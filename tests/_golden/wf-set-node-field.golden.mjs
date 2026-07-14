// wf-set-node-field.golden.mjs —— 画布节点抽屉可填字段原子（wf-set-node-field，light）端到端红金牌。
// 决策全录 docs/plans/wf-set-node-field/proposed/GRILL.md（D1 交互形态 / D3 复用 fill 零冻结的 schema 铁证 /
// D4 按原子分发域锁门 + 字段级唯一闸 / D5 填后精确 value 回读 / D7 金牌形态）+ plan.md 验收 C1–C3e。
// setNodeField 复用 events.action=fill（零 schema 涟漪，D3）：
// event = {atom:workflow.setNodeField, action:fill, value, semantic:{kind:label,name:placeholder,exact}}。
// 回放门按 ev.atom 分发到 doSetNodeField（域锁 .hr-drawer__content-wrapper 内 getByPlaceholder + 字段级
// 唯一闸唯一/显式 nth 消歧才填 + 填后 inputValue() 精确等于填入值）——与通用 doAct 是两扇门：占位符锚不是
// semanticLocator 的 label/text/role 命中口径，通用门必兜空/撞别处同名。冻结 schema 的 allOf 对 fill 只要求
// value；semantic 满足交互动作 anyOf——零冻结 schema 改动。
//
// value 非文本节点（registry :339 assertNodeFieldValue 亲述：assert.textVisible 看不到 input 的 value 属性）：
// 本金牌不用 textVisible 断填值——填值正确性由门内精确 value 回读（doSetNodeField 吐 identityReadback.ok）
// 确定性守住，金牌按动作轴核（identityReadback.ok===true + resolution unique，镜像 selectNodeDropdown ddtwin）；
// 端到端 verdict 的 setNodeField intent 每-intent 硬断言由全局取证（noPageError/noErrorEnvelope）兜底：
// PASS = 动作轴 ap（门内 value 精确回读成立）+ 全局取证无错；填错/半填 → 门 action_failed → ap=false → 绝不
// PASS（护栏 #14）。判内核纯编译/回放：不新增断言 kind、不碰 bin/verdict.mjs、不碰 bin/replay.mjs 采集通道
// （L1 断言 workflow.assertNodeFieldValue = 另契约，读 value 属性的独立 kind + 采集通道）。
//
// C1 setNodeField 可编译 + COMPILE_KNOWN_ATOMS 恰 18（setNodeField +1）+ agent.openToolPicker 不可编译（长寿反例）。
// C2 端到端开抽屉填字段（fake-sut happy）：compile [nav, open, addNode, openNode, setNodeField(placeholder,value)]
//    → events 末步是 setNodeField 的 fill（value / semantic label placeholder / 无 nth）→ 过 events.schema →
//    blockers 空 + compile-report 含字段回读证据 → draft(+patch)→sign→casey run→verdict 恰 5 intent 全 PASS。
//    setclash 钉位（C2-c）：详情页抽屉外再挂一个同占位符 input → 全页 getByPlaceholder count=2 必 ambiguous，
//    唯 doSetNodeField（域锁 .hr-drawer__content-wrapper 内 count=1）才 unique 填入（证回放走专用域锁门、
//    编译门=回放门同刻，D4）+ 动作轴 identityReadback ok（门内 value 精确回读 = 断言字段 value 含期望）。
//    计数通道单选：profile.countSelector='.hr-drawer__content-wrapper' 给 openNode intent 断 countChange up
//    （抽屉 0→1）；setNodeField intent 不抢抽屉计数通道、不用 value 看不到的 textVisible。
// C3 fail-closed 族（编译面预检 blocker + 回放面身份门三态）：
//    a 编译面·抽屉未开/无字段双证：①未 openNode → flow gate 前置门截（节点抽屉已开无提供者）exit 65 零 events；
//      ②openNode 开抽屉但无字段（ddempty）→ execute 预检域锁 getByPlaceholder count=0 → blocker exit 65 无谎报 acted；
//    b 编译面·多匹配未给 nth（setmulti：两同占位符字段）→ 预检 count>1 且无 nth → blocker exit 65 绝不填首项；
//    c 编译面·nth 越界（抽屉 1 字段、nth=1）→ 预检 nth≥count → blocker exit 65；
//    d 回放面·抽屉未开（手编 events）→ doSetNodeField 缺席守卫优雅 none 不崩 → verdict 不 PASS；
//    e 回放面·多匹配未给 nth（setmulti）→ 域内 count=2 → ambiguous 绝不填首项、candidateCount 恰 2 +
//      candidateValues 两格实读必空（证「字段值不变」非空话，codex-sol MED ①）→ verdict 不 PASS（fail-open 红证）。
//    f 编译面·非法 nth（happy 单字段、flow nth:-1 在场但非非负整数）→ 预检 blocker exit 65 绝不降级 index 0
//      （HIGH fix：修前 hasNth=Number.isInteger&&≥0?nth:0 静默 coerce 0 单匹配填入 exit 0=fail-open 红证）；
//    g 回放面·非法 nth（happy 单字段、事件 nth:-1）→ doSetNodeField action_failed 绝不降级 index 0 填首项
//      （HIGH fix 回放侧对称门；修前 coerce 0 单匹配真填入返 unique 假绿红证）；
//    h 回放面·精确回读律钉桩（setsuffix：字段追加尾巴→填后 value=want 超集）→ 精确门 got!==want action_failed 拒认
//      （codex-sol MED ②：若回读退成 includes(want) 会误判填对返 unique → 本考场 verdict 转 PASS 使断言红，钉精确回读律）。
//    编译面「填了但没填对」后置回读 blocker 与门内精确回读同源，但 compile 走 SPA go() 不携反面参、其孤立红证需
//    真机——covered-by-symmetry（回放门精确回读）+ customAct 回读 fail-closed，挂 route:human。
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
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-set-node-field-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-500)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CASE_ID = 'tc_wf_set_node_field';
const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读点开进详情=画布页，沿用 openNode/dropdown）
const NODE = 'HTTP请求'; // fake-sut NODE_TYPES 内；registry「请输入接口的URL」= HTTP 节点 URL 字段的宿主
const NODE_X = 320, NODE_Y = 150;
const PLACEHOLDER = '请输入接口的URL'; // registry :252 setNodeField 占位符例
const VALUE = 'https://api.example.com/notify'; // 填入值（回读精确等于；非 atl_/非 9 位数字长串）

