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
 * Batch codes are not all one shape. C160 and C155 were the expected form,
 * but Workshop Months also carries BC5, MC5, BC4 and GEF - 18967, so match
 * any short letter prefix followed by digits rather than one fixed pattern.
 */
var BATCH_CODE_RE = /^[A-Z]{1,4}[\s-]{0,3}\d{1,5}$/i;

/** Same shape, anywhere inside a longer label. Used only as a fallback. */
var BATCH_CODE_EMBEDDED_RE = /\b[A-Z]{1,4}[\s-]?\d{1,5}\b/i;

/**
 * "Aug 2026" fits the code shape exactly and appears all over this workbook,
 * so month labels are the one false positive worth excluding by name.
 */
var MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

/** Bound the scan so a large tab cannot time the script out. */
var SCAN_MAX_ROWS = 2000;
var SCAN_MAX_COLS = 40;

/**
 * What the SuperLeap Stage tab actually holds.
 *
 * The requested report lists PTP, WFC, Non Contact-1 to -5, Not Reachable,
 * Deferred Hot, Followup and Student, and totals 11,067 CALLS. None of those
 * are on SuperLeap Churn, which carries nine different dispositions and
 * counts 80,294 LEADS - a different unit at a different grain. They look like
 * sub-dispositions, which buildSlpStageView writes to this tab as
 * "Manager | Agent (CBC) | Total | <sub dispositions>" - the requested shape.
 *
 * Whether that block exists depends on the payload carrying "sub" rows at
 * all; buildSlpStageView prints "No sub-disposition rows in this payload"
 * when it does not. Print both block headers and a few rows so the report is
 * built against the real columns rather than the ones in a screenshot.
 */
function dumpStageTab() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('SuperLeap Stage');
  var out = [];
  out.push('SUPERLEAP STAGE');
  out.push('');

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('  SuperLeap Stage is empty or missing. Run buildSlpStageView() first.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = Math.min(sheet.getLastColumn(), SCAN_MAX_COLS);
  out.push('  ' + lastRow + ' rows x ' + sheet.getLastColumn() + ' cols');
  out.push('');

  var grid = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  // The two banners slpa_matrix_ writes, and the TOTAL row that closes each.
  for (var r = 0; r < grid.length; r++) {
    var first = String(grid[r][0]).trim();
    var isBanner = /^BY (STAGE|SUB DISPOSITION)/i.test(first);
    var isTotal = first.toUpperCase() === 'TOTAL';
    if (!isBanner && !isTotal) continue;

    out.push('  r' + (r + 1) + '  ' + (isTotal ? 'TOTAL ROW' : first));

    // A banner is followed by the header row, then the agents.
    var take = isTotal ? 1 : 4;
    for (var i = 0; i < take && r + i < grid.length; i++) {
      var trimmed = trimRow_(grid[r + (isTotal ? 0 : i + 1)]);
      if (trimmed.length) out.push('      | ' + trimmed.join(' | '));
    }
    out.push('');
  }

  Logger.log(out.join('\n'));
}

/**
 * Can the SuperLeap data be filtered by workshop?
 *
 * A workshop dropdown over the SuperLeap tabs needs the underlying leads to
 * say which workshop each one belongs to. The BY AGENT block does not carry
 * that - it is one row per agent - so the field has to exist on the raw
 * export, and if it does not, no dropdown over these tabs can work and the
 * leads have to be joined to a batch some other way first.
 *
 * Profile every column of _slp_raw: header, how many distinct values, and a
 * few samples. A workshop column shows up as a small number of distinct
 * values that look like batch codes or workshop names.
 */
