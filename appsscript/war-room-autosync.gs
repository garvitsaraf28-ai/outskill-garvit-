/**
 * AUTO-SYNC, with a guard against rebuilding from a broken import.
 *
 * WHAT WENT WRONG ON 7 OCT
 *
 *   A rebuild ran while the CBC roster IMPORTRANGE was returning nothing.
 *   updateAndCheck said so in its own log - "CBC read ZERO for every
 *   agent. The roster import did not land this run" - and rebuilt the
 *   pages anyway. Every figure in this project counts roster agents and
 *   nobody else, so an empty roster means almost no revenue: the board
 *   and the Management Report both fell to 1.6 L from 25.03 L.
 *
 *   The data was never lost. mdl_Payments was untouched. The pages were
 *   simply built against a roster that was briefly empty.
 *
 *   The first version of this file called updateAndCheck whenever the
 *   import had more rows than the model, with no opinion about whether
 *   the roster was sane. Left alone it would have done this again every
 *   thirty minutes. That is worse than the problem it was written for,
 *   and it is my fault.
 *
 * THE GUARD
 *
 *   The last healthy roster size is remembered. A rebuild is refused if
 *   this month's roster has collapsed to under 70% of it - an import
 *   that half-landed is far more likely than thirty people leaving
 *   overnight - and the refusal is logged loudly rather than passed over.
 *
 *   Payments are guarded the same way: the model is never rebuilt from an
 *   import holding fewer rows than the model already has.
 *
 * THE FUNCTIONS
 *
 *   warRoomSyncStatus   READ ONLY. Roster health and how far behind the
 *                       model is. Start here.
 *   warRoomSyncNow      Rebuild, but only if the import moved AND the
 *                       roster is sane.
 *   warRoomInstallSync  Run warRoomSyncNow every 30 minutes.
 *   warRoomRemoveSync   Stop it.
 *   warRoomForceSync    Rebuild even if the guard says no. For when the
 *                       roster really has shrunk and you mean it.
 */

var WRA_EVERY_MINUTES = 30;
var WRA_HANDLER = 'warRoomSyncNow';

/** Refuse a rebuild below this share of the last healthy roster. */
var WRA_MIN_ROSTER_FRACTION = 0.70;

/** Where the last healthy roster size is remembered. */
var WRA_PROP = 'WRA_GOOD_ROSTER';


/* ==================================================================
   1.  STATUS - read only
   ================================================================== */

function warRoomSyncStatus() {
  var s = wra_look_();
  Logger.log('=== SYNC STATUS ===   ' +
             Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  Logger.log('  Read only. Nothing was written.');
  Logger.log('');

  if (s.error) { Logger.log('  *** ' + s.error); return false; }

  Logger.log('  ROSTER');
  Logger.log('    agents this month  : ' + s.roster);
  Logger.log('    last healthy size  : ' + (s.good || '(not recorded yet)'));
  if (s.rosterBroken) {
    Logger.log('    *** THE ROSTER HAS COLLAPSED. Almost certainly the CBC');
    Logger.log('        IMPORTRANGE half-landed. DO NOT REBUILD until it');
    Logger.log('        recovers - every page would fall to near zero.');
    Logger.log('        Wait a few minutes and run this again.');
  } else {
    Logger.log('    healthy            OK');
  }
  Logger.log('');

  Logger.log('  PAYMENTS');
  Logger.log('    import this month  : ' + s.srcRows + ' rows');
  Logger.log('    model this month   : ' + s.mdlRows + ' rows');
  if (s.behind) {
    Logger.log('    *** BEHIND BY ' + s.behind + ' ROW(S) - run warRoomSyncNow');
  } else {
    Logger.log('    up to date         OK');
  }
  Logger.log('');

  if (!s.rosterBroken && !s.behind) {
    Logger.log('  Everything is current. If a screen still looks wrong it is not');
    Logger.log('  the data - rebuild the Management Report and run');
    Logger.log('  warRoomRefreshNow for the TV.');
  }
  return !s.behind && !s.rosterBroken;
}


/* ==================================================================
   2.  REBUILD, GUARDED
   ================================================================== */

function warRoomSyncNow() { wra_run_(false); }

/** Rebuild even if the roster looks collapsed. Only when you mean it. */
function warRoomForceSync() { wra_run_(true); }


function wra_run_(force) {
  var s = wra_look_();
  if (s.error) { Logger.log('AUTO-SYNC: ' + s.error); return; }

  /* THE GUARD. A roster that has lost a third of its people since the
     last healthy run is an import that half-landed, not thirty
     resignations. Rebuilding from it empties every page. */
  if (s.rosterBroken && !force) {
    Logger.log('AUTO-SYNC: *** REFUSING TO REBUILD.');
    Logger.log('  roster is ' + s.roster + ' agents, was ' + s.good +
               ' when last healthy.');
    Logger.log('  That is an IMPORTRANGE that has not landed, not people leaving.');
    Logger.log('  Rebuilding now would take every page to near zero, so nothing');
    Logger.log('  was touched. It usually recovers within a few minutes.');
    Logger.log('  If the roster really has shrunk, run warRoomForceSync.');
    return;
  }

  if (!s.behind && !force) {
    Logger.log('AUTO-SYNC: model is current (' + s.mdlRows + ' rows this month).');
    return;
  }

  /* And never rebuild from an import that holds LESS than the model. */
  if (s.srcRows < s.mdlRows && !force) {
    Logger.log('AUTO-SYNC: *** REFUSING - the import holds fewer rows (' + s.srcRows +
               ') than the model (' + s.mdlRows + '). That is the import,');
    Logger.log('  not a real drop. Nothing was touched.');
    return;
  }

  Logger.log('AUTO-SYNC: rebuilding (' + s.behind + ' row(s) behind, roster ' +
             s.roster + ').');
  if (typeof updateAndCheck !== 'function') {
    Logger.log('AUTO-SYNC: *** no updateAndCheck in this project. Nothing ran.');
    return;
  }
  updateAndCheck();

  if (typeof warRoomRefreshNow === 'function') {
    try { warRoomRefreshNow(); } catch (e) {
      Logger.log('AUTO-SYNC: rebuilt, but the cache would not clear: ' + e.message);
    }
  }

  /* Remember this roster only if it stayed healthy through the run. */
  var after = wra_look_();
  if (!after.error && !after.rosterBroken) wra_remember_(after.roster);
  Logger.log('AUTO-SYNC: done. roster ' + after.roster + ', ' +
             after.srcRows + ' rows this month in the import, ' +
             after.mdlRows + ' in the model.');
}


/* ==================================================================
   3.  THE TRIGGER
   ================================================================== */

function warRoomInstallSync() {
  var all = ScriptApp.getProjectTriggers(), already = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === WRA_HANDLER) already++;
  }
  if (already) {
    Logger.log('Already installed. Use warRoomRemoveSync first to change it.');
    return;
  }
  if (all.length >= 19) {
    Logger.log('*** ' + all.length + ' triggers already, limit is 20. Not adding one.');
    return;
  }
  ScriptApp.newTrigger(WRA_HANDLER).timeBased()
    .everyMinutes(WRA_EVERY_MINUTES).create();
  Logger.log('Installed. ' + WRA_HANDLER + ' runs every ' + WRA_EVERY_MINUTES +
             ' minutes, and refuses to rebuild from a collapsed roster.');
}

