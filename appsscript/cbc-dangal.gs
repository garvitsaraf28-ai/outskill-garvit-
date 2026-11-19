/* =====================================================================
   SALES DANGAL - LIVE FROM CBC ONLY                 (Apps Script file:
                                                     name it CbcDangal)

   From 19 Nov 2026 the Sales Dangal TV board shows exactly what CBC
   shows, and nothing else.

     CBC   the "CBC" sales tracker spreadsheet (DG_CBC_ID below)
     TAB   DG_TAB below - 'Nov 2026' for November. Next month, change
           that one line and deploy a new version.

   WHAT IS READ - READ ONLY. This file never writes to any sheet: not to
   CBC, not to the Payment Tracker, not to this workbook. It only reads
   one tab of CBC with getValues().

     the Total row        company Realised Revenue and company Target,
                          exactly as CBC shows them (G2 and K2 today)
     one row per agent    Manager, Agent, City/Region, Realised Revenue,
                          Target (rows 4 to 114 today)
     the summary block    India, International, the six desk rows
                          (India Team-Hyd ...) and Manager | Revenue
                          (F117:G136 today). It is found by its labels,
                          so it keeps working when CBC adds or removes
                          agent rows above it.

   NOTHING ELSE. Not the Inside Sales Master Tracker, not mdl_Payments,
   not any other CBC tab. Units are not read or shown.

   WHICH NUMBER GOES WHERE ON THE BOARD
     Company revenue / target   CBC Total row (Realised Revenue, Target)
     India / International      CBC summary block
     Desks (India Team-Hyd ..)  CBC summary block
     Cities                     CBC summary block, the two desks of the
                                city added together
     Managers                   CBC summary block (Manager | Revenue)
     Agents                     CBC agent rows
     Targets of a desk, city    the agents' own Target cells added up
     or manager                 (CBC has no target in the summary block)

   SELF CHECK, ON EVERY READ
   The agent rows must add up to the Total row, to India + International,
   to the six desks and to the nine managers, and every desk and manager
   line must equal its own agents. Any mismatch is sent to the board as
   a note ("CBC check: ...") instead of being hidden. dangalCheck() below
   prints the same checks in the execution log.

   HOW THE BOARD GETS IT
   The Exec file's doGet() hands feed=warroom to dg_serve_() below when
   this file exists (three lines added there). Delete this file and the
   old feed answers again, so it is safe to add and safe to remove.

   AUTOMATIC
   The tab is re-read at most once a minute (DG_CACHE_SECS). The board
   polls every 30 seconds, so a change typed into CBC reaches the TV in
   about a minute and a half. Nobody has to run anything.

   "JUST ADDED" - THE TICKER AND THE CELEBRATION
   This tab has no payment-by-payment list, so the feed compares each
   agent's Realised Revenue with the previous read. When it goes UP, the
   increase is shown as revenue added for that agent. Nothing is ever
   invented: a new or renamed agent row, a first read, a read more than
   20 minutes after the previous one (overnight, TVs off), or one change
   touching more than 25 agents at once becomes the new starting point
   and is not announced. Decreases are never announced. The list is for
   today only and starts empty each morning.

   NEXT MONTH
   Change DG_TAB to the new tab name (for example 'Dec 2026'), save,
   Deploy > Manage deployments > pencil > Version: New version > Deploy.
   ===================================================================== */

var DG_CBC_ID     = '1-r5VMZ2u9w7WrcyAgCdgzp4scJiJQONuPiUV6JbRu0s';
var DG_TAB        = 'Nov 2026';
var DG_TZ         = 'Asia/Kolkata';
var DG_CACHE_SECS = 60;
var DG_STALE_MS   = 20 * 60 * 1000;   /* older snapshot: re-seed, announce nothing */
var DG_BULK_LIMIT = 25;               /* more agents than this up at once: re-seed  */
var DG_MAX_EVENTS = 30;
var DG_TOL        = 0.5;              /* rupees - rounding tolerance for the checks */

var DG_CITY = {
  hyd: 'Hyderabad', hyderabad: 'Hyderabad',
  bangalore: 'Bangalore', bengaluru: 'Bangalore', blr: 'Bangalore',
  bbsr: 'Bhubaneswar', bhubaneswar: 'Bhubaneswar'
};