function checkWorkshopDimension() {
  var ss = SpreadsheetApp.getActive();
  var out = [];
  out.push('WORKSHOP DIMENSION CHECK');
  out.push('');

  ['_slp_raw', 'SuperLeap Stage'].forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    out.push('=== ' + name + ' ===');

    if (!sheet || !sheet.getLastRow()) {
      out.push('  not found or empty');
      out.push('');
      return;
    }

    var rows = Math.min(sheet.getLastRow(), SCAN_MAX_ROWS);
    var cols = Math.min(sheet.getLastColumn(), SCAN_MAX_COLS);
    out.push('  ' + sheet.getLastRow() + ' rows x ' + sheet.getLastColumn() + ' cols' +
      (sheet.getLastRow() > rows ? '   (profiling first ' + rows + ')' : ''));
    out.push('');

    var values = sheet.getRange(1, 1, rows, cols).getDisplayValues();

    for (var c = 0; c < cols; c++) {
      var header = String(values[0][c]).trim();
      var seen = {}, samples = [], count = 0, filled = 0;

      for (var r = 1; r < rows; r++) {
        var v = String(values[r][c]).trim();
        if (!v) continue;
        filled++;
        if (seen[v]) continue;
        seen[v] = true;
        count++;
        if (samples.length < 4) samples.push(v);
      }

      if (!filled) continue;

      // A workshop column is low-cardinality; a name or email column is not.
      var flag = (count > 1 && count <= 200 && samples.some(function (s) {
        return BATCH_CODE_RE.test(s) && !MONTH_RE.test(s);
      })) ? '   <-- looks like batch codes' : '';

      out.push('  ' + columnLetter(c + 1) + '  ' + (header || '(no header)'));
      out.push('      ' + count + ' distinct, ' + filled + ' filled' + flag);
      out.push('      ' + samples.join(' | '));
    }
    out.push('');
  });

  Logger.log(out.join('\n'));
}

/**
 * Find what inflates the payment totals.
 *
 * Summing Amount Paid across mdl_Payments gives about 990M, where Workshop
 * Months reports 89.7M for the same period - so something in that column is
 * not a payment. 25 rows with no batch code carried 450M between them, which
 * is 18M each and points at summary rows being counted as data.
 *
 * Print the largest rows with their type and batch, and the totals split by
 * Is Unit and Is Refund, so the real figure can be identified rather than
 * guessed at.
 */
function checkPaymentAmounts() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('mdl_Payments');
  var out = [];
  out.push('PAYMENT AMOUNT CHECK');
  out.push('');

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('  mdl_Payments is empty or missing.');
    return;
  }

  var n = sheet.getLastRow() - 1;
  var rows = sheet.getRange(2, 1, n, 18).getDisplayValues();

  var total = 0, units = 0, refunds = 0, big = [];

  rows.forEach(function (r, i) {
    var amount = paymentNumber_(r[7]);          // H  Amount Paid
    total += amount;
    if (String(r[9]).trim().toLowerCase() === 'yes') units += amount;   // J  Is Unit
    if (String(r[16]).trim().toLowerCase() === 'yes') refunds += amount; // Q  Is Refund

    big.push({
      row: i + 2,
      amount: amount,
      date: String(r[0]).trim(),
      type: String(r[8]).trim(),
      isUnit: String(r[9]).trim(),
      batch: String(r[12]).trim()
    });
  });

  out.push('  ' + n + ' rows');
  out.push('  total Amount Paid   ' + paymentCommas_(total));
  out.push('  where Is Unit = yes ' + paymentCommas_(units));
  out.push('  where Is Refund=yes ' + paymentCommas_(refunds));
  out.push('  Workshop Months says 89,720,869 for Apr-Aug');
  out.push('');

  big.sort(function (a, b) { return b.amount - a.amount; });
  out.push('  LARGEST 15 ROWS');
  big.slice(0, 15).forEach(function (b) {
    out.push('      r' + b.row + '  ' + paymentCommas_(b.amount) +
      '   unit=' + (b.isUnit || '-') +
      '   batch=' + (b.batch || '-') +
      '   ' + b.date + '  ' + b.type);
  });
  out.push('');

  var over = big.filter(function (b) { return b.amount > 1000000; });
  out.push('  rows over 1,000,000: ' + over.length);

  Logger.log(out.join('\n'));
}

