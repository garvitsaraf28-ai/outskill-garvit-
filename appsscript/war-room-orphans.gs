/**
 * TWO FUNCTIONS, ONE FILE. Both READ ONLY - they write nothing, anywhere,
 * and open neither CBC nor the Payment Tracker.
 *
 *   warRoomLostRows   - which rows the model never got, and WHERE they sit
 *   warRoomSrcVsModel - the money that costs, per Lead Owner
 *
 * WHERE THIS GOT TO
 *
 *   12 October rows are in src_Payments and never reach mdl_Payments,
 *   worth 12.97 L. 9.90 L of that belongs to five roster agents and is the
 *   whole gap between the board and CBC. The board and the Management
 *   Report were never wrong - they read a model that is missing rows.
 *
 *   The 12 share no programme, no currency, no payment type. What they
 *   share is WHEN: nothing from the 1st, 2nd or 4th, and every single row
 *   dated the 6th. The model's newest payment was the 5th.
 *
 *   That is not a filter, that is staleness - every row added to the
 *   tracker since the last successful rebuild is missing, whatever date it
 *   carries, and the 3rd and 5th ones were simply entered late.
 *
 *   This settles it. If the lost rows are the LAST rows of the import,
 *   nothing is filtering them and the rebuild is not reaching them. If
 *   they are scattered among rows that did make it, something is.
 */
function warRoomLostRows() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  L('=== THE ROWS THE MODEL NEVER GOT ===   ' + monthKey);
  L('  Read only. Nothing was written.');
  L('');

  var src = wr_svmFind_(ss, true), mdl = wr_svmFind_(ss, false);
  if (!src || !mdl) { L('  Could not find both the import and the model.'); return; }

  function rowKey(row, c) {
    var d = row[c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    if (wr_monthKey_(d) !== monthKey) return '';
    var nm = wr_str_(row[c.agent]);
    if (!nm || wr_isSummary_(nm)) return '';
    return wr_key_(nm) + '|' + Utilities.formatDate(d, WR_TZ, 'yyyy-MM-dd') +
           '|' + Math.round(wr_num_(row[c.amt]));
  }

  /* MULTISET - three identical rows against one is two lost, not a match. */
  var have = {};
  for (var r = 0; r < mdl.rows.length; r++) {
    var k = rowKey(mdl.rows[r], mdl.c);
    if (k) have[k] = (have[k] || 0) + 1;
  }

  var lost = [], lostRev = 0, lastMatched = 0, firstLost = 0;
  for (var r2 = 0; r2 < src.rows.length; r2++) {
    var k2 = rowKey(src.rows[r2], src.c);
    if (!k2) continue;
    var sheetRow = src.headerRow + 2 + r2;
    if (have[k2]) {
      have[k2]--;
      if (sheetRow > lastMatched) lastMatched = sheetRow;
      continue;
    }
    if (!firstLost) firstLost = sheetRow;
    lost.push({ row: src.rows[r2], at: sheetRow });
    lostRev += wr_num_(src.rows[r2][src.c.amt]);
  }

  L('  lost rows : ' + lost.length + '   worth ' + M(lostRev));
  L('');
  if (!lost.length) {
    L('  NONE. Every October row in the import is now in the model.');
    L('  Whatever you did last fixed it - rebuild the Management Report and');
    L('  the board and both should read about 25 L.');
    return;
  }

  L('  WHERE THEY SIT IN ' + src.name);
  L('    last October row that DID make it : row ' + lastMatched);
  L('    first October row that did NOT    : row ' + firstLost);
  L('    last row of the sheet             : row ' +
    (src.headerRow + 1 + src.rows.length));
  L('');
  if (firstLost > lastMatched) {
    L('    EVERY LOST ROW IS BELOW EVERY ROW THAT MADE IT.');
    L('    Nothing is filtering them. They are the newest entries and the');
    L('    rebuild is simply not reaching them - the model is stale, not');
    L('    selective. Run updateAndCheck and then run this again: if the');
    L('    count drops to zero the only real bug is that the rebuild is not');
    L('    happening on its own.');
  } else {
    L('    THE LOST ROWS ARE MIXED IN AMONG ROWS THAT MADE IT.');
    L('    So it is NOT staleness - something is choosing against these');
    L('    particular rows, and the builder is where to look.');
  }
  L('');

  var head = src.head;
  for (var i = 0; i < lost.length && i < 20; i++) {
    L('  --- lost, at row ' + lost[i].at + ' ---');
    var row = lost[i].row, bits = [];
    for (var cI = 0; cI < head.length && cI < row.length; cI++) {
      var nm2 = wr_str_(head[cI]);
      if (!nm2) continue;
      var v = row[cI];
      if (v instanceof Date) v = Utilities.formatDate(v, WR_TZ, 'dd-MMM');
      v = wr_str_(v);
      if (!v) continue;
      if (/^(date|lead owner|amount paid|program|currency|payment type)$/i.test(nm2)) {
        bits.push(nm2 + '=' + v);
      }
    }
    L('      ' + bits.join('   '));
  }
  if (lost.length > 20) L('  ... and ' + (lost.length - 20) + ' more');
  L('');
  L('  Nothing was written. This only reports.');
}


