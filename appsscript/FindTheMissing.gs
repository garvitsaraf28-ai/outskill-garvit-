/**
 * findTheMissing - READ ONLY. Writes nothing.
 *
 * WHAT I GOT WRONG
 *
 *   I reported 15 agents, 23.53 L, as "no payment row in the tracker".
 *   The payments are in the tracker. My check matched the tracker's Lead
 *   Owner against CBC's Agent spelling EXACTLY, so a payment logged under
 *   any other spelling of the same person read as nothing at all rather
 *   than as a near miss - and I passed that on as settled.
 *
 *   It is not only my check. mdl_Payments matches the same way, so those
 *   payments are missing from the model too. October carries 5.48 cr of
 *   "non-roster revenue", and some of that is these people under names
 *   the roster does not recognise.
 *
 * WHAT THIS DOES
 *
 *   For every agent CBC credits with more than the model has, it searches
 *   src_Payments for ANY Lead Owner containing a word from that agent's
 *   name, and prints every spelling it finds with what each one is worth
 *   this month.
 *
 *   Kshitij against "Kshitij Jaiswal" shows up immediately. So does
 *   Veena against "Veena  Madhuri Pallapu" with its double space, and a
 *   surname typed where a first name belongs.
 *
 * WHAT COMES NEXT
 *
 *   Every spelling it finds becomes one line in WR_ALIASES - the table
 *   that already exists for exactly this, with one entry in it. Send me
 *   the log and I will write them.
 *
 *   Nothing is guessed: a name is only ever matched to a person a human
 *   has confirmed. Merging two real people silently is far worse than a
 *   name that visibly fails to match, which is why this reports rather
 *   than fixes.
 */
