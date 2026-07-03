// publish 假 SUT（fixture server）—— wf-publish-states hermetic 契约的假被测系统。
// 与 fake-sut（p5 冻结）/login-sut/chat-sut 分件：本份只管「工作流列表 → 新建 → 编辑器发布状态机」
// 旅程，锚定 buttonState 采集考场：未发布态顶栏【保存、发布】，点「发布」→ 按钮群翻面
// 【保存、导出、新建版本】（「发布」消失——nl 语义，GRILL D3）。零外部依赖；只监听 127.0.0.1；不含真凭据。
// 同 p5/login-sut/chat-sut 教训：golden 同步跑 replay/compile 会冻住本进程事件循环，假 SUT fork 独立进程。
//
// startPublishSut({ port, scenario }) -> Promise<{ url, port, close }>
//   scenario: 'happy'（顶栏真 button）
//           | 'plainText'（顶栏旁常驻非按钮 span「导出」——钉「按钮命中采集不混文本通道」GRILL D2）
//           | 'divButtons'（顶栏是 div 假按钮 .editor-btn、role 盲区——配 profile.buttons.extraSelector
//             补采可见 / 不配则盲：present 落红不落绿（fail-safe 方向机器证明）
//           | 'dupButtons'（两个同名「发布」按钮——多匹配计数如实、点击身份门拒点）
//   GET /ai-manager/process/list    —— 列表页：新增工作流 → 抽屉（工作流名称 label 关联 input + 确定）
//                                      → 进编辑器（C 编译向考场：compileWorkflowCreate 锚定面逐字对齐）
//   GET /ai-manager/process/detail  —— 编辑器：顶栏按钮态 + 点「发布」fetch /ai-manager/process/publish 后翻面
//   GET /ai-manager/process/publish —— 假发布端点：只回成功信封 {status:200}
import http from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

function html(res, body) {
  const doc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>publish 假 SUT</title></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(doc), 'Cache-Control': 'no-store' });
  res.end(doc);
}

// 列表页（C 编译向）：新增工作流 role button（exact 唯一）→ 抽屉直开（无下拉菜单分支）；
// 工作流名称 label for 关联（getByLabel 命中）；确定 role button（抽屉开后唯一可见）。
const LIST_PAGE =
  '<h1>工作流列表</h1>' +
  '<button type="button" id="btn-new">新增工作流</button>' +
  '<div id="create-drawer" hidden>' +
  '<label for="wf-name">工作流名称</label><input id="wf-name" type="text">' +
  '<button type="button" id="btn-ok">确定</button>' +
  '</div>' +
  '<script>' +
  'document.getElementById("btn-new").addEventListener("click",function(){document.getElementById("create-drawer").hidden=false;});' +
  'document.getElementById("btn-ok").addEventListener("click",function(){' +
  'if(document.getElementById("wf-name").value.trim())location.href="/ai-manager/process/detail";});' +
  '</script>';

