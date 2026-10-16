/**
 * showSrcPayments - READ ONLY. Writes nothing.
 *
 * src_Payments can no longer be identified as the raw import, because the
 * customer columns it is recognised by - Name, Payment Email Id - are not
 * on its header row any more. That tab feeds mdl_Payments, which feeds
 * every page and the TV, so whatever state it is in is the state of
 * everything.
 *
 * This prints it: the formula, the header, the first rows, the last rows,
 * and what the header row looks like against what the Payment Tracker
 * actually has. Enough to say what happened rather than guess at it.
 */
function showSrcPayments() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var sh = ss.getSheetByName('src_Payments');
  if (!sh) { L('No src_Payments tab.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  L('=== src_Payments ===   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  ' + lastRow + ' rows x ' + lastCol + ' columns in use');
  L('  grid is ' + sh.getMaxRows() + ' x ' + sh.getMaxColumns());
  L('');

  /* ---- the formulas, if any ---- */
  L('  FORMULAS IN THE FIRST 8 ROWS OF COLUMN A');
  var any = false;
  for (var r = 1; r <= Math.min(8, sh.getMaxRows()); r++) {
    var f = '';
    try { f = sh.getRange(r, 1).getFormula(); } catch (e) {}
    if (f) { L('    A' + r + '  ' + f); any = true; }
  }
  if (!any) L('    none - every cell is a plain value');
  L('');

  /* ---- the first rows as a person sees them ---- */
  L('  THE FIRST 8 ROWS  (display values, first 14 columns)');
  var show = sh.getRange(1, 1, Math.min(8, lastRow || 1),
                         Math.min(14, lastCol || 1)).getDisplayValues();
  for (var i = 0; i < show.length; i++) {
    var cells = [];
    for (var c = 0; c < show[i].length; c++) {
      var t = String(show[i][c]).trim();
      cells.push(t ? t.substring(0, 18) : '-');
    }
    L('    ' + ssp_pad_(String(i + 1), 4) + cells.join(' | '));
  }
  L('');

  /* ---- the last rows, because a half-landed import shows at the end ---- */
  if (lastRow > 10) {
    L('  THE LAST 3 ROWS');
    var tail = sh.getRange(Math.max(1, lastRow - 2), 1, Math.min(3, lastRow),
                           Math.min(10, lastCol || 1)).getDisplayValues();
    for (var t2 = 0; t2 < tail.length; t2++) {
      var out = [];
      for (var c2 = 0; c2 < tail[t2].length; c2++) {
        var x = String(tail[t2][c2]).trim();
        out.push(x ? x.substring(0, 16) : '-');
      }
      L('    ' + ssp_pad_(String(lastRow - 2 + t2), 6) + out.join(' | '));
    }
    L('');
  }

  /* ---- which row is the header, and is the customer on it ---- */
  L('  LOOKING FOR THE HEADER');
  var found = -1;
  for (var hr = 1; hr <= Math.min(10, lastRow); hr++) {
    var row = sh.getRange(hr, 1, 1, lastCol).getValues()[0];
    var has = {}, n = 0;
    for (var k = 0; k < row.length; k++) {
      var key = String(row[k]).trim().toLowerCase();
      if (key) { has[key] = k; n++; }
    }
    if (has['date'] !== undefined && has['lead owner'] !== undefined) {
      found = hr;
      L('    row ' + hr + ' names ' + n + ' columns, including Date and Lead Owner');
      L('      Name              : ' + (has['name'] !== undefined ? 'yes' : '*** MISSING'));
      L('      Payment Email Id  : ' + (has['payment email id'] !== undefined ? 'yes' : '*** MISSING'));
      L('      Amount Paid       : ' + (has['amount paid'] !== undefined ? 'yes' : '*** MISSING'));
      break;
    }
  }
  if (found < 0) {
    L('    *** no row in the first 10 names both Date and Lead Owner.');
    L('        Nothing downstream can read this tab at all.');
  }
  L('');

  /* ---- what the Payment Tracker has, to compare against ---- */
  L('  WHAT THE PAYMENT TRACKER HAS, FOR COMPARISON');
  try {
    var srcSh = SpreadsheetApp.openById('1a-34agNIYY0ZcBIJKHpOsYb-ppM6FQZhietpWtBfreE')
                              .getSheetByName('All Payments');
    if (srcSh) {
      var h = srcSh.getRange(1, 1, 1, srcSh.getLastColumn()).getValues()[0];
      L('    ' + srcSh.getLastRow() + ' rows, ' + h.length + ' columns');
      L('    ' + h.map(function (x) { return String(x).trim(); })
                 .filter(function (x) { return x; }).join(' | '));
    } else {
      L('    *** no "All Payments" tab in it.');
    }
  } catch (e) {
    L('    *** cannot open it: ' + (e && e.message ? e.message : e));
  }
  L('');
  L('  Nothing was written. This only reports.');
}

function ssp_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}
