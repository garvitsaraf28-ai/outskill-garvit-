/**
 * scorecard.gs
 *
 * Builds the "Scorecard" page: every agent in the org, grouped
 * office > manager > agent, showing target vs achieved for each month
 * plus a YTD roll-up, with subtotals at office and manager level.
 *
 * Modelled on the CBC "BBS Team" tab, widened to the whole org.
 *
 * Source: the local src_Roster_* tabs, which syncRosterSources already
 * mirrors from CBC. This file never opens the CBC workbook, so it does
 * not depend on cross-workbook permissions and cannot be slowed by them.
 *
 * Columns are found by HEADER NAME, not by letter, because CBC changed
 * its month-tab layout between June and July 2026 (Apr/May/Jun put Agent
 * in A and Target in F; Jul/Aug put Agent in E and Target in J). Matching
 * on names survives the next reshuffle too.
 *
 * Run: buildScorecard
 */

var SCC_TAB = 'Scorecard';
var SCC_PREFIX = 'src_Roster_';
var SCC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// how the office reads on the page, keyed by the tail of the team name
var SCC_OFFICE_NAME = {
  bbsr: 'Bhubaneswar',
  blr: 'Bangalore',
  bangalore: 'Bangalore',
  hyd: 'Hyderabad',
  hyderabad: 'Hyderabad'
};

var SCC_UNASSIGNED = 'No office set';
var SCC_NO_MANAGER = 'No manager set';

/* colours, kept close to the CBC tab so the page feels familiar */
var SCC_C_TOTAL = '#f4cccc';
var SCC_C_HEAD = '#d9d9d9';
var SCC_C_OFFICE = '#c9daf8';
var SCC_C_MGR = '#eeeeee';
var SCC_C_YTD = '#e2efda';

function buildScorecard() {
  var t0 = new Date();
  var ss = SpreadsheetApp.getActive();

  var months = scc_months_(ss);
  if (!months.length) {
    throw new Error('no ' + SCC_PREFIX + '* tabs found. run the roster sync first.');
  }
  Logger.log('months found: ' + months.map(function (m) { return m.label; }).join(', '));

  var agents = scc_collect_(ss, months);
  var keys = Object.keys(agents);
  if (!keys.length) throw new Error('no agents read from the roster tabs.');
  Logger.log('agents read: ' + keys.length);

  var tree = scc_group_(agents);
  scc_write_(ss, tree, months);

  Logger.log('built "' + SCC_TAB + '" in ' + Math.round((new Date() - t0) / 1000) + 's');
}

/* ---------- which months exist ---------- */

function scc_months_(ss) {
  var out = [];
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n.indexOf(SCC_PREFIX) !== 0) return;
    var tail = n.substring(SCC_PREFIX.length).toLowerCase().substring(0, 3);
    for (var i = 0; i < SCC_MONTHS.length; i++) {
      if (SCC_MONTHS[i].toLowerCase() === tail) {
        out.push({ tab: n, label: SCC_MONTHS[i], order: i, sheet: sh });
        return;
      }
    }
  });
  out.sort(function (a, b) { return a.order - b.order; });
  return out;
}

/* ---------- find the columns by name ---------- */

function scc_cols_(sh) {
  var probe = Math.min(sh.getLastRow(), 12);
  var wide = Math.min(sh.getLastColumn(), 40);
  if (probe < 1 || wide < 1) return null;

  var grid = sh.getRange(1, 1, probe, wide).getDisplayValues();

  for (var r = 0; r < probe; r++) {
    var row = grid[r];
    var iAgent = -1, iRev = -1;
    for (var c = 0; c < row.length; c++) {
      var h = String(row[c] || '').trim().toLowerCase();
      if (h === 'agent') iAgent = c;
      else if (h === 'revenue') iRev = c;
    }
    if (iAgent < 0 || iRev < 0) continue;   // not the header row

    var out = {
      headerRow: r + 1, agent: iAgent, revenue: iRev,
      manager: -1, doj: -1, team: -1, target: -1
    };
    for (var k = 0; k < row.length; k++) {
      var t = String(row[k] || '').trim().toLowerCase();
      if (t === 'manager') out.manager = k;
      else if (t === 'doj') out.doj = k;
      else if (t === 'city/region' || t === 'team') out.team = k;
      else if (out.target < 0 && t.indexOf('target') > -1) out.target = k;
    }
    return out;
  }
  return null;
}

