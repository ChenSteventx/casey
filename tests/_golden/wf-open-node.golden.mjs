// wf-open-node.golden.mjs —— 画布节点配置抽屉原子（wf-open-node，light）端到端红金牌。
// 决策全录 docs/plans/wf-open-node/proposed/GRILL.md（D1 单击节点中心定案——registry 真机 SOP 为准、
// HANDOFF「双击」查无实证按笔误处理 / D3 复用 click 零冻结 / D4 按原子分发域锁门 / D5 抽屉双证回读 /
// D7 金牌形态）+ plan.md 验收 C1–C3。
// openNode 复用 events.action=click（零 schema 涟漪）：event = {atom:workflow.openNode, action:click,
// semantic:{kind:text,name:label,exact:true}}；回放门按 ev.atom 分发到 doOpenNode（.lf-canvas-overlay
// 域锁 + 域内唯一才点 + 抽屉可见含标题双证回读）——与全页统一身份门是两扇门：节点标题同时活在左面板
// .node-item 与画布 .lf-node-content，全页门必撞多匹配卡死合法回放（wf-add-node R1-F2 同型缝）。
//
// C1 openNode 可编译 + COMPILE_KNOWN_ATOMS 恰 25（智能体工具首纵切 +7）+ agent.selectModel 不可编译
//    （继任反例真缝，长寿）。
// C2 端到端开抽屉（fake-sut happy）：compile [nav, open, addNode, openNode] → events 末步是 openNode
//    的 click（semantic text label）→ 过 events.schema → blockers 空 + compile-report 含抽屉双证 →
//    draft(+patch)→sign→casey run→verdict 恰 4 intent 全 PASS。
//    【本金牌最大钉位】casey run 时 addNode 面板仍开着——页面上「模型节点」= 面板项 + 画布节点双在场，
//    全页统一身份门 count=2 必 ambiguous 拒点；唯域锁 doOpenNode（画布域 count=1）才 unique 开抽屉。
//    C2 全 PASS 即证回放走的是专用门（编译门=回放门按 ev.atom 分发，GRILL D4）。
//    计数通道单选（wf-connect-nodes learn #5 既定约束）：profile.countSelector='.hr-drawer__content-wrapper'
//    给 openNode intent 断 countChange up（抽屉 0→1）；addNode 用 textVisible、nav 用 urlPathname、
//    open 用 onPage——四 intent 都有硬断言防 INDETERMINATE、无人抢计数通道。
// C3 fail-closed 族：
//    a 编译面·节点缺席（未 addNode 即 openNode）→ 预检域锁 count=0 → blocker 点名证不出、硬阻断
//      exit 65、零 events、无谎报 acted（镜像 addNode 源身份门自证——customAct 通路不走 emit 定位核验）；
//    b 编译面·域内多匹配（addNode 同名两次落两同名 .lf-node）→ 预检 count=2 → blocker exit 65 绝不点；
//    c 回放面·节点缺席（手编 events）→ doOpenNode 缺席守卫优雅 none 不崩（waitFor 抛不得穿出，
//      codex R2-F1 先例）→ verdict 不 PASS；
//    d 回放面·域内多匹配（手编 events：同名两节点 + 面板开着）→ ambiguous 绝不点、candidateCount 恰 2
//      （域锁排除面板项——全页门会数出 3，此钉位区分两扇门）→ 抽屉不开（countChange 不 up）→ verdict 不 PASS。
//    e 回放面·开错抽屉（场景 drawersuperset：标题=label+副本，含子串非精确）→ 身份回读须精确、
//      拒认 action_failed（评审 F1：子串 hasText 会把「label副本」抽屉误判「开对了」——精确回读钉死）→ verdict 不 PASS。
//    f 回放面·点了抽屉不开（场景 drawernone 模拟 app 无响应）→ 等抽屉超时 action_failed（不假 unique）
//      → verdict 不 PASS。（原注「hermetic 造不出」由夹具反面模式证伪——评审 coverage 缺口兑现。）
//    编译面「点了不开」后置核验 blocker（compile-atoms.mjs:562）与 e/f 同源，但 compile 走 SPA go() 导航
//    不携 query 反面参、其孤立红证需真机——covered-by-symmetry + customAct waitFor 已 fail-closed，挂 route:human。
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const S = (p) => join(ROOT, 'tests', '_golden', 'schemas', p);
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-open-node-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-500)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CASE_ID = 'tc_wf_open_node';
const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读点开进详情=画布页）
const NODE = '模型节点'; // 面板前 4 真机实采名之一（抽屉族原子的典型宿主）
const NODE_X = 320, NODE_Y = 150;
const NODE_X2 = 520, NODE_Y2 = 230; // C3b/d 同名第二节点落点（显著分离，域内多匹配考场）

