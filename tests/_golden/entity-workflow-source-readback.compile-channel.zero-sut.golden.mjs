#!/usr/bin/env node
// entity-workflow-source-readback（C2）验收金牌：workflows.listApi 通道注入 + 声明不全 fail-closed（红先行、zero-SUT）。
// 纯 node：结构断言（导出 Map）+ 驱动 bin/compile.mjs 到浏览器前门（CASEY_LAUNCH_SENTINEL 短路，绝不启动
// 浏览器/SUT）。断言纪律：退出码 + sentinel 在否 + 具名失败原因；禁标记串 grep（判绿只信退出码，MEMORY 铁律）。
//
// ── C2 目标（母规格 §3、本契约 plan 验收点 1/2）──
// C0 已把 compile 的身份通道注入泛化成【数据驱动遍历】ENTITY_KIND_COMPILE_CHANNELS（bin/compile.mjs:235-272）：
//   各已登记 kind 从其 profile 通道（profileKey）注入身份 ledger，listApi 形状不完整则 fail-closed exit 65。
//   C0 只登记 agent→{profileKey:'agents'}；C2 加 workflow→{profileKey:'workflows'}（镜像 agents.listApi）。
// 注入逻辑本身 C0 已是 kind 无关的闭集遍历——C2 只加【数据条目】，其余 fail-closed 校验自动继承。
//
// ── 红先行判据 ──
//   · s1 结构：ENTITY_KIND_COMPILE_CHANNELS.get('workflow')?.profileKey==='workflows' → 现无 workflow 条目 → RED。
//   · s2 行为（声明不全）：profile 只声明 workflows.listApi 但缺 totalPath → C2 后须 fail-closed exit 65、不写 sentinel。
//        现无 workflow 通道 → profile.workflows 被整体忽略 → 控制流越过通道门到 launch 前哨 → exit 66 + sentinel 在 → RED。
//   · s3 行为（声明完备，正控）：完整 workflows 通道 → 越过通道门到 launch 前哨 → exit 66 + sentinel 在。
//        现忽略、C2 后校验通过——两态皆 exit 66，稳定绿正控：证明 s2 的 exit 65 归因于「声明不全」而非别的门抢跑
//        （scaffolding 有效性守卫：s3 不达 66 = 夹具坏，非 C2 缺口）。
//
// ⚠ 真字段名待真机采、先采不猜（GRILL D4）：profile 里 recordsPath='data.records'/totalPath='data.total'/
//   fields{workflowId,workflowCode,workflowName}/itemContainer='.workflow-card' 全为仿造 hermetic 占位，
//   非 Heren 真机真实字段/类名。本金牌只钉「通道数据条目在 + 声明不全 fail-closed」结构，不钉真字段字面量。

import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const COMPILE = join(ROOT, 'bin', 'compile.mjs');
const REGISTRY_MODULE = resolve(ROOT, 'lib', 'entity-observation-registry.mjs');

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; } else { failures.push(msg); console.error(`FAIL ${msg}`); } };

// ── s1 结构：ENTITY_KIND_COMPILE_CHANNELS 加 workflow→{profileKey:'workflows'} ─────────
let ENTITY_KIND_COMPILE_CHANNELS = null;
try {
  ({ ENTITY_KIND_COMPILE_CHANNELS } = await import(REGISTRY_MODULE));
} catch (error) {
  console.error(`RED  entity-workflow-source-readback.compile-channel: 注册表模块缺席 —— ${String(error?.message || error).slice(0, 200)}`);
  process.exit(1);
}
assert(ENTITY_KIND_COMPILE_CHANNELS instanceof Map, 's1 ENTITY_KIND_COMPILE_CHANNELS 须为 Map');
{
  const wf = ENTITY_KIND_COMPILE_CHANNELS.get('workflow');
  assert(wf && typeof wf === 'object' && wf.profileKey === 'workflows',
    `s1 ENTITY_KIND_COMPILE_CHANNELS 须登记 workflow→{profileKey:'workflows'}（镜像 agents.listApi）；实得 ${JSON.stringify(wf) ?? 'undefined'}`);
  // agent 条目保序（C2 不得改 agent 通道）。
  const ag = ENTITY_KIND_COMPILE_CHANNELS.get('agent');
  assert(ag && ag.profileKey === 'agents', 's1 agent→{profileKey:agents} 须保序');
}

// ── s2/s3 行为：驱动 compile 到 launch 前哨（sentinel 短路，零浏览器）──────────────────
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-channel-'));
const writeJson = (name, value) => { const p = join(tmp, name); writeFileSync(p, JSON.stringify(value, null, 2)); return p; };
const caseId = 'tc_wf_channel';
const siteJson = writeJson('site.json', {});
const testcase = writeJson('testcase.json', {
  schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
});
// 只读 nav.workflowManagement flow 草稿（effect:'read' → 越过身份准入门无需 entity-authority）。
// flow.id 须 ^[a-z0-9_]+$、name 非空（compile-gate 结构闸）。
const flowDraft = writeJson('flow-draft.json', {
  id: 'wf_channel_flow', name: 'workflow 通道注入探针', channel: 'web',
  steps: [{ intentId: 'intent_0', atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'intent_0' }],
});

