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
var WR_CACHE_SECS = 420;
var WR_MAX_AGENTS = 200;       // cap on the agent list sent to the TV
var WR_MAX_RECENT = 40;        // closes kept for the running ticker
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

  /* WHAT COUNTS AS ONE
       'units'    only rows flagged Is Unit = YES. A new close.
       'payments' EVERY payment row in the window, including a balance or
                  an instalment against a sale closed weeks ago.

     These are genuinely different contests. "Booking or full amount = 1
     unit" means a close counts whether or not the whole price arrived -
     which is what Is Unit is for. It does NOT mean an old customer paying
     off a balance hands their agent another unit. Run warRoomWhatCounts
     to see which rows each mode would pay before choosing.

     LIVE SETTING: 'units'. Confirmed for this contest - only a first
     payment or a full payment counts. A balance or an instalment against
     a sale closed earlier does not, even though the money lands inside
     the window. That is exactly what the Is Unit flag marks, so the rule
     needs no extra column. Refunds and cancellations are excluded under
     both modes. */
  countMode: 'units',

  /* WHICH PRODUCT COUNTS
       onlyProduct    '' = every product. Otherwise ONLY rows whose
                      productColumn contains this text.
       excludeProduct '' = bar nothing. Otherwise drop rows that match.
       productColumn  the header to read. Leave '' and no product column
                      is read at all, so nothing can be lost to a filter.

     Set the column from evidence, never by guessing. "Batch Family" is
     the LEAD'S SOURCE CAMPAIGN, not the product - filtering on it once
     threw away Fahad Nizar (10,000) and Kshitij (28,500), both real
     Accelerator sales to Mastermind-sourced leads. warRoomWhatCounts
     prints every candidate column's real values. */
  onlyProduct:    '',
  excludeProduct: '',
  productColumn:  '',

  /* BARRING WHOLE PRODUCTS BY BATCH CODE

     warRoomBatches showed the Batch column carries the product - BC18,
     EBC4, CL WS IND, and bare cohort numbers for Accelerator. It also
     showed the column is NOT purely a product: "Referral" and "Website"
     are lead SOURCES sitting in the same column, and Referral runs at
     about 155,000 a unit, higher than the Accelerator cohorts. Barring
     "anything that is not a number" would have dropped 7.77 L of real
     Accelerator business - the Batch Family mistake over again.

     So this is an explicit list, never a pattern. Each entry is matched
     as a PREFIX of the batch code, not a substring: "EBC4" contains "BC"
     but is not a Bootcamp code under a "BC" rule, and a substring match
     would also catch unrelated future codes by accident.

     Empty bars nothing, which is the live setting. When it is set, the
     Batch column is read automatically - warRoomContestWhatIf shows
     exactly who gains and loses before you commit to it. */
  excludeBatchPrefixes: []
};

/* Does one row's product qualify? With every product setting empty - the
   live rule - yes, always. */
function wr_progMatches_(cell) {
  var raw  = String(cell == null ? '' : cell).trim();
  var v    = raw.toLowerCase();
  var only = String(WR_CONTEST.onlyProduct || '').toLowerCase();
  var bad  = String(WR_CONTEST.excludeProduct || '').toLowerCase();
  if (only && v.indexOf(only) === -1) return false;
  if (bad  && v.indexOf(bad)  > -1)   return false;

  /* PREFIX, not substring. "EBC4" contains "BC" and must not be barred by
     a "BC" rule; only a code that STARTS with the entry is barred. */
  var pref = wr_excludedPrefixes_();
  for (var i = 0; i < pref.length; i++) {
    if (pref[i] && v.indexOf(pref[i]) === 0) return false;
  }
  return true;
}

/* The exclusion list, lowercased and trimmed, empties dropped. */
function wr_excludedPrefixes_() {
  var raw = WR_CONTEST.excludeBatchPrefixes;
  if (!raw || !raw.length) return [];
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var t = String(raw[i] == null ? '' : raw[i]).trim().toLowerCase();
    if (t) out.push(t);
  }
  return out;
}

/* Is a product filter switched on at all? */
function wr_progFiltering_() {
  return !!(WR_CONTEST.onlyProduct || WR_CONTEST.excludeProduct ||
            wr_excludedPrefixes_().length);
}

/* Which column carries the product. An explicit productColumn always
   wins; a bare prefix list means the Batch column, because that is what
   the prefixes are codes from. Resolving it here rather than leaving it
   blank stops a set exclusion list from silently barring nothing. */
function wr_productColumnName_() {
  if (WR_CONTEST.productColumn) return String(WR_CONTEST.productColumn);
  return wr_excludedPrefixes_().length ? 'batch' : '';
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

  var tA = new Date().getTime();
  var roster = wr_roster_(ss, monthKey);
  WR_HAS_MM = roster.mmCol;   // gates every per-man-month figure below
  var tB = new Date().getTime();
  var pay    = wr_payments_(ss, monthKey);
  var tC = new Date().getTime();

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
      buildMs: new Date().getTime() - t0,
      /* where the time actually went, so a slow build is diagnosed rather
         than guessed at */
      rosterMs: tB - tA,
      paymentsMs: tC - tB,
      scanRows: pay.scanRows,
      blockRows: pay.blockRows
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
    /* Newest closes first, for the running ticker. Roster agents only, so
       the ticker can never announce a name the boards do not show. */
    recent: wr_recent_(pay, roster),
    notes: wr_notes_(roster, pay, offRosterNames, offRosterRev, mgrList)
  };
}

/* The contest board. Units only, its own date window, ranked by units
   with revenue breaking ties - so the person who closed four small ones
   beats the person who closed three big ones, which is the whole point
   of a unit contest. */
