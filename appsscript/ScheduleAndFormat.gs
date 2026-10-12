/**
 * ScheduleAndFormat.gs - the 2.5 hour refresh, and the Management
 * Report's house style.
 *
 * TWO THINGS, BOTH ASKED FOR ON 12 OCT
 *
 *   1. The sheet and the leaderboard update by themselves every two and
 *      a half hours, starting at 10:30.
 *   2. The Management Report sits centred, every block carries an outer
 *      border, and the four lines at the top are bold.
 *
 * WHY THE SCHEDULE IS SIX SEPARATE TRIGGERS
 *
 *   Apps Script only offers everyHours with a whole number, so two and a
 *   half hours cannot be expressed as an interval at all. Six triggers at
 *   fixed times give exactly the asked-for cadence and, unlike an
 *   interval, they do not drift every time the project is redeployed.
 *
 *     10:30   13:00   15:30   18:00   20:30   23:00
 *
 *   Google fires a time trigger within about fifteen minutes of the hour
 *   asked for, so treat these as "around then" rather than to the minute.
 *
 * WHAT A RUN DOES
 *
 *   Exactly what fixEverything does by hand - the model, the pages, then
 *   the board's cache - but it REFUSES when the roster has collapsed.
 *   On 7 Oct a rebuild ran while the CBC import was returning nothing and
 *   took every page to 1.6 L from 25 L. That must never be something a
 *   timer can do unattended at 03:00.
 */

var SF_TIMES = [[10, 30], [13, 0], [15, 30], [18, 0], [20, 30], [23, 0]];
var SF_HANDLER = 'scheduledRefresh';


/* ==================================================================
   1.  INSTALL THE SCHEDULE
   ================================================================== */

function installSchedule() {
  var all = ScriptApp.getProjectTriggers();

  var mine = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === SF_HANDLER) mine++;
  }
  if (mine) {
    Logger.log('Already installed - ' + mine + ' trigger(s) for ' + SF_HANDLER + '.');
    Logger.log('Run removeSchedule() first if you want to change the times.');
    return;
  }

  /* A project is capped at 20 triggers. Hitting the cap throws part way
     through, which would leave half a schedule installed and no sign of
     it, so check before adding any. */
  var room = 20 - all.length;
  if (room < SF_TIMES.length) {
    Logger.log('*** ' + all.length + ' triggers already exist and the limit is 20.');
    Logger.log('    This needs ' + SF_TIMES.length + ' and there is room for ' + room + '.');
    Logger.log('    Nothing was added. Clear some out first - the clock icon in');
    Logger.log('    the left sidebar lists them.');
    return;
  }

  for (var t = 0; t < SF_TIMES.length; t++) {
    ScriptApp.newTrigger(SF_HANDLER).timeBased()
      .atHour(SF_TIMES[t][0]).nearMinute(SF_TIMES[t][1]).everyDays(1).create();
  }

  Logger.log('Installed ' + SF_TIMES.length + ' daily triggers for ' + SF_HANDLER + ':');
  Logger.log('  ' + SF_TIMES.map(function (x) {
    return sf_pad2_(x[0]) + ':' + sf_pad2_(x[1]);
  }).join('   '));
  Logger.log('');
  Logger.log('Google fires these within about fifteen minutes of the time asked');
  Logger.log('for, so treat them as "around then".');
  Logger.log('Triggers were ' + all.length + ', now ' + (all.length + SF_TIMES.length) + ' of 20.');
}


function removeSchedule() {
  var all = ScriptApp.getProjectTriggers(), gone = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === SF_HANDLER) {
      ScriptApp.deleteTrigger(all[i]); gone++;
    }
  }
  Logger.log(gone ? ('Removed ' + gone + ' trigger(s). Nothing updates by itself now.')
                  : 'There was no schedule to remove.');
}


function showSchedule() {
  var all = ScriptApp.getProjectTriggers();
  Logger.log('=== TRIGGERS ===   ' + all.length + ' of 20');
  var mine = 0;
  for (var i = 0; i < all.length; i++) {
    var h = all[i].getHandlerFunction();
    if (h === SF_HANDLER) mine++;
    Logger.log('  ' + h);
  }
  Logger.log('');
  Logger.log(mine ? ('  ' + mine + ' of them are the 2.5 hour refresh.')
                  : '  The 2.5 hour refresh is NOT installed. Run installSchedule().');
}


/* ==================================================================
   2.  WHAT EACH RUN DOES
   ================================================================== */

