// drawer-lock-hardening.golden.mjs —— 画布三原子域锁跨抽屉边界硬化红先行金牌（G1–G11，light）。
// 决策全录 docs/plans/drawer-lock-hardening/proposed/GRILL.md（D1 方向定案 / D2 标题锚取舍 / D3 nodeName
// 供给通道 / D4 缺 nodeName fail-closed / D5 openNode 预点基线 / D6 抽屉域三态分层 / D7 夹具反面场景 /
// D8 金牌形态）+ plan.md 落地步骤与验收。挂账原文：loop/prd-wf-set-node-field.json observability 第二条
// （codex-sol 异构冗余评审 MED#2，2026-07-10）——doSetNodeField/compileWorkflowSetNodeField 的域锁用宽
// .hr-drawer__content-wrapper，匹配所有抽屉而非当前节点配置抽屉，若另一可见抽屉恰有唯一同 placeholder
// 字段，域内 count===1 会填错抽屉的字段、精确回读仍成立→假绿；openNode/selectNodeDropdown/setNodeField
// 三原子同型设计局限。
//
// 本文件在【旧实现】（改前）上跑必须逐条红（红证）；实现收窄标题锚域锁后须逐条绿。
//
// 断言总纪律（评审修订，对每条生效）：反面用例的 verdict 一律钉精确路由 NEEDS_HUMAN（不再只断「不 PASS」）；
// 涉冒牌字段/触发器的用例一律加宽域候选零落笔/唯一落笔取证断言（吃门内宽域候选快照，纯加法证据字段，
// axes 无冻结 schema 约束）；每个原子分支一个独立子用例（checkAsync 隔离），不许合写短路掩盖。
//
// 金牌 × fake-sut 场景映射：
//   G1  回放 setNodeField 跨抽屉误命中          twinfield
//   G2  回放 selectNodeDropdown 跨抽屉误命中     twinfield
//   G3a 编译 setNodeField 跨抽屉误命中           twinfield
//   G3b 编译 selectNodeDropdown 跨抽屉误命中     twinfield
//   G4  回放 setNodeField 域内唯一才动手（正面） twinboth
//   G11 回放 selectNodeDropdown 域内唯一（正面） twinboth
//   G5  回放 openNode 开错抽屉归因                twintitle
//   G6  编译 openNode 预点基线                    twintitle
//   G7a/b/c 回放缺/空/纯空白 nodeName fail-closed happy
//   G8  回放+编译 openNode 点后歧义                twinlate
//   G9  回放+编译 set/select 域级多匹配            twinlate
//   G10 回放隐藏标题文本拒认（openNode + set）     twinghost
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut } from '../fixtures/fake-sut/server.mjs';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-drawer-lock-hardening-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-600)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };

const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut 列表既有行（只读点开进详情=画布页）
const NODE = '模型节点'; // 与 fake-sut TWIN_TITLE_NODE 一致（twintitle/twinlate/twinghost 冒牌标题固定复用此名）
const NODE_X = 320, NODE_Y = 150;
const PLACEHOLDER = '请输入接口的URL'; // registry :252 setNodeField 占位符例
const VALUE = 'https://api.example.com/drawer-lock';
const OPT = '订单库'; // 节点抽屉下拉目标选项（happy/twin* 缺省下拉既有项）

// 通道剖面：countSelector 沿用既有三原子金牌约定；本文件多数考场落 NEEDS_HUMAN/不 PASS，countChange 通道
// 不是本文件关注面（PASS 考场 G4/G11 靠 GLOBALS 兜底，不抢 countChange）。
const PROFILE_OBJ = { successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);
// 全局取证（PASS 考场 G4/G11 靠它得出 PASS，镜像 wf-set-node-field/wf-select-node-dropdown C2-c 先例）。
const GLOBALS = [{ kind: 'noPageError', op: 'absent' }, { kind: 'noErrorEnvelope', op: 'envelopeOk' }];

