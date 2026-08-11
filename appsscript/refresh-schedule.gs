/**
 * Refresh schedule for the Inside Sales sheet.
 *
 * Runs the refresh every 2.5 hours through the working day, starting 11:30 IST:
 *
 *     11:30   14:00   16:30   19:00   21:30
 *
 * Why fixed clock times rather than an interval
 * ---------------------------------------------
 * Apps Script's everyHours() only accepts 1, 2, 4, 6, 8 or 12 — there is no
 * way to express 2.5 hours with it, which is why the schedule had settled at
 * 2 hours. Fixed daily triggers give the exact spacing instead.
 *
 * A self-rescheduling one-shot chain could hold 150-minute spacing around the
 * clock, but 24 hours is not divisible by 2.5, so it would walk off 11:30
 * within a day and start refreshing at 02:30. Fixed times stay anchored, and
 * a failed run cannot break the chain because each trigger is independent.
 *
 * Google fires time triggers within roughly 15 minutes of the stated time,
 * so treat these as "around 11:30", not to the second.
 *
 * Setup:
 *   1. Confirm REFRESH_FUNCTION below matches your refresh entry point.
 *   2. Run installRefreshTriggers() once.
 *   3. Run showRefreshSchedule() to confirm what is now installed.
 */

/** The function each trigger calls. Change this if your entry point differs. */
var REFRESH_FUNCTION = 'refreshEverything';

/** First run of the day, in the script's time zone. */
var FIRST_RUN = { hour: 11, minute: 30 };

/** Spacing between runs. 150 minutes = 2.5 hours. */
var INTERVAL_MINUTES = 150;

/** How many runs per day. 5 covers 11:30 through 21:30. */
var RUNS_PER_DAY = 5;

/* ------------------------------------------------------------------ */

/**
 * Install the schedule. Safe to re-run — it clears its own triggers first,
 * including the old 2-hour one, so you never end up with two schedules
 * refreshing on top of each other.
 */
function installRefreshTriggers() {
  if (typeof this[REFRESH_FUNCTION] !== 'function') {
    throw new Error(
      'No function named "' + REFRESH_FUNCTION + '" exists in this project. ' +
        'Set REFRESH_FUNCTION to your actual refresh entry point first.'
    );
  }

  var removed = clearRefreshTriggers_();

  var times = refreshTimes_();
  times.forEach(function (t) {
    ScriptApp.newTrigger(REFRESH_FUNCTION)
      .timeBased()
      .atHour(t.hour)
      .nearMinute(t.minute)
      .everyDays(1)
      .create();
  });

  Logger.log(
    'Removed %s old trigger(s) for %s, installed %s new one(s): %s (time zone %s).',
    removed,
    REFRESH_FUNCTION,
    times.length,
    times.map(formatTime_).join(', '),
    Session.getScriptTimeZone()
  );
}

/** Remove every trigger pointing at the refresh function. */
function removeRefreshTriggers() {
  Logger.log('Removed %s trigger(s) for %s.', clearRefreshTriggers_(), REFRESH_FUNCTION);
}

/** Print every trigger on the project, so you can see the real state. */
function showRefreshSchedule() {
  var triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    Logger.log('No triggers installed on this project.');
    return;
  }
  Logger.log('Time zone: %s', Session.getScriptTimeZone());
  Logger.log('%s trigger(s) installed:', triggers.length);
  triggers.forEach(function (t) {
    Logger.log('  %s  (%s)', t.getHandlerFunction(), String(t.getEventType()));
  });
  Logger.log('');
  Logger.log(
    'Intended refresh times for %s: %s',
    REFRESH_FUNCTION,
    refreshTimes_().map(formatTime_).join(', ')
  );
}

/* ------------------------------------------------------------------ */

function clearRefreshTriggers_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === REFRESH_FUNCTION) {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  return n;
}

/**
 * Build the run times by stepping INTERVAL_MINUTES from FIRST_RUN.
 * Any run that would spill past midnight is dropped rather than wrapping
 * into the small hours.
 */
function refreshTimes_() {
  var out = [];
  var minutes = FIRST_RUN.hour * 60 + FIRST_RUN.minute;
  for (var i = 0; i < RUNS_PER_DAY; i++) {
    if (minutes >= 24 * 60) break;
    out.push({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
    minutes += INTERVAL_MINUTES;
  }
  return out;
}

function formatTime_(t) {
  return ('0' + t.hour).slice(-2) + ':' + ('0' + t.minute).slice(-2);
}