function scheduledRefresh() {
  var t0 = new Date();
  Logger.log('=== SCHEDULED REFRESH ===   ' +
             Utilities.formatDate(t0, WR_TZ, 'dd MMM HH:mm'));

  /* THE GUARD. On 7 Oct a rebuild ran while the CBC roster import was
     returning nothing, and every page fell to 1.6 L from 25 L. A timer
     firing unattended at 23:00 must not be able to do that. */
  if (typeof wra_look_ === 'function') {
    var s = wra_look_();
    if (!s.error && s.rosterBroken) {
      Logger.log('*** SKIPPED. The roster is ' + s.roster + ' agents, was ' + s.good + '.');
      Logger.log('    That is a CBC import that has not landed, not people leaving.');
      Logger.log('    Rebuilding now would empty every page, so nothing was touched.');
      Logger.log('    The next run in 2.5 hours will pick it up.');
      return;
    }
    Logger.log('  roster ' + s.roster + ' agents - healthy, going ahead.');
  } else {
    /* Said every run rather than once, because a timer nobody watches is
       exactly where a missing guard goes unnoticed until a morning like
       the 7th. */
    Logger.log('  !! war-room-autosync.gs is not in this project, so the roster');
    Logger.log('     guard is NOT running. If the CBC import fails mid-rebuild,');
    Logger.log('     this will write empty pages the way 7 Oct did. Paste that');
    Logger.log('     file - it is what makes this safe to leave unattended.');
  }

  if (typeof updateAndCheck === 'function') {
    try { updateAndCheck(); }
    catch (e) { Logger.log('*** updateAndCheck failed: ' + e.message); }
  } else {
    Logger.log('*** no updateAndCheck in this project.');
  }

  if (typeof buildManagementReport === 'function') {
    try { buildManagementReport(); }
    catch (e2) { Logger.log('*** buildManagementReport failed: ' + e2.message); }
  }

  /* The house style has to be re-applied every time, because the report
     is cleared and rewritten on each build and takes its formatting with
     it. Last, so it dresses the finished page. */
  try { formatManagementReport(); }
  catch (e3) { Logger.log('*** formatting failed: ' + e3.message); }

  if (typeof warRoomRefreshNow === 'function') {
    try { warRoomRefreshNow(); }
    catch (e4) { Logger.log('*** cache clear failed: ' + e4.message); }
  }

  Logger.log('done in ' + Math.round((new Date() - t0) / 1000) + 's');
}


/* ==================================================================
   3.  THE HOUSE STYLE
   ================================================================== */

/**
 * Centre the page, box every block, bold the four lines at the top.
 *
 * BLOCKS ARE FOUND, NOT HARDCODED
 *
 *   The report grows - a manager joins, a batch is added - so a border
 *   drawn at fixed row numbers would be in the wrong place by the next
 *   build. Instead the used rows are read and split into runs separated
 *   by blank lines, which is exactly what a person sees as a block.
 */
