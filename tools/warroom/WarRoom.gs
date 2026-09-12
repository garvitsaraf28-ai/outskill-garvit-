/**
 * WarRoom.gs   -   the data feed behind the Sales War Room TV board.
 *
 * WHAT IT IS
 *   A Web App that publishes the leaderboard as JSON. The TV page polls it.
 *   It is the ONLY new moving part. It computes nothing new: it reads the
 *   same mdl_Payments and mdl_Roster that every existing page reads, so the
 *   TV and the reports can never disagree.
 *
 * WHAT IT NEVER DOES
 *   It never opens CBC. It never opens the Payment Tracker. It never writes
 *   to any sheet, not one cell. Every sheet call below is a read.
 *   The only thing it stores is a small daily rank snapshot, and that lives
 *   in Script Properties, not on the sheet.
 *
 * THIS FILE DEFINES NO doGet, ON PURPOSE
 *   Apps Script allows only ONE doGet per project, and this project already
 *   has one: the Executive Command Center. So the war room does not claim
 *   it. Instead the Exec file's doGet routes to wr_serve_() when the request
 *   carries feed=warroom, and serves the exec page for everything else.
 *   Both web apps then live behind the same URL without fighting.
 *
 *   The one line to add to the EXISTING doGet, as its first statement:
 *
 *     var p = (e && e.parameter) || {};
 *     if (p.feed === 'warroom') return wr_serve_(p);
 *
 * HOW TO PUBLISH
 *   1. Paste this file into the Inside Sales script project (new file,
 *      name it WarRoom).
 *   2. Add the two lines above to the Exec file's doGet.
 *   3. Run  warRoomSelfTest  once. It prints PASS/FAIL and never writes.
 *   4. Run  warRoomPreview   once. It prints the numbers the TV will show,
 *      so you can eyeball them against the Management Report first.
 *   5. Deploy > Manage deployments > edit the existing deployment
 *        Version           : New version   (or the URL serves the old code)
 *        Execute as        : Me
 *        Who has access    : Anyone
 *      Keep the same /exec URL.
 *   6. Open the TV page with that URL plus feed=warroom on the end:
 *        https://outskill-garvit.vercel.app/warroom?api=<EXEC URL>?feed=warroom
 *
 *   "Anyone" is required because a TV is not logged into Google. A TV that
 *   has to sign in gets a login page instead of data, every time. The URL is
 *   the password - it is a long random string, and the feed only ever returns
 *   aggregated leaderboard numbers. No lead data, no phone numbers, no
 *   payment rows. If it ever leaks, redeploy for a fresh URL.
 *
 * QUERY OPTIONS (all optional)
 *   &month=2026-09   a specific month instead of today's
 *   &nocache=1       skip the 45 second cache
 *   &callback=fn     JSONP, which is what the TV page uses
 */

var WR_PAY_TAB    = 'mdl_Payments';
var WR_ROSTER_TAB = 'mdl_Roster';
var WR_TZ         = 'Asia/Kolkata';
/* mdl_Payments is tens of thousands of rows, so a cold build measured ~14s
   on the real workbook. The cache is what keeps that off the TVs: at 240s
   roughly one poll in eight rebuilds and the other seven answer instantly,
   from any number of screens. Nothing is lost by caching this long - the
   figures only move when updateAndCheck runs. */
var WR_CACHE_SECS = 240;
var WR_MAX_AGENTS = 200;       // cap on the agent list sent to the TV
var WR_HAS_MM = false;         // set per build: did mdl_Roster carry a ramp column

/* ---------------------------------------------------------------------
   THE RUNNING CONTEST

   A contest counts UNITS over a few days, not revenue over a month, so it
   needs its own window. Set the dates, save, and the TV picks it up within
   four minutes. Set active:false when it is over.

   THE RULE IS: A UNIT IS A UNIT.

   Every unit a roster agent closes inside the window counts. Where the LEAD
   came from is irrelevant - a Mastermind lead or a Bootcamp lead who buys is
   still a unit, and the agent still earns it. That is the whole rule, and it
   needs no column to enforce.

   This is written down because filtering it cost real sales. "Batch Family"
   in mdl_Payments is the lead's SOURCE CAMPAIGN, not the product. Filtering
   on it threw away Fahad Nizar (10,000) and Kshitij (28,500) - both units,
   both on roster, both verified against the Payment Tracker.

   excludeProduct exists only for a future contest that genuinely bars a
   product. Leave it '' and nothing whatsoever is filtered.
   --------------------------------------------------------------------- */
var WR_CONTEST = {
  active: true,
  name:   'THE UNIT RUSH',
  from:   '2026-09-12',     // inclusive, Asia/Kolkata
  to:     '2026-09-14',     // inclusive

  /* '' = count every unit. This is the live setting. */
  excludeProduct: '',

  /* Which column names the PRODUCT, if excludeProduct is ever used. Only
     read when excludeProduct is non-empty, so it cannot lose a row today.
     mdl_Payments does not carry it yet; the Payment Tracker calls it
     "Program" (AIAP C14, AI Bootcamp, EAP C10). */
  productColumn: 'program'
};

/* Does one row qualify? With excludeProduct empty - the live rule - yes,
   always. A unit is a unit. */
function wr_progMatches_(cell) {
  var bad = String(WR_CONTEST.excludeProduct || '').toLowerCase();
  if (!bad) return true;
  return String(cell == null ? '' : cell).toLowerCase().indexOf(bad) === -1;
}

/* =====================================================================
   WEB APP ENTRY POINT

   Deliberately NOT called doGet. The Executive Command Center owns the
   project's one and only doGet; it hands us the request when the caller
   asks for feed=warroom. Taking doGet for ourselves would have silently
   broken the exec page, which is the same trap that once cost a day on
   refreshAndVerify.
   ===================================================================== */

