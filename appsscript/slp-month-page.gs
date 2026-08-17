/**
 * SlpMonthPage.gs - the SuperLeap numbers, sliceable by month and source.
 *
 * The SuperLeap Churn tab is every lead since 1 April summed into one
 * figure per agent. That is deliberate and it stays that way, because other
 * things read it. This page is the same numbers with two dropdowns in front
 * of them.
 *
 * Run buildSlpMonthPage(). It writes:
 *   "SuperLeap by Month"  - the visible page
 *   "_SlpMonthData"       - hidden lookup, one row per key
 *
 * NOTHING TO SWITCH ON
 *
 *   It needs month and source, which only a v3 payload carries. On a v1
 *   payload it writes nothing, says exactly why in the log, and leaves any
 *   existing page alone.

 *   NOTE ON "source". SuperLeap's source field is the lead CHANNEL -
 *   Website, Inbound Call, Manual, Bulk Upload - not the workshop code
 *   (C160, MM158) the rest of this workbook joins on. That was assumed
 *   rather than checked when the v3 prompt was written, and a real
 *   payload proved it wrong: five values, all channels. The dimension is
 *   still worth having, it is just not the workshop one. If a workshop
 *   filter is wanted, the field carrying it has to be found in SuperLeap
 *   first.
 *
 *   Run it again after the first v3 payload lands and it builds. Nothing
 *   here has to be edited in between.
 *
 * WHY A HIDDEN LOOKUP TAB RATHER THAN FORMULAS OVER THE RAW DATA
 *
 *   Same reason the Overall Report uses one: every cell is a single
 *   INDEX/MATCH against a pre-summed key, so changing a dropdown is
 *   instant and nothing has to be re-run. The alternative - SUMIFS across
 *   tens of thousands of payload rows, once per cell - recalculates the
 *   whole page on every keystroke.
 *
 *   The "All months" and "All sources" rows are real pre-summed rows, not
 *   something the page adds up at read time, for the same reason.
 */

var SMP_TAB     = 'SuperLeap by Month';
var SMP_DATA    = '_SlpMonthData';
var SMP_ALL_M   = 'All months';
var SMP_ALL_S   = 'All sources';

/* A guard, not a target. If the key count ever gets near this the page has
   stopped being a page, and silently writing 200,000 rows into someone's
   workbook is not a kindness. */
var SMP_MAX_ROWS = 60000;

/* Same nine dispositions the churn tab shows, in SuperLeap's own order.
   Falls back to a local copy so this file can be pasted before or after
   SuperLeapChurn.gs without depending on load order. */
function smp_disps_() {
  if (typeof SLP_DISPS !== 'undefined' && SLP_DISPS && SLP_DISPS.length) return SLP_DISPS;
  return ['Prospect', 'Non Contact', 'Invalid', 'Disqualified', 'Lead',
          'Not Interested', 'Already Paid', 'Financial Issue', 'Sales Won'];
}


/* ================================================================
   1.  BUILD
   ================================================================ */
