#!/usr/bin/env node
// 示教 raw source 复现的薄诊断入口。它先开一段 canonical anchor runtime 并真实关闭，
// 再开第二段 source runtime；fresh authority 只由前段关闭事件 + 后段对象归属铸造。
// CLEAN 仅表示原始动作可复现，不是测试结论，不产正式报告。

import { readFileSync } from 'node:fs';
import { admitAndRunRawReplay } from '../lib/teachin/raw-replay-runner.mjs';
import { writeRawReplayProof } from '../lib/teachin/raw-proof-output.mjs';
import { canonicalRuntimeBootstrap } from '../lib/teachin/runtime-bootstrap.mjs';
import {
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
} from '../lib/teachin/fresh-runtime.mjs';
import {
  closeLiveRuntime,
  defaultCloseRuntimeOwners,
  projectTopologyAuthority,
} from '../lib/teachin/runtime-owner.mjs';
import { canonicalRawPlaywrightDriver } from '../lib/teachin/raw-playwright-driver.mjs';
import { loadSiteConfig } from '../lib/login-bootstrap.mjs';
import { resolveCliExecutionTarget } from '../lib/execution-target/wiring.mjs';

const USAGE = [
  '用法: node bin/teachin-raw-replay.mjs --case <caseId>',
  '--capture <capture.json> --sut <本地基址> [--out <proof.json>]',
].join(' ');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--case') args.caseId = argv[index += 1];
    else if (token === '--capture') args.capture = argv[index += 1];
    else if (token === '--sut') args.sut = argv[index += 1];
    else if (token === '--out') args.out = argv[index += 1];
    else return null;
  }
  return args;
}

function fail(reason, code = 1) {
  process.stderr.write(`casey teachin-raw-replay: ${reason}\n`);
  process.exit(code);
}

function abort(reason) {
  const error = new Error('RAW_REPLAY_ABORTED');
  error.reason = reason;
  throw error;
}

async function openRuntime(executionTargetAuthority) {
  const opened = await canonicalRuntimeBootstrap.openRuntime({
    role: 'source',
    executionTargetAuthority,
  });
  return opened?.ok === true && opened.runtime ? opened.runtime : null;
}

async function closeRuntime(runtime) {
  if (!runtime) return false;
  return closeLiveRuntime(defaultCloseRuntimeOwners, runtime);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args || typeof args.caseId !== 'string' || !args.caseId
    || typeof args.capture !== 'string' || !args.capture
    || typeof args.sut !== 'string' || !args.sut) {
    process.stderr.write(`${USAGE}\n`);
    process.exit(64);
  }
  let captureBytes;
  let execution;
  try {
    captureBytes = readFileSync(args.capture);
    execution = resolveCliExecutionTarget({
      site: loadSiteConfig(undefined, { strict: true }),
      cliSut: args.sut,
      requiresOriginContinuity: true,
    });
  } catch {
    fail('RAW_REPLAY_RUNTIME_UNAVAILABLE');
  }
  if (execution?.ok !== true) fail(execution?.reason || 'RAW_REPLAY_RUNTIME_UNAVAILABLE');

  let anchor = null;
  let replay = null;
  let replayed;
  try {
    anchor = await openRuntime(execution.authority);
    if (!anchor) abort('RAW_REPLAY_RUNTIME_UNAVAILABLE');
    const witnessed = createFreshReplayWitness({
      recordingBrowser: anchor.browser,
      recordingContext: anchor.context,
    });
    if (witnessed?.ok !== true) abort(witnessed?.reason || 'FRESH_RUNTIME_WITNESS_INVALID');
    if (await closeRuntime(anchor) !== true) abort('SOURCE_RUNTIME_CLOSE_FAILED');
    anchor = null;

    replay = await openRuntime(execution.authority);
    if (!replay) abort('RAW_REPLAY_RUNTIME_UNAVAILABLE');
    const topologyAuthority = projectTopologyAuthority(replay.topology);
    const fresh = authorizeFreshReplayRuntime({
      witness: witnessed.witness,
      replayBrowser: replay.browser,
      replayContext: replay.context,
      replayPage: replay.page,
      topologyAuthority,
    });
    if (fresh?.ok !== true) abort(fresh?.reason || 'FRESH_RUNTIME_AUTHORITY_INVALID');

    replayed = await admitAndRunRawReplay({
      caseId: args.caseId,
      captureBytes,
      freshRuntimeFactory: async () => fresh,
      topologyAuthority,
      executionTargetAuthority: execution.authority,
      actionDriver: canonicalRawPlaywrightDriver,
    });
  } finally {
    await closeRuntime(replay);
    await closeRuntime(anchor);
  }

  if (replayed?.proof && typeof args.out === 'string' && args.out) {
    const written = writeRawReplayProof({
      outputPath: args.out,
      proofBytes: Buffer.from(`${JSON.stringify(replayed.proof, null, 2)}\n`),
    });
    if (written.ok !== true) fail(written.reason);
  }
  if (replayed?.ok !== true) {
    fail(typeof replayed?.reason === 'string' ? replayed.reason : 'RAW_REPLAY_INTERNAL_ERROR');
  }
  process.stdout.write('CLEAN\n');
}

await main().catch((error) => {
  fail(typeof error?.reason === 'string' ? error.reason : 'RAW_REPLAY_RUNTIME_UNAVAILABLE');
});
