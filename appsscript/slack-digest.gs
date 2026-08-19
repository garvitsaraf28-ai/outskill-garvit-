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

/**
 * Optional. An Incoming Webhook URL for the same channel.
 *
 * Set this and messages become native Slack posts with the text visible in
 * the channel. Leave it unset and messages go by email, which works but
 * always renders as a collapsed card that has to be clicked open.
 */
var SLACK_WEBHOOK_PROP = 'SLACK_WEBHOOK_URL';

/**
 * The mute switch. Set SLACK_MUTED to yes and the bot stops posting.
 *
 * WHY A MUTE RATHER THAN REMOVING THE TRIGGERS
 *
 *   Removing the triggers would also stop the work the triggers do. The
 *   Day and Night windows run refreshAndVerify and buildExecSnapshot
 *   BEFORE they post, so deleting them stops the Command Centre and the
 *   Executive page updating too - and the tabs would quietly go stale
 *   while the reason for it looked like "we turned off Slack".
 *
 *   Muting keeps every schedule running: the workbook still refreshes,
 *   the tabs are still rebuilt, the reports are still built and written
 *   to the log. Only the sending is skipped. Turning it back on is one
 *   property and nothing has to be reinstalled or caught up.
 *
 *   Everything scheduled goes through postToSlack_, so one check there
 *   covers all 18 firings. testWebhook deliberately bypasses it: running
 *   that function by hand IS asking for a message, and a delivery test
 *   that silently sends nothing would be useless.
 *
 * Use muteSlack() and unmuteSlack() rather than editing the property.
 */
var SLACK_MUTE_PROP = 'SLACK_MUTED';

/** True when the bot has been told to stay quiet. */
function slackMuted_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(SLACK_MUTE_PROP);
    v = String(v == null ? '' : v).trim().toLowerCase();
    return v === 'yes' || v === 'true' || v === '1' || v === 'on';
  } catch (e) {
    return false;                 // no properties, no mute - fail towards posting
  }
}

/** Stop every scheduled Slack post. Schedules and refreshes keep running. */
function muteSlack() {
  PropertiesService.getScriptProperties().setProperty(SLACK_MUTE_PROP, 'yes');
  Logger.log('Slack is MUTED. The bot will not post again until unmuteSlack().');
  Logger.log('');
  Logger.log('Still running normally, just not sending:');
  Logger.log('  - the refresh sequence on the Day and Night windows');
  Logger.log('  - every tab rebuild, including the two Lead Status tabs');
  Logger.log('  - the reports themselves, which are written to the log');
  Logger.log('');
  Logger.log('testWebhook() still posts, because running it by hand is a');
  Logger.log('deliberate request to send one message.');
}