var DG_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
var DG_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                      'August', 'September', 'October', 'November', 'December'];


/* =====================================================================
   WEB ENTRY - called by doGet() for feed=warroom
   ===================================================================== */

function dg_serve_(p) {
  p = p || {};

  /* The board page itself, when it is hosted inside this project, is
     still served by the war room file. Only the numbers changed. */
  if (p.page === 'board' && typeof wr_serve_ === 'function') return wr_serve_(p);

  var json;
  try {
    var cache = CacheService.getScriptCache();
    var key = 'dg_' + DG_TAB.replace(/[^A-Za-z0-9]/g, '') + '_v1';
    json = (p.nocache === '1') ? null : cache.get(key);
    if (!json) {
      var payload = dg_build_({});
      dg_attachRecent_(payload);
      json = JSON.stringify(payload);
      try { cache.put(key, json, DG_CACHE_SECS); } catch (ignore) {}
    }
  } catch (err) {
    json = JSON.stringify({
      ok: false, source: 'CBC', tab: DG_TAB,
      error: String((err && err.message) || err),
      at: new Date().getTime()
    });
  }

  var cb = p.callback;
  if (cb && /^[A-Za-z_$][A-Za-z0-9_$.]{0,60}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


/* =====================================================================
   RUN THIS FROM THE EDITOR to see exactly what the board will show and
   whether CBC adds up. Read only - it changes nothing, not even the
   "just added" memory.
   ===================================================================== */

function dangalCheck() {
  var d = dg_build_({ formulas: true });
  var L = [];
  L.push('CBC tab "' + d.meta.tab + '" read in ' + d.meta.readMs + ' ms');
  L.push('Agent rows ' + d.meta.agentRows + ' (' + d.agents.length + ' agents)' +
         ' | summary block ' + d.meta.block + ' | Total row ' + d.meta.totalRow);
  L.push('Company revenue ' + dg_fmt_(d.totals.revenue) + ' | target ' + dg_fmt_(d.totals.target) +
         ' | agents\' own targets add to ' + dg_fmt_(d.totals.agentTargets));
  if (d.meta.formulas) {
    L.push('Total row formulas: revenue ' + d.meta.formulas.revenue +
           ' | target ' + d.meta.formulas.target);
  }
  L.push('India ' + dg_fmt_(d.totals.india) + ' | International ' + dg_fmt_(d.totals.international));
  d.desks.forEach(function (x) {
    L.push('  desk ' + x.label + ' ' + dg_fmt_(x.revenue) + ' (' + x.agents + ' agents)');
  });
  d.managers.forEach(function (x) {
    L.push('  manager ' + x.name + ' ' + dg_fmt_(x.revenue) + ' (' + x.agents + ' agents, ' +
           x.city + ', ' + x.team + ')');
  });
  d.cities.forEach(function (x) {
    L.push('  city ' + x.name + ' ' + dg_fmt_(x.revenue) + ' of ' + dg_fmt_(x.target));
  });
  var bad = 0;
  d.checks.forEach(function (c) {
    if (!c.ok) bad++;
    L.push((c.ok ? '  OK   ' : '  FAIL ') + c.label + (c.detail ? ' - ' + c.detail : ''));
  });
  L.push(bad ? (bad + ' CHECK(S) FAILED - the board shows a "CBC check" note') :
               'ALL CHECKS PASS - the board matches CBC');
  Logger.log(L.join('\n'));
  return d;
}


/* =====================================================================
   THE READ
   ===================================================================== */

function dg_build_(opts) {
  opts = opts || {};
  var t0 = new Date().getTime();
  var book = SpreadsheetApp.openById(DG_CBC_ID);
  var sh = dg_tab_(book, DG_TAB);
  if (!sh) throw new Error('CBC has no tab named "' + DG_TAB + '"');

  var lastRow = sh.getLastRow(), lastCol = Math.min(sh.getLastColumn(), 80);
  if (lastRow < 3 || lastCol < 2) throw new Error('CBC tab "' + sh.getName() + '" is empty');
  var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var readMs = new Date().getTime() - t0;

  var hd = dg_header_(grid);
  if (!hd) throw new Error('CBC tab "' + sh.getName() + '": no header row with "Agent" and ' +
                           '"Realised Revenue" in the first 15 rows');
  var C = hd.cols, checks = [];

  /* ---- the Total row: Agent cell reads "Total" ---- */
  var totalRow = -1;
  for (var r = 0; r < grid.length; r++) {
    if (dg_key_(grid[r][C.agent]) === 'total') { totalRow = r; break; }
  }

  /* ---- where the agent rows stop: the summary block starts ---- */
  var block = dg_block_(grid, hd.row + 1);
  var agentEnd = block.found ? block.firstRow : grid.length;

  /* ---- agent rows ---- */
  var agents = [], firstAgentRow = -1, lastAgentRow = -1, badCells = [];
  for (r = hd.row + 1; r < agentEnd; r++) {
    var row = grid[r];
    var name = dg_clean_(row[C.agent]);
    if (!name || name.toLowerCase() === 'total') continue;
    var label = (C.city != null) ? dg_clean_(row[C.city]) : '';
    var desk = dg_desk_(label);
    var rev = dg_num_(row[C.rev]);
    var tgt = (C.target != null) ? dg_num_(row[C.target]) : 0;
    if (rev === null) { badCells.push(name + ' revenue "' + dg_clean_(row[C.rev]) + '"'); rev = 0; }
    if (tgt === null) { badCells.push(name + ' target "' + dg_clean_(row[C.target]) + '"'); tgt = 0; }
    agents.push({
      name: name,
      manager: (C.manager != null) ? dg_clean_(row[C.manager]) : '',
      desk: label,
      city: desk ? desk.city : 'Unassigned',
      team: desk ? desk.team : '',
      revenue: rev,
      target: tgt,
      row: r + 1
    });
    if (firstAgentRow < 0) firstAgentRow = r + 1;
    lastAgentRow = r + 1;
  }
  if (!agents.length) throw new Error('CBC tab "' + sh.getName() + '": no agent rows found');

  var sumRev = 0, sumTgt = 0;
  agents.forEach(function (a) { sumRev += a.revenue; sumTgt += a.target; });

  /* ---- company totals: the Total row, exactly as CBC shows it ---- */
  var totRev = null, totTgt = null;
  if (totalRow > -1) {
    totRev = dg_num_(grid[totalRow][C.rev]);
    if (C.target != null) totTgt = dg_num_(grid[totalRow][C.target]);
  }
  var revenue = totRev, target = totTgt;
  if (revenue === null) {
    revenue = (block.india !== null && block.international !== null)
      ? block.india + block.international : sumRev;
    checks.push(dg_check_('total_row', 'CBC Total row Realised Revenue', false,
      totalRow < 0 ? 'no Total row found' : 'Total row cell is not a number'));
  }
  if (target === null) {
    target = sumTgt;
    checks.push(dg_check_('total_target', 'CBC Total row Target', false,
      totalRow < 0 ? 'no Total row found' : 'Total row target cell is not a number'));
  }

  /* ---- the checks that prove the board equals CBC ---- */
  if (badCells.length) {
    checks.push(dg_check_('cells', 'Agent cells are numbers', false, badCells.slice(0, 4).join('; ')));
  }
  checks.push(dg_check_('rows_vs_total', 'Agent rows add up to the Total row',
    Math.abs(sumRev - revenue) <= DG_TOL,
    'agents ' + dg_fmt_(sumRev) + ' vs Total ' + dg_fmt_(revenue)));

  if (!block.found) {
    checks.push(dg_check_('block', 'Summary block (India / International / desks / managers)',
      false, 'not found below the agent rows - desks and managers built from agent rows'));
  } else {
    if (block.india === null || block.international === null) {
      checks.push(dg_check_('geo', 'India and International in the summary block', false,
        'India or International missing or not a number'));
    } else {
      checks.push(dg_check_('geo_vs_total', 'India + International = Total row',
        Math.abs(block.india + block.international - revenue) <= DG_TOL,
        dg_fmt_(block.india) + ' + ' + dg_fmt_(block.international) + ' vs ' + dg_fmt_(revenue)));
    }
    block.issues.forEach(function (s) { checks.push(dg_check_('block_label', 'Summary block', false, s)); });
  }

  /* ---- desks: CBC summary block, targets from the agent rows ---- */
  var deskIndex = {}, desks = [];
  block.desks.forEach(function (d) {
    var o = { label: d.label, city: d.city, team: d.team, revenue: d.revenue,
              target: 0, agents: 0, rowsRevenue: 0, cell: d.cell };
    deskIndex[d.label.toLowerCase()] = o;
    desks.push(o);
  });
  var orphanDesk = {};
  agents.forEach(function (a) {
    var o = deskIndex[a.desk.toLowerCase()];
    if (!o) { orphanDesk[a.desk || '(blank)'] = (orphanDesk[a.desk || '(blank)'] || 0) + 1; return; }
    o.target += a.target; o.agents++; o.rowsRevenue += a.revenue;
  });
  if (block.found) {
    var sumDesk = 0;
    desks.forEach(function (o) {
      if (o.revenue === null) {
        checks.push(dg_check_('desk', 'Desk ' + o.label, false, 'summary cell is not a number'));
        o.revenue = o.rowsRevenue;
      } else if (Math.abs(o.revenue - o.rowsRevenue) > DG_TOL) {
        checks.push(dg_check_('desk', 'Desk ' + o.label + ' equals its agent rows', false,
          'summary ' + dg_fmt_(o.revenue) + ' vs agent rows ' + dg_fmt_(o.rowsRevenue)));
      }
      sumDesk += o.revenue;
    });
    checks.push(dg_check_('desks_vs_total', 'Desk lines add up to the Total row',
      Math.abs(sumDesk - revenue) <= DG_TOL, 'desks ' + dg_fmt_(sumDesk) + ' vs Total ' + dg_fmt_(revenue)));
    Object.keys(orphanDesk).forEach(function (k) {
      checks.push(dg_check_('desk_missing', 'Every agent\'s City/Region has a summary line', false,
        orphanDesk[k] + ' agent(s) on "' + k + '" which has no line in the summary block'));
    });
  }

  /* ---- managers: CBC summary block, targets from the agent rows ---- */
  var mgrIndex = {}, managers = [];
  block.managers.forEach(function (m) {
    var o = { name: m.name, revenue: m.revenue, target: 0, agents: 0, rowsRevenue: 0,
              cities: {}, teams: {}, inBlock: true, cell: m.cell };
    mgrIndex[m.name.toLowerCase()] = o;
    managers.push(o);
  });
  agents.forEach(function (a) {
    var k = a.manager.toLowerCase();
    var o = mgrIndex[k];
    if (!o) {
      o = { name: a.manager || 'No manager', revenue: null, target: 0, agents: 0, rowsRevenue: 0,
            cities: {}, teams: {}, inBlock: false };
      mgrIndex[k] = o; managers.push(o);
    }
    o.target += a.target; o.agents++; o.rowsRevenue += a.revenue;
    o.cities[a.city] = 1; if (a.team) o.teams[a.team] = 1;
  });
  var sumMgr = 0;
  managers.forEach(function (o) {
    if (!o.inBlock) {
      if (block.found) checks.push(dg_check_('manager_missing', 'Manager ' + o.name + ' in the summary block',
        false, 'not listed under Manager | Revenue - shown from agent rows ' + dg_fmt_(o.rowsRevenue)));
      o.revenue = o.rowsRevenue;
    } else if (o.revenue === null) {
      checks.push(dg_check_('manager', 'Manager ' + o.name, false, 'summary cell is not a number'));
      o.revenue = o.rowsRevenue;
    } else if (Math.abs(o.revenue - o.rowsRevenue) > DG_TOL) {
      checks.push(dg_check_('manager', 'Manager ' + o.name + ' equals the agent rows', false,
        'summary ' + dg_fmt_(o.revenue) + ' vs agent rows ' + dg_fmt_(o.rowsRevenue)));
    }
    sumMgr += o.revenue;
    var cs = Object.keys(o.cities), ts = Object.keys(o.teams).sort();
    o.city = cs.length === 1 ? cs[0] : (cs.length ? cs.sort().join('/') : '');
    o.team = ts.length === 1 ? ts[0] : (ts.length ? 'India/Intl' : '');
  });
  if (block.found) {
    checks.push(dg_check_('managers_vs_total', 'Manager lines add up to the Total row',
      Math.abs(sumMgr - revenue) <= DG_TOL, 'managers ' + dg_fmt_(sumMgr) + ' vs Total ' + dg_fmt_(revenue)));
  }

  /* ---- cities: the two desks of each city, added ---- */
  var cityIndex = {}, cities = [];
  function cityOf(name) {
    if (!cityIndex[name]) { cityIndex[name] = { name: name, revenue: 0, target: 0, agents: 0 }; cities.push(cityIndex[name]); }
    return cityIndex[name];
  }
  if (block.found && desks.length) {
    desks.forEach(function (o) { cityOf(o.city).revenue += o.revenue; });
    agents.forEach(function (a) { var c = cityOf(a.city); c.target += a.target; c.agents++; if (!deskIndex[a.desk.toLowerCase()]) c.revenue += a.revenue; });
  } else {
    agents.forEach(function (a) { var c = cityOf(a.city); c.revenue += a.revenue; c.target += a.target; c.agents++; });
  }

  /* ---- India / International ---- */
  var geo = [
    { name: 'India', revenue: block.india, target: 0, agents: 0 },
    { name: 'International', revenue: block.international, target: 0, agents: 0 }
  ];
  agents.forEach(function (a) {
    var g = a.team === 'India' ? geo[0] : (a.team === 'International' ? geo[1] : null);
    if (!g) return;
    g.target += a.target; g.agents++;
    if (block.india === null || block.international === null) g.revenue = (g.revenue || 0) + a.revenue;
  });

  /* Targets: reported, never "fixed". CBC's Total row target is what the
     board shows; when it differs from the agents' own targets added up,
     that is said here so somebody can look at CBC. */
  checks.push(dg_check_('target_total', 'Total row Target vs agents\' own targets', true,
    dg_fmt_(target) + ' vs ' + dg_fmt_(sumTgt) +
    (Math.abs(target - sumTgt) > DG_TOL ? ' (differ by ' + dg_fmt_(sumTgt - target) + ')' : ''), 'info'));

  /* ---- dates ---- */
  var now = new Date();
  var today = Utilities.formatDate(now, DG_TZ, 'yyyy-MM-dd');
  var tm = dg_tabMonth_(sh.getName());
  var day = 0, days = 30, monthLabel = sh.getName();
  if (tm) {
    days = new Date(tm.y, tm.m + 1, 0).getDate();
    monthLabel = DG_MONTH_NAMES[tm.m] + ' ' + tm.y;
    var ty = +today.substring(0, 4), tmo = +today.substring(5, 7) - 1, td = +today.substring(8, 10);
    if (ty === tm.y && tmo === tm.m) day = td;
    else if (ty > tm.y || (ty === tm.y && tmo > tm.m)) day = days;
  }

  var out = {
    ok: true,
    source: 'CBC',
    meta: {
      month: monthLabel,
      windowLabel: 'live from CBC',
      tab: sh.getName(),
      generatedAt: now.getTime(),
      today: today,
      day: day,
      days: days,
      readMs: readMs,
      agentRows: firstAgentRow + '-' + lastAgentRow,
      totalRow: totalRow > -1 ? (totalRow + 1) : null,
      block: block.found ? block.a1 : null
    },
    totals: {
      revenue: revenue,
      target: target,
      india: geo[0].revenue,
      international: geo[1].revenue,
      agentTargets: sumTgt,
      units: 0, offRoster: 0, offRosterUnits: 0
    },
    geo: geo,
    desks: desks.map(function (o) {
      return { label: o.label, city: o.city, team: o.team, revenue: o.revenue,
               target: o.target, agents: o.agents };
    }),
    cities: cities,
    managers: managers.map(function (o) {
      return { name: o.name, city: o.city, team: o.team, revenue: o.revenue,
               target: o.target, agents: o.agents };
    }),
    agents: agents.map(function (a) {
      return { name: a.name, manager: a.manager, city: a.city, team: a.team,
               desk: a.desk, revenue: a.revenue, target: a.target };
    }).sort(function (x, y) { return y.revenue - x.revenue; }),
    recent: [],
    byDay: [],
    checks: checks,
    contest: { active: false }
  };

  if (opts.formulas && totalRow > -1) {
    try {
      var f = sh.getRange(totalRow + 1, 1, 1, lastCol).getFormulas()[0];
      out.meta.formulas = { revenue: f[C.rev] || '(value)', target: (C.target != null && f[C.target]) || '(value)' };
    } catch (eF) { out.meta.formulas = { revenue: '?', target: '?' }; }
  }
  return out;
}


/* =====================================================================
   "JUST ADDED" - compare with the previous read
   ===================================================================== */

function dg_attachRecent_(payload) {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  var got = false;
  try { got = lock.tryLock(15000); } catch (eL) { got = false; }
  try {
    var events = dg_jsonProp_(props, 'DG_EVENTS') || [];
    if (!got) {
      payload.recent = dg_todays_(events, payload);
      return;
    }
    var snap = dg_jsonProp_(props, 'DG_SNAP');
    var now = payload.meta.generatedAt, tab = payload.meta.tab, today = payload.meta.today;
    var fresh = snap && snap.t === tab && snap.r && (now - (snap.at || 0)) <= DG_STALE_MS &&
                (now >= (snap.at || 0));
    var found = [];
    if (fresh) {
      payload.agents.forEach(function (a) {
        var k = a.name.toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(snap.r, k)) return;     /* new row: seed */
        var up = a.revenue - snap.r[k];
        if (up > DG_TOL) {
          found.push({ name: a.name, amt: Math.round(up * 100) / 100, at: now,
                       city: a.city, team: a.team, manager: a.manager, d: today });
        }
      });
      if (found.length > DG_BULK_LIMIT) found = [];                         /* bulk edit: seed */
    }
    found.sort(function (x, y) { return x.amt - y.amt; });   /* biggest ends up first */
    found.forEach(function (e) { e.tab = tab; });
    events = found.reverse().concat(events).filter(function (e) {
      return e && e.d === today && e.tab === tab;
    }).slice(0, DG_MAX_EVENTS);

    var r = {};
    payload.agents.forEach(function (a) { r[a.name.toLowerCase()] = a.revenue; });
    dg_setJsonProp_(props, 'DG_SNAP', { t: tab, at: now, r: r });
    dg_setJsonProp_(props, 'DG_EVENTS', events);
    payload.recent = dg_todays_(events, payload);
  } finally {
    if (got) { try { lock.releaseLock(); } catch (eR) {} }
  }
}

function dg_todays_(events, payload) {
  var today = payload.meta.today, tab = payload.meta.tab;
  return (events || []).filter(function (e) {
    return e && e.d === today && e.tab === tab;
  }).map(function (e) {
    return { name: e.name, amt: e.amt, at: e.at, city: e.city, team: e.team, manager: e.manager };
  });
}

/* Script Properties hold 9 KB per value; the snapshot is split into
   parts so a longer roster can never overflow one. Other properties of
   this project are never touched (setProperties with deleteAllOthers
   false). */
function dg_jsonProp_(props, key) {
  try {
    var n = parseInt(props.getProperty(key + '_n') || '0', 10), s = '';
    if (!(n > 0)) return null;
    for (var i = 0; i < n; i++) s += props.getProperty(key + '_' + i) || '';
    return JSON.parse(s);
  } catch (e) { return null; }
}
function dg_setJsonProp_(props, key, obj) {
  var s = JSON.stringify(obj), size = 3000, parts = {};
  var n = Math.max(1, Math.ceil(s.length / size));
  for (var i = 0; i < n; i++) parts[key + '_' + i] = s.substring(i * size, (i + 1) * size);
  parts[key + '_n'] = String(n);
  props.setProperties(parts, false);
}


/* =====================================================================
   HELPERS
   ===================================================================== */

function dg_clean_(x) {
  if (x === null || x === undefined) return '';
  if (Object.prototype.toString.call(x) === '[object Date]') return '';
  return String(x).replace(/\s+/g, ' ').trim();
}
function dg_key_(x) { return dg_clean_(x).toLowerCase(); }

/* A number, 0 for an empty cell, or null for anything else (an error
   value such as #N/A, or text) so the caller can say so. */
function dg_num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v === null || v === undefined) return 0;
  if (Object.prototype.toString.call(v) === '[object Date]') return null;
  var s = String(v).replace(/[\s,]/g, '').replace(/^(Rs\.?|INR|\u20b9)/i, '');
  if (s === '') return 0;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

