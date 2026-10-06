# What to do — 6 Oct 2026

Everything below takes about five minutes. After it, the sheet and the TV
both read **25.03 L** and stay current on their own.

---

## 1. One code edit — `WarRoom.gs`

Open `WarRoom.gs` in Apps Script. Press **Ctrl+F**, search for:

```
fold payments onto roster agents
```

You will land on this block. **Select all of it** (from `var roster =` down
to the closing `}`):

```js
  var roster = wr_roster_(ss, monthKey);
  WR_HAS_MM = roster.mmCol;   // gates every per-man-month figure below
  var tB = new Date().getTime();
  var pay    = wr_payments_(ss, monthKey);
  var tC = new Date().getTime();

  /* ---- fold payments onto roster agents ---- */
  var agents = {};   // lowercase name -> record
  var k;

  for (k in roster.byAgent) {
    var r = roster.byAgent[k];
    agents[k] = {
      name: r.name, manager: r.manager, city: r.city, team: r.team,
      target: r.target, revenue: 0, units: 0,
      mm: r.mm, upgrade: r.upgrade, counted: (r.mm > 0) ? 1 : 0
    };
  }
```

**Replace it with this.** Only two lines differ — the new second line, and
`revenue: 0` becoming `revenue: r.upgrade`:

```js
  var roster = wr_roster_(ss, monthKey);
  wr_fillUpgrade_(ss, monthKey, roster);
  WR_HAS_MM = roster.mmCol;   // gates every per-man-month figure below
  var tB = new Date().getTime();
  var pay    = wr_payments_(ss, monthKey);
  var tC = new Date().getTime();

  /* ---- fold payments onto roster agents ---- */
  var agents = {};   // lowercase name -> record
  var k;

  for (k in roster.byAgent) {
    var r = roster.byAgent[k];
    agents[k] = {
      name: r.name, manager: r.manager, city: r.city, team: r.team,
      target: r.target, revenue: r.upgrade, units: 0,
      mm: r.mm, upgrade: r.upgrade, counted: (r.mm > 0) ? 1 : 0
    };
  }
```

Then **Save**.

> Why both lines: the first fetches the upgrade figure out of
> `src_Roster_Oct`, because `mdl_Roster` does not carry that column. The
> second counts it. One without the other does nothing.

---

## 2. Redeploy the web app

**Deploy → Manage deployments → the pencil icon → Version: New version →
Deploy**

The `/exec` URL serves a frozen snapshot. Without this the TV keeps running
the old code no matter what the editor says.

---

## 3. Run these two, once each

| Function | What it does |
|---|---|
| `warRoomInstallSync` | Keeps the model current by itself, every 30 min |
| `warRoomRefreshNow`  | Drops the board's 7-minute cache so the TV updates now |

`warRoomInstallSync` is the important one. The model rebuilds six times a
day today — 10:00, 13:30, 17:00, 20:30, 00:00, 03:30 — while payments
arrive all day. Every gap between those is a window where every screen is
short and none of them say so. That is what cost today.

---

## 4. Check it worked

- The **Management Report** tab says `Total revenue  25.03 L`
- The **TV** says the same within a minute of `warRoomRefreshNow`
- `warRoomSyncStatus` says **UP TO DATE**

---

## Keep these three files

| File | Why |
|---|---|
| `warroomautosync` | The actual fix. Deleting it brings today back. |
| `ManagementReportUpgrade` | Upgrade revenue on the report. The report needs it. |
| `warroomfind` | Answers "where is this agent's money" in one run. |

## Safe to delete — today's scaffolding

`warroomwhere`, `warroomorphans`, `warroomthreeway`, and the
agent-by-agent file. They answered their question and are not wired into
anything.

Also worth clearing out when you have a quiet moment: `fixfailed`,
`whydiff`, `cbccheck`, `where is the`, `reconcile sept`, `killduplicate`,
`fixmanager`, `auditerrors`, `showreport`. Nine one-off files from earlier
rounds. They are harmless, but a project with two copies of a function and
nobody sure which one runs is how this kind of day starts.

---

## Not a code problem

CBC says 26.18 L, the sheet says 25.03 L. The 1.15 L difference is
**Dinesh Kumar Tarenia (80,000)** and **Satyam Aditya Samant (35,000)**.
Both have payments in the tracker for August and September and **none for
October**, while the tracker itself is current to 06 Oct. CBC also shows
them as booked-but-not-collected.

So that is a conversation with Abhishek Anand about what got logged, not
something to change in the sheet. The sheet is right to leave it out.
