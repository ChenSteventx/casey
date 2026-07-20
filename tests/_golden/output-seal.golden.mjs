// output-seal.golden.mjs —— 全仓输出通道封缝（full）红金牌。实现前多数哨兵红在「输出含种子」断言（现状回显实锤）。
// 缝谱系：docs/plans/output-seal/proposed/AUDIT.md（A1–A13/B1–B8/C 点名）；决策 proposed/GRILL.md D1–D6；改动清单 plan.md。
// 哨兵三断言模式（caseid-echo-mask 形制）：喂含种子标记（SEEDVAL_*，每口独立种子）的坏输入 →
//   a) 退出码与修前语义一致（sign lint 命中仍 65 / readJson 坏 JSON 仍原码 / report 坏 caseId 新闸 65）；
//   b) stderr/stdout 不含种子值（封缝核心断言）；
//   c) 报错仍含可诊断类型词 + intentId/序号类定位（遮值不降诊断）。
// 收窄注记（不立种子哨兵、留实现 + 评审背书，prd observability 记档）：
//   - B5 只哨兵 :199 前置口（AT_CREDS_FILE 缺文件报文携种子路径，hermetic 可喂）；:274/:307/:329 登录期
//     Playwright 报错面需真浏览器在飞语境，hermetic 触发不了 → route:human 真机验证。
//   - B6 收窄为「不含多行栈帧」：坏 events 经 replay :709 兜底 catch，按 plan 剥栈留首行后，首行仍是 V8
//     JSON.parse 报文（自带内容片段）——种子不落断言（AUDIT 未把 replay:162/163 的 JSON.parse 列消毒对象，记发现）。
//   - B7 只哨兵 :295（main 兜底 catch，mkdir 触 ENOTDIR 可喂）；:168 执行段 catch 需真机执行流 → 评审面背书。
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BIN = (n) => join(ROOT, 'bin', n);
const FIX_DRAFT = join(HERE, 'fixtures', 'seams', 'expected-draft.fixture.json');
const FIX_OBSERVED = join(HERE, 'fixtures', 'seams', 'observed-reality.fixture.json');
const FIX_MODEL = join(HERE, 'fixtures', 'seams', 'report-model.fixture.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-output-seal-'));

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-400)}`); } }
function run(args, env) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, env: env || process.env }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wf = (name, data) => { const p = join(tmp, name); writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); return p; };

// 统一哨兵断言：退出码 → 不含种子 → 类型词/定位在场 → （可选）不含多行栈帧。
function assertSeal(r, { label, exit, seeds = [], mustHave = [], noStack = false }) {
  if (r.status !== exit) throw new Error(`${label} 应 exit ${exit}，实际 ${r.status}（stderr 尾：${String(r.stderr || '').slice(-160)}）`);
  const out = (r.stdout || '') + (r.stderr || '');
  for (const s of seeds) if (out.includes(s)) throw new Error(`${label} 输出通道回显了种子「${s}」（封缝核心断言：文件侧值不得上 stderr/stdout）`);
  for (const t of mustHave) if (!out.includes(t)) throw new Error(`${label} 报错缺可诊断定位词「${t}」（遮值不得降诊断）`);
  if (noStack && /\n\s+at /.test(out)) throw new Error(`${label} 输出含多行栈帧（e.stack 须剥栈只留首行 + 截断）`);
}

// 公共夹具
const SIGN = BIN('sign.mjs');
const DRAFT = BIN('draft.mjs');
const COMPILE = BIN('compile.mjs');
const REPLAY = BIN('replay.mjs');
const writePrd = (name, caseId) => wf(name, { schemaVersion: 2, caseId, task: 'output-seal hermetic', testChecksums: {}, stories: [] });
const signArgs = (caseId, draft, prd, frozen) => [SIGN, caseId, '--draft', draft, '--prd', prd, '--frozen-out', frozen, '--signer', 'qa.steven', '--against-build', 'b1'];

// ---------- A1 sign 冻结期 lint：未模板化 atl_ 命中遮值 ----------
check('A1 sign lint atl_ 命中不回显断言值 + 不回显文件侧 intentId', () => {
  const d = readJson(FIX_DRAFT);
  d.intents[0].intentId = 'intent_SEEDVAL_A1ID_x9'; // codex R1-F2：种子塞进 intentId，证明定位不回显文件侧 id
  d.intents[0].expected.push({ kind: 'textVisible', op: 'appears', value: 'atl_SEEDVAL_A1_x9' });
  const r = run(signArgs('tc_sign_probe', wf('a1-draft.json', d), writePrd('a1-prd.json', 'tc_sign_probe'), join(tmp, 'a1-frozen.json')));
  // 定位用结构性下标 intents[0].expected[..]，值与 intentId 两个文件侧种子都不得回显。
  assertSeal(r, { label: 'A1', exit: 65, seeds: ['SEEDVAL_A1_x9', 'SEEDVAL_A1ID_x9'], mustHave: ['未模板化', 'intents['] });
});

// ---------- A2 sign 冻结期 lint：9+ 位数字命中遮值 ----------
check('A2 sign lint 数字长串命中不回显断言值', () => {
  const d = readJson(FIX_DRAFT);
  d.intents[0].expected.push({ kind: 'textVisible', op: 'appears', value: 'SEEDVAL_A2_x9 t=1234567890' });
  const r = run(signArgs('tc_sign_probe', wf('a2-draft.json', d), writePrd('a2-prd.json', 'tc_sign_probe'), join(tmp, 'a2-frozen.json')));
  assertSeal(r, { label: 'A2', exit: 65, seeds: ['SEEDVAL_A2_x9'], mustHave: ['数字长串', 'intents['] });
});

// ---------- A3 draft --patch problems：lib/assertion-draft 两条易变字面量问题遮值 ----------
check('A3 draft 校验闸 problems 不回显补缝断言值（atl_ 与数字长串两形态）', () => {
  const rep = wf('a3-report.json', { caseId: 'tc_workflow_create_smoke', handoff: { assertionAtoms: [] } });
  const patch = wf('a3-patch.json', [
    { intentId: 'intent_1', kind: 'textVisible', op: 'appears', value: 'atl_SEEDVAL_A3A_x9' },
    { intentId: 'intent_1', kind: 'textVisible', op: 'appears', value: 'SEEDVAL_A3B_x9 t=1234567890' },
  ]);
  const r = run([DRAFT, 'tc_workflow_create_smoke', '--observed', FIX_OBSERVED, '--compile-report', rep, '--out-dir', join(tmp, 'a3out'), '--patch', patch]);
  // codex R1-F3：where 定位用结构性下标（不回显 --patch 文件侧 intentId）。
  assertSeal(r, { label: 'A3', exit: 65, seeds: ['SEEDVAL_A3A_x9', 'SEEDVAL_A3B_x9'], mustHave: ['未模板化', '数字长串', 'intents['] });
});

// ---------- A4/A5 sign 两处 caseId 遮值 ----------
check('A4 sign 拒 draft.caseId 不一致时不回显文件侧值', () => {
  const d = readJson(FIX_DRAFT);
  d.caseId = 'SEEDVAL_A4_x9';
  const r = run(signArgs('tc_sign_probe', wf('a4-draft.json', d), writePrd('a4-prd.json', 'tc_sign_probe'), join(tmp, 'a4-frozen.json')));
  assertSeal(r, { label: 'A4', exit: 65, seeds: ['SEEDVAL_A4_x9'], mustHave: ['不一致'] });
});
check('A5 sign 拒 prd.caseId 不一致时不回显文件侧值', () => {
  const r = run(signArgs('tc_sign_probe', wf('a5-draft.json', readJson(FIX_DRAFT)), writePrd('a5-prd.json', 'SEEDVAL_A5_x9'), join(tmp, 'a5-frozen.json')));
  assertSeal(r, { label: 'A5', exit: 65, seeds: ['SEEDVAL_A5_x9'], mustHave: ['不一致'] });
});

// ---------- A6/A7 draft 两处 caseId 遮值 ----------
check('A6 draft 拒 observed.caseId 不一致时不回显文件侧值', () => {
  const obs = wf('a6-observed.json', { caseId: 'SEEDVAL_A6_x9' });
  const rep = wf('a6-report.json', { caseId: 'tc_a6', handoff: { assertionAtoms: [] } });
  const r = run([DRAFT, 'tc_a6', '--observed', obs, '--compile-report', rep, '--out-dir', join(tmp, 'a6out')]);
  assertSeal(r, { label: 'A6', exit: 65, seeds: ['SEEDVAL_A6_x9'], mustHave: ['不一致'] });
});
check('A7 draft 拒 compile-report.caseId 不一致时不回显文件侧值', () => {
  const obs = wf('a7-observed.json', { caseId: 'tc_a7' });
  const rep = wf('a7-report.json', { caseId: 'SEEDVAL_A7_x9', handoff: { assertionAtoms: [] } });
  const r = run([DRAFT, 'tc_a7', '--observed', obs, '--compile-report', rep, '--out-dir', join(tmp, 'a7out')]);
  assertSeal(r, { label: 'A7', exit: 65, seeds: ['SEEDVAL_A7_x9'], mustHave: ['不一致'] });
});

// ---------- A8/A9 compile 两处 caseId 遮值 ----------
check('A8 compile 闸段拒 TestCase.caseId 不一致时不回显文件侧值', () => {
  const tc = wf('a8-tc.json', { caseId: 'SEEDVAL_A8_x9', uniquePrefix: 'ctxtest_' });
  const flow = wf('a8-flow.json', {});
  const r = run([COMPILE, 'tc_a8', '--testcase', tc, '--flow', flow, '--out-dir', join(tmp, 'a8out')]);
  assertSeal(r, { label: 'A8', exit: 65, seeds: ['SEEDVAL_A8_x9'], mustHave: ['不一致'] });
});
check('A9 compile 执行段拒 flow 文件 caseId 不一致时不回显文件侧值', () => {
  const outDir = join(tmp, 'a9out'); mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'flow-tc_a9.json'), JSON.stringify({ caseId: 'SEEDVAL_A9_x9', confirmedBy: 'steven', confirmedAt: '2026-07-07T00:00:00Z', flow: {} }));
  const tc = wf('a9-tc.json', { caseId: 'tc_a9', uniquePrefix: 'ctxtest_' });
  const profile = wf('a9-profile.json', { background: [], successField: 'status', successValue: 200 });
  const r = run([COMPILE, 'tc_a9', '--execute', '--testcase', tc, '--sut', 'http://127.0.0.1:1', '--out-dir', outDir, '--profile', profile]);
  assertSeal(r, { label: 'A9', exit: 65, seeds: ['SEEDVAL_A9_x9'], mustHave: ['不一致'] });
});

// ---------- A10 replay expected/events caseId 遮值（卡在绑定闸，开浏览器之前即退，--sut 可指死端口） ----------
check('A10 replay 拒 caseId 未双向绑定时不回显两文件侧值', () => {
  const events = wf('a10-events.json', { schemaVersion: 2, channel: 'web', caseId: 'SEEDVAL_A10E_x9', url: '{{baseUrl}}/plain', recordedAt: '2026-07-07T00:00:00.000Z', compiledBy: 'golden', authored: false, events: [{ stepId: 'atstep_0', intentId: 'intent_1', atom: 'workflow.create', action: 'nav', url: '{{baseUrl}}/plain' }] });
  const exp = wf('a10-expected.json', signExpected({ caseId: 'SEEDVAL_A10X_x9', channel: 'web', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/plain' }] }], globalAssertions: [] }));
  const profile = wf('a10-profile.json', { background: [], successField: 'status', successValue: 200 });
  const r = run([REPLAY, '--events', events, '--sut', 'http://127.0.0.1:1', '--expected', exp, '--profile', profile, '--out', join(tmp, 'a10-axes.json')]);
  assertSeal(r, { label: 'A10', exit: 65, seeds: ['SEEDVAL_A10E_x9', 'SEEDVAL_A10X_x9'], mustHave: ['绑定'] });
});

// ---------- A11 sign verdict-baseline 键名遮值（非 SAFE_ID 键只报序号） ----------
check('A11 sign 拒坏 verdict-baseline 时不回显键名（含字母数字种子——codex R2-F5：SAFE_ID 挡不住）', () => {
  // 键名用纯字母数字下划线种子 SEEDVAL_A11_x9（会过 SAFE_ID）——结构性 entries[i] 下标才真堵。
  const vb = wf('a11-vb.json', { SEEDVAL_A11_x9: { verdict: 'BOGUS' } });
  const r = run([...signArgs('tc_sign_probe', wf('a11-draft.json', readJson(FIX_DRAFT)), writePrd('a11-prd.json', 'tc_sign_probe'), join(tmp, 'a11-frozen.json')), '--verdict-baseline', vb]);
  assertSeal(r, { label: 'A11', exit: 65, seeds: ['SEEDVAL_A11_x9'], mustHave: ['verdict-baseline', 'entries['] });
});

// ---------- F4 assertion-draft kind/op 非法分支遮值（--patch 任意 kind/op 可携种子） ----------
check('F4 draft kind/op 不过词表时不回显文件侧 kind/op 原值（codex R2-F4）', () => {
  const rep = wf('f4-report.json', { caseId: 'tc_f4', handoff: { assertionAtoms: [] } });
  const patch = wf('f4-patch.json', [{ intentId: 'intent_1', kind: 'SEEDVAL_F4K_x9', op: 'SEEDVAL_F4O_x9', value: 'x' }]);
  const r = run([DRAFT, 'tc_f4', '--observed', wf('f4-observed.json', { caseId: 'tc_f4' }), '--compile-report', rep, '--out-dir', join(tmp, 'f4out'), '--patch', patch]);
  assertSeal(r, { label: 'F4', exit: 65, seeds: ['SEEDVAL_F4K_x9', 'SEEDVAL_F4O_x9'], mustHave: ['词表硬闸', 'intents['] });
});

// ---------- A12 report 坏 caseId 新闸（穿越面：值进文件名/路径构造）——exit 65 + 零落盘 + 不回显 ----------
function reportModelWith(caseId, name) {
  const m = readJson(FIX_MODEL);
  m.caseId = caseId;
  return wf(name, m);
}
function assertNoSeedFile(dir, frag, label) {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) if (n.includes(frag)) throw new Error(`${label} 落了含种子的文件（穿越面须零落盘）：${n}`);
}
check('A12a report 拒含 ../ 穿越 caseId：exit 65 + 不落文件 + 不回显', () => {
  const outer = join(tmp, 'a12a'); const outDir = join(outer, 'inner'); mkdirSync(outDir, { recursive: true });
  const r = run([BIN('report.mjs'), '--model', reportModelWith('../SEEDVAL_A12A_x9', 'a12a-model.json'), '--out', outDir]);
  assertSeal(r, { label: 'A12a', exit: 65, seeds: ['SEEDVAL_A12A'], mustHave: ['非法字符'] });
  assertNoSeedFile(outer, 'SEEDVAL_A12A', 'A12a');
  assertNoSeedFile(outDir, 'SEEDVAL_A12A', 'A12a');
});
check('A12b report 拒非法字符 caseId：exit 65 + 不落文件 + 不回显', () => {
  const outDir = join(tmp, 'a12b-out');
  const r = run([BIN('report.mjs'), '--model', reportModelWith('SEEDVAL@A12B!x9', 'a12b-model.json'), '--out', outDir]);
  assertSeal(r, { label: 'A12b', exit: 65, seeds: ['SEEDVAL@A12B'], mustHave: ['非法字符'] });
  assertNoSeedFile(outDir, 'A12B', 'A12b');
});

// ---------- A13 compile-gate 破坏性实体名遮值（step 序号定位保留） ----------
check('A13 compile 闸段拒无前缀实体名时不回显实体名原值', () => {
  const tc = wf('a13-tc.json', { caseId: 'tc_a13', uniquePrefix: 'ctxtest_', preconditions: ['已登录'] });
  const flow = wf('a13-flow.json', { id: 'f_a13', name: 'a13 探针', steps: [{ atom: 'workflow.create', params: { name: 'SEEDVAL_A13_x9' } }] });
  const r = run([COMPILE, 'tc_a13', '--testcase', tc, '--flow', flow, '--out-dir', join(tmp, 'a13out')]);
  assertSeal(r, { label: 'A13', exit: 65, seeds: ['SEEDVAL_A13_x9'], mustHave: ['前缀', 'step[0]'] });
});

// ---------- B1/B2/B3/B8 四 CLI 坏 JSON 消毒（V8 JSON.parse 报错自带内容片段） ----------
const BAD_JSON = (seed) => `{"k": ${seed}}`;
check('B1 sign readJson 坏 draft JSON 不透传内容片段', () => {
  const bad = wf('b1-draft.json', BAD_JSON('SEEDVAL_B1_x9'));
  const r = run(signArgs('tc_b1', bad, join(tmp, 'b1-prd.json'), join(tmp, 'b1-frozen.json')));
  assertSeal(r, { label: 'B1', exit: 65, seeds: ['SEEDVAL_B1_x9'], mustHave: ['读/解析', '失败'] });
});
check('B2 draft readJson 坏 observed JSON 不透传内容片段', () => {
  const bad = wf('b2-observed.json', BAD_JSON('SEEDVAL_B2_x9'));
  const r = run([DRAFT, 'tc_b2', '--observed', bad, '--compile-report', join(tmp, 'none.json'), '--out-dir', join(tmp, 'b2out')]);
  assertSeal(r, { label: 'B2', exit: 65, seeds: ['SEEDVAL_B2_x9'], mustHave: ['读/解析', '失败'] });
});
check('B3 compile readJson 坏 TestCase JSON 不透传内容片段', () => {
  const bad = wf('b3-tc.json', BAD_JSON('SEEDVAL_B3_x9'));
  const r = run([COMPILE, 'tc_b3', '--testcase', bad, '--flow', wf('b3-flow.json', {}), '--out-dir', join(tmp, 'b3out')]);
  assertSeal(r, { label: 'B3', exit: 65, seeds: ['SEEDVAL_B3_x9'], mustHave: ['读/解析', '失败'] });
});
check('B8 verdict 坏 axes JSON 不透传内容片段（裁判面，退出码 65 不变）', () => {
  const bad = wf('b8-axes.json', BAD_JSON('SEEDVAL_B8_x9'));
  const r = run([BIN('verdict.mjs'), '--axes', bad, '--out', join(tmp, 'b8-verdict.json')]);
  assertSeal(r, { label: 'B8', exit: 65, seeds: ['SEEDVAL_B8_x9'], mustHave: ['axes', '读/解析'] });
});

// ---------- B4 report-model 坏 case-meta JSON 消毒（大 catch 面，退出码 1 不变） ----------
check('B4 report-model 坏 case-meta JSON 不透传内容片段', () => {
  const v = wf('b4-verdict.json', {}); const a = wf('b4-axes.json', {});
  const bad = wf('b4-meta.json', BAD_JSON('SEEDVAL_B4_x9'));
  const r = run([BIN('report-model.mjs'), '--verdict', v, '--axes', a, '--case-meta', bad, '--out', join(tmp, 'b4-model.json')]);
  assertSeal(r, { label: 'B4', exit: 1, seeds: ['SEEDVAL_B4_x9'], mustHave: ['装配失败'] });
});

// ---------- B5 replay 登录期前置口（:199）：报文只留 e.name + 固定文案，不携路径/内容 ----------
// 收窄：:274/:307/:329 登录期 Playwright 在飞报错 hermetic 触发不了 → 不立哨兵，真机验证 route:human（prd 记档）。
check('B5 replay 登录预备动作前置失败报文不携 AT_CREDS_FILE 路径（种子目录名）', () => {
  const url = '{{baseUrl}}/ai-manager/process/list';
  const events = wf('b5-events.json', { schemaVersion: 2, channel: 'web', caseId: 'tc_b5', url, recordedAt: '2026-07-07T00:00:00.000Z', compiledBy: 'golden', authored: false, events: [{ stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.workflowManagement', action: 'nav', url }] });
  const exp = wf('b5-expected.json', signExpected({ caseId: 'tc_b5', channel: 'web', intents: [{ intentId: 'intent_1', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' }] }], globalAssertions: [] }));
  const profile = wf('b5-profile.json', { background: [], successField: 'status', successValue: 200 });
  const site = wf('b5-site-config.json', {});
  const launchSentinel = join(tmp, 'b5-launch.sentinel');
  const env = { ...process.env, AT_SITE_JSON: site, AT_CREDS_FILE: join(tmp, 'SEEDVAL_B5_x9dir', 'creds.json'), CASEY_LAUNCH_SENTINEL: launchSentinel };
  delete env.AT_CREDS_USER; delete env.AT_CREDS_PASS;
  const r = run([REPLAY, '--events', events, '--sut', 'http://127.0.0.1:1', '--expected', exp, '--profile', profile, '--out', join(tmp, 'b5-axes.json'), '--login-bootstrap'], env);
  assertSeal(r, { label: 'B5', exit: 65, seeds: ['SEEDVAL_B5_x9dir'], mustHave: ['登录预备动作'] });
  if (existsSync(launchSentinel)) throw new Error('B5 控制流越过浏览器启动前门（CASEY_LAUNCH_SENTINEL 已写）');
});

// ---------- B6 replay events 坏 JSON 消毒（追加发现 #1 提硬）----------
// 原设计只断「不含多行栈帧」——但剥栈后首行仍是 V8 JSON.parse 报文（携内容片段）。loop 段照 B1-B3/B8
// 同款把 events/expected/profile 裸 parse 收进消毒 readJsonSafe（exit 65），此处随之提硬为「种子遮蔽」真断言。
check('B6 replay events 坏 JSON 消毒（不透传内容片段，退出码 65）', () => {
  const bad = wf('b6-events.json', BAD_JSON('SEEDVAL_B6_x9'));
  const r = run([REPLAY, '--events', bad, '--sut', 'http://127.0.0.1:1', '--expected', join(tmp, 'none.json'), '--profile', join(tmp, 'none.json'), '--out', join(tmp, 'b6-axes.json')]);
  assertSeal(r, { label: 'B6', exit: 65, seeds: ['SEEDVAL_B6_x9'], mustHave: ['读/解析', '失败'], noStack: true });
});

// ---------- B7 compile main 兜底 catch（:295）剥栈——收窄断「不含多行栈帧」（:168 执行段留评审面） ----------
check('B7 compile 兜底 catch 不打多行栈帧（mkdir ENOTDIR 触 main catch，退出码 1 不变）', () => {
  const tc = wf('b7-tc.json', { caseId: 'tc_b7', uniquePrefix: 'ctxtest_', preconditions: ['已登录'] });
  const flow = wf('b7-flow.json', { id: 'f_b7', name: 'b7 探针', steps: [{ atom: 'workflow.create', params: { name: 'ctxtest_b7' } }] });
  const r = run([COMPILE, 'tc_b7', '--testcase', tc, '--flow', flow, '--out-dir', '/dev/null/x']);
  assertSeal(r, { label: 'B7', exit: 1, mustHave: ['compile 失败'], noStack: true });
});

// ---------- C 点名：ingest / flow-bridge 凭据门命中报文不携原始输入路径（种子埋目录名） ----------
check('C-ingest 凭据门拦截输入的报文不携 --in 原始路径', () => {
  const dir = join(tmp, 'SEEDVAL_C1_x9dir'); mkdirSync(dir, { recursive: true });
  const cand = join(dir, 'cand.json'); writeFileSync(cand, '{"note":"password=abc"}');
  const r = run([BIN('ingest.mjs'), 'tc_c1', '--in', cand, '--out-dir', join(tmp, 'c1out')]);
  assertSeal(r, { label: 'C-ingest', exit: 1, seeds: ['SEEDVAL_C1_x9dir'], mustHave: ['凭据兜底门'] });
});
check('C-flow-bridge 凭据门拦截输入的报文不携 --testcase/--mapping 原始路径', () => {
  const dir = join(tmp, 'SEEDVAL_C2_x9dir'); mkdirSync(dir, { recursive: true });
  const tc = join(dir, 'tc.json'); writeFileSync(tc, '{"note":"password=abc"}');
  const map = join(dir, 'map.json'); writeFileSync(map, '[]');
  const r = run([BIN('flow-bridge.mjs'), 'tc_c2', '--testcase', tc, '--mapping', map, '--out-dir', join(tmp, 'c2out')]);
  assertSeal(r, { label: 'C-flow-bridge', exit: 1, seeds: ['SEEDVAL_C2_x9dir'], mustHave: ['凭据兜底门'] });
});

// ---------- inbox 过门：term-judge 路由人写 loop/inbox.md 前过凭据门（命中拒写非零退出） ----------
check('inbox term-judge 候选携凭据形种子 → 拒写非零退出 + inbox 不含种子', () => {
  const cands = wf('c4-cands.json', [{ type: 'metaphor', span: 'password=SEEDVAL_C4_x9' }]);
  const inbox = join(tmp, 'c4-inbox.md');
  const r = run([BIN('term-judge.mjs'), '--candidates', cands, '--stub', 'uncertain', '--inbox', inbox]);
  if (r.status === 0) throw new Error(`inbox 应过凭据门命中拒写非零退出（与七落盘口同律），实际 exit 0`);
  if (existsSync(inbox) && readFileSync(inbox, 'utf8').includes('SEEDVAL_C4_x9')) throw new Error('inbox 落盘含种子（写入未过凭据门）');
  const out = (r.stdout || '') + (r.stderr || '');
  if (out.includes('SEEDVAL_C4_x9')) throw new Error('term-judge 输出通道回显了种子');
});

// ---------- candidates 过门：term-guard --emit-candidates 落盘前过凭据门 ----------
check('candidates term-guard 候选携凭据形种子 → 拒写非零退出 + 文件不含种子', () => {
  const text = wf('c3-text.txt', '普通说明一句，PasswordSeedvalC3x9（口令种子说明）。\n');
  const cands = join(tmp, 'c3-cands.json');
  const r = run([BIN('term-guard.mjs'), '--text', text, '--emit-candidates', cands]);
  if (r.status === 0) throw new Error(`candidates 应过凭据门命中拒写非零退出（与七落盘口同律），实际 exit 0`);
  if (existsSync(cands) && readFileSync(cands, 'utf8').includes('SeedvalC3x9')) throw new Error('candidates 落盘含种子（写入未过凭据门）');
});

console.log(`output-seal golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
