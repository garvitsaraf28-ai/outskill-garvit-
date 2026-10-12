/**
 * PaymentsPull.gs - stop src_Payments breaking.
 *
 * THE PROBLEM
 *
 *   src_Payments is an IMPORTRANGE, and it keeps falling over to #REF!.
 *   When it does, mdl_Payments is rebuilt from nothing and every page in
 *   the workbook goes with it - which is what put the board at 1.6 L on
 *   7 Oct, and what fixPaymentsRange has been patching since.
 *
 *   IMPORTRANGE is a live formula. It re-fetches whenever Sheets feels
 *   like it, it counts against the workbook's cell budget the whole time
 *   it exists, and it can fail for reasons that have nothing to do with
 *   this file - the source growing, a permission lapsing, a quota. A
 *   number the whole floor reads should not depend on something that can
 *   quietly become #REF! at 3am.
 *
 * THE CURE
 *
 *   Fetch the rows with a script and write them as VALUES. There is no
 *   formula left to break, nothing recalculates, and the workbook gets
 *   lighter rather than heavier. It either works and says so, or fails
 *   and says why - which is the whole difference.
 *
 * THE THREE FUNCTIONS
 *
 *   paymentsDiagnose()      READ ONLY. Why is it broken, and how heavy is
 *                           this workbook really. Start here.
 *   paymentsPullNow()       Replace the import with values. Guarded.
 *   paymentsRestoreImport() Put the IMPORTRANGE back, if ever wanted.
 *
 * BEFORE YOU SWITCH - ONE THING TO KNOW
 *
 *   refreshAndVerify calls fixPaymentsRange, which REWRITES the
 *   IMPORTRANGE formula. So after pulling values, the next full refresh
 *   would put the formula straight back. paymentsDiagnose says whether
 *   that function exists in this project, and the note it prints tells
 *   you the one line to change. Read that before relying on the switch.
 */

/** The Payment Tracker, and the tab inside it. */
var PP_SOURCE_ID  = '1a-34agNIYY0ZcBIJKHpOsYb-ppM6FQZhietpWtBfreE';
var PP_SOURCE_TAB = 'All Payments';

/** This workbook's copy. */
var PP_TARGET_TAB = 'src_Payments';
var PP_HEADER_ROW = 4;              // the header sits here; data from the next row

/** Keep in step with the import's own window. */
var PP_FROM_YEAR  = 2026;
var PP_FROM_MONTH = 4;              // April

/** Refuse a pull that would leave fewer than this share of what is there. */
var PP_MIN_FRACTION = 0.75;


/* ==================================================================
   1.  WHY IS IT BROKEN  - read only
   ================================================================== */

