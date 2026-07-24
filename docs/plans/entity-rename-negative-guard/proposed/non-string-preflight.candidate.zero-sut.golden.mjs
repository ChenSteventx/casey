#!/usr/bin/env node
// C4 保真补强候选一：生产 replay 对非字符串 atom 的前置拒绝。
// 纯 Node、零 SUT、零浏览器、零网络；候选未进 tests/_golden，未改任何冻结 checksum。

import { existsSync, readFileSync } from 'node:fs';
import { checkReplayEntityAdmission } from '../../../../lib/entity-semantic-lock-preflight.mjs';

const REPLAY_SOURCE_URL = new URL('../../../../bin/replay.mjs', import.meta.url);
const BOUNDARY_URL = new URL('./boundary-correction.md', import.meta.url);

let passed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function replayAdmissionFor(atom, { omitAtom = false } = {}) {
  const event = {
    stepId: 'atstep_0',
    intentId: 'intent_0',
    action: 'click',
  };
  if (!omitAtom) event.atom = atom;
  const document = {
    schemaVersion: 1,
    caseId: 'tc_c4_non_string_preflight',
    events: [event],
  };
  const bytes = Buffer.from(JSON.stringify(document));
  return checkReplayEntityAdmission({
    caseId: document.caseId,
    eventsBytes: bytes,
    eventsDocument: JSON.parse(bytes.toString('utf8')),
  });
}

check('P1 非字符串/缺失 atom 全由真实 replay preflight 具名拒绝', () => {
  const cases = [
    ['missing', undefined, { omitAtom: true }],
    ['number', 123, {}],
    ['array', [], {}],
    ['object', {}, {}],
  ];
  for (const [label, atom, options] of cases) {
    const result = replayAdmissionFor(atom, options);
    assert(result?.ok === false, `${label} atom 被 preflight 放行：${JSON.stringify(result)}`);
    assert(
      result.reason === 'REPLAY_EVENT_SHAPE_INVALID',
      `${label} atom 拒绝原因漂移：${JSON.stringify(result)}`,
    );
    assert(
      result.allowBrowserLaunch === false,
      `${label} atom 拒绝未显式关闭 browser launch：${JSON.stringify(result)}`,
    );
  }
});

check('P2 bin/replay 生产入口把原始 events 字节与文档送入同一 preflight', () => {
  const source = readFileSync(REPLAY_SOURCE_URL, 'utf8');
  assert(
    /checkReplayEntityAdmission as checkCompileIdentityAdmission/.test(source),
    'bin/replay 未绑定 checkReplayEntityAdmission',
  );
  const callAt = source.indexOf('const identityAdmission = checkCompileIdentityAdmission({');
  const bytesAt = source.indexOf('eventsBytes: readFileSync(args.events)', callAt);
  const documentAt = source.indexOf('eventsDocument: eventsDoc', callAt);
  assert(callAt >= 0 && bytesAt > callAt && documentAt > callAt, '生产 preflight 未同时消费原始字节与解析文档');
});

check('P3 生产 preflight 拒绝以 exit 65 终止，静态顺序早于 chromium.launch', () => {
  const source = readFileSync(REPLAY_SOURCE_URL, 'utf8');
  const callAt = source.indexOf('const identityAdmission = checkCompileIdentityAdmission({');
  const denyAt = source.indexOf('if (!identityAdmission.ok)', callAt);
  const exitAt = source.indexOf('process.exit(65)', denyAt);
  const launchAt = source.indexOf('chromium.launch');
  assert(callAt >= 0 && denyAt > callAt && exitAt > denyAt, '生产 preflight 拒绝链不完整');
  assert(launchAt > exitAt, '生产 preflight 拒绝未早于浏览器启动');
});

check('P4 候选边界说明明确非字符串安全归属与待人签状态', () => {
  assert(existsSync(BOUNDARY_URL), '缺 boundary-correction.md 候选边界说明');
  const text = readFileSync(BOUNDARY_URL, 'utf8');
  assert(text.includes('REPLAY_EVENT_SHAPE_INVALID'), '候选说明未锁定非字符串 atom 的具名拒绝码');
  assert(text.includes('生产 `replay` 前置检查'), '候选说明未把非字符串安全归属到生产 replay 前置检查');
  assert(text.includes('候选态，待人签'), '候选说明未声明仍待人签、不得冒充正式冻结金牌');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  C4 non-string-preflight candidate: ${failure}`);
  console.error(`RED  C4 non-string-preflight candidate: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   C4 non-string-preflight candidate: ${passed}/${passed} 全过（候选态，零 SUT）`);
