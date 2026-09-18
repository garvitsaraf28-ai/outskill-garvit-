/**
 * Config.gs - every setting in this project, in one file.
 *
 * WHY THIS FILE EXISTS
 *
 *   In the old project the CBC file id was written into four different
 *   files, the timezone into six, and a row bound on mdl_Payments into
 *   five. Changing one meant finding all of them, and the ones that were
 *   missed did not throw - they quietly read the wrong thing. That is how
 *   six months of revenue went missing in August, and how 'IST' sat in six
 *   files silently meaning GMT.
 *
 *   Nothing else in this project hardcodes an id, a tab name, a timezone
 *   or a threshold. If you need to change a setting, it is in here.
 *
 * WHAT TO DO NOW
 *
 *   1. Fill in CFG_PAYMENT_TRACKER_ID below. It is the long string in the
 *      middle of that file's URL:
 *        docs.google.com/spreadsheets/d/<THIS PART>/edit
 *      CFG_CBC_ID is already filled in - carried over from the old project.
 *
 *   2. Project Settings > Time zone > (GMT+05:30) India Standard Time.
 *
 *   3. Run cfgCheck(). It opens both source files, lists what is inside
 *      them, and says PASS or what is missing. It writes nothing, anywhere.
 *
 *   4. Send that log back. It names the tabs inside the Payment Tracker and
 *      CBC, which is what Sources.gs has to be built against - guessing at
 *      them is how the old project ended up with a Batch Family filter that
 *      threw away real sales.
 *
 *   Each file assumes the one before it passed its check.
 */


/* ==================================================================
   1.  THE TWO SOURCE FILES

   This workbook is a READER. It never writes to either of these, and
   no function in this project opens them except to read. That is a
   rule, not a habit - they are the company's files, not ours.
   ================================================================== */

/** The Payment Tracker. FILL THIS IN - nothing runs until you do. */
var CFG_PAYMENT_TRACKER_ID = '';

/** CBC. Carried over from the old project unchanged. */
var CFG_CBC_ID = '1-r5VMZ2u9w7WrcyAgCdgzp4scJiJQONuPiUV6JbRu0s';


/* ==================================================================
   2.  TIME

   One timezone, spelled the way Java recognises it.

   'IST' is a legacy three-letter id. An unresolved zone does not throw -
   it falls back to GMT, silently, and every date shifts five and a half
   hours. A payment at 2am IST then lands on the previous day, which
   moves it into the previous MONTH once a month, on exactly the day
   anyone would be looking.
   ================================================================== */

var CFG_TZ = 'Asia/Kolkata';


/* ==================================================================
   3.  TAB NAMES

   THE ELEVEN VISIBLE PAGES, and nothing else visible. Everything the
   model needs is hidden underneath.

   Change a name here and every file follows. The old project had the
   same tab named as a literal string in eleven places, and an
   AuditEverything that wrote to a tab called 'Audit' the Command Centre
   was already using - so the Command Centre's warning cell showed
   whatever the audit had last put there.
   ================================================================== */

var CFG_PAGES = {
  managementReport: 'Management Report',
  overallReport:    'Overall Report',
  salesMonitoring:  'Sales Monitoring',
  commandCentre:    'Command Centre',
  rhythm:           'Rhythm',
  officeTeam:       'Office & Team',
  manager:          'Manager',
  workshopMonths:   'Workshop Months',
  agent:            'Agent',
  trend:            'Trend',
  funnel:           'Funnel'
};

var CFG_TABS = {
  /* the raw imports - hidden, nobody reads these directly */
  srcPayments:     'src_Payments',
  srcRosterPrefix: 'src_Roster_',      // one per month: src_Roster_Sep etc

  /* the model - hidden. Everything on every page comes from these three. */
  mdlPayments: 'mdl_Payments',
  mdlRoster:   'mdl_Roster',
  mdlBatches:  'mdl_Batches'
};


/* ==================================================================
   4.  THE GUARDS

   The settings that stop a bad build reaching a page. Each exists
   because of a specific incident, named here so nobody loosens one
   without knowing what it cost.
   ================================================================== */

/**
 * Refuse a rebuild that would leave mdl_Payments with less than this
 * fraction of the rows it already has.
 *
 * On the day this was needed, the IMPORTRANGE was re-bound, Google began
 * refetching, the model was built from a half-arrived import, and the
 * writer cleared the tab before writing the partial result. Six months
 * of revenue, gone, with nothing in the log.
 *
 * 0.75 is deliberately generous. A real month never shrinks the model.
 */
var CFG_PAY_MIN_FRACTION = 0.75;

/**
 * How long to wait for src_Payments to settle before building from it.
 *
 * A refetching IMPORTRANGE shows the text "Loading...", not an error, so
 * a guard that only looks for #REF! waves it straight through. This waits
 * for the row count to stop moving AND the Loading text to clear.
 */
var CFG_LOAD_WAIT_SECS = 180;

/**
 * Below this, mdl_Payments is treated as empty rather than small - so a
 * reader reports "nothing to read" instead of throwing on a zero-row
 * getRange(2, 1, lastRow - 1, n).
 */
var CFG_MIN_DATA_ROWS = 2;


/* ==================================================================
   5.  THE LEADERBOARD
   ================================================================== */

