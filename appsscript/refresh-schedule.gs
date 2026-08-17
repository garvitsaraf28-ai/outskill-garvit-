/**
 * Scheduled Slack reports for the Inside Sales sheet.
 *
 * Two reports, on three independent windows:
 *
 *   Disposition Update   Day    11:30  14:00  16:30  19:00  21:30
 *                        Night  19:30  22:00  00:30  03:00  05:30
 *   Agent Lead Status           11:00  19:00  20:00  04:00
 *
 * Disposition Update reports money from the Command Centre and refreshes
 * first; buildReport_ writes it, below. Agent Lead Status reports where the
 * leads sit per agent and is written by buildAgentLeadReport_ in
 * agent-lead-report.gs.
 *
 * Which builder runs, and whether the refresh sequence runs before it, are
 * both properties of the window in SCHEDULES - runSchedule_ reads them rather
 * than knowing about either report.
 *
 * Why fixed clock times rather than an interval
 * ---------------------------------------------
 * Apps Script's everyHours() only accepts 1, 2, 4, 6, 8 or 12, so a 2.5-hour
 * interval cannot be expressed with it - which is why the schedule had
 * settled at 2 hours. Fixed daily triggers give the exact spacing, stay
 * anchored to their start time, and one failed run cannot break the sequence
 * because each trigger is independent.
 *
 * Google fires time triggers within roughly 15 minutes of the stated time,
 * so read these as "around 11:30", not to the second.
 *
 * Setup:
 *   1. Make sure slack-digest.gs is in this project and SLACK_WEBHOOK_URL is
 *      set, then run testWebhook() once to confirm delivery works.
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
 * The windows.
 *
 * `label` names the window in the logs; `report` is the name that appears in
 * Slack, so the two 2.5-hour windows post under one report name while staying
 * separately installable. `builder` is the function that writes the message.
 *
 * A window is timed either by `first` + `runs` at INTERVAL_MINUTES spacing - 
 * times past midnight wrap around, which is what carries Night through to
 * 05:30 - or by explicit `times` where the spacing is not regular.
 *
 * AGENT_LEAD does not run the refresh sequence. That sequence rebuilds the
 * Command Centre and exec_Snapshot, which this report does not read; the
 * SuperLeap Churn tab it does read is on its own two-hour refresh. Running it
 * anyway would add four heavy rebuilds a day for figures nobody reads from
 * them. The report carries its source snapshot time so staleness is visible.
 */
var SCHEDULES = {
  DAY: {
    label: 'Day',
    report: 'Disposition Update',
    handler: 'runDaySchedule',
    builder: 'buildReport_',
    refresh: true,
    first: { hour: 11, minute: 30 },
    runs: 5
  },
  NIGHT: {
    label: 'Night',
    report: 'Disposition Update',
    handler: 'runNightSchedule',
    builder: 'buildReport_',
    refresh: true,
    first: { hour: 19, minute: 30 },
    runs: 5
  },
  AGENT_LEAD: {
    label: 'Agent Lead',
    report: 'Agent Lead Status',
    handler: 'runAgentLeadSchedule',
    builder: 'buildAgentLeadReport_',
    refresh: false,
    times: [
      { hour: 11, minute: 0 },
      { hour: 19, minute: 0 },
      { hour: 20, minute: 0 },
      { hour: 4, minute: 0 }
    ]
  }
};

/* ------------------------------------------------------------------ *
 * What each firing sends
 * ------------------------------------------------------------------ */

/** Where the previous run's revenue is kept, to compute the delta. */
var LAST_REVENUE_PROP = 'LAST_REPORTED_REVENUE';

/**
 * The report.
 *
 * Ten posts a day means a static snapshot becomes wallpaper, so the first
 * line after the headline is what changed since the previous post. The
 * previous figure is kept in Script Properties; the first run has nothing to
 * compare against and says so rather than showing a misleading +0.
 */