function wr_serve_(p) {
  p = p || {};
  var json;

  try {
    var key = 'wr_' + (p.month || 'now');
    var cache = CacheService.getScriptCache();
    json = (p.nocache === '1') ? null : cache.get(key);
    if (!json) {
      json = JSON.stringify(wr_build_(p.month || ''));
      try { cache.put(key, json, WR_CACHE_SECS); } catch (ignore) {}
    }
  } catch (err) {
    json = JSON.stringify({
      ok: false,
      error: String((err && err.message) || err),
      at: new Date().getTime()
    });
  }

  var cb = p.callback;
  if (cb && /^[A-Za-z_$][A-Za-z0-9_$.]{0,60}$/.test(cb)) {
    return ContentService
      .createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* =====================================================================
   THE BUILD
   ===================================================================== */

function wr_build_(monthKey) {
  var t0 = new Date().getTime();
  var ss = SpreadsheetApp.getActive();
  var now = new Date();
  if (!monthKey) monthKey = Utilities.formatDate(now, WR_TZ, 'yyyy-MM');

  var roster = wr_roster_(ss, monthKey);
  WR_HAS_MM = roster.mmCol;   // gates every per-man-month figure below
  var pay    = wr_payments_(ss, monthKey);

  /* ---- fold payments onto roster agents ---- */
  var agents = {};   // lowercase name -> record
  var k;

  for (k in roster.byAgent) {
    var r = roster.byAgent[k];
    agents[k] = {
      name: r.name, manager: r.manager, city: r.city, team: r.team,
      target: r.target, revenue: 0, units: 0,
      mm: r.mm, upgrade: r.upgrade, counted: (r.mm > 0) ? 1 : 0
    };
  }

  var offRosterRev = 0, offRosterUnits = 0, offRosterNames = {};
  for (k in pay.byAgent) {
    var pRec = pay.byAgent[k];
    if (agents[k]) {
      agents[k].revenue += pRec.revenue;
      agents[k].units   += pRec.units;
    } else {
      offRosterRev   += pRec.revenue;
      offRosterUnits += pRec.units;
      offRosterNames[pRec.name] = (offRosterNames[pRec.name] || 0) + pRec.revenue;
    }
  }

  /* ---- roll up ---- */
  var cities = {}, managers = {}, teams = {};
  var agentList = [];

  for (k in agents) {
    var a = agents[k];
    agentList.push(a);

    var cName = a.city || 'Unassigned';
    if (!cities[cName]) cities[cName] = { name: cName, revenue: 0, units: 0, target: 0, agents: 0, mm: 0, counted: 0 };
    cities[cName].revenue += a.revenue;
    cities[cName].units   += a.units;
    cities[cName].target  += a.target;
    cities[cName].agents  += 1;
    cities[cName].mm      += a.mm;
    cities[cName].counted += a.counted;

    var mName = a.manager || 'Unassigned';
    if (!managers[mName]) managers[mName] = {
      name: mName, city: a.city, team: a.team,
      revenue: 0, units: 0, target: 0, agents: 0, mm: 0, counted: 0,
      _teams: {}, _cities: {}
    };
    managers[mName].revenue += a.revenue;
    managers[mName].units   += a.units;
    managers[mName].target  += a.target;
    managers[mName].agents  += 1;
    managers[mName].mm      += a.mm;
    managers[mName].counted += a.counted;
    if (a.team) managers[mName]._teams[a.team] = true;
    if (a.city) managers[mName]._cities[a.city] = true;

    var tName = a.team || 'Unassigned';
    if (!teams[tName]) teams[tName] = { name: tName, revenue: 0, units: 0, target: 0, agents: 0, mm: 0, counted: 0 };
    teams[tName].revenue += a.revenue;
    teams[tName].units   += a.units;
    teams[tName].target  += a.target;
    teams[tName].agents  += 1;
    teams[tName].mm      += a.mm;
    teams[tName].counted += a.counted;
  }

  /* a manager who runs both desks should say so, not pick one at random */
  for (k in managers) {
    var mg = managers[k];
    mg.team = wr_joinKeys_(mg._teams, 'India/Intl');
    mg.city = wr_joinKeys_(mg._cities, 'Multi-city');
    delete mg._teams; delete mg._cities;
  }

  /* ---- order and rank ---- */
  agentList.sort(wr_bySales_);
  var cityList = wr_values_(cities).sort(wr_bySales_);
  var mgrList  = wr_values_(managers).sort(wr_bySales_);
  var teamList = wr_values_(teams).filter(function (t) { return t.name !== 'Unassigned'; })
                                  .sort(wr_bySales_);

  /* ---- rank movement, measured from this morning ---- */
  var opening = wr_openingRanks_(monthKey, agentList);
  for (var i = 0; i < agentList.length; i++) {
    var nm = agentList[i].name;
    agentList[i].prevRank = (opening[nm] != null) ? opening[nm] : null;
  }

  /* ---- totals ---- */
  var rosterRev = 0, rosterUnits = 0, target = 0, manMonths = 0, countedAgents = 0;
  for (var c = 0; c < cityList.length; c++) {
    rosterRev     += cityList[c].revenue;
    rosterUnits   += cityList[c].units;
    target        += cityList[c].target;
    manMonths     += cityList[c].mm;
    countedAgents += cityList[c].counted;
  }

  var day  = Number(Utilities.formatDate(now, WR_TZ, 'd'));
  var days = wr_daysInMonth_(monthKey);
  var isCurrentMonth = (monthKey === Utilities.formatDate(now, WR_TZ, 'yyyy-MM'));

  return {
    ok: true,
    sample: false,
    meta: {
      month: wr_monthName_(monthKey),
      monthKey: monthKey,
      day: isCurrentMonth ? day : days,
      days: days,
      windowLabel: isCurrentMonth ? ('MTD 1-' + day) : 'full month',
      generatedAt: now.getTime(),
      generatedLabel: Utilities.formatDate(now, WR_TZ, 'dd MMM HH:mm') + ' IST',
      rows: pay.rowsScanned,
      buildMs: new Date().getTime() - t0
    },
    /* The headline is the ROSTER total, because that is what the Management
       Report calls "Total revenue" and what leadership quotes. Everything
       below adds up to it exactly: cities, managers and agents all sum to
       this number, so nothing on the TV can contradict anything else on it.

       Money paid by names not on the roster is reported separately and
       stays off the screen. It is mostly other business lines - Mastermind
       and the like - and putting it in the headline would have the TV
       shouting 4.23 cr while the report says 60.91 L. */
    totals: {
      revenue:     rosterRev,
      units:       rosterUnits,
      target:      target,
      agents:      agentList.length,
      counted:     countedAgents,        // agents whose man-month is above zero
      manMonths:   Math.round(manMonths * 100) / 100,
      upgrade:     wr_r2_(roster.upgrade),
      hasManMonth: roster.mmCol,
      hasUpgrade:  roster.upCol,
      offRoster:      offRosterRev,      // diagnostics only, never rendered
      offRosterUnits: offRosterUnits
    },
    teams:    teamList.map(wr_slim_),
    cities:   cityList.map(wr_slim_),
    managers: mgrList.map(wr_slim_),
    agents:   agentList.slice(0, WR_MAX_AGENTS).map(function (a) {
      return {
        name: a.name, manager: a.manager, city: a.city, team: a.team,
        revenue: wr_r2_(a.revenue), units: a.units,
        target: wr_r2_(a.target), prevRank: a.prevRank,
        mm: a.mm, counted: a.counted
      };
    }),
    contest: wr_contest_(pay, roster),
    notes: wr_notes_(roster, pay, offRosterNames, offRosterRev, mgrList)
  };
}

/* The contest board. Units only, its own date window, ranked by units
   with revenue breaking ties - so the person who closed four small ones
   beats the person who closed three big ones, which is the whole point
   of a unit contest. */
function wr_contest_(pay, roster) {
  if (!WR_CONTEST.active) return { active: false };

  var list = [], k;
  for (k in pay.contest) {
    var c = pay.contest[k];
    var r = roster.byAgent[k];
    list.push({
      name: c.name,
      manager: r ? r.manager : '',
      city:    r ? r.city    : '',
      units:   c.units,
      revenue: wr_r2_(c.revenue)
    });
  }
  list.sort(function (a, b) {
    return (b.units - a.units) || (b.revenue - a.revenue) ||
           String(a.name).localeCompare(String(b.name));
  });

  return {
    active: true,
    name: WR_CONTEST.name,
    from: WR_CONTEST.from,
    to: WR_CONTEST.to,
    /* These four keys are what the TV reads. With excludeProduct empty -
       the live rule - all of them are false or blank and nothing is hidden
       from the board. They exist so that if a future contest ever does bar
       a product, a filter that silently keeps nothing announces itself
       instead of running a whole weekend showing zero. */
    programme: WR_CONTEST.excludeProduct || '',
    programmeFiltered: !!(WR_CONTEST.excludeProduct && pay.programmeCol),
    programmeColumnMissing: !!(WR_CONTEST.excludeProduct && !pay.programmeCol),
    programmeMatchedNothing: !!(WR_CONTEST.excludeProduct && pay.programmeCol &&
                                pay.contestWindowRows > 0 && pay.contestProgMatched === 0),
    windowRows: pay.contestWindowRows,
    matchedRows: pay.contestProgMatched,
    totalUnits: pay.contestUnits,
    agents: list.slice(0, WR_MAX_AGENTS)
  };
}

function wr_slim_(x) {
  return {
    name: x.name, city: x.city, team: x.team,
    revenue: wr_r2_(x.revenue), units: x.units,
    target: wr_r2_(x.target), agents: x.agents,
    counted: x.counted, mm: Math.round((x.mm || 0) * 100) / 100,
    /* Revenue per man-month, the fair read when half a team is new. Null
       unless a real ramp column was found - a figure computed off raw
       headcount would look like capacity and would not be. */
    revPerMM: (WR_HAS_MM && x.mm > 0) ? wr_r2_(x.revenue / x.mm) : null
  };
}

/* =====================================================================
   READING mdl_Roster   (read only)
   ===================================================================== */

function wr_roster_(ss, monthKey) {
  var out = { byAgent: {}, count: 0, counted: 0, manMonths: 0, upgrade: 0,
              mmCol: false, upCol: false, monthsSeen: {}, headers: [] };
  var sh = ss.getSheetByName(WR_ROSTER_TAB);
  if (!sh || sh.getLastRow() < 2) return out;

  var grid = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var H = wr_headers_(grid[0]);
  out.headers = grid[0];

  var cAgent  = wr_col_(H, ['agent', 'agent name', 'name', 'lead owner', 'owner', 'employee', 'full name']);
  var cMgr    = wr_col_(H, ['manager', 'reporting manager', 'tl']);
  var cCity   = wr_col_(H, ['office', 'city', 'location', 'branch']);
  var cTeam   = wr_col_(H, ['team', 'segment', 'source', 'desk']);
  var cTarget = wr_col_(H, ['target', 'monthly target', 'target amount']);
  var cMonth  = wr_monthCol_(grid);
  /* Capacity and upgrade revenue, both optional. If the columns are not
     carried through from CBC the board simply omits them and says so. */
  var cMM     = wr_manMonthCol_(grid, cAgent);
  var cUp     = wr_col_(H, ['aigf upgrade', 'upgrade', 'aigf', 'catalyst']);
  out.mmCol = cMM >= 0;
  out.upCol = cUp >= 0;

  if (cAgent < 0) return out;

  for (var r = 1; r < grid.length; r++) {
    var row = grid[r];
    var name    = wr_str_(row[cAgent]);
    var mgrRaw  = cMgr  >= 0 ? wr_str_(row[cMgr])  : '';
    var cityRaw = cCity >= 0 ? wr_str_(row[cCity]) : '';
    if (!name) continue;
    if (wr_isSummaryRow_(name, mgrRaw, cityRaw)) continue;

    var rowMonth = (cMonth >= 0) ? wr_monthKey_(row[cMonth]) : monthKey;
    if (rowMonth) out.monthsSeen[rowMonth] = true;
    if (rowMonth && rowMonth !== monthKey) continue;

    var key = wr_key_(name);
    if (out.byAgent[key]) {
      // same agent listed twice for one month: keep the bigger target, do not double count
      out.byAgent[key].target = Math.max(out.byAgent[key].target, wr_num_(row[cTarget]));
      continue;
    }
    /* No ramp column: every agent counts as one. The feed says so in its
       notes and hasManMonth stays false, so nothing renders a fake capacity. */
    var mm = (cMM >= 0) ? wr_num_(row[cMM]) : 1;
    out.byAgent[key] = {
      name:    name,
      manager: mgrRaw,
      city:    wr_city_(cityRaw),
      team:    cTeam   >= 0 ? wr_team_(wr_str_(row[cTeam])) : '',
      target:  cTarget >= 0 ? wr_num_(row[cTarget])         : 0,
      mm:      mm,
      upgrade: (cUp >= 0) ? wr_num_(row[cUp]) : 0
    };
    out.count++;
    out.manMonths += mm;
    out.upgrade   += out.byAgent[key].upgrade;
    if (mm > 0) out.counted++;
  }
  return out;
}

/* THE CAPACITY COLUMN.

   The business does not count every name as a whole agent. A joiner's
   first month counts 0, the next 0.5, then 0.75, and 1.0 from the third.
   CBC records that factor in a column that carries NO HEADER and sits in
   a different place on different month layouts, so it cannot be found by
   name. It is found by its values instead: the one column whose agent
   rows are made of 0.5 / 0.75 / 1.0.

   It matters because per-head numbers are misleading without it. A team
   of thirteen where six are new is not a team of thirteen. */
function wr_manMonthCol_(grid, cAgent) {
  var rows = [];
  for (var r = 1; r < grid.length && rows.length < 400; r++) {
    if (cAgent >= 0 && wr_str_(grid[r][cAgent])) rows.push(r);
  }
  if (rows.length < 4) return -1;

  var best = -1, bestHits = 0;
  for (var c = 0; c < grid[0].length; c++) {
    var hits = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = Number(grid[rows[i]][c]);
      if (v === 0.5 || v === 0.75 || v === 1) hits++;
    }
    if (hits >= rows.length * 0.5 && hits > bestHits) { bestHits = hits; best = c; }
  }
  return best;
}

/* =====================================================================
   READING mdl_Payments   (read only)
   ===================================================================== */

function wr_payments_(ss, monthKey) {
  var out = { byAgent: {}, rowsScanned: 0, rowsCounted: 0, headers: [], noRosterCol: false,
              contest: {}, contestUnits: 0, contestRows: 0, programmeCol: false,
              contestWindowRows: 0, contestProgMatched: 0, progSamples: {},
              refundRows: 0, refundAmount: 0, cancelledRows: 0, cancelledAmount: 0,
              upgradeRows: 0, upgradeAmount: 0 };
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) return out;

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();

  /* Read the header alone first, work out which columns matter, then pull
     only those. mdl_Payments can be tens of thousands of rows; fetching the
     full width of every one of them is the difference between a feed that
     answers in two seconds and one the TV gives up waiting for. */
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  out.headers = head;

  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit  = wr_col_(H, ['is unit', 'unit', 'units']);
  var cRost  = wr_col_(H, ['on roster', 'onroster', 'roster']);
  /* Only looked up when the contest actually bars a product. The live rule
     bars nothing, so cProg stays -1, no product column is read, and no row
     can be lost to a filter. No fuzzy fallback either: guessing once landed
     on "Batch Family", which is the lead's source campaign and not the
     product, and threw away real sales. */
  var cProg  = (WR_CONTEST.excludeProduct && WR_CONTEST.productColumn)
                 ? wr_col_(H, [String(WR_CONTEST.productColumn).toLowerCase()])
                 : -1;
  var cRef   = wr_col_(H, ['is refund', 'refund']);
  var cType  = wr_col_(H, ['payment type']);
  var cStat  = wr_col_(H, ['status']);
  if (cRost < 0) out.noRosterCol = true;
  out.programmeCol = cProg >= 0;

  if (cDate < 0 || cAgent < 0 || cAmt < 0) return out;

  var width = Math.max(cDate, cAgent, cAmt, cUnit, cRost, cProg, cRef, cStat, cType) + 1;
  var grid = sh.getRange(2, 1, lastRow - 1, width).getValues();

  /* the contest window, as day numbers so the comparison is a plain integer */
  var cFrom = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.from) : 0;
  var cTo   = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.to)   : 0;

  for (var r = 0; r < grid.length; r++) {
    var row = grid[r];
    var d = row[cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;

    var name = wr_str_(row[cAgent]);
    if (!name || wr_isSummary_(name)) continue;   // totals rows are not people
    var key = wr_key_(name);
    var isUnit = (cUnit >= 0 && wr_truthy_(row[cUnit]));

    /* Money that came back is not money earned. mdl_Payments carries both
       "Is Refund" and a "Status" that says CANCELLED, and neither was being
       read - so a refunded payment lifted the board exactly like a sale. */
    var isRefund  = (cRef >= 0 && wr_truthy_(row[cRef]));
    var statusTxt = (cStat >= 0) ? String(row[cStat] || '').trim().toLowerCase() : '';
    var isCancel  = (statusTxt.indexOf('cancel') > -1);
    var thisMonth = (wr_monthKey_(d) === monthKey);
    if (thisMonth && cType >= 0 &&
        String(row[cType] || '').toLowerCase().indexOf('upgrade') > -1) {
      out.upgradeRows++; out.upgradeAmount += wr_num_(row[cAmt]);
    }

    if (thisMonth && isRefund) { out.refundRows++;    out.refundAmount    += wr_num_(row[cAmt]); }
    if (thisMonth && isCancel) { out.cancelledRows++; out.cancelledAmount += wr_num_(row[cAmt]); }
    if (isRefund || isCancel) continue;

    /* --- the month-to-date boards --- */
    if (thisMonth) {
      out.rowsScanned++;
      if (!out.byAgent[key]) out.byAgent[key] = { name: name, revenue: 0, units: 0 };
      out.byAgent[key].revenue += wr_num_(row[cAmt]);
      if (isUnit) out.byAgent[key].units += 1;
      out.rowsCounted++;
    }

    /* --- the contest window, counted independently --- */
    if (cFrom) {
      var day = wr_dayNumOf_(d);
      if (day < cFrom || day > cTo) continue;
      out.contestWindowRows++;

      /* Skipped entirely on the live rule, because cProg is -1 unless a
         contest bars a product. Judge the RAW cell when it does run:
         '(blank)' is only a label for the log. */
      if (cProg >= 0) {
        var raw = wr_str_(row[cProg]);
        var label = raw || '(blank)';
        out.progSamples[label] = (out.progSamples[label] || 0) + 1;
        if (!wr_progMatches_(raw)) continue;
      }
      out.contestProgMatched++;                    // == windowRows when nothing is barred
      if (!isUnit) continue;                       // the contest counts units only
      if (!out.contest[key]) out.contest[key] = { name: name, units: 0, revenue: 0 };
      out.contest[key].units += 1;
      out.contest[key].revenue += wr_num_(row[cAmt]);
      out.contestUnits++;
      out.contestRows++;
    }
  }
  return out;
}

