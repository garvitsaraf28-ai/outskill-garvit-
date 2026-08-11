/**
 * Scheduled Slack reports for the Inside Sales sheet.
 *
 * Two independent windows, each stepping 2.5 hours:
 *
 *   Day    11:30  14:00  16:30  19:00  21:30
 *   Night  19:30  22:00  00:30  03:00  05:30
 *
 * CURRENT STATE: each firing posts a test message naming the window and the
 * time it fired. That is deliberate — it proves the schedule and the Slack
 * path work before any real content depends on them. See buildReport_ below
 * for the single place to swap in the actual report, and runSchedule_ for
 * where to re-enable the sheet refresh.
 *
 * Why fixed clock times rather than an interval
 * ---------------------------------------------
 * Apps Script's everyHours() only accepts 1, 2, 4, 6, 8 or 12, so a 2.5-hour
 * interval cannot be expressed with it — which is why the schedule had
 * settled at 2 hours. Fixed daily triggers give the exact spacing, stay
 * anchored to their start time, and one failed run cannot break the sequence
 * because each trigger is independent.
 *
 * Google fires time triggers within roughly 15 minutes of the stated time,
 * so read these as "around 11:30", not to the second.
 *
 * Setup:
 *   1. Make sure slack-digest.gs is in this project and SLACK_CHANNEL_EMAIL
 *      is set, then run testSlack() once to confirm delivery works.
 *   2. Run installAllSchedules().
 *   3. Run showAllSchedules() to confirm what is installed.
 */

/** Spacing between runs within a window. 150 minutes = 2.5 hours. */
var INTERVAL_MINUTES = 150;

/**
 * The refresh sequence, run in order.
 *
 * refreshAndVerify is what the existing trigger calls and it demonstrably
 * updates the Command Centre. It does not rebuild exec_Snapshot: on 11 Aug a
 * refresh stamped the Command Centre at 18:26 while exec_Snapshot stayed at
 * 15:59, which is why the Executive page reads stale while every other page
 * looks current.
 *
 * buildExecSnapshot is therefore called after it, explicitly, rather than
 * trusting any one entry point to cover both.
 */
var REFRESH_SEQUENCE = ['refreshAndVerify', 'buildExecSnapshot'];

/** Kept for the older trigger-cleanup helpers. */
var REFRESH_FUNCTION = 'refreshAndVerify';

/**
 * The two windows. `first` is the opening run, `runs` is how many firings
 * follow at INTERVAL_MINUTES spacing. Times past midnight wrap around, which
 * is what carries the night window through to 05:30.
 */
var SCHEDULES = {
  DAY: {
    label: 'Day',
    handler: 'runDaySchedule',
    first: { hour: 11, minute: 30 },
    runs: 5
  },
  NIGHT: {
    label: 'Night',
    handler: 'runNightSchedule',
    first: { hour: 19, minute: 30 },
    runs: 5
  }
};

/* ------------------------------------------------------------------ *
 * What each firing sends
 * ------------------------------------------------------------------ */

/**
 * Placeholder report.
 *
 * Replace the body of this function when the real report is defined. Both
 * windows call it, so whatever it returns is what lands in Slack. To give
 * the two windows different content, branch on `label` — it is 'Day' or
 * 'Night'.
 */
