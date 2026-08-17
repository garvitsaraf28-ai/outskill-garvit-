/**
 * SlpPayload.gs - one door for every SuperLeap payload shape.
 *
 * WHY THIS FILE EXISTS
 *
 *   The routine that queries SuperLeap and the workbook that reads the
 *   result are two separate programs that have to agree on a file format.
 *   They have disagreed three times already:
 *
 *     v1  disp  [agent, email, disposition, n]          <- what the readers know
 *         stage [agent, stage, n]
 *         sub   [agent, sub, n]
 *
 *     v2  disp  [agent, email, source, disposition, n]  <- source inserted at 2
 *         stage [agent, source, stage, n]
 *         sub   [agent, source, sub, n]
 *
 *     v3  rows  [{agent,email,source,month,stage,disposition,sub,n}, ...]
 *         version: 3
 *
 *   A v2 file read by a v1 reader does not error. It reads the workshop
 *   code as the disposition and the disposition as the count, so every
 *   number becomes NaN and the tab fills with nonsense that looks like
 *   data. A v3 file read by a v1 reader is worse in a quieter way: there
 *   is no "disp" key at all, so slpAutoRefresh stops at its guard, logs
 *   "payload has no disposition rows", and the workbook sits on its last
 *   good numbers indefinitely while appearing to run fine every two hours.
 *
 *   So the readers have to understand v3 BEFORE the routine starts
 *   writing it, not after. This file is that understanding, in one place,
 *   so the version question is asked once instead of at four call sites.
 *
 * WHAT IT DOES
 *
 *   slp_normalisePayload_(text) takes the JSON text of any payload and
 *   returns the JSON text of a payload in v1 shape - the shape every
 *   existing reader already handles - with the newer dimensions carried
 *   alongside rather than thrown away:
 *
 *     .disp / .stage / .sub    v1 arrays, rebuilt by summing if needed
 *     .rows                    v3 named rows, when the payload has them
 *     .months                  every month present, ascending
 *     .sources                 every workshop code present
 *     .version                 the version that arrived (1, 2 or 3)
 *
 *   Nothing downstream has to change. buildSuperLeapChurn and
 *   buildSlpStageView keep reading .disp and .stage exactly as they do
 *   now, and they keep working whichever version the routine is on.
 *
 * HOW TO WIRE IT IN - two lines, both one-word changes
 *
 *   In SlpAuto.gs, inside slpAutoRefresh():
 *
 *       try { pay = JSON.parse(text); }
 *   becomes
 *       try { text = slp_normalisePayload_(text); pay = JSON.parse(text); }
 *
 *   In SuperLeapChurn.gs, inside slpLoadFromDrive():
 *
 *       try { pay = JSON.parse(text); }
 *   becomes
 *       try { text = slp_normalisePayload_(text); pay = JSON.parse(text); }
 *
 *   Both functions already store `text` afterwards via slp_writeRaw_, so
 *   normalising it there means _slp_raw always holds one shape and every
 *   later reader is insulated from the question permanently.
 *
 *   Leave the existing "if (!pay.disp || !pay.disp.length)" guards alone.
 *   After normalisation they are still the right check, and they now
 *   correctly reject a v3 payload that arrived empty.
 *
 * HOW TO CHECK THE EDITS TOOK  -  run slpLoadFromDrive(), then
 * slpPayloadCheck(). The "normaliser :" line must say WIRED IN.
 *
 *   Use slpLoadFromDrive, NOT slpAutoRefresh. slpAutoRefresh compares the
 *   payload's snapshot against the last one it stored and returns early
 *   when they match - "no new data" - and that return happens BEFORE it
 *   calls slp_writeRaw_. So on an unchanged payload it re-stores nothing,
 *   the check keeps reporting NOT WIRED IN however correct the edits are,
 *   and the only thing that would eventually clear it is a fresh payload
 *   arriving from the routine up to two hours later.
 *
 *   slpLoadFromDrive has no such guard. It re-reads, re-normalises and
 *   re-stores every time, which is exactly what is wanted here.
 *
 * Run slpPayloadCheck() any time to see which version is in Drive right
 * now without changing anything.
 */

/* Apps Script gives a script 6 minutes and a cell 50,000 characters.
   A v3 payload carrying month multiplies the row count, so say so
   loudly at the point it becomes a problem rather than failing later
   inside JSON.parse with a message nobody can act on. */
var SLP_PAYLOAD_MAX_CHARS = 9000000;

/* ----------------------------------------------------------------
   THE SHRINK GUARD

   On 17 Aug a payload arrived carrying 5 disposition rows where the one
   before it had 671. It was stored, the SuperLeap tabs were rebuilt from
   it, and the Slack report went out saying the Inside Sales team had one
   agent and 123 leads. Nothing errored, because nothing was wrong in a
   way any check was looking for: the file was valid JSON in the right
   shape, it just had almost nothing in it.

   A payload that suddenly loses most of its rows is a failed query far
   more often than it is real news. Refusing it costs one stale refresh
   cycle. Accepting it costs the tabs, the report, and anyone who read
   the report.

   The guard lives here rather than in the readers because this is the
   one place every payload already passes through, so it protects both
   slpAutoRefresh and slpLoadFromDrive without either needing another
   hand-edit. Both wrap the call in a try/catch that returns early
   WITHOUT storing, which is exactly the behaviour wanted.

   Their catch reports its own message rather than this one, so the real
   reason is also written to SLP_LAST_REJECT, which slpPayloadCheck
   reports.

   To accept a genuinely smaller payload, set the script property
   SLP_ALLOW_SHRINK to yes. It clears itself after one use, so a
   deliberate override cannot silently become permanent.
   ---------------------------------------------------------------- */