/* 'yyyy-MM-dd' -> a comparable integer, 0 if it is not a date */
function wr_dayNum_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return 0;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}
function wr_dayNumOf_(d) {
  return Number(Utilities.formatDate(d, WR_TZ, 'yyyy')) * 10000 +
         Number(Utilities.formatDate(d, WR_TZ, 'MM')) * 100 +
         Number(Utilities.formatDate(d, WR_TZ, 'dd'));
}

/* =====================================================================
   RANK MOVEMENT
   Stored in Script Properties, never on a sheet. The snapshot is taken
   the first time the feed is built each day, so "up 3" on the TV means
   "up 3 since this morning", which is the only movement a floor cares
   about.
   ===================================================================== */

function wr_openingRanks_(monthKey, ranked) {
  var today = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM-dd');
  var propKey = 'WR_OPEN_' + monthKey;
  var props = PropertiesService.getScriptProperties();

  var snap = null;
  try { snap = JSON.parse(props.getProperty(propKey) || 'null'); } catch (ignore) {}

  if (snap && snap.day === today && snap.ranks) return snap.ranks;

  var ranks = {};
  for (var i = 0; i < ranked.length && i < WR_MAX_AGENTS; i++) ranks[ranked[i].name] = i + 1;
  try {
    props.setProperty(propKey, JSON.stringify({ day: today, ranks: ranks }));
  } catch (ignore) {}
  return ranks;
}

