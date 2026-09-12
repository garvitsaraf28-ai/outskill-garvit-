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

/* ---------------------------------------------------------------------
   THE RUNNING CONTEST

   A contest counts UNITS over a few days, not revenue over a month, so
   it needs its own window. Set the dates, save, and the TV picks it up
   within four minutes. Set active:false when it is over.

   programme: only rows whose programme/product cell contains this text
   are counted, so "accel" keeps Accelerator sales and drops Bootcamp.
   Leave it '' to count every unit. If the model has no programme column
   the feed says so, on screen and in warRoomPreview, rather than quietly
   counting things the contest excludes.
   --------------------------------------------------------------------- */
var WR_CONTEST = {
  active:    true,
  name:      'THE UNIT RUSH',
  from:      '2026-09-12',     // inclusive, Asia/Kolkata
  to:        '2026-09-14',     // inclusive
  programme: 'accel'
};

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
  var pay    = wr_payments_(ss, monthKey);

  /* ---- fold payments onto roster agents ---- */
  var agents = {};   // lowercase name -> record
  var k;

  for (k in roster.byAgent) {
    var r = roster.byAgent[k];
    agents[k] = {
      name: r.name, manager: r.manager, city: r.city, team: r.team,
      target: r.target, revenue: 0, units: 0
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
    if (!cities[cName]) cities[cName] = { name: cName, revenue: 0, units: 0, target: 0, agents: 0 };
    cities[cName].revenue += a.revenue;
    cities[cName].units   += a.units;
    cities[cName].target  += a.target;
    cities[cName].agents  += 1;

    var mName = a.manager || 'Unassigned';
    if (!managers[mName]) managers[mName] = {
      name: mName, city: a.city, team: a.team,
      revenue: 0, units: 0, target: 0, agents: 0, _teams: {}, _cities: {}
    };
    managers[mName].revenue += a.revenue;
    managers[mName].units   += a.units;
    managers[mName].target  += a.target;
    managers[mName].agents  += 1;
    if (a.team) managers[mName]._teams[a.team] = true;
    if (a.city) managers[mName]._cities[a.city] = true;

    var tName = a.team || 'Unassigned';
    if (!teams[tName]) teams[tName] = { name: tName, revenue: 0, units: 0, target: 0, agents: 0 };
    teams[tName].revenue += a.revenue;
    teams[tName].units   += a.units;
    teams[tName].target  += a.target;
    teams[tName].agents  += 1;
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
  var rosterRev = 0, rosterUnits = 0, target = 0;
  for (var c = 0; c < cityList.length; c++) {
    rosterRev   += cityList[c].revenue;
    rosterUnits += cityList[c].units;
    target      += cityList[c].target;
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
        target: wr_r2_(a.target), prevRank: a.prevRank
      };
    }),
    contest: wr_contest_(pay, roster),
    notes: wr_notes_(roster, pay, offRosterNames, offRosterRev)
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
    programme: WR_CONTEST.programme || '',
    /* If the contest excludes a programme but the model has no programme
       column, every unit is being counted. Say so rather than let a board
       quietly pay out on sales the rules exclude. */
    programmeFiltered: !!(WR_CONTEST.programme && pay.programmeCol),
    programmeColumnMissing: !!(WR_CONTEST.programme && !pay.programmeCol),
    totalUnits: pay.contestUnits,
    /* What the window holds before the programme rule is applied. If the
       rule is throwing away every single unit, that is almost always a
       filter pointed at the wrong column, not a quiet weekend - and a
       board frozen at zero during a contest is the worst failure there
       is, because it looks like nobody is selling. */
    unfilteredUnits: pay.contestUnfiltered,
    filterKillsEverything: !!(pay.contestUnits === 0 && pay.contestUnfiltered > 0),
    agents: list.slice(0, WR_MAX_AGENTS)
  };
}

function wr_slim_(x) {
  return {
    name: x.name, city: x.city, team: x.team,
    revenue: wr_r2_(x.revenue), units: x.units,
    target: wr_r2_(x.target), agents: x.agents
  };
}

/* =====================================================================
   READING mdl_Roster   (read only)
   ===================================================================== */

function wr_roster_(ss, monthKey) {
  var out = { byAgent: {}, count: 0, monthsSeen: {}, headers: [] };
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
    out.byAgent[key] = {
      name:    name,
      manager: mgrRaw,
      city:    wr_city_(cityRaw),
      team:    cTeam   >= 0 ? wr_team_(wr_str_(row[cTeam])) : '',
      target:  cTarget >= 0 ? wr_num_(row[cTarget])         : 0
    };
    out.count++;
  }
  return out;
}

/* =====================================================================
   READING mdl_Payments   (read only)
   ===================================================================== */