function buildReport_(label, firedAt) {
  return [
    label + ' schedule fired at ' + firedAt + ' IST.',
    '',
    'This is a test message. Report content is not wired up yet.',
    '',
    'Window: ' + scheduleTimes_(scheduleByLabel_(label)).map(formatTime_).join('  '),
    SpreadsheetApp.getActive().getUrl()
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Trigger entry points
 *
 * One per window, so the two schedules can be installed, inspected and
 * removed independently.
 * ------------------------------------------------------------------ */

function runDaySchedule() {
  runSchedule_('DAY');
}

function runNightSchedule() {
  runSchedule_('NIGHT');
}

function runSchedule_(key) {
  var schedule = SCHEDULES[key];
  var firedAt = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd-MMM-yyyy HH:mm'
  );

  // Refresh first, report second. This is what keeps exec_Snapshot current:
  // the pre-existing trigger calls refreshAndVerify alone, which updates the
  // Command Centre and leaves the snapshot behind, so the sequence has to run
  // from here. Failures are captured rather than thrown, so a broken step
  // still gets reported to Slack instead of dying in the execution log.
  var failures = [];
  try {
    callRefresh_().forEach(function (r) {
      if (r.status !== 'ok') failures.push(r.name + ': ' + r.status);
    });
  } catch (err) {
    failures.push('refresh sequence: ' + (err && err.message ? err.message : String(err)));
  }
  if (failures.length) {
    Logger.log('%s — %s', schedule.label, failures.join(' | '));
  }

  postToSlack_(
    '[' + schedule.label + '] Schedule test — ' + firedAt,
    buildReport_(schedule.label, firedAt)
  );
}

/**
 * Refresh now, and report what each step did.
 *
 * Run this to bring exec_Snapshot back in line with the Command Centre
 * without waiting for a schedule. Each step is timed and its outcome
 * recorded, so a step that fails names itself instead of stopping the rest.
 */
function runRefreshNow() {
  var results = callRefresh_();
  Logger.log('REFRESH SEQUENCE');
  results.forEach(function (r) {
    Logger.log('  %s — %s (%ss)', r.name, r.status, r.seconds);
  });
  var failed = results.filter(function (r) { return r.status !== 'ok'; });
  Logger.log('');
  Logger.log(failed.length ? '%s step(s) failed.' : 'All steps completed.', failed.length);
  Logger.log('Check exec_Snapshot — generatedAt should now match the Command Centre.');
  return results;
}

/**
 * Run every function in REFRESH_SEQUENCE, in order.
 *
 * A failing step is recorded and the sequence continues, because the steps
 * are independent — a broken verify should not stop the snapshot rebuild
 * that the Executive page depends on.
 */
function callRefresh_() {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var results = [];

  REFRESH_SEQUENCE.forEach(function (name) {
    var started = new Date().getTime();
    var fn = g[name];

    if (typeof fn !== 'function') {
      results.push({ name: name, status: 'MISSING — no such function', seconds: 0 });
      return;
    }

    try {
      fn();
      results.push({
        name: name,
        status: 'ok',
        seconds: ((new Date().getTime() - started) / 1000).toFixed(1)
      });
    } catch (err) {
      results.push({
        name: name,
        status: 'FAILED — ' + (err && err.message ? err.message : String(err)),
        seconds: ((new Date().getTime() - started) / 1000).toFixed(1)
      });
    }
  });

  return results;
}

/* ------------------------------------------------------------------ *
 * Install / inspect / remove
 * ------------------------------------------------------------------ */

/**
 * Install the schedules and write the outcome to Drive.
 *
 * installAllSchedules() has run twice without any trigger appearing, and its
 * only output is the execution log, which cannot be read from outside the
 * project. This does the same install, captures whatever it throws, and
 * writes the before and after trigger lists to schedule_install.txt in the
 * SuperLeap Feed folder, so the failure can be seen rather than inferred.
 */
function installAllSchedulesToDrive() {
  var out = [];
  var stamp;
  try {
    stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm:ss');
  } catch (e) {
    stamp = new Date().toISOString();
  }

  out.push('SCHEDULE INSTALL');
  out.push('Generated ' + stamp);
  out.push('');

  out.push('BEFORE');
  out.push('  ' + triggerSummary_());
  out.push('');

  out.push('ATTEMPT');
  try {
    Object.keys(SCHEDULES).forEach(function (key) {
      var s = SCHEDULES[key];
      try {
        var removed = clearHandler_(s.handler);
        var times = scheduleTimes_(s);
        times.forEach(function (t) {
          ScriptApp.newTrigger(s.handler)
            .timeBased()
            .atHour(t.hour)
            .nearMinute(t.minute)
            .everyDays(1)
            .create();
        });
        out.push('  ' + s.label + ': removed ' + removed + ', created ' + times.length +
          ' at ' + times.map(formatTime_).join(' '));
      } catch (err) {
        out.push('  ' + s.label + ': FAILED — ' + (err && err.message ? err.message : String(err)));
      }
    });
  } catch (err) {
    out.push('  OUTER FAILURE — ' + (err && err.message ? err.message : String(err)));
  }
  out.push('');

  out.push('AFTER');
  out.push('  ' + triggerSummary_());
  out.push('');
  out.push('Time zone: ' + Session.getScriptTimeZone());

  var text = out.join('\n');
  Logger.log(text);

  var folder = null;
  try {
    folder = DriveApp.getFolderById(DIAG_FOLDER_ID);
  } catch (e) {}
  var name = 'schedule_install.txt';
  if (folder) {
    var old = folder.getFilesByName(name);
    while (old.hasNext()) old.next().setTrashed(true);
    folder.createFile(name, text, MimeType.PLAIN_TEXT);
  } else {
    DriveApp.createFile(name, text, MimeType.PLAIN_TEXT);
  }
  Logger.log('\nWritten to %s', name);
}

function triggerSummary_() {
  try {
    var ts = ScriptApp.getProjectTriggers();
    if (!ts.length) return 'none';
    var counts = {};
    ts.forEach(function (t) {
      var h = t.getHandlerFunction();
      counts[h] = (counts[h] || 0) + 1;
    });
    return Object.keys(counts).sort().map(function (h) {
      return h + ' x' + counts[h];
    }).join(', ');
  } catch (err) {
    return 'ERROR — ' + err.message;
  }
}

/** Fire both windows once, right now, without waiting for a trigger. */
function testBothSchedules() {
  runDaySchedule();
  runNightSchedule();
  Logger.log('Both test messages sent. Check the channel.');
}

/** Install both windows. Safe to re-run — clears its own triggers first. */
function installAllSchedules() {
  var total = 0;
  Object.keys(SCHEDULES).forEach(function (key) {
    total += installSchedule_(key);
  });
  Logger.log('');
  Logger.log('%s trigger(s) installed. Time zone: %s', total, Session.getScriptTimeZone());
  Logger.log('Confirm the time zone is India Standard Time, or every time above is wrong.');
}

function installDaySchedule() {
  installSchedule_('DAY');
}

function installNightSchedule() {
  installSchedule_('NIGHT');
}

function installSchedule_(key) {
  var schedule = SCHEDULES[key];
  var removed = clearHandler_(schedule.handler);
  var times = scheduleTimes_(schedule);

  times.forEach(function (t) {
    ScriptApp.newTrigger(schedule.handler)
      .timeBased()
      .atHour(t.hour)
      .nearMinute(t.minute)
      .everyDays(1)
      .create();
  });

  Logger.log(
    '%s — removed %s, installed %s: %s',
    schedule.label,
    removed,
    times.length,
    times.map(formatTime_).join('  ')
  );
  return times.length;
}

/**
 * Remove every trigger this file installs, plus any left pointing directly
 * at the refresh function — that last part clears the old 2-hour trigger,
 * which would otherwise keep firing alongside the new schedules.
 */
function removeAllSchedules() {
  var n = 0;
  Object.keys(SCHEDULES).forEach(function (key) {
    n += clearHandler_(SCHEDULES[key].handler);
  });
  var legacy = clearHandler_(REFRESH_FUNCTION);
  Logger.log(
    'Removed %s schedule trigger(s) and %s legacy %s trigger(s).',
    n, legacy, REFRESH_FUNCTION
  );
}

/** Print the real installed state alongside what this file intends. */
function showAllSchedules() {
  Logger.log('Time zone: %s', Session.getScriptTimeZone());
  Logger.log('');

  Logger.log('Intended:');
  Object.keys(SCHEDULES).forEach(function (key) {
    var s = SCHEDULES[key];
    Logger.log('  %s — %s', s.label, scheduleTimes_(s).map(formatTime_).join('  '));
  });
  Logger.log('');

  var triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    Logger.log('Installed: none. Run installAllSchedules().');
    return;
  }

  var counts = {};
  triggers.forEach(function (t) {
    var h = t.getHandlerFunction();
    counts[h] = (counts[h] || 0) + 1;
  });

  Logger.log('Installed (%s total):', triggers.length);
  Object.keys(counts).forEach(function (h) {
    var note = h === REFRESH_FUNCTION ? '   <-- legacy 2-hour trigger, remove this' : '';
    Logger.log('  %s x%s%s', h, counts[h], note);
  });
}

function clearHandler_(name) {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === name) {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  return n;
}

/* ------------------------------------------------------------------ */

/** Step INTERVAL_MINUTES from the window's first run, wrapping past midnight. */
function scheduleTimes_(schedule) {
  var out = [];
  var minutes = schedule.first.hour * 60 + schedule.first.minute;
  for (var i = 0; i < schedule.runs; i++) {
    var m = ((minutes % 1440) + 1440) % 1440;
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
    minutes += INTERVAL_MINUTES;
  }
  return out;
}

function scheduleByLabel_(label) {
  var keys = Object.keys(SCHEDULES);
  for (var i = 0; i < keys.length; i++) {
    if (SCHEDULES[keys[i]].label === label) return SCHEDULES[keys[i]];
  }
  return SCHEDULES.DAY;
}

function formatTime_(t) {
  return ('0' + t.hour).slice(-2) + ':' + ('0' + t.minute).slice(-2);
}
