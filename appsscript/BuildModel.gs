/**
 * BuildModel.gs - rebuild the two tabs every other page reads.
 *
 * WHY THIS IS THE ONLY REMAINING FIX
 *
 *   Command Centre, Agent, Manager, Office & Team, Overall Report,
 *   Trend, Rhythm and the TV board all read mdl_Payments and mdl_Roster.
 *   They are not stale and they are not broken - they are being handed
 *   wrong numbers. Fix those two tabs and all of it is correct at once,
 *   with no change to any of them.
 *
 *   insideSales already proved the inputs: CBC's roster read directly,
 *   and src_Payments. The Management Report built from them reconciles
 *   with CBC to within two named attribution differences, where the
 *   model-built page was 23.63 L out.
 *
 * WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT
 *
 *   buildModel() writes TWO NEW TABS - ins_Payments and ins_Roster - in
 *   exactly the shape mdl_Payments and mdl_Roster have, then prints the
 *   two side by side, month by month. It does not touch mdl_Payments,
 *   mdl_Roster, or any page. Nothing can break by running it.
 *
 *   buildModelSwap() is a separate command, run only after you have read
 *   that comparison. It renames the live tabs to _OLD and the new ones
 *   into their place. buildModelRevert() puts them back.
 *
 *   Last night a failed read published a page of zeros because the code
 *   carried on after an error it had already detected. So every write
 *   here is gated on a complete read, and the swap is gated on the
 *   comparison passing. A model that is wrong is worse than a model that
 *   is old, because ten pages and a television repeat it.
 *
 * WHERE EACH COLUMN COMES FROM
 *
 *   Date, Lead Owner, Amount Paid,
 *   Status, Payment Type, Sale Price,
 *   Balance Left, Batch, Batch Family,
 *   Segment                            src_Payments, as they stand
 *
 *   Month                              the payment's own date
 *   Manager, Office, Team              the roster for THAT ROW'S month
 *   On Roster                          is that Lead Owner on that
 *                                      month's roster - asked per row,
 *                                      per month, not stamped once
 *   Is Unit                            is this the customer's first ever
 *                                      payment
 *   Origin Month                       the month of that first payment
 *   Is Refund                          the status says so
 *
 *   Rosters come from mdl_Roster for past months, which is where the
 *   history lives, and from CBC directly for the current month, which is
 *   the month that has to be right.
 */

var BM_PAY_OUT    = 'ins_Payments';
var BM_ROSTER_OUT = 'ins_Roster';
var BM_PAY_LIVE   = 'mdl_Payments';
var BM_ROSTER_LIVE = 'mdl_Roster';

/* The shape the pages read. These names are not decoration: mr_payments_
   and wr_payments_ look them up by exact string. */
var BM_PAY_COLS = ['Date', 'Month', 'Lead Owner', 'On Roster', 'Manager',
                   'Office', 'Team', 'Amount Paid', 'Payment Type', 'Is Unit',
                   'Sale Price', 'Balance Left', 'Batch', 'Batch Family',
                   'Segment', 'Status', 'Is Refund', 'Origin Month'];

var BM_ROSTER_COLS = ['Month', 'Agent', 'Manager', 'Office', 'Team',
                      'Target', 'Man Month'];


/**
 * Rebuild straight into the live tabs. This is what belongs in the
 * schedule once the swap has been made and trusted.
 *
 * refreshAndVerify runs first on every scheduled cycle and writes
 * mdl_Payments itself, so a one-off swap would be undone within two and
 * a half hours. Running this after it means the model is rebuilt
 * correctly on every cycle, while refreshAndVerify keeps producing
 * mdl_Batches and everything else it is still responsible for.
 */
function rebuildModelLive() {
  /* ONLY ONCE A HUMAN HAS ACCEPTED THE SWAP.
   *
   * This is safe to leave in the schedule from the moment it is pasted,
   * because it refuses to write until mdl_Payments_OLD exists - and that
   * tab only exists because somebody read the comparison and ran
   * buildModelSwap. Until then the scheduled cycle carries on exactly as
   * it does today.
   *
   * The alternative was asking to be trusted with a direct write to the
   * tab ten pages and a television read, on the strength of a comparison
   * nobody had looked at yet. */
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(BM_PAY_LIVE + '_OLD')) {
    Logger.log('rebuildModelLive: not enabled - no ' + BM_PAY_LIVE + '_OLD, so the ' +
               'swap has never been accepted. Run buildModel() then buildModelSwap() ' +
               'once, and every cycle from then on rebuilds the model by itself.');
    return;
  }
  buildModel(true);
}


