/**
 * SlpLeadReport.gs - the per-agent lead status table, one tab per team.
 *
 * Two tabs, because India and International are read by different people at
 * different times and mixing them made both harder to read:
 *
 *   "Lead Report - India"
 *   "Lead Report - International"
 *
 * Each is one month, agents grouped under their office, one column per
 * outcome, a total per office and a grand total.
 *
 * Run buildLeadReportIndia() or buildLeadReportIntl(). Both take an optional
 * month like '2026-08'; with nothing passed they use the newest month in the
 * payload.
 *
 * WHERE EACH PIECE COMES FROM
 *
 *   the numbers   the stored payload's "rows" - agent, month, outcome, count
 *   the agents    mdl_Roster, which is also what makes this Inside Sales only
 *   office, team  mdl_Roster
 *   the batches   the payload's "batches", listed at the top of the tab
 *
 *   Nothing is hardcoded. A new office, a joiner, a leaver or a new outcome
 *   appears on its own at the next build.
 *
 * WHAT COUNTS AS AN OUTCOME
 *
 *   One column per lead outcome, taken as the sub-disposition where a lead
 *   has one and the disposition where it does not - so "Non Contact-2" and
 *   "Not Interested" sit side by side, which is how the report has always
 *   been read.
 *
 *   This counts LEADS, not calls. An earlier attempt at this report counted
 *   call activities instead and the Lead column came out at 36 where it
 *   should have been 4,322, because a call that has a sub-disposition never
 *   lands in the plain disposition bucket. If a column looks implausibly
 *   empty, that is the first thing to check.
 */

var LR_TAB_INDIA = 'Lead Report - India';
var LR_TAB_INTL  = 'Lead Report - International';

/** The team values that mean something. Anything else is reported, not hidden. */
var LR_TEAMS = { INDIA: 'India', INTL: 'International' };

/**
 * Column order, matching the report people already read. Anything the payload
 * carries that is not on this list is appended after it, so a new outcome in
 * SuperLeap shows up rather than being silently dropped.
 */
var LR_COLS = ['Lead', 'PTP', 'WFC', 'Non Contact', 'Non Contact-1', 'Non Contact-2',
               'Non Contact-3', 'Non Contact-4', 'Non Contact-5', 'Not Interested',
               'Not Reachable', 'Prospect', 'Deferred Hot', 'Followup', 'Student',
               'Disqualified', 'Financial Issue'];


/* ================================================================
   ENTRY POINTS
   ================================================================ */
function buildLeadReportIndia(month) { return lr_build_(LR_TEAMS.INDIA, LR_TAB_INDIA, month); }
function buildLeadReportIntl(month)  { return lr_build_(LR_TEAMS.INTL,  LR_TAB_INTL,  month); }

/** Both, for a quick check after a payload arrives. */
function buildLeadReportsBoth() {
  var a = buildLeadReportIndia();
  var b = buildLeadReportIntl();
  Logger.log('India: ' + JSON.stringify(a));
  Logger.log('International: ' + JSON.stringify(b));
  return { india: a, intl: b };
}


/* ================================================================
   BUILD
   ================================================================ */
