// 假 SUT（fixture server）—— P5 hermetic 回放的假被测系统。
// 契约见同目录 CONTRACT.md。每条 golden 起一个自带固定场景的实例，回放期场景不变、无共享态。
// 零外部依赖（只用 node 内置 http）；只监听 127.0.0.1；不含真凭据。
//
// startFakeSut({ scenario, port }) -> Promise<{ url, port, scenario, close }>
//   scenario ∈ happy | inject500 | envelope200bad | background401 | stream | pageerror | drift | ambiguous
//   close() -> Promise<void>
import http from 'node:http';

const SCENARIOS = new Set([
  'happy', 'inject500', 'envelope200bad', 'background401', 'stream', 'pageerror', 'drift', 'ambiguous',
]);

// 背景轮询 denylist 的合成形态（绝不引真 site.json，护栏 #7）：watchNetworkForensics 用它把 /auths/poll 归 background。
export const FAKE_SITE_DENYLIST = ['/api/auths/poll'];

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// save POST 的场景化响应（错误信封成功字段 = HTTP status==200 且 body.code===0，对齐 observed-reality/expected-frozen）。
function saveResponse(res, scenario) {
  if (scenario === 'inject500') return json(res, 500, { code: 1, message: '内部错误（注入故障）' });
  if (scenario === 'envelope200bad') return json(res, 200, { code: 1, message: '保存失败（HTTP 200 软失败信封）' });
  return json(res, 200, { code: 0, data: { id: 'wf_8f3a21' } });
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
    var table = el('table', { class: 'wf-list', role: 'table' });
    var tbody = el('tbody');
    var rows = scenario === 'drift' ? ['atl_wf_5fa1'] : ['atl_目录CRUD_a', 'atl_目录CRUD_b'];
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
      if (r.status === 200 && r.body && r.body.code === 0) { toast('新增成功'); go('/ai-manager/process/detail'); }
      else { toast('新增失败'); }
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
        if (!(r.status === 200 && r.body && r.body.code === 0)) toast('保存失败');
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
    if (p === '/api/auths/poll') return json(res, scenario === 'background401' ? 401 : 200, scenario === 'background401' ? { code: 1 } : { code: 0 });
    if (p === '/api/process/listProcessData') return json(res, 200, { code: 0, data: { list: ['atl_目录CRUD_a', 'atl_目录CRUD_b'] } });
    if (p === '/api/llm/streamReply') return streamReply(res);
    // 其余一律回单页应用（客户端按 pathname 渲染，覆盖 /ai-manager/process/list|detail 等）
    const body = pageHtml(scenario);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
  };
}

export function startFakeSut({ scenario = 'happy', port = 0 } = {}) {
  if (!SCENARIOS.has(scenario)) throw new Error('未知 fixture 场景: ' + scenario + '（合法: ' + [...SCENARIOS].join('/') + '）');
  return new Promise((resolve, reject) => {
    const server = http.createServer(makeHandler(scenario));
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({
        url: 'http://127.0.0.1:' + actual,
        port: actual,
        scenario,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
