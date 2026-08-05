/**
 * Page Vintage.gs — WORKSHOP VINTAGE block on the Command Centre.
 *
 * Answers, for every month: how much of the money banked in that month came
 * from workshops that RAN in that month, versus instalments arriving against
 * earlier batches, versus revenue with no workshop behind it at all.
 *
 * The Funnel already shows a batch's LIFETIME revenue whenever it was collected.
 * This is the other cut: money that landed IN the month, split by batch vintage.
 * The two deliberately disagree and both are correct.
 *
 * Layer: PAGE. Reads mdl_Payments and mdl_Batches only. Writes one block on the
 * Command Centre and refuses to write anywhere else.
 *
 * Run buildVintageBlock(). Add it to the end of refreshEverything(), inside a
 * try/catch, so a failure here can never stop the revenue pages refreshing.
 */

var VIN_SHEET     = 'Command Centre';
var VIN_FIRST_ROW = 34;   // first row of the block. B1:H32 is the existing page.
var VIN_FIRST_COL = 2;    // column B
var VIN_NUM_COLS  = 12;   // B..M. The hidden agent helper block starts at P — do not reach it.
var VIN_MAX_ROWS  = 40;   // clear-down guard: block can never be taller than this

function buildVintageBlock() {
  var ss = SpreadsheetApp.getActive();

  // ---- guard: this function may only ever touch the Command Centre ----
  var sh = ss.getSheetByName(VIN_SHEET);
  if (!sh) throw new Error('buildVintageBlock: sheet "' + VIN_SHEET + '" not found.');
  if (sh.getName() !== VIN_SHEET) throw new Error('buildVintageBlock: refusing to write to ' + sh.getName());

  var batchMonth = vin_readBatchMonths_(ss);
  var model      = vin_readPayments_(ss, batchMonth);

  vin_render_(sh, model);
}

/** mdl_Batches -> { canonicalBatchCode: monthKey }  e.g. { 'C154': 202607 } */
function vin_readBatchMonths_(ss) {
  var sh = ss.getSheetByName('mdl_Batches');
  if (!sh) throw new Error('buildVintageBlock: mdl_Batches not found. Run buildStep5_BatchModel first.');
  var values = sh.getDataRange().getValues();
  var head   = vin_headerIndex_(values[0]);
  var cB     = vin_need_(head, 'batch', 'mdl_Batches');
  var cD     = vin_need_(head, 'date',  'mdl_Batches');

  var out = {};
  for (var i = 1; i < values.length; i++) {
    var code = vin_canon_(values[i][cB]);
    var d    = values[i][cD];
    if (!code || !(d instanceof Date)) continue;
    out[code] = d.getFullYear() * 100 + (d.getMonth() + 1);
  }
  return out;
}

/**
 * mdl_Payments -> per month: revenue and units, bucketed by batch vintage.
 * Mirrors the workbook's own rules exactly:
 *   Inside Sales = On Roster is YES. Everything else is Sales Success.
 *   Revenue      = Amount Paid, every row, refunds included (never deducted).
 *   Units        = Is Unit is YES (1st Part Payment or Full Payment only).
 */
