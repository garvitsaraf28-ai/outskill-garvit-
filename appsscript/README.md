# Inside Sales workbook - Apps Script

What is in this folder, what runs on a clock, and what is waiting on a
decision. Files here are pasted into the bound Apps Script project; the
project also contains files that only ever lived in the editor, so this
folder is a subset, not a mirror.

## What runs on a clock

| When | What | Refreshes the workbook? |
|---|---|---|
| 11:30, 14:00, 16:30, 19:00, 21:30 IST | Disposition Update to Slack (`runDaySchedule`) | yes |
| 19:30, 22:00, 00:30, 03:00, 05:30 IST | Disposition Update to Slack (`runNightSchedule`) | yes |
| 11:00, 19:00, 20:00, 04:00 IST | Agent Lead Status to Slack (`runAgentLeadSchedule`) | no, reads only |
| every 2 hours | `slpAutoRefresh` - picks up the SuperLeap payload, rebuilds the two SuperLeap tabs, posts | no |
| every ~2 hours, outside Apps Script | the Claude routine queries SuperLeap and writes `slp_payload.json` to Drive | no |

`nearMinute()` places a trigger within +/-15 minutes of the hour asked
for, so these overlap. Day 19:00 and Agent Lead 19:00 are the same minute
by design. A script lock in `refresh-schedule.gs` serialises them; see the
comment on `withScheduleLock_` for what went wrong without it.

## The SuperLeap payload

The routine and the workbook are two separate programs that have to agree
on a file format, and they have disagreed three times.

```
v1  disp  [agent, email, disposition, n]           <- what the readers were written for
v2  disp  [agent, email, source, disposition, n]   <- source inserted at index 2
v3  rows  [{agent,email,source,month,stage,disposition,sub,n}, ...]
```

**Live: v3**, since 17 Aug. Run `slpPayloadCheck()` to see the current
state at any time - it reports the version in Drive, the version in the
sheet, whether the normaliser is wired in, and any refusal.

`slp-payload.gs` converts any of the three into the shape the readers
already know, so the version question is asked once instead of at four
call sites. Every reader still consumes `disp` and `stage` exactly as it
did on v1.

### v3 is live - what it took, and what still guards it

**Done on 17 Aug.** The workbook reads v3, the month page is built, and
both ends refuse a bad payload. `slpPayloadCheck()` reports the state at
any time.

The changeover needed the readers to understand v3 BEFORE the routine
wrote it, so the order was: paste `slp-payload.gs`, make two one-line
edits, verify, then switch the routine. Doing it the other way stops the
pipeline without an error - a v3 payload has no `disp` key, so
`slpAutoRefresh` returns at its guard and the workbook shows its last
good numbers every two hours without ever saying why.

The two edits, both `try { pay = JSON.parse(text); }` becoming
`try { text = slp_normalisePayload_(text); pay = JSON.parse(text); }`:

- `SlpAuto.gs`, in `slpAutoRefresh()` - the one on the trigger
- `SuperLeapChurn.gs`, in `slpLoadFromDrive()` - the manual loader

**To check they are still in place:** run `slpLoadFromDrive()` - NOT
`slpAutoRefresh`, which returns early on an unchanged snapshot and
re-stores nothing - then `slpPayloadCheck()`. The `normaliser :` line
must say `WIRED IN`. It is detectable because the routine's payload
carries no `version` key and `slp_normalisePayload_` always adds one.

### What the payload looks like now

```
disp   [agent, email, disposition, n]        exactly as v1 - readers untouched
stage  [agent, stage, n]                     exactly as v1
sub    [agent, sub, n]                       exactly as v1
rows   {"a":agent,"m":month,"s":source,"d":disposition,"n":count}
```

Additive, not a redesign. The three v1 arrays are byte-identical to what
they always were, so every existing reader kept working without a change.
`rows` is the only new part.

