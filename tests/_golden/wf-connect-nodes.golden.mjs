// wf-connect-nodes.golden.mjs —— 画布连线原子（wf-connect-nodes，full）端到端红金牌。
// 决策全录 docs/plans/wf-connect-nodes/proposed/GRILL.md（D1 复用 dragTo / D2 按原子分发门 /
// D3 .lf-edge 边数身份回读 / D4 addNode expectedNodeDelta / D5 覆盖缺口）+ plan.md 验收 C1–C4。
// connectNodes 复用 events.action=dragTo（零 schema 涟漪）：event = {atom:workflow.connectNodes,
// action:dragTo, semantic:{kind:text,name:fromLabel}, nodeName:toLabel, ox/oy=目标中心相对画布内容坐标}；
// 回放门按 ev.atom 分发到 doConnectNodes（源在 .lf-canvas-overlay 按标签解析、.lf-node-anchor-hover
// 最近锚点、拖目标、.lf-edge 增身份回读）——与 addNode 的 .node-item 面板域门是两扇门（D2）。
//
// C1 connectNodes/addNode 可编译 + COMPILE_KNOWN_ATOMS 恰 17（与 wf-add-node C1 一致防漂移，selectNodeDropdown +1）+
//    agent.openToolPicker 不可编译（GRILL D5 继任反例真缝）。
// C2 端到端连线（fake-sut happy）：compile [nav, open, addNode×2, connectNodes] → events 末步是
//    connectNodes 的 dragTo（源语义 fromLabel + nodeName=toLabel + ox/oy 有限数）→ 过 events.schema →
//    blockers 空 + compile-report notes 含 .lf-edge 0→1 → draft(+patch)→sign→casey run→verdict 恰 5 intent 全 PASS。
//    【计数通道冲突的解法，本金牌最大坑】rowCount 用单一 profile.countSelector；addNode 后置核验要 .lf-node、
//    connectNodes 要 .lf-edge——一个 profile 只能配一个 countSelector。对策：端到端 verdict 只对 connectNodes
//    intent 断 countChange（countSelector='.lf-edge'）；addNode 两步用 textVisible（节点 .lf-node-content 文本
//    可见，不依赖 countChange 的 kind），nav 用 urlPathname 硬断言——五 intent 都有硬断言防 INDETERMINATE，
//    且没有第二个原子去抢 .lf-edge 计数通道。addNode 编译期自己的 .lf-node 后置核验走硬编码选择器、不碰 profile。
// C3 fail-closed 反面（起草子代理二次评审揪出 codex 两健壮性缝 F1/F2，本契约 loop 段已修，C3 提硬为验证修复）：
//    a 编译面·源节点未 addNode（画布不存在）→ 预检 workflowNodeBox(fromLabel) 缺席守卫返回 null → 推 blocker
//      点名「源节点证不出」硬阻断 exit 65 零 events（F2 修后干净预检路径，镜像 addNode 先例）；
//    b 编译面·目标节点未 addNode → 预检 workflowNodeBox(toLabel) 缺席守卫返回 null → 推 blocker 点名「目标证不出」
//      exit 65 零 events（F2 修后：waitFor 不再抛穿出跳产物块、与 a 对称、有诊断）；
//    c 回放面·自连（节点在场但源=目标，边不增）→ doConnectNodes 优雅 action_failed → verdict 不 PASS（graceful）；
//    d 回放面·源节点画布不存在 → nodeBoxByLabel 缺席守卫返回 null → doConnectNodes 优雅 none 不崩溃 → verdict 不 PASS
//      （F1 修后：waitFor 抛不再穿出 performAction 崩整轮回放；此条 = F1 修复的红证——修前 replay 崩 exit 1）。
//      锚点缺席：夹具每节点恒渲锚点、hermetic 造不出（收窄注，真机 route:human）。
// C4 addNode +2 路径：flow nodeName='真并行网关开始' → .lf-node +2 后置核验过、blockers 空（fake-sut 双节点夹具
//    loop 段已加：NODE_TYPES 该项一拖落 start/end 两节点，对齐 addNode expectedNodeDelta=2）。
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
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-connect-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-500)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CASE_ID = 'tc_wf_connect';
const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读点开进详情=画布页）
const FROM_NODE = '脚本转换'; // 面板前 4 真机实采名之一（连线源）
const TO_NODE = '模型节点';   // 同上（连线目标）
// 落点相对画布左上角（registry x/y 直译）；两节点显著分离，保证连线时源锚点=源节点自身锚点（最近锚点判定不歧义）。
const FROM_X = 180, FROM_Y = 90;
const TO_X = 520, TO_Y = 210;
const PARALLEL_NODE = '真并行网关开始'; // C4：真机一次拖拽落 start/end 两节点（expectedNodeDelta=2）
const PARALLEL_X = 300, PARALLEL_Y = 140;

