// 登录假 SUT（fixture server）—— replay-login-bootstrap hermetic 契约的假被测系统。
// 与 tests/fixtures/fake-sut/server.mjs 分件：那份是 p5 冻结夹具（改动触其棘轮），本份只管登录会话形态。
// 零外部依赖（node 内置 http）；只监听 127.0.0.1；不含真凭据；服务端绝不持久化请求体（登录标记只落布尔）。
//
// startLoginSut({ port, markerFile }) -> Promise<{ url, port, close }>
//   GET /plain      —— 无登录墙的纯页（始终有「直达」按钮）。
//   GET /app        —— 服务端会话（cookie sid=1）：已登录出「进入」按钮；未登录出登录表单
//                      （占位符可访问名：请输入账号 / 请输入登录密码；提交按钮「登 录」中缝带空格，同真机）。
//   POST /api/login —— 写登录标记文件（内容恒 '1'，绝不写 body）+ Set-Cookie sid=1 + {status:200}。
//   客户端提交不传输入值（fetch body 恒 '{}'）——夹具只为证明「登录预备动作发生过」，凭据值只停留在表单内存。
import http from 'node:http';
import fs from 'node:fs';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

function html(res, body) {
  const doc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>登录假 SUT</title></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(doc), 'Cache-Control': 'no-store' });
  res.end(doc);
}

function json(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

const LOGIN_FORM =
  '<h1>登录</h1>' +
  '<input type="text" placeholder="请输入账号">' +
  '<input type="password" placeholder="请输入登录密码">' +
  '<button type="button" id="login-btn">登 录</button>' +
  '<script>document.getElementById("login-btn").addEventListener("click",function(){' +
  'fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})' +
  '.then(function(){location.reload();});});</script>';

function makeHandler(markerFile) {
  return (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/plain') {
      return html(res, '<h1>纯页</h1><button type="button">直达</button>');
    }
    if (req.method === 'GET' && path === '/app') {
      const loggedIn = String(req.headers.cookie || '').includes('sid=1');
      return html(res, loggedIn ? '<h1>应用页</h1><button type="button">进入</button>' : LOGIN_FORM);
    }
    if (req.method === 'POST' && path === '/api/login') {
      // 消费并丢弃 body（绝不落盘）；标记只证明「登录 POST 到达过」。
      req.on('data', () => {});
      req.on('end', () => {
        if (markerFile) fs.writeFileSync(markerFile, '1\n', 'utf8');
        json(res, 200, { status: 200 }, { 'Set-Cookie': 'sid=1; Path=/' });
      });
      return;
    }
    json(res, 404, { status: 404 });
  };
}

// 同 p5 夹具教训：golden 用同步 execFileSync 跑 replay 会冻住本进程事件循环，
// 假 SUT 必须 fork 到独立子进程才答得了浏览器请求。
export function startLoginSut({ port = 0, markerFile = '' } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--port', String(port), '--marker', markerFile], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('登录假 SUT 子进程启动超时')); } }, 10000);
    child.once('message', (msg) => {
      if (settled || !msg || !msg.ready) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        url: 'http://127.0.0.1:' + msg.port,
        port: msg.port,
        close: () => new Promise((r) => {
          if (child.exitCode !== null || child.killed) return r();
          const to = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} r(); }, 3000);
          child.once('exit', () => { clearTimeout(to); r(); });
          try { child.kill(); } catch { clearTimeout(to); r(); }
        }),
      });
    });
    child.once('error', (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
    child.once('exit', (code) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('登录假 SUT 子进程未就绪即退出 code=' + code)); } });
  });
}

function serveMain() {
  const argv = process.argv;
  const port = Number(argv[argv.indexOf('--port') + 1] || 0);
  const markerIdx = argv.indexOf('--marker');
  const markerFile = markerIdx >= 0 ? argv[markerIdx + 1] : '';
  const server = http.createServer(makeHandler(markerFile));
  server.listen(port, '127.0.0.1', () => {
    if (process.send) process.send({ ready: true, port: server.address().port });
  });
}

const isServeMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--serve');
if (isServeMain) serveMain();
