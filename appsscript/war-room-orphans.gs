/**
 * warRoomSrcVsModel - READ ONLY. Writes nothing, anywhere.
 *
 * WHAT KILLED THE LAST THEORY, AND WHAT IT REVEALED
 *
 *   Instalments losing their owner was a good theory and it was wrong:
 *   not one dropped row this month belongs to a customer a roster agent
 *   ever closed. Zero. That is settled.
 *
 *   The run that settled it printed something far more important by
 *   accident. src_Payments holds 14,960 rows. mdl_Payments holds 10,403.
 *   And the same off-roster names come out HIGHER in the raw import than
 *   in the model - Priyadarsan 4.48 L against 3.74 L, Anjali 4.26 against
 *   3.42, KHUSHI A GANDHI 3.40 against 1.93.
 *
 *   The model is losing rows the import already has. Not a naming problem,
 *   not an instalment problem - the build step between them is dropping
 *   data, and it does it silently.
 *
 *   If it drops rows belonging to other teams it drops rows belonging to
 *   ours, and 9.91 L of them would explain the whole gap.
 *
 * WHAT THIS DOES
 *
 *   Totals this month per Lead Owner in BOTH tabs and prints them side by
 *   side, biggest disagreement first. Every rupee in the import that never
 *   reached the model shows up as a difference against the name it belongs
 *   to.
 *
 *   If the five short agents appear here with roughly their shortfalls,
 *   the fault is in whatever builds mdl_Payments and nowhere else.
 *
 * It replaces the orphan test, which has done its job. Read only - it
 * opens neither CBC nor the Payment Tracker, only this workbook's own tabs.
 */
function warRoomSrcVsModel() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  L('=== IMPORT vs MODEL ===   ' + monthKey);
  L('  Read only. Nothing was written.');
  L('');

  var src = wr_svmFind_(ss, true);
  var mdl = wr_svmFind_(ss, false);
  if (!src) { L('  Could not find a raw payments import tab.'); return; }
  if (!mdl) { L('  Could not find mdl_Payments.'); return; }

  L('  import : ' + P(src.name, 18) + src.rows.length + ' rows   (header row ' +
    (src.headerRow + 1) + ')');
  L('  model  : ' + P(mdl.name, 18) + mdl.rows.length + ' rows   (header row ' +
    (mdl.headerRow + 1) + ')');
  L('');

  var A = wr_svmTally_(src, monthKey);
  var B = wr_svmTally_(mdl, monthKey);

  L('  THIS MONTH, PER LEAD OWNER');
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

  var shown = 0, lostTotal = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (Math.abs(e.d) < 1) continue;            // identical, nothing to say
    lostTotal += e.d;
    if (shown++ < 40) {
      /* Signed, so a model holding MORE than the import reads as a minus
         rather than hiding inside a column headed LOST. */
      L('  ' + P(e.name, 28) + P(M(e.a.rev), 12) + P(M(e.b.rev), 12) +
        P(M(e.d), 12) + e.a.rows + '/' + e.b.rows);
    }
  }
  if (!shown) L('  (every owner matches - the model is not losing anything this month)');
  L('');

  L('  ' + P('TOTAL THIS MONTH', 28) + P(M(A.rev), 12) + P(M(B.rev), 12) +
    P(M(A.rev - B.rev), 12) + A.rows + '/' + B.rows);
  L('');
  L('    The gap to explain is 9.91 L across Kshitij, Dhanush Kirthi,');
  L('    Kashish Sinha, Tamanna Choudhary and Sarthak Thakur. If they are');
  L('    in the list above, the fault is in whatever builds mdl_Payments.');
  L('    If the import matches the model everywhere, the money was never');
  L('    imported and the fault is upstream of this workbook.');
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
 * Find the import tab, or the model tab, by its columns.
 *
 * wantCustomer picks them apart: the raw import carries a customer (name
 * or payment email) and the model does not, which is the one structural
 * difference between them that holds whatever either gets renamed to. The
 * import also carries preamble lines above its header, so the header is
 * not row 1 and has to be looked for.
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
        name: sh.getName(), headerRow: hr, c: c,
        rows: sh.getRange(hr + 2, 1, n, lastCol).getValues()
      };
      break;
    }
  }
  return best;
}