function wr_contest_(pay, roster) {
  if (!WR_CONTEST.active) return { active: false };

  /* The contest is for the sales floor, so it counts the same people the
     month board counts: names on THIS month's mdl_Roster. Anyone else -
     Mastermind, Anjali, Pratham and the other business lines - is off the
     revenue board already, and must be off the contest board too, or the
     two screens disagree about who sold what on the same day. Their units
     are kept separately so the number is visible, never silently dropped. */
  var list = [], k, units = 0, offUnits = 0, offNames = {};
  for (k in pay.contest) {
    var c = pay.contest[k];
    var r = roster.byAgent[k];
    if (!r) {
      offUnits += c.units;
      offNames[c.name] = (offNames[c.name] || 0) + c.units;
      continue;
    }
    units += c.units;
    list.push({
      name: c.name,
      manager: r.manager,
      city:    r.city,
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
    countMode: WR_CONTEST.countMode || 'units',
    programme: WR_CONTEST.onlyProduct || WR_CONTEST.excludeProduct ||
               (wr_excludedPrefixes_().length
                  ? 'excluding ' + wr_excludedPrefixes_().join(', ').toUpperCase() : ''),
    programmeFiltered: !!(wr_progFiltering_() && pay.programmeCol),
    programmeColumnMissing: !!(wr_progFiltering_() && !pay.programmeCol),
    programmeMatchedNothing: !!(wr_progFiltering_() && pay.programmeCol &&
                                pay.contestWindowRows > 0 && pay.contestProgMatched === 0),
    windowRows: pay.contestWindowRows,
    matchedRows: pay.contestProgMatched,
    totalUnits: units,                 // roster agents only - what the TV shows
    offRosterUnits: offUnits,          // diagnostics, never rendered
    offRosterNames: offNames,
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
              contestWindowRows: 0, contestProgMatched: 0, contestCounted: 0, progSamples: {},
              recent: [],
              scanRows: 0, blockRows: 0,
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
  var progColName = wr_productColumnName_();
  var cProg  = (wr_progFiltering_() && progColName)
                 ? wr_col_(H, [progColName.toLowerCase()])
                 : -1;
  var cRef   = wr_col_(H, ['is refund', 'refund']);
  var cType  = wr_col_(H, ['payment type']);
  var cStat  = wr_col_(H, ['status']);
  if (cRost < 0) out.noRosterCol = true;
  out.programmeCol = cProg >= 0;

  if (cDate < 0 || cAgent < 0 || cAmt < 0) return out;

  /* THE EXPENSIVE PART, AND WHY IT IS DONE THIS WAY.

     mdl_Payments runs to the IMPORTRANGE's pinned bound - tens of thousands
     of rows covering every month there has ever been - while a build needs
     only this month's few hundred. Reading the whole sheet to find them cost
     34 seconds, past the point where the TV gives up waiting.

     Narrowing the columns barely helped: the cost is per row, not per cell.
     So read the DATE column alone first, work out which block of rows is
     actually in scope, and then fetch only that block. Payments arrive in
     date order, so September is a contiguous run near the end and the second
     read is a few hundred rows instead of tens of thousands.

     If the dates ever are not in order the block simply widens - at worst
     back to the whole sheet, which is where this started. It cannot return
     wrong numbers, only do more work. */
  var n = lastRow - 1;
  var vDateRaw = sh.getRange(2, cDate + 1, n, 1).getValues();

  var cFromScan = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.from) : 0;
  var cToScan   = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.to)   : 0;
  var first = -1, last = -1;
  /* One day number per row, compared as integers. The month is a prefix of
     it, so this needs no month key and no second pass. */
  var wantYM = Number(monthKey.substring(0, 4)) * 100 + Number(monthKey.substring(5, 7));
  for (var s0 = 0; s0 < n; s0++) {
    var dScan = vDateRaw[s0][0];
    if (!(dScan instanceof Date) || isNaN(dScan.getTime())) continue;
    var dayScan = wr_dayNumOf_(dScan);
    var inScope = (Math.floor(dayScan / 100) === wantYM) ||
                  (cFromScan && dayScan >= cFromScan && dayScan <= cToScan);
    if (inScope) { if (first < 0) first = s0; last = s0; }
  }
  out.scanRows = n;
  if (first < 0) { out.blockRows = 0; return out; }   // nothing dated in scope
  var blockN = last - first + 1;
  out.blockRows = blockN;

  /* one read of the block, spanning only the columns that get used */
  var need = [cDate, cAgent, cAmt, cUnit, cProg, cRef, cType, cStat]
               .filter(function (x) { return x >= 0; });
  var lo = Math.min.apply(null, need), hi = Math.max.apply(null, need);
  var block = sh.getRange(2 + first, lo + 1, blockN, hi - lo + 1).getValues();
  function cell(row, idx) { return idx < 0 ? '' : row[idx - lo]; }

  /* the contest window, as day numbers so the comparison is a plain integer */
  var cFrom = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.from) : 0;
  var cTo   = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.to)   : 0;

  for (var r = 0; r < blockN; r++) {
    var row = block[r];
    var d = cell(row, cDate);
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;

    var name = wr_str_(cell(row, cAgent));
    if (!name || wr_isSummary_(name)) continue;   // totals rows are not people
    var key = wr_key_(name);
    var isUnit = (cUnit >= 0 && wr_truthy_(cell(row, cUnit)));

    /* Money that came back is not money earned. mdl_Payments carries both
       "Is Refund" and a "Status" that says CANCELLED, and neither was being
       read - so a refunded payment lifted the board exactly like a sale. */
    var isRefund  = (cRef >= 0 && wr_truthy_(cell(row, cRef)));
    var statusTxt = (cStat >= 0) ? String(cell(row, cStat) || '').trim().toLowerCase() : '';
    var isCancel  = (statusTxt.indexOf('cancel') > -1);
    var thisMonth = (wr_monthKey_(d) === monthKey);
    var amt = wr_num_(cell(row, cAmt));
    if (thisMonth && cType >= 0 &&
        String(cell(row, cType) || '').toLowerCase().indexOf('upgrade') > -1) {
      out.upgradeRows++; out.upgradeAmount += amt;
    }

    if (thisMonth && isRefund) { out.refundRows++;    out.refundAmount    += amt; }
    if (thisMonth && isCancel) { out.cancelledRows++; out.cancelledAmount += amt; }
    if (isRefund || isCancel) continue;

    /* --- the month-to-date boards --- */
    if (thisMonth) {
      out.rowsScanned++;
      if (!out.byAgent[key]) out.byAgent[key] = { name: name, revenue: 0, units: 0 };
      out.byAgent[key].revenue += amt;
      if (isUnit) out.byAgent[key].units += 1;
      out.rowsCounted++;

      /* THE TICKER. A board that only shows month-to-date totals has
         nothing to say between sales - the numbers sit still for hours and
         the floor stops looking at it. Individual closes are what make it
         worth glancing up at, so keep the newest ones.

         Units only: a balance payment against a sale closed weeks ago is
         not news, and announcing it would credit the same close twice. */
      if (isUnit) {
        out.recent.push({ name: name, amt: amt, at: d.getTime() });
        /* Trimmed rather than sorted at the end: the sheet is in date
           order so this is nearly always a straight append, and an
           unbounded array over a big month is a lot of memory for rows
           that will be thrown away. */
        if (out.recent.length > 400) out.recent.splice(0, 200);
      }
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
        var raw = wr_str_(cell(row, cProg));
        var label = raw || '(blank)';
        out.progSamples[label] = (out.progSamples[label] || 0) + 1;
        if (!wr_progMatches_(raw)) continue;
      }
      out.contestProgMatched++;                    // == windowRows when nothing is barred
      /* 'units' pays a close; 'payments' pays every rupee that lands. */
      if (WR_CONTEST.countMode !== 'payments' && !isUnit) continue;
      out.contestCounted++;
      if (!out.contest[key]) out.contest[key] = { name: name, units: 0, revenue: 0 };
      out.contest[key].units += 1;
      out.contest[key].revenue += amt;
      out.contestUnits++;
      out.contestRows++;
    }
  }
  return out;
}

/* The newest closes, newest first, ready for the ticker. */
function wr_recent_(pay, roster) {
  var src = pay.recent || [], out = [];
  for (var i = 0; i < src.length; i++) {
    var r = src[i];
    var who = roster.byAgent[wr_key_(r.name)];
    if (!who) continue;                 // off-roster names stay off the board
    out.push({
      name: r.name, amt: wr_r2_(r.amt), at: r.at,
      city: who.city || '', team: who.team || '', manager: who.manager || ''
    });
  }
  out.sort(function (a, b) { return b.at - a.at; });
  return out.slice(0, WR_MAX_RECENT);
}

/* FORMATTING DATES IS THE EXPENSIVE THING.

   Utilities.formatDate is a bridge call out of JavaScript, and the scan
   loop was making about 35,000 of them - one per row for the month key,
   three more per out-of-month row for the day number. Measured on the real
   sheet that was 27.5 of the build's 29 seconds. Everything else put
   together was 1.5.

   A plain JS Date already carries the right calendar fields when the
   script's own timezone is the one we report in, so ask once, cache the
   answer, and only fall back to formatDate when they differ. Asking once
   per execution rather than per row is the whole optimisation. */
var WR_FAST_DATES = null;
function wr_fastDates_() {
  if (WR_FAST_DATES !== null) return WR_FAST_DATES;
  WR_FAST_DATES = false;            /* set first, so a probe can never recurse */
  try {
    /* Do not compare timezone NAMES. Google reports Indian projects as
       'Asia/Calcutta' at least as often as 'Asia/Kolkata', and a name compare
       would quietly fall through to the slow path - a no-op optimisation that
       still costs 29 seconds. Prove the arithmetic instead.

       Compare the whole timestamp, not just the calendar date. If the hour
       and the minute agree as well, the two zones are at the same offset at
       that instant, which is the only thing being relied on. An earlier
       version of this probe compared dates alone at half-hour steps, and a
       quarter-hour zone such as Asia/Kathmandu slipped through it - the
       offset never pushed any probe across midnight. Comparing the time
       closes that: any difference at all shows up directly.

       Twelve instants across the year, so a zone that keeps IST's offset in
       winter and drifts in summer is caught by the summer probes. Twelve
       formatDate calls, once, against the 35,000 this replaces. */
    for (var mo = 0; mo < 12; mo++) {
      var probe = new Date(2026, mo, 15, 13, 47, 0);
      var p2 = function (x) { return x < 10 ? '0' + x : '' + x; };
      var localStamp = probe.getFullYear() + p2(probe.getMonth() + 1) + p2(probe.getDate()) +
                       p2(probe.getHours()) + p2(probe.getMinutes());
      if (Utilities.formatDate(probe, WR_TZ, 'yyyyMMddHHmm') !== localStamp) return false;
    }
    WR_FAST_DATES = true;
  } catch (e) {
    WR_FAST_DATES = false;          /* anything unexpected: take the slow, correct road */
  }
  return WR_FAST_DATES;
}

/* Month key of a Date, the fast way where that has been proven safe. */
function wr_monthKeyOf_(d) {
  if (wr_fastDates_()) {
    var y = d.getFullYear(), m = d.getMonth() + 1;
    if (y >= 1000) return y + '-' + (m < 10 ? '0' + m : m);
  }
  return Utilities.formatDate(d, WR_TZ, 'yyyy-MM');
}

