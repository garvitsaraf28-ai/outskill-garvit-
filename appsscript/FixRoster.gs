/**
 * fixRoster - the gap is not missing payments. It is a missing roster.
 *
 * WHAT TODAY ACTUALLY WAS
 *
 *   I spent it looking for payments. findTheMissing settled that: for
 *   every one of CBC's 93 agents, mdl_Payments already holds what CBC
 *   credits them with. "Nothing is short. CBC and the model agree."
 *
 *   So the money reaches the model and is lost after it. wr_build_ counts
 *   one set of people: the names on mdl_Roster for this month. An agent
 *   CBC lists who is not on mdl_Roster has their payments read, keyed,
 *   and then dropped into "off-roster revenue" - a figure no page renders.
 *   October carries 5.48 cr in that bucket. Some of it is other teams and
 *   belongs there. The part that is CBC's own agents does not.
 *
 *   That is why running updateAndCheck ten times changed nothing. The
 *   refresh was working. It was refreshing a roster that was short.
 *
 * WHAT THIS DOES
 *
 *   Compares CBC's src_Roster for this month against mdl_Roster, and adds
 *   the agents CBC has and mdl_Roster does not - name, manager, office,
 *   team, target, capacity, taken from CBC's own row. It prints every name
 *   it adds and what that name is worth in mdl_Payments this month, so the
 *   money it releases is visible before anything is rebuilt.
 *
 *   If mdl_Roster is already complete it adds nothing and says so. There
 *   is no state in which this is destructive: it appends, it never clears,
 *   never edits an existing row, and never touches CBC or the Payment
 *   Tracker. Run it twice and the second run adds nothing.
 *
 * WHAT IT DELIBERATELY WILL NOT DO
 *
 *   It will not add more than RTU_MAX_ADD_FRACTION of the existing roster
 *   in one go. Forty new names is not forty joiners, it is a key that
 *   stopped matching, and appending on top of that would double every
 *   figure on the board. In that case it reports and stops.
 *
 *   It also will not run if mdl_Roster has no rows at all for this month,
 *   because then there is no existing row to copy the Month cell's format
 *   from, and a Month cell written in the wrong shape is invisible to
 *   wr_roster_ - which is this bug a second time.
 *
 * AFTER IT
 *
 *   Run updateAndCheck. The agents are on the roster, so their payments
 *   are counted, and the report and the TV both move.
 *
 *   One thing to know: whatever builds mdl_Roster rewrites that tab on
 *   every refreshAndVerify, so these rows go when the 2.5-hour cycle next
 *   runs. Once the number moves I will wire this into the sequence ahead
 *   of buildManagementReport so it holds by itself.
 */

var RTU_MAX_ADD_FRACTION = 0.40;


