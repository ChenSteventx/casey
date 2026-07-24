// workflow 假 SUT（fixture server）—— entity-workflow-source-readback（C2）hermetic 轨的假被测系统。
// 与 chat-sut（智能体旅程）/fake-sut（p5 冻结夹具）/login-sut 分件：本份只管「工作流列表 → 搜索
// 出卡 → 打开/创建工作流 → 从 workflows 列表接口信封读回工作流平台 ID」这条 source 读回旅程。
// 镜像 chat-sut 的 id* 五场景形态（interface-spec §6），把「智能体」翻面成「工作流」：搜索 Enter 改发
// fetch('/api/workflows/query?nameLike=…') 按响应渲染 .workflow-card（标题 name + 副标题 code），
// 服务端按场景回 { data: { records: [{workflowId,workflowCode,workflowName}], total } }，workflowId 一律
// 19 位纯数字字符串（opaque，越安全整数的 number 形态会被投影拒，plan §1）。零外部依赖；只监听
// 127.0.0.1；不含真凭据。同 chat-sut/p5 教训：golden 同步跑 compile/replay 会冻住本进程事件循环，
// 假 SUT fork 独立子进程。
//
// ⚠ 真字段名待真机采、先采不猜（GRILL D4 / plan §边界）：本 fixture 的 recordsPath='data.records'、
//   totalPath='data.total'、fields{id:'workflowId',code:'workflowCode',name:'workflowName'}、抽屉/卡片
//   类名（.workflow-card / .workflow-card__name / .workflow-card__code）全为【仿造 hermetic 占位值】，
//   绝非 Heren 真机真实字段名/类名。真 recordsPath/totalPath + 抽屉真实类名 = route:human，须真机 UAT
//   采回后另填（agent 侧第一轮猜 data.records 曾被真机纠正——workflow 侧务必先采不猜）。消费本 fixture
//   的通道剖面（loop 浏览器金牌用）须声明与本文件一致的仿造字段，仅作 hermetic 行为轨、不冒充真机完成。
//
// startWorkflowSut({ port, scenario }) -> Promise<{ url, port, close }>
//   scenario:
//     'wfhappy'          名码唯一命中（records 一行、total=1）——source 读回取回 19 位 workflowId
//     'wftwins-hidden'   records 两行同名但 DOM 只渲一卡（DOM 假唯一、信封现形——毒化「重复同名不得取 first」）
//     'wfcode-mismatch'  名中码不中（DOM/信封码与期望码不一致）
//     'wfpaged'          total=2 records=1（单页一行、完整性先决不过——「total>records.length 不得证 SAME」）
//     'wfmissing'        /api/workflows/query 回 500（读回接口失败，不得静默推 SAME/absent）
//     'wftwins-dupdom'   信封 total=2 单页一行 叠加 DOM 渲两张同名卡（判定序考场——须 action_failed 非 ambiguous）
//   GET /                          —— 首页：侧栏「工作流管理」→ /process/list
//   GET /process/list              —— 工作流列表：搜索框（输入工作流名称或编码进行搜索）Enter 出 .workflow-card；
//                                     「新增工作流」按钮 → 创建抽屉（工作流名称 + 确定）→ /process/detail
//   GET /process/detail            —— 工作流详情（创建/打开后着陆页；真机 URL 含 /process/detail 已实证于既有 wf-open-smoke）
//   GET /api/workflows/query        —— 工作流名称查询信封（wfmissing 该路由回 500）——仿造 workflows.listApi
import http from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

function html(res, body) {
  const doc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>workflow 假 SUT</title></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(doc), 'Cache-Control': 'no-store' });
  res.end(doc);
}

const SIDEBAR =
  '<ul class="hr-menu"><li class="hr-menu__item"><span id="nav-workflow">工作流管理</span></li></ul>' +
  '<script>document.getElementById("nav-workflow").addEventListener("click",function(){location.href="/process/list";});</script>';

// 仿造工作流记录（workflowId 一律 19 位纯数字字符串——JSON string 形态，opaque 不作数）。
// ⚠ 字段名 workflowId/workflowCode/workflowName 为仿造占位，真字段名待真机采（先采不猜）。
const WF_MAIN = { workflowId: '1234567890123456789', workflowCode: 'WF-IM-001', workflowName: '互联网问诊-主流程' };
const WF_TWIN = { workflowId: '9876543210987654321', workflowCode: 'WF-IM-002', workflowName: '互联网问诊-主流程' };
const WF_BADCODE = { workflowId: '1234567890123456789', workflowCode: 'WF-WRONG-999', workflowName: '互联网问诊-主流程' };

// 服务端场景信封 { data: { records, total } }；wfmissing 不在此表——路由层直接 500。
function workflowQueryEnvelope(scenario) {
  if (scenario === 'wftwins-hidden' || scenario === 'wftwins-dupdom') return { data: { records: [WF_MAIN, WF_TWIN], total: 2 } };
  if (scenario === 'wfcode-mismatch') return { data: { records: [WF_BADCODE], total: 1 } };
  if (scenario === 'wfpaged') return { data: { records: [WF_MAIN], total: 2 } }; // 单页一行、total=2：完整性先决考场
  return { data: { records: [WF_MAIN], total: 1 } }; // wfhappy
}

