/**
 * Resolving a payment's batch code to a row in mdl_Batches.
 *
 * The two tabs disagree on how a batch is written. mdl_Batches holds C124;
 * mdl_Payments mostly holds a bare 124, which is why 5,583 of its 7,784 rows
 * failed to join. Revenue that fails to join does not error - it silently
 * goes missing from the batch totals - so this resolves what it safely can
 * and names the rest rather than guessing.
 *
 * The rule
 * --------
 * A code with no letters is matched on its digits: 124 -> C124. Across the
 * real data every bare code had exactly one candidate, because the C and E
 * series do not overlap.
 *
 * A code WITH letters must match exactly. BCR1 is a generalist bootcamp, and
 * is neither BC1 nor EBC1 - matching it on digits alone would have merged a
 * batch into an unrelated one and moved real revenue with it. When the
 * letters do not match a known batch, the answer is that the batch is missing
 * from mdl_Batches, not that some similar batch will do.
 */

var BATCH_TAB = 'mdl_Batches';
var BATCH_KEY_COL = 1;

var PAYMENTS_TAB = 'mdl_Payments';
var PAYMENTS_BATCH_COL = 13;
var PAYMENTS_AMOUNT_COL = 8;

/** A code that is digits only, and one that carries a letter prefix. */
var BARE_DIGITS_RE = /^\d+$/;
var PREFIXED_CODE_RE = /^([A-Z]+)[\s-]*(\d+)$/i;

/**
 * Index the batch keys once: exact lookups, plus the bare-digit lookup that
 * the payment codes need. A digit key holding more than one batch is what
 * makes a bare code ambiguous.
 */
function buildBatchIndex_(ss) {
  var sheet = ss.getSheetByName(BATCH_TAB);
  if (!sheet || sheet.getLastRow() < 2) return { exact: {}, byDigits: {}, count: 0 };

  var raw = sheet.getRange(2, BATCH_KEY_COL, sheet.getLastRow() - 1, 1).getDisplayValues();
  var exact = {}, byDigits = {}, count = 0;

  raw.forEach(function (r) {
    var key = String(r[0]).trim();
    if (!key || exact[key.toUpperCase()]) return;

    exact[key.toUpperCase()] = key;
    count++;

    var m = key.match(PREFIXED_CODE_RE);
    if (!m) return;
    var digits = String(parseInt(m[2], 10));
    if (!byDigits[digits]) byDigits[digits] = [];
    byDigits[digits].push(key);
  });

  return { exact: exact, byDigits: byDigits, count: count };
}

/**
 * Resolve one payment code against the index.
 *
 * Returns a status alongside the key so a caller can treat an unresolved code
 * as an exception to report rather than a row to drop:
 *
 *   exact       the code is already a batch key
 *   normalized  a bare number matched exactly one batch
 *   ambiguous   a bare number matched several - needs a rule, not a guess
 *   unknown     no batch matches; if it carries letters, it is missing from
 *               mdl_Batches rather than mistyped
 *   blank       no code on the row
 */
function resolveBatchKey_(raw, index) {
  var code = String(raw == null ? '' : raw).trim();
  if (!code) return { status: 'blank', key: '', code: code };

  var hit = index.exact[code.toUpperCase()];
  if (hit) return { status: 'exact', key: hit, code: code };

  if (BARE_DIGITS_RE.test(code)) {
    var candidates = index.byDigits[String(parseInt(code, 10))] || [];
    if (candidates.length === 1) {
      return { status: 'normalized', key: candidates[0], code: code };
    }
    if (candidates.length > 1) {
      return { status: 'ambiguous', key: '', code: code, candidates: candidates };
    }
  }

  return { status: 'unknown', key: '', code: code };
}

/**
 * What resolving every payment row would do, before anything is changed.
 *
 * Reports rows and revenue per status, and names every code that does not
 * resolve. Revenue here counts every payment row, including part payments and
 * refunds, so it sizes the join problem - it is not a sales total.
 */
function previewBatchKeys() {
  var ss = SpreadsheetApp.getActive();
  var index = buildBatchIndex_(ss);
  var out = [];

  out.push('BATCH KEY RESOLUTION');
  out.push('');
  out.push('  ' + BATCH_TAB + ': ' + index.count + ' batch keys');
  out.push('');

  var sheet = ss.getSheetByName(PAYMENTS_TAB);
  if (!sheet || sheet.getLastRow() < 2) {
    out.push('  ' + PAYMENTS_TAB + ' is empty or missing.');
    Logger.log(out.join('\n'));
    return;
  }

  var n = sheet.getLastRow() - 1;
  var codes = sheet.getRange(2, PAYMENTS_BATCH_COL, n, 1).getDisplayValues();
  var amounts = sheet.getRange(2, PAYMENTS_AMOUNT_COL, n, 1).getDisplayValues();

  var stats = {}, unresolved = {};

  for (var i = 0; i < n; i++) {
    var r = resolveBatchKey_(codes[i][0], index);
    var money = batchAmount_(amounts[i][0]);

    if (!stats[r.status]) stats[r.status] = { rows: 0, money: 0 };
    stats[r.status].rows++;
    stats[r.status].money += money;

    if (r.status === 'ambiguous' || r.status === 'unknown') {
      var label = r.code + (r.candidates ? '  (' + r.candidates.join(' / ') + ')' : '');
      if (!unresolved[label]) unresolved[label] = { rows: 0, money: 0, status: r.status };
      unresolved[label].rows++;
      unresolved[label].money += money;
    }
  }

  ['exact', 'normalized', 'ambiguous', 'unknown', 'blank'].forEach(function (s) {
    var v = stats[s];
    if (!v) return;
    out.push('  ' + batchPad_(s, 12) + batchPad_(v.rows + ' rows', 12) +
      batchCommas_(v.money));
  });
  out.push('');

  var labels = Object.keys(unresolved).sort(function (a, b) {
    return unresolved[b].money - unresolved[a].money;
  });

  out.push('  DOES NOT RESOLVE: ' + labels.length + ' code(s)');
  labels.slice(0, 30).forEach(function (l) {
    out.push('      ' + batchPad_(l, 34) + batchPad_(unresolved[l].rows + ' rows', 11) +
      batchCommas_(unresolved[l].money));
  });
  if (labels.length > 30) out.push('      ... and ' + (labels.length - 30) + ' more');

  Logger.log(out.join('\n'));
}

/** Display values arrive with separators and currency symbols. */
function batchAmount_(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function batchCommas_(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function batchPad_(s, width) {
  s = String(s);
  while (s.length < width) s += ' ';
  return s;
}
