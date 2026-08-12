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
  { name: 'SuperLeap Stage', rows: 8 }
];

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
