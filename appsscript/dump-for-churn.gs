/**
 * One-off inspection for the churn report build.
 *
 * Writes the structure of the three tabs the churn report depends on to
 * churn_inputs.txt in the SuperLeap Feed folder, so the report can be built
 * against real column names rather than assumed ones.
 *
 * Read-only. Run dumpForChurn() once and say so.
 */

var CHURN_DUMP_FILENAME = 'churn_inputs.txt';

/** Tabs to inspect, and how many data rows to sample from each. */
var CHURN_DUMP_TABS = [
  { name: 'Agent Directory', rows: 45 },
  { name: 'Workshop Months', rows: 30 },
  { name: 'SuperLeap Churn', rows: 8 },
  { name: 'SuperLeap Stage', rows: 8 },
  { name: 'mdl_Batches', rows: 30 },
  { name: 'DN Batch Map', rows: 30 }
];

/**
 * Batch codes look like C160 / C155. Workshop Months turned out to hold
 * revenue by month rather than codes, so rather than guessing which tab
 * carries them, scan every tab and report where they actually live.
 */
var BATCH_CODE_RE = /^C\s?\d{2,4}$/i;

/** Same code, but anywhere inside a longer label. Used only as a fallback. */
var BATCH_CODE_EMBEDDED_RE = /\bC\s?\d{2,4}\b/i;

/** Bound the scan so a large tab cannot time the script out. */
var SCAN_MAX_ROWS = 2000;
var SCAN_MAX_COLS = 40;

/**
 * Report every column containing batch codes, as "tab / column / header",
 * with a few sample codes and a distinct count. The column holding the most
 * distinct codes is the join key the churn report needs.
 */
function findBatchCodeColumns(ss, out) {
  out.push('================================================');
  out.push('BATCH CODE LOCATIONS');
  out.push('');

  var found = scanColumnsFor(ss, out, BATCH_CODE_RE, 'exact');

  // The codes may be embedded in a longer label ("Cohort C160 - Mar"), which
  // the exact match misses. Falling back here means one run settles the
  // question either way instead of costing another round trip.
  if (!found) {
    out.push('  No bare codes. Retrying against labels that contain one.');
    out.push('');
    found = scanColumnsFor(ss, out, BATCH_CODE_EMBEDDED_RE, 'embedded');
  }

  if (!found) {
    out.push('  NONE FOUND — no tab holds anything shaped like a batch code.');
  }
  out.push('');
}

/**
 * Report every column whose cells match `re`, as "tab / column / header",
 * with sample values and a distinct count. The column holding the most
 * distinct codes is the join key the churn report needs.
 * Returns the number of matching columns.
 */
function scanColumnsFor(ss, out, re, label) {
  var found = 0;

  ss.getSheets().forEach(function (sh) {
    var lastRow = Math.min(sh.getLastRow(), SCAN_MAX_ROWS);
    var lastCol = Math.min(sh.getLastColumn(), SCAN_MAX_COLS);
    if (!lastRow || !lastCol) return;

    var values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    // Walk column-first: a join key lives in one column, not scattered.
    for (var c = 0; c < lastCol; c++) {
      var distinct = {};
      var samples = [];
      var firstRow = 0;

      for (var r = 0; r < lastRow; r++) {
        var cell = String(values[r][c]).trim();
        if (!re.test(cell)) continue;
        if (!firstRow) firstRow = r + 1;
        if (!distinct[cell.toUpperCase()]) {
          distinct[cell.toUpperCase()] = true;
          if (samples.length < 6) samples.push(cell);
        }
      }

      var count = Object.keys(distinct).length;
      if (!count) continue;

      found++;
      var header = String(values[0][c]).trim() || '(no header)';
      out.push('  [' + label + '] ' + sh.getName() +
        ' / col ' + columnLetter(c + 1) +
        ' / header "' + header + '"');
      out.push('      ' + count + ' distinct, first at row ' + firstRow +
        ', e.g. ' + samples.join(', '));
    }
  });

  return found;
}

/** 1 -> A, 27 -> AA. Apps Script has no built-in for this. */
function columnLetter(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}

function dumpForChurn() {
  var ss = SpreadsheetApp.getActive();
  var out = [];

  out.push('CHURN REPORT INPUTS');
  out.push('Generated ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
    'dd-MMM-yyyy HH:mm:ss'));
  out.push('');

  out.push('ALL TABS');
  ss.getSheets().forEach(function (sh) {
    out.push('  ' + sh.getName());
  });
  out.push('');

  // Early, so it survives a truncated execution log — this is the open question.
  findBatchCodeColumns(ss, out);

  CHURN_DUMP_TABS.forEach(function (spec) {
    out.push('================================================');
    out.push('TAB: ' + spec.name);

    var sh = ss.getSheetByName(spec.name);
    if (!sh) {
      out.push('  NOT FOUND');
      out.push('');
      return;
    }

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    out.push('  ' + lastRow + ' rows x ' + lastCol + ' cols');
    out.push('');

    if (!lastRow || !lastCol) {
      out.push('  (empty)');
      out.push('');
      return;
    }

    var rows = Math.min(lastRow, spec.rows);
    var cols = Math.min(lastCol, 25);
    var values = sh.getRange(1, 1, rows, cols).getDisplayValues();

    values.forEach(function (row, i) {
      // Trim trailing blanks so the dump stays readable.
      var trimmed = row.slice();
      while (trimmed.length && String(trimmed[trimmed.length - 1]).trim() === '') {
        trimmed.pop();
      }
      if (!trimmed.length) return;
      out.push('  r' + (i + 1) + ' | ' + trimmed.join(' | '));
    });
    out.push('');
  });

  var text = out.join('\n');
  Logger.log(text);

  var folder = null;
  try {
    folder = DriveApp.getFolderById(DIAG_FOLDER_ID);
  } catch (e) {}

  if (folder) {
    var old = folder.getFilesByName(CHURN_DUMP_FILENAME);
    while (old.hasNext()) old.next().setTrashed(true);
    folder.createFile(CHURN_DUMP_FILENAME, text, MimeType.PLAIN_TEXT);
  } else {
    DriveApp.createFile(CHURN_DUMP_FILENAME, text, MimeType.PLAIN_TEXT);
  }

  Logger.log('\nWritten to %s', CHURN_DUMP_FILENAME);
}