var SLP_SHRINK_FLOOR = 0.5;   // refuse below half of the last good count
var SLP_SHRINK_MIN   = 50;    // ignore the guard until there is a real baseline


/* ================================================================
   1.  WHICH VERSION IS THIS

   Detect by shape, not by trusting the version field, because v1 and
   v2 do not carry one. The version field is used when it is there
   because it is the only thing that can distinguish a v3 payload that
   happens to have no rows.
   ================================================================ */
function slp_payloadVersion_(pay) {
  if (!pay || typeof pay !== 'object') return 0;

  if (Number(pay.version) === 3) return 3;
  if (pay.rows && pay.rows.length) return 3;

  var d = pay.disp;
  if (!d || !d.length) return 0;

  /* v1 disp rows carry 4 fields, v2 carry 5. Read the widest row
     present rather than the first one: a single malformed row at the
     top should not decide the format of the whole file. */
  var widest = 0;
  for (var i = 0; i < d.length; i++) {
    if (d[i] && d[i].length > widest) widest = d[i].length;
  }
  if (widest >= 5) return 2;
  if (widest >= 4) return 1;
  return 0;
}


/* ================================================================
   2.  NORMALISE

   Returns JSON text, not an object, because both call sites want the
   text: they store it in _slp_raw straight afterwards. Returning text
   keeps "what was checked" and "what was stored" the same string.
   ================================================================ */
function slp_normalisePayload_(text) {
  if (!text) return text;

  if (text.length > SLP_PAYLOAD_MAX_CHARS) {
    throw new Error('payload is ' + Math.round(text.length / 1000000) +
      ' MB, past the ' + Math.round(SLP_PAYLOAD_MAX_CHARS / 1000000) +
      ' MB this script can hold. Narrow the routine query - a shorter ' +
      'date window or fewer dimensions - rather than raising this limit.');
  }

  var pay = JSON.parse(text);          // let a parse error reach the caller
  var v = slp_payloadVersion_(pay);

  slp_guardShrink_(pay, v);

  if (v === 1) {
    /* Already the shape the readers want. Add the empty new fields so
       later code can ask for .months without checking it exists, and
       gets an honest empty answer instead of undefined. */
    if (!pay.months) pay.months = [];
    if (!pay.sources) pay.sources = [];
    if (!pay.rows) pay.rows = [];
    pay.version = 1;
    return JSON.stringify(pay);
  }

  if (v === 2) {
    pay = slp_v2ToV1_(pay);
    return JSON.stringify(pay);
  }

  if (v === 3) {
    pay = slp_v3ToV1_(pay);
    return JSON.stringify(pay);
  }

  /* Unknown shape. Hand it back untouched so the existing guards see
     the same thing they would have seen without this file, and report
     the same message they always did. Silently inventing a shape here
     would be the worst outcome: a tab full of confident zeroes. */
  return text;
}


/** How many data rows a payload carries, whatever shape it is in. */
function slp_rowCount_(pay) {
  if (!pay) return 0;
  if (pay.rows && pay.rows.length) return pay.rows.length;
  return ((pay.disp && pay.disp.length) || 0);
}

/**
 * True only while slpPayloadSelfTest is running.
 *
 * The self test feeds the normaliser deliberately tiny payloads - two or
 * three rows - to prove the conversions. Against a live baseline of 674
 * the guard correctly refuses every one of them, so the test could not
 * run at all in a workbook that had ever seen real data. It also wrote
 * its throwaway row counts into the live SLP_LAST_GOOD_ROWS, which is a
 * diagnostic quietly editing production state.
 *
 * Both are fixed by taking the guard out of the self test's path. What
 * the guard actually decides is tested directly, through
 * slp_shrinkVerdict_, which touches nothing.
 */
var SLP_IN_SELFTEST = false;

/**
 * The whole decision, as arithmetic. No properties, no throwing, no
 * side effects - so it can be tested honestly.
 *
 * Returns 'first' | 'ok' | 'override' | 'refuse'.
 */
function slp_shrinkVerdict_(now, last, allow) {
  if (!last || last < SLP_SHRINK_MIN) return 'first';
  if (now >= Math.floor(last * SLP_SHRINK_FLOOR)) return 'ok';
  var a = String(allow || '').trim().toLowerCase();
  if (a === 'yes' || a === 'true') return 'override';
  return 'refuse';
}

/**
 * Refuse a payload that has lost most of its rows.
 *
 * Throws to stop it being stored. Records why, because the callers'
 * catch blocks report their own wording rather than this message.
 */
