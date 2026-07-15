#!/usr/bin/env node
// WSL 侧 CEF 原始 TCP 反向中继。与 HTTP 15519 通道物理分离，不解析/改写任何字节，可承载 CDP WebSocket。
import net from 'node:net';

const CLIENT_PORT = Number(process.env.CASEY_CEF_CLIENT_PORT || 15529);
const SUPPLY_PORT = Number(process.env.CASEY_CEF_SUPPLY_PORT || 15530);
const SUPPLY_BIND = process.env.CASEY_CEF_TUNNEL_BIND || '127.0.0.1';
const validPort = (value) => Number.isInteger(value) && value >= 1024 && value <= 65535;
if (!validPort(CLIENT_PORT) || !validPort(SUPPLY_PORT) || CLIENT_PORT === SUPPLY_PORT) {
  console.error('CEF 中继：端口配置非法');
  process.exit(64);
}

const idle = [];
const supply = net.createServer((socket) => {
  socket.setKeepAlive(true, 15000);
  socket.on('error', () => {});
  socket.on('close', () => { const index = idle.indexOf(socket); if (index >= 0) idle.splice(index, 1); });
  idle.push(socket);
});

function take() {
  while (idle.length) {
    const socket = idle.shift();
    if (socket && !socket.destroyed) return socket;
  }
  return null;
}

const clients = net.createServer((client) => {
  const tunnel = take();
  if (!tunnel) { client.destroy(); return; }
  const close = () => { client.destroy(); tunnel.destroy(); };
  client.on('error', close);
  tunnel.on('error', close);
  client.on('close', () => tunnel.destroy());
  tunnel.on('close', () => client.destroy());
  client.pipe(tunnel);
  tunnel.pipe(client);
});

supply.listen(SUPPLY_PORT, SUPPLY_BIND, () => console.log(`CEF 中继补给口就绪：${SUPPLY_BIND}:${SUPPLY_PORT}`));
// 客户端口恒绑回环；真实调试地址永不在 WSL 进程出现。
clients.listen(CLIENT_PORT, '127.0.0.1', () => console.log(`CEF 客户端口就绪：127.0.0.1:${CLIENT_PORT}`));
