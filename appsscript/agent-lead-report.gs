/**
 * The Agent Lead Status report.
 *
 * Posted at 11:00, 19:00, 20:00 and 04:00 IST, alongside the 2.5-hourly
 * Disposition Update. Where that one reports money from the Command Centre,
 * this one lists every agent by name with their disposition counts, read from
 * the BY AGENT block of the SuperLeap Churn tab.
 *
 * That tab already reconciles agent names between the CBC roster and
 * SuperLeap ("Niraj" against "Niraj Paul") and already carries the
 * India/International split, so this report reads it directly rather than
 * joining anything itself.
 *
 * buildAgentLeadReport_ is the only place that decides what the message says.
 */

var AGENT_TAB = 'SuperLeap Churn';

/**
 * Where the BY AGENT header sits today. Used only as a starting point:
 * buildSuperLeapChurn writes the summary block above it row by row, so
 * adding one line there moves this header down and a hardcoded 13 would
 * stop finding it. locateAgentHeader_ searches instead.
 */
var AGENT_HEADER_ROW = 13;

/** How far down to search before giving up on the header. */
var AGENT_HEADER_SEARCH = 40;

/** Identity columns, by header text rather than by position. */
var AGENT_COLS = {
  manager: 'Manager',
  team: 'Team',
  agent: 'Agent (CBC)',
  status: 'Status',
  leads: 'Total leads',
  pending: 'Not dispositioned yet',
  dispositioned: 'Dispositioned %'
};

/**
 * Which months an agent appears on the CBC roster for, e.g. "Jul, Aug".
 *
 * Optional on purpose. Without it the report cannot tell a leaver from a
 * current agent, and the right answer then is to show everyone and say so -
 * not to filter on something that is not there.
 */
var AGENT_ROSTER_COL = 'On roster';

var AGENT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The dispositions to show per agent, and the short label each gets.
 *
 * Not all nine: a Slack section caps at 3000 characters and 66 agents have to
 * fit. These five are the ones that describe what an agent actually did -
 * reached nobody, is working someone, was turned down, or closed. Invalid,
 * Disqualified, Lead, Already Paid and Financial Issue are on the tab for
 * anyone who needs them and are summarised in the totals line below.
 */
var AGENT_DISPOSITIONS = [
  { header: 'Non Contact', label: 'NC' },
  { header: 'Prospect', label: 'Pros' },
  { header: 'Not Interested', label: 'NI' },
  { header: 'Sales Won', label: 'Won' }
];

/**
 * The only two real teams. Anything else in that column is not a team.
 *
 * slp_roster_ in SuperLeapChurn.gs falls back to the office when Team is
 * blank - "if (!rec.team) rec.team = rec.office" - so five agents arrive
 * labelled "Bangalore". Left alone that reads as a third desk alongside India
 * and International, and 5,187 leads look split when they are not. Team is
 * only populated from July 2026, so an agent on earlier months only has none.
 */
var AGENT_TEAMS = ['India', 'International'];

/**
 * Manager names that are not a person. Mirrors SYNC_PLACEHOLDER_MGRS in the
 * sync file: an agent under one of these rolls up to nobody, which the Audit
 * page counts and this report should not present as a normal manager.
 */
var AGENT_PLACEHOLDER_MGRS = ['priyatam vusala', 'manager needed', 'tbd',
                              'na', 'n/a', '#n/a', '#ref!', '(unassigned)',
                              '(no manager)'];