/* 'yyyy-MM-dd' -> a comparable integer, 0 if it is not a date */
function wr_dayNum_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return 0;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}
function wr_dayNumOf_(d) {
  if (wr_fastDates_()) {
    var yf = d.getFullYear();
    if (yf >= 1000) return yf * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
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
    return wr_monthKeyOf_(v);
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
  Logger.log('    of which          : roster ' + p.meta.rosterMs + ' ms, payments ' +
             p.meta.paymentsMs + ' ms   (scanned ' + p.meta.scanRows +
             ' rows, read a block of ' + p.meta.blockRows + ')');
  /* If this says no, the date scan is formatting every row and the build will
     be tens of seconds. It means this project's timezone is not IST, which is
     worth knowing on its own - every date on the board is reported in IST. */
  Logger.log('    fast dates        : ' + (wr_fastDates_() ? 'yes' : 'NO - script timezone is not ' + WR_TZ +
             ', so dates are formatted one row at a time. Fix it in Project Settings.'));
  if (p.meta.buildMs > 60000) {
    Logger.log('  *** THAT IS SLOW ENOUGH TO MATTER. The TV waits 90s for a cold build.');
    Logger.log('  *** Above that it gives up and shows NO DATA YET on every cache miss.');
    Logger.log('  *** Tell me and I will cut what the feed reads.');
  }
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
    Logger.log('    units counted    : ' + p.contest.totalUnits + '   (roster agents)');
    if (p.contest.offRosterUnits) {
      var offList = [];
      for (var on in p.contest.offRosterNames) {
        offList.push(on + ' ' + p.contest.offRosterNames[on] + 'u');
      }
      Logger.log('    off roster       : ' + p.contest.offRosterUnits +
                 ' more units NOT on the board - ' + offList.join(', '));
    }
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
  /* Judge the roster here too, or this tool and the TV disagree. */
  var con = wr_contest_(pay, wr_roster_(ss, Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM')));
  Logger.log('  rows in window    : ' + pay.contestWindowRows);
  Logger.log('  rows counted      : ' + pay.contestProgMatched);
  Logger.log('  units, all names  : ' + pay.contestUnits + '   (every Is Unit = YES row)');
  Logger.log('  UNITS ON THE BOARD: ' + con.totalUnits + '   (roster agents only)');
  if (con.offRosterUnits) {
    var offL = [];
    for (var onm in con.offRosterNames) offL.push(onm + ' ' + con.offRosterNames[onm] + 'u');
    Logger.log('  off roster        : ' + con.offRosterUnits + ' units held off the board - ' +
               offL.join(', '));
    Logger.log('                      (other business lines, same rule as the revenue board)');
  }
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
               pay.contestUnits + ' are units, ' + con.totalUnits +
               ' of those by roster agents. No product was filtered out.');
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

/**
 * warRoomWhatCounts - READ ONLY. Writes nothing.
 *
 * Two questions decide who gets paid this weekend, and both are settled by
 * looking at the sheet rather than by guessing:
 *
 *   1. Does "any Accelerator payment counts" mean every payment row, or
 *      every new close? This prints both totals, and lists the rows that
 *      differ, so the gap between the two rules is visible in names and
 *      rupees rather than in the abstract.
 *
 *   2. Which column actually names the product? It prints every distinct
 *      value in each candidate column and marks the ones containing
 *      "accel". Whichever list names products is the column to use.
 */
function warRoomWhatCounts() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) { Logger.log('mdl_Payments is empty.'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  var c = {
    date:  wr_col_(H, ['date', 'payment date', 'paid on']),
    agent: wr_col_(H, ['lead owner', 'agent', 'owner']),
    amt:   wr_col_(H, ['amount paid', 'amount']),
    unit:  wr_col_(H, ['is unit', 'unit']),
    type:  wr_col_(H, ['payment type']),
    batch: wr_col_(H, ['batch']),
    fam:   wr_col_(H, ['batch family']),
    seg:   wr_col_(H, ['segment']),
    stat:  wr_col_(H, ['status']),
    ref:   wr_col_(H, ['is refund', 'refund'])
  };

  Logger.log('=== WHAT COUNTS ===  ' + WR_CONTEST.name + '   ' +
             WR_CONTEST.from + ' to ' + WR_CONTEST.to);
  Logger.log('  current setting   : countMode "' + (WR_CONTEST.countMode || 'units') + '"' +
             (wr_progFiltering_()
                ? ('   product filter on column "' + WR_CONTEST.productColumn + '"')
                : '   no product filter'));
  Logger.log('');

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var roster = wr_roster_(ss, Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM'));
  var from = wr_dayNum_(WR_CONTEST.from), to = wr_dayNum_(WR_CONTEST.to);

  var rows = [], vals = { Batch: {}, 'Batch Family': {}, Segment: {}, 'Payment Type': {} };
  var nPay = 0, nUnit = 0, payAmt = 0, unitAmt = 0;

  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var dn = wr_dayNumOf_(d);
    if (dn < from || dn > to) continue;

    var name = wr_str_(grid[r][c.agent]);
    if (!name || wr_isSummary_(name)) continue;

    var isRefund = (c.ref >= 0 && wr_truthy_(grid[r][c.ref]));
    var isCancel = (c.stat >= 0 &&
                    String(grid[r][c.stat] || '').toLowerCase().indexOf('cancel') > -1);
    if (isRefund || isCancel) continue;      // never counted under either rule

    var amt = c.amt >= 0 ? wr_num_(grid[r][c.amt]) : 0;
    var isUnit = (c.unit >= 0 && wr_truthy_(grid[r][c.unit]));
    var onRoster = !!roster.byAgent[wr_key_(name)];

    nPay++; payAmt += amt;
    if (isUnit) { nUnit++; unitAmt += amt; }

    function tally(label, idx) {
      if (idx < 0) return;
      var v = wr_str_(grid[r][idx]) || '(blank)';
      vals[label][v] = (vals[label][v] || 0) + 1;
    }
    tally('Batch', c.batch); tally('Batch Family', c.fam);
    tally('Segment', c.seg); tally('Payment Type', c.type);

    rows.push({ d: Utilities.formatDate(d, WR_TZ, 'dd MMM'), name: name, amt: amt,
                unit: isUnit, onRoster: onRoster,
                type:  c.type  >= 0 ? wr_str_(grid[r][c.type])  : '',
                batch: c.batch >= 0 ? wr_str_(grid[r][c.batch]) : '',
                fam:   c.fam   >= 0 ? wr_str_(grid[r][c.fam])   : '',
                seg:   c.seg   >= 0 ? wr_str_(grid[r][c.seg])   : '' });
  }

  Logger.log('  THE TWO RULES, SIDE BY SIDE   (refunds and cancellations already out)');
  Logger.log('    countMode "units"    : ' + nUnit + ' rows   ' + wr_money_(unitAmt));
  Logger.log('    countMode "payments" : ' + nPay  + ' rows   ' + wr_money_(payAmt));
  Logger.log('    the difference       : ' + (nPay - nUnit) + ' rows   ' +
             wr_money_(payAmt - unitAmt) + '  <-- paid only under "payments"');
  Logger.log('');

  if (nPay > nUnit) {
    Logger.log('  THE ROWS THAT ONLY "payments" WOULD PAY');
    Logger.log('  (these are NOT flagged as a close - look at Payment Type: if they');
    Logger.log('   are balances on older sales, "units" is the rule you want)');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].unit) continue;
      Logger.log('    ' + wr_pad_(rows[i].d, 8) + wr_pad_(rows[i].name, 22) +
                 wr_pad_(wr_money_(rows[i].amt), 11) +
                 wr_pad_('type ' + (rows[i].type || '-'), 24) +
                 (rows[i].onRoster ? 'on roster' : 'OFF roster'));
    }
    Logger.log('');
  }

  Logger.log('  EVERY ROW IN THE WINDOW');
  Logger.log('    ' + wr_pad_('DATE', 8) + wr_pad_('AGENT', 22) + wr_pad_('AMOUNT', 11) +
             wr_pad_('UNIT', 6) + wr_pad_('BATCH', 16) + wr_pad_('FAMILY', 15) +
             wr_pad_('SEGMENT', 15) + 'ROSTER');
  for (var j = 0; j < rows.length && j < 80; j++) {
    Logger.log('    ' + wr_pad_(rows[j].d, 8) + wr_pad_(rows[j].name, 22) +
               wr_pad_(wr_money_(rows[j].amt), 11) + wr_pad_(rows[j].unit ? 'YES' : '-', 6) +
               wr_pad_(rows[j].batch, 16) + wr_pad_(rows[j].fam || '(blank)', 15) +
               wr_pad_(rows[j].seg || '(blank)', 15) +
               (rows[j].onRoster ? 'on roster' : 'OFF roster'));
  }
  if (!rows.length) Logger.log('    nothing is dated inside the window yet.');
  Logger.log('');

  Logger.log('  WHICH COLUMN NAMES THE PRODUCT?');
  Logger.log('  (the one whose values are programmes is the one to filter on)');
  ['Batch', 'Batch Family', 'Segment', 'Payment Type'].forEach(function (label) {
    var keys = [], k;
    for (k in vals[label]) keys.push(k);
    if (!keys.length) { Logger.log('    "' + label + '"  - not in mdl_Payments'); return; }
    keys.sort(function (a, b) { return vals[label][b] - vals[label][a]; });
    Logger.log('    "' + label + '"');
    keys.slice(0, 20).forEach(function (v) {
      Logger.log('        ' + wr_pad_(v, 30) + wr_pad_(vals[label][v] + ' rows', 10) +
                 (/accel/i.test(v) ? '  <<< contains "accel"' : ''));
    });
  });

  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/**
 * warRoomWhyStale - READ ONLY. Writes nothing, fixes nothing, and never
 * opens CBC or the Payment Tracker. It reads two tabs of your own sheet.
 *
 * "Revenue shows the same every time" has three possible causes and they
 * need three different fixes. Guessing wastes an afternoon. This walks
 * the chain and names the broken link:
 *
 *   Payment Tracker -> src_Payments -> mdl_Payments -> the feed -> the TV
 *
 * If src_Payments is behind, the IMPORTRANGE is broken and no amount of
 * running updateAndCheck will help. If src is current but mdl is behind,
 * the model build has not run. Those are opposite problems.
 */
function warRoomWhyStale() {
  var ss = SpreadsheetApp.getActive();
  var today = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM-dd');
  Logger.log('=== WHY IS IT STALE ===   today is ' + today + ' (' + WR_TZ + ')');
  Logger.log('');

  /* ---------- link 1: the import tab ---------- */
  var src = ss.getSheetByName('src_Payments');
  var srcLast = null, srcRows = 0, srcErr = '';
  if (!src) {
    Logger.log('  1. src_Payments   *** TAB NOT FOUND ***');
  } else {
    srcRows = src.getLastRow();
    /* An IMPORTRANGE that has lost authorisation shows #REF! in the top
       left. That is the single most common cause here, and it comes back
       every time the formula's row bound is rewritten. */
    var corner = src.getRange(1, 1, Math.min(6, srcRows || 1), 1).getDisplayValues();
    for (var i = 0; i < corner.length; i++) {
      var v = String(corner[i][0] || '');
      if (v.indexOf('#REF') > -1 || v.indexOf('#N/A') > -1 || v.indexOf('#ERROR') > -1) {
        srcErr = v; break;
      }
    }
    srcLast = wr_lastDateIn_(src);
    Logger.log('  1. src_Payments   ' + srcRows + ' rows' +
               (srcErr ? ('   *** SHOWS ' + srcErr + ' ***') : '') +
               '   last payment date: ' + (srcLast || 'none found'));
    var f = src.getRange(1, 1).getFormula() || src.getRange(5, 1).getFormula();
    if (f) Logger.log('     formula: ' + f.substring(0, 160));
  }

  /* ---------- link 2: the model ---------- */
  var mdl = ss.getSheetByName(WR_PAY_TAB);
  var mdlLast = null, mdlRows = 0;
  if (!mdl) {
    Logger.log('  2. mdl_Payments   *** TAB NOT FOUND ***');
  } else {
    mdlRows = mdl.getLastRow();
    mdlLast = wr_lastDateIn_(mdl);
    Logger.log('  2. mdl_Payments   ' + mdlRows + ' rows   last payment date: ' +
               (mdlLast || 'none found'));
  }

  /* ---------- link 3: the feed ---------- */
  Logger.log('  3. the feed       rebuilds every ' + WR_CACHE_SECS +
             's, so the TV is at most ' + Math.ceil(WR_CACHE_SECS / 60) +
             ' min behind mdl_Payments');
  Logger.log('  4. the TV         polls every 30s');
  Logger.log('');

  /* ---------- the verdict ---------- */
  Logger.log('  VERDICT');
  if (srcErr) {
    Logger.log('    src_Payments is showing ' + srcErr + '. The import from the Payment');
    Logger.log('    Tracker is BROKEN, so nothing downstream can be current and running');
    Logger.log('    updateAndCheck will not help.');
    Logger.log('');
    Logger.log('    FIX: open src_Payments, click cell A1 (or A5 - whichever holds the');
    Logger.log('    IMPORTRANGE), and press the blue "Allow access" button. Wait for the');
    Logger.log('    rows to fill, THEN run updateAndCheck once. Do not run it twice.');
  } else if (!srcLast) {
    Logger.log('    src_Payments has no readable payment dates. Send me the formula above.');
  } else if (srcLast < today && mdlLast === srcLast) {
    Logger.log('    Both tabs agree, and both stop at ' + srcLast + '. Your sheet is');
    Logger.log('    consistent - it simply has no payment dated today yet.');
    Logger.log('    If the Payment Tracker DOES have one, the IMPORTRANGE is lagging:');
    Logger.log('    open src_Payments and check the tracker against it row for row.');
  } else if (mdlLast && srcLast && mdlLast < srcLast) {
    Logger.log('    src_Payments is current to ' + srcLast + ' but mdl_Payments only');
    Logger.log('    reaches ' + mdlLast + '. The import is fine; the MODEL BUILD has not run.');
    Logger.log('');
    Logger.log('    FIX: run updateAndCheck once and wait for it to finish.');
  } else {
    Logger.log('    The chain looks healthy. src and mdl both reach ' + (mdlLast || srcLast) + '.');
    Logger.log('    If the TV still shows an old figure, give it ' +
               Math.ceil(WR_CACHE_SECS / 60) + ' minutes for the feed cache,');
    Logger.log('    then check the pill top right - it shows the true age of the numbers.');
  }
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/* Latest real date anywhere in a sheet's date column, as yyyy-MM-dd. */
function wr_lastDateIn_(sh) {
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;
  var H = wr_headers_(sh.getRange(1, 1, 1, lastCol).getValues()[0]);
  var c = wr_col_(H, ['date', 'payment date', 'paid on']);
  if (c < 0) return null;
  var col = sh.getRange(2, c + 1, lastRow - 1, 1).getValues();
  var best = null;
  for (var i = 0; i < col.length; i++) {
    var d = col[i][0];
    if (d instanceof Date && !isNaN(d.getTime())) {
      if (!best || d.getTime() > best.getTime()) best = d;
    }
  }
  return best ? Utilities.formatDate(best, WR_TZ, 'yyyy-MM-dd') : null;
}

/* Which tab holds the report leadership actually quotes. The board is
   checked against this, never sourced from it: the report holds rounded
   display strings like "53.05 L", while mdl_Payments holds the rupee. */
var WR_REPORT_TAB = 'Management Report';

/**
 * warRoomVsReport - READ ONLY. Writes nothing.
 *
 * Puts the board's figures next to the Management Report's, line by line,
 * and says PASS or MISMATCH on each. The two are computed independently -
 * the report by its own code, the board from mdl_Payments - so agreement
 * is real evidence rather than a claim.
 *
 * It also refuses to be fooled by a stale tab: it prints the report's own
 * "Report Dated" cell, so a frozen copy announces itself instead of
 * quietly passing.
 */
function warRoomVsReport() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(WR_REPORT_TAB);
  if (!sh) {
    Logger.log('Tab "' + WR_REPORT_TAB + '" not found. Set WR_REPORT_TAB to its exact name.');
    return;
  }

  /* Wide enough for the report's indented blocks - it runs to column L
     today, and a cap that clips the revenue column would compare against
     blanks and call everything a mismatch. */
  var grid = sh.getRange(1, 1, Math.min(sh.getLastRow(), 200),
                         Math.min(sh.getLastColumn(), 30)).getDisplayValues();
  var p = wr_build_('');
  var today = Utilities.formatDate(new Date(), WR_TZ, 'dd-MMM-yyyy');

  Logger.log('=== BOARD vs MANAGEMENT REPORT ===  ' + p.meta.generatedLabel);
  var dated = wr_findRight_(grid, 'Report Dated');
  Logger.log('  report says it was built : ' + (dated || '(no Report Dated cell)'));
  Logger.log('  today is                 : ' + today);
  if (dated && dated.indexOf(today.substring(0, 6)) === -1) {
    Logger.log('  *** THE REPORT ITSELF IS NOT FROM TODAY. Re-run whatever builds it');
    Logger.log('  *** before trusting anything below.');
  }
  Logger.log('');

  var fails = 0;
  function cmp(label, reportRaw, boardNum) {
    var r = wr_num_(wr_reportNum_(reportRaw));
    var b = Number(boardNum) || 0;
    /* The report rounds to two decimals in lakh, so 1,000 of slack is
       rounding, not disagreement. */
    var ok = Math.abs(r - b) <= Math.max(1000, Math.abs(b) * 0.001);
    if (!ok) fails++;
    Logger.log('  ' + (ok ? 'PASS     ' : 'MISMATCH ') + wr_pad_(label, 22) +
               wr_pad_('report ' + (reportRaw || '-'), 20) +
               'board ' + wr_money_(b) +
               (ok ? '' : '     <-- differs by ' + wr_money_(Math.abs(r - b))));
  }
  function cmpN(label, reportRaw, boardNum) {
    var r = wr_num_(reportRaw), b = Number(boardNum) || 0;
    var ok = (r === b);
    if (!ok) fails++;
    Logger.log('  ' + (ok ? 'PASS     ' : 'MISMATCH ') + wr_pad_(label, 22) +
               wr_pad_('report ' + (reportRaw || '-'), 20) + 'board ' + b);
  }

  cmp ('Total revenue',  wr_findRight_(grid, 'Total revenue'),  p.totals.revenue);
  cmp ('Committed For',  wr_findRight_(grid, 'Committed For'),  p.totals.target);
  cmpN('Units',          wr_findRight_(grid, 'Units'),          p.totals.units);
  Logger.log('');

  Logger.log('  BY CITY');
  p.cities.forEach(function (c) {
    cmp(c.name, wr_revenueOf_(wr_findRow_(grid, c.name)), c.revenue);
  });
  Logger.log('');

  Logger.log('  BY MANAGER');
  p.managers.forEach(function (m) {
    cmp(m.name, wr_revenueOf_(wr_findRow_(grid, m.name)), m.revenue);
  });

  Logger.log('');
  if (fails) {
    Logger.log('  === ' + fails + ' LINE(S) DISAGREE ===');
    Logger.log('  Both read the same workbook, so a mismatch means one of them ran');
    Logger.log('  against older data. Run updateAndCheck, rebuild the report, then');
    Logger.log('  run this again. If it still disagrees, send me this log.');
  } else {
    Logger.log('  === EVERY LINE AGREES ===');
    Logger.log('  The TV and the Management Report are showing the same numbers.');
  }
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/* The cell to the right of a label, anywhere in the grid. Labels on the
   report carry the month - "Committed For Sep", not "Committed For" - so
   these are matched on the opening words. Names never are: a prefix match
   would hand Saeed's line to a "Saeed Khan". */
function wr_findRight_(grid, label) {
  var row = wr_findRow_(grid, label, true);
  if (!row) return '';
  for (var i = row._at + 1; i < row.length; i++) {
    if (String(row[i]).trim()) return String(row[i]).trim();
  }
  return '';
}

/* The first row carrying this label, tagged with the column it sat in.
   Exact match always wins; prefixOk then allows "Committed For Sep" to
   answer to "Committed For". */
function wr_findRow_(grid, label, prefixOk) {
  var want = String(label).trim().toLowerCase();
  var loose = null;
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      var cell = String(grid[r][c]).trim().toLowerCase();
      if (cell === want) { var row = grid[r].slice(); row._at = c; return row; }
      if (prefixOk && !loose && cell.indexOf(want) === 0) {
        loose = grid[r].slice(); loose._at = c;
      }
    }
  }
  return loose;
}

