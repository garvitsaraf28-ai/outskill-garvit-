/**
 * warRoomOrphanPayments - READ ONLY. Writes nothing, anywhere.
 *
 * THE THEORY THIS TESTS
 *
 *   A sale paid in instalments is several rows in the Payment Tracker, and
 *   the later rows do not always carry the Lead Owner who closed it. The
 *   same customer appears as
 *
 *     01-Oct, Madhav,     George Sarcov, 1st Part Payment, 1/3
 *     01-Oct, Mastermind, George Sarcov, 2nd Part Payment, 2/3
 *
 *   The board credits the first row and drops the second, because
 *   "Mastermind" is not a person and not on the roster - it is a bucket,
 *   carrying 118 of October's 159 rows. CBC credits both to the closer.
 *   That one difference has the exact shape of the gap: 9.91 L across five
 *   agents, four of them International, where deals are high-ticket and
 *   paid in parts.
 *
 * WHY IT READS src_Payments AND NOT mdl_Payments
 *
 *   The first version ran on mdl_Payments and stopped with "customer keyed
 *   on: NOTHING". The model keeps Date, Lead Owner, Amount and the flags,
 *   and throws the customer away - no name, no email. Without a customer
 *   there is no way to tell that two rows are the same sale, which is also
 *   why nothing has ever noticed this. The raw import still has both, so
 *   this works there and finds the tab by looking for the columns rather
 *   than by trusting a tab name.
 *
 * WHAT THE ANSWER MEANS
 *
 *   Near 9.91 L - that is the bug, and the fix is to credit a payment to
 *   whoever owns the CUSTOMER rather than the name typed on one row.
 *   Near zero  - the theory is wrong, the money is not in the import, and
 *   the search moves upstream. It says which, in as many words.
 *
 * Paste as its own file and run warRoomOrphanPayments.
 */
function warRoomOrphanPayments() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  L('=== ORPHANED INSTALMENTS ===   ' + monthKey);
  L('  Read only. Nothing was written.');
  L('');

  var src = wr_orphFindTab_(ss);
  if (!src) {
    L('  *** No tab found with a date, a lead owner, an amount AND a customer');
    L('      (name or payment email) in it. Looked at every tab in this file.');
    L('      src_Payments is the expected one - if it exists, its header row');
    L('      is not where this could see it.');
    return;
  }

  var c = src.c, head = src.head;
  L('  reading tab   : ' + src.name + '   (header on row ' + (src.headerRow + 1) +
    ', ' + src.rows.length + ' data rows)');
  L('  customer key  : ' + (c.mail >= 0 ? '"' + head[c.mail] + '"'
                                        : '"' + head[c.cust] + '"'));
  L('  owner column  : "' + head[c.agent] + '"');
  L('  amount column : "' + head[c.amt] + '"');
  L('');

  var rows = src.rows;
  var roster = wr_roster_(ss, monthKey);

  function custKey(row) {
    var e = c.mail >= 0 ? wr_str_(row[c.mail]).toLowerCase() : '';
    if (e) return 'e:' + e;
    var n = c.cust >= 0 ? wr_key_(wr_str_(row[c.cust])) : '';
    return n ? 'n:' + n : '';
  }
  function cancelled(row) {
    if (c.stat < 0) return false;
    return String(row[c.stat] || '').toLowerCase().indexOf('cancel') > -1;
  }

  /* ---- pass 1: which roster agent took each customer's EARLIEST payment ---- */
  var ownerOf = {};
  for (var r = 0; r < rows.length; r++) {
    var d = rows[r][c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var nm = wr_str_(rows[r][c.agent]);
    if (!nm || wr_isSummary_(nm)) continue;
    var key = wr_key_(nm);
    if (!roster.byAgent[key]) continue;          // only a roster agent can own one
    var ck = custKey(rows[r]);
    if (!ck) continue;
    var t = d.getTime();
    if (!ownerOf[ck] || t < ownerOf[ck].at) ownerOf[ck] = { name: nm, key: key, at: t };
  }

  /* ---- pass 2: this month's dropped rows, traced back ---- */
  var back = {}, totRev = 0, totRows = 0, lost = 0, lostRows = 0, lostWho = {};
  for (var r2 = 0; r2 < rows.length; r2++) {
    var row = rows[r2], d2 = row[c.date];
    if (!(d2 instanceof Date) || isNaN(d2.getTime())) continue;
    if (wr_monthKey_(d2) !== monthKey) continue;
    var nm2 = wr_str_(row[c.agent]);
    if (!nm2 || wr_isSummary_(nm2)) continue;
    if (roster.byAgent[wr_key_(nm2)]) continue;  // the board already counts it
    if (cancelled(row)) continue;

    var amt = wr_num_(row[c.amt]);
    var ck2 = custKey(row);
    var own = ck2 ? ownerOf[ck2] : null;

    if (own) {
      if (!back[own.key]) back[own.key] = { name: own.name, rev: 0, rows: 0, from: {}, who: [] };
      var b = back[own.key];
      b.rev += amt; b.rows++;
      b.from[nm2] = (b.from[nm2] || 0) + amt;
      if (b.who.length < 12) {
        b.who.push(wr_str_(c.cust >= 0 ? row[c.cust] : '') + '  ' + M(amt) +
                   (c.type >= 0 ? '  ' + wr_str_(row[c.type]) : '') + '  logged to ' + nm2);
      }
      totRev += amt; totRows++;
    } else {
      lost += amt; lostRows++;
      lostWho[nm2] = (lostWho[nm2] || 0) + amt;
    }
  }

  L('  THIS MONTH\'S DROPPED MONEY, TRACED TO WHO CLOSED THE CUSTOMER');
  L('');
  var keys = [], k;
  for (k in back) keys.push(k);
  keys.sort(function (a, b) { return back[b].rev - back[a].rev; });

  for (var i = 0; i < keys.length; i++) {
    var e = back[keys[i]];
    L('    ' + P(e.name, 26) + P(M(e.rev), 12) + e.rows + ' rows');
    var fr = [], f;
    for (f in e.from) fr.push(f + ' ' + M(e.from[f]));
    L('        logged instead to : ' + fr.join(',  '));
    for (var j = 0; j < e.who.length; j++) L('          ' + e.who[j]);
  }
  if (!keys.length) {
    L('    Nothing. Not one dropped row belongs to a customer a roster agent');
    L('    ever closed, so the instalment theory is WRONG and the money is');
    L('    not in this import at all.');
  }

  L('');
  L('    ' + P('WOULD RETURN TO ROSTER AGENTS', 32) + P(M(totRev), 12) + totRows + ' rows');
  L('    ' + P('genuinely not ours', 32) + P(M(lost), 12) + lostRows + ' rows');
  L('');
  L('    The gap to close is 9.91 L.');
  L('');

  L('  THE REST, BY THE NAME THEY ARE LOGGED UNDER');
  var ls = [], n3;
  for (n3 in lostWho) ls.push(n3);
  ls.sort(function (a, b) { return lostWho[b] - lostWho[a]; });
  for (var q = 0; q < ls.length && q < 30; q++) {
    L('    ' + P(ls[q], 26) + M(lostWho[ls[q]]));
  }
  L('');
  L('  Nothing was written. This only reports.');
}