function buildAgentLeadReport_(label, firedAt) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(AGENT_TAB);
  var lines = [];

  lines.push('As at ' + firedAt + ' IST   (' + label + ')');

  if (!sheet) {
    lines.push('');
    lines.push('!! Tab "' + AGENT_TAB + '" not found. No figures below.');
    return { subject: '[' + label + '] tab not found', body: lines.join('\n') };
  }

  // SuperLeap Churn refreshes on its own two-hour cycle, so this report can
  // be newer than the data it reads. Carry the source snapshot time to make
  // that visible instead of implying the numbers are as at the post time.
  var snapshot = agentSnapshotTime_(sheet);
  if (snapshot) lines.push('Source snapshot: ' + snapshot);

  // Prefer the payload when it can answer "this month", fall back to the tab
  // when it cannot. The tab is every lead since 1 April summed together, so
  // it has no month to filter on - see agentRowsForMonth_.
  var scoped = agentRowsForMonth_();
  var everyone;

  if (scoped) {
    everyone = scoped.rows;
    lines.push('Showing ' + scoped.label + ' only');
  } else {
    everyone = readAgentRows_(sheet);
  }

  if (!everyone.length) {
    lines.push('');
    lines.push('!! No agent rows found below the BY AGENT header. The block may ' +
      'have moved. Numbers are not reliable.');
    return { subject: '[' + label + '] no agent rows', body: lines.join('\n') };
  }

  // Someone who has left keeps their last month's manager, so a departed
  // manager stays visible for as long as their departed team does - which is
  // why Rohit R Pawaskar and PRIYATAM VUSALA appeared with six and one agent,
  // every one of them gone. Report on who is on the roster now.
  var split = agentSplitLeavers_(everyone);
  var agents = split.current;
  var left = split.left;

  if (!agents.length) {
    agents = everyone;
    left = [];
    lines.push('');
    lines.push('!! Could not tell current agents from leavers - showing all ' +
      everyone.length + '. ' + split.why);
  }

  var all = agentSummarise_(agents);
  lines.push('');
  lines.push(all.count + ' agents        ' + withCommas_(all.leads) + ' leads        ' +
    withCommas_(all.pending) + ' not dispositioned (' +
    agentPercent_(all.pending, all.leads) + ')');
  lines.push('');

  // India and International separately: the split is the reason this report
  // reads SuperLeap Churn rather than counting rows anywhere else. A value
  // that is neither is the office showing through, so say so on the line
  // rather than letting it read as a third desk.
  agentByTeam_(agents).forEach(function (t) {
    var real = AGENT_TEAMS.indexOf(t.name) > -1;
    lines.push(agentPad_(real ? t.name : 'no team', 16) +
      agentPad_(t.count + ' agents', 12) +
      agentLead_(withCommas_(t.leads) + ' leads', 14) +
      withCommas_(t.pending) + ' pending' +
      (real ? '' : '   (Team blank, showing office "' + t.name + '")'));
  });

  // Every agent by name, under the manager they report to - the same grouping
  // the tab uses, so a line here can be found there without translation.
  agentByManager_(agents).forEach(function (group) {
    lines.push('');
    lines.push(group.name + '   (' + group.rows.length + ')' +
      (group.placeholder ? '   <-- not a real manager, these roll up to nobody' : ''));
    group.rows.forEach(function (a) {
      lines.push('  ' + agentPad_(a.agent, 24) +
        agentLead_(withCommas_(a.leads), 7) +
        AGENT_DISPOSITIONS.map(function (d) {
          return agentPad_(d.label + ' ' + a.disp[d.header], 9);
        }).join('') +
        'pend ' + a.pending);
    });
  });

  var idle = agents.filter(function (a) { return a.leads > 0 && a.pending === a.leads; });
  if (idle.length) {
    lines.push('');
    lines.push(idle.length + ' agent(s) have dispositioned nothing at all: ' +
      idle.map(function (a) { return a.agent; }).join(', '));
  }

  var orphan = agents.filter(function (a) { return agentIsPlaceholder_(a.manager); });
  if (orphan.length) {
    lines.push('');
    lines.push(orphan.length + ' agent(s) have no real manager on the roster: ' +
      orphan.map(function (a) { return a.agent; }).join(', ') +
      '. Fix Manager Override on Agent Directory.');
  }

  // Their leads did not leave with them, and nothing above counts these -
  // so say it here rather than let the total quietly shrink.
  if (left.length) {
    var goneLeads = agentSummarise_(left).leads;
    lines.push('');
    lines.push('Not counted above - ' + left.length + ' agent(s) off the ' +
      split.newest + ' roster still hold ' + withCommas_(goneLeads) + ' leads:');
    lines.push('  ' + left.sort(function (x, y) { return y.leads - x.leads; })
      .map(function (a) { return a.agent + ' ' + withCommas_(a.leads); }).join(', '));
  }

  var subject = '[' + label + ']  ' + agents.length + ' agents   ' +
    withCommas_(all.leads) + ' leads   ' +
    withCommas_(all.pending) + ' not dispositioned';

  return { subject: subject, body: lines.join('\n') };
}

