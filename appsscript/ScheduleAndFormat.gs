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
 * WHY IT IS ONE TRIGGER AND NOT SIX
 *
 *   Apps Script only offers everyHours with a whole number, so two and a
 *   half hours cannot be expressed as an interval, and the obvious answer
 *   is six triggers at fixed times. This project cannot afford six: it
 *   already holds 21 against a ceiling of 20.
 *
 *   So one trigger wakes every half hour and the FUNCTION decides whether
 *   this is a slot. One trigger, the same six times, and 20 lines of
 *   arithmetic instead of five more of a scarce resource.
 *
 *     10:30   13:00   15:30   18:00   20:30   23:00
 *
 *   Google fires a time trigger within about fifteen minutes of the time
 *   asked for, so a slot is counted as open for 25 minutes after it and
 *   the date-and-slot of the last run is remembered. A late wake still
 *   runs its slot; a slot never runs twice.
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

/** How long after a slot it may still run, in minutes. Google's firing
    window is about fifteen; 25 leaves room without reaching the next. */
var SF_GRACE = 25;

/** Where the last slot actually run is remembered. */
var SF_PROP = 'SF_LAST_SLOT';


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
    Logger.log('Already installed. Run removeSchedule() first to change it.');
    return;
  }

  if (all.length >= 20) {
    Logger.log('*** ' + all.length + ' triggers already exist and the ceiling is 20.');
    Logger.log('    This needs ONE and there is no room for it.');
    Logger.log('');
    Logger.log('    retireOldSchedule() frees six by removing the old');
    Logger.log('    warRoomScheduledUpdate slots, which this replaces - it rebuilds');
    Logger.log('    the same model at 10:00, 13:30, 17:00, 20:30, 00:00 and 03:30,');
    Logger.log('    and running both would only mean rebuilding twice.');
    Logger.log('');
    Logger.log('    showSchedule() lists everything that is installed.');
    return;
  }

  ScriptApp.newTrigger(SF_HANDLER).timeBased().everyMinutes(30).create();

  Logger.log('Installed. One trigger wakes every 30 minutes; the function runs');
  Logger.log('only on these slots:');
  Logger.log('  ' + SF_TIMES.map(function (x) {
    return sf_pad2_(x[0]) + ':' + sf_pad2_(x[1]);
  }).join('   '));
  Logger.log('');
  Logger.log('A wake that is not a slot costs one property read and stops.');
  Logger.log('Triggers were ' + all.length + ', now ' + (all.length + 1) + ' of 20.');
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

  /* Most wakes are not a slot. Decide first and cheaply, so twenty-four
     hours of half-hourly wakes cost almost nothing. */
  var slot = sf_dueSlot_(t0);
  if (!slot) return;

  Logger.log('=== SCHEDULED REFRESH ===   ' +
             Utilities.formatDate(t0, WR_TZ, 'dd MMM HH:mm') +
             '   (slot ' + slot.label + ')');
  sf_markRun_(slot.key);

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


/**
 * Which slot, if any, this wake belongs to.
 *
 * A slot is open from its own time until SF_GRACE minutes after it, so a
 * trigger Google fires late still does its job. The date and the slot of
 * the last run are stored together, so a slot cannot run twice and
 * yesterday's record cannot suppress today's.
 */
function sf_dueSlot_(now) {
  var day  = Utilities.formatDate(now, WR_TZ, 'yyyy-MM-dd');
  var mins = Number(Utilities.formatDate(now, WR_TZ, 'H')) * 60 +
             Number(Utilities.formatDate(now, WR_TZ, 'm'));

  var best = null;
  for (var i = 0; i < SF_TIMES.length; i++) {
    var at = SF_TIMES[i][0] * 60 + SF_TIMES[i][1];
    var since = mins - at;
    if (since < 0 || since > SF_GRACE) continue;
    /* If two somehow overlap, the later one wins - it is the more
       current of the two. */
    if (!best || at > best.at) {
      best = { at: at, label: sf_pad2_(SF_TIMES[i][0]) + ':' + sf_pad2_(SF_TIMES[i][1]) };
    }
  }
  if (!best) return null;

  best.key = day + ' ' + best.label;
  if (sf_lastRun_() === best.key) return null;      // this slot already ran
  return best;
}

function sf_lastRun_() {
  try { return PropertiesService.getScriptProperties().getProperty(SF_PROP) || ''; }
  catch (e) { return ''; }
}

function sf_markRun_(key) {
  try { PropertiesService.getScriptProperties().setProperty(SF_PROP, key); }
  catch (e) {}
}


/**
 * Free six trigger slots by retiring the old schedule this replaces.
 *
 * warRoomScheduledUpdate rebuilds the same model at 10:00, 13:30, 17:00,
 * 20:30, 00:00 and 03:30. Running both would rebuild twice for no gain,
 * and this project is at 21 triggers against a ceiling of 20.
 *
 * Reversible: warRoomAddUpdateTriggers() puts them back.
 */
function retireOldSchedule() {
  var all = ScriptApp.getProjectTriggers();
  Logger.log('=== RETIRE THE OLD SCHEDULE ===   ' + all.length + ' trigger(s) now');
  Logger.log('');

  var gone = 0, kept = {};
  for (var i = 0; i < all.length; i++) {
    var h = all[i].getHandlerFunction();
    if (h === 'warRoomScheduledUpdate') {
      ScriptApp.deleteTrigger(all[i]); gone++;
    } else {
      kept[h] = (kept[h] || 0) + 1;
    }
  }

  if (!gone) {
    Logger.log('  No warRoomScheduledUpdate triggers found - nothing removed.');
  } else {
    Logger.log('  Removed ' + gone + ' warRoomScheduledUpdate trigger(s).');
    Logger.log('  warRoomAddUpdateTriggers() puts them back if ever needed.');
  }
  Logger.log('');
  Logger.log('  STILL INSTALLED');
  var k, names = [];
  for (k in kept) names.push(k);
  names.sort();
  for (var j = 0; j < names.length; j++) {
    Logger.log('    ' + sf_pad2_(kept[names[j]]) + ' x  ' + names[j]);
  }
  Logger.log('');
  Logger.log('  ' + (all.length - gone) + ' of 20 used. Now run installSchedule().');
}


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