function buildReport_(label, firedAt) {
  var cc = findCommandCentre_();

  var revenue = get_(cc, 'Revenue');
  var delta = revenueDelta_(revenue);

  var lines = [];
  lines.push('As at ' + firedAt + ' IST   (' + label + ')');

  // A report of dashes looks like real data at a glance. If the headline
  // figure did not resolve, say so and name the tab that was read, rather
  // than posting something that reads as a genuine zero.
  //
  // Test for "carries no digit" rather than for get_'s placeholder. The two
  // used to be a matched pair of the same dash character in two different
  // files, which meant changing the placeholder in one silently disabled
  // the warning in the other. A figure with no digit in it did not resolve,
  // whatever the placeholder happens to be today.
  if (!/\d/.test(String(revenue))) {
    lines.push('');
    lines.push('!! Could not read the figures. Tab read was "' +
      cc.sheet.getName() + '". Numbers below are not reliable.');
  }

  lines.push('');

  lines.push('Revenue        ' + revenue);
  lines.push('Since last     ' + delta);
  lines.push('Target         ' + get_(cc, 'Target'));
  lines.push('Attainment     ' + get_(cc, 'Attainment'));
  lines.push('Gap            ' + get_(cc, 'Gap to target'));
  lines.push('');

  lines.push('Day ' + get_(cc, 'Days elapsed') + ' of ' + get_(cc, 'Days in month') +
    '   (' + get_(cc, 'Days remaining') + ' left)');
  lines.push('Running at     ' + get_(cc, 'Daily rate achieved') + ' / day');
  lines.push('Needs          ' + get_(cc, 'Daily rate needed') + ' / day');
  lines.push('On track for   ' + get_(cc, 'Projected month end'));
  lines.push('');

  lines.push('Domestic       ' + get_(cc, 'Domestic'));
  lines.push('International  ' + get_(cc, 'International'));
  lines.push('Others         ' + get_(cc, 'Others'));
  lines.push('');

  lines.push('Units ' + get_(cc, 'Units') + '   avg ticket ' + get_(cc, 'Average ticket'));

  // The subject is the only part visible without opening the message in a
  // notification or channel list, so it carries the headline rather than
  // describing the mechanism that sent it.
  var subject = '[' + label + '] Inside Sales  ' + revenue +
    '   ' + get_(cc, 'Attainment') + ' of target';
  if (delta !== 'no change' && delta.charAt(0) === '+') {
    subject += '   ' + delta;
  }

  return { subject: subject, body: lines.join('\n') };
}

/**
 * Change in revenue since the previous post, and remember the new figure.
 *
 * Display strings carry commas and may carry a currency symbol, so the
 * comparison is done on digits only. Anything unparseable is reported as
 * such rather than silently becoming zero.
 */
function revenueDelta_(displayValue) {
  var props = PropertiesService.getScriptProperties();
  var previousRaw = props.getProperty(LAST_REVENUE_PROP);
  var current = toNumber_(displayValue);

  if (current === null) {
    return '(could not read revenue)';
  }

  props.setProperty(LAST_REVENUE_PROP, String(current));

  if (previousRaw === null) {
    return '(first report - no baseline yet)';
  }

  var previous = toNumber_(previousRaw);
  if (previous === null) return '(previous figure unreadable)';

  var diff = current - previous;
  if (diff === 0) return 'no change';

  var sign = diff > 0 ? '+' : '-';
  return sign + withCommas_(Math.abs(diff));
}

function toNumber_(v) {
  var digits = String(v).replace(/[^0-9.\-]/g, '');
  if (digits === '' || digits === '-' || digits === '.') return null;
  var n = Number(digits);
  return isNaN(n) ? null : n;
}

function withCommas_(n) {
  var s = String(Math.round(n));
  var out = '';
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s.charAt(i);
  }
  return out;
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

function runAgentLeadSchedule() {
  runSchedule_('AGENT_LEAD');
}

/**
 * A script gets 6 minutes. This is that, less enough headroom to finish
 * posting to Slack after the last thing that can block.
 */
var SCHEDULE_BUDGET_SECS = 330;

/**
 * How long to wait for the lock before giving up on refreshing.
 *
 * Short on purpose. If another firing is refreshing the same workbook from
 * the same sources, waiting the whole thing out to do it again is wasted
 * budget - the data will be current either way.
 */
