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

  var agents = readAgentRows_(sheet);

  if (!agents.length) {
    lines.push('');
    lines.push('!! No agent rows found below the BY AGENT header. The block may ' +
      'have moved. Numbers are not reliable.');
    return { subject: '[' + label + '] no agent rows', body: lines.join('\n') };
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

  var subject = '[' + label + ']  ' + agents.length + ' agents   ' +
    withCommas_(all.leads) + ' leads   ' +
    withCommas_(all.pending) + ' not dispositioned';

  return { subject: subject, body: lines.join('\n') };
}

/**
 * The agent rows, read by header name.
 *
 * The block ends at the TOTAL row and at the manager and lead-pool listing
 * below it, which is keyed by email rather than by name — neither is an
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

/** Display values arrive with commas and percent signs. */
function agentNumber_(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function agentPercent_(part, whole) {
  if (!whole) return '—';
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
