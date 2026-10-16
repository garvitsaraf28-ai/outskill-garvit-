/**
 * traceGap - READ ONLY. Writes nothing.
 *
 * WHAT RECONCILE SETTLED
 *
 *   CBC column G, Realised Revenue, over its 93 agent rows   1.56 cr
 *   mdl_Payments, On Roster = YES, October                   1.32 cr
 *   the report, 1.32 cr of payments plus 3.12 L of upgrade   1.35 cr
 *
 *   So the report is arithmetically right about its own input, and the
 *   gap is 16 named agents, 23.63 L, every one of them in the same
 *   direction: CBC credits them with money mdl_Payments does not have.
 *   That is the same 23.53 L the report's own CBC line has been printing
 *   all along.
 *
 *   It also ruled out the off-roster bucket. Those 5.48 cr sit under nine
 *   Lead Owners - Mastermind alone is 4 cr - and only one is a name
 *   variant, worth 1999. The missing money is not hiding there.
 *
 * WHY findTheMissing NEVER RAN
 *
 *   It gated its search on its own comparison, that comparison said
 *   nothing was short, and so the search it exists for never happened.
 *   A diagnostic that decides whether to look is a diagnostic that can
 *   talk itself out of looking. This one does not decide: it takes the
 *   16 agents as given and traces every one of them through both tabs.
 *
 * WHAT THIS DOES
 *
 *   For each short agent it asks two separate questions, because they
 *   have two completely different fixes:
 *
 *     1. Is the money in src_Payments under THIS agent's own spelling?
 *        Then it is in the import and not in the model, and the fault is
 *        the src_Payments -> mdl_Payments hop. No alias will fix that.
 *
 *     2. Is it in src_Payments under a DIFFERENT spelling?
 *        Then it is an alias, and WR_ALIASES is where it goes.
 *
 *     3. Neither? Then it is not in the import for this month at all -
 *        logged to another month, or not logged yet - and no change to
 *        this workbook can conjure it.
 *
 *   It ends by splitting the 23.63 L across those three, so the next
 *   thing I write is the fix for whichever bucket actually holds it
 *   rather than a fifth guess.
 */

