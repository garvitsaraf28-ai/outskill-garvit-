# Inside Sales Apps Script - full audit

16 October 2026. Written after reading every script available: 33 files you
pasted on 18 September recovered from this conversation's transcript (16,566
lines), the 27 in this repository (14,322 lines), and `ManagementReport.gs`
recovered the same way. About 50 distinct scripts once duplicates between the
two sets are collapsed.

**The recovered 33 are a snapshot of 18 September.** Files have been deleted
and changed since. The three faults in section 2 are architectural and do not
depend on which files exist today, so they stand. **The file-by-file verdicts
in sections 4 and 5 do not** - they are rewritten against `whatsHere()` output
before a single line is deleted.

You asked for this on **18 September**: *"I have given you my all 63 files...
I want to make a new Google Sheet and want to run a new script, a very simple
script. I think there are so many things which is not necessary."* It did not
get done then. This is that answer.

---

## 1. The headline

**Nothing here is fundamentally broken.** `CbcGap.gs` records what this
pipeline used to do:

```
April 2026    15,217,166  |  15,217,166  |        0
May 2026      17,690,995  |  17,690,995  |        0
June 2026     25,969,311  |  25,969,311  |        0
July 2026     21,394,816  |  21,394,816  |        0
August 2026   15,344,064  |  15,473,219  | -129,155
```

Four months agreeing with CBC to the rupee. It drifted after that. It drifted
because of three structural faults, not fifty bugs - and all three are fixed by
the same change.

---

## 2. The three faults

### Fault 1 - two IMPORTRANGEs are the only way data gets in

`Payment Tracker -> src_Payments` and `CBC -> src_Roster_<month>` are both
`IMPORTRANGE`. Every figure on every page and the TV descends from them.

`IMPORTRANGE` fails on its own. It failed **three times today**: `#REF!` at
10:30, readable at 12:32, dead again at 15:07 when `traceGap` could not find a
header row in a tab that had 22 good columns two hours earlier. When it fails,
downstream code does not stop - it reads an empty or partial tab and writes a
confident wrong number. The 7 October board showing 1.6 L was exactly this: a
rebuild ran while the roster import returned nothing.

**No amount of defensive code downstream fixes this.** The data has to come in
by a path that either succeeds or throws.

### Fault 2 - derived facts are stored in cells and never recomputed

`mdl_Payments` carries four columns that are *computed*, not observed:

| col | what it holds | computed from |
|---|---|---|
| D | `On Roster` | did Lead Owner match `mdl_Roster` **at write time** |
| E | `Manager` | the roster row **at write time** |
| F | `Office` | same |
| G | `Team` | same |

`ManagementReport.gs` then filters on the stamp:

```js
if (String(row[col['On Roster']]).trim().toUpperCase() !== 'YES') continue;
```

A stamp that was correct when written is not correct later. An agent who joined
after a payment landed, or any row written during a moment when the roster
import was empty, carries `NO` permanently - and the report skips it forever. No
amount of re-running `updateAndCheck` helps, because re-running re-reads the
same stale stamp. That is why ten runs moved nothing today.

