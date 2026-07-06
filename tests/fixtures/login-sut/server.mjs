// 登录假 SUT（fixture server）—— replay-login-bootstrap hermetic 契约的假被测系统。
// 与 tests/fixtures/fake-sut/server.mjs 分件：那份是 p5 冻结夹具（改动触其棘轮），本份只管登录会话形态。
// 零外部依赖（node 内置 http）；只监听 127.0.0.1；不含真凭据；服务端绝不持久化请求体（登录标记只落布尔）。
//
// startLoginSut({ port, markerFile }) -> Promise<{ url, port, close }>
//   GET /plain      —— 无登录墙的纯页（始终有「直达」按钮）。
//   GET /app        —— 服务端会话（cookie sid=1）：已登录出「进入」按钮；未登录出登录表单
//                      （占位符可访问名：请输入账号 / 请输入登录密码；提交按钮「登 录」中缝带空格，同真机）。
//   GET /app-session —— 页签级会话（video-login-carry）：登录态只活在 sessionStorage（复刻 Heren 形态，
//                      页签级不跨 page 继承、实测 3 键）；客户端脚本按内嵌期望值校验三键全对才渲染应用页，
//                      否则登录表单，服务端无会话。三键值每实例随机（codex R1-F3：钉「全键值快照」语义——
//                      硬编码键名/常量值/部分携带都进不了应用页）；startLoginSut 可传 sessionKeys 复用他实例
//                      的键值（codex R1-F2 跨 origin 负向：两实例同值时 origin 门成为唯一分界）。
//   POST /api/login —— 写登录标记文件（内容恒 '1'，绝不写 body）+ Set-Cookie sid=1 + {status:200}。
//   POST /api/login-session —— 同上标记，但无 Set-Cookie：回 {status:200, keys}，keys 由页面脚本逐键写
//                      sessionStorage（keys 是夹具随机常量非凭据；金牌以其值做「不泄漏产物」负向断言）。
//   客户端提交不传输入值（fetch body 恒 '{}'）——夹具只为证明「登录预备动作发生过」，凭据值只停留在表单内存。
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
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

// 页签级会话页（video-login-carry）：服务端恒回同一页面壳，登录态判定全在客户端 sessionStorage——
// 新开 page（页签）拿不到旧页签的 sessionStorage，即复刻 Heren「双 page 舞步丢登录态」形态。
// 期望值内嵌页面壳（与登录响应同源下发，夹具随机常量非凭据）：三键值全对才渲染应用页。
// crossLink 配置时应用页多渲一枚「外链」锚点（SUT 自身跳转形态；金牌跨 origin 负向用——
// replay 的 nav 步被钉在 --sut 基址，跨 origin 转移只能由 SUT 自身跳转发生）。
function appSessionShell(sessionKeys, crossLink) {
  const appView = '<h1>应用页</h1><button type="button">进入</button>' +
    (crossLink ? '<a href="' + crossLink + '">外链</a>' : '');
  // EXPECT 走运行时 JSON.parse（codex R2-F4）而非 JS 对象字面量：字面量里 "__proto__": 值会被
  // 解释为设原型（Annex B）、不成自有键 → Object.keys 漏掉它；JSON.parse 建的是自有键，任何键名都保真。
  return '<div id="root"></div>' +
    '<script>(function(){' +
    'var EXPECT=JSON.parse(' + JSON.stringify(JSON.stringify(sessionKeys)) + ');' +
    'var root=document.getElementById("root");' +
    'var ok=Object.keys(EXPECT).every(function(k){return sessionStorage.getItem(k)===EXPECT[k];});' +
    'if(ok){' +
    'root.innerHTML=' + JSON.stringify(appView) + ';' +
    '}else{' +
    'root.innerHTML=\'<h1>登录</h1>\'+' +
    '\'<input type="text" placeholder="请输入账号">\'+' +
    '\'<input type="password" placeholder="请输入登录密码">\'+' +
    '\'<button type="button" id="login-btn">登 录</button>\';' +
    'document.getElementById("login-btn").addEventListener("click",function(){' +
    'fetch("/api/login-session",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})' +
    '.then(function(r){return r.json();})' +
    '.then(function(j){Object.keys(j.keys).forEach(function(k){sessionStorage.setItem(k,j.keys[k]);});location.reload();});});' +
    '}})();</script>';
}

