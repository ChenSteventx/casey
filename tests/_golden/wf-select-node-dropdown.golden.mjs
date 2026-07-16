// wf-select-node-dropdown.golden.mjs —— 画布节点抽屉下拉原子（wf-select-node-dropdown，light）端到端红金牌。
// 决策全录 docs/plans/wf-select-node-dropdown/proposed/GRILL.md（D1 交互形态 / D3 复用 click 零冻结的
// schema 铁证 / D4 按原子分发域锁门 + 域内 nth 消歧路 A / D5 触发器值精确回读 / D7 金牌形态）+ plan.md 验收 C1–C3f。
// selectNodeDropdown 复用 events.action=click（零 schema 涟漪，D3）：
// event = {atom:workflow.selectNodeDropdown, action:click, nth, text:option, semantic:{kind:text,name:请选择,exact:true}}。
// 回放门按 ev.atom 分发到 doSelectNodeDropdown（域锁 .hr-drawer__content-wrapper 内第 nth 个 .hr-select
// 触发器 + 限【可见浮层】.hr-select-option 作用域唯一才点 + 触发器值精确回读）——与通用 doSelect 是两扇门：
// 节点抽屉「请选择」触发器非 role=combobox-带名，全页 combobox 门必兜空/撞既有分类下拉（wf-add-node R1-F2
// 同型缝）。不走 selectOption：冻结 schema 的 allOf 强制 selectOption 带 dropdownUnit，而 dropdownUnit
// （additionalProperties:false、required fieldLabel/optionText/scope）无 nth 槽——走它要改冻结 schema。
//
// C1 selectNodeDropdown 可编译 + COMPILE_KNOWN_ATOMS 恰 18（setNodeField +1）+ agent.openToolPicker
//    不可编译（继任反例真缝，长寿——agent_tool 维度整体压后）。
// C2 端到端开抽屉选下拉（fake-sut happy）：compile [nav, open, addNode, openNode, selectNodeDropdown(option)]
//    → events 末步是 selectNodeDropdown 的 click（nth:0 / text:OPT / semantic text 请选择）→ 过 events.schema
//    → blockers 空 + compile-report 含触发器值回读证据 → draft(+patch)→sign→casey run→verdict 恰 5 intent
//    全 PASS。ddtwin 钉位（C2-c）：抽屉两「请选择」+ 目标选项两浮层各现一次——非域锁/全页门必 ambiguous
//    （getByText 请选择 count=2、全页 .hr-select-option OPT count=2），唯 nth 域锁 + 可见浮层作用域
//    doSelectNodeDropdown（域内 count=1）才 unique 选中（证回放走专用门、编译门=回放门按 ev.atom 分发，D4）。
//    计数通道单选（wf-connect-nodes learn #5）：profile.countSelector='.hr-drawer__content-wrapper' 给
//    openNode intent 断 countChange up（抽屉 0→1）；selectNodeDropdown intent 用 textVisible(OPT)——不抢抽屉
//    计数通道（抽屉此时已开、不再变），每 intent 各一硬断言防 INDETERMINATE。
// C3 fail-closed 族（编译面预检 blocker + 回放面身份门三态）：
//    a 编译面·抽屉未开/无下拉（未 openNode 即 selectNodeDropdown）→ 预检域锁触发器 count=0 → blocker
//      点名证不出、exit 65、零 events、无谎报 acted（customAct 通路不走 emit 定位核验、自证）；
//    b 编译面·nth 越界（抽屉 1 下拉、nth=1）→ 预检 nth ≥ count → blocker exit 65 绝不点；
//    c 回放面·抽屉未开（手编 events）→ doSelectNodeDropdown 缺席守卫优雅 none 不崩 → verdict 不 PASS；
//    d 回放面·选项多匹配（ddmulti）→ 可见浮层内目标选项 count=2 → ambiguous 绝不点、candidateCount 恰 2、
//      触发器值不变 → verdict 不 PASS；
//    e 回放面·选错项/写错值（ddwrong：触发器值更成含子串非精确的「OPT副本」）→ 精确回读拒认 action_failed
//      （子串 hasText 会把「OPT副本」误判选对——openNode F1 精确回读同律）→ verdict 不 PASS；
//    f 回放面·目标缺席（ddabsent：浮层不含 OPT）→ action_failed（不假 unique）→ verdict 不 PASS。
//    编译面「选了但没选中」后置回读 blocker 与 e/f 同源，但 compile 走 SPA go() 不携反面参、其孤立红证需
//    真机——covered-by-symmetry（回放 e/f）+ customAct 回读 fail-closed，挂 route:human。
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
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-select-node-dropdown-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-500)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CASE_ID = 'tc_wf_select_node_dropdown';
const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读点开进详情=画布页，沿用 openNode）
const NODE = '模型节点'; // 面板前 4 真机实采名之一（抽屉族原子的典型宿主）
const NODE_X = 320, NODE_Y = 150;
const OPT = '订单库'; // 目标选项（fixture happy 下拉既有项，子串匹配点、精确回读）