function fixRoster() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  L('=== FIX ROSTER ===   ' + monthKey + '   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('');

  /* ---------- what CBC says ---------- */
  var src = rtu_src_(ss, monthKey);
  if (!src) {
    L('  *** No src_Roster tab for ' + monthKey + ' with an Agent column.');
    L('      Without CBC there is nothing to compare against.');
    return;
  }
  L('  CBC        : ' + src.name + ', ' + src.agents.length + ' agents');

  /* ---------- what every page reads ---------- */
  var mdlSh = ss.getSheetByName('mdl_Roster');
  if (!mdlSh || mdlSh.getLastRow() < 2) {
    L('  *** mdl_Roster is empty. Run refreshAndVerify first.');
    return;
  }
  var roster = wr_roster_(ss, monthKey);
  L('  mdl_Roster : ' + roster.count + ' agents for ' + monthKey);
  L('');

  /* ---------- who is on one and not the other ---------- */
  var add = [], k;
  for (var i = 0; i < src.agents.length; i++) {
    k = wr_key_(src.agents[i].name);
    if (roster.byAgent[k]) continue;
    add.push(src.agents[i]);
  }

  var extra = [];
  for (k in roster.byAgent) {
    if (!src.byKey[k]) extra.push(roster.byAgent[k].name);
  }

  if (extra.length) {
    L('  ' + extra.length + ' on mdl_Roster that CBC does not list. Left alone,');
    L('  not deleted - a leaver still owns the revenue they closed.');
    L('    ' + extra.join(', '));
    L('');
  }

  if (!add.length) {
    L('  Every CBC agent is already on mdl_Roster. Nothing to add.');
    L('');
    L('  Then the gap is somewhere else and I will keep looking. Send this log.');
    return;
  }

  /* ---------- what adding them releases ---------- */
  var pay = rtu_payTally_(ss, monthKey);
  var releasing = 0;
  L('  ' + add.length + ' agent(s) CBC lists that mdl_Roster does not,');
  L('  with what each is already worth in mdl_Payments this month:');
  L('');
  for (i = 0; i < add.length; i++) {
    var p = pay[wr_key_(add[i].name)];
    var rev = p ? p.rev : 0;
    releasing += rev;
    L('    ' + rtu_pad_(add[i].name, 28) + rtu_money_(rev) +
      (add[i].manager ? '   (' + add[i].manager + ')' : '') +
      (rev ? '' : '   no payments yet this month'));
  }
  L('');
  L('  ' + rtu_money_(releasing) + ' of revenue is counted nowhere today because');
  L('  these names are not on the roster.');
  L('');

  /* ---------- the guard ---------- */
  var limit = Math.max(5, Math.floor(roster.count * RTU_MAX_ADD_FRACTION));
  if (add.length > limit) {
    L('  *** REFUSING TO ADD. ' + add.length + ' names is more than ' + limit +
      ', which is ' + Math.round(RTU_MAX_ADD_FRACTION * 100) + '% of the ' +
      roster.count + ' already there.');
    L('      That many at once is not joiners, it is name matching that has');
    L('      stopped working - and appending on top of it would count half');
    L('      the floor twice. Send me this log and I will read the names.');
    return;
  }

  /* ---------- where to write ---------- */
  var grid = mdlSh.getRange(1, 1, mdlSh.getLastRow(), mdlSh.getLastColumn()).getValues();
  var H = wr_headers_(grid[0]);
  var cAgent  = wr_col_(H, ['agent', 'agent name', 'name', 'lead owner', 'owner', 'employee', 'full name']);
  var cMgr    = wr_col_(H, ['manager', 'reporting manager', 'tl']);
  var cCity   = wr_col_(H, ['office', 'city', 'location', 'branch']);
  var cTeam   = wr_col_(H, ['team', 'segment', 'source', 'desk']);
  var cTarget = wr_col_(H, ['target', 'monthly target', 'target amount']);
  var cMonth  = (typeof wr_monthCol_ === 'function') ? wr_monthCol_(grid) : -1;
  if (cMonth < 0) cMonth = wr_col_(H, ['month']);
  var cMM     = (typeof wr_manMonthCol_ === 'function') ? wr_manMonthCol_(grid, cAgent) : -1;

  if (cAgent < 0) { L('  *** mdl_Roster has no Agent column. Stopping.'); return; }

  /* The Month cell copied from a row that already works, never composed.
     wr_roster_ reads this column through wr_monthKey_; a date where the
     tab holds text, or text where it holds a date, and the agent is
     invisible - which is the bug this is fixing. */
  var monthVal = null;
  if (cMonth >= 0) {
    for (var r = 1; r < grid.length; r++) {
      var v = grid[r][cMonth];
      if (v !== '' && v != null && wr_monthKey_(v) === monthKey) { monthVal = v; break; }
    }
    if (monthVal === null) {
      L('  *** mdl_Roster has a Month column but no row in it for ' + monthKey + '.');
      L('      Refusing to guess the format. Run refreshAndVerify, then this again.');
      return;
    }
  }

  var width = mdlSh.getLastColumn();
  var rows = [];
  for (i = 0; i < add.length; i++) {
    var a = add[i], row = [];
    for (var c = 0; c < width; c++) row.push('');
    row[cAgent] = a.name;
    if (cMonth  >= 0) row[cMonth]  = monthVal;
    if (cMgr    >= 0) row[cMgr]    = a.manager;
    if (cCity   >= 0) row[cCity]   = a.city;
    if (cTeam   >= 0) row[cTeam]   = a.team;
    if (cTarget >= 0) row[cTarget] = a.target;
    /* Capacity: CBC's own ramp factor where it has one, otherwise a whole
       agent. Zero here would hide them from every per-head figure. */
    if (cMM     >= 0) row[cMM]     = a.mm > 0 ? a.mm : 1;
    rows.push(row);
  }

  mdlSh.getRange(mdlSh.getLastRow() + 1, 1, rows.length, width).setValues(rows);

  L('  ADDED ' + rows.length + ' row(s) to mdl_Roster, starting at row ' +
    (mdlSh.getLastRow() - rows.length + 1) + '.');
  L('  Nothing existing was changed. CBC and the Payment Tracker were not touched.');
  L('');
  L('  NOW RUN updateAndCheck. Those payments are on the roster, so they');
  L('  count, and the report and the TV both move by about ' + rtu_money_(releasing) + '.');
}


