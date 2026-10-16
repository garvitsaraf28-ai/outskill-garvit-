/**
 * showReportNow - READ ONLY. Prints the Management Report as text.
 *
 * I have been guessing at what "still the same" means and guessing is
 * what has made today long. This prints the actual page - every row that
 * has anything on it, with its row number and column letters - so the
 * answer comes from the sheet instead of from me.
 *
 * It writes nothing. Run it and send the log.
 */
function showReportNow() {
  var ss = SpreadsheetApp.getActive();
  var tab = (typeof MR_TAB === 'string') ? MR_TAB : 'Management Report';
  var sh = ss.getSheetByName(tab);
  if (!sh) { Logger.log('No "' + tab + '" tab in this workbook.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  Logger.log('=== ' + tab + ' ===   ' +
             Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  Logger.log('  ' + lastRow + ' rows x ' + lastCol + ' columns in use');
  Logger.log('');

  /* Display values, not raw ones: this is about what a person sees on
     the page, which is the thing in dispute. */
  var v = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  for (var r = 0; r < v.length; r++) {
    var cells = [];
    for (var c = 0; c < v[r].length; c++) {
      var t = String(v[r][c]).trim();
      if (t) cells.push(srn_col_(c) + ':' + t);
    }
    if (cells.length) Logger.log('  ' + srn_pad_(String(r + 1), 4) + cells.join('  |  '));
  }

  Logger.log('');
  Logger.log('  WHAT I AM LOOKING FOR');
  Logger.log('    - a row with "Booked" or "To Come" on it  -> the columns did not go');
  Logger.log('    - a row with "CBC vs this sheet"          -> the new block landed');
  Logger.log('    - what "Total revenue" actually reads');
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

function srn_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

function srn_col_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m) / 26 | 0; }
  return s;
}