function warRoomRemoveSync() {
  var all = ScriptApp.getProjectTriggers(), gone = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === WRA_HANDLER) {
      ScriptApp.deleteTrigger(all[i]); gone++;
    }
  }
  Logger.log(gone ? ('Removed ' + gone + ' auto-sync trigger(s). The model now only')
                  : 'There was no auto-sync trigger to remove.');
  if (gone) Logger.log('updates when updateAndCheck is run by hand.');
}


/* ==================================================================
   4.  LOOKING
   ================================================================== */

function wra_look_() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  var src = wra_find_(ss, true), mdl = wra_find_(ss, false);
  if (!src) return { error: 'no raw payments import tab found' };
  if (!mdl) return { error: 'no model tab found' };

  var a = wra_count_(src, monthKey), b = wra_count_(mdl, monthKey);
  var roster = wra_roster_(ss, monthKey);
  var good = wra_good_();

  return {
    srcRows: a, mdlRows: b, behind: Math.max(0, a - b),
    roster: roster, good: good,
    rosterBroken: (good > 0 && roster < good * WRA_MIN_ROSTER_FRACTION)
  };
}

/** How many agents mdl_Roster holds for this month. */
function wra_roster_(ss, monthKey) {
  var sh = ss.getSheetByName(WR_ROSTER_TAB);
  if (!sh || sh.getLastRow() < 2) return 0;
  var grid = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var H = wr_headers_(grid[0]);
  var cAgent = wr_col_(H, ['agent', 'agent name', 'name']);
  var cMonth = wr_monthCol_(grid);
  if (cAgent < 0) return 0;
  var seen = {}, n = 0;
  for (var r = 1; r < grid.length; r++) {
    var nm = wr_str_(grid[r][cAgent]);
    if (!nm) continue;
    if (cMonth >= 0 && wr_monthKey_(grid[r][cMonth]) !== monthKey) continue;
    var k = wr_key_(nm);
    if (seen[k]) continue;
    seen[k] = 1; n++;
  }
  return n;
}

function wra_good_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(WRA_PROP);
    return v ? Number(v) : 0;
  } catch (e) { return 0; }
}

function wra_remember_(n) {
  if (!(n > 0)) return;
  try {
    var was = wra_good_();
    if (n >= was) PropertiesService.getScriptProperties().setProperty(WRA_PROP, String(n));
  } catch (e) {}
}

function wra_count_(t, monthKey) {
  var vals = t.sheet.getRange(t.headerRow + 2, t.dateCol + 1, t.n, 1).getValues();
  var rows = 0;
  for (var i = 0; i < vals.length; i++) {
    var d = vals[i][0];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKey_(d) === monthKey) rows++;
  }
  return rows;
}

function wra_find_(ss, wantCustomer) {
  var tabs = ss.getSheets(), best = null;
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 3) continue;
    var look = sh.getRange(1, 1, Math.min(25, lastRow), lastCol).getValues();
    for (var hr = 0; hr < look.length; hr++) {
      var H = wr_headers_(look[hr]);
      var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
      var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner']);
      var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr']);
      if (cDate < 0 || cAgent < 0 || cAmt < 0) continue;
      var hasCust = (H['payment email id'] !== undefined) ||
                    (H['payment email'] !== undefined) ||
                    (H['name'] !== undefined);
      if (hasCust !== !!wantCustomer) continue;
      var n = lastRow - (hr + 1);
      if (n < 1) continue;
      if (best && best.n >= n) continue;
      best = { sheet: sh, headerRow: hr, dateCol: cDate, n: n };
      break;
    }
  }
  return best;
}