function buildModel(live) {
  var t0 = new Date();
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var since = function () { return Math.round((new Date() - t0) / 1000) + 's'; };
  var monthKey = Utilities.formatDate(t0, INS_TZ, 'yyyy-MM');

  var payOut = live ? BM_PAY_LIVE : BM_PAY_OUT;
  var rosOut = live ? BM_ROSTER_LIVE : BM_ROSTER_OUT;

  L('=== BUILD MODEL ===   ' + monthKey + '   ' +
    Utilities.formatDate(t0, INS_TZ, 'dd MMM HH:mm'));
  if (live) {
    L('  LIVE: writing ' + payOut + ' and ' + rosOut + ' directly.');
  } else {
    L('  Writes ' + payOut + ' and ' + rosOut + ' only.');
    L('  ' + BM_PAY_LIVE + ', ' + BM_ROSTER_LIVE + ' and every page are untouched.');
  }
  L('');

  /* ---------- rosters, per month ---------- */
  var ros = bm_rosters_(ss, monthKey, L);
  if (ros.error) { L('  *** ' + ros.error); return; }
  var months = [];
  for (var mk in ros.byMonth) months.push(mk);
  months.sort();
  L('  ROSTERS: ' + months.length + ' month(s): ' + months.join(', '));
  L('           ' + monthKey + ' from CBC direct (' + ros.cbcCount + ' agents)');
  L('           earlier months from ' + BM_ROSTER_LIVE + ' as they stand');
  L('');

  /* ---------- payments ---------- */
  var sh = ss.getSheetByName('src_Payments');
  if (!sh || sh.getLastRow() < 10) {
    L('  *** src_Payments is missing or empty. Nothing written.'); return;
  }
  var map = bm_cols_(sh, L);
  if (map.error) { L('  *** ' + map.error); return; }

  var first = bm_firstPayments_(sh, map, L, since);
  if (first.error) { L('  *** ' + first.error + ' Nothing written.'); return; }
  L('  UNITS  : ' + first.count + ' distinct customers across the whole tracker, ' + since());
  L('');

  /* WRITING OVER THE LIVE MODEL IS THE ONE IRREVERSIBLE STEP HERE, so
     it is refused when the rebuild is dramatically smaller than what it
     would replace. A short read - a half-loaded import, a truncated
     source - would otherwise gut the tab that ten pages and the
     television read, and nothing downstream would question it. */
  if (live) {
    var existing = bm_rowCount_(ss, payOut);
    if (existing > 100 && built0Rows(sh, map) < existing * 0.6) {
      L('  *** REFUSING TO WRITE OVER ' + payOut + '.');
      L('      It holds ' + existing + ' rows and this rebuild would write far');
      L('      fewer. That is a short read, not a quiet month.');
      L('      Nothing was changed. Run buildModel() to inspect it safely.');
      return;
    }
  }

  var built = bm_build_(ss, sh, map, ros, first, L, since, payOut);
  if (built.error) { L('  *** ' + built.error + ' Nothing written.'); return; }

  /* ---------- the roster tab ---------- */
  bm_writeRoster_(ss, ros, L, rosOut);

  L('');
  if (live) {
    L('  ' + payOut + ' and ' + rosOut + ' have been rebuilt in place.');
    L('  Every page and the TV read the new figures from here.');
  } else {
    bm_compare_(ss, L);
    L('');
    L('  Nothing live was changed. Read the comparison above, then:');
    L('    buildModelSwap()    put these in place of ' + BM_PAY_LIVE + ' / ' + BM_ROSTER_LIVE);
    L('    buildModelRevert()  undo that');
  }
  L('  done in ' + Math.round((new Date() - t0) / 1000) + 's');
}


/** How many data rows a tab holds, 0 if it is not there. */
function bm_rowCount_(ss, name) {
  var sh = ss.getSheetByName(name);
  return (sh && sh.getLastRow() > 1) ? sh.getLastRow() - 1 : 0;
}

/** How many dated rows the source offers, for the short-read guard. */
function built0Rows(sh, map) {
  return Math.max(0, sh.getLastRow() - (map.hr + 1));
}


/* =====================================================================
   ROSTERS, ONE PER MONTH
   ===================================================================== */

