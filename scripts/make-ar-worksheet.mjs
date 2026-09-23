#!/usr/bin/env node
/**
 * Builds the Arabic worksheet for this site.
 *
 * Every Arabic string on mera-concept is written by a person, never generated
 * (D19 in the studio's plan.md — and this site is the studio's own proof that
 * it ships real Arabic, so a machine draft here would disprove the one thing
 * the project exists to demonstrate). The AR page therefore ships with every
 * string as `ph('[pending] <the EN source>')`, and this script turns those into
 * two files:
 *
 *   docs/translation-worksheet.md  what to write, with its EN sentence and
 *                                  where it lands — the readable one
 *   docs/ar-copy.json              the same keys with empty values — the file
 *                                  the writer fills in and hands back
 *
 * Then scripts/apply-ar-copy.mjs writes the filled JSON into the pages
 * file-to-file: the bytes are never retyped, echoed through a shell, pasted
 * into a heredoc or reconstructed from memory.
 *
 * PAIRING, which is the only subtle part. The AR page mirrors the EN page
 * element for element and both carry the same transition names — but the names
 * sit on the CONTAINER (`card-1`, `range-row-2`), not on the elements holding
 * the text. So an element with its own name pairs by that name, and everything
 * else pairs by (nearest enclosing name, position within it): the second
 * text-bearing element inside `card-1` on the AR page is the second one inside
 * `card-1` on the EN page. Without that, fifteen of the forty rows read
 * "matches EN card 3" and whoever writes the Arabic has to go and find the
 * sentence themselves — which is how a worksheet gets filled in against the
 * wrong line.
 *
 * Usage: node scripts/make-ar-worksheet.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['src/pages/ar/index.astro', 'src/components/Header.astro'];

// Any string literal opening with [pending] — inside ph(), or a bare label in
// a data array like the header's nav.
const PH = /(['"])\[pending\]\s*([\s\S]*?)\1/;
const NAV_KEY = /\bkey:\s*['"]([\w-]+)['"]/;
const NAME = /transition:name="([^"]+)"/;
const PLAIN = /<(?:h[1-6]|p|span|strong|a|li)[^>]*>([^<{}]+)</;
const isPointer = (t) => /\b(matches EN|see EN|from Sam|matching content)\b/i.test(t);

/* ---- the EN page, keyed the same way the AR scan keys itself -------------- */
const EN = new Map();
{
  let scope = '_root';
  let n = 0;
  for (const line of readFileSync(join(root, 'src', 'pages', 'index.astro'), 'utf8').split(/\r?\n/)) {
    const name = NAME.exec(line)?.[1];
    const text = PLAIN.exec(line)?.[1]?.trim();
    if (name && !text) {
      scope = name;
      n = 0;
      continue;
    }
    if (!text) continue;
    const key = name ?? `${scope}#${n}`;
    if (!name) n += 1;
    if (!EN.has(key)) EN.set(key, text);
  }
}

/* ---- scan the AR pages --------------------------------------------------- */
const rows = [];
const seen = new Map();

for (const rel of SOURCES) {
  let src;
  try {
    src = readFileSync(join(root, rel), 'utf8');
  } catch {
    continue;
  }

  let scope = '_root';
  let n = 0;

  src.split(/\r?\n/).forEach((line, i) => {
    const name = NAME.exec(line)?.[1];
    const m = PH.exec(line);

    if (name && !m) {
      scope = name;
      n = 0;
      return;
    }
    if (!m) {
      // A line of literal text with no placeholder still occupies a position —
      // `<p class="card__index">01</p>` is the first child of every card. The EN
      // scan counts it, so this one must too, or every index below it drifts by
      // one and "matches EN card 1" resolves to the heading above the paragraph
      // instead of the paragraph.
      if (PLAIN.exec(line)?.[1]?.trim()) n += 1;
      return;
    }

    const navKey = NAV_KEY.exec(line)?.[1];
    const tag = /<([a-zA-Z][\w-]*)/.exec(line.slice(0, Math.max(0, line.indexOf('[pending]'))))?.[1] ?? (navKey ? 'nav' : 'span');
    const cls = /class="([^"]+)"/.exec(line)?.[1];
    const idx = name ? null : n;
    if (!name) n += 1;

    let en = m[2].trim();
    if (isPointer(en)) {
      const found = name ? EN.get(name) : EN.get(`${scope}#${idx}`);
      if (found) en = found;
    }

    let key = navKey ? `nav-${navKey}` : (name ?? `${scope}-${tag}${idx === null ? '' : `-${idx + 1}`}`);
    if (seen.has(key)) {
      const c = seen.get(key) + 1;
      seen.set(key, c);
      key = `${key}-${c}`;
    } else {
      seen.set(key, 1);
    }

    rows.push({ key, en, file: rel, line: i + 1, tag, cls, thin: isPointer(en) });
  });
}

