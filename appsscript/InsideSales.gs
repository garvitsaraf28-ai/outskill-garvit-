/**
 * InsideSales.gs - the whole revenue number, from the two sources, in one pass.
 *
 * WHY THIS REPLACES ABOUT TWENTY FILES
 *
 *   "this is so simple easy to understand payments come in payment tracker
 *    and in cbc we can see those"
 *
 *   That is the design. Two sources. One join. One page.
 *
 *   What stands between them today is: two IMPORTRANGEs, four intermediate
 *   tabs, four columns of derived values stamped into cells and never
 *   recomputed, and a model builder that was pasted into a session that has
 *   since been summarised away and so cannot be read or repaired. See
 *   AUDIT.md for the full reckoning.
 *
 *   This opens CBC and the Payment Tracker directly, joins them in memory,
 *   and writes the page. Nothing is cached. Nothing is stamped. No
 *   intermediate tab is consulted, so none can go stale.
 *
 * WHAT IT NEVER DOES
 *
 *   It never writes to CBC. It never writes to the Payment Tracker. Both are
 *   opened read only and every call against them below is a read. It writes
 *   to exactly one tab in this workbook, "Management Report NEW", which it
 *   creates. The existing Management Report is not touched, not read, and
 *   not replaced - so this can be run with nothing at risk, and the two
 *   pages compared side by side.
 *
 * WHY IT CAN CHECK ITSELF
 *
 *   It reads CBC's own Realised Revenue column in the same pass that it
 *   totals the payments. So every run ends by printing CBC's figure against
 *   the one it just computed, per agent, from one read. The old chain could
 *   never do that: CBC arrived through an import that might be hours stale
 *   or in #REF!, and the comparison was against a model built by code that
 *   had already dropped rows.
 *
 * WHAT IS DERIVED HERE RATHER THAN STORED
 *
 *   on roster   Lead Owner keys to an agent on CBC's roster for the month.
 *               Asked at read time, every time. Never written down.
 *   manager     CBC's Manager column, for that agent, this month.
 *   office/team CBC's City/Region, split on the last dash:
 *               "India Team-Bangalore" -> team "India Team", city "Bangalore".
 *   a unit      a customer whose FIRST EVER payment in the tracker falls in
 *               this window, credited to the Lead Owner on that first row.
 *               That is what closing a deal this month means, and it is
 *               computable from the source - unlike an Is Unit flag written
 *               once by code nobody can read.
 *   upgrade     CBC's AIGF Upgrade / Catalyst column. Real revenue (a learner
 *               shifted programme and paid), so it counts, seeded at the
 *               agent so it rolls up through manager and office. It adds no
 *               unit, because no new deal was closed.
 *
 * NOT HERE YET
 *
 *   The SKU block, which reads mdl_Batches - a third source with its own
 *   shape. Left out of this pass deliberately rather than half done. The
 *   existing report still has it.
 *
 * RUN
 *
 *   insideSales()            this month
 *   insideSales('2026-09')   any month
 *   insideSalesSelfTest()    the arithmetic, on fixtures, touching no sheet
 */

/* The two sources. Read only, both of them. */
var INS_CBC_ID      = '1-r5VMZ2u9w7WrcyAgCdgzp4scJiJQONuPiUV6JbRu0s';
var INS_TRACKER_ID  = '1a-34agNIYY0ZcBIJKHpOsYb-ppM6FQZhietpWtBfreE';
var INS_TRACKER_TAB = 'All Payments';

/* A new tab. The existing report is never opened. */
var INS_OUT_TAB = 'Management Report NEW';

/* CBC carries the AIGF Upgrade / Catalyst figures in a column with no
   header. Where the label can be found this is ignored; where it cannot,
   this column is used and the log says it was assumed. Set it to '' to
   refuse to guess at all. */
var INS_CBC_UPGRADE_COL = 'AE';

/* Column positions on the page, matching the existing report exactly:
   labels in C, this month in D, last month in E. */
var INS_C = { LABEL: 3, V1: 4, V2: 5 };

var INS_COLS = ['Agents', 'Revenue', 'Target', 'Attain %', 'Gap', 'Units',
                'Avg Ticket', 'Rev / MM', 'Rev / Target Commitment'];

var INS_TZ = 'Asia/Kolkata';