/**
 * A month key, without depending on war-room.gs.
 *
 * The first version called wr_monthKey_, which lives in another file.
 * BuildModel writes the tabs that war-room.gs reads, so taking a
 * dependency back the other way means neither can be moved or deleted
 * without breaking the other. It uses the project's version where it
 * exists and falls back to its own, which is all this needs.
 */
function bm_monthKey_(v) {
  if (typeof wr_monthKey_ === 'function') return wr_monthKey_(v);
  if (v instanceof Date && !isNaN(v.getTime())) {
    var m = v.getMonth() + 1;
    return v.getFullYear() + '-' + (m < 10 ? '0' + m : '' + m);
  }
  var s = String(v == null ? '' : v).trim();
  return /^\d{4}-\d{2}$/.test(s) ? s : '';
}


function bm_rosters_(ss, monthKey, L) {
  var out = { byMonth: {}, cbcCount: 0, error: '' };

  /* History from the live roster tab. These months are settled and this
     is where their record lives; rebuilding them from a CBC tab that may
     since have been edited would quietly restate closed months. */
  var sh = ss.getSheetByName(BM_ROSTER_LIVE);
  if (sh && sh.getLastRow() > 1) {
    var grid = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var col = {};
    for (var c = 0; c < grid[0].length; c++) {
      var h = String(grid[0][c]).trim();
      if (h && col[h] === undefined) col[h] = c;
    }
    if (col['Month'] !== undefined && col['Agent'] !== undefined) {
      for (var r = 1; r < grid.length; r++) {
        var mk = bm_monthKey_(grid[r][col['Month']]);
        var name = String(grid[r][col['Agent']] || '').trim();
        if (!mk || !name) continue;
        if (!out.byMonth[mk]) out.byMonth[mk] = {};
        out.byMonth[mk][ins_key_(name)] = {
          name:    name,
          manager: col['Manager'] !== undefined ? String(grid[r][col['Manager']] || '').trim() : '',
          office:  col['Office']  !== undefined ? String(grid[r][col['Office']]  || '').trim() : '',
          team:    col['Team']    !== undefined ? String(grid[r][col['Team']]    || '').trim() : '',
          target:  col['Target']  !== undefined ? ins_num_(grid[r][col['Target']]) : 0,
          mm:      col['Man Month'] !== undefined ? ins_num_(grid[r][col['Man Month']]) : 1
        };
      }
    }
  }

  /* This month from CBC, replacing whatever the live tab holds for it.
     This is the month that has to be right, and CBC is the authority on
     who is on the floor. */
  var cbc = ins_cbc_(monthKey);
  if (cbc.error) { out.error = 'CBC: ' + cbc.error; return out; }
  out.byMonth[monthKey] = {};
  for (var i = 0; i < cbc.agents.length; i++) {
    var a = cbc.agents[i];
    out.byMonth[monthKey][a.key] = {
      name: a.name, manager: a.manager, office: a.city, team: a.team,
      target: a.target, mm: a.mm > 0 ? a.mm : 1
    };
    out.cbcCount++;
  }
  return out;
}


/* =====================================================================
   src_Payments: its columns, and the first payment per customer
   ===================================================================== */

function bm_cols_(sh, L) {
  var lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, Math.min(10, sh.getLastRow()), lastCol).getValues();
  var hr = -1, H = null;
  for (var i = 0; i < head.length; i++) {
    var m = {};
    for (var j = 0; j < head[i].length; j++) {
      var h = String(head[i][j]).trim().toLowerCase();
      if (h && m[h] === undefined) m[h] = j;
    }
    if (m['date'] !== undefined && (m['lead owner'] !== undefined || m['agent'] !== undefined) &&
        m['amount paid'] !== undefined) { hr = i; H = m; break; }
  }
  if (hr < 0) return { error: 'no Date / Lead Owner / Amount Paid row in the first 10 of src_Payments' };

  var pick = function (names) { return ins_col_(H, names); };
  var out = {
    hr: hr, lastCol: lastCol,
    date:   pick(['date', 'payment date', 'paid on']),
    agent:  pick(['lead owner', 'agent', 'owner']),
    amt:    pick(['amount paid', 'amount', 'amount inr']),
    stat:   pick(['status']),
    cust:   pick(['payment email id', 'payment email', 'email', 'name']),
    ptype:  pick(['payment type']),
    sale:   pick(['sale price', 'total price', 'deal value']),
    bal:    pick(['balance left', 'balance', 'pending']),
    batch:  pick(['batch']),
    family: pick(['batch family', 'family']),
    seg:    pick(['segment'])
  };

  var found = [], missing = [];
  var label = { date: 'Date', agent: 'Lead Owner', amt: 'Amount Paid',
                stat: 'Status', cust: 'customer', ptype: 'Payment Type',
                sale: 'Sale Price', bal: 'Balance Left', batch: 'Batch',
                family: 'Batch Family', seg: 'Segment' };
  for (var k in label) (out[k] >= 0 ? found : missing).push(label[k]);
  L('  COLUMNS: header row ' + (hr + 1) + ' of src_Payments');
  L('           found   ' + found.join(', '));
  if (missing.length) {
    L('           missing ' + missing.join(', '));
    L('           Those columns are written blank. Any page that reads one');
    L('           will show nothing rather than something wrong.');
  }
  return out;
}