/* ---------- read every month ---------- */

function scc_collect_(ss, months) {
  var map = {};

  // months arrive oldest first, so a later month overwrites the
  // attributes of an earlier one. latest month wins.
  months.forEach(function (m) {
    var cols = scc_cols_(m.sheet);
    if (!cols) { Logger.log('skipped ' + m.tab + ': no header row found'); return; }

    var last = m.sheet.getLastRow();
    if (last <= cols.headerRow) { Logger.log('skipped ' + m.tab + ': no data rows'); return; }

    var vals = m.sheet
      .getRange(cols.headerRow + 1, 1, last - cols.headerRow, m.sheet.getLastColumn())
      .getValues();

    var seen = 0;
    for (var i = 0; i < vals.length; i++) {
      var row = vals[i];
      var name = String(row[cols.agent] || '').trim();
      if (!name || name.toLowerCase() === 'total') continue;

      var key = scc_key_(name);
      if (!key) continue;

      if (!map[key]) map[key] = { name: name, manager: '', team: '', doj: '', months: {} };
      var rec = map[key];
      rec.name = name;

      if (cols.manager >= 0) {
        var mg = String(row[cols.manager] || '').trim();
        if (mg) rec.manager = mg;
      }
      if (cols.team >= 0) {
        var tm = String(row[cols.team] || '').trim();
        if (tm) rec.team = tm;
      }
      if (cols.doj >= 0 && row[cols.doj]) rec.doj = row[cols.doj];

      rec.months[m.label] = {
        target: scc_num_(cols.target >= 0 ? row[cols.target] : 0),
        ach: scc_num_(row[cols.revenue])
      };
      seen++;
    }
    Logger.log(m.tab + ': ' + seen + ' agent rows');
  });

  return map;
}

/* ---------- office > manager > agent ---------- */

function scc_group_(map) {
  var offices = {};
  Object.keys(map).forEach(function (k) {
    var a = map[k];
    var off = scc_office_(a.team);
    var mgr = a.manager || SCC_NO_MANAGER;
    if (!offices[off]) offices[off] = {};
    if (!offices[off][mgr]) offices[off][mgr] = [];
    offices[off][mgr].push(a);
  });
  return offices;
}

function scc_office_(team) {
  var t = String(team || '').trim();
  if (!t) return SCC_UNASSIGNED;
  var parts = t.split('-');
  if (parts.length < 2) return SCC_UNASSIGNED;
  var tail = parts[parts.length - 1].trim();
  if (!tail) return SCC_UNASSIGNED;
  return SCC_OFFICE_NAME[tail.toLowerCase()] || tail;
}

/* ---------- write the page ---------- */

