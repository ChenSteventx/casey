// 假 SUT（fixture server）—— P5 hermetic 回放的假被测系统。
// 契约见同目录 CONTRACT.md。每条 golden 起一个自带固定场景的实例，回放期场景不变、无共享态。
// 零外部依赖（只用 node 内置 http）；只监听 127.0.0.1；不含真凭据。
//
// startFakeSut({ scenario, port }) -> Promise<{ url, port, scenario, close }>
//   scenario ∈ happy | inject500 | envelope200bad | background401 | stream | pageerror | drift | ambiguous
//   close() -> Promise<void>
import http from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const SCENARIOS = new Set([
  'happy', 'inject500', 'envelope200bad', 'background401', 'stream', 'pageerror', 'drift', 'ambiguous',
  'stale_bg401', 'vanished',
]);

// 背景轮询 denylist 的合成形态（绝不引真 site.json，护栏 #7）：watchNetworkForensics 用它把 /auths/poll 归 background。
export const FAKE_SITE_DENYLIST = ['/api/auths/poll'];

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// save POST 的场景化响应。错误信封成功字段 = body.status===200（web/Heren 实测，ADR-0006/observed-reality 钉死；
//   通道剖面 successField='status'/successValue=200）。软失败 = HTTP 200 但 body.status≠200（招牌缺陷）。绝不用旧 {code} 形态。
function saveResponse(res, scenario) {
  if (scenario === 'inject500') return json(res, 500, { status: 500, msg: '内部错误（注入故障）' });
  if (scenario === 'envelope200bad') return json(res, 200, { status: 50001, msg: '保存失败（HTTP 200 软失败信封）' });
  return json(res, 200, { status: 200, data: { id: 'wf_8f3a21' } });
}

// SSE 流式回复：推 N 块后发 finished（静默点 = 流 finished，非 networkidle）。
function streamReply(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const chunks = ['已为该工作流', '生成节点建议：', '1) 接收患者主诉 2) 调用分诊模型 3) 输出建议科室。'];
  let i = 0;
  const tick = setInterval(() => {
    if (i < chunks.length) {
      res.write('event: delta\ndata: ' + JSON.stringify({ text: chunks[i++] }) + '\n\n');
    } else {
      clearInterval(tick);
      res.write('event: finished\ndata: ' + JSON.stringify({ status: 200, finished: true }) + '\n\n');
      res.end();
    }
  }, 20);
  res.on('close', () => clearInterval(tick));
}