function paymentNumber_(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function paymentCommas_(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Names that agent-lead-report.gs and batch-key.gs define, and the one name
 * they expect to already exist.
 *
 * Apps Script puts every file in one global scope, so two files defining the
 * same name do not error - the last one loaded wins and the other silently
 * changes behaviour. Run checkNameCollisions() BEFORE pasting either file to
 * see whether the project already has any of these.
 */
var INCOMING_NAMES = [
  'AGENT_TAB', 'AGENT_HEADER_ROW', 'AGENT_ATTENTION_COUNT', 'AGENT_COLS',
  'buildAgentLeadReport_', 'readAgentRows_', 'agentSummarise_', 'agentByTeam_',
  'agentLowestDispositioned_', 'agentSnapshotTime_', 'agentNumber_',
  'agentPercent_', 'agentPad_',
  'BATCH_TAB', 'BATCH_KEY_COL', 'PAYMENTS_TAB', 'PAYMENTS_BATCH_COL',
  'PAYMENTS_AMOUNT_COL', 'BARE_DIGITS_RE', 'PREFIXED_CODE_RE',
  'buildBatchIndex_', 'resolveBatchKey_', 'previewBatchKeys', 'batchAmount_',
  'batchCommas_', 'batchPad_',
  'runAgentLeadSchedule', 'installAgentLeadSchedule', 'testAgentLeadReport',
  'buildSchedule_'
];

/** agent-lead-report.gs calls this one rather than defining its own. */
var REQUIRED_NAMES = ['withCommas_', 'postToSlack_'];

/**
 * Report which incoming names the project already defines.
 *
 * Anything listed under TAKEN has to be renamed on one side or the other
 * before the new files are pasted, or one of the two definitions disappears
 * without any error being raised.
 */
function checkNameCollisions() {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var out = [];
  out.push('NAME COLLISION CHECK');
  out.push('');

  var taken = INCOMING_NAMES.filter(function (n) {
    return typeof g[n] !== 'undefined';
  });

  out.push('  TAKEN - already in the project: ' + taken.length);
  taken.forEach(function (n) {
    out.push('      ' + n + '   (' + typeof g[n] + ')');
  });
  if (!taken.length) {
    out.push('      none. Both files can be pasted as new.');
  }
  out.push('');

  var missing = REQUIRED_NAMES.filter(function (n) {
    return typeof g[n] !== 'function';
  });
  out.push('  EXPECTED but not found: ' + missing.length);
  missing.forEach(function (n) {
    out.push('      ' + n + '   <-- paste refresh-schedule.gs / slack-digest.gs first');
  });
  out.push('');

  // Anything already there whose name says it is the existing agent report.
  var related = Object.getOwnPropertyNames(g).filter(function (n) {
    return /agent|lead/i.test(n) && typeof g[n] === 'function';
  }).sort();

  out.push('  EXISTING functions mentioning agent or lead: ' + related.length);
  related.forEach(function (n) { out.push('      ' + n); });

  Logger.log(out.join('\n'));
}

/**
 * Two things stand between the settled inputs and a correct report.
 *
 * mdl_Payments r3 carries batch "122" where every other code is BC5 / C124 /
 * E47, so some payments may not join to mdl_Batches at all - and revenue that
 * fails to join does not error, it just goes missing from the batch totals.
 *
 * The region vocabularies also disagree: mdl_Batches says Domestic, SuperLeap
 * Churn says India. Splitting on either without mapping them would put agents
 * and batches in different buckets while both columns look populated.
 */
function checkBatchJoin() {
  var ss = SpreadsheetApp.getActive();
  var out = [];
  out.push('BATCH JOIN AND VOCABULARY CHECK');
  out.push('');

  var known = {};
  var keys = columnValues_(ss, 'mdl_Batches', 1, 2);
  keys.forEach(function (k) { known[k.toUpperCase()] = true; });
  out.push('  mdl_Batches: ' + Object.keys(known).length + ' distinct batch keys');
  out.push('');

  // Payment batches with no matching row in mdl_Batches.
  var missing = {}, blank = 0, matched = 0;
  columnValues_(ss, 'mdl_Payments', 13, 2, true).forEach(function (v) {
    if (!v) { blank++; return; }
    if (known[v.toUpperCase()]) matched++;
    else missing[v] = (missing[v] || 0) + 1;
  });

  var codes = Object.keys(missing).sort(function (a, b) { return missing[b] - missing[a]; });
  var lost = 0;
  codes.forEach(function (c) { lost += missing[c]; });

  out.push('  mdl_Payments rows: ' + matched + ' joined, ' + lost + ' unmatched, ' +
    blank + ' blank');
  out.push('');
  out.push('  UNMATCHED BATCH CODES: ' + codes.length);
  codes.slice(0, 25).forEach(function (c) {
    out.push('      ' + c + '  x' + missing[c]);
  });
  if (codes.length > 25) out.push('      ... and ' + (codes.length - 25) + ' more');
  out.push('');

  vocabulary_(out, ss, 'mdl_Batches / Region', 'mdl_Batches', 5, 2);
  vocabulary_(out, ss, 'mdl_Payments / Segment', 'mdl_Payments', 15, 2);
  vocabulary_(out, ss, 'mdl_Payments / Team', 'mdl_Payments', 7, 2);
  vocabulary_(out, ss, 'mdl_Roster / Team', 'mdl_Roster', 5, 2);

  Logger.log(out.join('\n'));
}

/** Distinct values of one column, with counts - the vocabulary to reconcile. */
function vocabulary_(out, ss, title, tab, col, fromRow) {
  var counts = {}, blank = 0;
  columnValues_(ss, tab, col, fromRow, true).forEach(function (v) {
    if (!v) blank++;
    else counts[v] = (counts[v] || 0) + 1;
  });

  var vals = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  out.push('  ' + title + ': ' + vals.length + ' distinct, ' + blank + ' blank');
  vals.slice(0, 12).forEach(function (v) {
    out.push('      ' + v + '  x' + counts[v]);
  });
  if (vals.length > 12) out.push('      ... and ' + (vals.length - 12) + ' more');
  out.push('');
}

/**
 * Trimmed values of a single column. Returns unique values by default;
 * pass keepAll when the counts matter.
 */
function columnValues_(ss, tab, col, fromRow, keepAll) {
  var sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < fromRow) return [];

  var raw = sh.getRange(fromRow, col, sh.getLastRow() - fromRow + 1, 1).getDisplayValues();
  var out = [], seen = {};

  raw.forEach(function (r) {
    var v = String(r[0]).trim();
    if (keepAll) { out.push(v); return; }
    if (v && !seen[v]) { seen[v] = true; out.push(v); }
  });
  return out;
}

var CHURN_TAB = 'SuperLeap Churn';

/** Header of the BY AGENT block. Rows above it are the lead-pool summary. */
var CHURN_AGENT_HEADER_ROW = 13;

/**
 * Measure the agent join instead of estimating it.
 *
 * SuperLeap Churn already reconciles names itself - "Agent (CBC)" against
 * "SuperLeap account" - and already carries Team, so the India/International
 * split does not need Agent Directory at all. What matters is how often that
 * reconciliation fails, because a row with a blank Team drops silently out of
 * the split and leaves the totals looking plausible and wrong.
 *
 * Report every agent row missing a Team, missing a CBC name, or whose two
 * names disagree.
 */
function checkAgentJoin() {
  var sh = SpreadsheetApp.getActive().getSheetByName(CHURN_TAB);
  var out = [];
  out.push('AGENT JOIN CHECK');
  out.push('');

  if (!sh) {
    Logger.log('  ' + CHURN_TAB + ' NOT FOUND');
    return;
  }

  var first = CHURN_AGENT_HEADER_ROW + 1;
  if (sh.getLastRow() < first) {
    Logger.log('  no rows below the BY AGENT header at r' + CHURN_AGENT_HEADER_ROW);
    return;
  }
  var values = sh.getRange(first, 1, sh.getLastRow() - first + 1, 6).getDisplayValues();

  var total = 0, noTeam = [], noCbc = [], drift = [];

  for (var i = 0; i < values.length; i++) {
    var manager = String(values[i][0]).trim();
    var team = String(values[i][1]).trim();
    var cbc = String(values[i][2]).trim();
    var account = String(values[i][3]).trim();

    // The block ends where the manager/pool listing starts, which is keyed
    // by email rather than by name.
    if (!cbc && !account) break;
    if (EMAIL_RE.test(cbc) || EMAIL_RE.test(account)) break;

    // It also ends on a TOTAL row, which has no Team and would otherwise be
    // counted as an agent that failed the split.
    if (manager.toUpperCase() === 'TOTAL') break;

    total++;
    var who = (cbc || account) + (manager ? '  (mgr ' + manager + ')' : '');
    if (!team) noTeam.push(who);
    if (!cbc) noCbc.push(who);
    if (cbc && account && cbc !== account) drift.push(cbc + '  ->  ' + account);
  }

  out.push('  ' + total + ' agent rows, r' + first + ' to r' + (first + total - 1));
  out.push('');
  report_(out, 'BLANK TEAM - dropped from the India/International split', noTeam);
  report_(out, 'NO CBC NAME - in SuperLeap, not matched to the roster', noCbc);
  report_(out, 'NAME DIFFERS - already reconciled, listed to confirm', drift);

  Logger.log(out.join('\n'));
}

/** One section of the join check, capped so the log stays readable. */
function report_(out, title, rows) {
  out.push('  ' + title + ': ' + rows.length);
  rows.slice(0, 25).forEach(function (r) {
    out.push('      ' + r);
  });
  if (rows.length > 25) out.push('      ... and ' + (rows.length - 25) + ' more');
  out.push('');
}

/**
 * Tabs whose column layout the churn report still needs, and where to start
 * reading each one. The presentation tabs open with banner and summary
 * blocks, so the header is not at row 1 - SuperLeap Churn starts at 9
 * because rows 1-8 are the lead-pool summary, already seen.
 */
var KEY_TABS = [
  { name: 'mdl_Batches', from: 1, rows: 4 },
  { name: 'mdl_Payments', from: 1, rows: 3 },
  { name: 'mdl_Roster', from: 1, rows: 3 },
  { name: 'SuperLeap Churn', from: 9, rows: 14 }
];

/**
 * Compact layout dump: a few rows from each tab the report joins against.
 * Deliberately small - the full dump has overrun the execution log on every
 * run, and the column names are all that is missing.
 */
function dumpKeyTabs() {
  var ss = SpreadsheetApp.getActive();
  var out = [];
  out.push('KEY TAB LAYOUTS');
  out.push('');

  KEY_TABS.forEach(function (spec) {
    var sh = ss.getSheetByName(spec.name);
    out.push('=== ' + spec.name + ' ===');
    if (!sh) {
      out.push('  NOT FOUND');
      out.push('');
      return;
    }

    var lastRow = sh.getLastRow();
    var lastCol = Math.min(sh.getLastColumn(), SCAN_MAX_COLS);
    out.push('  ' + lastRow + ' rows x ' + sh.getLastColumn() + ' cols');

    if (spec.from > lastRow || !lastCol) {
      out.push('  (nothing at row ' + spec.from + ')');
      out.push('');
      return;
    }

    var rows = Math.min(spec.rows, lastRow - spec.from + 1);
    var values = sh.getRange(spec.from, 1, rows, lastCol).getDisplayValues();

    values.forEach(function (row, i) {
      var trimmed = trimRow_(row);
      if (trimmed.length) out.push('  r' + (spec.from + i) + ' | ' + trimmed.join(' | '));
    });
    out.push('');
  });

  Logger.log(out.join('\n'));
}

/** Drop trailing blanks so a dumped row stays readable. */
function trimRow_(row) {
  var t = row.slice();
  while (t.length && String(t[t.length - 1]).trim() === '') t.pop();
  return t;
}

var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * Agent Directory joins to SuperLeap on agent name, which fails on spelling
 * drift ("Niraj" vs "Niraj Paul", "Chakraborty" vs "Chakrabrty"). Email is
 * the stable key, but it is only worth adding to the Directory if the other
 * side carries email too - a key with nothing to join to is no key at all.
 *
 * Report every column of email addresses in the workbook, so we know whether
 * the emails already exist somewhere and can be copied across, rather than
 * typing 67 of them by hand.
 */
function findEmailColumns() {
  var out = [];
  out.push('EMAIL COLUMNS');
  out.push('Generated ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
    'dd-MMM-yyyy HH:mm:ss'));
  out.push('');

  var found = scanColumnsFor(SpreadsheetApp.getActive(), out, EMAIL_RE, 'email');
  if (!found) {
    out.push('  NONE - no tab holds email addresses. They have to be entered by hand,');
    out.push('  and SuperLeap cannot be joined on email until its export carries one.');
  }

  Logger.log(out.join('\n'));
}

