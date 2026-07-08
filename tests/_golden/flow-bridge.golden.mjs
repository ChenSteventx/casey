// flow-bridge.golden.mjs —— 相1 LLM flow 草拟桥（flow-bridge，full）红金牌。实现前 lib/bin 缺席 → C1 起全红。
// 桥：规范 TestCase（嵌套 steps）+ LLM mapping（CLI 外产，测时 mock）→ compile 吃的 flow（原子+参数）。
// 三闸：投影忠实（每 TestCase.steps[].intentId 被覆盖 + 无凭空 intentId）+ 编译知识允许集（atom 可编译）
// + 复用 compile-gate.validateDraft（结构+破坏性前缀+状态机）。裁判零 LLM、fail-closed、凭据不外泄。
// C1 桥件在册；C2 happy 产 flow 形状（结构不变量）；C3【round-trip】桥产 flow 灌 compile gate 段 exit 0；
// C4 未知原子（不在注册表）拒；C5【真缝】册内无编译知识原子拒；C6 破坏性前缀+模板保留；C7 投影忠实双向；
// C8 凭据兜底门；C9 caseId 一致 + id 派生；C10 半份安全（任一闸拒零落盘）。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BRIDGE = join(ROOT, 'bin', 'flow-bridge.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-flow-bridge-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
function run(args) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// 规范嵌套 TestCase（design §2 最小形态；caseId/uniquePrefix/preconditions 供 compile，steps 供桥投影）。
const CASE_ID = 'tc_bridge';
const TESTCASE = {
  schemaVersion: 1, caseId: CASE_ID, title: '工作流创建保存',
  target: { startUrl: 'http://sut.invalid/ai-manager/process/list', auth: 'ref:site.json', channel: 'web' },
  preconditions: ['已登录'],
  steps: [
    { intentId: 'intent_create', intent: '新增工作流 atl_{{uniqueName}}', actionHint: 'fill', inputValue: 'atl_{{uniqueName}}', uniqueGuard: true, expected: [] },
    { intentId: 'intent_save', intent: '保存工作流', actionHint: 'click', expected: [] },
  ],
  globalAssertions: [], uniquePrefix: 'atl_',
};
// mock LLM mapping（CLI 外产，逐 intent → 原子+参数）。
const MAPPING = [
  { intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' } },
  { intentId: 'intent_save', atom: 'workflow.save', params: {} },
];
const tcFile = join(tmp, 'testcase.json'); writeFileSync(tcFile, JSON.stringify(TESTCASE));
function writeMapping(m, name) { const f = join(tmp, name); writeFileSync(f, JSON.stringify(m)); return f; }
function bridge(caseId, mapFile, outDir, tc = tcFile) { mkdirSync(outDir, { recursive: true }); return run([BRIDGE, caseId, '--testcase', tc, '--mapping', mapFile, '--out-dir', outDir]); }
// 桥产物文件（约定 flow-<caseId>.json 于 out-dir）。
const flowOut = (outDir, caseId = CASE_ID) => join(outDir, `flow-${caseId}.json`);

// ---------- C1 桥件在册 ----------
await checkAsync('C1 lib/flow-bridge 导出 buildFlow/validateBridge；compile-atoms 导出 COMPILE_KNOWN_ATOMS', async () => {
  const fb = await import(`file://${join(ROOT, 'lib', 'flow-bridge.mjs').replace(/\\/g, '/')}`);
  if (typeof fb.buildFlow !== 'function' || typeof fb.validateBridge !== 'function') throw new Error('flow-bridge 未导出 buildFlow/validateBridge');
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.COMPILE_KNOWN_ATOMS || typeof ca.isCompilableAtom !== 'function') throw new Error('compile-atoms 未导出 COMPILE_KNOWN_ATOMS/isCompilableAtom');
});