function vin_readPayments_(ss, batchMonth) {
  var sh = ss.getSheetByName('mdl_Payments');
  if (!sh) throw new Error('buildVintageBlock: mdl_Payments not found. Run buildStep4_PaymentsModel first.');
  var values = sh.getDataRange().getValues();
  var head   = vin_headerIndex_(values[0]);

  var cDate   = vin_need_(head, 'date',         'mdl_Payments');
  var cRoster = vin_need_(head, 'on roster',    'mdl_Payments');
  var cAmt    = vin_need_(head, 'amount paid',  'mdl_Payments');
  var cUnit   = vin_need_(head, 'is unit',      'mdl_Payments');
  var cBatch  = vin_need_(head, 'batch',        'mdl_Payments');
  var cFam    = vin_need_(head, 'batch family', 'mdl_Payments');

  var months = {};   // monthKey -> bucket totals
  function bucket(k) {
    if (!months[k]) {
      months[k] = { key: k, sameR: 0, sameU: 0, earlyR: 0, earlyU: 0,
                    futR: 0, futU: 0, noneR: 0, noneU: 0, totR: 0, totU: 0, unmapped: 0 };
    }
    return months[k];
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[cRoster]).trim().toUpperCase() !== 'YES') continue;   // Sales Success — not ours
    var d = row[cDate];
    if (!(d instanceof Date)) continue;

    var pm  = d.getFullYear() * 100 + (d.getMonth() + 1);
    var amt = Number(row[cAmt]) || 0;
    var isU = String(row[cUnit]).trim().toUpperCase() === 'YES';
    var fam = String(row[cFam] || '').trim();
    var code = vin_canon_(row[cBatch]);

    var m = bucket(pm), where;
    if (!code || fam === 'Unattributed') {
      where = 'none';                       // referral / website / direct
    } else if (batchMonth.hasOwnProperty(code)) {
      var bm = batchMonth[code];
      where = (bm === pm) ? 'same' : (bm > pm ? 'fut' : 'early');
    } else {
      // Names a batch mdl_Batches has no row for. Every such code today is
      // pre-window (nothing at or above C123 / E47 / BC6 is missing), so it is
      // an earlier workshop. Counted separately so the Audit figure stays visible.
      where = 'early';
      m.unmapped += amt;
    }

    m[where + 'R'] += amt;
    m.totR += amt;
    if (isU) { m[where + 'U'] += 1; m.totU += 1; }
  }

  // Analysis window starts April 2026 (Settings). Discovered, not hard-coded —
  // a new month appears here on its own with no code edit.
  var keys = Object.keys(months).map(Number).filter(function (k) { return k >= 202604; }).sort();
  return keys.map(function (k) { return months[k]; });
}

function vin_render_(sh, rows) {
  var TITLE = 'WORKSHOP VINTAGE  —  WHERE THIS MONTH’S MONEY WAS SOLD';
  var NOTE  = 'Money banked IN the month, split by the month its workshop ran. '
            + 'Instalments against an older batch land in "Earlier workshops". '
            + 'The Funnel shows a batch’s lifetime revenue instead — these two are '
            + 'different cuts of the same rupees and are meant to differ.';

  // Clear the whole reserved area first so the block is idempotent. Merges from
  // a previous run must be broken BEFORE clearing — setValues() over a merged
  // range throws, which is how a rebuild would fail on the second run.
  var area = sh.getRange(VIN_FIRST_ROW, VIN_FIRST_COL, VIN_MAX_ROWS, VIN_NUM_COLS);
  try { area.breakApart(); } catch (e) { /* nothing merged yet — fine */ }
  area.clear();

  var out = [];
  out.push([TITLE, '', '', '', '', '', '', '', '', '', '', '']);
  out.push([NOTE,  '', '', '', '', '', '', '', '', '', '', '']);
  out.push(['', 'This month’s workshops', '', 'Earlier workshops', '', 'Future workshops', '',
            'No workshop', '', 'TOTAL', '', '']);
  out.push(['Month', 'Revenue', 'Units', 'Revenue', 'Units', 'Revenue', 'Units',
            'Revenue', 'Units', 'Revenue', 'Units', 'Same-month %']);

  var t = { sameR: 0, sameU: 0, earlyR: 0, earlyU: 0, futR: 0, futU: 0,
            noneR: 0, noneU: 0, totR: 0, totU: 0, unmapped: 0 };

  rows.forEach(function (m) {
    out.push([vin_label_(m.key), m.sameR, m.sameU, m.earlyR, m.earlyU, m.futR, m.futU,
              m.noneR, m.noneU, m.totR, m.totU, m.totR ? m.sameR / m.totR : '']);
    for (var k in t) t[k] += m[k];
  });

  out.push(['TOTAL', t.sameR, t.sameU, t.earlyR, t.earlyU, t.futR, t.futU,
            t.noneR, t.noneU, t.totR, t.totU, t.totR ? t.sameR / t.totR : '']);

  var foot = 'Of "Earlier workshops", ' + vin_inr_(t.unmapped)
           + ' names a batch mdl_Batches has no row for — all pre-April. This is the same '
           + 'figure the Funnel COVERAGE block and the Audit page report.';
  out.push([foot, '', '', '', '', '', '', '', '', '', '', '']);

  var n = out.length;
  sh.getRange(VIN_FIRST_ROW, VIN_FIRST_COL, n, VIN_NUM_COLS).setValues(out);

  var r0      = VIN_FIRST_ROW;
  var headRow = r0 + 3;
  var dataTop = r0 + 4;
  var totRow  = r0 + 4 + rows.length;

  sh.getRange(r0, VIN_FIRST_COL, 1, VIN_NUM_COLS).merge()
    .setFontSize(12).setFontWeight('bold');
  sh.getRange(r0 + 1, VIN_FIRST_COL, 1, VIN_NUM_COLS).merge()
    .setFontSize(9).setFontColor('#666666').setWrap(true);
  sh.getRange(r0 + 2, VIN_FIRST_COL, 1, VIN_NUM_COLS)
    .setFontSize(9).setFontColor('#666666').setHorizontalAlignment('center');

  // group headers sit over their two columns
  [[3, 2], [5, 2], [7, 2], [9, 2], [11, 2]].forEach(function (p) {
    sh.getRange(r0 + 2, VIN_FIRST_COL + p[0] - 2, 1, p[1]).merge()
      .setHorizontalAlignment('center');
  });

  sh.getRange(headRow, VIN_FIRST_COL, 1, VIN_NUM_COLS)
    .setFontWeight('bold').setBorder(null, null, true, null, null, null);

  if (rows.length) {
    // offsets 1-10 are the five revenue/units pairs; offset 11 is the share
    sh.getRange(dataTop, VIN_FIRST_COL + 1, rows.length + 1, 10).setNumberFormat('#,##0');
    sh.getRange(dataTop, VIN_FIRST_COL + 11, rows.length + 1, 1).setNumberFormat('0.0%');
    sh.getRange(totRow, VIN_FIRST_COL, 1, VIN_NUM_COLS)
      .setFontWeight('bold').setBorder(true, null, null, null, null, null);
  }

  sh.getRange(r0 + n - 1, VIN_FIRST_COL, 1, VIN_NUM_COLS).merge()
    .setFontSize(9).setFontColor('#666666').setWrap(true);
}

