#!/usr/bin/env node
// 四 HIGH successor：本地 sign 文件事务 + 纯函数 + 静态接线；禁止 SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildFlow, validateBridge } from '../../lib/flow-bridge.mjs';
import {
  buildEntityBindingsDraft, checkReplayEntityAdmission,
} from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const SECTION = process.argv[2] ?? 'all';
if (!new Set(['all', 'resign-recovery', 'bridge-subject', 'symlink-boundary', 'readonly']).has(SECTION)) process.exit(2);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha = (value) => createHash('sha256').update(value).digest('hex');
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';

function prepareSignCase(caseId, physicalDir, logicalDir = physicalDir) {
  mkdirSync(physicalDir, { recursive: true });
  const signedAt = '2026-07-17T08:00:00.000Z';
  const events = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/workflow', recordedAt: signedAt,
    compiledBy: 'operability-successor-golden', authored: false,
    events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', action: 'click', text: 'create' }],
  };
  const eventsText = jsonText(events);
  const provenance = [{
    stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', sourceIntentId: 'source_1',
    candidateId: 'candidate-workflow-main', role: 'subject',
  }];
  const bindingDraft = buildEntityBindingsDraft({ eventsBytes: Buffer.from(eventsText), eventsDocument: events, provenance });
  assert(bindingDraft.ok === true, `fixture binding draft ${bindingDraft.reason}`);
  const receipt = createEntityLockReceipt({
    lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing',
    scopeFingerprint: 'sha256:operability-scope', expected: { name: 'A', code: 'WF-A' },
    observed: { name: 'A', code: 'WF-A' }, source: 'user-confirmed',
  });
  const names = {
    draft: 'expected.draft.json', events: 'events.json', bindings: 'entity-bindings.draft.json',
    confirmations: 'entity-confirmations.json', frozen: 'expected.frozen.json', locks: 'entity-locks.frozen.json',
  };
  writeFileSync(join(physicalDir, names.draft), jsonText({
    caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [],
  }));
  writeFileSync(join(physicalDir, names.events), eventsText);
  writeFileSync(join(physicalDir, names.bindings), jsonText(bindingDraft.draft));
  writeFileSync(join(physicalDir, names.confirmations), jsonText({
    caseId, confirmations: provenance.map((row) => ({ ...row, receipt })),
  }));
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  const initialPrdText = jsonText({ schemaVersion: 1, caseId, task: 'operability successor golden', testChecksums: {}, stories: [] });
  writeFileSync(prdPath, initialPrdText);
  return {
    caseId, signedAt, prdPath, initialPrdText,
    draft: join(logicalDir, names.draft), events: join(logicalDir, names.events), bindings: join(logicalDir, names.bindings),
    confirmations: join(logicalDir, names.confirmations), frozen: join(logicalDir, names.frozen), locks: join(logicalDir, names.locks),
  };
}

function signArgs(fixture, extra = []) {
  return [SIGN, fixture.caseId,
    '--draft', fixture.draft, '--prd', fixture.prdPath, '--frozen-out', fixture.frozen,
    '--signer', 'golden-human', '--against-build', 'golden-build', '--signed-at', fixture.signedAt,
    '--events', fixture.events, '--entity-bindings-draft', fixture.bindings,
    '--entity-confirmations', fixture.confirmations, '--entity-locks-out', fixture.locks,
    '--audience', 'test', // 准入受众必填（ADR-0010）：golden 签测试夹具用 test 受众
    ...extra];
}
const runSign = (fixture, extra = []) => spawnSync(process.execPath, signArgs(fixture, extra), { cwd: ROOT, encoding: 'utf8' });

