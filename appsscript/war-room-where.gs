/**
 * warRoomWhereIsTheMoney - READ ONLY. Writes nothing, to any file, anywhere.
 *
 * WHY THIS EXISTS
 *
 *   CBC says 86 agents and about 25 L this month. The board says 13.50 L.
 *   Both can be right at once, because they are not measuring the same
 *   thing, and until now nothing printed the difference as a single chain.
 *
 *   warRoomGap() came closest, but it counts every rupee with a date in
 *   this month INCLUDING refunds and cancellations, while the feed that
 *   paints the board removes both. So the two disagree by exactly the
 *   amount that matters most, and comparing them led nowhere.
 *
 *   This walks the whole chain, in the order wr_payments_ actually
 *   applies it, and prints what each step removes:
 *
 *     every rupee dated this month
 *       minus rows that are a refund or a cancellation
 *       minus rows paid to a name that is not on this month's roster
 *       = the number on the TV
 *
 *   If the last line does not match the TV, the fault is below this
 *   sheet - in how mdl_Payments is built - and not in the board.
 *
 * WHERE TO PUT IT
 *
 *   Apps Script > Files > + > Script, name it war-room-where, paste this
 *   in, pick warRoomWhereIsTheMoney from the function list, Run. Then
 *   View > Execution log and send the log over.
 *
 *   It is a separate file on purpose. It touches nothing in war-room.gs,
 *   so it cannot break the feed, and deleting it later costs nothing. It
 *   borrows that file's helpers, which works because every file in one
 *   Apps Script project shares the same global scope.
 *
 * SAFETY
 *
 *   Reads mdl_Payments and mdl_Roster in THIS workbook and nothing else.
 *   It never opens CBC or the Payment Tracker, and it has no write call
 *   of any kind in it.
 */