/**
 * Find a tab that actually holds raw payments, by its COLUMNS.
 *
 * Not by name: src_Payments is the expected one, but these tabs carry
 * preamble lines above the header ("SOURCE - ...", "Read-only. Do not type
 * here.") so the header is rarely row 1, and a tab can be renamed. This
 * scans the first 25 rows of each tab for a row that names a date, a lead
 * owner, an amount and a customer, and prefers the tab with the most rows.
 */
/** Exact header match only - no substring fallback. See the note above. */
function wr_orphExact_(H, names) {
  for (var i = 0; i < names.length; i++) {
    if (H[names[i]] !== undefined) return H[names[i]];
  }
  return -1;
}


function wr_orphFindTab_(ss) {
  var tabs = ss.getSheets(), best = null;

  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3 || lastCol < 4) continue;

    var look = sh.getRange(1, 1, Math.min(25, lastRow), lastCol).getValues();
    for (var hr = 0; hr < look.length; hr++) {
      var H = wr_headers_(look[hr]);
      var c = {
        date:  wr_col_(H, ['date', 'payment date', 'paid on']),
        agent: wr_col_(H, ['lead owner', 'agent', 'owner']),
        amt:   wr_col_(H, ['amount paid', 'amount', 'amount inr']),
        mail:  wr_col_(H, ['payment email id', 'payment email', 'email id', 'email']),
        /* EXACT only. wr_col_ falls back to a substring match, and 'name'
           is a substring of half the headers in a sales sheet - 'Agent
           Name', 'Batch Name', 'First Name'. Keying customers off the
           wrong column would silently merge unrelated people and hand the
           money to whoever happened to sort first. */
        cust:  wr_orphExact_(H, ['name', 'customer name', 'customer',
                                 'learner name', 'student name']),
        type:  wr_col_(H, ['payment type']),
        stat:  wr_col_(H, ['status'])
      };
      if (c.date < 0 || c.agent < 0 || c.amt < 0) continue;
      if (c.mail < 0 && c.cust < 0) continue;

      var n = lastRow - (hr + 1);
      if (n < 1) continue;
      if (best && best.rows.length >= n) continue;

      best = {
        name: sh.getName(), headerRow: hr, head: look[hr], c: c,
        rows: sh.getRange(hr + 2, 1, n, lastCol).getValues()
      };
      break;        // one header row per tab is enough
    }
  }
  return best;
}
