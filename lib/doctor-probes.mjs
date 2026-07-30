// lib/doctor-probes.mjs —— casey doctor 就绪探针【采集层，导出化】（p9-tier2-live-smoke GRILL D4）。
// 本模块是 bin/doctor.mjs 原私有探针的原样搬迁：行为零变化（doctor 金牌复跑作证），
// 唯一目的是让 tier-2 自检壳层复用同一套结构化采集结果——不照抄私有函数、不另起第二套探法。
// 本层碰真环境（fs/spawn/net/process），故不是纯层；纯判定仍归 lib/doctor.mjs 与 lib/selftest-tier2.mjs。
//
// 凭据纪律（护栏 #7）：只出布尔/端口号/平台等结构标志，凭据值与真目标地址一律不出模块、不进返回值。
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { PROJECT_ROOT, CREDS_FILE, hasPlaywright } from './paths.mjs';
import { classifyLogicalTargetShape, classifyExecutionTargetShape } from './execution-target/wiring.mjs';

// ── isWSL：读 /proc/version 含 microsoft 或 WSL_DISTRO_NAME env（win/mac 无 /proc/version 即 false）──
export function detectWSL() {
  if (process.env.WSL_DISTRO_NAME) return true;
  try { return /microsoft/i.test(readFileSync('/proc/version', 'utf8')); } catch { return false; }
}

// ── engines.node 单源（读不到回默认 >=22.12）─────────────────────
export function requiredNodeRange() {
  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));
    if (pkg.engines && pkg.engines.node) return pkg.engines.node;
  } catch { /* 回默认 */ }
  return '>=22.12';
}

// ── playwright：文件在位 → 真 import → chromium.executablePath 存在性 ──
export async function probePlaywright() {
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
export function probeFonts(platform) {
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

// 只从 devProxyUrl 取【回环】端口号（非回环一律不取、不探——防连真目标，GRILL D6）。
export function loopbackPort(target) {
  try {
    if (!target || typeof target.devProxyUrl !== 'string') return null;
    const u = new URL(target.devProxyUrl);
    const loop = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1' || u.hostname === '[::1]';
    if (!loop) return null;
    const port = Number(u.port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch { return null; }
}

// ── site.json：目标只在内存验形状，绝不输出；顺带取回环端口 ─────
export function probeSite() {
  const sitePath = process.env.AT_SITE_JSON || join(PROJECT_ROOT, 'site.json');
  let present = false, shapeOk = false, proxyPort = null;
  let hasLogicalTarget = false, hasLoopbackTransport = false, configuredMode;
  if (existsSync(sitePath)) {
    present = true;
    try {
      const j = JSON.parse(readFileSync(sitePath, 'utf8'));
      const t = j && typeof j.target === 'object' && j.target ? j.target : null;
      proxyPort = loopbackPort(t); // 只从 devProxyUrl 取回环端口号，绝不碰 startUrl
      const logicalShape = classifyLogicalTargetShape(t?.startUrl);
      hasLogicalTarget = logicalShape.hasLogicalTarget;
      shapeOk = logicalShape.shapeOk;
      hasLoopbackTransport = proxyPort != null;
      configuredMode = typeof t?.transportMode === 'string'
        ? t.transportMode
        : (typeof t?.transport?.mode === 'string' ? t.transport.mode : undefined);
    } catch { shapeOk = false; }
  }
  return {
    present,
    shapeOk,
    proxyPort,
    hasLogicalTarget,
    hasLoopbackTransport,
    configuredMode,
  };
}

// ── 凭据：AT_CREDS_USER/PASS env 在场视同在位；否则 existsSync 文件 + 顶层键名 ──
export function probeCreds() {
  if (process.env.AT_CREDS_USER && process.env.AT_CREDS_PASS) return { present: true, shapeOk: true };
  const credsPath = process.env.AT_CREDS_FILE || CREDS_FILE;
  if (!existsSync(credsPath)) return { present: false, shapeOk: false };
  try {
    const j = JSON.parse(readFileSync(credsPath, 'utf8'));
    return { present: true, shapeOk: !!j && typeof j === 'object' && ('user' in j) && ('pass' in j) }; // 只看键名，值不取
  } catch { return { present: true, shapeOk: false }; }
}

// ── 隧道回环端口 TCP 连（只回状态 + 耗时；绝不回显地址）─────────────
export function probeTunnel(proxyPort) {
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

// ── 结构化采集：一次跑齐全部探针 → 纯层 env（doctor 与 tier-2 共用同一入口）──
// 返回 { platform, isWSL, site, env }：site 只给壳层判「配没配」，env 直接喂 lib/doctor.mjs 的 runDoctor。
export async function collectDoctorEnv() {
  const platform = process.platform;
  const isWSL = detectWSL();
  const pw = await probePlaywright();
  const site = probeSite();
  const env = {
    node: { nodeVersion: process.version, requiredRange: requiredNodeRange() },
    playwright: { present: pw.present, importable: pw.importable },
    chromium: { execResolved: pw.execResolved, execExists: pw.execExists },
    fonts: { platform, isWSL, cjkProbeNonEmpty: probeFonts(platform) },
    siteJson: { present: site.present, shapeOk: site.shapeOk },
    creds: probeCreds(),
    tunnel: await probeTunnel(site.proxyPort),
    executionTarget: classifyExecutionTargetShape({
      platform,
      isWSL,
      hasLogicalTarget: site.hasLogicalTarget,
      hasLoopbackTransport: site.hasLoopbackTransport,
      configuredMode: site.configuredMode,
    }),
  };
  return { platform, isWSL, site, env };
}
