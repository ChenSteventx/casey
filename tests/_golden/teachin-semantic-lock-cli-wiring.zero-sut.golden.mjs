#!/usr/bin/env node
// 冻结验收：五阶段 CLI 必须真实调用语义锁接缝，且 replay 的 preflight 位于浏览器启动前。
// 只静态读取源码；禁止启动任何 bin、浏览器、网络、fake 或 fixture SUT。

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => readFileSync(resolve(ROOT, 'bin', name), 'utf8');
const failures = [];
function requireAll(file, tokens) {
  const source = read(file);
  for (const token of tokens) if (!source.includes(token)) failures.push(`${file} 缺 ${token}`);
  return source;
}

requireAll('record.mjs', [
  'createIdentityObservationSidecar',
  'identity-observations.json',
  'sidecarSha256',
]);
requireAll('distill.mjs', [
  'distillIdentityCandidates',
  'identityCandidates',
  'pending',
]);
requireAll('compile.mjs', [
  'buildEntityLocksDraft',
  'entity-locks.draft.json',
  'eventsSha256',
]);
requireAll('sign.mjs', [
  'freezeEntityLocks',
  'entity-locks.frozen.json',
  'eventsSha256',
]);
const replay = requireAll('replay.mjs', [
  'preflightFrozenEntityLocks',
  'rebindEntityLocksAfterLogin',
  'authorizeLockedAction',
]);

const preflightAt = replay.indexOf('preflightFrozenEntityLocks(');
const launchAt = replay.indexOf('chromium.launch(');
if (preflightAt < 0 || launchAt < 0 || preflightAt > launchAt) failures.push('replay preflight 必须在 chromium.launch 前完成');
const loginAt = replay.indexOf('loginBootstrap(');
const rebindAt = replay.indexOf('rebindEntityLocksAfterLogin(');
if (loginAt < 0 || rebindAt < 0 || rebindAt < loginAt) failures.push('live rebind 必须在登录后执行');

// 静态禁弱 agent 直通：实现不得新增 name-only/position fallback 标记。
for (const [file, source] of [['compile.mjs', read('compile.mjs')], ['replay.mjs', replay]]) {
  // `fallback_first` 仍是 run-history 的合法诊断枚举，不能做全文件字面量黑名单；
  // 这里只钉身份锁专用的显式降级开关。
  for (const forbidden of ['nameOnlyEntityBinding', 'allowUnsignedEntityLocks']) {
    if (source.includes(forbidden)) failures.push(`${file} 含禁止的语义锁降级：${forbidden}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-cli-wiring: ${failure}`);
  process.exit(1);
}
console.log('ok   teachin-semantic-lock-cli-wiring: record→distill→compile→sign→replay 静态接线（零 SUT）');