/** Start posting again. */
function unmuteSlack() {
  PropertiesService.getScriptProperties().deleteProperty(SLACK_MUTE_PROP);
  Logger.log('Slack is UNMUTED. The next scheduled firing will post.');
  Logger.log('Nothing is sent for the runs that were missed - each report');
  Logger.log('reads the tabs as they are now, so the next one is current.');
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/**
 * Send one digest right now, and say which route carried it.
 *
 * The route is the thing to check: 'webhook' is a native message with the
 * text visible in the channel, anything else is the email fallback and its
 * collapsed card.
 */
function testSlack() {
  var result = sendSlackDigest_();
  Logger.log('Route: %s', result.route);
  if (result.route !== 'webhook') {
    Logger.log(
      'This went by email, so it will appear as a collapsed card. ' +
        'Set SLACK_WEBHOOK_URL in Script properties for a native message.'
    );
  }
  Logger.log('\n%s\n\n%s', result.subject, result.body);
}

/** Scheduled entry point. Point triggers at this. */
function slackDigest() {
  sendSlackDigest_();
}

/**
 * Run this when the digest reports success but nothing reaches the channel.
 *
 * It sends the same short message twice - once to the Slack channel address,
 * once to the account running the script - which splits the two failure modes
 * apart. If the copy to yourself arrives and the channel stays empty, Google
 * is sending fine and the problem is the address or the Slack side. If neither
 * arrives, the problem is on the Google side and the quota and scope readings
 * below will say which.
 */
function diagnoseSlack() {
  var raw = PropertiesService.getScriptProperties().getProperty(SLACK_PROP_KEY);
  var clean = normalizeAddress_(raw);
  var me = Session.getEffectiveUser().getEmail();

  Logger.log('stored value : [%s]', raw);
  Logger.log('after cleanup: [%s]', clean);
  Logger.log('email shaped : %s', isEmailShaped_(clean));
  Logger.log('sending as   : %s', me);
  Logger.log('quota left   : %s', MailApp.getRemainingDailyQuota());

  if (!isEmailShaped_(clean)) {
    Logger.log('STOP - the address is malformed. Fix the property, then re-run.');
    return;
  }

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
  var body = 'Slack delivery probe sent at ' + stamp + ' IST from ' + me + '.';

  MailApp.sendEmail({ to: clean, subject: 'Slack probe ' + stamp, body: body });
  Logger.log('-> sent to channel address %s', clean);

  MailApp.sendEmail({ to: me, subject: 'Slack probe (copy to self) ' + stamp, body: body });
  Logger.log('-> sent copy to %s', me);

  Logger.log('Give it 2 minutes, then compare: channel vs your own inbox.');
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

/**
 * Accept the address in any of the forms a mail client will hand you:
 *
 *   team-pv-xxxx@growthschoolio.slack.com
 *   <team-pv-xxxx@growthschoolio.slack.com>
 *   "team-pv (Slack)" <team-pv-xxxx@growthschoolio.slack.com>
 *
 * MailApp will take the display form without complaining and then fail to
 * deliver, so the bare address is extracted before sending.
 */
function normalizeAddress_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  var angled = s.match(/<([^>]+)>/);
  if (angled) s = angled[1];
  s = s.replace(/^["']|["']$/g, '').trim();
  return s;
}

/**
 * Explain what is wrong with an address, or return null if it is usable.
 *
 * A plain shape check is not enough here. An address copied out of a UI that
 * abbreviates long strings comes back as team-pv-...@growthschoolio.slack.com - 
 * one U+2026 ellipsis standing in for the 25-character token. That still
 * satisfies "something@something.something", so MailApp accepts it, reports
 * success, decrements the quota, and the mail bounces because the mailbox
 * does not exist. Nothing surfaces as an error. Hence the two extra checks.
 */
function addressProblem_(s) {
  if (!s) return 'it is empty';

  var nonAscii = String(s).match(/[^\x20-\x7E]/g);
  if (nonAscii) {
    var described = nonAscii
      .map(function (ch) {
        return (
          JSON.stringify(ch) +
          ' (U+' + ('000' + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4) + ')'
        );
      })
      .join(', ');
    return (
      'it contains ' + described + '. An ellipsis or other non-ASCII character ' +
      'almost always means the address was copied from a display that ' +
      'abbreviated it. Use the copy button in Slack rather than selecting the ' +
      'visible text.'
    );
  }

  if (!/^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(s)) {
    return 'it is not shaped like an email address';
  }

  // Slack channel addresses are channel-name + '-' + a long random token.
  // A short tail means the token was cut off.
  if (/\.slack\.com$/i.test(s)) {
    var local = s.slice(0, s.indexOf('@'));
    var token = local.slice(local.lastIndexOf('-') + 1);
    if (token.length < 16) {
      return (
        'the Slack token looks truncated - the part after the last hyphen is "' +
        token + '" (' + token.length + ' characters), where a real one runs to ' +
        'roughly 24 or more.'
      );
    }
  }

  return null;
}

function isEmailShaped_(s) {
  return addressProblem_(s) === null;
}

function slackAddress_() {
  var raw = PropertiesService.getScriptProperties().getProperty(SLACK_PROP_KEY);
  if (!raw) {
    throw new Error(
      'Script property ' +
        SLACK_PROP_KEY +
        ' is not set. Add it under Project Settings > Script properties.'
    );
  }
  var to = normalizeAddress_(raw);
  var problem = addressProblem_(to);
  if (problem) {
    throw new Error(
      'SLACK_CHANNEL_EMAIL is unusable: ' + problem +
        '\nStored value: [' + raw + ']' +
        '\nAfter cleanup: [' + to + ']'
    );
  }
  return to;
}

/**
 * Post to the channel, preferring a webhook and falling back to email.
 *
 * Two routes, and the difference is visible in the channel:
 *
 *   Webhook  posts a native Slack message. The text is visible inline and
 *            Slack mrkdwn works, so a code block holds column alignment.
 *   Email    posts a collapsed email card. Slack always renders inbound mail
 *            this way - subject showing, body behind a click - and no header
 *            or formatting changes that.
 *
 * The webhook is used whenever SLACK_WEBHOOK_URL is set, so adding that one
 * property upgrades every message without touching any other code.
 */
function postToSlack_(subject, body) {
  /* Muted: build everything, send nothing. The report still goes to the
     log, so a run can be read afterwards and the schedule is provably
     working - which is the difference between "muted" and "broken". */
  if (slackMuted_()) {
    Logger.log('MUTED - not sent. Run unmuteSlack() to start posting again.');
    Logger.log('%s\n\n%s', subject, body);
    return 'muted';
  }

  var hook = PropertiesService.getScriptProperties().getProperty(SLACK_WEBHOOK_PROP);
  if (hook) return postViaWebhook_(hook, subject, body);
  return postViaEmail_(subject, body);
}

/**
 * Native Slack message. Body goes inside a code block so the alignment
 * survives - Slack collapses ordinary runs of spaces, which would otherwise
 * turn a tidy column of numbers into a ragged one.
 */
/**
 * Pull the webhook URL out of whatever was pasted.
 *
 * Slack presents the URL inside a sample curl command, so that whole line is
 * the most natural thing to copy. Rather than requiring a clean paste,
 * extract the first hooks.slack.com URL found in the value. The character
 * class stops at the quote that closes the curl argument.
 */
function normalizeWebhook_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  var m = s.match(/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_\/-]+/);
  return m ? m[0] : s;
}

function postViaWebhook_(url, subject, body) {
  url = normalizeWebhook_(url);

  if (url.indexOf('https://hooks.slack.com/services/') !== 0) {
    throw new Error(
      'No Slack webhook URL found in SLACK_WEBHOOK_URL. Expected something ' +
        'containing https://hooks.slack.com/services/... - got [' + url + ']'
    );
  }

  // A Slack section caps at 3000 characters and the whole message at 50
  // blocks. The per-agent report runs to roughly 9000, so a single section
  // would be rejected outright as invalid_blocks and nothing would post.
  var blocks = [{ type: 'section', text: { type: 'mrkdwn', text: '*' + subject + '*' } }];
  chunkForSlack_(body).forEach(function (part) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '```\n' + part + '\n```' } });
  });

  var payload = { text: subject, blocks: blocks };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('Slack webhook returned ' + code + ': ' + res.getContentText());
  }

  Logger.log('Posted via webhook.\n%s\n\n%s', subject, body);
  return 'webhook';
}