/* The revenue cell on a city or manager line. The report indents its
   blocks, so the label is not in column 0 - both blocks run
   Name | Agents | Revenue, so revenue sits two right of wherever the name
   was found. If that cell is empty, scan on for the first lakh or crore
   figure rather than silently comparing against a blank. */
function wr_revenueOf_(row) {
  if (!row) return '';
  var at = row._at;
  var direct = String(row[at + 2] == null ? '' : row[at + 2]).trim();
  if (direct) return direct;
  for (var i = at + 1; i < row.length; i++) {
    var v = String(row[i] == null ? '' : row[i]).trim();
    if (/\d/.test(v) && /\b(l|cr)\b/i.test(v)) return v;
  }
  return '';
}

/* "53.05 L" -> 5305000, "1.02 cr" -> 10200000, "4,865,206" -> 4865206. */
function wr_reportNum_(s) {
  var t = String(s == null ? '' : s).trim().toLowerCase();
  if (!t) return 0;
  var n = wr_num_(t);
  if (/\bcr\b/.test(t)) return n * 10000000;
  if (/\bl\b/.test(t))  return n * 100000;
  return n;
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
  var keepEx = WR_CONTEST.excludeProduct, keepOnly = WR_CONTEST.onlyProduct;
  WR_CONTEST.excludeProduct = ''; WR_CONTEST.onlyProduct = '';
  eq('the live rule bars nothing',        wr_progFiltering_(), false);
  eq('AIAP counts',                       wr_progMatches_('AIAP C14'), true);
  eq('AI Bootcamp counts too',            wr_progMatches_('AI Bootcamp'), true);
  eq('a Mastermind lead counts',          wr_progMatches_('Mastermind'), true);
  eq('an Unattributed lead counts',       wr_progMatches_('Unattributed'), true);
  eq('a blank cell counts',               wr_progMatches_(''), true);
  eq('a null cell counts',                wr_progMatches_(null), true);
  eq('Fahad Nizar 10,000 counts',         wr_progMatches_('AIAP C15'), true);
  eq('Kshitij 28,500 counts',             wr_progMatches_('AIAP C13+'), true);

  /* onlyProduct - "any payments of accelerator" */
  WR_CONTEST.onlyProduct = 'accel';
  eq('onlyProduct turns filtering on',    wr_progFiltering_(), true);
  eq('AI Accelerator counts',             wr_progMatches_('AI Accelerator'), true);
  eq('accelerator lower case counts',     wr_progMatches_('accelerator c14'), true);
  eq('Bootcamp is dropped',               wr_progMatches_('AI Bootcamp'), false);
  eq('Mastermind is dropped',             wr_progMatches_('Mastermind'), false);
  eq('a blank is dropped when only= is set', wr_progMatches_(''), false);
  WR_CONTEST.onlyProduct = '';

  /* excludeProduct - bar one product, keep the rest */
  WR_CONTEST.excludeProduct = 'bootcamp';
  eq('excludeProduct bars Bootcamp',      wr_progMatches_('AI Bootcamp'), false);
  eq('and AIAP still counts',             wr_progMatches_('AIAP C14'), true);
  eq('a blank is not the barred product', wr_progMatches_(''), true);
  WR_CONTEST.excludeProduct = keepEx; WR_CONTEST.onlyProduct = keepOnly;

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


/* ============================================================
   warRoomWhoIsMissing - why is a team blank, and who are these
   off-roster names?

   Two questions the preview raises but cannot answer. A manager showing
   zero is either a genuinely quiet fortnight or a name that does not line
   up between mdl_Roster and mdl_Payments, and those two want opposite
   responses. Same for the off-roster money: some of it is real outside
   business, and some of it is a roster agent spelled differently.

   mdl_Payments carries its own Manager and Office columns, so a payment
   row already states which team it belongs to. Where that disagrees with
   the roster, the row says so itself and there is nothing to guess at.

   READ ONLY. Touches mdl_Payments and mdl_Roster and nothing else, writes
   nowhere, and never opens CBC or the Payment Tracker.
   ============================================================ */
function warRoomWhoIsMissing() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) { Logger.log('mdl_Payments not found or empty'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  var cDate = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cName = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt  = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit = wr_col_(H, ['is unit', 'unit', 'units']);
  var cMgr  = wr_col_(H, ['manager', 'reporting manager', 'tl']);
  var cOff  = wr_col_(H, ['office', 'city', 'location', 'branch']);
  var cType = wr_col_(H, ['payment type']);
  var cBatch= wr_col_(H, ['batch']);
  var cFam  = wr_col_(H, ['batch family']);
  var cSeg  = wr_col_(H, ['segment']);
  if (cDate < 0 || cName < 0) { Logger.log('no date or owner column'); return; }

  var roster = wr_roster_(ss, monthKey);
  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  Logger.log('=== WHO IS MISSING ===   ' + monthKey +
             '   (read only, nothing is written)');
  Logger.log('');

  /* ---- gather this month's payments by owner name ---- */
  var payBy = {};
  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKeyOf_(d) !== monthKey) continue;
    var nm = wr_str_(grid[r][cName]);
    var mgrRaw = cMgr >= 0 ? wr_str_(grid[r][cMgr]) : '';
    var offRaw = cOff >= 0 ? wr_str_(grid[r][cOff]) : '';
    if (!nm || wr_isSummaryRow_(nm, mgrRaw, offRaw)) continue;
    var k = wr_key_(nm);
    if (!payBy[k]) payBy[k] = { name: nm, rev: 0, units: 0, rows: 0,
                                mgrs: {}, offs: {}, types: {}, fams: {},
                                segs: {}, batches: {}, sample: [] };
    var P = payBy[k];
    P.rows++;
    P.rev += wr_num_(grid[r][cAmt]);
    P.units += (cUnit >= 0 && wr_truthy_(grid[r][cUnit])) ? 1 : 0;
    if (mgrRaw) P.mgrs[mgrRaw] = (P.mgrs[mgrRaw] || 0) + 1;
    if (offRaw) P.offs[offRaw] = (P.offs[offRaw] || 0) + 1;
    if (cType >= 0) { var t = wr_str_(grid[r][cType]); if (t) P.types[t] = (P.types[t] || 0) + 1; }
    if (cFam  >= 0) { var f = wr_str_(grid[r][cFam]);  if (f) P.fams[f]  = (P.fams[f]  || 0) + 1; }
    if (cSeg  >= 0) { var g = wr_str_(grid[r][cSeg]);  if (g) P.segs[g]  = (P.segs[g]  || 0) + 1; }
    if (cBatch>= 0) { var b = wr_str_(grid[r][cBatch]);if (b) P.batches[b]=(P.batches[b]||0)+ 1; }
    if (P.sample.length < 4) {
      P.sample.push(Utilities.formatDate(d, WR_TZ, 'dd MMM') + '  ' +
                    wr_money_(wr_num_(grid[r][cAmt])) +
                    (cType  >= 0 ? '  ' + wr_str_(grid[r][cType])  : '') +
                    (cBatch >= 0 ? '  batch ' + wr_str_(grid[r][cBatch]) : ''));
    }
  }

  /* ---- 1. teams reading zero ---- */
  var byMgr = {};
  for (var ak in roster.byAgent) {
    var a = roster.byAgent[ak];
    var m = a.manager || '(no manager)';
    if (!byMgr[m]) byMgr[m] = [];
    byMgr[m].push(a);
  }
  Logger.log('  TEAMS WITH NO REVENUE THIS MONTH');
  var anySilent = false;
  for (var mgr in byMgr) {
    var team = byMgr[mgr], teamRev = 0;
    for (var i = 0; i < team.length; i++) {
      var pk = wr_key_(team[i].name);
      if (payBy[pk]) teamRev += payBy[pk].rev;
    }
    if (teamRev > 0) continue;
    anySilent = true;
    Logger.log('    ' + mgr + '   ' + team.length + ' agents, nothing matched');
    for (var j = 0; j < team.length; j++) {
      var nm2 = team[j].name, k2 = wr_key_(nm2);
      var near = wr_nearestPayName_(k2, payBy);
      Logger.log('      ' + wr_pad_(nm2, 26) +
                 (payBy[k2] ? 'has payments (so revenue is genuinely 0)'
                            : near ? 'NO EXACT MATCH  ->  closest in payments: "' + near.name +
                                     '"  ' + wr_money_(near.rev) + '  ' + near.units + 'u'
                                   : 'no payment row at all this month'));
    }
  }
  if (!anySilent) Logger.log('    none - every team has revenue');
  Logger.log('');

  /* ---- 2. off-roster money, biggest first ---- */
  var off = [];
  for (var pk2 in payBy) {
    if (roster.byAgent[pk2]) continue;
    off.push(payBy[pk2]);
  }
  off.sort(function (a, b) { return b.rev - a.rev; });
  Logger.log('  PAID BUT NOT ON THE ROSTER   (' + off.length + ' names)');
  Logger.log('    these are in the company total but on no city, manager or agent board');
  for (var o = 0; o < off.length && o < 15; o++) {
    var P2 = off[o];
    var nearR = wr_nearestRosterName_(wr_key_(P2.name), roster);
    Logger.log('');
    Logger.log('    ' + wr_pad_(P2.name, 24) + wr_pad_(wr_money_(P2.rev), 11) +
               P2.units + 'u in ' + P2.rows + ' rows');
    Logger.log('      payments say manager : ' + wr_topKeys_(P2.mgrs));
    Logger.log('      payments say office  : ' + wr_topKeys_(P2.offs));
    if (cSeg  >= 0) Logger.log('      segment              : ' + wr_topKeys_(P2.segs));
    if (cFam  >= 0) Logger.log('      batch family         : ' + wr_topKeys_(P2.fams));
    if (cType >= 0) Logger.log('      payment type         : ' + wr_topKeys_(P2.types));
    if (nearR) {
      Logger.log('      *** looks like roster agent "' + nearR.name + '" (' +
                 (nearR.manager || 'no manager') + ')');
      Logger.log('          roster spells it   : ' + nearR.name);
      Logger.log('          payments spell it  : ' + P2.name);
      Logger.log('          difference         : ' + wr_nameDiff_(nearR.name, P2.name));
      Logger.log('          if those look the same to you, check for a trailing space');
      Logger.log('          or a double space - this compares every character.');
    }
    for (var s = 0; s < P2.sample.length; s++) Logger.log('      eg  ' + P2.sample[s]);
  }
  if (off.length > 15) Logger.log('');
  if (off.length > 15) Logger.log('    ... and ' + (off.length - 15) + ' more, smaller');
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/* closest payment name to a roster key, for spotting spelling drift */
function wr_nearestPayName_(key, payBy) {
  var best = null, bestScore = 0;
  for (var k in payBy) {
    var sc = wr_nameScore_(key, k);
    if (sc > bestScore) { bestScore = sc; best = payBy[k]; }
  }
  return bestScore >= 0.72 ? best : null;
}