function traceGap() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  L('=== TRACE GAP ===   ' + monthKey + '   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing is written.');
  L('');

  /* ---------- CBC ---------- */
  var cbc = tg_cbc_(ss, monthKey);
  if (!cbc) { L('  *** no src_Roster tab for ' + monthKey); return; }
  L('  CBC          : ' + cbc.tab + ' col ' + tg_a1_(cbc.col) + ' "' + cbc.head +
    '", ' + cbc.list.length + ' agents, ' + tg_money_(cbc.total));

  /* ---------- the model ---------- */
  var mdl = tg_mdl_(ss, monthKey);
  if (mdl.error) { L('  *** ' + mdl.error); return; }
  L('  model        : mdl_Payments, ' + mdl.rows + ' rows for ' + monthKey +
    ', ' + tg_money_(mdl.total));

  /* ---------- the import ---------- */
  var src = tg_srcPay_(ss, monthKey);
  if (src.error) { L('  *** ' + src.error); return; }
  L('  src_Payments : header row ' + (src.hr + 1) + ', ' + src.allRows +
    ' rows in all, ' + src.rows + ' for ' + monthKey + ', ' + tg_money_(src.total));
  L('');

  /* The single most useful line in this log. If the import holds more
     October rows than the model, rows are being lost on the way in and
     every per-agent result below is a symptom of that one thing. */
  L('  October rows : src_Payments ' + src.rows + '   ->   mdl_Payments ' + mdl.rows +
    '   (' + (src.rows - mdl.rows >= 0 ? '+' : '') + (src.rows - mdl.rows) + ')');
  L('  October money: src_Payments ' + tg_money_(src.total) + '   ->   mdl_Payments ' +
    tg_money_(mdl.total));
  L('');

  /* ---------- who is short ---------- */
  var short = [], k;
  for (var i = 0; i < cbc.list.length; i++) {
    var a = cbc.list[i], key = wr_key_(a.name);
    var have = mdl.byKey[key] ? mdl.byKey[key].rev : 0;
    if (a.rev - have < 1000) continue;
    short.push({ name: a.name, key: key, cbc: a.rev, mdl: have, gap: a.rev - have });
  }
  short.sort(function (x, y) { return y.gap - x.gap; });

  if (!short.length) { L('  No agent is short by 1000 or more. Nothing to trace.'); return; }

  /* roster keys, so a spelling that belongs to somebody else is not
     offered as this agent's missing money */
  var taken = {};
  for (i = 0; i < cbc.list.length; i++) taken[wr_key_(cbc.list[i].name)] = cbc.list[i].name;

  var bucket = { hop: { rev: 0, n: 0 }, alias: { rev: 0, n: 0 }, absent: { rev: 0, n: 0 } };
  var aliasLines = [];

  L('  ' + short.length + ' agent(s) short, ' + tg_money_(tg_sum_(short, 'gap')) + ' in all.');
  L('');

  for (i = 0; i < short.length; i++) {
    var s = short[i];
    var inSrc = src.byKey[s.key] ? src.byKey[s.key] : { rev: 0, n: 0 };

    L('  ' + s.name);
    L('    CBC ' + tg_pad_(tg_money_(s.cbc), 11) + 'model ' + tg_pad_(tg_money_(s.mdl), 11) +
      'short ' + tg_money_(s.gap));
    L('    src_Payments, same spelling : ' + tg_pad_(tg_money_(inSrc.rev), 11) +
      inSrc.n + ' row(s)');

    /* other spellings in the import carrying a word of this name */
    var toks = tg_toks_(s.name), hits = [], kk;
    for (kk in src.byKey) {
      if (kk === s.key) continue;
      if (taken[kk]) continue;                       // somebody else on the roster
      if (!tg_shares_(toks, tg_toks_(src.byKey[kk].name))) continue;
      hits.push(src.byKey[kk]);
    }
    hits.sort(function (x, y) { return y.rev - x.rev; });

    if (inSrc.rev - s.mdl >= 1000) {
      /* The import has it under their own name and the model does not.
         Nothing about naming is wrong here. */
      var lost = inSrc.rev - s.mdl;
      bucket.hop.rev += Math.min(lost, s.gap); bucket.hop.n++;
      L('    => ' + tg_money_(lost) + ' IS IN THE IMPORT AND NOT IN THE MODEL.');
      L('       A src_Payments -> mdl_Payments loss. No alias fixes this.');
    } else if (hits.length) {
      var best = 0;
      for (var h = 0; h < hits.length && h < 6; h++) {
        var close = Math.abs(hits[h].rev - s.gap) < Math.max(1000, s.gap * 0.05);
        L('    other spelling in the import: "' + hits[h].name + '"  ' +
          tg_money_(hits[h].rev) + (close ? '   <-- matches the shortfall' : ''));
        best += hits[h].rev;
        aliasLines.push("      '" + String(hits[h].name).toLowerCase() +
                        "' : '" + s.name + "',");
      }
      bucket.alias.rev += Math.min(best, s.gap); bucket.alias.n++;
      L('    => an ALIAS. The money is logged to a different spelling of this name.');
    } else {
      bucket.absent.rev += s.gap; bucket.absent.n++;
      L('    => NOT IN THE IMPORT FOR ' + monthKey + ' under any spelling that shares');
      L('       a word with this name. Either logged to another month, or not');
      L('       logged yet. Nothing in this workbook can supply it.');
    }
    L('');
  }

  /* ---------- the split ---------- */
  L('  WHERE THE ' + tg_money_(tg_sum_(short, 'gap')) + ' IS');
  L('    in the import, lost before the model : ' +
    tg_pad_(tg_money_(bucket.hop.rev), 12) + bucket.hop.n + ' agent(s)');
  L('    under another spelling in the import : ' +
    tg_pad_(tg_money_(bucket.alias.rev), 12) + bucket.alias.n + ' agent(s)');
  L('    not in the import for this month     : ' +
    tg_pad_(tg_money_(bucket.absent.rev), 12) + bucket.absent.n + ' agent(s)');
  L('');

  if (bucket.hop.rev > 0) {
    L('  THE FIRST LINE IS THE ONE THAT MATTERS. Money sitting in src_Payments');
    L('  that never reaches mdl_Payments is a fault in the hop between them,');
    L('  which is the same failure that lost the 12 October rows. Whatever');
    L('  builds mdl_Payments is dropping rows it was handed, and that is a');
    L('  single fix for every agent above rather than one per name.');
    L('');
  }
  if (aliasLines.length) {
    L('  WR_ALIASES candidates, for the ones that are spelling. Confirm each');
    L('  is the same person before I write any of them in - merging two real');
    L('  people is far worse than a name that visibly fails to match:');
    for (i = 0; i < aliasLines.length; i++) L(aliasLines[i]);
    L('');
  }
  L('  Nothing was written. This only reports.');
}


/* =====================================================================
   CBC's roster: the agent list and the revenue column, found the way
   reconcile found them rather than guessed at again.
   ===================================================================== */

function tg_cbc_(ss, monthKey) {
  var tabs = ss.getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], nm = sh.getName();
    if (!/^src_Roster/i.test(nm)) continue;
    var suffix = nm.replace(/^src_Roster[_\s-]*/i, '').trim();
    var tabMonth = wr_monthKey_(suffix + ' ' + monthKey.substring(0, 4));
    if (tabMonth && tabMonth !== monthKey) continue;
    if (sh.getLastRow() < 3) continue;

    var grid = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    for (var hr = 0; hr < grid.length && hr < 25; hr++) {
      var H = wr_headers_(grid[hr]);
      var cAgent = wr_col_(H, ['agent', 'agent name']);
      var cRev   = wr_col_(H, ['realised revenue', 'realized revenue', 'revenue']);
      if (cAgent < 0 || cRev < 0) continue;
      var cMgr  = wr_col_(H, ['manager', 'reporting manager', 'tl']);
      var cCity = wr_col_(H, ['office', 'city', 'location', 'branch', 'city/region', 'region']);

      var list = [], seen = {}, total = 0;
      for (var r = hr + 1; r < grid.length; r++) {
        var name = wr_str_(grid[r][cAgent]);
        if (!name) continue;
        if (wr_isSummaryRow_(name, cMgr >= 0 ? wr_str_(grid[r][cMgr]) : '',
                                   cCity >= 0 ? wr_str_(grid[r][cCity]) : '')) continue;
        if (/^[0-9.,%\s-]+$/.test(name)) continue;
        var key = wr_key_(name);
        if (seen[key]) continue;
        seen[key] = true;
        var rev = wr_num_(grid[r][cRev]);
        list.push({ name: name, rev: rev });
        total += rev;
      }
      if (list.length) {
        return { tab: nm, col: cRev, head: wr_str_(grid[hr][cRev]),
                 list: list, total: total };
      }
    }
  }
  return null;
}