// 通道剖面（非凭据）：countSelector='.hr-drawer__content-wrapper' —— 端到端 verdict 的 countChange
// 计数通道对准节点配置抽屉（0→1 = 开抽屉身份回读的裁定面投影；见头注计数通道单选）。
const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);

// ── events.schema 结构校验器（无 ajv，与 seams-freeze / wf-connect-nodes 金牌同一 hermetic 习惯）──
const EV_SCHEMA = readJson(S('events.schema.json'));
const ACTION_ENUM = EV_SCHEMA.definitions.event.properties.action.enum;
function assertEventsDocAgainstSchema(doc) {
  if (doc.schemaVersion !== 2 || doc.channel !== 'web') throw new Error('events 信封违 schema（schemaVersion 须 2、channel 须 web）');
  if (doc.authored !== false) throw new Error('authored 须 false（LLM 编译产物须干净 v2 events）');
  const props = Object.keys(EV_SCHEMA.definitions.event.properties);
  for (const [i, e] of doc.events.entries()) {
    if (!e.stepId || !e.intentId || !e.action) throw new Error(`events[${i}] 缺 stepId/intentId/action`);
    if (!ACTION_ENUM.includes(e.action)) throw new Error(`events[${i}] action ${e.action} 不在 events.schema 枚举 ${JSON.stringify(ACTION_ENUM)}`);
    for (const k of Object.keys(e)) if (!props.includes(k)) throw new Error(`events[${i}] 字段 ${k} 不在 schema event properties（additionalProperties:false 纪律）`);
    if (['click', 'dblclick', 'fill', 'selectOption', 'dragTo'].includes(e.action)) {
      const stable = e.semantic || (e.role && e.accessibleName !== undefined) || e.text || e.fieldLabel || e.dropdownUnit;
      if (!stable) throw new Error(`events[${i}] (${e.action}) 纯坐标步——缺稳定定位字段（禁纯坐标步语义不变）`);
    }
  }
}