function slp_guardShrink_(pay, version) {
  if (SLP_IN_SELFTEST) return;

  var P;
  try { P = PropertiesService.getScriptProperties(); }
  catch (e) { return; }                       // no properties, no baseline, no guard

  var now = slp_rowCount_(pay);
  var last = Number(P.getProperty('SLP_LAST_GOOD_ROWS') || 0);
  var allow = P.getProperty('SLP_ALLOW_SHRINK');

  switch (slp_shrinkVerdict_(now, last, allow)) {
    case 'first':
      if (now) P.setProperty('SLP_LAST_GOOD_ROWS', String(now));
      return;

    case 'ok':
      P.setProperty('SLP_LAST_GOOD_ROWS', String(now));
      P.deleteProperty('SLP_LAST_REJECT');
      return;

    case 'override':
      P.deleteProperty('SLP_ALLOW_SHRINK');
      P.setProperty('SLP_LAST_GOOD_ROWS', String(now));
      P.setProperty('SLP_LAST_REJECT',
        'ACCEPTED a shrink from ' + last + ' to ' + now + ' rows because ' +
        'SLP_ALLOW_SHRINK was set. That override has now been cleared.');
      return;
  }

  var why = 'REFUSED a v' + version + ' payload with ' + now +
    ' row(s) where the last good one had ' + last +
    '. A payload that loses most of its rows is a failed query far more ' +
    'often than it is real news, so the workbook kept its previous ' +
    'numbers rather than rebuilding the tabs and the Slack report from ' +
    'almost nothing. If the drop is genuine, set the script property ' +
    'SLP_ALLOW_SHRINK to yes and run again; it clears itself after one use.';

  P.setProperty('SLP_LAST_REJECT', why);
  throw new Error(why);
}


/* ================================================================
   3.  v2 -> v1

   Drop the source column back out of the positional arrays. Nothing
   is lost that the v1 readers were ever going to use, and the source
   is preserved in .rows for anything that wants it.
   ================================================================ */
function slp_v2ToV1_(pay) {
  var disp = [], stage = [], sub = [], rows = [], sources = {};

  (pay.disp || []).forEach(function (r) {
    var agent = r[0], email = r[1], src = r[2], d = r[3], n = Number(r[4] || 0);
    disp.push([agent, email, d, n]);
    rows.push({ agent: String(agent || '(no owner)'), email: String(email || ''),
                source: String(src || ''), month: '', stage: '',
                disposition: String(d || ''), sub: '', n: n });
    if (src) sources[String(src)] = true;
  });

  (pay.stage || []).forEach(function (r) {
    stage.push([r[0], r[2], Number(r[3] || 0)]);
    if (r[1]) sources[String(r[1])] = true;
  });

  (pay.sub || []).forEach(function (r) {
    sub.push([r[0], r[2], Number(r[3] || 0)]);
    if (r[1]) sources[String(r[1])] = true;
  });

  return {
    version: 2,
    snapshot: pay.snapshot || '',
    from: pay.from || '',
    today_count: (pay.today_count === undefined ? null : pay.today_count),
    today_by_agent: pay.today_by_agent || [],
    months: [],
    sources: Object.keys(sources).sort(),
    disp: disp, stage: stage, sub: sub,
    rows: rows
  };
}


/* ================================================================
   4.  v3 -> v1

   One row in v3 carries every dimension at once, so the three v1
   arrays are three different rollups of the same rows. Summing is the
   whole job.

   The email rule matters: v1 sent an agent's email only on their first
   row to keep the file small, and buildSuperLeapChurn keeps the first
   non-blank one it sees. v3 sends it on every row. Emitting it on
   every rebuilt row is therefore correct and also harmless - the
   reader's "first non-blank wins" logic gives the same answer either
   way.
   ================================================================ */
/**
 * One month row, whatever spelling it arrived in.
 *
 * The first v3 draft used full names on every row and reached a megabyte,
 * which could not be uploaded. The shipped shape uses short keys and drops
 * the fields nothing slices by month. Both are accepted so a payload
 * written against either spec still reads.
 */
function slp_monthRow_(r) {
  if (!r) return null;
  var agent = r.a !== undefined ? r.a : r.agent;
  if (agent === undefined || agent === null || agent === '') return null;
  var d = r.d !== undefined ? r.d : r.disposition;
  return {
    agent: String(agent),
    month: String((r.m !== undefined ? r.m : r.month) || ''),
    source: String((r.s !== undefined ? r.s : r.source) || ''),
    disposition: (d === undefined || d === null) ? '' : String(d),
    stage: String(r.stage || ''),
    sub: String(r.sub || ''),
    email: String(r.email || ''),
    n: Number(r.n || 0)
  };
}

