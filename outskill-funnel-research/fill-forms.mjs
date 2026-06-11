#!/usr/bin/env node
/**
 * Outskill funnel sanity-check automation.
 *
 * For every form id in forms.json this script:
 *   1. Opens the form in a BRAND-NEW browser context (fresh cookies/storage),
 *      so nothing is cached between forms.
 *   2. Heuristically fills every required field with random-but-valid data.
 *   3. Steps through multi-page forms (Next / Continue) and submits.
 *   4. Watches navigations, popups and the DOM for a WhatsApp link
 *      (chat.whatsapp.com / wa.me / api.whatsapp.com).
 *   5. Optionally opens that invite link to read the WhatsApp GROUP NAME.
 *   6. Writes output/results.csv, output/results.json, a screenshot and the
 *      final HTML for each form, and prints a summary table.
 *
 * Usage:
 *   node fill-forms.mjs                 # all forms, headless
 *   node fill-forms.mjs --headed        # watch the browser (debug)
 *   node fill-forms.mjs --id=18437      # one form only
 *   node fill-forms.mjs --limit=3       # first 3 forms
 *   node fill-forms.mjs --no-groupname  # skip opening WhatsApp invite pages
 *   node fill-forms.mjs --concurrency=3 # run N forms in parallel (default 2)
 *
 * Requires: npm i  (installs playwright)  &&  npx playwright install chromium
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ---------- CLI args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const HEADLESS = !args.headed;
const ONLY_ID = args.id ? String(args.id) : null;
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const GET_GROUP_NAME = !args['no-groupname'];
const CONCURRENCY = Math.max(1, parseInt(args.concurrency || '2', 10));
const STEP_TIMEOUT = 45000;

const cfg = JSON.parse(readFileSync(join(__dirname, 'forms.json'), 'utf8'));

// flatten {id, segment} preserving order
const jobs = [];
for (const seg of cfg.segments) {
  for (const id of seg.ids) {
    if (ONLY_ID && String(id) !== ONLY_ID) continue;
    jobs.push({ id: String(id), segment: seg.segment });
  }
}
const targetJobs = jobs.slice(0, LIMIT);

// ---------- random data ----------
const rnd = (n) => Math.floor(Math.random() * n);
const FIRST = ['Aarav', 'Vivaan', 'Diya', 'Anaya', 'Kabir', 'Mira', 'Rohan', 'Sara', 'Arjun', 'Isha'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Singh', 'Mehta', 'Bose'];
const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Gurugram'];
function makeProfile() {
  const fn = FIRST[rnd(FIRST.length)];
  const ln = LAST[rnd(LAST.length)];
  const tag = Date.now().toString(36) + rnd(9999);
  // Valid Indian mobile: starts 6-9, 10 digits total.
  const phone = String(6 + rnd(4)) + Array.from({ length: 9 }, () => rnd(10)).join('');
  return {
    firstName: fn,
    lastName: ln,
    fullName: `${fn} ${ln}`,
    email: `qa.test.${tag}@gmail.com`,
    phone,
    city: CITIES[rnd(CITIES.length)],
    company: `${ln} Labs`,
    role: 'Software Engineer',
    generic: 'Test',
  };
}

// ---------- field filling ----------
// Decide what value a given input should get, based on its metadata.
function valueFor(meta, p) {
  const hay = `${meta.name} ${meta.id} ${meta.placeholder} ${meta.label} ${meta.aria}`.toLowerCase();
  const has = (...kw) => kw.some((k) => hay.includes(k));
  if (meta.type === 'email' || has('email', 'e-mail')) return p.email;
  if (meta.type === 'tel' || has('phone', 'mobile', 'whatsapp number', 'contact number', 'tel')) return p.phone;
  if (has('first name', 'firstname', 'fname')) return p.firstName;
  if (has('last name', 'lastname', 'lname', 'surname')) return p.lastName;
  if (has('full name', 'your name', 'name')) return p.fullName;
  if (has('city', 'location', 'town')) return p.city;
  if (has('company', 'organisation', 'organization', 'employer')) return p.company;
  if (has('role', 'designation', 'title', 'profession', 'occupation')) return p.role;
  if (has('age')) return String(22 + rnd(20));
  if (has('experience', 'years')) return String(1 + rnd(10));
  if (meta.type === 'number') return String(1 + rnd(9));
  if (meta.type === 'url') return 'https://example.com';
  return p.fullName; // sensible default for unknown text fields
}

async function fillVisibleFields(page, p, log) {
  // text-like inputs + textareas
  const handles = await page.$$(
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea'
  );
  for (const h of handles) {
    try {
      if (!(await h.isVisible()) || !(await h.isEditable())) continue;
      const meta = await h.evaluate((el) => ({
        type: el.type || el.tagName.toLowerCase(),
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        aria: el.getAttribute('aria-label') || '',
        label: (el.labels && el.labels[0] && el.labels[0].innerText) || '',
        value: el.value || '',
      }));
      if (meta.value && meta.value.trim()) continue; // already filled
      const v = valueFor(meta, p);
      await h.fill(v).catch(() => h.type(v, { delay: 10 }));
      log.push(`  filled ${meta.type} "${meta.name || meta.id || meta.placeholder || meta.label}" = ${v}`);
    } catch { /* skip stubborn field */ }
  }

  // selects -> first non-placeholder option
  for (const s of await page.$$('select')) {
    try {
      if (!(await s.isVisible())) continue;
      const opts = await s.$$eval('option', (os) =>
        os.map((o, i) => ({ i, value: o.value, text: o.textContent.trim(), disabled: o.disabled }))
      );
      const pick = opts.find((o, idx) => idx > 0 && o.value && !o.disabled) || opts[1] || opts[0];
      if (pick) {
        await s.selectOption(pick.value).catch(() => {});
        log.push(`  select = ${pick.text}`);
      }
    } catch { /* */ }
  }

  // radios -> choose first option of each group
  const radioGroups = new Set();
  for (const r of await page.$$('input[type=radio]')) {
    try {
      if (!(await r.isVisible())) continue;
      const name = (await r.getAttribute('name')) || Math.random();
      if (radioGroups.has(name)) continue;
      radioGroups.add(name);
      await r.check({ force: true }).catch(() => {});
    } catch { /* */ }
  }

  // checkboxes -> tick consent / required ones
  for (const c of await page.$$('input[type=checkbox]')) {
    try {
      if (!(await c.isVisible())) continue;
      const meta = await c.evaluate((el) => ({
        req: el.required,
        lbl: ((el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute('aria-label') || '').toLowerCase(),
      }));
      if (meta.req || /agree|consent|terms|whatsapp|updates|i accept/.test(meta.lbl)) {
        await c.check({ force: true }).catch(() => {});
      }
    } catch { /* */ }
  }
}