/**
 * The agent rows, read by header name.
 *
 * The block ends at the TOTAL row and at the manager and lead-pool listing
 * below it, which is keyed by email rather than by name - neither is an
 * agent, and counting either would inflate every figure in the report.
 */
function readAgentRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= AGENT_HEADER_ROW) return [];

  var width = sheet.getLastColumn();
  var headerRow = locateAgentHeader_(sheet, width);
  var header = sheet.getRange(headerRow, 1, 1, width).getDisplayValues()[0];

  var at = {};
  Object.keys(AGENT_COLS).forEach(function (key) {
    at[key] = header.indexOf(AGENT_COLS[key]);
  });

  var missing = Object.keys(at).filter(function (k) { return at[k] < 0; });
  if (missing.length) {
    throw new Error('SuperLeap Churn r' + headerRow + ' is missing column(s): ' +
      missing.map(function (k) { return AGENT_COLS[k]; }).join(', '));
  }

  // A disposition column that is not on the tab reports as 0 rather than
  // taking the report down - the identity columns above are what it cannot
  // do without.
  var dispAt = {};
  AGENT_DISPOSITIONS.forEach(function (d) {
    dispAt[d.header] = header.indexOf(d.header);
  });

  var rosterAt = header.indexOf(AGENT_ROSTER_COL);

  var first = headerRow + 1;
  var rows = sheet.getRange(first, 1, lastRow - first + 1, width).getDisplayValues();
  var out = [];

  for (var i = 0; i < rows.length; i++) {
    var manager = String(rows[i][at.manager]).trim();
    var agent = String(rows[i][at.agent]).trim();

    if (!agent) break;
    if (manager.toUpperCase() === 'TOTAL') break;
    if (agent.indexOf('@') > -1) break;

    var disp = {};
    AGENT_DISPOSITIONS.forEach(function (d) {
      var c = dispAt[d.header];
      disp[d.header] = c < 0 ? 0 : agentNumber_(rows[i][c]);
    });

    out.push({
      agent: agent,
      manager: manager || '(no manager)',
      team: String(rows[i][at.team]).trim(),
      status: String(rows[i][at.status]).trim(),
      months: rosterAt < 0 ? [] : agentMonths_(rows[i][rosterAt]),
      leads: agentNumber_(rows[i][at.leads]),
      pending: agentNumber_(rows[i][at.pending]),
      dispositioned: agentNumber_(rows[i][at.dispositioned]),
      disp: disp
    });
  }
  return out;
}

/**
 * Find the BY AGENT header by its own text rather than trusting a row number.
 *
 * buildSuperLeapChurn writes the summary block above this header one row at a
 * time, so a single extra line there shifts it down. AGENT_HEADER_ROW is
 * checked first because it is nearly always right and costs one read; the
 * search is the fallback that stops a layout change from breaking the report.
 */
/**
 * The same rows readAgentRows_ returns, but for the current month only.
 *
 * Returns null - meaning "use the tab instead" - whenever the month cannot be
 * answered honestly. That covers every case that exists today:
 *
 *   SlpPayload.gs not pasted into the project yet
 *   a v1 or v2 payload, which carries no month at all
 *   a payload whose newest month has no rows behind it
 *   mdl_Roster unreadable, so nothing could be tied to a manager
 *
 * This is why the switch needs no coordination. While the routine is on v1
 * this function returns null on its first check and the report reads the tab
 * exactly as it does now. The first v3 payload to land makes it start
 * answering, and the report narrows to the current month on its own.
 *
 * The tab cannot be filtered by month instead, and that is the whole reason
 * this exists: SuperLeap sums the leads before they reach the sheet, so by
 * the time a number is on the tab, April and August are already one figure.
 */
