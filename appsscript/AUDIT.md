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

> **THIS SECTION IS A SNAPSHOT OF 18 SEPTEMBER, NOT OF TODAY.**
>
> Files have been deleted and changed since that paste. So the verdicts
> below say what each file *was for*, which is still true and still useful -
> but **not** which files are in the project now. A delete list built from a
> stale inventory is how a function somebody still needs gets removed.
>
> `whatsHere()` settles it from the project itself: it probes all 151
> function names that have ever appeared here and reports which are live,
> which are gone, which tabs exist and how many triggers are installed.
> Sections 4 and 5 get rewritten against that output before anything is
> deleted.
>
> Sections 1 to 3 do not depend on the file list - they are about
> architecture - and stand as written.

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
