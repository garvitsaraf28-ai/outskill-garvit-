/**
 * PaymentsPull.gs - src_Payments by hand, and it stays by hand.
 *
 * WHY NOTHING STUCK
 *
 *   src_Payments is an IMPORTRANGE and it is #REF!. Pasting real rows
 *   over it looks like it works, and then the next updateAndCheck throws
 *   them away - because refreshAndVerify calls fixPaymentsRange, and
 *   fixPaymentsRange REWRITES the IMPORTRANGE formula every single run.
 *
 *   That is why running it ten times changed nothing. Each run put the
 *   broken formula back.
 *
 * WHAT THIS FILE DOES
 *
 *   It redefines fixPaymentsRange to do nothing.
 *
 *   Apps Script concatenates every .gs in the project into one scope, and
 *   a later definition of a name wins. A file added now loads after the
 *   original, so this one wins and the formula is never rewritten again.
 *   paymentsCheck() proves it is winning rather than leaving you to hope.
 *
 *   That is a blunt thing to do to somebody else's function, so: it is
 *   loud, it is in one place, and deleting this file undoes it
 *   completely. Nothing else in the project is touched.
 *
 *   With the rewrite off, src_Payments is an ordinary tab. Paste into it
 *   and the paste stays.
 *
 * HOW TO USE IT
 *
 *   paymentsCheck()      READ ONLY. Is the override winning, and does
 *                        what is in src_Payments look right? Run this
 *                        after every paste, before updateAndCheck.
 *   paymentsPullNow()    Fetch the rows from the Payment Tracker and
 *                        write them for you, instead of pasting.
 *   paymentsDiagnose()   READ ONLY. Why the import broke, and how close
 *                        this workbook is to Google's cell ceiling.
 *   paymentsRestoreImport()  Put the IMPORTRANGE back and go back to how
 *                        it was. Delete this file as well, or the rewrite
 *                        stays off.
 *
 * WHERE TO PASTE
 *
 *   Row 4 is the header - Date, Lead Owner, Name, ... exactly as the
 *   Payment Tracker has it. Row 5 down is the data. Column A onward.
 *   Paste the whole block including the header row and paymentsCheck
 *   will tell you if anything is out of place.
 */

var PP_SOURCE_ID  = '1a-34agNIYY0ZcBIJKHpOsYb-ppM6FQZhietpWtBfreE';
var PP_SOURCE_TAB = 'All Payments';

var PP_TARGET_TAB = 'src_Payments';
var PP_HEADER_ROW = 4;

var PP_FROM_YEAR  = 2026;
var PP_FROM_MONTH = 4;

/** Refuse a pull that would leave fewer than this share of what is there. */
var PP_MIN_FRACTION = 0.75;


/* ==================================================================
   THE OVERRIDE - the thing that makes a paste stick
   ================================================================== */

/**
 * Deliberately replaces the project's own fixPaymentsRange.
 *
 * The original rebuilds the IMPORTRANGE formula in src_Payments on every
 * refresh. That is the right thing to do when the tab is an import and
 * the wrong thing when it is maintained by hand, because it silently
 * discards the rows somebody just pasted.
 *
 * It is not deleted, only shadowed - delete this file and the original
 * is back, unchanged, the next time the project loads.
 */
function fixPaymentsRange() {
  Logger.log('fixPaymentsRange: OFF. src_Payments is maintained by hand now,');
  Logger.log('  so the IMPORTRANGE is not being rewritten. Delete PaymentsPull.gs');
  Logger.log('  to put the original behaviour back.');
  return { skipped: true, reason: 'src_Payments is maintained by hand' };
}


/* ==================================================================
   AFTER EVERY PASTE, BEFORE updateAndCheck
   ================================================================== */

