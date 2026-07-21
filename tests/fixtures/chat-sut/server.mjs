// chat 假 SUT（fixture server）—— chiefcomplaint-smoke hermetic 契约的假被测系统。
// 与 fake-sut（p5 冻结夹具）/login-sut（登录会话形态）分件：本份只管「智能体管理 → 详情 →
// 测试面板 → 流式对话」旅程，锚定三机制考场：keydown 触发垫（fill 不触发 keydown、发送钮保持
// disabled——复刻 regress 真机实测）、动态流等待（SSE 分片 + event:finished 静默点）、reply 采集
// （气泡 .hr-chat__text__assistant 渐进渲染）。零外部依赖；只监听 127.0.0.1；不含真凭据。
// 同 p5/login-sut 教训：golden 同步跑 replay/compile 会冻住本进程事件循环，假 SUT fork 独立进程。
//
// startChatSut({ port, scenario }) -> Promise<{ url, port, close }>
//   scenario: 'happy'（回复含「建议多休息。」）| 'error'（回复含「操作失败：服务异常」，流仍 200 finished）
//           | 'stale'（面板预置历史气泡、发送死键：不开流不产新气泡——钉「旧气泡陈迹不得当新回复」codex R1-F3）
//           | 'bgstream'（同 happy 但页面加载即开一条永不结束的背景 SSE——钉「流等待按本步发起归因、
//             背景长流不拖无关步」codex R1-F2）
//           | 'leaky'（同 happy 但发送另发一条 query 携凭据形态的请求——钉「axes 落盘口过凭据门拒写」）
//           | 'twins'（同 happy，但 /agent/list 列出两条完全同名的 .agent-item 条目——同一列表两条
//             「互联网问诊-主诉」不同实体，钉「entity-ui-wiring W1：名字定位遇同名双条目必须 AMBIGUOUS
//             硬阻断、绝不点 first」；纯加法，其余场景 /agent/list 一字不动）
//   GET /                          —— 首页：侧栏 list「智能体管理」→ /agent/list
//   GET /agent/list                —— 搜索框（placeholder 输入智能体名称或编码进行搜索）Enter 出结果项
//   GET /agent/detail              —— 「测试」按钮 → 右抽屉：消息框（请输入消息）+ 发送箭头
//                                     （.hr-icon.hr-icon-arrow-up，keydown 前 disabled）+ 关闭钮链
//   GET /ai-api/tester/agent/stream —— SSE：分片吐回复（300/700/1100ms）→ 1400ms event:finished {status:200}
import http from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

function html(res, body) {
  const doc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>chat 假 SUT</title></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(doc), 'Cache-Control': 'no-store' });
  res.end(doc);
}

const SIDEBAR =
  '<ul class="hr-menu"><li class="hr-menu__item"><span id="nav-agent">智能体管理</span></li></ul>' +
  '<script>document.getElementById("nav-agent").addEventListener("click",function(){location.href="/agent/list";});</script>';

const LIST_PAGE =
  SIDEBAR +
  '<h1>智能体列表</h1>' +
  '<input type="text" id="agent-search" placeholder="输入智能体名称或编码进行搜索">' +
  '<div id="results" hidden><div class="agent-item" id="agent-open">互联网问诊-主诉</div></div>' +
  '<script>' +
  'document.getElementById("agent-search").addEventListener("keydown",function(e){' +
  'if(e.key==="Enter"&&this.value.trim())document.getElementById("results").hidden=false;});' +
  'document.getElementById("agent-open").addEventListener("click",function(){location.href="/agent/detail";});' +
  '</script>';

// twins 列表页（entity-ui-wiring W1 对抗考场）：同一列表两条完全同名的 .agent-item 条目（不同实体：
// href 不同）。纯加法——仅 scenario==='twins' 时替换 /agent/list，既有场景走 LIST_PAGE 不动。名字文本是
// 夹具既有通道（同 LIST_PAGE 的 .agent-item 渲染），非投机接缝。
const TWINS_LIST_PAGE =
  SIDEBAR +
  '<h1>智能体列表</h1>' +
  '<input type="text" id="agent-search" placeholder="输入智能体名称或编码进行搜索">' +
  '<div id="results" hidden>' +
  '<div class="agent-item" id="agent-open-1">互联网问诊-主诉</div>' +
  '<div class="agent-item" id="agent-open-2">互联网问诊-主诉</div>' +
  '</div>' +
  '<script>' +
  'document.getElementById("agent-search").addEventListener("keydown",function(e){' +
  'if(e.key==="Enter"&&this.value.trim())document.getElementById("results").hidden=false;});' +
  'document.getElementById("agent-open-1").addEventListener("click",function(){location.href="/agent/detail";});' +
  'document.getElementById("agent-open-2").addEventListener("click",function(){location.href="/agent/detail?id=2";});' +
  '</script>';

