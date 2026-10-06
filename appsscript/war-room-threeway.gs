/**
 * warRoomThreeWay - READ ONLY. Writes nothing, anywhere.
 *
 * THE QUESTION IT ANSWERS
 *
 *   Two agents show money in CBC that no rebuild will produce:
 *   Dinesh Kumar Tarenia 80,000 and Satyam Aditya Samant 35,000, both
 *   Abhishek Anand's. updateAndCheck has been run and they are still not
 *   there, so it is not staleness any more.
 *
 *   There are only three places the truth can differ, and until now they
 *   have been compared two at a time, which is why this has taken all day:
 *
 *     CBC             what a manager says the agent realised
 *     src_Payments    what the Payment Tracker actually recorded
 *     mdl_Payments    what every screen in this workbook reads
 *
 *   src_Roster_<month> is an import of CBC and carries its Realised
 *   Revenue column, so all three can be read from this one workbook with
 *   nothing opened and nothing typed.
 *
 * HOW TO READ THE RESULT
 *
 *   CBC has it, the tracker does NOT   -> there is no payment row. CBC was
 *                                         filled in by hand, or the payment
 *                                         has not been logged yet. No
 *                                         rebuild can ever fix this, and
 *                                         the model is not wrong.
 *   tracker has it, the model does NOT -> a real build fault. Run
 *                                         warRoomLostRows to see the rows.
 *   tracker and model agree, CBC differs -> CBC is counting something else,
 *                                         such as AIGF Upgrade/Catalyst,
 *                                         which is not agent revenue.
 *
 * Paste as its own file and run warRoomThreeWay.
 */
