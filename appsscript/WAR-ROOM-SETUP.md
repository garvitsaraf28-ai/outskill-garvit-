# Sales War Room — setup and operation

The floor TV board. Live at **https://outskill-garvit.vercel.app/warroom**

Three pieces, nothing else:

| Piece | Where it lives | What it does |
|---|---|---|
| `war-room.gs` | paste into your Inside Sales Apps Script project | builds the leaderboard JSON |
| `exec-doget-patched.gs` | replaces the `doGet` in your Exec Web App file | routes the feed without breaking the exec page |
| `warroom.html` | already deployed to Vercel | the TV page |

The page is already online. It shows **preview data** until you give it the feed URL. That is one step.

---

## The doGet situation, settled

Apps Script allows only **one `doGet`** per project, and this project's belongs to the **Executive Command Center**. So the war room does not define one. Instead the exec `doGet` routes to the feed when the request asks for it, and serves the exec page for everything else. Both web apps share one URL without fighting.

That is why `war-room.gs` has no `doGet` in it, and why there is a second file, `exec-doget-patched.gs`.

## Step 1 — paste the WarRoom file in

Apps Script editor → **+ → Script** → name it `WarRoom` → paste the contents of `war-room.gs` → save.

## Step 2 — patch the exec doGet

Open your Exec Web App file. Replace **only** the `doGet` function with the one in `exec-doget-patched.gs`. Two lines are added at the top; the rest is byte-for-byte what you already have.

Leave `onOpen`, `showExecSidebarDialog` and `exec_inject_` alone.

The patched version guards with `typeof wr_serve_ === 'function'`, so if you paste it in before the WarRoom file exists it falls through to the exec page instead of throwing. Order does not matter.

> **While you are in there:** this file also defines `onOpen`. If any other file in the project defines `onOpen` too, Apps Script silently keeps one of them and your Executive menu may already be missing. Same trap as `refreshAndVerify`. Worth a `Ctrl+F` for `function onOpen` across all files.

## Step 3 — prove the numbers before anyone sees them

Run these two. **Both are read only. Neither writes to any sheet, and neither opens CBC or the Payment Tracker.**

```
warRoomSelfTest      prints PASS/FAIL for the parsing and folding logic
warRoomPreview       prints the exact numbers the TV will show
```

Check `warRoomPreview`'s output against your Management Report. The company total, the city splits and the manager rows should match to the rupee. If they do not, send me the log — do not put it on a TV yet.

## Step 4 — redeploy the existing web app

You already have a deployment. Do **not** make a new one — reuse it so the exec URL your people have bookmarked keeps working.

**Deploy → Manage deployments → pencil icon on the live one**

| Field | Set to |
|---|---|
| Version | **New version** ← without this the URL serves the old code |
| Execute as | **Me** |
| Who has access | **Anyone** ← changed from "Anyone with Google account" |

The `/exec` URL stays the same.

> **Why "Anyone" is unavoidable.** A TV is not signed into Google. With "Anyone with Google account" the TV gets a sign-in page instead of data, forever — I tested that exact case and the board just sits there saying the feed is unreachable.
>
> **What that costs you.** Your exec page loses its "must be signed into some Google account" speed bump. Be clear-eyed about what that bump was worth: it was not restricted to your domain, so it already let in anyone on earth with a Gmail address *and* the URL. The real protection was always the unguessable URL, and that does not change. But the exec page does become one step easier to open, so treat that URL as a password from here on and do not paste it into group chats.
>
> If you would rather not accept that, tell me — I can put a key on the exec page so it needs `?k=<secret>` to render, and then "Anyone" costs you nothing. It is about ten lines and one re-bookmark.

## Step 5 — point the TV at it

Take your `/exec` URL, add `?feed=warroom`, and put the whole thing on the end of the TV URL:

```
https://outskill-garvit.vercel.app/warroom?api=YOUR_EXEC_URL?feed=warroom
```

So it ends up looking like:

```
https://outskill-garvit.vercel.app/warroom?api=https://script.google.com/macros/s/AKfy.../exec?feed=warroom
```

Paste it raw — no need to encode anything, the two `?` do not confuse it. I tested that exact shape.

The gold "PREVIEW DATA" chip disappears and the top right turns to **LIVE ● updated 4s ago**.

**Sanity check:** open your plain `/exec` URL in a browser. You should still get the Executive Command Center, exactly as before. If you get JSON, the patch went in wrong.

---

## Putting it on the TVs

Any of these work. Ranked by how little they go wrong.

**A cheap Chromecast/Android TV stick, or the TV's own browser** — open the URL, press **F** for fullscreen. Simplest, but some TV browsers sleep after a few hours.

**A Fire TV Stick or an old laptop behind the TV, running Chrome in kiosk mode** — the most reliable, and what I would use:

```
chrome --kiosk --noerrdialogs --disable-infobars --incognito \
  --disable-session-crashed-bubble --autoplay-policy=no-user-gesture-required \
  "https://outskill-garvit.vercel.app/warroom?api=YOUR_EXEC_URL?feed=warroom"
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
| `&api=...` | none | the feed URL, with `?feed=warroom` on it |

Screen names: `overall`, `city:Bangalore`, `city:Hyderabad`, `city:Bhubaneswar`, `managers`, `agents`, `teams`, `targetbattle`, `awards`, `initiative`, `interstitial`.

So a Hyderabad-only board on a 20 second rotation is just:

```
...?api=YOUR_EXEC_URL?feed=warroom&rotate=20&screens=city:Hyderabad,managers,awards,interstitial
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
| Gold **PREVIEW DATA** chip | no `?api=` on the URL, or the feed is unreachable | check the URL has `?api=` **and `?feed=warroom` on the end of it**, and that the deployment is "Anyone" on a **New version** |
| The board shows the exec page's HTML, or never leaves PREVIEW | `feed=warroom` missing, so the router served the exec page instead of the feed | add `?feed=warroom` to the `api` value |
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
- **One `doGet` per project.** The feed is routed through the Executive Command Center's `doGet` rather than owning its own. If that function is ever rewritten, the two routing lines have to survive the rewrite.
- **No history.** It shows now, not a trend over time.

## Worth adding later, in the order I would do it

1. **Yesterday and last month** alongside MTD, for context on whether today is actually good.
2. **A daily snapshot tab** so the board can draw a trend line and month-on-month comparisons.
3. **A "just closed" toast** — the feed already knows the latest payment timestamp, so a name flashing up seconds after a close is a small change with a big effect on the floor.
4. **Per-city TVs auto-detecting their own city** from the URL, so one link works everywhere.
5. **Photos on the podium.** Faces beat names on a leaderboard.
6. **A Slack post** of the final board at month end, reusing the same feed.
