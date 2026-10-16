/**
 * ScheduleAndFormat.gs - the Management Report's house style.
 *
 * THE SCHEDULE TURNED OUT NOT TO NEED WRITING
 *
 *   This file started out installing its own triggers, and the project
 *   refused it: 21 triggers against a ceiling of 20. Reading what those
 *   triggers actually were settled it better than freeing a slot would
 *   have.
 *
 *   runDaySchedule already refreshes the whole workbook and then posts to
 *   Slack, five times a day, at INTERVAL_MINUTES spacing - and
 *   INTERVAL_MINUTES is 150. The 2.5 hour refresh asked for on 12 Oct
 *   already existed. It began at 11:30 rather than 10:30, so the floor
 *   had nothing fresh for its first hour, and that is the whole of what
 *   was wrong with it.
 *
 *   So refresh-schedule.gs got two one-line changes instead:
 *
 *     DAY.first        11:30  ->  10:30
 *                      giving 10:30, 13:00, 15:30, 18:00, 20:30
 *
 *     REFRESH_SEQUENCE gained buildManagementReport and
 *                      formatManagementReport
 *
 *   The second matters as much as the first. REFRESH_SEQUENCE was
 *   ['refreshAndVerify', 'buildExecSnapshot'] - the Management Report was
 *   never in it. refreshAndVerify rebuilds the model and most pages, but
 *   the board pack is built later by updateEverythingNow, so every
 *   scheduled run left the one page management actually reads sitting on
 *   the previous run's figures.
 *
 *   No new trigger. Nothing retired. Nothing to choose between.
 *
 * WHAT IS LEFT HERE
 *
 *   formatManagementReport, which the refresh sequence now calls on every
 *   run - and which you can run by hand any time.
 */


/* ==================================================================
   BOOKED AND TO COME - REMOVED
   ==================================================================

   Both read wrong and were taken off on 16 Oct.

   They were never comparable with Revenue. Revenue is cash that ARRIVED
   this month, including instalments on deals sold earlier. Booked is the
   full value of deals CLOSED this month, collected or not. Two different
   bases on one row invites the subtraction nobody should do, and the
   figures themselves could not be trusted either: Sale Price repeats on
   every instalment of a deal, so a three-part sale counts its own value
   three times unless exactly one row is picked, and which row that is
   depends on a unit flag that is not always set.

   WHY THIS IS AN OVERRIDE AND NOT AN EDIT

   ManagementReport.gs is six hundred lines and correct. Re-typing it to
   drop two columns is how a transcription error gets into a board pack.
   Apps Script runs every .gs into one scope and the last definition
   wins, so these four replace theirs and that file is not touched.

   All four must move together. MR_COLS names the columns, mr_metrics_
   produces one value per name, mr_display_ formats them and mr_formats_
   aligns them by position - a column removed from one and not the others
   shifts every figure one cell sideways, silently. The self test checks
   the four agree. */

var MR_COLS = ['Agents', 'Revenue', 'Target', 'Attain %', 'Gap', 'Units',
               'Avg Ticket', 'Rev / MM', 'Rev / Target Commitment'];

/** One value per entry in MR_COLS, in the same order. */
function mr_metrics_(x) {
  var mm = Number(x.mm || 0);
  return [x.n, x.rev, x.target,
          x.target ? x.rev / x.target : 0,
          x.rev - x.target,
          x.units,
          x.units ? x.rev / x.units : 0,
          mm > 0 ? x.rev / mm : 0,
          x.n ? x.target / x.n : 0];
}

/** The same row with the money shown in lakh / crore. */
function mr_display_(m) {
  return [m[0], mr_amt_(m[1]), mr_amt_(m[2]), m[3], mr_amt_(m[4]),
          m[5], mr_amt_(m[6]), mr_amt_(m[7]), mr_amt_(m[8])];
}

