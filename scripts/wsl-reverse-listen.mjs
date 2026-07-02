#!/usr/bin/env node
// WSL 侧反向隧道入口（开发环境工具，非产品链路）。
// 背景：WSL 直连目标站不通、Windows 可达；且 Windows 防火墙拦 WSL→Windows 入站（2026-07-02 亲验），
// 正向转发不可行。本方案反向：Windows 代理主动连出到本脚本（Windows→WSL localhost 转发默认放行），
// 本脚本把 WSL 本地客户端（playwright/curl）与 Windows 隧道连接配对，流量经 Windows 网络栈到站。
// 监听：127.0.0.1:15519 = 客户端口（WSL 内当 baseUrl 用）；127.0.0.1:15520 = 隧道补给口（Windows 代理连入）。
// 用法（WSL）：node scripts/wsl-reverse-listen.mjs 。配套 Windows 侧 scripts/win-reverse-agent.mjs。
import net from 'node:net';

const CLIENT_PORT = 15519;
const TUNNEL_PORT = 15520;
const idle = [];

const tunnelServer = net.createServer((sock) => {
  sock.setKeepAlive(true, 15000);
  sock.on('error', () => {});
  sock.on('close', () => { const i = idle.indexOf(sock); if (i >= 0) idle.splice(i, 1); });
  idle.push(sock);
});
tunnelServer.listen(TUNNEL_PORT, '127.0.0.1', () => console.log(`隧道补给口 127.0.0.1:${TUNNEL_PORT} 就绪（等 Windows 代理连入）`));

const clientServer = net.createServer((client) => {
  const tunnel = idle.shift();
  if (!tunnel || tunnel.destroyed) { client.destroy(); return; }
  client.pipe(tunnel);
  tunnel.pipe(client);
  const drop = () => { client.destroy(); tunnel.destroy(); };
  client.on('error', drop);
  tunnel.on('error', drop);
  client.on('close', drop);
});
clientServer.listen(CLIENT_PORT, '127.0.0.1', () => console.log(`客户端口 127.0.0.1:${CLIENT_PORT} 就绪（WSL 内以此为 baseUrl）`));