function wr_payments_(ss, monthKey) {
  var out = { byAgent: {}, rowsScanned: 0, rowsCounted: 0, headers: [], noRosterCol: false,
              contest: {}, contestUnits: 0, contestUnfiltered: 0, contestRows: 0, programmeCol: false };
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
  var cProg  = wr_col_(H, ['programme', 'program', 'product', 'course', 'offering', 'segment']);
  if (cRost < 0) out.noRosterCol = true;
  out.programmeCol = cProg >= 0;

  if (cDate < 0 || cAgent < 0 || cAmt < 0) return out;

  var width = Math.max(cDate, cAgent, cAmt, cUnit, cRost, cProg) + 1;
  var grid = sh.getRange(2, 1, lastRow - 1, width).getValues();

  /* the contest window, as day numbers so the comparison is a plain integer */
  var cFrom = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.from) : 0;
  var cTo   = WR_CONTEST.active ? wr_dayNum_(WR_CONTEST.to)   : 0;
  var want  = String(WR_CONTEST.programme || '').toLowerCase();

  for (var r = 0; r < grid.length; r++) {
    var row = grid[r];
    var d = row[cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;

    var name = wr_str_(row[cAgent]);
    if (!name || wr_isSummary_(name)) continue;   // totals rows are not people
    var key = wr_key_(name);
    var isUnit = (cUnit >= 0 && wr_truthy_(row[cUnit]));

    /* --- the month-to-date boards --- */
    if (wr_monthKey_(d) === monthKey) {
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
      if (!isUnit) continue;                       // the contest counts units only
      out.contestUnfiltered++;                     // what the window holds before the rule
      if (want && cProg >= 0 &&
          String(row[cProg] || '').toLowerCase().indexOf(want) === -1) continue;
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

function wr_notes_(roster, pay, offNames, offRev) {
  var notes = [];
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
  Logger.log('    agents           : ' + p.totals.agents);
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
               wr_pad_(wr_money_(m.revenue), 12) + 'target ' + wr_money_(m.target));
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
    Logger.log('    units counted    : ' + p.contest.totalUnits +
               '   (window holds ' + p.contest.unfilteredUnits + ' before the programme rule)');
    if (p.contest.filterKillsEverything) {
      Logger.log('    *** the programme rule is discarding EVERY unit in the window.');
      Logger.log('    *** That is almost certainly the wrong column. Run warRoomColumns');
      Logger.log('    *** to see which column actually names the programme.');
    }
    if (p.contest.programmeColumnMissing) {
      Logger.log('    *** WARNING: the contest excludes all but "' + p.contest.programme +
                 '", but mdl_Payments has no programme/product column.');
      Logger.log('    *** EVERY unit is being counted, including the ones the rules exclude.');
      Logger.log('    *** Add the column, or set WR_CONTEST.programme to \'\' and judge by hand.');
    } else if (p.contest.programmeFiltered) {
      Logger.log('    filtered to      : programme contains "' + p.contest.programme + '"');
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
 * warRoomColumns - READ ONLY. Writes nothing.
 *
 * Which column actually tells Accelerator from Bootcamp? The contest
 * filter is only as good as that answer, and guessing it wrong means the
 * board reads zero all weekend while people are closing.
 *
 * Prints every distinct value in each candidate column for this month,
 * with how many UNITS sit behind each one. Whichever list contains
 * something like "Accelerator" is the column to filter on - put its
 * header in WR_PROG_COLS and the matching text in WR_CONTEST.programme.
 */
function warRoomColumns() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var sh = ss.getSheetByName(WR_PAY_TAB);
  if (!sh) { Logger.log('mdl_Payments not found'); return; }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var H = wr_headers_(head);
  var cDate = wr_col_(H, ['date', 'payment date', 'paid on']);
  var cUnit = wr_col_(H, ['is unit', 'unit', 'units']);

  Logger.log('=== WAR ROOM COLUMNS ===  ' + Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  Logger.log('  looking at every ' + monthKey + ' row in mdl_Payments');
  Logger.log('');

  /* the columns that could plausibly name a programme */
  var want = ['segment', 'batch family', 'batch', 'team', 'payment type', 'status', 'origin month'];
  var cols = [];
  for (var w = 0; w < want.length; w++) {
    if (H[want[w]] !== undefined) cols.push({ name: head[H[want[w]]], idx: H[want[w]] });
  }
  if (!cols.length) { Logger.log('  none of the candidate columns exist'); return; }

  var grid = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var tally = {};
  cols.forEach(function (c) { tally[c.name] = {}; });
  var monthRows = 0, monthUnits = 0;

  for (var r = 0; r < grid.length; r++) {
    var d = grid[r][cDate];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKey_(d) !== monthKey) continue;
    monthRows++;
    var isUnit = (cUnit >= 0 && wr_truthy_(grid[r][cUnit])) ? 1 : 0;
    monthUnits += isUnit;
    cols.forEach(function (c) {
      var v = wr_str_(grid[r][c.idx]) || '(blank)';
      if (!tally[c.name][v]) tally[c.name][v] = { rows: 0, units: 0 };
      tally[c.name][v].rows++;
      tally[c.name][v].units += isUnit;
    });
  }

  Logger.log('  ' + monthRows + ' rows this month, ' + monthUnits + ' of them units');
  Logger.log('');

  cols.forEach(function (c) {
    var vals = [], v;
    for (v in tally[c.name]) vals.push(v);
    vals.sort(function (a, b) { return tally[c.name][b].units - tally[c.name][a].units; });
    Logger.log('  COLUMN "' + c.name + '"   ' + vals.length + ' distinct value(s)');
    vals.slice(0, 25).forEach(function (x) {
      var hit = /accel/i.test(x) ? '   <<< contains "accel"' : '';
      Logger.log('     ' + wr_pad_(x, 34) + wr_pad_(tally[c.name][x].units + 'u', 7) +
                 tally[c.name][x].rows + ' rows' + hit);
    });
    if (vals.length > 25) Logger.log('     ... and ' + (vals.length - 25) + ' more');
    Logger.log('');
  });

  Logger.log('  HOW TO READ THIS');
  Logger.log('  Find the column whose values name programmes. If one is marked');
  Logger.log('  <<< contains "accel" you are already filtering correctly. If the');
  Logger.log('  right column is NOT the one being used, tell me its header and I');
  Logger.log('  will point the contest at it.');
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}

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

  Logger.log('');
  Logger.log(fails ? ('=== ' + fails + ' FAILED ===') : '=== ALL PASS ===');
  Logger.log('Nothing was written.');
  return fails;
}
