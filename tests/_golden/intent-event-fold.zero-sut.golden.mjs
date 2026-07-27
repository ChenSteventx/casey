#!/usr/bin/env node
// intent-event-fold zero-SUT regression ratchet.
// This test uses only in-memory action projections plus temporary verdict inputs.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { foldIntentAction } from '../../lib/intent-action-fold.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-intent-event-fold-zero-sut-'));
const failures = [];
let passes = 0;
let verdictSequence = 0;

const REAL_INCIDENT_PROJECTION = Object.freeze([
  Object.freeze({
    stepId: 'atstep_12',
    action: Object.freeze({ resolution: 'ambiguous', candidateCount: 2 }),
  }),
  Object.freeze({
    stepId: 'atstep_13',
    action: Object.freeze({ resolution: 'none' }),
  }),
  Object.freeze({
    stepId: 'atstep_14',
    action: Object.freeze({ resolution: 'unique', candidateCount: 1 }),
  }),
]);

function check(name, fn) {
  try {
    fn();
    passes += 1;
  } catch (error) {
    failures.push(`${name}: ${String(error && (error.stderr || error.message || error)).slice(-900)}`);
  }
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
}

function writeJson(name, value) {
  const path = join(tmp, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

function verdictForAction(action) {
  verdictSequence += 1;
  const axesPath = writeJson(`axis-${verdictSequence}.json`, {
    caseId: 'tc_intent_event_fold_zero_sut',
    steps: [{
      stepId: 'atstep_projection',
      intentId: 'intent_cleanup_projection',
      atom: 'workflow.deleteByName',
      action,
      postAssertions: [{
        kind: 'countChange',
        op: 'equals',
        value: 0,
        ok: true,
        soft: false,
      }],
      forensics: {
        network: [],
        lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] },
      },
    }],
  });
  const verdictPath = join(tmp, `verdict-${verdictSequence}.json`);
  const result = spawnSync(process.execPath, [
    VERDICT,
    '--axes', axesPath,
    '--out', verdictPath,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (result.status !== 0) {
    throw new Error(`verdict exit=${result.status}: ${`${result.stderr || ''}${result.stdout || ''}`.slice(-700)}`);
  }
  const verdict = JSON.parse(readFileSync(verdictPath, 'utf8'));
  return verdict.steps[0];
}

function expectFoldVerdict(name, eventActions, expectedAction, expectedVerdict) {
  check(name, () => {
    const before = JSON.stringify(eventActions);
    const folded = foldIntentAction(eventActions);
    equal(JSON.stringify(eventActions), before, 'fold must not mutate evidence input');
    for (const [key, value] of Object.entries(expectedAction)) {
      equal(folded[key], value, `folded action.${key}`);
    }
    const verdict = verdictForAction(folded);
    equal(verdict.verdict, expectedVerdict.verdict, 'deterministic verdict');
    equal(verdict.reason, expectedVerdict.reason, 'deterministic reason');
  });
}

expectFoldVerdict(
  'R1 redacted real incident projection cannot be washed into PASS',
  REAL_INCIDENT_PROJECTION,
  { resolution: 'ambiguous', candidateCount: 2 },
  { verdict: 'NEEDS_HUMAN', reason: 'AMBIGUOUS_ACTION' },
);

expectFoldVerdict(
  'R2 all unique events preserve PASS',
  [
    { stepId: 's1', action: { resolution: 'unique', candidateCount: 1 } },
    { stepId: 's2', action: { resolution: 'unique', candidateCount: 1 } },
  ],
  { resolution: 'unique', candidateCount: 1 },
  { verdict: 'PASS', reason: null },
);

expectFoldVerdict(
  'R3 pure assertion tail is neutral',
  [
    { stepId: 's1', action: { resolution: 'unique', candidateCount: 1 } },
    { stepId: 's2', action: { kind: 'none' } },
  ],
  { resolution: 'unique', candidateCount: 1 },
  { verdict: 'PASS', reason: null },
);

expectFoldVerdict(
  'R4 ambiguous outranks action_failed ordinary none unknown and drift',
  [
    { stepId: 's1', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's2', action: { resolution: 'mystery' } },
    { stepId: 's3', action: { resolution: 'none' } },
    { stepId: 's4', action: { resolution: 'action_failed' } },
    { stepId: 's5', action: { resolution: 'ambiguous', candidateCount: 3 } },
    { stepId: 's6', action: { resolution: 'unique' } },
  ],
  { resolution: 'ambiguous', candidateCount: 3 },
  { verdict: 'NEEDS_HUMAN', reason: 'AMBIGUOUS_ACTION' },
);

expectFoldVerdict(
  'R5 action_failed outranks ordinary none unknown and drift',
  [
    { stepId: 's1', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's2', action: { resolution: 'mystery' } },
    { stepId: 's3', action: { resolution: 'none' } },
    { stepId: 's4', action: { resolution: 'action_failed' } },
    { stepId: 's5', action: { resolution: 'unique' } },
  ],
  { resolution: 'action_failed' },
  { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
);

expectFoldVerdict(
  'R6 ordinary none outranks unknown and drift',
  [
    { stepId: 's1', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's2', action: { resolution: 'mystery' } },
    { stepId: 's3', action: { resolution: 'none' } },
    { stepId: 's4', action: { resolution: 'unique' } },
  ],
  { resolution: 'none' },
  { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
);

expectFoldVerdict(
  'R7 unknown failure outranks drift',
  [
    { stepId: 's1', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's2', action: { resolution: 'mystery' } },
    { stepId: 's3', action: { resolution: 'unique' } },
  ],
  { resolution: 'mystery' },
  { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
);

expectFoldVerdict(
  'R8 all misses require positive drift evidence before HARNESS_ERROR',
  [
    { stepId: 's1', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's2', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's3', action: { resolution: 'unique' } },
  ],
  { resolution: 'none' },
  { verdict: 'HARNESS_ERROR', reason: null },
);

expectFoldVerdict(
  'R9 a single ordinary miss blocks HARNESS_ERROR',
  [
    { stepId: 's1', action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } } },
    { stepId: 's2', action: { resolution: 'none' } },
    { stepId: 's3', action: { resolution: 'unique' } },
  ],
  { resolution: 'none' },
  { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
);

expectFoldVerdict(
  'R10 identity readback is a valid positive action signal',
  [{ stepId: 's1', action: { identityReadback: { ok: true, observed: 'stable-id' } } }],
  {},
  { verdict: 'PASS', reason: null },
);

check('R11 ambiguous identityReadback.ok true is sanitized before verdict', () => {
  const input = [{
    stepId: 's1',
    action: { resolution: 'ambiguous', candidateCount: 2, identityReadback: { ok: true, observed: 'conflict' } },
  }];
  const before = JSON.stringify(input);
  const folded = foldIntentAction(input);
  equal(JSON.stringify(input), before, 'fold must preserve contradictory source evidence');
  equal(folded.resolution, 'ambiguous', 'ambiguous resolution');
  equal(folded.identityReadback.ok, false, 'contradictory success readback must be sanitized');
  const verdict = verdictForAction(folded);
  equal(verdict.verdict, 'NEEDS_HUMAN', 'contradictory axis verdict');
  equal(verdict.reason, 'AMBIGUOUS_ACTION', 'contradictory axis reason');
});

check('R12 kind none plus ambiguous is sanitized before verdict', () => {
  const folded = foldIntentAction([{
    stepId: 's1',
    action: { kind: 'none', resolution: 'ambiguous', candidateCount: 2 },
  }]);
  equal(folded.kind, undefined, 'contradictory kind none must be removed');
  equal(folded.resolution, 'ambiguous', 'ambiguous signal must survive');
  const verdict = verdictForAction(folded);
  equal(verdict.verdict, 'NEEDS_HUMAN', 'kind none contradiction verdict');
  equal(verdict.reason, 'AMBIGUOUS_ACTION', 'kind none contradiction reason');
});

check('R13 kind none plus unique becomes action_failed, never PASS', () => {
  const folded = foldIntentAction([{
    stepId: 's1',
    action: { kind: 'none', resolution: 'unique', identityReadback: { ok: true } },
  }]);
  equal(folded.kind, undefined, 'false success kind must be removed');
  equal(folded.resolution, 'action_failed', 'contradictory action must fail closed');
  equal(folded.identityReadback.ok, false, 'false success readback must be removed');
  const verdict = verdictForAction(folded);
  equal(verdict.verdict, 'NEEDS_HUMAN', 'kind none unique contradiction verdict');
  equal(verdict.reason, 'INDETERMINATE', 'kind none unique contradiction reason');
});

expectFoldVerdict(
  'R14 all pure assertions remain neutral',
  [
    { stepId: 's1', action: { kind: 'none' } },
    { stepId: 's2', action: { kind: 'none' } },
  ],
  { kind: 'none' },
  { verdict: 'PASS', reason: null },
);

check('R15 malformed containers and actions fail closed without throwing', () => {
  const malformed = [
    null,
    {},
    [],
    [{ stepId: 's1' }],
    [{ stepId: 's1', action: null }],
    [{ stepId: 's1', action: [] }],
    [{ stepId: 's1', action: 'unique' }],
  ];
  for (const input of malformed) {
    const folded = foldIntentAction(input);
    equal(folded.resolution, 'action_failed', `malformed input ${JSON.stringify(input)}`);
    const verdict = verdictForAction(folded);
    equal(verdict.verdict, 'NEEDS_HUMAN', 'malformed input verdict');
    equal(verdict.reason, 'INDETERMINATE', 'malformed input reason');
  }
});

check('R16 nested evidence remains immutable during sanitization', () => {
  const input = [{
    stepId: 's1',
    action: {
      kind: 'none',
      resolution: 'ambiguous',
      identityReadback: { ok: true, detail: { source: 'projection' } },
    },
  }];
  const before = JSON.stringify(input);
  foldIntentAction(input);
  equal(JSON.stringify(input), before, 'nested source evidence must remain byte-equivalent');
});

check('R17 replay wiring uses the fold output and preserves eventActions', () => {
  // replay 拆分后的真实可达链：
  // bin/replay → replay/artifact-finalizer → replay-axes → foldIntentAction。
  // 每一跳同时钉 import 与调用，且钉 intentEvents/actionByStep 证据穿过 finalizer，
  // 防止仅保留一个不可达 helper 或空壳委派把前序失败洗白。
  const replaySource = readFileSync(join(ROOT, 'bin', 'replay.mjs'), 'utf8');
  if (!replaySource.includes(
    "import { finalizeReplayArtifacts } from '../lib/replay/artifact-finalizer.mjs';",
  )) {
    throw new Error('replay does not import finalizeReplayArtifacts');
  }
  if (!/await\s+finalizeReplayArtifacts\(\{[\s\S]{0,2200}\bintentEvents,[\s\S]{0,2200}\bevidence,/u
    .test(replaySource)) {
    throw new Error('replay does not call finalizer with intentEvents and evidence');
  }

  const finalizerSource = readFileSync(
    join(ROOT, 'lib', 'replay', 'artifact-finalizer.mjs'),
    'utf8',
  );
  if (!finalizerSource.includes(
    "import { projectReplayAxes } from '../replay-axes.mjs';",
  )) {
    throw new Error('artifact-finalizer does not import projectReplayAxes');
  }
  if (!/const\s+axesText\s*=\s*projectReplayAxes\(\{[\s\S]{0,1800}\bintentEvents,[\s\S]{0,1800}actionByStep:\s*evidence\.actionByStep,/u
    .test(finalizerSource)) {
    throw new Error('artifact-finalizer does not project intentEvents/actionByStep into axes');
  }

  const axesSource = readFileSync(join(ROOT, 'lib', 'replay-axes.mjs'), 'utf8');
  if (!axesSource.includes("import { foldIntentAction } from './intent-action-fold.mjs';")) {
    throw new Error('replay-axes does not import foldIntentAction');
  }
  if (!/action:\s*foldIntentAction\(eventActions\)/u.test(axesSource)) {
    throw new Error('replay-axes does not assign folded intent action');
  }
  if (!/eventActions,\s*\n/u.test(axesSource)) {
    throw new Error('replay-axes does not retain eventActions evidence');
  }
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`RED  intent-event-fold-zero-sut: ${failure}`);
  process.exit(1);
}

console.log(`ok   intent-event-fold-zero-sut: ${passes}/17`);
