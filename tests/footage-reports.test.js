import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FOOTAGE_ITEMS } from '../js/apps/footage.js';
import { REPORT_ITEMS } from '../js/apps/reports.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('every footage item points at a file that actually exists in the repo', () => {
  assert.ok(FOOTAGE_ITEMS.length > 0);
  for (const item of FOOTAGE_ITEMS) {
    const decoded = decodeURI(item.src);
    assert.equal(existsSync(path.join(root, decoded)), true, `${item.src} should exist on disk`);
    assert.ok(item.id && item.title, 'footage item needs an id and a title');
  }
});

test('every report item points at a file that actually exists in the repo', () => {
  assert.ok(REPORT_ITEMS.length > 0);
  for (const item of REPORT_ITEMS) {
    assert.equal(existsSync(path.join(root, item.src)), true, `${item.src} should exist on disk`);
  }
});

test('REPORT_ITEMS covers every file actually present in assets/reports', () => {
  const files = readdirSync(path.join(root, 'assets/reports'));
  assert.equal(files.length, REPORT_ITEMS.length, 'no report file should be silently omitted, and no invented report should be listed');
});