function findTheMissing() {
  var ss = SpreadsheetApp.getActive();
  var L = function (s) { Logger.log(s); };
  var monthKey = Utilities.formatDate(new Date(), WR_TZ, 'yyyy-MM');

  L('=== WHERE THE MISSING PAYMENTS ARE ===   ' + monthKey + '   ' +
    Utilities.formatDate(new Date(), WR_TZ, 'dd MMM HH:mm'));
  L('  Read only. Nothing was written.');
  L('');

  if (typeof w3_roster_ !== 'function' || typeof w3_pay_ !== 'function') {
    L('  Needs war-room-threeway.gs in this project.');
    return;
  }

  /* Named one at a time. "Could not find CBC, the import and the model"
     says which of three things is wrong only by not saying, and a
     message that needs another run to interpret is not a message. */
  var cbc = w3_roster_(ss, monthKey);
  L('  CBC   (src_Roster_' + monthKey + ') : ' +
    (cbc ? (cbc.name + ', ' + cbc.n + ' agents') : '*** NOT FOUND'));

  var src = w3_pay_(ss, true);
  L('  import (a payments tab WITH a customer column) : ' +
    (src ? (src.name + ', ' + src.rows.length + ' rows') : '*** NOT FOUND'));

  var mdl = w3_pay_(ss, false);
  L('  model  (a payments tab WITHOUT one)            : ' +
    (mdl ? (mdl.name + ', ' + mdl.rows.length + ' rows') : '*** NOT FOUND'));
  L('');

  if (!cbc) {
    L('  *** No src_Roster tab for ' + monthKey + ' carrying both an Agent column');
    L('      and a Realised Revenue column. Without CBC there is nothing to');
    L('      compare the model against.');
  }
  if (!src || !mdl) {
    L('  *** The two payments tabs are told apart by one thing: the raw import');
    L('      carries a customer (a Name or Payment Email Id column) and the');
    L('      model does not. If src_Payments has just been replaced by hand and');
    L('      those columns were left out, both look like the model and neither');
    L('      can be found. Paste the header row as the tracker has it.');
  }
  if (!cbc || !src || !mdl) return;

  var M = w3_tally_(mdl, monthKey);

  /* every distinct Lead Owner in the import this month, with its total */
  var spell = {};
  for (var r = 0; r < src.rows.length; r++) {
    var row = src.rows[r], d = row[src.c.date];
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (wr_monthKey_(d) !== monthKey) continue;
    var nm = wr_str_(row[src.c.agent]);
    if (!nm || wr_isSummary_(nm)) continue;
    if (src.c.stat >= 0 &&
        String(row[src.c.stat] || '').toLowerCase().indexOf('cancel') > -1) continue;
    if (!spell[nm]) spell[nm] = 0;
    spell[nm] += wr_num_(row[src.c.amt]);
  }

  /* who the roster already accounts for, so a spelling that is already
     counted is not offered as a discovery */
  var known = {}, k;
  for (k in cbc.by) known[wr_key_(cbc.by[k].name)] = cbc.by[k].name;

  var short = [], totalGap = 0, totalFound = 0;
  for (k in cbc.by) {
    var c = cbc.by[k].rev, m = (M[k] || { rev: 0 }).rev;
    if (c - m < 1) continue;
    short.push({ name: cbc.by[k].name, cbc: c, model: m, gap: c - m });
  }
  short.sort(function (a, b) { return b.gap - a.gap; });

  if (!short.length) { L('  Nothing is short. CBC and the model agree.'); return; }

  L('  ' + short.length + ' agent(s) where CBC credits more than the model has.');
  L('  For each, every Lead Owner in src_Payments carrying a word from');
  L('  their name, and what it is worth this month.');
  L('');

  for (var i = 0; i < short.length; i++) {
    var a = short[i];
    totalGap += a.gap;

    L('  ' + a.name);
    L('    CBC ' + wr_money_(a.cbc) + '   model ' + wr_money_(a.model) +
      '   short ' + wr_money_(a.gap));

    var toks = ftm_tokens_(a.name);
    var hits = [], s2;
    for (s2 in spell) {
      if (wr_key_(s2) === wr_key_(a.name)) continue;      // the spelling already counted
      if (known[wr_key_(s2)]) continue;                   // somebody else on the roster
      if (!ftm_shares_(toks, ftm_tokens_(s2))) continue;
      hits.push({ name: s2, rev: spell[s2] });
    }
    hits.sort(function (x, y) { return y.rev - x.rev; });

    if (!hits.length) {
      L('    no other spelling in the import carries any word of this name.');
    } else {
      for (var h = 0; h < hits.length; h++) {
        var close = Math.abs(hits[h].rev - a.gap) < Math.max(1000, a.gap * 0.02);
        L('    FOUND  "' + hits[h].name + '"  ' + wr_money_(hits[h].rev) +
          (close ? '   <-- matches the shortfall almost exactly' : ''));
        totalFound += hits[h].rev;
      }
    }
    L('');
  }

  L('  ' + wr_money_(totalGap) + ' short in all.');
  L('  ' + wr_money_(totalFound) + ' found under other spellings.');
  L('');
  if (totalFound > 0) {
    L('  THAT IS THE BUG, AND IT IS MINE. Those payments are in the tracker');
    L('  under a name the roster does not recognise, so the model drops them');
    L('  and so did my check. Each FOUND line above becomes one entry in');
    L('  WR_ALIASES, written as');
    L('      \'how the tracker spells it\' : \'how the roster spells it\'');
    L('  Send me this log and I will write them. Nothing is guessed - a name');
    L('  is only matched to a person once somebody has confirmed it.');
  } else {
    L('  No other spelling carries any of these names, so the money really is');
    L('  not in the import under a near miss. Then it is either not logged');
    L('  yet, or logged against a name with nothing in common with theirs.');
  }
  L('');
  L('  Nothing was written. This only reports.');
}


/** Words worth matching on. Short ones catch half the floor. */
function ftm_tokens_(name) {
  var raw = String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    if (raw[i].length >= 4) out.push(raw[i]);
  }
  return out;
}

/** Do two names share a word? One is enough to be worth showing. */
function ftm_shares_(a, b) {
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      if (a[i] === b[j]) return true;
    }
  }
  return false;
}