function paymentsCheck() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  L('=== src_Payments CHECK ===   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing was written.');
  L('');

  /* ---- is the override actually winning? ---- */
  var off = false;
  try { off = !!(fixPaymentsRange() || {}).skipped; } catch (e) {}
  L('  THE FORMULA REWRITE');
  if (off) {
    L('    OFF. A paste into src_Payments will survive updateAndCheck.');
  } else {
    L('    *** STILL ON. The original fixPaymentsRange is winning, so the');
    L('        next updateAndCheck will throw your paste away and put the');
    L('        IMPORTRANGE back.');
    L('        Apps Script loads files in the order of the sidebar and the');
    L('        last definition wins, so this file has to sit BELOW the one');
    L('        holding the original. Delete this file and add it again -');
    L('        a new file goes to the bottom.');
  }
  L('');

  var sh = ss.getSheetByName(PP_TARGET_TAB);
  if (!sh) { L('  *** no "' + PP_TARGET_TAB + '" tab.'); return false; }

  /* ---- is it a formula or real rows? ---- */
  var f = '';
  try { f = sh.getRange(PP_HEADER_ROW, 1).getFormula(); } catch (e2) {}
  if (f) {
    L('  *** ROW ' + PP_HEADER_ROW + ' IS STILL A FORMULA:');
    L('      ' + f);
    L('      Nothing has been pasted yet, or it was overwritten. Clear from');
    L('      row ' + PP_HEADER_ROW + ' down and paste the real rows, or run paymentsPullNow.');
    return false;
  }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow <= PP_HEADER_ROW) { L('  *** empty below the header. Nothing to read.'); return false; }

  /* ---- the columns the rest of the project needs ---- */
  var head = sh.getRange(PP_HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var H = {};
  for (var c = 0; c < head.length; c++) {
    var k = String(head[c]).trim().toLowerCase();
    if (k && H[k] === undefined) H[k] = c;
  }
  var need = ['date', 'lead owner', 'amount paid'];
  var nice = ['name', 'payment email id', 'payment type', 'status', 'program', 'sale price'];
  L('  THE HEADER  (row ' + PP_HEADER_ROW + ', ' + lastCol + ' columns)');
  var missing = [];
  for (var i = 0; i < need.length; i++) {
    var at = H[need[i]];
    L('    ' + pp_pad_(need[i], 16) + (at === undefined ? '*** MISSING' : 'column ' + pp_col_(at)));
    if (at === undefined) missing.push(need[i]);
  }
  for (var j = 0; j < nice.length; j++) {
    if (H[nice[j]] !== undefined) L('    ' + pp_pad_(nice[j], 16) + 'column ' + pp_col_(H[nice[j]]));
  }
  if (missing.length) {
    L('');
    L('  *** STOP. Without ' + missing.join(', ') + ' nothing downstream can read');
    L('      this. Paste the header row too - it is row ' + PP_HEADER_ROW + '.');
    return false;
  }
  L('');

  /* ---- do the rows look like rows? ---- */
  var n = lastRow - PP_HEADER_ROW;
  var grid = sh.getRange(PP_HEADER_ROW + 1, 1, n, lastCol).getValues();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var good = 0, bad = 0, thisMonth = 0, rev = 0, newest = null;

  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][H['date']];
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      if (String(grid[r][H['lead owner']]).trim()) bad++;
      continue;
    }
    good++;
    if (!newest || d.getTime() > newest.getTime()) newest = d;
    if (wr_monthKey_(d) === monthKey) {
      thisMonth++; rev += wr_num_(grid[r][H['amount paid']]);
    }
  }

  L('  THE ROWS');
  L('    total below the header : ' + pp_commas_(n));
  L('    with a readable date   : ' + pp_commas_(good));
  if (bad) {
    L('    *** ' + bad + ' row(s) have a name but no readable date. Every reader in');
    L('        this project skips those silently, so that money lands nowhere.');
    L('        Usually it means the Date column pasted as text - select it and');
    L('        Format > Number > Date.');
  }
  L('    newest payment         : ' +
    (newest ? Utilities.formatDate(newest, WR_TZ, 'dd MMM yyyy') : 'none'));
  L('    this month             : ' + thisMonth + ' rows, ' + wr_money_(rev));
  L('');

  var ok = off && good > 0 && !missing.length;
  if (ok) {
    L('  READY. Run updateAndCheck - and this time the paste will survive it.');
  } else {
    L('  NOT READY. Fix the lines marked *** above first.');
  }
  return ok;
}


