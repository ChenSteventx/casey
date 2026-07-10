// replay-nth-visible-hardening.golden.mjs —— selectNodeDropdown 同域三修的红先行金牌。
// 决策全录 docs/plans/replay-nth-visible-hardening/proposed/GRILL.md（D1-D3）+ plan.md 验收 C1-C5。
//
// 三修（均加严 fail-closed / 一处注释订正，零冻结 schema 改动）：
//   fix#1 非法 nth 静默降级 index 0 → 硬阻断（replay action_failed / compile blocker exit 65）；缺省 nth 仍默认 0（不动）。
//   fix#2 触发器域锁 .hr-drawer__content-wrapper .hr-select 未限可见 → 补 :visible（照选项侧 .hr-select-option:visible 先例）。
//   fix#3（本金牌不测代码、只锁行为）fake-sut ambiguous 场景注释 resolution=fallback_first → ambiguous 订正。
//
// C1 fix#1 replay：happy + 事件 nth=-1（在场但非非负整数）+ 载 option → 修前静默取 0 真选中回 unique（假绿，点了 index 0）；
//    修后 action_failed（不点、不降级 0）→ identityReadback ok:false → verdict 非 PASS。
// C2 fix#1 compile：happy + flow nth:-1 execute → 修前 coerce 0 产 events exit 0；修后 blocker exit 65 零 events。
// C3 fix#2 replay：ddhidden（抽屉先挂 display:none 隐藏 .hr-select 触发器占 DOM 序 0、再挂真可见触发器）+ 事件 nth=0
//    → 修前域锁未限可见误命中隐藏触发器（点不动）落 action_failed；修后 :visible 只命中真可见触发器 → unique + verdict PASS。
// C4 fix#3 锁：ambiguous 场景回放（两同名「保存」按钮）→ 通用门 gateAndAct count>1 → resolution=ambiguous（钉订正后注释所述行为；
//    修前后皆绿的回归锁——p3-compile 亦钉编译面，CONTEXT.md 第 79 行定多匹配唯一合法字面量=ambiguous）。
// C5 回归零行为差由 prd s2 acceptance 承（p5-replay + 全 fake-sut 消费金牌 + selftest --tier1）。
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
const tmp = mkdtempSync(join(tmpdir(), 'casey-replay-nth-visible-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-500)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };

const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（沿用 openNode 进详情=画布页）
const NODE = '模型节点';
const NODE_X = 320, NODE_Y = 150;
const DD_OPT = '订单库'; // 节点抽屉下拉目标选项（happy/ddhidden 缺省下拉既有项）

const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);

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
// 抽屉族回放 setup（nav→addNode 开面板+落节点→openNode 开抽屉），末步留给各考场追加 selectNodeDropdown。
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

// ── 编译面公共助手（wf-select-node-dropdown 形制）：gate→confirm→execute，回 gate/execute 结果与 out-dir。──
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
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-09T00:00:00.000Z';
  writeJson(join(od, `flow-${caseId}.json`), fd);
  const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sutUrl, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag]);
  return { g, x, od };
}

// ---------- C1 fix#1 replay·非法 nth（happy + nth=-1 + option）→ action_failed 绝不点 index 0 → verdict 非 PASS ----------
await checkAsync('C1 fix#1 replay·非法 nth（happy + 事件 nth=-1 在场但非非负整数 + 载 option）：doSelectNodeDropdown action_failed（不点、不降级 index 0）、identityReadback ok:false → verdict 非 PASS（修前静默取 0 真选中回 unique=假绿红证）', async () => {
  const s = await startFakeSut({ scenario: 'happy' });
  try {
    const caseId = 'tc_rnvh_c1';
    const { axes, verdict } = runReplayVerdict('c1', s.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      // 事件 nth=-1（在场但非非负整数）+ 载 option DD_OPT：修前 coerce 0 点 index 0 真选中回 unique（假绿）。
      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: -1, text: DD_OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
    }, {
      caseId, channel: 'web',
      intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: DD_OPT }] }],
    });
    const ax = stepOf(axes, 'intent_3');
    if (!ax.action || ax.action.resolution !== 'action_failed') throw new Error(`非法 nth 应 action_failed 硬阻断（绝不降级 index 0、绝不点），实际 ${JSON.stringify(ax.action)}`);
    if (ax.action.identityReadback && ax.action.identityReadback.ok === true) throw new Error('非法 nth 竟 identityReadback ok:true——点了 index 0 假绿（护栏 #14/ADR-0007）');
    const v = stepOf(verdict, 'intent_3');
    if (v.verdict === 'PASS') throw new Error('非法 nth 竟 PASS——静默降级 index 0 真选中 fail-open 假绿（护栏 #14，绝不猜首项）');
  } finally { await s.close(); }
});

