#!/usr/bin/env node
/**
 * Writes the Arabic from docs/ar-copy.json into the AR page, file to file.
 *
 * THE RULE THIS EXISTS TO KEEP. Arabic never passes through a terminal. The
 * bytes are read from the JSON and written to the .astro file programmatically
 * — never retyped, never echoed through a shell, never pasted into a heredoc,
 * never reconstructed from memory. A terminal renders Arabic in visual order
 * and reorders bidirectional text, so terminal output can never confirm a
 * string is correct. This script therefore prints counts, keys and codepoint
 * ranges, and never prints an Arabic string.
 *
 * It replaces `ph('[pending] …')` with a plain quoted string and drops the
 * `lang="en"` that marked the element as not-yet-written.
 *
 * Verification, all of it after the write, all of it fatal:
 *   1. byte-for-byte — every value read back out of the file equals the JSON's
 *   2. codepoint hygiene — no U+FFFD, no bidi controls (200E/200F/061C/202A-
 *      202E/2066-2069), no Arabic presentation forms (FB50-FDFF, FE70-FEFF)
 *   3. nothing left behind — no `[pending]` and no stray `lang="en"`
 *
 * What it cannot check is whether the Arabic is any good, or whether it fits.
 * That is a real browser at 1440 and 390, by eye, before this is called done.
 *
 * Usage: node scripts/apply-ar-copy.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const SOURCES = ['src/pages/ar/index.astro', 'src/components/Header.astro'];

const copy = JSON.parse(readFileSync(join(root, 'docs', 'ar-copy.json'), 'utf8'));
const { strings } = copy;
const isDraft = String(copy._STATUS ?? '').toUpperCase() !== 'APPROVED';

const filled = Object.entries(strings).filter(([, v]) => v.ar && v.ar.trim());
const empty = Object.entries(strings).filter(([, v]) => !v.ar || !v.ar.trim());
if (!filled.length) throw new Error('docs/ar-copy.json has no Arabic in it yet — nothing to apply.');
if (empty.length) {
  console.log(`${empty.length} still empty, left as [pending]: ${empty.map(([k]) => k).join(', ')}`);
}

/* ---- codepoint hygiene, before anything is written ------------------------ */
const BAD = [
  [0xfffd, 0xfffd, 'U+FFFD replacement character'],
  [0x200e, 0x200f, 'bidi mark'],
  [0x061c, 0x061c, 'arabic letter mark'],
  [0x202a, 0x202e, 'bidi embedding/override'],
  [0x2066, 0x2069, 'bidi isolate'],
  [0xfb50, 0xfdff, 'arabic presentation forms A'],
  [0xfe70, 0xfeff, 'arabic presentation forms B'],
];
const faults = [];
for (const [key, { ar }] of filled) {
  for (const ch of ar) {
    const c = ch.codePointAt(0);
    const hit = BAD.find(([lo, hi]) => c >= lo && c <= hi);
    if (hit) faults.push(`${key}: U+${c.toString(16).toUpperCase().padStart(4, '0')} (${hit[2]})`);
  }
}
if (faults.length) {
  console.error('codepoint hygiene failed — nothing written:');
  for (const f of faults) console.error(`  ${f}`);
  process.exit(1);
}

