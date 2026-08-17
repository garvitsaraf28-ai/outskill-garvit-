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

**Live today: v1.** `buildSuperLeapChurn` reads `disp` rows as
`[agent, email, disposition, n]`, and the reports it produces carry
sensible numbers, which they could not if the routine were writing
anything else. Confirm it in ten seconds by running `slpPayloadCheck()`.

`slp-payload.gs` converts any of the three into the shape the readers
already know, so the version question is asked once instead of at four
call sites. Without it, pointing the routine at v3 stops the pipeline
dead: a v3 payload has no `disp` key, `slpAutoRefresh` returns at its
guard, and the workbook shows its last good numbers every two hours
without ever saying why.

### Switching to v3 - in this order

1. Paste `slp-payload.gs` into the project as `SlpPayload.gs`. **Done.**
2. Run `slpPayloadSelfTest()`. It should log `SELF TEST PASSED`. **Done.**
3. Run `slpPayloadCheck()`. It reports the version in Drive and in the
   sheet without changing either. **Done - v1 in both, 17 Aug 13:30 IST.**
4. Make two one-line edits. In each file the target line occurs exactly
   once, so find-and-replace cannot hit the wrong one:

   ```
   find     try { pay = JSON.parse(text); }
   replace  try { text = slp_normalisePayload_(text); pay = JSON.parse(text); }
   ```

   - `SlpAuto.gs`, in `slpAutoRefresh()` - this is the one on the trigger
   - `SuperLeapChurn.gs`, in `slpLoadFromDrive()` - the manual loader

5. Run **`slpLoadFromDrive()`** - not `slpAutoRefresh` - then
   `slpPayloadCheck()`. The `normaliser :` line must say `WIRED IN`. If
   it says `NOT WIRED IN`, an edit did not take; fix it before going
   further.
6. Only now point the routine at `superleap-routine-prompt-v3.md`.
7. Run `slpPayloadCheck()` again after the first v3 payload lands.

Steps 1-5 are safe while the routine is still on v1 - that is the point
of doing them first. Nothing changes visibly until step 6.

**Why `slpLoadFromDrive` and not `slpAutoRefresh` at step 5.**
`slpAutoRefresh` compares the payload's snapshot against the last one it
stored and returns early when they match - the `no new data` line in its
log - and that return happens *before* it calls `slp_writeRaw_`. On an
unchanged payload it therefore re-stores nothing, so the check would keep
reporting `NOT WIRED IN` no matter how correct the edits were, until a
fresh payload happened to arrive up to two hours later. `slpLoadFromDrive`
has no snapshot guard: it re-reads, re-normalises and re-stores every
time.

The check itself is not a formality. The two edits are the only part of
this a person does by hand, so they are the only part that can silently
not happen, and a missed edit looks exactly like a made one until the
routine switches and the pipeline stops. It is detectable without reading
the source: the routine's payload carries no `version` key and
`slp_normalisePayload_` always adds one, so a stored payload with a
version went through the normaliser and one without it did not.

### Current-month Slack report - built, dormant until v3

`agentRowsForMonth_` in `agent-lead-report.gs` already does this. It reads
the payload when the payload carries a month and falls back to the tab
when it does not, so it needs no switching on: while the routine is on v1
it returns null and the report behaves exactly as it does now. The first
v3 payload makes it narrow to the current month by itself and say which
month it is showing.

**Decided:** the SuperLeap Churn tab itself stays whole - everything since
1 April - because other things read it. Only the Slack report narrows.

### Month and workshop dropdowns - built, dormant until v3

`slp-month-page.gs`. Run `buildSlpMonthPage()`. It writes the visible
**SuperLeap by Month** tab and a hidden `_SlpMonthData` lookup, on the
same pattern `buildOverallReport` uses for `_OverallData`: one pre-summed
row per `month|source|agent` key, every cell on the page a single
`INDEX/MATCH` against it, so changing a dropdown is instant and nothing
has to be re-run.

`All months` and `All workshops` are real pre-summed rows, not the page
adding its own columns up, so they stay correct under any filter. Only
keys that carry leads are written - the page reads through
`IFERROR(..., 0)`, so an absent key is correctly a zero, and writing the
full cross product would be tens of thousands of rows of nothing.

On today's v1 payload it writes nothing, does not touch the spreadsheet,
and logs why. Run it again after the first v3 payload and it builds.
Nothing needs editing in between.

`slpMonthPageSelfTest()` checks the part that could be wrong quietly -
that `All months` equals the sum of the months, `All workshops` equals
the sum of the workshops, and nothing leaks between agents.

Rebuild it when a payload brings a new month or workshop, because the
dropdown lists are written at build time.

### Nothing else is waiting on v3

Everything that could be built before the data exists has been. The only
remaining steps are steps 4-6 above, which are yours.

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
| `slp-payload.gs` | payload version detection and normalising (v1/v2/v3) |
| `slp-month-page.gs` | the SuperLeap by Month page and its hidden lookup |
| `dump-for-churn.gs` | read-only diagnostics; nothing here writes |
| `diagnose-to-drive.gs`, `inventory-to-drive.gs` | diagnostics that write their output to Drive |
| `superleap-routine-prompt*.md` | instructions for the Claude routine, **not** Apps Script |