// 发送钮 enable 判据复刻 regress 实测：监听 keydown（fill 只发 input 事件不触发 keydown → 保持 disabled）。
function detailPage(scenario) {
  const staleBubble = scenario === 'stale' ? '<div class="hr-chat__text__assistant">历史回复：建议多喝水</div>' : '';
  // stale：发送死键（不开流不产新气泡）——旧气泡陈迹在场但本次无回复（codex R1-F3 考场）。
  // 真机同款时序（cred-route-mask G2）：发送先自取临时凭据（路由名字面含 token——凭据门打码考场），再开流。
  const leakyExtra = scenario === 'leaky' ? 'fetch("/api/leaky/save?token=fake-cred-999").catch(function(){});' : '';
  const sendBody = scenario === 'stale'
    ? '/* 死发送：无流无新气泡 */'
    : leakyExtra +
      // blob 请求（login-traffic-drop codex R2 考场）：blob: URL 的 pathname 内嵌完整 origin——投影须拒非 http(s) scheme。
      'try{var bu=URL.createObjectURL(new Blob(["x"]));fetch(bu).catch(function(){});}catch(e){}' +
      'fetch("/ai-manager/auths/getTempTokenForApi").catch(function(){});' +
      'var b=document.createElement("div");b.className="hr-chat__text__assistant";document.getElementById("chat-log").appendChild(b);' +
      'var es=new EventSource("/ai-api/tester/agent/stream");' +
      'es.onmessage=function(e){b.textContent+=e.data;};' +
      'es.addEventListener("finished",function(){es.close();});';
  // bgstream：页面加载即开背景长流（永不 finished）——与用户动作无因果（codex R1-F2 考场）；
  // 且「测试」点击也开一条（R2 收口：本步真发起、但非对话流——URL 域限定后不得拖本步）。
  const bgLoader = scenario === 'bgstream' ? 'new EventSource("/ai-api/background/stream");' : '';
  const bgOnOpen = scenario === 'bgstream' ? 'new EventSource("/ai-api/background/stream");' : '';
  return (
    '<h1>互联网问诊-主诉</h1><button type="button" id="open-test">测试</button>' +
    '<div class="hr-drawer hr-drawer--right" id="drawer" hidden>' +
    '<div class="hr-drawer__content-wrapper">' +
    '<div class="hr-drawer__close-btn"><i class="hr-icon" id="drawer-close">×</i></div>' + // 图标须有字形占位：空 i 零尺寸 Playwright 判不可见点不动（真机图标字体有字形，保真）
    '<div id="chat-log">' + staleBubble + '</div>' +
    '<input type="text" id="msg" placeholder="请输入消息">' +
    '<button class="hr-icon hr-icon-arrow-up" id="send" aria-label="发送" disabled></button>' +
    '</div></div>' +
    '<script>\n' +
    bgLoader + '\n' +
    'var drawer=document.getElementById("drawer");\n' +
    'document.getElementById("open-test").addEventListener("click",function(){drawer.hidden=false;drawer.classList.add("hr-drawer--open");' + bgOnOpen + '});\n' +
    'document.getElementById("drawer-close").addEventListener("click",function(){drawer.hidden=true;drawer.classList.remove("hr-drawer--open");});\n' +
    'var msg=document.getElementById("msg"),send=document.getElementById("send");\n' +
    'msg.addEventListener("keydown",function(){var self=this;setTimeout(function(){send.disabled=!self.value.trim();},0);});\n' +
    'send.addEventListener("click",function(){' + sendBody + '});\n' +
    '</script>'
  );
}

// SSE 分片：静默点 = 流 finished（同 p5 fake-sut 发法：event: finished + {status:200}）。
function streamReply(res, scenario) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  const chunks = scenario === 'error'
    ? ['操作失败：', '服务异常']
    : ['您好，', '已了解您的症状。', '建议多休息。'];
  chunks.forEach((c, i) => {
    setTimeout(() => { try { res.write('data: ' + c + '\n\n'); } catch { /* 客户端已关 */ } }, 300 + i * 400);
  });
  setTimeout(() => {
    try {
      res.write('event: finished\ndata: ' + JSON.stringify({ status: 200, finished: true }) + '\n\n');
      res.end();
    } catch { /* 客户端已关 */ }
  }, 300 + chunks.length * 400 + 300);
}

function makeHandler(scenario) {
  return (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/') return html(res, SIDEBAR + '<h1>首页</h1>');
    if (req.method === 'GET' && path === '/agent/list') return html(res, scenario === 'twins' ? TWINS_LIST_PAGE : LIST_PAGE);
    if (req.method === 'GET' && path === '/agent/detail') return html(res, detailPage(scenario));
    if (req.method === 'GET' && path === '/ai-api/tester/agent/stream') return streamReply(res, scenario);
    if (req.method === 'GET' && path === '/ai-manager/auths/getTempTokenForApi') {
      // 假临时凭据端点：只回成功信封，绝不回真值形态（打码考场只考路由名字面）。
      const body = JSON.stringify({ status: 200 });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && path === '/ai-api/background/stream') {
      // 背景长流：只发注释心跳、永不 finished、永不 end（服务进程随 close() 一并回收）。
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': bg\n\n');
      return;
    }
    const body = JSON.stringify({ status: 404 });
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };
}

export function startChatSut({ port = 0, scenario = 'happy' } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--port', String(port), '--scenario', scenario], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('chat 假 SUT 子进程启动超时')); } }, 10000);
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
    child.once('exit', (code) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('chat 假 SUT 子进程未就绪即退出 code=' + code)); } });
  });
}

function serveMain() {
  const argv = process.argv;
  const port = Number(argv[argv.indexOf('--port') + 1] || 0);
  const scIdx = argv.indexOf('--scenario');
  const scenario = scIdx >= 0 ? argv[scIdx + 1] : 'happy';
  const server = http.createServer(makeHandler(scenario));
  server.listen(port, '127.0.0.1', () => {
    if (process.send) process.send({ ready: true, port: server.address().port });
  });
}

const isServeMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--serve');
if (isServeMain) serveMain();