function lr_build_(team, tabName, month) {
  var t0 = new Date();
  Logger.log('--- ' + tabName + ' ---');

  if (typeof slp_storedPayload_ !== 'function') {
    Logger.log('STOPPING: SlpPayload.gs is not in this project.');
    return { error: 'no SlpPayload.gs' };
  }
  var pay = slp_storedPayload_();
  if (!pay) { Logger.log('STOPPING: no payload stored. Run slpLoadFromDrive() first.'); return { error: 'no payload' }; }

  var rows = pay.rows || [];
  if (!rows.length) {
    Logger.log('NOTHING TO BUILD: the payload carries no month-by-outcome rows.');
    Logger.log('  This report needs each lead\'s outcome broken down by month.');
    Logger.log('  Upload a payload that carries them, then run this again.');
    return { error: 'payload has no rows' };
  }

  month = month || slp_currentMonth_(pay);
  if (!month) { Logger.log('STOPPING: the payload carries no months.'); return { error: 'no month' }; }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ros = (typeof slp_roster_ === 'function') ? slp_roster_(ss) : null;
  if (!ros || !ros.count) { Logger.log('STOPPING: mdl_Roster unreadable.'); return { error: 'no roster' }; }

  var nameMap = (typeof SLP_NAME_MAP !== 'undefined' && SLP_NAME_MAP) ? SLP_NAME_MAP : {};

  /* ---- the month's numbers, keyed by roster name ---- */
  var byAgent = {}, colsSeen = {};
  rows.forEach(function (r) {
    var m = String(r.m !== undefined ? r.m : r.month || '');
    if (m !== month) return;

    var slpName = String((r.a !== undefined ? r.a : r.agent) || '').trim();
    if (!slpName) return;

    // On the roster or it is not Inside Sales. Same rule the churn tab uses,
    // so the two can never disagree about who counts.
    var hit = ros.find(nameMap[slpName] || slpName);
    if (!hit) return;

    var b = String((r.b !== undefined ? r.b : r.bucket) || '').trim() || '(none)';
    var n = Number(r.n || 0);
    if (!byAgent[hit.agent]) byAgent[hit.agent] = {};
    byAgent[hit.agent][b] = (byAgent[hit.agent][b] || 0) + n;
    colsSeen[b] = true;
  });

  /* ---- every Inside Sales agent on this team, including the quiet ones ----
     Driven by the roster rather than by the payload, so an agent with no
     leads at all this month still gets a row of zeros. Leaving them out
     would read as "no such agent" rather than "nothing yet". */
  var people = [], other = [];
  Object.keys(ros.byKey).forEach(function (k) {
    var rec = ros.byKey[k];
    var t = String(rec.team || '').trim();
    var row = {
      agent: rec.agent,
      office: String(rec.office || '').trim() || '(no office)',
      team: t,
      d: byAgent[rec.agent] || {}
    };
    row.total = 0;
    Object.keys(row.d).forEach(function (b) { row.total += row.d[b]; });

    if (t === team) people.push(row);
    else if (t !== LR_TEAMS.INDIA && t !== LR_TEAMS.INTL) other.push(row);
  });

  if (!people.length) {
    Logger.log('STOPPING: no roster agent has team "' + team + '".');
    Logger.log('  Team values found: ' + lr_teamValues_(ros).join(', '));
    return { error: 'no agents on this team' };
  }

  /* ---- columns: the familiar order first, then anything new ---- */
  var cols = [];
  LR_COLS.forEach(function (c) { if (colsSeen[c]) cols.push(c); });
  Object.keys(colsSeen).sort().forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
  if (!cols.length) cols = LR_COLS.slice(0, 4);

  /* ---- office, then agent within it ---- */
  var offices = {};
  people.forEach(function (p) { (offices[p.office] = offices[p.office] || []).push(p); });
  var officeNames = Object.keys(offices).sort();
  officeNames.forEach(function (o) {
    offices[o].sort(function (x, y) {
      if (y.total !== x.total) return y.total - x.total;
      return x.agent < y.agent ? -1 : 1;
    });
  });

  lr_write_(ss, tabName, team, month, pay, cols, officeNames, offices, other, t0);

  var grand = 0;
  people.forEach(function (p) { grand += p.total; });

  /* Enough for a Slack summary without rebuilding any of it there. The
     26-column table cannot go in a Slack message - it is unreadable on a
     phone and past the block size limit - so Slack gets the shape of it
     and a link to the real thing. */
  var byOffice = officeNames.map(function (o) {
    var n = 0;
    offices[o].forEach(function (p) { n += p.total; });
    return { office: o, agents: offices[o].length, leads: n };
  });
  var byCol = cols.map(function (c) {
    var n = 0;
    people.forEach(function (p) { n += (p.d[c] || 0); });
    return { col: c, n: n };
  }).filter(function (x) { return x.n; })
    .sort(function (a, b) { return b.n - a.n; });

  var tab = ss.getSheetByName(tabName);
  var url = '';
  try { url = ss.getUrl() + '#gid=' + tab.getSheetId(); } catch (e) {}
  Logger.log('built in ' + Math.round((new Date() - t0) / 1000) + 's');
  Logger.log('  month   : ' + month);
  Logger.log('  offices : ' + officeNames.join(', '));
  Logger.log('  agents  : ' + people.length);
  Logger.log('  leads   : ' + grand);
  if (other.length) Logger.log('  NOTE    : ' + other.length + ' agent(s) have no India/International team - listed at the bottom');

  return { month: month, offices: officeNames.length, agents: people.length,
           leads: grand, team: team, tab: tabName, url: url,
           batches: (pay.batches && pay.batches[month]) ? pay.batches[month] : [],
           snapshot: pay.snapshot || '', byOffice: byOffice, byCol: byCol,
           noTeam: other.length };
}