// ── 回放面公共助手（p5-replay 形制）：手编 events + 已签 expected → bin/replay → bin/verdict ──
function runReplayVerdict(tag, sutUrl, eventsDoc, expectedContract) {
  const evF = writeJson(join(tmp, `${tag}.events.json`), eventsDoc);
  const exF = writeJson(join(tmp, `${tag}.expected.json`), signExpected(expectedContract));
  const prF = writeJson(join(tmp, `${tag}.profile.json`), PROFILE_OBJ);
  const axF = join(tmp, `${tag}.axes.json`);
  const vdF = join(tmp, `${tag}.verdict.json`);
  const r1 = run([REPLAY, '--events', evF, '--sut', sutUrl, '--expected', exF, '--profile', prF, '--out', axF], 180000);
  if (r1.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r1.status}：${(r1.stderr || '').slice(-300)}`);
  const r2 = run([VERDICT, '--axes', axF, '--out', vdF]);
  if (r2.status !== 0) throw new Error(`verdict 应 exit 0，实际 ${r2.status}：${(r2.stderr || '').slice(-200)}`);
  return { axes: readJson(axF), verdict: readJson(vdF) };
}
const stepOf = (doc, iid) => (doc.steps || []).find((s) => s.intentId === iid) || {};

// 抽屉族回放 setup（nav→addNode 开面板+落节点），intent_0/intent_1；openNode 独立占 intent_2；
// 目标原子（set/select）占 intent_3。
const setupEvents = () => ([
  { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X, oy: NODE_Y },
]);
const openNodeEvent = () => ({ stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE });
// setNodeField/selectNodeDropdown 手编事件：nodeNameValue 可传 undefined（缺席）/ ''（空串）/ '   '（纯空白）/ NODE（合法）。
const setFieldEvent = (nodeNameValue) => {
  const ev = { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false } };
  if (nodeNameValue !== undefined) ev.nodeName = nodeNameValue;
  return ev;
};
const selectEvent = (nodeNameValue) => {
  const ev = { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true } };
  if (nodeNameValue !== undefined) ev.nodeName = nodeNameValue;
  return ev;
};
const setupIntents = () => ([
  { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
  { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
  { intentId: 'intent_2', expected: [] }, // openNode 本步不强断（本文件各考场对 openNode 自身结局各异，只钉目标原子）
]);

// ── 编译面公共助手：gate→confirm→execute，回 gate/execute 结果与 out-dir ──
function compileFlowCase(tag, caseId, steps, sutUrl) {
  const tc = writeJson(join(tmp, `tc-${tag}.json`), {
    schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
    intents: [{ intentId: 'intent_nav', text: '进列表' }, { intentId: 'intent_open', text: '开详情' }, { intentId: 'intent_body', text: '画布考场' }],
  });
  const flow = writeJson(join(tmp, `flow-${tag}.json`), { id: caseId, name: `考场 ${tag}`, category: 'normal', steps });
  const od = join(tmp, `compile-${tag}`);
  const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
  if (g.status !== 0) return { g, x: null, od };
  const fd = readJson(join(od, `flow-${caseId}.json`));
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-14T00:00:00.000Z';
  writeJson(join(od, `flow-${caseId}.json`), fd);
  const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sutUrl, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag]);
  return { g, x, od };
}
const stdFlow = (tail) => ([
  { atom: 'nav.workflowManagement', params: {} },
  { atom: 'workflow.open', params: { openName: OPEN_NAME } },
  { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
  { atom: 'workflow.openNode', params: { label: NODE } },
  ...tail,
]);

// ============================================================================================
// twinfield 场景：G1（回放 set 跨抽屉误命中）/ G2（回放 select 跨抽屉误命中）/
//                 G3a（编译 set 跨抽屉误命中）/ G3b（编译 select 跨抽屉误命中）
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'twinfield' });
  try {
    await checkAsync('G1 回放·setNodeField 跨抽屉误命中（twinfield）：标题锚域内字段 count=0 → resolution none + 宽域候选快照全空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧宽域锁 count=1 真填冒牌抽屉字段、回读成立 → unique+PASS 假绿实锤', async () => {
      const caseId = 'tc_dlh_g1';
      const { axes, verdict } = runReplayVerdict('g1', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`标题锚域内字段应 count=0 → resolution none（真节点抽屉此时是 ddempty 形态、冒牌抽屉不含标题不入域），实际 ${JSON.stringify(ax.action)}`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域（不分标题）候选字段快照应恰 1 项且为空（冒牌字段零落笔，唯一存在的同占位符字段在冒牌抽屉），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN（fail-safe 证不出归属），实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁 count=1 命中冒牌抽屉字段、填后回读成立会返 unique+PASS）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE（ap=false 且无取证背书/无漂移探针），实际 ${v.reason}`);
    });

    await checkAsync('G2 回放·selectNodeDropdown 跨抽屉误命中（twinfield）：标题锚域内触发器 count=0 → resolution none + 宽域候选快照仍「请选择」（零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧门点冒牌触发器选中回读成立 → unique+PASS 假绿实锤', async () => {
      const caseId = 'tc_dlh_g2';
      const { axes, verdict } = runReplayVerdict('g2', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`标题锚域内触发器应 count=0 → resolution none，实际 ${JSON.stringify(ax.action)}`);
      const wide = ax.action.wideTriggerValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '请选择') throw new Error(`宽域（不分标题）触发器快照应恰 1 项且仍「请选择」（冒牌触发器零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧门点冒牌触发器选中回读成立会返 unique+PASS）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G3a 编译·setNodeField 跨抽屉误命中（twinfield）：execute 预检标题锚域内 count=0 → blocker exit 65 + 零 events + blocker 点名域内 count=0。验红：旧编译门命中冒牌抽屉 exit 0 产 events 必红', async () => {
      const { x, od } = compileFlowCase('g3a', 'tc_dlh_g3a', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（标题锚域内 count=0，绝不误填冒牌抽屉字段），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门宽域命中冒牌抽屉产 events exit 0）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 setNodeField 标题锚域内 count=0，实际 ${btext.slice(0, 300)}`);
    });

    await checkAsync('G3b 编译·selectNodeDropdown 跨抽屉误命中（twinfield）：execute 预检标题锚域内 count=0 → blocker exit 65 + 零 events + blocker 点名域内 count=0。验红：旧编译门命中冒牌抽屉 exit 0 产 events 必红', async () => {
      const { x, od } = compileFlowCase('g3b', 'tc_dlh_g3b', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65，实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门宽域命中冒牌抽屉产 events exit 0）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 selectNodeDropdown 标题锚域内 count=0，实际 ${btext.slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// twinboth 场景：G4（回放 set 域内唯一才动手，正面）/ G11（回放 select 域内唯一，正面）
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'twinboth' });
  try {
    await checkAsync('G4 回放·setNodeField 域内唯一才动手（twinboth 正面半边）：标题锚锁进节点抽屉 count=1 → unique + candidateCount 1 + identityReadback ok + 宽域候选快照证唯一落笔在真节点抽屉字段、冒牌字段仍空 + verdict PASS。验红：旧宽域锁 count=2 → ambiguous，断言必红（证明收窄非无脑全关）', async () => {
      const caseId = 'tc_dlh_g4';
      const { axes, verdict } = runReplayVerdict('g4', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`标题锚应锁进节点抽屉 count=1 → unique（旧宽域锁 count=2 会返 ambiguous——断言故意钉在这），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 1) throw new Error(`candidateCount 应恰 1（标题锚域内唯一），实际 ${ax.action.candidateCount}`);
      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true（字段 value 精确回读），实际 ${JSON.stringify(ax.action.identityReadback)}`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 2) throw new Error(`宽域候选字段快照应恰 2 项（冒牌+真节点抽屉各一同占位符字段），实际 ${JSON.stringify(wide)}`);
      if (wide[0] !== '') throw new Error(`宽域候选[0]（冒牌抽屉字段，DOM 序先于真抽屉）应仍为空——唯一落笔须在真节点抽屉、冒牌字段零落笔，实际 ${JSON.stringify(wide)}`);
      if (wide[1] !== VALUE) throw new Error(`宽域候选[1]（真节点抽屉字段）应等于填入值「${VALUE}」，实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'PASS') throw new Error(`应 PASS（收窄后能证出归属时照常干活，不是无脑全关），实际 ${v.verdict}/${v.reason}`);
    });

    await checkAsync('G11 回放·selectNodeDropdown 域内唯一（twinboth 正面半边，冒牌在 DOM 序更前）：标题锚锁进真节点抽屉触发器 → unique + verdict PASS + 宽域候选快照证冒牌触发器仍「请选择」（唯一落笔在真抽屉触发器）。验红：旧宽域 nth=0 误点冒牌触发器同样 unique+PASS——红落在取证断言（旧门无宽域快照证据 + 冒牌触发器被误动）', async () => {
      const caseId = 'tc_dlh_g11';
      const { axes, verdict } = runReplayVerdict('g11', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`标题锚应锁进真节点抽屉 count=1 → unique，实际 ${JSON.stringify(ax.action)}`);
      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true（触发器值精确含 option），实际 ${JSON.stringify(ax.action.identityReadback)}`);
      const wide = ax.action.wideTriggerValues;
      if (!Array.isArray(wide) || wide.length !== 2) throw new Error(`宽域触发器快照应恰 2 项（冒牌+真节点抽屉各一「请选择」触发器），实际 ${JSON.stringify(wide)}`);
      if (wide[0] !== '请选择') throw new Error(`宽域候选[0]（冒牌触发器，DOM 序更前）应仍「请选择」——唯一落笔须在真抽屉触发器，实际 ${JSON.stringify(wide)}（红证：旧宽域 nth=0 会误点这个冒牌触发器）`);
      if (wide[1] !== OPT) throw new Error(`宽域候选[1]（真节点抽屉触发器）应已选中「${OPT}」，实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'PASS') throw new Error(`应 PASS（域内唯一才动手、真选中真抽屉），实际 ${v.verdict}/${v.reason}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// twintitle 场景：G5（回放 openNode 开错抽屉归因）/ G6（编译 openNode 预点基线）
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'twintitle' });
  try {
    await checkAsync('G5 回放·openNode 开错抽屉归因（twintitle：点了不开+冒牌抽屉画布外预挂含节点标题）：预点基线 count>0 证不出归因 → resolution action_failed + identityReadback 非 ok + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧回读命中冒牌抽屉 → unique 假绿实锤', async () => {
      const caseId = 'tc_dlh_g5';
      const { axes, verdict } = runReplayVerdict('g5', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent()],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_2');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`预点基线已见冒牌抽屉含精确标题（count>0），证不出点后归因 → 应 action_failed（绝不背书），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('开错抽屉竟 identityReadback ok:true——命中冒牌抽屉假绿（护栏 #14）');
      const v = stepOf(verdict, 'intent_2');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧回读命中冒牌抽屉会返 unique）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G6 编译·openNode 预点基线（twintitle）：execute 预检预点基线 count>0 → blocker exit 65 + 零 events + blocker 点名预点基线证不出归因。验红：旧编译门等到冒牌抽屉可见后置核验过 exit 0 必红', async () => {
      const { x, od } = compileFlowCase('g6', 'tc_dlh_g6', stdFlow([]).slice(0, 4), s.url);
      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（预点基线证不出归因，绝不等到冒牌抽屉可见即背书），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门后置核验命中冒牌抽屉过 exit 0）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/预点基线/.test(btext)) throw new Error(`blockers 应点名 openNode 预点基线证不出归因，实际 ${btext.slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// twinlate 场景：G8（回放+编译 openNode 点后歧义）/ G9（回放+编译 set/select 域级多匹配）
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'twinlate' });
  try {
    await checkAsync('G8a 回放·openNode 点后歧义（twinlate：单击开真抽屉同刻挂出含标题冒牌）：预点基线 0 过、点后域内 count=2 证不出归因 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧回读 first 可见即过 → unique 假绿必红', async () => {
      const caseId = 'tc_dlh_g8a';
      const { axes, verdict } = runReplayVerdict('g8a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent()],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_2');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`点后域内 count=2（真+冒牌同刻现身，均含精确标题）证不出归因 → 应 action_failed，实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_2');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧回读 first 可见即过会返 unique）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G8b 编译·openNode 点后歧义（twinlate）：execute 预检点后域内 count=2 → blocker exit 65 + 零 events + blocker 点名点后域内 count=2。验红：旧编译 isVisible 过 exit 0 必红', async () => {
      const { x, od } = compileFlowCase('g8b', 'tc_dlh_g8b', stdFlow([]).slice(0, 4), s.url);
      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（点后域内 count=2 证不出归因），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译 isVisible 过 exit 0）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/count=2/.test(btext)) throw new Error(`blockers 应点名 openNode 点后域内 count=2，实际 ${btext.slice(0, 300)}`);
    });

    await checkAsync('G9a 回放·setNodeField 域级多匹配（twinlate：openNode 点击已发生、两含标题抽屉在场）：标题锚域内 count=2 → resolution ambiguous + candidateCount 2 + 宽域候选快照零落笔 + verdict 恰 NEEDS_HUMAN/AMBIGUOUS_ACTION。验红：旧宽域锁字段 count=1 命中冒牌 → unique+PASS 假绿必红', async () => {
      const caseId = 'tc_dlh_g9a';
      const { axes, verdict } = runReplayVerdict('g9a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`点击已发生后两抽屉均含精确标题、标题锚域内 count=2 → 应 ambiguous（证不出归属，绝不动手），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2（域内两个含精确标题的可见抽屉），实际 ${ax.action.candidateCount}`);
      const wide = ax.action.wideCandidateValues;
      // codex-sol@medium L2 分析发现：仅 .some() 检查对空数组恒假通过（真节点抽屉此时 ddempty 无字段、
      // 冒牌抽屉恰一字段——域内应恰 1 项，缺 length 钉位则实现若误吐空数组此断言仍会「通过」，非真校验。
      if (!Array.isArray(wide) || wide.length !== 1 || wide.some((v) => v !== '')) throw new Error(`宽域候选字段快照应恰 1 项且为空（零落笔，冒牌字段未被误填；真节点抽屉此时 ddempty 无字段），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁 count=1 命中冒牌字段会返 unique+PASS）`);
      if (v.reason !== 'AMBIGUOUS_ACTION') throw new Error(`reason 应恰 AMBIGUOUS_ACTION（ap='ambiguous' 唯一合法路由），实际 ${v.reason}`);
    });

    await checkAsync('G9b 回放·selectNodeDropdown 域级多匹配（twinlate，同上两含标题抽屉在场）：标题锚域内 count=2 → resolution ambiguous + candidateCount 2 + 宽域候选快照仍「请选择」（零落笔）+ verdict 恰 NEEDS_HUMAN/AMBIGUOUS_ACTION。验红：旧宽域锁触发器 count=1 命中冒牌 → unique+PASS 假绿必红', async () => {
      const caseId = 'tc_dlh_g9b';
      const { axes, verdict } = runReplayVerdict('g9b', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`标题锚域内 count=2 → 应 ambiguous，实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2，实际 ${ax.action.candidateCount}`);
      const wide = ax.action.wideTriggerValues;
      // codex-sol@medium L2 分析发现：仅 .some() 检查对空数组恒假通过——域内应恰 1 项（真节点抽屉此时
      // ddempty 无下拉、冒牌抽屉恰一触发器），缺 length 钉位则实现若误吐空数组此断言仍会「通过」。
      if (!Array.isArray(wide) || wide.length !== 1 || wide.some((v) => v !== '请选择')) throw new Error(`宽域触发器快照应恰 1 项且全「请选择」（零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁触发器 count=1 命中冒牌会返 unique+PASS）`);
      if (v.reason !== 'AMBIGUOUS_ACTION') throw new Error(`reason 应恰 AMBIGUOUS_ACTION，实际 ${v.reason}`);
    });

    await checkAsync('G9c 编译·setNodeField 域级多匹配（twinlate：openNode 被 blocker 截后 run 态缺失）：openNode 点后 count=2 blocker + setNodeField run 态节点抽屉标题缺失 blocker 级联 → exit 65 零 events（D3 run 态缺失分支实钉，fail-closed 绝不回落宽域锁）', async () => {
      const { x, od } = compileFlowCase('g9c', 'tc_dlh_g9c', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（openNode 自身被点后歧义截、run 态节点抽屉标题从未写入，setNodeField 须 run 态缺失兜底 fail-closed），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!/openNode/.test(btext) || !/count=2/.test(btext)) throw new Error(`blockers 应含 openNode 点后域内 count=2 的自身 blocker，实际 ${btext.slice(0, 400)}`);
      if (!/setNodeField/.test(btext) || !/run 态|标题缺失|nodeDrawerLabel/.test(btext)) throw new Error(`blockers 应另含 setNodeField 因 run 态节点抽屉标题缺失而截断的 blocker（D3 run 态缺失分支），实际 ${btext.slice(0, 400)}`);
    });

    await checkAsync('G9d 编译·selectNodeDropdown 域级多匹配（twinlate，同上级联）：openNode 点后 count=2 blocker + selectNodeDropdown run 态节点抽屉标题缺失 blocker 级联 → exit 65 零 events', async () => {
      const { x, od } = compileFlowCase('g9d', 'tc_dlh_g9d', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65，实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!/openNode/.test(btext) || !/count=2/.test(btext)) throw new Error(`blockers 应含 openNode 点后域内 count=2 的自身 blocker，实际 ${btext.slice(0, 400)}`);
      if (!/selectNodeDropdown/.test(btext) || !/run 态|标题缺失|nodeDrawerLabel/.test(btext)) throw new Error(`blockers 应另含 selectNodeDropdown 因 run 态节点抽屉标题缺失而截断的 blocker，实际 ${btext.slice(0, 400)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// twinghost 场景：G10（回放 openNode + set，隐藏标题文本拒认）
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'twinghost' });
  try {
    await checkAsync('G10a 回放·openNode 隐藏标题文本拒认（twinghost：冒牌抽屉标题文本 display:none）：标题文本自身不可见不算命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧 filter({has}) 命中隐藏文本、wrapper 可见即过 → unique 假绿必红', async () => {
      const caseId = 'tc_dlh_g10a';
      const { axes, verdict } = runReplayVerdict('g10a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent()],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_2');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`标题文本 display:none 隐藏，自身不可见不算命中 → 应 action_failed（真抽屉本就不开），实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_2');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧 filter({has}) 不查内层可见性、wrapper 可见即命中隐藏文本会返 unique）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G10b 回放·setNodeField 隐藏标题文本拒认（twinghost，冒牌抽屉补挂同占位符字段+触发器）：标题文本不可见 → 标题锚域内 count=0 → resolution none + 宽域候选快照全空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧宽域锁不问标题只问抽屉可见、域内 count=1 真填冒牌抽屉字段、回读成立 → unique+PASS 假绿必红（若冒牌不挂字段则巧合吐 none 不构成红证，故补挂）', async () => {
      const caseId = 'tc_dlh_g10b';
      const { axes, verdict } = runReplayVerdict('g10b', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`隐藏标题文本不算命中 → 标题锚域内 count=0 → 应 resolution none，实际 ${JSON.stringify(ax.action)}`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域（不分标题）候选字段快照应恰 1 项且为空（冒牌字段零落笔，唯一存在的同占位符字段在冒牌抽屉），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（挂账假绿：旧宽域锁不问标题、域内 count=1 会真填冒牌抽屉字段、回读成立返 unique+PASS）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// happy 场景：G7a/b/c（缺/空/纯空白 nodeName fail-closed 钉桩，四条独立子用例，D4 修订判据）
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'happy' });
  try {
    await checkAsync('G7a 回放·setNodeField 事件缺 nodeName（happy）：字段缺席判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE（绝不回落宽域锁）。验红：旧门无此字段要求照常 unique+PASS 必红；此桩锁死后人加 legacy 回落', async () => {
      const caseId = 'tc_dlh_g7a';
      const { axes, verdict } = runReplayVerdict('g7a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(undefined)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`事件缺 nodeName 应硬阻断 action_failed（D4：绝不回落宽域锁），实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}（旧门无 nodeName 要求，照常 unique+PASS）`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G7b 回放·selectNodeDropdown 事件缺 nodeName（happy）：字段缺席判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧门无此字段要求照常 unique+PASS 必红', async () => {
      const caseId = 'tc_dlh_g7b';
      const { axes, verdict } = runReplayVerdict('g7b', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent(undefined)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`事件缺 nodeName 应硬阻断 action_failed，实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G7c-1 回放·setNodeField 事件 nodeName 为空串（happy，D4 修订判据）：trim() 空判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE（schema 只约束 string 类型合法、空串语义非法）。验红：改前（判据只查缺席）空串会穿过判据、旧门宽域锁照常 unique+PASS 必红', async () => {
      const caseId = 'tc_dlh_g7c1';
      const { axes, verdict } = runReplayVerdict('g7c1', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent('')],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`nodeName 空串应硬阻断 action_failed（D4 修订：字段缺席/非 string/trim 空三者任一），实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G7c-2 回放·selectNodeDropdown 事件 nodeName 为纯空白（happy，D4 修订判据）：trim() 空判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：改前纯空白会穿过判据、旧门宽域锁照常 unique+PASS 必红', async () => {
      const caseId = 'tc_dlh_g7c2';
      const { axes, verdict } = runReplayVerdict('g7c2', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent('   ')],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`nodeName 纯空白应硬阻断 action_failed，实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    // codex-sol@medium L2 分析 MED-3：D4 修订判据三者（缺席/非 string/trim 空）里「非 string」此前未直接
    // 覆盖（events.schema 只挡得住 additionalProperties 越界，挡不住 nodeName 类型；手编 events 越过 schema
    // 直喂 replay 时非 string 值仍可能出现）。G7d 补齐：nodeName 载数字（非 string 合法 JS 值）。
    await checkAsync('G7d 回放·setNodeField 事件 nodeName 为非 string（happy，D4 修订判据「非 string」分支）：typeof 非 string 判据命中 → resolution action_failed + verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：改前判据若只查缺席/trim 空，数字值会穿过判据、旧门宽域锁照常 unique+PASS 必红', async () => {
      const caseId = 'tc_dlh_g7d';
      const { axes, verdict } = runReplayVerdict('g7d', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(12345)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`nodeName 非 string（数字）应硬阻断 action_failed（D4 修订：typeof 非 string 判据），实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });
  } finally { await s.close(); }
}

console.log(`drawer-lock-hardening golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
