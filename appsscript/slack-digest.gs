/**
 * Slack digest for the Inside Sales Command Centre.
 *
 * Posts a plain-text summary into a Slack channel using that channel's
 * email-to-channel address. No webhook, no Slack app, no OAuth.
 *
 * The channel address is a credential: anyone holding it can post to the
 * channel. It lives in Script Properties, never in this file, so this file
 * stays safe to commit.
 *
 * Setup (one time):
 *   1. Extensions > Apps Script, paste this file in.
 *   2. Project Settings > Script properties > Add script property
 *        name:  SLACK_CHANNEL_EMAIL
 *        value: the channel address
 *   3. Check Project Settings > Time zone is (GMT+05:30) India Standard Time.
 *   4. Run testSlack() once. Approve the Gmail scope when prompted.
 *   5. Run installSlackTriggers() once to schedule 09:30 and 18:30 IST.
 */

var SLACK_PROP_KEY = 'SLACK_CHANNEL_EMAIL';

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/** Send one digest right now. Use this to verify the wiring. */
function testSlack() {
  var result = sendSlackDigest_();
  Logger.log('Sent to %s\n\n%s', result.to, result.body);
}

/** Scheduled entry point. Point triggers at this. */
function slackDigest() {
  sendSlackDigest_();
}

/** Create the 09:30 and 18:30 IST triggers. Safe to re-run; clears its own first. */
function installSlackTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'slackDigest') ScriptApp.deleteTrigger(t);
  });
  [9, 18].forEach(function (hour) {
    ScriptApp.newTrigger('slackDigest')
      .timeBased()
      .atHour(hour)
      .nearMinute(30)
      .everyDays(1)
      .create();
  });
  Logger.log(
    'Installed 2 daily triggers for slackDigest (09:30 and 18:30, script time zone: %s).',
    Session.getScriptTimeZone()
  );
}

/** Remove the digest triggers. */
function removeSlackTriggers() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'slackDigest') {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  Logger.log('Removed %s trigger(s).', n);
}

/* ------------------------------------------------------------------ *
 * Core
 * ------------------------------------------------------------------ */

function sendSlackDigest_() {
  var to = PropertiesService.getScriptProperties().getProperty(SLACK_PROP_KEY);
  if (!to) {
    throw new Error(
      'Script property ' +
        SLACK_PROP_KEY +
        ' is not set. Add it under Project Settings > Script properties.'
    );
  }

  var cc = findCommandCentre_();
  var body = buildDigest_(cc);
  var subject = 'Inside Sales — ' + monthLabel_(cc) + ' — ' + get_(cc, 'Revenue');

  MailApp.sendEmail({ to: to, subject: subject, body: body, noReply: false });
  return { to: to, body: body, subject: subject };
}

/**
 * Locate the Command Centre tab by its title text rather than by tab name,
 * so renaming the tab does not break this.
 */
function findCommandCentre_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var hit = sheets[i]
      .createTextFinder('COMMAND CENTRE')
      .matchCase(false)
      .matchEntireCell(false)
      .findNext();
    if (hit) {
      return { sheet: sheets[i], titleCell: hit, grid: readGrid_(sheets[i]) };
    }
  }
  throw new Error('No tab contains the text "COMMAND CENTRE".');
}

/** Read the whole used range once, as displayed strings. */
function readGrid_(sheet) {
  var rows = Math.max(sheet.getLastRow(), 1);
  var cols = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, rows, cols).getDisplayValues();
}

/**
 * Find a label cell and return the first non-empty cell to its right.
 *
 * The Command Centre lays labels out in two places: the KPI stack on the
 * left, and the PACING / MIX / PEOPLE blocks further right. Scanning the
 * whole grid covers both. Where a label appears more than once — "Revenue"
 * is also a header in the per-agent table — the match whose neighbour is
 * numeric wins, which is always the KPI block.
 */
function get_(cc, label, fallback) {
  var want = String(label).trim().toLowerCase();
  var grid = cc.grid;
  var textMatch = null;

  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length - 1; c++) {
      if (String(grid[r][c]).trim().toLowerCase() !== want) continue;

      var value = firstNonEmptyRight_(grid[r], c);
      if (value === null) continue;

      if (looksNumeric_(value)) return value; // KPI block
      if (textMatch === null) textMatch = value; // remember, keep looking
    }
  }
  return textMatch !== null ? textMatch : fallback === undefined ? '—' : fallback;
}

function firstNonEmptyRight_(row, fromCol) {
  for (var c = fromCol + 1; c < row.length; c++) {
    var v = String(row[c]).trim();
    if (v !== '') return v;
  }
  return null;
}

function looksNumeric_(v) {
  return /^-?[₹$]?\s*[\d,]+(\.\d+)?%?$/.test(String(v).trim());
}

/** "Last updated: 11-Aug-2026 17:25" -> the timestamp, or a blank string. */
function lastUpdated_(cc) {
  var grid = cc.grid;
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      var cell = String(grid[r][c]);
      if (/last updated/i.test(cell)) {
        var inline = cell.split(':').slice(1).join(':').trim();
        if (inline) return inline;
        var right = firstNonEmptyRight_(grid[r], c);
        if (right) return right;
      }
    }
  }
  return '';
}

/** "COMMAND CENTRE — August 2026" -> "August 2026". */
function monthLabel_(cc) {
  var title = String(cc.titleCell.getDisplayValue());
  var parts = title.split(/[—–-]/);
  var tail = parts.length > 1 ? parts[parts.length - 1].trim() : '';
  return tail || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM yyyy');
}

/* ------------------------------------------------------------------ *
 * Formatting
 *
 * Slack's email-to-channel does not parse Markdown, so this is deliberately
 * plain "Label: value" text. No backticks, no asterisks — they would show
 * up literally in the channel.
 * ------------------------------------------------------------------ */

function buildDigest_(cc) {
  var stamp = lastUpdated_(cc);
  var lines = [];

  lines.push('INSIDE SALES — ' + monthLabel_(cc).toUpperCase());
  if (stamp) lines.push('Sheet last updated ' + stamp);
  lines.push('');

  lines.push('REVENUE');
  lines.push('  Achieved: ' + get_(cc, 'Revenue'));
  lines.push('  Target: ' + get_(cc, 'Target'));
  lines.push('  Attainment: ' + get_(cc, 'Attainment'));
  lines.push('  Gap to target: ' + get_(cc, 'Gap to target'));
  lines.push('');

  lines.push('PACING');
  lines.push(
    '  Day ' + get_(cc, 'Days elapsed') + ' of ' + get_(cc, 'Days in month') +
    ' — ' + get_(cc, 'Days remaining') + ' remaining'
  );
  lines.push('  Daily rate achieved: ' + get_(cc, 'Daily rate achieved'));
  lines.push('  Daily rate needed: ' + get_(cc, 'Daily rate needed'));
  lines.push('  Projected month end: ' + get_(cc, 'Projected month end'));
  lines.push('');

  lines.push('MIX');
  lines.push('  Domestic: ' + get_(cc, 'Domestic'));
  lines.push('  International: ' + get_(cc, 'International'));
  lines.push('  Others: ' + get_(cc, 'Others'));
  lines.push('');

  lines.push('UNITS');
  lines.push('  Units: ' + get_(cc, 'Units'));
  lines.push('  Average ticket: ' + get_(cc, 'Average ticket'));
  lines.push('');

  lines.push(SpreadsheetApp.getActive().getUrl());

  return lines.join('\n');
}
