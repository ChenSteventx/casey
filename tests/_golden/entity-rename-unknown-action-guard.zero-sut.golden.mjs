#!/usr/bin/env node
// C4 后继：未知字符串原子在 nav / 非 nav 分叉前统一拒绝。
// 纯 Node、零 SUT、零浏览器、零网络；静态读取真实生产事件环，动态只跑纯判据与真实零 LLM verdict。

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { unknownAtomRejection } from '../../lib/replay-actions.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REPLAY_SOURCE = readFileSync(new URL('../../bin/replay.mjs', import.meta.url), 'utf8');
const RUNNER_SOURCE = readFileSync(new URL('../../lib/replay/event-runner.mjs', import.meta.url), 'utf8');
const VERDICT_CLI = join(REPO_ROOT, 'bin', 'verdict.mjs');
const UNKNOWN_ATOM = 'workflow.rename';

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

function runVerdict(action) {
  const dir = mkdtempSync(join(tmpdir(), 'casey-unknown-action-guard-'));
  const axesPath = join(dir, 'axes.json');
  const outPath = join(dir, 'verdict.json');
  writeFileSync(axesPath, JSON.stringify({
    caseId: 'tc_entity_rename_unknown_action_guard',
    steps: [{
      stepId: 'atstep_0',
      intentId: 'intent_0',
      atom: UNKNOWN_ATOM,
      action,
      postAssertions: [{ ok: true }],
    }],
  }));
  const proc = spawnSync(process.execPath, [VERDICT_CLI, '--axes', axesPath, '--out', outPath], {
    encoding: 'utf8',
  });
  assert(proc.status === 0, `verdict 非零退出 status=${proc.status}`);
  const result = JSON.parse(readFileSync(outPath, 'utf8'));
  rmSync(dir, { recursive: true, force: true });
  return result.steps[0];
}

check('G1 生产 replay 显式导入并调用统一未知原子判据', () => {
  assert(
    /import\s*\{[^}]*runReplayEvents[^}]*\}\s*from '\.\.\/lib\/replay\/event-runner\.mjs'/.test(REPLAY_SOURCE)
      && /runReplayEvents\(\{/.test(REPLAY_SOURCE),
    'bin/replay.mjs 未真实委派 event-runner',
  );
  assert(
    /import\s*\{[^}]*unknownAtomRejection[^}]*\}\s*from '\.\.\/replay-actions\.mjs'/.test(RUNNER_SOURCE),
    'event-runner 未从 replay-actions 导入 unknownAtomRejection',
  );
  const loopAt = RUNNER_SOURCE.indexOf('for (const event of events)');
  const gateAt = RUNNER_SOURCE.indexOf('const atomRejection = unknownAtomRejection(event);', loopAt);
  assert(loopAt >= 0 && gateAt > loopAt, '生产事件环未调用 unknownAtomRejection(ev)');
});

check('G2 未知原子判据先于 nav 分叉、pre.path 恢复与共享导航 guard', () => {
  const loopAt = RUNNER_SOURCE.indexOf('for (const event of events)');
  const gateAt = RUNNER_SOURCE.indexOf('const atomRejection = unknownAtomRejection(event);', loopAt);
  const navEnvelopeAt = RUNNER_SOURCE.indexOf('if (!atomRejection) {', gateAt);
  const navBranchAt = RUNNER_SOURCE.indexOf("if (event.action === 'nav')", navEnvelopeAt);
  const firstGuardAt = RUNNER_SOURCE.indexOf('await requireReplayNavigation({', navBranchAt);
  const prePathAt = RUNNER_SOURCE.indexOf('const wantedPath = event.pre && event.pre.path;', navBranchAt);
  const restoreGuardAt = RUNNER_SOURCE.indexOf('await requireReplayNavigation({', prePathAt);
  assert(
    loopAt >= 0
      && gateAt > loopAt
      && navEnvelopeAt > gateAt
      && navBranchAt > navEnvelopeAt
      && firstGuardAt > navBranchAt
      && prePathAt > navBranchAt
      && restoreGuardAt > prePathAt
      && !RUNNER_SOURCE.includes('page.goto('),
    `生产前置/共享导航顺序缺失：${JSON.stringify({
      loopAt, gateAt, navEnvelopeAt, navBranchAt, firstGuardAt, prePathAt, restoreGuardAt,
    })}`,
  );
});

check('G3 命中拒绝轴后跳过 nav 与业务动作分支', () => {
  const loopAt = RUNNER_SOURCE.indexOf('for (const event of events)');
  const rejectAt = RUNNER_SOURCE.indexOf('if (atomRejection) {', loopAt);
  const axisAt = RUNNER_SOURCE.indexOf('actionByStep.set(event.stepId, atomRejection);', rejectAt);
  const navAt = RUNNER_SOURCE.indexOf("} else if (event.action === 'nav') {", rejectAt);
  const dispatchAt = RUNNER_SOURCE.indexOf('dispatchAction(page, event, ctx)', navAt);
  assert(
    rejectAt > loopAt && axisAt > rejectAt && navAt > axisAt && dispatchAt > navAt,
    `生产拒绝分支未包住 nav/业务动作双路径：${JSON.stringify({ rejectAt, axisAt, navAt, dispatchAt })}`,
  );
});

check('G4 workflow.rename 的 nav/click 共用 UNKNOWN_ATOM 拒绝轴，合法 nav 不误拒', () => {
  for (const action of ['nav', 'click']) {
    const axis = unknownAtomRejection({ atom: UNKNOWN_ATOM, action });
    assert(axis?.resolution === 'action_failed', `${action} 未得到 action_failed：${JSON.stringify(axis)}`);
    assert(axis?.rejectReason === 'UNKNOWN_ATOM', `${action} 拒绝码漂移：${JSON.stringify(axis)}`);
    assert(axis?.identityReadback?.ok === false, `${action} 拒绝轴竟可背书动作成功`);
  }
  assert(
    unknownAtomRejection({ atom: 'nav.agentManagement', action: 'nav' }) === null,
    '合法 nav.agentManagement 被未知原子门误拒',
  );
});

check('G5 未知 nav 拒绝轴经真实 verdict 绝不 PASS，unique 对照仍可 PASS', () => {
  const rejected = unknownAtomRejection({ atom: UNKNOWN_ATOM, action: 'nav' });
  const deniedVerdict = runVerdict(rejected);
  assert(
    deniedVerdict.verdict === 'NEEDS_HUMAN',
    `未知 nav 拒绝轴未 fail-safe 到 NEEDS_HUMAN：${JSON.stringify(deniedVerdict)}`,
  );
  const controlVerdict = runVerdict({
    resolution: 'unique',
    candidateCount: 1,
    identityReadback: { ok: true },
  });
  assert(controlVerdict.verdict === 'PASS', `unique 对照未 PASS，测试可能空洞：${JSON.stringify(controlVerdict)}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-rename-unknown-action-guard: ${failure}`);
  console.error(`RED  entity-rename-unknown-action-guard: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   entity-rename-unknown-action-guard: ${passed}/${passed} 全过（zero-SUT）`);