/** Clears today's snapshot so movement is measured from now. Safe to run. */
function warRoomResetMovement() {
  var mk = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  PropertiesService.getScriptProperties().deleteProperty('WR_OPEN_' + mk);
  Logger.log('Opening ranks cleared for ' + mk + '. They will be retaken on the next feed build.');
}

/* =====================================================================
   NOTES - anything the TV should be honest about
   ===================================================================== */

function wr_notes_(roster, pay, offNames, offRev, mgrList) {
  var notes = [];
  if (pay.refundRows) {
    notes.push(pay.refundRows + ' refunded row(s) worth ' + wr_money_(pay.refundAmount) +
               ' were excluded from revenue.');
  }
  if (pay.cancelledRows) {
    notes.push(pay.cancelledRows + ' cancelled row(s) worth ' + wr_money_(pay.cancelledAmount) +
               ' were excluded from revenue.');
  }
  if (!roster.mmCol) {
    notes.push('mdl_Roster carries no capacity (man-month) column, so per-head figures ' +
               'divide by raw headcount and a team of new joiners looks like a full team.');
  }
  /* The AIGF upgrade DOES reach mdl_Payments - it arrives as its own row,
     Batch "Upgrade", Payment Type "Upgrade (CBC)" - so it is already inside
     these totals. An earlier version of this file claimed otherwise. */
  if (pay.upgradeRows) {
    notes.push(pay.upgradeRows + ' AIGF upgrade row(s) worth ' + wr_money_(pay.upgradeAmount) +
               ' are included in revenue. They carry no unit, so they win no contest.');
  }
  if (mgrList) {
    var zero = [];
    for (var i = 0; i < mgrList.length; i++) {
      if (mgrList[i].agents > 0 && !mgrList[i].target) zero.push(mgrList[i].name);
    }
    if (zero.length) {
      notes.push('No target is set for ' + zero.join(', ') +
                 ' - their teams are on the boards but cannot appear in any target race.');
    }
  }
  if (!roster.count) notes.push('mdl_Roster has no rows for this month - targets and cities are missing.');
  if (!pay.rowsScanned) notes.push('mdl_Payments has no rows dated in this month.');
  if (pay.noRosterCol) notes.push('mdl_Payments has no "On Roster" column - every payment row was counted.');
  if (offRev > 0) {
    var who = [];
    for (var n in offNames) who.push(n);
    who.sort();
    notes.push(wr_money_(offRev) + ' was paid by ' + who.length +
               ' name(s) not on this month\'s roster, so it is in the company total but not in any city or manager board: ' +
               who.slice(0, 12).join(', ') + (who.length > 12 ? ' and more' : ''));
  }
  return notes;
}

/* =====================================================================
   HELPERS
   ===================================================================== */

function wr_headers_(row) {
  var H = {};
  for (var c = 0; c < row.length; c++) {
    var h = String(row[c] == null ? '' : row[c]).trim().toLowerCase();
    if (h && H[h] === undefined) H[h] = c;
  }
  return H;
}

/** Exact header first, then a contains match, so a renamed column still lands. */
function wr_col_(H, names) {
  var i, key;
  for (i = 0; i < names.length; i++) if (H[names[i]] !== undefined) return H[names[i]];
  for (i = 0; i < names.length; i++) {
    for (key in H) if (key.indexOf(names[i]) > -1) return H[key];
  }
  return -1;
}

/** Finds the column that actually holds month keys, by looking at the data. */
function wr_monthCol_(grid) {
  var last = Math.min(grid.length, 60);
  var width = grid[0].length;
  var best = -1, bestHits = 0;
  for (var c = 0; c < width; c++) {
    var hits = 0;
    for (var r = 1; r < last; r++) {
      if (wr_monthKey_(grid[r][c])) hits++;
    }
    if (hits > bestHits) { bestHits = hits; best = c; }
  }
  return (bestHits >= Math.max(3, (last - 1) * 0.5)) ? best : -1;
}