// 完整 workflows 通道（仿造字段）：listApi 全字段 + 物理卡片双锚（itemContainer + cardFields.name/code）。
const workflowsComplete = {
  listApi: {
    pathname: '/api/workflows/query', method: 'GET',
    recordsPath: 'data.records', totalPath: 'data.total', queryParam: 'nameLike',
    hasNextPath: null,
    fields: { id: 'workflowId', code: 'workflowCode', name: 'workflowName' },
  },
  itemContainer: '.workflow-card',
  cardFields: { name: '.workflow-card__name', code: '.workflow-card__code' },
};
// 声明不全：listApi 缺 totalPath（完整性先决字段缺失——C2 后须 fail-closed exit 65）。
const workflowsIncomplete = JSON.parse(JSON.stringify(workflowsComplete));
delete workflowsIncomplete.listApi.totalPath;

const profileComplete = writeJson('profile-complete.json', { background: [], successField: 'status', successValue: 200, workflows: workflowsComplete });
const profileIncomplete = writeJson('profile-incomplete.json', { background: [], successField: 'status', successValue: 200, workflows: workflowsIncomplete });

const baseEnv = { ...process.env, AT_SITE_JSON: siteJson };
delete baseEnv.AT_CREDS_USER;
delete baseEnv.AT_CREDS_PASS;

// 闸段：flow 草稿过闸 → flow-<caseId>.json；然后填 confirmedBy/confirmedAt。
const gate = spawnSync(process.execPath, [COMPILE, caseId, '--testcase', testcase, '--flow', flowDraft, '--out-dir', tmp], { encoding: 'utf8', timeout: 120000, env: baseEnv });
const flowDocPath = join(tmp, `flow-${caseId}.json`);
if (gate.status !== 0 || !existsSync(flowDocPath)) {
  console.error(`RED  entity-workflow-source-readback.compile-channel: 夹具闸段未产 flow 草稿（exit=${gate.status}）：${(gate.stderr || gate.stdout || '').slice(-300)}`);
  process.exit(1);
}
{
  const fd = JSON.parse(readFileSync(flowDocPath, 'utf8'));
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-23T00:00:00.000Z';
  writeFileSync(flowDocPath, JSON.stringify(fd, null, 2));
}

function runExecute(profilePath, sentinelName) {
  const sentinel = join(tmp, sentinelName);
  try { rmSync(sentinel, { force: true }); } catch { /* 尽力 */ }
  const env = { ...baseEnv, CASEY_LAUNCH_SENTINEL: sentinel };
  const r = spawnSync(process.execPath, [
    COMPILE, caseId, '--execute', '--testcase', testcase, '--sut', 'http://127.0.0.1:1',
    '--out-dir', tmp, '--profile', profilePath, '--skip-login',
  ], { encoding: 'utf8', timeout: 120000, env });
  return { status: r.status, sentinelExists: existsSync(sentinel), output: `${r.stdout || ''}${r.stderr || ''}` };
}

// s3 正控：完整通道 → 越过通道门到 launch 前哨（exit 66 + sentinel 在）。夹具有效性守卫。
const cRes = runExecute(profileComplete, 'launch-complete.sentinel');
assert(cRes.status === 66 && cRes.sentinelExists,
  `s3 完整 workflows 通道须越过通道门抵 launch 前哨（exit 66 + sentinel 在，正控/夹具有效性守卫）；实得 exit=${cRes.status} sentinel=${cRes.sentinelExists}：${cRes.output.slice(-300)}`);

// s2 红驱动：声明不全 → C2 后 fail-closed exit 65 + 不写 sentinel；现忽略 workflows → exit 66 + sentinel 在 → RED。
const iRes = runExecute(profileIncomplete, 'launch-incomplete.sentinel');
assert(iRes.status === 65 && !iRes.sentinelExists,
  `s2 声明不全（workflows.listApi 缺 totalPath）须在浏览器前 fail-closed exit 65 且不写 sentinel；实得 exit=${iRes.status} sentinel=${iRes.sentinelExists}（现无 workflow 通道 → 被整体忽略 → 越门到 launch → RED）：${iRes.output.slice(-300)}`);
// 声明不全的拒绝须归因于通道形状（不被别的门抢跑；C2 后 exit 65 时校验消息含 workflows.listApi）。
if (iRes.status === 65) {
  assert(iRes.output.includes('workflows') && iRes.output.includes('listApi'),
    `s2 exit 65 拒绝原因须归因 workflows.listApi 形状不全（防别的门抢跑假绿）；实得：${iRes.output.slice(-300)}`);
} else {
  // 现态（RED）：不达 65，s2 主断言已红——此附加断言标记为「随 s2 一并翻绿」，此处不重复计红。
  passed += 0;
}

try { rmSync(tmp, { recursive: true, force: true }); } catch { /* 尽力 */ }

if (failures.length) {
  for (const f of failures) console.error(`RED  entity-workflow-source-readback.compile-channel: ${f}`);
  console.error(`RED  entity-workflow-source-readback.compile-channel: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-workflow-source-readback.compile-channel: ${passed}/${passed} 全过（workflow 通道条目 + 声明不全 fail-closed，零浏览器）`);
