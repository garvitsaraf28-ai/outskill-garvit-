/**
 * ManagementReportUpgrade.gs - AIGF Upgrade / Catalyst as revenue.
 *
 * Confirmed as revenue on 6 Oct 2026. CBC's headline has always included
 * it and neither the report nor the board did, so both read low by exactly
 * that amount - 1,61,500 in October, all of it on one agent.
 *
 * WHY IT READS src_Roster AND NOT mdl_Roster
 *
 *   The first version read mdl_Roster and stopped with "no AIGF Upgrade /
 *   Catalyst column". It is not there. CBC has it, src_Roster_<month> has
 *   it, and whatever builds mdl_Roster drops it on the way through - which
 *   is also why the board's roster reader has always reported upgrade as
 *   zero without anybody noticing.
 *
 *   Fixing the roster builder would be the tidier repair, but that file is
 *   not in hand and this needs neither it nor any change to it.
 *
 * AND WHY THE COLUMN IS FOUND THE HARD WAY
 *
 *   In src_Roster the label "AIGF Upgrade/Catalyst" does not sit on the
 *   same row as Manager and Agent - it sits on the totals row above them,
 *   over near column AE. An exact header match on the main header row
 *   finds nothing, which is exactly what happened. So the label is hunted
 *   across the top rows and the data is read from the Agent row down.
 *
 *   Manager and Office are taken from mdl_Roster, joined on agent name,
 *   rather than from src_Roster - its City/Region reads "India
 *   Team-Bangalore" where the report says "Bangalore", and keying the
 *   blocks off that would put the money in an office that does not exist.
 *
 * TWO ENTRY POINTS
 *
 *   mr_addUpgrade_   the Management Report. One line in
 *                    ManagementReport.gs, under the managers/offices
 *                    roll-up and before mr_write_:
 *
 *                        mr_addUpgrade_(ss, win, pay, managers, offices);
 *
 *   wr_fillUpgrade_  the leaderboard. One line in WarRoom.gs, in
 *                    wr_build_, directly after:
 *
 *                        var roster = wr_roster_(ss, monthKey);
 *                        wr_fillUpgrade_(ss, monthKey, roster);
 *
 *                    with the seed on the line below it reading
 *                    revenue: r.upgrade rather than revenue: 0.
 *
 * Run managementReportUpgradeSelfTest after pasting. Read only except for
 * the figures it folds into the report it is called from.
 */


/* ================================================================
   THE MANAGEMENT REPORT
   ================================================================ */
function mr_addUpgrade_(ss, win, pay, managers, offices) {
  var now = up_collect_(ss, win.monthKey);
  var prior = up_collect_(ss, mr_monthKeyOf_(win.priorStart));

  if (now.error) { Logger.log('  !! upgrade: ' + now.error); return 0; }
  if (!now.total && !prior.total) {
    Logger.log('  upgrade : none this month or last.');
    return 0;
  }

  managers.forEach(function (m) {
    if (now.byMgr[m.manager]) m.rev += now.byMgr[m.manager];
  });
  offices.forEach(function (o) {
    if (now.byOff[o.office]) o.rev += now.byOff[o.office];
  });
  pay.now.rev   += now.total;
  pay.prior.rev += prior.total;

  Logger.log('  upgrade : ' + mr_commas_(now.total) + ' counted as revenue across ' +
             now.rows + ' agent(s), from ' + now.tab +
             '   (prior window ' + mr_commas_(prior.total) + ')');
  var who = [];
  for (var k in now.byMgr) who.push(k + ' ' + mr_commas_(now.byMgr[k]));
  if (who.length) Logger.log('            by manager: ' + who.join(',  '));

  /* An upgrade against a name the roster does not carry would otherwise
     land in the headline and in no block, and the block-consistency check
     further down buildManagementReport would report it as a mystery. */
  if (now.unmatched.length) {
    Logger.log('  !! ' + now.unmatched.length + ' upgrade row(s) name an agent that is');
    Logger.log('     not on mdl_Roster for this month: ' + now.unmatched.join(', '));
    Logger.log('     Their money is in the total but in no manager or office block.');
  }
  return now.total;
}


/* ================================================================
   THE LEADERBOARD
   ================================================================ */