function slp_v3ToV1_(pay) {
  var raw = pay.rows || [];
  var rows = [];
  for (var i = 0; i < raw.length; i++) {
    var m = slp_monthRow_(raw[i]);
    if (m) rows.push(m);
  }

  /* The shipped v3 carries disp, stage and sub exactly as v1 does, and adds
     rows only for the month and workshop dimension. Keeping those three
     untouched is what lets every existing reader work without a change, so
     when they are present they are used as-is rather than rebuilt.

     The earlier draft put every dimension in rows and nothing else. That is
     still readable: if the arrays are missing, they are derived below. */
  var haveV1Arrays = !!(pay.disp && pay.disp.length);

  var months = {}, sources = {};
  rows.forEach(function (r) {
    if (r.month) months[r.month] = true;
    if (r.source) sources[r.source] = true;
  });

  if (haveV1Arrays) {
    var monthList0 = Object.keys(months).sort();
    if (!monthList0.length && pay.months && pay.months.length) {
      monthList0 = pay.months.slice().sort();
    }
    return {
      version: 3,
      snapshot: pay.snapshot || '',
      from: pay.from || '',
      today_count: (pay.today_count === undefined ? null : pay.today_count),
      today_by_agent: pay.today_by_agent || [],
      months: monthList0,
      sources: Object.keys(sources).sort(),
      disp: pay.disp,
      stage: pay.stage || [],
      sub: pay.sub || [],
      rows: rows
    };
  }

  var dAgg = {}, sAgg = {}, bAgg = {};
  var dOrder = [], sOrder = [], bOrder = [];
  var emails = {};

  rows.forEach(function (r) {
    var agent = String(r.agent || '(no owner)');
    var n = Number(r.n || 0);
    var d = (r.disposition === undefined || r.disposition === null) ? '' : String(r.disposition);
    var st = (r.stage === undefined || r.stage === null) ? '' : String(r.stage);
    var sb = (r.sub === undefined || r.sub === null) ? '' : String(r.sub);

    if (r.email && !emails[agent]) emails[agent] = String(r.email);
    if (r.month) months[String(r.month)] = true;
    if (r.source) sources[String(r.source)] = true;

    var kd = agent + '|' + d;
    if (dAgg[kd] === undefined) { dAgg[kd] = 0; dOrder.push([agent, d, kd]); }
    dAgg[kd] += n;

    var ks = agent + '|' + st;
    if (sAgg[ks] === undefined) { sAgg[ks] = 0; sOrder.push([agent, st, ks]); }
    sAgg[ks] += n;

    /* v1 and v2 only ever sent sub rows where a sub-disposition was
       set. Keep that, so the stage tab's totals mean the same thing
       they meant before the changeover. */
    if (sb) {
      var kb = agent + '|' + sb;
      if (bAgg[kb] === undefined) { bAgg[kb] = 0; bOrder.push([agent, sb, kb]); }
      bAgg[kb] += n;
    }
  });

  var disp = dOrder.map(function (o) {
    return [o[0], emails[o[0]] || '', o[1], dAgg[o[2]]];
  });
  var stage = sOrder.map(function (o) { return [o[0], o[1], sAgg[o[2]]]; });
  var sub = bOrder.map(function (o) { return [o[0], o[1], bAgg[o[2]]]; });

  /* Sort the way the routine was asked to sort, so two consecutive
     rebuilds produce the same tab and a diff means something changed
     in SuperLeap rather than in the ordering. */
  function byAgentThenKey(a, b) {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
    return 0;
  }
  disp.sort(function (a, b) {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return a[2] < b[2] ? -1 : (a[2] > b[2] ? 1 : 0);
  });
  stage.sort(byAgentThenKey);
  sub.sort(byAgentThenKey);

  var monthList = Object.keys(months).sort();
  /* Trust the rows over the routine's own months list. If they
     disagree, the rows are the data and the list is a summary of it. */
  if (!monthList.length && pay.months && pay.months.length) {
    monthList = pay.months.slice().sort();
  }

  return {
    version: 3,
    snapshot: pay.snapshot || '',
    from: pay.from || '',
    today_count: (pay.today_count === undefined ? null : pay.today_count),
    today_by_agent: pay.today_by_agent || [],
    months: monthList,
    sources: Object.keys(sources).sort(),
    disp: disp, stage: stage, sub: sub,
    rows: rows
  };
}


/* ================================================================
   5.  ASKING THE STORED PAYLOAD ABOUT MONTHS

   These read what is already in _slp_raw. They answer honestly when
   the payload has no month in it, which is the case for every v1 and
   v2 file, so a caller can tell "no leads this month" apart from
   "this payload cannot answer that question".
   ================================================================ */