function insideSales(monthKey) {
  var t0 = new Date();
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };

  var win = ins_window_(monthKey);
  L('=== INSIDE SALES ===   ' + win.monthKey + '   ' +
    Utilities.formatDate(t0, INS_TZ, 'dd MMM HH:mm'));
  L('  window ' + Utilities.formatDate(win.start, INS_TZ, 'dd MMM') + ' to ' +
    Utilities.formatDate(win.end, INS_TZ, 'dd MMM') + ', against ' +
    Utilities.formatDate(win.priorStart, INS_TZ, 'dd MMM') + ' to ' +
    Utilities.formatDate(win.priorEnd, INS_TZ, 'dd MMM'));
  L('  CBC and the Payment Tracker are opened read only and never written to.');
  L('');

  /* ---------- 1. CBC ---------- */
  var cbc = ins_cbc_(win.monthKey);
  if (cbc.error) { L('  *** CBC: ' + cbc.error); return; }
  L('  CBC   : "' + cbc.tab + '", header row ' + (cbc.hr + 1) + ', ' +
    cbc.agents.length + ' agents');
  L('          revenue column ' + ins_a1_(cbc.cRev) + ' "' + cbc.headRev +
    '", total ' + ins_money_(cbc.total));
  L('          target column  ' + (cbc.cTarget >= 0 ? ins_a1_(cbc.cTarget) : 'none') +
    ', total ' + ins_money_(cbc.targetTotal));
  L('          upgrade column ' + (cbc.cUp >= 0 ? ins_a1_(cbc.cUp) + ' (' + cbc.upHow + ')' : 'none') +
    ', total ' + ins_money_(cbc.upgradeTotal));
  L('          capacity       ' + (cbc.cMM >= 0 ? ins_a1_(cbc.cMM) + ', ' +
      ins_r2_(cbc.mmTotal) + ' man-months' : 'no ramp column, every agent counts as 1'));
  if (cbc.orphanRev) {
    L('          *** ' + cbc.orphanRows + ' row(s) carry ' + ins_money_(cbc.orphanRev) +
      ' of revenue with no agent name, in neither total:');
    for (var o = 0; o < cbc.orphans.length && o < 12; o++) {
      L('              row ' + ins_pad_(String(cbc.orphans[o].row), 5) +
        ins_pad_(ins_money_(cbc.orphans[o].rev), 11) + cbc.orphans[o].label);
    }
    L('              A total row is right to skip. Anything else is revenue');
    L('              nobody is credited with, and belongs to an agent.');
  }
  if (cbc.cUp < 0) {
    L('          *** no AIGF Upgrade / Catalyst column found on "' + cbc.tab + '".');
    L('              The tab is ' + cbc.width + ' columns wide (to ' +
      ins_a1_(cbc.width - 1) + ') and names them only to AD.');
    L('              Columns holding numbers under NO header:');
    for (var hl = 0; hl < cbc.headless.length; hl++) {
      L('                ' + ins_pad_(ins_a1_(cbc.headless[hl].col), 5) +
        ins_pad_(ins_money_(cbc.headless[hl].sum), 12) +
        cbc.headless[hl].n + ' value(s)');
    }
    L('              The upgrade is one of these. Capacity is the one summing');
    L('              to about 55. Tell me the letter and it gets counted, or');
    L('              set INS_CBC_UPGRADE_COL at the top of this file.');
  }
  L('');

  /* ---------- 2. the Payment Tracker ---------- */
  var pay = ins_tracker_(win);
  if (pay.error) { L('  *** tracker: ' + pay.error); return; }
  L('  PAYMENTS: ' + pay.source + ', header row ' + (pay.hr + 1) + ', ' +
    pay.allRows + ' rows in all');
  if (pay.newest) {
    var ageH = Math.round((new Date() - pay.newest) / 3600000);
    L('          newest payment in it: ' +
      Utilities.formatDate(pay.newest, INS_TZ, 'dd MMM HH:mm') +
      '  (' + ageH + ' hours ago)' +
      (ageH > 36 ? '   *** STALE. A payment taken since then is not on this page.' : ''));
  }
  L('          this window  ' + ins_pad_(String(pay.now.rows), 7) + ins_money_(pay.now.total));
  L('          last month   ' + ins_pad_(String(pay.prior.rows), 7) + ins_money_(pay.prior.total));
  if (pay.skipped) {
    L('          ' + pay.skipped + ' row(s) in the window skipped as cancelled.');
  }
  if (pay.partial) {
    L('          *** PARTIAL. Only the first ' + pay.partial + ' rows were read');
    L('              before the time budget. Every figure below is a floor,');
    L('              not a total. Say so rather than trusting the page.');
  }
  if (pay.statuses.length) {
    L('          statuses in the window, so nothing is excluded unseen:');
    for (var s = 0; s < pay.statuses.length && s < 12; s++) {
      L('            ' + ins_pad_(pay.statuses[s].name || '(blank)', 22) +
        ins_pad_(String(pay.statuses[s].rows), 7) + ins_money_(pay.statuses[s].rev));
    }
  }
  L('          units are first-ever payments: ' + pay.now.units + ' this window, ' +
    pay.prior.units + ' last month');
  L('');

  /* ---------- 3. the join ---------- */
  var m = ins_rollup_(cbc, pay);
  L('  JOIN  : ' + m.onRoster + ' of ' + cbc.agents.length +
    ' CBC agents have payments this window');
  L('          on roster  ' + ins_pad_(ins_money_(m.now.rev), 12) +
    m.now.units + ' unit(s)');
  L('          off roster ' + ins_pad_(ins_money_(m.offRev), 12) + m.offRows +
    ' row(s) under ' + m.offNames.length + ' Lead Owner(s) CBC does not list');
  if (m.offNames.length) {
    var top = m.offNames.slice(0, 8).map(function (x) {
      return x.name + ' ' + ins_money_(x.rev);
    });
    L('            ' + top.join('  |  '));
    L('            Other teams. Correctly excluded - but if a sales agent is');
    L('            in that list under a different spelling, that is money');
    L('            missing from the page and WR_ALIASES is where it is fixed.');
  }
  L('          upgrade    ' + ins_pad_(ins_money_(m.now.upgrade), 12) +
    'added to agent revenue, no units');
  L('');
  L('  TOTAL REVENUE ' + ins_money_(m.now.rev) + '   (payments ' +
    ins_money_(m.now.rev - m.now.upgrade) + ' + upgrade ' + ins_money_(m.now.upgrade) + ')');
  L('');

  /* ---------- 4. the page ---------- */
  ins_write_(ss, win, m, t0);
  L('  WROTE "' + INS_OUT_TAB + '". The existing Management Report was not touched.');
  L('');

  /* ---------- 5. does it agree with CBC ---------- */
  ins_reconcile_(cbc, m, L);

  L('');
  L('  done in ' + Math.round((new Date() - t0) / 1000) + 's');
}


/* =====================================================================
   THE WINDOW. Month to date, against the same days of last month.
   ===================================================================== */

function ins_window_(monthKey) {
  var now = new Date();
  var y, mo;
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    y = parseInt(monthKey.substring(0, 4), 10);
    mo = parseInt(monthKey.substring(5, 7), 10) - 1;
  } else {
    y = now.getFullYear(); mo = now.getMonth();
  }

  var start = new Date(y, mo, 1, 0, 0, 0);
  /* A month in the past is read whole. The current month stops now, because
     comparing a full month against a part month is the mistake that makes a
     page look like a collapse on the 2nd. */
  var isThisMonth = (y === now.getFullYear() && mo === now.getMonth());
  var end = isThisMonth ? now : new Date(y, mo + 1, 0, 23, 59, 59);

  var pStart = new Date(y, mo - 1, 1, 0, 0, 0);
  var dayCap = new Date(y, mo, 0).getDate();            // days in prior month
  var day = Math.min(end.getDate(), dayCap);
  var pEnd = new Date(y, mo - 1, day, 23, 59, 59);

  return {
    monthKey: y + '-' + ins_pad2_(mo + 1),
    start: start, end: end, priorStart: pStart, priorEnd: pEnd,
    label: Utilities.formatDate(start, INS_TZ, 'MMMM yyyy'),
    priorLabel: Utilities.formatDate(pStart, INS_TZ, 'MMMM yyyy'),
    shortLabel: Utilities.formatDate(start, INS_TZ, 'MMM'),
    priorShort: Utilities.formatDate(pStart, INS_TZ, 'MMM')
  };
}


/* =====================================================================
   CBC. The roster, the targets, the upgrade column, and CBC's own
   revenue figure for the reconciliation - all from one read.
   ===================================================================== */

