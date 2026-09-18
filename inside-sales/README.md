# Inside Sales workbook - the script

The Apps Script project behind the Inside Sales sheet and the Sales Dangal
leaderboard. **This folder is the source of truth.** The Apps Script editor
is a view of it, not a place to edit.

The old project's files are in `../appsscript/` and are kept only as history.
Nothing here reads them.

---

## How the sync works

Every push that touches `inside-sales/` runs `clasp push --force`, which makes
the Apps Script project match `inside-sales/src` **exactly**.

- A file added here appears in the editor.
- A file deleted here is **deleted** from the editor.
- Anything typed directly into the editor is **overwritten on the next push**.

That last one is deliberate. Hand-editing is how the old project ended up with
two copies of `canonBatch_` and no way to tell which was live.

### One thing is still manual, on purpose

Pushing updates the **code**. It does not update the **web app**, because a
deployment is pinned to a version and serves a frozen snapshot. After a change
the leaderboard needs:

> Deploy → Manage deployments → pencil → **Version: New version** → Deploy

Keep the same `/exec` URL. If you create a *new* deployment instead of editing
the existing one, the URL changes and the TV stops working.

---

## One-time setup

About fifteen minutes. You only ever do this once.

### 1. Make the sheet and its script

1. Create the new Google Sheet.
2. **Extensions → Apps Script.** This creates a project *bound* to the sheet,
   which is required - a standalone project cannot read the workbook.
3. **Project Settings → Time zone → (GMT+05:30) India Standard Time.**
4. Same page: copy the **Script ID**. Keep it for step 4.

### 2. Turn the Apps Script API on

Open <https://script.google.com/home/usersettings> and switch
**Google Apps Script API** to **ON**.

Without this, `clasp push` fails with *"User has not enabled the Apps Script
API"* and nothing else works.

### 3. Get the credentials

On your own machine, once:

```bash
npm install -g @google/clasp@2
clasp login
```

A browser opens. Sign in as the account that owns the sheet.

That writes a file called `.clasprc.json` in your home folder:

- **Mac / Linux** - `~/.clasprc.json`
- **Windows** - `C:\Users\<you>\.clasprc.json`

Open it and copy **all** of it, including the outer `{` and `}`.

> It holds a refresh token for your Google account. Put it in a GitHub secret
> and nowhere else - never in a file in this repo.

### 4. Add the two secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `CLASPRC_JSON` | the whole contents of `.clasprc.json` |
| `SCRIPT_ID` | the Script ID from step 1 |

### 5. Run it

**Actions → Deploy Apps Script → Run workflow.**

Green means the code is in the editor. Open the sheet, **Extensions → Apps
Script**, and the files are there.

From then on it is automatic. No more pasting.

---

## If it fails

The workflow reads the error and tells you which of these it is:

| What it says | What to do |
|---|---|
| `User has not enabled the Apps Script API` | Step 2 above |
| `invalid_grant` / `Token has been expired` | `clasp login` again, update the `CLASPRC_JSON` secret |
| `Script ID not found` | Wrong ID, or the signed-in account cannot open that project |
| `CLASPRC_JSON is not valid JSON` | The copy was partial - copy the whole file, braces included |

The refresh token does expire eventually. When it does, step 3 again.

---

## What this can and cannot reach

`clasp` writes **code into one Apps Script project**, named by `SCRIPT_ID`.

It has no access to any spreadsheet. It cannot touch the Payment Tracker, it
cannot touch CBC, and it cannot touch any other workbook - not by accident and
not on purpose. The only thing it can overwrite is this project's own files.

---

## The files

Built in order. Each assumes the one before it passed its check.

| | File | What it does | Check |
|---|---|---|---|
| 1 | `Config.gs` | Every id, tab name and threshold | `cfgCheck()` |
| 2 | `Aliases.gs` | Batch codes, manager names, name matching | `aliasSelfTest()` |
| 3 | `Sources.gs` | IMPORTRANGE setup, CBC roster sync | `sourcesCheck()` |
| 4 | `Model.gs` | src -> `mdl_Payments`, `mdl_Roster`, `mdl_Batches` | `modelSelfTest()` |
| 5 | `PagesPeople.gs` | Manager, Agent, Office & Team, Rhythm | |
| 6 | `PagesAnalysis.gs` | Trend, Funnel | |
| 7 | `PagesReports.gs` | Management Report, Overall Report, Sales Monitoring, Workshop Months | |
| 8 | `PagesCommand.gs` | Command Centre | |
| 9 | `WarRoom.gs` + `board.html` | The leaderboard feed and the TV page | `warRoomSelfTest()` |
| 10 | `Update.gs` | The one command you ever run | |
| 11 | `SelfTest.gs` | Proves the whole thing end to end | `selfTestAll()` |

### The eleven visible pages

Management Report · Overall Report · Sales Monitoring · Command Centre ·
Rhythm · Office & Team · Manager · Workshop Months · Agent · Trend · Funnel

Everything else - `src_*`, `mdl_*` and any helper - is **hidden**. If a tab is
visible, it is one of those eleven.

### Not carried over from the old project

SuperLeap (churn, stage, lead reports, month page, payload versioning), the
Slack digests and their 18 triggers, and roughly 35 one-off diagnostics.