function slp_storedPayload_() {
  var raw = slp_readRaw_();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** Newest month in the payload, or '' if it carries no months. */
function slp_currentMonth_(pay) {
  if (!pay || !pay.months || !pay.months.length) return '';
  return pay.months[pay.months.length - 1];
}

/**
 * Rows for one month, in the same named shape v3 uses.
 * month === '' means every row.
 * Returns [] for a payload with no rows, which is any v1 file.
 */
function slp_rowsForMonth_(pay, month) {
  if (!pay || !pay.rows || !pay.rows.length) return [];
  if (!month) return pay.rows;
  return pay.rows.filter(function (r) { return String(r.month || '') === month; });
}


/* ================================================================
   6.  IS THE NORMALISER ACTUALLY WIRED IN

   The two one-line edits are the only part of this that a person has
   to do by hand, so it is the only part that can silently not happen.
   An edit that was missed looks exactly like an edit that was made -
   until the routine switches to v3 and the pipeline stops.

   It can be checked without reading the source. The routine's own
   payload carries no "version" key; slp_normalisePayload_ always adds
   one. So a stored payload with a version went through the normaliser,
   and one without it did not.
   ================================================================ */
function slp_wiringState_(stored, drivePay) {
  if (!stored) {
    return { state: 'unknown',
             why: 'nothing stored yet - run slpAutoRefresh once, then check again' };
  }

  if (Object.prototype.hasOwnProperty.call(stored, 'version')) {
    return { state: 'WIRED IN', why: '' };
  }

  /* No version key. If what is stored is the same snapshot as the file
     currently in Drive, then the newest payload was stored without
     passing through the normaliser, which is conclusive. */
  if (drivePay && String(drivePay.snapshot || '') === String(stored.snapshot || '')) {
    return { state: 'NOT WIRED IN',
             why: 'the newest payload was stored without passing through ' +
                  'slp_normalisePayload_. Make the two edits in the header of ' +
                  'this file, then run slpLoadFromDrive() - NOT slpAutoRefresh, ' +
                  'which skips when the snapshot has not changed and so would ' +
                  'never re-store it.' };
  }

  return { state: 'cannot tell yet',
           why: 'the stored payload is older than the one in Drive. Run ' +
                'slpLoadFromDrive(), then check again.' };
}


/* ================================================================
   6b. WHAT PAYLOAD FILES ARE ACTUALLY OUT THERE

   slpLoadFromDrive reports how many files share the payload's name, and
   it said 12. That number is not what it looks like. Of the three
   functions that go looking for a payload, two skip trashed files and
   one does not:

     slpa_newestPayload_   skips trashed   respects SLP_FOLDER_ID
     slpa_tidy_            skips trashed   respects SLP_FOLDER_ID
     slpLoadFromDrive      counts trashed  searches the whole Drive

   slpa_tidy_ keeps the newest few and moves the rest to Trash, where
   they stay matchable by name. So the honest reading of "12 files" is
   most likely a working tidy - a few live payloads and the rest already
   binned - being counted by the one function that does not filter them
   out.

   This splits the count so it can be read rather than guessed at, and
   says plainly whether a trashed file could ever be picked up in
   preference to a live one, which is the part that would actually
   matter.
   ================================================================ */
function slp_payloadFiles_() {
  var name = (typeof SLPA_FILE !== 'undefined' && SLPA_FILE) ? SLPA_FILE : 'slp_payload.json';
  var folderId = PropertiesService.getScriptProperties().getProperty('SLP_FOLDER_ID');

  var out = { live: 0, trashed: 0, inFolder: 0, elsewhere: 0,
              newestLive: null, newestAny: null, folderId: folderId || '' };

  var it;
  try { it = DriveApp.getFilesByName(name); }
  catch (e) { return out; }

  var folder = null;
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; } }

  while (it.hasNext()) {
    var f = it.next();
    var trashed = !!(f.isTrashed && f.isTrashed());
    var when = f.getLastUpdated();

    if (trashed) out.trashed++; else out.live++;
    if (!out.newestAny || when > out.newestAny.when) out.newestAny = { when: when, trashed: trashed };
    if (!trashed && (!out.newestLive || when > out.newestLive.when)) out.newestLive = { when: when };

    if (folder) {
      var inIt = false;
      try {
        var p = f.getParents();
        while (p.hasNext()) { if (p.next().getId() === folderId) { inIt = true; break; } }
      } catch (e) {}
      if (inIt) out.inFolder++; else out.elsewhere++;
    }
  }
  return out;
}


/**
 * Every payload file, with what is actually inside it.
 *
 * Read-only. Opens each one and counts its rows, because size and date
 * cannot tell a good payload from a nearly empty one - the file that
 * rebuilt the tabs down to a single agent was valid JSON in the right
 * shape, and only its row count gave it away.
 *
 * Run this when the numbers look wrong, to find which file did it.
 */
function slpPayloadList() {
  var name = (typeof SLPA_FILE !== 'undefined' && SLPA_FILE) ? SLPA_FILE : 'slp_payload.json';
  var folderId = PropertiesService.getScriptProperties().getProperty('SLP_FOLDER_ID');

  Logger.log('--- every file called ' + name + ' ---');
  if (!folderId) Logger.log('SLP_FOLDER_ID is not set, so "where" cannot be reported.');

  var it;
  try { it = DriveApp.getFilesByName(name); }
  catch (e) { Logger.log('cannot search Drive: ' + e.message); return; }

  var rows = [];
  while (it.hasNext()) {
    var f = it.next();
    var rec = {
      when: f.getLastUpdated(),
      kb: Math.round(f.getSize() / 1024),
      trashed: !!(f.isTrashed && f.isTrashed()),
      where: '?', n: null, snap: '', ver: 0, id: f.getId()
    };

    if (folderId) {
      rec.where = 'elsewhere';
      try {
        var p = f.getParents();
        while (p.hasNext()) { if (p.next().getId() === folderId) { rec.where = 'feed folder'; break; } }
      } catch (e) {}
    }

    try {
      var pay = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
      rec.n = slp_rowCount_(pay);
      rec.snap = String(pay.snapshot || '');
      rec.ver = slp_payloadVersion_(pay);
    } catch (e) { rec.n = -1; }

    rows.push(rec);
  }

  if (!rows.length) { Logger.log('none found.'); return; }
  rows.sort(function (a, b) { return b.when - a.when; });

  var best = 0;
  rows.forEach(function (r) { if (r.n > best) best = r.n; });

  Logger.log('');
  Logger.log('uploaded            size   rows   v  where         state');
  rows.forEach(function (r) {
    var flag = '';
    if (r.trashed) flag = 'in Trash';
    else if (r.n === -1) flag = 'UNREADABLE';
    else if (best && r.n < best * SLP_SHRINK_FLOOR) flag = '<-- SUSPECT, far fewer rows';
    Logger.log('  ' +
      Utilities.formatDate(r.when, 'Asia/Kolkata', 'dd MMM HH:mm') + '   ' +
      (r.kb + ' KB').slice(0, 7) + '  ' +
      String(r.n).slice(0, 6) + '   ' + r.ver + '  ' +
      (r.where + '            ').slice(0, 13) + ' ' + flag);
  });

  Logger.log('');
  Logger.log('The newest file is the one the workbook will use. If it is marked');
  Logger.log('SUSPECT, the routine wrote a bad payload - fix the routine rather');
  Logger.log('than the workbook, then let the next run replace it.');
}