if (!rows.length) {
  // The success state, not a fault: every string has been written, so there is
  // nothing left to put on a worksheet. Leave the existing files untouched.
  console.log('no [pending] strings left — the AR copy has landed. docs/ left as it is.');
  process.exit(0);
}

/* ---- the readable worksheet ---------------------------------------------- */
const md = [
  '# Mera — Arabic worksheet',
  '',
  `${rows.length} strings. Generated by \`scripts/make-ar-worksheet.mjs\`; do not edit by hand —`,
  'fill `docs/ar-copy.json` instead.',
  '',
  '**Who writes this.** A person. Not a translation engine, and not the agent. This site is the',
  "studio's own proof that it ships Arabic written *for* an Arabic buyer rather than poured through",
  'a translator, so generated Arabic here would disprove the one thing the project exists to show.',
  '',
  '**It is not a translation exercise.** The EN column is the source *intent*, not a sentence to',
  'render word for word. Write what a Gulf procurement buyer should read. Where Arabic wants a',
  'different sentence to land the same point, write the different sentence.',
  '',
  '**Constraints from the layout, not from taste:** the hero heading wraps to about three lines on a',
  'phone, kickers are one short phrase, and the two hero buttons sit side by side so each wants two',
  'or three words. Longer is fine — it just needs a look at 390 px before it is called done.',
  '',
  '| key | EN source | where |',
  '| --- | --- | --- |',
  ...rows.map(
    (r) =>
      `| \`${r.key}\` | ${r.thin ? '**no EN pair found — write from the page** — ' : ''}${r.en.replace(/\|/g, '\\|')} | ${r.file}:${r.line} \`<${r.tag}>\`${r.cls ? ` .${r.cls.split(' ')[0]}` : ''} |`,
  ),
  '',
  '## How it gets in',
  '',
  '1. Fill `docs/ar-copy.json` — same keys, Arabic values.',
  '2. `node scripts/apply-ar-copy.mjs` — writes them into the pages file-to-file.',
  '3. It then verifies byte-for-byte against the JSON and checks codepoint hygiene (no U+FFFD, no',
  '   bidi controls, no Arabic presentation forms), and fails loudly rather than writing something',
  '   it cannot vouch for.',
  '4. Build, then look at `/ar/` in a real browser at 1440 and 390: RTL flow, joining, no tofu, no',
  '   overflow.',
  '',
].join('\n');

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'translation-worksheet.md'), md.replace(/\n/g, '\r\n'));

/* ---- the file the writer fills ------------------------------------------- */
/* MERGE, never overwrite. After the first apply the page holds Arabic instead
   of placeholders, so a fresh scan finds almost nothing — and a plain write
   would wipe every string already written. Existing Arabic and _STATUS survive,
   new keys arrive empty, and a key whose placeholder has gone is kept, because
   its absence means it was filled in, not that it stopped existing. */
const target = join(root, 'docs', 'ar-copy.json');
let existing = { strings: {} };
try {
  existing = JSON.parse(readFileSync(target, 'utf8'));
} catch {
  /* first run */
}

const merged = { ...existing.strings };
for (const r of rows) {
  merged[r.key] = { en: r.en, ar: existing.strings?.[r.key]?.ar ?? '' };
}

writeFileSync(
  target,
  `${JSON.stringify(
    {
      _README:
        existing._README ??
        'Arabic for mera-concept. Fill every "ar" value. See docs/translation-worksheet.md. Keys must not change.',
      ...(existing._STATUS ? { _STATUS: existing._STATUS } : {}),
      ...(existing._STATUS_NOTE ? { _STATUS_NOTE: existing._STATUS_NOTE } : {}),
      strings: merged,
    },
    null,
    2,
  )}\n`,
);
const kept = Object.keys(merged).length - rows.length;
if (kept > 0) console.log(`  ${kept} key(s) kept from the existing file (already filled in)`);

const thin = rows.filter((r) => r.thin);
console.log(`${rows.length} strings -> docs/translation-worksheet.md and docs/ar-copy.json`);
if (thin.length) console.log(`  ${thin.length} without an EN pair: ${thin.map((r) => r.key).join(', ')}`);
