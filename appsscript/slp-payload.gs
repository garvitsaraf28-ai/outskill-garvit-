/**
 * SlpPayload.gs - one door for every SuperLeap payload shape.
 *
 * WHY THIS FILE EXISTS
 *
 *   The routine that queries SuperLeap and the workbook that reads the
 *   result are two separate programs that have to agree on a file format.
 *   They have disagreed four times already:
 *
 *     v1  disp  [agent, email, disposition, n]          <- what the readers know
 *         stage [agent, stage, n]
 *         sub   [agent, sub, n]
 *
 *     v2  disp  [agent, email, source, disposition, n]  <- source inserted at 2
 *         stage [agent, source, stage, n]
 *         sub   [agent, source, sub, n]
 *
 *     v3  rows  [{a,m,s,b,n}, ...]   short keys; b is the lead's outcome
 *         version: 3
 *
 *     v4  dict  {a:[names], e:[emails], o:[outcomes], g:[stages], s:[sources]}
 *         rows  [[agentIdx, monthIdx, sourceIdx, outcomeIdx, n], ...]
 *         version: 4
 *
 *   A v2 file read by a v1 reader does not error. It reads the workshop
 *   code as the disposition and the disposition as the count, so every
 *   number becomes NaN and the tab fills with nonsense that looks like
 *   data. A v3 file read by a v1 reader is worse in a quieter way: there
 *   is no "disp" key at all, so slpAutoRefresh stops at its guard, logs
 *   "payload has no disposition rows", and the workbook sits on its last
 *   good numbers indefinitely while appearing to run fine every two hours.
 *
 *   v4 exists for a different reason: size. v3 spells every agent name,
 *   email and outcome out on every row they appear on, and at 148,006
 *   leads that came to 554,331 bytes - which the routine could not
 *   upload, because create_file takes the whole file as one tool-call
 *   argument. v4 writes each distinct string once and refers to it by
 *   position: the same payload, 389 KB down to 100 KB.
 *
 *   So the readers have to understand a version BEFORE the routine starts
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
 *     .sources                 every lead source present
 *     .bucket                  on each row, the lead's outcome
 *     .batches                 batch codes per month, when the payload has them
 *     .version                 the version that arrived (1, 2, 3 or 4)
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

  /* v4 replaces the repeated strings with indexes into a dictionary, so
     it is recognised by carrying one. Checked first: a v4 file also has
     rows and would otherwise be read as v3 and expand to nonsense. */
  if (Number(pay.version) === 4 || (pay.dict && typeof pay.dict === 'object')) return 4;

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

  if (v === 4) {
    /* Expand the dictionary back to strings, then hand the result to the
       v3 conversion - v4 is v3 with the repetition squeezed out, not a
       different set of facts, so it must not grow a second reader. */
    pay = slp_v3ToV1_(slp_v4ToV3_(pay));
    pay.version = 4;
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
 * How many LEADS a payload accounts for, whatever shape it is in.
 *
 * This is what the shrink guard should be watching, not the row count.
 * The two agree about truncation - the five-row payload carried 123
 * leads against 82,811 - but they disagree about a payload that is
 * deliberately reshaped. When the file is too big to deliver the routine
 * is told to re-roll it at a coarser grain, which drops rows sharply
 * while every lead is still counted. Guarding on rows would refuse
 * exactly the payload the size rule just asked for.
 *
 * Read from the LAST field of each row, which is where the count sits in
 * v1, v2 and v4 alike, so this works before any conversion has run.
 */
function slp_leadTotal_(pay) {
  if (!pay) return 0;
  var t = 0, any = false;

  var d = pay.disp || [];
  for (var i = 0; i < d.length; i++) {
    var r = d[i];
    if (!r || r.length === undefined) continue;
    var n = Number(r[r.length - 1]);
    if (isFinite(n)) { t += n; any = true; }
  }
  if (any) return t;

  var rows = pay.rows || [];
  for (var j = 0; j < rows.length; j++) {
    var q = rows[j];
    if (!q) continue;
    var m = (q.n !== undefined) ? Number(q.n)
          : (q.length !== undefined ? Number(q[q.length - 1]) : NaN);
    if (isFinite(m)) { t += m; any = true; }
  }
  return any ? t : 0;
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

  /* Leads, not rows - see slp_leadTotal_. Falls back to the row count for
     a payload whose counts cannot be read at all, so a shape nobody has
     seen before is still guarded rather than waved through. */
  var leads = slp_leadTotal_(pay);
  var now = leads || slp_rowCount_(pay);
  var unit = leads ? ' leads' : ' rows';
  var last = Number(P.getProperty('SLP_LAST_GOOD_LEADS') || 0);
  var allow = P.getProperty('SLP_ALLOW_SHRINK');

  /* No baseline, but the workbook is already holding a payload.
   *
   * This is the state every workbook was in the moment the guard moved
   * from rows to leads: SLP_LAST_GOOD_LEADS had never been written, so
   * the verdict was 'first' and the very next payload was accepted
   * whatever was in it - and then BECAME the baseline. A truncated one
   * would have set the bar at its own size and gone on being accepted.
   * That is the 17 Aug incident with the guard removed.
   *
   * The count is recoverable rather than lost: the payload the workbook
   * is holding right now is, by definition, the last one accepted. Read
   * the baseline back off it and the window never opens. Nothing to set
   * by hand, and it self-heals on any workbook that upgrades later.
   *
   * Note what is being read here: slp_guardShrink_ runs BEFORE the new
   * payload is stored, so the stored one is still the PREVIOUS good one.
   */
  if (!last) {
    try {
      var held = slp_storedPayload_();
      if (held) last = slp_leadTotal_(held);
    } catch (e) {
      /* Nothing stored, or the reader is not in this project. Falls
         through to 'first', which is the honest answer for a workbook
         that genuinely has no history. */
    }
  }

  function remember() {
    P.setProperty('SLP_LAST_GOOD_LEADS', String(now));
    P.setProperty('SLP_LAST_GOOD_ROWS', String(slp_rowCount_(pay)));
    P.setProperty('SLP_LAST_GOOD_VERSION', String(version));
  }

  switch (slp_shrinkVerdict_(now, last, allow)) {
    case 'first':
      if (now) remember();
      return;

    case 'ok':
      remember();
      P.deleteProperty('SLP_LAST_REJECT');
      return;

    case 'override':
      P.deleteProperty('SLP_ALLOW_SHRINK');
      remember();
      P.setProperty('SLP_LAST_REJECT',
        'ACCEPTED a shrink from ' + last + ' to ' + now + unit + ' because ' +
        'SLP_ALLOW_SHRINK was set. That override has now been cleared.');
      return;
  }

  /* A drop from v3 to v1 is not a failed query, it is the routine having
     gone back to the old prompt - and the row count collapses either way,
     so the generic message would send somebody to look at SuperLeap when
     the fix is in the routine's saved prompt. Name the real cause. */
  var lastVer = Number(P.getProperty('SLP_LAST_GOOD_VERSION') || 0);
  if (lastVer >= 3 && version < 3) {
    var vwhy = 'REFUSED a v' + version + ' payload. The last good one was v' +
      lastVer + ', ' +
      'so the routine has gone back to a prompt that does not select the ' +
      'month. This is almost always the saved prompt never having been ' +
      'updated: a run started by hand uses what you paste, but the schedule ' +
      'uses what is stored. The workbook kept its v3 data rather than losing ' +
      'the month, which means it will now stop updating until this is fixed. ' +
      'Update the routine\'s saved prompt to superleap-routine-prompt-v5.md. ' +
      'To accept v1 and give up the month page, set SLP_ALLOW_SHRINK to yes.';
    P.setProperty('SLP_LAST_REJECT', vwhy);
    throw new Error(vwhy);
  }

  var why = 'REFUSED a v' + version + ' payload with ' + now + unit +
    ' where the last good one had ' + last +
    '. A payload that loses most of its leads is a failed query far more ' +
    'often than it is real news, so the workbook kept its previous ' +
    'numbers rather than rebuilding the tabs and the Slack report from ' +
    'almost nothing. Note this counts leads, not rows: a payload re-rolled ' +
    'at a coarser grain to fit the upload limit has far fewer rows and the ' +
    'same leads, and passes. If the drop is genuine, set the script property ' +
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

  return slp_keepExtras_(pay, {
    version: 2,
    snapshot: pay.snapshot || '',
    from: pay.from || '',
    today_count: (pay.today_count === undefined ? null : pay.today_count),
    today_by_agent: pay.today_by_agent || [],
    months: [],
    sources: Object.keys(sources).sort(),
    disp: disp, stage: stage, sub: sub,
    rows: rows
  });
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
  var b = r.b !== undefined ? r.b : r.bucket;
  return {
    agent: String(agent),
    month: String((r.m !== undefined ? r.m : r.month) || ''),
    source: String((r.s !== undefined ? r.s : r.source) || ''),
    /* A payload that sends the outcome and no separate disposition would
       otherwise leave every reader of .disposition with a blank - the
       month page's whole breakdown column among them. The outcome is the
       finer answer to the same question, so stand it in. A payload that
       does send a disposition is left exactly as it was. */
    disposition: (d === undefined || d === null || d === '')
                   ? ((b === undefined || b === null) ? '' : String(b))
                   : String(d),
    /* The lead's outcome: its sub-disposition where it has one and its
       disposition where it does not. The lead report puts one column per
       distinct value, so a row that loses this lands in a single "(none)"
       column and the whole table collapses to one number per agent. That
       is exactly what happened when this line was missing. */
    bucket: (b === undefined || b === null) ? '' : String(b),
    stage: String(r.stage || ''),
    sub: String(r.sub || ''),
    email: String(r.email || ''),
    n: Number(r.n || 0)
  };
}


/**
 * Copy across every top-level key the conversion did not rebuild.
 *
 * The conversions used to return a fresh object listing the keys they knew
 * about, which silently deleted anything else the routine had sent - the
 * batch codes went that way, and nothing said so. Carrying the unknown keys
 * makes the normaliser additive: a new field reaches the readers on the day
 * the routine starts sending it, without a change here.
 *
 * Known keys win, because the conversion computed them deliberately.
 */
function slp_keepExtras_(src, built) {
  if (!src) return built;
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    if (Object.prototype.hasOwnProperty.call(built, k)) continue;
    built[k] = src[k];
  }
  return built;
}