/* ------------------------------------------------------------------ helpers */

/**
 * Canonical batch code. mdl_Payments stores the RAW source value despite what
 * the Data Dictionary says, so the mapping has to happen here:
 *   141 / "141.0"  -> C141      (bare mastermind numbers)
 *   "GEF 60"       -> E60       (engineering, three source vocabularies)
 *   "BC12i"        -> BC12I
 *   Referral / Website / LP - AIGF / GEF - 18967 -> '' (no workshop)
 * Verified against mdl_Batches: all 77 batches with revenue reconcile exactly.
 */
function vin_canon_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim();
  if (!s) return '';
  var low = s.toLowerCase();
  if (low === 'referral' || low === 'website' || low === 'lp - aigf' || low === 'gef - 18967') return '';
  var m = s.match(/^(\d+)(?:\.0+)?$/);
  if (m) return 'C' + parseInt(m[1], 10);
  m = s.match(/^GEF\s*-?\s*(\d+)$/i);
  if (m) return 'E' + parseInt(m[1], 10);
  return s.toUpperCase();
}

/** header name (lowercased, trimmed) -> column index */
function vin_headerIndex_(headerRow) {
  var ix = {};
  for (var i = 0; i < headerRow.length; i++) {
    var h = String(headerRow[i] || '').trim().toLowerCase();
    if (h && !(h in ix)) ix[h] = i;
  }
  return ix;
}

/** Read columns by NAME, never by position — the source layout has moved before. */
function vin_need_(ix, name, tab) {
  if (!(name in ix)) throw new Error('buildVintageBlock: ' + tab + ' has no "' + name + '" column.');
  return ix[name];
}

function vin_label_(key) {
  var y = Math.floor(key / 100), mo = key % 100;
  var names = ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December'];
  return names[mo - 1] + ' ' + y;
}

/** Indian digit grouping — last 3, then pairs. Matches the rest of the workbook. */
function vin_inr_(n) {
  var s = Math.abs(Math.round(n)).toString();
  var out;
  if (s.length <= 3) {
    out = s;
  } else {
    var tail = s.slice(-3), head = s.slice(0, -3);
    out = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
  }
  return (n < 0 ? '-₹' : '₹') + out;
}
