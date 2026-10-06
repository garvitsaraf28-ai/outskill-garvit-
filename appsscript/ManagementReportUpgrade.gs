/**
 * ManagementReportUpgrade.gs - AIGF Upgrade / Catalyst as revenue.
 *
 * WHY A SEPARATE FILE
 *
 *   ManagementReport.gs is long and correct, and re-typing it to change
 *   two numbers is how a transcription error gets introduced into a board
 *   pack. Every file in an Apps Script project shares one global scope, so
 *   this lives beside it and ManagementReport.gs needs exactly ONE line
 *   added. Nothing else in that file changes.
 *
 * WHAT IT DOES
 *
 *   CBC's headline has always included AIGF Upgrade / Catalyst and the
 *   report never did, so the two disagreed by exactly that amount -
 *   1,61,500 in October, all of it on one agent. Confirmed as revenue on
 *   6 Oct 2026.
 *
 *   The figure lives per agent in mdl_Roster, not in mdl_Payments, because
 *   it is an existing learner moving up rather than a payment row. So it
 *   cannot arrive through mr_payments_ and has to be folded in afterwards.
 *
 * WHERE TO PUT THE ONE LINE
 *
 *   In ManagementReport.gs, inside buildManagementReport, find:
 *
 *       var managers = mr_managers_(ros, pay);
 *       var offices = mr_offices_(ros, pay);
 *
 *   and add directly underneath:
 *
 *       mr_addUpgrade_(ss, win, pay, managers, offices);
 *
 *   It must sit BEFORE mr_write_, so the written page and the totals
 *   agree, and before the block-consistency check at the end of
 *   buildManagementReport, which then verifies this work for free: if an
 *   upgrade row has a blank Manager or Office the blocks will not add up
 *   and that check says so.
 *
 * WHAT IS DELIBERATELY NOT CHANGED
 *
 *   Units. A unit is a sale closed; this is an upsell on a sale already
 *   counted. October stays at 27 units.
 *
 *   Booked and To Come. Those measure deals closed this month out of
 *   mdl_Payments and an upgrade is not one.
 *
 *   Average ticket moves, because the page computes it as Revenue over
 *   Units and a reader doing that division by hand must get the printed
 *   answer. Consistency on the page beats precision in the metric: a
 *   figure that fails its own arithmetic is the exact fault this month was
 *   spent chasing.
 */


/**
 * Fold AIGF Upgrade / Catalyst into revenue, at every level the page
 * prints. Returns the amount added for the current month.
 *
 * Mutates pay.now.rev, pay.prior.rev and the rev on each manager and
 * office, which is on purpose: those are what mr_write_ prints, and
 * adding the figure only to the headline would leave the blocks summing
 * to less than the total above them.
 */
function mr_addUpgrade_(ss, win, pay, managers, offices) {
  var sh = ss.getSheetByName('mdl_Roster');
  if (!sh || sh.getLastRow() < 2) return 0;

  var grid = mr_grid_(sh);
  var iUp = mr_findCol_(grid[0], ['aigf upgrade/catalyst', 'aigf upgrade',
                                  'upgrade', 'catalyst', 'aigf']);
  if (iUp < 0) {
    Logger.log('  !! mdl_Roster has no AIGF Upgrade / Catalyst column.');
    Logger.log('     Upgrade revenue is not being counted, so this report will');
    Logger.log('     read lower than CBC by whatever that column holds.');
    return 0;
  }

  var iMonth = mr_findCol_(grid[0], ['month']);
  var iMgr   = mr_findCol_(grid[0], ['manager', 'reporting manager']);
  var iOff   = mr_findCol_(grid[0], ['office', 'city', 'location']);
  var iAg    = mr_findCol_(grid[0], ['agent', 'agent name']);
  if (iMonth < 0) { Logger.log('  !! mdl_Roster has no Month column.'); return 0; }

  var priorKey = mr_monthKeyOf_(win.priorStart);
  var byMgr = {}, byOff = {}, nowTotal = 0, priorTotal = 0, nowRows = 0;

  for (var r = 1; r < grid.length; r++) {
    var row = grid[r];

    /* The same guard mr_roster_ uses, so a totals row carrying a figure
       cannot be counted as an agent's upgrade. */
    var mg = iMgr >= 0 ? String(row[iMgr]).trim() : '';
    var ag = iAg  >= 0 ? String(row[iAg]).trim()  : '';
    if (!mg || mr_isNumeric_(mg) || mr_isNumeric_(ag)) continue;

    var amt = mr_number_(row[iUp]);
    if (!amt) continue;

    var mk = mr_monthKeyOf_(row[iMonth]);

    /* The prior month is counted too, or "MTD Oct V/s Sep" compares a
       figure that includes upgrades against one that does not, and the
       whole comparison tilts by the difference. */
    if (mk === priorKey) { priorTotal += amt; continue; }
    if (mk !== win.monthKey) continue;

    nowTotal += amt; nowRows++;
    byMgr[mg] = (byMgr[mg] || 0) + amt;
    var of = iOff >= 0 ? String(row[iOff]).trim() : '';
    if (of) byOff[of] = (byOff[of] || 0) + amt;
  }

  if (!nowTotal && !priorTotal) {
    Logger.log('  upgrade : none this month or last.');
    return 0;
  }

  managers.forEach(function (m) {
    if (byMgr[m.manager]) m.rev += byMgr[m.manager];
  });
  offices.forEach(function (o) {
    if (byOff[o.office]) o.rev += byOff[o.office];
  });
  pay.now.rev   += nowTotal;
  pay.prior.rev += priorTotal;

  Logger.log('  upgrade : ' + mr_commas_(nowTotal) + ' counted as revenue across ' +
             nowRows + ' agent(s)   (prior window ' + mr_commas_(priorTotal) + ')');

  /* Named, because one agent carrying a six-figure upgrade is worth
     seeing rather than inferring from a total that moved. */
  var names = [];
  for (var k in byMgr) names.push(k + ' ' + mr_commas_(byMgr[k]));
  if (names.length) Logger.log('            by manager: ' + names.join(',  '));

  return nowTotal;
}