function scc_write_(ss, tree, months) {
  var nCols = 5 + months.length * 2 + 3;

  /* header row */
  var head = ['', 'Manager', 'Team', 'Date of Joining', '# Days in Org'];
  months.forEach(function (m) {
    head.push(m.label + ' Target');
    head.push(m.label + ' Ach');
  });
  head.push('YTD Target', 'YTD Ach', 'YTD Ach%');

  /* body */
  var body = [];       // rows below the header
  var officeRows = []; // 1-based sheet rows, filled in after we know offsets
  var mgrRows = [];
  var grand = scc_zero_(months);

  var offNames = Object.keys(tree).sort(scc_sortOffice_);

  offNames.forEach(function (off) {
    var mgrs = tree[off];
    var offTot = scc_zero_(months);
    var offAt = body.length;
    body.push(null);   // placeholder, filled once the subtotal is known

    Object.keys(mgrs).sort(scc_sortName_).forEach(function (mgr) {
      var list = mgrs[mgr];
      var mgrTot = scc_zero_(months);
      var mgrAt = body.length;
      body.push(null);

      // best performer first; joining date is still visible in its own column
      list.sort(function (a, b) { return scc_ytd_(b, months).ach - scc_ytd_(a, months).ach; });

      list.forEach(function (a) {
        body.push(scc_agentRow_(a, months));
        scc_add_(mgrTot, a, months);
      });

      body[mgrAt] = { band: 'mgr', label: '    ' + mgr, tot: mgrTot };
      mgrRows.push(mgrAt);
      scc_addTot_(offTot, mgrTot, months);
    });

    body[offAt] = { band: 'office', label: off.toUpperCase(), tot: offTot };
    officeRows.push(offAt);
    scc_addTot_(grand, offTot, months);
  });

  /* turn the placeholders into real rows */
  var out = [];
  body.forEach(function (r) {
    out.push(Array.isArray(r) ? r : scc_totRow_(r.label, r.tot, months));
  });

  /* Days in org is left as a live formula so it stays right between
     rebuilds. out[i] lands on sheet row i + 4 (total, note, header, body).
     The -1 matches the CBC BBS Team tab, so the two pages agree. */
  out.forEach(function (r, i) {
    if (!Array.isArray(r) || !r[3]) return;
    var ref = '$D' + (i + 4);
    r[4] = '=IF(' + ref + '="","",TODAY()-' + ref + '-1)';
  });

  /* row 1 total, row 2 note, row 3 header, row 4+ body */
  var grid = [];
  grid.push(scc_totRow_('TOTAL', grand, months));
  var note = scc_blank_(nCols);
  note[0] = 'built ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMM yyyy HH:mm');
  grid.push(note);
  grid.push(head);
  out.forEach(function (r) { grid.push(r); });

  /* write */
  var sh = ss.getSheetByName(SCC_TAB) || ss.insertSheet(SCC_TAB);
  sh.clear();
  if (sh.getMaxRows() < grid.length) sh.insertRowsAfter(sh.getMaxRows(), grid.length - sh.getMaxRows());
  if (sh.getMaxColumns() < nCols) sh.insertColumnsAfter(sh.getMaxColumns(), nCols - sh.getMaxColumns());
  sh.getRange(1, 1, grid.length, nCols).setValues(grid);

  scc_format_(sh, grid.length, nCols, months, officeRows, mgrRows);
  SpreadsheetApp.flush();

  Logger.log('offices: ' + offNames.join(', '));
  Logger.log('rows written: ' + grid.length + ', columns: ' + nCols);
}

function scc_agentRow_(a, months) {
  var r = [a.name, a.manager || '', a.team || '', a.doj || '', ''];
  var y = scc_ytd_(a, months);
  months.forEach(function (m) {
    var v = a.months[m.label];
    r.push(v ? v.target : 0);
    r.push(v ? v.ach : 0);
  });
  r.push(y.target, y.ach, y.target ? y.ach / y.target : '');
  return r;
}

function scc_totRow_(label, tot, months) {
  var r = [label, '', '', '', ''];
  var tT = 0, tA = 0;
  months.forEach(function (m) {
    r.push(tot[m.label].target);
    r.push(tot[m.label].ach);
    tT += tot[m.label].target;
    tA += tot[m.label].ach;
  });
  r.push(tT, tA, tT ? tA / tT : '');
  return r;
}

/* ---------- formatting ---------- */

function scc_format_(sh, rows, nCols, months, officeRows, mgrRows) {
  var firstMoney = 6;                       // column F
  var pctCol = nCols;                       // last column
  var ytdFrom = 5 + months.length * 2 + 1;  // YTD Target

  sh.getRange(1, 1, rows, nCols).setFontFamily('Arial').setFontSize(10);
  sh.getRange(1, firstMoney, rows, nCols - firstMoney).setNumberFormat('#,##0');
  sh.getRange(1, pctCol, rows, 1).setNumberFormat('0.00%');
  sh.getRange(4, 4, rows - 3, 1).setNumberFormat('d-mmm-yyyy');
  sh.getRange(4, 5, rows - 3, 1).setNumberFormat('0');

  // row 1 total
  sh.getRange(1, 1, 1, nCols).setBackground(SCC_C_TOTAL).setFontWeight('bold').setFontColor('#990000');
  // row 2 note
  sh.getRange(2, 1, 1, nCols).setFontSize(8).setFontColor('#666666');
  // row 3 header
  sh.getRange(3, 1, 1, nCols).setBackground(SCC_C_HEAD).setFontWeight('bold').setWrap(true);

  // the YTD block gets the same green as the CBC tab
  sh.getRange(3, ytdFrom, rows - 2, 3).setBackground(SCC_C_YTD);

  // subtotal bands. body starts at sheet row 4.
  officeRows.forEach(function (i) {
    sh.getRange(i + 4, 1, 1, nCols).setBackground(SCC_C_OFFICE).setFontWeight('bold');
  });
  mgrRows.forEach(function (i) {
    sh.getRange(i + 4, 1, 1, nCols).setBackground(SCC_C_MGR).setFontWeight('bold');
  });

  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 150);
  sh.setColumnWidth(3, 150);
  sh.setColumnWidth(4, 110);
}

