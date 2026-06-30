#!/usr/bin/env node
// 草稿 / coverage-add / 未冻 / 未进任何 prd 的 testChecksums —— 接入轻车道 accept 才算数。
//
// 缺口补覆盖：P7 凭据兜底门（护栏 #7）此前零 golden 覆盖。本草稿是给【已存在且已绿】的
//   bin/report.mjs:credentialGate(outputs) 补回归覆盖，属 coverage-add（对现有实现跑应为绿），
//   不是 red ATDD —— 故不应先红；若它红了，说明实现或本草稿写错，而非「待实现」。
//
// 被测契约（直接复用现有导出，无需改 bin）：
//   credentialGate(outputs) -> { ok:true } | { ok:false, hit:string }
//   outputs 是「将落盘的三份产物」字符串映射（html/md/json），即 renderReport(model) 的输出经壳层组装后那一份。
//   命中禁字段关键词（authorization/set-cookie/password/apikey/x-api-key/bearer /secret/credential）
//   或凭据文件（.auth/credentials.json、site.json、.auth/site.json）里的敏感字面量 → fail-closed { ok:false }。
//
// 覆盖三态：①干净产物放行 ②含禁字段关键词被拦 ③含凭据文件敏感字面量被拦。
//   字面量分支依赖凭据文件物理存在于固定路径（collectSecretLiterals 内部、未导出、路径硬编码、无注入缝），
//   故本草稿在 .auth/site.json 临时写入一个【合成的、非真凭据】字面量 → 跑门 → finally 清理，净零副作用
//   （.auth/ 与 site.json 均已 .gitignore；当前环境二者均不存在）。绝不触碰任何预先存在的真凭据文件。
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
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

console.log(`ok   p7-credgate-cov: ${checks} 组凭据兜底门覆盖全过（草稿/未冻/未进 testChecksums）`);
process.exit(0);
