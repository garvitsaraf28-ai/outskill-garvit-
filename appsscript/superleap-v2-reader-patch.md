# SuperLeapChurn.gs — accept the v2 payload

`superleap-routine-prompt-v2.md` inserts `source` (the workshop code) into
every payload array. The readers still index the v1 positions, so a v2 payload
does not error — it shifts every field one place left and rebuilds the tab out
of nonsense:

```
v1  disp:  [agent, email,        disposition, count]
v2  disp:  [agent, email, source, disposition, count]

["Arpan Mishra","a@x.com","C160","Non Contact",357]
   read as v1  ->  disposition = "C160"   count = null
```

`Number("Non Contact")` is `NaN`, so `a.total` becomes `NaN` and every
percentage on the tab follows it. `stage` and `sub` shift the same way.

**Do not run the v2 routine until these three edits are in.**

The fix reads the row length rather than assuming a shape, so the same code
handles a v1 payload already sitting in `_slp_raw` and a v2 one arriving
tomorrow. That matters during the changeover: the tab must not break in the
window between the routine switching over and this being pasted.

---

## Edit 1 — `buildSuperLeapChurn`, the `disp` loop

Find:

```js
  pay.disp.forEach(function (r) {
    var a = get(String(r[0] || '(no owner)'), r[1]);
    var d = r[2] ? String(r[2]) : 'Not dispositioned yet';
    a.d[d] = (a.d[d] || 0) + Number(r[3] || 0);
    a.total += Number(r[3] || 0);
  });
```

Replace with:

```js
  pay.disp.forEach(function (r) {
    // v1 is [agent, email, disposition, count]; v2 inserts source at index 2.
    var v2 = r.length >= 5;
    var a = get(String(r[0] || '(no owner)'), r[1]);
    var src = v2 ? String(r[2] || '') : '';
    var d = (v2 ? r[3] : r[2]) ? String(v2 ? r[3] : r[2]) : 'Not dispositioned yet';
    var n = Number((v2 ? r[4] : r[3]) || 0);
    a.d[d] = (a.d[d] || 0) + n;
    a.total += n;
    // Kept per agent per workshop, which is what a workshop filter needs.
    if (src) {
      if (!a.src) a.src = {};
      if (!a.src[src]) a.src[src] = {};
      a.src[src][d] = (a.src[src][d] || 0) + n;
    }
  });
```

## Edit 2 — `buildSuperLeapChurn`, the `stage` loop

Find:

```js
  (pay.stage || []).forEach(function (r) {
    var a = get(String(r[0] || '(no owner)'), '');
    var s = r[1] ? String(r[1]) : '(blank)';
    a.s[s] = (a.s[s] || 0) + Number(r[2] || 0);
  });
```

Replace with:

```js
  (pay.stage || []).forEach(function (r) {
    // v1 is [agent, stage, count]; v2 inserts source at index 1.
    var v2 = r.length >= 4;
    var a = get(String(r[0] || '(no owner)'), '');
    var s = (v2 ? r[2] : r[1]) ? String(v2 ? r[2] : r[1]) : '(blank)';
    a.s[s] = (a.s[s] || 0) + Number((v2 ? r[3] : r[2]) || 0);
  });
```

## Edit 3 — `buildSlpStageView` in SlpAuto.gs, the two loops

Find:

```js
  (pay.stage || []).forEach(function (r) {
    var a = agent(String(r[0] || ''));
    if (!a) return;
    var s = r[1] ? String(r[1]) : '(blank)';
    a.st[s] = (a.st[s] || 0) + Number(r[2] || 0);
    a.tot += Number(r[2] || 0);
  });
  (pay.sub || []).forEach(function (r) {
    var a = agent(String(r[0] || ''));
    if (!a) return;
    var s = String(r[1] || '');
    a.sb[s] = (a.sb[s] || 0) + Number(r[2] || 0);
  });
```

Replace with:

```js
  (pay.stage || []).forEach(function (r) {
    var v2 = r.length >= 4;
    var a = agent(String(r[0] || ''));
    if (!a) return;
    var s = (v2 ? r[2] : r[1]) ? String(v2 ? r[2] : r[1]) : '(blank)';
    var n = Number((v2 ? r[3] : r[2]) || 0);
    a.st[s] = (a.st[s] || 0) + n;
    a.tot += n;
  });
  (pay.sub || []).forEach(function (r) {
    var v2 = r.length >= 4;
    var a = agent(String(r[0] || ''));
    if (!a) return;
    var s = String((v2 ? r[2] : r[1]) || '');
    a.sb[s] = (a.sb[s] || 0) + Number((v2 ? r[3] : r[2]) || 0);
  });
```

---

## After the edits

`slpSelfTest()` rebuilds from whatever payload is stored and prints the agent
and lead counts. Run it once against the current v1 payload: the totals must
be unchanged. If they move, the shape detection is reading something
unexpected and the routine should stay on v1 until that is understood.

## What v2 unlocks

`today_count` and `today_by_agent` are new in v2 and nothing reads them yet —
that is the "dispositions done today" figure.

`source` is the workshop code per agent per disposition. Once it is stored
(edit 1 keeps it on `a.src`), a workshop filter over the SuperLeap tabs
becomes possible for the first time. It could not be built on v1 because the
dimension genuinely was not in the data.