/* closest roster agent to a payment key, and why it matched */
function wr_nearestRosterName_(key, roster) {
  var best = null, bestScore = 0;
  for (var k in roster.byAgent) {
    var sc = wr_nameScore_(key, k);
    if (sc > bestScore) { bestScore = sc; best = roster.byAgent[k]; }
  }
  if (bestScore < 0.72 || !best) return null;
  return { name: best.name, manager: best.manager, score: bestScore };
}

/* Show WHERE two names differ, in their own spelling, so nobody has to
   take the match on trust. An earlier version reported the reason from
   the score band, which labelled a two-character spelling difference as
   containment - it described its own arithmetic instead of the names.
   This quotes the characters. */
function wr_nameDiff_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return 'identical';
  var i = 0;
  while (i < a.length && i < b.length && a.charAt(i) === b.charAt(i)) i++;
  var j = 0;
  while (j < a.length - i && j < b.length - i &&
         a.charAt(a.length - 1 - j) === b.charAt(b.length - 1 - j)) j++;
  var midA = a.substring(i, a.length - j);
  var midB = b.substring(i, b.length - j);
  var head = a.substring(0, i), tail = a.substring(a.length - j);
  if (!midA && !midB) return 'identical';
  return head + '[' + (midA || '-') + '|' + (midB || '-') + ']' + tail +
         '   (first spelling is the roster, second is payments)';
}