// ---------- WhatsApp detection ----------
const WA_RE = /(chat\.whatsapp\.com\/[A-Za-z0-9]+|wa\.me\/\S+|api\.whatsapp\.com\/send\S*)/i;
function extractWA(str) {
  if (!str) return null;
  const m = String(str).match(WA_RE);
  return m ? (m[0].startsWith('http') ? m[0] : 'https://' + m[0]) : null;
}

async function scanDomForWA(page) {
  try {
    return await page.evaluate(() => {
      const re = /(chat\.whatsapp\.com\/[A-Za-z0-9]+|wa\.me\/\S+|api\.whatsapp\.com\/send\S*)/i;
      // anchors / buttons first
      for (const a of document.querySelectorAll('a[href]')) {
        const m = a.href.match(re);
        if (m) return m[0].startsWith('http') ? m[0] : 'https://' + m[0];
      }
      for (const el of document.querySelectorAll('[onclick],button,[data-href],[data-url]')) {
        const s = el.getAttribute('onclick') || el.getAttribute('data-href') || el.getAttribute('data-url') || '';
        const m = s.match(re);
        if (m) return m[0].startsWith('http') ? m[0] : 'https://' + m[0];
      }
      const m = document.documentElement.innerHTML.match(re);
      return m ? (m[0].startsWith('http') ? m[0] : 'https://' + m[0]) : null;
    });
  } catch {
    return null;
  }
}