// 通道剖面（非凭据）：countSelector='.hr-drawer__content-wrapper' —— 沿用 openNode（抽屉 0→1 归 openNode
// intent）；selectNodeDropdown intent 不抢 countChange 通道、改用 textVisible(OPT) 硬断言。
const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);

// ── events.schema 结构校验器（无 ajv，与 seams-freeze / wf-open-node 金牌同一 hermetic 习惯）──
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
    if (e.nth !== undefined && (!Number.isInteger(e.nth) || e.nth < 0)) throw new Error(`events[${i}] nth 须 integer≥0（schema），实际 ${e.nth}`);
  }
}

// ---------- C1 编译原子集加法 + 例翻反例 ----------
await checkAsync('C1 workflow.selectNodeDropdown 可编译、COMPILE_KNOWN_ATOMS 恰 18、agent.openToolPicker 不可编译', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.isCompilableAtom('workflow.selectNodeDropdown')) throw new Error('workflow.selectNodeDropdown 应可编译（抽屉族第二原子加法）');
  if (ca.COMPILE_KNOWN_ATOMS.size !== 18) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 18（setNodeField +1），实际 ${ca.COMPILE_KNOWN_ATOMS.size}`);
  if (ca.isCompilableAtom('agent.openToolPicker')) throw new Error('agent.openToolPicker 不应可编译（继任反例真缝——agent_tool 维度整体压后、长寿反例）');
  if (ca.isCompilableAtom('nonsense.x')) throw new Error('nonsense.x 不应可编译');
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
      { intentId: 'intent_select', text: `在节点抽屉里选下拉项「${OPT}」` },
    ],
  });
  const FLOW = writeJson(join(tmp, 'flow.json'), {
    id: CASE_ID, name: '画布节点抽屉选下拉', category: 'normal',
    steps: [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } }, // 折进 open intent
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'assert.textVisible', params: { text: NODE } }, // 折进 addNode intent，硬断言防 INDETERMINATE
      { atom: 'workflow.openNode', params: { label: NODE } },
      { atom: 'workflow.selectNodeDropdown', params: { option: OPT } },
      { atom: 'assert.textVisible', params: { text: OPT } }, // 折进 selectNodeDropdown intent，硬断言防 INDETERMINATE
    ],
  });

  // ---------- C2-a compile 全程 ----------
  await checkAsync('C2-a compile 全程：events 末步 selectNodeDropdown click（nth:0/text:OPT/semantic text 请选择）、过 events.schema、blockers 空、compile-report 含触发器值回读证据', async () => {
    const g = run([CASEY, 'compile', CASE_ID, '--testcase', TESTCASE, '--flow', FLOW, '--out-dir', outDir]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const fd = readJson(join(outDir, `flow-${CASE_ID}.json`));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-09T00:00:00.000Z';
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
      { intentId: 'intent_3', action: 'click' },   // openNode 单击节点中心
      { intentId: 'intent_4', action: 'click' },   // selectNodeDropdown 点触发器 + 选项（内聚 customAct）
    ])) throw new Error(`events 应恰 [nav(0),click(1),click(2 开面板),dragTo(2),click(3 开抽屉),click(4 选下拉)]，实际 ${JSON.stringify(seq)}`);
    const sel = ev.events[ev.events.length - 1];
    if (sel.atom !== 'workflow.selectNodeDropdown') throw new Error(`末步 atom 应 workflow.selectNodeDropdown，实际 ${sel.atom}`);
    if (sel.action !== 'click') throw new Error(`末步 action 应 click（复用 click 零冻结 D3，非 selectOption），实际 ${sel.action}`);
    if (sel.nth !== 0) throw new Error(`selectNodeDropdown nth 应 0（缺省单下拉），实际 ${sel.nth}`);
    if (sel.text !== OPT) throw new Error(`selectNodeDropdown text 应载 option「${OPT}」，实际 ${sel.text}`);
    if (!sel.semantic || sel.semantic.kind !== 'text' || sel.semantic.name !== '请选择' || sel.semantic.exact !== true) throw new Error(`selectNodeDropdown 应经语义锚触发器「请选择」exact，实际 ${JSON.stringify(sel.semantic)}`);
    if (sel.dropdownUnit !== undefined) throw new Error('selectNodeDropdown 不得带 dropdownUnit（走 click 非 selectOption，零冻结 schema）');
    if (sel.nodeName !== NODE) throw new Error(`selectNodeDropdown 编译产物应带 nodeName「${NODE}」（drawer-lock-hardening D3 供给通道，编译期 run 态 openNode 成功后写入），实际 ${sel.nodeName}`);
    assertEventsDocAgainstSchema(ev);
    const rep = readJson(reportFile);
    if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    const repText = JSON.stringify(rep);
    if (!repText.includes('节点下拉已选中')) throw new Error(`compile-report 应含「节点下拉已选中」触发器回读证据 notes（GRILL D5），实际尾段 ${repText.slice(-300)}`);
    const obs = readJson(observedFile);
    const last = obs.steps[obs.steps.length - 1];
    if (last.urlPathnameAfter !== '/ai-manager/process/detail') throw new Error(`尾步应仍在详情路由（选下拉不换页），实际 ${last.urlPathnameAfter}`);
  });

  // ---------- C2-b 端到端裁定：draft(+patch)→sign→casey run→verdict 恰 5 intent 全 PASS ----------
  await checkAsync('C2-b 端到端：draft+patch(nav urlPathname + openNode countChange up 抽屉 0→1)→sign→casey run→verdict 恰 5 intent 全 PASS', async () => {
    const draftFile = join(outDir, `expected.draft-${CASE_ID}.json`);
    // patch：nav 补 urlPathname；openNode 补 countChange up（抽屉 0→1）。
    // open/addNode/selectNodeDropdown 的硬断言由 assert.onPage/assert.textVisible 折进（不抢抽屉计数通道）。
    const patch = writeJson(join(tmp, 'patch.json'), [
      { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' },
      { intentId: 'intent_3', kind: 'countChange', op: 'up', value: 1 },
    ]);
    const d = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', outDir, '--patch', patch]);
    if (d.status !== 0) throw new Error(`draft 应 exit 0，实际 ${d.status}：${(d.stderr || '').slice(-200)}`);
    if ((readJson(draftFile).pending || []).length) throw new Error('pending 应空（onPage/textVisible 已实现 kind、countChange 走 patch）');
    const prdFixture = writeJson(join(tmp, 'prd.json'), { schemaVersion: 2, caseId: CASE_ID, task: 'wf-select-node-dropdown hermetic 夹具', testChecksums: {}, stories: [] });
    const frozen = join(outDir, 'expected.frozen.json');
    const s = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixture, '--frozen-out', frozen, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-09T00:00:00.000Z']);
    if (s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${s.status}：${(s.stderr || '').slice(-200)}`);
    const runDir = join(tmp, 'run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozen, '--profile', PROFILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-400)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s2) => s2.intentId).sort(), ['intent_0', 'intent_1', 'intent_2', 'intent_3', 'intent_4'])) throw new Error(`verdict intent 集应恰 [intent_0..4]，实际 ${JSON.stringify(verdict.steps.map((s2) => s2.intentId))}`);
    const bad = verdict.steps.filter((s2) => s2.verdict !== 'PASS');
    if (bad.length) throw new Error(`应全 PASS（doSelectNodeDropdown 域锁门真跑夹具 + 触发器精确回读），败者 ${JSON.stringify(bad.map((s2) => ({ intentId: s2.intentId, verdict: s2.verdict, reason: s2.reason })))}`);
    if (!existsSync(join(runDir, `${CASE_ID}.report.html`))) throw new Error('缺报告 html');
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
  // 抽屉族回放 setup 事件（nav→addNode 开面板+落节点→openNode 开抽屉），末步留给各考场追加 selectNodeDropdown。
  const setupEvents = () => ([
    { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
    { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE, nodeName: NODE, ox: NODE_X, oy: NODE_Y },
    { stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: NODE, exact: true }, text: NODE },
  ]);
  const setupIntents = () => ([
    { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
    { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: NODE }] },
    { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
  ]);

  // ---------- C2-c ddtwin 钉位：抽屉两「请选择」+ 目标选项两浮层各现一次 → 唯 nth 域锁 + 可见浮层作用域 unique ----------
  await checkAsync('C2-c ddtwin 钉位：抽屉两「请选择」触发器 + 目标选项两浮层各现一次——非域锁/全页门必 ambiguous（getByText 请选择=2、全页 .hr-select-option OPT=2），唯 doSelectNodeDropdown（nth 域锁 + 可见浮层 count=1）unique 选中 → verdict PASS', async () => {
    const s = await startFakeSut({ scenario: 'ddtwin' });
    try {
      const caseId = 'tc_wf_seldd_ddtwin';
      const { axes, verdict } = runReplayVerdict('ddtwin', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`ddtwin 应 unique（nth 域锁 + 可见浮层作用域；非域锁门 getByText 请选择=2/全页 option=2 必 ambiguous），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 1) throw new Error(`candidateCount 应恰 1（可见浮层内 OPT 唯一；全页非域锁门=2 即门漂移），实际 ${ax.action.candidateCount}`);
      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`ddtwin 应 identityReadback ok:true（触发器值精确含 OPT），实际 ${JSON.stringify(ax.action.identityReadback)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'PASS') throw new Error(`ddtwin selectNodeDropdown 应 PASS（域锁门真选中），实际 ${v.verdict}/${v.reason}`);
    } finally { await s.close(); }
  });

  // ── 编译面反面公共助手：gate→confirm→execute，回 gate/execute 结果与 out-dir。
  //    sutUrl 缺省 = 共享 happy 实例；反面 execute 预检考场（ddempty 等）传各自场景 sut。──
  function compileFlowCase(tag, caseId, steps, sutUrl = sut.url) {
    const tc = writeJson(join(tmp, `tc-${tag}.json`), {
      schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
      intents: [{ intentId: 'intent_nav', text: '进列表' }, { intentId: 'intent_open', text: '开详情' }, { intentId: 'intent_body', text: '画布考场' }],
    });
    const flow = writeJson(join(tmp, `flow-${tag}.json`), { id: caseId, name: `考场 ${tag}`, category: 'normal', steps });
    const od = join(tmp, `compile-${tag}`);
    const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
    if (g.status !== 0) return { g, x: null, od }; // gate 段红（如 registry 前置未满足）→ 回 gate 结果，不进 execute
    const fd = readJson(join(od, `flow-${caseId}.json`));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-09T00:00:00.000Z';
    writeJson(join(od, `flow-${caseId}.json`), fd);
    const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sutUrl, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag]);
    return { g, x, od };
  }

  // ---------- C3a 编译面·抽屉未开（gate 段 registry 前置）+ 无下拉（execute 预检 count=0）双证 ----------
  // 注：registry（lib/atoms-registry.snapshot.json:319）已声明 selectNodeDropdown requires:[节点抽屉已开]，
  // 「未 openNode」被 flow gate 段前置门先截（真接缝，非 execute 预检）；execute 预检域锁触发器 count=0 的
  // 「无下拉」半边由 ddempty 场景（openNode 开抽屉但抽屉无下拉，registry 前置满足）触达——两半各钉自身签名。
  await checkAsync('C3a 编译面·抽屉未开/无下拉 fail-closed 双证：①未 openNode → flow gate 前置门截（需节点抽屉已开）exit 65 零 events；②openNode 开抽屉但无下拉（ddempty）→ execute 预检域锁触发器 count=0 → blocker exit 65 零 events 无谎报 acted', async () => {
    // ① 未 openNode：flow gate 段 registry 前置门截（节点抽屉已开无提供者）。
    const { g, x, od } = compileFlowCase('c3a1', 'tc_wf_seldd_c3a1', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.selectNodeDropdown', params: { option: OPT } }, // 前序无 openNode → 前置未满足
    ]);
    if (x !== null) throw new Error('未 openNode 不应过 gate 段（registry 前置节点抽屉已开无提供者）');
    if (g.status !== 65) throw new Error(`未 openNode 应 gate 段前置门截 exit 65（fail-closed），实际 ${g.status}：${(g.stderr || '').slice(-260)}`);
    if (!/节点抽屉已开|selectNodeDropdown/.test((g.stderr || '') + (g.stdout || ''))) throw new Error(`gate 段应点名前置「节点抽屉已开」缺提供者，实际 ${((g.stderr || '') + (g.stdout || '')).slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('gate 段前置截不得产 events');

    // ② 无下拉（ddempty）：openNode 开抽屉（前置满足）但抽屉无 .hr-select → execute 预检域锁 count=0。
    const s = await startFakeSut({ scenario: 'ddempty' });
    try {
      const r = compileFlowCase('c3a2', 'tc_wf_seldd_c3a2', [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: OPEN_NAME } },
        { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
        { atom: 'workflow.openNode', params: { label: NODE } },
        { atom: 'workflow.selectNodeDropdown', params: { option: OPT } }, // 抽屉开但无下拉 → 域内 count=0
      ], s.url);
      if (!r.x || r.x.status !== 65) throw new Error(`无下拉应 execute 预检 count=0 硬阻断 exit 65，实际 ${r.x && r.x.status}：${(r.x && r.x.stderr || '').slice(-260)}`);
      if (existsSync(join(r.od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(r.od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 selectNodeDropdown 预检域锁触发器 count=0（其自身签名，评审 coverage 隔离），实际 ${btext.slice(0, 300)}`);
      const lied = (rep.verification || []).some((v) => v.atom === 'workflow.selectNodeDropdown' && v.acted === true);
      if (lied) throw new Error('触发器缺席仍 acted=true——身份门破（选不了照 fail-closed 落轴）');
    } finally { await s.close(); }
  });

  // ---------- C3b 编译面·nth 越界 → 预检 blocker 硬阻断 exit 65 绝不点 ----------
  await checkAsync('C3b 编译面·nth 越界（抽屉 1 下拉、nth=1）：预检 nth ≥ count → blocker exit 65 绝不点、零 events', async () => {
    const { x, od } = compileFlowCase('c3b', 'tc_wf_seldd_c3b', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'workflow.openNode', params: { label: NODE } },
      { atom: 'workflow.selectNodeDropdown', params: { option: OPT, nth: 1 } }, // 抽屉 1 下拉、nth=1 越界
    ]);
    if (!x || x.status !== 65) throw new Error(`nth 越界应硬阻断 exit 65（绝不点），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/越界|nth=1/.test(btext)) throw new Error(`blockers 应点名 nth 越界，实际 ${btext.slice(0, 300)}`);
  });

  // ---------- C3c 回放面·抽屉未开 → doSelectNodeDropdown 缺席守卫优雅 none 不崩 → verdict 不 PASS ----------
  await checkAsync('C3c 回放面·抽屉未开（手编 events 无 addNode/openNode）：doSelectNodeDropdown 缺席守卫优雅 none（不崩整轮回放）→ verdict 不 PASS', async () => {
    const caseId = 'tc_wf_seldd_c3c';
    const { axes, verdict } = runReplayVerdict('c3c', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        // 抽屉未开（未 addNode/openNode）→ 触发器缺席 → 缺席守卫回 none（waitFor 抛不得穿出崩整轮）。
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] },
      ],
    });
    const ax = stepOf(axes, 'intent_1');
    if (!ax.action || ax.action.resolution !== 'none') throw new Error(`抽屉未开应优雅落 none（缺席守卫、不崩溃），实际 ${JSON.stringify(ax.action)}`);
    const v = stepOf(verdict, 'intent_1');
    if (v.verdict === 'PASS') throw new Error('抽屉未开竟 PASS——假绿（触发器缺席必须不 PASS，护栏 #14）');
  });

  // ---------- C3d 回放面·选项多匹配（ddmulti）→ ambiguous 绝不点 + candidateCount 恰 2 → verdict 不 PASS ----------
  await checkAsync('C3d 回放面·选项多匹配（ddmulti：目标选项浮层内出现两次）：doSelectNodeDropdown ambiguous 绝不点、candidateCount 恰 2、触发器值不变 → verdict 不 PASS', async () => {
    const s = await startFakeSut({ scenario: 'ddmulti' });
    try {
      const caseId = 'tc_wf_seldd_c3d';
      const { axes, verdict } = runReplayVerdict('c3d', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`选项多匹配应 ambiguous 绝不点，实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2（可见浮层内目标选项两处），实际 ${ax.action.candidateCount}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict === 'PASS') throw new Error('选项多匹配竟 PASS——假绿（绝不点则触发器值必不变，护栏 #14）');
    } finally { await s.close(); }
  });

  // ---------- C3e 回放面·选错项/写错值（ddwrong）→ 精确回读拒认 action_failed → verdict 不 PASS ----------
  await checkAsync('C3e 回放面·选错项/写错值（ddwrong：触发器值更成含子串非精确的「OPT副本」）：身份回读须精确非子串——doSelectNodeDropdown action_failed（点了但没选对）→ verdict 不 PASS', async () => {
    const s = await startFakeSut({ scenario: 'ddwrong' });
    try {
      const caseId = 'tc_wf_seldd_c3e';
      const { axes, verdict } = runReplayVerdict('c3e', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`选错项/写错值应精确回读拒认 action_failed（子串 hasText 会把「OPT副本」误判选对），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('选错项竟 identityReadback ok:true——substring 假绿（护栏 #14）');
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict === 'PASS') throw new Error('选错项竟 PASS——substring 假绿（身份回读须精确，护栏 #14）');
    } finally { await s.close(); }
  });

  // ---------- C3f 回放面·目标缺席（ddabsent）→ action_failed（不假 unique）→ verdict 不 PASS ----------
  await checkAsync('C3f 回放面·目标缺席（ddabsent：浮层不含 OPT）：doSelectNodeDropdown 可见浮层内 OPT count=0 → action_failed（不假 unique）→ verdict 不 PASS', async () => {
    const s = await startFakeSut({ scenario: 'ddabsent' });
    try {
      const caseId = 'tc_wf_seldd_c3f';
      const { axes, verdict } = runReplayVerdict('c3f', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: OPT, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
      }, {
        caseId, channel: 'web',
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`目标缺席应 action_failed（不假 unique），实际 ${JSON.stringify(ax.action)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict === 'PASS') throw new Error('目标缺席竟 PASS——假 unique（护栏 #14）');
    } finally { await s.close(); }
  });

  // ---------- C3g 回放面·缺 option 多选项浮层（happy 3 项 + 事件不给 option）→ 绝不点首项、ambiguous（fail-safe 不 fail-open）----------
  // codex 跨族异构评审 confirmed HIGH fail-safe（gate 曾绿漏）：doSelectNodeDropdown 当 option 缺失/未指定时，
  // 多选项浮层里误点「首个可见选项」还返 unique = 假绿（fail-open 成 PASS），违铁律「fail-safe 不 fail-open」+
  // 点击身份门 ADR-0007。红先行反例：happy 抽屉下拉 3 项（订单库/用户库/日志库）+ 末步 selectNodeDropdown 事件
  // 不载 text（缺 option）——修前误返 unique（点了首项）→ verdict 假绿 PASS；修后：多选项浮层无 option 一律
  // ambiguous 绝不点任何项、candidateCount 恰 3 → 触发器值不变、verdict 不 PASS（本分支裁判 ap=false 兜底落
  // NEEDS_HUMAN 仍 fail-safe；resolution 契约合并后升级为精确 AMBIGUOUS_ACTION）。仅浮层恰一项、或 option 域内
  // 唯一命中才 unique 点选（C2-c/C3d 已钉两端）。
  await checkAsync('C3g 回放面·缺 option 多选项浮层（happy 3 项 + 事件不给 option）：doSelectNodeDropdown 绝不点首项、ambiguous、candidateCount 恰 3、不点任何项 → verdict 不 PASS（修前误返 unique 假绿=fail-open 红证）', async () => {
    const caseId = 'tc_wf_seldd_c3g';
    const { axes, verdict } = runReplayVerdict('c3g', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      // 末步不载 text（缺 option）：多选项浮层里没给 option。修前误点首项返 unique（假绿），修后 ambiguous 绝不点。
      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: NODE }],
    }, {
      caseId, channel: 'web',
      intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: OPT }] }],
    });
    const ax = stepOf(axes, 'intent_3');
    if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`缺 option 多选项浮层应 ambiguous 绝不点首项（修前误返 unique=fail-open 假绿），实际 ${JSON.stringify(ax.action)}`);
    if (ax.action.candidateCount !== 3) throw new Error(`candidateCount 应恰 3（happy 可见浮层 3 项：订单库/用户库/日志库），实际 ${ax.action.candidateCount}`);
    if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('缺 option 多选项竟 identityReadback ok:true——点了首项假绿（护栏 #14）');
    const v = stepOf(verdict, 'intent_3');
    if (v.verdict === 'PASS') throw new Error('缺 option 多选项浮层竟 PASS——fail-open 假绿（多选项无 option 必不点，护栏 #14/ADR-0007）');
  });
} finally {
  await sut.close();
}

console.log(`wf-select-node-dropdown golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