/* =====================================================================
   mdl_Payments for the month, keyed by Lead Owner. Every row, not just
   the ones stamped YES: for a roster agent they are the same set, and
   counting only YES here would hide a stamp problem behind a hop problem.
   ===================================================================== */

function tg_mdl_(ss, monthKey) {
  var out = { byKey: {}, rows: 0, total: 0, error: '' };
  var sh = ss.getSheetByName('mdl_Payments');
  if (!sh || sh.getLastRow() < 2) { out.error = 'mdl_Payments is empty'; return out; }

  var grid = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var col = {};
  for (var c = 0; c < grid[0].length; c++) {
    var h = String(grid[0][c]).trim();
    if (h && col[h] === undefined) col[h] = c;
  }
  var iAgent = col['Lead Owner'], iAmt = col['Amount Paid'];
  var iDate = col['Date'], iMonth = col['Month'];
  if (iAgent === undefined || iAmt === undefined) {
    out.error = 'mdl_Payments has no Lead Owner or Amount Paid column';
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
    if (!out.byKey[key]) out.byKey[key] = { name: name, rev: 0, n: 0 };
    out.byKey[key].rev += amt; out.byKey[key].n++;
    out.rows++; out.total += amt;
  }
  return out;
}


/* =====================================================================
   src_Payments: the raw import. Its header is not row 1 - the tab
   carries a title and a warning above it.
   ===================================================================== */

function tg_srcPay_(ss, monthKey) {
  var out = { byKey: {}, rows: 0, allRows: 0, total: 0, hr: -1, error: '' };
  var sh = ss.getSheetByName('src_Payments');
  if (!sh || sh.getLastRow() < 3) { out.error = 'src_Payments is empty'; return out; }

  var lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, Math.min(10, sh.getLastRow()), lastCol).getValues();
  var hr = -1, c = null;
  for (var i = 0; i < head.length; i++) {
    var H = wr_headers_(head[i]);
    var cand = {
      date:  wr_col_(H, ['date', 'payment date', 'paid on']),
      agent: wr_col_(H, ['lead owner', 'agent', 'owner']),
      amt:   wr_col_(H, ['amount paid', 'amount', 'amount inr']),
      stat:  wr_col_(H, ['status'])
    };
    if (cand.date < 0 || cand.agent < 0 || cand.amt < 0) continue;
    hr = i; c = cand; break;
  }
  if (hr < 0) {
    out.error = 'no row in the first 10 of src_Payments names Date, Lead Owner and Amount Paid';
    return out;
  }
  out.hr = hr;

  var n = sh.getLastRow() - (hr + 1);
  if (n < 1) { out.error = 'src_Payments has a header and no rows'; return out; }
  out.allRows = n;

  var rows = sh.getRange(hr + 2, 1, n, lastCol).getValues();
  for (var r = 0; r < rows.length; r++) {
    var d = rows[r][c.date];
    if (wr_monthKey_(d) !== monthKey) continue;
    var name = wr_str_(rows[r][c.agent]);
    if (!name || wr_isSummary_(name)) continue;
    if (c.stat >= 0 &&
        String(rows[r][c.stat] || '').toLowerCase().indexOf('cancel') > -1) continue;
    var amt = wr_num_(rows[r][c.amt]);
    var key = wr_key_(name);
    if (!out.byKey[key]) out.byKey[key] = { name: name, rev: 0, n: 0 };
    out.byKey[key].rev += amt; out.byKey[key].n++;
    out.rows++; out.total += amt;
  }
  return out;
}


/* =====================================================================
   helpers
   ===================================================================== */

function tg_sum_(list, key) {
  var t = 0;
  for (var i = 0; i < list.length; i++) t += Number(list[i][key] || 0);
  return t;
}

function tg_toks_(name) {
  var raw = String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
  var out = [];
  for (var i = 0; i < raw.length; i++) if (raw[i].length >= 4) out.push(raw[i]);
  return out;
}

function tg_shares_(a, b) {
  for (var i = 0; i < a.length; i++)
    for (var j = 0; j < b.length; j++) if (a[i] === b[j]) return true;
  return false;
}

function tg_a1_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = (n - k) / 26 | 0; }
  return s;
}

function tg_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

function tg_money_(n) {
  if (typeof wr_money_ === 'function') return wr_money_(n);
  return String(Math.round(n || 0));
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