// Resolve the group name by opening the invite link (read-only; does not join).
async function resolveGroupName(context, waUrl) {
  if (!waUrl || !/chat\.whatsapp\.com/.test(waUrl)) return '';
  const page = await context.newPage();
  try {
    await page.goto(waUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const name = await page.evaluate(() => {
      const og = document.querySelector('meta[property="og:title"]')?.content;
      const h3 = document.querySelector('h3')?.innerText;
      const desc = document.querySelector('meta[property="og:description"]')?.content;
      const title = document.title;
      return { og, h3, desc, title };
    });
    // og:title is usually the cleanest ("<Group Name>") on invite pages.
    const candidate = (name.og || name.h3 || name.title || '').trim();
    return candidate.replace(/\s*\|\s*WhatsApp.*$/i, '').trim();
  } catch {
    return '';
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------- per-form runner ----------
async function processForm(browser, job) {
  const url = cfg.urlTemplate.replace('{id}', job.id);
  const result = {
    segment: job.segment,
    formId: job.id,
    url,
    status: 'unknown',
    whatsappLink: '',
    groupName: '',
    finalUrl: '',
    notes: '',
    log: [],
  };
  const p = makeProfile();
  // fresh, isolated context => no caching between forms
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });
  const waSeen = new Set();
  context.on('page', (pg) => pg.on('framenavigated', () => {})); // ensure popups tracked
  const page = await context.newPage();
  // capture WhatsApp appearing in any navigation / new tab / request
  const track = (u) => { const w = extractWA(u); if (w) waSeen.add(w); };
  page.on('framenavigated', (f) => track(f.url()));
  page.on('popup', (pg) => { track(pg.url()); pg.on('framenavigated', (f) => track(f.url())); });
  context.on('request', (r) => track(r.url()));

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT });
    const httpStatus = resp ? resp.status() : 0;
    result.notes = `http ${httpStatus || '?'}`;
    await page.waitForTimeout(2500); // let JS render

    // early block / bot-protection detection
    const bodyText = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).slice(0, 400);
    const blockedSig = /not in allowlist|access denied|forbidden|are you a robot|verify you are human|cloudflare|captcha|attention required|just a moment/i;
    if ([401, 403, 429, 503].includes(httpStatus) || blockedSig.test(bodyText)) {
      result.status = 'blocked';
      result.notes = `${result.notes} | blocked: ${bodyText.replace(/\s+/g, ' ').trim().slice(0, 120)}`;
      await page.screenshot({ path: join(OUT_DIR, `form-${job.id}.png`), fullPage: true }).catch(() => {});
      await context.close().catch(() => {});
      return result;
    }

    // dismiss obvious cookie/consent overlays
    for (const t of ['Accept', 'I agree', 'Got it', 'Allow all', 'Accept all']) {
      const b = page.getByRole('button', { name: new RegExp(t, 'i') }).first();
      if (await b.count().catch(() => 0)) await b.click({ timeout: 1500 }).catch(() => {});
    }

    // step through up to 8 pages of the form
    const SUBMIT_RE = /^(submit|register|apply|join|finish|complete|book|reserve|get|claim|start)/i;
    const NEXT_RE = /^(next|continue|proceed|save|ok)/i;
    for (let step = 0; step < 8; step++) {
      track(page.url());
      let wa = extractWA(page.url()) || (await scanDomForWA(page));
      if (wa) waSeen.add(wa);
      if (waSeen.size) break;

      await fillVisibleFields(page, p, result.log);

      // find a forward/submit button that is visible & enabled
      const buttons = await page.$$('button, input[type=submit], a[role=button], [role=button]');
      let clicked = false;
      // prefer submit-like over next-like only on what looks like the last step;
      // simplest robust approach: click submit-like if present, else next-like.
      const labelled = [];
      for (const b of buttons) {
        try {
          if (!(await b.isVisible())) continue;
          const txt = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value')) || '').trim();
          if (!txt) continue;
          labelled.push({ b, txt });
        } catch { /* */ }
      }
      const submitBtn = labelled.find((x) => SUBMIT_RE.test(x.txt));
      const nextBtn = labelled.find((x) => NEXT_RE.test(x.txt));
      const target = submitBtn || nextBtn || labelled[labelled.length - 1];
      if (target) {
        result.log.push(`  step ${step}: click "${target.txt}"`);
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT }).catch(() => {}),
          target.b.click({ timeout: 8000 }).catch((e) => result.log.push(`  click failed: ${e.message.split('\n')[0]}`)),
        ]);
        clicked = true;
        await page.waitForTimeout(2500);
      }

      track(page.url());
      wa = extractWA(page.url()) || (await scanDomForWA(page));
      if (wa) waSeen.add(wa);
      if (waSeen.size) break;
      if (!clicked) break; // nothing left to do
    }

    // final sweep
    track(page.url());
    const finalWa = await scanDomForWA(page);
    if (finalWa) waSeen.add(finalWa);
    result.finalUrl = page.url();

    // screenshot + html evidence
    await page.screenshot({ path: join(OUT_DIR, `form-${job.id}.png`), fullPage: true }).catch(() => {});
    writeFileSync(join(OUT_DIR, `form-${job.id}.html`), await page.content().catch(() => ''));

    const chosen =
      [...waSeen].find((u) => /chat\.whatsapp\.com/.test(u)) || [...waSeen][0] || '';
    if (chosen) {
      result.whatsappLink = chosen;
      result.status = 'whatsapp_found';
      if (GET_GROUP_NAME) result.groupName = await resolveGroupName(context, chosen);
    } else {
      result.status = /not in allowlist|forbidden/i.test(result.notes) ? 'blocked' : 'no_whatsapp_found';
    }
  } catch (e) {
    result.status = 'error';
    result.notes = (result.notes + ' | ' + e.message.split('\n')[0]).trim();
  } finally {
    await context.close().catch(() => {});
  }
  result.log = result.log.slice(0, 40); // trim
  return result;
}