function mr_formats_(sh, row, col, n) {
  if (!n) return;
  sh.getRange(row, col,     n, 1).setNumberFormat('#,##0');       // agents
  sh.getRange(row, col + 3, n, 1).setNumberFormat('0.00%');       // attain
  sh.getRange(row, col + 5, n, 1).setNumberFormat('#,##0');       // units
  sh.getRange(row, col + 1, n, 2).setHorizontalAlignment('right');  // revenue, target
  sh.getRange(row, col + 4, n, 1).setHorizontalAlignment('right');  // gap
  /* avg ticket, rev / MM, target per agent - three now, not five */
  sh.getRange(row, col + 6, n, 3).setHorizontalAlignment('right');
}


/* ==================================================================
   CBC vs THIS SHEET, ON THE PAGE
   ==================================================================

   "The sheet is not updating" has cost more time than every real bug put
   together, and every time it has turned out to be the same thing: CBC
   counts deals managers have marked realised, this sheet counts money
   the Payment Tracker actually received. They are not the same number
   and never will be while a deal can be marked before it is collected.

   Comparing two screens by hand to rediscover that is the actual
   problem. So the comparison goes on the page, under the headline, and
   answers itself on every run. */
function addCbcLine() {
  var ss = SpreadsheetApp.getActive();
  var tab = (typeof MR_TAB === 'string') ? MR_TAB : 'Management Report';
  var sh = ss.getSheetByName(tab);
  if (!sh) return;
  if (typeof w3_roster_ !== 'function' || typeof w3_pay_ !== 'function') return;

  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var cbc = w3_roster_(ss, monthKey);
  var mdl = w3_pay_(ss, false);
  if (!cbc || !mdl) return;

  var B = w3_tally_(mdl, monthKey);
  var tc = 0, tb = 0, names = [], k;
  for (k in cbc.by) {
    var c = cbc.by[k].rev, b = (B[k] || { rev: 0 }).rev;
    tc += c; tb += b;
    if (c - b >= 1) names.push({ name: cbc.by[k].name, gap: c - b });
  }
  /* CBC importing as zero is a failed IMPORTRANGE, not a real gap -
     writing "CBC says 0" on a board pack would be worse than writing
     nothing at all. */
  if (!tc) return;

  names.sort(function (x, y) { return y.gap - x.gap; });
  var top = names.slice(0, 3).map(function (x) {
    return x.name + ' ' + mr_amt_(x.gap);
  }).join(',  ');

  var at = sh.getLastRow() + 2;
  var L = (typeof MR_C === 'object' && MR_C.LABEL) ? MR_C.LABEL : 3;
  sh.getRange(at,     L).setValue('CBC vs this sheet');
  sh.getRange(at,     L + 1).setValue(mr_amt_(tc - tb) + ' apart');
  sh.getRange(at + 1, L).setValue('CBC says');
  sh.getRange(at + 1, L + 1).setValue(mr_amt_(tc));
  sh.getRange(at + 2, L).setValue('Payments received');
  sh.getRange(at + 2, L + 1).setValue(mr_amt_(tb));
  sh.getRange(at + 3, L).setValue(names.length + ' agent(s) marked in CBC with no payment logged');
  if (top) sh.getRange(at + 4, L).setValue('Largest: ' + top);
  sh.getRange(at, L, 1, 2).setFontWeight('bold');

  Logger.log('  CBC line: ' + mr_amt_(tc) + ' vs ' + mr_amt_(tb) + ', ' +
             names.length + ' agent(s), ' + mr_amt_(tc - tb) + ' apart.');
}


/* ==================================================================
   THE HOUSE STYLE
   ================================================================== */