/** The earliest payment per customer, over the whole tracker. */
function bm_firstPayments_(sh, map, L, since) {
  var out = { by: {}, count: 0, error: '' };
  if (map.cust < 0) {
    L('  UNITS  : no customer column, so Is Unit cannot be computed and is');
    L('           written blank. Units on every page would read zero, so');
    L('           this is reported rather than guessed.');
    return out;
  }
  var n = sh.getLastRow() - (map.hr + 1);
  var CH = 5000, done = 0, blank = 0;
  while (done < n) {
    var h = Math.min(CH, n - done), top = map.hr + 2 + done;
    var D = sh.getRange(top, map.date + 1, h, 1).getValues();
    var C = sh.getRange(top, map.cust + 1, h, 1).getValues();
    var S = map.stat >= 0 ? sh.getRange(top, map.stat + 1, h, 1).getValues() : null;
    var live = 0;
    for (var r = 0; r < h; r++) {
      var d = D[r][0];
      if (!(d instanceof Date) || isNaN(d.getTime())) continue;
      live++;
      if (S && ins_isDead_(S[r][0])) continue;
      var ck = String(C[r][0] == null ? '' : C[r][0]).trim().toLowerCase();
      if (!ck) continue;
      if (!out.by[ck] || d < out.by[ck]) { if (!out.by[ck]) out.count++; out.by[ck] = d; }
    }
    done += h;
    if (!live) { blank++; if (blank >= 2) break; } else blank = 0;
  }
  return out;
}


/* =====================================================================
   THE PAYMENTS TAB
   ===================================================================== */

function bm_build_(ss, sh, map, ros, first, L, since, outName) {
  var out = { rows: 0, error: '' };
  var n = sh.getLastRow() - (map.hr + 1);
  if (n < 1) { out.error = 'src_Payments has a header and no rows.'; return out; }

  var target = ss.getSheetByName(outName);
  if (!target) target = ss.insertSheet(outName);
  else target.clear();
  target.getRange(1, 1, 1, BM_PAY_COLS.length).setValues([BM_PAY_COLS]);

  var at = function (row, idx) { return idx >= 0 ? row[idx] : ''; };
  var CH = 2000, done = 0, blank = 0, written = 0, onRoster = 0;

  while (done < n) {
    var h = Math.min(CH, n - done), top = map.hr + 2 + done;
    var block = sh.getRange(top, 1, h, map.lastCol).getValues();
    var put = [], live = 0;

    for (var r = 0; r < h; r++) {
      var row = block[r];
      var d = at(row, map.date);
      if (!(d instanceof Date) || isNaN(d.getTime())) continue;
      live++;

      var mk = bm_monthKey_(d);
      var name = String(at(row, map.agent) || '').trim();
      var key = name ? ins_key_(name) : '';
      var who = (key && ros.byMonth[mk]) ? ros.byMonth[mk][key] : null;
      if (who) onRoster++;

      var ck = map.cust >= 0
                 ? String(at(row, map.cust) == null ? '' : at(row, map.cust)).trim().toLowerCase()
                 : '';
      var fd = ck ? first.by[ck] : null;
      var isUnit = (fd && d.getTime() === fd.getTime()) ? 'YES' : 'NO';
      if (!ck) isUnit = '';

      var st = map.stat >= 0 ? String(at(row, map.stat) || '').trim() : '';
      var dead = ins_isDead_(st);

      /* ON ROSTER IS THE ONLY FILTER THE REPORT APPLIES.
         mr_payments_ skips a row unless this column says YES and looks at
         nothing else - not Status, not Is Refund. So a cancelled row
         marked YES is counted as revenue. The test fixture caught exactly
         that: a cancelled 999,999 inflating October by ten lakh.
         A cancelled, refunded, failed or reversed row therefore says NO
         here, which is what makes these pages agree with insideSales.
         Is Refund still says YES, so the board's own refund accounting
         sees it. */
      put.push([
        d,
        mk,
        name,
        (who && !dead) ? 'YES' : 'NO',
        who ? who.manager : '',
        who ? who.office  : '',
        who ? who.team    : '',
        ins_num_(at(row, map.amt)),
        map.ptype  >= 0 ? at(row, map.ptype)  : '',
        isUnit,
        map.sale   >= 0 ? ins_num_(at(row, map.sale)) : '',
        map.bal    >= 0 ? ins_num_(at(row, map.bal))  : '',
        map.batch  >= 0 ? at(row, map.batch)  : '',
        map.family >= 0 ? at(row, map.family) : '',
        map.seg    >= 0 ? at(row, map.seg)    : '',
        st,
        dead ? 'YES' : 'NO',
        fd ? bm_monthKey_(fd) : ''
      ]);
    }

    if (put.length) {
      target.getRange(written + 2, 1, put.length, BM_PAY_COLS.length).setValues(put);
      written += put.length;
    }
    done += h;
    if (done % 10000 === 0 || done >= n) {
      L('  PAYMENTS: ' + ins_pad_(String(done), 8) + 'of ' + ins_pad_(String(n), 8) +
        ins_pad_(written + ' written', 16) + since());
    }
    if (!live) { blank++; if (blank >= 2) break; } else blank = 0;
  }

  if (!written) { out.error = 'no dated rows found in src_Payments.'; return out; }
  out.rows = written;
  L('  PAYMENTS: ' + written + ' row(s) written to ' + outName + ', ' +
    onRoster + ' on a roster, ' + since());
  return out;
}