function slp_v3ToV1_(pay) {
  var raw = pay.rows || [];
  var rows = [];
  for (var i = 0; i < raw.length; i++) {
    var m = slp_monthRow_(raw[i]);
    if (m) rows.push(m);
  }

  /* The shipped v3 carries disp, stage and sub exactly as v1 does, and adds
     rows only for the month and source dimension. Keeping those three
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
    return slp_keepExtras_(pay, {
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
    });
  }

  var dAgg = {}, sAgg = {}, bAgg = {};
  var dOrder = [], sOrder = [], bOrder = [];
  var emails = {};

  rows.forEach(function (r) {
    var agent = String(r.agent || '(no owner)');
    var n = Number(r.n || 0);
    /* Already carries the outcome where no disposition was sent -
       slp_monthRow_ stood it in on the way through. */
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

  return slp_keepExtras_(pay, {
    version: 3,
    snapshot: pay.snapshot || '',
    from: pay.from || '',
    today_count: (pay.today_count === undefined ? null : pay.today_count),
    today_by_agent: pay.today_by_agent || [],
    months: monthList,
    sources: Object.keys(sources).sort(),
    disp: disp, stage: stage, sub: sub,
    rows: rows
  });
}


/* ================================================================
   4b.  v4 -> v3

   WHY THIS FORMAT EXISTS

   v3 spells every agent name, email and outcome out on every row it
   appears on. At 148,006 leads that came to 554,331 bytes, and the
   routine has no way to hand a file to Drive except by typing it out as
   one tool-call argument. It could not, so on 18 Aug it correctly
   refused to upload rather than write a file that was silently cut in
   half - the workbook's timer would have read it.

   v4 says the same things with indexes. "Satyam Aditya Samant" is
   written once in dict.a and is a small number everywhere after. The
   strings are most of the file, so this is roughly a fourfold cut with
   no facts given up.

   Expanding it here means the readers never learn about any of it.
   ================================================================ */

