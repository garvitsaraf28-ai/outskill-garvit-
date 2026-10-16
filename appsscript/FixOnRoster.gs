/**
 * fixOnRoster - the one line that was dropping the money.
 *
 * WHERE IT WAS
 *
 *   ManagementReport.gs, mr_payments_, first line of the row loop:
 *
 *       if (String(row[col['On Roster']]).trim().toUpperCase() !== 'YES') continue;
 *
 *   Revenue, units, the manager blocks and the office blocks are all built
 *   from mdl_Payments rows where column D says YES. Nothing else.
 *
 * WHY THAT BROKE
 *
 *   On Roster is STAMPED. Whatever writes mdl_Payments decides YES or NO
 *   at the moment it writes the row, by matching Lead Owner against
 *   mdl_Roster as it stood right then - and never looks again.
 *
 *   So a payment logged before that agent reached mdl_Roster is stamped
 *   NO. A payment written during the 7 October collapse, when the CBC
 *   roster import came back empty, is stamped NO - every row in that run,
 *   because for a few minutes nobody was on the roster. The roster is
 *   complete today. Those rows still say NO, and the report still skips
 *   them. Re-running updateAndCheck re-reads the same stale stamp, which
 *   is exactly why ten runs moved nothing.
 *
 *   It also explains why every check I ran said the sheet was fine.
 *   findTheMissing, warRoomThreeWay and rtu_payTally_ all tally
 *   mdl_Payments by agent and ignore column D, so they saw the money.
 *   Only the report filters on it. I was comparing two things that both
 *   bypassed the broken gate.
 *
 * WHAT THIS DOES
 *
 *   For this month and the one before, it re-matches every Lead Owner in
 *   mdl_Payments against the CURRENT mdl_Roster for that row's own month.
 *   Where the roster confirms the agent and the stamp says NO, it corrects
 *   the stamp to YES and restamps Manager, Office and Team from the roster
 *   row, so the manager and office blocks roll up too.
 *
 *   It prints the agents and the money before it writes anything.
 *
 * WHAT IT WILL NOT DO
 *
 *   It only ever corrects a stamp TOWARDS yes, and only when this month's
 *   roster names that agent. It never turns a YES into a NO, never edits a
 *   row that is already YES, never touches amounts or dates, and never
 *   opens CBC or the Payment Tracker. A row whose Lead Owner is genuinely
 *   not on the roster - another team - is counted and reported, and left
 *   alone.
 *
 *   It is limited to this month and last month because those are the two
 *   windows the report reads. Older months are reported, not rewritten:
 *   silently restating a closed month is not a bug fix.
 *
 *   Run it twice and the second run corrects nothing.
 *
 * AFTER IT
 *
 *   Run updateAndCheck.
 */

