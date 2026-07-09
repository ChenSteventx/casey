// casey-demo.golden.mjs —— casey demo 样例报告子命令红先行金牌（casey-demo，light）。
// 断言清单对齐 docs/plans/casey-demo/proposed/GOLDEN-TESTPLAN.md A1-A8：门面接通产三件套 + 报告内容
// （裁定徽章/逐步 PASS/自包含）+ 凭据卫生（零关键词零 ://）+ help 可见（无黑名单 token）+ 幂等固定落点
// + 凭据毒化仍绿（demo 结构性不接凭据源）+ 跨平台路径提示不硬编码盘符 + 冻结金牌零 re-sign 回归锁。
// 性质：light 金牌，hermetic（夹具 SUT + 零凭据 + 零 LLM + 零真机），但需本机 chromium（demo 做真回放，
// 同 e2e-chain 同级，非 selftest --tier1 的零外部依赖）——本金牌不塞进 tier1。
// 实现前红：无 casey demo 子命令时门面走 default: exit 64（未知命令），A1/A2/A3/A5/A6/A7 无从谈起；
// help 无该行，A4 红。A8 现已绿，防退化守（实现后须仍绿）。
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { FORBIDDEN_KEYWORDS } from '../../lib/cred-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const CASE_ID = 'tc_wf_publish_sample';
const runDir = join(ROOT, 'runs', 'sample-wf-publish');

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-400)}`); } }
function runDemo(env = process.env, timeout = 90000) {
  return spawnSync(process.execPath, [CASEY, 'demo'], { encoding: 'utf8', timeout, env });
}
function readProducts() {
  return {
    html: readFileSync(join(runDir, `${CASE_ID}.report.html`), 'utf8'),
    md: readFileSync(join(runDir, `${CASE_ID}.report.md`), 'utf8'),
    json: readFileSync(join(runDir, `${CASE_ID}.report.json`), 'utf8'),
  };
}
function scanForbidden(label, text, offenders) {
  const low = String(text || '').toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) if (low.includes(kw)) offenders.push(`${label}⇒「${kw}」`);
}

// ---------- A1 casey demo exit 0 产 report.{html,md,json} + 旁件齐全 ----------
let r1;
check('A1 casey demo（零参）exit0，runs/sample-wf-publish/ 落三件套报告 + 旁件', () => {
  r1 = runDemo();
  if (r1.status !== 0) throw new Error(`应 exit 0，实际 ${r1.status}：${((r1.stderr || '') + (r1.stdout || '')).slice(-500)}`);
  for (const ext of ['html', 'md', 'json']) {
    const p = join(runDir, `${CASE_ID}.report.${ext}`);
    if (!existsSync(p)) throw new Error(`缺 ${p}`);
  }
  for (const f of ['verdict.json', 'report-model.json', 'axes.json']) {
    if (!existsSync(join(runDir, f))) throw new Error(`缺旁件 ${f}`);
  }
});

// ---------- A2 报告含裁定徽章、逐步 PASS、自包含可打开 ----------
check('A2 报告含裁定徽章「通过」、verdict 恰 2 步全 PASS、html 自包含无外链', () => {
  if (!r1 || r1.status !== 0) throw new Error('依赖 A1 产出，A1 未 exit 0——无从核报告内容');
  const { html } = readProducts();
  if (!html.includes('class="badge pass"') || !html.includes('通过')) throw new Error('html 缺裁定徽章「通过」标记');
  const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
  if (!Array.isArray(verdict.steps) || verdict.steps.length !== 2) throw new Error(`verdict.steps 应恰 2 步，实际 ${JSON.stringify(verdict.steps)}`);
  const bad = verdict.steps.filter((s) => s.verdict !== 'PASS');
  if (bad.length) throw new Error(`裁定应全 PASS（happy 夹具），实际 ${JSON.stringify(bad)}`);
  if (/<script[^>]*\ssrc\s*=/.test(html)) throw new Error('html 含外链 <script src>（自包含纪律破）');
  if (/<link[^>]*\shref\s*=/.test(html)) throw new Error('html 含外链样式（自包含纪律破）');
});

// ---------- A3 全文零凭据、零 :// ----------
check('A3 三产物 + stdout/stderr 全文零凭据形关键词、零 ://、无回环 host 明文', () => {
  if (!r1 || r1.status !== 0) throw new Error('依赖 A1 产出，A1 未 exit 0——无从扫产物文本');
  const { html, md, json } = readProducts();
  const offenders = [];
  scanForbidden('report.html', html, offenders);
  scanForbidden('report.md', md, offenders);
  scanForbidden('report.json', json, offenders);
  scanForbidden('stdout', r1.stdout, offenders);
  scanForbidden('stderr', r1.stderr, offenders);
  if (offenders.length) throw new Error(`凭据形关键词命中：${offenders.join('；')}`);
  for (const [label, text] of [['report.html', html], ['report.md', md], ['report.json', json]]) {
    const cnt = (text.match(/:\/\//g) || []).length;
    if (cnt !== 0) throw new Error(`${label} 含 :// 计数 ${cnt}（应 0，夹具地址不进产物）`);
  }
  if (/127\.0\.0\.1|localhost/.test(html) || /127\.0\.0\.1|localhost/.test(md) || /127\.0\.0\.1|localhost/.test(json)) {
    throw new Error('产物含回环 host 明文（127.0.0.1/localhost）');
  }
});