var SCHEDULE_REFRESH_WAIT_SECS = 90;

/** Seconds held back for building and posting once the lock is in hand. */
var SCHEDULE_BUILD_RESERVE_SECS = 20;

/**
 * Run fn with the script lock held, so two firings cannot write the same
 * tabs at once.
 *
 * This is not theoretical. The installed times collide by design and by
 * jitter:
 *
 *   Day 19:00 and Agent Lead 19:00 are the same minute.
 *   Day 19:00 and Night 19:30, and Day 21:30 and Night 22:00, are 30
 *   minutes apart, and nearMinute() places a trigger within +/-15 minutes
 *   of the hour asked for - so either pair can land on the same minute.
 *   slpAutoRefresh runs on its own 2-hour clock that nothing here controls.
 *
 * Two concurrent refreshAndVerify runs write mdl_Roster, mdl_Payments and
 * mdl_Batches at the same time. A report that reads SuperLeap Churn while
 * slpAutoRefresh is between its clear() and its setValues() reads an empty
 * tab and posts a confident report with no agents in it. Neither failure
 * throws, so neither would appear anywhere except in the numbers.
 *
 * Returns true if fn ran, false if the lock never came.
 */
function withScheduleLock_(what, waitMs, fn) {
  var lock;
  try {
    lock = LockService.getScriptLock();
  } catch (err) {
    // No lock service available: better to do the work unguarded than to
    // skip the report entirely.
    Logger.log('%s - lock service unavailable, running unguarded: %s', what, err);
    fn();
    return true;
  }

  if (!lock.tryLock(waitMs)) return false;

  try {
    fn();
  } finally {
    lock.releaseLock();
  }
  return true;
}

function runSchedule_(key) {
  var schedule = SCHEDULES[key];
  var firedAt = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd-MMM-yyyy HH:mm'
  );

  var startedMs = new Date().getTime();
  function spentSecs() { return (new Date().getTime() - startedMs) / 1000; }

  // Refresh first, report second. This is what keeps exec_Snapshot current:
  // the pre-existing trigger calls refreshAndVerify alone, which updates the
  // Command Centre and leaves the snapshot behind, so the sequence has to run
  // from here. Failures are captured rather than thrown, so a broken step
  // still gets reported to Slack instead of dying in the execution log.
  if (schedule.refresh) {
    var failures = [];

    // Skipping the refresh when another firing holds the lock is not a
    // degradation. Whoever holds it is refreshing the same workbook from the
    // same sources, so by the time the report is built the data is current
    // either way. Running it twice concurrently is the only bad outcome.
    var ran = withScheduleLock_(schedule.label + ' refresh', SCHEDULE_REFRESH_WAIT_SECS * 1000, function () {
      try {
        callRefresh_().forEach(function (r) {
          if (r.status !== 'ok') failures.push(r.name + ': ' + r.status);
        });
      } catch (err) {
        failures.push('refresh sequence: ' + (err && err.message ? err.message : String(err)));
      }
    });

    if (!ran) Logger.log('%s - another refresh was already running; used its result', schedule.label);
    if (failures.length) Logger.log('%s - %s', schedule.label, failures.join(' | '));
  }

  // Build under the lock too. The Agent Lead report reads the SuperLeap
  // Churn tab, which slpAutoRefresh rebuilds on a clock this file does not
  // control, and a read landing inside that rebuild returns an empty tab.
  // Wait with whatever budget is actually left rather than a fixed number.
  // A firing that skipped its refresh has spent almost nothing and can
  // afford to wait the other run out; one that just refreshed for four
  // minutes cannot. A fixed wait gets this wrong at both ends - it made
  // Night, jittering onto Day, give up and post nothing at all.
  var reportWait = Math.max(
    15,
    SCHEDULE_BUDGET_SECS - spentSecs() - SCHEDULE_BUILD_RESERVE_SECS
  ) * 1000;

  var report = null;
  var built = withScheduleLock_(schedule.label + ' report', reportWait, function () {
    report = buildSchedule_(schedule, firedAt);
  });

  if (!built) {
    // Say so rather than posting numbers read from a tab mid-rebuild, and
    // rather than staying silent - a missing post looks like a broken
    // trigger and sends someone looking in the wrong place.
    report = {
      subject: '[' + schedule.report + '] skipped this run',
      body: 'As at ' + firedAt + ' IST\n\n' +
        '!! Another refresh was still running after ' +
        Math.round(reportWait / 1000) + ' seconds, so this report ' +
        'was not built. Reading the tabs mid-rebuild would have reported ' +
        'numbers that were not real. The next run is unaffected.'
    };
  }

  postToSlack_(report.subject, report.body);
}

