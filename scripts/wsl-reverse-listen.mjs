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
import { timingSafeEqual } from 'node:crypto';
import { readTunnelConfig } from './tunnel-config.mjs';

function sanitizedFatal(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

let config;
try {
  config = readTunnelConfig();
} catch {
  sanitizedFatal('隧道监听器启动失败：站点配置无效', 64);
}

const { clientPort: CLIENT_PORT, tunnelPort: TUNNEL_PORT, hostHeader: HOST_HEADER } = config;
const HEAD_MAX = 65536;
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const idle = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TUNNEL_TOKEN = process.env.CASEY_TUNNEL_TOKEN || '';
const TOKEN_PREFIX = 'CASEY-TUNNEL/1 ';
if (TUNNEL_TOKEN && (!/^[\x21-\x7e]{16,512}$/.test(TUNNEL_TOKEN))) {
  sanitizedFatal('隧道监听器启动失败：补给握手配置无效', 64);
}

function admitTunnel(sock) {
  sock.setTimeout(0);
  if (!sock.destroyed) idle.push(sock);
}

function authenticateTunnel(sock) {
  if (!TUNNEL_TOKEN) {
    admitTunnel(sock); // 兼容既有 WSL 手工双进程模式。
    return;
  }

  const expected = Buffer.from(`${TOKEN_PREFIX}${TUNNEL_TOKEN}\n`, 'utf8');
  let received = Buffer.alloc(0);
  sock.setTimeout(3000, () => sock.destroy());
  const onData = (chunk) => {
    received = Buffer.concat([received, chunk]);
    if (received.length < expected.length) return;
    sock.off('data', onData);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      sock.destroy();
      return;
    }
    admitTunnel(sock);
  };
  sock.on('data', onData);
}

const tunnelServer = net.createServer((sock) => {
  sock.setKeepAlive(true, 15000);
  sock.on('error', () => {});
  sock.on('close', () => { const i = idle.indexOf(sock); if (i >= 0) idle.splice(i, 1); });
  authenticateTunnel(sock);
});
// 补给口绑定地址可用 CASEY_TUNNEL_BIND 覆盖（默认 127.0.0.1 零行为差）：wslrelay 的 Windows→WSL 回环
// 转发再度半死时（2026-07-14 复发，2026-07-13 首发），设 0.0.0.0 让 Windows 代理经 WSL 虚拟网卡 IP 直连绕开中继。
// 客户端口 15519 恒绑回环不放开（casey --sut 只喂回环基址，护栏 #7）。
const TUNNEL_BIND = process.env.CASEY_TUNNEL_BIND || '127.0.0.1';
tunnelServer.listen(TUNNEL_PORT, TUNNEL_BIND, () => console.log(`隧道补给口 ${TUNNEL_BIND}:${TUNNEL_PORT} 就绪（等 Windows 代理连入）`));
tunnelServer.on('error', () => sanitizedFatal('隧道监听器启动失败：补给口不可用'));

async function takeTunnel(budgetMs = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const s = idle.shift();
    if (s && !s.destroyed) return s;
    await sleep(50);
  }
  return null;
}

