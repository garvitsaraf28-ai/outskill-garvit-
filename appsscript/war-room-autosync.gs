/**
 * AUTO-SYNC - the actual fix.
 *
 * WHAT WENT WRONG, IN ONE PARAGRAPH
 *
 *   Nothing was broken in the board, the Management Report, the roster or
 *   the feed. Payments land in the tracker all day - six landed while we
 *   were looking at it - and mdl_Payments only changes when updateAndCheck
 *   runs. Between runs every screen is short, and not one of them says so.
 *   That is how 9.90 L belonging to five agents was missing all morning
 *   while the board reported "no sale recorded today yet".
 *
 *   So the repair is not in any screen. It is to rebuild the model when
 *   the import has moved, and to say loudly when that has not happened.
 *
 * THE FOUR FUNCTIONS
 *
 *   warRoomSyncStatus()   READ ONLY. How far behind is the model right now.
 *   warRoomSyncNow()      Rebuilds, but ONLY if the import has moved ahead.
 *   warRoomInstallSync()  Runs warRoomSyncNow every 30 minutes from now on.
 *   warRoomRemoveSync()   Takes that trigger away again.
 *
 *   Start with warRoomSyncStatus. It writes nothing and tells you whether
 *   anything needs doing.
 *
 * SAFETY
 *
 *   Reads this workbook only - never CBC, never the Payment Tracker.
 *   warRoomSyncNow calls the project's own updateAndCheck, the same one
 *   that has been run by hand all along, and only when the import is
 *   genuinely ahead. Nothing here writes a cell itself.
 */

/** How often the model gets checked against the import, in minutes. */
var WRA_EVERY_MINUTES = 30;

/** The trigger's handler name. One per project - a second would double-run. */
var WRA_HANDLER = 'warRoomSyncNow';


/* ==================================================================
   1.  IS THE MODEL BEHIND?  - read only
   ================================================================== */

function warRoomSyncStatus() {
  var s = wra_compare_();
  Logger.log('=== IS THE MODEL BEHIND THE IMPORT? ===   ' +
             Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  Logger.log('  Read only. Nothing was written.');
  Logger.log('');

  if (s.error) { Logger.log('  *** ' + s.error); return false; }

  Logger.log('  import ' + wr_pad_(s.srcName, 16) + wr_pad_(s.srcRows + ' rows this month', 26) +
             'newest ' + (s.srcNewest || '-'));
  Logger.log('  model  ' + wr_pad_(s.mdlName, 16) + wr_pad_(s.mdlRows + ' rows this month', 26) +
             'newest ' + (s.mdlNewest || '-'));
  Logger.log('');

  if (!s.behind) {
    Logger.log('  UP TO DATE. The model has every row the import has for this month.');
    Logger.log('  If a screen still looks wrong it is not the data - rebuild the');
    Logger.log('  Management Report, and run warRoomRefreshNow() for the TV, which');
    Logger.log('  caches its answer for several minutes.');
  } else {
    Logger.log('  *** BEHIND BY ' + s.behind + ' ROW(S).');
    Logger.log('      That money is in the tracker and on no screen. Every page in');
    Logger.log('      this workbook is short by it, and so is the leaderboard.');
    Logger.log('      Run warRoomSyncNow() to fix it now, and warRoomInstallSync()');
    Logger.log('      so it stops happening.');
  }
  Logger.log('');
  return !s.behind;
}


/* ==================================================================
   2.  REBUILD, BUT ONLY IF IT IS NEEDED
   ================================================================== */

function warRoomSyncNow() {
  var s = wra_compare_();
  if (s.error) { Logger.log('AUTO-SYNC: ' + s.error); return; }

  if (!s.behind) {
    Logger.log('AUTO-SYNC: model is current (' + s.mdlRows + ' rows this month). ' +
               'Nothing to do.');
    return;
  }

  Logger.log('AUTO-SYNC: behind by ' + s.behind + ' row(s) - rebuilding.');

  /* The project's own command, the same one run by hand all along. If it
     is ever renamed this says so rather than failing silently, which is
     the exact failure mode being fixed here. */
  if (typeof updateAndCheck !== 'function') {
    Logger.log('AUTO-SYNC: *** updateAndCheck not found in this project. Nothing ran.');
    return;
  }
  updateAndCheck();

  /* The feed holds its answer for several minutes, so a rebuilt model
     still reaches the TV late unless the cache is dropped too. */
  if (typeof warRoomRefreshNow === 'function') {
    try { warRoomRefreshNow(); } catch (e) {
      Logger.log('AUTO-SYNC: rebuilt, but could not clear the feed cache: ' + e.message);
    }
  }

  var after = wra_compare_();
  if (after.error) { Logger.log('AUTO-SYNC: rebuilt. ' + after.error); return; }
  if (after.behind) {
    Logger.log('AUTO-SYNC: *** STILL BEHIND BY ' + after.behind + ' AFTER REBUILDING.');
    Logger.log('           updateAndCheck is not picking these rows up. Run');
    Logger.log('           warRoomLostRows() to see which ones.');
  } else {
    Logger.log('AUTO-SYNC: done. Model now holds all ' + after.srcRows +
               ' of this month\'s rows.');
  }
}


/* ==================================================================
   3.  MAKE IT HAPPEN ON ITS OWN
   ================================================================== */

function warRoomInstallSync() {
  var all = ScriptApp.getProjectTriggers();

  var already = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === WRA_HANDLER) already++;
  }
  if (already) {
    Logger.log('Already installed (' + already + ' trigger). Nothing added.');
    Logger.log('Use warRoomRemoveSync() first if you want to change the interval.');
    return;
  }

  /* A project is capped at 20 triggers and this one has a lot already.
     Hitting the cap throws halfway through, so check before adding. */
  if (all.length >= 19) {
    Logger.log('*** ' + all.length + ' triggers already exist and the limit is 20.');
    Logger.log('    Not adding one. Remove something first - Triggers in the left');
    Logger.log('    sidebar (the clock icon) lists them.');
    return;
  }

  ScriptApp.newTrigger(WRA_HANDLER).timeBased()
    .everyMinutes(WRA_EVERY_MINUTES).create();

  Logger.log('Installed. ' + WRA_HANDLER + ' now runs every ' + WRA_EVERY_MINUTES +
             ' minutes.');
  Logger.log('It rebuilds ONLY when the import has moved ahead, so a quiet hour');
  Logger.log('costs nothing. Triggers were ' + all.length + ', now ' + (all.length + 1) +
             ' of 20.');
}