/** Money lost per Lead Owner this month. Run after updateAndCheck. */
function warRoomSrcVsModel() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  L('=== IMPORT vs MODEL ===   ' + monthKey);
  var src = wr_svmFind_(ss, true), mdl = wr_svmFind_(ss, false);
  if (!src || !mdl) { L('  Could not find both tabs.'); return; }

  L('  import : ' + P(src.name, 16) + src.rows.length + ' rows');
  L('  model  : ' + P(mdl.name, 16) + mdl.rows.length + ' rows');
  L('');

  var A = wr_svmTally_(src, monthKey), B = wr_svmTally_(mdl, monthKey);

  L('  ' + P('OWNER', 28) + P('IMPORT', 12) + P('MODEL', 12) + P('LOST', 12) + 'ROWS i/m');
  L('');
  var names = {}, k;
  for (k in A.by) names[k] = 1;
  for (k in B.by) names[k] = 1;
  var list = [];
  for (k in names) {
    var a = A.by[k] || { rev: 0, rows: 0, name: (B.by[k] || {}).name };
    var b = B.by[k] || { rev: 0, rows: 0, name: a.name };
    list.push({ name: a.name || b.name || k, a: a, b: b, d: a.rev - b.rev });
  }
  list.sort(function (x, y) { return y.d - x.d; });

  var shown = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (Math.abs(e.d) < 1) continue;
    if (shown++ < 40) {
      L('  ' + P(e.name, 28) + P(M(e.a.rev), 12) + P(M(e.b.rev), 12) +
        P(M(e.d), 12) + e.a.rows + '/' + e.b.rows);
    }
  }
  if (!shown) {
    L('  EVERY OWNER MATCHES. The model has caught up with the import.');
    L('  Rebuild the Management Report - it and the board should now agree');
    L('  with CBC.');
  }
  L('');
  L('  ' + P('TOTAL THIS MONTH', 28) + P(M(A.rev), 12) + P(M(B.rev), 12) +
    P(M(A.rev - B.rev), 12) + A.rows + '/' + B.rows);
  L('');
  L('  Nothing was written. This only reports.');
}


/** Total one tab's month by Lead Owner. Skips cancelled, as the feed does. */
function wr_svmTally_(t, monthKey) {
  var out = { by: {}, rev: 0, rows: 0 };
  for (var r = 0; r < t.rows.length; r++) {
    var row = t.rows[r], d = row[t.c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKey_(d) !== monthKey) continue;
    var nm = wr_str_(row[t.c.agent]);
    if (!nm || wr_isSummary_(nm)) continue;
    if (t.c.stat >= 0 &&
        String(row[t.c.stat] || '').toLowerCase().indexOf('cancel') > -1) continue;
    var amt = wr_num_(row[t.c.amt]);
    var k = wr_key_(nm);
    if (!out.by[k]) out.by[k] = { name: nm, rev: 0, rows: 0 };
    out.by[k].rev += amt; out.by[k].rows++;
    out.rev += amt; out.rows++;
  }
  return out;
}


/**
 * Find the import tab, or the model tab, by its columns. The import
 * carries a customer and the model does not - the one structural
 * difference that survives a rename - and the import's header is not on
 * row 1 because of the preamble above it.
 */
function wr_svmFind_(ss, wantCustomer) {
  var tabs = ss.getSheets(), best = null;

  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3 || lastCol < 3) continue;

    var look = sh.getRange(1, 1, Math.min(25, lastRow), lastCol).getValues();
    for (var hr = 0; hr < look.length; hr++) {
      var H = wr_headers_(look[hr]);
      var c = {
        date:  wr_col_(H, ['date', 'payment date', 'paid on']),
        agent: wr_col_(H, ['lead owner', 'agent', 'owner']),
        amt:   wr_col_(H, ['amount paid', 'amount', 'amount inr']),
        stat:  wr_col_(H, ['status'])
      };
      if (c.date < 0 || c.agent < 0 || c.amt < 0) continue;

      /* Exact only - wr_col_ falls back to substrings and 'name' is a
         substring of Agent Name, Batch Name, First Name. */
      var hasCust = (H['payment email id'] !== undefined) ||
                    (H['payment email'] !== undefined) ||
                    (H['name'] !== undefined);
      if (hasCust !== !!wantCustomer) continue;

      var n = lastRow - (hr + 1);
      if (n < 1) continue;
      if (best && best.rows.length >= n) continue;

      best = {
        name: sh.getName(), headerRow: hr, c: c, head: look[hr],
        rows: sh.getRange(hr + 2, 1, n, lastCol).getValues()
      };
      break;
    }
  }
  return best;
}
