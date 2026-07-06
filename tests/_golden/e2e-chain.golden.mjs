// e2e-chain.golden.mjs —— hermetic「文本→报告」全链集成金牌（e2e-chain，light）。
// 七相首次首尾串跑（零真机、零凭据、零 LLM）：候选文本(mock 归一) → 相0 ingest → 相1 flow-bridge(mock mapping)
// → compile gate → confirm 门(手编，镜像 p3 金牌 golden-human 先例) → compile --execute(fake-sut + --skip-login)
// → 相2 draft(+patch=mock LLM 补缝) → 相2 sign(CLI 真签面) → 相3-4-6 casey run → 报告三件 + verdict 全 PASS。
// 性质：集成回归金牌（收编存量行为、冻结时即绿）——零新实现；挖出真缝即停、按面升 lane（GRILL D4）。
// codex R1 加固（8 发现采信/修正采纳）：断言全部钉死源头期望集不跟随产物（F1）；真回放证据断 axes 全 unique +
// run-metrics 命中率 + run-history 行数（F2 修正采纳，浏览器没真解析夹具 DOM 伪造不出）；凭据 env 毒化陷阱（F3 部分）；
// {{baseUrl}} 正反双断言含 sut host（F4）；骨架断链前置断言、patch 只补显式缺口（F5）；全 tmp + 全站 stdout/stderr
// 扫描、词表取 lib/cred-gate FORBIDDEN_KEYWORDS 单一事实源（F6）；confirm 字段严判（F7）；补丁显式挂 intent（F8）。
// 确定性钉点：--unique-name e1 / --signed-at 定值 / signer qa.hermetic / AT_SITE_JSON 合成隔离（不读仓根真 site.json）。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';
import { FORBIDDEN_KEYWORDS } from '../../lib/cred-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-e2e-chain-'));
const CASE_ID = 'tc_e2e_chain';

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 合成 site 隔离（executeMode 无条件 loadSiteConfig，缺省会读仓根真 site.json——凭据类文件绝不进 hermetic 链）
// + 凭据 env 毒化陷阱（codex R1-F3）：删环境凭据、AT_CREDS_FILE 指不存在路径——链上任何站若触 loadCreds
// （--skip-login 纪律破了）即 fail-closed 抛错、该站非零退出、金牌红。
const SITE_FILE = writeJson(join(tmp, 'site.synthetic.json'), {});
const ENV = { ...process.env, AT_SITE_JSON: SITE_FILE, AT_CREDS_FILE: join(tmp, 'no-creds-here.json') };
delete ENV.AT_CREDS_USER; delete ENV.AT_CREDS_PASS;
const stationOutputs = []; // 全站 stdout/stderr 汇集，C8 一并扫（输出通道也是泄漏面）
function run(args, timeout = 120000) {
  // cwd 钉在 tmp（codex R3-F3）：任何站若把产物误写相对路径，落进 tmp 被 C8 全域扫描盖住，绝不静默漏到仓根。
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: ENV, cwd: tmp });
  stationOutputs.push((r.stdout || '') + (r.stderr || ''));
  return r;
}

