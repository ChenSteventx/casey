#!/usr/bin/env node
// doctor.golden.mjs —— casey doctor 跨平台就绪自检（casey-doctor，full）红金牌。
// 实现前红：lib/doctor.mjs 未建（import 即失败，全红）；casey.mjs 无 case 'doctor'（采集壳冒烟红）。
// 支点（GRILL D7）：主体是纯函数层注入假 env 逐项翻红绿（hermetic 可验），外加采集壳 hermetic 冒烟
//   （真跑 casey doctor 验结构与零泄漏）。不 rig：纯层注入的是探针已解析布尔/平台/端口，不倒着裁定；
//   零泄漏复现 AT_SITE_JSON/AT_CREDS_FILE 冻结接缝喂含哨兵密文的真临时夹具，验采集壳真不漏。
import { runDoctor, checkNode, checkFonts, checkTunnel, checkSiteJson, checkCreds } from '../../lib/doctor.mjs';
import { FORBIDDEN_KEYWORDS } from '../../lib/cred-gate.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');

const fails = [];
function assert(cond, msg) { if (!cond) fails.push(msg); }
const byId = (res, id) => res.items.find((i) => i.id === id);

// 全就绪注入 env（探针已解析结果，非倒裁）。
function readyEnv() {
  return {
    node: { nodeVersion: '22.12.0', requiredRange: '>=22.12' },
    playwright: { present: true, importable: true },
    chromium: { execResolved: true, execExists: true },
    fonts: { platform: 'linux', isWSL: true, cjkProbeNonEmpty: true },
    siteJson: { present: true, shapeOk: true },
    creds: { present: true, shapeOk: true },
    tunnel: { proxyPort: 15519, portListening: true, probeMs: 2 },
  };
}

const READINESS_IDS = ['node', 'playwright-present', 'playwright-import', 'chromium'];
const ALL_IDS = [...READINESS_IDS, 'fonts', 'site-json', 'creds', 'tunnel'];

// ── A1 全就绪 → exit 0 逐项 ok（隧道恒 route-human）───────────────
{
  const r = runDoctor(readyEnv());
  assert(r.exitCode === 0, `A1 全就绪应 exitCode 0，实得 ${r.exitCode}`);
  assert(r.items.length === 8, `A1 应逐项 8 条，实得 ${r.items.length}`);
  for (const it of r.items) {
    assert(['ok', 'route-human'].includes(it.status), `A1 项 ${it.id} 应 ok/route-human，实得 ${it.status}`);
    assert(it.status !== 'fail' && it.status !== 'warn', `A1 项 ${it.id} 不应 fail/warn`);
    assert(typeof it.id === 'string' && 'status' in it && 'detail' in it && 'hint' in it, `A1 项 ${it.id} 须 {id,status,detail,hint} 四键`);
  }
  assert(byId(r, 'tunnel').status === 'route-human', 'A1 隧道恒 route-human');
}

// ── A2 缺 @playwright/test → fail 带建议非崩，exit 1 ─────────────
{
  const env = readyEnv(); env.playwright = { present: false, importable: true };
  let r; assert((() => { try { r = runDoctor(env); return true; } catch { return false; } })(), 'A2 runDoctor 不得 throw');
  const it = byId(r, 'playwright-present');
  assert(it.status === 'fail', `A2 playwright-present 应 fail，实得 ${it.status}`);
  assert(/npm install/.test(it.hint), 'A2 hint 应含 npm install 意图');
  assert(r.exitCode === 1, `A2 应 exitCode 1，实得 ${r.exitCode}`);
}

// ── A3 缺 chromium / 装了加载失败 → 各 fail 带建议，exit 1 ────────
{
  const env = readyEnv(); env.chromium = { execResolved: true, execExists: false };
  const r = runDoctor(env);
  const it = byId(r, 'chromium');
  assert(it.status === 'fail', `A3 chromium 应 fail，实得 ${it.status}`);
  assert(/playwright install chromium/.test(it.hint), 'A3 chromium hint 应含 playwright install chromium 意图');
  assert(r.exitCode === 1, `A3 chromium 缺应 exitCode 1，实得 ${r.exitCode}`);

  // importable:false（装了但加载失败）→ playwright-import fail 指重装依赖。
  const env2 = readyEnv(); env2.playwright = { present: true, importable: false };
  const r2 = runDoctor(env2);
  const imp = byId(r2, 'playwright-import');
  assert(imp.status === 'fail', `A3 playwright-import 应 fail，实得 ${imp.status}`);
  assert(/重装/.test(imp.hint), 'A3 playwright-import hint 应指重装依赖');
  assert(r2.exitCode === 1, 'A3 importable:false 应 exitCode 1');
}

