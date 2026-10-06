/**
 * fixEverything - one button. Rebuilds everything, then says what is left.
 *
 * WHY THIS EXISTS
 *
 *   Getting the sheet and the TV current means running updateAndCheck,
 *   then rebuilding the Management Report, then clearing the board's
 *   cache, in that order, and then knowing how to read three numbers
 *   against each other to tell whether anything is still wrong. That is
 *   too much to remember and too easy to do in the wrong order.
 *
 *   This does all of it and then answers the only question that matters:
 *   CBC says one thing and my screens say another - whose fault is it?
 *
 * WHAT IT DOES, IN ORDER
 *
 *   1. updateAndCheck        rebuild the model from the import
 *   2. buildManagementReport rebuild the sheet's pages
 *   3. warRoomRefreshNow     drop the board's cache so the TV catches up
 *   4. the verdict           CBC vs the Payment Tracker vs the model,
 *                            per agent, with a reason for every difference
 *
 * HOW TO READ THE VERDICT
 *
 *   BUILD FAULT      the tracker has the money, the model does not. Mine
 *                    to fix - send me the log.
 *   NO PAYMENT ROW   CBC has it, the Payment Tracker does not. Nothing
 *                    here can produce it. Either the payment has not been
 *                    logged, or CBC was filled in ahead of the money
 *                    arriving. Not a bug.
 *
 *   If every line says NO PAYMENT ROW, the sheet and the board are right
 *   and the difference is a data-entry gap, not a fault.
 *
 * Safe to run any time. It writes only what updateAndCheck and
 * buildManagementReport already write, and never touches CBC or the
 * Payment Tracker.
 */
function fixEverything() {
  var t0 = new Date();
  Logger.log('=== FIX EVERYTHING ===   ' +
             Utilities.formatDate(t0, WR_TZ, 'dd MMM HH:mm'));
  Logger.log('');

  /* ---- 1. the model ---- */
  Logger.log('1/4  rebuilding the model from the import...');
  if (typeof updateAndCheck === 'function') {
    try { updateAndCheck(); Logger.log('     done.'); }
    catch (e) { Logger.log('     *** updateAndCheck failed: ' + e.message); }
  } else {
    Logger.log('     *** no updateAndCheck in this project. Nothing rebuilt.');
  }
  Logger.log('');

  /* ---- 2. the pages ---- */
  Logger.log('2/4  rebuilding the Management Report...');
  if (typeof buildManagementReport === 'function') {
    try { buildManagementReport(); Logger.log('     done.'); }
    catch (e2) { Logger.log('     *** buildManagementReport failed: ' + e2.message); }
  } else {
    Logger.log('     (not in this project - skipped)');
  }
  Logger.log('');

  /* ---- 3. the TV ---- */
  Logger.log('3/4  clearing the board cache...');
  if (typeof warRoomRefreshNow === 'function') {
    try { warRoomRefreshNow(); }
    catch (e3) { Logger.log('     *** refresh failed: ' + e3.message); }
  }
  Logger.log('');

  /* ---- 4. what is left ---- */
  Logger.log('4/4  checking CBC against the tracker and the model');
  Logger.log('');
  fx_verdict_();

  Logger.log('');
  Logger.log('finished in ' + Math.round((new Date() - t0) / 1000) + 's');
}


function fx_verdict_() {
  var ss = SpreadsheetApp.getActive();
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');
  var L = function (s) { Logger.log(s); };
  var P = wr_pad_, M = wr_money_;

  var cbc = (typeof w3_roster_ === 'function') ? w3_roster_(ss, monthKey) : null;
  var src = (typeof w3_pay_ === 'function') ? w3_pay_(ss, true) : null;
  var mdl = (typeof w3_pay_ === 'function') ? w3_pay_(ss, false) : null;
  if (!cbc || !src || !mdl) {
    L('  Cannot compare - the three-way file is not in this project.');
    L('  Paste war-room-threeway.gs and run this again.');
    return;
  }

  var A = w3_tally_(src, monthKey), B = w3_tally_(mdl, monthKey);

  var rows = [], k, tc = 0, ta = 0, tb = 0;
  for (k in cbc.by) {
    var c = cbc.by[k];
    var a = (A[k] || { rev: 0 }).rev, b = (B[k] || { rev: 0 }).rev;
    tc += c.rev; ta += a; tb += b;
    if (Math.abs(c.rev - a) < 1 && Math.abs(a - b) < 1) continue;
    rows.push({ name: c.name, cbc: c.rev, src: a, mdl: b });
  }
  rows.sort(function (x, y) { return Math.abs(y.cbc - y.mdl) - Math.abs(x.cbc - x.mdl); });

  L('  ' + P('AGENT', 26) + P('CBC', 11) + P('TRACKER', 11) + P('MODEL', 11) + 'VERDICT');
  L('');

  var faults = 0, faultRev = 0, noRow = 0, noRowRev = 0;
  for (var i = 0; i < rows.length; i++) {
    var e = rows[i], v;
    if (Math.abs(e.src - e.mdl) >= 1) {
      v = 'BUILD FAULT - send me this line'; faults++; faultRev += (e.src - e.mdl);
    } else if (e.cbc > e.src) {
      v = 'NO PAYMENT ROW - CBC only';       noRow++;  noRowRev += (e.cbc - e.src);
    } else {
      v = 'tracker ahead of CBC';
    }
    L('  ' + P(e.name, 26) + P(M(e.cbc), 11) + P(M(e.src), 11) + P(M(e.mdl), 11) + v);
  }
  if (!rows.length) L('  Every agent agrees across all three. Nothing outstanding.');

  L('');
  L('  ' + P('CBC says', 24) + M(tc));
  L('  ' + P('Payment Tracker has', 24) + M(ta));
  L('  ' + P('your screens show', 24) + M(tb));
  L('');

  if (faults) {
    L('  *** ' + faults + ' BUILD FAULT(S), ' + M(faultRev) + '. The tracker has this');
    L('      money and the model does not. That is a real bug - send me the log.');
  }
  if (noRow) {
    L('  ' + noRow + ' agent(s), ' + M(noRowRev) + ', are in CBC with no payment row');
    L('  behind them. Nothing here can produce those - either the payment is not');
    L('  logged in the Payment Tracker yet, or CBC was filled in before the money');
    L('  arrived. Your sheet and board are right to leave them out.');
  }
  if (!faults && !noRow) {
    L('  Nothing is being lost. Any difference left is CBC counting something');
    L('  that is not agent revenue.');
  }
}