function dg_fmt_(v) {
  if (v === null || v === undefined || !isFinite(v)) return 'n/a';
  var neg = v < 0, s = String(Math.round(Math.abs(v)));
  var last3 = s.slice(-3), rest = s.slice(0, -3);
  if (rest) last3 = ',' + last3;
  rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + 'Rs ' + rest + last3;
}

function dg_check_(id, label, ok, detail, level) {
  return { id: id, label: label, ok: !!ok, detail: detail || '', level: level || 'error' };
}

/* "India Team-Hyd" -> India, Hyderabad.  "Intl Team-Bangalore" -> International, Bangalore. */
function dg_desk_(label) {
  var m = /^(india|intl|international)\s*team\s*-\s*(.+)$/i.exec(dg_clean_(label));
  if (!m) return null;
  var place = dg_clean_(m[2]);
  return {
    team: m[1].toLowerCase() === 'india' ? 'India' : 'International',
    city: DG_CITY[place.toLowerCase().replace(/\s+/g, '')] || place
  };
}

function dg_tab_(book, name) {
  var sh = book.getSheetByName(name);
  if (sh) return sh;
  var want = dg_key_(name), all = book.getSheets();
  for (var i = 0; i < all.length; i++) if (dg_key_(all[i].getName()) === want) return all[i];
  return null;
}