/**
 * Put the upgrade figure onto each roster agent, so wr_build_ can seed
 * revenue with it. wr_roster_ reads mdl_Roster, which does not carry the
 * column, so without this every agent's upgrade is zero and the seed has
 * nothing to add.
 */
function wr_fillUpgrade_(ss, monthKey, roster) {
  if (!roster || !roster.byAgent) return 0;
  var got = up_collect_(ss, monthKey);
  if (got.error) { Logger.log('wr_fillUpgrade_: ' + got.error); return 0; }

  /* THE BOARD'S KEY, NOT THIS FILE'S.

     roster.byAgent is keyed by wr_key_, which strips spaces AND
     punctuation and applies WR_ALIASES: "Subham Sahoo" becomes
     "subhamsahoo". up_key_ only collapses whitespace, giving
     "subham sahoo". The first version looked up one with the other, found
     nothing every single time, and reported a cheerful zero - the board
     read "AIGF upgrade : 0 (included)" with the money sitting right there
     in src_Roster_Oct.

     So re-key through the board's own function wherever it exists. Two
     normalisations of the same name in one codebase is a trap, and this
     is the side that has to give way, because wr_key_ is what every
     board, the ticker and every diagnostic already agree on. */
  var keyOf = (typeof wr_key_ === 'function') ? wr_key_ : up_key_;

  var total = 0, filled = 0, missed = [];
  for (var k in got.byAgent) {
    var name = got.names[k] || k;
    var bk = keyOf(name);
    if (!roster.byAgent[bk]) { missed.push(name); continue; }
    roster.byAgent[bk].upgrade = got.byAgent[k];
    total += got.byAgent[k];
    filled++;
  }
  roster.upgrade = total;
  roster.upCol = true;

  /* Said out loud, both ways. A silent zero here is what made this take a
     second attempt, and a name that does not reach the board is money the
     TV will never show. */
  if (filled) {
    Logger.log('wr_fillUpgrade_: ' + filled + ' agent(s), ' + total +
               ' from ' + got.tab);
  }
  if (missed.length) {
    Logger.log('wr_fillUpgrade_: ' + missed.length + ' upgrade row(s) match no agent ' +
               'on the board: ' + missed.join(', '));
  }
  return total;
}


/* ================================================================
   THE WORK
   ================================================================ */
/**
 * Upgrade money for one month, keyed by agent, and rolled up by the
 * manager and office mdl_Roster gives that agent.
 */
function up_collect_(ss, monthKey) {
  var out = { byAgent: {}, names: {}, byMgr: {}, byOff: {}, total: 0, rows: 0,
              unmatched: [], tab: '', error: '' };
  if (!monthKey) { out.error = 'no month given'; return out; }

  var src = up_srcRoster_(ss, monthKey);
  if (!src) { out.error = 'no src_Roster tab for ' + monthKey; return out; }
  out.tab = src.name;

  var who = up_mdlRoster_(ss, monthKey);   // agent -> manager, office

  for (var r = src.firstData; r < src.grid.length; r++) {
    var row = src.grid[r];
    var agent = String(row[src.cAgent] == null ? '' : row[src.cAgent]).trim();
    if (!agent || mr_isNumeric_(agent)) continue;
    if (/^(total|grand total|sum)\b/i.test(agent)) continue;

    var amt = mr_number_(row[src.cUp]);
    if (!amt) continue;

    var key = up_key_(agent);
    /* The spelling is kept, not just the key: wr_fillUpgrade_ has to
       re-key these through wr_key_, which normalises differently. */
    out.names[key] = agent;
    out.byAgent[key] = (out.byAgent[key] || 0) + amt;
    out.total += amt; out.rows++;

    var m = who[key];
    if (!m) { out.unmatched.push(agent); continue; }
    if (m.manager) out.byMgr[m.manager] = (out.byMgr[m.manager] || 0) + amt;
    if (m.office)  out.byOff[m.office]  = (out.byOff[m.office]  || 0) + amt;
  }
  return out;
}