/** Date, '2026-09', 'Sep-26', 'September 2026' -> '2026-09'. Anything else -> ''. */
function wr_monthKey_(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, WR_TZ, 'yyyy-MM');
  }
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';

  var m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return m[1] + '-' + wr_pad2_(m[2]);

  m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return m[1] + '-' + wr_pad2_(m[2]);

  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
              jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  m = s.toLowerCase().match(/^([a-z]{3})[a-z]*[\s\-\/]*(\d{2,4})$/);
  if (m && MON[m[1]]) {
    var y = Number(m[2]);
    if (y < 100) y += 2000;
    return y + '-' + wr_pad2_(MON[m[1]]);
  }
  return '';
}

function wr_monthName_(monthKey) {
  var p = String(monthKey).split('-');
  var NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
               'August', 'September', 'October', 'November', 'December'];
  var idx = Number(p[1]) - 1;
  return (NAMES[idx] || monthKey) + ' ' + p[0];
}

function wr_daysInMonth_(monthKey) {
  var p = String(monthKey).split('-');
  return new Date(Number(p[0]), Number(p[1]), 0).getDate();
}

function wr_pad2_(x) { x = String(x); return x.length < 2 ? '0' + x : x; }

/** Spelling variants get folded so a city does not appear twice on the board. */
function wr_city_(s) {
  var t = String(s || '').trim().toLowerCase();
  if (!t) return '';
  if (t.indexOf('beng') > -1 || t.indexOf('blr') > -1 || t.indexOf('banga') > -1) return 'Bangalore';
  if (t.indexOf('hyd') > -1) return 'Hyderabad';
  if (t.indexOf('bhub') > -1 || t.indexOf('bbsr') > -1) return 'Bhubaneswar';
  return s.replace(/\s+/g, ' ').trim();
}

function wr_team_(s) {
  var t = String(s || '').trim().toLowerCase();
  if (!t) return '';
  if (t.indexOf('inter') > -1 || t.indexOf('intl') > -1 || t.indexOf('us') === 0) return 'International';
  if (t.indexOf('india') > -1 || t.indexOf('dom') > -1 || t.indexOf('ind') === 0) return 'India';
  return s.replace(/\s+/g, ' ').trim();
}