/* 1 identical, ~0.9 containment, otherwise similarity by edit distance.
   Deliberately blunt: this only ever SUGGESTS a match in a log for a human
   to judge. Nothing on the board is matched this way. */
function wr_nameScore_(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0)) return 0.9;
  var la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 4) return 0;
  var prev = [], cur = [], i, j;
  for (j = 0; j <= lb; j++) prev[j] = j;
  for (i = 1; i <= la; i++) {
    cur[0] = i;
    for (j = 1; j <= lb; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                        prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    }
    for (j = 0; j <= lb; j++) prev[j] = cur[j];
  }
  return 1 - (prev[lb] / Math.max(la, lb));
}

/* "Saboo x12, Prasanth x3" - what a set of values actually contains */
function wr_topKeys_(obj) {
  var a = [];
  for (var k in obj) a.push({ k: k, n: obj[k] });
  if (!a.length) return '(blank)';
  a.sort(function (x, y) { return y.n - x.n; });
  var s = [];
  for (var i = 0; i < a.length && i < 4; i++) s.push(a[i].k + ' x' + a[i].n);
  if (a.length > 4) s.push('+' + (a.length - 4) + ' more');
  return s.join(', ');
}


/* ============================================================
   warRoomBatches - what product is each sale, really?

   The contest counts Accelerator only, and the board currently counts
   everything, because nothing has ever positively identified the product.
   Guessing once cost two real sales: "Batch Family" looked like the
   product column and is in fact the lead's source campaign, so filtering
   on it threw away an Accelerator sale to a Mastermind-sourced lead.

   The Batch column looks like the real answer - BC17, EBC4, CL WS IND,
   166 - but "looks like" is exactly what went wrong last time. So this
   function does not decide anything. It tabulates every batch code
   against its family and segment and lets you read the mapping off real
   revenue, and it prints the exact config line for whatever you conclude.

   READ ONLY. mdl_Payments and mdl_Roster, writes nowhere, never opens
   CBC or the Payment Tracker.
   ============================================================ */
