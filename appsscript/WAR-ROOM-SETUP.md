# Sales War Room — setup and operation

The floor TV board. Live at **https://outskill-garvit.vercel.app/warroom**

Two pieces, nothing else:

| Piece | Where it lives | What it does |
|---|---|---|
| `war-room.gs` | your Inside Sales Apps Script project | publishes the leaderboard as JSON |
| `warroom.html` | already deployed to Vercel | the TV page |

The page is already online. It shows **preview data** until you give it the feed URL. That is one step.

---

## Step 1 — check for a clash (30 seconds)

Apps Script allows only **one `doGet`** per project. In the script editor press **Ctrl+F**, tick "search all files", and search for:

```
function doGet
```

- **No match** → you are clear, continue.
- **A match** → stop. Do not paste the file in, it would break whatever web app you already have. Tell me and I will fold the war room into your existing `doGet` instead.

## Step 2 — paste the file in

Apps Script editor → **+ → Script** → name it `WarRoom` → paste the contents of `war-room.gs` → save.

## Step 3 — prove the numbers before anyone sees them

Run these two. **Both are read only. Neither writes to any sheet, and neither opens CBC or the Payment Tracker.**

```
warRoomSelfTest      prints PASS/FAIL for the parsing and folding logic
warRoomPreview       prints the exact numbers the TV will show
```

Check `warRoomPreview`'s output against your Management Report. The company total, the city splits and the manager rows should match to the rupee. If they do not, send me the log — do not put it on a TV yet.

## Step 4 — publish the feed

**Deploy → New deployment → Web app**

| Field | Set to |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

Copy the `/exec` URL it gives you.

> **Why "Anyone".** A TV is not logged into Google. The URL is the password: it is a long random string, and it only ever returns aggregated leaderboard figures — no leads, no phone numbers, no payment rows, no email addresses. If it ever leaks, redeploy and the old URL dies.

## Step 5 — point the TV at it

Open this on the TV, with your `/exec` URL on the end:

```
https://outskill-garvit.vercel.app/warroom?api=PASTE_YOUR_EXEC_URL_HERE
```

The gold "PREVIEW DATA" chip disappears and the top right turns to **LIVE ● updated 4s ago**. That is it — you never edit a file to change the feed, the URL carries it.

---

## Putting it on the TVs

Any of these work. Ranked by how little they go wrong.

**A cheap Chromecast/Android TV stick, or the TV's own browser** — open the URL, press **F** for fullscreen. Simplest, but some TV browsers sleep after a few hours.

**A Fire TV Stick or an old laptop behind the TV, running Chrome in kiosk mode** — the most reliable, and what I would use:

```
chrome --kiosk --noerrdialogs --disable-infobars --incognito \
  --disable-session-crashed-bubble --autoplay-policy=no-user-gesture-required \
  "https://outskill-garvit.vercel.app/warroom?api=YOUR_EXEC_URL"
```

**A Raspberry Pi** — same Chrome command in `~/.config/autostart`. Add `xset s off; xset -dpms; xset s noblank` so the screen never sleeps.

Whatever you pick, in the TV settings turn **off** screen saver, sleep timer and any "energy saving" auto-dim. That is the single most common reason a board goes black at 4pm.

The page reloads itself once a night at 04:00 to clear out any browser cruft, so it is genuinely fine to leave running for months.

---

## Changing the offer on screen

Edit `public/warroom.html`, find `CONFIG.INITIATIVE` near the top, change the text, push. Under a minute:

```javascript
INITIATIVE: {
  active: true,                    // false removes the screen from rotation
  title: 'SEPTEMBER SPRINT',
  detail: 'Every unit closed before month end counts double...',
  eligibility: 'All agents, all cities',
  period: '1 - 30 September',
  reward: 'Podium + spot incentive',
  goalRevenue: 0                   // set a number to show a progress bar to it
}
```

---

## Everything you can change without touching code

Put these on the TV's URL after the `?api=...`:

