#!/usr/bin/env node
// First-pass link checker for source links and help resources.
// Some government sites (for example consumer.ftc.gov) block automated
// requests and return 403/404 to scripts. Anything flagged here must be
// opened in a real browser before you decide it's broken.
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const files = [];
(function walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (['.md', '.json'].includes(extname(d.name))) files.push(p);
  }
})(join(ROOT, 'src'));

const urls = new Map();
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https:\/\/[^\s"'<>)\]]+/g)) {
    const url = m[0].replace(/[.,]+$/, '');
    if (url.includes('YOUR-ORG') || url.endsWith('...')) continue;
    if (!urls.has(url)) urls.set(url, new Set());
    urls.get(url).add(f.replace(ROOT, ''));
  }
}

let failed = 0;
for (const [url, where] of urls) {
  let status;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SafeClick link checker)' },
    });
    status = res.status;
  } catch (e) {
    status = e.name === 'TimeoutError' ? 'timeout' : 'error';
  }
  const ok = typeof status === 'number' && status < 400;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✖'} ${status}  ${url}${ok ? '' : `\n      in ${[...where].join(', ')}`}`);
}
console.log(`\n${urls.size} links checked, ${failed} flagged.${failed ? ' Open flagged links in a browser to confirm.' : ''}`);
process.exit(failed ? 1 : 0);
