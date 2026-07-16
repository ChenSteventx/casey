#!/usr/bin/env node
// Windows 侧反向隧道代理：主动向监听端补充待用连接，收到客户端首块后才连接真实目标。
// 真目标只从 site.json 读入内存，绝不进入 argv、日志或状态文件（护栏 #7）。
import net from 'node:net';
import tls from 'node:tls';
import { readTunnelConfig } from './tunnel-config.mjs';

const POOL = 8;
const TOKEN_PREFIX = 'CASEY-TUNNEL/1 ';

function sanitizedFatal(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

let config;
try {
  config = readTunnelConfig();
} catch {
  sanitizedFatal('反向代理启动失败：站点配置无效', 64);
}

const { target, tunnelPort: TUNNEL_PORT } = config;
const TARGET_HOST = target.hostname.replace(/^\[|\]$/g, '');
const TARGET_PORT = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
const TUNNEL_HOST = process.env.CASEY_TUNNEL_HOST || '127.0.0.1';
const TUNNEL_TOKEN = process.env.CASEY_TUNNEL_TOKEN || '';
if (TUNNEL_TOKEN && (!/^[\x21-\x7e]{16,512}$/.test(TUNNEL_TOKEN))) {
  sanitizedFatal('反向代理启动失败：补给握手配置无效', 64);
}

let waitingSupplies = 0;
let refillDelay = 500;

function connectUpstream(onConnected) {
  if (target.protocol === 'https:') {
    const options = {
      host: TARGET_HOST,
      port: TARGET_PORT,
      rejectUnauthorized: true,
      ALPNProtocols: ['http/1.1'],
    };
    if (net.isIP(TARGET_HOST) === 0) options.servername = TARGET_HOST;
    return tls.connect(options, onConnected);
  }
  return net.connect(TARGET_PORT, TARGET_HOST, onConnected);
}

function openTunnel() {
  if (waitingSupplies >= POOL) return;
  waitingSupplies += 1;
  const tunnel = net.connect(TUNNEL_PORT, TUNNEL_HOST);
  let upstream = null;
  let supplyHeld = true;
  let settled = false;

  const releaseSupply = () => {
    if (!supplyHeld) return;
    supplyHeld = false;
    waitingSupplies = Math.max(0, waitingSupplies - 1);
  };

  // error 与 close 可能先后到达；只结算一次，避免计数变负后形成连接风暴。
  const done = (failed) => {
    if (settled) return;
    settled = true;
    releaseSupply();
    tunnel.destroy();
    if (upstream) upstream.destroy();
    if (failed) refillDelay = Math.min(refillDelay * 2, 10000);
    setTimeout(fill, refillDelay);
  };

  tunnel.on('connect', () => {
    if (TUNNEL_TOKEN) tunnel.write(`${TOKEN_PREFIX}${TUNNEL_TOKEN}\n`);
  });
  tunnel.on('error', () => done(true));
  tunnel.on('close', () => done(false));
  tunnel.once('data', (first) => {
    // 首块一到即暂停。否则上游建连期间同一请求的后续块会在无监听器时丢失。
    tunnel.pause();
    releaseSupply();
    refillDelay = 500;
    fill(); // 已消费的待用连接立即补回，不等业务连接关闭。

    upstream = connectUpstream(() => {
      if (settled) return;
      upstream.write(first);
      tunnel.pipe(upstream);
      upstream.pipe(tunnel);
      tunnel.resume();
    });
    upstream.on('error', () => done(true));
    upstream.on('close', () => done(false));
  });
}

function fill() {
  while (waitingSupplies < POOL) openTunnel();
}

process.on('uncaughtException', () => sanitizedFatal('反向代理运行失败：详情已抑制'));
process.on('unhandledRejection', () => sanitizedFatal('反向代理运行失败：详情已抑制'));

fill();
setInterval(fill, 5000);
console.log(`反向代理已起：待用补给池 ${POOL} 条（目标地址不回显）`);