// ── 链上夹具（mock LLM 产物，内联）──
const CANDIDATE = {
  schemaVersion: 1, caseId: CASE_ID, title: '工作流创建保存（hermetic 全链）',
  source: { kind: 'freetext', raw: '在工作流管理里新增一条名为 atl_ 前缀的工作流（分类：测试分类）并保存，保存后不应出现错误提示' },
  preconditions: ['已登录'],
  steps: [
    { intentId: 'intent_create', intent: '新增工作流 atl_{{uniqueName}}（分类 测试分类）', actionHint: 'fill', inputValue: 'atl_{{uniqueName}}', uniqueGuard: true },
    { intentId: 'intent_save', intent: '保存工作流', actionHint: 'click' },
  ],
  uniquePrefix: 'atl_',
};
const MAPPING = [
  { intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' } },
  { intentId: 'intent_create', atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
  { intentId: 'intent_save', atom: 'workflow.save', params: {} },
  { intentId: 'intent_save', atom: 'assert.noErrorToast', params: {} },
];
const PROFILE_FILE = writeJson(join(tmp, 'profile.json'), { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 });

// ── 源头期望集（codex R1-F1：断言钉死于此、绝不跟随产物动态推导）──
// compile 自生位置式 intent（run.newIntent）：nav=intent_0；create 四事件=intent_1；save=intent_2。
const EXPECT_EVENT_SEQ = [
  { intentId: 'intent_0', action: 'nav' },
  { intentId: 'intent_1', action: 'click' },
  { intentId: 'intent_1', action: 'fill' },
  { intentId: 'intent_1', action: 'selectOption' },
  { intentId: 'intent_1', action: 'click' },
  { intentId: 'intent_2', action: 'click' },
];
const EXPECT_INTENT_SET = ['intent_0', 'intent_1', 'intent_2'];
const EXPECT_ASSERTION_ATOMS = [
  { intentId: 'intent_1', atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
  { intentId: 'intent_2', atom: 'assert.noErrorToast', params: {} },
];
// mock LLM 补缝显式清单（codex R1-F5/F8：只补明确缺口、显式挂 intent，绝不循环兜底）
const PATCH = [
  { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' },
  { intentId: 'intent_2', kind: 'noErrorEnvelope', op: 'envelopeOk' },
];

const work = join(tmp, 'work');
const testcaseFile = join(work, `testcase-${CASE_ID}.json`);
const bridgeFlowFile = join(work, `flow-${CASE_ID}.json`);
const gateDir = join(tmp, 'compile');
const gateFlowFile = join(gateDir, `flow-${CASE_ID}.json`);
const eventsFile = join(gateDir, 'events.json');
const observedFile = join(gateDir, `observed-${CASE_ID}.json`);
const reportFile = join(gateDir, 'compile-report.json');
const draftFile = join(gateDir, `expected.draft-${CASE_ID}.json`);
const frozenFile = join(gateDir, 'expected.frozen.json');
const prdFixtureFile = writeJson(join(tmp, `prd-${CASE_ID}.json`), { schemaVersion: 2, caseId: CASE_ID, task: 'e2e-chain hermetic 最小 prd 夹具（镜像 p2-sign 金牌）', testChecksums: {}, stories: [] });
const runDir = join(tmp, 'run');

const sut = await startFakeSut({ scenario: 'happy' });
const sutHost = new URL(sut.url).host; // 127.0.0.1:<port>（codex R1-F4：host+port 全形态禁入产物）
try {
  // ---------- C1 相0 归一（产物深等钉死，codex R2-F1） ----------
  await checkAsync('C1 相0 ingest：候选 → 规范 TestCase，字段深等（除落章 ingestedAt）+ 落章 ISO 合法', async () => {
    const cand = writeJson(join(tmp, 'candidate.json'), CANDIDATE);
    const r = run([CASEY, 'ingest', CASE_ID, '--in', cand, '--out-dir', work]);
    if (r.status !== 0) throw new Error(`ingest 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const got = readJson(testcaseFile);
    if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(got.source.ingestedAt))) throw new Error(`ingestedAt 落章非法：${got.source.ingestedAt}`);
    const stripped = { ...got, source: Object.fromEntries(Object.entries(got.source).filter(([k]) => k !== 'ingestedAt')) };
    if (!deepEq(stripped, CANDIDATE)) throw new Error(`TestCase 产物须与候选逐字段深等（防归一静默丢字段），实际 ${JSON.stringify(stripped).slice(0, 300)}`);
  });

  // ---------- C2 相1 flow 桥（钉死步序，codex R1-F1） ----------
  await checkAsync('C2 相1 flow-bridge：flow 步序=mapping 原子序（钉死，非只数长度）', async () => {
    const mf = writeJson(join(tmp, 'mapping.json'), MAPPING);
    const r = run([CASEY, 'flow-bridge', CASE_ID, '--testcase', testcaseFile, '--mapping', mf, '--out-dir', work]);
    if (r.status !== 0) throw new Error(`flow-bridge 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const flow = readJson(bridgeFlowFile);
    if (!deepEq(flow.steps, MAPPING.map((m) => ({ atom: m.atom, params: m.params })))) throw new Error(`flow 步序须逐字=mapping 投影，实际 ${JSON.stringify(flow.steps)}`);
  });

  // ---------- C3 compile gate 段（confirm 字段严判，codex R1-F7） ----------
  await checkAsync('C3 compile gate 段：落 flow 文档且 confirmedBy===空串、confirmedAt===null（严判非 falsy）', async () => {
    const r = run([CASEY, 'compile', CASE_ID, '--testcase', testcaseFile, '--flow', bridgeFlowFile, '--out-dir', gateDir]);
    if (r.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const doc = readJson(gateFlowFile);
    if (doc.confirmedBy !== '' || doc.confirmedAt !== null) throw new Error(`confirm 契约形态漂移：confirmedBy=${JSON.stringify(doc.confirmedBy)} confirmedAt=${JSON.stringify(doc.confirmedAt)}`);
  });

  // ---------- C4 confirm 门 + execute（events 钉死序列 + {{baseUrl}} 正反双断言，codex R1-F1/F4） ----------
  await checkAsync('C4 confirm 负闸 66 零 events；确认后 execute 三件落地，events 序列钉死 + {{baseUrl}} 正反双断言', async () => {
    const execArgv = [CASEY, 'compile', CASE_ID, '--execute', '--testcase', testcaseFile, '--sut', sut.url, '--out-dir', gateDir, '--profile', PROFILE_FILE, '--skip-login', '--unique-name', 'e1'];
    const r1 = run(execArgv);
    if (r1.status !== 66) throw new Error(`未确认 --execute 应 exit 66，实际 ${r1.status}`);
    if (existsSync(eventsFile)) throw new Error('未确认不得落 events');
    const doc = readJson(gateFlowFile);
    doc.confirmedBy = 'hermetic-chain-human'; doc.confirmedAt = '2026-07-06T00:00:00.000Z'; // 镜像 p3 金牌 golden-human 先例
    writeJson(gateFlowFile, doc);
    const r2 = run(execArgv);
    if (r2.status !== 0) throw new Error(`确认后 --execute 应 exit 0，实际 ${r2.status}：${(r2.stderr || '').slice(-300)}`);
    for (const f of [eventsFile, observedFile, reportFile]) if (!existsSync(f)) throw new Error(`缺 execute 产物 ${f}`);
    const ev = readJson(eventsFile);
    if (ev.caseId !== CASE_ID || ev.authored !== false) throw new Error('events caseId/authored 纪律不符');
    const seq = ev.events.map((e) => ({ intentId: e.intentId, action: e.action }));
    if (!deepEq(seq, EXPECT_EVENT_SEQ)) throw new Error(`events 序列须钉死等于源头期望，实际 ${JSON.stringify(seq)}`);
    // 参数→events 闭环（codex R3-F1）：workflow.create 的 name/category 参数须真展开进事件字段。
    const fillEv = ev.events.find((e) => e.action === 'fill');
    if (!fillEv || fillEv.value !== 'atl_{{uniqueName}}' || fillEv.uniqueGuard !== true) throw new Error(`fill 事件须携模板值 atl_{{uniqueName}}+uniqueGuard，实际 ${JSON.stringify(fillEv)}`);
    const selEv = ev.events.find((e) => e.action === 'selectOption');
    if (!selEv || !selEv.dropdownUnit || selEv.dropdownUnit.optionText !== '测试分类') throw new Error(`selectOption 事件须携 optionText 测试分类，实际 ${JSON.stringify(selEv && selEv.dropdownUnit)}`);
    // {{baseUrl}} 正断言 + sut host（含端口）反断言（127.0.0.1/localhost 等任何形态都由 host 精确匹配盖住）
    if (!String(ev.url).startsWith('{{baseUrl}}')) throw new Error(`events.url 须以 {{baseUrl}} 起头，实际 ${ev.url}`);
    for (const e of ev.events) if (e.url !== undefined && !String(e.url).startsWith('{{baseUrl}}')) throw new Error(`event url 须占位符化：${e.url}`);
    if (JSON.stringify(ev).includes(sutHost)) throw new Error(`events 携 SUT host（${sutHost}）——占位符纪律破`);
  });

  // ---------- C5 相2 draft（骨架断链前置断言 + 显式补缝，codex R1-F5/F8） ----------
  await checkAsync('C5 相2 draft：assertionAtoms 钉死 → 骨架硬覆盖 intent_1/intent_2 → 显式 patch 只补 intent_0 与信封 → pending 空', async () => {
    // 骨架断链前置闸：compile-report 交接面必须恰为源头期望的两个断言原子（patch 兜不住这层）。
    const atoms = readJson(reportFile).handoff.assertionAtoms;
    if (!deepEq(atoms, EXPECT_ASSERTION_ATOMS)) throw new Error(`assertionAtoms 断链：实际 ${JSON.stringify(atoms)}`);
    const skeletonProbe = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', gateDir]);
    if (skeletonProbe.status !== 0) throw new Error(`draft 骨架应 exit 0，实际 ${skeletonProbe.status}：${(skeletonProbe.stderr || '').slice(-200)}`);
    const skeleton = readJson(draftFile);
    const hardCovered = skeleton.intents.filter((i) => (i.expected || []).some((a) => !a.soft)).map((i) => i.intentId).sort();
    if (!deepEq(hardCovered, ['intent_1', 'intent_2'])) throw new Error(`骨架硬覆盖应恰 [intent_1,intent_2]（查表映射失效则断链），实际 ${JSON.stringify(hardCovered)}`);
    const pf = writeJson(join(tmp, 'patch.json'), PATCH); // 显式清单，绝不按产物循环兜底
    const r = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', gateDir, '--patch', pf]);
    if (r.status !== 0) throw new Error(`draft+patch 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
    const draft = readJson(draftFile);
    if ((draft.pending || []).length !== 0) throw new Error(`pending 应空，实际 ${JSON.stringify(draft.pending)}`);
    if (!deepEq(draft.intents.map((i) => i.intentId), EXPECT_INTENT_SET)) throw new Error(`草稿 intent 集应恰 ${JSON.stringify(EXPECT_INTENT_SET)}`);
    for (const it of draft.intents) if (!(it.expected || []).some((a) => !a.soft)) throw new Error(`intent ${it.intentId} 缺硬断言（verdict 会判 INDETERMINATE）`);
  });

  // ---------- C6 相2 sign（CLI 真签面） ----------
  await checkAsync('C6 相2 sign：expected.frozen 三签署字段齐、intent 集钉死 + prd 夹具回写 checksum', async () => {
    const r = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixtureFile, '--frozen-out', frozenFile, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-06T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`sign 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
    const frozen = readJson(frozenFile);
    if (!deepEq(frozen.intents.map((i) => i.intentId), EXPECT_INTENT_SET)) throw new Error('冻结 intent 集漂移');
    for (const it of frozen.intents) for (const a of it.expected) {
      if (a.signedAt !== '2026-07-06T00:00:00.000Z' || a.signedAgainstBuild !== 'hermetic-b0' || a.signerId !== 'qa.hermetic') throw new Error('冻结断言签署三字段不齐/不定值');
    }
    // prd 回写精确性（codex R3-F2）：路径解析回冻结文件本尊 + checksum 与实文件 sha256 逐字节吻合。
    const prd = readJson(prdFixtureFile);
    if (!prd.expectedFrozenPath || resolve(String(prd.expectedFrozenPath)) !== frozenFile) throw new Error(`prd.expectedFrozenPath 应解析回 ${frozenFile}，实际 ${prd.expectedFrozenPath}`);
    const sha = createHash('sha256').update(readFileSync(frozenFile, 'utf8')).digest('hex');
    if ((prd.testChecksums || {})[prd.expectedFrozenPath] !== sha) throw new Error('prd.testChecksums 与冻结文件实 sha256 不吻合');
  });

  // ---------- C7 相3-4-6 casey run（真回放证据，codex R1-F2 修正采纳） ----------
  await checkAsync('C7 casey run：verdict 恰 3 intent 全 PASS + axes 全 unique + 命中率 1 + run-history 逐 event 行 + 报告三件', async () => {
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozenFile, '--profile', PROFILE_FILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-400)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s) => s.intentId).sort(), EXPECT_INTENT_SET)) throw new Error(`verdict intent 集应恰 ${JSON.stringify(EXPECT_INTENT_SET)}，实际 ${JSON.stringify(verdict.steps.map((s) => s.intentId))}`);
    const bad = verdict.steps.filter((s) => s.verdict !== 'PASS');
    if (bad.length) throw new Error(`裁定应全 PASS，实际 ${JSON.stringify(bad.map((s) => ({ intentId: s.intentId, verdict: s.verdict, reason: s.reason })))}`);
    // 真回放证据：浏览器没真解析夹具 DOM 伪造不出——axes 三步动作轴全 unique、指标命中率 1、回放历史逐 event 一行。
    const axes = readJson(join(runDir, 'axes.json'));
    if (axes.steps.length !== EXPECT_INTENT_SET.length) throw new Error(`axes 应恰 ${EXPECT_INTENT_SET.length} 代表步`);
    for (const s of axes.steps) if (s.action.resolution !== 'unique') throw new Error(`axes ${s.stepId} resolution=${s.action.resolution}（应 unique）`);
    const metrics = readJson(join(runDir, 'run-metrics.json'));
    if (metrics.locatorHitRate !== 1) throw new Error(`locatorHitRate 应 1，实际 ${metrics.locatorHitRate}`);
    // 业务副作用铁证（codex R2-F2 修正采纳）：保存 POST 按发起方归因到本步 + 成功信封 ok——
    // 真浏览器打真夹具后端才产得出；后台轮询须归因 null（denylist 归因纪律顺带钉死）。
    const SAVE_API = '/api/process/saveOrModifyProcessData';
    for (const iid of ['intent_1', 'intent_2']) {
      const step = axes.steps.find((s) => s.intentId === iid);
      const hit = (step.forensics.network || []).find((n) => n.url === SAVE_API && n.attributedStepId === step.stepId);
      if (!hit) throw new Error(`${iid} 缺归因到本步的保存 POST 取证`);
      if (!hit.errorEnvelope || hit.errorEnvelope.ok !== true || hit.errorEnvelope.actual !== 200) throw new Error(`${iid} 保存信封应 ok/200，实际 ${JSON.stringify(hit.errorEnvelope)}`);
    }
    for (const s of axes.steps) for (const n of s.forensics.network || []) {
      if (n.url === '/api/auths/poll' && n.attributedStepId !== null) throw new Error('后台轮询被误归因到业务步（denylist 归因纪律破）');
    }
    // 参数→回放闭环（codex R3-F1）：fill 事件在回放期身份回读成立——真填了值且读回一致，丢参必 identityReadback 失败。
    const s1 = axes.steps.find((s) => s.intentId === 'intent_1');
    const fillAction = (s1.eventActions || []).find((x) => x.action && x.action.identityReadback);
    if (!fillAction || fillAction.action.identityReadback.ok !== true) throw new Error(`intent_1 fill 身份回读应 ok，实际 ${JSON.stringify(fillAction)}`);
    const historyLines = readFileSync(join(runDir, 'run-history.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
    if (historyLines.length !== EXPECT_EVENT_SEQ.length) throw new Error(`run-history 应逐 event ${EXPECT_EVENT_SEQ.length} 行，实际 ${historyLines.length}`);
    for (const ext of ['html', 'md', 'json']) if (!existsSync(join(runDir, `${CASE_ID}.report.${ext}`))) throw new Error(`缺报告 .${ext}`);
    if (!readFileSync(join(runDir, `${CASE_ID}.report.html`), 'utf8').includes(CASE_ID)) throw new Error('报告 html 应含 caseId');
  });

  // ---------- C8 链完整性 + 卫生（全 tmp + 全站输出扫描，词表单一事实源，codex R1-F6） ----------
  await checkAsync('C8 卫生：caseId 绑定；全 tmp 文本产物 + 全站 stdout/stderr 过 FORBIDDEN_KEYWORDS；核心产物零 sut host', async () => {
    if (readJson(eventsFile).caseId !== readJson(frozenFile).caseId) throw new Error('events/expected caseId 应绑定一致');
    const offenders = [];
    const scanText = (label, text) => {
      const low = String(text).toLowerCase();
      for (const kw of FORBIDDEN_KEYWORDS) if (low.includes(kw)) offenders.push(`${label}⇒「${kw}」`);
    };
    (function walk(dir) {
      for (const n of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, n.name);
        if (n.isDirectory()) { walk(p); continue; }
        if (/\.(webm|png)$/.test(n.name)) continue; // 二进制媒体不做文本扫描
        scanText(p.slice(tmp.length + 1), readFileSync(p, 'utf8'));
      }
    })(tmp);
    stationOutputs.forEach((t, i) => scanText(`station-output[${i}]`, t));
    if (offenders.length) throw new Error(`凭据形关键词命中：${offenders.join('；')}`);
    // 核心确定性产物（events/frozen/draft/observed）零 sut host（axes/报告呈现层 URL 剥离由各自契约金牌守）。
    for (const f of [eventsFile, frozenFile, draftFile, observedFile]) if (readFileSync(f, 'utf8').includes(sutHost)) throw new Error(`${f} 携 sut host`);
  });
} finally {
  await sut.close();
}

console.log(`e2e-chain golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
