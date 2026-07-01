#!/usr/bin/env node
// coverage-add 回归锁（hermetic-gap-freeze 契约冻结，checksum 进 prd-p7-report.json testChecksums）。改本文件=Test Ratchet 判红。
//
// 缺口补覆盖：P7 凭据兜底门（护栏 #7）此前零 golden 覆盖。本锁是给【已存在且已绿】的
//   bin/report.mjs:credentialGate(outputs) 补回归覆盖，属 coverage-add（对现有实现跑为绿），非 red ATDD。
//
// 被测契约（直接复用现有导出，无需改 bin）：
//   credentialGate(outputs) -> { ok:true } | { ok:false, hit:string }
//   outputs 是「将落盘的三份产物」字符串映射（html/md/json），即 renderReport(model) 的输出经壳层组装后那一份。
//   命中禁字段关键词（authorization/set-cookie/password/apikey/x-api-key/bearer /secret/credential）
//   或凭据文件（.auth/credentials.json、site.json、.auth/site.json）里的敏感字面量 → fail-closed { ok:false }。
//
// 覆盖（纯函数门）三态：①干净产物放行 ②含禁字段关键词被拦 ③含凭据文件敏感字面量被拦。
// 覆盖（端到端壳层）④：spawn 真实 bin/report.mjs——门在 write 之前拒写。这是纯函数门测不到的接缝：
//   干净模型 → exit 0 且三份产物齐落盘；泄漏模型 → 非零退出、三份产物一个都不落（在 write 之前拒）。
//   顺带钉死壳层退出码分类（用法错 2 / 门拦 1 / 成功 0，均直读自 bin/report.mjs main()）。
//   字面量分支依赖凭据文件物理存在于固定路径（collectSecretLiterals 内部、未导出、路径硬编码、无注入缝），
//   故在 .auth/site.json 临时写入一个【合成的、非真凭据】字面量 → 跑门 → finally 清理，净零副作用
//   （.auth/ 与 site.json 均已 .gitignore；当前环境二者均不存在）。绝不触碰任何预先存在的真凭据文件。
import { writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BIN = join(ROOT, 'bin', 'report.mjs');
const AUTH_DIR = join(ROOT, '.auth');
const SITE_JSON = join(AUTH_DIR, 'site.json');

const fail = (msg) => { console.error(`FAIL p7-credgate-cov: ${msg}`); process.exit(1); };
let checks = 0;
const ok = () => { checks++; };

let credentialGate;
try {
  ({ credentialGate } = await import(`file://${BIN.replace(/\\/g, '/')}`));
} catch (e) {
  fail(`无法 import bin/report.mjs（coverage-add 不应红）：${String(e && e.message).slice(-200)}`);
}
if (typeof credentialGate !== 'function') fail('bin/report.mjs 未导出 credentialGate 纯函数');

// 合成「三份产物」字符串：仅为门的输入，站位 renderReport(model) 的 html/markdown/json 落盘前那一份。
const CASE = 'cov-001';
function cleanOutputs() {
  return {
    [`${CASE}.report.html`]: `<!doctype html><html><head><style>body{font:14px}</style></head><body><h1>${CASE}</h1><p>通过</p></body></html>`,
    [`${CASE}.report.md`]: `# ${CASE}\n\n裁定：通过\n`,
    [`${CASE}.report.json`]: JSON.stringify({ caseId: CASE, verdict: 'PASS' }),
  };
}

// ============ ① 干净产物放行 ============
{
  const r = credentialGate(cleanOutputs());
  if (!r || r.ok !== true) fail(`干净产物须放行 ok:true（实得 ${JSON.stringify(r)}）`);
  ok();
}

// ============ ② 含禁字段关键词被拦（fail-closed）============
// 逐个关键词注入到 html 产物，断言被拦且 hit 指出命中的关键词。大小写无关（门内 toLowerCase）。
for (const kw of ['authorization', 'set-cookie', 'password', 'secret', 'credential']) {
  const out = cleanOutputs();
  // 用大写注入以顺带验证「大小写无关」：门会 toLowerCase 后比对。
  out[`${CASE}.report.html`] = `<!doctype html><html><body><pre>${kw.toUpperCase()}: 不慎混入</pre></body></html>`;
  const r = credentialGate(out);
  if (!r || r.ok !== false) fail(`含禁字段关键词「${kw}」须被拦 ok:false（实得 ${JSON.stringify(r)}）`);
  if (typeof r.hit !== 'string' || !r.hit.includes(kw)) fail(`拦截 hit 须指出命中的关键词「${kw}」（实得 ${r.hit}）`);
}
ok();

// ============ ③ 含凭据文件敏感字面量被拦（fail-closed）============
// 合成一个非真凭据字面量写入 .auth/site.json，构造一份「不含任何禁字段关键词、只含该字面量」的产物，
// 隔离验证字面量分支（而非被关键词分支抢先命中）。finally 净零清理。
const FAKE_LITERAL = 'FAKE-SITE-VALUE-7a3f9b2c1d'; // >=6 字符、且不含任一禁字段关键词子串
const createdAuthDir = !existsSync(AUTH_DIR);
const preExistingSite = existsSync(SITE_JSON);
let didWrite = false;
try {
  if (preExistingSite) {
    // 预先存在（疑似真凭据）——绝不触碰、绝不覆盖。该分支留待落地环境单独覆盖。
    console.error('注意：.auth/site.json 预先存在（疑似真凭据），跳过合成注入以免触碰真凭据；字面量分支本次未实跑');
  } else {
    if (createdAuthDir) mkdirSync(AUTH_DIR, { recursive: true });
    // 仅写 value 字段；collectSecretLiterals 只收集对象的 value（不收集 key），故被收集的字面量是 FAKE_LITERAL。
    writeFileSync(SITE_JSON, JSON.stringify({ session: FAKE_LITERAL }), 'utf8');
    didWrite = true;

    const out = cleanOutputs();
    out[`${CASE}.report.html`] = `<!doctype html><html><body><p>会话标识 ${FAKE_LITERAL} 不慎混入报告</p></body></html>`;
    const r = credentialGate(out);
    if (!r || r.ok !== false) fail(`含凭据文件敏感字面量须被拦 ok:false（实得 ${JSON.stringify(r)}）`);
    if (typeof r.hit !== 'string' || !r.hit.includes('敏感字面量')) fail(`字面量拦截 hit 须为「敏感字面量（已隐去）」措辞（实得 ${r.hit}）`);

    // 反证：移除该字面量后同结构产物应放行，证明拦截确由字面量分支触发、而非别处。
    const out2 = cleanOutputs();
    const r2 = credentialGate(out2);
    if (!r2 || r2.ok !== true) fail(`移除字面量后干净产物仍须放行 ok:true（实得 ${JSON.stringify(r2)}）`);
    ok();
  }
} finally {
  if (didWrite) rmSync(SITE_JSON, { force: true });
  if (createdAuthDir && existsSync(AUTH_DIR)) {
    try { rmSync(AUTH_DIR, { recursive: true, force: true }); } catch { /* 净零尽力而为 */ }
  }
}

// ============ ④ 端到端壳层：spawn 真实 bin/report.mjs，验「落盘前 fail-closed」接缝 ============
// 前三节测纯函数门；本节钉死壳层行为——门在 write 之前拒写。复现 main() 的真实退出码：
//   缺 --model → exit 2（用法错，bin/report.mjs:62）；门命中 → exit 1（bin/report.mjs:78）；成功 → exit 0（默认返回）。
const TMP = mkdtempSync(join(tmpdir(), 'casey-p7-cg-'));
function writeModel(name, model) {
  const p = join(TMP, name);
  writeFileSync(p, JSON.stringify(model), 'utf8');
  return p;
}
function runReport(modelPath, outDir) {
  const r = spawnSync(process.execPath, [BIN, '--model', modelPath, '--out', outDir], { encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr || '', stdout: r.stdout || '', error: r.error };
}
const reportFiles = (outDir, caseId) => ['html', 'md', 'json'].map((ext) => join(outDir, `${caseId}.report.${ext}`));

// 干净 report-model：renderReport 只硬性要求 caseId + steps[]，其余走默认；全用中文/benign 值，
// 确保渲染产物不含任一禁字段关键词、不含任何凭据字面量。
const CLEAN_CASE = 'p7cg-clean-001';
const cleanModel = {
  schemaVersion: 1,
  caseId: CLEAN_CASE,
  title: '凭据门端到端·干净样例',
  channel: 'web',
  generatedAt: '2026-07-01T00:00:00+08:00',
  verdictSummary: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
  steps: [{
    stepId: 'atstep_0', intentId: 'i0', atom: '提交', verdict: 'PASS',
    action: { kind: 'click', describe: '点提交' },
    postAssertions: [{ kind: 'text', op: 'equals', value: '已提交', actual: '已提交', ok: true, soft: false }],
  }],
};

// ④a 干净模型 → exit 0 且三份产物齐落盘
{
  const outDir = join(TMP, 'out-clean');
  const r = runReport(writeModel('clean.model.json', cleanModel), outDir);
  if (r.code !== 0) fail(`干净模型须 exit 0（实得 ${r.code}；stderr=${r.stderr.slice(0, 200)}）`);
  for (const f of reportFiles(outDir, CLEAN_CASE)) if (!existsSync(f)) fail(`干净模型须落盘 ${f}`);
  ok();
}

// ④b 含泄漏凭据的 report-model → 门在 write 之前拒写：exit 1 + 三份产物一个都不落盘。
// 复现真实威胁：抓取的页面/LLM 输出里混进了 HTTP 鉴权头（渲染进 HTML pre.reply / MD「LLM 回复」，
//   json 旁车 renderJson 只投影白名单字段、不含 observed/replyText——该泄漏在三份产物里只命中 html/md 两份）。
// 断言「一个都不落盘」而非「只有中招的两份不落」：credentialGate 是落盘前一次性批量扫描（bin/report.mjs:77-78），
//   任一产物命中即整批拒写，故 json 虽自身干净也不会单独落盘——这正是本节要钉死的接缝，无需再补一条 json 专属泄漏样例。
const DIRTY_CASE = 'p7cg-dirty-001';
const leaked = 'HTTP/1.1 200 OK\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.PAYLOAD.sig\nSet-Cookie: session=abc';
const dirtyModel = {
  ...cleanModel,
  caseId: DIRTY_CASE,
  title: '凭据门端到端·泄漏样例',
  steps: [{ ...cleanModel.steps[0], observed: { replyText: leaked } }],
};
{
  const outDir = join(TMP, 'out-dirty');
  const r = runReport(writeModel('dirty.model.json', dirtyModel), outDir);
  if (r.error) fail(`bin/report.mjs 未正常起跑（spawn error：${String(r.error && r.error.message).slice(0, 160)}）`);
  if (r.code !== 1) fail(`含泄漏凭据的模型须 exit 1（门拦，bin/report.mjs:78；实得 ${r.code}）`);
  for (const f of reportFiles(outDir, DIRTY_CASE)) if (existsSync(f)) fail(`门命中后不得落盘（在 write 之前拒）：${f} 不应存在`);
  // stderr 须点明护栏 #7 / 凭据兜底门（措辞随实现，只软校关键锚点，避免脆断言随文案改动误报红）
  if (!/护栏\s*#?7|凭据/.test(r.stderr)) fail(`门拦截 stderr 须点明护栏 #7/凭据兜底门（实得 ${r.stderr.slice(0, 200)}）`);
  ok();
}

// ④c 用法错（缺 --model）→ exit 2（与门拦 exit 1、成功 exit 0 区分：退出码分类本身是接缝的一部分）
{
  const r = spawnSync(process.execPath, [BIN], { encoding: 'utf8' });
  if (r.status !== 2) fail(`缺 --model 须 exit 2（用法错，实得 ${r.status}）`);
  ok();
}

// 净零清理临时夹具（净零副作用）。
try { rmSync(TMP, { recursive: true, force: true }); } catch { /* 尽力而为 */ }

console.log(`ok   p7-credgate-cov: ${checks} 组凭据兜底门覆盖全过`);
process.exit(0);