/**
 * Find a column by header, exact match first, then substring.
 *
 * ManagementReport.gs indexes columns by their exact trimmed header, which
 * is right for the ones it requires and too strict for an optional column
 * nobody has agreed the spelling of - "AIGF Upgrade/Catalyst", "AIGF
 * Upgrade / Catalyst" and "Upgrade" are all the same column to a person.
 */
function mr_findCol_(headerRow, names) {
  var H = {};
  for (var c = 0; c < headerRow.length; c++) {
    var k = String(headerRow[c] == null ? '' : headerRow[c]).trim().toLowerCase();
    if (k && H[k] === undefined) H[k] = c;
  }
  var i, key;
  for (i = 0; i < names.length; i++) if (H[names[i]] !== undefined) return H[names[i]];
  for (i = 0; i < names.length; i++) {
    for (key in H) if (key.indexOf(names[i]) > -1) return H[key];
  }
  return -1;
}


/**
 * Prove the arithmetic without a sheet, the way managementReportSelfTest
 * does. Run it after pasting.
 */
function managementReportUpgradeSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  /* the header lookup */
  var head = ['Month', 'Agent', 'Manager', 'Office', 'Team', 'Target',
              'Man Month', 'AIGF Upgrade/Catalyst'];
  eq('finds the exact header', mr_findCol_(head, ['aigf upgrade/catalyst']), 7);
  eq('finds it by a looser name', mr_findCol_(head, ['upgrade']), 7);
  eq('finds Month', mr_findCol_(head, ['month']), 0);
  eq('says so when absent', mr_findCol_(head, ['nothing like this']), -1);
  eq('prefers an exact match over a substring',
     mr_findCol_(['Agent Name', 'Agent'], ['agent']), 1);

  /* the fold itself, against a stub sheet */
  var grid = [head,
    ['2026-10', 'Subham Sahoo', 'Vaibhav Tiwari', 'Bhubaneswar', 'India', 1000000, 1, 161500],
    ['2026-10', 'Kshitij',      'Deepika M',      'Bangalore',   'Intl',  1200000, 1, 0],
    ['2026-09', 'Subham Sahoo', 'Vaibhav Tiwari', 'Bhubaneswar', 'India', 1000000, 1, 50000],
    ['2026-10', '',             '',               '',            '',      0,       0, 999999]
  ];
  var ss = { getSheetByName: function () {
    return { getLastRow: function () { return grid.length; },
             getLastColumn: function () { return head.length; },
             getRange: function () { return { getValues: function () { return grid; } }; } };
  }};
  var win = { monthKey: '2026-10', priorStart: new Date(2026, 8, 1) };
  var pay = { now: { rev: 2341196 }, prior: { rev: 3429000 } };
  var managers = [{ manager: 'Vaibhav Tiwari', rev: 620000 },
                  { manager: 'Deepika M',      rev: 1146000 }];
  var offices  = [{ office: 'Bhubaneswar', rev: 639000 },
                  { office: 'Bangalore',   rev: 1333000 }];

  var added = mr_addUpgrade_(ss, win, pay, managers, offices);

  eq('adds this month only', added, 161500);
  eq('the headline moves by it', pay.now.rev, 2341196 + 161500);
  eq('the prior window moves by its own', pay.prior.rev, 3429000 + 50000);
  eq('the right manager gets it', managers[0].rev, 620000 + 161500);
  eq('and nobody else does', managers[1].rev, 1146000);
  eq('the right office gets it', offices[0].rev, 639000 + 161500);
  eq('and nobody else does', offices[1].rev, 1333000);
  eq('a row with no manager is ignored, not counted', added, 161500);

  if (fails.length) {
    Logger.log('UPGRADE SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('UPGRADE SELF TEST PASSED');
    Logger.log('  161500 added to this month, 50000 to the prior window,');
    Logger.log('  and only to Vaibhav Tiwari and Bhubaneswar.');
  }
  return fails;
}