// 严格 HTTP/1.1 framing 改写器：Host 换成真 host；header/body 有界；CL 与 chunked 按真实字节边界流式转发。
// Windows agent 收到首块会 pause 到上游建连完成，因此这里无需再把整条请求攒进内存。
function makeRewriter(writeOut) {
  let buf = Buffer.alloc(0);
  let mode = 'HEAD'; // HEAD | LEN | CHUNK_SIZE | CHUNK_DATA | CHUNK_DATA_CRLF | CHUNK_TRAILER
  let remaining = 0;
  let decodedBodyBytes = 0;
  let trailerBytes = 0;
  const CRLF2 = Buffer.from('\r\n\r\n');
  const CRLF = Buffer.from('\r\n');
  const CHUNK_LINE_MAX = 8192;
  const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
  const FORBIDDEN_TRAILERS = new Set([
    'authorization', 'connection', 'content-encoding', 'content-length', 'content-range', 'content-type',
    'cookie', 'host', 'proxy-authorization', 'proxy-connection', 'set-cookie', 'te', 'trailer',
    'transfer-encoding', 'upgrade',
  ]);

  const emit = (value) => {
    if (value.length) writeOut(Buffer.isBuffer(value) ? value : Buffer.from(value, 'latin1'));
  };

  function parseFieldLine(line) {
    if (!line || line[0] === ' ' || line[0] === '\t') return null; // obs-fold 一律拒绝。
    const colon = line.indexOf(':');
    if (colon <= 0) return null;
    const name = line.slice(0, colon);
    const rawValue = line.slice(colon + 1);
    if (!TOKEN.test(name) || !/^[\t\x20-\x7e\x80-\xff]*$/.test(rawValue)) return null;
    const value = rawValue.replace(/^[ \t]+|[ \t]+$/g, '');
    return { name, lower: name.toLowerCase(), value };
  }

  function parseCommaTokens(value) {
    const values = value.split(',').map((item) => item.replace(/^[ \t]+|[ \t]+$/g, ''));
    return values.length && values.every((item) => TOKEN.test(item)) ? values : null;
  }

  function rewriteHead(headBuf) {
    const raw = headBuf.toString('latin1');
    const headEnd = raw.indexOf('\r\n\r\n');
    const lines = raw.slice(0, headEnd).split('\r\n');
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+ [^\x00-\x20\x7f]+ HTTP\/1\.1$/.test(lines[0] || '')) return null;

    const fields = [];
    for (let i = 1; i < lines.length; i++) {
      const field = parseFieldLine(lines[i]);
      if (!field) return null;
      fields.push(field);
    }

    const hosts = fields.filter((field) => field.lower === 'host');
    if (hosts.length !== 1 || !hosts[0].value) return null;

    const transferEncodings = fields.filter((field) => field.lower === 'transfer-encoding');
    const contentLengths = fields.filter((field) => field.lower === 'content-length');
    if (transferEncodings.length && contentLengths.length) return null;

    let framing = 'NONE';
    let contentLength = null;
    if (transferEncodings.length) {
      // 本代理只实现单一、最终的 chunked；其它 coding / 多字段 / 参数均拒绝，避免双方解释不同。
      if (transferEncodings.length !== 1 || transferEncodings[0].value.toLowerCase() !== 'chunked') return null;
      framing = 'CHUNKED';
    } else if (contentLengths.length) {
      let seen = null;
      for (const field of contentLengths) {
        if (!/^\d+$/.test(field.value)) return null;
        const parsed = Number(field.value);
        if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_BODY_BYTES) return null;
        if (seen != null && parsed !== seen) return null;
        seen = parsed;
      }
      contentLength = seen;
      framing = seen > 0 ? 'LENGTH' : 'NONE';
    }

    for (const field of fields.filter((item) => item.lower === 'connection')) {
      const named = parseCommaTokens(field.value);
      if (!named || named.some((name) => ['content-length', 'host', 'transfer-encoding'].includes(name.toLowerCase()))) return null;
    }
    for (const field of fields.filter((item) => item.lower === 'trailer')) {
      if (framing !== 'CHUNKED') return null;
      const named = parseCommaTokens(field.value);
      if (!named || named.some((name) => FORBIDDEN_TRAILERS.has(name.toLowerCase()))) return null;
    }

    const out = [lines[0]];
    for (const field of fields) {
      if (['content-length', 'host', 'proxy-connection', 'transfer-encoding'].includes(field.lower)) continue;
      out.push(`${field.name}:${field.value ? ` ${field.value}` : ''}`);
    }
    out.push(`Host: ${HOST_HEADER}`);
    if (framing === 'CHUNKED') out.push('Transfer-Encoding: chunked');
    if (contentLength != null) out.push(`Content-Length: ${contentLength}`);
    return { head: Buffer.from(out.join('\r\n') + '\r\n\r\n', 'latin1'), framing, contentLength };
  }

  function isTokenChar(code) {
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      || "!#$%&'*+-.^_`|~".includes(String.fromCharCode(code));
  }

  function parseChunkExtensions(text, start) {
    let index = start;
    let canonical = '';
    const skipOws = () => { while (text[index] === ' ' || text[index] === '\t') index += 1; };
    skipOws();
    while (index < text.length) {
      if (text[index] !== ';') return null;
      index += 1;
      skipOws();
      const nameStart = index;
      while (index < text.length && isTokenChar(text.charCodeAt(index))) index += 1;
      if (index === nameStart) return null;
      const name = text.slice(nameStart, index);
      skipOws();
      let value = null;
      if (text[index] === '=') {
        index += 1;
        skipOws();
        if (text[index] === '"') {
          const valueStart = index;
          index += 1;
          let closed = false;
          while (index < text.length) {
            const code = text.charCodeAt(index);
            if (text[index] === '"') { index += 1; closed = true; break; }
            if (text[index] === '\\') {
              index += 1;
              if (index >= text.length) return null;
              const escaped = text.charCodeAt(index);
              if (!(escaped === 9 || (escaped >= 32 && escaped <= 126) || escaped >= 128)) return null;
              index += 1;
              continue;
            }
            const qdtext = code === 9 || code === 32 || code === 33 || (code >= 35 && code <= 91)
              || (code >= 93 && code <= 126) || code >= 128;
            if (!qdtext) return null;
            index += 1;
          }
          if (!closed) return null;
          value = text.slice(valueStart, index);
        } else {
          const valueStart = index;
          while (index < text.length && isTokenChar(text.charCodeAt(index))) index += 1;
          if (index === valueStart) return null;
          value = text.slice(valueStart, index);
        }
        skipOws();
      }
      canonical += `;${name}${value == null ? '' : `=${value}`}`;
    }
    return canonical;
  }

  function parseChunkSizeLine(lineBuf) {
    const line = lineBuf.toString('latin1');
    const match = /^([0-9A-Fa-f]+)(.*)$/.exec(line);
    if (!match || match[1].length > 8) return null;
    const size = Number.parseInt(match[1], 16);
    if (!Number.isSafeInteger(size) || size < 0) return null;
    const extensions = parseChunkExtensions(line, match[1].length);
    if (extensions == null) return null;
    return { size, line: `${size.toString(16)}${extensions}\r\n` };
  }

  function takeLine(maxBytes) {
    const index = buf.indexOf(CRLF);
    if (index < 0) return buf.length > maxBytes ? false : null;
    if (index > maxBytes) return false;
    const line = Buffer.from(buf.subarray(0, index));
    buf = buf.subarray(index + CRLF.length);
    return line;
  }

  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (mode === 'HEAD') {
        const idx = buf.indexOf(CRLF2);
        if (idx < 0) { if (buf.length > HEAD_MAX) return false; return true; }
        if (idx + CRLF2.length > HEAD_MAX) return false;
        const headBuf = buf.subarray(0, idx + 4);
        buf = buf.subarray(idx + 4);
        const rewritten = rewriteHead(headBuf);
        if (!rewritten) return false;
        emit(rewritten.head);
        decodedBodyBytes = 0;
        if (rewritten.framing === 'CHUNKED') mode = 'CHUNK_SIZE';
        else if (rewritten.framing === 'LENGTH') { mode = 'LEN'; remaining = rewritten.contentLength; }
        else mode = 'HEAD';
      } else if (mode === 'LEN') {
        if (buf.length === 0) return true;
        const take = Math.min(remaining, buf.length);
        emit(Buffer.from(buf.subarray(0, take)));
        buf = buf.subarray(take);
        remaining -= take;
        if (remaining === 0) mode = 'HEAD';
        else return true;
      } else if (mode === 'CHUNK_SIZE') {
        const line = takeLine(CHUNK_LINE_MAX);
        if (line === null) return true;
        if (line === false) return false;
        const parsed = parseChunkSizeLine(line);
        if (!parsed || decodedBodyBytes + parsed.size > MAX_BODY_BYTES) return false;
        emit(parsed.line);
        if (parsed.size === 0) { mode = 'CHUNK_TRAILER'; trailerBytes = 0; }
        else {
          decodedBodyBytes += parsed.size;
          remaining = parsed.size;
          mode = 'CHUNK_DATA';
        }
      } else if (mode === 'CHUNK_DATA') {
        if (buf.length === 0) return true;
        const take = Math.min(remaining, buf.length);
        emit(Buffer.from(buf.subarray(0, take)));
        buf = buf.subarray(take);
        remaining -= take;
        if (remaining === 0) mode = 'CHUNK_DATA_CRLF';
        else return true;
      } else if (mode === 'CHUNK_DATA_CRLF') {
        if (buf.length < CRLF.length) return true;
        if (!buf.subarray(0, CRLF.length).equals(CRLF)) return false;
        emit(CRLF);
        buf = buf.subarray(CRLF.length);
        mode = 'CHUNK_SIZE';
      } else {
        const line = takeLine(HEAD_MAX - trailerBytes);
        if (line === null) return true;
        if (line === false) return false;
        trailerBytes += line.length + CRLF.length;
        if (trailerBytes > HEAD_MAX) return false;
        if (line.length === 0) {
          emit(CRLF);
          mode = 'HEAD';
          decodedBodyBytes = 0;
          continue;
        }
        const field = parseFieldLine(line.toString('latin1'));
        if (!field || FORBIDDEN_TRAILERS.has(field.lower)) return false;
        emit(`${field.name}:${field.value ? ` ${field.value}` : ''}\r\n`);
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
    let dropped = false;
    let blocked = false;
    const drop = () => {
      if (dropped) return;
      dropped = true;
      client.destroy();
      tunnel.destroy();
    };
    tunnel.on('error', drop);
    tunnel.on('close', () => client.end());
    client.on('close', () => tunnel.destroy());
    const rewrite = makeRewriter((b) => {
      if (dropped) return;
      let writable = false;
      try { writable = tunnel.write(b); } catch { drop(); return; }
      if (!writable && !blocked) {
        blocked = true;
        client.pause();
        tunnel.once('drain', () => {
          blocked = false;
          if (!dropped && !client.destroyed) client.resume();
        });
      }
    });
    client.on('data', (d) => {
      try { if (rewrite(d) === false) drop(); } catch { drop(); }
    });
    tunnel.pipe(client); // 响应方向：原样回传
    client.resume();
  })().catch(() => client.destroy());
});
clientServer.listen(CLIENT_PORT, '127.0.0.1', () => console.log(`客户端口 127.0.0.1:${CLIENT_PORT} 就绪（逐请求 Host 重写已启用）`));
clientServer.on('error', () => sanitizedFatal('隧道监听器启动失败：客户端口不可用'));

process.on('uncaughtException', () => sanitizedFatal('隧道监听器运行失败：详情已抑制'));
process.on('unhandledRejection', () => sanitizedFatal('隧道监听器运行失败：详情已抑制'));
