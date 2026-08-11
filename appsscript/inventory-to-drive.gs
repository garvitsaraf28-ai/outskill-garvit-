/**
 * Project inventory, written to Drive.
 *
 * Answers two questions that cannot be settled from outside the script:
 * which refresh function is the real one, and which tabs are going stale.
 *
 * Run inventoryToDrive(). It writes project_inventory.txt to the SuperLeap
 * Feed folder, listing every top-level function in the project and every tab
 * in the sheet alongside whatever freshness stamp that tab carries. Comparing
 * those stamps against each other is what exposes a page that some refresh
 * path is quietly skipping.
 *
 * Read-only. It calls nothing and changes nothing.
 */

var INVENTORY_FILENAME = 'project_inventory.txt';

/** Rows scanned per tab when hunting for a freshness stamp. */
var STAMP_SCAN_ROWS = 40;

function inventoryToDrive() {
  var out = [];
  var stamp;
  try {
    stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm:ss');
  } catch (e) {
    stamp = new Date().toISOString();
  }

  out.push('PROJECT INVENTORY');
  out.push('Generated ' + stamp);
  out.push('');

  listFunctions_(out);
  out.push('');
  listTriggers_(out);
  out.push('');
  listTabs_(out);

  var text = out.join('\n');
  Logger.log(text);
  var where = writeInventory_(text);
  Logger.log('');
  Logger.log('Inventory written to: %s', where);
  return where;
}

/* ------------------------------------------------------------------ */

/**
 * Every top-level function in the project.
 *
 * Functions this repo added are marked so they can be told apart from the
 * ones that were already here — the pre-existing ones are the interesting
 * set when working out which refresh entry point is real.
 */
function listFunctions_(out) {
  out.push('FUNCTIONS');
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    var mine = {
      testSlack: 1, slackDigest: 1, diagnoseSlack: 1, installSlackTriggers: 1,
      removeSlackTriggers: 1, diagnoseToDrive: 1, inventoryToDrive: 1,
      runDaySchedule: 1, runNightSchedule: 1, installAllSchedules: 1,
      installDaySchedule: 1, installNightSchedule: 1, removeAllSchedules: 1,
      showAllSchedules: 1, testBothSchedules: 1, whichSlackRoute: 1
    };

    var names = Object.getOwnPropertyNames(g)
      .filter(function (n) {
        if (n.slice(-1) === '_') return false; // private helpers
        try {
          return typeof g[n] === 'function';
        } catch (e) {
          return false;
        }
      })
      .sort();

    var existing = names.filter(function (n) { return !mine[n]; });
    var added = names.filter(function (n) { return mine[n]; });

    out.push('  Already in the project (' + existing.length + '):');
    existing.forEach(function (n) { out.push('    ' + n); });
    out.push('');
    out.push('  Added by the Slack/schedule work (' + added.length + '):');
    added.forEach(function (n) { out.push('    ' + n); });
  } catch (err) {
    out.push('  ERROR — ' + err.message);
  }
}

function listTriggers_(out) {
  out.push('TRIGGERS');
  try {
    var ts = ScriptApp.getProjectTriggers();
    if (!ts.length) {
      out.push('  none');
      return;
    }
    var counts = {};
    ts.forEach(function (t) {
      var h = t.getHandlerFunction();
      counts[h] = (counts[h] || 0) + 1;
    });
    Object.keys(counts).sort().forEach(function (h) {
      out.push('  ' + h + ' x' + counts[h]);
    });
  } catch (err) {
    out.push('  ERROR — ' + err.message);
  }
}

/**
 * Every tab, with its size and any freshness stamp it carries.
 *
 * The stamp is what matters. A tab whose stamp trails the others is one
 * that some refresh path is not rebuilding.
 */
function listTabs_(out) {
  out.push('TABS');
  try {
    var ss = SpreadsheetApp.getActive();
    if (!ss) {
      out.push('  ERROR — not bound to a spreadsheet');
      return;
    }
    out.push('  ' + ss.getName());
    out.push('');

    ss.getSheets().forEach(function (sh) {
      var rows = sh.getLastRow();
      var cols = sh.getLastColumn();
      out.push('  ' + sh.getName() + '   (' + rows + ' rows x ' + cols + ' cols)');
      var found = findStamp_(sh, rows, cols);
      out.push('      stamp: ' + (found || '(none found)'));
    });
  } catch (err) {
    out.push('  ERROR — ' + err.message);
  }
}

/** Scan the top of a tab for a cell that reads like a freshness stamp. */
function findStamp_(sheet, lastRow, lastCol) {
  if (!lastRow || !lastCol) return null;
  var rows = Math.min(lastRow, STAMP_SCAN_ROWS);
  var cols = Math.min(lastCol, 20);
  var values;
  try {
    values = sheet.getRange(1, 1, rows, cols).getDisplayValues();
  } catch (e) {
    return 'ERROR — ' + e.message;
  }

  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var cell = String(values[r][c]).trim();
      if (!cell) continue;
      if (!/last updated|last refresh|as of|generated|refreshed/i.test(cell)) continue;

      var inline = cell.split(':').slice(1).join(':').trim();
      if (inline) return cell;

      for (var k = c + 1; k < values[r].length; k++) {
        var right = String(values[r][k]).trim();
        if (right) return cell + ' ' + right;
      }
      return cell;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */

function writeInventory_(text) {
  var folder = null;
  try {
    folder = DriveApp.getFolderById(DIAG_FOLDER_ID);
  } catch (err) {
    Logger.log('Could not open folder %s (%s), falling back to My Drive.',
      DIAG_FOLDER_ID, err.message);
  }

  if (folder) {
    var old = folder.getFilesByName(INVENTORY_FILENAME);
    while (old.hasNext()) old.next().setTrashed(true);
    return folder.createFile(INVENTORY_FILENAME, text, MimeType.PLAIN_TEXT).getUrl();
  }

  var stale = DriveApp.getFilesByName(INVENTORY_FILENAME);
  while (stale.hasNext()) stale.next().setTrashed(true);
  return DriveApp.createFile(INVENTORY_FILENAME, text, MimeType.PLAIN_TEXT).getUrl();
}
