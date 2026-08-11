/**
 * Slack delivery diagnostic that writes its findings to Drive.
 *
 * Run diagnoseToDrive(), then say so. The report lands in the SuperLeap Feed
 * folder as slack_diagnostic.txt and can be read from outside the script
 * project, so the execution log does not have to be copied by hand.
 *
 * Every probe is wrapped individually. One failing check records its own
 * error and the rest still run, because the useful signal is usually the
 * combination — a valid address plus zero remaining quota says something
 * quite different from a valid address plus a full quota.
 */

/** SuperLeap Feed. Falls back to My Drive if this is not reachable. */
var DIAG_FOLDER_ID = '1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq';
var DIAG_FILENAME = 'slack_diagnostic.txt';

function diagnoseToDrive() {
  var out = [];
  var stamp;

  try {
    stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm:ss');
  } catch (e) {
    stamp = new Date().toISOString();
  }

  out.push('SLACK DELIVERY DIAGNOSTIC');
  out.push('Generated ' + stamp);
  out.push('');

  /* --- environment ------------------------------------------------ */
  out.push('ENVIRONMENT');
  probe_(out, 'script time zone', function () {
    return Session.getScriptTimeZone();
  });
  probe_(out, 'effective user', function () {
    return Session.getEffectiveUser().getEmail() || '(empty)';
  });
  probe_(out, 'bound spreadsheet', function () {
    var ss = SpreadsheetApp.getActive();
    if (!ss) return 'NOT BOUND — this is a standalone script, not bound to a sheet';
    return ss.getName();
  });
  out.push('');

  /* --- the address ------------------------------------------------ */
  out.push('ADDRESS');
  var clean = '';
  probe_(out, 'property exists', function () {
    var raw = PropertiesService.getScriptProperties().getProperty(SLACK_PROP_KEY);
    return raw === null ? 'NO — SLACK_CHANNEL_EMAIL is not set' : 'yes';
  });
  probe_(out, 'stored value', function () {
    var raw = PropertiesService.getScriptProperties().getProperty(SLACK_PROP_KEY);
    return '[' + String(raw) + ']';
  });
  probe_(out, 'after cleanup', function () {
    var raw = PropertiesService.getScriptProperties().getProperty(SLACK_PROP_KEY);
    clean = normalizeAddress_(raw);
    return '[' + clean + ']';
  });
  probe_(out, 'character codes', function () {
    return clean
      .split('')
      .map(function (ch) {
        var c = ch.charCodeAt(0);
        return c > 126 || c < 32
          ? ch + '=U+' + ('000' + c.toString(16).toUpperCase()).slice(-4) + '(BAD)'
          : ch;
      })
      .join('');
  });
  probe_(out, 'usable', function () {
    var problem = addressProblem_(clean);
    return problem ? 'NO — ' + problem : 'yes';
  });
  probe_(out, 'domain', function () {
    var at = clean.lastIndexOf('@');
    return at === -1 ? '(none)' : clean.slice(at + 1);
  });
  out.push('');

  /* --- mail capability -------------------------------------------- */
  out.push('MAIL');
  probe_(out, 'remaining quota', function () {
    var q = MailApp.getRemainingDailyQuota();
    return q + (q === 0 ? '   <-- ZERO, nothing can send today' : '');
  });
  out.push('');

  /* --- triggers ---------------------------------------------------- */
  out.push('TRIGGERS');
  probe_(out, 'installed', function () {
    var ts = ScriptApp.getProjectTriggers();
    if (!ts.length) return 'none';
    var counts = {};
    ts.forEach(function (t) {
      var h = t.getHandlerFunction();
      counts[h] = (counts[h] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (h) {
        return h + ' x' + counts[h];
      })
      .join(', ');
  });
  out.push('');

  /* --- the two sends ----------------------------------------------- */
  out.push('SEND TEST');
  out.push('  Two identical probes go out. Compare where they land:');
  out.push('    channel arrives, inbox arrives  -> delivery works, look elsewhere');
  out.push('    inbox arrives, channel does not -> Google is fine, Slack side is at fault');
  out.push('    neither arrives                 -> Google side, see quota and errors above');
  out.push('');

  var probeStamp = stamp;
  var body = 'Slack delivery probe generated at ' + probeStamp + '.';

  probe_(out, 'send to channel', function () {
    if (!isEmailShaped_(clean)) return 'SKIPPED — address is malformed';
    MailApp.sendEmail({ to: clean, subject: 'Slack probe ' + probeStamp, body: body });
    return 'sent without error to ' + clean;
  });

  probe_(out, 'send to self', function () {
    var me = Session.getEffectiveUser().getEmail();
    if (!me) return 'SKIPPED — could not resolve own address';
    MailApp.sendEmail({ to: me, subject: 'Slack probe, copy to self ' + probeStamp, body: body });
    return 'sent without error to ' + me;
  });

  out.push('');
  out.push('Wait two minutes, then check the channel and your inbox.');
  out.push('A bounce, if there is one, arrives in the sending account.');

  /* --- write it out ------------------------------------------------ */
  var text = out.join('\n');
  Logger.log(text);

  var where = writeReport_(text);
  Logger.log('');
  Logger.log('Report written to: %s', where);
  return where;
}

/** Run one check, recording its result or its error. Never throws. */
function probe_(out, label, fn) {
  var value;
  try {
    value = fn();
  } catch (err) {
    value = 'ERROR — ' + (err && err.message ? err.message : String(err));
  }
  out.push('  ' + label + ': ' + value);
}

/**
 * Write the report to the shared folder so it can be read from outside.
 * Falls back to My Drive if that folder is not reachable, since a report
 * saved somewhere is far more useful than one that failed to save.
 */
function writeReport_(text) {
  var folder = null;
  try {
    folder = DriveApp.getFolderById(DIAG_FOLDER_ID);
  } catch (err) {
    Logger.log('Could not open folder %s (%s), falling back to My Drive.',
      DIAG_FOLDER_ID, err.message);
  }

  if (folder) {
    var old = folder.getFilesByName(DIAG_FILENAME);
    while (old.hasNext()) old.next().setTrashed(true);
    var f = folder.createFile(DIAG_FILENAME, text, MimeType.PLAIN_TEXT);
    return f.getUrl();
  }

  var stale = DriveApp.getFilesByName(DIAG_FILENAME);
  while (stale.hasNext()) stale.next().setTrashed(true);
  return DriveApp.createFile(DIAG_FILENAME, text, MimeType.PLAIN_TEXT).getUrl();
}