// 列表页：搜索 Enter 发 fetch('/api/workflows/query?nameLike=…') 渲 .workflow-card（.workflow-card__name +
// .workflow-card__code 物理卡片双锚门考场）；「新增工作流」→ 创建抽屉；卡片点击 → 详情（workflow.open）。
// wftwins-hidden 只渲首行——DOM 假唯一、信封两行同名现形（DOM-only 门必被骗、双证门必 ambiguous）。
function listPage(scenario) {
  const renderRows = scenario === 'wftwins-hidden' ? 'rows.slice(0,1)'
    : scenario === 'wftwins-dupdom' ? 'rows.concat(rows)'
    : 'rows';
  const codeExpr = 'row.workflowCode';
  return (
    SIDEBAR +
    '<h1>工作流列表</h1>' +
    '<input type="text" id="wf-search" placeholder="输入工作流名称或编码进行搜索">' +
    '<button type="button" id="wf-new">新增工作流</button>' +
    '<div id="wf-results" hidden></div>' +
    // 创建抽屉（仿造 .hr-drawer；真抽屉类名待真机采）：工作流名称 + 确定 → 详情。
    '<div class="hr-drawer hr-drawer--right" id="wf-drawer" hidden>' +
    '<div class="hr-drawer__content-wrapper">' +
    '<div class="hr-form__item"><label>工作流名称</label><input type="text" id="wf-name"></div>' +
    '<div class="hr-drawer__footer"><button type="button" class="hr-button hr-button--primary" id="wf-confirm">确定</button></div>' +
    '</div></div>' +
    '<script>' +
    'document.getElementById("wf-search").addEventListener("keydown",function(e){' +
    'if(e.key!=="Enter"||!this.value.trim())return;' +
    'var box=document.getElementById("wf-results");' +
    'fetch("/api/workflows/query?nameLike="+encodeURIComponent(this.value.trim()))' +
    '.then(function(r){if(!r.ok)throw new Error("http "+r.status);return r.json();})' +
    '.then(function(j){' +
    'box.innerHTML="";' +
    'var rows=(j&&j.data&&j.data.records)||[];' +
    renderRows + '.forEach(function(row){' +
    'var card=document.createElement("div");card.className="workflow-card";' +
    'var n=document.createElement("div");n.className="workflow-card__name";n.textContent=row.workflowName;' +
    'var c=document.createElement("div");c.className="workflow-card__code";c.textContent=' + codeExpr + ';' +
    'card.appendChild(n);card.appendChild(c);' +
    'card.addEventListener("click",function(){location.href="/process/detail";});' +
    'box.appendChild(card);});' +
    'box.hidden=false;})' +
    '.catch(function(){box.innerHTML="";box.hidden=false;});' +
    '});' +
    // 新增工作流：开抽屉（条件步线性化，镜像真机下拉/抽屉形态）。
    'document.getElementById("wf-new").addEventListener("click",function(){' +
    'var d=document.getElementById("wf-drawer");d.hidden=false;d.classList.add("hr-drawer--open");});' +
    'document.getElementById("wf-confirm").addEventListener("click",function(){location.href="/process/detail";});' +
    '</script>'
  );
}

function detailPage() {
  // 详情着陆页（创建/打开后）：真机 URL 含 /process/detail（既有 wf-open-smoke 实证）。极简占位。
  return SIDEBAR + '<h1>互联网问诊-主流程</h1><div class="workflow-detail">工作流详情</div>';
}

function makeHandler(scenario) {
  return (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/') return html(res, SIDEBAR + '<h1>首页</h1>');
    if (req.method === 'GET' && path === '/process/list') return html(res, listPage(scenario));
    if (req.method === 'GET' && path === '/process/detail') return html(res, detailPage());
    if (req.method === 'GET' && path === '/api/workflows/query') {
      if (scenario === 'wfmissing') {
        const errBody = JSON.stringify({ status: 500, message: '服务异常' });
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(errBody) });
        res.end(errBody);
        return;
      }
      const okBody = JSON.stringify(workflowQueryEnvelope(scenario));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(okBody) });
      res.end(okBody);
      return;
    }
    const body = JSON.stringify({ status: 404 });
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };
}

export function startWorkflowSut({ port = 0, scenario = 'wfhappy' } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--port', String(port), '--scenario', scenario], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('workflow 假 SUT 子进程启动超时')); } }, 10000);
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
    child.once('exit', (code) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('workflow 假 SUT 子进程未就绪即退出 code=' + code)); } });
  });
}

function serveMain() {
  const argv = process.argv;
  const port = Number(argv[argv.indexOf('--port') + 1] || 0);
  const scIdx = argv.indexOf('--scenario');
  const scenario = scIdx >= 0 ? argv[scIdx + 1] : 'wfhappy';
  const server = http.createServer(makeHandler(scenario));
  server.listen(port, '127.0.0.1', () => {
    if (process.send) process.send({ ready: true, port: server.address().port });
  });
}

const isServeMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--serve');
if (isServeMain) serveMain();