/* =====================================================================
   CBC's roster for this month
   ===================================================================== */

function rtu_src_(ss, monthKey) {
  var tabs = ss.getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], nm = sh.getName();
    if (!/^src_Roster/i.test(nm)) continue;

    /* src_Roster_Oct feeds 2026-10. A tab for another month is skipped,
       but a tab with no month in its name is allowed through - some are
       just called src_Roster. */
    var suffix = nm.replace(/^src_Roster[_\s-]*/i, '').trim();
    var tabMonth = wr_monthKey_(suffix + ' ' + monthKey.substring(0, 4));
    if (tabMonth && tabMonth !== monthKey) continue;

    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3) continue;
    var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();

    /* The header is not row 1. CBC puts a title, a month and sometimes an
       AIGF Upgrade/Catalyst total above it. */
    for (var hr = 0; hr < grid.length && hr < 25; hr++) {
      var H = wr_headers_(grid[hr]);
      var cAgent = wr_col_(H, ['agent', 'agent name']);
      if (cAgent < 0) continue;
      var cMgr    = wr_col_(H, ['manager', 'reporting manager', 'tl']);
      var cCity   = wr_col_(H, ['office', 'city', 'location', 'branch', 'city/region', 'region']);
      var cTeam   = wr_col_(H, ['team', 'segment', 'source', 'desk']);
      var cTarget = wr_col_(H, ['target', 'monthly target', 'target amount']);
      var cMM     = (typeof wr_manMonthCol_ === 'function')
                      ? wr_manMonthCol_(grid.slice(hr), cAgent) : -1;

      var agents = [], byKey = {};
      for (var r = hr + 1; r < grid.length; r++) {
        var name = wr_str_(grid[r][cAgent]);
        if (!name) continue;
        var mgr  = cMgr  >= 0 ? wr_str_(grid[r][cMgr])  : '';
        var cty  = cCity >= 0 ? wr_str_(grid[r][cCity]) : '';
        if (wr_isSummaryRow_(name, mgr, cty)) continue;
        if (/^[0-9.,%\s-]+$/.test(name)) continue;

        var key = wr_key_(name);
        if (byKey[key]) continue;
        var a = {
          name:    name,
          manager: mgr,
          city:    rtu_city_(cty),
          team:    cTeam   >= 0 ? wr_str_(grid[r][cTeam]) : '',
          target:  cTarget >= 0 ? wr_num_(grid[r][cTarget]) : 0,
          mm:      cMM     >= 0 ? wr_num_(grid[r][cMM])     : 1
        };
        byKey[key] = a;
        agents.push(a);
      }
      if (agents.length) return { name: nm, agents: agents, byKey: byKey };
    }
  }
  return null;
}


/* CBC writes "India Team-Bangalore" where the report says "Bangalore".
   Take what is after the last dash, then hand it to the board's own
   normaliser so it lands in the same bucket as every other row. */
function rtu_city_(s) {
  var t = String(s == null ? '' : s).trim();
  var dash = t.lastIndexOf('-');
  if (dash > -1 && dash < t.length - 1) t = t.substring(dash + 1).trim();
  return (typeof wr_city_ === 'function') ? wr_city_(t) : t;
}


/* =====================================================================
   What mdl_Payments already holds, by agent, for this month
   ===================================================================== */

function rtu_payTally_(ss, monthKey) {
  var out = {};
  var sh = ss.getSheetByName('mdl_Payments');
  if (!sh || sh.getLastRow() < 2) return out;

  var lastCol = sh.getLastColumn();
  var H = wr_headers_(sh.getRange(1, 1, 1, lastCol).getValues()[0]);
  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr']);
  var cStat  = wr_col_(H, ['status']);
  if (cDate < 0 || cAgent < 0 || cAmt < 0) return out;

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  for (var r = 0; r < rows.length; r++) {
    var d = rows[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKey_(d) !== monthKey) continue;
    var nm = wr_str_(rows[r][cAgent]);
    if (!nm || wr_isSummary_(nm)) continue;
    if (cStat >= 0 &&
        String(rows[r][cStat] || '').toLowerCase().indexOf('cancel') > -1) continue;
    var k = wr_key_(nm);
    if (!out[k]) out[k] = { name: nm, rev: 0 };
    out[k].rev += wr_num_(rows[r][cAmt]);
  }
  return out;
}


function rtu_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

function rtu_money_(n) {
  if (typeof wr_money_ === 'function') return wr_money_(n);
  return String(Math.round(n || 0));
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
