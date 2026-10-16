/**
 * reconcile - READ ONLY. Writes nothing. The whole chain in one log.
 *
 * WHY THIS AND NOT ANOTHER GUESS
 *
 *   Three results now have to be true at once:
 *
 *     fixOnRoster   every roster agent's payment rows are stamped YES
 *     the report    sums exactly those rows, and shows 1.35 cr
 *     findTheMissing  model >= CBC for all 93 agents
 *
 *   If all three hold, then CBC's own 93 agents add up to 1.35 cr or
 *   less. So the 1.56 cr on the CBC screenshot is NOT the sum of those
 *   93 agents' revenue column - or findTheMissing was reading the wrong
 *   column and "nothing is short" meant nothing.
 *
 *   wr_col_ falls back to substring matching. Asked for 'revenue' it will
 *   take "Revenue Target" or "Revenue %" if that column comes first. If
 *   it picked a column like that, every per-agent comparison I have run
 *   today was against the wrong numbers, and all four of my diagnoses
 *   rest on it.
 *
 *   So this stops naming a column and prints EVERY column in CBC's roster
 *   with its total. Whichever one adds to 1.56 cr is the one the business
 *   means by revenue, and we will both be able to see it.
 *
 * WHAT IT PRINTS
 *
 *   1. src_Roster for this month: the header row, every column, and the
 *      total of each numeric one - over agent rows, and over all rows, so
 *      a Total row baked into the tab shows up as the difference.
 *   2. mdl_Payments for this month: YES rows, NO rows, and the whole tab,
 *      so the report's figure can be checked against its own input.
 *   3. The Management Report's own "Total revenue" cell, read off the page
 *      rather than taken from a screenshot.
 *   4. The biggest off-roster Lead Owners, flagged where the name shares a
 *      word with somebody on the roster - a variant spelling, which is the
 *      one thing findTheMissing could not see once it decided nothing was
 *      short.
 *   5. Every agent where CBC and the model differ, in BOTH directions.
 *      Today's checks only ever looked for CBC being higher.
 */