function formatManagementReport() {
  var ss = SpreadsheetApp.getActive();
  var tab = (typeof MR_TAB === 'string') ? MR_TAB : 'Management Report';
  var sh = ss.getSheetByName(tab);
  if (!sh) { Logger.log('formatManagementReport: no "' + tab + '" tab.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 2) { Logger.log('formatManagementReport: nothing on it.'); return; }

  var vals = sh.getRange(1, 1, lastRow, lastCol).getValues();

  /* ---- everything centred ---- */
  sh.getRange(1, 1, lastRow, lastCol)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  /* ---- clear the old boxes, so a shrunk report leaves none behind ---- */
  sh.getRange(1, 1, Math.max(lastRow, sh.getMaxRows()), lastCol)
    .setBorder(false, false, false, false, false, false);

  /* ---- find each block, and box it ---- */
  var blocks = sf_blocks_(vals), b;
  for (b = 0; b < blocks.length; b++) {
    var blk = blocks[b];
    sh.getRange(blk.top, blk.left, blk.rows, blk.cols)
      .setBorder(true, true, true, true, false, false,
                 '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }

  /* ---- the four lines at the top, bold ---- */
  var head = sf_headRows_(vals);
  for (var h = 0; h < head.length; h++) {
    sh.getRange(head[h], 1, 1, lastCol).setFontWeight('bold');
  }

  SpreadsheetApp.flush();
  Logger.log('formatManagementReport: ' + blocks.length + ' block(s) boxed, ' +
             head.length + ' header line(s) bold, page centred.');
}


/**
 * A block is a run of rows with something in them, bounded by blank
 * rows. Columns are trimmed to what the block actually uses, so a narrow
 * block does not get a border stretching across the whole page.
 */
function sf_blocks_(vals) {
  var out = [], run = null;

  for (var r = 0; r < vals.length; r++) {
    var left = -1, right = -1;
    for (var c = 0; c < vals[r].length; c++) {
      if (String(vals[r][c]).trim() !== '') { if (left < 0) left = c; right = c; }
    }
    if (left < 0) {                       // blank row - closes a run
      if (run) { out.push(run); run = null; }
      continue;
    }
    if (!run) run = { top: r + 1, bot: r + 1, left: left, right: right };
    else {
      run.bot = r + 1;
      if (left  < run.left)  run.left  = left;
      if (right > run.right) run.right = right;
    }
  }
  if (run) out.push(run);

  /* A single stray line is not a block worth boxing. */
  var keep = [];
  for (var i = 0; i < out.length; i++) {
    var o = out[i];
    o.rows = o.bot - o.top + 1;
    o.left = o.left + 1;
    o.cols = (o.right + 1) - o.left + 1;
    if (o.rows >= 2 && o.cols >= 2) keep.push(o);
  }
  return keep;
}


/**
 * The four lines at the top of the page - Report Dated, Committed For,
 * Delivered So Far, and the month-on-month line.
 *
 * Found by their labels rather than by row number, because an extra
 * blank line at the top would otherwise bold the wrong four rows.
 */
function sf_headRows_(vals) {
  var want = ['report dated', 'committed for', 'delivered so far', 'mtd '];
  var rows = [];
  for (var r = 0; r < vals.length && r < 20; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      var t = String(vals[r][c]).trim().toLowerCase();
      if (!t) continue;
      for (var w = 0; w < want.length; w++) {
        if (t.indexOf(want[w]) === 0) { rows.push(r + 1); break; }
      }
      break;                              // first filled cell decides the row
    }
  }
  return rows;
}


function sf_pad2_(n) { n = String(n); return n.length < 2 ? '0' + n : n; }


/* ==================================================================
   4.  CHECK THE BLOCK FINDER WITHOUT A SHEET
   ================================================================== */

function scheduleAndFormatSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  /* the shape of the real page: four header lines, then blocks */
  var v = [
    ['', '', '', ''],
    ['', '', 'Report Dated', '12-Oct-2026'],
    ['', '', '', ''],
    ['', '', 'Committed For Oct', '4.16 cr'],
    ['', '', 'Delivered So Far', '0.70 cr'],
    ['', '', '', ''],
    ['', '', 'MTD Oct V/s Sept', 'We are behind by 4.7L'],
    ['', '', '', ''],
    ['', '', 'Same window', 'October 2026'],
    ['', '', 'Total revenue', '69.43 L'],
    ['', '', 'Units', 71],
    ['', '', '', ''],
    ['', '', 'Location Wise', 'Agents'],
    ['', '', 'Bangalore', 16],
    ['', '', 'Bhubaneswar', 22]
  ];

  var blocks = sf_blocks_(v);
  eq('three blocks found', blocks.length, 3);
  eq('the top block starts at row 4', blocks[0].top, 4);
  eq('and is two rows tall', blocks[0].rows, 2);
  eq('the revenue block starts at row 9', blocks[1].top, 9);
  eq('and is three rows tall', blocks[1].rows, 3);
  eq('the location block starts at 13', blocks[2].top, 13);
  eq('blocks start at the first used column', blocks[0].left, 3);
  eq('and are only as wide as they are used', blocks[0].cols, 2);

  /* a lone line is not a block */
  eq('a single line is not boxed', sf_blocks_([['', 'x'], ['', '']]).length, 0);

  var head = sf_headRows_(v);
  eq('four header lines', head.length, 4);
  eq('Report Dated is row 2', head[0], 2);
  eq('Committed For is row 4', head[1], 4);
  eq('Delivered So Far is row 5', head[2], 5);
  eq('the MTD line is row 7', head[3], 7);

  eq('times are padded', sf_pad2_(0), '00');
  eq('and not mangled', sf_pad2_(30), '30');
  eq('six slots, 2.5 hours apart', SF_TIMES.length, 6);
  var mins = SF_TIMES.map(function (x) { return x[0] * 60 + x[1]; });
  var okGap = true;
  for (var i = 1; i < mins.length; i++) if (mins[i] - mins[i - 1] !== 150) okGap = false;
  eq('every gap is exactly 150 minutes', okGap, true);
  eq('the first is 10:30', mins[0], 630);

  if (fails.length) {
    Logger.log('SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('SELF TEST PASSED');
    Logger.log('  blocks are found by their blank lines, the four header lines by');
    Logger.log('  their labels, and the six slots are 150 minutes apart from 10:30.');
  }
  return fails;
}