// ---------- pool ----------
async function runPool(browser, items, n, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      process.stdout.write(`[${idx + 1}/${items.length}] form ${item.id} (${item.segment}) ...\n`);
      out[idx] = await fn(browser, item);
      process.stdout.write(`    -> ${out[idx].status} ${out[idx].whatsappLink || ''} ${out[idx].groupName ? '("' + out[idx].groupName + '")' : ''}\n`);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------- main ----------
function csvCell(s) {
  s = String(s ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
  if (!targetJobs.length) {
    console.error('No form ids to process (check forms.json or --id filter).');
    process.exit(1);
  }
  console.log(`Processing ${targetJobs.length} form(s), concurrency=${CONCURRENCY}, headless=${HEADLESS}\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  let results;
  try {
    results = await runPool(browser, targetJobs, CONCURRENCY, processForm);
  } finally {
    await browser.close();
  }

  // write json
  writeFileSync(join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  // write csv
  const header = ['Segment', 'Form ID', 'Status', 'WhatsApp Join Link', 'WhatsApp Group Name', 'Final URL', 'Notes'];
  const rows = results.map((r) =>
    [r.segment, r.formId, r.status, r.whatsappLink, r.groupName, r.finalUrl, r.notes].map(csvCell).join(',')
  );
  writeFileSync(join(OUT_DIR, 'results.csv'), [header.join(','), ...rows].join('\n'));

  // console table
  console.log('\n================ RESULTS ================\n');
  console.table(
    results.map((r) => ({
      Segment: r.segment,
      'Form ID': r.formId,
      Status: r.status,
      'WhatsApp Link': r.whatsappLink || '—',
      'Group Name': r.groupName || '—',
    }))
  );
  console.log(`\nSaved: output/results.csv, output/results.json, output/form-<id>.png/.html`);
})();