function warRoomBatches() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) { Logger.log('mdl_Payments not found or empty'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  var cDate = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cName = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt  = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit = wr_col_(H, ['is unit', 'unit', 'units']);
  var cMgr  = wr_col_(H, ['manager', 'reporting manager', 'tl']);
  var cOff  = wr_col_(H, ['office', 'city', 'location', 'branch']);
  var cBatch= wr_col_(H, ['batch']);
  var cFam  = wr_col_(H, ['batch family']);
  var cSeg  = wr_col_(H, ['segment']);
  if (cDate < 0 || cName < 0 || cBatch < 0) {
    Logger.log('need Date, Lead Owner and Batch columns; Batch found: ' + (cBatch >= 0));
    return;
  }

  var roster = wr_roster_(ss, monthKey);
  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var byBatch = {}, byClass = {};
  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKeyOf_(d) !== monthKey) continue;
    var nm = wr_str_(grid[r][cName]);
    var mgrRaw = cMgr >= 0 ? wr_str_(grid[r][cMgr]) : '';
    var offRaw = cOff >= 0 ? wr_str_(grid[r][cOff]) : '';
    if (!nm || wr_isSummaryRow_(nm, mgrRaw, offRaw)) continue;

    var onRoster = !!roster.byAgent[wr_key_(nm)];
    var batch = wr_str_(grid[r][cBatch]) || '(blank)';
    var fam   = cFam >= 0 ? (wr_str_(grid[r][cFam]) || '(blank)') : '';
    var seg   = cSeg >= 0 ? (wr_str_(grid[r][cSeg]) || '(blank)') : '';
    var amt   = wr_num_(grid[r][cAmt]);
    var unit  = (cUnit >= 0 && wr_truthy_(grid[r][cUnit])) ? 1 : 0;

    if (!byBatch[batch]) byBatch[batch] = { batch: batch, rows: 0, rev: 0, units: 0,
                                            onRows: 0, onRev: 0, onUnits: 0, fams: {}, segs: {} };
    var B = byBatch[batch];
    B.rows++; B.rev += amt; B.units += unit;
    if (onRoster) { B.onRows++; B.onRev += amt; B.onUnits += unit; }
    if (fam) B.fams[fam] = (B.fams[fam] || 0) + 1;
    if (seg) B.segs[seg] = (B.segs[seg] || 0) + 1;

    var cls = wr_batchClass_(batch);
    if (!byClass[cls]) byClass[cls] = { rows: 0, rev: 0, units: 0, onRev: 0, onUnits: 0, codes: {} };
    var C = byClass[cls];
    C.rows++; C.rev += amt; C.units += unit;
    if (onRoster) { C.onRev += amt; C.onUnits += unit; }
    C.codes[batch] = (C.codes[batch] || 0) + 1;
  }

  Logger.log('=== BATCHES ===   ' + monthKey + '   (read only, nothing is written)');
  Logger.log('  "on board" = the roster agents the TV actually shows.');
  Logger.log('');
  Logger.log('  BY BATCH CODE SHAPE   <-- this is the one to read');
  Logger.log('    ' + wr_pad_('shape', 20) + wr_pad_('on board', 12) + wr_pad_('units', 7) +
             wr_pad_('all rows', 12) + 'example codes');
  var classes = [];
  for (var cl in byClass) classes.push({ k: cl, v: byClass[cl] });
  classes.sort(function (a, b) { return b.v.onRev - a.v.onRev; });
  for (var i = 0; i < classes.length; i++) {
    var V = classes[i].v;
    Logger.log('    ' + wr_pad_(classes[i].k, 20) +
               wr_pad_(wr_money_(V.onRev), 12) + wr_pad_(String(V.onUnits), 7) +
               wr_pad_(wr_money_(V.rev), 12) + wr_topKeys_(V.codes));
  }
  Logger.log('');

  var list = [];
  for (var b2 in byBatch) list.push(byBatch[b2]);
  list.sort(function (a, b) { return b.onRev - a.onRev; });
  Logger.log('  EVERY BATCH CODE, biggest on-board revenue first');
  Logger.log('    ' + wr_pad_('batch', 14) + wr_pad_('on board', 12) + wr_pad_('units', 7) +
             wr_pad_('family', 22) + 'segment');
  for (var j = 0; j < list.length && j < 40; j++) {
    var L = list[j];
    Logger.log('    ' + wr_pad_(L.batch, 14) + wr_pad_(wr_money_(L.onRev), 12) +
               wr_pad_(String(L.onUnits), 7) + wr_pad_(wr_topKeys_(L.fams), 22) +
               wr_topKeys_(L.segs));
  }
  if (list.length > 40) Logger.log('    ... and ' + (list.length - 40) + ' more codes');
  Logger.log('');

  Logger.log('  IF YOU WANT THE CONTEST TO COUNT ACCELERATOR ONLY');
  Logger.log('    Decide from the table above which shapes are Accelerator, then set');
  Logger.log('    in WR_CONTEST:');
  Logger.log('      productColumn : \'Batch\'');
  Logger.log('      excludeBatchPrefixes : [\'BC\', \'EBC\', \'CL WS\']     <-- edit to match');
  Logger.log('    Nothing is filtered until you set it. Every unit counts today.');
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/* Group batch codes by shape, not by guessing at meaning: "BC12" and
   "BC13B" are one shape, "165" and "166" another. The shapes are what a
   human can then map to products. */
function wr_batchClass_(batch) {
  var t = String(batch || '').trim();
  if (!t) return '(blank)';
  if (/^\d+$/.test(t)) return 'plain number';
  var m = t.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*)/);
  if (!m) return 'other';
  return m[1].toUpperCase().replace(/\s+/g, ' ') + '*';
}


/* ============================================================
   warRoomContestWhatIf - see the exclusion before you commit to it

   Barring a product changes who wins money, so it should never be
   switched on blind. This builds the contest board twice, once as
   configured and once with a proposed exclusion list, and shows the
   difference per agent: who drops, who moves up, and what the ladder
   pays either way.

   Edit TRY below, run it, read it. It changes no setting - the live
   config is restored before it returns, including if it throws.

   READ ONLY. Writes nowhere, never opens CBC or the Payment Tracker.
   ============================================================ */
function warRoomContestWhatIf() {

  /* -------- edit this, then run -------- */
  var TRY = ['BC', 'EBC', 'CL WS'];
  /* ------------------------------------- */

  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var was = WR_CONTEST.excludeBatchPrefixes;
  var before, after;
  try {
    WR_CONTEST.excludeBatchPrefixes = [];
    before = wr_contestBoard_(ss, monthKey);
    WR_CONTEST.excludeBatchPrefixes = TRY;
    after  = wr_contestBoard_(ss, monthKey);
  } finally {
    WR_CONTEST.excludeBatchPrefixes = was;   // never leave the config changed
  }

  Logger.log('=== CONTEST WHAT IF ===   ' + WR_CONTEST.name + '   ' +
             WR_CONTEST.from + ' to ' + WR_CONTEST.to);
  Logger.log('  proposal: bar batch codes starting with  ' + TRY.join(', '));
  Logger.log('  (prefix, not substring - EBC4 is not barred by a BC rule)');
  Logger.log('');
  if (!after.colFound) {
    Logger.log('  *** NO BATCH COLUMN FOUND in ' + WR_PAY_TAB + '.');
    Logger.log('      Nothing would be barred. Check the header spelling.');
    return;
  }
  Logger.log('  units counted : ' + before.units + '   ->   ' + after.units +
             '   (' + (before.units - after.units) + ' barred)');
  Logger.log('  payout        : ' + wr_money_(before.payout) + '   ->   ' +
             wr_money_(after.payout));
  Logger.log('');

  var names = {}, k;
  for (k in before.byAgent) names[k] = true;
  for (k in after.byAgent)  names[k] = true;
  var rows = [];
  for (k in names) {
    var b = before.byAgent[k] || { name: k, units: 0, rev: 0 };
    var a = after.byAgent[k]  || { name: b.name, units: 0, rev: 0 };
    rows.push({ name: b.name || a.name, bu: b.units, au: a.units,
                br: b.rev, ar: a.rev,
                bp: wr_ladderPays_(b.units), ap: wr_ladderPays_(a.units) });
  }
  rows.sort(function (x, y) { return (y.bu - y.au) - (x.bu - x.au) || y.bu - x.bu; });

  Logger.log('  WHO IS AFFECTED   (biggest change first)');
  Logger.log('    ' + wr_pad_('agent', 24) + wr_pad_('units', 12) +
             wr_pad_('ladder pays', 20) + 'barred revenue');
  var shown = 0;
  for (var i = 0; i < rows.length; i++) {
    var R = rows[i];
    if (R.bu === R.au) continue;
    shown++;
    Logger.log('    ' + wr_pad_(R.name, 24) +
               wr_pad_(R.bu + ' -> ' + R.au, 12) +
               wr_pad_(wr_money_(R.bp) + ' -> ' + wr_money_(R.ap), 20) +
               wr_money_(R.br - R.ar));
  }
  if (!shown) Logger.log('    nobody - the exclusion changes nothing');
  Logger.log('');
  Logger.log('  UNCHANGED');
  for (var j = 0; j < rows.length; j++) {
    if (rows[j].bu !== rows[j].au || !rows[j].au) continue;
    Logger.log('    ' + wr_pad_(rows[j].name, 24) + rows[j].au + 'u   ' +
               wr_money_(rows[j].ar) + '   pays ' + wr_money_(rows[j].ap));
  }
  Logger.log('');
  /* The whole point: an exclusion is judged on the rows it actually
     drops, not on an average. Averages hid that this proposal bars a
     1.52 L unit alongside a 9,405 one. */
  Logger.log('  EVERY UNIT THIS WOULD BAR   (check these are really not Accelerator)');
  Logger.log('    ' + wr_pad_('agent', 24) + wr_pad_('date', 8) + wr_pad_('amount', 11) +
             wr_pad_('batch', 13) + wr_pad_('family', 15) + wr_pad_('segment', 15) + 'payment type');
  var bar = after.barred.slice(0).sort(function (x, y) { return y.amt - x.amt; });
  for (var q = 0; q < bar.length; q++) {
    var Bq = bar[q];
    Logger.log('    ' + wr_pad_(Bq.name, 24) + wr_pad_(Bq.day, 8) +
               wr_pad_(wr_money_(Bq.amt), 11) + wr_pad_(Bq.batch, 13) +
               wr_pad_(Bq.fam, 15) + wr_pad_(Bq.seg, 15) + Bq.type);
  }
  if (!bar.length) Logger.log('    none');
  Logger.log('');
  Logger.log('  To apply it, set in WR_CONTEST:');
  Logger.log('      excludeBatchPrefixes: [' +
             TRY.map(function (t) { return "'" + t + "'"; }).join(', ') + ']');
  Logger.log('  Nothing was written. This only reports.');
}

/* The contest board on its own, so it can be built twice and compared.
   Same window, same countMode and same exclusions as the live board. */
