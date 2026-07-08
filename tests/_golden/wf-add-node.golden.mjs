// wf-add-node.golden.mjs —— 画布维度首原子（wf-add-node，full）红金牌。实现前红且红在断言层：
// C1「workflow.addNode 应可编译/集非 14」、C2 execute 报「暂无编译知识」+ events.schema 枚举无 dragTo、
// C5 四 schema 枚举缺 dragTo/maxItems 仍 7。决策全录 docs/plans/wf-add-node/proposed/GRILL.md；
// 夹具画布行为契约 = 预研 CONTRACT 画布通路增补（「添加节点」开面板 21 项 .node-item、mouse 三段式
// 双守卫【位移 ≥12px 且落点 .lf-graph 界内】落 .lf-node、单击/双击/微动/出界不落、data-node-count 按 DOM 实数刷新）。
// C1 addNode 可编译 + COMPILE_KNOWN_ATOMS 恰 16（openNode +1）+ agent.openToolPicker 不可编译（GRILL D5 继任反例真缝）；
// C2 compile 全程（fake-sut happy）：events 序列钉死 [nav, click(open), click(开面板条件步), dragTo]、
//    dragTo 源语义定位（面板项文本身份门源）+ ox/oy 落点（registry x/y 直译，GRILL D2 (a) 案）、
//    过 events.schema 结构校验（读 schema 枚举/字段面断言——仓内 hermetic 习惯无 ajv，形制同 seams-freeze）、
//    blockers 空、compile-report 含 .lf-node 计数 +1 后置核验证据。
//    【落点修正注】plan C2 原文「observed 含计数 +1 证据」：observed-reality.schema 已冻 additionalProperties:false
//    且不在本契约涟漪重签清单——计数证据无处入 observed，落 compile-report（verification/notes 面，非冻结）。
// C3 mini 端到端：draft(+patch：countChange up 走 profile countSelector『.lf-node』，GRILL D4 (a) 案)
//    → sign → casey run（dragTo 分支真跑夹具）→ verdict 恰 3 intent 全 PASS。
// C4 fail-closed 反面五连（能用夹具场景做的做，做不了的收窄注明）：
//    a 源面板项缺席（none）不拖 → execute 65 零 events（半份安全）+ 无谎报 acted；
//    b 落点出界（夹具 up 不在界内不落）→ 计数不 +1 进 blockers 硬阻断 65 零 events（落点是内容参数，出界不许 clamp——落不进如实阻断）；
//    c 画布容器 .lf-graph 缺席（列表页）→ dragTo 如实回 false（action_failed，绝不谎报 unique）→ verdict 不 PASS；
//    d 源域外多匹配（ambiguous 双保存钮）对同刻门 = 源域零命中 none/0 绝不拖（codex R1-F2 修后语义；
//      【收窄注】面板 21 项名唯一造不出面板内多匹配，门内 fallback_first 分支真机 route:human 观察）；
//    e 单击面板项不落节点（夹具否定行为反证）→ countChange 证不出 → verdict 不 PASS 不假绿；
//    f 落点 ox/oy 缺失 → 源唯一也绝不拖（不默认 0，codex R1-F1 钉红）。
// codex R1 处置录：F1 落点必填门 / F2 源同刻门锁 .node-item 域（编译门=回放门）/ F3 v1 金牌稳定定位名单
// 补 dragTo / F4 srcLocatorPinned 提硬为结构性必填——四条全采信，金牌随修提硬重签。
// C5 冻结面自洽：dragTo 在 events/action-vocabulary/channel-driver/run-history 四 schema 枚举全等在场 +
//    action-vocabulary entries.maxItems 8 镜像 + run-history 交互定位支归位 + ox/oy 语义描述补齐 +
//    action-vocabulary fixture 覆盖全枚举含 dragTo 治理条目（coordinateFallback.allowed:false + failClosed 红线同族）+
//    channel-driver fixture web 驱动 actionSpace 声明 dragTo。
// 真机四停站 route:human 挂 loop/prd-wf-add-node.json observability（21 面板项文本漂移/lf-node 族类名漂移/
// 拖拽时序真机负载稳定性/window.lf 图对象口挂账 SUT）。
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
const F = (p) => join(ROOT, 'tests', '_golden', 'fixtures', 'seams-v2', p);
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-addnode-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CASE_ID = 'tc_wf_addnode';
const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读打开进详情=画布页）
const NODE_NAME = '脚本转换'; // 夹具面板前 4 真机实采名之一（乙案真机实证同款节点）
const DROP_X = 620, DROP_Y = 240; // registry x/y 语义（相对画布左上角）→ event ox/oy 直译（GRILL D2 (a) 案）
const TESTCASE = writeJson(join(tmp, 'testcase.json'), {
  schemaVersion: 1, caseId: CASE_ID, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
  intents: [
    { intentId: 'intent_nav', text: '进入工作流管理列表' },
    { intentId: 'intent_open', text: `点开工作流 ${OPEN_NAME} 详情` },
    { intentId: 'intent_add', text: `往画布拖入「${NODE_NAME}」节点` },
  ],
});
const FLOW = writeJson(join(tmp, 'flow.json'), {
  id: CASE_ID, name: '画布拖入节点', category: 'normal',
  steps: [
    { atom: 'nav.workflowManagement', params: {} },
    { atom: 'workflow.open', params: { openName: OPEN_NAME } },
    { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
    { atom: 'workflow.addNode', params: { nodeName: NODE_NAME, x: DROP_X, y: DROP_Y } },
    { atom: 'assert.textVisible', params: { text: NODE_NAME } }, // 落点节点 .lf-node-content 文本可见（面板项同名共存不碍 appears 语义）
  ],
});
// 通道剖面（非凭据）：+countSelector 画布计数通道（GRILL D4 (a) 案：profile 加法零碰冻结，缺省 .hr-table-row 零行为差）。
const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.lf-node' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);
const outDir = join(tmp, 'compile');
const eventsFile = join(outDir, 'events.json');
const observedFile = join(outDir, `observed-${CASE_ID}.json`);
const reportFile = join(outDir, 'compile-report.json');

// ── events.schema 结构校验器（无 ajv，与 seams-freeze 金牌同一 hermetic 习惯）：
// 枚举/必填/字段面（additionalProperties:false 纪律）/禁纯坐标步——枚举与字段面直读已冻 schema 当真值源，
// 实现前 dragTo 不在枚举 → 此处红且红因清晰（「action dragTo 不在 events.schema 枚举」）。
const EV_SCHEMA = readJson(S('events.schema.json'));
const ACTION_ENUM = EV_SCHEMA.definitions.event.properties.action.enum;
function assertEventsDocAgainstSchema(doc) {
  if (doc.schemaVersion !== 2 || doc.channel !== 'web') throw new Error('events 信封违 schema（schemaVersion 须 2、channel 须 web）');
  if (doc.authored !== false) throw new Error('authored 须 false（LLM 编译产物须干净 v2 events）');
  const props = Object.keys(EV_SCHEMA.definitions.event.properties);
  for (const [i, e] of doc.events.entries()) {
    if (!e.stepId || !e.intentId || !e.action) throw new Error(`events[${i}] 缺 stepId/intentId/action`);
    if (!ACTION_ENUM.includes(e.action)) throw new Error(`events[${i}] action ${e.action} 不在 events.schema 枚举 ${JSON.stringify(ACTION_ENUM)}`);
    for (const k of Object.keys(e)) if (!props.includes(k)) throw new Error(`events[${i}] 字段 ${k} 不在 schema event properties（additionalProperties:false 纪律；落点承载须复用既有 ox/oy，零新增字段）`);
    if (['click', 'dblclick', 'fill', 'selectOption', 'dragTo'].includes(e.action)) {
      const stable = e.semantic || (e.role && e.accessibleName !== undefined) || e.text || e.fieldLabel || e.dropdownUnit;
      if (!stable) throw new Error(`events[${i}] (${e.action}) 纯坐标步——缺稳定定位字段（禁纯坐标步语义不变，GRILL D2）`);
    }
  }
}

// ---------- C1 编译原子加法 + 例翻反例 ----------
await checkAsync('C1 workflow.addNode 可编译、COMPILE_KNOWN_ATOMS 恰 16、agent.openToolPicker 不可编译', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.isCompilableAtom('workflow.addNode')) throw new Error('workflow.addNode 应可编译（本契约加法）');
  if (!ca.isCompilableAtom('workflow.connectNodes')) throw new Error('workflow.connectNodes 应可编译（连线原子加法）');
  if (ca.COMPILE_KNOWN_ATOMS.size !== 16) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 16（openNode +1），实际 ${ca.COMPILE_KNOWN_ATOMS.size}`);
  if (ca.isCompilableAtom('agent.openToolPicker')) throw new Error('agent.openToolPicker 不应可编译（GRILL D5 继任反例真缝——agent_tool 维度整体压后、长寿反例）');
});

// ---------- C2/C3/C4a/C4b/C4c/C4e：fake-sut happy ----------
const sut = await startFakeSut({ scenario: 'happy' });
try {
  // ---------- C2 compile 全程 ----------
  await checkAsync('C2 compile 全程：events [nav,click,click,dragTo] 钉死、dragTo 源语义+ox/oy、过 events.schema、blockers 空、计数 +1 证据', async () => {
    const g = run([CASEY, 'compile', CASE_ID, '--testcase', TESTCASE, '--flow', FLOW, '--out-dir', outDir]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const fd = readJson(join(outDir, `flow-${CASE_ID}.json`));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(outDir, `flow-${CASE_ID}.json`), fd);
    const x = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', TESTCASE, '--sut', sut.url, '--out-dir', outDir, '--profile', PROFILE, '--skip-login', '--unique-name', 'a1']);
    if (x.status !== 0) throw new Error(`execute 应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-300)}`);
    const ev = readJson(eventsFile);
    const seq = ev.events.map((e) => ({ intentId: e.intentId, action: e.action }));
    if (!deepEq(seq, [
      { intentId: 'intent_0', action: 'nav' },
      { intentId: 'intent_1', action: 'click' },
      { intentId: 'intent_2', action: 'click' }, // 条件步线性化开面板（面板未开必点，镜像 create 下拉先例）
      { intentId: 'intent_2', action: 'dragTo' },
    ])) throw new Error(`events 应恰 [nav(0),click(1),click(2 开面板),dragTo(2)]，实际 ${JSON.stringify(seq)}`);
    if (!JSON.stringify(ev.events[2]).includes('添加节点')) throw new Error(`intent_2 条件步应点「添加节点」开面板，实际 ${JSON.stringify(ev.events[2]).slice(0, 200)}`);
    const drag = ev.events[3];
    if (drag.atom !== 'workflow.addNode') throw new Error(`dragTo 步 atom 应 workflow.addNode，实际 ${drag.atom}`);
    if (!drag.semantic || !drag.semantic.kind || drag.semantic.name !== NODE_NAME) throw new Error(`dragTo 源应经语义定位器锚面板项文本「${NODE_NAME}」（身份门源），实际 ${JSON.stringify(drag.semantic)}`);
    if (drag.ox !== DROP_X || drag.oy !== DROP_Y) throw new Error(`dragTo 落点应写 event ox/oy=${DROP_X}/${DROP_Y}（registry x/y 直译内容参数），实际 ${drag.ox}/${drag.oy}`);
    assertEventsDocAgainstSchema(ev);
    const rep = readJson(reportFile);
    if (!deepEq(rep.blockers || [], [])) throw new Error(`blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    const repText = JSON.stringify(rep);
    // 计数 +1 后置核验证据落 compile-report（见头注落点修正注）：点名 .lf-node 且可见 0→1（或 +1）。
    if (!/lf-node/.test(repText) || !/(0\s*→\s*1|0\s*->\s*1|\+1)/.test(repText)) throw new Error('compile-report 应含 .lf-node 计数 +1 后置核验证据（点名 lf-node + 0→1/+1）');
    if (!deepEq(rep.handoff.assertionAtoms, [
      { intentId: 'intent_1', atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
      { intentId: 'intent_2', atom: 'assert.textVisible', params: { text: NODE_NAME } },
    ])) throw new Error(`assertionAtoms 断链：${JSON.stringify(rep.handoff.assertionAtoms)}`);
    const obs = readJson(observedFile);
    const last = obs.steps[obs.steps.length - 1];
    if (last.urlPathnameAfter !== '/ai-manager/process/detail') throw new Error(`尾步应仍在详情路由（画布拖拽不换页），实际 ${last.urlPathnameAfter}`);
  });

  // ---------- C3 mini 端到端 ----------
  await checkAsync('C3 mini 端到端：draft+patch(countChange up 走 countSelector)→sign→casey run→verdict 恰 3 intent 全 PASS', async () => {
    const draftFile = join(outDir, `expected.draft-${CASE_ID}.json`);
    const patch = writeJson(join(tmp, 'patch.json'), [
      { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' }, // nav 步补硬断言防 INDETERMINATE（e2e-chain 先例）
      { intentId: 'intent_2', kind: 'countChange', op: 'up', value: 1 }, // 画布计数走 profile.countSelector='.lf-node'（GRILL D4 (a) 案）
    ]);
    const d = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', outDir, '--patch', patch]);
    if (d.status !== 0) throw new Error(`draft 应 exit 0，实际 ${d.status}：${(d.stderr || '').slice(-200)}`);
    if ((readJson(draftFile).pending || []).length) throw new Error('pending 应空（onPage/textVisible 均已实现 kind、countChange 走 patch）');
    const prdFixture = writeJson(join(tmp, 'prd.json'), { schemaVersion: 2, caseId: CASE_ID, task: 'wf-add-node hermetic 夹具', testChecksums: {}, stories: [] });
    const frozen = join(outDir, 'expected.frozen.json');
    const s = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixture, '--frozen-out', frozen, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-07T00:00:00.000Z']);
    if (s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${s.status}：${(s.stderr || '').slice(-200)}`);
    const runDir = join(tmp, 'run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozen, '--profile', PROFILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-300)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s2) => s2.intentId).sort(), ['intent_0', 'intent_1', 'intent_2'])) throw new Error(`verdict intent 集应恰 [intent_0..2]，实际 ${JSON.stringify(verdict.steps.map((s2) => s2.intentId))}`);
    const bad = verdict.steps.filter((s2) => s2.verdict !== 'PASS');
    if (bad.length) throw new Error(`应全 PASS（dragTo 分支真跑夹具 + countChange up），败者 ${JSON.stringify(bad.map((s2) => ({ intentId: s2.intentId, verdict: s2.verdict, reason: s2.reason })))}`);
    if (!existsSync(join(runDir, `${CASE_ID}.report.html`))) throw new Error('缺报告 html');
  });

  // ── C4 compile 面反面公共助手：gate→confirm→execute，回 execute 结果与 out-dir ──
  function compileNegative(tag, caseId, addNodeParams) {
    const tc = writeJson(join(tmp, `testcase-${tag}.json`), {
      schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
      intents: [{ intentId: 'intent_nav', text: '进列表' }, { intentId: 'intent_open', text: '开详情' }, { intentId: 'intent_add', text: '拖节点（反面考场）' }],
    });
    const flow = writeJson(join(tmp, `flow-${tag}.json`), {
      id: caseId, name: `addNode 反面考场 ${tag}`, category: 'normal',
      steps: [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: OPEN_NAME } },
        { atom: 'workflow.addNode', params: addNodeParams },
      ],
    });
    const od = join(tmp, `compile-${tag}`);
    const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const fd = readJson(join(od, `flow-${caseId}.json`));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(od, `flow-${caseId}.json`), fd);
    const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sut.url, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag]);
    return { x, od };
  }

  // ---------- C4a 源面板项缺席不拖 ----------
  await checkAsync('C4a 源面板项缺席（none）不拖：execute 65、零 events（半份安全）、无谎报 acted、诊断点名', async () => {
    const { x, od } = compileNegative('c4a', 'tc_wf_addnode_absent', { nodeName: '幽灵节点', x: DROP_X, y: DROP_Y });
    if (x.status !== 65) throw new Error(`源缺席应硬阻断 exit 65（fail-closed），实际 ${x.status}：${(x.stderr || '').slice(-200)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.addNode' && v.action === 'dragTo' && v.acted === true);
    if (lied) throw new Error('源缺席仍 acted=true——身份门破（count===1 才拖，缺席/多匹配照 emit 三态落轴）');
    if (!/幽灵节点|addNode|lf-node/.test(JSON.stringify(rep))) throw new Error(`诊断报告未点名缺席源/计数核验：${JSON.stringify(rep).slice(-200)}`);
  });

  // ---------- C4b 落点出界 → 计数不 +1 进 blockers ----------
  await checkAsync('C4b 落点出界不落（夹具 up 界内才落）：计数不 +1 进 blockers 硬阻断、65 零 events', async () => {
    // 落点是内容参数：出界不许 clamp（clamp = 篡改用例语义假绿向），落不进节点 → 后置核验 .lf-node 计数
    // 不 +1 → run.blockers 硬阻断（镜像 workflow.open 容器归属闸先例）。
    const { x, od } = compileNegative('c4b', 'tc_wf_addnode_oob', { nodeName: NODE_NAME, x: DROP_X, y: 5000 });
    if (x.status !== 65) throw new Error(`计数核验不过应硬阻断 exit 65，实际 ${x.status}：${(x.stderr || '').slice(-200)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/lf-node|计数/.test(btext)) throw new Error(`blockers 应点名 .lf-node 计数不 +1，实际 ${btext.slice(0, 300)}`);
  });

  // ── C4 回放面反面公共助手（p5-replay 形制）：手编 events + 已签 expected → bin/replay → bin/verdict ──
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

  // ---------- C4c 源不在面板域（列表页零 .node-item）→ 同刻门证不出不拖 ----------
  await checkAsync('C4c 源不在面板域（列表页零 .node-item）：同刻门 none/count=0 绝不拖（页面同名文本不越域）、verdict 不 PASS', async () => {
    // codex R1-F2 修：dragTo 源解析锁 .node-item 域（与编译门同一扇门）——列表页行名 td 全页唯一也不算源，
    // 全页 getByText 越域命中被同刻门排除；证不出 → none/0 + 漂移探针，绝不拖、绝不 PASS。
    const caseId = 'tc_wf_addnode_negc';
    const { axes, verdict } = runReplayVerdict('c4c', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/list', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/list' },
        // 列表行名 td 文本全页唯一，但不在 .node-item 域内——源域零命中，同刻门 fail-closed。
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: OPEN_NAME, exact: true }, ox: 120, oy: 80 },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' }] },
        { intentId: 'intent_1', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const ax = stepOf(axes, 'intent_1');
    if (!ax.action || ax.action.resolution !== 'none' || ax.action.candidateCount !== 0) throw new Error(`源不在面板域应 none/count=0（同刻门锁 .node-item 域，全页同名文本不越域），实际 ${JSON.stringify(ax.action)}`);
    const v = stepOf(verdict, 'intent_1');
    if (v.verdict === 'PASS') throw new Error('源不在面板域竟 PASS——假绿（fail-safe 破）');
  });

  // ---------- C4f 落点缺失 → 证不出绝不拖（codex R1-F1 钉红） ----------
  await checkAsync('C4f 落点 ox/oy 缺失：源唯一也绝不拖（不默认 0 拖左上角）、action_failed 不谎报、verdict 不 PASS', async () => {
    // R1-F1：手写/损坏 dragTo event 缺 ox/oy——修前默认 0 拖到画布左上角（界内）落节点、countChange up 假 PASS；
    // 修后落点证不出 → 不动 mouse、action_failed/identityReadback ok:false、verdict 不 PASS。
    const caseId = 'tc_wf_addnode_negf';
    const { axes, verdict } = runReplayVerdict('c4f', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
        // 面板已开、源面板项唯一，但 event 无 ox/oy——落点是内容参数，缺失即证不出（events.schema 本要求必填，
        // 手喂 replay 绕过 schema 正是本反面的考点）。
        { stepId: 'atstep_2', intentId: 'intent_2', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: NODE_NAME, exact: true }, text: NODE_NAME },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_2', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const ax = stepOf(axes, 'intent_2');
    if (!ax.action || ax.action.resolution !== 'action_failed' || ax.action.candidateCount !== 1 || !ax.action.identityReadback || ax.action.identityReadback.ok !== false) {
      throw new Error(`落点缺失应 action_failed/count=1/readback ok:false（源唯一但落点证不出），实际 ${JSON.stringify(ax.action)}`);
    }
    const v = stepOf(verdict, 'intent_2');
    if (v.verdict === 'PASS') throw new Error('落点缺失竟 PASS——默认 0 拖左上角落节点假绿（codex R1-F1 缝）');
  });

  // ---------- C4e 单击不落节点（夹具否定行为） ----------
  await checkAsync('C4e 单击面板项不落节点（夹具否定行为反证）：计数不 +1 → verdict 不 PASS 不假绿', async () => {
    const caseId = 'tc_wf_addnode_nege';
    const { verdict } = runReplayVerdict('c4e', sut.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' },
        // 单击面板项（真机否定行为：单击/双击均不落节点，夹具双守卫复现）——绝不产 .lf-node。
        { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.addNode', action: 'click', semantic: { kind: 'text', name: NODE_NAME, exact: true }, text: NODE_NAME },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    });
    const v = stepOf(verdict, 'intent_1');
    if (v.verdict === 'PASS') throw new Error('单击不落节点竟 PASS——countChange 证不出必须不假绿（护栏 #14）');
  });
} finally {
  await sut.close();
}

// ---------- C4d 源多匹配绝不拖（ambiguous 场景） ----------
const sutAmb = await startFakeSut({ scenario: 'ambiguous' });
try {
  await checkAsync('C4d 源语义多匹配（ambiguous 双保存钮）：fallback_first 绝不拖、verdict 不 PASS', async () => {
    // 收窄注：面板 21 项名唯一，面板内多匹配夹具造不出——借 ambiguous 场景双「保存」钮复现「源语义定位
    // 多匹配」考场（统一身份门辖全部定位分支：count>1 绝不执行变更动作）。
    const caseId = 'tc_wf_addnode_negd';
    const evF = writeJson(join(tmp, 'c4d.events.json'), {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-07T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: '保存', exact: true }, ox: 100, oy: 60 },
      ],
    });
    const exF = writeJson(join(tmp, 'c4d.expected.json'), signExpected({
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'countChange', op: 'up', value: 1 }] },
      ],
    }));
    const prF = writeJson(join(tmp, 'c4d.profile.json'), PROFILE_OBJ);
    const axF = join(tmp, 'c4d.axes.json');
    const vdF = join(tmp, 'c4d.verdict.json');
    const r1 = run([REPLAY, '--events', evF, '--sut', sutAmb.url, '--expected', exF, '--profile', prF, '--out', axF], 180000);
    if (r1.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r1.status}：${(r1.stderr || '').slice(-300)}`);
    const r2 = run([VERDICT, '--axes', axF, '--out', vdF]);
    if (r2.status !== 0) throw new Error(`verdict 应 exit 0，实际 ${r2.status}`);
    const ax = (readJson(axF).steps || []).find((s) => s.intentId === 'intent_1') || {};
    // codex R1-F2 修后语义：同刻门锁 .node-item 域——双「保存」钮是页面级多匹配、不在源域内，
    // 门外多匹配对 dragTo 是「源域零命中」none/0（面板内多匹配 hermetic 造不出：21 项名唯一——收窄注，
    // 门内 >1 走 fallback_first 的分支真机 route:human 观察）。两个方向都绝不拖、绝不 PASS。
    if (!ax.action || ax.action.resolution !== 'none' || ax.action.candidateCount !== 0) throw new Error(`页面级多匹配对同刻门应 none/count=0（.node-item 域外命中不算源），实际 ${JSON.stringify(ax.action)}`);
    const v = (readJson(vdF).steps || []).find((s) => s.intentId === 'intent_1') || {};
    if (v.verdict === 'PASS') throw new Error('源域外多匹配竟 PASS——假绿（绝不拖，护栏 #15）');
  });
} finally {
  await sutAmb.close();
}

// ---------- C5 冻结面自洽 ----------
await checkAsync('C5 冻结面自洽：dragTo 四 schema 枚举全等 + maxItems 8 + 交互支归位 + ox/oy 语义 + 双 fixture 治理条目', async () => {
  const en = ACTION_ENUM;
  if (!Array.isArray(en) || en.length !== 8 || !en.includes('dragTo')) throw new Error(`events.schema action 枚举应恰 8 项且含 dragTo，实际 ${JSON.stringify(en)}`);
  if (!/dragTo/.test(String(EV_SCHEMA.definitions.event.properties.action.description || ''))) throw new Error('events.schema action 描述未按 GRILL D2 口径修订（应点名画布拖拽经 dragTo 封装、落点是内容参数、禁纯坐标步语义不变）');
  const allOf = EV_SCHEMA.definitions.event.allOf || [];
  const dragBranch = allOf.find((b) => JSON.stringify((b.if && b.if.properties && b.if.properties.action) || {}).includes('dragTo') && b.then && Array.isArray(b.then.required));
  if (!dragBranch || !dragBranch.then.required.includes('ox') || !dragBranch.then.required.includes('oy')) throw new Error('events.schema allOf 缺 dragTo 条件分支（then.required 须含 ox 与 oy 落点必填）');
  const interactive = allOf.find((b) => b.if && b.if.properties && b.if.properties.action && Array.isArray(b.if.properties.action.enum) && b.if.properties.action.enum.includes('click'));
  // codex R1-F4 提硬：不许 stringify 含字判（description 里带「semantic」字样即可水过）——必须是结构性必填。
  const srcLocatorPinned = (Array.isArray(dragBranch.then.required) && dragBranch.then.required.includes('semantic'))
    || (interactive && interactive.if.properties.action.enum.includes('dragTo'));
  if (!srcLocatorPinned) throw new Error('dragTo 源语义定位必填未入 schema（本体分支 then.required 含 semantic，或交互定位支 enum 纳入 dragTo，二者须居其一；描述文本不算数）');
  const oxDesc = String((EV_SCHEMA.definitions.event.properties.ox || {}).description || '');
  if (!/dragTo/.test(oxDesc)) throw new Error('ox 字段缺 dragTo 落点语义描述（「相对画布容器左上角的内容参数」，重冻时补）');
  const av = readJson(S('action-vocabulary.schema.json'));
  const cd = readJson(S('channel-driver.schema.json'));
  const rh = readJson(S('run-history.schema.json'));
  if (!deepEq(av.definitions.actionEntry.properties.action.enum, en)) throw new Error('action-vocabulary.schema actionEntry.action.enum 须与 events.schema 枚举全等（含 dragTo）');
  if (!deepEq(cd.definitions.actionCapability.properties.action.enum, en)) throw new Error('channel-driver.schema actionCapability.action.enum 须与 events.schema 枚举全等（含 dragTo）');
  if (!deepEq(rh.definitions.runHistoryLine.properties.action.enum, en)) throw new Error('run-history.schema runHistoryLine.action.enum 须与 events.schema 枚举全等（含 dragTo）');
  if (av.properties.entries.maxItems !== en.length) throw new Error(`action-vocabulary entries.maxItems 应镜像枚举长度 ${en.length}，实际 ${av.properties.entries.maxItems}`);
  // run-history 交互定位支归位：任何 if.action.enum 含 click 的分支须纳入 dragTo（源有定位 → locatorResolution string 支）。
  let rhBranchSeen = false;
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') {
      const e2 = n.if && n.if.properties && n.if.properties.action && n.if.properties.action.enum;
      if (Array.isArray(e2) && e2.includes('click')) {
        rhBranchSeen = true;
        if (!e2.includes('dragTo')) throw new Error(`run-history 交互定位支未纳入 dragTo：${JSON.stringify(e2)}`);
      }
      Object.values(n).forEach(walk);
    }
  })(rh);
  if (!rhBranchSeen) throw new Error('run-history.schema 未找到交互定位支（if.action.enum 含 click）——冻结形状漂移');
  const avf = readJson(F('action-vocabulary.fixture.json'));
  const acts = (avf.entries || []).map((e) => e.action).sort();
  if (!deepEq(acts, [...en].sort())) throw new Error(`action-vocabulary fixture 应覆盖全枚举（v2 golden 强制），实际 ${JSON.stringify(acts)}`);
  const de = (avf.entries || []).find((e) => e.action === 'dragTo');
  if (!de) throw new Error('action-vocabulary fixture 缺 dragTo 治理条目');
  if (!de.coordinateFallback || de.coordinateFallback.allowed !== false) throw new Error('dragTo 治理条目 coordinateFallback.allowed 须 false（落点是内容参数非定位兜底，禁纯坐标红线同族）');
  if (!de.failClosed || de.failClosed.neverSubstitute !== true || de.failClosed.neverSelfHeal !== true) throw new Error('dragTo 治理条目 failClosed 红线须 neverSubstitute/neverSelfHeal 双真');
  const cdf = readJson(F('channel-driver.fixture.json'));
  const web = (cdf.drivers || []).find((d) => d.channel === 'web');
  if (!web || !(web.actionSpace || []).some((a) => a.action === 'dragTo')) throw new Error('channel-driver fixture web 驱动 actionSpace 未声明 dragTo 能力');
});

console.log(`wf-add-node golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