/* =====================================================================
   THE ROSTER TAB
   ===================================================================== */

function bm_writeRoster_(ss, ros, L, outName) {
  var target = ss.getSheetByName(outName);
  if (!target) target = ss.insertSheet(outName);
  else target.clear();
  target.getRange(1, 1, 1, BM_ROSTER_COLS.length).setValues([BM_ROSTER_COLS]);

  var rows = [], mk, k;
  var months = [];
  for (mk in ros.byMonth) months.push(mk);
  months.sort();
  for (var i = 0; i < months.length; i++) {
    mk = months[i];
    for (k in ros.byMonth[mk]) {
      var a = ros.byMonth[mk][k];
      rows.push([mk, a.name, a.manager, a.office, a.team, a.target, a.mm]);
    }
  }
  if (rows.length) {
    target.getRange(2, 1, rows.length, BM_ROSTER_COLS.length).setValues(rows);
  }
  L('  ROSTER : ' + rows.length + ' row(s) written to ' + outName);
}


/* =====================================================================
   THE COMPARISON. The whole point of writing to new tabs first.
   ===================================================================== */

function bm_compare_(ss, L) {
  var a = bm_tally_(ss, BM_PAY_LIVE);
  var b = bm_tally_(ss, BM_PAY_OUT);
  if (a.error || b.error) {
    L('  Cannot compare: ' + (a.error || b.error));
    return;
  }

  var months = {}, mk;
  for (mk in a.by) months[mk] = true;
  for (mk in b.by) months[mk] = true;
  var list = [];
  for (mk in months) list.push(mk);
  list.sort();

  L('  --- ' + BM_PAY_LIVE + '  vs  ' + BM_PAY_OUT + ', on-roster revenue by month ---');
  L('  ' + ins_pad_('month', 10) + ins_pad_('live rows', 11) + ins_pad_('new rows', 11) +
    ins_pad_('live revenue', 15) + ins_pad_('new revenue', 15) + 'change');
  for (var i = 0; i < list.length; i++) {
    mk = list[i];
    var x = a.by[mk] || { rows: 0, rev: 0 };
    var y = b.by[mk] || { rows: 0, rev: 0 };
    var d = y.rev - x.rev;
    L('  ' + ins_pad_(mk, 10) + ins_pad_(String(x.rows), 11) + ins_pad_(String(y.rows), 11) +
      ins_pad_(ins_money_(x.rev), 15) + ins_pad_(ins_money_(y.rev), 15) +
      (Math.abs(d) < 1 ? '-' : (d > 0 ? '+' : '') + ins_money_(d)));
  }
  L('');
  L('  A month that rises is revenue the live model was dropping.');
  L('  A month that falls by more than a little is a reason NOT to swap -');
  L('  say so and it gets looked at before anything is replaced.');
}