function wr_contestBoard_(ss, monthKey) {
  var out = { byAgent: {}, units: 0, rev: 0, payout: 0, colFound: false, barred: [] };
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) return out;
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  var cDate = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cName = wr_col_(H, ['lead owner', 'agent', 'owner', 'agent name', 'name']);
  var cAmt  = wr_col_(H, ['amount paid', 'amount', 'amount inr', 'paid amount']);
  var cUnit = wr_col_(H, ['is unit', 'unit', 'units']);
  var cMgr  = wr_col_(H, ['manager', 'reporting manager', 'tl']);
  var cOff  = wr_col_(H, ['office', 'city', 'location', 'branch']);
  var cRef  = wr_col_(H, ['is refund', 'refund']);
  var cStat = wr_col_(H, ['status']);
  var cBat  = wr_col_(H, ['batch']);
  var cFam  = wr_col_(H, ['batch family']);
  var cSeg  = wr_col_(H, ['segment']);
  var cType = wr_col_(H, ['payment type']);
  out.colFound = cBat >= 0;
  if (cDate < 0 || cName < 0) return out;

  var roster = wr_roster_(ss, monthKey);
  var from = wr_dayNum_(WR_CONTEST.from), to = wr_dayNum_(WR_CONTEST.to);
  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    var day = wr_dayNumOf_(d);
    if (day < from || day > to) continue;
    var nm = wr_str_(grid[r][cName]);
    var mgrRaw = cMgr >= 0 ? wr_str_(grid[r][cMgr]) : '';
    var offRaw = cOff >= 0 ? wr_str_(grid[r][cOff]) : '';
    if (!nm || wr_isSummaryRow_(nm, mgrRaw, offRaw)) continue;
    var key = wr_key_(nm);
    if (!roster.byAgent[key]) continue;                        // roster agents only
    /* Exactly the live board's test, not a parallel one: a status
       containing "cancel" is out, and so is Is Refund. Keeping the two
       in step matters more than keeping this function short. */
    if (cRef >= 0 && wr_truthy_(grid[r][cRef])) continue;
    var statusTxt = (cStat >= 0) ? String(grid[r][cStat] || '').trim().toLowerCase() : '';
    if (statusTxt.indexOf('cancel') > -1) continue;
    var isUnit = (cUnit >= 0 && wr_truthy_(grid[r][cUnit])) ? 1 : 0;
    var counts = (WR_CONTEST.countMode === 'payments') ? 1 : isUnit;
    if (!counts) continue;

    /* Barred AFTER the counting tests, so the list holds only rows that
       would really have paid out. A row dropped for being a refund or a
       balance was never in the contest and does not belong in a list of
       what an exclusion costs. */
    if (!wr_progMatches_(cBat >= 0 ? grid[r][cBat] : '')) {
      out.barred.push({
        name: nm, day: Utilities.formatDate(d, WR_TZ, 'dd MMM'),
        amt: wr_num_(grid[r][cAmt]),
        batch: cBat >= 0 ? wr_str_(grid[r][cBat]) : '',
        fam: cFam >= 0 ? wr_str_(grid[r][cFam]) : '',
        seg: cSeg >= 0 ? wr_str_(grid[r][cSeg]) : '',
        type: cType >= 0 ? wr_str_(grid[r][cType]) : ''
      });
      continue;
    }
    if (!out.byAgent[key]) out.byAgent[key] = { name: nm, units: 0, rev: 0 };
    out.byAgent[key].units += counts;
    out.byAgent[key].rev   += wr_num_(grid[r][cAmt]);
    out.units += counts;
    out.rev   += wr_num_(grid[r][cAmt]);
  }
  for (var k in out.byAgent) out.payout += wr_ladderPays_(out.byAgent[k].units);
  return out;
}

/* The published ladder: 2 -> 1,000, 3 -> 1,500, 4 -> 2,500, 5+ -> 1,000
   per unit with no cap. Below 2 pays nothing. */
function wr_ladderPays_(units) {
  var u = Number(units) || 0;
  if (u < 2) return 0;
  if (u === 2) return 1000;
  if (u === 3) return 1500;
  if (u === 4) return 2500;
  return u * 1000;
}


/* ============================================================
   warRoomAutoUpdate - what is actually keeping this sheet fresh?

   Three clocks decide how old a number on the TV is: how often
   IMPORTRANGE pulls from the Payment Tracker and CBC, how often this
   project rebuilds the model tabs, and how long the feed caches. Only
   the middle one is yours to set, and it is the one nobody can see,
   because triggers live in the project settings rather than in any file.

   So this lists them: every trigger, what it calls, and where the
   duplicates are. A handler with several clock triggers on it is doing
   the same work several times over and burning the daily runtime quota
   for nothing.

   READ ONLY. It reads the trigger list and the two model tabs. It
   creates no trigger, deletes none, writes to no sheet, and never opens
   CBC or the Payment Tracker.
   ============================================================ */
function warRoomAutoUpdate() {
  Logger.log('=== AUTO UPDATE ===   ' +
             Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm') + ' IST');
  Logger.log('  (read only - no trigger is created, changed or deleted here)');
  Logger.log('');

  /* ---- 1. the triggers ---- */
  var trigs = [];
  try {
    trigs = ScriptApp.getProjectTriggers();
  } catch (e) {
    Logger.log('  Could not read the trigger list: ' + e.message);
    Logger.log('  Run it once from the editor and accept the permission prompt.');
    return;
  }

  var byHandler = {};
  for (var i = 0; i < trigs.length; i++) {
    var h = trigs[i].getHandlerFunction();
    var src = String(trigs[i].getTriggerSource());
    if (!byHandler[h]) byHandler[h] = { clock: 0, sheet: 0, other: 0 };
    if (src.indexOf('CLOCK') > -1) byHandler[h].clock++;
    else if (src.indexOf('SPREADSHEET') > -1) byHandler[h].sheet++;
    else byHandler[h].other++;
  }

  Logger.log('  TRIGGERS   (' + trigs.length + ' in this project)');
  if (!trigs.length) {
    Logger.log('    NONE. Nothing rebuilds the model tabs on its own, so the');
    Logger.log('    sheet only updates when somebody runs it by hand.');
  }
  var dupes = [];
  var names = [];
  for (var k in byHandler) names.push(k);
  names.sort();
  for (var n = 0; n < names.length; n++) {
    var H = byHandler[names[n]], total = H.clock + H.sheet + H.other;
    var bits = [];
    if (H.clock) bits.push(H.clock + ' on a timer');
    if (H.sheet) bits.push(H.sheet + ' on sheet edits');
    if (H.other) bits.push(H.other + ' other');
    Logger.log('    ' + wr_pad_(names[n], 30) + bits.join(', ') +
               (total > 1 ? '   <-- ' + total + ' triggers on ONE function' : ''));
    if (total > 1) dupes.push(names[n] + ' x' + total);
  }
  if (dupes.length) {
    Logger.log('');
    Logger.log('    *** DUPLICATES: ' + dupes.join(', '));
    Logger.log('        Each one runs the whole rebuild again. They do not make');
    Logger.log('        the sheet fresher, they just spend the daily runtime');
    Logger.log('        quota faster, and when it runs out the sheet stops');
    Logger.log('        updating for the rest of the day.');
  }
  Logger.log('');

  /* ---- 2. how old the data actually is ---- */
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var latest = wr_latestPaymentDate_(ss);
  Logger.log('  FRESHNESS');
  Logger.log('    newest payment in ' + WR_PAY_TAB + ' : ' + (latest || 'none found'));
  Logger.log('    today                          : ' +
             Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM-dd'));
  Logger.log('    feed cache                     : ' + WR_CACHE_SECS +
             's, so the TV is at most ' + Math.ceil(WR_CACHE_SECS / 60) +
             ' min behind the sheet');
  Logger.log('');

  /* ---- 3. what to do ---- */
  Logger.log('  WHAT A HEALTHY SETUP LOOKS LIKE');
  Logger.log('    ONE time-driven trigger, on updateAndCheck, every 15 minutes.');
  Logger.log('    That is it. updateAndCheck guards against overlapping runs;');
  Logger.log('    calling refreshEverything directly skips that guard, so two');
  Logger.log('    runs can collide and leave a tab half written.');
  Logger.log('');
  Logger.log('    To set it up:  Triggers (the clock icon, left edge)');
  Logger.log('      - delete every existing rebuild trigger');
  Logger.log('      - Add Trigger -> updateAndCheck -> Time-driven');
  Logger.log('                    -> Minutes timer -> Every 15 minutes');
  Logger.log('');
  Logger.log('    IMPORTRANGE is not on your clock. Google refreshes it about');
  Logger.log('    hourly and there is no setting for it, so a payment entered');
  Logger.log('    in the Payment Tracker can take that long to reach this sheet');
  Logger.log('    no matter how often the rebuild runs.');
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

/* The most recent payment date in the sheet, as a plain yyyy-MM-dd
   string. Reads the date column alone. */
function wr_latestPaymentDate_(ss) {
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var H = wr_headers_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  var cDate = wr_col_(H, ['date', 'payment date', 'paid on']);
  if (cDate < 0) return null;
  var v = sh.getRange(2, cDate + 1, sh.getLastRow() - 1, 1).getValues();
  var best = null;
  for (var i = 0; i < v.length; i++) {
    var d = v[i][0];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best ? Utilities.formatDate(best, WR_TZ, 'yyyy-MM-dd') : null;
}