function warRoomWhereIsTheMoney() {
  var ss = SpreadsheetApp.getActive();
  var now = new Date();
  var monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');
  var monthName = Utilities.formatDate(now, WR_TZ, 'MMMM yyyy');

  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) {
    Logger.log('mdl_Payments is missing or empty. Nothing to reconcile.');
    return;
  }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);

  /* The SAME column lookups wr_payments_ uses. If one of these picks the
     wrong column the board is wrong in a way no amount of re-running can
     fix, so they are printed below rather than trusted. */
  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit  = wr_col_(H, ['is unit', 'unit', 'units']);
  var cRost  = wr_col_(H, ['on roster', 'onroster', 'roster']);
  var cRef   = wr_col_(H, ['is refund', 'refund']);
  var cStat  = wr_col_(H, ['status']);
  var cBatch = wr_col_(H, ['batch']);

  Logger.log('=== WHERE IS THE MONEY ===   ' + monthName + '   ' +
             Utilities.formatDate(now, WR_TZ, 'dd MMM HH:mm'));
  Logger.log('  Read only. Nothing was written, here or anywhere else.');
  Logger.log('');

  Logger.log('  COLUMNS THIS IS READING  (if one says NOT FOUND, that is the bug)');
  Logger.log('    date       : ' + wr_whHead_(head, cDate));
  Logger.log('    agent      : ' + wr_whHead_(head, cAgent));
  Logger.log('    amount     : ' + wr_whHead_(head, cAmt));
  Logger.log('    is unit    : ' + wr_whHead_(head, cUnit));
  Logger.log('    is refund  : ' + wr_whHead_(head, cRef));
  Logger.log('    status     : ' + wr_whHead_(head, cStat));
  Logger.log('    on roster  : ' + wr_whHead_(head, cRost));
  Logger.log('    batch      : ' + wr_whHead_(head, cBatch));
  Logger.log('');
  if (cDate < 0 || cAgent < 0 || cAmt < 0) {
    Logger.log('  *** STOP. One of date / agent / amount was not found, so the feed');
    Logger.log('      returns nothing at all. Fix the header in mdl_Payments first.');
    return;
  }

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var roster = wr_roster_(ss, monthKey);

  /* every bucket, in the order the feed applies them */
  var badDate = 0, otherMonth = 0, noName = 0, summaryRows = 0;
  var grossRev = 0, grossRows = 0, grossUnits = 0;
  var refRev = 0, refRows = 0;
  var canRev = 0, canRows = 0;
  var bothRows = 0;
  var onRev = 0, onRows = 0, onUnits = 0;
  var offRev = 0, offRows = 0, offUnits = 0;
  var off = {}, statusSeen = {}, earners = {};
  var latest = null;

  for (var r = 0; r < grid.length; r++) {
    var row = grid[r];
    var d = row[cDate];

    /* A date the sheet stores as TEXT is not a Date object. Every reader
       here skips it without a word, so the money is in the sheet, visible
       to a human, and in no total anywhere. Worth counting. */
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

    grossRev += amt; grossRows++; grossUnits += isUnit;

    var isRefund = (cRef >= 0 && wr_truthy_(row[cRef]));
    var statTxt = (cStat >= 0) ? String(row[cStat] || '').trim() : '';
    var isCancel = (statTxt.toLowerCase().indexOf('cancel') > -1);

    var label = statTxt || '(blank)';
    if (!statusSeen[label]) statusSeen[label] = { rev: 0, rows: 0 };
    statusSeen[label].rev += amt; statusSeen[label].rows++;

    if (isRefund && isCancel) bothRows++;
    if (isRefund) { refRev += amt; refRows++; }
    else if (isCancel) { canRev += amt; canRows++; }
    if (isRefund || isCancel) continue;

    var key = wr_key_(name);
    if (roster.byAgent[key]) {
      onRev += amt; onRows++; onUnits += isUnit;
      if (!earners[key]) earners[key] = 0;
      earners[key] += amt;
    } else {
      offRev += amt; offRows++; offUnits += isUnit;
      if (!off[name]) off[name] = { rev: 0, units: 0, flagged: 0 };
      off[name].rev += amt; off[name].units += isUnit;
      if (cRost >= 0 && wr_truthy_(row[cRost])) off[name].flagged++;
    }
  }

  /* ---------------- the chain ---------------- */
  /* One label width for every line, so the money forms a single column and
     the subtraction can be checked by eye. A chain that does not line up
     does not read as a chain. */
  function step(label, amount, tail) {
    Logger.log('    ' + wr_pad_(label, 38) + wr_pad_(amount, 12) + (tail || ''));
  }

  Logger.log('  THE CHAIN  -  each line is what the step below removes');
  Logger.log('');
  step('every rupee dated ' + monthName, wr_money_(grossRev),
       grossRows + ' rows, ' + grossUnits + ' units');
  step('  minus refunds', '-' + wr_money_(refRev),
       refRows + ' rows');
  step('  minus cancelled', '-' + wr_money_(canRev),
       canRows + ' rows' +
       (bothRows ? '   (' + bothRows + ' also refunds, counted once)' : ''));
  step('  minus names not on this roster', '-' + wr_money_(offRev),
       offRows + ' rows, ' + offUnits + ' units');
  step('= WHAT THE BOARD SHOWS', wr_money_(onRev),
       onRows + ' rows, ' + onUnits + ' units');
  Logger.log('');

  /* ---------------- all three numbers, side by side ----------------

     The Management Report and the leaderboard are two readers of the SAME
     model, so when both are short the fault cannot be in either of them,
     and it cannot be the deployed version of the web app either - that
     would move the TV and leave the report alone. It is in mdl_Payments or
     mdl_Roster, below both.

     This prints the report's own headline next to the chain above so that
     distinction can be made in one run instead of three. */
  var repRev = '', repUnits = '', repDated = '';
  var repSh = ss.getSheetByName(WR_REPORT_TAB);
  if (repSh && repSh.getLastRow() > 1) {
    var rGrid = repSh.getRange(1, 1, Math.min(repSh.getLastRow(), 200),
                               Math.min(repSh.getLastColumn(), 30)).getDisplayValues();
    repRev   = wr_findRight_(rGrid, 'Total revenue');
    repUnits = wr_findRight_(rGrid, 'Units');
    repDated = wr_findRight_(rGrid, 'Report Dated');
  }

  Logger.log('  THE SAME MONTH, FROM EVERY PLACE THAT REPORTS IT');
  Logger.log('    ' + wr_pad_('mdl_Payments, board rules applied', 38) +
             wr_pad_(wr_money_(onRev), 12) + onUnits + ' units');
  if (repSh) {
    var repNum = wr_reportNum_(repRev);
    var diff = Math.abs(repNum - onRev);
    var same = diff <= Math.max(1000, Math.abs(onRev) * 0.001);
    Logger.log('    ' + wr_pad_('Management Report tab says', 38) +
               wr_pad_(repRev || '(not found)', 12) +
               (repUnits ? repUnits + ' units' : '') +
               (repRev ? (same ? '   SAME' : '   DIFFERS by ' + wr_money_(diff)) : ''));
    Logger.log('    ' + wr_pad_('  report was built', 38) +
               (repDated || '(no Report Dated cell)'));
  } else {
    Logger.log('    ' + wr_pad_('Management Report tab', 38) +
               'NOT FOUND (looked for "' + WR_REPORT_TAB + '")');
  }
  Logger.log('');
  Logger.log('    READ IT LIKE THIS:');
  Logger.log('    - report and board agree, both under CBC  -> the fault is in');
  Logger.log('      mdl_Payments or mdl_Roster, below both. Check the roster count');
  Logger.log('      just below, then run warRoomRosterAudit().');
  Logger.log('    - report and board DISAGREE -> one ran against older data. Rebuild');
  Logger.log('      the report, then run warRoomVsReport() for the line by line.');
  Logger.log('    - both agree with CBC but the TV does not -> only then is it the');
  Logger.log('      deployment: Deploy > Manage deployments > pencil > New version.');
  Logger.log('');

  /* ---------------- the roster, against CBC ---------------- */
  var withMoney = 0, k;
  for (k in earners) if (earners[k] > 0) withMoney++;
  var rosterN = 0;
  for (k in roster.byAgent) rosterN++;

  Logger.log('  THE ROSTER THIS MONTH');
  Logger.log('    agents loaded from mdl_Roster : ' + rosterN);
  Logger.log('    of those, with a sale         : ' + withMoney);
  Logger.log('    of those, with nothing yet    : ' + (rosterN - withMoney));
  Logger.log('    CBC is said to hold 86 this month. If the first number is well');
  Logger.log('    under that, the roster is short and BOTH the report and the board');
  Logger.log('    are short with it - every agent missing here is missing from both.');
  Logger.log('');

  wr_whRosterCheck_(ss, monthKey);


  /* ---------------- who is being dropped ---------------- */
  Logger.log('  PAID, BUT NOT ON THE ROSTER  (this money is on no screen)');
  var names = [];
  for (var n2 in off) names.push(n2);
  names.sort(function (a, b) { return off[b].rev - off[a].rev; });
  for (var i = 0; i < names.length; i++) {
    var o = off[names[i]];
    Logger.log('    ' + wr_pad_(names[i], 28) + wr_pad_(wr_money_(o.rev), 12) +
               wr_pad_(o.units + 'u', 5) +
               (o.flagged ? '  <-- flagged On Roster = YES, but no roster row this month' : ''));
  }
  if (!names.length) {
    Logger.log('    nobody. Every payment this month belongs to a roster agent,');
    Logger.log('    so the gap is NOT the roster - look at refunds and cancelled above.');
  }
  Logger.log('');

  /* ---------------- what Status actually contains ---------------- */
  Logger.log('  EVERY Status VALUE THIS MONTH  (anything containing "cancel" is removed)');
  var sts = [];
  for (var s2 in statusSeen) sts.push(s2);
  sts.sort(function (a, b) { return statusSeen[b].rev - statusSeen[a].rev; });
  for (var j = 0; j < sts.length; j++) {
    Logger.log('    ' + wr_pad_(sts[j], 28) + wr_pad_(wr_money_(statusSeen[sts[j]].rev), 12) +
               wr_pad_(statusSeen[sts[j]].rows + ' rows', 10) +
               (sts[j].toLowerCase().indexOf('cancel') > -1 ? '  REMOVED' : ''));
  }
  Logger.log('');

  /* ---------------- rows nothing counted at all ---------------- */
  Logger.log('  ROWS NO TOTAL INCLUDES');
  Logger.log('    unreadable date (stored as text) : ' + badDate +
             (badDate ? '   <-- real money, in no figure anywhere' : ''));
  Logger.log('    blank agent name                 : ' + noName);
  Logger.log('    looked like a totals row         : ' + summaryRows);
  Logger.log('    dated another month              : ' + otherMonth);
  Logger.log('');

  Logger.log('  IS THE IMPORT CURRENT?');
  Logger.log('    newest payment anywhere : ' +
             (latest ? Utilities.formatDate(latest, WR_TZ, 'dd MMM yyyy') : 'none'));
  Logger.log('    today                   : ' +
             Utilities.formatDate(now, WR_TZ, 'dd MMM yyyy'));
  Logger.log('    rows in mdl_Payments    : ' + (lastRow - 1));
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}


