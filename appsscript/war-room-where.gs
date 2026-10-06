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
  Logger.log('    Compare that last figure with the TV. If they match, the board is');
  Logger.log('    doing exactly what it was told and the argument is about the rules');
  Logger.log('    above it. If they DO NOT match, the feed is serving an older');
  Logger.log('    deployed version - Deploy > Manage deployments > pencil > New version.');
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
  Logger.log('    CBC is said to hold 86. If the first number is well under that,');
  Logger.log('    the roster tab for this month is short and NOTHING below is');
  Logger.log('    trustworthy - fix that before reading anything else.');
  Logger.log('');

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
