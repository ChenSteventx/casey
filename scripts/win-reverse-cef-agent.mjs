#!/usr/bin/env node
// Windows 侧 CEF 原始 TCP 反向代理：主动给 WSL 补连接，每个 tunnel 首字节到达后连接本机调试端口并原样 pipe。
import net from 'node:net';

const DEBUG_HOST = process.env.CASEY_CEF_DEBUG_HOST || '127.0.0.1';
const DEBUG_PORT = Number(process.env.CASEY_CEF_DEBUG_PORT);
const TUNNEL_HOST = process.env.CASEY_CEF_TUNNEL_HOST || '127.0.0.1';
const TUNNEL_PORT = Number(process.env.CASEY_CEF_SUPPLY_PORT || 15530);
const POOL = 6;
const loopback = new Set(['127.0.0.1', 'localhost', '::1']);
const validPort = (value) => Number.isInteger(value) && value >= 1024 && value <= 65535;
if (!loopback.has(DEBUG_HOST) || !validPort(DEBUG_PORT) || !validPort(TUNNEL_PORT)) {
  console.error('CEF Windows 代理：调试端口缺失或配置非法（真实值不回显）');
  process.exit(64);
}

let live = 0;
let refillDelay = 500;

function openTunnel() {
  if (live >= POOL) return;
  live += 1;
  const tunnel = net.connect(TUNNEL_PORT, TUNNEL_HOST);
  let upstream = null;
  let settled = false;
  const done = (failed) => {
    if (settled) return;
    settled = true;
    live -= 1;
    tunnel.destroy();
    if (upstream) upstream.destroy();
    if (failed) refillDelay = Math.min(refillDelay * 2, 10000);
    setTimeout(fill, refillDelay);
  };
  tunnel.on('error', () => done(true));
  tunnel.on('close', () => done(false));
  tunnel.once('data', (first) => {
    // 首块到达即暂停：上游 TCP 连接建立前的后续 HTTP/WebSocket 字节由 socket 内部缓冲，
    // 避免只保住 first、丢掉同一请求的第二块。
    tunnel.pause();
    refillDelay = 500;
    fill();
    upstream = net.connect(DEBUG_PORT, DEBUG_HOST, () => {
      upstream.write(first);
      tunnel.pipe(upstream);
      upstream.pipe(tunnel);
      tunnel.resume();
    });
    upstream.on('error', () => done(true));
    upstream.on('close', () => done(false));
  });
}

function fill() { while (live < POOL) openTunnel(); }
fill();
setInterval(fill, 5000);
console.log(`CEF Windows 代理已起：池 ${POOL} 条 → ${TUNNEL_HOST}:${TUNNEL_PORT}（调试上游不回显）`);
