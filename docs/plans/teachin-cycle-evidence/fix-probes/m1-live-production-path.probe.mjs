#!/usr/bin/env node
// M1 生产路径活体探针（零 SUT）：直接驱动现役 executeAuthorizedSourceReplay 的
// issuer 吞异常位与结果形状位，量两轴——
//   ① 微任务世代：从调用发起到 completion 返回，落在第几代微任务
//      （多套一层 async 包裹就多一代，黑盒可测）；
//   ② 同步异常栈：issuer 同步抛时，异常栈里有没有多出的包裹帧。
// 用法：node <本文件> <标签>，输出一行 JSON，落进同目录的 .json 供前后对照。

import {
  api, buildHappy, ready, loadFailure,
} from '../../../../tests/_golden/support/teachin-replayability-equivalence-harness.mjs';

const label = process.argv[2] || 'unlabeled';

if (!ready) {
  console.error(`PROBE_RED: 生产 API 不可用：${loadFailure}`);
  process.exit(1);
}

function microtaskTicker() {
  let generation = 0;
  let stopped = false;
  const pump = () => {
    if (stopped) return;
    generation += 1;
    queueMicrotask(pump);
  };
  queueMicrotask(pump);
  return { read: () => generation, stop: () => { stopped = true; } };
}

// ① 结果形状位：issuer 同步返回畸形结果 → completion 走 exactKeys 拒付。
// 量 completion 返回时的微任务世代：包裹层每多一次 await 就多一代。
async function measureGeneration(tag) {
  const built = await buildHappy(tag, { stopBeforeSourceExecution: true });
  const issuer = { kind: 'raw', executeAndVerify: () => ({ ok: true }) };
  const ticker = microtaskTicker();
  const result = await api.executeAuthorizedSourceReplay({
    runAuthority: built.sourceRun.authority,
    trustedRawReplayIssuer: issuer,
  });
  const generation = ticker.read();
  ticker.stop();
  await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceFresh.runtimeOwnerAuthority,
  });
  return { generation, reason: result?.reason || null, ok: result?.ok === true };
}

// ② 吞异常位：issuer 同步抛，量异常栈帧与包裹帧是否在场。
async function measureStack(tag) {
  const built = await buildHappy(tag, { stopBeforeSourceExecution: true });
  let captured = null;
  const issuer = {
    kind: 'raw',
    executeAndVerify() {
      const error = new TypeError('PROBE_SYNC_THROW');
      captured = error;
      throw error;
    },
  };
  const result = await api.executeAuthorizedSourceReplay({
    runAuthority: built.sourceRun.authority,
    trustedRawReplayIssuer: issuer,
  });
  await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceFresh.runtimeOwnerAuthority,
  });
  const frames = String(captured?.stack || '').split('\n').slice(1)
    .map((row) => row.trim()).filter(Boolean);
  return {
    reason: result?.reason || null,
    frameCount: frames.length,
    hasWrapperFrame: frames.some((row) => row.includes('reportedCall')),
    // 只留函数名，绝不回显绝对路径（匿名帧统一折成 <anonymous>）。
    frameNames: frames.map((row) => {
      const name = (row.match(/^at ([^ (]+)/) || [])[1] || '';
      return !name || /[/\\]|^file:/.test(name) ? '<anonymous>' : name;
    }),
  };
}

const generation = await measureGeneration('m1_gen');
const stack = await measureStack('m1_stack');

console.log(JSON.stringify({ label, generation, stack }));