/* ================================================================
   7.  CHECK IT YOURSELF

   Read-only. Says which version is in Drive, which is in the sheet,
   whether the normaliser is wired in, and what to do next.
   ================================================================ */
function slpPayloadCheck() {
  Logger.log('--- SuperLeap payload check ---');

  var stored = slp_storedPayload_();
  if (!stored) {
    Logger.log('in the sheet : nothing stored in ' + SLP_RAW + ' yet');
  } else {
    Logger.log('in the sheet : v' + slp_payloadVersion_(stored) +
               '   snapshot ' + slp_stamp_(stored.snapshot));
    Logger.log('               ' + ((stored.disp && stored.disp.length) || 0) + ' disp rows, ' +
               ((stored.stage && stored.stage.length) || 0) + ' stage rows, ' +
               ((stored.rows && stored.rows.length) || 0) + ' named rows');
    var m = (stored.months && stored.months.length) ? stored.months.join(', ') : '(none - this payload has no month in it)';
    Logger.log('               months: ' + m);
    var s = (stored.sources && stored.sources.length) || 0;
    Logger.log('               workshops: ' + (s ? s + ' distinct' : '(none - this payload has no workshop code in it)'));
  }

  var file = null;
  try { file = slpa_newestPayload_(); }
  catch (e) { Logger.log('in Drive     : could not look - ' + e.message); }

  if (!file) {
    Logger.log('in Drive     : no payload file found');
  } else {
    var text = '';
    try { text = file.getBlob().getDataAsString('UTF-8'); }
    catch (e) { Logger.log('in Drive     : could not read - ' + e.message); return; }

    var pay = null;
    try { pay = JSON.parse(text); }
    catch (e) { Logger.log('in Drive     : not valid JSON - ' + e.message); return; }

    var dv = slp_payloadVersion_(pay);
    Logger.log('in Drive     : v' + dv + '   ' + Math.round(text.length / 1024) + ' KB' +
               '   snapshot ' + slp_stamp_(pay.snapshot));

    if (dv === 0) {
      Logger.log('');
      Logger.log('VERDICT      : the file in Drive is not a shape this script knows.');
      Logger.log('               Nothing will be rebuilt from it. Check what the');
      Logger.log('               routine wrote before changing anything here.');
      return;
    }

    var wiring = slp_wiringState_(stored, pay);
    Logger.log('normaliser   : ' + wiring.state);
    if (wiring.why) Logger.log('               ' + wiring.why);

    var files = slp_payloadFiles_();
    Logger.log('files        : ' + files.live + ' live, ' + files.trashed + ' in Trash' +
      (files.folderId ? '   (' + files.inFolder + ' in the feed folder, ' +
                        files.elsewhere + ' elsewhere)'
                      : '   (SLP_FOLDER_ID not set, so the whole Drive is searched)'));

    if (files.trashed) {
      Logger.log('               slpLoadFromDrive counts Trash and will say "' +
                 (files.live + files.trashed) + ' files"; only ' + files.live + ' are real.');
    }
    if (files.newestAny && files.newestAny.trashed) {
      Logger.log('               WARNING: the newest file by date is IN TRASH.');
      Logger.log('               slpLoadFromDrive does not skip trashed files, so it');
      Logger.log('               would load that one. slpAutoRefresh is unaffected.');
    }
    if (!files.folderId) {
      Logger.log('               Set SLP_FOLDER_ID to the feed folder so a stray');
      Logger.log('               slp_payload.json elsewhere in Drive cannot be picked up.');
    }
    if (files.elsewhere) {
      Logger.log('               ' + files.elsewhere + ' file(s) sit OUTSIDE the feed folder. ' +
                 'slpLoadFromDrive');
      Logger.log('               searches the whole Drive and would use one if it were newest.');
    }

    var rejected = PropertiesService.getScriptProperties().getProperty('SLP_LAST_REJECT');
    if (rejected) {
      Logger.log('');
      Logger.log('last refusal : ' + rejected);
    }

    var lastRows = PropertiesService.getScriptProperties().getProperty('SLP_LAST_GOOD_ROWS');
    if (lastRows) Logger.log('row baseline : ' + lastRows + ' (a payload below half of this is refused)');

    Logger.log('');
    if (dv === 1) {
      Logger.log('VERDICT      : v1. This is what the readers were written for, so');
      Logger.log('               nothing is broken and nothing is urgent.');
      Logger.log('               No month and no workshop code in this payload, so');
      Logger.log('               the current-month report and the month dropdown');
      Logger.log('               have nothing to work from yet.');
      Logger.log('');
      if (wiring.state === 'WIRED IN') {
        Logger.log('NEXT         : the workbook side is ready. Point the routine at');
        Logger.log('               superleap-routine-prompt-v3.md whenever you want');
        Logger.log('               the month. Everything switches on by itself.');
      } else {
        Logger.log('NEXT         : make the two edits in the header of this file');
        Logger.log('               FIRST, then switch the routine to v3. Doing it');
        Logger.log('               the other way round stops the pipeline without');
        Logger.log('               an error message.');
      }
    } else {
      Logger.log('VERDICT      : v' + dv + '. The readers cannot use this on their own.');
      if (wiring.state === 'WIRED IN') {
        Logger.log('               The normaliser is wired in, so this is handled.');
      } else {
        Logger.log('               slp_normalisePayload_ is NOT wired in. The workbook');
        Logger.log('               is showing its last good numbers and will keep');
        Logger.log('               doing so, silently. Make the two edits in the');
        Logger.log('               header of this file now.');
      }
    }
  }
}