// ---------- C2 happy 产 flow 形状 ----------
await checkAsync('C2 happy：桥产 flow {id,name,category,steps[{atom,params}]}，steps 顺序=mapping、无 intentId', async () => {
  const mf = writeMapping(MAPPING, 'm-c2.json'); const od = join(tmp, 'c2');
  const r = bridge(CASE_ID, mf, od);
  if (r.status !== 0) throw new Error(`桥应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const flow = readJson(flowOut(od));
  if (!/^[a-z0-9_]+$/.test(flow.id)) throw new Error(`flow.id 须 ^[a-z0-9_]+$，实际 ${flow.id}`);
  if (typeof flow.name !== 'string' || !flow.name) throw new Error('flow.name 须非空');
  if (!Array.isArray(flow.steps) || flow.steps.length !== MAPPING.length) throw new Error('flow.steps 数应=mapping');
  flow.steps.forEach((s, i) => { if (s.atom !== MAPPING[i].atom) throw new Error(`step[${i}] atom 序不符`); if ('intentId' in s) throw new Error('flow 步不得带 intentId（compile 自生）'); });
});

// ---------- C3 载荷核心：round-trip 灌 compile gate 段 ----------
await checkAsync('C3 round-trip：桥产 flow → casey compile --flow gate 段 exit 0 落 flow-<caseId>.json', async () => {
  const mf = writeMapping(MAPPING, 'm-c3.json'); const od = join(tmp, 'c3');
  const rb = bridge(CASE_ID, mf, od);
  if (rb.status !== 0) throw new Error(`桥应 exit 0，实际 ${rb.status}`);
  const od2 = join(tmp, 'c3-compile'); mkdirSync(od2, { recursive: true });
  const rc = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', flowOut(od), '--out-dir', od2]);
  if (rc.status !== 0) throw new Error(`compile gate 段应 exit 0，实际 ${rc.status}：${(rc.stderr || '').slice(-200)}`);
  if (!existsSync(join(od2, `flow-${CASE_ID}.json`))) throw new Error('compile 应落 flow-<caseId>.json');
});

// ---------- C4 未知原子（不在注册表）拒 ----------
await checkAsync('C4 未知原子（不在注册表）→ 桥 exit 65 零落盘', async () => {
  const bad = [{ intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: 'x' } }, { intentId: 'intent_save', atom: 'nonsense.atom', params: {} }];
  const mf = writeMapping(bad, 'm-c4.json'); const od = join(tmp, 'c4');
  const r = bridge(CASE_ID, mf, od);
  if (r.status !== 65) throw new Error(`未知原子应 exit 65，实际 ${r.status}`);
  if (existsSync(flowOut(od))) throw new Error('拒应零落盘');
});

// ---------- C5 真缝：册内无编译知识原子拒 ----------
await checkAsync('C5【真缝】册内(60)但无编译知识原子（如 agent.openToolPicker）→ 桥 exit 65 点名无编译知识', async () => {
  // 例翻（wf-add-node）：addNode 已获编译知识（wf-add-node）——反例换 agent.openToolPicker（agent_tool 维度双 stale 依赖压后，长寿反例）。
  const bad = [{ intentId: 'intent_create', atom: 'agent.openToolPicker', params: {} }, { intentId: 'intent_save', atom: 'workflow.save', params: {} }];
  const mf = writeMapping(bad, 'm-c5.json'); const od = join(tmp, 'c5');
  const r = bridge(CASE_ID, mf, od);
  if (r.status !== 65) throw new Error(`册内无编译知识原子应 exit 65，实际 ${r.status}`);
  if (!/编译知识|compil/i.test((r.stderr || '') + (r.stdout || ''))) throw new Error('应点名「无编译知识」');
  if (existsSync(flowOut(od))) throw new Error('拒应零落盘');
});

// ---------- C6 破坏性前缀 + 模板保留 ----------
await checkAsync('C6 破坏性原子实体名无 uniquePrefix → 拒；{{uniqueName}} 模板原样保留不冻字面量', async () => {
  const badPrefix = [{ intentId: 'intent_create', atom: 'workflow.create', params: { name: '目录CRUD无前缀', category: 'x' } }];
  const tcOne = join(tmp, 'tc-c6.json'); writeFileSync(tcOne, JSON.stringify({ ...TESTCASE, steps: [TESTCASE.steps[0]] }));
  const mf = writeMapping(badPrefix, 'm-c6.json'); const od = join(tmp, 'c6');
  const r = bridge(CASE_ID, mf, od, tcOne);
  if (r.status !== 65) throw new Error(`裸名破坏性原子应拒 exit 65，实际 ${r.status}`);
  // 模板保留：happy mapping 的 {{uniqueName}} 不被冻成字面量
  const mf2 = writeMapping(MAPPING, 'm-c6b.json'); const od2 = join(tmp, 'c6b');
  if (bridge(CASE_ID, mf2, od2).status !== 0) throw new Error('happy 应 exit 0');
  if (!JSON.stringify(readJson(flowOut(od2))).includes('{{uniqueName}}')) throw new Error('{{uniqueName}} 模板须原样保留');
});

// ---------- C7 投影忠实闸双向 ----------
await checkAsync('C7 投影忠实：漏覆盖 intent → 拒；mapping 造 TestCase 不存在的 intentId → 拒', async () => {
  const miss = [{ intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: 'x' } }]; // 漏 intent_save
  if (bridge(CASE_ID, writeMapping(miss, 'm-c7a.json'), join(tmp, 'c7a')).status !== 65) throw new Error('漏覆盖 intent 应拒 exit 65');
  const phantom = [...MAPPING, { intentId: 'intent_ghost', atom: 'workflow.save', params: {} }];
  if (bridge(CASE_ID, writeMapping(phantom, 'm-c7b.json'), join(tmp, 'c7b')).status !== 65) throw new Error('凭空 intentId 应拒 exit 65');
});

// ---------- C8 凭据兜底门 ----------
await checkAsync('C8 凭据兜底门：mapping params 含凭据关键词 → 拒写 零落盘', async () => {
  const leaky = [{ intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: 'token=abc123' } }, { intentId: 'intent_save', atom: 'workflow.save', params: {} }];
  const od = join(tmp, 'c8');
  const r = bridge(CASE_ID, writeMapping(leaky, 'm-c8.json'), od);
  if (r.status === 0) throw new Error('凭据门应拦截含 token= 的 params');
  if (existsSync(flowOut(od))) throw new Error('凭据门拦截应零落盘');
});

// ---------- C9 caseId 一致 + id 派生 ----------
await checkAsync('C9 caseId 一致：TestCase.caseId≠命令行 → 拒；caseId 带大写/-  → 派生 flow.id ^[a-z0-9_]+$', async () => {
  if (bridge('tc_OTHER', writeMapping(MAPPING, 'm-c9.json'), join(tmp, 'c9')).status !== 65) throw new Error('caseId 不一致应拒 exit 65');
  const tcUp = join(tmp, 'tc-c9.json'); writeFileSync(tcUp, JSON.stringify({ ...TESTCASE, caseId: 'TC-Bridge_2' }));
  const od = join(tmp, 'c9b');
  const r = bridge('TC-Bridge_2', writeMapping(MAPPING, 'm-c9b.json'), od, tcUp);
  if (r.status !== 0) throw new Error(`带大写/- 的 caseId 应 exit 0，实际 ${r.status}`);
  if (!/^[a-z0-9_]+$/.test(readJson(flowOut(od, 'TC-Bridge_2')).id)) throw new Error('flow.id 须确定性派生为 ^[a-z0-9_]+$');
});

// ---------- C10 半份安全 ----------
await checkAsync('C10 半份安全：任一闸拒 → out-dir 无 flow 残留', async () => {
  const od = join(tmp, 'c10');
  bridge(CASE_ID, writeMapping([{ intentId: 'intent_create', atom: 'nonsense.x', params: {} }], 'm-c10.json'), od);
  if (existsSync(flowOut(od))) throw new Error('闸拒不得留半份 flow');
});

// ---------- C11 route:human 跳过通道留痕（codex R1-F2） ----------
await checkAsync('C11 route:human：缺 reason 拒 / 带 reason 过且不进 flow + 留痕 / 又被 mapping 覆盖拒', async () => {
  const mapOne = [MAPPING[0]]; // 只覆盖 intent_create
  const tcNoReason = { ...TESTCASE, steps: [TESTCASE.steps[0], { ...TESTCASE.steps[1], route: 'human' }] };
  const f1 = join(tmp, 'tc-c11a.json'); writeFileSync(f1, JSON.stringify(tcNoReason));
  if (bridge(CASE_ID, writeMapping(mapOne, 'm-c11a.json'), join(tmp, 'c11a'), f1).status !== 65) throw new Error('route:human 缺 reason 应拒 exit 65');
  const tcSkip = { ...TESTCASE, steps: [TESTCASE.steps[0], { ...TESTCASE.steps[1], route: 'human', reason: '需人工核对保存结果' }] };
  const f2 = join(tmp, 'tc-c11b.json'); writeFileSync(f2, JSON.stringify(tcSkip));
  const od = join(tmp, 'c11b'); const r = bridge(CASE_ID, writeMapping(mapOne, 'm-c11b.json'), od, f2);
  if (r.status !== 0) throw new Error(`route:human 带 reason 应 exit 0，实际 ${r.status}`);
  if (!/route:human 跳过|人工/.test(r.stdout || '')) throw new Error('应打印跳过留痕（别静默丢）');
  if (readJson(flowOut(od)).steps.length !== 1) throw new Error('跳过的 intent 不得进 flow');
  if (bridge(CASE_ID, writeMapping(MAPPING, 'm-c11c.json'), join(tmp, 'c11c'), f2).status !== 65) throw new Error('route:human 又被 mapping 覆盖（矛盾）应拒');
});

// ---------- C12 TestCase.intentId 唯一（codex R1-F3） ----------
await checkAsync('C12 TestCase.steps[].intentId 重复 → 拒（防投影忠实按 ID 去重退化）', async () => {
  const dup = { ...TESTCASE, steps: [TESTCASE.steps[0], { ...TESTCASE.steps[1], intentId: 'intent_create' }] };
  const f = join(tmp, 'tc-c12.json'); writeFileSync(f, JSON.stringify(dup));
  if (bridge(CASE_ID, writeMapping(MAPPING, 'm-c12.json'), join(tmp, 'c12'), f).status !== 65) throw new Error('重复 intentId 应拒 exit 65');
});

// ---------- C13 凭据门零目录副作用（codex R1-F4）：直调 BRIDGE 不预建 out-dir ----------
await checkAsync('C13 凭据门前零目录副作用：leaky mapping + 全新 out-dir → exit 1 且 out-dir 不被创建', async () => {
  const leaky = [{ intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: 'password=hunter2' } }, MAPPING[1]];
  const mf = writeMapping(leaky, 'm-c13.json');
  const od = join(tmp, 'c13-fresh'); // 不预建（bridge 助手会 mkdir，故直调 BRIDGE）
  const r = run([BRIDGE, CASE_ID, '--testcase', tcFile, '--mapping', mf, '--out-dir', od]);
  if (r.status !== 1) throw new Error(`凭据门应 exit 1，实际 ${r.status}`);
  if (existsSync(od)) throw new Error('凭据拒不得创建 out-dir（零目录副作用）');
});

// ---------- C14 isCompilableAtom 单一事实源语义（codex R1-F1；wf-open-smoke 集 11→13 重钉） ----------
await checkAsync('C14 isCompilableAtom 语义：16 命名 + login + assert.* 真；册内无知识/未知 假；集恰 16', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  for (const a of ['workflow.create', 'chat.closeTestPanel', 'nav.workflowManagement', 'workflow.open', 'workflow.addNode', 'workflow.connectNodes', 'workflow.openNode', 'login', 'assert.onPage']) if (!ca.isCompilableAtom(a)) throw new Error(`${a} 应可编译`);
  for (const a of ['agent.openToolPicker', 'nonsense.x']) if (ca.isCompilableAtom(a)) throw new Error(`${a} 不应可编译`);
  if (ca.COMPILE_KNOWN_ATOMS.size !== 16) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 16 个（分派表派生，openNode +1），实际 ${ca.COMPILE_KNOWN_ATOMS.size}`);
});

