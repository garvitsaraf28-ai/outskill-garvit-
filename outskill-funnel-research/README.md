# Outskill Funnel Sanity-Check

Fills every Outskill application form (by form id) with random valid data, walks
through multi-step forms, submits, and records the **WhatsApp join link** and
**group name** each funnel redirects to. Output is a CSV/JSON table mapping
`segment → form id → WhatsApp link → group name`.

> ⚠️ This must be run **on a machine with open internet access**. It cannot run
> inside the Claude Code web sandbox, whose network policy blocks
> `applications.outskill.com` ("Host not in allowlist"). Run it on your laptop.

## Setup (once)

```bash
cd outskill-funnel-research
npm install            # installs Playwright + downloads Chromium (postinstall)
```

If the Chromium download didn't run automatically:

```bash
npx playwright install chromium
```

## Run

```bash
npm start                          # all forms in forms.json, headless, 2 in parallel
node fill-forms.mjs --headed       # watch the browser (great for first debug run)
node fill-forms.mjs --id=18437     # just one form
node fill-forms.mjs --limit=3      # first 3 forms only
node fill-forms.mjs --concurrency=4
node fill-forms.mjs --no-groupname # skip opening WhatsApp invite pages to read the name
```

## Output

After a run, check the `output/` folder:

| File | What |
|------|------|
| `results.csv`  | The table you asked for — open in Sheets/Excel |
| `results.json` | Same data + per-form fill log for debugging |
| `form-<id>.png`  | Full-page screenshot of where each form ended up (proof of WhatsApp screen) |
| `form-<id>.html` | Saved HTML of the final page |

A summary table is also printed to the console.

### Status column meanings
- `whatsapp_found` — captured a WhatsApp link (and group name if reachable).
- `no_whatsapp_found` — form submitted but no WhatsApp redirect detected (inspect the screenshot/html — the form may have changed, needs a field the heuristics missed, or genuinely doesn't redirect).
- `blocked` — network/bot-protection blocked the page.
- `error` — navigation/automation error (see `notes`).

## Editing the form list

`forms.json` holds every segment and its form ids exactly as provided. Add or
remove ids there. `urlTemplate` controls the URL shape —
`https://applications.outskill.com/2021/{id}`; change the `2021` segment if a
funnel lives under a different path.

## How field-filling works (and tuning it)

The script is **funnel-agnostic**: it detects fields by `type`, `name`,
`placeholder`, label and `aria-label`, then fills name/email/phone/city/etc with
random valid values (Indian 10-digit mobiles, fresh `qa.test.*@gmail.com`
emails). Selects pick the first real option; required radios/checkboxes/consent
boxes are ticked; it clicks `Next/Continue` then `Submit/Register/Apply/Join`.

If a specific funnel uses unusual field names and a field is left blank, add a
keyword to the `valueFor()` matcher (or the consent regex) in `fill-forms.mjs`.
Run that one form with `--headed --id=<id>` to watch exactly where it stops.
