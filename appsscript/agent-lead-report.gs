/**
 * The Agent Lead Status report.
 *
 * Posted at 11:00, 19:00, 20:00 and 04:00 IST, alongside the 2.5-hourly
 * Disposition Update. Where that one reports money from the Command Centre,
 * this one reports where the leads are sitting per agent, read from the BY
 * AGENT block of the SuperLeap Churn tab.
 *
 * That tab already reconciles agent names between the CBC roster and
 * SuperLeap ("Niraj" against "Niraj Paul") and already carries the
 * India/International split, so this report reads it directly rather than
 * joining anything itself.
 *
 * buildAgentLeadReport_ is the only place that decides what the message says.
 */

var AGENT_TAB = 'SuperLeap Churn';

/** Header of the BY AGENT block. Rows above it are the lead-pool summary. */
var AGENT_HEADER_ROW = 13;

/** How many of the least-dispositioned agents to name. */
var AGENT_ATTENTION_COUNT = 5;

/**
 * Columns read from the block, by header text rather than by position, so
 * that a column inserted upstream shifts nothing silently.
 */
var AGENT_COLS = {
  manager: 'Manager',
  team: 'Team',
  agent: 'Agent (CBC)',
  status: 'Status',
  leads: 'Total leads',
  pending: 'Not dispositioned yet',
  dispositioned: 'Dispositioned %'
};

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
    lines.push('!! No agent rows found below r' + AGENT_HEADER_ROW +
      '. The block may have moved. Numbers are not reliable.');
    return { subject: '[' + label + '] no agent rows', body: lines.join('\n') };
  }

  var all = agentSummarise_(agents);
  lines.push('');
  lines.push(all.count + ' agents        ' + withCommas_(all.leads) + ' leads');
  lines.push('');

  // India and International separately: the split is the reason this report
  // reads SuperLeap Churn rather than counting rows anywhere else.
  agentByTeam_(agents).forEach(function (t) {
    lines.push(agentPad_(t.name, 15) + agentPad_(t.count + ' agents', 12) +
      withCommas_(t.leads) + ' leads');
  });
  lines.push('');

  lines.push('Not dispositioned  ' + withCommas_(all.pending) +
    '   (' + agentPercent_(all.pending, all.leads) + ' of leads)');
  lines.push('Dispositioned      ' + agentPercent_(all.leads - all.pending, all.leads) +
    '   across all agents');
  lines.push('');

  var idle = agents.filter(function (a) { return a.leads > 0 && a.pending === a.leads; });
  if (idle.length) {
    lines.push(idle.length + ' agent(s) have dispositioned nothing at all:');
    idle.slice(0, AGENT_ATTENTION_COUNT).forEach(function (a) {
      lines.push('  ' + agentPad_(a.agent, 26) + withCommas_(a.leads) + ' leads');
    });
    if (idle.length > AGENT_ATTENTION_COUNT) {
      lines.push('  ... and ' + (idle.length - AGENT_ATTENTION_COUNT) + ' more');
    }
    lines.push('');
  }

  var worst = agentLowestDispositioned_(agents);
  if (worst.length) {
    lines.push('Lowest dispositioned %:');
    worst.forEach(function (a) {
      lines.push('  ' + agentPad_(a.agent, 26) + agentPad_(a.dispositioned + '%', 9) +
        withCommas_(a.pending) + ' pending');
    });
  }

  var subject = '[' + label + ']  ' + withCommas_(all.leads) + ' leads   ' +
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
  var header = sheet.getRange(AGENT_HEADER_ROW, 1, 1, width).getDisplayValues()[0];

  var at = {};
  Object.keys(AGENT_COLS).forEach(function (key) {
    at[key] = header.indexOf(AGENT_COLS[key]);
  });

  var missing = Object.keys(at).filter(function (k) { return at[k] < 0; });
  if (missing.length) {
    throw new Error('SuperLeap Churn is missing column(s): ' +
      missing.map(function (k) { return AGENT_COLS[k]; }).join(', '));
  }

  var first = AGENT_HEADER_ROW + 1;
  var rows = sheet.getRange(first, 1, lastRow - first + 1, width).getDisplayValues();
  var out = [];

  for (var i = 0; i < rows.length; i++) {
    var manager = String(rows[i][at.manager]).trim();
    var agent = String(rows[i][at.agent]).trim();

    if (!agent) break;
    if (manager.toUpperCase() === 'TOTAL') break;
    if (agent.indexOf('@') > -1) break;

    out.push({
      agent: agent,
      team: String(rows[i][at.team]).trim(),
      status: String(rows[i][at.status]).trim(),
      leads: agentNumber_(rows[i][at.leads]),
      pending: agentNumber_(rows[i][at.pending]),
      dispositioned: agentNumber_(rows[i][at.dispositioned])
    });
  }
  return out;
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
  var groups = {};
  agents.forEach(function (a) {
    var key = a.team || '(no team)';
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  return Object.keys(groups).map(function (name) {
    var s = agentSummarise_(groups[name]);
    return { name: name, count: s.count, leads: s.leads, pending: s.pending };
  }).sort(function (x, y) { return y.leads - x.leads; });
}

/** The least-dispositioned agents that still have leads to work. */
function agentLowestDispositioned_(agents) {
  return agents
    .filter(function (a) { return a.pending > 0 && a.leads > 0; })
    .sort(function (x, y) { return x.dispositioned - y.dispositioned; })
    .slice(0, AGENT_ATTENTION_COUNT);
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