function warRoomRemoveSync() {
  var all = ScriptApp.getProjectTriggers(), gone = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === WRA_HANDLER) {
      ScriptApp.deleteTrigger(all[i]); gone++;
    }
  }
  Logger.log(gone ? ('Removed ' + gone + ' auto-sync trigger(s). The model will now')
                  : 'There was no auto-sync trigger to remove.');
  if (gone) Logger.log('only update when updateAndCheck is run by hand.');
}


/* ==================================================================
   4.  THE COMPARISON ITSELF
   ================================================================== */

/**
 * Count this month's rows in the import and in the model.
 *
 * Reads the DATE COLUMN ALONE from each - one narrow read rather than
 * 15,000 rows of everything, so this is cheap enough to run every half
 * hour without the trigger becoming the slow thing in the project.
 */
function wra_compare_() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  var src = wra_find_(ss, true), mdl = wra_find_(ss, false);
  if (!src) return { error: 'No raw payments import tab found (expected src_Payments).' };
  if (!mdl) return { error: 'No model tab found (expected mdl_Payments).' };

  var a = wra_count_(src, monthKey), b = wra_count_(mdl, monthKey);
  return {
    srcName: src.name, mdlName: mdl.name,
    srcRows: a.rows, mdlRows: b.rows,
    srcNewest: a.newest, mdlNewest: b.newest,
    behind: Math.max(0, a.rows - b.rows)
  };
}


function wra_count_(t, monthKey) {
  var vals = t.sheet.getRange(t.headerRow + 2, t.dateCol + 1, t.n, 1).getValues();
  var rows = 0, newest = null;
  for (var i = 0; i < vals.length; i++) {
    var d = vals[i][0];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (!newest || d.getTime() > newest.getTime()) newest = d;
    if (wr_monthKey_(d) === monthKey) rows++;
  }
  return { rows: rows, newest: newest ? Utilities.formatDate(newest, WR_TZ, 'dd MMM') : '' };
}


/**
 * Find the import tab or the model tab by their columns, not their names.
 * The import carries a customer and the model does not - the one
 * structural difference that survives a rename - and the import's header
 * sits below a preamble rather than on row 1.
 */
function wra_find_(ss, wantCustomer) {
  var tabs = ss.getSheets(), best = null;

  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3 || lastCol < 3) continue;

    var look = sh.getRange(1, 1, Math.min(25, lastRow), lastCol).getValues();
    for (var hr = 0; hr < look.length; hr++) {
      var H = wr_headers_(look[hr]);
      var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
      var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner']);
      var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr']);
      if (cDate < 0 || cAgent < 0 || cAmt < 0) continue;

      /* Exact only - wr_col_ falls back to substrings and 'name' is a
         substring of Agent Name, Batch Name, First Name. */
      var hasCust = (H['payment email id'] !== undefined) ||
                    (H['payment email'] !== undefined) ||
                    (H['name'] !== undefined);
      if (hasCust !== !!wantCustomer) continue;

      var n = lastRow - (hr + 1);
      if (n < 1) continue;
      if (best && best.n >= n) continue;

      best = { name: sh.getName(), sheet: sh, headerRow: hr, dateCol: cDate, n: n };
      break;
    }
  }
  return best;
}