// 客户端主函数：不在服务端跑，仅 .toString() 内嵌。内部不用模板字面量（避开外层 ${} 冲突），全用字符串拼接。
function clientMain() {
  var cfg = window.__CFG__ || { scenario: 'happy' };
  var scenario = cfg.scenario;
  var app = document.getElementById('app');

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
    if (text != null) n.textContent = text;
    return n;
  }
  function toast(msg) {
    var t = el('div', { class: 'hr-toast', role: 'status' }, msg);
    document.body.appendChild(t);
  }
  function go(path) { history.pushState({}, '', path); render(); }

  async function postSave() {
    var r = await fetch('/api/process/saveOrModifyProcessData', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    var body = await r.json().catch(function () { return {}; });
    return { status: r.status, body: body };
  }

  function renderList() {
    app.innerHTML = '';
    var btn = el('button', { class: 'hr-button create-wf', type: 'button' }, '新增工作流');
    btn.addEventListener('click', openDrawer);
    app.appendChild(btn);
    // 列表行 .hr-table-row（行 role=row + 行名）、删除按钮 .hr-action-delete（role=button name=删除）——
    // 类名照 drift-patch.fixture 的 locatorBefore/canonical 复刻（reproduce，复现已冻接缝、不另造）。
    // drift（漂移）场景：只渲目标行 atl_wf_5fa1 在第 1 位 → 录制脆性定位器 '.hr-table-row:nth-child(2) .hr-action-delete' 命中空(miss，失配)，
    //   而稳定签名 role=button|name=删除|withinRow=atl_wf_5fa1 唯一仍在 → 漂移探针 candidateCount=1。
    // vanished（drift 的反面）：只渲【非目标】行 atl_目录CRUD_a → 脆性定位器同样失配，但目标稳定签名 withinRow=atl_wf_5fa1 已不在
    //   → 漂移探针 candidateCount=0、sameSignatureUniquePresent=false → INDETERMINATE（堵漂移信号硬编码成 present:true）。
    var table = el('table', { class: 'wf-list', role: 'table' });
    var tbody = el('tbody');
    var rows = scenario === 'drift' ? ['atl_wf_5fa1'] : scenario === 'vanished' ? ['atl_目录CRUD_a'] : ['atl_目录CRUD_a', 'atl_目录CRUD_b'];
    for (var i = 0; i < rows.length; i++) {
      var tr = el('tr', { class: 'hr-table-row', role: 'row', 'aria-label': rows[i] });
      tr.appendChild(el('td', null, rows[i]));
      var delCell = el('td');
      var del = el('button', { class: 'hr-action-delete', type: 'button' }, '删除');
      del.addEventListener('click', (function (row) { return function () { row.remove(); }; })(tr));
      delCell.appendChild(del);
      tr.appendChild(delCell);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    app.appendChild(table);
  }

  function openDrawer() {
    var drawer = el('div', { class: 'hr-drawer__content-wrapper' });
    var lab = el('label', { for: 'wf-name' }, '工作流名称');
    var inp = el('input', { id: 'wf-name', placeholder: '请输入工作流名称', required: 'true', 'aria-label': '工作流名称' });
    var sel = el('div', { class: 'hr-select', role: 'combobox', 'aria-label': '分类' }, '请选择');
    var opts = ['测试分类', '业务分类', '其它'];
    sel.addEventListener('click', function () {
      var list = el('div', { class: 'hr-select__list' });
      for (var j = 0; j < opts.length; j++) {
        var o = el('div', { class: 'hr-select__item' }, opts[j]);
        o.addEventListener('click', (function (txt) { return function () { sel.textContent = txt; list.remove(); }; })(opts[j]));
        list.appendChild(o);
      }
      drawer.appendChild(list);
    });
    var footer = el('div', { class: 'hr-drawer__footer' });
    var ok = el('button', { class: 'hr-button hr-button--primary', type: 'button' }, '确定');
    ok.addEventListener('click', async function () {
      var r = await postSave();
      // 成功判据 = body.status===200（通道剖面成功字段，复现 Heren）。
      if (r.status === 200 && r.body && r.body.status === 200) {
        toast('新增成功');
        // stale_bg401：save 干净成功却【不】导航（复现『成功但页面未推进』= 缺陷或改版的二义）→ urlPathname 硬断言失配。
        if (scenario !== 'stale_bg401') go('/ai-manager/process/detail');
      } else { toast('新增失败'); }
    });
    footer.appendChild(ok);
    drawer.appendChild(lab); drawer.appendChild(inp); drawer.appendChild(sel); drawer.appendChild(footer);
    app.appendChild(drawer);
  }

  function renderDetail() {
    app.innerHTML = '';
    if (scenario === 'pageerror') { throw new Error('注入页面错误（pageerror 场景）'); }
    // drift：保存按钮换 class（录制 fallbackCss button.hr-button.wf-save 失配），但 role=button + name 保存 不变 → 同稳定签名唯一仍在。
    var saveClass = scenario === 'drift' ? 'hr-button wf-save-v2' : 'hr-button wf-save';
    function mkSave() {
      var b = el('button', { class: saveClass, type: 'button' }, '保存');
      b.addEventListener('click', async function () {
        var r = await postSave();
        if (scenario === 'stream') openStream();
        if (!(r.status === 200 && r.body && r.body.status === 200)) toast('保存失败');
      });
      return b;
    }
    app.appendChild(mkSave());
    // ambiguous：渲染第二个同名保存按钮 → 语义定位器多匹配 → resolution=fallback_first。
    if (scenario === 'ambiguous') app.appendChild(mkSave());
  }

  function openStream() {
    var es = new EventSource('/api/llm/streamReply?sessionId=atl_sess_1');
    es.addEventListener('finished', function () { es.close(); });
  }

  function render() {
    var p = location.pathname;
    if (p.indexOf('/ai-manager/process/detail') === 0) renderDetail();
    else renderList();
  }

  window.addEventListener('popstate', render);
  // 背景轮询：页面加载即起的 setInterval → CDP initiator = timer → watchNetworkForensics 归 background。
  setInterval(function () { fetch('/api/auths/poll').catch(function () {}); }, 300);
  render();
}

function pageHtml(scenario) {
  const cfg = JSON.stringify({ scenario });
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>假 SUT</title>'
    + '<style>.hr-toast{position:fixed;top:8px;right:8px}.hr-drawer__content-wrapper{border:1px solid #ccc}</style>'
    + '</head><body><div id="app"></div>'
    + '<script>window.__CFG__=' + cfg + ';</script>'
    + '<script>(' + clientMain.toString() + ')();</script>'
    + '</body></html>';
}

function makeHandler(scenario) {
  return function handle(req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const p = u.pathname;
    // 后端路由
    if (p === '/api/process/saveOrModifyProcessData' && req.method === 'POST') return saveResponse(res, scenario);
    if (p === '/api/auths/poll') {
      // 背景轮询：background401 与 stale_bg401 回 401（body 用 status 形态、actual=401，复现 observed-reality 的 poll 记录）。
      var poll401 = scenario === 'background401' || scenario === 'stale_bg401';
      return json(res, poll401 ? 401 : 200, poll401 ? { status: 401, msg: '登录态过期' } : { status: 200 });
    }
    if (p === '/api/process/listProcessData') return json(res, 200, { status: 200, data: { list: ['atl_目录CRUD_a', 'atl_目录CRUD_b'] } });
    if (p === '/api/llm/streamReply') return streamReply(res);
    // 其余一律回单页应用（客户端按 pathname 渲染，覆盖 /ai-manager/process/list|detail 等）
    const body = pageHtml(scenario);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
  };
}

// 假 SUT 起在【独立子进程】（fork）。关键：golden 用同步 execFileSync 跑 replay 会冻住调用进程的事件循环；
// 假 SUT 若在同进程内，replay 期间就答不了浏览器请求（goto 卡死）。fork 到独立进程即不受阻塞——
// 假被测系统本就该是独立进程。行为（8 态路由 + 客户端）一字未改，只把承载进程移出去。
export function startFakeSut({ scenario = 'happy', port = 0 } = {}) {
  if (!SCENARIOS.has(scenario)) throw new Error('未知 fixture 场景: ' + scenario + '（合法: ' + [...SCENARIOS].join('/') + '）');
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--scenario', scenario, '--port', String(port)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('假 SUT 子进程启动超时')); } }, 10000);
    child.once('message', (msg) => {
      if (settled || !msg || !msg.ready) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        url: 'http://127.0.0.1:' + msg.port,
        port: msg.port,
        scenario,
        close: () => new Promise((r) => {
          if (child.exitCode !== null || child.killed) return r(); // 已退即返回，不挂死（finding 10）
          const to = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} r(); }, 3000); // 兜底超时
          child.once('exit', () => { clearTimeout(to); r(); });
          try { child.kill(); } catch { clearTimeout(to); r(); }
        }),
      });
    });
    child.once('error', (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
    child.once('exit', (code) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('假 SUT 子进程未就绪即退出 code=' + code)); } });
  });
}

// 子进程入口（fork 后以 --serve 跑）：在独立进程内起 http server、把实际端口经 IPC 报回父进程。
function serveMain() {
  const argv = process.argv;
  const scenario = argv[argv.indexOf('--scenario') + 1] || 'happy';
  const port = Number(argv[argv.indexOf('--port') + 1] || 0);
  const server = http.createServer(makeHandler(scenario));
  server.listen(port, '127.0.0.1', () => {
    if (process.send) process.send({ ready: true, port: server.address().port });
  });
}

// run-as-main 检测：仅 fork 出的 --serve 子进程跑 serveMain；被 import（golden/smoke）时无副作用。
const isServeMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--serve');
if (isServeMain) serveMain();