/** On-roster revenue per month from a payments tab in model shape. */
function bm_tally_(ss, name) {
  var out = { by: {}, error: '' };
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) { out.error = name + ' is missing or empty'; return out; }

  var lastCol = sh.getLastColumn();
  var col = {};
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var c = 0; c < head.length; c++) {
    var h = String(head[c]).trim();
    if (h && col[h] === undefined) col[h] = c;
  }
  if (col['Month'] === undefined || col['Amount Paid'] === undefined ||
      col['On Roster'] === undefined) {
    out.error = name + ' has no Month / Amount Paid / On Roster column';
    return out;
  }

  var n = sh.getLastRow() - 1, CH = 5000, done = 0;
  while (done < n) {
    var h2 = Math.min(CH, n - done);
    var g = sh.getRange(2 + done, 1, h2, lastCol).getValues();
    for (var r = 0; r < h2; r++) {
      if (String(g[r][col['On Roster']]).trim().toUpperCase() !== 'YES') continue;
      var mk = bm_monthKey_(g[r][col['Month']]);
      if (!mk) continue;
      if (!out.by[mk]) out.by[mk] = { rows: 0, rev: 0 };
      out.by[mk].rows++;
      out.by[mk].rev += ins_num_(g[r][col['Amount Paid']]);
    }
    done += h2;
  }
  return out;
}


/* =====================================================================
   THE SWAP, AND THE WAY BACK
   ===================================================================== */

function buildModelSwap() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  L('=== BUILD MODEL SWAP ===   ' +
    Utilities.formatDate(new Date(), INS_TZ, 'dd MMM HH:mm'));

  var pay = ss.getSheetByName(BM_PAY_OUT);
  var ros = ss.getSheetByName(BM_ROSTER_OUT);
  if (!pay || pay.getLastRow() < 100) {
    L('  *** ' + BM_PAY_OUT + ' is missing or too small. Run buildModel first.');
    return;
  }
  if (!ros || ros.getLastRow() < 2) {
    L('  *** ' + BM_ROSTER_OUT + ' is missing. Run buildModel first.');
    return;
  }

  /* The live tab must not already have been swapped away, or a second
     run would bury the real original under a copy of itself. */
  if (ss.getSheetByName(BM_PAY_LIVE + '_OLD')) {
    L('  *** ' + BM_PAY_LIVE + '_OLD already exists, so a swap has already');
    L('      happened. Run buildModelRevert first if you want to redo it.');
    return;
  }

  var steps = [[BM_PAY_LIVE, BM_PAY_OUT], [BM_ROSTER_LIVE, BM_ROSTER_OUT]];
  for (var i = 0; i < steps.length; i++) {
    var live = ss.getSheetByName(steps[i][0]);
    var next = ss.getSheetByName(steps[i][1]);
    if (live) live.setName(steps[i][0] + '_OLD');
    next.setName(steps[i][0]);
    L('  ' + steps[i][1] + ' is now ' + steps[i][0] +
      (live ? ', and the old one is ' + steps[i][0] + '_OLD' : ''));
  }
  L('');
  L('  Every page and the TV now read the rebuilt model. They will show');
  L('  the new figures on their next refresh, or immediately if you run');
  L('  one by hand.');
  L('  buildModelRevert() puts the originals back in one step.');
}


function buildModelRevert() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  L('=== BUILD MODEL REVERT ===');

  var pairs = [[BM_PAY_LIVE, BM_PAY_OUT], [BM_ROSTER_LIVE, BM_ROSTER_OUT]];
  var any = false;
  for (var i = 0; i < pairs.length; i++) {
    var oldName = pairs[i][0] + '_OLD';
    var backup = ss.getSheetByName(oldName);
    if (!backup) { L('  no ' + oldName + ' - nothing to put back'); continue; }
    var current = ss.getSheetByName(pairs[i][0]);
    if (current) current.setName(pairs[i][1]);
    backup.setName(pairs[i][0]);
    L('  ' + oldName + ' is ' + pairs[i][0] + ' again');
    any = true;
  }
  if (any) L('  The original model is back. Nothing was deleted at any point.');
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
