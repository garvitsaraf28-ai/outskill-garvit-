/**
 * warRoomOrphanPayments - READ ONLY. Writes nothing, anywhere.
 *
 * THE THEORY THIS TESTS
 *
 *   A sale paid in instalments is several rows in the Payment Tracker, and
 *   the later rows do not always carry the Lead Owner who closed it. The
 *   same customer can appear as
 *
 *     01-Oct, Madhav,     George Sarcov, 1st Part Payment, 1/3
 *     01-Oct, Mastermind, George Sarcov, 2nd Part Payment, 2/3
 *
 *   The board credits the first row and drops the second, because
 *   "Mastermind" is not on the roster. CBC credits both to the closer. That
 *   single difference would explain the whole gap - 9.91 L across five
 *   agents, every one of them hit hardest where deals are high-ticket and
 *   paid in parts.
 *
 *   It is a theory until it is counted. This counts it.
 *
 * HOW
 *
 *   Pass 1 reads every row ever and remembers, per CUSTOMER, which roster
 *   agent took their earliest payment. The customer is keyed on payment
 *   email where there is one, on name where there is not.
 *
 *   Pass 2 takes this month's dropped rows and asks whether that customer
 *   was ever owned by a roster agent. If so the row is an orphaned
 *   instalment, and it names the agent it should have gone to.
 *
 *   If the total it reports is close to 9.91 L, that is the bug, and the
 *   fix is to credit a payment to whoever owns the CUSTOMER rather than
 *   to whatever is typed on that one row.
 *
 *   If it reports close to nothing, the theory is wrong, the money is not
 *   in mdl_Payments at all, and the next place to look is upstream.
 *
 * Paste as its own file and run warRoomOrphanPayments.
 */
function warRoomOrphanPayments() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) { L('mdl_Payments is empty.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0], H = wr_headers_(head);

  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr']);
  var cMail  = wr_col_(H, ['payment email id', 'payment email', 'email', 'email id']);
  var cCust  = wr_col_(H, ['name', 'customer', 'learner', 'student']);
  var cType  = wr_col_(H, ['payment type']);

  L('=== ORPHANED INSTALMENTS ===   ' + monthKey);
  L('  customer keyed on : ' +
    (cMail >= 0 ? '"' + head[cMail] + '"' : (cCust >= 0 ? '"' + head[cCust] + '"' : 'NOTHING')));
  L('  payment type col  : ' + (cType >= 0 ? '"' + head[cType] + '"' : 'not present'));
  L('');
  if (cDate < 0 || cAgent < 0 || cAmt < 0 || (cMail < 0 && cCust < 0)) {
    L('  *** Cannot run: need date, lead owner, amount, and an email or name');
    L('      column to identify the customer. One of those is missing.');
    return;
  }

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var roster = wr_roster_(ss, monthKey);

  function custKey(row) {
    var e = cMail >= 0 ? wr_str_(row[cMail]).toLowerCase() : '';
    if (e) return 'e:' + e;
    var n = cCust >= 0 ? wr_key_(wr_str_(row[cCust])) : '';
    return n ? 'n:' + n : '';
  }

  /* ---- pass 1: who closed each customer ---- */
  var ownerOf = {};
  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var nm = wr_str_(grid[r][cAgent]);
    if (!nm || wr_isSummary_(nm)) continue;
    var key = wr_key_(nm);
    if (!roster.byAgent[key]) continue;        // only a roster agent can own one
    var ck = custKey(grid[r]);
    if (!ck) continue;
    var t = d.getTime();
    if (!ownerOf[ck] || t < ownerOf[ck].at) ownerOf[ck] = { name: nm, key: key, at: t };
  }

  /* ---- pass 2: this month's dropped rows, matched back ---- */
  var back = {}, totRev = 0, totRows = 0, lost = 0, lostRows = 0, lostWho = {};
  for (var r2 = 0; r2 < grid.length; r2++) {
    var row = grid[r2], d2 = row[cDate];
    if (!(d2 instanceof Date) || isNaN(d2.getTime())) continue;
    if (wr_monthKey_(d2) !== monthKey) continue;
    var nm2 = wr_str_(row[cAgent]);
    if (!nm2 || wr_isSummary_(nm2)) continue;
    if (roster.byAgent[wr_key_(nm2)]) continue;        // already counted

    var amt = wr_num_(row[cAmt]);
    var ck2 = custKey(row);
    var own = ck2 ? ownerOf[ck2] : null;

    if (own) {
      if (!back[own.key]) back[own.key] = { name: own.name, rev: 0, rows: 0, from: {}, who: [] };
      var b = back[own.key];
      b.rev += amt; b.rows++;
      b.from[nm2] = (b.from[nm2] || 0) + amt;
      if (b.who.length < 12) {
        b.who.push(wr_str_(cCust >= 0 ? row[cCust] : '') + '  ' + M(amt) +
                   (cType >= 0 ? '  ' + wr_str_(row[cType]) : '') + '  logged to ' + nm2);
      }
      totRev += amt; totRows++;
    } else {
      lost += amt; lostRows++;
      lostWho[nm2] = (lostWho[nm2] || 0) + amt;
    }
  }

  L('  THIS MONTH\'S DROPPED MONEY, TRACED BACK TO WHO CLOSED THE CUSTOMER');
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
    L('    ever closed, so the instalment theory is WRONG and the missing money');
    L('    is not in mdl_Payments at all.');
  }

  L('');
  L('    ' + P('WOULD RETURN TO ROSTER AGENTS', 32) + P(M(totRev), 12) + totRows + ' rows');
  L('    ' + P('genuinely not ours', 32) + P(M(lost), 12) + lostRows + ' rows');
  L('');
  L('    The gap to close is 9.91 L. If the first figure is near it, that is');
  L('    the bug, and the fix is to credit a payment to whoever owns the');
  L('    CUSTOMER rather than to whatever name is typed on that one row.');
  L('');

  L('  THE REST, BY THE NAME THEY ARE LOGGED UNDER');
  var ls = [], n3;
  for (n3 in lostWho) ls.push(n3);
  ls.sort(function (a, b) { return lostWho[b] - lostWho[a]; });
  for (var q = 0; q < ls.length; q++) {
    L('    ' + P(ls[q], 26) + M(lostWho[ls[q]]));
  }
  L('');
  L('  Nothing was written. This only reports.');
}