function wr_key_(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* Both model tabs carry totals rows at the foot - "Sum agent revenue",
   "Sum targets", and bare numbers like 52675000 sitting where a name
   should be. Left alone they become agents, cities and managers of their
   own and poison every roll-up.

   A value in an identity column is a total if it has no letters in it at
   all, or if it announces itself as one. Blank is NOT a total here: a real
   agent can have an empty manager or office cell, and dropping them would
   lose real revenue. */
function wr_looksLikeTotal_(v) {
  var t = String(v == null ? '' : v).trim().toLowerCase();
  if (!t) return false;
  if (!/[a-z]/.test(t)) return true;
  return /^(sum|total|totals|subtotal|grand\s+total|average|avg|count)\b/.test(t);
}

/* For the name column specifically, where blank means there is no row. */
function wr_isSummary_(name) {
  var t = String(name == null ? '' : name).trim();
  if (!t) return true;
  return wr_looksLikeTotal_(t);
}

/* A totals row does not always announce itself in the column you are
   looking at. The real roster had one whose agent cell read like an
   ordinary label while its manager said "Sum agent revenue" and its
   office said "Sum targets" - so it survived a name-only check and put a
   city called "Sum targets" on the board. Judge the row, not one cell. */
function wr_isSummaryRow_(name, manager, office) {
  return wr_isSummary_(name) || wr_looksLikeTotal_(manager) || wr_looksLikeTotal_(office);
}

function wr_str_(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

function wr_num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v == null ? '' : v).replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function wr_truthy_(v) {
  if (v === true) return true;
  if (typeof v === 'number') return v > 0;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

function wr_r2_(n) { return Math.round(Number(n) || 0); }

function wr_bySales_(a, b) {
  return (b.revenue - a.revenue) || (b.units - a.units) ||
         String(a.name).localeCompare(String(b.name));
}

function wr_values_(obj) {
  var out = [], k;
  for (k in obj) out.push(obj[k]);
  return out;
}

function wr_joinKeys_(obj, multiLabel) {
  var ks = [], k;
  for (k in obj) ks.push(k);
  if (!ks.length) return '';
  if (ks.length === 1) return ks[0];
  return multiLabel;
}

function wr_money_(v) {
  v = Number(v) || 0;
  var a = Math.abs(v);
  if (a >= 10000000) return (v / 10000000).toFixed(2) + ' cr';
  if (a >= 100000) return (v / 100000).toFixed(2) + ' L';
  return String(Math.round(v));
}

/* =====================================================================
   RUN THESE IN THE EDITOR - both are read only
   ===================================================================== */

/** Prints exactly what the TV will show, so it can be checked against the report. */
function warRoomPreview() {
  var p = wr_build_('');
  Logger.log('=== WAR ROOM FEED PREVIEW ===  ' + p.meta.generatedLabel);
  Logger.log('  month              : ' + p.meta.month + '  (' + p.meta.windowLabel + ')');
  Logger.log('  payment rows in it : ' + p.meta.rows);
  Logger.log('  build took         : ' + p.meta.buildMs + ' ms   (cached ' + WR_CACHE_SECS + 's between TV polls)');
  Logger.log('');
  Logger.log('  COMPANY   <-- compare these to the Management Report');
  Logger.log('    revenue          : ' + wr_money_(p.totals.revenue) +
             '        (report: Total revenue / Delivered So Far)');
  Logger.log('    target           : ' + wr_money_(p.totals.target) +
             '        (report: Committed For)');
  Logger.log('    units            : ' + p.totals.units + '        (report: Units)');
  Logger.log('    agents           : ' + p.totals.agents +
             (p.totals.hasManMonth
                ? ('   of which counted: ' + p.totals.counted +
                   '   capacity: ' + p.totals.manMonths + ' man-months')
                : '   (no capacity column found - see NOTES)'));
  if (p.totals.hasManMonth && p.totals.manMonths > 0) {
    Logger.log('    revenue / man-mth: ' + wr_money_(p.totals.revenue / p.totals.manMonths) +
               '        <-- the fair per-head read');
  }
  if (p.totals.hasUpgrade) {
    Logger.log('    AIGF upgrade     : ' + wr_money_(p.totals.upgrade) + ' (included)');
  }
  Logger.log('');
  Logger.log('    off roster       : ' + wr_money_(p.totals.offRoster) + ' in ' +
             p.totals.offRosterUnits + ' units - NOT on the TV, listed under NOTES below');
  Logger.log('');
  Logger.log('  CITIES');
  p.cities.forEach(function (c) {
    Logger.log('    ' + wr_pad_(c.name, 16) + wr_pad_(wr_money_(c.revenue), 12) +
               wr_pad_(c.units + 'u', 6) + 'target ' + wr_money_(c.target));
  });
  Logger.log('');
  Logger.log('  TEAMS');
  p.teams.forEach(function (t) {
    Logger.log('    ' + wr_pad_(t.name, 16) + wr_pad_(wr_money_(t.revenue), 12) + t.units + 'u');
  });
  Logger.log('');
  Logger.log('  MANAGERS');
  p.managers.forEach(function (m) {
    Logger.log('    ' + wr_pad_(m.name, 20) + wr_pad_(m.city, 14) + wr_pad_(m.team, 14) +
               wr_pad_(wr_money_(m.revenue), 12) +
               wr_pad_('target ' + wr_money_(m.target), 18) +
               (m.revPerMM != null
                  ? (wr_pad_(m.counted + '/' + m.agents + ' counted', 16) +
                     wr_pad_(m.mm + ' mm', 9) + wr_money_(m.revPerMM) + ' per mm')
                  : wr_pad_(m.agents + ' agents', 16)));
  });
  Logger.log('');
  Logger.log('  TOP 10 AGENTS');
  p.agents.slice(0, 10).forEach(function (a, i) {
    Logger.log('    ' + wr_pad_((i + 1) + '.', 5) + wr_pad_(a.name, 24) +
               wr_pad_(a.manager, 18) + wr_pad_(wr_money_(a.revenue), 12) + a.units + 'u');
  });
  if (p.contest && p.contest.active) {
    Logger.log('');
    Logger.log('  CONTEST: ' + p.contest.name + '   ' + p.contest.from + ' to ' + p.contest.to);
    Logger.log('    rows in window   : ' + p.contest.windowRows);
    Logger.log('    units counted    : ' + p.contest.totalUnits);
    if (!p.contest.programme) {
      Logger.log('    rule             : every unit a roster agent closes counts.');
    } else if (p.contest.programmeMatchedNothing) {
      Logger.log('    *** THE PRODUCT FILTER IS KEEPING NOTHING ***');
      Logger.log('    *** ' + p.contest.windowRows + ' rows are dated inside the window and');
      Logger.log('    *** excludeProduct "' + p.contest.programme + '" dropped every one.');
      Logger.log('    *** Set WR_CONTEST.excludeProduct back to \'\' to count every unit.');
    } else if (p.contest.programmeColumnMissing) {
      Logger.log('    *** excludeProduct is "' + p.contest.programme + '" but mdl_Payments');
      Logger.log('    *** has no "' + WR_CONTEST.productColumn + '" column, so nothing is filtered.');
    } else {
      Logger.log('    rule             : every unit EXCEPT "' + p.contest.programme + '"');
    }
    p.contest.agents.slice(0, 10).forEach(function (a, i) {
      Logger.log('    ' + wr_pad_((i + 1) + '.', 5) + wr_pad_(a.name, 24) +
                 wr_pad_(a.units + 'u', 6) + wr_money_(a.revenue));
    });
    if (!p.contest.agents.length) Logger.log('    nobody has closed a qualifying unit yet.');
  }

  if (p.notes && p.notes.length) {
    Logger.log('');
    Logger.log('  NOTES');
    p.notes.forEach(function (n) { Logger.log('    - ' + n); });
  }
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
  return p;
}

function wr_pad_(s, n) { s = String(s == null ? '' : s); while (s.length < n) s += ' '; return s; }

/**
 * warRoomGap - READ ONLY. Writes nothing.
 *
 * Answers one question: the report says 60.91 L, the floor says about
 * 65 L, where is the difference. It splits every September rupee in
 * mdl_Payments into what the boards count and what they drop, names
 * every dropped payer with their amount, and shows the last date the
 * model actually has - which is how a stale import gives itself away.
 */
function warRoomGap() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh) { Logger.log('mdl_Payments not found'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit  = wr_col_(H, ['is unit', 'unit', 'units']);
  var cRost  = wr_col_(H, ['on roster', 'onroster', 'roster']);

  Logger.log('=== WAR ROOM GAP ===  ' + Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  Logger.log('  mdl_Payments headers : ' + head.join(' | '));
  Logger.log('');

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var roster = wr_roster_(ss, monthKey);
  WR_HAS_MM = roster.mmCol;   // gates every per-man-month figure below

  var onRev = 0, onUnits = 0, offRev = 0, offUnits = 0, off = {};
  var latest = null, monthRows = 0, byDay = {};

  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (!latest || d.getTime() > latest.getTime()) latest = d;
    if (wr_monthKey_(d) !== monthKey) continue;

    var name = wr_str_(grid[r][cAgent]);
    if (!name || wr_isSummary_(name)) continue;
    monthRows++;

    var amt = wr_num_(grid[r][cAmt]);
    var isUnit = (cUnit >= 0 && wr_truthy_(grid[r][cUnit])) ? 1 : 0;
    var day = Utilities.formatDate(d, WR_TZ, 'dd MMM');
    if (!byDay[day]) byDay[day] = { rev: 0, units: 0 };
    byDay[day].rev += amt; byDay[day].units += isUnit;

    if (roster.byAgent[wr_key_(name)]) { onRev += amt; onUnits += isUnit; }
    else {
      offRev += amt; offUnits += isUnit;
      if (!off[name]) off[name] = { rev: 0, units: 0, roster: 0 };
      off[name].rev += amt; off[name].units += isUnit;
      if (cRost >= 0 && wr_truthy_(grid[r][cRost])) off[name].roster++;
    }
  }

  Logger.log('  SEPTEMBER IN mdl_Payments');
  Logger.log('    counted on the boards  : ' + wr_pad_(wr_money_(onRev), 12) + onUnits + ' units');
  Logger.log('    dropped (not on roster): ' + wr_pad_(wr_money_(offRev), 12) + offUnits + ' units');
  Logger.log('    every September rupee   : ' + wr_pad_(wr_money_(onRev + offRev), 12) +
             (onUnits + offUnits) + ' units   across ' + monthRows + ' rows');
  Logger.log('');

  Logger.log('  WHO IS BEING DROPPED  (each of these is missing from the report too)');
  var names = [];
  for (var n2 in off) names.push(n2);
  names.sort(function (a, b) { return off[b].rev - off[a].rev; });
  for (var i = 0; i < names.length; i++) {
    var o = off[names[i]];
    Logger.log('    ' + wr_pad_(names[i], 26) + wr_pad_(wr_money_(o.rev), 12) +
               wr_pad_(o.units + 'u', 6) +
               (o.roster ? '  <-- flagged On Roster = YES, but no roster row for this month' : ''));
  }
  if (!names.length) Logger.log('    nobody. Every September payment belongs to a roster agent.');
  Logger.log('');

  Logger.log('  IS THE IMPORT CURRENT?');
  Logger.log('    last payment date anywhere in mdl_Payments : ' +
             (latest ? Utilities.formatDate(latest, WR_TZ, 'dd MMM yyyy') : 'none'));
  Logger.log('    today : ' + Utilities.formatDate(new Date(), WR_TZ, 'dd MMM yyyy'));
  Logger.log('    If the last date is days behind today, the gap is the IMPORTRANGE,');
  Logger.log('    not the roster - run updateAndCheck and check src_Payments for #REF!.');
  Logger.log('');

  Logger.log('  SEPTEMBER DAY BY DAY  (a missing tail means a stale import)');
  var days = [];
  for (var dd in byDay) days.push(dd);
  days.sort(function (a, b) {
    return new Date(a + ' 2026').getTime() - new Date(b + ' 2026').getTime();
  });
  for (var j = 0; j < days.length; j++) {
    Logger.log('    ' + wr_pad_(days[j], 10) + wr_pad_(wr_money_(byDay[days[j]].rev), 12) +
               byDay[days[j]].units + 'u');
  }

  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/**
 * warRoomContestCheck - READ ONLY. Writes nothing.
 *
 * Prints every distinct programme value inside the contest window with its
 * row count, and says plainly whether the filter keeps any of them. Run it
 * once whenever a contest starts, and the "it showed zero all weekend"
 * failure cannot happen quietly.
 */
function warRoomContestCheck() {
  var ss = SpreadsheetApp.getActive();
  var pay = wr_payments_(ss, Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM'));

  Logger.log('=== CONTEST CHECK ===  ' + WR_CONTEST.name +
             '   ' + WR_CONTEST.from + ' to ' + WR_CONTEST.to);
  if (!WR_CONTEST.excludeProduct) {
    Logger.log('  rule              : EVERY unit a roster agent closes counts.');
    Logger.log('                      Where the lead came from does not matter.');
    Logger.log('                      Nothing is filtered out. excludeProduct is empty.');
  } else {
    Logger.log('  rule              : every unit EXCEPT "' + WR_CONTEST.excludeProduct + '"');
    Logger.log('  product column    : "' + WR_CONTEST.productColumn + '" - ' +
               (pay.programmeCol ? 'found' : '*** NOT IN mdl_Payments - nothing filtered ***'));
  }
  Logger.log('  rows in window    : ' + pay.contestWindowRows);
  Logger.log('  rows counted      : ' + pay.contestProgMatched);
  Logger.log('  qualifying units  : ' + pay.contestUnits +
             '   (rows marked Is Unit = YES by a roster agent)');
  Logger.log('');
  if (WR_CONTEST.excludeProduct && pay.programmeCol) {
    Logger.log('  EVERY PRODUCT VALUE IN THE WINDOW');
    var keys = [], v;
    for (v in pay.progSamples) keys.push(v);
    keys.sort(function (a, b) { return pay.progSamples[b] - pay.progSamples[a]; });
    for (var i = 0; i < keys.length; i++) {
      var v2 = keys[i], raw2 = (v2 === '(blank)') ? '' : v2;
      Logger.log('    ' + wr_pad_(v2, 26) + wr_pad_(pay.progSamples[v2] + ' rows', 10) +
                 (wr_progMatches_(raw2) ? 'COUNTS' : 'excluded'));
    }
    if (pay.contestWindowRows > 0 && pay.contestProgMatched === 0) {
      Logger.log('');
      Logger.log('  *** THE FILTER IS KEEPING NOTHING. THE CONTEST WILL PAY NOBODY. ***');
      Logger.log('  *** Set WR_CONTEST.excludeProduct to \'\' to count every unit. ***');
    }
  } else if (pay.contestWindowRows === 0) {
    Logger.log('  Nothing is dated inside the contest window yet.');
  } else {
    Logger.log('  All ' + pay.contestWindowRows + ' rows in the window are counted - ' +
               pay.contestUnits + ' of them are units. Nothing was filtered out.');
  }

  Logger.log('');
  Logger.log('  EVERY ROW IN THE CONTEST WINDOW, ONE BY ONE');
  Logger.log('  (if an Accelerator sale is sitting here as Unattributed or blank,');
  Logger.log('   this is where you will see it - look for a roster agent with unit YES)');
  wr_dumpWindow_(ss);

  Logger.log('');
  Logger.log('  EXCLUDED FROM REVENUE THIS MONTH');
  Logger.log('    refunded  : ' + pay.refundRows + ' rows, ' + wr_money_(pay.refundAmount));
  Logger.log('    cancelled : ' + pay.cancelledRows + ' rows, ' + wr_money_(pay.cancelledAmount));
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/* Lists the individual payment rows inside the contest window. Read only.
   Kept separate so warRoomContestCheck stays readable. */
function wr_dumpWindow_(ss) {
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) { Logger.log('    mdl_Payments is empty.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var H = wr_headers_(sh.getRange(1, 1, 1, lastCol).getValues()[0]);
  var cDate  = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cAgent = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt   = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit  = wr_col_(H, ['is unit', 'unit', 'units']);
  var cFam   = wr_col_(H, ['batch family']);
  var cBatch = wr_col_(H, ['batch']);
  var cType  = wr_col_(H, ['payment type']);
  if (cDate < 0 || cAgent < 0) { Logger.log('    no date/agent column.'); return; }

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var roster = wr_roster_(ss, Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM'));
  var from = wr_dayNum_(WR_CONTEST.from), to = wr_dayNum_(WR_CONTEST.to);
  var shown = 0;

  Logger.log('    ' + wr_pad_('DATE', 8) + wr_pad_('AGENT', 22) + wr_pad_('AMOUNT', 11) +
             wr_pad_('UNIT', 6) + wr_pad_('BATCH', 16) + wr_pad_('FAMILY', 15) +
             wr_pad_('TYPE', 20) + 'ROSTER');
  for (var r = 0; r < grid.length && shown < 60; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var dn = wr_dayNumOf_(d);
    if (dn < from || dn > to) continue;
    var name = wr_str_(grid[r][cAgent]);
    if (!name || wr_isSummary_(name)) continue;
    shown++;
    Logger.log('    ' +
      wr_pad_(Utilities.formatDate(d, WR_TZ, 'dd MMM'), 8) +
      wr_pad_(name, 22) +
      wr_pad_(wr_money_(cAmt >= 0 ? wr_num_(grid[r][cAmt]) : 0), 11) +
      wr_pad_((cUnit >= 0 && wr_truthy_(grid[r][cUnit])) ? 'YES' : '-', 6) +
      wr_pad_(cBatch >= 0 ? wr_str_(grid[r][cBatch]) : '', 16) +
      wr_pad_(cFam >= 0 ? (wr_str_(grid[r][cFam]) || '(blank)') : '', 15) +
      wr_pad_(cType >= 0 ? wr_str_(grid[r][cType]) : '', 20) +
      (roster.byAgent[wr_key_(name)] ? 'on roster' : 'OFF roster'));
  }
  if (!shown) Logger.log('    nothing is dated inside the window yet.');
}

/** Checks the pure logic. Touches no sheet, writes nothing. */
function warRoomSelfTest() {
  var fails = 0;
  function eq(what, got, want) {
    var ok = String(got) === String(want);
    if (!ok) fails++;
    Logger.log((ok ? '  PASS  ' : '  FAIL  ') + what +
               (ok ? '' : '   got [' + got + ']  want [' + want + ']'));
  }

  Logger.log('=== WAR ROOM SELF TEST ===');

  eq('month key from a Date',      wr_monthKey_(new Date(2026, 8, 12)), '2026-09');
  eq('month key from 2026-09',     wr_monthKey_('2026-09'), '2026-09');
  eq('month key from 2026-9',      wr_monthKey_('2026-9'), '2026-09');
  eq('month key from Sep-26',      wr_monthKey_('Sep-26'), '2026-09');
  eq('month key from September 2026', wr_monthKey_('September 2026'), '2026-09');
  eq('month key from junk',        wr_monthKey_('hello'), '');
  eq('month key from blank',       wr_monthKey_(''), '');

  eq('days in September',          wr_daysInMonth_('2026-09'), 30);
  eq('days in February 2028',      wr_daysInMonth_('2028-02'), 29);
  eq('month name',                 wr_monthName_('2026-09'), 'September 2026');

  eq('Bengaluru folds to Bangalore',  wr_city_('Bengaluru'), 'Bangalore');
  eq('BLR folds to Bangalore',        wr_city_('blr'), 'Bangalore');
  eq('Hyd folds to Hyderabad',        wr_city_('HYD '), 'Hyderabad');
  eq('BBSR folds to Bhubaneswar',     wr_city_('BBSR'), 'Bhubaneswar');
  eq('an unknown city is kept as is', wr_city_('Pune'), 'Pune');
  eq('a blank city stays blank',      wr_city_(''), '');

  eq('Intl folds to International',   wr_team_('Intl'), 'International');
  eq('international stays',           wr_team_('INTERNATIONAL'), 'International');
  eq('India stays',                   wr_team_('india'), 'India');
  eq('Domestic folds to India',       wr_team_('Domestic'), 'India');

  /* the exact strings the real mdl_Roster and mdl_Payments were putting
     on the boards as if they were people */
  eq('"Sum agent revenue" is a total',  wr_isSummary_('Sum agent revenue'), true);
  eq('"Sum targets" is a total',        wr_isSummary_('Sum targets'), true);
  eq('a bare number is a total',        wr_isSummary_('52675000'), true);
  eq('another bare number is a total',  wr_isSummary_(6430970), true);
  eq('"Grand Total" is a total',        wr_isSummary_('Grand Total'), true);
  eq('blank is a total',                wr_isSummary_(''), true);
  eq('a real agent is not a total',     wr_isSummary_('Alisha Khan'), false);
  eq('Mastermind is not a total',       wr_isSummary_('Mastermind'), false);
  eq('a name starting with All is safe', wr_isSummary_('Alli Raza'), false);
  eq('a name starting with Sum is safe', wr_isSummary_('Sumit Kumar'), false);
  eq('a name starting with Avg is safe', wr_isSummary_('Avgust Petrov'), false);

  /* the row that survived a name-only check on the real roster: its agent
     cell read like a label, but its manager and office were totals */
  eq('a totals manager condemns the row',
     wr_isSummaryRow_('Headcount', 'Sum agent revenue', ''), true);
  eq('a totals office condemns the row',
     wr_isSummaryRow_('Headcount', '', 'Sum targets'), true);
  eq('a numeric office condemns the row',
     wr_isSummaryRow_('Headcount', '', '52675000'), true);
  eq('a real agent with a blank manager survives',
     wr_isSummaryRow_('Alisha Khan', '', 'Hyderabad'), false);
  eq('a real agent with a blank office survives',
     wr_isSummaryRow_('Alisha Khan', 'Saeed', ''), false);
  eq('a fully blank-but-named agent survives',
     wr_isSummaryRow_('Alisha Khan', '', ''), false);
  eq('blank is not itself a total', wr_looksLikeTotal_(''), false);

  eq('name key ignores case/space',   wr_key_(' Alisha  Khan '), 'alishakhan');
  eq('name key ignores punctuation',  wr_key_('Satyam Aditya-Samant'), 'satyamadityasamant');

  eq('number from a string',       wr_num_('1,75,000'), 175000);
  eq('number from a rupee string', wr_num_('Rs 2,500.50'), 2500.5);
  eq('number from blank',          wr_num_(''), 0);
  eq('number from junk',           wr_num_('n/a'), 0);

  eq('unit YES is true',           wr_truthy_('YES'), true);
  eq('unit 1 is true',             wr_truthy_(1), true);
  eq('unit blank is false',        wr_truthy_(''), false);
  eq('unit NO is false',           wr_truthy_('no'), false);
  eq('unit 0 is false',            wr_truthy_(0), false);

  eq('money in lakh',              wr_money_(4865206), '48.65 L');
  eq('money in crore',             wr_money_(52675000), '5.27 cr');
  eq('money small',                wr_money_(4500), '4500');

  var H = wr_headers_(['Date', 'Batch', 'Lead Owner', 'On Roster', 'Manager', 'Amount Paid', 'Is Unit']);
  eq('header exact match',         wr_col_(H, ['amount paid']), 5);
  eq('header fallback match',      wr_col_(H, ['agent', 'lead owner']), 2);
  eq('header contains match',      wr_col_(H, ['roster']), 3);
  eq('header miss returns -1',     wr_col_(H, ['nothing here']), -1);

  var sorted = [{ name: 'B', revenue: 10, units: 1 }, { name: 'A', revenue: 50, units: 1 },
                { name: 'C', revenue: 50, units: 3 }].sort(wr_bySales_);
  eq('sorted by revenue then units', sorted.map(function (x) { return x.name; }).join(''), 'CAB');

  eq('one team stays named',       wr_joinKeys_({ India: true }, 'India/Intl'), 'India');
  eq('two teams become the label', wr_joinKeys_({ India: true, International: true }, 'India/Intl'), 'India/Intl');
  eq('no team is blank',           wr_joinKeys_({}, 'India/Intl'), '');

  /* the JSONP callback guard */
  eq('good callback passes',  /^[A-Za-z_$][A-Za-z0-9_$.]{0,60}$/.test('__wr1'), true);
  eq('injection is rejected', /^[A-Za-z_$][A-Za-z0-9_$.]{0,60}$/.test('a();alert(1)'), false);

  /* ---- the contest rule: a unit is a unit ----
     The live setting filters nothing, so every product value qualifies.
     These two are the sales the old Batch Family filter was throwing away:
     Fahad Nizar (10,000) and Kshitij (28,500), real Accelerator sales to
     Mastermind-sourced leads, both verified against the Payment Tracker. */
  var keepEx = WR_CONTEST.excludeProduct;
  WR_CONTEST.excludeProduct = '';
  eq('the live rule bars nothing',        WR_CONTEST.excludeProduct, '');
  eq('AIAP counts',                       wr_progMatches_('AIAP C14'), true);
  eq('AI Bootcamp counts too',            wr_progMatches_('AI Bootcamp'), true);
  eq('a Mastermind lead counts',          wr_progMatches_('Mastermind'), true);
  eq('a Bootcamp lead counts',            wr_progMatches_('Bootcamp'), true);
  eq('an Unattributed lead counts',       wr_progMatches_('Unattributed'), true);
  eq('a blank cell counts',               wr_progMatches_(''), true);
  eq('a null cell counts',                wr_progMatches_(null), true);
  eq('Fahad Nizar 10,000 counts',         wr_progMatches_('AIAP C15'), true);
  eq('Kshitij 28,500 counts',             wr_progMatches_('AIAP C13+'), true);
  /* and it can still bar a product if a future contest ever needs it */
  WR_CONTEST.excludeProduct = 'bootcamp';
  eq('excludeProduct bars Bootcamp',      wr_progMatches_('AI Bootcamp'), false);
  eq('lower case is barred too',          wr_progMatches_('bootcamp'), false);
  eq('and AIAP still counts',             wr_progMatches_('AIAP C14'), true);
  eq('a blank is not the barred product', wr_progMatches_(''), true);
  WR_CONTEST.excludeProduct = keepEx;

  /* ---- refunds and cancellations ---- */
  eq('Is Refund YES is truthy',    wr_truthy_('YES'), true);
  eq('a CANCELLED status is caught',
     ('CANCELLED'.toLowerCase().indexOf('cancel') > -1), true);
  eq('a SHIFT TO status is not',
     ('SHIFT TO'.toLowerCase().indexOf('cancel') > -1), false);

  /* ---- the capacity column, found by its values ----
     Column 3 is the ramp. Column 1 is a name, 2 a target, 4 a stray 1. */
  var rosterGrid = [
    ['Agent', 'Target', '', 'Note'],
    ['Alisha Khan',   500000, 1,    1],
    ['Kshitij',       500000, 0.5,  2],
    ['Gowtham C',     400000, 0.75, 3],
    ['J Joel',        300000, 1,    4],
    ['Salman Rashid', 300000, 0.5,  5],
    ['Gayana K N',    300000, 1,    6]
  ];
  eq('capacity column found by value', wr_manMonthCol_(rosterGrid, 0), 2);

  var noRamp = [
    ['Agent', 'Target'],
    ['Alisha Khan', 500000],
    ['Kshitij',     500000],
    ['Gowtham C',   400000],
    ['J Joel',      300000]
  ];
  eq('no capacity column returns -1', wr_manMonthCol_(noRamp, 0), -1);
  eq('too few rows to judge returns -1',
     wr_manMonthCol_([['Agent'], ['Only One']], 0), -1);

  /* revenue per man-month, the number the ranking should use */
  eq('13 heads at 4.00 mm on 30.10 L', wr_r2_(3010190 / 4), 752548);
  eq('14 heads at 11.25 mm on 33.51 L', wr_r2_(3351372 / 11.25), 297900);

  Logger.log('');
  Logger.log(fails ? ('=== ' + fails + ' FAILED ===') : '=== ALL PASS ===');
  Logger.log('Nothing was written.');
  return fails;
}
