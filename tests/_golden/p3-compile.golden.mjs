#!/usr/bin/env node
// 冻结黄金标准（P3 相1 编译 · hermetic）：编译执行引擎对假 SUT（被测系统）产 events + 观测现状 + 编译期核验记录。
// 决策依 docs/plans/p3-compile/proposed/GRILL.md（G1–G7 人签 2026-07-02）；计划依 docs/plans/p3-compile/plan.md。
// 零 LLM 零真机零真凭据：flow 草稿由（将来的）LLM 在 CLI 之外产出，本 golden 直接喂合成 flow——CLI 是 L0 复核器。
// 实现前必须红：casey compile 现为诚实桩 exit 3；lib/cred-gate.mjs / lib/login-bootstrap.mjs / 原子快照均缺席。
// 改本文件 = Test Ratchet 判红。
//
// 冻结的 CLI 契约：
//   casey compile <caseId> --testcase <f> --flow <f> --out-dir <d>          闸+落 flow-<caseId>.json；坏 flow exit 65 不落盘
//   casey compile <caseId> --execute --sut <url> --out-dir <d> --profile <f> [--skip-login] [--unique-name <tok>]
//       须 flow-<caseId>.json 的 confirmedBy 非空（G3 分岔一人 confirm 门），否则 exit 66 不产 events
//   casey compile <caseId> --verify --sut <url> --out-dir <d> --profile <f>  回放核验（G1 取 B）：动作轴全 unique 才 0
//   缺参一律 exit 64。所有落盘口过 lib/cred-gate.mjs（G5 取 B）。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const SNAPSHOT = join(ROOT, 'lib', 'atoms-registry.snapshot.json');
const CASE_ID = 'tc_compile_smoke';
const ACTIONS = new Set(['click', 'dblclick', 'fill', 'selectOption', 'press', 'nav', 'newpage', 'dragTo']);
const tmp = mkdtempSync(join(tmpdir(), 'casey-p3compile-'));

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}
function run(args, opts = {}) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });
}
const FORBIDDEN = ['authorization', 'setcookie', 'set-cookie', 'password', 'apikey', 'x-api-key', 'secret', 'credential', 'cookie', 'token'];
function findForbiddenKey(node, path = '') {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const r = findForbiddenKey(node[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const norm = k.toLowerCase().replace(/[_-]/g, '');
      if (FORBIDDEN.includes(norm)) return `${path}.${k}`;
      const r = findForbiddenKey(node[k], `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}

// ---------- C1 原子注册表快照（G3 分岔二：整表 60 + snapshotOf 溯源，atomId 钉 registry 原名） ----------
check('C1 快照完整性', () => {
  if (!existsSync(SNAPSHOT)) throw new Error('lib/atoms-registry.snapshot.json 缺席');
  const s = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  if (!s.snapshotOf || !s.snapshotOf.repo || !s.snapshotOf.copiedAt) throw new Error('缺 snapshotOf 溯源（repo/copiedAt）');
  const atoms = s.atoms || {};
  if (Object.keys(atoms).length !== 60) throw new Error(`原子须整表 60，实际 ${Object.keys(atoms).length}`);
  for (const id of ['login', 'workflow.deleteByName', 'workflow.create', 'assert.onPage', 'workflow.save', 'assert.noErrorToast']) {
    if (!atoms[id]) throw new Error(`catalog_wf_crud 所用原子 ${id} 不在册`);
  }
  if (atoms['workflow.create'].entityNameParam !== 'name' || atoms['workflow.create'].destructive !== true) throw new Error('workflow.create 须 entityNameParam=name 且 destructive');
  if (atoms['workflow.deleteByName'].entityNameParam !== 'name') throw new Error('workflow.deleteByName 须 entityNameParam=name');
});

// ---------- C2 登录预备动作件（G2 取 A：拷快照，凭据只进内存） ----------
await checkAsync('C2 登录件 hermetic', async () => {
  const m = await import(`file://${join(ROOT, 'lib', 'login-bootstrap.mjs').replace(/\\/g, '/')}`);
  const { DEFAULT_SITE, loadSiteConfig, loadCreds } = m;
  if (!DEFAULT_SITE || !loadSiteConfig || !loadCreds) throw new Error('须导出 DEFAULT_SITE/loadSiteConfig/loadCreds');
  if (DEFAULT_SITE.login.submit.name !== '登 录') throw new Error('登录按钮可访问名须保留「登 录」空格坑');
  const sp = join(tmp, 'site.synth.json');
  writeFileSync(sp, JSON.stringify({ login: { user: { name: '账号X' } }, target: { startUrl: 'http://x.invalid/' } }));
  const site = loadSiteConfig(sp);
  if (site.login.user.name !== '账号X') throw new Error('site.json 深合并覆盖未生效');
  if (site.login.submit.name !== '登 录') throw new Error('深合并须保留未覆盖键');
  if (!site.target || site.target.startUrl !== 'http://x.invalid/') throw new Error('顶层键须透传');
  const envBak = { u: process.env.AT_CREDS_USER, p: process.env.AT_CREDS_PASS };
  try {
    process.env.AT_CREDS_USER = 'u_synth'; process.env.AT_CREDS_PASS = 'p_synth';
    const c = loadCreds({ credsFile: join(tmp, 'no-such-creds.json') });
    if (c.user !== 'u_synth' || c.pass !== 'p_synth') throw new Error('env 覆盖须优先且不读盘');
    delete process.env.AT_CREDS_USER; delete process.env.AT_CREDS_PASS;
    let threw = false;
    try { loadCreds({ credsFile: join(tmp, 'no-such-creds.json') }); } catch { threw = true; }
    if (!threw) throw new Error('无 env 且缺凭据文件须抛错 fail-closed');
  } finally {
    if (envBak.u == null) delete process.env.AT_CREDS_USER; else process.env.AT_CREDS_USER = envBak.u;
    if (envBak.p == null) delete process.env.AT_CREDS_PASS; else process.env.AT_CREDS_PASS = envBak.p;
  }
});

// ---------- C3 凭据门共享化（G5 取 B：抽 lib/cred-gate.mjs，bin/report.mjs 保留 re-export） ----------
await checkAsync('C3 凭据门共享件', async () => {
  const m = await import(`file://${join(ROOT, 'lib', 'cred-gate.mjs').replace(/\\/g, '/')}`);
  const { credentialGate, stripUrlQuery } = m;
  if (typeof credentialGate !== 'function' || typeof stripUrlQuery !== 'function') throw new Error('须导出 credentialGate 与 stripUrlQuery');
  if (stripUrlQuery('http://h.invalid/p?tok=abc#f') !== 'http://h.invalid/p') throw new Error('stripUrlQuery 须剥 query 与 hash');
  if (stripUrlQuery('/api/x?a=1&b=2') !== '/api/x') throw new Error('stripUrlQuery 须支持相对路径');
  if (stripUrlQuery('/api/x') !== '/api/x') throw new Error('无 query 须原样');
  const bad = credentialGate({ j: '{"note":"password=abc123"}' });
  if (!bad || bad.ok !== false) throw new Error('禁字段关键词须 fail-closed { ok:false }');
  // R1-F5 采信半边：关键词面补 token/cookie（p7 原表缺）。
  for (const kw of ['token', 'cookie']) {
    const hit = credentialGate({ j: `{"note":"${kw}=abc123"}` });
    if (!hit || hit.ok !== false) throw new Error(`禁字段关键词「${kw}」须 fail-closed`);
  }
  const good = credentialGate({ j: '{"note":"干净产物"}' });
  if (!good || good.ok !== true) throw new Error('干净产物须放行');
  const rep = await import(`file://${join(ROOT, 'bin', 'report.mjs').replace(/\\/g, '/')}`);
  if (typeof rep.credentialGate !== 'function') throw new Error('bin/report.mjs 须保留 credentialGate re-export（p7 冻结 golden 依赖）');
});

// ---------- C3b 删除计数口径：表格行 + 真机卡片布局都可对账，证不出仍红 ----------
await checkAsync('C3b 删除计数口径兼容卡片布局', async () => {
  const m = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  const { summarizeDeleteCountAudit } = m;
  if (typeof summarizeDeleteCountAudit !== 'function') throw new Error('lib/compile-atoms.mjs 须导出 summarizeDeleteCountAudit');
  const table = summarizeDeleteCountAudit({ tableRows: 1, tableDeleteButtons: 1, targetCards: 0, targetCardDeleteButtons: 0, globalDeleteButtons: 1 });
  if (!table.equal || table.layout !== 'table' || table.recordContainers !== 1 || table.deleteButtons !== 1) throw new Error('表格行布局 1:1 应放行');
  const card = summarizeDeleteCountAudit({ tableRows: 0, tableDeleteButtons: 0, targetCards: 1, targetCardDeleteButtons: 1, globalDeleteButtons: 1 });
  if (!card.equal || card.layout !== 'card' || card.recordContainers !== 1 || card.deleteButtons !== 1) throw new Error('卡片布局 1:1 应放行（真机 atl_c1 形态）');
  const mismatch = summarizeDeleteCountAudit({ tableRows: 0, tableDeleteButtons: 0, targetCards: 1, targetCardDeleteButtons: 2, globalDeleteButtons: 2 });
  if (mismatch.equal || mismatch.layout !== 'card') throw new Error('卡片布局记录与删除目标不恒等时必须 fail-closed');
});

// ---------- 合成输入（inline fixture：TestCase 最小规范形态 + flow 草稿） ----------
const TESTCASE = {
  schemaVersion: 1, caseId: CASE_ID, channel: 'web', uniquePrefix: 'atl_',
  preconditions: ['已登录'],
  intents: [
    { intentId: 'intent_list', text: '进入工作流管理列表' },
    { intentId: 'intent_create', text: '新增工作流：名称 atl_{{uniqueName}}、分类 测试分类' },
    { intentId: 'intent_save', text: '保存工作流' },
  ],
};
const FLOW_GOOD = {
  id: CASE_ID, name: '编译冒烟', category: 'normal',
  steps: [
    { atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' } },
    { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
    { atom: 'workflow.save', params: {} },
    { atom: 'assert.noErrorToast', params: {} },
  ],
};
const FLOW_BAD_PREFIX = { ...FLOW_GOOD, steps: [{ atom: 'workflow.create', params: { name: '目录CRUD无前缀', category: '测试分类' } }] };
const FLOW_WITH_DELETE = { ...FLOW_GOOD, steps: [...FLOW_GOOD.steps, { atom: 'workflow.deleteByName', params: { name: 'atl_{{uniqueName}}' } }] };

const tcFile = join(tmp, 'testcase.json');
writeFileSync(tcFile, JSON.stringify(TESTCASE));
const profFile = join(tmp, 'profile.json');
writeFileSync(profFile, JSON.stringify({ background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 }));
function writeFlow(obj, name) { const f = join(tmp, name); writeFileSync(f, JSON.stringify(obj)); return f; }
const emptyExpected = join(tmp, 'expected.empty.json');
writeFileSync(emptyExpected, JSON.stringify({ caseId: CASE_ID, channel: 'web', intents: [], globalAssertions: [] }));

// ---------- C4 闸 + 人 confirm 门 + 执行（happy 假 SUT） ----------
const dirA = join(tmp, 'out-a'); mkdirSync(dirA, { recursive: true });
const dirBad = join(tmp, 'out-bad'); mkdirSync(dirBad, { recursive: true });
let sutHappy;
let eventsA = null;
await checkAsync('C4 闸+confirm+执行 happy', async () => {
  sutHappy = await startFakeSut({ scenario: 'happy' });
  // 闸：好 flow 落盘、坏 flow（实体名无前缀）exit 65 不落盘（compile-gate 破坏性前缀硬闸）
  const g1 = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', writeFlow(FLOW_GOOD, 'flow.good.json'), '--out-dir', dirA]);
  if (g1.status !== 0) throw new Error(`好 flow 过闸应 exit 0，实际 ${g1.status}：${(g1.stderr || '').slice(-200)}`);
  const flowFile = join(dirA, `flow-${CASE_ID}.json`);
  if (!existsSync(flowFile)) throw new Error('过闸后须落 flow-<caseId>.json');
  const g2 = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', writeFlow(FLOW_BAD_PREFIX, 'flow.bad.json'), '--out-dir', dirBad]);
  if (g2.status !== 65) throw new Error(`坏 flow 应 exit 65（fail-closed），实际 ${g2.status}`);
  if (existsSync(join(dirBad, `flow-${CASE_ID}.json`))) throw new Error('坏 flow 不得落盘 canonical flow');
  // 人 confirm 门：未确认拒跑 exit 66、不产 events（执行段以 --testcase 为不可变锚，R2-F1）
  const e1 = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', tcFile, '--sut', sutHappy.url, '--out-dir', dirA, '--profile', profFile, '--skip-login', '--unique-name', 'g1']);
  if (e1.status !== 66) throw new Error(`未 confirm 执行应 exit 66，实际 ${e1.status}`);
  if (existsSync(join(dirA, 'events.json'))) throw new Error('未 confirm 不得产 events.json');
  const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
  flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-02T00:00:00.000Z';
  writeFileSync(flowFile, JSON.stringify(flow, null, 2));
  // 执行：产 events + observed + 编译期核验记录
  const e2 = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', tcFile, '--sut', sutHappy.url, '--out-dir', dirA, '--profile', profFile, '--skip-login', '--unique-name', 'g1']);
  if (e2.status !== 0) throw new Error(`confirm 后执行应 exit 0，实际 ${e2.status}：${(e2.stderr || '').slice(-300)}`);
  for (const f of ['events.json', `observed-${CASE_ID}.json`, 'compile-report.json']) {
    if (!existsSync(join(dirA, f))) throw new Error(`执行后缺产物 ${f}`);
  }
  eventsA = JSON.parse(readFileSync(join(dirA, 'events.json'), 'utf8'));
});

check('C4a events 形状与占位符纪律', () => {
  if (!eventsA) throw new Error('前置 C4 未产 events');
  if (eventsA.schemaVersion !== 2 || eventsA.channel !== 'web' || eventsA.caseId !== CASE_ID) throw new Error('events 顶层三键不符已冻 schema');
  if (eventsA.authored !== false) throw new Error('authored 须 false（P3 硬门）');
  if (!String(eventsA.url).startsWith('{{baseUrl}}/')) throw new Error('顶层 url 须 {{baseUrl}} 占位符形态（G6 分岔三取 C）');
  if (!Array.isArray(eventsA.events) || eventsA.events.length < 5) throw new Error(`events 须 ≥5 步（nav+新增4步+保存），实际 ${(eventsA.events || []).length}`);
  const atoms = new Set(eventsA.events.map((e) => e.atom));
  if (!atoms.has('workflow.create') || !atoms.has('workflow.save')) throw new Error('event.atom 回链须钉 registry 原名（workflow.create/workflow.save）');
  const intents = new Set(eventsA.events.map((e) => e.intentId));
  if (intents.size < 3) throw new Error('workflow.create 须拆 进列表+新增 两 intent、加保存 ≥3 intent');
  for (const ev of eventsA.events) {
    if (!ACTIONS.has(ev.action)) throw new Error(`未知 action ${ev.action}`);
    if (!/^atstep_\d+$/.test(ev.stepId)) throw new Error(`stepId 形态非法 ${ev.stepId}`);
    if (ev.action === 'nav' && !String(ev.url).startsWith('{{baseUrl}}/')) throw new Error('nav url 须 {{baseUrl}} 占位符形态');
    if (['click', 'dblclick', 'fill', 'selectOption'].includes(ev.action)) {
      const anchored = ev.semantic || (ev.role && ev.accessibleName) || ev.text || ev.fieldLabel || ev.dropdownUnit;
      if (!anchored) throw new Error(`交互步 ${ev.stepId} 无稳定绑定属性（禁纯坐标步）`);
    }
    if (ev.action === 'fill' && ev.value != null && !String(ev.value).includes('{{uniqueName}}') && String(ev.value).startsWith('atl_')) {
      throw new Error('实体名 fill 须保留 {{uniqueName}} 模板（易变值模板化）');
    }
  }
  const raw = JSON.stringify(eventsA);
  if (raw.includes('atl_g1')) throw new Error('events 不得携实例值 atl_g1（模板归 events、实测归 observed）');
  if (raw.includes('127.0.0.1')) throw new Error('events 不得携基址字面量（占位符纪律）');
});

check('C4b observed 观测现状纪律', () => {
  const obs = JSON.parse(readFileSync(join(dirA, `observed-${CASE_ID}.json`), 'utf8'));
  if (obs.schemaVersion !== 1 || obs.caseId !== CASE_ID || obs.channel !== 'web') throw new Error('observed 顶层三键不符已冻 schema');
  if (!obs.capturedAt) throw new Error('缺 capturedAt');
  if (!Array.isArray(obs.steps) || obs.steps.length !== eventsA.events.length) throw new Error(`observed 步数(${(obs.steps || []).length}) 须 = events 步数(${eventsA.events.length})`);
  for (const st of obs.steps) {
    for (const k of ['stepId', 'intentId', 'urlPathnameAfter', 'cleanTitles', 'toastTexts', 'requestLog', 'quietPointReached']) {
      if (!(k in st)) throw new Error(`observedStep ${st.stepId || '?'} 缺必填 ${k}`);
    }
    for (const r of st.requestLog) {
      if (String(r.url).includes('?')) throw new Error(`requestLog url 须剥 query（G5）：${r.url}`);
      if (!String(r.url).startsWith('/') || String(r.url).includes('://') || String(r.url).includes('127.0.0.1')) {
        throw new Error(`requestLog url 只许落 pathname，不得携 origin/site 字面量（护栏 #7）：${r.url}`);
      }
      if (String(r.url).includes('/api/auths/poll') && r.attributedStepId !== null) throw new Error('背景轮询须归 background/null，不得归因业务步');
    }
  }
  if (JSON.stringify(obs).includes('{{')) throw new Error('observed 存实测字面量，不得携模板占位符');
  // 确定步：进画布 + 成功提示；保存步：save POST 归因本步
  const confirmStep = obs.steps.find((s) => s.urlPathnameAfter === '/ai-manager/process/detail' && s.toastTexts.includes('新增成功'));
  if (!confirmStep) throw new Error('缺「确定→进画布+新增成功 toast」的观测步（P4 地面真值）');
  const saveEv = eventsA.events.filter((e) => e.atom === 'workflow.save').pop();
  const saveObs = obs.steps.find((s) => s.stepId === saveEv.stepId);
  const saveReq = (saveObs.requestLog || []).find((r) => String(r.url).includes('saveOrModifyProcessData'));
  if (!saveReq) throw new Error('保存步 requestLog 须含 saveOrModifyProcessData');
  if (saveReq.attributedStepId !== saveEv.stepId) throw new Error('保存请求须按发起方归因到保存步（非时间窗）');
  const fk = findForbiddenKey(obs);
  if (fk) throw new Error(`observed 命中凭据禁字段 ${fk}（护栏 #7）`);
});

check('C4c 编译期核验记录', () => {
  const rep = JSON.parse(readFileSync(join(dirA, 'compile-report.json'), 'utf8'));
  if (!Array.isArray(rep.verification) || rep.verification.length !== eventsA.events.length) throw new Error('核验记录须逐 event 一条');
  for (const v of rep.verification) {
    if (v.resolution !== 'unique') throw new Error(`happy 场景全步须 unique，${v.stepId} 实际 ${v.resolution}`);
  }
  if (!Array.isArray(rep.caseDefectCandidates) || rep.caseDefectCandidates.length !== 0) throw new Error('happy 场景不得有 CASE_DEFECT 候选');
  const ah = rep.handoff && rep.handoff.assertionAtoms;
  if (!Array.isArray(ah) || ah.length !== 2) throw new Error('断言原子（assert.onPage/noErrorToast）须记入交接面意图留痕（G7-3）');
  for (const a of ah) if (!a.intentId || !a.atom) throw new Error('意图留痕条目须带 intentId+atom');
  const fk = findForbiddenKey(rep);
  if (fk) throw new Error(`compile-report 命中凭据禁字段 ${fk}（护栏 #7）`);
});

// ---------- C5 入口可证缺席 → CASE_DEFECT 候选（G1 附属：不落该步+记候选，编译继续） ----------
const dirB = join(tmp, 'out-b'); mkdirSync(dirB, { recursive: true });
await checkAsync('C5 CASE_DEFECT 候选', async () => {
  const g = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', writeFlow(FLOW_WITH_DELETE, 'flow.del.json'), '--out-dir', dirB]);
  if (g.status !== 0) throw new Error(`含 deleteByName 的 flow 过闸应 0，实际 ${g.status}`);
  const flowFile = join(dirB, `flow-${CASE_ID}.json`);
  const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
  flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-02T00:00:00.000Z';
  writeFileSync(flowFile, JSON.stringify(flow, null, 2));
  const e = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', tcFile, '--sut', sutHappy.url, '--out-dir', dirB, '--profile', profFile, '--skip-login', '--unique-name', 'g2']);
  if (e.status !== 0) throw new Error(`入口缺席不 fail 全盘、应 exit 0，实际 ${e.status}：${(e.stderr || '').slice(-300)}`);
  const ev = JSON.parse(readFileSync(join(dirB, 'events.json'), 'utf8'));
  if (ev.events.some((x) => x.atom === 'workflow.deleteByName')) throw new Error('入口缺席的原子不得落 event');
  const rep = JSON.parse(readFileSync(join(dirB, 'compile-report.json'), 'utf8'));
  const cand = (rep.caseDefectCandidates || []).find((c) => c.atom === 'workflow.deleteByName');
  if (!cand) throw new Error('须记 workflow.deleteByName 的 CASE_DEFECT 候选');
  if (!cand.evidence || cand.evidence.count !== 0) throw new Error('候选须带 count===0 可证缺席证据');
});

// ---------- C6 {{baseUrl}} 回填接线：编译产物直接可回放（p5 回放器 URL 通道过 instantiate） ----------
await checkAsync('C6 占位符 events 可回放', async () => {
  if (!eventsA) throw new Error('前置 C4 未产 events');
  const axesFile = join(tmp, 'axes.c6.json');
  const r = run([REPLAY, '--events', join(dirA, 'events.json'), '--sut', sutHappy.url, '--expected', emptyExpected, '--profile', profFile, '--out', axesFile]);
  if (r.status !== 0) throw new Error(`占位符 events 回放应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const axes = JSON.parse(readFileSync(axesFile, 'utf8'));
  // p5 已冻接缝语义：axes 按 intentId 卷回、每 intent 一条代表步（非逐 event）。
  const wantIntents = new Set(eventsA.events.map((e) => e.intentId)).size;
  if (!Array.isArray(axes.steps) || axes.steps.length !== wantIntents) {
    throw new Error(`axes 步数（${(axes.steps || []).length}）须 = intent 数（${wantIntents}，按 intent 卷回代表步）`);
  }
  // 动作轴形状复现 p5 已冻接缝：actionPerformed 由 verdict.mjs 从 resolution 推导、轴本身只带 resolution。
  for (const s of axes.steps) {
    if (!s.action || s.action.resolution !== 'unique') {
      throw new Error(`回放核验判据失守：${s.stepId} resolution=${s.action && s.action.resolution}`);
    }
  }
});

// ---------- C4d 确认门防篡改（R1-F1）：confirm 后被改坏的 flow 不得执行 ----------
const dirC = join(tmp, 'out-c'); mkdirSync(dirC, { recursive: true });
await checkAsync('C4d 执行段重验闸（防 confirm 后篡改）', async () => {
  const g = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', writeFlow(FLOW_GOOD, 'flow.c.json'), '--out-dir', dirC]);
  if (g.status !== 0) throw new Error(`过闸应 0，实际 ${g.status}`);
  const flowFile = join(dirC, `flow-${CASE_ID}.json`);
  const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
  flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-02T00:00:00.000Z';
  // R2-F1 双篡改（自洽伪造）：实体名改裸名 + flow 文件自带锚 uniquePrefix 一起改配套——
  // 执行段重验必须以 --testcase（不可变锚）为准而非 flow 文件自带字段，否则放行。
  flow.flow.steps[0].params.name = '目录CRUD裸名篡改';
  flow.uniquePrefix = '目录';
  flow.preconditions = ['已登录'];
  writeFileSync(flowFile, JSON.stringify(flow, null, 2));
  const e = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', tcFile, '--sut', sutHappy.url, '--out-dir', dirC, '--profile', profFile, '--skip-login', '--unique-name', 'g3']);
  if (e.status !== 65) throw new Error(`双篡改 flow 执行应 exit 65（重验以 TestCase 为锚），实际 ${e.status}`);
  if (existsSync(join(dirC, 'events.json'))) throw new Error('篡改 flow 不得产 events.json');
});

// ---------- C8 非唯一拒产出（R1-F2/F3）：多匹配绝不点击、执行段非零退出、events 不落盘 ----------
const dirD = join(tmp, 'out-d'); mkdirSync(dirD, { recursive: true });
await checkAsync('C8 多匹配拒动作拒产出', async () => {
  let sutAmb2;
  try {
    sutAmb2 = await startFakeSut({ scenario: 'ambiguous' });
    const g = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', writeFlow(FLOW_GOOD, 'flow.d.json'), '--out-dir', dirD]);
    if (g.status !== 0) throw new Error(`过闸应 0，实际 ${g.status}`);
    const flowFile = join(dirD, `flow-${CASE_ID}.json`);
    const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
    flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-02T00:00:00.000Z';
    writeFileSync(flowFile, JSON.stringify(flow, null, 2));
    // R2-F3：out-dir 预放旧「成功产物」——失败运行后不得残留假冒本轮成功。
    writeFileSync(join(dirD, 'events.json'), JSON.stringify({ stale: true }));
    writeFileSync(join(dirD, `observed-${CASE_ID}.json`), JSON.stringify({ stale: true }));
    const e = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', tcFile, '--sut', sutAmb2.url, '--out-dir', dirD, '--profile', profFile, '--skip-login', '--unique-name', 'g4']);
    if (e.status !== 65) throw new Error(`保存按钮多匹配执行应 exit 65（证不出→非零，fail-safe），实际 ${e.status}`);
    if (existsSync(join(dirD, 'events.json'))) throw new Error('非唯一执行不得产/残留可进 P4 的 events.json（含旧产物清场）');
    if (existsSync(join(dirD, `observed-${CASE_ID}.json`))) throw new Error('非唯一执行不得残留旧 observed（假冒本轮成功）');
    if (!existsSync(join(dirD, 'compile-report.json'))) throw new Error('诊断用 compile-report.json 应照落（route:human 依据）');
    const rep = JSON.parse(readFileSync(join(dirD, 'compile-report.json'), 'utf8'));
    if (!rep.verification.some((v) => v.resolution === 'multi' && v.acted === false)) throw new Error('多匹配步须记 multi 且 acted=false（绝不点击）');
  } finally { if (sutAmb2) await sutAmb2.close(); }
});

// ---------- C7b 逐 event 核验（R1-F4）：intent 中间步 ambiguous 不得被代表步掩盖 ----------
const dirE = join(tmp, 'out-e'); mkdirSync(dirE, { recursive: true });
await checkAsync('C7b verify 逐 event 不被卷回掩盖', async () => {
  writeFileSync(join(dirE, 'events.json'), JSON.stringify({
    schemaVersion: 2, channel: 'web', caseId: CASE_ID,
    url: '{{baseUrl}}/ai-manager/process/list', recordedAt: '2026-07-02T00:00:00.000Z',
    compiledBy: 'golden-crafted', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.create', action: 'nav', url: '{{baseUrl}}/ai-manager/process/list' },
      { stepId: 'atstep_1', intentId: 'intent_0', atom: 'workflow.create', action: 'click', semantic: { kind: 'text', name: '删除', exact: true }, text: '删除' },
      { stepId: 'atstep_2', intentId: 'intent_0', atom: 'workflow.create', action: 'click', semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true }, text: '新增工作流' },
    ],
  }));
  // happy 列表两行 → 「删除」count=2 = 中间步多匹配；代表步（最后一步）unique——verify 须仍红且点名 atstep_1。
  const v = run([CASEY, 'compile', CASE_ID, '--verify', '--sut', sutHappy.url, '--out-dir', dirE, '--profile', profFile]);
  if (v.status === 0) throw new Error('intent 中间步 ambiguous 时 verify 应非零（代表步聚合不得掩盖）');
  const out = `${v.stdout || ''}${v.stderr || ''}`;
  if (!out.includes('atstep_1')) throw new Error('verify 失败输出须点名中间雷点步 atstep_1');
});

// ---------- C7 回放核验器 CLI（G1 取 B）：unique 全过才 0，ambiguous 非零+雷点清单 ----------
await checkAsync('C7 verify 正反两向', async () => {
  const v1 = run([CASEY, 'compile', CASE_ID, '--verify', '--sut', sutHappy.url, '--out-dir', dirA, '--profile', profFile]);
  if (v1.status !== 0) throw new Error(`happy verify 应 exit 0，实际 ${v1.status}：${(v1.stderr || '').slice(-200)}`);
  let sutAmb;
  try {
    sutAmb = await startFakeSut({ scenario: 'ambiguous' });
    const v2 = run([CASEY, 'compile', CASE_ID, '--verify', '--sut', sutAmb.url, '--out-dir', dirA, '--profile', profFile]);
    if (v2.status === 0) throw new Error('ambiguous 场景 verify 应非零退出（雷点须暴露）');
    const out = `${v2.stdout || ''}${v2.stderr || ''}`;
    if (!/ambiguous|fallback_first/.test(out)) throw new Error('verify 失败输出须点名 ambiguous/fallback_first 雷点');
  } finally { if (sutAmb) await sutAmb.close(); }
});

if (sutHappy) await sutHappy.close();

if (fails.length) {
  for (const f of fails) console.error(`RED  p3-compile: ${f}`);
  console.error(`RED  p3-compile: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   p3-compile: ${pass}/${pass} 全过（快照+登录件+凭据门共享化+闸/confirm/执行+候选+占位符回放+verify 正反）`);
process.exit(0);
