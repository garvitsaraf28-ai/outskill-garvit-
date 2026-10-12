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