// ── A4 node 版本过低 → fail 指 engines；边界 semver 手写比较正确 ──
{
  const env = readyEnv(); env.node = { nodeVersion: '20.10.0', requiredRange: '>=22.12' };
  const r = runDoctor(env);
  const it = byId(r, 'node');
  assert(it.status === 'fail', `A4 node 过低应 fail，实得 ${it.status}`);
  assert(it.detail.includes('20.10.0') && it.detail.includes('>=22.12'), 'A4 node detail 应报当前版本与要求范围');
  assert(r.exitCode === 1, 'A4 node 过低应 exitCode 1');

  // 边界：恰等下界 ok；下界减一 fail（验无 off-by-one）。
  assert(checkNode({ nodeVersion: '22.12.0', requiredRange: '>=22.12' }).status === 'ok', 'A4 边界 22.12.0 恰等下界应 ok');
  assert(checkNode({ nodeVersion: '22.11.9', requiredRange: '>=22.12' }).status === 'fail', 'A4 边界 22.11.9 应 fail');
  assert(checkNode({ nodeVersion: 'v24.18.0', requiredRange: '>=22.12' }).status === 'ok', 'A4 带 v 前缀高版本应 ok');
  assert(checkNode({ nodeVersion: '22.13.0', requiredRange: '>=22.12' }).status === 'ok', 'A4 minor 高一位应 ok');
}

// ── A5 中文字体缺 → warn 不翻 exit ──────────────────────────────
{
  const env = readyEnv(); env.fonts = { platform: 'linux', isWSL: true, cjkProbeNonEmpty: false };
  const r = runDoctor(env);
  const it = byId(r, 'fonts');
  assert(it.status === 'warn', `A5 字体缺应 warn（非 fail），实得 ${it.status}`);
  assert(it.hint.length > 0, 'A5 字体缺 hint 非空');
  assert(r.exitCode === 0, `A5 就绪级全 ok 时字体 warn 不翻 exit，实得 ${r.exitCode}`);
}