/**
 * Locator only, as its own entry point. The full dump overruns the execution
 * log every time, and the batch codes are the one open question - run this
 * when that is all you need and the whole result fits in the log.
 */
function findBatchCodes() {
  var out = [];
  out.push('Generated ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
    'dd-MMM-yyyy HH:mm:ss'));
  out.push('');
  findBatchCodeColumns(SpreadsheetApp.getActive(), out);
  Logger.log(out.join('\n'));
}

function findBatchCodeColumns(ss, out) {
  out.push('================================================');
  out.push('BATCH CODE LOCATIONS');
  out.push('');

  var found = scanColumnsFor(ss, out, BATCH_CODE_RE, 'exact', MONTH_RE);

  // The codes may be embedded in a longer label ("Cohort C160 - Mar"), which
  // the exact match misses. Falling back here means one run settles the
  // question either way instead of costing another round trip.
  if (!found) {
    out.push('  No bare codes. Retrying against labels that contain one.');
    out.push('');
    found = scanColumnsFor(ss, out, BATCH_CODE_EMBEDDED_RE, 'embedded', MONTH_RE);
  }

  if (!found) {
    out.push('  NONE FOUND - no tab holds anything shaped like a batch code.');
  }
  out.push('');
}

/**
 * Report every column whose cells match `re`, as "tab / column / header",
 * with sample values and a distinct count. The column holding the most
 * distinct codes is the join key the churn report needs.
 * Returns the number of matching columns.
 */