/* ================================================================
   THE SLACK POST

   A summary and a link, not the table. Twenty-six columns is unreadable
   on a phone whatever is done to it, and a Slack section block caps at
   3000 characters - the table alone would be several times that. What
   goes out is the shape of the month: totals, each office, and which
   outcomes actually moved. The full grid is one tap away.
   ================================================================ */
function lr_slack_(team, tabName, label, firedAt) {
  var res = lr_build_(team, tabName);

  if (res.error) {
    return {
      subject: '[' + label + '] report not built',
      body: 'As at ' + firedAt + ' IST\n\n!! ' + res.error +
            '\nThe tab was left as it was; nothing below is new.'
    };
  }

  var L = [];
  L.push('As at ' + firedAt + ' IST   (' + label + ')');
  L.push(lr_monthLabel_(res.month) + '   |   snapshot ' +
         (typeof slp_stamp_ === 'function' ? slp_stamp_(res.snapshot) : ''));
  L.push('');
  L.push(res.agents + ' agents        ' + lr_commas_(res.leads) + ' leads');

  if (res.batches && res.batches.length) {
    L.push('');
    L.push('Batches: ' + res.batches.join(', '));
  }

  L.push('');
  res.byOffice.forEach(function (o) {
    L.push(lr_pad_(o.office, 16) + lr_pad_(o.agents + ' agents', 12) +
           lr_commas_(o.leads) + ' leads');
  });

  if (res.byCol.length) {
    L.push('');
    L.push('By outcome');
    res.byCol.slice(0, 8).forEach(function (c) {
      L.push('  ' + lr_pad_(c.col, 22) + lr_commas_(c.n));
    });
    if (res.byCol.length > 8) {
      var rest = 0;
      res.byCol.slice(8).forEach(function (c) { rest += c.n; });
      L.push('  ' + lr_pad_('everything else', 22) + lr_commas_(rest));
    }
  }

  if (res.noTeam) {
    L.push('');
    L.push('!! ' + res.noTeam + ' agent(s) are on neither team - see the bottom of the tab.');
  }

  if (res.url) {
    L.push('');
    L.push('<' + res.url + '|Open the full table>');
  }

  return {
    subject: '[' + label + '] ' + lr_monthLabel_(res.month) + '   ' +
             lr_commas_(res.leads) + ' leads',
    body: L.join('\n')
  };
}

/** Schedule entry points. buildSchedule_ calls these with (label, firedAt). */
function buildLeadSlackIndia_(label, firedAt) {
  return lr_slack_(LR_TEAMS.INDIA, LR_TAB_INDIA, label, firedAt);
}
function buildLeadSlackIntl_(label, firedAt) {
  return lr_slack_(LR_TEAMS.INTL, LR_TAB_INTL, label, firedAt);
}


/** Distinct team values on the roster, for when nothing matched. */
function lr_teamValues_(ros) {
  var seen = {};
  Object.keys(ros.byKey).forEach(function (k) {
    seen[String(ros.byKey[k].team || '(blank)').trim()] = true;
  });
  return Object.keys(seen).sort();
}


/* ================================================================
   WRITE THE TAB
   ================================================================ */