test('resign-recovery', 'O1 --resign archive 已到/PRD 未到时同输入恢复完整目标集合', () => {
  const caseId = 'tc_operability_resign';
  const caseDir = join(ROOT, 'cases', caseId);
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  try {
    rmSync(caseDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
    const fixture = prepareSignCase(caseId, caseDir);
    writeFileSync(fixture.frozen, jsonText({
      caseId, intents: [{ intentId: 'old', expected: [{
        kind: 'textVisible', op: 'appears', value: 'old', soft: false,
        signedAt: '2026-07-16T00:00:00.000Z', signedAgainstBuild: 'old-build', signerId: 'old-human',
      }] }],
    }));
    const first = runSign(fixture, ['--resign']);
    assert(first.status === 0, `fixture 首次 resign 失败 ${first.status}: ${first.stderr}`);
    const archiveDir = join(caseDir, 'archive');
    const archiveNames = readdirSync(archiveDir).filter((name) => name.endsWith('.json'));
    assert(archiveNames.length === 1, 'archive fixture 非唯一');
    const archivePath = join(archiveDir, archiveNames[0]);
    const finalWrites = [archivePath, fixture.frozen, fixture.locks, fixture.prdPath]
      .map((path) => ({ path: resolve(path), text: readFileSync(path, 'utf8') }));
    writeFileSync(fixture.prdPath, fixture.initialPrdText);
    const journalPath = `${resolve(fixture.locks)}.publish.json`;
    writeFileSync(journalPath, JSON.stringify({
      schemaVersion: 1, artifactKind: 'casey-sign-publication', signedAt: fixture.signedAt,
      authorityTargetHash: sha(resolve(fixture.prdPath)),
      entries: finalWrites.map(({ path, text }) => ({ targetHash: sha(path), contentHash: sha(text) })),
    }) + '\n');
    const recovery = runSign(fixture, ['--resign']);
    assert(recovery.status === 0, `同输入 resign recovery 应成功，实际 ${recovery.status}: ${recovery.stderr}`);
    assert(!existsSync(journalPath) && readFileSync(fixture.prdPath, 'utf8') === finalWrites.at(-1).text, 'resign recovery 未收口');
  } finally {
    rmSync(caseDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
  }
});

test('bridge-subject', 'O2 自然语言 mapping 的 mutation subject 正向进入 flow', () => {
  const testcase = {
    caseId: 'tc_bridge_subject', title: '创建工作流', uniquePrefix: 'atl_',
    preconditions: ['已登录', '在工作流管理页'],
    steps: [{ intentId: 'intent_create', intent: '创建指定工作流' }],
  };
  const mapping = [{
    intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' },
    entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }],
  }];
  const flow = buildFlow(testcase, mapping);
  assert(flow.steps[0].sourceIntentId === 'intent_create', 'sourceIntentId 丢失');
  assert(flow.steps[0].entityBindings?.[0]?.role === 'subject', 'subject 未保真');
  const registry = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
  assert(validateBridge(testcase, mapping, { registry }).ok === true, '合法 subject 未过 bridge policy');
  for (const entityBindings of [undefined, [{ candidateId: 'candidate-workflow-main', role: 'source' }]]) {
    const bad = [{ ...mapping[0], ...(entityBindings ? { entityBindings } : {}) }];
    if (!entityBindings) delete bad[0].entityBindings;
    assert(validateBridge(testcase, bad, { registry }).ok === false, 'mutation 缺 subject/错 source 未在 bridge 拒绝');
  }
});

test('bridge-subject', 'O2 未知角色仍拒且 relation source/target 不回退', () => {
  const tc = { caseId: 'tc_roles', steps: [{ intentId: 'i', intent: '绑定智能体' }] };
  const relation = buildFlow(tc, [{
    intentId: 'i', atom: 'workflow.bindAgent', params: {}, entityBindings: [
      { candidateId: 'wf', role: 'source' }, { candidateId: 'ag', role: 'target' },
    ],
  }]);
  assert(relation.steps[0].entityBindings.map((row) => row.role).join(',') === 'source,target', 'relation 角色漂移');
  let denied = false;
  try { buildFlow(tc, [{ intentId: 'i', atom: 'workflow.create', params: {}, entityBindings: [{ candidateId: 'wf', role: 'owner' }] }]); }
  catch { denied = true; }
  assert(denied, '未知角色未拒');
});