function warRoomThreeWay() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  L('=== CBC vs TRACKER vs MODEL ===   ' + monthKey + '   ' +
    Utilities.formatDate(now, WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing was written. CBC is read through its own import');
  L('  tab in this workbook - the CBC file itself is never opened.');
  L('');

  var cbc = w3_roster_(ss, monthKey);
  if (!cbc) {
    L('  *** No src_Roster tab for this month with a Realised Revenue column.');
    L('      Without it CBC cannot be compared from inside this workbook.');
    return;
  }
  L('  CBC read from : ' + cbc.name + '   (' + cbc.n + ' agents)');

  var src = w3_pay_(ss, true), mdl = w3_pay_(ss, false);
  if (!src || !mdl) { L('  *** Could not find both the import and the model.'); return; }
  L('  tracker       : ' + src.name);
  L('  model         : ' + mdl.name);
  L('');

  var A = w3_tally_(src, monthKey), B = w3_tally_(mdl, monthKey);

  var rows = [], k;
  for (k in cbc.by) {
    var c = cbc.by[k];
    var a = (A[k] || { rev: 0 }).rev, b = (B[k] || { rev: 0 }).rev;
    if (Math.abs(c.rev - a) < 1 && Math.abs(a - b) < 1) continue;   // all agree
    rows.push({ name: c.name, cbc: c.rev, src: a, mdl: b });
  }
  rows.sort(function (x, y) {
    return Math.abs(y.cbc - y.mdl) - Math.abs(x.cbc - x.mdl);
  });

  L('  ONLY THE AGENTS WHERE THE THREE DISAGREE');
  L('  ' + P('AGENT', 26) + P('CBC', 11) + P('TRACKER', 11) + P('MODEL', 11) + 'VERDICT');
  L('');

  var noRow = 0, noRowRev = 0, buildFault = 0, buildRev = 0;
  for (var i = 0; i < rows.length; i++) {
    var e = rows[i], verdict;
    if (Math.abs(e.src - e.mdl) >= 1) {
      verdict = 'BUILD FAULT - tracker has it, model does not';
      buildFault++; buildRev += (e.src - e.mdl);
    } else if (e.cbc > e.src) {
      verdict = 'NO PAYMENT ROW - CBC only';
      noRow++; noRowRev += (e.cbc - e.src);
    } else {
      verdict = 'tracker ahead of CBC';
    }
    L('  ' + P(e.name, 26) + P(M(e.cbc), 11) + P(M(e.src), 11) + P(M(e.mdl), 11) + verdict);
  }
  if (!rows.length) L('  (none - CBC, the tracker and the model agree on every agent)');
  L('');

  L('  TOTALS ACROSS ROSTER AGENTS');
  var tc = 0, ta = 0, tb = 0;
  for (k in cbc.by) {
    tc += cbc.by[k].rev;
    ta += (A[k] || { rev: 0 }).rev;
    tb += (B[k] || { rev: 0 }).rev;
  }
  L('    ' + P('CBC says', 22) + M(tc));
  L('    ' + P('Payment Tracker has', 22) + M(ta));
  L('    ' + P('the model has', 22) + M(tb) + '   <- what every screen shows');
  L('');

  if (buildFault) {
    L('  *** ' + buildFault + ' agent(s), ' + M(buildRev) + ', ARE IN THE TRACKER AND');
    L('      NOT IN THE MODEL. That is a real build fault - run warRoomLostRows.');
  }
  if (noRow) {
    L('  ' + noRow + ' agent(s), ' + M(noRevSafe_(noRowRev)) + ', have money in CBC with no');
    L('  payment row behind it. No rebuild can produce these. Either the');
    L('  payment is not logged in the Payment Tracker yet, or CBC was filled');
    L('  in by hand. The model is not wrong about them.');
  }
  if (!buildFault && !noRow) {
    L('  Nothing is being lost. Any difference left is CBC counting something');
    L('  that is not agent revenue - AIGF Upgrade/Catalyst is the usual one.');
  }
  L('');
  L('  Nothing was written. This only reports.');
}


function noRevSafe_(v) { return v > 0 ? v : 0; }


/** CBC's own numbers, through this month's src_Roster import tab. */
function w3_roster_(ss, monthKey) {
  var tabs = ss.getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], nm = sh.getName();
    if (!/^src_Roster/i.test(nm)) continue;

    var suffix = nm.replace(/^src_Roster[_\s-]*/i, '').trim();
    var tabMonth = wr_monthKey_(suffix + ' ' + monthKey.substring(0, 4));
    if (tabMonth && tabMonth !== monthKey) continue;

    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3) continue;
    var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();

    for (var hr = 0; hr < grid.length && hr < 25; hr++) {
      var H = wr_headers_(grid[hr]);
      var cAgent = wr_col_(H, ['agent', 'agent name']);
      var cRev   = wr_col_(H, ['realised revenue', 'realized revenue', 'revenue']);
      var cMgr   = wr_col_(H, ['manager', 'reporting manager', 'tl']);
      if (cAgent < 0 || cRev < 0) continue;

      var by = {}, n = 0;
      for (var r = hr + 1; r < grid.length; r++) {
        var a = wr_str_(grid[r][cAgent]);
        if (!a) continue;
        if (wr_isSummaryRow_(a, cMgr >= 0 ? wr_str_(grid[r][cMgr]) : '', '')) continue;
        var key = wr_key_(a);
        if (by[key]) continue;
        by[key] = { name: a, rev: wr_num_(grid[r][cRev]) };
        n++;
      }
      if (n) return { name: nm, by: by, n: n };
    }
  }
  return null;
}


/** The import tab (wantCustomer) or the model tab. Same rule as elsewhere. */
function w3_pay_(ss, wantCustomer) {
  var tabs = ss.getSheets(), best = null;
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    /* A header plus one row is enough. Demanding three would skip a tab
       that is merely small, and silently finding nothing is the failure
       mode this whole exercise has been about. */
    if (lastRow < 2 || lastCol < 3) continue;

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
      if (best && best.n >= n) continue;
      best = { name: sh.getName(), sheet: sh, headerRow: hr, c: c, n: n,
               rows: sh.getRange(hr + 2, 1, n, lastCol).getValues() };
      break;
    }
  }
  return best;
}


function w3_tally_(t, monthKey) {
  var out = {};
  for (var r = 0; r < t.rows.length; r++) {
    var row = t.rows[r], d = row[t.c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKey_(d) !== monthKey) continue;
    var nm = wr_str_(row[t.c.agent]);
    if (!nm || wr_isSummary_(nm)) continue;
    if (t.c.stat >= 0 &&
        String(row[t.c.stat] || '').toLowerCase().indexOf('cancel') > -1) continue;
    var k = wr_key_(nm);
    if (!out[k]) out[k] = { name: nm, rev: 0 };
    out[k].rev += wr_num_(row[t.c.amt]);
  }
  return out;
}