function paymentsDiagnose() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  L('=== src_Payments DIAGNOSIS ===   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing was written.');
  L('');

  /* ---- what is actually in the cell ---- */
  var sh = ss.getSheetByName(PP_TARGET_TAB);
  if (!sh) { L('  *** no "' + PP_TARGET_TAB + '" tab.'); return; }

  var f = '';
  try { f = sh.getRange(PP_HEADER_ROW, 1).getFormula(); } catch (e) {}
  var v = '';
  try { v = String(sh.getRange(PP_HEADER_ROW, 1).getValue()); } catch (e2) {}

  L('  THE CELL');
  L('    ' + PP_TARGET_TAB + '!A' + PP_HEADER_ROW + ' holds : ' + (v || '(blank)'));
  L('    formula : ' + (f || '(none - it is a plain value)'));
  L('    rows now : ' + sh.getLastRow() + '   cols : ' + sh.getLastColumn());
  L('');

  /* ---- can this account still reach the source? ----
     A lapsed permission and a range that is too big both show as #REF!,
     and they need completely different fixes. Opening it settles which. */
  L('  THE SOURCE');
  var src = null;
  try { src = SpreadsheetApp.openById(PP_SOURCE_ID); }
  catch (e3) {
    L('    *** CANNOT OPEN IT: ' + (e3 && e3.message ? e3.message : e3));
    L('        That is a permission problem, not a size one. Open the');
    L('        Payment Tracker in this account once, then try again.');
    return;
  }
  L('    name : ' + src.getName());
  var tab = src.getSheetByName(PP_SOURCE_TAB);
  if (!tab) {
    L('    *** no "' + PP_SOURCE_TAB + '" tab in it. The import points at a');
    L('        tab that no longer exists - that alone is the #REF!.');
    L('        Tabs it does have: ' +
      src.getSheets().slice(0, 12).map(function (x) { return x.getName(); }).join(', '));
    return;
  }
  L('    tab  : ' + PP_SOURCE_TAB + '   ' + tab.getLastRow() + ' rows, ' +
    tab.getLastColumn() + ' cols');
  L('    grid : ' + tab.getMaxRows() + ' x ' + tab.getMaxColumns() + ' = ' +
    pp_commas_(tab.getMaxRows() * tab.getMaxColumns()) + ' cells allocated');
  L('    THE ACCOUNT CAN REACH IT. So this is not permission.');
  L('');

  /* ---- how heavy is this workbook, really ---- */
  L('  THIS WORKBOOK');
  var tabs = ss.getSheets(), total = 0, rows = [];
  for (var i = 0; i < tabs.length; i++) {
    var c = tabs[i].getMaxRows() * tabs[i].getMaxColumns();
    total += c;
    rows.push({ name: tabs[i].getName(), cells: c });
  }
  rows.sort(function (a, b) { return b.cells - a.cells; });
  L('    ' + tabs.length + ' tabs, ' + pp_commas_(total) + ' cells allocated');
  L('    Google stops a spreadsheet at 10,000,000. You are at ' +
    (total / 10000000 * 100).toFixed(1) + '%.');
  L('');
  L('    THE TEN BIGGEST');
  for (var j = 0; j < rows.length && j < 10; j++) {
    L('      ' + pp_pad_(rows[j].name, 26) + pp_commas_(rows[j].cells));
  }
  L('');
  if (total > 7000000) {
    L('    *** THAT IS THE PROBLEM. Near the ceiling, IMPORTRANGE is the');
    L('        first thing to fail, because it is the biggest single ask.');
    L('        Trim the grids above - a tab with 1000 unused rows still');
    L('        counts every one of them - and the import stops breaking.');
  } else {
    L('    Comfortable. So the failure is not the workbook being full.');
  }
  L('');

  /* ---- the thing that would undo the fix ---- */
  L('  ONE THING TO KNOW BEFORE SWITCHING');
  if (typeof fixPaymentsRange === 'function') {
    L('    fixPaymentsRange EXISTS in this project, and refreshAndVerify');
    L('    calls it. It rewrites the IMPORTRANGE formula, so after');
    L('    paymentsPullNow the next full refresh would put the formula');
    L('    straight back and this would start breaking again.');
    L('');
    L('    To make the switch stick, that call has to go. Send me the file');
    L('    holding fixPaymentsRange and I will give you the one line.');
  } else {
    L('    fixPaymentsRange is not in this project, so nothing will rewrite');
    L('    the formula behind you. paymentsPullNow is safe to rely on.');
  }
  L('');
  L('  Nothing was written. This only reports.');
}


/* ==================================================================
   2.  PULL THE ROWS AS VALUES
   ================================================================== */

