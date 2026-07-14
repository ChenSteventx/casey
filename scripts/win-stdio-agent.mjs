#!/usr/bin/env node
// Windows 侧 stdio 桥代理（开发环境工具，非产品链路）：win-reverse-agent.mjs 的无网络栈替身。
// 每条桥 = 一个 wsl.exe 子进程（stdio 管道直通 WSL 内 scripts/stdio-supply.mjs → 回环 15520 补给口）
// + 首包到达时才连目标站并双向桥接。适用场景：wslrelay 回环转发半死且 Hyper-V NAT 入站不可达
// （2026-07-14 实录：端口规则 NATInboundRuleNotApplicable、VM 级 DefaultInboundAction Allow 仍不通）。
// 目标地址只从 site.json 读、绝不出现在命令行/日志（护栏 #7）。
// 用法（Windows，node 在 PATH 的终端）：node D:\ctx\heren\casey\scripts\win-stdio-agent.mjs
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(HERE, '..', 'site.json'), 'utf8'));
const target = new URL(site.target.startUrl);
const TARGET_PORT = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
const POOL = 6;
let live = 0;
let refillDelay = 500; // 失败退避：500ms 起倍增、封顶 10s；配对成功即复位（沿 2026-07-08 settled 教训）

// WSL 内 node 是 nvm 管理——wsl.exe 的非交互 shell（dash/.bashrc 早退）都加载不到 PATH（2026-07-14 实录），
// 故按序取：CASEY_WSL_NODE 环境变量 → 已知 nvm 绝对路径候选（逐个 test -x 校验）→ 登录 bash 探测兜底。
const CANDIDATES = [process.env.CASEY_WSL_NODE, '/home/test/.nvm/versions/node/v24.18.0/bin/node'].filter(Boolean);
let WSL_NODE = null;
for (const c of CANDIDATES) {
  const t = spawnSync('wsl.exe', ['--', '/bin/sh', '-c', `test -x '${c}' && echo ok`], { encoding: 'utf8' });
  if ((t.stdout || '').includes('ok')) { WSL_NODE = c; break; }
}
if (!WSL_NODE) {
  const probe = spawnSync('wsl.exe', ['--', '/bin/bash', '-lc', 'command -v node'], { encoding: 'utf8' });
  const p = (probe.stdout || '').trim().split('\n').pop();
  if (p && p.startsWith('/')) WSL_NODE = p;
}
if (!WSL_NODE) {
  console.error('探不到 WSL 内 node 绝对路径：设 $env:CASEY_WSL_NODE 后重跑（WSL 内 command -v node 取值）'); process.exit(1);
}
console.log(`WSL node: ${WSL_NODE}`);
const SUPPLY = '/mnt/d/ctx/heren/casey/scripts/stdio-supply.mjs';

function openBridge() {
  if (live >= POOL) return;
  live++;
  const child = spawn('wsl.exe', ['--', WSL_NODE, SUPPLY], { stdio: ['pipe', 'pipe', 'ignore'] });
  let upstream = null;
  let settled = false;
  const done = (failed) => {
    if (settled) return;
    settled = true;
    live--;
    try { child.kill(); } catch { /* 已退 */ }
    if (upstream) upstream.destroy();
    if (failed) refillDelay = Math.min(refillDelay * 2, 10000);
    setTimeout(fill, refillDelay);
  };
  child.on('error', () => done(true));
  child.on('exit', () => done(false));
  child.stdin.on('error', () => done(true));
  child.stdout.once('data', (first) => {
    // 有首包 = 该桥被 WSL 侧配对使用；立即补新桥保持池量。
    refillDelay = 500;
    fill();
    upstream = net.connect(TARGET_PORT, target.hostname, () => {
      upstream.write(first);
      child.stdout.pipe(upstream);
      upstream.pipe(child.stdin);
    });
    upstream.on('error', () => done(true));
    upstream.on('close', () => done(false));
  });
}
function fill() { while (live < POOL) openBridge(); }
fill();
setInterval(fill, 5000);
console.log(`stdio 桥已起：池 ${POOL} 条 → wsl.exe 管道 → WSL 回环 15520（目标地址不回显）`);
