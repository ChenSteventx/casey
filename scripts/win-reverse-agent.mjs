#!/usr/bin/env node
// Windows 侧反向隧道代理（开发环境工具，非产品链路）：主动连出到 WSL 的隧道补给口（localhost:15520，
// Windows→WSL localhost 转发默认放行、无需防火墙/管理员），首包到达时才连目标站并双向桥接。
// 目标地址只从 site.json 读、绝不出现在命令行/日志（护栏 #7）。
// 用法（Windows）：node D:\ctx\heren\casey\scripts\win-reverse-agent.mjs 。开机重拉：win-forward-start.cmd。
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(HERE, '..', 'site.json'), 'utf8'));
const target = new URL(site.target.startUrl);
const TARGET_PORT = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
const TUNNEL_PORT = 15520;
const POOL = 8;
let live = 0;

function openTunnel() {
  if (live >= POOL) return;
  live++;
  const tunnel = net.connect(TUNNEL_PORT, '127.0.0.1');
  let upstream = null;
  const done = () => { live--; tunnel.destroy(); if (upstream) upstream.destroy(); setTimeout(fill, 500); };
  tunnel.on('error', done);
  tunnel.on('close', done);
  tunnel.once('data', (first) => {
    // 有首包 = 该隧道被配对使用；立即补一条新闲置隧道保持池量。
    fill();
    upstream = net.connect(TARGET_PORT, target.hostname, () => {
      upstream.write(first);
      tunnel.pipe(upstream);
      upstream.pipe(tunnel);
    });
    upstream.on('error', done);
  });
}
function fill() { while (live < POOL) openTunnel(); }
fill();
setInterval(fill, 5000);
console.log(`反向代理已起：池 ${POOL} 条 → localhost:${TUNNEL_PORT}（目标地址不回显）`);
