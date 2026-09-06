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
 *
 *   If EVERY lead lands in one column called "(none)", the payload is not
 *   carrying the outcome at all. That is the routine's prompt, not this
 *   file - it needs v4, which sends "b" on every row.
 *
 * SLACK GETS THE SAME TABLE
 *
 *   Not a summary of it. Agents down, outcomes across, offices in order,
 *   totals where they are on the tab. Two differences, both forced by the
 *   width of a Slack message and both stated at the foot of the post:
 *   headings are short (NC2, not "Non Contact-2"), and outcomes outside the
 *   familiar seventeen are summed into one OTHR column. The tab keeps every
 *   outcome in a column of its own.
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

    var b = String((r.b !== undefined ? r.b : r.bucket) || '').trim() || LR_NONE;
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

  /* Everything Slack needs to print the same table, so it never
     recomputes a number that is already on the tab. */
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

  /* The grid itself, so Slack can print the same table rather than
     rebuilding it from a different set of numbers and drifting. */
  var groups = officeNames.map(function (o) {
    return {
      office: o,
      people: offices[o].map(function (p) {
        return { agent: p.agent, d: p.d, total: p.total };
      })
    };
  });

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
           cols: cols, groups: groups, noTeam: other.length };
}


/* ================================================================
   THE SLACK POST

   The whole grid, not a summary of it. Every agent is a line, every
   outcome a column, exactly as on the tab.

   Three things make that fit in Slack:

     the code fence   postToSlack_ wraps each part in one, which is the
                      only way Slack keeps runs of spaces - without it
                      the columns collapse into a ragged sentence

     short headings   "NC2" instead of "Non Contact-2". Full names are
                      six times the width of the number underneath them,
                      and the width is the whole problem. A legend at the
                      bottom spells every one of them out

     one block per    postToSlack_ splits on blank lines and caps each
     office           part at 2800 characters. An office is a block and
                      carries its own heading row, so wherever the split
                      lands the reader still has the column names

   It is still wide - that is what a table of this shape is. On a phone
   the code block scrolls sideways; the link at the bottom opens the tab
   for anyone who would rather pinch and zoom there.
   ================================================================ */

/**
 * Cap on the owner column for AGENT names. Longer ones are cut, not
 * wrapped - one long name must not push every number sideways. Twenty
 * fits all but a handful of the roster; the total rows are allowed past
 * it, because a cut total label reads as a different total.
 */
var LR_SLACK_NAME_W = 20;

/** The Slack-only catch-all for outcomes outside the familiar seventeen. */
var LR_OTHER = 'Other';

/**
 * What a lead with no outcome at all is called.
 *
 * It must never be pooled into OTHR. On 19 Aug a payload sent a blank
 * outcome for every untouched lead - 989 of them on the India report -
 * and because "(none)" is not one of the seventeen named columns it went
 * straight into the catch-all, where a number that size is invisible.
 *
 * A bucket this big is a fact about the month, not a rounding error: it
 * is the work not yet started. It gets a column of its own whatever the
 * payload calls it.
 */
var LR_NONE = '(none)';

/**
 * Characters per page of the grid.
 *
 * A Slack section holds 3000 and chunkForSlack_ budgets 2800 for the
 * code fence it adds. Staying under that here means postToSlack_ never
 * has to split a page, so every page keeps the heading row this file
 * put at the top of it.
 */
var LR_SLACK_PAGE = 2500;

/**
 * Short headings for the outcomes that have them.
 *
 * Only the familiar ones are listed. Anything SuperLeap invents later
 * gets an abbreviation derived from its name, so a new outcome appears
 * in the table on its own rather than waiting for this map to be edited.
 */
var LR_ABBR = {
  'Lead': 'LEAD', 'PTP': 'PTP', 'WFC': 'WFC',
  'Non Contact': 'NC', 'Non Contact-1': 'NC1', 'Non Contact-2': 'NC2',
  'Non Contact-3': 'NC3', 'Non Contact-4': 'NC4', 'Non Contact-5': 'NC5',
  'Not Interested': 'NI', 'Not Reachable': 'NR', 'Prospect': 'PROS',
  'Deferred Hot': 'DHOT', 'Followup': 'FUP', 'Student': 'STUD',
  'Disqualified': 'DISQ', 'Financial Issue': 'FIN', 'Other': 'OTHR',
  '(none)': 'NONE'
};