/**
 * DID EVERY AGENT MAKE IT ACROSS FROM CBC?
 *
 * mdl_Roster is built from the src_Roster_* tabs, which are themselves
 * IMPORTRANGEs of CBC. An IMPORTRANGE with a PINNED last row - A2:H60
 * rather than A2:H - stops importing the moment CBC grows past it, and it
 * does so silently: no error, no red cell, just fewer rows. New joiners
 * are added at the BOTTOM of CBC, which is exactly where a pinned range
 * cuts, so a new intake is the most likely thing in the world to fall off
 * the end of it.
 *
 * An agent lost here is lost from the Management Report and the board
 * alike, because both read mdl_Roster. That is why this runs inside the
 * same function: there is nothing else to remember to run.
 */
function wr_whRosterCheck_(ss, monthKey) {
  Logger.log('  DID EVERYONE MAKE IT ACROSS FROM CBC?');

  var mdl = ss.getSheetByName(WR_ROSTER_TAB);
  if (!mdl || mdl.getLastRow() < 2) {
    Logger.log('    mdl_Roster is empty. Nothing can be right until it is built.');
    Logger.log('');
    return;
  }

  var mg = mdl.getRange(1, 1, mdl.getLastRow(), mdl.getLastColumn()).getValues();
  var mh = wr_headers_(mg[0]);
  var mAgent = wr_col_(mh, ['agent', 'agent name', 'name', 'lead owner', 'owner']);
  var mMgr   = wr_col_(mh, ['manager', 'reporting manager', 'tl']);
  var mMonth = wr_monthCol_(mg);
  if (mAgent < 0) {
    Logger.log('    mdl_Roster has no Agent column. Stop here and fix that.');
    Logger.log('');
    return;
  }

  /* who mdl_Roster holds for THIS month */
  var inMdl = {}, mdlCount = 0, perMonth = {};
  for (var r = 1; r < mg.length; r++) {
    var nm = wr_str_(mg[r][mAgent]);
    if (!nm) continue;
    if (wr_isSummaryRow_(nm, mMgr >= 0 ? wr_str_(mg[r][mMgr]) : '', '')) continue;
    var mo = (mMonth >= 0) ? wr_monthKey_(mg[r][mMonth]) : monthKey;
    if (mo) perMonth[mo] = (perMonth[mo] || 0) + 1;
    if (mo && mo !== monthKey) continue;
    if (!inMdl[wr_key_(nm)]) { inMdl[wr_key_(nm)] = nm; mdlCount++; }
  }
  Logger.log('    mdl_Roster holds for this month : ' + mdlCount + ' agents');

  var months = [];
  for (var mk in perMonth) months.push(mk);
  months.sort();
  if (months.length > 1) {
    Logger.log('    every month it holds            : ' +
               months.map(function (x) { return x + '(' + perMonth[x] + ')'; }).join('  '));
  }
  Logger.log('');

  /* every src_Roster_* tab, with the import range it was built from */
  var tabs = ss.getSheets(), found = 0;
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], nameT = sh.getName();
    if (!/^src_Roster/i.test(nameT)) continue;
    found++;

    var rows = sh.getLastRow(), cols = sh.getLastColumn();
    Logger.log('    --- ' + nameT + '   ' + rows + ' rows ---');

    /* The formula behind it. A pinned last row is visible right here. */
    var f = '';
    try { f = sh.getRange(1, 1).getFormula() || sh.getRange(2, 1).getFormula() || ''; }
    catch (e) { f = ''; }
    if (f) {
      Logger.log('        built by : ' + f);
      if (/![A-Z]+\d+:[A-Z]+\d+/.test(f)) {
        Logger.log('        *** THAT RANGE ENDS ON A FIXED ROW NUMBER. The moment CBC');
        Logger.log('            grows past it the extra agents stop arriving, with no');
        Logger.log('            error anywhere. Change it to end at the column letter');
        Logger.log('            with no row - A2:H instead of A2:H60 - and they return.');
      }
    }

    if (rows < 2) { Logger.log('        empty.'); continue; }

    /* who is in the import but never reached mdl_Roster for this month */
    var g = sh.getRange(1, 1, rows, cols).getValues();
    var hRow = -1;
    for (var rr = 0; rr < g.length && hRow < 0; rr++) {
      for (var cc = 0; cc < g[rr].length; cc++) {
        if (String(g[rr][cc]).trim().toLowerCase() === 'agent') { hRow = rr; break; }
      }
    }
    if (hRow < 0) { Logger.log('        no "Agent" header row found - cannot compare.'); continue; }

    var sh2 = wr_headers_(g[hRow]);
    var sAgent = wr_col_(sh2, ['agent', 'agent name', 'name']);
    var sMgr   = wr_col_(sh2, ['manager', 'reporting manager', 'tl']);
    if (sAgent < 0) { Logger.log('        no Agent column - cannot compare.'); continue; }

    var srcCount = 0, missing = [];
    for (var r2 = hRow + 1; r2 < g.length; r2++) {
      var n2 = wr_str_(g[r2][sAgent]);
      if (!n2) continue;
      if (wr_isSummaryRow_(n2, sMgr >= 0 ? wr_str_(g[r2][sMgr]) : '', '')) continue;
      srcCount++;
      if (!inMdl[wr_key_(n2)]) missing.push(n2);
    }
    Logger.log('        agents in this tab : ' + srcCount);

    if (missing.length) {
      Logger.log('        IN THIS TAB BUT NOT IN mdl_Roster FOR ' + monthKey + ' : ' +
                 missing.length);
      for (var i2 = 0; i2 < missing.length && i2 < 40; i2++) {
        Logger.log('          ' + missing[i2]);
      }
      if (missing.length > 40) Logger.log('          ... and ' + (missing.length - 40) + ' more');
      Logger.log('        Every one of these is invisible to the report AND the board.');
    } else {
      Logger.log('        all of them are in mdl_Roster for ' + monthKey + '.');
    }
  }

  if (!found) {
    Logger.log('    No src_Roster_* tab exists, so mdl_Roster is not being fed from');
    Logger.log('    CBC at all and cannot grow when CBC does.');
  }
  Logger.log('');
}


/** Name the column an index landed on, or say plainly that it did not. */
function wr_whHead_(head, idx) {
  if (idx < 0) return 'NOT FOUND';
  return '"' + String(head[idx]) + '"   (column ' + wr_whA1_(idx) + ')';
}


/** 0-based column index to a spreadsheet letter, so it can be found by eye. */
function wr_whA1_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}
