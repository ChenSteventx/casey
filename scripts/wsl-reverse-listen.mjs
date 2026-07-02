#!/usr/bin/env node
// WSL 侧反向隧道入口（开发环境工具，非产品链路）。
// 背景：WSL 直连目标站不通、Windows 可达；且 Windows 防火墙拦 WSL→Windows 入站（2026-07-02 亲验），
// 正向转发不可行。本方案反向：Windows 代理主动连出到本脚本（Windows→WSL localhost 转发默认放行），
// 本脚本把 WSL 本地客户端（playwright/curl）与 Windows 隧道连接配对，流量经 Windows 网络栈到站。
// 监听：127.0.0.1:15519 = 客户端口（WSL 内当 baseUrl 用）；127.0.0.1:15520 = 隧道补给口（Windows 代理连入）。
//
// Host 重写（2026-07-02 spike 修正）：目标网关按虚拟主机路由——客户端发的 Host: 127.0.0.1:15519 落进
// 默认静态块（GET 静态 200 / API POST 405）。故对 client→tunnel 方向做逐请求 HTTP 头改写：把 Host 换成
// 目标真实 host（从 site.json 内存读、绝不回显，护栏 #7）。逐请求 = 正确处理 keep-alive/流水线的多请求，
// 不止首个（否则复用连接的后续 API 仍 405）。tunnel→client 方向（响应）原样 pipe、不解析。
// 用法（WSL）：node scripts/wsl-reverse-listen.mjs 。配套 Windows 侧 scripts/win-reverse-agent.mjs（不变）。
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(HERE, '..', 'site.json'), 'utf8'));
const HOST_HEADER = new URL(site.target.startUrl).host; // host[:port]，只进内存、绝不回显

const CLIENT_PORT = 15519;
const TUNNEL_PORT = 15520;
const HEAD_MAX = 65536;
const idle = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tunnelServer = net.createServer((sock) => {
  sock.setKeepAlive(true, 15000);
  sock.on('error', () => {});
  sock.on('close', () => { const i = idle.indexOf(sock); if (i >= 0) idle.splice(i, 1); });
  idle.push(sock);
});
tunnelServer.listen(TUNNEL_PORT, '127.0.0.1', () => console.log(`隧道补给口 127.0.0.1:${TUNNEL_PORT} 就绪（等 Windows 代理连入）`));

async function takeTunnel(budgetMs = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const s = idle.shift();
    if (s && !s.destroyed) return s;
    await sleep(50);
  }
  return null;
}

// 逐请求 HTTP 头改写器：把每个请求的 Host 换成目标真实 host，透传 body（Content-Length / chunked / 无 body）。
// 状态机保证 keep-alive 复用连接上的每个请求都被改写（不止首个）。
// 关键：每个完整请求（改写头 + 原 body）攒齐后【单次】writeOut——Windows 代理用 tunnel.once('data') 抓首包
// 再异步连 upstream，期间到达的后续包会丢；把整条请求合成一次写，保证首个请求头+body 一起落进 once 捕获。
function makeRewriter(writeOut) {
  let buf = Buffer.alloc(0);
  let mode = 'HEAD';       // HEAD | LEN | CHUNK
  let remaining = 0;       // LEN 模式待透传的 body 字节
  let pending = [];        // 当前请求累积的输出片（头 + body），完整后一次 flush
  const CRLF2 = Buffer.from('\r\n\r\n');
  const CHUNK_END = Buffer.from('\r\n0\r\n\r\n');
  const flush = () => { if (pending.length) { writeOut(Buffer.concat(pending)); pending = []; } };

  function rewriteHead(headBuf) {
    // headBuf 以 \r\n\r\n 结尾——先切掉终止符再 split，否则尾部空行会把补的 Host 挤到 body 里。
    const raw = headBuf.toString('latin1');
    const headEnd = raw.indexOf('\r\n\r\n');
    const lines = raw.slice(0, headEnd).split('\r\n');
    const out = [lines[0]]; // 请求行原样
    let te = null, cl = 0;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      const low = l.toLowerCase();
      if (low.startsWith('host:')) continue;                 // 丢弃原 Host，稍后补真 host
      if (low.startsWith('proxy-connection:')) continue;     // 代理噪声
      if (low.startsWith('transfer-encoding:') && low.includes('chunked')) te = 'chunked';
      if (low.startsWith('content-length:')) cl = parseInt(l.slice(l.indexOf(':') + 1).trim(), 10) || 0;
      out.push(l);
    }
    out.push(`Host: ${HOST_HEADER}`);
    return { head: Buffer.from(out.join('\r\n') + '\r\n\r\n', 'latin1'), te, cl };
  }

  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    // 循环消费缓冲：一个 data 可能含多个请求（流水线）或半个头。
    for (;;) {
      if (mode === 'HEAD') {
        const idx = buf.indexOf(CRLF2);
        if (idx < 0) { if (buf.length > HEAD_MAX) return false; return true; }
        const headBuf = buf.subarray(0, idx + 4);
        buf = buf.subarray(idx + 4);
        const { head, te, cl } = rewriteHead(headBuf);
        pending.push(head);
        if (te === 'chunked') { mode = 'CHUNK'; }
        else if (cl > 0) { mode = 'LEN'; remaining = cl; }
        else { flush(); mode = 'HEAD'; } // 无 body（GET 等），整条请求即头、一次写完
      } else if (mode === 'LEN') {
        if (buf.length === 0) return true;
        const take = Math.min(remaining, buf.length);
        pending.push(Buffer.from(buf.subarray(0, take)));
        buf = buf.subarray(take);
        remaining -= take;
        if (remaining === 0) { flush(); mode = 'HEAD'; } // 头+body 齐，一次写完
        else return true;
      } else { // CHUNK：累积直到终止块 0\r\n\r\n
        const end = buf.indexOf(CHUNK_END);
        if (end < 0) { if (buf.length > HEAD_MAX * 4) return false; return true; }
        pending.push(Buffer.from(buf.subarray(0, end + CHUNK_END.length)));
        buf = buf.subarray(end + CHUNK_END.length);
        flush();
        mode = 'HEAD';
      }
    }
  };
}

const clientServer = net.createServer((client) => {
  client.pause();
  client.on('error', () => {});
  (async () => {
    const tunnel = await takeTunnel();
    if (!tunnel) { client.destroy(); return; }
    const drop = () => { client.destroy(); tunnel.destroy(); };
    tunnel.on('error', drop);
    tunnel.on('close', () => client.end());
    client.on('close', () => tunnel.destroy());
    const rewrite = makeRewriter((b) => { try { tunnel.write(b); } catch { drop(); } });
    client.on('data', (d) => { if (rewrite(d) === false) drop(); });
    tunnel.pipe(client); // 响应方向：原样回传
    client.resume();
  })().catch(() => client.destroy());
});
clientServer.listen(CLIENT_PORT, '127.0.0.1', () => console.log(`客户端口 127.0.0.1:${CLIENT_PORT} 就绪（WSL 内以此为 baseUrl；逐请求 Host 重写已启用）`));
