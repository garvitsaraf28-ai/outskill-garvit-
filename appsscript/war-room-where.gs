/**
 * warRoomWhereIsTheMoney - READ ONLY. Writes nothing, anywhere.
 *
 * Says where this month's revenue goes between mdl_Payments and the two
 * screens that report it, and whether every CBC agent reached the model.
 *
 * Deliberately terse. The first version of this ran to 440 lines and the
 * paste into the Apps Script editor silently stopped at line 150, which
 * only showed up as "Unexpected end of input". Short enough to paste in
 * one go beats well documented, so the reasoning lives in the repo and
 * this file carries only what it needs to run.
 *
 * Borrows war-room.gs's helpers through the shared global scope, so it
 * touches nothing in that file and cannot break the feed. Reads
 * mdl_Payments, mdl_Roster, src_Roster_* and the report tab in THIS
 * workbook only - never CBC, never the Payment Tracker.
 */
function warRoomWhereIsTheMoney() {
  var ss = SpreadsheetApp.getActive(), now = new Date();
  var monthKey  = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var monthName = Utilities.formatDate(now, WR_TZ, 'MMMM yyyy');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) { L('mdl_Payments is missing or empty.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0], H = wr_headers_(head);

  /* the same lookups wr_payments_ uses */
  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit  = wr_col_(H, ['is unit', 'unit', 'units']);
  var cRost  = wr_col_(H, ['on roster', 'onroster', 'roster']);
  var cRef   = wr_col_(H, ['is refund', 'refund']);
  var cStat  = wr_col_(H, ['status']);
  var cBatch = wr_col_(H, ['batch']);

  L('=== WHERE IS THE MONEY ===   ' + monthName + '   ' +
    Utilities.formatDate(now, WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing was written.');
  L('');
  L('  COLUMNS BEING READ  (a NOT FOUND here is the bug)');
  var cols = [['date', cDate], ['agent', cAgent], ['amount', cAmt], ['is unit', cUnit],
              ['is refund', cRef], ['status', cStat], ['on roster', cRost], ['batch', cBatch]];
  for (var ci = 0; ci < cols.length; ci++) {
    L('    ' + P(cols[ci][0], 11) +
      (cols[ci][1] < 0 ? 'NOT FOUND' : '"' + head[cols[ci][1]] + '"'));
  }
  L('');
  if (cDate < 0 || cAgent < 0 || cAmt < 0) {
    L('  *** STOP. date / agent / amount missing - the feed returns nothing.');
    return;
  }

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var roster = wr_roster_(ss, monthKey);

  var badDate = 0, otherMonth = 0, noName = 0, summaryRows = 0;
  var gRev = 0, gRows = 0, gUnits = 0, refRev = 0, refRows = 0;
  var canRev = 0, canRows = 0, bothRows = 0;
  var onRev = 0, onRows = 0, onUnits = 0, offRev = 0, offRows = 0, offUnits = 0;
  var off = {}, statusSeen = {}, earners = {}, latest = null;

  for (var r = 0; r < grid.length; r++) {
    var row = grid[r], d = row[cDate];
    /* a date stored as TEXT is skipped by every reader in the project */
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      if (wr_str_(row[cAgent]) || wr_num_(row[cAmt])) badDate++;
      continue;
    }
    if (!latest || d.getTime() > latest.getTime()) latest = d;
    if (wr_monthKey_(d) !== monthKey) { otherMonth++; continue; }

    var name = wr_str_(row[cAgent]);
    if (!name) { noName++; continue; }
    if (wr_isSummary_(name)) { summaryRows++; continue; }

    var amt = wr_num_(row[cAmt]);
    var isUnit = (cUnit >= 0 && wr_truthy_(row[cUnit])) ? 1 : 0;
    if (isUnit && cBatch >= 0 && wr_unitBarred_(row[cBatch])) isUnit = 0;
    gRev += amt; gRows++; gUnits += isUnit;

    var isRefund = (cRef >= 0 && wr_truthy_(row[cRef]));
    var statTxt = (cStat >= 0) ? String(row[cStat] || '').trim() : '';
    var isCancel = (statTxt.toLowerCase().indexOf('cancel') > -1);

    var lab = statTxt || '(blank)';
    if (!statusSeen[lab]) statusSeen[lab] = { rev: 0, rows: 0 };
    statusSeen[lab].rev += amt; statusSeen[lab].rows++;

    if (isRefund && isCancel) bothRows++;
    if (isRefund) { refRev += amt; refRows++; }
    else if (isCancel) { canRev += amt; canRows++; }
    if (isRefund || isCancel) continue;

    var key = wr_key_(name);
    if (roster.byAgent[key]) {
      onRev += amt; onRows++; onUnits += isUnit;
      earners[key] = (earners[key] || 0) + amt;
    } else {
      offRev += amt; offRows++; offUnits += isUnit;
      if (!off[name]) off[name] = { rev: 0, units: 0, flagged: 0 };
      off[name].rev += amt; off[name].units += isUnit;
      if (cRost >= 0 && wr_truthy_(row[cRost])) off[name].flagged++;
    }
  }

  function step(label, amt, tail) { L('    ' + P(label, 38) + P(amt, 12) + (tail || '')); }

  L('  THE CHAIN  -  each line is what the step below removes');
  L('');
  step('every rupee dated ' + monthName, M(gRev), gRows + ' rows, ' + gUnits + ' units');
  step('  minus refunds', '-' + M(refRev), refRows + ' rows');
  step('  minus cancelled', '-' + M(canRev), canRows + ' rows' +
       (bothRows ? '   (' + bothRows + ' also refunds, counted once)' : ''));
  step('  minus names not on this roster', '-' + M(offRev),
       offRows + ' rows, ' + offUnits + ' units');
  step('= WHAT THE BOARD SHOWS', M(onRev), onRows + ' rows, ' + onUnits + ' units');
  L('');

  /* The report and the board read the same model, so both being short
     rules out the board AND the pinned web app deployment. */
  var repSh = ss.getSheetByName(WR_REPORT_TAB), repRev = '', repUnits = '', repDated = '';
  if (repSh && repSh.getLastRow() > 1) {
    var rg = repSh.getRange(1, 1, Math.min(repSh.getLastRow(), 200),
                            Math.min(repSh.getLastColumn(), 30)).getDisplayValues();
    repRev = wr_findRight_(rg, 'Total revenue');
    repUnits = wr_findRight_(rg, 'Units');
    repDated = wr_findRight_(rg, 'Report Dated');
  }
  L('  THE SAME MONTH, FROM EVERY PLACE THAT REPORTS IT');
  L('    ' + P('mdl_Payments, board rules applied', 38) + P(M(onRev), 12) + onUnits + ' units');
  if (repSh) {
    var dif = Math.abs(wr_reportNum_(repRev) - onRev);
    var same = dif <= Math.max(1000, Math.abs(onRev) * 0.001);
    L('    ' + P('Management Report tab says', 38) + P(repRev || '(not found)', 12) +
      (repUnits ? repUnits + ' units' : '') +
      (repRev ? (same ? '   SAME' : '   DIFFERS by ' + M(dif)) : ''));
    L('    ' + P('  report was built', 38) + (repDated || '(no Report Dated cell)'));
  } else {
    L('    ' + P('Management Report tab', 38) + 'NOT FOUND ("' + WR_REPORT_TAB + '")');
  }
  L('');
  L('    - both agree but under CBC -> fault is in mdl_Payments or mdl_Roster');
  L('    - they disagree            -> one ran on older data, rebuild the report');
  L('    - both agree WITH CBC but the TV does not -> redeploy the web app');
  L('');

  var withMoney = 0, k, rosterN = 0;
  for (k in earners) if (earners[k] > 0) withMoney++;
  for (k in roster.byAgent) rosterN++;
  L('  THE ROSTER THIS MONTH');
  L('    agents loaded from mdl_Roster : ' + rosterN);
  L('    of those, with a sale         : ' + withMoney);
  L('    CBC is said to hold 86. Well under that means the roster is short,');
  L('    and the report and the board are short with it.');
  L('');

  wr_whRoster_(ss, monthKey, L, P);

  L('  PAID, BUT NOT ON THE ROSTER  (on no screen)');
  var names = [], n2;
  for (n2 in off) names.push(n2);
  names.sort(function (a, b) { return off[b].rev - off[a].rev; });
  for (var i = 0; i < names.length && i < 60; i++) {
    var o = off[names[i]];
    L('    ' + P(names[i], 28) + P(M(o.rev), 12) + P(o.units + 'u', 5) +
      (o.flagged ? '  <-- On Roster = YES, but no roster row this month' : ''));
  }
  if (!names.length) L('    nobody - so the gap is refunds, cancelled, or the roster.');
  L('');

  L('  EVERY Status VALUE  (anything containing "cancel" is removed)');
  var sts = [], s2;
  for (s2 in statusSeen) sts.push(s2);
  sts.sort(function (a, b) { return statusSeen[b].rev - statusSeen[a].rev; });
  for (var j = 0; j < sts.length; j++) {
    L('    ' + P(sts[j], 28) + P(M(statusSeen[sts[j]].rev), 12) +
      P(statusSeen[sts[j]].rows + ' rows', 10) +
      (sts[j].toLowerCase().indexOf('cancel') > -1 ? '  REMOVED' : ''));
  }
  L('');

  L('  ROWS NO TOTAL INCLUDES');
  L('    date stored as text : ' + badDate + (badDate ? '   <-- real money, counted nowhere' : ''));
  L('    blank agent name    : ' + noName);
  L('    looked like a total : ' + summaryRows);
  L('    another month       : ' + otherMonth);
  L('');
  L('  newest payment anywhere : ' +
    (latest ? Utilities.formatDate(latest, WR_TZ, 'dd MMM yyyy') : 'none'));
  L('  today                   : ' + Utilities.formatDate(now, WR_TZ, 'dd MMM yyyy'));
  L('  rows in mdl_Payments    : ' + (lastRow - 1));
  L('');
  L('  Nothing was written. This only reports.');
}


/**
 * Did every CBC agent reach mdl_Roster? An IMPORTRANGE ending on a fixed
 * row - A2:H60 rather than A2:H - stops the moment CBC grows past it, with
 * no error. New joiners are added at the BOTTOM, exactly where it cuts.
 */
function wr_whRoster_(ss, monthKey, L, P) {
  L('  DID EVERYONE MAKE IT ACROSS FROM CBC?');
  var mdl = ss.getSheetByName(WR_ROSTER_TAB);
  if (!mdl || mdl.getLastRow() < 2) { L('    mdl_Roster is empty.'); L(''); return; }

  var mg = mdl.getRange(1, 1, mdl.getLastRow(), mdl.getLastColumn()).getValues();
  var mh = wr_headers_(mg[0]);
  var mAgent = wr_col_(mh, ['agent', 'agent name', 'name', 'lead owner', 'owner']);
  var mMgr   = wr_col_(mh, ['manager', 'reporting manager', 'tl']);
  var mMonth = wr_monthCol_(mg);
  if (mAgent < 0) { L('    mdl_Roster has no Agent column.'); L(''); return; }

  var inMdl = {}, perMonth = {};
  for (var r = 1; r < mg.length; r++) {
    var nm = wr_str_(mg[r][mAgent]);
    if (!nm || wr_isSummaryRow_(nm, mMgr >= 0 ? wr_str_(mg[r][mMgr]) : '', '')) continue;
    var mo = (mMonth >= 0) ? wr_monthKey_(mg[r][mMonth]) : monthKey;
    if (mo) perMonth[mo] = (perMonth[mo] || 0) + 1;
    if (mo && mo !== monthKey) continue;
    inMdl[wr_key_(nm)] = nm;
  }
  var months = [], mk;
  for (mk in perMonth) months.push(mk);
  months.sort();
  L('    mdl_Roster by month : ' +
    months.map(function (x) { return x + '(' + perMonth[x] + ')'; }).join('  '));
  L('');

  /* ONLY THIS MONTH'S TAB GETS COMPARED.

     The first version compared every src_Roster_* tab against the CURRENT
     month's roster and called everything it did not find "missing". On a
     real workbook that printed about a hundred names from April through
     September - every person who has ever left - as though each were a
     fault. They are not: an agent in src_Roster_Jul and not in October is
     someone who left in August, which is the system working.

     A diagnostic that cries wolf a hundred times is worse than no
     diagnostic, because the one real line gets lost in it. So the other
     months get a single line each, and only the tab for THIS month is
     compared name by name. */
  var tabs = ss.getSheets(), found = 0, curTab = 0;
  for (var t = 0; t < tabs.length; t++) {
    var s = tabs[t];
    if (!/^src_Roster/i.test(s.getName())) continue;
    found++;

    var suffix = s.getName().replace(/^src_Roster[_\s-]*/i, '').trim();
    var tabMonth = wr_monthKey_(suffix + ' ' + monthKey.substring(0, 4));
    var rows = s.getLastRow(), cols = s.getLastColumn();

    if (tabMonth && tabMonth !== monthKey) {
      L('    ' + P(s.getName(), 22) + rows + ' rows   (' + tabMonth +
        ' - not this month, not compared)');
      continue;
    }
    curTab++;
    L('    --- ' + s.getName() + '   ' + rows + ' rows   THIS MONTH ---');

    var f = '';
    try { f = s.getRange(1, 1).getFormula() || s.getRange(2, 1).getFormula() || ''; }
    catch (e) { f = ''; }
    if (f) {
      L('        built by : ' + f);
      if (/![A-Z]+\d+:[A-Z]+\d+/.test(f)) {
        L('        *** THAT RANGE ENDS ON A FIXED ROW. Once CBC grows past it the');
        L('            extra agents stop arriving, silently. Use A2:H, not A2:H60.');
      }
    }
    if (rows < 2) { L('        empty.'); continue; }

    var g = s.getRange(1, 1, rows, cols).getValues(), hRow = -1;
    for (var rr = 0; rr < g.length && hRow < 0; rr++) {
      for (var cc = 0; cc < g[rr].length; cc++) {
        if (String(g[rr][cc]).trim().toLowerCase() === 'agent') { hRow = rr; break; }
      }
    }
    if (hRow < 0) { L('        no "Agent" header found.'); continue; }

    var sh2 = wr_headers_(g[hRow]);
    var sAgent = wr_col_(sh2, ['agent', 'agent name', 'name']);
    var sMgr   = wr_col_(sh2, ['manager', 'reporting manager', 'tl']);
    if (sAgent < 0) { L('        no Agent column.'); continue; }

    var cnt = 0, missing = [];
    for (var r2 = hRow + 1; r2 < g.length; r2++) {
      var n3 = wr_str_(g[r2][sAgent]);
      if (!n3 || wr_isSummaryRow_(n3, sMgr >= 0 ? wr_str_(g[r2][sMgr]) : '', '')) continue;
      cnt++;
      if (!inMdl[wr_key_(n3)]) missing.push(n3);
    }
    L('        agents here : ' + cnt);
    if (missing.length) {
      L('        NOT IN mdl_Roster FOR ' + monthKey + ' : ' + missing.length);
      for (var i2 = 0; i2 < missing.length && i2 < 40; i2++) L('          ' + missing[i2]);
      if (missing.length > 40) L('          ... and ' + (missing.length - 40) + ' more');
      L('        Each one is invisible to the report AND the board.');
    } else {
      L('        all present for ' + monthKey + '.');
    }
  }
  if (!found) {
    L('    No src_Roster_* tab - mdl_Roster is not fed from CBC at all.');
  } else if (!curTab) {
    L('');
    L('    *** NO src_Roster TAB FOR ' + monthKey + '. The roster for this month is');
    L('        not being imported at all, so it can only be as stale as whatever');
    L('        was last written into mdl_Roster by hand.');
  }
  L('');
}

/* ===================================================================
   END OF FILE.

   If you cannot see THIS line at the bottom of the editor, the paste
   was cut short and Apps Script will say "Unexpected end of input".
   Select all in the editor, delete, and paste again.
   =================================================================== */