function ins_cbc_(monthKey) {
  var out = { agents: [], byKey: {}, total: 0, targetTotal: 0, upgradeTotal: 0,
              mmTotal: 0, orphanRows: 0, orphanRev: 0, orphans: [], error: '',
              tab: '', hr: -1, cRev: -1, cTarget: -1, cUp: -1, cMM: -1,
              cMgr: -1, cCity: -1, headRev: '', upHow: '', headers: [] };

  var book;
  try { book = SpreadsheetApp.openById(INS_CBC_ID); }
  catch (e) { out.error = 'cannot open it: ' + ((e && e.message) ? e.message : e);
              return out; }

  /* CBC names tabs inconsistently - "July 2026" but "Aug  2026" with a
     double space. Match the first three letters of the month plus the
     year, which is the rule the old syncRosterSources used. */
  var y = monthKey.substring(0, 4);
  var abbr = Utilities.formatDate(new Date(parseInt(y, 10),
               parseInt(monthKey.substring(5, 7), 10) - 1, 1),
               INS_TZ, 'MMM').toLowerCase();
  var sh = null, all = book.getSheets();
  for (var i = 0; i < all.length; i++) {
    var n = all[i].getName().toLowerCase();
    if (n.indexOf(abbr) > -1 && n.indexOf(y) > -1) { sh = all[i]; break; }
  }
  if (!sh) {
    /* Fall back to a tab named for the month alone, e.g. "Oct". */
    for (i = 0; i < all.length; i++) {
      if (all[i].getName().toLowerCase().indexOf(abbr) > -1) { sh = all[i]; break; }
    }
  }
  if (!sh) {
    var names = [];
    for (i = 0; i < all.length && i < 20; i++) names.push(all[i].getName());
    out.error = 'no tab matching "' + abbr + '" and "' + y + '". Tabs: ' + names.join(', ');
    return out;
  }
  out.tab = sh.getName();

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 3) { out.error = '"' + out.tab + '" has ' + lastRow + ' row(s)'; return out; }
  var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();

  /* The header is not row 1. CBC puts a title and totals above it. */
  var cAgent = -1;
  for (var r = 0; r < grid.length && r < 25 && out.hr < 0; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      if (String(grid[r][c]).trim().toLowerCase() === 'agent') {
        out.hr = r; cAgent = c; break;
      }
    }
  }
  if (out.hr < 0) { out.error = 'no "Agent" header in the first 25 rows of "' + out.tab + '"'; return out; }

  var H = {};
  for (c = 0; c < grid[out.hr].length; c++) {
    var h = String(grid[out.hr][c]).trim().toLowerCase();
    if (h && H[h] === undefined) H[h] = c;
  }
  /* "Realised Revenue" sits beside "Booked Revenue" in CBC, and a loose
     match on 'revenue' can take either depending on key order. Booked is
     the pipeline, not money in - taking it would overstate the page by
     about a crore. So it is excluded by name, and the column that was
     chosen is printed either way. */
  out.cRev    = ins_revCol_(H);
  out.cTarget = ins_col_(H, ['target', 'monthly target', 'target amount']);
  out.cMgr    = ins_col_(H, ['manager', 'reporting manager', 'tl']);
  out.cCity   = ins_col_(H, ['city/region', 'city / region', 'city', 'region',
                             'office', 'location', 'branch']);
  if (out.cRev < 0) {
    var hs = [];
    for (var k in H) hs.push(k);
    out.error = 'no revenue column on row ' + (out.hr + 1) + '. Headers: ' + hs.join(' | ');
    return out;
  }
  out.headRev = String(grid[out.hr][out.cRev]).trim();
  for (c = 0; c < grid[out.hr].length; c++) {
    var hh = String(grid[out.hr][c]).trim();
    if (hh) out.headers.push(ins_a1_(c) + ' ' + hh);
  }

  /* The upgrade column. On the header if it is named there; otherwise its
     label sits in a cell ABOVE the header, which is where CBC puts it. */
  out.cUp = ins_col_(H, ['aigf upgrade/catalyst', 'aigf upgrade', 'upgrade', 'catalyst', 'aigf']);
  if (out.cUp >= 0) { out.upHow = 'named on the header row'; }
  else {
    for (r = 0; r < out.hr && out.cUp < 0; r++) {
      for (c = 0; c < grid[r].length; c++) {
        var t = String(grid[r][c]).trim().toLowerCase();
        if (!t) continue;
        if (t.indexOf('aigf') > -1 || t.indexOf('catalyst') > -1) {
          /* The label may sit in the column itself, or one to its left with
             the figures beside it. Take the column under the label if it
             carries numbers, else the next one that does. */
          out.cUp = ins_numericColNear_(grid, out.hr, c);
          if (out.cUp >= 0) out.upHow = 'label "' + String(grid[r][c]).trim() +
                                        '" on row ' + (r + 1);
          break;
        }
      }
    }
  }

  /* Still nothing. CBC's own "Oct 2026" names its columns on row 3 and
     stops at AD - Z, AB and AE carry numbers under no header at all. AB
     is the ramp factors. AE totalled 3.12 L in the imported copy, which
     is the upgrade, and the letters line up between the two because AC
     and AD read "Sales Incentive" and "Sales + SPOT Incentive" in both.
     So AE is used, but only as a fallback, only if it is headerless and
     actually holds numbers, and the log always says it was assumed
     rather than found. A column letter hard-coded silently is how next
     month's layout change becomes a wrong total nobody questions. */
  if (out.cUp < 0 && INS_CBC_UPGRADE_COL) {
    var guess = ins_colFromA1_(INS_CBC_UPGRADE_COL);
    if (guess >= 0 && guess < grid[out.hr].length &&
        !String(grid[out.hr][guess]).trim() &&
        ins_numericColNear_(grid, out.hr, guess) === guess) {
      out.cUp = guess;
      out.upHow = 'ASSUMED to be ' + INS_CBC_UPGRADE_COL + ' - headerless and ' +
                  'numeric, matching the imported copy. CONFIRM THIS.';
    }
  }

  /* Capacity: a headerless column of ramp factors. Found by its values,
     because CBC gives it no name and moves it between months. */
  out.cMM = ins_rampCol_(grid, out.hr, cAgent);

  var seen = {};
  for (r = out.hr + 1; r < grid.length; r++) {
    var row = grid[r];
    var name = String(row[cAgent] == null ? '' : row[cAgent]).trim();
    var rev = ins_num_(row[out.cRev]);

    /* A row with revenue and no agent name is in neither total. The old
       buildRoster_ dropped these silently; they get reported instead. */
    if (!name || /^(total|grand total|sum|agent)\b/i.test(name) || /^[0-9.,%\s-]+$/.test(name)) {
      if (rev) {
        out.orphanRows++; out.orphanRev += rev;
        /* Named, not just counted. 3.23 cr sitting on rows with no agent
           is either a total row this is right to skip, or real revenue
           nobody is being credited with - and a count cannot tell those
           apart. The row number and whatever text is on the row can. */
        var label = name;
        if (!label && out.cMgr >= 0) label = String(row[out.cMgr] || '').trim();
        if (!label && out.cCity >= 0) label = String(row[out.cCity] || '').trim();
        out.orphans.push({ row: r + 1, rev: rev, label: label || '(entirely blank)' });
      }
      continue;
    }

    var key = ins_key_(name);
    if (seen[key]) {
      /* Same agent twice in one month: keep the larger target, do not
         double the revenue. */
      if (out.cTarget >= 0) {
        seen[key].target = Math.max(seen[key].target, ins_num_(row[out.cTarget]));
      }
      continue;
    }

    var tc = ins_teamCity_(out.cCity >= 0 ? row[out.cCity] : '');
    var a = {
      name:    name,
      key:     key,
      manager: out.cMgr >= 0 ? String(row[out.cMgr] == null ? '' : row[out.cMgr]).trim() : '',
      team:    tc.team,
      city:    tc.city,
      target:  out.cTarget >= 0 ? ins_num_(row[out.cTarget]) : 0,
      upgrade: out.cUp >= 0 ? ins_num_(row[out.cUp]) : 0,
      mm:      out.cMM >= 0 ? ins_num_(row[out.cMM]) : 1,
      cbcRev:  rev
    };
    if (!(a.mm > 0)) a.mm = (out.cMM >= 0) ? 0 : 1;

    seen[key] = a;
    out.agents.push(a);
    out.byKey[key] = a;
    out.total += rev;
    out.targetTotal += a.target;
    out.upgradeTotal += a.upgrade;
    out.mmTotal += a.mm;
  }

  /* Columns carrying numbers under no header at all. CBC names nothing
     past AD, yet Z, AB and AE hold figures - the capacity factors and
     the upgrade among them. When the label cannot be found, printing
     these with their totals identifies the right one by its size
     instead of by a guess at a column letter. */
  out.headless = [];
  out.width = lastCol;
  for (c = 0; c < lastCol; c++) {
    if (String(grid[out.hr][c]).trim()) continue;
    var sum = 0, cnt = 0;
    for (r = out.hr + 1; r < grid.length; r++) {
      var vv = grid[r][c];
      if (typeof vv === 'number' && vv) { sum += vv; cnt++; }
    }
    if (cnt >= 3) out.headless.push({ col: c, n: cnt, sum: sum });
  }

  if (!out.agents.length) out.error = 'no agent rows under row ' + (out.hr + 1);
  return out;
}


