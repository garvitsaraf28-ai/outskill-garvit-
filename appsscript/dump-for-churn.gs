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
    out.push('  NONE — no tab holds email addresses. They have to be entered by hand,');
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