// ── A6 凭据/site.json 缺失 → warn 清晰指引不翻 exit；形态不符只报结构 ──
{
  const env = readyEnv();
  env.siteJson = { present: false, shapeOk: false };
  env.creds = { present: false, shapeOk: false };
  const r = runDoctor(env);
  assert(byId(r, 'site-json').status === 'warn', 'A6 site.json 缺应 warn');
  assert(byId(r, 'creds').status === 'warn', 'A6 凭据缺应 warn');
  assert(/README\.md/.test(byId(r, 'site-json').hint), 'A6 site.json hint 应指 README.md');
  assert(/README\.md/.test(byId(r, 'creds').hint), 'A6 凭据 hint 应指 README.md');
  assert(r.exitCode === 0, `A6 缺真机件绝不惩罚 hermetic 装机（exit 0），实得 ${r.exitCode}`);

  // 形态不符：present:true shapeOk:false → warn，detail/hint 只报结构、零字段值。
  const sj = checkSiteJson({ present: true, shapeOk: false });
  assert(sj.status === 'warn', 'A6 site.json 形态不符应 warn');
  assert(!/https?:\/\//.test(sj.detail + sj.hint), 'A6 形态不符 detail/hint 不得含 URL 值');
  const cr = checkCreds({ present: true, shapeOk: false });
  assert(cr.status === 'warn', 'A6 凭据形态不符应 warn');
}

// ── A8 隧道项标 route-human，不阻塞主判 ─────────────────────────
{
  const t1 = checkTunnel({ proxyPort: 15519, portListening: true, probeMs: 1 });
  const t2 = checkTunnel({ proxyPort: 15519, portListening: false, probeMs: 8000 });
  assert(t1.status === 'route-human' && t2.status === 'route-human', 'A8 隧道在听/不在听皆 route-human');
  assert(!/:\/\//.test(t1.detail) && !/:\/\//.test(t2.detail), 'A8 隧道 detail 零裸 :// 目标地址');
  assert(!/target/i.test(t1.detail) && !/target/i.test(t2.detail), 'A8 隧道 detail 零 target 地址');

  const env = readyEnv(); env.tunnel = { proxyPort: 15519, portListening: false, probeMs: 8000 };
  assert(runDoctor(env).exitCode === 0, 'A8 隧道不在听绝不驱动退出码（其余就绪级全 ok → exit 0）');
}

// ── A9 OS 分支字体建议正确 + 路径分隔符 ─────────────────────────
{
  const linux = checkFonts({ platform: 'linux', isWSL: false, cjkProbeNonEmpty: false });
  const wsl = checkFonts({ platform: 'linux', isWSL: true, cjkProbeNonEmpty: false });
  const mac = checkFonts({ platform: 'darwin', isWSL: false, cjkProbeNonEmpty: false });
  const win = checkFonts({ platform: 'win32', isWSL: false, cjkProbeNonEmpty: false });
  for (const [name, h] of [['linux', linux.hint], ['wsl', wsl.hint]]) {
    assert(/fc-list/.test(h), `A9 ${name} 字体 hint 应含 fc-list`);
    assert(/Noto Sans CJK/.test(h), `A9 ${name} 字体 hint 应含 Noto Sans CJK`);
    assert(!h.includes('\\'), `A9 ${name} 字体 hint 不得含反斜杠路径分隔符`);
  }
  assert(/PingFang|苹方/.test(mac.hint), 'A9 macos 字体 hint 应含 PingFang/苹方');
  assert(!mac.hint.includes('\\'), 'A9 macos 字体 hint 不得含反斜杠');
  assert(/微软雅黑/.test(win.hint), 'A9 win 字体 hint 应含微软雅黑');
  assert(/Fonts/.test(win.hint), 'A9 win 字体 hint 应含 Fonts 目录');
  assert(win.hint.includes('\\'), 'A9 win 字体 hint 应用反斜杠路径分隔符');
}

// ── A7 采集壳零泄漏（复现真接缝，喂含哨兵密文的临时夹具）─────────
function scanLeak(tag, text, extraForbidden = []) {
  const low = text.toLowerCase();
  for (const s of ['SENTINEL-TARGET', 'SENTINEL-USER', 'SENTINEL-PASS-9x9', ...extraForbidden]) {
    assert(!text.includes(s), `${tag} 输出泄漏哨兵字面量「${s}」`);
  }
  assert(!/:\/\//.test(text), `${tag} 输出含裸 ://（目标地址泄漏）`);
  for (const kw of FORBIDDEN_KEYWORDS) {
    assert(!low.includes(kw), `${tag} 输出含禁字段关键词「${kw}」`);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'casey-doctor-'));
try {
  const siteFix = join(tmp, 'site.json');
  writeFileSync(siteFix, JSON.stringify({
    target: { startUrl: 'https://SENTINEL-TARGET.invalid/x', devProxyUrl: 'http://127.0.0.1:15519' },
  }), 'utf8');
  const credsFix = join(tmp, 'creds.json');
  writeFileSync(credsFix, JSON.stringify({ user: 'SENTINEL-USER', pass: 'SENTINEL-PASS-9x9' }), 'utf8');

  {
    const r = spawnSync(process.execPath, [CASEY, 'doctor'], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, AT_SITE_JSON: siteFix, AT_CREDS_FILE: credsFix },
    });
    const text = (r.stdout || '') + (r.stderr || '');
    assert([0, 1].includes(r.status), `A7 doctor 应 exit 0/1（就绪与否都不崩），实得 ${r.status}`);
    // 采集壳查含哨兵的 site.json/凭据、探隧道端口时真的一个值都没漏；亦不回显临时夹具绝对路径。
    scanLeak('A7', text, [tmp]);
  }

  // ── A10 采集壳 hermetic 冒烟（本机真环境；验结构与安全，不苛求绿）───
  {
    const r = spawnSync(process.execPath, [CASEY, 'doctor'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    const text = (r.stdout || '') + (r.stderr || '');
    assert([0, 1].includes(r.status), `A10 doctor 本机应 exit 0/1（不崩、不 exit 2/3/64），实得 ${r.status}`);
    assert(!/at .*doctor\.mjs.*\n\s+at /.test(text), 'A10 不得有未捕获异常栈');
    for (const id of ALL_IDS) {
      assert((r.stdout || '').includes(id), `A10 stdout 应含逐项 id「${id}」（无静默漏项）`);
    }
    scanLeak('A10', text);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (fails.length) {
  console.error(`doctor golden: ${fails.length} 败`);
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('doctor golden: GREEN');
process.exit(0);
