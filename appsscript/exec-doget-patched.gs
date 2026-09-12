/* ================================================================
   REPLACE THE doGet IN YOUR EXEC WEB APP FILE WITH THIS ONE.

   Nothing else in that file changes. Do not touch onOpen,
   showExecSidebarDialog or exec_inject_ - they stay exactly as they are.

   WHAT CHANGED
   Two lines at the top. Apps Script allows one doGet per project, and
   this project's doGet belongs to the Executive Command Center. So the
   war room does not define its own - it gets routed to from here.

   A request carrying feed=warroom gets the leaderboard JSON. Every other
   request behaves precisely as it did before, down to the title and the
   XFrameOptions mode. If the WarRoom file is not installed yet, the guard
   below falls through to the exec page rather than throwing, so pasting
   this in early cannot break anything.
   ================================================================ */

function doGet(e) {
  var p = (e && e.parameter) || {};

  /* --- the Sales War Room TV asks for its feed here --- */
  if (p.feed === 'warroom' && typeof wr_serve_ === 'function') {
    return wr_serve_(p);
  }

  /* --- everything below is the Executive Command Center, unchanged --- */
  var json = execSnapshotJson_();
  if (!json) {
    try { buildExecSnapshot(); json = execSnapshotJson_(); } catch (err) { json = null; }
  }
  var html = HtmlService.createHtmlOutputFromFile('ExecPage').getContent();
  html = exec_inject_(html, json);

  return HtmlService.createHtmlOutput(html)
    .setTitle('Executive Command Center')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