/* ================================================================
   7.  PROVE THE CONVERSION, WITHOUT A PAYLOAD

   Runs the three shapes through the normaliser on made-up numbers and
   checks the totals survive. Run it after any edit to this file.
   ================================================================ */
function slpPayloadSelfTest() {
  var fails = [];
  function eq(what, got, want) {
    if (String(got) !== String(want)) fails.push(what + ': got ' + got + ', wanted ' + want);
  }

  /* The guard is switched off for the duration, and put back in a finally
     so a thrown assertion cannot leave it off. Without this the test
     cannot run in any workbook that has seen real data - its two-row
     fixtures are exactly what the guard exists to refuse - and it would
     write its fixture row counts into the live baseline on the way. */
  SLP_IN_SELFTEST = true;
  try {

  var v1 = { snapshot: 'x', disp: [['Ann', 'a@x', 'Prospect', 3], ['Ann', '', '', 2]],
             stage: [['Ann', 'Lead', 5]], sub: [['Ann', 'PTP', 3]] };
  var o1 = JSON.parse(slp_normalisePayload_(JSON.stringify(v1)));
  eq('v1 version', slp_payloadVersion_(v1), 1);
  eq('v1 disp untouched', o1.disp.length, 2);
  eq('v1 months empty', o1.months.length, 0);

  var v2 = { snapshot: 'x',
             disp: [['Ann', 'a@x', 'C160', 'Prospect', 3], ['Ann', '', 'C161', 'Prospect', 4]],
             stage: [['Ann', 'C160', 'Lead', 7]],
             sub: [['Ann', 'C160', 'PTP', 3]] };
  var o2 = JSON.parse(slp_normalisePayload_(JSON.stringify(v2)));
  eq('v2 detected', slp_payloadVersion_(v2), 2);
  eq('v2 disp width', o2.disp[0].length, 4);
  eq('v2 disp count kept', o2.disp[0][3], 3);
  eq('v2 disp name kept', o2.disp[0][2], 'Prospect');
  eq('v2 sources found', o2.sources.join(','), 'C160,C161');
  eq('v2 stage width', o2.stage[0].length, 3);

  var v3 = { version: 3, snapshot: 'x', months: ['2026-07', '2026-08'], rows: [
    { agent: 'Ann', email: 'a@x', source: 'C160', month: '2026-07',
      stage: 'Lead', disposition: 'Prospect', sub: 'PTP', n: 3 },
    { agent: 'Ann', email: 'a@x', source: 'C161', month: '2026-08',
      stage: 'Lead', disposition: 'Prospect', sub: '', n: 4 },
    { agent: 'Ann', email: 'a@x', source: 'C161', month: '2026-08',
      stage: 'Non Contact', disposition: '', sub: '', n: 5 }
  ] };
  var o3 = JSON.parse(slp_normalisePayload_(JSON.stringify(v3)));
  eq('v3 detected', slp_payloadVersion_(v3), 3);
  eq('v3 disp rolled up', o3.disp.length, 2);              // Prospect 7, "" 5
  eq('v3 prospect total', o3.disp[1][3], 7);               // '' sorts before 'Prospect'
  eq('v3 blank disp kept', o3.disp[0][3], 5);
  eq('v3 email on every row', o3.disp[0][1], 'a@x');
  eq('v3 stage rolled up', o3.stage.length, 2);            // Lead 7, Non Contact 5
  eq('v3 sub only when set', o3.sub.length, 1);
  eq('v3 sub total', o3.sub[0][2], 3);
  eq('v3 months', o3.months.join(','), '2026-07,2026-08');
  eq('v3 sources', o3.sources.join(','), 'C160,C161');
  eq('v3 rows kept', o3.rows.length, 3);

  var total3 = 0;
  o3.disp.forEach(function (r) { total3 += Number(r[3]); });
  eq('v3 totals survive', total3, 12);

  eq('current month', slp_currentMonth_(o3), '2026-08');
  eq('rows for Aug', slp_rowsForMonth_(o3, '2026-08').length, 2);
  eq('rows for all', slp_rowsForMonth_(o3, '').length, 3);
  eq('v1 has no rows to filter', slp_rowsForMonth_(o1, '2026-08').length, 0);

  eq('unknown shape passes through', slp_normalisePayload_('{"nope":1}'), '{"nope":1}');

  /* The shipped v3: v1's three rollups untouched, plus a short-keyed rows
     array carrying only the month and workshop dimension. The first draft
     put every dimension in rows with long keys and reached a megabyte,
     which create_file could not take. Both shapes must still read. */
  var v3s = {
    version: 3, snapshot: 'x', months: ['2026-07', '2026-08'],
    disp:  [['Ann', 'a@x', 'Prospect', 30], ['Ann', '', '', 5]],
    stage: [['Ann', 'Lead', 35]],
    sub:   [['Ann', 'PTP', 12]],
    rows: [
      { a: 'Ann', m: '2026-07', s: 'C160', d: 'Prospect', n: 10 },
      { a: 'Ann', m: '2026-08', s: 'C161', d: 'Prospect', n: 20 },
      { a: 'Ann', m: '2026-08', s: 'C161', d: '', n: 5 }
    ]
  };
  var os = JSON.parse(slp_normalisePayload_(JSON.stringify(v3s)));

  eq('shipped v3 detected', slp_payloadVersion_(v3s), 3);
  eq('v1 rollups passed through untouched', JSON.stringify(os.disp), JSON.stringify(v3s.disp));
  eq('stage untouched', JSON.stringify(os.stage), JSON.stringify(v3s.stage));
  eq('sub untouched', JSON.stringify(os.sub), JSON.stringify(v3s.sub));
  eq('months read from rows', os.months.join(','), '2026-07,2026-08');
  eq('sources read from rows', os.sources.join(','), 'C160,C161');
  eq('short keys expanded to agent', os.rows[0].agent, 'Ann');
  eq('short keys expanded to month', os.rows[1].month, '2026-08');
  eq('short keys expanded to source', os.rows[1].source, 'C161');
  eq('short keys expanded to disposition', os.rows[1].disposition, 'Prospect');
  eq('blank disposition survives expansion', os.rows[2].disposition, '');
  eq('current month', slp_currentMonth_(os), '2026-08');
  eq('rows for Aug', slp_rowsForMonth_(os, '2026-08').length, 2);
  eq('Aug leads', slp_rowsForMonth_(os, '2026-08').reduce(
      function (s, r) { return s + r.n; }, 0), 25);

  // long-key rows must still work, so a payload written to either spec reads
  var mixed = { version: 3, snapshot: 'x', disp: [['Bo', 'b@x', 'Lead', 4]],
    rows: [{ agent: 'Bo', month: '2026-08', source: 'C1', disposition: 'Lead', n: 4 }] };
  var om = JSON.parse(slp_normalisePayload_(JSON.stringify(mixed)));
  eq('long keys still accepted', om.rows[0].agent, 'Bo');
  eq('long-key month', om.rows[0].month, '2026-08');

  // a row with no agent is dropped rather than becoming "(no owner)" noise
  var junk = { version: 3, snapshot: 'x', disp: [['Bo', '', 'Lead', 1]],
    rows: [{ m: '2026-08', n: 5 }, { a: 'Bo', m: '2026-08', d: 'Lead', n: 1 }] };
  eq('agentless row dropped',
     JSON.parse(slp_normalisePayload_(JSON.stringify(junk))).rows.length, 1);

  /* The wiring check. A payload straight from the routine has no version
     key; anything the normaliser touched has one. */
  var routineV1 = { snapshot: 'S1', disp: [['Ann', 'a@x', 'Prospect', 3]] };
  var normalised = JSON.parse(slp_normalisePayload_(JSON.stringify(routineV1)));

  eq('wiring: normalised payload is detected as wired',
     slp_wiringState_(normalised, { snapshot: 'S1' }).state, 'WIRED IN');
  eq('wiring: raw payload, same snapshot as Drive, is detected as not wired',
     slp_wiringState_(routineV1, { snapshot: 'S1' }).state, 'NOT WIRED IN');
  eq('wiring: raw payload older than Drive is not called either way',
     slp_wiringState_(routineV1, { snapshot: 'S2' }).state, 'cannot tell yet');
  eq('wiring: nothing stored',
     slp_wiringState_(null, { snapshot: 'S1' }).state, 'unknown');
  eq('wiring: v3 payload is wired by construction',
     slp_wiringState_(o3, { snapshot: 'x' }).state, 'WIRED IN');

  /* The shrink guard, tested as the arithmetic it is. slp_guardShrink_
     itself reads and writes script properties, so calling it here would
     mean a diagnostic editing live state - which is the bug this section
     was rewritten to remove. */
  eq('shrink: no baseline yet', slp_shrinkVerdict_(5, 0, null), 'first');
  eq('shrink: baseline too small to trust', slp_shrinkVerdict_(5, 10, null), 'first');
  eq('shrink: the 674 -> 5 collapse is refused', slp_shrinkVerdict_(5, 674, null), 'refuse');
  eq('shrink: growth 674 -> 703 is fine', slp_shrinkVerdict_(703, 674, null), 'ok');
  eq('shrink: exactly half is allowed', slp_shrinkVerdict_(337, 674, null), 'ok');
  eq('shrink: just under half is refused', slp_shrinkVerdict_(336, 674, null), 'refuse');
  eq('shrink: override accepts it', slp_shrinkVerdict_(5, 674, 'yes'), 'override');
  eq('shrink: override is case and space tolerant',
     slp_shrinkVerdict_(5, 674, '  YES '), 'override');
  eq('shrink: a v1 payload after v3 looks like a collapse',
     slp_shrinkVerdict_(674, 12000, null), 'refuse');

  } finally {
    SLP_IN_SELFTEST = false;
  }

  if (fails.length) {
    Logger.log('SELF TEST FAILED');
    fails.forEach(function (f) { Logger.log('  ' + f); });
  } else {
    Logger.log('SELF TEST PASSED - v1, v2 and v3 all normalise, totals intact.');
  }
  return fails;
}
