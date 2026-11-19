/* ================================================================
   EXEC WEB APP  -  serves the Executive Command Center,
                    and routes the Sales War Room feed.

   HOW IT WORKS
   doGet() reads the JSON that buildExecSnapshot() has already written
   to the hidden exec_Snapshot tab, drops it straight into the page, and
   serves it. There is no round trip after load and no query against the
   spreadsheet while the page is open - which is why it opens instantly
   on a phone in a boardroom regardless of how big the workbook gets.

   IT ALSO CARRIES THE WAR ROOM FEED
   Apps Script allows exactly ONE doGet per project, and this is it. So
   the WarRoom file does not define one - it exposes wr_serve_() instead,
   and the two lines at the top of doGet() below hand the request over
   when the caller asks for feed=warroom. Everything else is served as
   the Executive Command Center, exactly as before.

   Two consequences worth knowing:
     - If doGet() is ever rewritten, those two lines have to survive, or
       the TVs go back to preview data.
     - The guard is "typeof wr_serve_ === 'function'", so this file is
       safe to install before the WarRoom file exists. It falls through
       to the exec page rather than throwing.

   ACCESS
   Deploy with "Execute as: Me" and "Who has access: Anyone".
   "Anyone" is required, not preferred: a wall-mounted TV is not signed
   into Google, and "Anyone with Google account" serves it a sign-in
   page instead of data, permanently.

   What that costs: the exec page loses its "must be signed in" step.
   That step was never domain-restricted, so it already admitted anyone
   with a Google account AND the URL - the real protection was always
   the unguessable URL, and that has not changed. Treat the URL as a
   password. Viewers still need no access to the workbook itself: they
   see the numbers, never the sheets, and cannot edit anything.

   The war room feed returns aggregated leaderboard figures only. No
   leads, no phone numbers, no payment rows, no email addresses.

   TO DEPLOY
   Deploy > Manage deployments > pencil on the live deployment >
   Version: New version > Who has access: Anyone > Deploy.
   Edit the EXISTING deployment rather than making a new one, so the URL
   people have bookmarked keeps working. Without "New version" the URL
   keeps serving the old code - this is the single most common reason a
   change appears to have done nothing.
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

/* Open it from inside the spreadsheet as well, for people who live in
   the workbook and just want the executive view without a URL.

   NOTE: onOpen is one-per-project in the same way doGet is. If another
   file in this project also defines onOpen, Apps Script silently keeps
   one of them and the other menu never appears. Worth a Ctrl+F for
   "function onOpen" across all files if the Executive menu is missing. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Executive')
    .addItem('Open Command Center', 'showExecSidebarDialog')
    .addItem('Rebuild snapshot now', 'buildExecSnapshot')
    .addToUi();
}

function showExecSidebarDialog() {
  var json = execSnapshotJson_();
  if (!json) { buildExecSnapshot(); json = execSnapshotJson_(); }
  var html = exec_inject_(HtmlService.createHtmlOutputFromFile('ExecPage').getContent(), json);
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1500).setHeight(900),
    'Executive Command Center');
}

/* Put the data into the page.

   THREE ROUTES, IN ORDER. The middle one exists because of a real bug:
   the old fallback injected the data before </head> (line 115) while the
   page's own "var SNAP = null;" sits at line 208 - so the browser loaded
   the data and then overwrote it with null a moment later. The page had
   the data all along and threw it away. Replacing the ASSIGNMENT rather
   than adding a second one makes that impossible.

   Replacement is passed as a FUNCTION so that a "$" anywhere in the data
   can never be read as a String.replace directive. */
function exec_inject_(html, json) {
  var payload = json || 'null';
  var token = '/*__SNAPSHOT__*/null';

  if (html.indexOf(token) > -1) {
    Logger.log('inject: placeholder token');
    return html.replace(token, function () { return payload; });
  }

  var re = /var\s+SNAP\s*=[^;]*;/;
  if (re.test(html)) {
    Logger.log('inject: token missing - replaced the whole var SNAP assignment');
    return html.replace(re, function () { return 'var SNAP=' + payload + ';'; });
  }

  Logger.log('inject: no SNAP assignment found at all - injecting into <head>');
  return html.replace('</head>',
    function () { return '<script>var SNAP=' + payload + ';<\/script></head>'; });
}

/* ================================================================
   HOOKING IT INTO THE REFRESH

   Do NOT define refreshAndVerify here. It already exists in the Sync
   file, and two files defining the same function is precisely the trap
   that cost us a day - Apps Script silently keeps one and you cannot
   tell which. Instead, add ONE line to the copy in Sync:

     function refreshAndVerify() {
       refreshEverything();
       try { buildExecSnapshot(); } catch (e) { Logger.log('snapshot: ' + e); }
       verifyEverything();
     }

   The try/catch matters: if the executive layer ever fails, the
   operational workbook must still finish its refresh.

   The war room needs nothing added here. It reads mdl_Payments and
   mdl_Roster live on each request and caches for 45 seconds, so it is
   always as current as the workbook is, with no snapshot step to keep
   in sync and nothing to forget to call.
   ================================================================ */