function agentRowsForMonth_() {
  // Written as capability checks rather than assumptions, so this file is
  // safe to paste on its own, in any order, without breaking the report.
  if (typeof slp_storedPayload_ !== 'function' ||
      typeof slp_currentMonth_ !== 'function' ||
      typeof slp_rowsForMonth_ !== 'function' ||
      typeof slp_roster_ !== 'function') return null;

  var pay = slp_storedPayload_();
  if (!pay) return null;

  var month = slp_currentMonth_(pay);
  if (!month) return null;                       // no month in this payload

  var rows = slp_rowsForMonth_(pay, month);
  if (!rows.length) return null;

  var ros = slp_roster_(SpreadsheetApp.getActive());
  if (!ros || !ros.count) return null;

  // SuperLeap and CBC spell the same people differently; SLP_NAME_MAP is the
  // agreed translation and lives in SuperLeapChurn.gs.
  var nameMap = (typeof SLP_NAME_MAP !== 'undefined' && SLP_NAME_MAP) ? SLP_NAME_MAP : {};

  var acc = {}, order = [];

  rows.forEach(function (r) {
    var slpName = String(r.agent || '').trim();
    if (!slpName) return;

    // Not on the roster means a manager, a lead pool or another team. The
    // churn tab makes the same call the same way; this report is about
    // Inside Sales agents.
    var hit = ros.find(nameMap[slpName] || slpName);
    if (!hit) return;

    var key = hit.agent;
    if (!acc[key]) {
      var rec = {
        agent: hit.agent,
        manager: hit.mgr || '(no manager)',
        team: hit.team || '',
        status: hit.status || '',
        months: agentMonths_(hit.months),
        leads: 0, pending: 0, dispositioned: 0,
        disp: {}
      };
      AGENT_DISPOSITIONS.forEach(function (d) { rec.disp[d.header] = 0; });
      acc[key] = rec;
      order.push(key);
    }

    var a = acc[key];
    var n = Number(r.n || 0);
    var d = String(r.disposition || '');

    a.leads += n;
    if (d) a.dispositioned += n; else a.pending += n;
    // Only the four dispositions this report has room for; the rest are
    // counted in the total and shown on the tab.
    if (a.disp[d] !== undefined) a.disp[d] += n;
  });

  if (!order.length) return null;

  return {
    month: month,
    label: agentMonthLabel_(month),
    rows: order.map(function (k) { return acc[k]; })
  };
}

/** "2026-08" -> "August 2026". Anything else is passed through unchanged. */
function agentMonthLabel_(m) {
  var parts = String(m).split('-');
  if (parts.length !== 2) return String(m);
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
               'August', 'September', 'October', 'November', 'December'];
  var i = Number(parts[1]) - 1;
  if (i < 0 || i > 11) return String(m);
  return names[i] + ' ' + parts[0];
}


function locateAgentHeader_(sheet, width) {
  var probe = sheet.getRange(AGENT_HEADER_ROW, 1, 1, width).getDisplayValues()[0];
  if (probe.indexOf(AGENT_COLS.agent) > -1) return AGENT_HEADER_ROW;

  var depth = Math.min(AGENT_HEADER_SEARCH, sheet.getLastRow());
  var grid = sheet.getRange(1, 1, depth, width).getDisplayValues();
  for (var r = 0; r < grid.length; r++) {
    if (grid[r].indexOf(AGENT_COLS.agent) > -1) return r + 1;
  }

  throw new Error('SuperLeap Churn has no "' + AGENT_COLS.agent +
    '" header in the first ' + depth + ' rows - the BY AGENT block has moved.');
}

/** Totals across a set of agent rows. */
function agentSummarise_(agents) {
  var leads = 0, pending = 0;
  agents.forEach(function (a) {
    leads += a.leads;
    pending += a.pending;
  });
  return { count: agents.length, leads: leads, pending: pending };
}

/**
 * Totals per team, largest first. A blank Team is reported under its own
 * heading rather than dropped, because an agent missing from the split is
 * exactly the failure this report exists to make visible.
 */
function agentByTeam_(agents) {
  return agentGroup_(agents, 'team', '(no team)').map(function (g) {
    var s = agentSummarise_(g.rows);
    return { name: g.name, count: s.count, leads: s.leads, pending: s.pending };
  });
}