// ---------- C15 原型链键 + 导出 Set 可变性（codex R2） ----------
await checkAsync('C15 原型链原子（toString/constructor）不可编译且桥拒；导出 Set 被 .add 不影响 isCompilableAtom', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  for (const a of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) if (ca.isCompilableAtom(a)) throw new Error(`原型链键 ${a} 不应可编译`);
  // 桥拒（toString 不在注册表 → validateDraft 未知原子）
  const bad = [{ intentId: 'intent_create', atom: 'toString', params: {} }, MAPPING[1]];
  if (bridge(CASE_ID, writeMapping(bad, 'm-c15.json'), join(tmp, 'c15')).status !== 65) throw new Error('原型链原子桥应拒 exit 65');
  // 导出 Set 可变性：篡改不影响行为判定（isCompilableAtom 直查私有分派表；例随 wf-add-node 换 agent.openToolPicker）
  ca.COMPILE_KNOWN_ATOMS.add('agent.openToolPicker');
  if (ca.isCompilableAtom('agent.openToolPicker')) throw new Error('篡改导出 Set 不得让 isCompilableAtom 漂移');
});

// ---------- C16 坏 mapping 契约退出码（codex R2）：mapping:[null] → exit 65 非未捕获 exit 1 ----------
await checkAsync('C16 mapping:[null]/非对象元素 → 桥 exit 65（契约码，非 buildFlow TypeError 的 exit 1）', async () => {
  const r1 = bridge(CASE_ID, writeMapping([null, MAPPING[1]], 'm-c16a.json'), join(tmp, 'c16a'));
  if (r1.status !== 65) throw new Error(`mapping:[null] 应 exit 65，实际 ${r1.status}`);
  const r2 = bridge(CASE_ID, writeMapping(['not-an-object'], 'm-c16b.json'), join(tmp, 'c16b'));
  if (r2.status !== 65) throw new Error(`mapping 非对象元素应 exit 65，实际 ${r2.status}`);
});

console.log(`flow-bridge golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
