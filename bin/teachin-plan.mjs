#!/usr/bin/env node
// 已完成 capture → 首发 read-only known-recipe cycle plan。只写开发期计划，
// 不启动浏览器、不执行 SUT、不裁定；有 pending/popup/意图错配即转人工。

import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import atomRegistry from '../lib/atoms-registry.snapshot.json' with { type: 'json' };
import { PROJECT_ROOT } from '../lib/paths.mjs';
import { atomicWriteFileSync, scanPrivateAddress } from '../lib/promptset-authoring.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { generateKnownReadOnlyCyclePlan } from '../lib/teachin/cycle-plan-generator.mjs';

function parseArgs(argv) {
  const output = { pos: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) output.pos.push(token);
    else if (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
      output[token.slice(2)] = argv[index += 1];
    } else output[token.slice(2)] = true;
  }
  return output;
}

function usage(reason) {
  if (reason) console.error(`teachin-plan: ${reason}`);
  console.error('用法: casey teachin-plan <caseId> --capture <f> --testcase <f> --expected <f> --entity-lock <f> --profile <f> --sut-build-digest <sha256:...> --out <f>');
  process.exit(64);
}

function projectPath(input) {
  const absolute = resolve(String(input));
  const rel = relative(PROJECT_ROOT, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

function readJson(bytes) {
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function fail(reason) {
  console.error(`teachin-plan: ${reason}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
for (const key of [
  'capture', 'testcase', 'expected', 'entity-lock', 'profile',
  'sut-build-digest', 'out',
]) {
  if (typeof args[key] !== 'string' || !args[key]) usage(`缺 --${key}`);
}
if (!/^[A-Za-z0-9_-]+$/.test(caseId || '')) usage('caseId 非法');

let captureBytes;
let testcaseBytes;
let expectedBytes;
let entityLockBytes;
let profileBytes;
let kernelBytes;
try {
  captureBytes = readFileSync(resolve(args.capture));
  testcaseBytes = readFileSync(resolve(args.testcase));
  expectedBytes = readFileSync(resolve(args.expected));
  entityLockBytes = readFileSync(resolve(args['entity-lock']));
  profileBytes = readFileSync(resolve(args.profile));
  kernelBytes = readFileSync(resolve(PROJECT_ROOT, 'lib', 'atoms-registry.snapshot.json'));
} catch {
  fail('CYCLE_PLAN_INPUT_UNREADABLE');
}
if (!entityLockBytes.equals(Buffer.from('[]', 'utf8'))) {
  fail('CYCLE_PLAN_RUNTIME_ENTITY_REVIEW_REQUIRED');
}
const paths = {
  capture: projectPath(args.capture),
  testcase: projectPath(args.testcase),
  expected: projectPath(args.expected),
  entityLock: projectPath(args['entity-lock']),
};
if (Object.values(paths).some((value) => value === null)) fail('CYCLE_PLAN_PATH_INVALID');
const generated = generateKnownReadOnlyCyclePlan({
  caseId,
  captureBytes,
  authoredTestCase: readJson(testcaseBytes),
  expectedDocument: readJson(expectedBytes),
  atomRegistry,
  paths,
  sutBuildDigest: args['sut-build-digest'],
  channelProfileBytes: profileBytes,
  replayKernelBytes: kernelBytes,
});
if (generated?.ok !== true) fail(generated?.reason || 'CYCLE_PLAN_INVALID');
const text = `${JSON.stringify(generated.plan, null, 2)}\n`;
if (!credentialGate({ cyclePlan: text }).ok || scanPrivateAddress(text).hit) {
  fail('CYCLE_PLAN_OUTPUT_REDACTED');
}
try {
  atomicWriteFileSync(resolve(args.out), text);
} catch {
  fail('CYCLE_PLAN_WRITE_FAILED');
}
console.log('teachin-plan: 已生成 known-recipe read-only 闭环计划；pending/popup/entity 仍须人工编排。');