function dg_tabMonth_(name) {
  var m = /^([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/.exec(dg_clean_(name));
  if (!m) return null;
  var i = DG_MONTHS.indexOf(m[1].toLowerCase());
  return i < 0 ? null : { m: i, y: +m[2] };
}

function dg_header_(grid) {
  for (var r = 0; r < Math.min(grid.length, 15); r++) {
    var row = grid[r], c = {};
    for (var j = 0; j < row.length; j++) {
      var h = dg_key_(row[j]);
      if (!h) continue;
      if (h === 'agent' && c.agent == null) c.agent = j;
      else if (h === 'manager' && c.manager == null) c.manager = j;
      else if ((h === 'city/region' || h.indexOf('city') === 0) && c.city == null) c.city = j;
      else if ((h.indexOf('realised revenue') > -1 || h.indexOf('realized revenue') > -1) && c.rev == null) c.rev = j;
      else if (h.indexOf('target') > -1 && c.target == null) c.target = j;
    }
    if (c.agent != null && c.rev != null) return { row: r, cols: c };
  }
  return null;
}

/* The summary block: a label column with the value one column to its
   right. Located by the first "India" cell below the header, so it is
   found wherever CBC puts it. */
function dg_block_(grid, fromRow) {
  var out = { found: false, firstRow: -1, lastRow: -1, col: -1, a1: '',
              india: null, international: null, desks: [], managers: [], issues: [] };
  for (var r = fromRow; r < grid.length && out.col < 0; r++) {
    for (var c = 0; c < grid[r].length - 1; c++) {
      if (dg_key_(grid[r][c]) === 'india') { out.col = c; out.firstRow = r; break; }
    }
  }
  if (out.col < 0) return out;
  out.found = true;
  var L = out.col, V = L + 1, inMgr = false;
  for (r = out.firstRow; r < grid.length; r++) {
    var lab = dg_clean_(grid[r][L]), k = lab.toLowerCase();
    if (!lab) { if (inMgr && out.managers.length) break; continue; }
    var val = dg_num_(grid[r][V]), cell = dg_col_(V) + (r + 1);
    out.lastRow = r;
    if (inMgr) { out.managers.push({ name: lab, revenue: val, cell: cell }); continue; }
    if (k === 'india') { out.india = val; continue; }
    if (k === 'international') { out.international = val; continue; }
    if (k === 'manager' && dg_key_(grid[r][V]) === 'revenue') { inMgr = true; continue; }
    var d = dg_desk_(lab);
    if (d) { out.desks.push({ label: lab, city: d.city, team: d.team, revenue: val, cell: cell }); continue; }
    out.issues.push('label "' + lab + '" at ' + dg_col_(L) + (r + 1) + ' not recognised - not shown');
  }
  out.a1 = dg_col_(L) + (out.firstRow + 1) + ':' + dg_col_(V) + (out.lastRow + 1);
  return out;
}

function dg_col_(i) {
  var s = '', n = i + 1;
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