| Option | Default | What it does |
|---|---|---|
| `&rotate=13` | 13 | seconds each screen is held |
| `&refresh=30` | 30 | seconds between data polls (floored at 10 to protect the Apps Script quota) |
| `&sound=1` | off | a chime on milestones. Off by default — several TVs in one room is a nightmare |
| `&screens=overall,managers,agents` | all 13 | pick and order the screens yourself |
| `&api=...` | none | the feed URL |

Screen names: `overall`, `city:Bangalore`, `city:Hyderabad`, `city:Bhubaneswar`, `managers`, `agents`, `teams`, `targetbattle`, `awards`, `initiative`, `interstitial`.

So a Hyderabad-only board on a 20 second rotation is just:

```
...?api=YOUR_URL&rotate=20&screens=city:Hyderabad,managers,awards,interstitial
```

Keyboard, if you ever want it: **←/→** step through screens, **F** fullscreen.

---

## Where the numbers come from

```
Payment Tracker ──IMPORTRANGE──> src_Payments ──> mdl_Payments ─┐
                                                                ├─> war-room.gs ──JSON──> the TV
CBC ─────────────IMPORTRANGE──> src_Roster_* ──> mdl_Roster  ───┘
```

The feed reads **only** `mdl_Payments` and `mdl_Roster` — the same two tabs every existing page reads. It never opens CBC or the Payment Tracker, and it writes to no sheet. So the TV cannot drift from the Management Report: if a number is wrong on the TV it is wrong on the report too, and the fix is the same fix.

The only thing it stores is each morning's opening ranks, and that sits in Script Properties, not on a sheet. That is what makes "▲ 3" mean "up 3 places since this morning".

**Refresh cadence.** The TV polls every 30s; the feed caches for 45s. So five TVs polling do not mean five sheet reads — it is about one a minute regardless of how many screens you hang. New numbers reach the TV within about a minute of `updateAndCheck` finishing.

### One number that needs explaining

The company total is **every rupee paid in the month**. The city and manager boards only cover people on that month's roster. When somebody is paid but is not on the roster, their money is in the company total but in no city or manager board — so the overall screen says so in plain text underneath, rather than quietly hiding the gap. Get them onto `mdl_Roster` and the line disappears by itself.

---

## When something breaks

| On screen | What happened | What to do |
|---|---|---|
| Gold **PREVIEW DATA** chip | no `?api=` on the URL, or the feed is unreachable | check the URL has `?api=`, and that the deployment is set to "Anyone" |
| **updated 3m ago** in amber | a poll or two was missed | usually nothing, it self-corrects |
| **reconnecting · last 12m ago** in red | the feed has been down a while | run `warRoomPreview` in the editor — if that fails, Apps Script quota or a `#REF!` in `src_Payments` |
| Numbers frozen but the clock is live | the sheet itself has not refreshed | run `updateAndCheck` |
| All zeroes | the roster has no rows for this month | add the month to `mdl_Roster` |

**The board never goes blank.** If the feed dies it keeps showing the last good figures and tells you how old they are, because a stale number that is labelled stale is useful and an empty screen is not.

---

## What it does not do

- **Polling, not push.** Apps Script cannot push, so a new sale appears within about a minute rather than instantly.
- **Month to date only.** No week or quarter view yet.
- **It inherits the sheet's accuracy.** It is a window onto `mdl_Payments`, not a second opinion. The 3.24 L CBC gap and the 13 `#N/A` DOJ lookups will show up here exactly as they show up everywhere else.
- **Rank movement resets at midnight** and is empty on the very first day, because there is no earlier snapshot to compare against. That is honest rather than wrong.
- **One `doGet` per project** — see step 1.
- **No history.** It shows now, not a trend over time.

## Worth adding later, in the order I would do it

1. **Yesterday and last month** alongside MTD, for context on whether today is actually good.
2. **A daily snapshot tab** so the board can draw a trend line and month-on-month comparisons.
3. **A "just closed" toast** — the feed already knows the latest payment timestamp, so a name flashing up seconds after a close is a small change with a big effect on the floor.
4. **Per-city TVs auto-detecting their own city** from the URL, so one link works everywhere.
5. **Photos on the podium.** Faces beat names on a leaderboard.
6. **A Slack post** of the final board at month end, reusing the same feed.