function makeHandler(markerFile, sessionKeys, crossLink, hitMarkerFile) {
  return (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/plain') {
      return html(res, '<h1>纯页</h1><button type="button">直达</button>');
    }
    if (req.method === 'GET' && path === '/app') {
      const loggedIn = String(req.headers.cookie || '').includes('sid=1');
      return html(res, loggedIn ? '<h1>应用页</h1><button type="button">进入</button>' : LOGIN_FORM);
    }
    if (req.method === 'GET' && path === '/app-session') {
      // 命中标记（codex R2-F2）：证明本实例真被浏览器访问过（金牌跨 origin 负向的「跳转真落到 B」前提锁）。
      if (hitMarkerFile) fs.writeFileSync(hitMarkerFile, '1\n', 'utf8');
      return html(res, appSessionShell(sessionKeys, crossLink));
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
    if (req.method === 'POST' && path === '/api/login-session') {
      // 同 /api/login 的标记纪律；无 Set-Cookie——登录态只经 keys 落页面脚本的 sessionStorage。
      req.on('data', () => {});
      req.on('end', () => {
        if (markerFile) fs.writeFileSync(markerFile, '1\n', 'utf8');
        json(res, 200, { status: 200, keys: sessionKeys });
      });
      return;
    }
    json(res, 404, { status: 404 });
  };
}

// 同 p5 夹具教训：golden 用同步 execFileSync 跑 replay 会冻住本进程事件循环，
// 假 SUT 必须 fork 到独立子进程才答得了浏览器请求。
export function startLoginSut({ port = 0, markerFile = '', sessionKeys = null, crossLink = '', hitMarkerFile = '', capture = false } = {}) {
  return new Promise((resolve, reject) => {
    // sessionKeys/crossLink/hitMarkerFile 经 env 注入子进程（跨 origin 负向用：两实例同值 + A 应用页渲
    // 外链锚点 + B 页面命中标记）；缺省子进程自生随机三键、不渲外链。env 先洗净再按显式传参重设
    // （codex R2-F1：调用方环境残留不得改写「缺省随机、缺省不渲外链」）。
    const env = { ...process.env };
    delete env.LOGIN_SUT_KEYS; delete env.LOGIN_SUT_CROSSLINK; delete env.LOGIN_SUT_HITMARKER;
    if (sessionKeys) env.LOGIN_SUT_KEYS = JSON.stringify(sessionKeys);
    if (crossLink) env.LOGIN_SUT_CROSSLINK = crossLink;
    if (hitMarkerFile) env.LOGIN_SUT_HITMARKER = hitMarkerFile;
    // capture：子进程输出改走 pipe 汇入 handle.output()（codex R2-F3：金牌卫生扫描盖住夹具输出）；
    // 缺省仍 inherit（既有消费者零动）。
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--port', String(port), '--marker', markerFile], { stdio: capture ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'inherit', 'inherit', 'ipc'], env });
    const outChunks = [];
    if (capture) {
      child.stdout.on('data', (c) => outChunks.push(c));
      child.stderr.on('data', (c) => outChunks.push(c));
    }
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('登录假 SUT 子进程启动超时')); } }, 10000);
    child.once('message', (msg) => {
      if (settled || !msg || !msg.ready) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        url: 'http://127.0.0.1:' + msg.port,
        port: msg.port,
        sessionKeys: msg.sessionKeys, // 本实例三键随机值（金牌卫生扫描 + 跨实例复用取此）
        output: () => Buffer.concat(outChunks).toString('utf8'), // capture 模式下的子进程全部输出
        // 关：等 'close' 事件（stdio EOF 后触发、晚于 'exit'）而非 'exit'——capture 模式下保证子进程
        // 全部 stdout/stderr 的 'data' 已落 outChunks，output() 确定性完整（codex R3-F1）。
        close: () => new Promise((r) => {
          let done = false;
          const to = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} finish(); }, 3000);
          function finish() { if (done) return; done = true; clearTimeout(to); r(); }
          child.once('close', finish);
          if (child.exitCode === null && !child.killed) { try { child.kill(); } catch { finish(); } }
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
  // 三键随机值（复刻 Heren 实测 3 键；每实例每启动都不同）；env 注入时校验形状后原样复用
  // （codex R2-F1：非空 string map 才认，坏形状回退自生随机）。
  let sessionKeys = null;
  try {
    const parsed = process.env.LOGIN_SUT_KEYS ? JSON.parse(process.env.LOGIN_SUT_KEYS) : null;
    const okShape = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && Object.keys(parsed).length && Object.values(parsed).every((v) => typeof v === 'string' && v);
    sessionKeys = okShape ? parsed : null;
  } catch { sessionKeys = null; }
  if (!sessionKeys) {
    const rnd = () => crypto.randomBytes(6).toString('hex');
    sessionKeys = { sid: 's1d_' + rnd(), uid: 'u1d_' + rnd(), mark: 'mrk_' + rnd() };
  }
  const server = http.createServer(makeHandler(markerFile, sessionKeys, process.env.LOGIN_SUT_CROSSLINK || '', process.env.LOGIN_SUT_HITMARKER || ''));
  server.listen(port, '127.0.0.1', () => {
    if (process.send) process.send({ ready: true, port: server.address().port, sessionKeys });
  });
}

const isServeMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--serve');
if (isServeMain) serveMain();