// ---------- C2 fix#1 compile·非法 nth（happy + flow nth:-1 execute）→ blocker exit 65 零 events ----------
await checkAsync('C2 fix#1 compile·非法 nth（happy + flow selectNodeDropdown nth:-1 execute）：预检非法 nth → blocker exit 65 绝不点、零 events（修前 coerce 0 产 events exit 0 红证）', async () => {
  const s = await startFakeSut({ scenario: 'happy' });
  try {
    const { x, od } = compileFlowCase('c2', 'tc_rnvh_c2', [
      { atom: 'nav.workflowManagement', params: {} },
      { atom: 'workflow.open', params: { openName: OPEN_NAME } },
      { atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y } },
      { atom: 'workflow.openNode', params: { label: NODE } },
      { atom: 'workflow.selectNodeDropdown', params: { option: DD_OPT, nth: -1 } }, // 非法 nth：在场但非非负整数
    ], s.url);
    if (!x || x.status !== 65) throw new Error(`非法 nth 应 execute 预检 blocker exit 65（绝不点、不降级 index 0），实际 ${x && x.status}：${(x && x.stderr || '').slice(-260)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/selectNodeDropdown/.test(btext) || !/非法|nth=-1|nth/.test(btext)) throw new Error(`blockers 应点名非法 nth，实际 ${btext.slice(0, 300)}`);
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.selectNodeDropdown' && v.acted === true);
    if (lied) throw new Error('非法 nth 仍 acted=true——身份门破（选不了照 fail-closed 落轴）');
  } finally { await s.close(); }
});

// ---------- C3 fix#2 replay·隐藏触发器（ddhidden + nth=0）→ :visible 只命中可见触发器 unique → verdict PASS ----------
await checkAsync('C3 fix#2 replay·隐藏触发器（ddhidden：抽屉先挂 display:none 隐藏 .hr-select 触发器占 DOM 序 0、再挂真可见触发器 + 事件 nth=0）：触发器域锁限 :visible 后只命中真可见触发器 → unique + identityReadback ok:true + verdict PASS（修前域锁未限可见误命中隐藏触发器点不动落 action_failed 红证）', async () => {
  const s = await startFakeSut({ scenario: 'ddhidden' });
  try {
    const caseId = 'tc_rnvh_c3';
    const { axes, verdict } = runReplayVerdict('c3', s.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      events: [...setupEvents(), { stepId: 'atstep_4', intentId: 'intent_3', atom: 'workflow.selectNodeDropdown', action: 'click', nth: 0, text: DD_OPT, semantic: { kind: 'text', name: '请选择', exact: true } }],
    }, {
      caseId, channel: 'web',
      intents: [...setupIntents(), { intentId: 'intent_3', expected: [{ kind: 'textVisible', op: 'appears', value: DD_OPT }] }],
    });
    const ax = stepOf(axes, 'intent_3');
    if (!ax.action || ax.action.resolution !== 'unique') throw new Error(`域锁限可见后 nth=0 应只命中真可见触发器 unique（修前误命中隐藏触发器落 action_failed），实际 ${JSON.stringify(ax.action)}`);
    if (ax.action.candidateCount !== 1) throw new Error(`candidateCount 应恰 1（可见浮层内 DD_OPT 唯一），实际 ${ax.action.candidateCount}`);
    if (!(ax.action.identityReadback && ax.action.identityReadback.ok === true)) throw new Error(`应 identityReadback ok:true（真可见触发器值精确含 DD_OPT），实际 ${JSON.stringify(ax.action.identityReadback)}`);
    const v = stepOf(verdict, 'intent_3');
    if (v.verdict !== 'PASS') throw new Error(`ddhidden selectNodeDropdown 应 PASS（:visible 只命中可见触发器真选中），实际 ${v.verdict}/${v.reason}`);
  } finally { await s.close(); }
});

// ---------- C4 fix#3 锁·ambiguous 场景注释订正（resolution=ambiguous 非 fallback_first）----------
await checkAsync('C4 fix#3 锁·ambiguous 场景（两同名「保存」按钮）：通用门 gateAndAct count>1 → resolution=ambiguous（钉订正后注释所述行为，非旧写法 fallback_first；CONTEXT.md 第 79 行）', async () => {
  const s = await startFakeSut({ scenario: 'ambiguous' });
  try {
    const caseId = 'tc_rnvh_c4';
    const { axes } = runReplayVerdict('c4', s.url, {
      schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-09T00:00:00.000Z', authored: false,
      events: [
        { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
        { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.save', action: 'click', semantic: { kind: 'role', role: 'button', name: '保存', exact: true }, text: '保存' },
      ],
    }, {
      caseId, channel: 'web',
      intents: [
        { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }] },
        { intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: '保存' }] },
      ],
    });
    const ax = stepOf(axes, 'intent_1');
    if (!ax.action || ax.action.resolution !== 'ambiguous') throw new Error(`两同名「保存」按钮应 resolution=ambiguous（订正后注释所述；非旧写法 fallback_first），实际 ${JSON.stringify(ax.action)}`);
    if (ax.action.candidateCount !== 2) throw new Error(`candidateCount 应恰 2（两同名保存按钮），实际 ${ax.action.candidateCount}`);
  } finally { await s.close(); }
});

console.log(`replay-nth-visible-hardening golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