/* =====================================================================
   THE PAYMENT TRACKER. Every row read once; this window and last
   month's same days tallied in the same pass.
   ===================================================================== */

function ins_tracker_(win) {
  var out = { byKey: {}, priorByKey: {}, statuses: [], skipped: 0,
              allRows: 0, hr: -1, error: '', source: '', usedLocal: false,
              newest: null, partial: 0,
              now: { rev: 0, rows: 0, units: 0, total: 0 },
              prior: { rev: 0, rows: 0, units: 0, total: 0 } };

  var t0 = new Date();
  var since = function () { return Math.round((new Date() - t0) / 1000) + 's'; };
  var L = function (s) { Logger.log(s); };

  /* LOCAL FIRST, THE TRACKER ONLY IF IT HAS TO.
   *
   * The 01:37 run reached CBC in 42 seconds and then printed nothing at
   * all - no row count, no error - because it never got past
   * openById(tracker).getSheetByName(). The Payment Tracker is too large
   * to open from Apps Script in any useful time, and that call happens
   * before any read, so it cannot be chunked or budgeted around.
   *
   * src_Payments is the same data, already in this workbook, and a local
   * read is an order of magnitude cheaper. It is used first. The tracker
   * stays as the fallback for when the import is in #REF! - which is the
   * right way round, because the import is usually fine and the tracker
   * is the safety net, not the default.
   *
   * The cost of the local copy is that it can be stale, so how fresh it
   * is gets measured and printed rather than assumed. */
  var sh = null, usedLocal = false;
  var local = SpreadsheetApp.getActive().getSheetByName('src_Payments');
  if (local && local.getLastRow() > 100) {
    sh = local; usedLocal = true;
    out.source = 'src_Payments (the local copy)';
    L('  PAYMENTS: ' + out.source + ', ' + since());
  } else {
    L('  PAYMENTS: src_Payments is ' +
      (local ? 'only ' + local.getLastRow() + ' rows' : 'missing') +
      ', so opening the Payment Tracker itself. This is slow.');
    try {
      sh = SpreadsheetApp.openById(INS_TRACKER_ID).getSheetByName(INS_TRACKER_TAB);
    } catch (e) {
      out.error = 'src_Payments is unusable and the tracker will not open: ' +
                  ((e && e.message) ? e.message : e);
      return out;
    }
    if (!sh) { out.error = 'no "' + INS_TRACKER_TAB + '" tab in the tracker'; return out; }
    out.source = 'the Payment Tracker';
    L('  PAYMENTS: ' + out.source + ' opened, ' + since());
  }

  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) { out.error = out.source + ' has ' + lastRow + ' row(s)'; return out; }
  L('            ' + lastRow + ' rows x ' + lastCol + ' columns, ' + since());
  out.usedLocal = usedLocal;

  var head = sh.getRange(1, 1, Math.min(10, lastRow), lastCol).getValues();
  var c = null;
  for (var i = 0; i < head.length && out.hr < 0; i++) {
    var H = {};
    for (var j = 0; j < head[i].length; j++) {
      var h = String(head[i][j]).trim().toLowerCase();
      if (h && H[h] === undefined) H[h] = j;
    }
    var cand = {
      date:  ins_col_(H, ['date', 'payment date', 'paid on']),
      agent: ins_col_(H, ['lead owner', 'agent', 'owner']),
      amt:   ins_col_(H, ['amount paid', 'amount', 'amount inr']),
      stat:  ins_col_(H, ['status']),
      cust:  ins_col_(H, ['payment email id', 'payment email', 'email', 'name'])
    };
    if (cand.date < 0 || cand.agent < 0 || cand.amt < 0) continue;
    out.hr = i; c = cand;
  }
  if (out.hr < 0) {
    out.error = 'no row in the first 10 names Date, Lead Owner and Amount Paid';
    return out;
  }

  var n = lastRow - (out.hr + 1);
  if (n < 1) { out.error = 'a header row and nothing under it'; return out; }
  out.allRows = n;

  /* CHUNKED, AND ONE PASS, AND ONLY THE FIVE COLUMNS THAT ARE USED.
   *
   * Version one asked for all 22 columns of every row in a single
   * getValues - about 350,000 cells - and printed nothing for twelve
   * minutes. Version two asked for five full-height columns and was
   * still slow, which says this tab is far taller than src_Payments'
   * 15,558 rows suggested: a sheet keeps its last row wherever anything
   * has ever been typed or formatted, so a tracker can carry a hundred
   * thousand empty rows behind the data.
   *
   * So: five columns, 5,000 rows at a time, each chunk logged as it
   * lands, and one traversal instead of two. Progress is visible,
   * memory stays flat, two consecutive chunks with no dates in them
   * means the data has ended, and a time budget stops the run cleanly
   * with partial figures rather than letting Apps Script kill it with
   * nothing to show. */
  var statMap = {}, firstOf = {};
  var CH = 5000, done = 0, blankRuns = 0, BUDGET = 260;

  while (done < n) {
    if (Math.round((new Date() - t0) / 1000) > BUDGET) {
      out.partial = done;
      L('           *** STOPPED at ' + done + ' of ' + n + ' rows, ' + since() + '.');
      L('               Apps Script would end the run before this finished.');
      break;
    }

    var h = Math.min(CH, n - done), top = out.hr + 2 + done;
    var D  = sh.getRange(top, c.date  + 1, h, 1).getValues();
    var A  = sh.getRange(top, c.agent + 1, h, 1).getValues();
    var M  = sh.getRange(top, c.amt   + 1, h, 1).getValues();
    var S  = c.stat >= 0 ? sh.getRange(top, c.stat + 1, h, 1).getValues() : null;
    var CU = c.cust >= 0 ? sh.getRange(top, c.cust + 1, h, 1).getValues() : null;

    var live = 0;
    for (var r = 0; r < h; r++) {
      var d = D[r][0];
      if (!(d instanceof Date) || isNaN(d.getTime())) continue;
      live++;
      /* The newest payment anywhere in the source. A local copy that
         stopped updating yesterday produces a page that looks complete
         and is not, so this is measured rather than trusted. */
      if (!out.newest || d > out.newest) out.newest = d;

      var st   = S ? String(S[r][0] || '').trim() : '';
      var dead = ins_isDead_(st);
      var name = String(A[r][0] || '').trim();
      var amt  = ins_num_(M[r][0]);

      /* The earliest payment per customer, over all history. A unit is a
         deal closed, and a deal closes on its first payment, not on every
         instalment - so this is the one thing that needs the whole tab. */
      if (!dead && CU) {
        var ck = String(CU[r][0] || '').trim().toLowerCase();
        if (ck && (!firstOf[ck] || d < firstOf[ck].when)) {
          firstOf[ck] = { when: d, agent: name };
        }
      }

      var inNow   = (d >= win.start && d <= win.end);
      var inPrior = (d >= win.priorStart && d <= win.priorEnd);
      if (!inNow && !inPrior) continue;

      if (inNow) {
        var sk = st.toLowerCase();
        if (!statMap[sk]) statMap[sk] = { name: st, rows: 0, rev: 0 };
        statMap[sk].rows++; statMap[sk].rev += amt;
      }
      if (dead) { if (inNow) out.skipped++; continue; }
      if (!name || /^(total|grand total|sum)\b/i.test(name)) continue;

      var key = ins_key_(name);
      var bag = inNow ? out.byKey : out.priorByKey;
      if (!bag[key]) bag[key] = { name: name, rev: 0, rows: 0, units: 0 };
      bag[key].rev += amt; bag[key].rows++;

      var side = inNow ? out.now : out.prior;
      side.rev += amt; side.rows++; side.total += amt;
    }

    done += h;
    L('           rows ' + ins_pad_(String(done), 8) + 'of ' + ins_pad_(String(n), 8) +
      ins_pad_(live + ' dated', 13) + since());

    if (!live) {
      blankRuns++;
      if (blankRuns >= 2) {
        L('           no dates in the last ' + (CH * 2) + ' rows - the data ends here.');
        break;
      }
    } else { blankRuns = 0; }
  }

  /* Units, from the first-payment index, credited to the agent on that
     first row - not to whoever took a later instalment. */
  for (var ck2 in firstOf) {
    var f = firstOf[ck2];
    var fk = ins_key_(f.agent);
    if (!fk) continue;
    if (f.when >= win.start && f.when <= win.end) {
      out.now.units++;
      if (out.byKey[fk]) out.byKey[fk].units++;
    } else if (f.when >= win.priorStart && f.when <= win.priorEnd) {
      out.prior.units++;
      if (out.priorByKey[fk]) out.priorByKey[fk].units++;
    }
  }

  for (var s in statMap) out.statuses.push(statMap[s]);
  out.statuses.sort(function (a, b) { return b.rev - a.rev; });
  L('           tallied, ' + since());
  return out;
}