/**
 * Centre the page, box every block, bold the lines at the top.
 *
 * BLOCKS ARE FOUND, NOT HARDCODED
 *
 *   The report grows - a manager joins, a batch is added - so a border
 *   drawn at fixed row numbers would be in the wrong place by the next
 *   build. Instead the used cells are read and split into runs separated
 *   by blank rows, which is exactly what a person sees as a block.
 *
 *   It has to be re-applied on every build, because
 *   buildManagementReport clears the tab and rewrites it, taking the
 *   formatting with it. That is why it sits in REFRESH_SEQUENCE directly
 *   after buildManagementReport rather than being set once by hand.
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

  /* ---- clear the old boxes, so a report that shrinks leaves none ---- */
  sh.getRange(1, 1, Math.max(lastRow, sh.getMaxRows()), lastCol)
    .setBorder(false, false, false, false, false, false);

  /* ---- find each block, and box it ---- */
  var blocks = sf_blocks_(vals);
  for (var b = 0; b < blocks.length; b++) {
    var blk = blocks[b];
    sh.getRange(blk.top, blk.left, blk.rows, blk.cols)
      .setBorder(true, true, true, true, false, false,
                 '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }

  /* ---- the lines at the top, bold ---- */
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
 * table does not get a border stretching across the whole page.
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
 * The lines at the top of the page - Report Dated, Committed For,
 * Delivered So Far, and the month-on-month line.
 *
 * Found by their labels rather than by row number, because one extra
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


/* ==================================================================
   CHECK IT WITHOUT A SHEET
   ================================================================== */

function scheduleAndFormatSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  /* the shape of the real page */
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
  eq('a single line is not boxed', sf_blocks_([['', 'x'], ['', '']]).length, 0);

  var head = sf_headRows_(v);
  eq('four header lines', head.length, 4);
  eq('Report Dated is row 2', head[0], 2);
  eq('Committed For is row 4', head[1], 4);
  eq('Delivered So Far is row 5', head[2], 5);
  eq('the MTD line is row 7', head[3], 7);

  /* The schedule lives in refresh-schedule.gs now. Check it from here
     anyway: this is the file somebody reads when asking why the report
     is stale, and a sequence that has lost the report again should be
     caught by a test rather than by a wrong number on a Monday. */
  if (typeof REFRESH_SEQUENCE !== 'undefined') {
    eq('the refresh sequence rebuilds the report',
       REFRESH_SEQUENCE.indexOf('buildManagementReport') > -1, true);
    eq('and formats it afterwards',
       REFRESH_SEQUENCE.indexOf('formatManagementReport') >
       REFRESH_SEQUENCE.indexOf('buildManagementReport'), true);
  }
  if (typeof SCHEDULES !== 'undefined' && SCHEDULES.DAY) {
    eq('the day window starts at 10:30',
       SCHEDULES.DAY.first.hour + ':' + SCHEDULES.DAY.first.minute, '10:30');
  }
  if (typeof INTERVAL_MINUTES !== 'undefined') {
    eq('spaced 2.5 hours apart', INTERVAL_MINUTES, 150);
  }

  /* MR_COLS, mr_metrics_, mr_display_ and mr_formats_ are positional.
     One column dropped from some and not the others shifts every figure
     a cell sideways without anything throwing. */
  eq('Booked is gone', MR_COLS.indexOf('Booked'), -1);
  eq('To Come is gone', MR_COLS.indexOf('To Come'), -1);
  eq('nine columns left', MR_COLS.length, 9);
  var probe = mr_metrics_({ n: 7, rev: 5367310, target: 11400000, units: 30, mm: 5.5 });
  eq('one metric per column', probe.length, MR_COLS.length);
  eq('one displayed cell per column', mr_display_(probe).length, MR_COLS.length);
  eq('Rev / MM still sits eighth', MR_COLS.indexOf('Rev / MM'), 7);
  eq('rev per man-month', probe[7].toFixed(2), (5367310 / 5.5).toFixed(2));
  eq('no divide by zero without capacity',
     mr_metrics_({ n: 0, rev: 0, target: 0, units: 0, mm: 0 })[7], 0);

  if (fails.length) {
    Logger.log('SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('SELF TEST PASSED');
    Logger.log('  Blocks are found by their blank lines and the header lines by');
    Logger.log('  their labels. The refresh sequence rebuilds the report and');
    Logger.log('  formats it, and the day window starts at 10:30, 150 apart.');
  }
  return fails;
}