**Why short keys and only four dimensions.** The first v3 draft put
agent x source x month x stage x disposition x sub in one array with long
key names: 5,731 rows, **1,015,020 bytes**, and `create_file` only takes
content inline - undeliverable. Nothing slices stage or sub by month, so
they do not belong there. Rolled up, the file is ~300 KB.

### Two guards, at opposite ends

Both exist because of real incidents on 17 Aug, and both are worth
keeping.

**The routine stops rather than writing a thin payload.** It writes 5 rows
where the last had 671, the workbook rebuilt from it, and Slack reported
that Inside Sales had one agent and 123 leads. Every check in the
pipeline tested *shape* - is it JSON, does it have a `disp` key, is it
non-empty - and a five-row payload passes all three. Nothing tested
magnitude. The prompt now takes `SELECT COUNT(*)` first and requires the
summed rows to match it, which also catches the **2000-row server-side
cap** on `execute_query` that made `LIMIT 60000` a fiction: a run got
exactly 2000 rows holding 84,844 of 147,570 leads, and the old
"did it equal the LIMIT?" check could never have seen it.

**The workbook refuses a payload below half the last good row count.**
`slp_guardShrink_`, with the baseline in `SLP_LAST_GOOD_ROWS`, advancing
only on an accepted payload so a bad one cannot drag it down.

A **version downgrade** is its own case with its own message. If the
routine goes back to a v1 prompt, the row count collapses and the generic
"failed query" wording would send someone to SuperLeap when the fix is
the routine's saved prompt. Note that a run started by hand uses what you
paste; the schedule uses what is stored.

`SLP_ALLOW_SHRINK = yes` accepts a genuine drop, and clears itself after
one use.

### "source" is the lead channel, not the workshop

Worth knowing before reading the month page as a workshop breakdown.
SuperLeap's `source` field returned five values:

```
(no source), Bulk Upload, Inbound Call, Manual, Website
```

Not one batch code. Earlier prompts asserted it was the workshop code;
that was assumed and never checked. Whether SuperLeap carries the
workshop on some other field is still open and needs a query.

### The month page

`slp-month-page.gs`, `buildSlpMonthPage()`. Writes **SuperLeap by Month**
and a hidden `_SlpMonthData`, on the same pattern `buildOverallReport`
uses: one pre-summed row per `month|source|agent` key, every cell a
single `INDEX/MATCH`, so a dropdown change is instant.

`All months` and `All sources` are real pre-summed rows, not the page
adding its own columns - a page that sums its own filtered columns
double-counts the moment a filter is applied.

Rebuild it when a payload brings a new month or source; the dropdown
lists are written at build time.

Two traps already paid for: the month cells are set to **text format
before** a value, because "Aug 2026" in a general cell becomes a Date and
the key built from it concatenates as a serial number, so every MATCH
misses and the page reads 0. And there are **no frozen columns** - the
subtitle and footnote are merged across the full width, and Sheets
refuses a freeze that cuts through a merge anywhere on the sheet.

### The current-month Slack report

`agentRowsForMonth_` in `agent-lead-report.gs`. Reads the payload when it
carries a month, falls back to the tab when it does not - so it needed no
switching on and needs no switching off.

**Decided:** the SuperLeap Churn tab itself stays whole, everything since
1 April, because other things read it. Only the Slack report narrows.

## The churn post to Slack is off, deliberately

`slpAutoRefresh` ends with a line like:

```
slack not sent: SLACK_WEBHOOK is not set in Script Properties
```

That is expected, not a fault. `postChurnToSlack` reads a script property
called `SLACK_WEBHOOK`; everything else reads `SLACK_WEBHOOK_URL`. Only
the second was ever set, so the churn summary has never posted - it has
been failing quietly every two hours for as long as the trigger has
existed, and nobody missed it.

It was left off rather than fixed. You already get 14 Slack posts a day
and the Agent Lead Status report covers per-agent dispositions four times
daily; the churn summary every two hours would be 12 more.

The one figure in it that nothing else reported - leads sitting in pools
with no owner, better than a third of every lead in SuperLeap - is now on
the Agent Lead Status report instead, so the information survives without
the posts.