function reconcile() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  L('=== RECONCILE ===   ' + monthKey + '   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing is written.');
  L('');

  /* ================================================================
     1. CBC's roster, every column, with totals
     ================================================================ */
  var src = rc_srcTab_(ss, monthKey);
  if (!src) { L('  *** No src_Roster tab for ' + monthKey + '.'); return; }

  L('  --- 1. ' + src.name + ' ---');
  L('  header on row ' + (src.hr + 1) + ', agent column ' + rc_a1_(src.cAgent) +
    ', ' + src.agentRows.length + ' agent rows');
  L('');
  L('  ' + rc_pad_('col', 5) + rc_pad_('header', 30) +
    rc_pad_('total over agents', 20) + 'total over all rows');

  var cands = [];
  for (var c = 0; c < src.width; c++) {
    var head = wr_str_(src.grid[src.hr][c]);
    var sumAgents = 0, nAgents = 0, sumAll = 0, nAll = 0;
    for (var i = 0; i < src.agentRows.length; i++) {
      var v = src.grid[src.agentRows[i]][c];
      if (rc_isNum_(v)) { sumAgents += wr_num_(v); nAgents++; }
    }
    for (var r = src.hr + 1; r < src.grid.length; r++) {
      var v2 = src.grid[r][c];
      if (rc_isNum_(v2)) { sumAll += wr_num_(v2); nAll++; }
    }
    if (!head && !nAll) continue;
    L('  ' + rc_pad_(rc_a1_(c), 5) + rc_pad_(head || '(no header)', 30) +
      rc_pad_(nAgents ? rc_money_(sumAgents) : '-', 20) +
      (nAll ? rc_money_(sumAll) : '-') +
      (nAll > nAgents ? '   (' + (nAll - nAgents) + ' row(s) outside the agent list)' : ''));
    if (nAgents > 5) cands.push({ col: c, head: head, sum: sumAgents });
  }
  L('');

  /* What today's checks were actually comparing against. */
  var H = wr_headers_(src.grid[src.hr]);
  var picked = wr_col_(H, ['realised revenue', 'realized revenue', 'revenue']);
  L('  wr_col_ asked for revenue picks column ' +
    (picked >= 0 ? rc_a1_(picked) + '  "' + wr_str_(src.grid[src.hr][picked]) + '"'
                 : '*** nothing'));
  if (picked >= 0) {
    var pSum = 0;
    for (i = 0; i < src.agentRows.length; i++) pSum += wr_num_(src.grid[src.agentRows[i]][picked]);
    L('  and that column totals ' + rc_money_(pSum) + ' over the agent rows.');
    L('  THAT is the number every check today compared the model against.');
  }
  L('');

  /* ================================================================
     2. mdl_Payments for this month
     ================================================================ */
  var pay = rc_pay_(ss, monthKey);
  if (pay.error) { L('  *** ' + pay.error); return; }

  L('  --- 2. mdl_Payments, ' + monthKey + ' ---');
  L('    On Roster = YES : ' + rc_pad_(String(pay.yesRows), 8) + rc_money_(pay.yes));
  L('    On Roster = NO  : ' + rc_pad_(String(pay.noRows), 8) + rc_money_(pay.no));
  L('    whole month     : ' + rc_pad_(String(pay.yesRows + pay.noRows), 8) +
    rc_money_(pay.yes + pay.no));
  L('');
  L('    The YES line is what the report sums. If it does not match the');
  L('    page, the fault is in the report. If it does, the page is right');
  L('    about its own input and the question is which input is correct.');
  L('');

  /* ================================================================
     3. The report's own cell
     ================================================================ */
  L('  --- 3. the Management Report page ---');
  var mrTab = (typeof MR_TAB === 'string') ? MR_TAB : 'Management Report';
  var mrSh = ss.getSheetByName(mrTab);
  if (!mrSh) {
    L('    no "' + mrTab + '" tab.');
  } else {
    /* Wide enough for the real page: "Total revenue" sits on row 11 with
       this month and last month beside it, and the CBC line below that. */
    var mv = mrSh.getRange(1, 1, Math.min(60, mrSh.getLastRow()),
                           Math.min(14, mrSh.getLastColumn())).getDisplayValues();
    var shown = 0;
    for (r = 0; r < mv.length; r++) {
      var joined = mv[r].join(' ').toLowerCase();
      if (joined.indexOf('revenue') < 0 && joined.indexOf('cbc') < 0) continue;
      var cells = [];
      for (c = 0; c < mv[r].length; c++) {
        var t = String(mv[r][c]).trim();
        if (t) cells.push(rc_a1_(c) + ':' + t);
      }
      if (cells.length) { L('    row ' + (r + 1) + '  ' + cells.join('  |  ')); shown++; }
      if (shown >= 12) break;
    }
    if (!shown) L('    no row in the first 40 mentions revenue.');
  }
  L('');

  /* ================================================================
     4. the off-roster money, and which of it looks like a roster name
     ================================================================ */
  var ros = wr_roster_(ss, monthKey);
  var rosterToks = {}, k;
  for (k in ros.byAgent) rosterToks[k] = rc_toks_(ros.byAgent[k].name);

  var off = [];
  for (k in pay.offBy) off.push(pay.offBy[k]);
  off.sort(function (a, b) { return b.rev - a.rev; });

  L('  --- 4. biggest Lead Owners NOT on the roster (' +
    rc_money_(pay.no) + ' in all) ---');
  var flagged = 0, flaggedRev = 0;
  for (i = 0; i < off.length && i < 30; i++) {
    var t = rc_toks_(off[i].name), match = '';
    for (k in rosterToks) {
      if (rc_shares_(t, rosterToks[k])) { match = ros.byAgent[k].name; break; }
    }
    if (match) { flagged++; flaggedRev += off[i].rev; }
    L('    ' + rc_pad_(off[i].name, 30) + rc_pad_(rc_money_(off[i].rev), 12) +
      (match ? '<-- shares a name with "' + match + '"' : ''));
  }
  if (off.length > 30) L('    ... and ' + (off.length - 30) + ' more');
  L('');
  if (flagged) {
    L('    ' + flagged + ' of those, ' + rc_money_(flaggedRev) + ', share a word with');
    L('    somebody on the roster. Each one is either a variant spelling that');
    L('    belongs to a sales agent, or a different person who happens to');
    L('    share a name. Confirm them and they become WR_ALIASES entries.');
    L('');
  }

  /* ================================================================
     5. CBC against the model, BOTH directions
     ================================================================ */
  L('  --- 5. CBC against the model, per agent ---');
  if (picked < 0) { L('    no revenue column in CBC, nothing to compare.'); return; }

  var rows = [], cbcTotal = 0, mdlTotal = 0;
  for (i = 0; i < src.agentRows.length; i++) {
    var name = wr_str_(src.grid[src.agentRows[i]][src.cAgent]);
    var key = wr_key_(name);
    var cbcRev = wr_num_(src.grid[src.agentRows[i]][picked]);
    var mdlRev = pay.byAgent[key] ? pay.byAgent[key].rev : 0;
    cbcTotal += cbcRev; mdlTotal += mdlRev;
    if (Math.abs(cbcRev - mdlRev) >= 1000) {
      rows.push({ name: name, cbc: cbcRev, mdl: mdlRev, d: mdlRev - cbcRev });
    }
  }
  rows.sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });

  L('    CBC total over its agent rows : ' + rc_money_(cbcTotal));
  L('    model total for the same names: ' + rc_money_(mdlTotal));
  L('    difference                    : ' + rc_money_(mdlTotal - cbcTotal));
  L('');
  if (!rows.length) {
    L('    Every agent agrees to within 1000. Then CBC\'s headline is not the');
    L('    sum of this column, and the figure to chase is in section 1 above.');
  } else {
    L('    ' + rows.length + ' agent(s) differ by 1000 or more. Negative = model has less.');
    for (i = 0; i < rows.length && i < 40; i++) {
      L('    ' + rc_pad_(rows[i].name, 28) +
        'CBC ' + rc_pad_(rc_money_(rows[i].cbc), 11) +
        'model ' + rc_pad_(rc_money_(rows[i].mdl), 11) +
        (rows[i].d < 0 ? '-' : '+') + rc_money_(Math.abs(rows[i].d)));
    }
    if (rows.length > 40) L('    ... and ' + (rows.length - 40) + ' more');
  }
  L('');
  L('  Nothing was written. This only reports.');
}