/**
 * Build one schedule's message.
 *
 * A builder that throws would otherwise take the whole firing down silently,
 * leaving no post and only an execution-log entry nobody is watching. Report
 * the failure to Slack instead, naming the builder, so a broken report is as
 * visible as a working one.
 */
function buildSchedule_(schedule, firedAt) {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var builder = g[schedule.builder];

  if (typeof builder !== 'function') {
    return {
      subject: '[' + schedule.report + '] report unavailable',
      body: 'As at ' + firedAt + ' IST\n\n!! ' + schedule.builder +
        ' is not defined in this project, so there is nothing to report.'
    };
  }

  try {
    return builder(schedule.report, firedAt);
  } catch (err) {
    return {
      subject: '[' + schedule.report + '] report failed',
      body: 'As at ' + firedAt + ' IST\n\n!! ' + schedule.builder +
        ' failed: ' + (err && err.message ? err.message : String(err))
    };
  }
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
    Logger.log('  %s - %s (%ss)', r.name, r.status, r.seconds);
  });
  var failed = results.filter(function (r) { return r.status !== 'ok'; });
  Logger.log('');
  Logger.log(failed.length ? '%s step(s) failed.' : 'All steps completed.', failed.length);
  Logger.log('Check exec_Snapshot - generatedAt should now match the Command Centre.');
  return results;
}

/**
 * Run every function in REFRESH_SEQUENCE, in order.
 *
 * A failing step is recorded and the sequence continues, because the steps
 * are independent - a broken verify should not stop the snapshot rebuild
 * that the Executive page depends on.
 */
function callRefresh_() {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var results = [];

  REFRESH_SEQUENCE.forEach(function (name) {
    var started = new Date().getTime();
    var fn = g[name];

    if (typeof fn !== 'function') {
      results.push({ name: name, status: 'MISSING - no such function', seconds: 0 });
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
        status: 'FAILED - ' + (err && err.message ? err.message : String(err)),
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
        out.push('  ' + s.label + ': FAILED - ' + (err && err.message ? err.message : String(err)));
      }
    });
  } catch (err) {
    out.push('  OUTER FAILURE - ' + (err && err.message ? err.message : String(err)));
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
    return 'ERROR - ' + err.message;
  }
}

/** Fire both Disposition Update windows once, without waiting for a trigger. */
function testBothSchedules() {
  runDaySchedule();
  runNightSchedule();
  Logger.log('Both test messages sent. Check the channel.');
}

/** Fire Agent Lead Status once, without waiting for a trigger. */
function testAgentLeadReport() {
  runAgentLeadSchedule();
  Logger.log('Agent Lead Status sent. Check the channel.');
}

/** Install both windows. Safe to re-run - clears its own triggers first. */
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

function installAgentLeadSchedule() {
  installSchedule_('AGENT_LEAD');
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
    '%s - removed %s, installed %s: %s',
    schedule.label,
    removed,
    times.length,
    times.map(formatTime_).join('  ')
  );
  return times.length;
}

/**
 * Remove every trigger this file installs, plus any left pointing directly
 * at the refresh function - that last part clears the old 2-hour trigger,
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
    Logger.log('  %s - %s', s.label, scheduleTimes_(s).map(formatTime_).join('  '));
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

/**
 * The times a window fires: either its explicit list, or INTERVAL_MINUTES
 * steps from the first run, wrapping past midnight.
 */
function scheduleTimes_(schedule) {
  if (schedule.times) return schedule.times.slice();

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