**To turn it on anyway:** add a script property `SLACK_WEBHOOK` with the
same value as `SLACK_WEBHOOK_URL`. No code change needed. Be aware that
rotating the webhook then means updating both.

## "12 files with that name"

`slpLoadFromDrive` reports how many files share the payload's name. That
count includes the Trash, and it is the only one of the three payload
finders that does not filter it out:

| function | skips trashed | respects `SLP_FOLDER_ID` |
|---|---|---|
| `slpa_newestPayload_` (used by `slpAutoRefresh`) | yes | yes |
| `slpa_tidy_` | yes | yes |
| `slpLoadFromDrive` | **no** | **no** |

`slpa_tidy_` keeps the newest few payloads and moves the rest to Trash,
where they stay matchable by name. So "12 files" is most likely a working
tidy being miscounted, not a pile-up. `slpPayloadCheck()` now splits the
count into live and trashed so it can be read rather than guessed at.

The automated path is unaffected - `slpAutoRefresh` goes through
`slpa_newestPayload_`, which filters both. Only the manual loader could
pick up a trashed file, and only if a trashed one were newer than every
live one. `slpPayloadCheck()` warns explicitly if that is ever true.

**Optional one-line fix.** In `slpLoadFromDrive`, inside the
`while (it.hasNext())` loop, after `seen++;`:

```
if (f.isTrashed && f.isTrashed()) continue;
```

That makes all three agree on what counts as a payload. Also worth
setting a script property `SLP_FOLDER_ID` to the feed folder, so a stray
`slp_payload.json` anywhere else in Drive cannot be picked up.

## When the numbers suddenly look wrong

Run `slpPayloadList()`. It opens every `slp_payload.json` in Drive and
reports the row count inside each, because size and date cannot tell a
good payload from a nearly empty one.

This has happened twice:

```
17 Aug 14:52   91 KB  674 rows   healthy
17 Aug 14:43    0 KB    5 rows   <- rebuilt the tabs down to one agent
12 Aug 17:00    1 KB   16 rows   <- same failure, six days earlier
```

Both were valid JSON in the correct shape with a plausible snapshot, so
every guard in the pipeline passed them - they all test shape, and
nothing tested magnitude. The Slack report went out saying Inside Sales
had one agent and 123 leads.

Two defences now exist, at both ends:

- **The routine** is told to STOP and write nothing if its query returns
  fewer than 100 rows. A partial payload is worse than no payload,
  because the workbook keeps its last good one and merely goes stale.
- **The workbook** refuses any payload below half the row count of the
  last good one, via `slp_guardShrink_`. The baseline lives in
  `SLP_LAST_GOOD_ROWS` and only advances on an accepted payload, so a bad
  one cannot drag it down and make the next bad one look reasonable.
  `slpPayloadCheck()` reports any refusal.

**To recover:** the routine usually writes a good payload on its next
run, so the fix is normally just `slpLoadFromDrive()` to pick up the
newest. Check `slpPayloadList()` first to confirm the newest is healthy.

**If a drop is genuine**, set the script property `SLP_ALLOW_SHRINK` to
`yes` and run again. It clears itself after one use.

## "Revenue (CBC)" is 0 every month - and that is CBC, not the workbook

`refreshEverything` prints a reconciliation table per month:

```
Month        Rows   Revenue (payments)   Revenue (CBC)   Difference
April 2026   176            15,217,166               0    15,217,166
```

`Difference` is supposed to be near zero. It is instead the whole
payments figure, which reads like a total reconciliation failure and
actually means CBC published no number to compare against.

Checked, twice, and it is not a workbook bug:

- `checkCbcRevenueColumn()` - every `src_Roster_*` tab carries an exact
  `Revenue` header, so `buildRoster_` locates the column correctly.
- `checkCbcRevenueValues()` - across all five tabs and 204 agent-months,
  **not one row has a non-zero revenue**, and the cells are literal
  numeric `0`, not blanks, text or error values.

