/**
 * scout-scorecard.gs
 *
 * READ ONLY. Nothing in this file writes to any sheet, local or CBC.
 *
 * Purpose: dump the shape of the data needed to build an
 * office / manager / agent scorecard page modelled on the CBC
 * "BBS Team" tab.
 *
 * How to run:
 *   1. paste this in as a new file
 *   2. run  scoutScorecardSources
 *   3. paste the whole Execution log back
 */

var SC_CBC_ID = '1-r5VMZ2u9w7WrcyAgCdgzp4scJiJQONuPiUV6JbRu0s';
var SC_SAMPLE = 3;    // sample rows per tab
var SC_MAXCOL = 18;   // columns to show

function scoutScorecardSources() {
  var t0 = new Date();
  Logger.log('=== SCOUT: scorecard sources ===');
  Logger.log('read only. nothing is written.');

  try { sc_localTabs_(); } catch (e) { Logger.log('LOCAL FAILED: ' + e); }
  try { sc_bbsRecipe_(); } catch (e) { Logger.log('BBS RECIPE FAILED: ' + e); }
  try { sc_cbcMonthly_(); } catch (e) { Logger.log('CBC MONTHLY FAILED: ' + e); }

  Logger.log('');
  Logger.log('done in ' + Math.round((new Date() - t0) / 1000) + 's');
}

/* ---------- the local workbook ---------- */

function sc_localTabs_() {
  var ss = SpreadsheetApp.getActive();
  Logger.log('');
  Logger.log('=== LOCAL WORKBOOK: ' + ss.getName() + ' ===');

  var names = ss.getSheets().map(function (sh) { return sh.getName(); });
  Logger.log('tabs (' + names.length + '): ' + names.join(' | '));

  // the payments model, and anything roster shaped
  var want = [];
  names.forEach(function (n) {
    if (n === 'mdl_Payments') want.push(n);
    else if (n.indexOf('src_Roster') === 0) want.push(n);
    else if (n.toLowerCase().indexOf('target') > -1) want.push(n);
  });

  if (!want.length) {
    Logger.log('no mdl_Payments / src_Roster* / *target* tab found.');
    return;
  }

  // roster tabs share a layout, so two is enough to learn the shape
  var shown = 0;
  want.forEach(function (n) {
    if (n.indexOf('src_Roster') === 0 && shown++ >= 2) return;
    sc_dump_(ss.getSheetByName(n), 'LOCAL');
  });
}

/* ---------- how BBS Team is actually built ---------- */

function sc_bbsRecipe_() {
  var cbc = SpreadsheetApp.openById(SC_CBC_ID);
  var sh = cbc.getSheetByName('BBS Team');
  if (!sh) { Logger.log('BBS Team tab not found in CBC'); return; }

  Logger.log('');
  Logger.log('=== BBS Team: how it is built ===');
  Logger.log('size: ' + sh.getLastRow() + ' rows x ' + sh.getLastColumn() + ' cols');

  var n = Math.min(sh.getLastColumn(), SC_MAXCOL);

  Logger.log('-- header row 3 --');
  Logger.log(sh.getRange(3, 1, 1, n).getDisplayValues()[0].join(' | '));

  Logger.log('-- row 4 (first agent): value then formula --');
  var f4 = sh.getRange(4, 1, 1, n).getFormulas()[0];
  var v4 = sh.getRange(4, 1, 1, n).getDisplayValues()[0];
  for (var i = 0; i < n; i++) {
    Logger.log(sc_col_(i + 1) + '4  [' + v4[i] + ']' +
               (f4[i] ? '  <= ' + f4[i] : '  <= typed in'));
  }

  Logger.log('-- row 22 (a tenured agent), formulas only --');
  var f22 = sh.getRange(22, 1, 1, n).getFormulas()[0];
  for (var j = 0; j < n; j++) {
    if (f22[j]) Logger.log(sc_col_(j + 1) + '22  <= ' + f22[j]);
  }

  Logger.log('-- total row 1 --');
  var f1 = sh.getRange(1, 1, 1, n).getFormulas()[0];
  for (var k = 0; k < n; k++) {
    if (f1[k]) Logger.log(sc_col_(k + 1) + '1  <= ' + f1[k]);
  }
}

/* ---------- CBC month tabs ---------- */

function sc_cbcMonthly_() {
  var cbc = SpreadsheetApp.openById(SC_CBC_ID);
  Logger.log('');
  Logger.log('=== CBC WORKBOOK ===');

  var names = cbc.getSheets().map(function (sh) { return sh.getName(); });
  Logger.log('tabs (' + names.length + '): ' + names.join(' | '));

  // month tabs look like "Aug 2026" / "August 2026" / "July 2026"
  var months = names.filter(function (n) { return /20\d\d\s*$/.test(n) && /[a-z]/i.test(n); });
  Logger.log('month-looking tabs: ' + months.join(' | '));

  // they share a layout, so dump only the last few. keeps the log readable.
  var pick = months.slice(-3);
  Logger.log('dumping only: ' + pick.join(' | '));
  pick.forEach(function (n) { sc_dump_(cbc.getSheetByName(n), 'CBC'); });
}

/* ---------- shared ---------- */

function sc_dump_(sh, tag) {
  if (!sh) return;
  var rows = sh.getLastRow(), cols = sh.getLastColumn();
  Logger.log('');
  Logger.log('-- ' + tag + ' tab: ' + sh.getName() + '  (' + rows + ' rows x ' + cols + ' cols) --');
  if (rows < 1 || cols < 1) { Logger.log('(empty)'); return; }

  var nc = Math.min(cols, SC_MAXCOL);
  var nr = Math.min(rows, SC_SAMPLE + 3);
  var vals = sh.getRange(1, 1, nr, nc).getDisplayValues();

  for (var i = 0; i < nr; i++) {
    Logger.log('r' + (i + 1) + ': ' + vals[i].join(' | '));
  }
  if (cols > SC_MAXCOL) Logger.log('(+' + (cols - SC_MAXCOL) + ' more columns not shown)');
}

function sc_col_(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - r - 1) / 26;
  }
  return s;
}