function fixOnRoster() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var now = new Date();
  var thisMonth = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var prevMonth = for_prevMonth_(thisMonth);

  L('=== FIX ON ROSTER ===   ' + thisMonth + '   ' +
    Utilities.formatDate(now, WR_TZ, 'dd MMM HH:mm'));
  L('');

  var sh = ss.getSheetByName('mdl_Payments');
  if (!sh || sh.getLastRow() < 2) { L('  *** mdl_Payments is empty.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var col = {};
  for (var c = 0; c < grid[0].length; c++) {
    var h = String(grid[0][c]).trim();
    if (h && col[h] === undefined) col[h] = c;
  }

  /* The report needs these exact spellings, so this does too. If one is
     renamed the report is already broken and should say so here first. */
  var iStamp = for_need_(col, 'On Roster', L); if (iStamp < 0) return;
  var iAgent = for_need_(col, 'Lead Owner', L); if (iAgent < 0) return;
  var iAmt   = for_need_(col, 'Amount Paid', L); if (iAmt < 0) return;
  var iDate  = col['Date']  === undefined ? -1 : col['Date'];
  var iMonth = col['Month'] === undefined ? -1 : col['Month'];
  var iMgr   = col['Manager'] === undefined ? -1 : col['Manager'];
  var iOff   = col['Office']  === undefined ? -1 : col['Office'];
  var iTeam  = col['Team']    === undefined ? -1 : col['Team'];
  if (iDate < 0 && iMonth < 0) {
    L('  *** mdl_Payments has neither a Date nor a Month column. Stopping.');
    return;
  }

  L('  mdl_Payments : ' + (lastRow - 1) + ' rows');
  L('  columns      : On Roster=' + for_a1_(iStamp) + '  Lead Owner=' + for_a1_(iAgent) +
    '  Amount Paid=' + for_a1_(iAmt) +
    (iMgr  >= 0 ? '  Manager=' + for_a1_(iMgr)  : '') +
    (iOff  >= 0 ? '  Office='  + for_a1_(iOff)  : '') +
    (iTeam >= 0 ? '  Team='    + for_a1_(iTeam) : ''));

  /* The roster as it stands NOW, per month. A May row is judged against
     May's roster, never October's - an agent who joined in June did not
     own May's revenue. */
  var ros = {};
  ros[thisMonth] = wr_roster_(ss, thisMonth);
  ros[prevMonth] = wr_roster_(ss, prevMonth);
  L('  mdl_Roster   : ' + ros[thisMonth].count + ' agents for ' + thisMonth +
    ', ' + ros[prevMonth].count + ' for ' + prevMonth);
  if (!ros[thisMonth].count) {
    L('  *** No roster rows for ' + thisMonth + '. Run refreshAndVerify first.');
    return;
  }
  L('');

  /* ---------- the pass ---------- */
  var fix = {}, offRoster = {}, older = { rows: 0, rev: 0 }, touched = 0;
  for (var r = 1; r < grid.length; r++) {
    var row = grid[r];
    var stamp = String(row[iStamp]).trim().toUpperCase();
    if (stamp === 'YES') continue;                 // never re-judged

    var name = wr_str_(row[iAgent]);
    if (!name || wr_isSummary_(name)) continue;

    var mk = iMonth >= 0 ? wr_monthKey_(row[iMonth]) : '';
    if (!mk && iDate >= 0) mk = wr_monthKey_(row[iDate]);
    if (!mk) continue;

    var amt = wr_num_(row[iAmt]);
    var key = wr_key_(name);

    if (mk !== thisMonth && mk !== prevMonth) {
      /* An older month. Counted so the scale is visible, never rewritten. */
      if (ros[thisMonth].byAgent[key]) { older.rows++; older.rev += amt; }
      continue;
    }

    var who = ros[mk].byAgent[key];
    if (!who) {
      /* Genuinely not on that month's roster. Another team, or a name the
         roster has never carried. Reported, left exactly as it is. */
      if (!offRoster[mk]) offRoster[mk] = { rows: 0, rev: 0, names: {} };
      offRoster[mk].rows++; offRoster[mk].rev += amt;
      offRoster[mk].names[name] = (offRoster[mk].names[name] || 0) + amt;
      continue;
    }

    if (!fix[mk]) fix[mk] = { rows: 0, rev: 0, byAgent: {} };
    fix[mk].rows++; fix[mk].rev += amt;
    if (!fix[mk].byAgent[key]) fix[mk].byAgent[key] = { name: who.name, rev: 0, rows: 0 };
    fix[mk].byAgent[key].rev += amt;
    fix[mk].byAgent[key].rows++;

    /* Corrected in the copy first. Nothing reaches the sheet until the
       whole pass has run and the totals have been printed. */
    row[iStamp] = 'YES';
    if (iMgr  >= 0 && who.manager) row[iMgr]  = who.manager;
    if (iOff  >= 0 && who.city)    row[iOff]  = who.city;
    if (iTeam >= 0 && who.team)    row[iTeam] = who.team;
    touched++;
  }

  /* ---------- what it found ---------- */
  var months = [thisMonth, prevMonth], m, i;
  var releasedNow = 0, releasedPrior = 0;
  for (i = 0; i < months.length; i++) {
    m = months[i];
    if (!fix[m]) {
      L('  ' + m + ' : nothing stamped NO that belongs to a roster agent.');
      continue;
    }
    /* Kept apart on purpose. Last month's rows land in the report's
       comparison column, not the headline, and a single combined number
       here would be a figure that does not match what the page then
       shows - which is the whole complaint. */
    if (m === thisMonth) releasedNow += fix[m].rev; else releasedPrior += fix[m].rev;
    L('  ' + m + ' : ' + fix[m].rows + ' row(s) stamped NO that belong to a roster agent');
    L('            ' + for_money_(fix[m].rev) + ' the report is dropping today');
    var list = [];
    for (var k in fix[m].byAgent) list.push(fix[m].byAgent[k]);
    list.sort(function (a, b) { return b.rev - a.rev; });
    for (var j = 0; j < list.length && j < 25; j++) {
      L('    ' + for_pad_(list[j].name, 28) + for_pad_(for_money_(list[j].rev), 12) +
        list[j].rows + ' row(s)');
    }
    if (list.length > 25) L('    ... and ' + (list.length - 25) + ' more');
    L('');
  }

  for (i = 0; i < months.length; i++) {
    m = months[i];
    if (!offRoster[m]) continue;
    L('  ' + m + ' : ' + offRoster[m].rows + ' row(s), ' + for_money_(offRoster[m].rev) +
      ', whose Lead Owner is genuinely not on that month\'s roster.');
    L('            Left alone - that is other teams, and it belongs out.');
  }
  if (older.rows) {
    L('  Older months : ' + older.rows + ' row(s), ' + for_money_(older.rev) +
      ', stamped NO for people on the roster now.');
    L('            Not rewritten. Restating a closed month is not a bug fix.');
  }
  L('');

  if (!touched) {
    L('  Every row for a roster agent is already stamped YES. Nothing to correct.');
    L('  Then the report and mdl_Payments agree, and the gap is elsewhere.');
    return;
  }

  /* ---------- write ---------- */
  var lo = iStamp, hi = iStamp;
  if (iMgr  >= 0) { lo = Math.min(lo, iMgr);  hi = Math.max(hi, iMgr); }
  if (iOff  >= 0) { lo = Math.min(lo, iOff);  hi = Math.max(hi, iOff); }
  if (iTeam >= 0) { lo = Math.min(lo, iTeam); hi = Math.max(hi, iTeam); }

  var width = hi - lo + 1, block = [];
  for (r = 1; r < grid.length; r++) block.push(grid[r].slice(lo, hi + 1));
  sh.getRange(2, lo + 1, block.length, width).setValues(block);

  L('  CORRECTED ' + touched + ' row(s): ' + for_a1_(lo) + ' to ' + for_a1_(hi) + '.');
  L('  Rows already YES were written back byte for byte, unchanged. No amount,');
  L('  date or name was altered. CBC and the Payment Tracker were not opened.');
  L('');
  L('  NOW RUN updateAndCheck.');
  L('    Total revenue should rise by about ' + for_money_(releasedNow) + '.');
  if (releasedPrior) {
    L('    The ' + prevMonth + ' comparison column should rise by about ' +
      for_money_(releasedPrior) + '. That one is last month, not the headline.');
  }
}


/* =====================================================================
   Small helpers. Prefixed so nothing here can shadow the project.
   ===================================================================== */

function for_need_(col, name, L) {
  if (col[name] === undefined) {
    L('  *** mdl_Payments has no "' + name + '" column, which the report needs');
    L('      by that exact spelling. Stopping rather than guessing.');
    return -1;
  }
  return col[name];
}

function for_prevMonth_(monthKey) {
  var y = parseInt(monthKey.substring(0, 4), 10);
  var m = parseInt(monthKey.substring(5, 7), 10) - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + (m < 10 ? '0' + m : '' + m);
}

function for_a1_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = (n - k) / 26 | 0; }
  return s;
}

function for_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

function for_money_(n) {
  if (typeof wr_money_ === 'function') return wr_money_(n);
  return String(Math.round(n || 0));
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
