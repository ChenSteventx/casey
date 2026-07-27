#!/usr/bin/env node
// bin/doctor.mjs —— casey doctor 跨平台就绪自检【采集壳】（casey-doctor，GRILL D7）。
// 唯一碰真环境处：探 platform+isWSL、读 process.version 与 package.json.engines、hasPlaywright() +
//   真 import('@playwright/test') + chromium.executablePath()→existsSync、OS 分支字体探测、
//   existsSync 凭据/site.json；目标值只在内存验 URL 形状，绝不输出；devProxyUrl 仅取回环端口。
//   把结果装成 env 喂纯层 lib/doctor.mjs → 渲染逐项行 + process.exit(runDoctor(env).exitCode)。
// 渲染沿 selftestTier1 的 ok/RED 配色，另加 warn(黄)/route-human(灰)。
//
// 凭据纪律（护栏 #7，GRILL D6）：全输出零凭据值、零真目标地址（隧道只述回环端口号）、零裸 ://、
//   零用户绝对路径（output-seal）。site.json/凭据只 existsSync + JSON.parse 后查顶层键名，值绝不进输出。
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { PROJECT_ROOT, CREDS_FILE, hasPlaywright } from '../lib/paths.mjs';
import { runDoctor } from '../lib/doctor.mjs';
import {
  classifyLogicalTargetShape,
  classifyExecutionTargetShape,
} from '../lib/execution-target/wiring.mjs';

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

// ── site.json：目标只在内存验形状，绝不输出；顺带取回环端口 ─────
function probeSite() {
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

// ── 凭据：AT_CREDS_USER/PASS env 在场视同在位；否则 existsSync 文件 + 顶层键名 ──
function probeCreds() {
  if (process.env.AT_CREDS_USER && process.env.AT_CREDS_PASS) return { present: true, shapeOk: true };
  const credsPath = process.env.AT_CREDS_FILE || CREDS_FILE;
  if (!existsSync(credsPath)) return { present: false, shapeOk: false };
  try {
    const j = JSON.parse(readFileSync(credsPath, 'utf8'));
    return { present: true, shapeOk: !!j && typeof j === 'object' && ('user' in j) && ('pass' in j) }; // 只看键名，值不取
  } catch { return { present: true, shapeOk: false }; }
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

function executionTargetItem(shape, sitePresent) {
  if (!sitePresent) {
    return {
      id: 'execution-target',
      status: 'warn',
      detail: '执行目标未配置（hermetic 用户可无）',
      hint: '真机运行前补齐规范逻辑目标',
    };
  }
  if (!shape.ready) {
    return {
      id: 'execution-target',
      status: 'fail',
      detail: `执行目标分类不可准入：${shape.runtimeClass} / ${shape.transportMode}`,
      hint: '使用与运行平台匹配的传输方式，并保持逻辑目标独立',
    };
  }
  return {
    id: 'execution-target',
    status: 'ok',
    detail: `执行目标分类：${shape.runtimeClass} / ${shape.transportMode} / origin ${shape.originContinuity}`,
    hint: '',
  };
}

async function main() {
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

  const base = runDoctor(env);
  const targetItem = executionTargetItem(env.executionTarget, site.present);
  const items = [...base.items, targetItem];
  const exitCode = base.exitCode || (targetItem.status === 'fail' ? 1 : 0);
  console.log(col(C.bold, '\ncasey doctor —— 跨平台就绪自检') + col(C.gray, '（node / playwright / 中文字体 / 凭据·site.json / 隧道）') + '\n');
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
