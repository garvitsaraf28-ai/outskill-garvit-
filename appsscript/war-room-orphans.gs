/**
 * warRoomLostRows - READ ONLY. Writes nothing, anywhere.
 *
 * WHAT IS ALREADY PROVEN
 *
 *   12 October rows are in src_Payments and never reach mdl_Payments, and
 *   they are worth 12.97 L. 9.90 L of that belongs to five roster agents
 *   and is the entire gap between the board and CBC:
 *
 *     Kshitij            6.19 L import   1.99 L model   8 rows   5 rows
 *     Dhanush Kirthi     3.28 L          14,155         3        1
 *     Kashish Sinha      1.43 L          0              2        0
 *     Tamanna Choudhary  94,999          0              1        0
 *     Sarthak Thakur     1.99 L          1.80 L         2        1
 *
 *   The board and the Management Report were right all along. They read a
 *   model that is missing rows.
 *
 * WHY THIS EXISTS
 *
 *   Knowing 12 rows are lost does not say WHY, and the why decides the
 *   fix. A programme whitelist, a currency the builder cannot parse, a
 *   de-duplicate on Payment ID that is too eager, a status it quietly
 *   skips - each is a different repair, and guessing between them would
 *   mean changing how revenue is counted on a hunch.
 *
 *   So this prints the lost rows in full, every column with a value in it.
 *   Twelve rows side by side make the pattern obvious in one look.
 *
 * HOW IT MATCHES
 *
 *   On owner + date + amount, counted as a MULTISET rather than a set: if
 *   the import holds three identical rows and the model holds one, two are
 *   lost, and a set would have called that a match. That distinction is
 *   the whole question where a de-duplicate is a suspect.
 *
 * Read only. Opens neither CBC nor the Payment Tracker.
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

  /* every column name in the import, so the rows can be printed in full */
  var head = src.head, wide = [];
  for (var h = 0; h < head.length; h++) wide.push(wr_str_(head[h]));

  function rowKey(row, c) {
    var d = row[c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    if (wr_monthKey_(d) !== monthKey) return '';
    var nm = wr_str_(row[c.agent]);
    if (!nm || wr_isSummary_(nm)) return '';
    return wr_key_(nm) + '|' + Utilities.formatDate(d, WR_TZ, 'yyyy-MM-dd') +
           '|' + Math.round(wr_num_(row[c.amt]));
  }

  /* MULTISET. A de-duplicate is a live suspect, so three identical rows
     against one must read as two lost, not as a match. */
  var have = {};
  for (var r = 0; r < mdl.rows.length; r++) {
    var k = rowKey(mdl.rows[r], mdl.c);
    if (k) have[k] = (have[k] || 0) + 1;
  }

  var lost = [], lostRev = 0;
  for (var r2 = 0; r2 < src.rows.length; r2++) {
    var k2 = rowKey(src.rows[r2], src.c);
    if (!k2) continue;
    if (have[k2]) { have[k2]--; continue; }
    lost.push(src.rows[r2]);
    lostRev += wr_num_(src.rows[r2][src.c.amt]);
  }

  L('  lost rows : ' + lost.length + '   worth ' + M(lostRev));
  L('');
  if (!lost.length) {
    L('  None. Every October row in the import has a match in the model,');
    L('  so the loss is not row-for-row and the amounts differ some other');
    L('  way - a column being read differently on each side.');
    return;
  }

  for (var i = 0; i < lost.length && i < 40; i++) {
    L('  --- lost row ' + (i + 1) + ' ---');
    var row = lost[i];
    for (var cI = 0; cI < wide.length && cI < row.length; cI++) {
      if (!wide[cI]) continue;
      var v = row[cI];
      if (v instanceof Date) v = Utilities.formatDate(v, WR_TZ, 'dd-MMM-yyyy');
      v = wr_str_(v);
      if (!v) continue;
      L('      ' + P(wide[cI], 24) + v);
    }
    L('');
  }
  if (lost.length > 40) L('  ... and ' + (lost.length - 40) + ' more');

  /* a count of each value, per column, so a shared cause shows itself */
  L('  WHAT THESE ROWS HAVE IN COMMON');
  L('  (a column where ALL of them share one value is the likely filter)');
  L('');
  var interesting = ['program', 'current program(generic)', 'current program(specific)',
                     'currency', 'status', 'payment type', 'payment mode', 'source',
                     'mm', 'source channel', 'new program', 'partial payment status'];
  for (var q = 0; q < interesting.length; q++) {
    var idx = -1;
    for (var w = 0; w < wide.length; w++) {
      if (wide[w].toLowerCase() === interesting[q]) { idx = w; break; }
    }
    if (idx < 0) continue;
    var tally = {}, key;
    for (var z = 0; z < lost.length; z++) {
      var val = lost[z][idx];
      if (val instanceof Date) val = Utilities.formatDate(val, WR_TZ, 'dd-MMM-yyyy');
      val = wr_str_(val) || '(blank)';
      tally[val] = (tally[val] || 0) + 1;
    }
    var parts = [];
    for (key in tally) parts.push(key + ' x' + tally[key]);
    L('    ' + P(wide[idx], 26) + parts.join(',  ') +
      (parts.length === 1 ? '   <-- ALL THE SAME' : ''));
  }
  L('');
  L('  Nothing was written. This only reports.');
}


/**
 * Find the import tab, or the model tab, by its columns.
 *
 * wantCustomer picks them apart: the raw import carries a customer and the
 * model does not, the one structural difference that survives a rename.
 * The import also carries preamble lines above its header.
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