/* ==================================================================
   OR LET IT FETCH THE ROWS FOR YOU
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

  var head = src.getRange(1, 1, 1, sCols).getValues()[0];
  var cDate = -1;
  for (var c = 0; c < head.length; c++) {
    if (String(head[c]).trim().toLowerCase() === 'date') { cDate = c; break; }
  }
  if (cDate < 0) { L('*** the source has no "Date" column.'); return; }

  /* The date column alone first, to find the window - one narrow read
     instead of dragging 28,000 rows across to discover most are out of
     scope. */
  var dates = src.getRange(2, cDate + 1, sRows - 1, 1).getValues();
  var want = PP_FROM_YEAR * 100 + PP_FROM_MONTH;
  var first = -1, last = -1;
  for (var r = 0; r < dates.length; r++) {
    var d = dates[r][0];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (d.getFullYear() * 100 + (d.getMonth() + 1) < want) continue;
    if (first < 0) first = r;
    last = r;
  }
  if (first < 0) { L('*** nothing dated ' + want + ' or later. Nothing pulled.'); return; }
  var nRows = last - first + 1;

  /* A pull that would shrink the tab to a fraction of what it holds is
     the source half-read, and writing it would empty every page the way
     7 Oct did. */
  var have = Math.max(0, dst.getLastRow() - PP_HEADER_ROW);
  if (have > 50 && nRows < have * PP_MIN_FRACTION) {
    L('*** REFUSING. The source offers ' + nRows + ' rows against ' + have + ' already here.');
    L('    That is the tracker half-read, not a real drop. Nothing was touched.');
    return;
  }

  var block = [], CH = 5000, at, w;
  for (at = 0; at < nRows; at += CH) {
    block = block.concat(src.getRange(2 + first + at, 1,
                                      Math.min(CH, nRows - at), sCols).getValues());
  }

  var maxR = dst.getMaxRows();
  if (maxR >= PP_HEADER_ROW) {
    dst.getRange(PP_HEADER_ROW, 1, maxR - PP_HEADER_ROW + 1, dst.getMaxColumns()).clearContent();
  }
  var need = PP_HEADER_ROW + 1 + block.length;
  if (dst.getMaxRows() < need) dst.insertRowsAfter(dst.getMaxRows(), need - dst.getMaxRows());
  if (dst.getMaxColumns() < sCols) {
    dst.insertColumnsAfter(dst.getMaxColumns(), sCols - dst.getMaxColumns());
  }

  dst.getRange(PP_HEADER_ROW, 1, 1, sCols).setValues([head]);
  for (w = 0; w < block.length; w += CH) {
    var slice = block.slice(w, w + CH);
    dst.getRange(PP_HEADER_ROW + 1 + w, 1, slice.length, sCols).setValues(slice);
  }
  SpreadsheetApp.flush();

  L('  pulled ' + pp_commas_(block.length) + ' rows x ' + sCols + ' cols as VALUES');
  L('  took   ' + Math.round((new Date() - t0) / 1000) + 's');
  L('  Now run paymentsCheck, then updateAndCheck.');
}


/* ==================================================================
   WHY IT BROKE, AND HOW HEAVY THIS WORKBOOK IS
   ================================================================== */