/* =====================================================================
   CBC's roster tab for the month, with its agent rows identified
   ===================================================================== */

function rc_srcTab_(ss, monthKey) {
  var tabs = ss.getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], nm = sh.getName();
    if (!/^src_Roster/i.test(nm)) continue;
    var suffix = nm.replace(/^src_Roster[_\s-]*/i, '').trim();
    var tabMonth = wr_monthKey_(suffix + ' ' + monthKey.substring(0, 4));
    if (tabMonth && tabMonth !== monthKey) continue;

    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 3) continue;
    var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();

    for (var hr = 0; hr < grid.length && hr < 25; hr++) {
      var H = wr_headers_(grid[hr]);
      var cAgent = wr_col_(H, ['agent', 'agent name']);
      if (cAgent < 0) continue;
      var cMgr  = wr_col_(H, ['manager', 'reporting manager', 'tl']);
      var cCity = wr_col_(H, ['office', 'city', 'location', 'branch', 'city/region', 'region']);

      var agentRows = [];
      for (var r = hr + 1; r < grid.length; r++) {
        var a = wr_str_(grid[r][cAgent]);
        if (!a) continue;
        if (wr_isSummaryRow_(a, cMgr >= 0 ? wr_str_(grid[r][cMgr]) : '',
                                cCity >= 0 ? wr_str_(grid[r][cCity]) : '')) continue;
        if (/^[0-9.,%\s-]+$/.test(a)) continue;
        agentRows.push(r);
      }
      if (agentRows.length) {
        return { name: nm, grid: grid, hr: hr, cAgent: cAgent,
                 agentRows: agentRows, width: lastCol };
      }
    }
  }
  return null;
}


/* =====================================================================
   mdl_Payments for the month, split by the stamp the report filters on
   ===================================================================== */

function rc_pay_(ss, monthKey) {
  var out = { yes: 0, no: 0, yesRows: 0, noRows: 0, byAgent: {}, offBy: {}, error: '' };
  var sh = ss.getSheetByName('mdl_Payments');
  if (!sh || sh.getLastRow() < 2) { out.error = 'mdl_Payments is empty'; return out; }

  var lastCol = sh.getLastColumn();
  var grid = sh.getRange(1, 1, sh.getLastRow(), lastCol).getValues();
  var col = {};
  for (var c = 0; c < grid[0].length; c++) {
    var h = String(grid[0][c]).trim();
    if (h && col[h] === undefined) col[h] = c;
  }
  var iStamp = col['On Roster'],  iAgent = col['Lead Owner'];
  var iAmt   = col['Amount Paid'], iDate = col['Date'], iMonth = col['Month'];
  if (iStamp === undefined || iAgent === undefined || iAmt === undefined) {
    out.error = 'mdl_Payments is missing On Roster, Lead Owner or Amount Paid';
    return out;
  }

  for (var r = 1; r < grid.length; r++) {
    var row = grid[r];
    var mk = (iMonth !== undefined) ? wr_monthKey_(row[iMonth]) : '';
    if (!mk && iDate !== undefined) mk = wr_monthKey_(row[iDate]);
    if (mk !== monthKey) continue;

    var name = wr_str_(row[iAgent]);
    if (!name || wr_isSummary_(name)) continue;
    var amt = wr_num_(row[iAmt]);
    var key = wr_key_(name);

    if (String(row[iStamp]).trim().toUpperCase() === 'YES') {
      out.yes += amt; out.yesRows++;
      if (!out.byAgent[key]) out.byAgent[key] = { name: name, rev: 0 };
      out.byAgent[key].rev += amt;
    } else {
      out.no += amt; out.noRows++;
      if (!out.offBy[key]) out.offBy[key] = { name: name, rev: 0 };
      out.offBy[key].rev += amt;
    }
  }
  return out;
}


/* =====================================================================
   helpers
   ===================================================================== */

function rc_isNum_(v) {
  if (typeof v === 'number') return isFinite(v);
  var s = String(v == null ? '' : v).trim();
  if (!s) return false;
  return /^-?[0-9][0-9,]*(\.[0-9]+)?%?$/.test(s);
}

function rc_toks_(name) {
  var raw = String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
  var out = [];
  for (var i = 0; i < raw.length; i++) if (raw[i].length >= 4) out.push(raw[i]);
  return out;
}

function rc_shares_(a, b) {
  for (var i = 0; i < a.length; i++)
    for (var j = 0; j < b.length; j++) if (a[i] === b[j]) return true;
  return false;
}

function rc_a1_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = (n - k) / 26 | 0; }
  return s;
}

function rc_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

function rc_money_(n) {
  if (typeof wr_money_ === 'function') return wr_money_(n);
  return String(Math.round(n || 0));
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