/**
 * One index back to its string.
 *
 * An index the dictionary cannot answer becomes "", never "undefined"
 * and never a number - a bad index should cost one blank cell, not put
 * the word undefined in a report or shift a whole row.
 */
function slp_fromDict_(list, i) {
  if (i === undefined || i === null || i === '') return '';
  var n = Number(i);
  if (!isFinite(n) || n < 0 || n >= list.length) return '';
  var v = list[n];
  return (v === undefined || v === null) ? '' : String(v);
}

function slp_v4ToV3_(pay) {
  var D = pay.dict || {};
  var A = D.a || [];             // agent names
  var E = D.e || [];             // emails
  var O = D.o || [];             // outcomes and dispositions
  var G = D.g || [];             // stages
  var S = D.s || [];             // sources
  var M = pay.months || [];      // months index straight into this

  var disp = (pay.disp || []).map(function (r) {
    return [slp_fromDict_(A, r[0]), slp_fromDict_(E, r[1]),
            slp_fromDict_(O, r[2]), Number(r[3] || 0)];
  });
  var stage = (pay.stage || []).map(function (r) {
    return [slp_fromDict_(A, r[0]), slp_fromDict_(G, r[1]), Number(r[2] || 0)];
  });
  var sub = (pay.sub || []).map(function (r) {
    return [slp_fromDict_(A, r[0]), slp_fromDict_(O, r[1]), Number(r[2] || 0)];
  });
  var rows = (pay.rows || []).map(function (r) {
    return { a: slp_fromDict_(A, r[0]), m: slp_fromDict_(M, r[1]),
             s: slp_fromDict_(S, r[2]), b: slp_fromDict_(O, r[3]),
             n: Number(r[4] || 0) };
  });

  /* today_by_agent is a hundred-odd entries either way, so v4 leaves it
     as named objects. An indexed form is accepted too rather than
     rejected over a detail that costs nothing. */
  var today = (pay.today_by_agent || []).map(function (t) {
    if (t && t.length !== undefined && typeof t !== 'string') {
      return { agent: slp_fromDict_(A, t[0]), n: Number(t[1] || 0) };
    }
    return t;
  });

  var out = slp_keepExtras_(pay, {
    version: 3,
    snapshot: pay.snapshot || '',
    from: pay.from || '',
    today_count: (pay.today_count === undefined ? null : pay.today_count),
    today_by_agent: today,
    months: M.slice(),
    disp: disp, stage: stage, sub: sub, rows: rows
  });
  delete out.dict;               // spent; carrying it on would double the size
  return out;
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
    Logger.log('               sources: ' + (s ? s + ' distinct   ' + stored.sources.join(', ')
                                               : '(none - this payload has no source in it)'));
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

      /* A refusal on its own is fine - the workbook kept good numbers. A
         refusal of the file that is currently newest is not, because
         there is nothing left to accept: every run from here refuses the
         same file and the tabs never move again. */
      if (stored && String(pay.snapshot || '') !== String(stored.snapshot || '')) {
        Logger.log('');
        Logger.log('!! THE WORKBOOK HAS STOPPED UPDATING. The newest file in Drive is');
        Logger.log('   the one that was refused, so nothing newer can arrive to');
        Logger.log('   replace it. The tabs are frozen on ' + slp_stamp_(stored.snapshot) + '.');
      }
    }

    /* Report the number the guard actually decides on. It used to say
       "row baseline", which stopped being true when the guard moved to
       leads - a diagnostic naming the wrong rule is worse than none,
       because it is read during an incident. Rows are still shown,
       labelled as what they are: context, not the threshold. */
    var PS = PropertiesService.getScriptProperties();
    var lastLeads = PS.getProperty('SLP_LAST_GOOD_LEADS');
    var lastRows = PS.getProperty('SLP_LAST_GOOD_ROWS');
    if (lastLeads) {
      Logger.log('lead baseline: ' + lastLeads +
                 ' (a payload below half of this is refused)');
    } else {
      Logger.log('lead baseline: not set yet - it will be read back off the');
      Logger.log('               payload the workbook is holding, so the guard');
      Logger.log('               is active from the next load onwards.');
    }
    if (lastRows) Logger.log('rows last ok : ' + lastRows + ' (context only, not the threshold)');

    Logger.log('');
    if (dv === 1) {
      Logger.log('VERDICT      : v1. This is what the readers were written for, so');
      Logger.log('               nothing is broken and nothing is urgent.');
      Logger.log('               No month and no source in this payload, so');
      Logger.log('               the current-month report and the month dropdown');
      Logger.log('               have nothing to work from yet.');
      Logger.log('');
      if (wiring.state === 'WIRED IN') {
        Logger.log('NEXT         : the workbook side is ready. Point the routine at');
        Logger.log('               superleap-routine-prompt-v5.md whenever you want');
        Logger.log('               the month, the outcome and the batch codes.');
        Logger.log('               Everything switches on by itself.');
      } else {
        Logger.log('NEXT         : make the two edits in the header of this file');
        Logger.log('               FIRST, then switch the routine to v5. Doing it');
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
     array carrying only the month and source dimension. The first draft
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

  /* ---- the two things the normaliser used to throw away ----

     Both shipped, and both showed up the same way: a lead report where
     every lead sat in one column called "(none)" and no batch codes at the
     top. The cause was a conversion that returned a fresh object listing
     the keys it knew about, so "batches" was deleted, and a row expander
     that never mapped the outcome. Neither failed loudly. These four
     assertions are the ones that would have. */
  var withB = {
    version: 3, snapshot: 'x', months: ['2026-08'],
    batches: { '2026-08': ['C162 16th Aug 2026', 'BC14 4th August 2026'] },
    rows: [
      { a: 'Ann', m: '2026-08', b: 'Non Contact-2', n: 7 },
      { a: 'Ann', m: '2026-08', b: 'PTP', n: 3 },
      { a: 'Bo',  m: '2026-08', bucket: 'Lead', n: 4 }
    ]
  };
  var ob = JSON.parse(slp_normalisePayload_(JSON.stringify(withB)));
  eq('short-key outcome survives', ob.rows[0].bucket, 'Non Contact-2');
  eq('long-key outcome survives', ob.rows[2].bucket, 'Lead');
  eq('batches survive the conversion',
     (ob.batches && ob.batches['2026-08'] || []).length, 2);
  /* With no disposition sent, the outcome stands in, so the rollups say
     something rather than one blank row per agent. */
  eq('outcome stands in for a missing disposition', ob.disp.length, 3);

  /* ---- v4, the indexed form ----

     The routine could not upload a 554 KB payload: create_file takes the
     whole file as one tool-call argument and it truncated silently. v4
     says exactly the same things with indexes into a dictionary and
     comes to about a quarter of the size. "Exactly the same things" is
     the claim being tested here - the same payload written both ways
     must normalise to the same object. */
  var pairV3 = {
    version: 3, snapshot: 's', months: ['2026-07', '2026-08'],
    batches: { '2026-08': ['C162'] },
    disp:  [['Ann', 'a@x', 'Prospect', 30], ['Bo', 'b@x', 'Lead', 5]],
    stage: [['Ann', 'Lead', 30]],
    sub:   [['Ann', 'PTP', 12]],
    rows: [
      { a: 'Ann', m: '2026-08', s: 'Website', b: 'Non Contact-2', n: 20 },
      { a: 'Bo',  m: '2026-07', s: 'Manual',  b: 'Lead',          n: 5 }
    ]
  };
  var pairV4 = {
    version: 4, snapshot: 's', months: ['2026-07', '2026-08'],
    batches: { '2026-08': ['C162'] },
    dict: { a: ['Ann', 'Bo'], e: ['a@x', 'b@x'],
            o: ['Prospect', 'Lead', 'Non Contact-2', 'PTP'],
            g: ['Lead'], s: ['Website', 'Manual'] },
    disp:  [[0, 0, 0, 30], [1, 1, 1, 5]],
    stage: [[0, 0, 30]],
    sub:   [[0, 3, 12]],
    rows:  [[0, 1, 0, 2, 20], [1, 0, 1, 1, 5]]
  };
  eq('v4 detected by its dictionary', slp_payloadVersion_(pairV4), 4);
  eq('a dictionary alone is enough to detect it',
     slp_payloadVersion_({ dict: {}, disp: [['A', '', 'L', 1]] }), 4);

  var n3 = JSON.parse(slp_normalisePayload_(JSON.stringify(pairV3)));
  var n4 = JSON.parse(slp_normalisePayload_(JSON.stringify(pairV4)));
  function shape(o) {
    return JSON.stringify({ disp: o.disp, stage: o.stage, sub: o.sub,
      months: o.months, batches: o.batches,
      rows: o.rows.map(function (r) {
        return [r.agent, r.month, r.source, r.bucket, r.disposition, r.n];
      }) });
  }
  eq('v4 normalises to exactly what v3 does', shape(n4), shape(n3));
  eq('v4 keeps its version so diagnostics can say which arrived', n4.version, 4);
  eq('the dictionary is not carried into storage', n4.dict, undefined);

  /* A bad index must cost one blank cell. Left as a number it would put
     "3" in a report as if it were an agent's name. */
  eq('an index past the end becomes blank', slp_fromDict_(['a', 'b'], 9), '');
  eq('a negative index becomes blank', slp_fromDict_(['a'], -1), '');
  eq('a missing index becomes blank', slp_fromDict_(['a'], null), '');
  eq('a good index resolves', slp_fromDict_(['a', 'b'], 1), 'b');

  /* ---- the guard counts leads, not rows ----

     When the payload is too big to upload the routine re-rolls it at a
     coarser grain: far fewer rows, every lead still counted. Guarding on
     rows would refuse the very payload the size rule just asked for. */
  eq('leads read from a v1 payload',
     slp_leadTotal_({ disp: [['A', '', 'L', 10], ['B', '', 'L', 5]] }), 15);
  eq('leads read from a v2 payload, where n sits one place later',
     slp_leadTotal_({ disp: [['A', '', 'C1', 'L', 10]] }), 10);
  eq('leads read from a v4 payload before it is expanded',
     slp_leadTotal_({ dict: {}, disp: [[0, 0, 0, 10], [1, 1, 0, 5]] }), 15);
  eq('leads fall back to rows when there is no disp',
     slp_leadTotal_({ rows: [{ a: 'A', n: 7 }, { a: 'B', n: 3 }] }), 10);
  eq('a coarser re-roll with the same leads is accepted',
     slp_shrinkVerdict_(147570, 147570, ''), 'ok');
  eq('a truncated payload is still refused',
     slp_shrinkVerdict_(123, 82811, ''), 'refuse');

  /* Same for a v1 payload carrying an unknown key - the v1 path mutates
     rather than rebuilds, so this has always worked, and a test keeps it
     that way. */
  eq('v1 keeps unknown keys',
     JSON.parse(slp_normalisePayload_('{"disp":[["A","","L",1]],"batches":{"x":["c1"]}}'))
       .batches.x[0], 'c1');

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
    Logger.log('SELF TEST PASSED - v1, v2, v3 and v4 all normalise, totals intact.');
  }
  return fails;
}