/** agent -> {manager, office} for one month, exactly as the report sees it. */
function up_mdlRoster_(ss, monthKey) {
  var out = {};
  var sh = ss.getSheetByName('mdl_Roster');
  if (!sh || sh.getLastRow() < 2) return out;

  var grid = mr_grid_(sh);
  var iMonth = mr_findCol_(grid[0], ['month']);
  var iAgent = mr_findCol_(grid[0], ['agent', 'agent name']);
  var iMgr   = mr_findCol_(grid[0], ['manager', 'reporting manager']);
  var iOff   = mr_findCol_(grid[0], ['office', 'city', 'location']);
  if (iMonth < 0 || iAgent < 0) return out;

  for (var r = 1; r < grid.length; r++) {
    if (mr_monthKeyOf_(grid[r][iMonth]) !== monthKey) continue;
    var a = String(grid[r][iAgent] == null ? '' : grid[r][iAgent]).trim();
    if (!a) continue;
    out[up_key_(a)] = {
      manager: iMgr >= 0 ? String(grid[r][iMgr]).trim() : '',
      office:  iOff >= 0 ? String(grid[r][iOff]).trim()  : ''
    };
  }
  return out;
}


/**
 * The src_Roster tab for a month, with the Agent column, the first data
 * row, and the upgrade column - which is labelled on a row ABOVE the Agent
 * header, so it is hunted across the top of the sheet rather than looked
 * up in one header row.
 */
function up_srcRoster_(ss, monthKey) {
  var tabs = ss.getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], nm = sh.getName();
    if (!/^src_Roster/i.test(nm)) continue;

    var suffix = nm.replace(/^src_Roster[_\s-]*/i, '').trim();
    var tabMonth = up_monthOfName_(suffix, monthKey.substring(0, 4));
    if (tabMonth && tabMonth !== monthKey) continue;

    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3 || lastCol < 3) continue;
    var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();

    /* the row that names Agent - everything below it is data */
    var hr = -1, cAgent = -1;
    for (var r = 0; r < grid.length && r < 25 && hr < 0; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (String(grid[r][c]).trim().toLowerCase() === 'agent') { hr = r; cAgent = c; break; }
      }
    }
    if (hr < 0) continue;

    /* the upgrade label, anywhere in the rows at or above it */
    var cUp = -1;
    for (var r2 = 0; r2 <= hr && cUp < 0; r2++) {
      for (var c2 = 0; c2 < grid[r2].length; c2++) {
        var v = String(grid[r2][c2]).trim().toLowerCase();
        if (!v) continue;
        if (v.indexOf('upgrade') > -1 || v.indexOf('catalyst') > -1) { cUp = c2; break; }
      }
    }
    if (cUp < 0) continue;

    return { name: nm, grid: grid, firstData: hr + 1, cAgent: cAgent, cUp: cUp };
  }
  return null;
}


/** "Oct" plus a year to 2026-10. Blank when the suffix is not a month. */
function up_monthOfName_(suffix, year) {
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
              jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  var m = String(suffix).toLowerCase().match(/^([a-z]{3})/);
  if (!m || !MON[m[1]]) return '';
  var n = MON[m[1]];
  return year + '-' + (n < 10 ? '0' : '') + n;
}


function up_key_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
}


/**
 * Find a column by header, exact match first, then substring.
 * ManagementReport.gs indexes by the exact trimmed header, which is right
 * for the columns it requires and too strict for optional ones.
 */
function mr_findCol_(headerRow, names) {
  var H = {};
  for (var c = 0; c < headerRow.length; c++) {
    var k = String(headerRow[c] == null ? '' : headerRow[c]).trim().toLowerCase();
    if (k && H[k] === undefined) H[k] = c;
  }
  var i, key;
  for (i = 0; i < names.length; i++) if (H[names[i]] !== undefined) return H[names[i]];
  for (i = 0; i < names.length; i++) {
    for (key in H) if (key.indexOf(names[i]) > -1) return H[key];
  }
  return -1;
}


/* ================================================================
   PROVE IT WITHOUT A SHEET
   ================================================================ */
function managementReportUpgradeSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  eq('a month suffix', up_monthOfName_('Oct', '2026'), '2026-10');
  eq('a longer one', up_monthOfName_('October', '2026'), '2026-10');
  eq('not a month', up_monthOfName_('Archive', '2026'), '');
  eq('names are matched loosely', up_key_('  Subham   Sahoo '), 'subham sahoo');

  var head = ['Month', 'Agent', 'Manager', 'Office', 'Target'];
  eq('exact beats substring', mr_findCol_(['Agent Name', 'Agent'], ['agent']), 1);
  eq('substring still works', mr_findCol_(head, ['offic']), 3);
  eq('absent reads -1', mr_findCol_(head, ['nothing']), -1);

  /* src_Roster as it really is: preamble, the upgrade label on the totals
     row above the header, City/Region unlike the report's Office. */
  var srcOct = [
    ['SOURCE - CBC > Oct 2026', '', '', '', ''],
    ['Read-only. Do not type here.', '', '', '', ''],
    ['Total', '', '', '', 'AIGF Upgrade/Catalyst'],
    ['Manager', 'Agent', 'City/Region', 'Oct Target', ''],
    ['Vaibhav Tiwari', 'Subham Sahoo', 'India Team-Bbsr', 1000000, 161500],
    ['Deepika M', 'Kshitij', 'Intl Team-Bangalore', 1200000, 0],
    ['', 'Ghost Agent', '', 0, 7000]
  ];
  var srcSep = [
    ['Total', '', '', '', 'AIGF Upgrade/Catalyst'],
    ['Manager', 'Agent', 'City/Region', 'Sep Target', ''],
    ['Vaibhav Tiwari', 'Subham Sahoo', 'India Team-Bbsr', 1000000, 50000]
  ];
  var mdl = [
    ['Month', 'Agent', 'Manager', 'Office', 'Target'],
    ['2026-10', 'Subham Sahoo', 'Vaibhav Tiwari', 'Bhubaneswar', 1000000],
    ['2026-10', 'Kshitij', 'Deepika M', 'Bangalore', 1200000],
    ['2026-09', 'Subham Sahoo', 'Vaibhav Tiwari', 'Bhubaneswar', 1000000]
  ];
  function tab(name, g) {
    return { getName: function () { return name; },
             getLastRow: function () { return g.length; },
             getLastColumn: function () { return g[0].length; },
             getRange: function () { return { getValues: function () { return g; } }; } };
  }
  var TABS = [tab('src_Roster_Oct', srcOct), tab('src_Roster_Sep', srcSep),
              tab('mdl_Roster', mdl)];
  var ss = { getSheets: function () { return TABS; },
             getSheetByName: function (n) {
               for (var i = 0; i < TABS.length; i++) if (TABS[i].getName() === n) return TABS[i];
               return null; } };

  var win = { monthKey: '2026-10', priorStart: new Date(2026, 8, 1) };
  var pay = { now: { rev: 2341196 }, prior: { rev: 3428581 } };
  var managers = [{ manager: 'Vaibhav Tiwari', rev: 620000 },
                  { manager: 'Deepika M', rev: 1146000 }];
  var offices = [{ office: 'Bhubaneswar', rev: 639000 },
                 { office: 'Bangalore', rev: 1333000 }];

  var added = mr_addUpgrade_(ss, win, pay, managers, offices);

  eq('reads the label above the header', added, 168500);
  eq('the headline moves', pay.now.rev, 2341196 + 168500);
  eq('the prior window moves by its own', pay.prior.rev, 3428581 + 50000);
  eq('the right manager gets it', managers[0].rev, 620000 + 161500);
  eq('nobody else does', managers[1].rev, 1146000);
  eq('the office comes from mdl_Roster, not City/Region',
     offices[0].rev, 639000 + 161500);
  eq('nobody else does', offices[1].rev, 1333000);

  /* the leaderboard side */
  /* Keyed the way wr_key_ does it - no spaces - which is the whole point
     of the bug this now guards against. */
  var roster = { byAgent: { 'subhamsahoo': { upgrade: 0 }, 'kshitij': { upgrade: 0 } },
                 upgrade: 0, upCol: false };
  var filled = wr_fillUpgrade_(ss, '2026-10', roster);
  eq('fills the agent the board knows', roster.byAgent['subhamsahoo'].upgrade, 161500);
  eq('leaves the others alone', roster.byAgent['kshitij'].upgrade, 0);
  eq('an agent off the roster is not invented', filled, 161500);
  eq('the board now knows it has a column', roster.upCol, true);

  if (fails.length) {
    Logger.log('UPGRADE SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('UPGRADE SELF TEST PASSED');
    Logger.log('  the label is found on the row above the header, the money lands');
    Logger.log('  on the right manager and office, and an agent missing from');
    Logger.log('  mdl_Roster is reported rather than silently dropped.');
  }
  return fails;
}
