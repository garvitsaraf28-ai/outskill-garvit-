/**
 * whatsHere - READ ONLY. Writes nothing, anywhere.
 *
 * WHY
 *
 *   I recovered 33 pasted files from this conversation and audited them.
 *   That snapshot is from 18 SEPTEMBER. Since then files have been deleted
 *   and changed, so every file-level verdict in AUDIT.md is a guess until
 *   checked against the project as it stands today - and acting on a stale
 *   list is how a working function gets deleted.
 *
 *   This asks the project itself. Apps Script cannot list its own files,
 *   but it does not need to: what matters is which functions are LIVE, and
 *   `typeof name === 'function'` answers that exactly, for all 151 names
 *   that have ever appeared in this project.
 *
 * WHAT IT SETTLES THAT NOTHING ELSE CAN
 *
 *   Fault 3 in AUDIT.md is that ~50 files share one scope and the project
 *   relies on later definitions overriding earlier ones - ScheduleAndFormat
 *   redefines MR_COLS and mr_metrics_ from ManagementReport - and which one
 *   wins depends on load order, which is not controllable. Reading the code
 *   cannot tell you which won.
 *
 *   Calling it can. mr_metrics_ returns 11 values in the original and 9 in
 *   the override, so one call says which definition is actually in effect,
 *   and therefore whether Booked / To Come was really removed.
 *
 *   It also lists every tab with its size, and every installed trigger, so
 *   the 20-trigger ceiling and any stale tab are visible in the same log.
 *
 * Run whatsHere and send the log. Nothing is written, nothing is opened
 * outside this workbook.
 */

var WH_PROBE = [
  'addCbcLine', 'addFailedPaymentsToManager', 'addUpgradeRevenue', 'au_monthSplit',
  'au_scanErrors', 'au_triggerList', 'auditEverything', 'buildFunnelSplit',
  'buildLeadReportIndia', 'buildLeadReportIntl', 'buildLeadReportsBoth', 'buildManagementReport',
  'buildPayments_', 'buildRoster_', 'buildSlpMonthPage', 'cbcCheck',
  'cbcGapSelfTest', 'cgReconcileMonth', 'checkAgentJoin', 'checkAutomation',
  'checkBatchJoin', 'checkBatchMatcher', 'checkCbcRevenueColumn', 'checkCbcRevenueValues',
  'checkNameCollisions', 'checkPaymentAmounts', 'checkWorkshopDimension', 'columnLetter',
  'diagnoseSlack', 'diagnoseToDrive', 'doGet', 'dumpForChurn',
  'dumpKeyTabs', 'dumpStageTab', 'findBatchCodeColumns', 'findBatchCodes',
  'findEmailColumns', 'findTheMissing', 'fixEverything', 'fixFailedPayments',
  'fixOnRoster', 'fixPaymentsRange', 'fixRoster', 'formatManagementReport',
  'ftRemoveUnguardedRefresh', 'ftShowTriggerLoad', 'ftTimeTheRebuild', 'funnelSplitSelfTest',
  'insideSales', 'insideSalesSelfTest', 'installAgentLeadSchedule', 'installAllSchedules',
  'installAllSchedulesToDrive', 'installDaySchedule', 'installNightSchedule', 'installSlackTriggers',
  'inventoryToDrive', 'killDuplicateUpgrades', 'listUnmatchedAgents', 'managementReportSelfTest',
  'managementReportUpgradeSelfTest', 'mrFix', 'mrShow', 'mrWhoIsMissing',
  'mr_addUpgrade_', 'mr_display_', 'mr_metrics_', 'mr_payments_',
  'mr_roster_', 'muteSlack', 'onOpen', 'pageNumbers',
  'reconcile', 'reconcileSept', 'refreshAndVerify', 'removeAllSchedules',
  'removeSlackTriggers', 'runAgentLeadSchedule', 'runDaySchedule', 'runLeadIndiaSchedule',
  'runLeadIntlSchedule', 'runNightSchedule', 'runRefreshNow', 'scanColumnsFor',
  'scheduleAndFormatSelfTest', 'showAllSchedules', 'showExecSidebarDialog', 'showReportCode',
  'showReportNow', 'showSrcPayments', 'slackDigest', 'slpLeadReportSelfTest',
  'slpMonthPageSelfTest', 'slpPayloadCheck', 'slpPayloadList', 'slpPayloadSelfTest',
  'syncRosterSources', 'testAgentLeadReport', 'testBothSchedules', 'testLeadReportIndia',
  'testLeadReportIntl', 'testSlack', 'testWebhook', 'traceGap',
  'ucTodo', 'unmuteSlack', 'up_key_', 'updateAndCheck',
  'updateEverythingNow', 'updateEverythingSelfTest', 'updateRevenueNow', 'w3_pay_',
  'w3_roster_', 'warRoomAddUpdateTriggers', 'warRoomAddUpdateTriggersPreview', 'warRoomAgentByAgent',
  'warRoomAutoUpdate', 'warRoomBatches', 'warRoomCapacity', 'warRoomContestCheck',
  'warRoomContestWhatIf', 'warRoomFindAgent', 'warRoomForceSync', 'warRoomGap',
  'warRoomInstallSync', 'warRoomLiveCheck', 'warRoomLostRows', 'warRoomPreview',
  'warRoomRefreshNow', 'warRoomRemoveSync', 'warRoomResetMovement', 'warRoomRevPerMM',
  'warRoomRosterAudit', 'warRoomScheduledUpdate', 'warRoomSelfTest', 'warRoomSrcVsModel',
  'warRoomSyncNow', 'warRoomSyncStatus', 'warRoomThreeWay', 'warRoomVsReport',
  'warRoomWhatCounts', 'warRoomWhereIsTheMoney', 'warRoomWhoIsMissing', 'warRoomWhyStale',
  'whereIsTheMoney', 'whichSlackRoute', 'whyDifferent', 'wr_build_',
  'wr_fillUpgrade_', 'wr_key_', 'wr_roster_'];