/**
 * A heading for an outcome nothing has named yet.
 *
 * One word gives its first four letters, several give their initials -
 * so "Callback" reads CALL and "Language Barrier" reads LB. Digits are
 * kept wherever they appear, which is what keeps the five Non Contact
 * levels apart.
 */
function lr_abbr_(name) {
  var s = String(name || '').trim();
  if (LR_ABBR[s]) return LR_ABBR[s];
  if (!s) return '?';

  var digits = s.replace(/[^0-9]/g, '');
  var words = s.replace(/[^A-Za-z ]/g, ' ').split(/\s+/)
               .filter(function (w) { return w; });
  var base;
  if (!words.length) base = 'X';
  else if (words.length === 1) base = words[0].substring(0, 4);
  else base = words.map(function (w) { return w.charAt(0); }).join('').substring(0, 4);

  return (base + digits).toUpperCase().substring(0, 5);
}

/** Headings for a whole column list, with collisions broken by a digit. */
function lr_abbrs_(cols) {
  var used = {}, out = [];
  cols.forEach(function (c) {
    var a = lr_abbr_(c), t = a, i = 2;
    while (used[t]) { t = (a + i).substring(0, 5); i++; }
    used[t] = true;
    out.push(t);
  });
  return out;
}

function lr_slack_(team, tabName, label, firedAt) {
  var res = lr_build_(team, tabName);

  if (res.error) {
    return {
      subject: '[' + label + '] report not built',
      body: 'As at ' + firedAt + ' IST\n\n!! ' + res.error +
            '\nThe tab was left as it was; nothing below is new.'
    };
  }

  /* Only the outcomes this team actually recorded. A column of nothing
     but zeroes costs width and says nothing; how many were left out is
     stated at the bottom so the omission is visible rather than quiet. */
  var present = [], emptied = 0;
  res.cols.forEach(function (c) {
    var n = 0;
    res.groups.forEach(function (g) {
      g.people.forEach(function (p) { n += (p.d[c] || 0); });
    });
    if (n) present.push(c); else emptied++;
  });
  if (!present.length) present = res.cols.slice(0, 6);

  /* Width is the one thing that decides whether this is readable, and
     SuperLeap carries about twenty-six distinct outcomes against the
     seventeen the report is read for. The seventeen keep their own
     columns; the rest are summed into OTHER and named underneath. The
     tab still shows every one of them separately - this trade is Slack's
     alone, and it is what brings the line back under a screen width. */
  var known = [], extra = [];
  present.forEach(function (c) {
    if (c === LR_NONE) { known.push(c); return; }   // never pooled - see LR_NONE
    (LR_COLS.indexOf(c) > -1 ? known : extra).push(c);
  });
  var live = known.slice();
  if (extra.length) live.push(LR_OTHER);

  /* One place that answers "what goes in this cell", so the body, the
     office totals and the grand total can never disagree about OTHER. */
  function valOf(p, c) {
    if (c !== LR_OTHER) return p.d[c] || 0;
    var n = 0;
    extra.forEach(function (e) { n += (p.d[e] || 0); });
    return n;
  }

  var head = lr_abbrs_(live);

  /* Column widths from the widest thing that will sit in them, headings
     and office totals included, so nothing overflows its column and
     shunts the rest of the line out of alignment. */
  /* Every number that will be printed, the office subtotals and the grand
     total included. Leaving the grand total out of this is what put
     "1013" in a column three characters wide and shifted the whole
     TOTAL - INDIA line one place left of its heading. */
  var W = head.map(function (h) { return Math.max(h.length, 3); });
  var totW = 5, gsum = [];
  res.groups.forEach(function (g) {
    var sub = [];
    g.people.forEach(function (p) {
      live.forEach(function (c, i) {
        var n = valOf(p, c);
        if (String(n).length > W[i]) W[i] = String(n).length;
        sub[i] = (sub[i] || 0) + n;
        gsum[i] = (gsum[i] || 0) + n;
      });
      totW = Math.max(totW, String(p.total).length);
    });
    live.forEach(function (c, i) {
      W[i] = Math.max(W[i], String(sub[i] || 0).length);
    });
  });
  live.forEach(function (c, i) {
    W[i] = Math.max(W[i], String(gsum[i] || 0).length);
  });
  totW = Math.max(totW, String(res.leads).length, 5);

  /* The owner column has to hold the total rows' labels as well as the
     names - "TOTAL - INTERNATIONAL" is longer than any agent and was
     being cut to "TOTAL - INTERNATI.". */
  var labels = ['TOTAL - ' + team.toUpperCase()];
  var nameW = 0;
  res.groups.forEach(function (g) {
    labels.push(g.office.toUpperCase() + ' TOTAL');
    g.people.forEach(function (p) {
      nameW = Math.max(nameW, Math.min(p.agent.length, LR_SLACK_NAME_W));
    });
  });
  labels.forEach(function (t) { nameW = Math.max(nameW, t.length); });
  nameW = Math.max(Math.min(nameW, LR_SLACK_NAME_W + 8), 14);

  function line(label0, values, total) {
    var s = lr_pad_(lr_cut_(label0, nameW), nameW);
    values.forEach(function (v, i) { s += ' ' + lr_lpad_(v, W[i]); });
    return s + ' ' + lr_lpad_(total, totW);
  }
  var headRow = line('OWNER', head, 'TOTAL');
  var wrapAt = Math.max(headRow.length, 60);

  /* ---- what the month is ---- */
  var L = [];
  L.push('As at ' + firedAt + ' IST   (' + label + ')');
  L.push(lr_monthLabel_(res.month) + '   |   snapshot ' +
         (typeof slp_stamp_ === 'function' ? slp_stamp_(res.snapshot) : '') +
         '   |   ' + res.agents + ' agents   ' + lr_commas_(res.leads) + ' leads');
  lr_wrap_('Batches: ', (res.batches && res.batches.length
      ? res.batches.join(', ')
      : 'not carried by this payload'), wrapAt)
    .forEach(function (x) { L.push(x); });

  /* ---- the grid, in blocks that carry their own heading ----

     An office of 27 agents is past what one Slack section holds, and
     leaving the split to postToSlack_ drops the second half in with no
     column names above it - which is what happened the first time this
     ran. Pagination belongs here, where the heading row can be repeated
     at the top of each page. Blank lines between the pages are what
     stop chunkForSlack_ from cutting anywhere else. */
  var grand = [], grandTotal = 0;
  res.groups.forEach(function (g) {
    var sub = [], subTotal = 0;
    var body = g.people.map(function (p) {
      var vals = live.map(function (c, i) {
        var v = valOf(p, c);
        sub[i] = (sub[i] || 0) + v;
        grand[i] = (grand[i] || 0) + v;
        return v;
      });
      subTotal += p.total;
      grandTotal += p.total;
      return line(p.agent, vals, p.total);
    });
    body.push(line(g.office.toUpperCase() + ' TOTAL',
                   live.map(function (c, i) { return sub[i] || 0; }), subTotal));

    var head0 = 'OFFICE: ' + g.office + '   (' + g.people.length + ' agents, ' +
                lr_commas_(subTotal) + ' leads)';
    var overhead = head0.length + headRow.length + 24;

    /* Fill each page to the brim and the office total gets pushed onto a
       page of its own - a heading, a row of column names and one line,
       which reads as a broken table rather than a continuation. Splitting
       into equal pages instead puts half the office on each and keeps the
       total with the agents it totals. */
    function fits(n) {
      var per = Math.ceil(body.length / n);
      for (var i = 0; i < body.length; i += per) {
        var len = overhead;
        for (var j = i; j < Math.min(i + per, body.length); j++) len += body[j].length + 1;
        if (len > LR_SLACK_PAGE) return false;
      }
      return true;
    }
    var pages = 1;
    while (pages < body.length && !fits(pages)) pages++;

    var per = Math.ceil(body.length / pages);
    for (var p = 0; p * per < body.length; p++) {
      L.push('');
      L.push(p ? head0 + '   cont. ' + (p + 1) : head0);
      L.push(headRow);
      body.slice(p * per, (p + 1) * per).forEach(function (b) { L.push(b); });
    }
  });

  L.push('');
  L.push(headRow);
  L.push(line('TOTAL - ' + team.toUpperCase(),
              live.map(function (c, i) { return grand[i] || 0; }), grandTotal));

  /* ---- what the headings mean ---- */
  L.push('');
  L.push('Columns');
  var pairs = known.map(function (c, i) { return head[i] + ' = ' + c; });
  for (var i = 0; i < pairs.length; i += 2) {
    /* Cut before padding. Padding a pair that is already past the column
       width does nothing, and the next pair then starts flush against
       it - which is how "requirements" and "DTAO" ended up as one word. */
    L.push('  ' + pairs.slice(i, i + 2).map(function (p) {
      return lr_pad_(lr_cut_(p, 43), 44);
    }).join('').replace(/\s+$/, ''));
  }
  if (extra.length) {
    lr_wrap_('  OTHR = ', extra.join(', '), wrapAt)
      .forEach(function (x) { L.push(x); });
  }
  if (emptied) {
    L.push('  ' + emptied + ' outcome column(s) were zero for every agent ' +
           'this month; they are on the tab.');
  }

  if (res.noTeam) {
    L.push('');
    L.push('!! ' + res.noTeam + ' agent(s) are on neither team - check the');
    L.push('   Team column on mdl_Roster. They are named at the tab\'s foot.');
  }

  if (res.url) {
    L.push('');
    L.push('<' + res.url + '|Open the full table>');
  }

  return {
    subject: '[' + label + '] ' + lr_monthLabel_(res.month) + '   ' +
             lr_commas_(res.leads) + ' leads   ' + res.agents + ' agents',
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

  /* ---- the Slack table's formatting ---- */
  eq('named outcomes keep their heading', lr_abbr_('Non Contact-2'), 'NC2');
  eq('an unnamed one word outcome', lr_abbr_('Callback'), 'CALL');
  eq('an unnamed multi word outcome', lr_abbr_('Language Barrier'), 'LB');
  eq('digits are kept, so levels stay apart', lr_abbr_('Some Level 4'), 'SL4');
  eq('an empty outcome still gets a heading', lr_abbr_(''), '?');

  /* Two outcomes reducing to the same letters would put two columns
     under one heading and there would be no way to tell which was
     which. */
  eq('collisions are broken apart',
     lr_abbrs_(['Alpha Beta', 'Alpha Bravo']).join(','), 'AB,AB2');

  /* Every column the Slack table can ever show must have a heading
     chosen deliberately, not derived. The derived form is a safety net
     for an outcome SuperLeap invents, and a net is not a design: a new
     entry added to LR_COLS without one would read as something like
     "PC2" and mean nothing to anybody. This is the assertion that says
     so at the moment the column is added, rather than in a Slack post. */
  var unnamed = [];
  LR_COLS.concat([LR_OTHER, LR_NONE]).forEach(function (c) {
    if (!LR_ABBR[c]) unnamed.push(c);
  });
  eq('every possible column has a deliberate heading', unnamed.join(','), '');

  /* The untouched-work bucket must never be swept into OTHR - it was, and
     989 leads went invisible for it. */
  eq('the blank bucket has its own heading', lr_abbr_(LR_NONE), 'NONE');
  eq('it does not collide with anything else',
     lr_abbrs_(LR_COLS.concat([LR_NONE, LR_OTHER])).join(',').indexOf('NONE') > -1, true);

  /* Headings must not depend on which columns happen to be non-zero
     this month, or a reader comparing two days would see the same
     outcome under two different names. */
  var fullSet = lr_abbrs_(LR_COLS.concat([LR_OTHER]));
  var subset = lr_abbrs_(['Lead', 'Not Interested', LR_OTHER]);
  eq('a heading does not change with the month\'s column set',
     [subset[0], subset[1], subset[2]].join(','),
     [fullSet[LR_COLS.indexOf('Lead')],
      fullSet[LR_COLS.indexOf('Not Interested')],
      fullSet[LR_COLS.length]].join(','));

  /* Numbers must be right-aligned or a column of them does not line up,
     and a long name must be cut rather than widen every row. */
  eq('numbers right align', lr_lpad_(42, 5), '   42');
  eq('a long name is cut and marked', lr_cut_('Baishali Bhattercharya', 18), 'Baishali Bhatterc.');
  eq('a short name is left alone', lr_cut_('Divya', 18), 'Divya');

  /* Pages are split evenly rather than filled to the brim. Filling put
     21 agents on one page and the office total alone on the next, under
     its own heading and column names - which reads as a broken table.
     This is the arithmetic that decides it, checked directly: 22 lines
     that need two pages must come out 11 and 11, never 21 and 1. */
  function pagesFor(lines, overhead, budget) {
    function fits(n) {
      var per = Math.ceil(lines.length / n);
      for (var i = 0; i < lines.length; i += per) {
        var len = overhead;
        for (var j = i; j < Math.min(i + per, lines.length); j++) len += lines[j] + 1;
        if (len > budget) return false;
      }
      return true;
    }
    var n = 1;
    while (n < lines.length && !fits(n)) n++;
    return Math.ceil(lines.length / n);
  }
  var twentyTwo = [];
  for (var q = 0; q < 22; q++) twentyTwo.push(107);
  eq('a full office splits evenly, not to the brim',
     pagesFor(twentyTwo, 175, LR_SLACK_PAGE), 11);
  eq('a small office stays on one page',
     pagesFor([107, 107, 107], 175, LR_SLACK_PAGE), 3);

  /* A code block does not wrap. One long line of batch codes would set
     the sideways scroll for the whole table if it were not broken up. */
  var w = lr_wrap_('Batches: ', 'C160, C161, C162, BC14', 24);
  eq('a long line is broken', w.length > 1, true);
  eq('every piece fits the width',
     w.filter(function (x) { return x.length > 24; }).length, 0);
  eq('no code is lost in the wrap',
     w.join(' ').replace(/\s+/g, ' ').indexOf('C162,') > -1, true);
  eq('a short line is left on one line',
     lr_wrap_('Batches: ', 'C160', 40).length, 1);

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

/**
 * Wrap a long comma-separated line to the table's width.
 *
 * A code block does not wrap, so one long line of batch codes sets the
 * sideways scroll for everything under it - the table could be 100
 * characters wide and still need a 190-character swipe because of a
 * sentence. Broken on commas, so no code is split in half.
 */
function lr_wrap_(prefix, text, width) {
  var parts = String(text).split(', ');
  var out = [], line = prefix;
  var indent = lr_pad_('', Math.min(prefix.length, 9));

  parts.forEach(function (p, i) {
    var piece = p + (i < parts.length - 1 ? ',' : '');
    if (line !== prefix && line !== indent && (line + ' ' + piece).length > width) {
      out.push(line);
      line = indent;
    }
    line += (line === prefix || line === indent) ? piece : ' ' + piece;
  });
  if (line.replace(/\s+$/, '')) out.push(line);
  return out;
}

/** Right-aligned, which is the only way a column of numbers reads as one. */
function lr_lpad_(s, width) {
  s = String(s);
  while (s.length < width) s = ' ' + s;
  return s;
}

/**
 * Cut a long name to the column, marking that it was cut.
 *
 * Letting one long name widen the owner column pushes every number
 * sideways for the sake of a single row, and the table is already as
 * wide as Slack will take.
 */
function lr_cut_(s, width) {
  s = String(s);
  return s.length <= width ? s : s.substring(0, width - 1) + '.';
}