test('symlink-boundary', 'O3 项目内 symlink ancestor 指仓外时 sign 拒且 PRD 不变', () => {
  if (process.platform === 'win32') return; // Windows reparse 由 observability route:human；POSIX 动态门不伪装覆盖。
  const caseId = 'tc_operability_symlink';
  const logicalDir = join(ROOT, 'cases', caseId);
  const external = mkdtempSync(join(tmpdir(), 'casey-locks-external-'));
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  try {
    rmSync(logicalDir, { recursive: true, force: true }); rmSync(prdPath, { force: true });
    symlinkSync(external, logicalDir, 'dir');
    const fixture = prepareSignCase(caseId, external, logicalDir);
    const before = readFileSync(prdPath, 'utf8');
    const result = runSign(fixture);
    assert(result.status !== 0, `symlink ancestor 绕仓外被放行 exit ${result.status}`);
    assert(readFileSync(prdPath, 'utf8') === before, 'symlink 拒绝仍更新 PRD');
  } finally {
    rmSync(logicalDir, { recursive: true, force: true }); rmSync(external, { recursive: true, force: true }); rmSync(prdPath, { force: true });
  }
});

test('symlink-boundary', 'O3 物理边界核含 lstat/realpath/no-follow/fstat+inode，sign 与 reader 双接线', () => {
  const boundaryPath = join(ROOT, 'lib', 'project-artifact-boundary.mjs');
  assert(existsSync(boundaryPath), '缺 project-artifact-boundary');
  const boundary = readFileSync(boundaryPath, 'utf8');
  for (const token of ['lstatSync', 'realpathSync', 'O_NOFOLLOW', 'fstatSync', '.ino', '.dev']) assert(boundary.includes(token), `物理边界缺 ${token}`);
  const sign = readFileSync(join(ROOT, 'bin', 'sign.mjs'), 'utf8');
  const reader = readFileSync(join(ROOT, 'lib', 'entity-semantic-lock-preflight.mjs'), 'utf8');
  assert(sign.includes('beforeAuthorityCommit') && sign.includes('project-artifact-boundary.mjs'), 'sign 未在 PRD-last 前接物理复核');
  assert(reader.includes('readProjectArtifactBytes'), '固定 PRD reader 未接物理读边界');
});

test('readonly', 'O4 纯只读原 events 无 frozen authority 可达', () => {
  const document = {
    schemaVersion: 2, channel: 'web', caseId: 'tc_readonly', url: '{{baseUrl}}/workflow',
    recordedAt: '2026-07-17T08:00:00.000Z', compiledBy: 'golden', authored: false,
    events: [
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'nav.workflowManagement', action: 'nav' },
      { stepId: 'atstep_2', intentId: 'intent_2', atom: 'assert.textVisible', action: 'assert', text: '工作流' },
    ],
  };
  const text = jsonText(document);
  const result = checkReplayEntityAdmission({ caseId: document.caseId, eventsBytes: Buffer.from(text), eventsDocument: document });
  assert(result?.ok === true && result.allowBrowserLaunch === true && result.authorityKind === 'deterministic-read-only-policy', `纯只读不可达 ${result?.reason}`);
});

test('readonly', 'O4 mutation/未知原子无 authority 仍拒，caller flags 不能洗只读', () => {
  for (const atom of ['workflow.create', 'future.unknownMutation']) {
    const document = {
      schemaVersion: 2, channel: 'web', caseId: 'tc_not_readonly', url: '{{baseUrl}}/workflow',
      recordedAt: '2026-07-17T08:00:00.000Z', compiledBy: 'golden', authored: false,
      events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom, action: 'click' }],
    };
    const text = jsonText(document);
    const result = checkReplayEntityAdmission({
      caseId: document.caseId, eventsBytes: Buffer.from(text), eventsDocument: document,
      containsEntityMutation: false, requiredBindings: [],
    });
    assert(result?.ok === false && result.allowBrowserLaunch === false, `${atom} 被 caller flags 洗成只读`);
  }
  const disguised = {
    schemaVersion: 2, channel: 'web', caseId: 'tc_bad_read_shape', url: '{{baseUrl}}/workflow',
    recordedAt: '2026-07-17T08:00:00.000Z', compiledBy: 'golden', authored: false,
    events: [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'nav.workflowManagement', action: 'fill' }],
  };
  const disguisedText = jsonText(disguised);
  const disguisedResult = checkReplayEntityAdmission({
    caseId: disguised.caseId, eventsBytes: Buffer.from(disguisedText), eventsDocument: disguised,
  });
  assert(disguisedResult?.ok === false, '只读 atom 的错误 action 借名放行');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-binding-operability-successor: ${failure}`);
  console.error(`RED  entity-binding-operability-successor/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-binding-operability-successor/${SECTION}: ${passed}/${passed} 全过（本地文件/纯函数/静态，零 SUT）`);