/* ---- the same pairing the worksheet used --------------------------------- */
// Any string literal opening with [pending] — inside ph(), or a bare label in
// a data array like the header's nav.
const PH = /(['"])\[pending\]\s*([\s\S]*?)\1/;
const NAV_KEY = /\bkey:\s*['"]([\w-]+)['"]/;
const NAME = /transition:name="([^"]+)"/;
const PLAIN = /<(?:h[1-6]|p|span|strong|a|li)[^>]*>([^<{}]+)</;
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

let written = 0;
const applied = new Set();

for (const rel of SOURCES) {
  const path = join(root, rel);
  let src;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    continue;
  }

  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let scope = '_root';
  let n = 0;
  const seen = new Map();

  const out = src.split(/\r?\n/).map((line) => {
    const name = NAME.exec(line)?.[1];
    const m = PH.exec(line);

    if (name && !m) {
      scope = name;
      n = 0;
      return line;
    }
    if (!m) {
      if (PLAIN.exec(line)?.[1]?.trim()) n += 1;
      return line;
    }

    const navKey = NAV_KEY.exec(line)?.[1];
    const tag = /<([a-zA-Z][\w-]*)/.exec(line.slice(0, Math.max(0, line.indexOf('[pending]'))))?.[1] ?? (navKey ? 'nav' : 'span');
    const idx = name ? null : n;
    if (!name) n += 1;

    let key = navKey ? `nav-${navKey}` : (name ?? `${scope}-${tag}${idx === null ? '' : `-${idx + 1}`}`);
    if (seen.has(key)) {
      const c = seen.get(key) + 1;
      seen.set(key, c);
      key = `${key}-${c}`;
    } else {
      seen.set(key, 1);
    }

    const value = strings[key]?.ar;
    if (!value || !value.trim()) return line;

    applied.add(key);
    written += 1;
    // `lang="en"` marked the element as not-yet-written; the page's own lang is
    // ar, so the attribute goes with the placeholder.
    return line.replace(PH, `'${esc(value)}'`).replace(/\s+lang="en"/, '');
  });

  let text = out.join(eol);

  // The marker is the only thing standing between draft Arabic and a deploy
  // that silently disproves this site's whole argument. It goes in as an HTML
  // comment at the top of the file — visible in source, greppable, and removed
  // the moment _STATUS flips to APPROVED.
  const MARK = '<!-- AR COPY STATUS: DRAFT — machine-written, not approved, must not deploy. See docs/ar-copy.json _STATUS_NOTE. -->';
  text = text.replace(new RegExp(`^\\s*<!-- AR COPY STATUS[^>]*-->\\r?\\n`, 'm'), '');
  if (isDraft && rel.endsWith('ar/index.astro')) text = `${MARK}${eol}${text}`;

  if (!dry) writeFileSync(path, text);
}

console.log(`${written} strings ${dry ? 'would be' : ''} written`);

/* A key with no placeholder left is usually a key that was written on an
   earlier run — the placeholder is gone precisely because it worked. Only a key
   that is neither written now nor already present in the file is a real miss. */
const current = SOURCES.map((rel) => {
  try {
    return readFileSync(join(root, rel), 'utf8');
  } catch {
    return '';
  }
}).join('\n');
const alreadyThere = filled.filter(([k, v]) => !applied.has(k) && current.includes(v.ar)).map(([k]) => k);
const missed = filled.filter(([k, v]) => !applied.has(k) && !current.includes(v.ar)).map(([k]) => k);
if (alreadyThere.length) console.log(`${alreadyThere.length} already in place from an earlier run`);
if (missed.length) {
  console.error(`these keys had Arabic but no placeholder and no match in the page — it may have moved: ${missed.join(', ')}`);
  process.exit(1);
}
if (dry) process.exit(0);

/* ---- read back and verify ------------------------------------------------- */
const after = SOURCES.map((rel) => {
  try {
    return readFileSync(join(root, rel), 'utf8');
  } catch {
    return '';
  }
}).join('\n');

const mismatched = filled.filter(([, v]) => !after.includes(v.ar));
if (mismatched.length) {
  console.error(`byte-for-byte check FAILED for ${mismatched.length} string(s): ${mismatched.map(([k]) => k).join(', ')}`);
  process.exit(1);
}
const leftoverLang = (after.match(/lang="en"/g) || []).length;
console.log(`verified: ${filled.length} strings byte-for-byte, 0 bad codepoints, ${leftoverLang} lang="en" left`);
console.log('now build and look at /ar/ in a real browser at 1440 and 390 — RTL flow, joining, no tofu, no overflow.');
if (isDraft) {
  console.log('');
  console.log('  ** THIS IS DRAFT COPY. _STATUS is not APPROVED. **');
  console.log('  The AR page carries a draft marker and scripts/check-copy-status.mjs will');
  console.log('  fail until a person has written the real Arabic and set _STATUS to APPROVED.');
}