function paymentsPullNow() {
  var t0 = new Date();
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  L('=== PULL PAYMENTS ===   ' + Utilities.formatDate(t0, WR_TZ, 'dd MMM HH:mm'));

  var dst = ss.getSheetByName(PP_TARGET_TAB);
  if (!dst) { L('*** no "' + PP_TARGET_TAB + '" tab.'); return; }

  var src;
  try { src = SpreadsheetApp.openById(PP_SOURCE_ID).getSheetByName(PP_SOURCE_TAB); }
  catch (e) { L('*** cannot open the Payment Tracker: ' + e.message); return; }
  if (!src) { L('*** no "' + PP_SOURCE_TAB + '" tab in the Payment Tracker.'); return; }

  var sRows = src.getLastRow(), sCols = src.getLastColumn();
  if (sRows < 2) { L('*** the source is empty. Nothing pulled.'); return; }

  /* ---- the header, and which column holds the date ---- */
  var head = src.getRange(1, 1, 1, sCols).getValues()[0];
  var cDate = -1;
  for (var c = 0; c < head.length; c++) {
    if (String(head[c]).trim().toLowerCase() === 'date') { cDate = c; break; }
  }
  if (cDate < 0) { L('*** the source has no "Date" column.'); return; }

  /* ---- read the date column alone to find where the window starts ----
     One narrow read instead of pulling 28,000 rows of everything to
     discover that most of them are out of scope. */
  var dates = src.getRange(2, cDate + 1, sRows - 1, 1).getValues();
  var want = PP_FROM_YEAR * 100 + PP_FROM_MONTH;
  var first = -1, last = -1;
  for (var r = 0; r < dates.length; r++) {
    var d = dates[r][0];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var key = d.getFullYear() * 100 + (d.getMonth() + 1);
    if (key < want) continue;
    if (first < 0) first = r;
    last = r;
  }
  if (first < 0) { L('*** nothing dated ' + want + ' or later. Nothing pulled.'); return; }

  var nRows = last - first + 1;

  /* THE GUARD. A pull that would shrink the tab to a fraction of what it
     holds is the source half-read, not a real drop - and writing it would
     empty every page the way 7 Oct did. */
  var have = Math.max(0, dst.getLastRow() - PP_HEADER_ROW);
  if (have > 50 && nRows < have * PP_MIN_FRACTION) {
    L('*** REFUSING. The source offers ' + nRows + ' rows against ' + have +
      ' already here.');
    L('    That is the Payment Tracker half-read, not a real drop. Nothing');
    L('    was touched. Try again in a few minutes.');
    return;
  }

  /* ---- read the block, in chunks ---- */
  var block = [], CH = 5000;
  for (var at = 0; at < nRows; at += CH) {
    var take = Math.min(CH, nRows - at);
    block = block.concat(src.getRange(2 + first + at, 1, take, sCols).getValues());
  }

  /* ---- write it ---- */
  var lastRow = dst.getMaxRows();
  if (lastRow >= PP_HEADER_ROW) {
    dst.getRange(PP_HEADER_ROW, 1, lastRow - PP_HEADER_ROW + 1,
                 dst.getMaxColumns()).clearContent();
  }
  var need = PP_HEADER_ROW + 1 + block.length;
  if (dst.getMaxRows() < need) dst.insertRowsAfter(dst.getMaxRows(), need - dst.getMaxRows());
  if (dst.getMaxColumns() < sCols) {
    dst.insertColumnsAfter(dst.getMaxColumns(), sCols - dst.getMaxColumns());
  }

  dst.getRange(PP_HEADER_ROW, 1, 1, sCols).setValues([head]);
  for (var w = 0; w < block.length; w += CH) {
    var slice = block.slice(w, w + CH);
    dst.getRange(PP_HEADER_ROW + 1 + w, 1, slice.length, sCols).setValues(slice);
  }
  SpreadsheetApp.flush();

  L('  pulled  : ' + pp_commas_(block.length) + ' rows x ' + sCols + ' cols');
  L('  window  : ' + PP_FROM_YEAR + '-' + pp_pad2_(PP_FROM_MONTH) + ' onward');
  L('  written : ' + PP_TARGET_TAB + ' row ' + PP_HEADER_ROW + ' (header) and below,');
  L('            as VALUES - there is no formula left to break.');
  L('  took    : ' + Math.round((new Date() - t0) / 1000) + 's');
  L('');
  if (typeof fixPaymentsRange === 'function') {
    L('  !! fixPaymentsRange is in this project and refreshAndVerify calls');
    L('     it. It will rewrite the IMPORTRANGE on the next full refresh and');
    L('     undo this. Run paymentsDiagnose for what to do about it.');
  }
}


/* ==================================================================
   3.  PUT THE IMPORT BACK
   ================================================================== */

function paymentsRestoreImport() {
  var ss = SpreadsheetApp.getActive();
  var dst = ss.getSheetByName(PP_TARGET_TAB);
  if (!dst) { Logger.log('no "' + PP_TARGET_TAB + '" tab.'); return; }

  var url = 'https://docs.google.com/spreadsheets/d/' + PP_SOURCE_ID;
  var f = '=IMPORTRANGE("' + url + '","' + PP_SOURCE_TAB + '!A1:AZ")';

  var lastRow = dst.getMaxRows();
  if (lastRow >= PP_HEADER_ROW) {
    dst.getRange(PP_HEADER_ROW, 1, lastRow - PP_HEADER_ROW + 1,
                 dst.getMaxColumns()).clearContent();
  }
  dst.getRange(PP_HEADER_ROW, 1).setFormula(f);
  SpreadsheetApp.flush();
  Logger.log('Restored the IMPORTRANGE at ' + PP_TARGET_TAB + '!A' + PP_HEADER_ROW + '.');
  Logger.log('It may show #REF! until the connection is approved once -');
  Logger.log('click the cell and allow access if it asks.');
}


/* ==================================================================
   HELPERS
   ================================================================== */

function pp_commas_(n) {
  var s = String(Math.round(Number(n) || 0)), out = '', c = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    out = s.charAt(i) + out;
    if (++c % 3 === 0 && i > 0) out = ',' + out;
  }
  return out;
}

function pp_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

function pp_pad2_(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
