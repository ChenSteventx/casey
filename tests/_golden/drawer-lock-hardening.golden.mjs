// drawer-lock-hardening.golden.mjs —— 画布三原子域锁跨抽屉边界硬化红先行金牌（G1–G20，light）。
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
//   —— 实现评审 r1 修复轮新增（红先行：在 r1 实现上逐条红后修绿）——
//   G12a 回放 setNodeField 检查后窗口前插冒牌      twindelay（codex HIGH#1 TOCTOU）
//   G12b 回放 selectNodeDropdown 检查后窗口前插    twindelay（codex HIGH#1 TOCTOU）
//   G12c 编译 selectNodeDropdown 检查后窗口前插    twindelay（codex HIGH#1 TOCTOU）
//   G13  编译 openNode 失败不失效旧 run 态标题     happy（codex HIGH#2 陈旧 nodeDrawerLabel）
//   G14a 回放 隐藏同文案在前合法抽屉不误拒（正面）  ghostdup（codex/pi 双路 MED#1）
//   G14b 编译 隐藏同文案在前合法抽屉不误拒（正面）  ghostdup（codex/pi 双路 MED#1）
//   —— 实现评审 r2 修复轮新增（红先行：在 r1 修复版 835a8ec 上逐条红后修绿）——
//   G15a 回放 setNodeField pin 被页面复制拒动       pinclone（codex r2 HIGH，握手确定性）
//   G15b 编译 setNodeField pin 被页面复制拒动       pinclone（codex r2 HIGH，握手确定性）
//   —— 实现评审 r3 前置修复轮新增（红先行：在 r2 实现上逐条红后修绿）——
//   G16a 回放 setNodeField focus 后控件离域拒认      fieldmove（独立审查 HIGH，动作窗口）
//   G16b 编译 setNodeField focus 后控件离域拒认      fieldmove（独立审查 HIGH，动作窗口）
//   G17a 回放 selectNodeDropdown click 后触发器离域  triggermove（独立审查 HIGH，动作窗口）
//   G17b 编译 selectNodeDropdown click 后触发器离域  triggermove（独立审查 HIGH，动作窗口）
//   —— 实现评审 r4 汇裁修复轮新增（红先行：在 r3 实现上逐条红后修绿）——
//   G18a 回放 setNodeField pin 搬到无标题嵌套 wrapper  pinmove（汇裁 A2 HIGH，挂点闸）
//   G18b 编译 setNodeField pin 搬到无标题嵌套 wrapper  pinmove（汇裁 A2 HIGH，挂点闸）
//   —— 实现评审 r5 修复轮新增（红先行：在 r4 实现上逐条红后修绿）——
//   G19a 回放 openNode+setNodeField label 前后空白归一  happy（codex r4 MED，标题两侧归一）
//   G19b 编译 openNode+setNodeField label 前后空白归一  happy（codex r4 MED，标题两侧归一）
//   —— 实现评审 r6 修复轮新增（红先行：在 r5 实现上逐条红后修绿）——
//   G20a 回放 openNode 纯空白 label fail-closed          happy（codex r5 fail-open，trim 空门）
//   G20b 编译 openNode 纯空白 label fail-closed          happy（codex r5 fail-open，trim 空门）
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
// gate 单命令上限 300s；全量默认仍跑 G1-G20，gate 可按编号分成两条独立命令，断言与夹具不变。
const part = process.env.DLH_GOLDEN_PART || 'all';
async function checkAsync(name, fn) {
  const number = Number((/^G(\d+)/.exec(name) || [])[1]);
  if ((part === 'base' && number > 11) || (part === 'review' && number <= 11)) return;
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-600)}`); }
}
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

// ============================================================================================
// twindelay 场景（实现评审 r1 修复轮新增，codex HIGH#1）：G12a/G12b（回放 set/select 检查后窗口
// 前插冒牌）/ G12c（编译 select 同窗口）。夹具：点击开真抽屉（ddempty 形态），延时 3000ms 把含同
// 标题的冒牌抽屉（带字段+触发器）前插到真抽屉之前（DOM 序更早）——初次域计数（点击后约 1s 内）
// 只见真抽屉、字段/触发器 5s 可见等待期间冒牌现身。旧实现 root=structural.nth(0) 惰性重解析漂移
// 到冒牌抽屉且不重判三态 → 落笔冒牌+回读成立=假绿；抗漂移绑定后动作只认已钉抽屉，真抽屉无字段/
// 无触发器 → 5s 等待超时 count=0 → none（fail-closed）。
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'twindelay' });
  try {
    await checkAsync('G12a 回放·setNodeField 检查后窗口前插冒牌（twindelay）：域计数时唯一（真抽屉）、等待字段期间同标题冒牌前插 → 抗漂移绑定只认已钉真抽屉、域内字段 count=0 → resolution none + 宽域候选快照恰 1 项且为空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧动态 root 漂移到冒牌、真填冒牌字段回读成立 → unique+PASS 假绿实锤', async () => {
      const caseId = 'tc_dlh_g12a';
      const { axes, verdict } = runReplayVerdict('g12a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`已钉真抽屉内字段应 count=0 → resolution none（冒牌是检查后前插、绝不得漂移过去），实际 ${JSON.stringify(ax.action)}（挂账假绿：旧动态 root 在 5s 字段等待里漂移到前插冒牌、真填其字段回读成立会返 unique+PASS）`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域（不分标题）候选字段快照应恰 1 项且为空（超时后冒牌已在场、其字段零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G12b 回放·selectNodeDropdown 检查后窗口前插冒牌（twindelay）：同 G12a 型——已钉真抽屉内触发器 count=0 → resolution none + 宽域触发器快照恰 1 项仍「请选择」（冒牌触发器零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：旧动态 root 漂移点冒牌触发器选中回读成立 → unique+PASS 假绿实锤', async () => {
      const caseId = 'tc_dlh_g12b';
      const { axes, verdict } = runReplayVerdict('g12b', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'none') throw new Error(`已钉真抽屉内触发器应 count=0 → resolution none，实际 ${JSON.stringify(ax.action)}（挂账假绿：旧动态 root 漂移到前插冒牌、点其触发器选中回读成立会返 unique+PASS）`);
      const wide = ax.action.wideTriggerValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '请选择') throw new Error(`宽域触发器快照应恰 1 项且仍「请选择」（冒牌触发器零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G12c 编译·selectNodeDropdown 检查后窗口前插冒牌（twindelay）：execute 预检域计数唯一后、触发器 5s 可见等待期间冒牌前插 → 已钉真抽屉内触发器 count=0 → blocker exit 65 + 零 events + blocker 点名触发器 count=0。验红：旧编译门等待期漂移到冒牌触发器、点选回读成立 exit 0 产 events 假绿必红', async () => {
      const { x, od } = compileFlowCase('g12c', 'tc_dlh_g12c', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 execute 预检 blocker exit 65（已钉真抽屉无触发器，绝不漂移到检查后前插的冒牌），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：旧编译门在 5s 等待里漂移到冒牌触发器、走完点选回读 exit 0 产 events）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 selectNodeDropdown 触发器 count=0，实际 ${btext.slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// happy 场景（实现评审 r1 修复轮新增，codex HIGH#2）：G13 编译 openNode 尝试即失效旧 run 态标题。
// A（模型节点，在画布上）开成 → B（SQL查询，从未落画布）开败（画布域 count=0 预检 blocker）→
// 后续 setNodeField 不得借 A 的旧标题过域锁对 A 抽屉落笔（exit 65 零 events 也不允许编译执行期对
// 错误抽屉产生副作用，fail-safe）。
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'happy' });
  try {
    await checkAsync('G13 编译·openNode 失败不失效旧 run 态标题（happy）：openNode A 成功后 openNode B 预检 blocker，随后 setNodeField 须 run 态标题缺失 blocker 级联（尝试开始即失效旧值、仅确证成功才写回）→ exit 65 + 零 events + 零落笔（notes 无「节点字段已填入」）。验红：旧实现 B 失败不清 A 旧标题、setNodeField 借 A 标题过域锁真填 A 抽屉字段（notes 现「已填入」、无 setNodeField blocker）必红', async () => {
      const NODE_B = 'SQL查询'; // 面板项存在但从未拖落画布 → openNode B 画布域 count=0 预检 blocker（确定性开败）
      const { x, od } = compileFlowCase('g13', 'tc_dlh_g13', stdFlow([
        { atom: 'workflow.openNode', params: { label: NODE_B } },
        { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } },
      ]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（openNode B 画布域 count=0），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const ntext = JSON.stringify(rep.notes || []);
      if (/节点字段已填入/.test(ntext)) throw new Error(`B 开败后 setNodeField 竟对 A 抽屉真落笔（notes 现「节点字段已填入」）——借旧标题过域锁的编译期副作用假绿（codex HIGH#2 实锤），notes=${ntext.slice(0, 400)}`);
      const btext = JSON.stringify(rep.blockers || []);
      if (!/openNode/.test(btext) || !new RegExp(NODE_B).test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应含 openNode「${NODE_B}」画布域 count=0 的自身 blocker，实际 ${btext.slice(0, 400)}`);
      if (!/setNodeField/.test(btext) || !/run 态|标题缺失|nodeDrawerLabel/.test(btext)) throw new Error(`blockers 应另含 setNodeField 因 run 态节点抽屉标题缺失而截断的 blocker（尝试开始即失效旧值），实际 ${btext.slice(0, 400)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// ghostdup 场景（实现评审 r1 修复轮新增，codex/pi 双路 MED#1 合法正面）：G14a 回放 / G14b 编译。
// 真抽屉合法（标题可见、字段/下拉照常），但可见标题之前有一个 display:none 的同文案隐藏节点占
// DOM 序更早——可见性判定只查首命中会把合法抽屉整个排出域（fail-closed 假阴、合法操作被误拒）；
// 须遍历全部命中任一可见即纳入。
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'ghostdup' });
  try {
    await checkAsync('G14a 回放·隐藏同文案在前合法抽屉不误拒（ghostdup 正面）：openNode unique + setNodeField unique + identityReadback ok + 宽域候选快照恰 1 项等于填入值 + verdict PASS（收窄不误伤合法形态）。验红：r1 实现 .first() 只查首命中（隐藏节点）→ 合法抽屉被排出域、openNode action_failed / set none 假阴必红', async () => {
      const caseId = 'tc_dlh_g14a';
      const { axes, verdict } = runReplayVerdict('g14a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const axOpen = stepOf(axes, 'intent_2');
      if (!axOpen.action || axOpen.action.resolution !== 'unique') throw new Error(`openNode 应 unique（隐藏同文案在前不碍事、可见真标题在后即命中），实际 ${JSON.stringify(axOpen.action)}（假阴实锤：只查首命中把合法抽屉排出域）`);
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`setNodeField 应 unique（合法抽屉入域、域内字段恰 1），实际 ${JSON.stringify(ax.action)}`);
      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true，实际 ${JSON.stringify(ax.action.identityReadback)}`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== VALUE) throw new Error(`宽域候选字段快照应恰 1 项且等于填入值「${VALUE}」，实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'PASS') throw new Error(`应 PASS（合法形态不误拒），实际 ${v.verdict}/${v.reason}`);
    });

    await checkAsync('G14b 编译·隐藏同文案在前合法抽屉不误拒（ghostdup 正面）：openNode 点后恰一过、setNodeField 域内唯一真填 → exit 0 + events 产出 + 零 blockers。验红：r1 实现 openNode 点后域计数把合法抽屉排出域（count=0）→ blocker exit 65 假阴必红', async () => {
      const { x, od } = compileFlowCase('g14b', 'tc_dlh_g14b', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
      if (!x || x.status !== 0) throw new Error(`应 exit 0（合法形态照常编译产 events），实际 ${x && x.status}：${(x && x.stderr || '').slice(-300)}（假阴实锤：只查首命中致 openNode 点后域 count=0 blocker）`);
      if (!existsSync(join(od, 'events.json'))) throw new Error('应产出 events.json（合法编译全通）');
      const rep = readJson(join(od, 'compile-report.json'));
      if ((rep.blockers || []).length) throw new Error(`blockers 应为空，实际 ${JSON.stringify(rep.blockers).slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// pinclone 场景（实现评审 r2 修复轮新增，codex r2 HIGH「pin 属性可被页面复制」）：G15a 回放 / G15b 编译。
// 夹具 MutationObserver 监听 data-casey-domain-pin——真抽屉（ddempty 形态、含标题）一被钉上 pin，同一
// JS 任务的微任务里同步把 pin 值复制到前插冒牌抽屉（无标题、带唯一同占位符字段+触发器）。显式阶段握手
// （以 stamp 本身为相位信号）、零时序依赖——评审 r2 MED 对 twindelay 时基延时的确定性补强。钉：按 pin
// 属性选择器定根且只验「域内唯一者带 pin」的实现（r1 修复版）会把冒牌纳入 pin 根、其唯一字段被当域内
// 唯一而真落笔+回读成立=假绿；物理句柄绑定（rootHandle 物理同一性）+ pin 全页唯一重验后，复制即被识破。
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'pinclone' });
  try {
    await checkAsync('G15a 回放·setNodeField pin 被页面复制（pinclone 握手）：钉 pin 即同步现身复制了 pin 值的冒牌（无标题、有唯一同占位符字段）→ 物理绑定重验识破（pin 全页非唯一/写目标不在被钉物理节点内）→ resolution action_failed + 宽域候选快照恰 1 项且为空（冒牌字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：r1 修复版按 pin 属性定根、只验域内唯一者带 pin → 冒牌唯一字段被当域内唯一真落笔+回读成立 → unique 假绿实锤', async () => {
      const caseId = 'tc_dlh_g15a';
      const { axes, verdict } = runReplayVerdict('g15a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`pin 被复制须被识破 → 应 action_failed（绑定证不出、绝不落笔），实际 ${JSON.stringify(ax.action)}（挂账假绿：按 pin 属性定根的实现会真填冒牌唯一字段返 unique）`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域候选字段快照应恰 1 项且为空（复制 pin 的冒牌字段零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G15b 编译·setNodeField pin 被页面复制（pinclone 握手）：execute 预检钉 pin 即同步现身复制 pin 的冒牌 → 绑定重验识破 → blocker exit 65 + 零 events + blocker 点名 setNodeField 绑定证不出 + notes 无「节点字段已填入」（零落笔取证）。验红：r1 修复版填冒牌字段回读成立 exit 0 产 events 假绿必红', async () => {
      const { x, od } = compileFlowCase('g15b', 'tc_dlh_g15b', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（pin 被复制、绑定证不出，绝不落笔冒牌），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：r1 修复版真填冒牌字段回读成立 exit 0 产 events）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      if (/节点字段已填入/.test(JSON.stringify(rep.notes || []))) throw new Error(`pin 被复制后竟真落笔（notes 现「节点字段已填入」），notes=${JSON.stringify(rep.notes).slice(0, 300)}`);
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/绑定|pin/.test(btext)) throw new Error(`blockers 应点名 setNodeField 抗漂移绑定证不出，实际 ${btext.slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// fieldmove 场景（实现评审 r3 前置独立审查 HIGH）：G16a 回放 / G16b 编译。
// 字段 focus 事件把【同一物理 input】搬到无标题冒牌抽屉。只在 fill 前验 contains、fill 后仍从同句柄
// 读 value 的实现会真填域外字段且精确回读成立=假绿；动作拆成 focus -> 重验 -> fill 后，focus 后离域即拒填。
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'fieldmove' });
  try {
    await checkAsync('G16a 回放·setNodeField focus 后同一物理字段离域（fieldmove 动作窗口）：focus 触发搬移到无标题冒牌抽屉 → fill 前物理包含重验失败 → resolution action_failed + 宽域候选恰 1 项且仍为空（域外字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：r2 实现一把 fill 会先 focus 搬移再真填同句柄、精确回读成立返 unique 假绿', async () => {
      const caseId = 'tc_dlh_g16a';
      const { axes, verdict } = runReplayVerdict('g16a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`focus 后字段离开被钉抽屉须 action_failed，实际 ${JSON.stringify(ax.action)}（挂账假绿：r2 一把 fill 会填已搬离的同一物理字段并回读 unique）`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '') throw new Error(`宽域候选字段应恰 1 项且为空（focus 后已搬到冒牌抽屉但 fill 尚未发生），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN' || v.reason !== 'INDETERMINATE') throw new Error(`应恰 NEEDS_HUMAN/INDETERMINATE，实际 ${v.verdict}/${v.reason}`);
    });

    await checkAsync('G16b 编译·setNodeField focus 后同一物理字段离域（fieldmove 动作窗口）：execute 拆步 focus 后重验失败 → blocker exit 65 + 零 events + notes 无「节点字段已填入」。验红：r2 一把 fill 真填域外同句柄、精确回读成立 exit 0 产 events 假绿必红', async () => {
      const { x, od } = compileFlowCase('g16b', 'tc_dlh_g16b', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（focus 后字段离域，绝不继续 fill），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      if (/节点字段已填入/.test(JSON.stringify(rep.notes || []))) throw new Error(`字段离域后竟被承认已填入，notes=${JSON.stringify(rep.notes).slice(0, 300)}`);
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/后置核验|漂移|离开|绑定/.test(btext)) throw new Error(`blockers 应点名 setNodeField 动作窗口绑定/后置核验失败，实际 ${btext.slice(0, 350)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// triggermove 场景（实现评审 r3 前置独立审查 HIGH）：G17a 回放 / G17b 编译。
// 触发器既有 click listener 先开浮层，随后 listener 把【同一物理触发器】搬到无标题冒牌抽屉。只在 click
// 前验 contains、选项后仍从同句柄回读的实现会真改域外触发器且精确回读成立=假绿；触发器 click 后立即
// 重验物理包含，离域即不点选项。
// ============================================================================================
{
  const s = await startFakeSut({ scenario: 'triggermove' });
  try {
    await checkAsync('G17a 回放·selectNodeDropdown 触发器 click 后同一物理节点离域（triggermove 动作窗口）：浮层已开但触发器被搬到无标题冒牌抽屉 → 点选项前重验失败 → resolution action_failed + 宽域触发器恰 1 项仍「请选择」（零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：r2 仍点选项并从搬离同句柄精确回读，返 unique 假绿', async () => {
      const caseId = 'tc_dlh_g17a';
      const { axes, verdict } = runReplayVerdict('g17a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), selectEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`触发器 click 后离开被钉抽屉须 action_failed，实际 ${JSON.stringify(ax.action)}（挂账假绿：r2 会继续选项并从搬离同句柄回读 unique）`);
      const wide = ax.action.wideTriggerValues;
      if (!Array.isArray(wide) || wide.length !== 1 || wide[0] !== '请选择') throw new Error(`宽域触发器应恰 1 项且仍「请选择」（选项未点、零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN' || v.reason !== 'INDETERMINATE') throw new Error(`应恰 NEEDS_HUMAN/INDETERMINATE，实际 ${v.verdict}/${v.reason}`);
    });

    await checkAsync('G17b 编译·selectNodeDropdown 触发器 click 后同一物理节点离域（triggermove 动作窗口）：execute 点选项前重验失败 → blocker exit 65 + 零 events + notes 无「节点下拉已选中」。验红：r2 继续点选项、搬离同句柄精确回读成立 exit 0 产 events 假绿必红', async () => {
      const { x, od } = compileFlowCase('g17b', 'tc_dlh_g17b', stdFlow([{ atom: 'workflow.selectNodeDropdown', params: { option: OPT } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（触发器 click 后离域，绝不点选项），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      if (/节点下拉已选中/.test(JSON.stringify(rep.notes || []))) throw new Error(`触发器离域后竟被承认已选中，notes=${JSON.stringify(rep.notes).slice(0, 300)}`);
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/后置核验|漂移|离开|绑定/.test(btext)) throw new Error(`blockers 应点名 selectNodeDropdown 动作窗口绑定/后置核验失败，实际 ${btext.slice(0, 350)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// pinmove 场景（实现评审 r4 汇裁 A2 HIGH）：G18a 回放 / G18b 编译。
// 真抽屉 A（可见标题）含两个同占位符字段，其一（field2）包在 A 内部无标题、同类名
// .hr-drawer__content-wrapper 的嵌套子容器 B 里。MutationObserver 监听 pin——A 一被钉，同一微任务里
// 摘下 A 的 pin、以同值挂到 B（全页始终恰一）。r3 实现 verifyPinnedNodeDrawer 只两闸（域内唯一者物理
// 同一 + pin 全页恰一），pin 搬到 B 后：域计数仍认 A（B 无标题不入域）、pin 全页仍恰一（在 B 上）→
// 两闸皆过；bound.root 按 pin 定位到 B、候选域 2→1 洗成 unique 假绿。修法（A2）：pin 全页恰一之后补
// 第三闸——唯一 pin 承载者须与 rootHandle 物理同一，B ≠ A → action_failed。
{
  const s = await startFakeSut({ scenario: 'pinmove' });
  try {
    await checkAsync('G18a 回放·setNodeField pin 搬到无标题嵌套 wrapper（pinmove 挂点闸）：钉 A 即把 pin 搬到 A 内部无标题嵌套 wrapper B → 挂点闸识破（唯一 pin 承载者 B ≠ 被钉物理节点 A）→ resolution action_failed + 宽域候选快照恰 2 项且全空（两字段零落笔）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。验红：r3 只验域内唯一者物理同一+pin 全页恰一（皆过）、bound.root 按 pin 定位到 B、B 内唯一字段被当域内唯一真落笔+回读成立 → unique 假绿实锤', async () => {
      const caseId = 'tc_dlh_g18a';
      const { axes, verdict } = runReplayVerdict('g18a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeEvent(), setFieldEvent(NODE)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`pin 搬到无标题嵌套 wrapper 须被挂点闸识破 → 应 action_failed（绑定证不出、绝不落笔），实际 ${JSON.stringify(ax.action)}（挂账假绿：r3 两闸皆过、bound.root 定位到 B、其唯一字段被当域内唯一真落笔返 unique）`);
      const wide = ax.action.wideCandidateValues;
      if (!Array.isArray(wide) || wide.length !== 2 || wide.some((v) => v !== '')) throw new Error(`宽域候选字段快照应恰 2 项且全空（A 内 field1 + 嵌套 B 内 field2 各一同占位符字段，两字段零落笔），实际 ${JSON.stringify(wide)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
      if (v.reason !== 'INDETERMINATE') throw new Error(`reason 应恰 INDETERMINATE，实际 ${v.reason}`);
    });

    await checkAsync('G18b 编译·setNodeField pin 搬到无标题嵌套 wrapper（pinmove 挂点闸）：execute 预检钉 A 即把 pin 搬到 B → 挂点闸识破 → blocker exit 65 + 零 events + notes 无「节点字段已填入」（零落笔取证）+ blocker 点名 setNodeField 绑定证不出。验红：r3 两闸皆过、填 B 内字段回读成立 exit 0 产 events 假绿必红', async () => {
      const { x, od } = compileFlowCase('g18b', 'tc_dlh_g18b', stdFlow([{ atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }]), s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（pin 被搬到无标题嵌套 wrapper、挂点闸识破，绝不落笔 B 内字段），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：r3 真填 B 内字段回读成立 exit 0 产 events）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      if (/节点字段已填入/.test(JSON.stringify(rep.notes || []))) throw new Error(`pin 搬移后竟真落笔（notes 现「节点字段已填入」），notes=${JSON.stringify(rep.notes).slice(0, 300)}`);
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/绑定|pin|抗漂移/.test(btext)) throw new Error(`blockers 应点名 setNodeField 抗漂移绑定证不出，实际 ${btext.slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// happy 场景（实现评审 r5 修复轮新增，codex r4 MED「标题参数未按 Playwright 规则归一」）：
// G19a 回放 / G19b 编译。节点画布标题「模型节点」（干净），但事件 label/nodeName 带前后多空白
// 「  模型节点  」——Playwright getByText(exact) 同时归一查询文本与 DOM 文本，故合法命中；页内标题
// 判据若只归一 DOM 文本却与原始 lbl 直接比较（norm(node.textContent)===lbl），会把合法抽屉排出域
// （新增假阴、合法操作被误拒）。修法：norm(node.textContent)===norm(lbl) 两侧归一。红证（r4 raw 比较）
// = openNode 轮询/点后域内 count=0 → action_failed / blocker exit 65；绿证（norm 两侧）= unique + PASS。
{
  const s = await startFakeSut({ scenario: 'happy' });
  const WS_LABEL = '  ' + NODE + '  '; // 前后各两空白，Playwright exact 归一后等于「模型节点」
  const openNodeWsEvent = () => ({ stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: WS_LABEL, exact: true }, text: WS_LABEL });
  try {
    await checkAsync('G19a 回放·openNode+setNodeField label 前后空白归一（happy 正面）：DOM 标题「模型节点」干净、事件 label/nodeName 带前后空白「  模型节点  」→ openNode unique + setNodeField unique + identityReadback ok + verdict PASS（Playwright exact 两侧归一，页内判据须同归一 lbl 才不误拒）。验红：r4 页内只归一 DOM 却比原始 lbl → 域内 count=0 → openNode action_failed / setNodeField none 假阴必红', async () => {
      const caseId = 'tc_dlh_g19a';
      const { axes, verdict } = runReplayVerdict('g19a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openNodeWsEvent(), setFieldEvent(WS_LABEL)],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const axOpen = stepOf(axes, 'intent_2');
      if (!axOpen.action || axOpen.action.resolution !== 'unique') throw new Error(`openNode 带前后空白 label 应 unique（Playwright exact 两侧归一），实际 ${JSON.stringify(axOpen.action)}（假阴实锤：页内判据只归一 DOM 却比原始 lbl，合法抽屉被排出域）`);
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`setNodeField 带前后空白 nodeName 应 unique（合法抽屉入域、域内字段恰 1），实际 ${JSON.stringify(ax.action)}`);
      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true（字段 value 精确回读），实际 ${JSON.stringify(ax.action.identityReadback)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'PASS') throw new Error(`应 PASS（空白归一后合法形态不误拒），实际 ${v.verdict}/${v.reason}`);
    });

    await checkAsync('G19b 编译·openNode+setNodeField label 前后空白归一（happy 正面）：openNode 点后恰一过、setNodeField 域内唯一真填 → exit 0 + events 产出 + 零 blockers。验红：r4 页内 raw 比较致 openNode 点后域 count=0 → blocker exit 65 假阴必红', async () => {
      const wsFlow = [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: OPEN_NAME } },
        { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
        { atom: 'workflow.openNode', params: { label: WS_LABEL } },
        { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } },
      ];
      const { x, od } = compileFlowCase('g19b', 'tc_dlh_g19b', wsFlow, s.url);
      if (!x || x.status !== 0) throw new Error(`应 exit 0（前后空白 label 归一后合法形态照常编译产 events），实际 ${x && x.status}：${(x && x.stderr || '').slice(-300)}（假阴实锤：r4 页内 raw 比较致 openNode 点后域 count=0 blocker）`);
      if (!existsSync(join(od, 'events.json'))) throw new Error('应产出 events.json（合法编译全通）');
      const rep = readJson(join(od, 'compile-report.json'));
      if ((rep.blockers || []).length) throw new Error(`blockers 应为空，实际 ${JSON.stringify(rep.blockers).slice(0, 300)}`);
      if (!/节点字段已填入/.test(JSON.stringify(rep.notes || []))) throw new Error(`notes 应含「节点字段已填入」（合法真落笔），实际 ${JSON.stringify(rep.notes).slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

// ============================================================================================
// happy 场景（实现评审 r6 修复轮新增，codex r5 fail-open「纯空白 label 经 norm 成空 target」）：
// G20a 回放 / G20b 编译。openNode 的 label 为纯空白「   」——Playwright getByText(exact) 把纯空白查询
// 归一为空串，可命中画布空文本节点；且 r5 页内判据 target=norm('   ')='' 会让 norm(空 input.textContent)===''
// 成立、把空控件误当标题（假绿向）。openNode 两入口（回放 doOpenNode 仅 !label、编译 String(params.label||'')）
// 均无 trim 空门。修法：openNode 回放门与编译门统一拒 label.trim()===''（fail-closed），nodeDrawerDomain
// 对空 target 早返空数组防御。红证（r5）：纯空白 label 不被拒（openNode 非 action_failed / 编译非 blocker）；
// 绿证（r6）：openNode resolution action_failed + verdict NEEDS_HUMAN / 编译 blocker exit 65 零 events。
{
  const s = await startFakeSut({ scenario: 'happy' });
  const WS_ONLY = '   '; // 纯三空白，trim 后为空=非法标题
  const openWsOnlyEvent = () => ({ stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: WS_ONLY, exact: true }, text: WS_ONLY });
  try {
    await checkAsync('G20a 回放·openNode 纯空白 label fail-closed（happy，codex r5 fail-open）：label「   」trim 后空=非法标题 → resolution action_failed（绝不借空 target 命中画布/抽屉空文本节点假绿）+ verdict 恰 NEEDS_HUMAN。验红：r5 openNode 无 trim 空门、空 target 可命中空文本节点 → 非 action_failed（none/unique）必红', async () => {
      const caseId = 'tc_dlh_g20a';
      const { axes, verdict } = runReplayVerdict('g20a', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-14T00:00:00.000Z', authored: false,
        events: [...setupEvents(), openWsOnlyEvent()],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents().slice(0, 2), { intentId: 'intent_2', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_2');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`纯空白 label 应硬阻断 action_failed（trim 空=非法输入，绝不借空 target 命中空文本节点假绿），实际 ${JSON.stringify(ax.action)}（挂账假绿：r5 openNode 无 trim 空门）`);
      const v = stepOf(verdict, 'intent_2');
      if (v.verdict !== 'NEEDS_HUMAN') throw new Error(`应恰 NEEDS_HUMAN，实际 ${v.verdict}/${v.reason}`);
    });

    await checkAsync('G20b 编译·openNode 纯空白 label fail-closed（happy）：label「   」trim 空 → blocker exit 65 + 零 events + blocker 点名 openNode label 空白。验红：r5 编译门无 trim 空门、空 target 可命中空文本节点致 openNode 后置核验过 exit 0 产 events 必红', async () => {
      const wsFlow = [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: OPEN_NAME } },
        { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
        { atom: 'workflow.openNode', params: { label: WS_ONLY } },
      ];
      const { x, od } = compileFlowCase('g20b', 'tc_dlh_g20b', wsFlow, s.url);
      if (!x || x.status !== 65) throw new Error(`应 blocker exit 65（纯空白 label 非法，绝不借空 target 命中空文本节点），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}（挂账假绿：r5 编译门无 trim 空门）`);
      if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/空白|trim|空/.test(btext)) throw new Error(`blockers 应点名 openNode label 纯空白/trim 空，实际 ${btext.slice(0, 300)}`);
    });
  } finally { await s.close(); }
}

console.log(`drawer-lock-hardening golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