// ---------- A4 help 暴露 casey demo 且无黑名单 token ----------
check('A4 casey help 暴露 casey demo 行，且不含 handover-pack C2 黑名单形态', () => {
  const r = spawnSync(process.execPath, [CASEY, 'help'], { encoding: 'utf8', timeout: 30000 });
  const txt = (r.stdout || '') + (r.stderr || '');
  if (!txt.includes('casey demo')) throw new Error('help 输出无 casey demo 行');
  for (const stale of ['run <file>', '--build <id>]', 'P0 引导 + P1 词表/ADR 已落地', '--sut <url>']) {
    if (txt.includes(stale)) throw new Error(`help 仍含黑名单形态「${stale}」`);
  }
});

// ---------- A5 幂等/固定落点 ----------
check('A5 连跑两次落同一 runDir/caseId（无时间戳目录），清建覆盖，产物形态一致', () => {
  if (!r1 || r1.status !== 0) throw new Error('依赖 A1 首跑 exit 0——首跑未成先无从谈第二跑幂等');
  const r2 = runDemo();
  if (r2.status !== 0) throw new Error(`第二次 casey demo 应 exit 0，实际 ${r2.status}：${((r2.stderr || '') + (r2.stdout || '')).slice(-400)}`);
  for (const ext of ['html', 'md', 'json']) {
    if (!existsSync(join(runDir, `${CASE_ID}.report.${ext}`))) throw new Error(`第二次未落同一固定路径 report.${ext}`);
  }
  const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
  if (verdict.caseId !== CASE_ID) throw new Error(`第二次 caseId 应仍恰 ${CASE_ID}，实际 ${verdict.caseId}`);
  const bad = verdict.steps.filter((s) => s.verdict !== 'PASS');
  if (bad.length) throw new Error('第二次裁定应仍全 PASS（清建幂等）');
});

// ---------- A6 demo 不依赖凭据：毒化仍绿 ----------
check('A6 AT_SITE_JSON/AT_CREDS_* 凭据毒化三件套后仍 exit 0、产物仍落、零泄漏', () => {
  const poisonTmp = mkdtempSync(join(tmpdir(), 'casey-demo-golden-poison-'));
  const siteFile = join(poisonTmp, 'site.synthetic.json');
  writeFileSync(siteFile, JSON.stringify({}));
  const env = { ...process.env, AT_SITE_JSON: siteFile, AT_CREDS_FILE: join(poisonTmp, 'no-creds-here.json') };
  delete env.AT_CREDS_USER; delete env.AT_CREDS_PASS;
  const r3 = runDemo(env);
  if (r3.status !== 0) throw new Error(`凭据毒化后应仍 exit 0（demo 结构性不接凭据源），实际 ${r3.status}：${((r3.stderr || '') + (r3.stdout || '')).slice(-400)}`);
  const { html, md, json } = readProducts();
  const offenders = [];
  scanForbidden('poisoned report.html', html, offenders);
  scanForbidden('poisoned report.md', md, offenders);
  scanForbidden('poisoned report.json', json, offenders);
  scanForbidden('poisoned stdout', r3.stdout, offenders);
  scanForbidden('poisoned stderr', r3.stderr, offenders);
  if (offenders.length) throw new Error(`凭据毒化后产物/输出命中：${offenders.join('；')}`);
});

// ---------- A7 跨平台路径提示不硬编码盘符 ----------
check('A7 bin/demo.mjs 源码零 /mnt/d 字面硬编码；stdout 路径提示由真实产物路径推导', () => {
  const src = readFileSync(join(ROOT, 'bin', 'demo.mjs'), 'utf8');
  if (/\/mnt\/d/i.test(src)) throw new Error('bin/demo.mjs 源码仍含 /mnt/d 字面硬编码（GRILL D5 未清）');
  if (!r1.stdout.includes(runDir)) throw new Error('stdout 打开路径提示未含真实产物绝对路径（未证明由真实路径推导）');
});

// ---------- A8 现有金牌不 re-sign（回归锁：真跑三个冻结金牌确认仍绿） ----------
check('A8 回归锁：cli-mcp-face / handover-pack / e2e-chain 三冻结金牌真跑仍 exit0（无冻结金牌被 re-sign）', () => {
  for (const golden of ['cli-mcp-face.golden.mjs', 'handover-pack.golden.mjs', 'e2e-chain.golden.mjs']) {
    const r = spawnSync(process.execPath, [join(ROOT, 'tests', '_golden', golden)], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error(`${golden} 应仍 exit 0（回归），实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-400)}`);
  }
});

console.log(`casey-demo golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