// 编辑器页：按钮元素形态按场景切换；点「发布」→ 假发布请求 + 顶栏翻面（发布消失、导出/新建版本出现）。
function editorPage(scenario) {
  const div = scenario === 'divButtons';
  const mk = (name, id) => div
    ? '<div class="editor-btn"' + (id ? ' id="' + id + '"' : '') + '>' + name + '</div>'
    : '<button type="button" class="top-btn"' + (id ? ' id="' + id + '"' : '') + '>' + name + '</button>';
  const plainHint = scenario === 'plainText' ? '<span class="pub-hint">导出</span>' : '';
  const dupPublish = scenario === 'dupButtons' ? mk('发布') : '';
  // divButtons 场景带隐藏模板节点（codex R1-F2 考场）：类名命中补采选择器、文本「导出」、display:none——
  // 可见性过滤缺席时 present(导出) 会被 DOM 计数假绿。
  const hiddenTpl = div ? '<div class="editor-btn" style="display:none">导出</div>' : '';
  // 历史版本弹窗（wf-history-version D4，regress 2026-06-09 真机探得形态复刻）：未发布「暂无数据」、
  // 发布后表头 版本/状态/创建时间/操作 + 行 V1/查看 + 关闭钮；Esc 关闭（closeDrawer 键盘行为考场）。
  return (
    '<h1>工作流编辑器</h1>' +
    // 历史版本钮走 mk（divButtons 场景同为 div，保持该场景「role 全盲」前提不被本钮污染——wf-publish-states I3）。
    '<div id="topbar">' + mk('保存') + mk('发布', 'btn-publish') + mk('历史版本', 'btn-history') + dupPublish + plainHint + hiddenTpl + '</div>' +
    '<div id="history-dialog" class="hr-dialog" hidden></div>' +
    '<script>\n' +
    'var bar=document.getElementById("topbar");\n' +
    'var isDiv=' + JSON.stringify(div) + ';\n' +
    'var published=false;\n' +
    'function mkBtn(name){var el;if(isDiv){el=document.createElement("div");el.className="editor-btn";}' +
    'else{el=document.createElement("button");el.type="button";el.className="top-btn";}el.textContent=name;return el;}\n' +
    'function onPublish(){\n' +
    '  fetch("/ai-manager/process/publish").catch(function(){});\n' +
    '  published=true;\n' +
    '  var all=bar.querySelectorAll("button.top-btn,div.editor-btn");\n' +
    '  for(var i=0;i<all.length;i++){if((all[i].textContent||"").trim()==="发布")all[i].remove();}\n' +
    '  bar.appendChild(mkBtn("导出"));bar.appendChild(mkBtn("新建版本"));\n' +
    '}\n' +
    'var all=bar.querySelectorAll("button.top-btn,div.editor-btn");\n' +
    'for(var i=0;i<all.length;i++){if((all[i].textContent||"").trim()==="发布")all[i].addEventListener("click",onPublish);}\n' +
    'var dlg=document.getElementById("history-dialog");\n' +
    'document.getElementById("btn-history").addEventListener("click",function(){\n' +
    '  dlg.innerHTML=published\n' +
    '    ?"<table><thead><tr><th>版本</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>"+\n' +
    '     "<tbody><tr><td>V1</td><td>已发布</td><td>2026-07-03 00:00:00</td><td><button type=\\"button\\">查看</button></td></tr></tbody></table>"+\n' +
    '     "<button type=\\"button\\" id=\\"dlg-close\\">关闭</button>"\n' +
    '    :"<div class=\\"empty\\">暂无数据</div><button type=\\"button\\" id=\\"dlg-close\\">关闭</button>";\n' +
    '  dlg.hidden=false;\n' +
    '});\n' +
    // 关闭效果可观测（codex hist R1-F1）：Esc 关弹窗时清空内容——「暂无数据」真离 DOM，供 textHidden 锁关闭效果。
    'function closeDlg(){dlg.hidden=true;dlg.innerHTML="";}\n' +
    'document.addEventListener("keydown",function(e){if(e.key==="Escape")closeDlg();});\n' +
    // 关闭钮 handler（codex hist R1-F4）：本流关闭走 Esc(closeDrawer)，关闭钮同走 closeDlg 保语义一致。
    'dlg.addEventListener("click",function(e){if(e.target&&e.target.id==="dlg-close")closeDlg();});\n' +
    '</script>'
  );
}

function makeHandler(scenario) {
  return (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/') return html(res, '<h1>首页</h1><a href="/ai-manager/process/list">工作流</a>');
    if (req.method === 'GET' && path === '/ai-manager/process/list') return html(res, LIST_PAGE);
    if (req.method === 'GET' && path === '/ai-manager/process/detail') return html(res, editorPage(scenario));
    if (req.method === 'GET' && path === '/ai-manager/process/publish') {
      const body = JSON.stringify({ status: 200 });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    const body = JSON.stringify({ status: 404 });
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };
}

export function startPublishSut({ port = 0, scenario = 'happy' } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--port', String(port), '--scenario', scenario], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('publish 假 SUT 子进程启动超时')); } }, 10000);
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
    child.once('exit', (code) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('publish 假 SUT 子进程未就绪即退出 code=' + code)); } });
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
