#!/usr/bin/env node
/**
 * Fails while the Arabic on this site is still a draft.
 *
 * Mera's whole argument is that its Arabic was written for an Arabic buyer
 * rather than generated. Draft copy that reaches the deployed site does not
 * merely look unfinished — it makes the site disprove the claim it exists to
 * make, and nobody looking at it would be able to tell. So the check is a
 * build gate, not a lint warning.
 *
 * It passes only when docs/ar-copy.json says _STATUS is APPROVED and the AR
 * page carries no draft marker. Run it before every deploy.
 *
 * Usage: node scripts/check-copy-status.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (msg) => {
  console.error(`copy status: ${msg}`);
  process.exit(1);
};

let copy;
try {
  copy = JSON.parse(readFileSync(join(root, 'docs', 'ar-copy.json'), 'utf8'));
} catch {
  fail('docs/ar-copy.json is missing or unreadable.');
}

const status = String(copy._STATUS ?? '').toUpperCase();
if (status !== 'APPROVED') {
  fail(
    `_STATUS is "${copy._STATUS ?? '(unset)'}", not APPROVED. The Arabic on this site has not been written or signed off by a person yet, so it must not deploy. See docs/ar-copy.json _STATUS_NOTE.`,
  );
}

const ar = readFileSync(join(root, 'src', 'pages', 'ar', 'index.astro'), 'utf8');
if (ar.includes('AR COPY STATUS: DRAFT')) {
  fail('src/pages/ar/index.astro still carries the draft marker — re-run scripts/apply-ar-copy.mjs after approval.');
}
const pending = (ar.match(/\[pending\]/g) || []).length;
if (pending) fail(`${pending} string(s) on the AR page are still [pending].`);

console.log('copy status: APPROVED, no draft marker, nothing pending.');