(On today's data the stamps happen to be clean - `fixOnRoster` found nothing to
correct. The fragility is the fault, not this month's values.)

### Fault 3 - ~50 files in one global scope, with deliberate overrides

Apps Script concatenates every `.gs` into one scope. The last definition of a
name wins. This project **relies** on that:

`ScheduleAndFormat.gs` redefines `MR_COLS`, `mr_metrics_`, `mr_display_` and
`mr_formats_`, all of which `ManagementReport.gs` also defines. That is how
Booked / To Come was removed.

**Which one wins depends on file load order, which you cannot reliably
control.** So whether that change is in effect is not determined by the code.
This is almost certainly behind *"nothing fixed infact broke leaderboard"* -
the same project, two different load orders, two different outcomes.

It has bitten harder before: `PaymentsPull.gs` overrode `fixPaymentsRange` to a
no-op and disabled a function the project needs. I withdrew it.

### And one thing that cannot be fixed

`refreshAndVerify`, `buildPayments_`, `buildRoster_` and `fixPaymentsRange` -
the code that actually builds `mdl_Payments` and `mdl_Roster` - were pasted in
a session **before** this one, which was summarised away. They are not in the
repo and not recoverable from the transcript.

So the one function that decides which payments become rows cannot be read or
repaired. Every diagnostic I ran today was downstream of it. That alone decides
the architecture: it has to be replaced rather than fixed.

---

## 3. The replacement

```
  CBC            1-r5VMZ2u9w7WrcyAgCdgzp4scJiJQONuPiUV6JbRu0s
                    \
                     +--->  insideSales()  --->  Management Report
                    /                       --->  board feed
  Payment Tracker  1a-34agNIYY0ZcBIJKHpOsYb-ppM6FQZhietpWtBfreE
```

Your own description of the business is the design:

> *"this is so simple easy to understand payments come in payment tracker and
> in cbc we can see those"*

One function. Opens both sources directly with `openById`, **read only**, joins
them in memory, writes the report. Nothing is stamped, nothing is cached, no
intermediate tab is consulted.

What that removes outright:

| removed | fault it carried |
|---|---|
| `src_Payments` IMPORTRANGE | fault 1 - three failures today |
| `src_Roster_*` IMPORTRANGE | fault 1 - the 7 Oct 1.6 L collapse |
| `mdl_Payments` | fault 2 - the `On Roster` stamp |
| `mdl_Roster` | fault 2 - stamped manager / office / team |
| `refreshAndVerify` and friends | unreadable, unfixable |
| 19 trigger slots | one trigger instead of the 20-ceiling |

And it is self-checking in a way the current chain cannot be: because it reads
CBC directly, every run can print *CBC says X, I computed Y* from the same
source in the same pass. If those disagree the run says so instead of writing a
number nobody can trace.

`openById` on both is read-only. Neither CBC nor the Payment Tracker is ever
written to - the standing constraint from 6 October holds.

---

## 4. Script by script

> **SNAPSHOT OF 18 SEPTEMBER. Checked against the live project on 17
> October - see section 7 for what that changed.** The verdicts below say
> what each file was for, which is still accurate. Section 7 is what is
> actually there.

### Keep - the TV board (works, leave alone)

| file | lines | note |
|---|---|---|
| `war-room.gs` / `WarRoom.gs` | 3,751 | the JSON feed |
| `public/warroom.html` | 2,264 | 4 screens, celebration, bell - shipped 12 Oct |
| `war-room-autosync.gs` | 293 | has the 70% roster guard |
| `exec-webapp.gs` | 149 | the web app entry point |

Once the new pipeline lands, `war-room.gs` reads its feed instead of
`mdl_Payments` - a small change at one call site, not a rewrite.

### Keep - SuperLeap lead reports (a different product entirely)

| file | lines |
|---|---|
| `slp-payload.gs` | 1,627 |
| `slp-lead-report.gs` | 916 |
| `agent-lead-report.gs` | 787 |
| `slack-digest.gs` | 675 |
| `slp-month-page.gs` | 509 |
| `refresh-schedule.gs` | 799 |

These post lead-status to Slack. They carry **no revenue figures** and have
nothing to do with the gap. Untouched.

### Replace - the revenue pipeline

| file | lines | verdict |
|---|---|---|
| `ManagementReport.gs` | 671 | superseded by `insideSales()` |
| `UpdateAndCheck.gs` | 280 | becomes one call |
| `CbcCheck.gs` | 260 | folded in as the reconciliation print |
| `ScheduleAndFormat.gs` | 375 | formatting kept, **overrides dropped** (fault 3) |
| `ManagementReportUpgrade.gs` | 396 | folded in - upgrade is a CBC column, read directly |
| `FixFailed.gs` | 66 | keep, independent of this |

### Delete - one-off fixes, already applied

`FixTriggers.gs` (267) removed a duplicate trigger · `FixManagerBlock.gs` (253)
grew the manager block 7->9 · `ManagerFailedPayments.gs` (216) mirrored a block
· `KillDuplicateUpgrades.gs` (111) deleted stacked upgrade rows ·
`UpdateEverything.gs` (251) superseded by `UpdateAndCheck` · `dump-for-churn.gs`
(1,171) · `inventory-to-drive.gs` (194) · `diagnose-to-drive.gs` (171) ·
`ShowReportCode.gs` (69) tried to fetch the project's own source and never
worked.

**2,703 lines.** Each did its job once. None is needed again.

### Delete - diagnostics, all superseded

`CbcGap.gs` (401) · `war-room-where.gs` (325) · `FixRoster.gs` (327) ·
`FixOnRoster.gs` (280) · `war-room-orphans.gs` (240) ·
`war-room-threeway.gs` (225) · `why-different.gs` (212) ·
`FindTheMissing.gs` (190) · `AuditErrors.gs` (170) · `war-room-find.gs` (150) ·
`FixEverything.gs` (147) · `ReconcileSept.gs` (138) ·
`WhereIsTheMoney.gs` (136) · `ShowSrcPayments.gs` (117) ·
`PageNumbers.gs` (107) · `ShowReportNow.gs` (55) · `war-room-agents.gs` (46)

**3,266 lines.** Written to answer one question each, kept afterwards, and now
they disagree with each other - which is its own cost. `FindTheMissing.gs` is
the clearest case: it reported *"Nothing is short. CBC and the model agree"*
while 16 agents and 23.63 L were short, because it gated its search on its own
faulty comparison. A wrong diagnostic is worse than none.

### Keep for now - until the gap is closed

`Reconcile.gs` (358) is the only check today that produced self-consistent
numbers. `TraceGap.gs` (461) splits the remaining 23.63 L into its three
possible causes. Both go once the new pipeline is reconciling, because it
prints the same comparison on every run.

---

## 5. Where that leaves it

| | before | after |
|---|---|---|
| scripts in the revenue path | ~24 | 1 |
| lines in the revenue path | ~6,000 | ~800 |
| IMPORTRANGEs it depends on | 2 | 0 |
| intermediate tabs | 4 | 0 |
| computed values stored in cells | 4 columns | 0 |
| triggers | 20 (at the ceiling) | 1 |
| name normalisations | 2 (`wr_key_`, `up_key_`) | 1 |

**5,969 lines deleted.** Nothing in the TV board or the Slack lead reports is
touched.

---

## 6. Order of work

0. **Run `whatsHere()`.** One read-only pass that asks the project which of
   the 151 known functions are live, which tabs exist, how many triggers are
   installed, and - by calling `mr_metrics_` and counting what comes back -
   **which of the two competing definitions actually won**. That last one is
   fault 3 measured rather than argued, and nothing else can measure it.
   Sections 4 and 5 are rewritten from its output.

1. **Build `insideSales()`** and have it write to a tab named
   `Management Report NEW`, beside the existing one. Nothing is replaced and
   nothing is deleted. Two pages side by side, and the new one prints its own
   CBC reconciliation.
2. **Compare.** The new page's total must equal CBC's own agent total from the
   same read. If it does not, the run says which agents differ - which is the
   answer to today's 23.63 L either way.
3. **Switch** the report over, point `war-room.gs` at the new feed, move the
   single trigger across.
4. **Delete** the 5,969 lines, in the two groups above.

Step 1 is non-destructive and is the next thing I write. Nothing gets deleted
until a page you can see agrees with CBC.

---

## 7. Verified against the live project, 17 October 00:53

`whatsHere()` probed all 151 function names. **143 are live.** Two things I
wrote above were wrong, and one guess was right.

### Correction 1 - the model builder is not lost

I wrote that `refreshAndVerify`, `buildPayments_`, `buildRoster_` and
`fixPaymentsRange` "cannot be read or repaired". **All four are live**, along
with `addUpgradeRevenue` and `syncRosterSources`. They are not gone from the
project - I simply do not have their source, which is a different thing and a
weaker claim. They could be pasted and fixed.

The architecture decision still stands, for a reason that does not depend on
readability: the design stores derived facts in cells (fault 2). Repairing the
code that writes a stamp leaves a stamp to go stale. Reading CBC and the
tracker directly removes the stamp entirely. **Bypass, not because it cannot
be fixed, but because fixing it preserves the fault.**

### Correction 2 - fault 3 is dormant, not active

```
MR_COLS has 9 columns
mr_metrics_ returns 9 values.
Consistent with MR_COLS, so the two files agree.
```

The `ScheduleAndFormat` override **did** win. Booked / To Come really is
removed, and the two files are in step. So the override race is not currently
producing wrong figures.

The mechanism is still there - two files still define the same four names, and
the order that resolves it is still not controllable. It is a fault waiting
rather than a fault acting, and it stops mattering when the page has one
author.

### Confirmed - what is genuinely absent

Only 8 of 151 names are not live:

| missing | why it matters |
|---|---|
| `warRoomSyncStatus` `warRoomSyncNow` `warRoomInstallSync` `warRoomRemoveSync` `warRoomForceSync` | **`war-room-autosync.gs` was never added.** `WRA_MIN_ROSTER_FRACTION` is undefined, so **there is no roster guard.** |
| `showReportNow` | deleted, and it was only a printer |
| `insideSales` `insideSalesSelfTest` | not pasted yet |

**The missing roster guard is a live risk, not housekeeping.** Ten scheduled
rebuilds a day run unattended with nothing stopping a rebuild that reads a
collapsed roster import. That is precisely what produced the 1.6 L board on
7 October, and it can happen again tonight.

### Triggers - at the ceiling, exactly

```
20 of a maximum 20.
  onOpen                x1
  runAgentLeadSchedule  x4
  runDaySchedule        x5
  runLeadIndiaSchedule  x2
  runLeadIntlSchedule   x2
  runNightSchedule      x5
  slpAutoRefresh        x1
```

**Full.** Installing one more throws part way through - which is how a
schedule ends up half applied, and why `installAllSchedules` refused earlier.

The 8 slots held by `runAgentLeadSchedule`, `runLeadIndiaSchedule` and
`runLeadIntlSchedule` are three Slack lead reports on fixed hours. One trigger
on a short interval with a slot gate does the same work, the way
`runDaySchedule` already does. **That frees 6 slots** without losing a single
report.

Note `warRoomAutoUpdate` and `warRoomScheduledUpdate` are live but have **no
trigger**. The board is not on its own clock; it reads the model, so it moves
when the model moves.

### The workbook - 56 tabs, and why it is slow

The heaviest, in rows:

| tab | rows |
|---|---|
| `DN Batch Map` | 65,196 |
| `src_Payments` | 15,558 |
| `mdl_Payments` | 11,001 |
| `src_MM_Dom` | 8,426 |
| `src_MM_Eng` | 4,264 |
| `src_MM_Intl` | 3,171 |
| `src_BC_Ind` | 1,577 |
| `_SlpMonthData` | 1,304 |
| `mdl_Roster` | 427 |

Roughly 112,000 rows, most of it in hidden source and model tabs. This is the
answer to *"sheet is so heavy thats why every time this happens"* - and it is
why `IMPORTRANGE` keeps dropping to `#REF!`. Recalculation cost rises with
every tab, and `IMPORTRANGE` is evaluated with everything else.

`insideSales()` adds nothing to that load: it reads the two sources over the
API, not through a formula, so no new cell depends on anything.

### Still open - the upgrade may be counted twice

`addUpgradeRevenue` is live and, per `KillDuplicateUpgrades.gs`, it *writes
rows into `mdl_Payments`* - one per agent per CBC month. `killDuplicateUpgrades`
exists only because repeated runs stacked them.

But `addUpgradeRevenue` is **not in `REFRESH_SEQUENCE`**:

```
refreshAndVerify, buildExecSnapshot, buildManagementReport,
addCbcLine, formatManagementReport
```

So on the scheduled path those rows are never refreshed, while
`mr_addUpgrade_` and `wr_fillUpgrade_` add the upgrade *again* from
`src_Roster`. Either the upgrade is double counted on the report, or the
written rows are stale - and which one depends on what last ran by hand.

`insideSales()` has one source for it: CBC's column, read once, added at the
agent. There is no second path to disagree with.

### Revised order of work

1. **`insideSales()`** - the correct number, independent of all 143 functions.
2. **Free 6 trigger slots** by collapsing the three lead-report schedules into
   one gated trigger.
3. **Restore a roster guard** - or let step 1 make it moot, since
   `insideSales` reads CBC directly and a roster of 0 agents makes it stop
   rather than write a zero.
4. **Delete**, per-function, against this verified list rather than the
   September one.
