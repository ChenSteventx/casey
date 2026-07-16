#!/usr/bin/env node
// Public release trust boundary: pure-function + static checks only. Never starts or connects to a SUT.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessFormalDelivery } from '../../lib/run-delivery.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const caseId = 'tc_public_trust';
const runId = 'run-public-trust';
const videoConvergence = { ok: true, explicitException: false, reason: null };

const mixed = assessFormalDelivery({
  caseId,
  runId,
  videoConvergence,
  verdict: {
    caseId,
    steps: [
      { verdict: 'PASS' },
      { verdict: 'NEEDS_HUMAN' },
    ],
  },
});
assert.equal(mixed.formalDeliveryComplete, false);
assert.equal(mixed.exitCode, 1);
assert.ok(mixed.reasons.includes('VERDICT_NOT_ALL_PASS'));
assert.ok(mixed.reasons.includes('VISUAL_REVIEW_MISSING'));

const allPassWithoutVisual = assessFormalDelivery({
  caseId,
  runId,
  videoConvergence,
  verdict: { caseId, steps: [{ verdict: 'PASS' }] },
});
assert.equal(allPassWithoutVisual.formalDeliveryComplete, false);
assert.equal(allPassWithoutVisual.exitCode, 1);
assert.deepEqual(allPassWithoutVisual.reasons, ['VISUAL_REVIEW_MISSING']);

const caseySource = readFileSync(join(root, 'bin', 'casey.mjs'), 'utf8');
const replaySource = readFileSync(join(root, 'bin', 'replay.mjs'), 'utf8');
const mcpSource = readFileSync(join(root, 'mcp', 'casey-server.mjs'), 'utf8');
assert.match(caseySource, /\.\.\.\(opts\['unique-name'\] \? \['--unique-name', opts\['unique-name'\]\] : \[\]\)/);
assert.match(replaySource, /else if \(a === '--unique-name'\) o\.uniqueName = argv\[\+\+i\]/);
assert.match(replaySource, /const ctx = \{ uniqueName,/);
assert.equal((mcpSource.match(/uniqueName: \{ type: 'string' \}/g) || []).length, 3);
assert.equal((mcpSource.match(/flag\('unique-name', a\.uniqueName\)/g) || []).length, 3);

const anchorGate = replaySource.indexOf('validateReplayEntityAnchors(');
const browserLaunch = replaySource.indexOf('chromium.launch(');
assert.ok(anchorGate >= 0, 'entity anchor preflight must exist');
assert.ok(browserLaunch >= 0, 'browser launch must exist');
assert.ok(anchorGate < browserLaunch, 'entity anchor preflight must run before browser launch');

console.log('public real-run trust zero-SUT golden: PASS');