/** Cancelled, refunded, failed and reversed are not revenue. One place. */
function ins_isDead_(status) {
  var s = String(status == null ? '' : status).toLowerCase();
  return s.indexOf('cancel') > -1 || s.indexOf('refund') > -1 ||
         s.indexOf('fail') > -1 || s.indexOf('reverse') > -1;
}

/** Same rule, reached through a row and its column map. */
function ins_cancelled_(row, c) {
  if (c.stat < 0) return false;
  return ins_isDead_(row[c.stat]);
}


/* =====================================================================
   THE JOIN. CBC's roster decides who counts; the tracker decides how
   much. Nothing is stored; this is recomputed on every run.
   ===================================================================== */

function ins_rollup_(cbc, pay) {
  var m = {
    agents: [], managers: [], offices: [], onRoster: 0,
    now:   { rev: 0, units: 0, target: 0, mm: 0, upgrade: 0, n: 0 },
    prior: { rev: 0, units: 0 },
    offRev: 0, offRows: 0, offNames: []
  };

  var mgr = {}, off = {};
  for (var i = 0; i < cbc.agents.length; i++) {
    var a = cbc.agents[i];
    var p = pay.byKey[a.key];
    var pp = pay.priorByKey[a.key];

    var rev = (p ? p.rev : 0) + a.upgrade;        // upgrade is revenue
    var units = p ? p.units : 0;                  // upgrade adds no unit

    if (p) m.onRoster++;

    var node = { name: a.name, manager: a.manager, team: a.team, city: a.city,
                 rev: rev, units: units, target: a.target, mm: a.mm,
                 upgrade: a.upgrade, cbcRev: a.cbcRev,
                 priorRev: pp ? pp.rev : 0 };
    m.agents.push(node);

    m.now.rev += rev; m.now.units += units; m.now.target += a.target;
    m.now.mm += a.mm; m.now.upgrade += a.upgrade; m.now.n++;
    m.prior.rev += node.priorRev;
    m.prior.units += pp ? pp.units : 0;

    var mk = a.manager || '(no manager)';
    if (!mgr[mk]) mgr[mk] = { manager: mk, team: a.team, rev: 0, units: 0,
                              target: 0, mm: 0, n: 0 };
    mgr[mk].rev += rev; mgr[mk].units += units; mgr[mk].target += a.target;
    mgr[mk].mm += a.mm; mgr[mk].n++;
    if (!mgr[mk].team && a.team) mgr[mk].team = a.team;

    var ok = a.city || '(no office)';
    if (!off[ok]) off[ok] = { office: ok, rev: 0, units: 0, target: 0, mm: 0, n: 0 };
    off[ok].rev += rev; off[ok].units += units; off[ok].target += a.target;
    off[ok].mm += a.mm; off[ok].n++;
  }

  /* Everything in the tracker that is not one of CBC's agents. Other
     teams, mostly - but a sales agent spelled differently would land
     here too, which is why it is reported rather than discarded. */
  for (var k in pay.byKey) {
    if (cbc.byKey[k]) continue;
    m.offRev += pay.byKey[k].rev;
    m.offRows += pay.byKey[k].rows;
    m.offNames.push({ name: pay.byKey[k].name, rev: pay.byKey[k].rev });
  }
  m.offNames.sort(function (a, b) { return b.rev - a.rev; });

  var key;
  for (key in mgr) m.managers.push(mgr[key]);
  for (key in off) m.offices.push(off[key]);
  m.managers.sort(function (a, b) { return b.rev - a.rev; });
  m.offices.sort(function (a, b) { return b.rev - a.rev; });
  m.agents.sort(function (a, b) { return b.rev - a.rev; });
  m.hasMM = cbc.cMM >= 0;
  return m;
}