// ---------- C1 编译原子集加法 + 例翻反例 ----------
await checkAsync('C1 workflow.openNode 可编译、COMPILE_KNOWN_ATOMS 恰 25、agent.selectModel 不可编译', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.isCompilableAtom('workflow.openNode')) throw new Error('workflow.openNode 应可编译（抽屉族前置原子加法）');
  if (ca.COMPILE_KNOWN_ATOMS.size !== 25) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 25（智能体工具首纵切 +7），实际 ${ca.COMPILE_KNOWN_ATOMS.size}`);
  if (ca.isCompilableAtom('agent.selectModel')) throw new Error('agent.selectModel 不应可编译（下一条尚未迁移的智能体原子）');
});

// ---------- fake-sut happy：C2 端到端 + C3 编译/回放反面 ----------
const sut = await startFakeSut({ scenario: 'happy' });
try {
  const outDir = join(tmp, 'compile');
  const eventsFile = join(outDir, 'events.json');
  const observedFile = join(outDir, `observed-${CASE_ID}.json`);
  const reportFile = join(outDir, 'compile-report.json');

  const TESTCASE = writeJson(join(tmp, 'testcase.json'), {
    schemaVersion: 1, caseId: CASE_ID, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
    intents: [
      { intentId: 'intent_nav', text: '进入工作流管理列表' },
      { intentId: 'intent_open', text: `点开工作流 ${OPEN_NAME} 详情` },
      { intentId: 'intent_add', text: `往画布拖入「${NODE}」节点` },
      { intentId: 'intent_open_node', text: `单击「${NODE}」节点打开配置抽屉` },
    ],
  });
  const FLOW = writeJson(join(tmp, 'flow.json'), {
    id: CASE_ID, name: '画布开节点抽屉', category: 'normal',
    steps: [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } }, // 折进 open intent
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'assert.textVisible', params: { text: NODE } }, // 折进 addNode intent，硬断言防 INDETERMINATE
      { atom: 'workflow.openNode', params: { label: NODE } },
    ],
  });

  // ---------- C2 compile 全程 ----------
  await checkAsync('C2 compile 全程：events 末步 openNode click（semantic text label）、过 events.schema、blockers 空、compile-report 含抽屉双证', async () => {
    const g = run([CASEY, 'compile', CASE_ID, '--testcase', TESTCASE, '--flow', FLOW, '--out-dir', outDir]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const fd = readJson(join(outDir, `flow-${CASE_ID}.json`));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(outDir, `flow-${CASE_ID}.json`), fd);
    const x = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', TESTCASE, '--sut', sut.url, '--out-dir', outDir, '--profile', PROFILE, '--skip-login', '--unique-name', 'a1']);
    if (x.status !== 0) throw new Error(`execute 应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-400)}`);
    const ev = readJson(eventsFile);
    const seq = ev.events.map((e) => ({ intentId: e.intentId, action: e.action }));
    if (!deepEq(seq, [
      { intentId: 'intent_0', action: 'nav' },
      { intentId: 'intent_1', action: 'click' },   // workflow.open 点开进详情
      { intentId: 'intent_2', action: 'click' },   // addNode 条件步开面板
      { intentId: 'intent_2', action: 'dragTo' },  // addNode 落 .lf-node
      { intentId: 'intent_3', action: 'click' },   // openNode 单击节点中心（D1 定案）
    ])) throw new Error(`events 应恰 [nav(0),click(1),click(2 开面板),dragTo(2),click(3 开抽屉)]，实际 ${JSON.stringify(seq)}`);
    const open = ev.events[ev.events.length - 1];
    if (open.atom !== 'workflow.openNode') throw new Error(`末步 atom 应 workflow.openNode，实际 ${open.atom}`);
    if (open.action !== 'click') throw new Error(`末步 action 应 click（单击定案 GRILL D1，非 dblclick），实际 ${open.action}`);
    if (!open.semantic || open.semantic.kind !== 'text' || open.semantic.name !== NODE || open.semantic.exact !== true) throw new Error(`openNode 应经语义定位锚 label「${NODE}」exact，实际 ${JSON.stringify(open.semantic)}`);
    assertEventsDocAgainstSchema(ev);
    const rep = readJson(reportFile);
    if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    const repText = JSON.stringify(rep);
    if (!repText.includes('节点配置抽屉已开')) throw new Error(`compile-report 应含「节点配置抽屉已开」双证 notes（GRILL D5），实际尾段 ${repText.slice(-300)}`);
    const obs = readJson(observedFile);
    const last = obs.steps[obs.steps.length - 1];
    if (last.urlPathnameAfter !== '/ai-manager/process/detail') throw new Error(`尾步应仍在详情路由（开抽屉不换页），实际 ${last.urlPathnameAfter}`);
  });

  // ---------- C2 端到端裁定：draft(+patch)→sign→casey run→verdict 恰 4 intent 全 PASS ----------
  await checkAsync('C2 端到端：draft+patch(openNode countChange up 抽屉 0→1)→sign→casey run→verdict 恰 4 intent 全 PASS（域锁门钉位：面板开着全页门必 ambiguous）', async () => {
    const draftFile = join(outDir, `expected.draft-${CASE_ID}.json`);
    // patch：nav 补 urlPathname 硬断言；openNode 补 countChange up（profile.countSelector='.hr-drawer__content-wrapper'）。
    // open/addNode 的硬断言由 assert.onPage/assert.textVisible 折进（不抢抽屉计数通道，见头注）。
    const patch = writeJson(join(tmp, 'patch.json'), [
      { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' },
      { intentId: 'intent_3', kind: 'countChange', op: 'up', value: 1 },
    ]);
    const d = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', outDir, '--patch', patch]);
    if (d.status !== 0) throw new Error(`draft 应 exit 0，实际 ${d.status}：${(d.stderr || '').slice(-200)}`);
    if ((readJson(draftFile).pending || []).length) throw new Error('pending 应空（onPage/textVisible 已实现 kind、countChange 走 patch）');
    const prdFixture = writeJson(join(tmp, 'prd.json'), { schemaVersion: 2, caseId: CASE_ID, task: 'wf-open-node hermetic 夹具', testChecksums: {}, stories: [] });
    const frozen = join(outDir, 'expected.frozen.json');
    const s = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixture, '--frozen-out', frozen, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-07T00:00:00.000Z']);
    if (s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${s.status}：${(s.stderr || '').slice(-200)}`);
    const runDir = join(tmp, 'run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozen, '--profile', PROFILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-400)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s2) => s2.intentId).sort(), ['intent_0', 'intent_1', 'intent_2', 'intent_3'])) throw new Error(`verdict intent 集应恰 [intent_0..3]，实际 ${JSON.stringify(verdict.steps.map((s2) => s2.intentId))}`);
    const bad = verdict.steps.filter((s2) => s2.verdict !== 'PASS');
    if (bad.length) throw new Error(`应全 PASS（doOpenNode 域锁门真跑夹具 + 抽屉 countChange up），败者 ${JSON.stringify(bad.map((s2) => ({ intentId: s2.intentId, verdict: s2.verdict, reason: s2.reason })))}`);
    if (!existsSync(join(runDir, `${CASE_ID}.report.html`))) throw new Error('缺报告 html');
  });

  // ── 编译面反面公共助手：gate→confirm→execute，回 execute 结果与 out-dir ──
  function compileFlowCase(tag, caseId, steps) {
    const tc = writeJson(join(tmp, `tc-${tag}.json`), {
      schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
      intents: [{ intentId: 'intent_nav', text: '进列表' }, { intentId: 'intent_open', text: '开详情' }, { intentId: 'intent_body', text: '画布考场' }],
    });
    const flow = writeJson(join(tmp, `flow-${tag}.json`), { id: caseId, name: `考场 ${tag}`, category: 'normal', steps });
    const od = join(tmp, `compile-${tag}`);
    const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const fd = readJson(join(od, `flow-${caseId}.json`));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(od, `flow-${caseId}.json`), fd);
    const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sut.url, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag]);
    return { x, od };
  }

  // ---------- C3a 编译面·节点缺席 → 预检 blocker 硬阻断 exit 65 零 events ----------
  await checkAsync('C3a 编译面·节点画布缺席（未 addNode 即 openNode）：预检域锁 count=0 → blocker 点名证不出、exit 65、零 events、无谎报 acted', async () => {
    const { x, od } = compileFlowCase('c3a', 'tc_wf_opennode_c3a', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.openNode', params: { label: NODE } }, // 画布空、节点缺席
    ]);
    if (x.status !== 65) throw new Error(`节点缺席应硬阻断 exit 65（fail-closed），实际 ${x.status}：${(x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/画布域内 count=0/.test(btext)) throw new Error(`blockers 应点名 openNode 预检域锁 count=0（须其自身签名，非 box-null 兜底路径也含「证不出」——评审 coverage 隔离），实际 ${btext.slice(0, 300)}`);
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.openNode' && v.acted === true);
    if (lied) throw new Error('节点缺席仍 acted=true——身份门破（开不了照 fail-closed 落轴）');
  });

  // ---------- C3b 编译面·域内多匹配 → 预检 blocker 硬阻断 exit 65 绝不点 ----------
  await checkAsync('C3b 编译面·域内同名多匹配（addNode 同名两次）：预检域锁 count=2 → blocker exit 65 绝不点、零 events', async () => {
    const { x, od } = compileFlowCase('c3b', 'tc_wf_opennode_c3b', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X2, y: NODE_Y2 } }, // 同名第二节点
      { atom: 'workflow.openNode', params: { label: NODE } }, // 域内 count=2 歧义
    ]);
    if (x.status !== 65) throw new Error(`域内多匹配应硬阻断 exit 65（多匹配绝不点，统一身份门同律），实际 ${x.status}：${(x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/openNode/.test(btext) || !/count=2|非唯一|多匹配/.test(btext)) throw new Error(`blockers 应点名域内多匹配 count=2，实际 ${btext.slice(0, 300)}`);
  });

  // ── 回放面反面公共助手（p5-replay 形制）：手编 events + 已签 expected → bin/replay → bin/verdict ──
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

  // ---------- C3c 回放面·节点缺席 → doOpenNode 缺席守卫优雅 none 不崩 → verdict 不 PASS ----------
  await checkAsync('C3c 回放面·节点画布缺席：doOpenNode 缺席守卫优雅 none（不崩整轮回放）→ verdict 不 PASS', async () => {
    const caseId = 'tc_wf_opennode_c3c';
    const { axes, verdict } = runReplayVerdict('c3c', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        // 画布上无任何节点（未 addNode）→ 节点缺席 → 缺席守卫回 none（waitFor 抛不得穿出崩整轮）。
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const ax = stepOf(axes, 'intent_1');
    if (!ax.action || ax.action.resolution !== 'none') throw new Error(`节点缺席应优雅落 none（缺席守卫、不崩溃），实际 ${JSON.stringify(ax.action)}`);
    const v = stepOf(verdict, 'intent_1');
    if (v.verdict === 'PASS') throw new Error('节点缺席竟 PASS——假绿（抽屉未开必须不 PASS，护栏 #14）');
  });

  // ---------- C3d 回放面·域内多匹配 → ambiguous 绝不点 + candidateCount 恰 2（域锁钉位）→ verdict 不 PASS ----------
  await checkAsync('C3d 回放面·域内同名多匹配：doOpenNode ambiguous 绝不点、candidateCount 恰 2（域锁排除面板项——全页门会数 3）→ 抽屉不开 → verdict 不 PASS', async () => {
    const caseId = 'tc_wf_opennode_c3d';
    const { axes, verdict } = runReplayVerdict('c3d', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
        { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X, oy: NODE_Y },
        { stepId: 'atstep_3', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X2, oy: NODE_Y2 },
        // 面板开着 + 画布两同名节点：全页门会数 3（面板项+两节点）、域锁门数 2——candidateCount 钉位区分两扇门。
        { stepId: 'atstep_4', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
        { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const ax = stepOf(axes, 'intent_2');
    if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`域内多匹配应 ambiguous 绝不点，实际 ${JSON.stringify(ax.action)}`);
    if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2（域锁排除面板项；全页门=3 即门漂移），实际 ${ax.action.candidateCount}`);
    const v = stepOf(verdict, 'intent_2');
    if (v.verdict === 'PASS') throw new Error('域内多匹配竟 PASS——假绿（绝不点则抽屉必未开，护栏 #14）');
  });

  // ---------- C3e 回放面·开错抽屉（superset 标题含 label 子串非精确）→ 精确回读拒认 action_failed（评审 F1 红证）→ verdict 不 PASS ----------
  await checkAsync('C3e 回放面·开错抽屉（场景 drawersuperset：标题=label+副本）：身份回读须精确非子串——doOpenNode action_failed（点开了但不是这个节点的抽屉）→ verdict 不 PASS', async () => {
    const s = await startFakeSut({ scenario: 'drawersuperset' }); // 场景控抽屉标题=label+副本（replay nav 剥 query 不能用 URL）
    try {
      const caseId = 'tc_wf_opennode_c3e';
      const { axes, verdict } = runReplayVerdict('c3e', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
        events: [
          { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
          { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
          { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X, oy: NODE_Y },
          { stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE },
        ],
      }, {
        caseId, channel: 'web',
        intents: [
          { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
          { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
          { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
        ],
      });
      const ax = stepOf(axes, 'intent_2');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`开错抽屉（superset）应精确回读拒认 action_failed（子串 hasText 会假绿），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('开错抽屉竟 identityReadback ok:true——substring 假绿（护栏 #14）');
      const v = stepOf(verdict, 'intent_2');
      if (v.verdict === 'PASS') throw new Error('开错抽屉竟 PASS——substring 假绿（身份回读须精确，护栏 #14）');
    } finally { await s.close(); }
  });

  // ---------- C3f 回放面·点了抽屉不开（none 模拟 app 无响应）→ 等抽屉超时 action_failed（不假 unique）→ verdict 不 PASS ----------
  await checkAsync('C3f 回放面·点了抽屉不开（场景 drawernone）：doOpenNode 点了没开 → action_failed（不假 unique）→ verdict 不 PASS', async () => {
    const s = await startFakeSut({ scenario: 'drawernone' }); // 场景控单击节点不开抽屉
    try {
      const caseId = 'tc_wf_opennode_c3f';
      const { axes, verdict } = runReplayVerdict('c3f', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
        events: [
          { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
          { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
          { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X, oy: NODE_Y },
          { stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE },
        ],
      }, {
        caseId, channel: 'web',
        intents: [
          { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
          { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
          { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
        ],
      });
      const ax = stepOf(axes, 'intent_2');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`点了不开抽屉应 action_failed（等抽屉超时不假 unique），实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_2');
      if (v.verdict === 'PASS') throw new Error('点了不开抽屉竟 PASS——假 unique（护栏 #14）');
    } finally { await s.close(); }
  });
} finally {
  await sut.close();
}

console.log(`wf-open-node golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
