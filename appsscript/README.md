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

1. Paste `slp-payload.gs` into the project as `SlpPayload.gs`.
2. Run `slpPayloadSelfTest()`. It should log `SELF TEST PASSED`.
3. Run `slpPayloadCheck()`. It reports the version in Drive and in the
   sheet without changing either.
4. Make two one-line edits, both `try { pay = JSON.parse(text); }` ->
   `try { text = slp_normalisePayload_(text); pay = JSON.parse(text); }`:
   - `SlpAuto.gs`, in `slpAutoRefresh()`
   - `SuperLeapChurn.gs`, in `slpLoadFromDrive()`
5. Only now point the routine at `superleap-routine-prompt-v3.md`.
6. Run `slpPayloadCheck()` again after the first v3 payload lands.

Steps 1-4 are safe while the routine is still on v1 - that is the point
of doing them first. Nothing changes visibly until step 5.

### Still waiting on v3 data

Neither of these can be built against a payload that has no month in it,
so both are waiting on step 5 above, not on a decision:

- **Slack report for the current month only.** Today every report covers
  everything since 1 April stacked together.
- **Month and workshop dropdowns in the sheet.** Same pattern the Agent,
  Manager and Rhythm pages already use - a hidden lookup tab keyed
  `month|source|agent`, the visible tab INDEX/MATCHing against two
  data-validation cells, exactly how `buildOverallReport` drives
  `_OverallData`.

One open question before the sheet side is built: should the **SuperLeap
Churn tab itself** become month-selectable, or stay as it is - everything
since 1 April - with only the Slack report filtered to the current month?
The tab is used as a source by other things, so narrowing it is not a
free change.

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
| `dump-for-churn.gs` | read-only diagnostics; nothing here writes |
| `diagnose-to-drive.gs`, `inventory-to-drive.gs` | diagnostics that write their output to Drive |
| `superleap-routine-prompt*.md` | instructions for the Claude routine, **not** Apps Script |