The Target column on the same tabs, in the same IMPORTRANGE, in the same
rows, IS populated - it is what drives the 27.9% attainment figure. So
the import works and the source column is genuinely empty.

**This is a question for whoever owns the CBC sheet**, not for Apps
Script. Ask whether that Revenue column is still meant to be filled:

- **If yes** - it has stopped being populated at source. Fixing it there
  makes the cross-check start working with no workbook change at all.
- **If no** - it is deprecated, and the workbook should stop printing a
  `Difference` that reads like a discrepancy. Say so and that is a small
  change to `buildPayments_` in `Code.gs`.

Deliberately not papered over in the meantime. Suppressing the column
would hide a real question behind a cosmetic fix, and the revenue figures
people actually use come from `mdl_Payments` and are unaffected.

## House rules that have cost time before

- **Shared global scope.** Every `.gs` file in the project shares one
  namespace and duplicate names resolve silently to one of them. Check
  before pasting anything new; `checkNameCollisions()` in
  `dump-for-churn.gs` does it against the live project.
- **Pure ASCII in `.gs` files.** Non-ASCII becomes mojibake when pasted
  into the editor. Where a specific character is genuinely needed in a
  regex or comparison, write it as a `\u` escape - see `looksNumeric_`
  and `monthLabel_` in `slack-digest.gs`.
- **One matcher per concept.** Batch codes are canonicalised by
  `canonBatch_` in `ModelAliases.gs` and nowhere else. A second one was
  written in this folder and deleted again; two competing matchers drift.
- **Markdown is not code.** The `.md` files here are instructions for the
  Claude routine, which runs outside Apps Script. Pasting one into the
  editor as a `.gs` file breaks every function and trigger in the whole
  project, because Apps Script compiles all files together.

## Files

| File | What it is |
|---|---|
| `refresh-schedule.gs` | the trigger windows, the lock, and the Disposition Update body |
| `agent-lead-report.gs` | the Agent Lead Status report, incl. the leaver filter |
| `slack-digest.gs` | Slack delivery - webhook and email routes, 3000-char chunking |
| `slp-payload.gs` | payload version detection, normalising (v1/v2/v3), the shrink guard, `slpPayloadCheck`, `slpPayloadList` |
| `slp-month-page.gs` | the SuperLeap by Month page and its hidden lookup |
| `dump-for-churn.gs` | read-only diagnostics: `checkBatchMatcher`, `checkCbcRevenueColumn`, `checkCbcRevenueValues`, `listUnmatchedAgents` |
| `diagnose-to-drive.gs`, `inventory-to-drive.gs` | diagnostics that write their output to Drive |
| `superleap-routine-prompt*.md` | instructions for the Claude routine, **not** Apps Script |

## Open, and not in this folder

None of these are Apps Script problems, which is why none of them are
fixed here.

**The routine's saved prompt.** The v3 changeover was done by pasting the
prompt as a message into the routine's session. A message runs once; the
schedule uses the saved prompt. If that was never updated, a scheduled run
writes v1, the shrink guard refuses it, and the workbook stops updating -
correctly keeping its v3 data, but frozen, because the file it refused is
the newest one and nothing newer can replace it. `slpPayloadCheck()` says
so outright when that happens.

**Thirteen SuperLeap accounts with no roster row**, holding roughly 1,400
leads between them and therefore outside every agent total. Twelve of the
thirteen hold between 104 and 113 leads - a nine-lead band, which is a
bulk allocation rather than organic assignment. Almost certainly a cohort
of joiners not yet on the CBC roster, in which case they belong on the CBC
month tab and `syncRosterSources` picks them up. `listUnmatchedAgents()`
names them.

**`Revenue (CBC)` is empty at source.** Not a workbook bug - see the
section above. Needs whoever owns the CBC sheet to say whether that column
is still meant to be filled.

**One stray `slp_payload.json`** outside the feed folder. Harmless while
it stays old, because `slpLoadFromDrive` takes the newest by date across
the whole Drive; delete it and that route closes.
