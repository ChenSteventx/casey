#!/usr/bin/env node
// bin/doctor.mjs —— casey doctor 跨平台就绪自检【采集壳】（casey-doctor，GRILL D7）。
// 唯一碰真环境处：探 platform+isWSL、读 process.version 与 package.json.engines、hasPlaywright() +
//   真 import('@playwright/test') + chromium.executablePath()→existsSync、OS 分支字体探测、
//   本地账户/site.json 形状检查（值只在内存校验、绝不输出）、devProxyUrl 回环端口 TCP 连（绝不碰 target.startUrl）。
//   把结果装成 env 喂纯层 lib/doctor.mjs → 渲染逐项行 + process.exit(runDoctor(env).exitCode)。
// 渲染沿 selftestTier1 的 ok/RED 配色，另加 warn(黄)/route-human(灰)。
//
// 凭据纪律（护栏 #7，GRILL D6）：全输出零凭据值、零真目标地址（隧道只述回环端口号）、零裸 ://、
//   零用户绝对路径（output-seal）。site.json/账户文件经 JSON.parse 校验闭合形状，值绝不进输出。
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { PROJECT_ROOT, AUTH_DIR, hasPlaywright } from '../lib/paths.mjs';
import { runDoctor } from '../lib/doctor.mjs';
import { inspectAccountStatus } from '../lib/account-config.mjs';

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', gray: '\x1b[90m', cyan: '\x1b[36m', bold: '\x1b[1m' };
const col = (c, s) => `${c}${s}${C.reset}`;
const LABEL = {
  ok: col(C.green, 'ok  '), fail: col(C.red, 'RED '), warn: col(C.yellow, 'warn'), 'route-human': col(C.gray, 'hum '),
};

// ── isWSL：读 /proc/version 含 microsoft 或 WSL_DISTRO_NAME env（win/mac 无 /proc/version 即 false）──
function detectWSL() {
  if (process.env.WSL_DISTRO_NAME) return true;
  try { return /microsoft/i.test(readFileSync('/proc/version', 'utf8')); } catch { return false; }
}

// ── engines.node 单源（读不到回默认 >=22.12）─────────────────────
function requiredNodeRange() {
  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));
    if (pkg.engines && pkg.engines.node) return pkg.engines.node;
  } catch { /* 回默认 */ }
  return '>=22.12';
}

// ── playwright：文件在位 → 真 import → chromium.executablePath 存在性 ──
async function probePlaywright() {
  const present = hasPlaywright();
  let importable = false, execResolved = false, execExists = false;
  try {
    const pw = await import('@playwright/test');
    importable = true;
    try {
      const p = pw.chromium.executablePath(); // 只取存在性，路径绝不进输出（output-seal）
      execResolved = !!p;
      execExists = execResolved && existsSync(p);
    } catch { execResolved = false; execExists = false; }
  } catch { importable = false; }
  return { present, importable, execResolved, execExists };
}