// 通道剖面（非凭据）：countSelector='.lf-edge' —— 端到端 verdict 的 countChange 计数通道对准连线边（见头注计数通道冲突解法）。
const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.lf-edge' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);

// ── events.schema 结构校验器（无 ajv，与 seams-freeze / wf-add-node 金牌同一 hermetic 习惯）：
// 枚举/必填/字段面（additionalProperties:false 纪律）/禁纯坐标步——直读已冻 schema 当真值源。
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
      if (!stable) throw new Error(`events[${i}] (${e.action}) 纯坐标步——缺稳定定位字段（禁纯坐标步语义不变，GRILL D2）`);
    }
  }
}

// ---------- C1 编译原子集加法 + 例翻反例 ----------
await checkAsync('C1 workflow.connectNodes/addNode 可编译、COMPILE_KNOWN_ATOMS 恰 17、agent.openToolPicker 不可编译', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.isCompilableAtom('workflow.connectNodes')) throw new Error('workflow.connectNodes 应可编译（连线原子加法）');
  if (!ca.isCompilableAtom('workflow.addNode')) throw new Error('workflow.addNode 应可编译（画布维度先例）');
  if (ca.COMPILE_KNOWN_ATOMS.size !== 17) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 17（与 wf-add-node C1 一致防漂移，selectNodeDropdown +1），实际 ${ca.COMPILE_KNOWN_ATOMS.size}`);
  if (ca.isCompilableAtom('agent.openToolPicker')) throw new Error('agent.openToolPicker 不应可编译（GRILL D5 继任反例真缝）');
});

// ---------- fake-sut happy：C2 端到端 + C3 编译/回放反面 + C4 addNode +2 ----------
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
      { intentId: 'intent_add_from', text: `往画布拖入「${FROM_NODE}」节点` },
      { intentId: 'intent_add_to', text: `往画布拖入「${TO_NODE}」节点` },
      { intentId: 'intent_connect', text: `连线 ${FROM_NODE} → ${TO_NODE}` },
    ],
  });
  const FLOW = writeJson(join(tmp, 'flow.json'), {
    id: CASE_ID, name: '画布连线', category: 'normal',
    steps: [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } }, // 折进 open intent
      { atom: 'workflow.addNode', params: { nodeName: FROM_NODE, x: FROM_X, y: FROM_Y } },
      { atom: 'assert.textVisible', params: { text: FROM_NODE } }, // 折进 addNode(源) intent，硬断言防 INDETERMINATE
      { atom: 'workflow.addNode', params: { nodeName: TO_NODE, x: TO_X, y: TO_Y } },
      { atom: 'assert.textVisible', params: { text: TO_NODE } }, // 折进 addNode(目标) intent
      { atom: 'workflow.connectNodes', params: { fromLabel: FROM_NODE, toLabel: TO_NODE } },
    ],
  });

  // ---------- C2 compile 全程 ----------
  await checkAsync('C2 compile 全程：events 末步 connectNodes dragTo（源语义+nodeName+ox/oy）、过 events.schema、blockers 空、compile-report 含 .lf-edge 0→1', async () => {
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
      { intentId: 'intent_2', action: 'click' },   // addNode(源) 条件步开面板
      { intentId: 'intent_2', action: 'dragTo' },  // addNode(源) 落 .lf-node
      { intentId: 'intent_3', action: 'dragTo' },  // addNode(目标) 面板已开、只拖
      { intentId: 'intent_4', action: 'dragTo' },  // connectNodes 落 .lf-edge
    ])) throw new Error(`events 应恰 [nav(0),click(1),click(2 开面板),dragTo(2),dragTo(3),dragTo(4 连线)]，实际 ${JSON.stringify(seq)}`);
    const drag = ev.events[ev.events.length - 1];
    if (drag.atom !== 'workflow.connectNodes') throw new Error(`末步 atom 应 workflow.connectNodes，实际 ${drag.atom}`);
    if (drag.action !== 'dragTo') throw new Error(`末步 action 应 dragTo（复用 dragTo，GRILL D1），实际 ${drag.action}`);
    if (!drag.semantic || drag.semantic.kind !== 'text' || drag.semantic.name !== FROM_NODE) throw new Error(`连线源应经语义定位锚 fromLabel「${FROM_NODE}」，实际 ${JSON.stringify(drag.semantic)}`);
    if (drag.nodeName !== TO_NODE) throw new Error(`连线目标应写既有 nodeName 字段=toLabel「${TO_NODE}」，实际 ${drag.nodeName}`);
    if (!Number.isFinite(drag.ox) || !Number.isFinite(drag.oy)) throw new Error(`连线 ox/oy 应为有限数（目标中心相对画布内容坐标），实际 ${drag.ox}/${drag.oy}`);
    assertEventsDocAgainstSchema(ev);
    const rep = readJson(reportFile);
    if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    const repText = JSON.stringify(rep);
    // .lf-edge 后置核验证据落 compile-report notes（D3：边数 +1 身份回读）：0→1。
    if (!repText.includes('.lf-edge 计数 0→1')) throw new Error(`compile-report 应含 .lf-edge 计数 0→1 后置核验证据，实际尾段 ${repText.slice(-300)}`);
    const obs = readJson(observedFile);
    const last = obs.steps[obs.steps.length - 1];
    if (last.urlPathnameAfter !== '/ai-manager/process/detail') throw new Error(`尾步应仍在详情路由（画布连线不换页），实际 ${last.urlPathnameAfter}`);
  });

  // ---------- C2 端到端裁定：draft(+patch)→sign→casey run→verdict 恰 5 intent 全 PASS ----------
  await checkAsync('C2 端到端：draft+patch(connectNodes countChange up .lf-edge)→sign→casey run→verdict 恰 5 intent 全 PASS', async () => {
    const draftFile = join(outDir, `expected.draft-${CASE_ID}.json`);
    // patch：nav 补 urlPathname 硬断言（防 INDETERMINATE）；connectNodes 补 countChange up（profile.countSelector='.lf-edge'）。
    // addNode 两步不进 patch——它们的硬断言由 assert.textVisible 折进（不抢 .lf-edge 计数通道，见头注冲突解法）。
    const patch = writeJson(join(tmp, 'patch.json'), [
      { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' },
      { intentId: 'intent_4', kind: 'countChange', op: 'up', value: 1 },
    ]);
    const d = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', outDir, '--patch', patch]);
    if (d.status !== 0) throw new Error(`draft 应 exit 0，实际 ${d.status}：${(d.stderr || '').slice(-200)}`);
    if ((readJson(draftFile).pending || []).length) throw new Error('pending 应空（onPage/textVisible 已实现 kind、countChange 走 patch）');
    const prdFixture = writeJson(join(tmp, 'prd.json'), { schemaVersion: 2, caseId: CASE_ID, task: 'wf-connect-nodes hermetic 夹具', testChecksums: {}, stories: [] });
    const frozen = join(outDir, 'expected.frozen.json');
    const s = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixture, '--frozen-out', frozen, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-07T00:00:00.000Z']);
    if (s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${s.status}：${(s.stderr || '').slice(-200)}`);
    const runDir = join(tmp, 'run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozen, '--profile', PROFILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-400)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s2) => s2.intentId).sort(), ['intent_0', 'intent_1', 'intent_2', 'intent_3', 'intent_4'])) throw new Error(`verdict intent 集应恰 [intent_0..4]，实际 ${JSON.stringify(verdict.steps.map((s2) => s2.intentId))}`);
    const bad = verdict.steps.filter((s2) => s2.verdict !== 'PASS');
    if (bad.length) throw new Error(`应全 PASS（connectNodes 真跑夹具 + .lf-edge countChange up），败者 ${JSON.stringify(bad.map((s2) => ({ intentId: s2.intentId, verdict: s2.verdict, reason: s2.reason })))}`);
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

  // ---------- C3a 编译面·源节点未 addNode → blockers 硬阻断 exit 65 零 events ----------
  await checkAsync('C3a 编译面·连线源节点画布不存在（未 addNode）：预检 blocker 点名源证不出、硬阻断 exit 65、零 events、无谎报 acted（F2 修后）', async () => {
    // F2 修后：源缺席 → 预检 workflowNodeBox(fromLabel) 缺席守卫返回 null → 推 blocker（不再走 dragConnectByLabels
    // 抛→emit 捕获路径），干净诊断 exit 65（镜像 addNode 预检先例）。
    const { x, od } = compileFlowCase('c3a', 'tc_wf_conn_c3a', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: TO_NODE, x: TO_X, y: TO_Y } }, // 只加目标
      { atom: 'workflow.connectNodes', params: { fromLabel: '幽灵源节点', toLabel: TO_NODE } }, // 源缺席
    ]);
    if (x.status !== 65) throw new Error(`源缺席应硬阻断 exit 65（fail-closed），实际 ${x.status}：${(x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/证不出/.test(btext) || !/source=false/.test(btext)) throw new Error(`blockers 应点名源节点证不出（F2 预检诊断），实际 ${btext.slice(0, 300)}`);
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.connectNodes' && v.acted === true);
    if (lied) throw new Error('源缺席仍 acted=true——身份门破（连不上照 fail-closed 落轴）');
  });

  // ---------- C3b 编译面·目标节点未 addNode → 预 emit 异常路径 exit 1 零 events（对称行为不一致，评审发现 F2） ----------
  await checkAsync('C3b 编译面·连线目标节点画布不存在（未 addNode）：预检 blocker 点名目标证不出、硬阻断 exit 65、零 events（F2 修后与 C3a 对称）', async () => {
    // F2 修后：目标缺席 → 预检 workflowNodeBox(toLabel) 缺席守卫返回 null → 推 blocker exit 65 带诊断
    // （不再 waitFor 抛穿出跳产物块留剥栈 exit 1），与 C3a 源缺席对称。
    const { x, od } = compileFlowCase('c3b', 'tc_wf_conn_c3b', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: FROM_NODE, x: FROM_X, y: FROM_Y } }, // 只加源
      { atom: 'workflow.connectNodes', params: { fromLabel: FROM_NODE, toLabel: '幽灵目标节点' } }, // 目标缺席
    ]);
    if (x.status !== 65) throw new Error(`目标缺席应硬阻断 exit 65（F2 修后，与 C3a 对称），实际 ${x.status}：${(x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/证不出/.test(btext) || !/target=false/.test(btext)) throw new Error(`blockers 应点名目标节点证不出，实际 ${btext.slice(0, 300)}`);
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

  // ---------- C3c 回放面·自连（节点在场但边不增）→ doConnectNodes action_failed → verdict 不 PASS ----------
  await checkAsync('C3c 回放面·自连（源=目标，边不增）：doConnectNodes 优雅 action_failed → verdict 不 PASS 不假绿', async () => {
    // 手编 events：nav 到详情 → 开面板 → addNode 一节点 → connectNodes 自连（from=to 同一节点）。
    // doConnectNodes：两端在场、mouse 三段式成功但 beginEdge onUp 见 toNode===fromNode 不落边 → after 不 > before
    // → action_failed（可达的优雅失败路径）。字面「源节点名画布不存在」的回放场景 doConnectNodes 会崩溃 exit 1
    // （nodeBoxByLabel waitFor 抛未捕获，应回 none）——见文末【评审发现 F1】，故此处用自连复现 action_failed。
    const caseId = 'tc_wf_conn_c3c';
    const { axes, verdict } = runReplayVerdict('c3c', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
        { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: TO_NODE, exact: true }, text: TO_NODE, nodeName: TO_NODE, ox: 320, oy: 150 },
        { stepId: 'atstep_3', intentId: 'intent_2', atom: 'workflow.connectNodes', action: 'dragTo', semantic: { kind: 'text', name: TO_NODE, exact: true }, text: TO_NODE, nodeName: TO_NODE, ox: 320, oy: 150 },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: TO_NODE }] },
        { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const ax = stepOf(axes, 'intent_2');
    if (!ax.action || !['action_failed', 'none'].includes(ax.action.resolution)) throw new Error(`自连应优雅落 action_failed/none（边不增、不崩溃），实际 ${JSON.stringify(ax.action)}`);
    const v = stepOf(verdict, 'intent_2');
    if (v.verdict === 'PASS') throw new Error('自连（边不增）竟 PASS——假绿（.lf-edge 未 +1 必须不 PASS，护栏 #14）');
  });

  // ---------- C3d 回放面·源节点画布不存在（F1 修复红证）→ 缺席守卫回 none 不崩溃 → verdict 不 PASS ----------
  await checkAsync('C3d 回放面·源节点画布不存在（F1 修后）：nodeBoxByLabel 缺席守卫 → doConnectNodes 优雅 none、replay 不崩、verdict 不 PASS', async () => {
    // F1 修前：源节点缺席 → nodeBoxByLabel waitFor 抛未捕获 → 穿出 performAction → 整轮 replay 崩 exit 1（废后续 intent）。
    // 修后：缺席守卫返回 null → doConnectNodes 的 !sBox/!eBox 活代码回 none → replay exit 0 不崩、单步降级不 PASS。
    // runReplayVerdict 内已断 replay exit 0——本条能跑到断言即证 F1 修复（修前此处 replay 非 0 直接抛「replay 应 exit 0」）。
    const caseId = 'tc_wf_conn_c3d';
    const { axes, verdict } = runReplayVerdict('c3d', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        // 画布上无任何节点（未 addNode）→ 源节点缺席 → F1 守卫回 none（修前此步崩溃整轮）。
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.connectNodes', action: 'dragTo', semantic: { kind: 'text', name: FROM_NODE, exact: true }, text: FROM_NODE, nodeName: TO_NODE, ox: 320, oy: 150 },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const ax = stepOf(axes, 'intent_1');
    if (!ax.action || ax.action.resolution !== 'none') throw new Error(`源节点缺席应优雅落 none（F1 缺席守卫、不崩溃），实际 ${JSON.stringify(ax.action)}`);
    const v = stepOf(verdict, 'intent_1');
    if (v.verdict === 'PASS') throw new Error('源节点缺席竟 PASS——假绿（F1 修后仍须不 PASS，护栏 #14）');
  });

  // ---------- C4 addNode +2 路径（红先行主轴：待 fake-sut 双节点夹具转绿） ----------
  await checkAsync('C4 addNode 真并行网关开始 → .lf-node +2 成功、blockers 空【现红：fake-sut 缺双节点夹具，主循环 loop 段加】', async () => {
    const { x, od } = compileFlowCase('c4', 'tc_wf_conn_c4', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: PARALLEL_NODE, x: PARALLEL_X, y: PARALLEL_Y } },
    ]);
    if (x.status !== 0) throw new Error(`addNode「${PARALLEL_NODE}」应 execute exit 0（依赖 fake-sut 真并行网关开始双节点夹具，主循环 loop 段加），实际 ${x.status}：${(x.stderr || '').slice(-260)}`);
    const rep = readJson(join(od, 'compile-report.json'));
    if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    const repText = JSON.stringify(rep);
    if (!/lf-node/.test(repText) || !/0\s*→\s*2|\+2/.test(repText)) throw new Error(`compile-report 应含 .lf-node 计数 +2 后置核验证据（0→2/+2），实际尾段 ${repText.slice(-300)}`);
  });
} finally {
  await sut.close();
}

console.log(`wf-connect-nodes golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