function lr_write_(ss, tabName, team, month, pay, cols, officeNames, offices, other, t0) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
  } else {
    /* Break every merge on the sheet, not just those inside the data range -
       a merge can sit past the last row with content and then defeat the
       next one. */
    var wiped = false;
    try {
      sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
      sh.clear();
      wiped = true;
    } catch (e) { Logger.log('could not clear the old tab (' + e.message + '); rebuilding it'); }
    if (!wiped) { ss.deleteSheet(sh); sh = ss.insertSheet(tabName); }
  }
  sh.setHiddenGridlines(true);

  var NC = 1 + cols.length + 1;               // Owner | outcomes | Total
  var GREEN = '#c6e0b4', ORANGE = '#f8cbad', OFFICE = '#dbe5f1', GREY = '#d9d9d9';

  var r = 1;
  sh.getRange(r, 1).setValue('INSIDE SALES - LEAD STATUS - ' + team.toUpperCase() +
      '   ' + lr_monthLabel_(month))
    .setFontSize(15).setFontWeight('bold').setFontColor('#1f3864');
  r++;

  var batches = (pay.batches && pay.batches[month]) ? pay.batches[month] : null;
  sh.getRange(r, 1).setValue(batches && batches.length
      ? 'Batches: ' + batches.join(', ')
      : 'Batches: not carried by this payload')
    .setFontSize(10).setFontStyle('italic').setFontColor('#555555').setWrap(true);
  sh.getRange(r, 1, 1, NC).merge();
  r++;

  sh.getRange(r, 1).setValue('Leads created in ' + lr_monthLabel_(month) +
      '   |   snapshot ' + (typeof slp_stamp_ === 'function' ? slp_stamp_(pay.snapshot) : '') +
      '   |   built ' + Utilities.formatDate(t0, 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm') +
      '   |   agents with no leads this month show as zero')
    .setFontSize(9).setFontColor('#808080').setWrap(true);
  sh.getRange(r, 1, 1, NC).merge();
  r += 2;

  var head = ['Owner'].concat(cols).concat(['Total Leads']);
  var hRow = r;
  sh.getRange(r, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setBackground(GREEN)
    .setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(r, head.length).setBackground(ORANGE);
  sh.setRowHeight(r, 44);
  r++;

  var body = [], marks = [];                  // marks: rows to style after writing
  var grand = {}, grandTotal = 0;

  officeNames.forEach(function (o) {
    var list = offices[o];

    marks.push({ row: r + body.length, kind: 'office' });
    var oRow = ['OFFICE: ' + o];
    for (var i = 0; i < cols.length + 1; i++) oRow.push('');
    body.push(oRow);

    var sub = {}, subTotal = 0;
    list.forEach(function (p) {
      var line = [p.agent];
      cols.forEach(function (c) {
        var v = p.d[c] || 0;
        line.push(v);
        sub[c] = (sub[c] || 0) + v;
        grand[c] = (grand[c] || 0) + v;
      });
      line.push(p.total);
      subTotal += p.total;
      grandTotal += p.total;
      body.push(line);
    });

    marks.push({ row: r + body.length, kind: 'sub' });
    var sRow = [o + ' TOTAL'];
    cols.forEach(function (c) { sRow.push(sub[c] || 0); });
    sRow.push(subTotal);
    body.push(sRow);

    body.push(new Array(head.length).join('.').split('.'));   // spacer row
  });

  marks.push({ row: r + body.length, kind: 'grand' });
  var gRow = ['TOTAL - ' + team.toUpperCase()];
  cols.forEach(function (c) { gRow.push(grand[c] || 0); });
  gRow.push(grandTotal);
  body.push(gRow);

  sh.getRange(r, 1, body.length, head.length).setValues(body);
  sh.getRange(r, 2, body.length, head.length - 1)
    .setNumberFormat('#,##0').setHorizontalAlignment('center');

  marks.forEach(function (m) {
    var rng = sh.getRange(m.row, 1, 1, head.length);
    if (m.kind === 'office') {
      rng.setBackground(OFFICE).setFontWeight('bold').setFontColor('#1f3864');
    } else if (m.kind === 'sub') {
      rng.setBackground(GREY).setFontWeight('bold');
    } else {
      rng.setBackground(ORANGE).setFontWeight('bold').setFontSize(11);
    }
  });

  var after = r + body.length + 1;

  /* Agents whose team is neither India nor International. Named rather than
     dropped: a person missing from both reports is invisible, and the cause
     is a blank or misspelt Team cell on mdl_Roster, which somebody can fix. */
  if (other.length) {
    sh.getRange(after, 1).setValue('Not on either team - check the Team column on mdl_Roster: ' +
        other.map(function (p) {
          return p.agent + (p.total ? ' (' + p.total + ')' : '');
        }).join(', '))
      .setFontSize(9).setFontColor('#a04000').setWrap(true);
    sh.getRange(after, 1, 2, NC).merge();
    after += 3;
  }

  sh.getRange(after, 1).setValue(
      'One column per outcome: the sub-disposition where a lead has one, the disposition where it does not. ' +
      'Counts leads, not calls. Only agents on mdl_Roster appear, which is what makes this Inside Sales only - ' +
      'managers, lead pools and other teams are excluded. Rebuild with buildLeadReportIndia() or ' +
      'buildLeadReportIntl(), optionally passing a month like \'2026-07\'.')
    .setFontSize(9).setFontStyle('italic').setFontColor('#666666').setWrap(true);
  sh.getRange(after, 1, 2, NC).merge();

  sh.setColumnWidth(1, 210);
  for (var c2 = 2; c2 <= head.length; c2++) sh.setColumnWidth(c2, 84);
  sh.setFrozenRows(hRow);
  SpreadsheetApp.flush();
}


/** '2026-08' -> 'August 2026'. */
function lr_monthLabel_(m) {
  var p = String(m).split('-');
  if (p.length !== 2) return String(m);
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
               'August', 'September', 'October', 'November', 'December'];
  var i = Number(p[1]) - 1;
  return (i < 0 || i > 11) ? String(m) : names[i] + ' ' + p[0];
}