/**
 * Split a body across Slack sections, breaking on line boundaries.
 *
 * The limit is 3000 characters per section; 2800 leaves room for the code
 * fence this gets wrapped in. Breaking mid-line would split a number away
 * from the agent it belongs to, so a line longer than the budget is emitted
 * on its own rather than cut.
 */
var SLACK_SECTION_BUDGET = 2800;

function chunkForSlack_(body) {
  // Break between groups, not inside one. Splitting on lines alone put
  // Tarlana Geetha at the top of a new section with her manager's heading
  // left behind in the previous one, which reads as an agent under nobody.
  // Blank lines are what separate a manager's block, so pack whole blocks.
  var blocks = String(body).split('\n\n');
  var parts = [], current = '';

  blocks.forEach(function (block) {
    var candidate = current ? current + '\n\n' + block : block;
    if (candidate.length <= SLACK_SECTION_BUDGET) {
      current = candidate;
      return;
    }
    if (current) { parts.push(current); current = ''; }

    // A single group longer than one section still has to be split, and only
    // then does a break land between two agents of the same manager.
    if (block.length <= SLACK_SECTION_BUDGET) {
      current = block;
      return;
    }
    splitLongBlock_(block).forEach(function (piece, i, all) {
      if (i === all.length - 1) current = piece;
      else parts.push(piece);
    });
  });

  if (current) parts.push(current);
  return parts.length ? parts : [''];
}

/** Last resort: a group too big for one section, split on line boundaries. */
function splitLongBlock_(block) {
  var out = [], current = '';
  block.split('\n').forEach(function (line) {
    var candidate = current ? current + '\n' + line : line;
    if (candidate.length <= SLACK_SECTION_BUDGET) {
      current = candidate;
      return;
    }
    if (current) out.push(current);
    current = line;
  });
  if (current) out.push(current);
  return out;
}

/** Fallback route. Delivers reliably, but renders as a collapsed card. */
function postViaEmail_(subject, body) {
  var to = slackAddress_();
  MailApp.sendEmail({ to: to, subject: subject, body: body });
  Logger.log('Posted via email to %s\nSubject: %s\n\n%s', to, subject, body);
  return to;
}

/**
 * Post a short message through the webhook only, and report what Slack said.
 *
 * Use this to test the webhook on its own. It never falls back to email, so
 * a failure here is unambiguously a webhook problem and Slack's own response
 * body names the reason - no_service for a revoked URL, channel_not_found if
 * the app was removed from the channel.
 */
function testWebhook() {
  var hook = PropertiesService.getScriptProperties().getProperty(SLACK_WEBHOOK_PROP);
  if (!hook) {
    Logger.log(
      'SLACK_WEBHOOK_URL is not set. Add it under Project Settings > Script ' +
        'properties, then run this again.'
    );
    return;
  }

  Logger.log('URL starts: %s...', hook.slice(0, 40));

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
  postViaWebhook_(hook, 'Webhook test ' + stamp, 'If you can read this in the channel\nwithout clicking anything, the webhook works.');
  Logger.log('Slack accepted it. Check the channel.');
}