/**
 * Agents under each manager, busiest manager first, busiest agent first.
 * A placeholder manager is flagged rather than presented as a person, and
 * sorts last however many leads sit under it - it is a data fault, not a team.
 */
function agentByManager_(agents) {
  var groups = agentGroup_(agents, 'manager', '(no manager)');
  groups.forEach(function (g) {
    g.placeholder = agentIsPlaceholder_(g.name);
    g.rows.sort(function (x, y) { return y.leads - x.leads; });
  });
  return groups.sort(function (x, y) {
    if (x.placeholder !== y.placeholder) return x.placeholder ? 1 : -1;
    return y.leads - x.leads;
  });
}

/** Is this manager name a placeholder rather than a person? */
function agentIsPlaceholder_(name) {
  return AGENT_PLACEHOLDER_MGRS.indexOf(String(name).trim().toLowerCase()) > -1;
}

/**
 * Split agents into those on the newest CBC roster and those who have left.
 *
 * The rule is the workbook's own: syncAgentDirectory marks an agent Active
 * when their latest month is the newest month and Left otherwise, so the
 * newest month present in the "On roster" column is the current one and
 * anybody missing it has gone.
 *
 * Returns everyone as current, with a reason, whenever that cannot be
 * established - a report showing a few too many agents is recoverable, one
 * that quietly drops working agents is not.
 */
function agentSplitLeavers_(agents) {
  var seen = {};
  agents.forEach(function (a) {
    a.months.forEach(function (m) { seen[m] = true; });
  });
  var present = Object.keys(seen);

  if (!present.length) {
    return { current: [], left: [], newest: '',
             why: 'The "' + AGENT_ROSTER_COL + '" column is empty or missing.' };
  }

  // Month names carry no year, so Dec and Jan together cannot be ordered -
  // December 2026 and January 2027 look like the eleventh and the first.
  if (seen.Dec && seen.Jan) {
    return { current: [], left: [], newest: '',
             why: 'Roster months span a year boundary (Dec and Jan), which ' +
                  'cannot be ordered without a year.' };
  }

  var newest = present.reduce(function (best, m) {
    return AGENT_MONTHS.indexOf(m) > AGENT_MONTHS.indexOf(best) ? m : best;
  }, present[0]);

  if (AGENT_MONTHS.indexOf(newest) < 0) {
    return { current: [], left: [], newest: '',
             why: 'Roster months are not recognisable month names.' };
  }

  var current = [], left = [];
  agents.forEach(function (a) {
    if (a.months.indexOf(newest) > -1) current.push(a);
    else left.push(a);
  });

  return { current: current, left: left, newest: newest, why: '' };
}

/** Group rows by one field, heaviest group first. */
function agentGroup_(agents, field, blank) {
  var groups = {}, order = [];
  agents.forEach(function (a) {
    var key = a[field] || blank;
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(a);
  });

  return order.map(function (name) {
    return { name: name, rows: groups[name], leads: agentSummarise_(groups[name]).leads };
  }).sort(function (x, y) { return y.leads - x.leads; });
}

/** The "snapshot ..." part of the subtitle, which carries the data's age. */
function agentSnapshotTime_(sheet) {
  var text = String(sheet.getRange(2, 1).getDisplayValue());
  var m = text.match(/snapshot\s+([^|]+)/i);
  return m ? m[1].trim() : '';
}

/** "Jul, Aug" -> ["Jul","Aug"]. slp_roster_ writes the abbreviation only. */
function agentMonths_(v) {
  return String(v == null ? '' : v).split(',')
    .map(function (m) { return m.trim(); })
    .filter(function (m) { return m.length > 0; });
}

/** Display values arrive with commas and percent signs. */
function agentNumber_(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function agentPercent_(part, whole) {
  if (!whole) return '-';
  return (part / whole * 100).toFixed(1) + '%';
}

function agentPad_(s, width) {
  s = String(s);
  while (s.length < width) s += ' ';
  return s;
}

/** Right-aligned, so a column of counts reads down the page. */
function agentLead_(s, width) {
  s = String(s);
  while (s.length < width) s = ' ' + s;
  return s + '  ';
}
