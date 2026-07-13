#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildRatchetIndex,
  findAffectedPrds,
  verifyRatchet,
} from '../../loop-kit/bin/ratchet.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const CLI = join(ROOT, 'loop-kit', 'bin', 'ratchet.mjs');
let passed = 0;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function write(root, rel, value) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, value);
  return abs;
}

function json(root, rel, value) {
  return write(root, rel, JSON.stringify(value, null, 2) + '\n');
}

function prd(root, name, checksums) {
  return json(root, `loop/prd-${name}.json`, {
    schemaVersion: 1,
    task: name,
    testChecksums: checksums,
    stories: [{ id: 's1', desc: name, lane: 'implementation', acceptance: ['node -e "process.exit(0)"'], passes: false }],
  });
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (error) {
    console.error(`RED ${name}: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'casey-ratchet-index-'));
try {
  const shared = 'tests/shared.golden.mjs';
  const unique = 'tests/unique.fixture.json';
  const sharedBytes = 'shared-v1\n';
  const uniqueBytes = '{"ok":true}\n';
  write(tmp, shared, sharedBytes);
  write(tmp, unique, uniqueBytes);
  prd(tmp, 'alpha', { [shared]: sha256(sharedBytes), [unique]: sha256(uniqueBytes) });
  prd(tmp, 'beta', { [shared]: sha256(sharedBytes) });

  test('builds a deterministic reverse index for shared frozen files', () => {
    const index = buildRatchetIndex(tmp);
    assert.equal(index.schemaVersion, 1);
    assert.deepEqual(Object.keys(index.files), [shared, unique]);
    assert.deepEqual(index.files[shared].prds, ['loop/prd-alpha.json', 'loop/prd-beta.json']);
    assert.deepEqual(index.files[shared].expectedHashes, [sha256(sharedBytes)]);
    assert.equal(index.files[shared].consistent, true);
    assert.deepEqual(index.prds, ['loop/prd-alpha.json', 'loop/prd-beta.json']);
  });

  test('verifies a clean repository', () => {
    const result = verifyRatchet(tmp);
    assert.equal(result.ok, true);
    assert.deepEqual(result.issues, []);
    assert.equal(result.summary.prdCount, 2);
    assert.equal(result.summary.frozenFileCount, 2);
    assert.equal(result.summary.referenceCount, 3);
  });

  test('reports every PRD affected by actual byte drift', () => {
    write(tmp, shared, 'shared-v2\n');
    const result = verifyRatchet(tmp);
    assert.equal(result.ok, false);
    const mismatches = result.issues.filter((issue) => issue.code === 'CHECKSUM_MISMATCH');
    assert.deepEqual(mismatches.map((issue) => issue.prd), ['loop/prd-alpha.json', 'loop/prd-beta.json']);
    write(tmp, shared, sharedBytes);
  });

  test('reports conflicting expectations for the same frozen file', () => {
    const betaPath = join(tmp, 'loop', 'prd-beta.json');
    const beta = JSON.parse(readFileSync(betaPath, 'utf8'));
    beta.testChecksums[shared] = sha256('other\n');
    writeFileSync(betaPath, JSON.stringify(beta, null, 2) + '\n');
    const result = verifyRatchet(tmp);
    const conflicts = result.issues.filter((issue) => issue.code === 'CONFLICTING_EXPECTATIONS');
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].file, shared);
    beta.testChecksums[shared] = sha256(sharedBytes);
    writeFileSync(betaPath, JSON.stringify(beta, null, 2) + '\n');
  });

  test('fails closed for missing files, malformed PRDs, invalid checksum maps, and unsafe paths', () => {
    prd(tmp, 'missing', { 'tests/missing.txt': sha256('missing') });
    write(tmp, 'loop/prd-bad-json.json', '{');
    json(tmp, 'loop/prd-bad-map.json', { schemaVersion: 1, task: 'bad-map', testChecksums: [], stories: [] });
    prd(tmp, 'escape', { '../outside.txt': sha256('outside'), '/absolute.txt': sha256('absolute') });
    const result = verifyRatchet(tmp);
    const codes = new Set(result.issues.map((issue) => issue.code));
    assert.equal(result.ok, false);
    assert.ok(codes.has('FILE_MISSING'));
    assert.ok(codes.has('PRD_PARSE_ERROR'));
    assert.ok(codes.has('TEST_CHECKSUMS_INVALID'));
    assert.ok(codes.has('UNSAFE_PATH'));
  });

  test('finds all PRDs affected by changed frozen files', () => {
    const index = buildRatchetIndex(tmp);
    const result = findAffectedPrds(index, [unique, shared, shared]);
    assert.deepEqual(result.files, [shared, unique]);
    assert.deepEqual(result.prds, ['loop/prd-alpha.json', 'loop/prd-beta.json']);
    assert.deepEqual(result.untracked, []);
    const unknown = findAffectedPrds(index, ['lib/untracked.mjs']);
    assert.deepEqual(unknown.prds, []);
    assert.deepEqual(unknown.untracked, ['lib/untracked.mjs']);
  });

  test('CLI has deterministic JSON and meaningful exit codes', () => {
    const clean = spawnSync(process.execPath, [CLI, 'verify', '--root', tmp, '--json'], { encoding: 'utf8' });
    assert.equal(clean.status, 1, 'fixture still contains deliberate invalid PRDs and must fail closed');
    const parsed = JSON.parse(clean.stdout);
    assert.equal(parsed.ok, false);
    const usage = spawnSync(process.execPath, [CLI, 'unknown'], { encoding: 'utf8' });
    assert.equal(usage.status, 64);
    const affected = spawnSync(process.execPath, [CLI, 'affected', '--root', tmp, '--file', shared, '--json'], { encoding: 'utf8' });
    assert.equal(affected.status, 0);
    assert.deepEqual(JSON.parse(affected.stdout).prds, ['loop/prd-alpha.json', 'loop/prd-beta.json']);
  });

  test('implementation has no file write capability', () => {
    const source = readFileSync(CLI, 'utf8');
    for (const forbidden of ['writeFile', 'appendFile', 'rename', 'unlink', 'rmSync', 'mkdirSync']) {
      assert.equal(source.includes(forbidden), false, `forbidden write capability: ${forbidden}`);
    }
    assert.equal(source.includes("from 'node:child_process'"), false);
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!process.exitCode) console.log(`ratchet-reverse-index golden: ${passed}/8 GREEN`);