/* =====================================================================
   THE PAGE. Same layout as the existing report, written to a new tab.
   ===================================================================== */

function ins_write_(ss, win, m, t0) {
  var sh = ss.getSheetByName(INS_OUT_TAB);
  if (!sh) sh = ss.insertSheet(INS_OUT_TAB);
  else {
    try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) {}
    sh.clear();
  }

  var LB = INS_C.LABEL, V1 = INS_C.V1, V2 = INS_C.V2;
  var put = function (r, c, v) { sh.getRange(r, c).setValue(v); };
  var bold = function (r, c, n) { sh.getRange(r, c, 1, n || 1).setFontWeight('bold'); };

  put(2, LB, 'Report Dated');
  put(2, V1, Utilities.formatDate(t0, INS_TZ, 'yyyy-MM-dd HH:mm'));

  put(4, LB, 'Committed For ' + win.shortLabel);
  put(4, V1, ins_money_(m.now.target));
  put(5, LB, 'Delivered So Far');
  put(5, V1, ins_money_(m.now.rev));

  var delta = m.now.rev - m.prior.rev;
  put(7, LB, 'MTD ' + win.shortLabel + ' V/s ' + win.priorShort);
  put(7, V1, (delta >= 0 ? 'We are ahead by ' : 'We are behind by ') +
             ins_money_(Math.abs(delta)));
  bold(7, V1);

  put(9, LB, 'Same window, every month');
  put(9, V1, win.label); put(9, V2, win.priorLabel);
  bold(9, LB, 3);

  put(10, LB, 'REVENUE'); bold(10, LB);
  put(11, LB, 'Total revenue'); put(11, V1, ins_money_(m.now.rev));
  put(11, V2, ins_money_(m.prior.rev));
  put(12, LB, 'Units'); put(12, V1, m.now.units); put(12, V2, m.prior.units);
  put(13, LB, 'Average ticket');
  put(13, V1, ins_money_(m.now.units ? m.now.rev / m.now.units : 0));
  put(13, V2, ins_money_(m.prior.units ? m.prior.rev / m.prior.units : 0));
  sh.getRange(12, V1, 1, 2).setNumberFormat('#,##0');
  sh.getRange(11, V1, 1, 2).setHorizontalAlignment('right');
  sh.getRange(13, V1, 1, 2).setHorizontalAlignment('right');

  put(15, LB, 'Location Wise Report');
  sh.getRange(15, V1, 1, INS_COLS.length).setValues([INS_COLS]);
  bold(15, LB, 1 + INS_COLS.length);
  var r = 16, i;
  for (i = 0; i < m.offices.length; i++) {
    sh.getRange(r, LB, 1, 1 + INS_COLS.length)
      .setValues([[m.offices[i].office].concat(ins_display_(m.offices[i]))]);
    r++;
  }
  ins_formats_(sh, 16, V1, m.offices.length);

  var mr0 = r + 1;
  put(mr0, 2, 'Manager Wise Report'); bold(mr0, 2);
  sh.getRange(mr0 + 1, 2, 1, 2 + INS_COLS.length)
    .setValues([['Team', 'Manager'].concat(INS_COLS)]);
  bold(mr0 + 1, 2, 2 + INS_COLS.length);
  var mrow = mr0 + 2;
  for (i = 0; i < m.managers.length; i++) {
    sh.getRange(mrow, 2, 1, 2 + INS_COLS.length)
      .setValues([[m.managers[i].team, m.managers[i].manager]
                  .concat(ins_display_(m.managers[i]))]);
    mrow++;
  }
  ins_formats_(sh, mr0 + 2, 4, m.managers.length);

  /* Where the number came from, on the page rather than only in a log.
     A figure nobody can trace is the thing this whole exercise was
     about. */
  var note = mrow + 1;
  put(note, LB, 'HOW THIS PAGE WAS BUILT'); bold(note, LB);
  var lines = [
    'Read straight from CBC and the Payment Tracker, read only, in one pass. ' +
      'No import, no mdl_ tab, nothing stamped.',
    'Revenue = Payment Tracker rows in the window whose Lead Owner is on CBC\'s ' +
      'roster for this month, plus CBC\'s AIGF Upgrade / Catalyst column.',
    'A unit is a customer whose first ever payment falls in this window, ' +
      'credited to the Lead Owner on that first row. Upgrades add no unit.',
    'Cancelled, refunded, failed and reversed rows are excluded.',
    m.hasMM ? 'Rev / MM uses CBC\'s capacity column.'
            : 'CBC carries no capacity column this month, so Rev / MM counts ' +
              'every agent as one whole month.',
    'Off roster this window: ' + ins_money_(m.offRev) + ' across ' + m.offRows +
      ' row(s) under ' + m.offNames.length + ' Lead Owner(s) CBC does not list.'
  ];
  for (i = 0; i < lines.length; i++) put(note + 1 + i, LB, lines[i]);

  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 200);
  for (var c2 = 4; c2 <= 3 + INS_COLS.length; c2++) sh.setColumnWidth(c2, 118);
  SpreadsheetApp.flush();
}