function buildSlpMonthPage() {
  var t0 = new Date();
  Logger.log('--- SuperLeap by Month ---');

  if (typeof slp_storedPayload_ !== 'function') {
    Logger.log('STOPPING: SlpPayload.gs is not in this project. Paste it first.');
    return { error: 'no SlpPayload.gs' };
  }

  var pay = slp_storedPayload_();
  if (!pay) {
    Logger.log('STOPPING: no payload stored yet. Run slpAutoRefresh() first.');
    return { error: 'no payload' };
  }

  if (!pay.rows || !pay.rows.length || !pay.months || !pay.months.length) {
    Logger.log('NOTHING TO BUILD: this payload carries no month.');
    Logger.log('');
    Logger.log('  It is v' + slp_payloadVersion_(pay) + '. Month and source arrive with v3.');
    Logger.log('  SuperLeap sums the leads before they reach the sheet, so a month');
    Logger.log('  cannot be recovered from what is here - it has to be in the query.');
    Logger.log('');
    Logger.log('  Nothing was written and any existing page was left alone.');
    Logger.log('  See appsscript/README.md, "Switching to v3".');
    return { error: 'payload has no month' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ros = (typeof slp_roster_ === 'function') ? slp_roster_(ss) : null;
  if (!ros || !ros.count) {
    Logger.log('STOPPING: mdl_Roster unreadable, so nothing could be tied to an agent.');
    return { error: 'no roster' };
  }

  var nameMap = (typeof SLP_NAME_MAP !== 'undefined' && SLP_NAME_MAP) ? SLP_NAME_MAP : {};
  var disps = smp_disps_();

  var agg = smp_aggregate_(pay.rows, ros, nameMap, disps);

  if (!agg.agents.length) {
    Logger.log('STOPPING: no payload row matched an agent on mdl_Roster.');
    return { error: 'no agents matched' };
  }

  var rows = smp_lookupRows_(agg, disps);
  if (rows.length - 1 > SMP_MAX_ROWS) {
    Logger.log('STOPPING: the lookup would be ' + (rows.length - 1) + ' rows, past the ' +
               SMP_MAX_ROWS + ' guard. Narrow the routine query before building this.');
    return { error: 'too many keys' };
  }

  /* ---------------- hidden lookup ---------------- */
  var dsh = ss.getSheetByName(SMP_DATA) || ss.insertSheet(SMP_DATA);
  dsh.clear();
  dsh.getRange(1, 1, rows.length, 1).setNumberFormat('@');    // keys stay text
  dsh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  dsh.setFrozenRows(1);
  dsh.hideSheet();

  /* ---------------- the visible page ---------------- */
  agg.snapshot = pay.snapshot || '';
  smp_writePage_(ss, agg, disps, t0);

  Logger.log('built in ' + Math.round((new Date() - t0) / 1000) + 's');
  Logger.log('  agents    : ' + agg.agents.length);
  Logger.log('  months    : ' + agg.months.join(', '));
  Logger.log('  sources   : ' + agg.sources.length);
  Logger.log('  lookup    : ' + (rows.length - 1) + ' rows on the hidden "' + SMP_DATA + '"');
  Logger.log('  leads     : ' + agg.total);

  return { agents: agg.agents.length, months: agg.months.length,
           sources: agg.sources.length, keys: rows.length - 1 };
}


/* ================================================================
   2.  AGGREGATE

   Every payload row is added to four keys, so "All months" and "All
   sources" are real sums rather than something the page works out at
   read time:

     month|source|agent   month|ALL|agent   ALL|source|agent   ALL|ALL|agent

   Only keys that actually carry leads are emitted. The page reads through
   IFERROR(..., 0), so a key that is not there is correctly a zero, and
   writing the full cross product would be tens of thousands of rows of
   nothing.
   ================================================================ */
function smp_aggregate_(payRows, ros, nameMap, disps) {
  var buckets = {};
  var months = {}, sources = {}, agents = {}, agentOrder = [];
  var total = 0;

  function bucket(key) {
    var b = buckets[key];
    if (!b) {
      b = buckets[key] = { total: 0, pending: 0, d: {} };
      disps.forEach(function (d) { b.d[d] = 0; });
    }
    return b;
  }

  payRows.forEach(function (r) {
    var slpName = String(r.agent || '').trim();
    if (!slpName) return;

    // Not on the roster means a manager, a lead pool or another team. The
    // churn tab draws the line in the same place.
    var hit = ros.find(nameMap[slpName] || slpName);
    if (!hit) return;

    var agent = hit.agent;
    var month = String(r.month || '');
    var src = String(r.source || '');
    if (!month) return;                      // cannot place it on the month axis
    if (!src) src = '(no source)';

    var n = Number(r.n || 0);
    if (!n) return;

    var d = String(r.disposition || '');

    if (!agents[agent]) {
      agents[agent] = { agent: agent, mgr: hit.mgr || '(unassigned)',
                        team: hit.team || '-', status: hit.status || '-' };
      agentOrder.push(agent);
    }
    months[month] = true;
    sources[src] = true;
    total += n;

    [month + '|' + src + '|' + agent,
     month + '|' + SMP_ALL_S + '|' + agent,
     SMP_ALL_M + '|' + src + '|' + agent,
     SMP_ALL_M + '|' + SMP_ALL_S + '|' + agent].forEach(function (k) {
      var b = bucket(k);
      b.total += n;
      if (d) { if (b.d[d] !== undefined) b.d[d] += n; }
      else b.pending += n;
    });
  });

  var list = agentOrder.map(function (a) { return agents[a]; })
    .sort(function (x, y) {
      if (x.mgr !== y.mgr) return x.mgr < y.mgr ? -1 : 1;
      return x.agent < y.agent ? -1 : 1;
    });

  return {
    buckets: buckets,
    agents: list,
    months: Object.keys(months).sort(),
    sources: Object.keys(sources).sort(),
    total: total
  };
}


/** The hidden tab: header row, then one row per non-empty key. */
function smp_lookupRows_(agg, disps) {
  var head = ['KEY', 'Total'].concat(disps).concat(['Not dispositioned']);
  var rows = [head];

  Object.keys(agg.buckets).forEach(function (k) {
    var b = agg.buckets[k];
    var row = [k, b.total];
    disps.forEach(function (d) { row.push(b.d[d] || 0); });
    row.push(b.pending);
    rows.push(row);
  });

  return rows;
}


/* ================================================================
   3.  THE PAGE
   ================================================================ */
function smp_writePage_(ss, agg, disps, t0) {
  var sh = ss.getSheetByName(SMP_TAB);
  if (!sh) sh = ss.insertSheet(SMP_TAB);
  else {
    // clear() leaves merges behind, and a stale merge breaks every later
    // setValues on that range.
    sh.getDataRange().breakApart();
    sh.clear();
  }
  sh.setHiddenGridlines(true);

  var NCOL = 4 + 1 + disps.length + 3;   // mgr, team, agent, status | total | disps | pend, disp%, contact%

  sh.getRange(1, 1).setValue('SUPERLEAP BY MONTH AND SOURCE')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1f3864');

  sh.getRange(2, 1).setValue(
    'The same leads as the SuperLeap Churn tab, sliced. Pick a month in B3 and a ' +
    'lead source in C3 - both apply together and the numbers update as you choose, ' +
    'nothing needs re-running.' +
    (agg.snapshot && typeof slp_stamp_ === 'function'
      ? '   Snapshot ' + slp_stamp_(agg.snapshot) : '') +
    '   Built ' + Utilities.formatDate(t0, 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm'))
    .setFontSize(10).setFontColor('#808080').setWrap(true);
  sh.getRange(2, 1, 1, NCOL).merge();

  /* ---- the two dropdowns ---- */
  sh.getRange(3, 1).setValue('Filter').setFontWeight('bold').setFontColor('#1f3864');

  // Text format BEFORE the value. "Aug 2026" written into a general cell is
  // parsed into a Date - it still reads as "Aug 2026" but the key built from
  // it concatenates as a serial number, so every MATCH misses and every cell
  // on the page returns 0. This trap has already cost this workbook a day
  // once, on the Overall Report.
  sh.getRange(3, 2, 1, 2).setNumberFormat('@');
  sh.getRange(3, 2).setValue(agg.months[agg.months.length - 1]);   // newest month
  sh.getRange(3, 3).setValue(SMP_ALL_S);
  sh.getRange(3, 2, 1, 2).setBackground('#fff3cd')
    .setBorder(true, true, true, true, null, null).setFontWeight('bold');

  sh.getRange(3, 2).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([SMP_ALL_M].concat(agg.months), true)
    .setAllowInvalid(false).build());
  sh.getRange(3, 3).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([SMP_ALL_S].concat(agg.sources), true)
    .setAllowInvalid(false).build());

  /* ---- header ---- */
  var head = ['Manager', 'Team', 'Agent (CBC)', 'Status', 'Total leads']
    .concat(disps)
    .concat(['Not dispositioned', 'Dispositioned %', 'Contact %']);

  var hRow = 5;
  sh.getRange(hRow, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3864')
    .setWrap(true).setHorizontalAlignment('center');

  /* ---- body ---- */
  var first = hRow + 1;
  var body = agg.agents.map(function (a, i) {
    var row = first + i;
    var key = '$B$3&"|"&$C$3&"|"&$C' + row;

    function look(col) {
      return '=IFERROR(INDEX(' + SMP_DATA + '!$' + smp_col_(col) + ':$' + smp_col_(col) +
             ',MATCH(' + key + ',' + SMP_DATA + '!$A:$A,0)),0)';
    }

    var out = [a.mgr, a.team, a.agent, a.status];
    // lookup col 2 = Total, 3..(2+n) = dispositions, 3+n = Not dispositioned
    out.push(look(2));
    for (var d = 0; d < disps.length; d++) out.push(look(3 + d));
    out.push(look(3 + disps.length));

    // Percentages are computed on the page from cells that are already
    // there, rather than stored, so they cannot disagree with the counts
    // above them.
    var totalCell = '$' + smp_col_(5) + row;
    var pendCell  = '$' + smp_col_(5 + disps.length + 1) + row;
    var ncCell    = '$' + smp_col_(6 + disps.indexOf('Non Contact')) + row;
    out.push('=IFERROR((' + totalCell + '-' + pendCell + ')/' + totalCell + ',0)');
    out.push(disps.indexOf('Non Contact') < 0
      ? '=IFERROR((' + totalCell + '-' + pendCell + ')/' + totalCell + ',0)'
      : '=IFERROR((' + totalCell + '-' + pendCell + '-' + ncCell + ')/' + totalCell + ',0)');

    return out;
  });

  if (body.length) {
    sh.getRange(first, 1, body.length, head.length).setValues(body);
    sh.getRange(first, 5, body.length, disps.length + 2).setNumberFormat('#,##0')
      .setHorizontalAlignment('center');
    sh.getRange(first, head.length - 1, body.length, 2).setNumberFormat('0.0%')
      .setHorizontalAlignment('center');
    sh.getRange(first, 5, body.length, 1).setFontWeight('bold');
  }

  /* ---- total row ---- */
  var tRow = first + body.length;
  if (body.length) {
    var tvals = ['', '', 'TOTAL', ''];
    for (var c = 5; c <= 5 + disps.length + 1; c++) {
      var L = smp_col_(c);
      tvals.push('=SUM(' + L + first + ':' + L + (tRow - 1) + ')');
    }
    var tt = '$' + smp_col_(5) + tRow;
    var tp = '$' + smp_col_(5 + disps.length + 1) + tRow;
    var tn = '$' + smp_col_(6 + disps.indexOf('Non Contact')) + tRow;
    tvals.push('=IFERROR((' + tt + '-' + tp + ')/' + tt + ',0)');
    tvals.push(disps.indexOf('Non Contact') < 0
      ? '=IFERROR((' + tt + '-' + tp + ')/' + tt + ',0)'
      : '=IFERROR((' + tt + '-' + tp + '-' + tn + ')/' + tt + ',0)');

    sh.getRange(tRow, 1, 1, tvals.length).setValues([tvals])
      .setFontWeight('bold').setBackground('#d9d9d9');
    sh.getRange(tRow, 5, 1, disps.length + 2).setNumberFormat('#,##0')
      .setHorizontalAlignment('center');
    sh.getRange(tRow, head.length - 1, 1, 2).setNumberFormat('0.0%')
      .setHorizontalAlignment('center');
  }

  sh.getRange(tRow + 2, 1).setValue(
    'Only leads that carry a month are on this page. "' + SMP_ALL_M + '" and "' +
    SMP_ALL_S + '" are pre-summed rows on the hidden lookup, not the page adding ' +
    'the columns up, so they stay right when a filter is applied. Rebuild with ' +
    'buildSlpMonthPage() after a payload arrives with a new month or source in it - ' +
    'the dropdown lists are written at build time.   Source here is the lead ' +
    'channel SuperLeap records (Website, Inbound Call, Manual, Bulk Upload), not ' +
    'the workshop code the rest of the workbook joins on.')
    .setFontStyle('italic').setFontColor('#666666').setWrap(true);
  sh.getRange(tRow + 2, 1, 2, NCOL).merge();

  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 150);
  sh.setColumnWidth(4, 80);
  for (var w = 5; w <= NCOL; w++) sh.setColumnWidth(w, 92);
  sh.setFrozenRows(hRow);
  sh.setFrozenColumns(3);
  SpreadsheetApp.flush();
}


/** 1 -> A, 27 -> AA. */
function smp_col_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}


/* ================================================================
   4.  PROVE THE AGGREGATION, WITHOUT A SHEET

   The part that can be wrong in a way nobody notices is the bucketing:
   an "All months" row that does not equal the sum of its months is a
   number people will act on. Run this after any edit to this file.
   ================================================================ */
function slpMonthPageSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  var disps = ['Prospect', 'Non Contact', 'Sales Won'];
  var ros = {
    count: 2,
    find: function (n) {
      if (n === 'Ann') return { agent: 'Ann', mgr: 'M1', team: 'India', status: 'Active' };
      if (n === 'Bob') return { agent: 'Bob', mgr: 'M1', team: 'India', status: 'Active' };
      return null;
    }
  };

  var rows = [
    { agent: 'Ann', month: '2026-07', source: 'C160', disposition: 'Prospect', n: 10 },
    { agent: 'Ann', month: '2026-08', source: 'C160', disposition: 'Prospect', n: 20 },
    { agent: 'Ann', month: '2026-08', source: 'C161', disposition: 'Non Contact', n: 5 },
    { agent: 'Ann', month: '2026-08', source: 'C161', disposition: '', n: 7 },
    { agent: 'Bob', month: '2026-08', source: 'C160', disposition: 'Sales Won', n: 3 },
    { agent: 'Pool', month: '2026-08', source: 'C160', disposition: 'Prospect', n: 999 },
    { agent: 'Ann', month: '', source: 'C160', disposition: 'Prospect', n: 500 }
  ];

  var agg = smp_aggregate_(rows, ros, {}, disps);
  var B = agg.buckets;

  eq('agents matched', agg.agents.length, 2);
  eq('pool excluded', agg.total, 10 + 20 + 5 + 7 + 3);
  eq('monthless row excluded', !!B['|C160|Ann'], false);
  eq('months found', agg.months.join(','), '2026-07,2026-08');
  eq('sources found', agg.sources.join(','), 'C160,C161');

  eq('one month one source', B['2026-08|C160|Ann'].total, 20);
  eq('one month all sources', B['2026-08|' + SMP_ALL_S + '|Ann'].total, 32);
  eq('all months one source', B[SMP_ALL_M + '|C160|Ann'].total, 30);
  eq('all months all sources', B[SMP_ALL_M + '|' + SMP_ALL_S + '|Ann'].total, 42);

  // the thing that would be wrong quietly: All must equal the sum of parts
  var sumMonths = B['2026-07|' + SMP_ALL_S + '|Ann'].total + B['2026-08|' + SMP_ALL_S + '|Ann'].total;
  eq('All months == sum of months', B[SMP_ALL_M + '|' + SMP_ALL_S + '|Ann'].total, sumMonths);
  var sumSrc = B[SMP_ALL_M + '|C160|Ann'].total + B[SMP_ALL_M + '|C161|Ann'].total;
  eq('All sources == sum of sources', B[SMP_ALL_M + '|' + SMP_ALL_S + '|Ann'].total, sumSrc);

  eq('blank disposition is pending, not lost', B['2026-08|C161|Ann'].pending, 7);
  eq('pending not counted as a disposition', B['2026-08|C161|Ann'].d['Prospect'], 0);
  eq('non contact bucketed', B['2026-08|C161|Ann'].d['Non Contact'], 5);
  eq('per-agent isolation', B[SMP_ALL_M + '|' + SMP_ALL_S + '|Bob'].total, 3);

  // totals across a bucket must equal its parts
  var b = B['2026-08|' + SMP_ALL_S + '|Ann'];
  var parts = b.pending;
  disps.forEach(function (d) { parts += b.d[d]; });
  eq('bucket total == dispositions + pending', b.total, parts);

  // only non-empty keys are emitted
  var lookup = smp_lookupRows_(agg, disps);
  eq('lookup has a header', lookup[0][0], 'KEY');
  eq('no empty keys emitted', lookup.length - 1, Object.keys(B).length);

  eq('column letters', smp_col_(1) + smp_col_(26) + smp_col_(27), 'AZAA');

  if (fails.length) {
    Logger.log('SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('SELF TEST PASSED - buckets sum correctly and nothing leaks between agents.');
  }
  return fails;
}
