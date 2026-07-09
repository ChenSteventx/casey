// ingest-scaffold.golden.mjs —— 相0 前段脚手架（scaffold-case，full）红金牌。
// 实现前 bin/scaffold-case.mjs 缺席、casey.mjs 无 scaffold-case 分发、help 无 casey scaffold-case → C1 起全红
//（C8 selftest 不依赖 scaffold-case，是实现后不回归的回归锁，非红先行项）。
//
// 归一脚手架：把一段自由文本零 LLM 包成 schema 合规的候选骨架（source.kind:'freetext' + source.raw 泊原文 +
// 一条 route:human 占位步），开箱过 parseTestCase；真实归一（切分意图/填 actionHint）仍是 CLI 外 LLM 的活，
// 改完经 casey ingest 重新入场。反夹具纪律：happy 路径复现真接缝——真写自由文本 → 真 casey scaffold-case 产骨架
// → 真 casey ingest 收下（相0 前段→相0 归一闸贯通）；mock LLM 归一候选 = 内联夹具，绝不烧真 LLM。
//
// C1 门面+用法错；C2 前置凭据门（自由文本头号凭据向量）；C3 候选骨架形态（单占位步不臆断切分/URL 不剥/字节可复现）；
// C4 候选真过 parseTestCase 闸 + 真被 ingest 收下（骨架直入 + mock LLM 归一后入场）；C5 畸形候选被闸拒（不 create bypass）；
// C6 不改冻结 schema + 降权硬不变量；C7 输出卫生（output-seal）；C8 门面回归（selftest --tier1）。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SCHEMA_FILE = join(HERE, 'schemas', 'testcase.schema.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-scaffold-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
// 真接缝统一走 casey.mjs 门面（GOLDEN-TESTPLAN 测试骨架：run = spawnSync(node,[casey.mjs,...args])）。
function run(args) { return spawnSync(process.execPath, [CASEY, ...args], { encoding: 'utf8', timeout: 60000 }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const outText = (r) => (r.stdout || '') + (r.stderr || '');

const CASE_ID = 'tc_scaffold';
// 自由文本用例原文：无凭据、含一条合法 authoring URL（测 C3e「source.raw 不剥 URL」）。
const FREE_TEXT = [
  '在工作流管理页新增一条名为 atl_demo 的工作流。',
  '填写名称后点击保存按钮。',
  '打开 https://example.invalid/ai-manager/process/list 确认列表里出现该工作流。',
].join('\n');
// 脏自由文本：含英文凭据关键词 password（自由文本是头号凭据粘贴向量）→ 前置凭据门 exit 1。
const DIRTY_TEXT = '登录后把 password: hunter2 粘到名称输入框，再进入列表页确认。';

function writeText(s, name) { const f = join(tmp, name); writeFileSync(f, s); return f; }
function writeCand(obj, name) { const f = join(tmp, name); writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; }
const candPath = (outDir, caseId = CASE_ID) => join(outDir, `scaffold-candidate-${caseId}.json`);
const tcPath = (outDir, caseId = CASE_ID) => join(outDir, `testcase-${caseId}.json`);
// 真接缝：写自由文本 → casey scaffold-case → 候选骨架。返回 { r, dir, cand（若落盘）}。
function scaffold(caseId, freeTextPath, outDir) { return run(['scaffold-case', caseId, '--from-text', freeTextPath, '--out-dir', outDir]); }
function ingest(caseId, inFile, outDir) { mkdirSync(outDir, { recursive: true }); return run(['ingest', caseId, '--in', inFile, '--out-dir', outDir]); }

// happy 真接缝产物（多用例共用）：真写自由文本 → 真 scaffold-case 产骨架。
const HAPPY_FT = writeText(FREE_TEXT, 'free-text.txt');
const HAPPY_OUT = join(tmp, 'scaffold-happy');
const HAPPY_R = scaffold(CASE_ID, HAPPY_FT, HAPPY_OUT);
const HAPPY_CAND = existsSync(candPath(HAPPY_OUT)) ? readJson(candPath(HAPPY_OUT)) : null;

// ---------- C1 门面 + 用法错 ----------
await checkAsync('C1a casey.mjs help 源码暴露 casey scaffold-case 命令', async () => {
  if (!readFileSync(CASEY, 'utf8').includes('casey scaffold-case')) throw new Error('casey.mjs 未在 help 暴露 casey scaffold-case');
});
await checkAsync('C1b 缺 caseId → exit 64（真用法串含 --from-text，非未知命令假绿）', async () => {
  const r = run(['scaffold-case']);
  if (r.status !== 64) throw new Error(`缺 caseId 应 exit 64，实际 ${r.status}`);
  if (!outText(r).includes('--from-text')) throw new Error('应落 scaffold-case 真用法（含 --from-text），非 casey default 未知命令分支');
});
await checkAsync('C1c 缺 --from-text/--out-dir → exit 64', async () => {
  const r1 = run(['scaffold-case', CASE_ID]);
  if (r1.status !== 64) throw new Error(`缺 --from-text 应 exit 64，实际 ${r1.status}`);
  if (!outText(r1).includes('--from-text')) throw new Error('缺 --from-text 应落真用法串');
  const r2 = run(['scaffold-case', CASE_ID, '--from-text', HAPPY_FT]);
  if (r2.status !== 64) throw new Error(`缺 --out-dir 应 exit 64，实际 ${r2.status}`);
  if (!outText(r2).includes('--out-dir')) throw new Error('缺 --out-dir 应落真用法串');
});
await checkAsync('C1d 裸旗标（--from-text 无值被解析成 true）→ exit 64', async () => {
  const r = run(['scaffold-case', CASE_ID, '--from-text', '--out-dir', join(tmp, 'c1d')]);
  if (r.status !== 64) throw new Error(`裸旗标应 exit 64（不得写到 ./true），实际 ${r.status}`);
  if (!outText(r).includes('--from-text')) throw new Error('裸旗标应落真用法串');
});
await checkAsync('C1e caseId 穿越/斜杠 → exit 65，原值不回显', async () => {
  const r1 = run(['scaffold-case', '../../escape', '--from-text', HAPPY_FT, '--out-dir', join(tmp, 'c1e-a')]);
  if (r1.status !== 65) throw new Error(`caseId 穿越应 exit 65，实际 ${r1.status}`);
  if (outText(r1).includes('escape')) throw new Error('穿越 caseId 报错不得回显原值');
  const r2 = run(['scaffold-case', 'a/b', '--from-text', HAPPY_FT, '--out-dir', join(tmp, 'c1e-b')]);
  if (r2.status !== 65) throw new Error(`caseId 含斜杠应 exit 65，实际 ${r2.status}`);
});
await checkAsync('C1f caseId 命中凭据门（含 token/password 子串）→ exit 65，原值不回显', async () => {
  for (const bad of ['mytoken', 'passwordcase']) {
    const r = run(['scaffold-case', bad, '--from-text', HAPPY_FT, '--out-dir', join(tmp, `c1f-${bad}`)]);
    if (r.status !== 65) throw new Error(`caseId「${bad}」命中凭据门应 exit 65，实际 ${r.status}`);
    if (outText(r).includes(bad)) throw new Error(`凭据形 caseId「${bad}」报错不得回显原值`);
  }
});
await checkAsync('C1g 涟漪守：casey help 无过时形态 --sut <url>；scaffold-case help 行带 --from-text/--out-dir', async () => {
  const h = run(['help']);
  const txt = outText(h);
  if (txt.includes('--sut <url>')) throw new Error('casey help 不得含过时形态 --sut <url>（handover-pack C2 黑名单）');
  if (!/casey scaffold-case[^\n]*--from-text <f>[^\n]*--out-dir <d>/.test(txt)) throw new Error('scaffold-case help 行须带 --from-text <f> --out-dir <d>');
});

// ---------- C2 前置凭据门（护栏 #7，自由文本头号凭据向量） ----------
await checkAsync('C2 脏自由文本（含 password）→ exit 1、零骨架落盘、零目录副作用、脏值不回显', async () => {
  const dirty = writeText(DIRTY_TEXT, 'dirty.txt');
  const od = join(tmp, 'c2-fresh'); // 不预建：命中即拒须零目录副作用
  const r = run(['scaffold-case', CASE_ID, '--from-text', dirty, '--out-dir', od]);
  if (r.status !== 1) throw new Error(`前置凭据门应 exit 1，实际 ${r.status}`);
  if (!/凭据|护栏/.test(outText(r))) throw new Error('exit 1 须出自凭据门点名（防与 MODULE_NOT_FOUND 撞码假绿）');
  if (existsSync(candPath(od))) throw new Error('凭据命中不得落骨架（零骨架落盘）');
  if (existsSync(od)) throw new Error('凭据命中不得创建 out-dir（零目录副作用，前置门早于 mkdir）');
  if (outText(r).includes('hunter2')) throw new Error('凭据门报错不得回显脏值');
});

// ---------- C3 候选骨架（happy，exit 0） ----------
await checkAsync('C3a happy exit 0；out-dir 恰含 scaffold-candidate-<caseId>.json 一件，无 events/expected/testcase/prd 副产物', async () => {
  if (HAPPY_R.status !== 0) throw new Error(`happy 应 exit 0，实际 ${HAPPY_R.status}：${(HAPPY_R.stderr || '').slice(-200)}`);
  const files = readdirSync(HAPPY_OUT);
  if (files.length !== 1 || files[0] !== `scaffold-candidate-${CASE_ID}.json`) throw new Error(`out-dir 应恰含候选一件，实际 ${JSON.stringify(files)}`);
});
await checkAsync('C3b schemaVersion/caseId/source.kind/source.raw（逐字节）/uniquePrefix 严守形态', async () => {
  const c = HAPPY_CAND;
  if (!c) throw new Error('候选未落盘');
  if (c.schemaVersion !== 1) throw new Error(`schemaVersion 应为 1，实际 ${c.schemaVersion}`);
  if (c.caseId !== CASE_ID) throw new Error('caseId 应与入参一致');
  if (c.source.kind !== 'freetext') throw new Error(`source.kind 应为 freetext，实际 ${c.source.kind}`);
  if (c.source.raw !== FREE_TEXT) throw new Error('source.raw 应逐字节泊自由文本原文');
  if (c.uniquePrefix !== 'atl_') throw new Error(`uniquePrefix 应为 atl_，实际 ${c.uniquePrefix}`);
});
await checkAsync('C3c 单占位步（不臆断切分）：steps.length===1、i1、route:human、reason 非空', async () => {
  const c = HAPPY_CAND;
  if (!Array.isArray(c.steps) || c.steps.length !== 1) throw new Error(`零 LLM 不臆断切分：应恰 1 条占位步，实际 ${c.steps && c.steps.length}`);
  const s = c.steps[0];
  if (s.intentId !== 'i1') throw new Error(`占位步 intentId 应为 i1，实际 ${s.intentId}`);
  if (s.route !== 'human') throw new Error('占位步 route 应为 human（诚实桩，不臆造自动化步）');
  if (typeof s.reason !== 'string' || !/\S/.test(s.reason)) throw new Error('占位步 reason 须非空（route:human ⟹ reason）');
  if (!/占位|归一/.test(s.reason)) throw new Error('占位步 reason 须留脚手架占位痕迹');
});
await checkAsync('C3d 严守 parseTestCase 契约：无 expected、无 target、source 键 ⊆ {kind,raw,ingestedAt}', async () => {
  const c = HAPPY_CAND;
  if ('target' in c) throw new Error('候选骨架不得含 target（不臆造 startUrl）');
  for (const s of c.steps) if ('expected' in s) throw new Error('候选骨架步不得含 expected（断言归相2）');
  const allowed = new Set(['kind', 'raw', 'ingestedAt']);
  for (const k of Object.keys(c.source)) if (!allowed.has(k)) throw new Error(`source 含闭合外键「${k}」（否则被 parseTestCase 拒）`);
});
await checkAsync('C3e source.raw 保留自由文本里的合法 URL（不剥 URL，与 distill C6a 显式差异）', async () => {
  if (!HAPPY_CAND.source.raw.includes('https://example.invalid/ai-manager/process/list')) throw new Error('source.raw 应保留 authoring URL（护栏 #7 边界是 site.json 目标地址，非任何 URL）');
});
await checkAsync('C3f 确定性可复现：同一自由文本连跑两次，候选文件逐字节一致', async () => {
  const od2 = join(tmp, 'scaffold-repro');
  const r = scaffold(CASE_ID, HAPPY_FT, od2);
  if (r.status !== 0) throw new Error(`复现跑应 exit 0，实际 ${r.status}`);
  const a = readFileSync(candPath(HAPPY_OUT), 'utf8');
  const b = readFileSync(candPath(od2), 'utf8');
  if (a !== b) throw new Error('候选文件应逐字节一致（纯函数无时刻字段，可进 golden 真值）');
});

// ---------- C4 候选真过 parseTestCase 闸 + 真被 ingest 收下（核心 hermetic 验收，复现真接缝） ----------
await checkAsync('C4a 骨架直入：casey ingest 收下候选骨架 → exit 0，产合规 testcase-<caseId>.json（单 route:human 兜底基线）', async () => {
  const od = join(tmp, 'c4a-ingest');
  const r = ingest(CASE_ID, candPath(HAPPY_OUT), od);
  if (r.status !== 0) throw new Error(`候选骨架应真过 parseTestCase 闸 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const tc = readJson(tcPath(od));
  if (tc.source.kind !== 'freetext') throw new Error('产物 source.kind 应为 freetext');
  if (tc.steps.length !== 1 || tc.steps[0].route !== 'human') throw new Error('产物应为单 route:human 步的兜底基线合规 TestCase');
});
await checkAsync('C4b mock LLM 归一后入场：内联把 source.raw 切成真实自动化步 → casey ingest exit 0（绝不烧真 LLM）', async () => {
  // mock 候选 = CLI 外 LLM 编辑骨架后的产物：补真实意图步（intentId 全局唯一 / actionHint 枚举 / inputValue 模板化）、去 route:human。
  const mock = structuredClone(HAPPY_CAND);
  mock.steps = [
    { intentId: 'i1', intent: '新增工作流 atl_{{uniqueName}}', actionHint: 'fill', inputValue: 'atl_{{uniqueName}}' },
    { intentId: 'i2', intent: '保存工作流', actionHint: 'click' },
    { intentId: 'i3', intent: '打开流程列表确认', actionHint: 'navigate' },
  ];
  const od = join(tmp, 'c4b-ingest');
  const r = ingest(CASE_ID, writeCand(mock, 'c4b-mock.json'), od);
  if (r.status !== 0) throw new Error(`mock LLM 归一候选应真过 ingest exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const tc = readJson(tcPath(od));
  if (tc.steps.length !== 3 || tc.steps.some((s) => s.route === 'human')) throw new Error('归一后产物应为 3 条真实自动化步（无 route:human）');
});

// ---------- C5 畸形候选被闸拒（fail-closed，脚手架不 create bypass） ----------
await checkAsync('C5 CLI 外 LLM 把骨架改坏，ingest 照旧 fail-closed exit 65（不新造闸、不弱化既有闸）', async () => {
  const base = HAPPY_CAND;
  const mock3 = structuredClone(base);
  mock3.steps = [
    { intentId: 'i1', intent: '步一', actionHint: 'fill', inputValue: 'atl_{{uniqueName}}' },
    { intentId: 'i2', intent: '步二', actionHint: 'click' },
  ];
  const cases = [
    ['a-删 uniquePrefix', structuredClone(base), (c) => { delete c.uniquePrefix; }],
    ['b-intentId 重复', mock3, (c) => { c.steps[1].intentId = 'i1'; }],
    ['c-source.kind 未知值', structuredClone(base), (c) => { c.source.kind = 'teach-in'; }],
    ['d-route:human 删 reason', structuredClone(base), (c) => { delete c.steps[0].reason; }],
    ['e-source 闭合外键 signed:false', structuredClone(base), (c) => { c.source.signed = false; }],
  ];
  for (const [tag, obj, mut] of cases) {
    const c = structuredClone(obj); mut(c);
    const od = join(tmp, `c5-${tag}`);
    const r = ingest(CASE_ID, writeCand(c, `c5-${tag}.json`), od);
    if (r.status !== 65) throw new Error(`畸形候选「${tag}」应 exit 65，实际 ${r.status}`);
    if (existsSync(tcPath(od))) throw new Error(`畸形候选「${tag}」拒后不得落半份 testcase`);
  }
});

// ---------- C6 不改冻结 schema + 降权硬不变量 ----------
await checkAsync('C6a 棘轮守：testcase.schema.json 未被改——source.kind enum 仍含 freetext、source additionalProperties:false 仍在', async () => {
  const schema = readJson(SCHEMA_FILE);
  const kinds = schema.definitions.source.properties.kind.enum;
  if (!Array.isArray(kinds) || !kinds.includes('freetext')) throw new Error('source.kind enum 应仍含 freetext（脚手架靠既有模态、不改 schema）');
  if (schema.definitions.source.additionalProperties !== false) throw new Error('source additionalProperties 应仍为 false');
});
await checkAsync('C6b 降权负向不变量：绝不产 events/expected.frozen/prd 文件，候选无 signed:true/replayReady:true', async () => {
  const files = readdirSync(HAPPY_OUT);
  const banned = files.filter((n) => /events\.json$|expected\.frozen\.json$|^prd-|\.frozen\.json$/.test(n));
  if (banned.length) throw new Error(`脚手架不得产降权外产物：${banned.join(',')}`);
  const c = HAPPY_CAND;
  if (c.signed === true || c.replayReady === true) throw new Error('候选不得自标 signed/replayReady 为 true');
  const raw = readFileSync(candPath(HAPPY_OUT), 'utf8');
  if (/"replayReady"\s*:\s*true|"signed"\s*:\s*true/.test(raw)) throw new Error('候选文本不得含 signed/replayReady:true');
});
await checkAsync('C6c 候选无处自标非权威（source 键闭合）；降权靠文件名 + stdout 落地提示（归一/人签）', async () => {
  // source 键闭合已由 C3d 守；此处钉降权落地提示。
  const txt = HAPPY_R.stdout || '';
  if (!txt.includes(`scaffold-candidate-${CASE_ID}.json`)) throw new Error('成功 stdout 须报定名产物 scaffold-candidate-<caseId>.json');
  if (!/归一/.test(txt) || !/人签/.test(txt)) throw new Error('成功 stdout 须含降权落地提示（候选非权威、须 CLI 外 LLM 归一 + 人签才算数）');
});

// ---------- C7 输出卫生（护栏 #7，output-seal） ----------
await checkAsync('C7a 成功 stdout 不回显 --from-text/--out-dir 用户绝对路径', async () => {
  const echoed = (HAPPY_R.stdout || '') + (HAPPY_R.stderr || '');
  if (echoed.includes(HAPPY_FT)) throw new Error('stdout 不得回显 --from-text 绝对路径');
  if (echoed.includes(HAPPY_OUT)) throw new Error('stdout 不得回显 --out-dir 绝对路径');
});
await checkAsync('C7c 候选骨架过 credentialGate（干净原文进、干净原文出）', async () => {
  const { credentialGate } = await import(`file://${join(ROOT, 'lib', 'cred-gate.mjs').replace(/\\/g, '/')}`);
  const raw = readFileSync(candPath(HAPPY_OUT), 'utf8');
  if (!credentialGate({ [candPath(HAPPY_OUT)]: raw }).ok) throw new Error('候选骨架须过凭据门（前置门保证含凭据原文进不来）');
});
await checkAsync('C7d 与 distill C6a 差异：不对候选断言无裸 ://（authoring URL 合法，凭据值由凭据门拦）', async () => {
  // 显式反向锚：候选确实保留了 :// —— 证明本契约不做 URL 剥净（GRILL D7），仅凭据门拦值。
  if (!readFileSync(candPath(HAPPY_OUT), 'utf8').includes('://')) throw new Error('候选应保留 authoring URL 的 ://（不剥 URL）');
});

// ---------- C8 门面回归 ----------
await checkAsync('C8 selftest --tier1 → exit 0（新增 scaffold-case 门面不破确定性内核与统一语言自检）', async () => {
  const r = run(['selftest', '--tier1']);
  if (r.status !== 0) throw new Error(`selftest --tier1 应 exit 0，实际 ${r.status}`);
});

console.log(`ingest-scaffold golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