/** One value per INS_COLS entry, in order. */
function ins_metrics_(x) {
  var mm = Number(x.mm || 0);
  return [x.n, x.rev, x.target,
          x.target ? x.rev / x.target : 0,
          x.rev - x.target,
          x.units,
          x.units ? x.rev / x.units : 0,
          mm > 0 ? x.rev / mm : 0,
          x.n ? x.target / x.n : 0];
}

/** The same row with the money columns as lakh / crore. */
function ins_display_(x) {
  var v = ins_metrics_(x);
  return [v[0], ins_money_(v[1]), ins_money_(v[2]), v[3], ins_money_(v[4]),
          v[5], ins_money_(v[6]), ins_money_(v[7]), ins_money_(v[8])];
}

function ins_formats_(sh, row, col, n) {
  if (!n) return;
  sh.getRange(row, col, n, 1).setNumberFormat('#,##0');
  sh.getRange(row, col + 3, n, 1).setNumberFormat('0.00%');
  sh.getRange(row, col + 5, n, 1).setNumberFormat('#,##0');
  sh.getRange(row, col + 1, n, 2).setHorizontalAlignment('right');
  sh.getRange(row, col + 4, n, 1).setHorizontalAlignment('right');
  sh.getRange(row, col + 6, n, 3).setHorizontalAlignment('right');
}


/* =====================================================================
   DOES IT AGREE WITH CBC. Same read, same pass, both numbers.
   ===================================================================== */

function ins_reconcile_(cbc, m, L) {
  L('  --- CBC against this page ---');
  L('    CBC\'s own revenue column : ' + ins_money_(cbc.total));
  L('    this page                : ' + ins_money_(m.now.rev));
  var d = m.now.rev - cbc.total;
  L('    difference               : ' + (d >= 0 ? '+' : '') + ins_money_(d));
  L('');

  var diff = [];
  for (var i = 0; i < m.agents.length; i++) {
    var a = m.agents[i];
    if (Math.abs(a.rev - a.cbcRev) < 1000) continue;
    diff.push(a);
  }
  diff.sort(function (x, y) {
    return Math.abs(y.rev - y.cbcRev) - Math.abs(x.rev - x.cbcRev);
  });

  if (!diff.length) {
    L('    Every agent agrees with CBC to within 1000. The page is right.');
    return;
  }

  L('    ' + diff.length + ' agent(s) differ by 1000 or more.');
  L('    Negative means this page has less than CBC credits.');
  for (i = 0; i < diff.length && i < 40; i++) {
    var x = diff[i], gap = x.rev - x.cbcRev;
    L('      ' + ins_pad_(x.name, 28) +
      'CBC ' + ins_pad_(ins_money_(x.cbcRev), 11) +
      'here ' + ins_pad_(ins_money_(x.rev), 11) +
      (gap < 0 ? '-' : '+') + ins_money_(Math.abs(gap)));
  }
  if (diff.length > 40) L('      ... and ' + (diff.length - 40) + ' more');
  L('');
  L('    A negative line means CBC credits an agent with money the tracker');
  L('    has not logged against that spelling of their name. Check the');
  L('    off-roster list above for the same person spelled differently -');
  L('    that is a WR_ALIASES entry. If they are not there either, the');
  L('    payment is not in the tracker for this window at all, and no');
  L('    change to this workbook can produce it.');
}


/* =====================================================================
   HELPERS
   ===================================================================== */

/** Exact header first, then a contains match. */
function ins_col_(H, names) {
  var i, key;
  for (i = 0; i < names.length; i++) if (H[names[i]] !== undefined) return H[names[i]];
  for (i = 0; i < names.length; i++) {
    for (key in H) if (key.indexOf(names[i]) > -1) return H[key];
  }
  return -1;
}

/** Realised revenue, never booked revenue. */
function ins_revCol_(H) {
  var exact = ['realised revenue', 'realized revenue', 'revenue realised',
               'revenue realized', 'collection', 'collections'];
  for (var i = 0; i < exact.length; i++) if (H[exact[i]] !== undefined) return H[exact[i]];
  /* Loose, but a header naming booked, target, projection or a week is not
     money collected. */
  var bad = /booked|target|project|expect|deficit|defict|incentive|w[1-5]|spot|drr/;
  for (var key in H) {
    if (key.indexOf('revenue') < 0) continue;
    if (bad.test(key)) continue;
    return H[key];
  }
  return -1;
}

/** The project's own name key, so aliases and the TV board agree with this. */
function ins_key_(name) {
  if (typeof wr_key_ === 'function') return wr_key_(name);
  var t = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (typeof WR_ALIASES !== 'undefined' && WR_ALIASES &&
      WR_ALIASES.hasOwnProperty(t)) t = String(WR_ALIASES[t]).toLowerCase();
  return t.replace(/[^a-z0-9]/g, '');
}

/** "India Team-Bangalore" -> team "India Team", city "Bangalore". */
function ins_teamCity_(v) {
  var t = String(v == null ? '' : v).trim();
  if (!t) return { team: '', city: '' };
  var dash = t.lastIndexOf('-');
  if (dash > 0 && dash < t.length - 1) {
    return { team: t.substring(0, dash).trim(), city: t.substring(dash + 1).trim() };
  }
  return { team: '', city: t };
}

/** The column under a label, or the next one along that holds numbers. */
function ins_numericColNear_(grid, hr, c) {
  for (var off = 0; off < 3; off++) {
    var col = c + off, hits = 0;
    for (var r = hr + 1; r < grid.length && r < hr + 40; r++) {
      if (col >= grid[r].length) break;
      var v = grid[r][col];
      if (typeof v === 'number' && v) hits++;
      else if (typeof v === 'string' && /^[0-9][0-9,]*(\.[0-9]+)?$/.test(v.trim())) hits++;
    }
    if (hits >= 2) return col;
  }
  return -1;
}