// ── 中文字体：按 OS 分支探法（探的都是「有没有」布尔，文案由纯层出）──
function probeFonts(platform) {
  try {
    if (platform === 'win32') {
      const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
      const dir = join(windir, 'Fonts');
      return ['msyh.ttc', 'msyh.ttf', 'msyhbd.ttc', 'simsun.ttc', 'simsun.ttf'].some((f) => existsSync(join(dir, f)));
    }
    if (platform === 'darwin') {
      const macFonts = ['/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Light.ttc', '/Library/Fonts/Arial Unicode.ttf'];
      if (macFonts.some((p) => existsSync(p))) return true;
      const r = spawnSync('fc-list', [':lang=zh'], { encoding: 'utf8', timeout: 5000 });
      return r.status === 0 && String(r.stdout || '').trim().length > 0;
    }
    // linux / WSL：playwright 跑在 Linux 侧，查 Linux 侧字体库。
    const r = spawnSync('fc-list', [':lang=zh'], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0 && String(r.stdout || '').trim().length > 0;
  } catch { return false; }
}

// ── site.json：existsSync + 顶层键名（绝不读值）；顺带取回环端口 ─────
function probeSite() {
  const sitePath = process.env.AT_SITE_JSON || join(PROJECT_ROOT, 'site.json');
  let present = false, shapeOk = false, proxyPort = null;
  if (existsSync(sitePath)) {
    present = true;
    try {
      const j = JSON.parse(readFileSync(sitePath, 'utf8'));
      const t = j && typeof j.target === 'object' && j.target ? j.target : null;
      shapeOk = !!t && ('startUrl' in t || 'devProxyUrl' in t); // 只看键名，值不取
      proxyPort = loopbackPort(t); // 只从 devProxyUrl 取回环端口号，绝不碰 startUrl
    } catch { shapeOk = false; }
  }
  return { present, shapeOk, proxyPort };
}

// 只从 devProxyUrl 取【回环】端口号（非回环一律不取、不探——防连真目标，GRILL D6）。
function loopbackPort(target) {
  try {
    if (!target || typeof target.devProxyUrl !== 'string') return null;
    const u = new URL(target.devProxyUrl);
    const loop = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1' || u.hostname === '[::1]';
    if (!loop) return null;
    const port = Number(u.port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch { return null; }
}

// ── 隧道回环端口 TCP 连（只回状态 + 耗时；绝不回显地址）─────────────
function probeTunnel(proxyPort) {
  return new Promise((res) => {
    const t0 = Date.now();
    if (proxyPort == null) { res({ proxyPort: null, portListening: false, probeMs: 0 }); return; }
    let done = false;
    const finish = (listening) => {
      if (done) return; done = true;
      try { sock.destroy(); } catch { /* ignore */ }
      res({ proxyPort, portListening: listening, probeMs: Date.now() - t0 });
    };
    const sock = net.connect({ host: '127.0.0.1', port: proxyPort });
    sock.setTimeout(800);
    sock.on('connect', () => finish(true));
    sock.on('timeout', () => finish(false));
    sock.on('error', () => finish(false));
  });
}

async function main() {
  const platform = process.platform;
  const isWSL = detectWSL();
  const pw = await probePlaywright();
  const site = probeSite();
  const accounts = inspectAccountStatus({ authDir: AUTH_DIR, env: process.env });
  const env = {
    node: { nodeVersion: process.version, requiredRange: requiredNodeRange() },
    playwright: { present: pw.present, importable: pw.importable },
    chromium: { execResolved: pw.execResolved, execExists: pw.execExists },
    fonts: { platform, isWSL, cjkProbeNonEmpty: probeFonts(platform) },
    siteJson: { present: site.present, shapeOk: site.shapeOk },
    creds: { present: accounts.aiMiddle.configured, shapeOk: accounts.aiMiddle.shapeOk },
    desktopAccount: { present: accounts.desktop.configured, shapeOk: accounts.desktop.shapeOk, ready: accounts.desktop.ready },
    tunnel: await probeTunnel(site.proxyPort),
  };

  const { items, exitCode } = runDoctor(env);
  console.log(col(C.bold, '\ncasey doctor —— 跨平台就绪自检') + col(C.gray, '（node / playwright / 中文字体 / 账户·site.json / 隧道）') + '\n');
  for (const it of items) {
    const line = `${LABEL[it.status]} ${col(C.cyan, `[${it.id}]`)} ${it.detail}${it.hint ? col(C.gray, '  → ' + it.hint) : ''}`;
    console.log(line);
  }
  console.log('');
  if (exitCode === 0) {
    console.log(col(C.green, '就绪级全 ok → hermetic 回放就绪（exit 0）。warn/route-human 项按上方建议自行处理，不阻塞。'));
  } else {
    console.log(col(C.red, '就绪级有 RED → 未就绪（exit 1）。按上方建议修复就绪级项后重跑；本命令只诊断不自动修。'));
  }
  process.exit(exitCode);
}

main().catch(() => {
  // fail-closed：采集壳意外故障不得抛裸栈（可能夹带路径/环境），静默退 1。
  console.error(col(C.red, 'casey doctor：采集期意外故障（详情已抑制，防泄漏），exit 1。'));
  process.exit(1);
});