/* Globals worth printing by value, not just presence: each one decides
   something downstream. */
var WH_GLOBALS = ['MR_TAB', 'MR_COLS', 'WR_ROSTER_TAB', 'WR_PAY_TAB',
                  'WR_TZ', 'INTERVAL_MINUTES', 'REFRESH_SEQUENCE',
                  'WR_ALIASES', 'WR_MAX_AGENTS', 'WRA_MIN_ROSTER_FRACTION'];


function whatsHere() {
  var L = function (s) { Logger.log(s); };
  var ss = SpreadsheetApp.getActive();

  L('=== WHAT IS ACTUALLY IN THIS PROJECT ===   ' +
    Utilities.formatDate(new Date(), (typeof WR_TZ === 'string' ? WR_TZ : 'Asia/Kolkata'),
                         'dd MMM yyyy HH:mm'));
  L('  Read only. Nothing is written.');
  L('');

  /* ---------- 1. which functions are live ---------- */
  var here = [], gone = [];
  for (var i = 0; i < WH_PROBE.length; i++) {
    var n = WH_PROBE[i], live = false;
    try { live = (eval('typeof ' + n) === 'function'); } catch (e) { live = false; }
    (live ? here : gone).push(n);
  }

  L('  --- 1. FUNCTIONS ---');
  L('  ' + here.length + ' of ' + WH_PROBE.length + ' known names are live in this project.');
  L('');
  L('  LIVE (' + here.length + '):');
  L(wh_wrap_(here, 4));
  L('');
  L('  GONE - deleted since 18 September, or never in this project (' + gone.length + '):');
  L(wh_wrap_(gone, 4));
  L('');

  /* ---------- 2. which definition won ---------- */
  L('  --- 2. WHICH DEFINITION IS IN EFFECT ---');
  if (typeof MR_COLS !== 'undefined' && MR_COLS && MR_COLS.length) {
    L('    MR_COLS has ' + MR_COLS.length + ' columns: ' + MR_COLS.join(', '));
    L('      9 means ScheduleAndFormat won and Booked / To Come IS removed.');
    L('      11 means ManagementReport won and the removal is NOT in effect.');
  } else {
    L('    MR_COLS is not defined - ManagementReport.gs is not in this project.');
  }
  if (typeof mr_metrics_ === 'function') {
    var got = -1;
    try {
      got = mr_metrics_({ n: 1, rev: 100, target: 100, units: 1, mm: 1,
                          booked: 0, toCome: 0 }).length;
    } catch (e) { L('    mr_metrics_ threw: ' + (e && e.message ? e.message : e)); }
    if (got > -1) {
      L('    mr_metrics_ returns ' + got + ' values.');
      if (typeof MR_COLS !== 'undefined' && MR_COLS && got !== MR_COLS.length) {
        L('    *** MISMATCH. MR_COLS says ' + MR_COLS.length + ' and mr_metrics_ gives ' +
          got + '.');
        L('        Two files are fighting and they are out of step. This is');
        L('        exactly fault 3, and it would put values under the wrong');
        L('        headings on the page.');
      } else {
        L('    Consistent with MR_COLS, so the two files agree.');
      }
    }
  } else {
    L('    mr_metrics_ is not defined.');
  }
  L('');

  /* ---------- 3. the two name keys ---------- */
  L('  --- 3. NAME NORMALISATION ---');
  var sample = 'Subham  Sahoo';
  if (typeof wr_key_ === 'function') L('    wr_key_("' + sample + '") = "' + wr_key_(sample) + '"');
  else L('    wr_key_ is not defined.');
  if (typeof up_key_ === 'function') {
    L('    up_key_("' + sample + '") = "' + up_key_(sample) + '"');
    L('    Two normalisations in one project. They must never be used to look');
    L('    one table up with the other - that is what returned a silent zero');
    L('    for the AIGF upgrade.');
  } else {
    L('    up_key_ is gone, so there is one normalisation left. Good.');
  }
  if (typeof WR_ALIASES !== 'undefined' && WR_ALIASES) {
    var ak = [];
    for (var a in WR_ALIASES) ak.push(a + ' -> ' + WR_ALIASES[a]);
    L('    WR_ALIASES holds ' + ak.length + ' entry(ies)' + (ak.length ? ':' : '.'));
    for (i = 0; i < ak.length; i++) L('      ' + ak[i]);
  }
  L('');

  /* ---------- 4. globals ---------- */
  L('  --- 4. SETTINGS ---');
  for (i = 0; i < WH_GLOBALS.length; i++) {
    var g = WH_GLOBALS[i], v;
    try { v = eval('typeof ' + g + ' === "undefined" ? undefined : ' + g); }
    catch (e) { v = undefined; }
    L('    ' + wh_pad_(g, 26) + wh_show_(v));
  }
  L('');

  /* ---------- 5. tabs ---------- */
  L('  --- 5. TABS IN THIS WORKBOOK ---');
  var tabs = ss.getSheets();
  L('    ' + tabs.length + ' tab(s)');
  for (i = 0; i < tabs.length; i++) {
    var sh = tabs[i];
    var r = sh.getLastRow(), c = sh.getLastColumn();
    L('    ' + wh_pad_(sh.getName(), 30) + wh_pad_(r + ' x ' + c, 14) +
      (sh.isSheetHidden() ? 'hidden' : ''));
  }
  L('');

  /* ---------- 6. triggers ---------- */
  L('  --- 6. TRIGGERS ---');
  var tg = [];
  try { tg = ScriptApp.getProjectTriggers(); }
  catch (e) { L('    cannot read triggers: ' + (e && e.message ? e.message : e)); }
  L('    ' + tg.length + ' of a maximum 20.');
  var byFn = {};
  for (i = 0; i < tg.length; i++) {
    var f = tg[i].getHandlerFunction();
    byFn[f] = (byFn[f] || 0) + 1;
  }
  var fns = [];
  for (var k in byFn) fns.push(k + ' x' + byFn[k]);
  fns.sort();
  for (i = 0; i < fns.length; i++) L('    ' + fns[i]);
  if (tg.length >= 20) {
    L('    *** AT THE CEILING. Installing one more throws part way through,');
    L('        which is how a schedule ends up half applied.');
  }
  L('');
  L('  Nothing was written. This only reports.');
}


function wh_wrap_(list, perLine) {
  if (!list.length) return '    (none)';
  var out = [], row = [];
  for (var i = 0; i < list.length; i++) {
    row.push(wh_pad_(list[i], 30));
    if (row.length === perLine) { out.push('    ' + row.join('').replace(/\s+$/, '')); row = []; }
  }
  if (row.length) out.push('    ' + row.join('').replace(/\s+$/, ''));
  return out.join('\n');
}

function wh_show_(v) {
  if (v === undefined) return '(not defined)';
  if (v === null) return 'null';
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return '[' + v.length + '] ' + v.join(', ').substring(0, 120);
  }
  if (typeof v === 'object') {
    var n = 0;
    for (var k in v) n++;
    return '{' + n + ' key(s)}';
  }
  return String(v).substring(0, 120);
}

function wh_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}


/* =====================================================================
   END OF FILE. If the editor does not show this line, the paste was cut
   short - select all, delete, and paste again.
   ===================================================================== */