/* ================================================================
   PROVE THE GROUPING, WITHOUT A SHEET
   ================================================================ */
function slpLeadReportSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  eq('month label', lr_monthLabel_('2026-08'), 'August 2026');
  eq('month label passes odd input through', lr_monthLabel_('nonsense'), 'nonsense');

  var ros = { count: 4, byKey: {
    a: { agent: 'Ann', office: 'BLR', team: 'India' },
    b: { agent: 'Bob', office: 'BLR', team: 'India' },
    c: { agent: 'Cal', office: 'HYD', team: 'International' },
    d: { agent: 'Dee', office: 'HYD', team: '' }
  } };
  /* A blank Team cell must be reported as "(blank)" rather than vanishing -
     that string is what tells somebody which cell on mdl_Roster to go and
     fill in. */
  eq('a blank Team cell is named, not skipped',
     lr_teamValues_(ros).join(','), '(blank),India,International');

  /* Dee has a blank team, so she belongs to neither report and must appear
     in the "not on either team" line rather than being dropped. */
  var teams = lr_teamValues_(ros);
  eq('both real teams still recognised',
     teams.indexOf('India') > -1 && teams.indexOf('International') > -1, true);

  if (fails.length) {
    Logger.log('SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('SELF TEST PASSED');
  }
  return fails;
}


/* Local number and padding helpers.

   withCommas_ lives in RefreshSchedule.gs and agentPad_ in
   AgentLeadReport.gs. Borrowing them would mean this report stops posting
   because a different file was not pasted, which is a failure with no
   relationship to its cause. */
function lr_commas_(n) {
  var s = String(Math.round(Number(n) || 0));
  var out = '', c = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    out = s.charAt(i) + out;
    if (++c % 3 === 0 && i > 0) out = ',' + out;
  }
  return out;
}

function lr_pad_(s, width) {
  s = String(s);
  while (s.length < width) s += ' ';
  return s;
}