var CFG_BOARD = {
  /* The feed caches its answer for this long. A wall of TVs polling every
     30 seconds must not rebuild the model 120 times a minute. The update
     command clears this cache at the end of its run, so the board is
     never stale because of the cache - only ever because the sheet is. */
  cacheSecs: 420,

  maxAgents: 200,      // cap on the agent list sent to the TV
  maxRecent: 40,       // closes kept for the running ticker

  /* Batches that earn REVENUE but are not a UNIT. A workshop batch is
     Bootcamp being sold, not an Accelerator unit, so the money counts and
     the unit does not. Matched as a PREFIX, so 'CL WS' covers CL WS IND
     and CL WS INTL together and catches nothing else by accident. */
  unitExclude: ['CL WS'],

  /* Names spelled differently in CBC and the Payment Tracker. Each entry
     is one pair a person has CONFIRMED, written as
       'how payments spell it' : 'how the roster spells it'
     and nothing is matched that is not listed here. Deliberately not
     fuzzy: a guess that silently merges two real people is worse than a
     name that visibly fails to match. */
  aliases: {
    'baishali bhattacharjee': 'Baishali Bhattercharjee'
  }
};


/* ==================================================================
   6.  CHECK IT - read only, run this now
   ================================================================== */

function cfgCheck() {
  Logger.log('=== CONFIG CHECK ===');
  Logger.log('  This reads. It writes nothing, to any file, anywhere.');
  Logger.log('');

  var ok = true;

  /* ---- this project's own timezone ---- */
  var tz = '';
  try { tz = Session.getScriptTimeZone(); } catch (e) { tz = '(could not read)'; }
  Logger.log('  script timezone : ' + tz);
  if (tz !== CFG_TZ) {
    ok = false;
    Logger.log('    *** does not match CFG_TZ (' + CFG_TZ + ').');
    Logger.log('        Project Settings > Time zone > (GMT+05:30) India Standard Time.');
    Logger.log('        Left wrong, a payment near midnight lands on the wrong day,');
    Logger.log('        and once a month that is the wrong MONTH.');
  } else {
    Logger.log('    matches CFG_TZ   OK');
  }
  Logger.log('');

  /* ---- the two source files ---- */
  ok = cfg_probe_('PAYMENT TRACKER', CFG_PAYMENT_TRACKER_ID,
                  'CFG_PAYMENT_TRACKER_ID') && ok;
  Logger.log('');
  ok = cfg_probe_('CBC', CFG_CBC_ID, 'CFG_CBC_ID') && ok;

  /* ---- this workbook ---- */
  Logger.log('');
  Logger.log('  THIS WORKBOOK');
  try {
    var here = SpreadsheetApp.getActive();
    if (!here) {
      ok = false;
      Logger.log('    *** this script is not bound to a spreadsheet.');
      Logger.log('        It has to be created from Extensions > Apps Script INSIDE');
      Logger.log('        the new sheet, not as a standalone project.');
    } else {
      Logger.log('    name : ' + here.getName());
      Logger.log('    tabs : ' + here.getSheets().length +
                 '   (they get created as we go - nothing to do yet)');
    }
  } catch (e) {
    ok = false;
    Logger.log('    *** could not read it: ' + e.message);
  }

  Logger.log('');
  if (ok) {
    Logger.log('  PASS. Both source files open and the timezone is right.');
    Logger.log('');
    Logger.log('  SEND THIS LOG BACK. The tab names and row counts above are what');
    Logger.log('  Sources.gs has to be built against. The old project guessed at a');
    Logger.log('  column once - "Batch Family" looked like the product and was');
    Logger.log('  actually the lead source - and it threw away two real sales.');
  } else {
    Logger.log('  NOT READY. Fix the lines marked *** above, then run this again.');
  }
  return ok;
}


/** Open one source file and report what is inside it. Never writes. */
function cfg_probe_(label, id, constName) {
  Logger.log('  ' + label);

  if (!String(id == null ? '' : id).trim()) {
    Logger.log('    *** EMPTY. Set ' + constName + ' at the top of this file.');
    Logger.log('        The id is the long part of the URL between /d/ and /edit:');
    Logger.log('        docs.google.com/spreadsheets/d/THIS_PART/edit');
    return false;
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (e) {
    Logger.log('    *** CANNOT OPEN IT.');
    Logger.log('        ' + (e && e.message ? e.message : e));
    Logger.log('        Either the id is wrong, or this Google account cannot see');
    Logger.log('        the file. Open it yourself and copy the id out of the URL.');
    return false;
  }

  Logger.log('    name : ' + ss.getName());

  var sheets;
  try { sheets = ss.getSheets(); }
  catch (e2) {
    Logger.log('    *** opened, but could not list its tabs: ' + e2.message);
    return false;
  }

  Logger.log('    tabs : ' + sheets.length);
  for (var i = 0; i < sheets.length && i < 40; i++) {
    var sh = sheets[i];
    var rows = 0, cols = 0;
    try { rows = sh.getLastRow(); cols = sh.getLastColumn(); } catch (e3) {}
    Logger.log('        ' + cfg_pad_(sh.getName(), 28) +
               cfg_pad_(rows + ' rows', 12) + cols + ' cols' +
               (sh.isSheetHidden() ? '   (hidden)' : ''));
  }
  if (sheets.length > 40) {
    Logger.log('        ... and ' + (sheets.length - 40) + ' more');
  }
  return true;
}


function cfg_pad_(s, n) {
  s = String(s == null ? '' : s);
  while (s.length < n) s += ' ';
  return s;
}