/* ---------- small helpers ---------- */

function scc_zero_(months) {
  var o = {};
  months.forEach(function (m) { o[m.label] = { target: 0, ach: 0 }; });
  return o;
}

function scc_add_(tot, a, months) {
  months.forEach(function (m) {
    var v = a.months[m.label];
    if (!v) return;
    tot[m.label].target += v.target;
    tot[m.label].ach += v.ach;
  });
}

function scc_addTot_(dst, src, months) {
  months.forEach(function (m) {
    dst[m.label].target += src[m.label].target;
    dst[m.label].ach += src[m.label].ach;
  });
}

function scc_ytd_(a, months) {
  var t = 0, c = 0;
  months.forEach(function (m) {
    var v = a.months[m.label];
    if (!v) return;
    t += v.target;
    c += v.ach;
  });
  return { target: t, ach: c };
}

function scc_blank_(n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push('');
  return r;
}

function scc_key_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scc_num_(v) {
  if (typeof v === 'number') return v;
  var raw = String(v == null ? '' : v).trim();
  if (!raw) return 0;
  var neg = /^\(.*\)$/.test(raw);          // CBC writes negatives as (1,234)
  var n = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

function scc_sortName_(a, b) {
  if (a === SCC_NO_MANAGER) return 1;
  if (b === SCC_NO_MANAGER) return -1;
  return a < b ? -1 : (a > b ? 1 : 0);
}

function scc_sortOffice_(a, b) {
  if (a === SCC_UNASSIGNED) return 1;
  if (b === SCC_UNASSIGNED) return -1;
  return a < b ? -1 : (a > b ? 1 : 0);
}

/* ---------- self test ---------- */

function scorecardSelfTest() {
  var fails = [];

  // currency parsing, including the way CBC writes negatives
  // \u20B9 is the rupee sign, written as an escape so this file stays
  // pure ASCII and survives being pasted into the Apps Script editor.
  if (scc_num_('\u20B9' + '1,000,000') !== 1000000) fails.push('rupee string not parsed');
  if (scc_num_('(1,521,870)') !== -1521870) fails.push('bracket negative not parsed');
  if (scc_num_('') !== 0) fails.push('blank should be 0');
  if (scc_num_(250) !== 250) fails.push('plain number should pass through');
  if (scc_num_('-') !== 0) fails.push('dash should be 0');

  // office comes off the tail of the team name
  if (scc_office_('India Team-Bbsr') !== 'Bhubaneswar') fails.push('Bbsr not mapped');
  if (scc_office_('Intl Team-Bangalore') !== 'Bangalore') fails.push('Bangalore not mapped');
  if (scc_office_('India Team-Hyd') !== 'Hyderabad') fails.push('Hyd not mapped');
  if (scc_office_('') !== SCC_UNASSIGNED) fails.push('blank team should be unassigned');
  if (scc_office_('Something') !== SCC_UNASSIGNED) fails.push('team with no dash should be unassigned');

  // name keys ignore case and punctuation
  if (scc_key_('SWAPNA NAIK') !== scc_key_('Swapna Naik')) fails.push('case should not split an agent');
  if (scc_key_('Peesa  Sirisha') !== scc_key_('peesasirisha')) fails.push('spacing should not split an agent');

  // months sort calendar order, not alphabetical
  var order = SCC_MONTHS.indexOf('Apr') < SCC_MONTHS.indexOf('Aug') &&
              SCC_MONTHS.indexOf('Aug') < SCC_MONTHS.indexOf('Sep');
  if (!order) fails.push('month order is wrong');

  if (fails.length) {
    Logger.log('SELF TEST FAILED:');
    fails.forEach(function (f) { Logger.log('  - ' + f); });
  } else {
    Logger.log('scorecard self test: all checks passed');
  }
  return fails.length === 0;
}