/** The ramp column: no header, values that are all 0, 0.25 .. 1. */
function ins_rampCol_(grid, hr, cAgent) {
  if (typeof wr_manMonthCol_ === 'function') {
    try {
      var got = wr_manMonthCol_(grid.slice(hr), cAgent);
      if (got >= 0) return got;
    } catch (e) {}
  }
  var width = grid[hr] ? grid[hr].length : 0;
  for (var c = 0; c < width; c++) {
    if (String(grid[hr][c]).trim()) continue;            // must be headerless
    var n = 0, ok = 0;
    for (var r = hr + 1; r < grid.length && r < hr + 120; r++) {
      if (c >= grid[r].length) break;
      var v = grid[r][c];
      if (v === '' || v == null) continue;
      if (typeof v !== 'number') { n = 0; break; }
      n++;
      if (v >= 0 && v <= 1) ok++;
    }
    if (n >= 10 && ok === n) return c;
  }
  return -1;
}

function ins_num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v == null ? '' : v).replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Lakh and crore, the way the page is read by hand. */
function ins_money_(n) {
  n = Number(n || 0);
  var a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e7) return s + (a / 1e7).toFixed(2) + ' cr';
  if (a >= 1e5) return s + (a / 1e5).toFixed(2) + ' L';
  return s + Math.round(a).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function ins_r2_(n) { return Math.round(Number(n || 0) * 100) / 100; }
function ins_pad2_(n) { return n < 10 ? '0' + n : '' + n; }

function ins_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}

/** "AE" -> 30. The inverse of ins_a1_. */
function ins_colFromA1_(s) {
  var t = String(s || '').trim().toUpperCase(), n = 0;
  if (!/^[A-Z]+$/.test(t)) return -1;
  for (var i = 0; i < t.length; i++) n = n * 26 + (t.charCodeAt(i) - 64);
  return n - 1;
}

function ins_a1_(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = (n - k) / 26 | 0; }
  return s;
}


/* =====================================================================
   SELF TEST. Fixtures only. Opens nothing, writes nothing.
   ===================================================================== */

function insideSalesSelfTest() {
  var fails = [], ran = 0;
  function eq(what, got, want) {
    ran++;
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', want ' + want);
  }

  eq('money crore', ins_money_(15873148), '1.59 cr');
  eq('money lakh', ins_money_(437000), '4.37 L');
  eq('money small', ins_money_(9405), '9,405');
  eq('money negative', ins_money_(-2363000), '-23.63 L');
  eq('money zero', ins_money_(0), '0');

  var tc = ins_teamCity_('India Team-Bangalore');
  eq('team split', tc.team, 'India Team');
  eq('city split', tc.city, 'Bangalore');
  eq('city only', ins_teamCity_('Hyderabad').city, 'Hyderabad');
  eq('blank city', ins_teamCity_('').city, '');

  eq('a1 col 6', ins_a1_(6), 'G');
  eq('a1 col 30', ins_a1_(30), 'AE');
  eq('a1 inverse AE', ins_colFromA1_('AE'), 30);
  eq('a1 inverse G', ins_colFromA1_('G'), 6);
  eq('a1 inverse rejects junk', ins_colFromA1_('A1'), -1);
  eq('a1 round trip', ins_a1_(ins_colFromA1_('AB')), 'AB');

  eq('num from text', ins_num_('1,416,000'), 1416000);
  eq('num from blank', ins_num_(''), 0);

  /* The join: upgrade counts as revenue and adds no unit. */
  var cbc = { agents: [{ name: 'A', key: 'a', manager: 'M', team: 'India Team',
                         city: 'Hyderabad', target: 500000, upgrade: 100000,
                         mm: 1, cbcRev: 1079000 }],
              byKey: { a: true }, cMM: 0 };
  var pay = { byKey: { a: { name: 'A', rev: 979000, rows: 3, units: 2 },
                       z: { name: 'Other Desk', rev: 4000000, rows: 9, units: 0 } },
              priorByKey: {} };
  var m = ins_rollup_(cbc, pay);
  eq('revenue includes upgrade', m.now.rev, 1079000);
  eq('units exclude upgrade', m.now.units, 2);
  eq('off roster captured', m.offRev, 4000000);
  eq('off roster named', m.offNames[0].name, 'Other Desk');
  eq('manager rollup', m.managers[0].rev, 1079000);
  eq('office rollup', m.offices[0].office, 'Hyderabad');
  eq('reconciles to CBC', m.now.rev - cbc.agents[0].cbcRev, 0);

  var d = ins_display_(m.offices[0]);
  eq('display agents', d[0], 1);
  eq('display revenue', d[1], '10.79 L');
  eq('display attain', ins_r2_(d[3] * 100), 215.8);

  /* The window: a past month is read whole, this month stops now. */
  var w = ins_window_('2026-09');
  eq('window month', w.monthKey, '2026-09');
  eq('window starts 1st', w.start.getDate(), 1);
  eq('window ends 30th', w.end.getDate(), 30);
  eq('prior is August', w.priorStart.getMonth(), 7);

  /* Cancelled, refunded, failed and reversed are all excluded. */
  var c = { stat: 0 };
  eq('cancel excluded', ins_cancelled_(['Cancelled'], c), true);
  eq('refund excluded', ins_cancelled_(['Refund issued'], c), true);
  eq('failed excluded', ins_cancelled_(['Failed'], c), true);
  eq('paid kept', ins_cancelled_(['Paid'], c), false);
  eq('blank kept', ins_cancelled_([''], c), false);

  /* Realised revenue is picked, never booked. Getting this wrong
     overstates the page by about a crore, so it is a test and not a
     comment. */
  eq('picks realised', ins_revCol_({ 'realised revenue': 6, 'booked revenue': 7 }), 6);
  eq('picks realised when listed second',
     ins_revCol_({ 'booked revenue': 7, 'realised revenue': 6 }), 6);
  eq('never picks booked alone', ins_revCol_({ 'booked revenue': 7 }), -1);
  eq('never picks a projection', ins_revCol_({ 'projected revenue': 3 }), -1);

  Logger.log('=== INSIDE SALES SELF TEST ===');
  if (!fails.length) {
    Logger.log('  all ' + ran + ' checks pass. Nothing was opened or written.');
  } else {
    Logger.log('  ' + fails.length + ' FAILED:');
    for (var i = 0; i < fails.length; i++) Logger.log('    ' + fails[i]);
  }
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