function paymentsDiagnose() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  L('=== src_Payments DIAGNOSIS ===   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing was written.');
  L('');

  var sh = ss.getSheetByName(PP_TARGET_TAB);
  if (!sh) { L('  *** no "' + PP_TARGET_TAB + '" tab.'); return; }
  var f = '';
  try { f = sh.getRange(PP_HEADER_ROW, 1).getFormula(); } catch (e) {}
  L('  THE CELL');
  L('    A' + PP_HEADER_ROW + ' : ' + (String(sh.getRange(PP_HEADER_ROW, 1).getValue()) || '(blank)'));
  L('    formula : ' + (f || '(none - plain values, which is what we want)'));
  L('    rows : ' + sh.getLastRow() + '   cols : ' + sh.getLastColumn());
  L('');

  /* A lapsed permission and an oversized range both read as #REF! and
     need opposite fixes. Opening the source settles which. */
  L('  THE SOURCE');
  var src = null;
  try { src = SpreadsheetApp.openById(PP_SOURCE_ID); }
  catch (e3) {
    L('    *** CANNOT OPEN IT: ' + (e3 && e3.message ? e3.message : e3));
    L('        That is permission, not size. Open the Payment Tracker in this');
    L('        account once, then try again.');
    return;
  }
  var tab = src.getSheetByName(PP_SOURCE_TAB);
  L('    ' + src.getName() + (tab ? ('  >  ' + PP_SOURCE_TAB + '  ' +
      tab.getLastRow() + ' rows') : '  *** no "' + PP_SOURCE_TAB + '" tab'));
  L('    This account CAN reach it, so the #REF! was not permission.');
  L('');

  L('  THIS WORKBOOK');
  var tabs = ss.getSheets(), total = 0, rows = [];
  for (var i = 0; i < tabs.length; i++) {
    var cells = tabs[i].getMaxRows() * tabs[i].getMaxColumns();
    total += cells;
    rows.push({ name: tabs[i].getName(), cells: cells });
  }
  rows.sort(function (a, b) { return b.cells - a.cells; });
  L('    ' + tabs.length + ' tabs, ' + pp_commas_(total) + ' cells allocated');
  L('    Google stops a spreadsheet at 10,000,000 - you are at ' +
    (total / 10000000 * 100).toFixed(1) + '%.');
  L('');
  L('    THE TEN BIGGEST');
  for (var j = 0; j < rows.length && j < 10; j++) {
    L('      ' + pp_pad_(rows[j].name, 26) + pp_commas_(rows[j].cells));
  }
  L('');
  if (total > 7000000) {
    L('    *** THAT is why the import keeps failing. Near the ceiling,');
    L('        IMPORTRANGE is the first thing to go. A tab with a thousand');
    L('        unused rows still charges for every one - trim the grids above.');
  } else {
    L('    Comfortable, so the failure was not the workbook being full.');
  }
  L('');
  L('  Nothing was written. This only reports.');
}


function paymentsRestoreImport() {
  var ss = SpreadsheetApp.getActive();
  var dst = ss.getSheetByName(PP_TARGET_TAB);
  if (!dst) { Logger.log('no "' + PP_TARGET_TAB + '" tab.'); return; }
  var url = 'https://docs.google.com/spreadsheets/d/' + PP_SOURCE_ID;
  var maxR = dst.getMaxRows();
  if (maxR >= PP_HEADER_ROW) {
    dst.getRange(PP_HEADER_ROW, 1, maxR - PP_HEADER_ROW + 1, dst.getMaxColumns()).clearContent();
  }
  dst.getRange(PP_HEADER_ROW, 1)
     .setFormula('=IMPORTRANGE("' + url + '","' + PP_SOURCE_TAB + '!A1:AZ")');
  SpreadsheetApp.flush();
  Logger.log('IMPORTRANGE restored at ' + PP_TARGET_TAB + '!A' + PP_HEADER_ROW + '.');
  Logger.log('DELETE PaymentsPull.gs as well, or fixPaymentsRange stays switched');
  Logger.log('off and the old bounding behaviour will not come back.');
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

/** 0-based column index to a letter, so it can be found by eye. */
function pp_col_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m) / 26 | 0; }
  return s;
}