// 通道剖面（非凭据）：countSelector='.hr-drawer__content-wrapper' —— 沿用 openNode（抽屉 0→1 归 openNode
// intent）；setNodeField intent 不抢 countChange 通道、也不用 value 看不到的 textVisible（PASS 由动作轴 ap +
// 全局取证 noPageError/noErrorEnvelope 得出）。
const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);

// ── events.schema 结构校验器（无 ajv，与 seams-freeze / wf-select-node-dropdown 金牌同一 hermetic 习惯）──
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
    if (e.action === 'fill' && typeof e.value !== 'string') throw new Error(`events[${i}] fill 须带 value（events.schema allOf）`);
    if (e.nth !== undefined && (!Number.isInteger(e.nth) || e.nth < 0)) throw new Error(`events[${i}] nth 须 integer≥0（schema），实际 ${e.nth}`);
  }
}

// ---------- C1 编译原子集加法 + 例翻反例 ----------
await checkAsync('C1 workflow.setNodeField 可编译、COMPILE_KNOWN_ATOMS 恰 18、agent.openToolPicker 不可编译', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.isCompilableAtom('workflow.setNodeField')) throw new Error('workflow.setNodeField 应可编译（抽屉族第三原子加法）');
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
      { intentId: 'intent_set', text: `在节点抽屉里给字段「${PLACEHOLDER}」填值` },
    ],
  });
  const FLOW = writeJson(join(tmp, 'flow.json'), {
    id: CASE_ID, name: '画布节点抽屉填字段', category: 'normal',
    steps: [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } }, // 折进 open intent
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'assert.textVisible', params: { text: NODE } }, // 折进 addNode intent，硬断言防 INDETERMINATE
      { atom: 'workflow.openNode', params: { label: NODE } },
      { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } },
      // setNodeField intent 不折 assert.*：value 非文本节点、不硬凑 textVisible；其 PASS 由动作轴 ap（门内 value
      // 精确回读）+ 全局取证 noPageError/noErrorEnvelope 得出（synthesizeSkeleton 缺省加、per-intent 合入）。
    ],
  });

  // ---------- C2-a compile 全程 ----------
  await checkAsync('C2-a compile 全程：events 末步 setNodeField fill（value/semantic label placeholder/无 nth/无 dropdownUnit）、过 events.schema、blockers 空、compile-report 含字段回读证据', async () => {
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
      { intentId: 'intent_4', action: 'fill' },    // setNodeField 填字段（内聚 customAct）
    ])) throw new Error(`events 应恰 [nav(0),click(1),click(2 开面板),dragTo(2),click(3 开抽屉),fill(4 填字段)]，实际 ${JSON.stringify(seq)}`);
    const setf = ev.events[ev.events.length - 1];
    if (setf.atom !== 'workflow.setNodeField') throw new Error(`末步 atom 应 workflow.setNodeField，实际 ${setf.atom}`);
    if (setf.action !== 'fill') throw new Error(`末步 action 应 fill（复用 fill 零冻结 D3），实际 ${setf.action}`);
    if (setf.value !== VALUE) throw new Error(`setNodeField value 应载填入值「${VALUE}」，实际 ${setf.value}`);
    if (!setf.semantic || setf.semantic.kind !== 'label' || setf.semantic.name !== PLACEHOLDER) throw new Error(`setNodeField 应经语义锚 placeholder「${PLACEHOLDER}」（kind label），实际 ${JSON.stringify(setf.semantic)}`);
    if (setf.semantic.exact !== false) throw new Error(`setNodeField exact 缺省应 false（未给 exact 入参），实际 ${setf.semantic.exact}`);
    if (setf.nth !== undefined) throw new Error(`setNodeField 单字段不给 nth（严格唯一，未给 nth 入参不载 nth），实际带 nth=${setf.nth}`);
    if (setf.dropdownUnit !== undefined) throw new Error('setNodeField 不得带 dropdownUnit（走 fill 非 selectOption）');
    if (setf.nodeName !== NODE) throw new Error(`setNodeField 编译产物应带 nodeName「${NODE}」（drawer-lock-hardening D3 供给通道，编译期 run 态 openNode 成功后写入），实际 ${setf.nodeName}`);
    assertEventsDocAgainstSchema(ev);
    const rep = readJson(reportFile);
    if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    const repText = JSON.stringify(rep);
    if (!repText.includes('节点字段已填入')) throw new Error(`compile-report 应含「节点字段已填入」value 回读证据 notes（GRILL D5），实际尾段 ${repText.slice(-300)}`);
    const obs = readJson(observedFile);
    const last = obs.steps[obs.steps.length - 1];
    if (last.urlPathnameAfter !== '/ai-manager/process/detail') throw new Error(`尾步应仍在详情路由（填字段不换页），实际 ${last.urlPathnameAfter}`);
  });

  // ---------- C2-b 端到端裁定：draft(+patch)→sign→casey run→verdict 恰 5 intent 全 PASS ----------
  await checkAsync('C2-b 端到端：draft+patch(nav urlPathname + openNode countChange up 抽屉 0→1)→sign→casey run→verdict 恰 5 intent 全 PASS（setNodeField intent 由动作轴 ap 门内 value 精确回读 + 全局取证得出）', async () => {
    const draftFile = join(outDir, `expected.draft-${CASE_ID}.json`);
    // patch：nav 补 urlPathname；openNode 补 countChange up（抽屉 0→1）。open/addNode 硬断言由 assert.onPage/
    // assert.textVisible 折进；setNodeField intent 无每-intent assert（value 看不到、不硬凑 textVisible）→ 靠全局取证兜。
    const patch = writeJson(join(tmp, 'patch.json'), [
      { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' },
      { intentId: 'intent_3', kind: 'countChange', op: 'up', value: 1 },
    ]);
    const d = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', outDir, '--patch', patch]);
    if (d.status !== 0) throw new Error(`draft 应 exit 0，实际 ${d.status}：${(d.stderr || '').slice(-200)}`);
    if ((readJson(draftFile).pending || []).length) throw new Error('pending 应空（onPage/textVisible 已实现 kind、countChange 走 patch）');
    const prdFixture = writeJson(join(tmp, 'prd.json'), { schemaVersion: 2, caseId: CASE_ID, task: 'wf-set-node-field hermetic 夹具', testChecksums: {}, stories: [] });
    const frozen = join(outDir, 'expected.frozen.json');
    const s = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixture, '--frozen-out', frozen, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-09T00:00:00.000Z']);
    if (s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${s.status}：${(s.stderr || '').slice(-200)}`);
    const runDir = join(tmp, 'run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozen, '--profile', PROFILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-400)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s2) => s2.intentId).sort(), ['intent_0', 'intent_1', 'intent_2', 'intent_3', 'intent_4'])) throw new Error(`verdict intent 集应恰 [intent_0..4]，实际 ${JSON.stringify(verdict.steps.map((s2) => s2.intentId))}`);
    const bad = verdict.steps.filter((s2) => s2.verdict !== 'PASS');
    if (bad.length) throw new Error(`应全 PASS（doSetNodeField 域锁门真跑夹具 + 字段精确回读 → ap=true + 全局取证），败者 ${JSON.stringify(bad.map((s2) => ({ intentId: s2.intentId, verdict: s2.verdict, reason: s2.reason })))}`);
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
  // 抽屉族回放 setup 事件（nav→addNode 开面板+落节点→openNode 开抽屉），末步留给各考场追加 setNodeField。
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
  // setNodeField fill 事件（末步，intent_3）：无 nth（严格唯一/多匹配 ambiguous）；semantic label 载 placeholder + exact；
  // nodeName 载当前节点标题（drawer-lock-hardening D3/D8：既有金牌手编 events 补齐，供标题锚域锁读取）。
  const setFieldEvent = () => ({ stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false }, nodeName: NODE });
  // 全局取证（synthesizeSkeleton 缺省加的两条硬断言，手编路径显式带上——setNodeField intent 的 PASS 靠它 + 门内 ap）。
  const GLOBALS = [{ kind: 'noPageError', op: 'absent' }, { kind: 'noErrorEnvelope', op: 'envelopeOk' }];

  // ---------- C2-c setclash 钉位：详情页抽屉外再挂同占位符 input → 唯域锁门 count=1 unique ----------
  await checkAsync('C2-c setclash 钉位：详情页抽屉外再挂一个同占位符 input——全页 getByPlaceholder count=2 必 ambiguous，唯 doSetNodeField（域锁 .hr-drawer__content-wrapper 内 count=1）unique 填入 → 动作轴 unique+candidateCount 1+identityReadback ok + verdict PASS', async () => {
    const s = await startFakeSut({ scenario: 'setclash' });
    try {
      const caseId = 'tc_wf_setf_setclash';
      const { axes, verdict } = runReplayVerdict('setclash', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), setFieldEvent()],
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`setclash 应 unique（域锁门 count=1；全页 getByPlaceholder count=2 必 ambiguous），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 1) throw new Error(`candidateCount 应恰 1（域锁抽屉内唯一；全页非域锁门=2 即门漂移），实际 ${ax.action.candidateCount}`);
      if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`setclash 应 identityReadback ok:true（字段 value 精确回读），实际 ${JSON.stringify(ax.action.identityReadback)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict !== 'PASS') throw new Error(`setclash setNodeField 应 PASS（域锁门真填入 + 全局取证），实际 ${v.verdict}/${v.reason}`);
    } finally { await s.close(); }
  });

  // ── 编译面反面公共助手：gate→confirm→execute，回 gate/execute 结果与 out-dir。──
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

  // ---------- C3a 编译面·抽屉未开（gate 前置）+ 无字段（execute 预检 count=0）双证 ----------
  await checkAsync('C3a 编译面·抽屉未开/无字段 fail-closed 双证：①未 openNode → flow gate 前置门截（需节点抽屉已开）exit 65 零 events；②openNode 开抽屉但无字段（ddempty）→ execute 预检域锁 getByPlaceholder count=0 → blocker exit 65 零 events 无谎报 acted', async () => {
    // ① 未 openNode：flow gate 段 registry 前置门截（节点抽屉已开无提供者）。
    const { g, x, od } = compileFlowCase('c3a1', 'tc_wf_setf_c3a1', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }, // 前序无 openNode → 前置未满足
    ]);
    if (x !== null) throw new Error('未 openNode 不应过 gate 段（registry 前置节点抽屉已开无提供者）');
    if (g.status !== 65) throw new Error(`未 openNode 应 gate 段前置门截 exit 65（fail-closed），实际 ${g.status}：${(g.stderr || '').slice(-260)}`);
    if (!/节点抽屉已开|setNodeField/.test((g.stderr || '') + (g.stdout || ''))) throw new Error(`gate 段应点名前置「节点抽屉已开」缺提供者，实际 ${((g.stderr || '') + (g.stdout || '')).slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('gate 段前置截不得产 events');

    // ② 无字段（ddempty）：openNode 开抽屉（前置满足）但抽屉无 .hr-input → execute 预检域锁 count=0。
    const s = await startFakeSut({ scenario: 'ddempty' });
    try {
      const r = compileFlowCase('c3a2', 'tc_wf_setf_c3a2', [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: OPEN_NAME } },
        { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
        { atom: 'workflow.openNode', params: { label: NODE } },
        { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }, // 抽屉开但无字段 → 域内 count=0
      ], s.url);
      if (!r.x || r.x.status !== 65) throw new Error(`无字段应 execute 预检 count=0 硬阻断 exit 65，实际 ${r.x && r.x.status}：${(r.x && r.x.stderr || '').slice(-260)}`);
      if (existsSync(join(r.od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(r.od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/count=0/.test(btext)) throw new Error(`blockers 应点名 setNodeField 预检域锁字段 count=0（其自身签名），实际 ${btext.slice(0, 300)}`);
      const lied = (rep.verification || []).some((v) => v.atom === 'workflow.setNodeField' && v.acted === true);
      if (lied) throw new Error('字段缺席仍 acted=true——身份门破（填不了照 fail-closed 落轴）');
    } finally { await s.close(); }
  });

  // ---------- C3b 编译面·多匹配未给 nth（setmulti）→ 预检 count>1 blocker 硬阻断 exit 65 绝不填首项 ----------
  await checkAsync('C3b 编译面·多匹配未给 nth（setmulti：两同占位符字段、入参不给 nth）：预检 count>1 且无 nth → blocker exit 65 绝不填首项、零 events', async () => {
    const s = await startFakeSut({ scenario: 'setmulti' });
    try {
      const r = compileFlowCase('c3b', 'tc_wf_setf_c3b', [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: OPEN_NAME } },
        { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
        { atom: 'workflow.openNode', params: { label: NODE } },
        { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE } }, // 两同占位符字段、不给 nth → 多匹配
      ], s.url);
      if (!r.x || r.x.status !== 65) throw new Error(`多匹配未给 nth 应硬阻断 exit 65（绝不填首项），实际 ${r.x && r.x.status}：${(r.x && r.x.stderr || '').slice(-260)}`);
      if (existsSync(join(r.od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
      const rep = readJson(join(r.od, 'compile-report.json'));
      const btext = JSON.stringify(rep.blockers || []);
      if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/多匹配|ambiguous|count=2/.test(btext)) throw new Error(`blockers 应点名 setNodeField 多匹配 ambiguous，实际 ${btext.slice(0, 300)}`);
    } finally { await s.close(); }
  });

  // ---------- C3c 编译面·nth 越界 → 预检 blocker 硬阻断 exit 65 绝不填 ----------
  await checkAsync('C3c 编译面·nth 越界（抽屉 1 字段、nth=1）：预检 nth ≥ count → blocker exit 65 绝不填、零 events', async () => {
    const { x, od } = compileFlowCase('c3c', 'tc_wf_setf_c3c', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'workflow.openNode', params: { label: NODE } },
      { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE, nth: 1 } }, // 抽屉 1 字段、nth=1 越界
    ]);
    if (!x || x.status !== 65) throw new Error(`nth 越界应硬阻断 exit 65（绝不填），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/越界|nth=1/.test(btext)) throw new Error(`blockers 应点名 nth 越界，实际 ${btext.slice(0, 300)}`);
  });

  // ---------- C3d 回放面·抽屉未开 → doSetNodeField 缺席守卫优雅 none 不崩 → verdict 不 PASS ----------
  await checkAsync('C3d 回放面·抽屉未开（手编 events 无 addNode/openNode）：doSetNodeField 缺席守卫优雅 none（不崩整轮回放）→ verdict 不 PASS', async () => {
    const caseId = 'tc_wf_setf_c3d';
    const { axes, verdict } = runReplayVerdict('c3d', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        // 抽屉未开（未 addNode/openNode）→ 标题锚域内缺席 → 缺席守卫回 none（waitFor 抛不得穿出崩整轮）；
        // nodeName 载 NODE（drawer-lock-hardening D8 既有金牌补齐）——域内确实无此标题，仍归 none，非 nodeName 缺席那支。
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, semantic: { kind: 'label', name: PLACEHOLDER, exact: false }, nodeName: NODE },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'noPageError', op: 'absent' }] },
      ],
    });
    const ax = stepOf(axes, 'intent_1');
    if (!ax.action || ax.action.resolution !== 'none') throw new Error(`抽屉未开应优雅落 none（缺席守卫、不崩溃），实际 ${JSON.stringify(ax.action)}`);
    const v = stepOf(verdict, 'intent_1');
    if (v.verdict === 'PASS') throw new Error('抽屉未开竟 PASS——假绿（字段缺席必须不 PASS，护栏 #14）');
  });

  // ---------- C3e 回放面·多匹配未给 nth（setmulti）→ ambiguous 绝不填首项 + candidateCount 恰 2 → verdict 不 PASS ----------
  await checkAsync('C3e 回放面·多匹配未给 nth（setmulti：两同占位符字段、事件不载 nth）：doSetNodeField ambiguous 绝不填首项、candidateCount 恰 2、candidateValues 两格 value 必仍为空（实读证「一格未落笔」非空话）→ verdict 不 PASS（修前误填首项返 unique=fail-open 假绿红证）', async () => {
    const s = await startFakeSut({ scenario: 'setmulti' });
    try {
      const caseId = 'tc_wf_setf_c3e';
      const { axes, verdict } = runReplayVerdict('c3e', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), setFieldEvent()], // 末步不载 nth：两同占位符字段没给消歧 → ambiguous 绝不填首项
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`多匹配未给 nth 应 ambiguous 绝不填首项（修前误填首项返 unique=fail-open 假绿），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2（域内两同占位符字段），实际 ${ax.action.candidateCount}`);
      if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('多匹配竟 identityReadback ok:true——填了首项假绿（护栏 #14）');
      // 「绝不填首项」实读钉证（codex-sol MED ①）：ambiguous 分支须快照全部候选字段 value、且两格必仍为空——
      //   证「字段值不变」非口头（若误填首项，candidateValues[0] 会成填入值 → 此断言红）。
      if (!Array.isArray(ax.action.candidateValues)) throw new Error(`ambiguous 应带 candidateValues 快照佐证一格未落笔，实际 ${JSON.stringify(ax.action.candidateValues)}`);
      if (ax.action.candidateValues.length !== 2 || ax.action.candidateValues.some((x) => x !== '')) throw new Error(`多匹配 ambiguous 后两字段 value 必仍为空（绝不填首项实读），实际 ${JSON.stringify(ax.action.candidateValues)}`);
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict === 'PASS') throw new Error('多匹配未给 nth 竟 PASS——fail-open 假绿（多匹配无 nth 必不填，护栏 #14/ADR-0007）');
    } finally { await s.close(); }
  });

  // ---------- C3f 编译面·非法 nth（happy 单字段 + flow nth:-1）→ 预检非法 nth blocker exit 65 绝不降级 index 0 ----------
  await checkAsync('C3f 编译面·非法 nth（happy 单字段、flow setNodeField nth:-1 在场但非非负整数）：预检非法 nth → blocker exit 65 绝不填、零 events（修前 hasNth=Number.isInteger&&≥0?nth:0 静默降级 index 0 单匹配填入 exit 0=fail-open 红证）', async () => {
    const { x, od } = compileFlowCase('c3f', 'tc_wf_setf_c3f', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'workflow.openNode', params: { label: NODE } },
      { atom: 'workflow.setNodeField', params: { placeholder: PLACEHOLDER, value: VALUE, nth: -1 } }, // 非法 nth：在场但非非负整数
    ]);
    if (!x || x.status !== 65) throw new Error(`非法 nth 应 execute 预检 blocker exit 65（绝不填、不降级 index 0），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/setNodeField/.test(btext) || !/非法|nth=-1|nth/.test(btext)) throw new Error(`blockers 应点名 setNodeField 非法 nth，实际 ${btext.slice(0, 300)}`);
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.setNodeField' && v.acted === true);
    if (lied) throw new Error('非法 nth 仍 acted=true——身份门破（填不了照 fail-closed 落轴）');
  });

  // ---------- C3g 回放面·非法 nth（happy 单字段 + 事件 nth:-1）→ action_failed 绝不降级 index 0 填首项 ----------
  await checkAsync('C3g 回放面·非法 nth（happy 单字段、事件 nth:-1 在场但非非负整数）：doSetNodeField action_failed（不填、不降级 index 0）、identityReadback ok:false → verdict 不 PASS（修前静默取 0 单匹配真填入返 unique=fail-open 假绿红证）', async () => {
    const caseId = 'tc_wf_setf_c3g';
    const { axes, verdict } = runReplayVerdict('c3g', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      // 事件 nth=-1（在场但非非负整数）：修前 coerce 0 单匹配真填入返 unique（假绿，填了 index 0）。
      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.setNodeField', action: 'fill', value: VALUE, nth: -1, semantic: { kind: 'label', name: PLACEHOLDER, exact: false } }],
    }, {
      caseId, channel: 'web', globalAssertions: GLOBALS,
      intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
    });
    const ax = stepOf(axes, 'intent_3');
    if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`非法 nth 应 action_failed 硬阻断（绝不降级 index 0、绝不填），实际 ${JSON.stringify(ax.action)}`);
    if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('非法 nth 竟 identityReadback ok:true——填了 index 0 假绿（护栏 #14/ADR-0007）');
    const v = stepOf(verdict, 'intent_3');
    if (v.verdict === 'PASS') throw new Error('非法 nth 竟 PASS——静默降级 index 0 真填入 fail-open 假绿（护栏 #14，绝不猜首项）');
  });

  // ---------- C3h 回放面·精确回读律钉桩（setsuffix：字段 input 事件追加尾巴 → 填后 value 成 want 超集）----------
  // 填后 inputValue()=want+'#tail'（含 want 非等 want）：精确门 got!==want → action_failed 拒认（点了但没填对）。
  // 负向钉证（codex-sol MED ②）：若把回读从 inputValue()===want 退成 includes(want) 会误判填对返 unique →
  //   本考场 verdict 转 PASS → 下方 action_failed/非 PASS 断言红。故此桩钉死「精确回读非子串」律不被削弱。
  await checkAsync('C3h 回放面·精确回读律钉桩（setsuffix：字段追加尾巴→填后 value=want+尾成超集）：doSetNodeField 精确门 got!==want → action_failed 拒认、identityReadback ok:false → verdict 不 PASS（若回读退成 includes 会误判填对返 unique → 本断言红，钉精确回读律）', async () => {
    const s = await startFakeSut({ scenario: 'setsuffix' });
    try {
      const caseId = 'tc_wf_setf_c3h';
      const { axes, verdict } = runReplayVerdict('c3h', s.url, {
        schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
        events: [...setupEvents(), setFieldEvent()], // 单字段无 nth；填后字段 value 被追加尾巴成超集
      }, {
        caseId, channel: 'web', globalAssertions: GLOBALS,
        intents: [...setupIntents(), { intentId: 'intent_3', expected: [] }],
      });
      const ax = stepOf(axes, 'intent_3');
      if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`超集回读应精确门拒认 action_failed（includes 子串会把 want+尾误判填对），实际 ${JSON.stringify(ax.action)}`);
      if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('超集回读竟 identityReadback ok:true——子串误判填对假绿（护栏 #14，精确回读非子串）');
      const v = stepOf(verdict, 'intent_3');
      if (v.verdict === 'PASS') throw new Error('超集回读竟 PASS——回读退成 includes 的 fail-open 假绿（钉精确回读律 inputValue()===want）');
    } finally { await s.close(); }
  });
} finally {
  await sut.close();
}

console.log(`wf-set-node-field golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