/** Which route is live right now. */
function whichSlackRoute() {
  if (slackMuted_()) {
    Logger.log('MUTED - nothing is being posted. unmuteSlack() turns it back on.');
    Logger.log('');
  }
  var hook = PropertiesService.getScriptProperties().getProperty(SLACK_WEBHOOK_PROP);
  if (hook) {
    Logger.log('Route when unmuted: webhook - native messages, text visible inline.');
  } else {
    Logger.log('Route when unmuted: email - collapsed cards. Set SLACK_WEBHOOK_URL to upgrade.');
  }
}

/**
 * Build the digest and hand it to postToSlack_, which picks the route.
 *
 * Everything that posts goes through postToSlack_. Calling MailApp here
 * instead is what pinned the digest to email regardless of whether a
 * webhook was configured.
 */
function sendSlackDigest_(label, warning) {
  var cc = findCommandCentre_();

  var body = buildDigest_(cc);
  if (warning) body = warning + '\n\n' + body;

  var subject = 'Inside Sales - ' + monthLabel_(cc) + ' - ' + get_(cc, 'Revenue');
  if (label) subject = '[' + label + '] ' + subject;

  var route = postToSlack_(subject, body);
  return { route: route, body: body, subject: subject };
}

/**
 * Locate the Command Centre tab by its title text rather than by tab name,
 * so renaming the tab does not break this.
 */
/**
 * Locate the Command Centre tab, by name first.
 *
 * Searching every tab for the text "COMMAND CENTRE" is not safe here: the
 * Sales Monitoring tab carries the line "cross-check vs Command Centre" and
 * sits earlier in the workbook, so a content scan locks onto it, finds none
 * of the KPI labels, and reports a dash for every figure.
 *
 * The tab name is the reliable signal. Content matching stays as a fallback
 * for a renamed tab, but only where the text begins the cell, which is true
 * of the title and not of a passing mention in a note.
 */
function findCommandCentre_() {
  var sheets = SpreadsheetApp.getActive().getSheets();

  for (var i = 0; i < sheets.length; i++) {
    if (/^\s*command\s*centre\s*$/i.test(sheets[i].getName())) {
      return wrapCommandCentre_(sheets[i]);
    }
  }

  for (var j = 0; j < sheets.length; j++) {
    var grid = readGrid_(sheets[j]);
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (/^\s*command\s+centre\b/i.test(String(grid[r][c]))) {
          return {
            sheet: sheets[j],
            titleCell: sheets[j].getRange(r + 1, c + 1),
            grid: grid
          };
        }
      }
    }
  }

  throw new Error(
    'Could not find the Command Centre tab. No tab is named "Command Centre" ' +
      'and no cell begins with that text.'
  );
}

function wrapCommandCentre_(sheet) {
  var grid = readGrid_(sheet);
  var titleCell = sheet.getRange(1, 1);
  for (var r = 0; r < grid.length && r < 10; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      if (/^\s*command\s+centre\b/i.test(String(grid[r][c]))) {
        titleCell = sheet.getRange(r + 1, c + 1);
        r = grid.length;
        break;
      }
    }
  }
  return { sheet: sheet, titleCell: titleCell, grid: grid };
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
 * whole grid covers both. Where a label appears more than once - "Revenue"
 * is also a header in the per-agent table - the match whose neighbour is
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
  return textMatch !== null ? textMatch : fallback === undefined ? '-' : fallback;
}

function firstNonEmptyRight_(row, fromCol) {
  for (var c = fromCol + 1; c < row.length; c++) {
    var v = String(row[c]).trim();
    if (v !== '') return v;
  }
  return null;
}

function looksNumeric_(v) {
  return /^-?[\u20B9$]?\s*[\d,]+(\.\d+)?%?$/.test(String(v).trim());
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

/** "COMMAND CENTRE - August 2026" -> "August 2026". */
function monthLabel_(cc) {
  var title = String(cc.titleCell.getDisplayValue());
  var parts = title.split(/[\u2014\u2013-]/);
  var tail = parts.length > 1 ? parts[parts.length - 1].trim() : '';
  return tail || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM yyyy');
}

/* ------------------------------------------------------------------ *
 * Formatting
 *
 * Slack's email-to-channel does not parse Markdown, so this is deliberately
 * plain "Label: value" text. No backticks, no asterisks - they would show
 * up literally in the channel.
 * ------------------------------------------------------------------ */

function buildDigest_(cc) {
  var stamp = lastUpdated_(cc);
  var lines = [];

  lines.push('INSIDE SALES - ' + monthLabel_(cc).toUpperCase());
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
    ' - ' + get_(cc, 'Days remaining') + ' remaining'
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