function scanColumnsFor(ss, out, re, label, reject) {
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
        if (reject && reject.test(cell)) continue;
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

  // Early, so it survives a truncated execution log - this is the open question.
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
      var trimmed = trimRow_(row);
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


/**
 * Which canonBatch_ is live, and are there duplicate definitions?
 *
 * Read-only. Run this from the Apps Script editor.
 *
 * canonBatch_ is defined twice in this project: the full version in
 * ModelAlliases.gs, and an older seven-line version in Code.gs that a
 * previous session's EDIT 1 said to delete and which is still there. Every
 * .gs file shares one global scope, so Apps Script keeps one of them and
 * there is no way to tell which by reading the files.
 *
 * The difference is not cosmetic. The old version does not map MM, ENG or
 * BCR codes, so the same August mastermind arrives as both MM158 and C158
 * and the model builds two workshops out of one - which is the bug the
 * comment above the good version says cost a day.
 *
 * This asks the function itself rather than guessing.
 */
function checkBatchMatcher() {
  if (typeof canonBatch_ !== 'function') {
    Logger.log('canonBatch_ is not defined in this project at all.');
    return;
  }

  var cases = [
    ['MM158', 'C158'], ['ENG64', 'E64'], ['BCR1', 'BC1'],
    ['GEF60', 'E60'],  ['141', 'C141'],  ['C158', 'C158']
  ];

  var wrong = [];
  Logger.log('--- which canonBatch_ is live ---');
  cases.forEach(function (c) {
    var got = canonBatch_(c[0]);
    var ok = got === c[1];
    if (!ok) wrong.push(c[0] + ' -> ' + got + ' (should be ' + c[1] + ')');
    Logger.log('  ' + c[0] + '  ->  ' + got + (ok ? '' : '   WRONG, expected ' + c[1]));
  });

  // Global scope keeps exactly one definition, so this can report which one
  // won but never how many were declared. Reading the live function's own
  // source is the closest thing to proof available at runtime: the keeper
  // carries five rules, the old Code.gs copy carried two.
  var rules = -1;
  try { rules = (String(canonBatch_).match(/if\s*\(\//g) || []).length; }
  catch (e) {}

  Logger.log('');
  if (!wrong.length) {
    Logger.log('VERDICT: correct. Every code maps the way it should.');
    if (rules === 5) {
      Logger.log('         The live function carries 5 rules, which is the');
      Logger.log('         ModelAlliases.gs version.');
    }
    Logger.log('');
    Logger.log('         This test sees which definition won, not how many exist.');
    Logger.log('         If Code.gs still holds a second canonBatch_, delete it -');
    Logger.log('         with two declared, which one wins depends on file order,');
    Logger.log('         so a correct answer here would be luck. With one, it is not.');
  } else {
    Logger.log('VERDICT: the OLD Code.gs version is live. This is the bug.');
    Logger.log('         ' + wrong.length + ' code(s) are not being mapped:');
    wrong.forEach(function (w) { Logger.log('           ' + w); });
    Logger.log('         Workshops are being split in two. Delete the seven-line');
    Logger.log('         canonBatch_ from Code.gs, keep the one in ModelAlliases.gs,');
    Logger.log('         then run refreshEverything.');
  }
}


/**
 * Why "Revenue (CBC)" reports 0 for every month.
 *
 * Read-only. Run this from the Apps Script editor.
 *
 * buildRoster_ finds the CBC revenue column by an EXACT header match:
 *
 *     else if (k === 'revenue') col.revenue = i;
 *
 * while the target column next to it is matched on a substring:
 *
 *     else if (k.indexOf('target') > -1 && col.target === undefined)
 *
 * So a CBC header of "Revenue Achieved" or "Total Revenue" leaves
 * col.revenue undefined, grid[row][undefined] is undefined, toNum_ turns
 * that into 0, and every month reports zero CBC revenue. Nothing errors.
 *
 * The cost is a dead cross-check. That column exists to compare our
 * payments total against CBC's own figure, and the Difference column
 * beside it is meant to be near zero. With CBC always zero, Difference
 * silently equals the whole payments revenue - it reads like a total
 * mismatch and actually means "never read".
 *
 * Attainment is computed from targets and shows a sensible 27.9%, which
 * proves these tabs are readable and that it is specifically the revenue
 * header that does not match.
 *
 * This prints the real header row of every src_Roster_* tab so the fix
 * can be made against the actual column name rather than a guess.
 */
function checkCbcRevenueColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = [];
  ss.getSheets().forEach(function (sh) {
    if (/^src_Roster_/i.test(sh.getName())) tabs.push(sh);
  });

  if (!tabs.length) { Logger.log('No src_Roster_* tabs found.'); return; }

  Logger.log('--- CBC roster headers ---');
  Logger.log('buildRoster_ needs a header that is EXACTLY "revenue" (any case).');
  Logger.log('');

  var anyExact = false;

  tabs.forEach(function (sh) {
    var grid = sh.getDataRange().getValues();
    var hRow = -1;
    for (var r = 0; r < grid.length && hRow < 0; r++)
      for (var c = 0; c < grid[r].length; c++)
        if (String(grid[r][c]).trim() === 'Agent') { hRow = r; break; }

    if (hRow < 0) { Logger.log(sh.getName() + ' : no "Agent" header row found'); return; }

    var heads = grid[hRow].map(function (h) { return String(h).trim(); })
                          .filter(function (h) { return h !== ''; });

    var exact = null, near = [];
    heads.forEach(function (h) {
      var k = h.toLowerCase();
      if (k === 'revenue') exact = h;
      else if (k.indexOf('revenue') > -1 || k.indexOf('achiev') > -1 ||
               k.indexOf('collect') > -1 || k.indexOf('sales') > -1) near.push(h);
    });

    if (exact) anyExact = true;

    Logger.log(sh.getName() + '   (header on row ' + (hRow + 1) + ')');
    Logger.log('   headers : ' + heads.join(' | '));
    Logger.log('   exact "revenue" match : ' + (exact ? 'YES' : 'NO'));
    if (!exact && near.length) Logger.log('   closest candidates    : ' + near.join(' | '));
    Logger.log('');
  });

  if (anyExact) {
    Logger.log('VERDICT: at least one tab has an exact "Revenue" header, so the');
    Logger.log('         zero is coming from somewhere else. Check whether the');
    Logger.log('         column is empty rather than misnamed.');
  } else {
    Logger.log('VERDICT: no tab has a header of exactly "Revenue", which is why');
    Logger.log('         Revenue (CBC) is 0 for every month.');
    Logger.log('');
    Logger.log('         Fix in Code.gs, inside buildRoster_. Change:');
    Logger.log('           else if (k === \'revenue\') col.revenue = i;');
    Logger.log('         to match the real name above. If you widen it to a');
    Logger.log('         substring, exclude target as well, because a header like');
    Logger.log('         "Revenue Target" would otherwise be read as revenue -');
    Logger.log('         the revenue test runs BEFORE the target test:');
    Logger.log('           else if (k.indexOf(\'revenue\') > -1 &&');
    Logger.log('                    k.indexOf(\'target\') < 0 &&');
    Logger.log('                    col.revenue === undefined) col.revenue = i;');
  }
}


/**
 * The CBC Revenue column is found but reads as zero. What is in it?
 *
 * Read-only. Run after checkCbcRevenueColumn has confirmed the header
 * exists, which it does - every src_Roster_* tab carries an exact
 * "Revenue" header, so the column is located correctly and the zero has
 * to come from the values or from how they are converted.
 *
 * buildRoster_ does:  var rev = toNum_(grid[r2][col.revenue]);
 *
 * There are only a few ways that yields 0 for every row:
 *   the cells are genuinely empty or zero
 *   they hold text toNum_ cannot parse - a currency symbol, a stray
 *     space, a non-breaking space, "-" for nil
 *   they hold an error value from a broken IMPORTRANGE
 *   the header row found is not the row the data is under
 *
 * This prints the raw cell, its JavaScript type, and what toNum_ makes
 * of it, so the answer is read rather than guessed.
 */
function checkCbcRevenueValues() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = [];
  ss.getSheets().forEach(function (sh) {
    if (/^src_Roster_/i.test(sh.getName())) tabs.push(sh);
  });
  if (!tabs.length) { Logger.log('No src_Roster_* tabs found.'); return; }

  var haveToNum = (typeof toNum_ === 'function');
  Logger.log('--- CBC Revenue values ---');
  Logger.log(haveToNum ? 'toNum_ is available, so its real output is shown.'
                       : 'toNum_ NOT found - showing parseFloat instead.');
  Logger.log('');

  tabs.forEach(function (sh) {
    var grid = sh.getDataRange().getValues();
    var hRow = -1;
    for (var r = 0; r < grid.length && hRow < 0; r++)
      for (var c = 0; c < grid[r].length; c++)
        if (String(grid[r][c]).trim() === 'Agent') { hRow = r; break; }
    if (hRow < 0) { Logger.log(sh.getName() + ' : no Agent header'); return; }

    var col = {};
    grid[hRow].forEach(function (h, i) {
      var k = String(h).trim().toLowerCase();
      if (k === 'agent') col.agent = i;
      else if (k === 'revenue') col.revenue = i;
    });

    Logger.log(sh.getName() + '   header row ' + (hRow + 1) +
               '   Agent at col ' + col.agent + '   Revenue at col ' + col.revenue);

    if (col.revenue === undefined) { Logger.log('   no revenue column'); Logger.log(''); return; }

    var shown = 0, sum = 0, nonZero = 0, dataRows = 0;
    for (var r2 = hRow + 1; r2 < grid.length; r2++) {
      var name = String(grid[r2][col.agent]).trim();
      if (!name || name === 'Total' || name === 'Agent') continue;
      dataRows++;

      var raw = grid[r2][col.revenue];
      var n = haveToNum ? toNum_(raw) : parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
      if (!isNaN(n)) sum += n;
      if (n) nonZero++;

      if (shown < 4) {
        shown++;
        Logger.log('   ' + name.slice(0, 22) +
                   '   raw=' + JSON.stringify(raw).slice(0, 30) +
                   '   type=' + (raw instanceof Date ? 'Date' : typeof raw) +
                   '   toNum_=' + n);
      }
    }
    Logger.log('   ' + dataRows + ' agent rows, ' + nonZero +
               ' with a non-zero revenue, total = ' + sum);
    Logger.log('');
  });

  Logger.log('If raw values are numbers and the total is large, the column reads');
  Logger.log('fine here and the zero is being lost later - in how buildRoster_');
  Logger.log('returns cbc, or how buildPayments_ receives it.');
  Logger.log('If the totals are 0, the CBC tabs genuinely carry no revenue and');
  Logger.log('the cross-check has nothing to compare against - that is a CBC');
  Logger.log('question, not a workbook one.');
}
