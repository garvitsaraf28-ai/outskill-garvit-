/**
 * warRoomFindAgent - READ ONLY. Writes nothing, anywhere.
 *
 * WHY THE LAST CHECK WAS NOT ENOUGH
 *
 *   warRoomThreeWay reported Dinesh Kumar Tarenia and Satyam Aditya Samant
 *   as having no payment row. They are in the tracker. The check matched
 *   the tracker's Lead Owner against CBC's Agent spelling EXACTLY, so a
 *   name written any other way - "Dinesh Kumar", a trailing initial, a
 *   different order - reads as nothing at all rather than as a near miss.
 *   An exact match cannot tell "not there" from "spelled differently", and
 *   it reported the first when it meant the second.
 *
 *   This searches by TEXT instead, across every month, and prints what it
 *   finds. A name spelled differently shows up with its real spelling next
 *   to it; a payment dated another month shows up with its date; and if
 *   nothing comes back at all, the row genuinely has not reached the
 *   import yet.
 *
 * TO USE IT
 *
 *   Run warRoomFindAgent. It looks for the names in WRF_LOOK below -
 *   change them to search for anybody else. Matching is loose on purpose:
 *   any Lead Owner CONTAINING the text, in any month, in both the import
 *   and the model.
 */

var WRF_LOOK = ['Dinesh', 'Satyam'];


function warRoomFindAgent() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  L('=== LOOKING FOR: ' + WRF_LOOK.join(', ') + ' ===');
  L('  Read only. Matching is loose - any Lead Owner containing the text,');
  L('  in ANY month, so a different spelling or a different date shows up');
  L('  rather than reading as nothing.');
  L('');

  var src = wrf_find_(ss, true), mdl = wrf_find_(ss, false);
  if (!src) { L('  Could not find the raw payments import.'); return; }

  wrf_scan_(src, 'IMPORT  (' + src.name + ')', L, P, M, monthKey);
  if (mdl) wrf_scan_(mdl, 'MODEL   (' + mdl.name + ')', L, P, M, monthKey);

  /* If a row is in the tracker but in neither tab, the IMPORTRANGE has
     simply not fetched it yet - so say how fresh each tab is. */
  L('  HOW FRESH IS EACH TAB');
  L('    ' + P(src.name, 18) + 'newest payment ' + wrf_newest_(src));
  if (mdl) L('    ' + P(mdl.name, 18) + 'newest payment ' + wrf_newest_(mdl));
  L('    today              ' + Utilities.formatDate(new Date(), WR_TZ, 'dd MMM yyyy'));
  L('');
  L('  If a payment is in the Payment Tracker and appears in NEITHER tab');
  L('  above, the IMPORTRANGE has not fetched it yet. That is not something');
  L('  updateAndCheck can fix - it rebuilds the model from the import, and');
  L('  cannot add a row the import has not received.');
  L('');
  L('  Nothing was written. This only reports.');
}


function wrf_scan_(t, title, L, P, M, monthKey) {
  L('  ' + title);
  var hits = 0, thisMonth = 0, total = 0;

  for (var r = 0; r < t.rows.length; r++) {
    var row = t.rows[r];
    var owner = wr_str_(row[t.c.agent]);
    if (!owner) continue;

    var lower = owner.toLowerCase(), match = false;
    for (var i = 0; i < WRF_LOOK.length; i++) {
      if (lower.indexOf(String(WRF_LOOK[i]).toLowerCase()) > -1) { match = true; break; }
    }
    if (!match) continue;

    var d = row[t.c.date];
    var when = (d instanceof Date && !isNaN(d.getTime()))
      ? Utilities.formatDate(d, WR_TZ, 'dd-MMM-yyyy') : '(no date)';
    var inMonth = (d instanceof Date && !isNaN(d.getTime()) &&
                   wr_monthKey_(d) === monthKey);
    var amt = wr_num_(row[t.c.amt]);

    hits++; total += amt;
    if (inMonth) thisMonth++;

    if (hits <= 25) {
      L('    ' + P(when, 14) + P(owner, 24) + P(M(amt), 11) +
        (t.c.cust >= 0 ? P(wr_str_(row[t.c.cust]), 22) : '') +
        (inMonth ? '  <- THIS MONTH' : ''));
    }
  }

  if (!hits) {
    L('    nothing. No Lead Owner here contains any of those names, in any month.');
  } else {
    if (hits > 25) L('    ... and ' + (hits - 25) + ' more');
    L('    ' + hits + ' row(s), ' + M(total) + ' in all, ' + thisMonth + ' dated this month.');
  }
  L('');
}


function wrf_newest_(t) {
  var newest = null;
  for (var r = 0; r < t.rows.length; r++) {
    var d = t.rows[r][t.c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (!newest || d.getTime() > newest.getTime()) newest = d;
  }
  return newest ? Utilities.formatDate(newest, WR_TZ, 'dd MMM yyyy') : 'none';
}


/** The import (wantCustomer) or the model, found by columns not by name. */
function wrf_find_(ss, wantCustomer) {
  var tabs = ss.getSheets(), best = null;
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 3) continue;

    var look = sh.getRange(1, 1, Math.min(25, lastRow), lastCol).getValues();
    for (var hr = 0; hr < look.length; hr++) {
      var H = wr_headers_(look[hr]);
      var c = {
        date:  wr_col_(H, ['date', 'payment date', 'paid on']),
        agent: wr_col_(H, ['lead owner', 'agent', 'owner']),
        amt:   wr_col_(H, ['amount paid', 'amount', 'amount inr']),
        cust:  (H['name'] !== undefined) ? H['name'] : -1
      };
      if (c.date < 0 || c.agent < 0 || c.amt < 0) continue;

      var hasCust = (H['payment email id'] !== undefined) ||
                    (H['payment email'] !== undefined) ||
                    (H['name'] !== undefined);
      if (hasCust !== !!wantCustomer) continue;

      var n = lastRow - (hr + 1);
      if (n < 1) continue;
      if (best && best.rows.length >= n) continue;
      best = { name: sh.getName(), c: c,
               rows: sh.getRange(hr + 2, 1, n, lastCol).getValues() };
      break;
    }
  }
  return best;
}
