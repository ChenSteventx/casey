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
  'versioned', // plan-debt-sweep：入口脚本带 ?v= 发版号（capturedAgainstBuild 提取考场，复刻 Heren api-config.js?v=1.1.2 形态）
  'drawernone', 'drawersuperset', // wf-open-node 评审 F3/coverage：节点抽屉反面（点了不开 / 开错抽屉——标题含 label 子串非精确）
  // wf-select-node-dropdown：节点抽屉下拉反面（选项多匹配 / 目标缺席 / 选错项写错值 / 两「请选择」孪生浮层 /
  //   抽屉开但无下拉——节点抽屉已开满足 registry 前置、但域内触发器 count=0，钉 execute 预检的「无下拉」半边）。
  'ddmulti', 'ddabsent', 'ddwrong', 'ddtwin', 'ddempty',
  // wf-set-node-field：节点抽屉可填字段反面（同占位符字段多匹配 / 域锁反例——抽屉外再挂同占位符 input；
  //   复用 ddempty 作「抽屉开但无字段」缺席半边——域内 getByPlaceholder count=0）。
  //   setsuffix：字段 input 事件追加尾巴 → 填后 inputValue() 成填入值的【超集】（含 want 非等 want）——
  //   钉精确回读律（inputValue()===want 而非 includes 子串）；修前若把回读退成 includes 会误判填对假绿。
  'setmulti', 'setclash', 'setsuffix',
  // replay-nth-visible-hardening fix#2：抽屉挂一枚 display:none 的隐藏 .hr-select 触发器（占 DOM 序 index 0）+
  //   真·可见触发器——触发器域锁未限可见时误命中隐藏触发器，限 :visible 后只命中可见触发器。
  'ddhidden',
  // drawer-lock-hardening（GRILL D7，设计评审修订三扩五）：详情页画布外挂第二个可见
  //   .hr-drawer__content-wrapper 冒牌抽屉，钉 openNode/selectNodeDropdown/setNodeField 三原子域锁
  //   跨抽屉边界（codex-sol MED#2 挂账）。冒牌抽屉字段/触发器与真节点抽屉共用构建函数不特判，
  //   纯加法、既有场景零行为差。
  //   twinfield：真节点抽屉 ddempty 形态（无字段无下拉）+ 冒牌抽屉挂唯一同 placeholder 字段与「请选择」触发器
  //     （可点可选可回读）——钉 setNodeField/selectNodeDropdown 跨抽屉误命中；
  //   twinboth：真节点抽屉与冒牌抽屉各挂一个同 placeholder 字段 + 各一「请选择」触发器（评审修订：冒牌
  //     补挂触发器）——钉「域内唯一才动手」正面半边（set 与 select 各自的正面半边）；
  //   twintitle：单击节点不开抽屉（drawernone 半形态）+ 冒牌抽屉（画布外、预挂）含节点标题精确文本——
  //     钉 openNode 开错抽屉归因假绿（只覆盖『点击前已存在』的冒牌）；
  //   twinlate（评审修订新增）：单击节点开真抽屉（ddempty 形态：无字段无下拉），同刻（同一次点击的
  //     同一事件处理器内）动态挂出含该节点标题精确可见文本的冒牌抽屉（带同 placeholder 字段 + 「请选择」
  //     触发器）——钉『点击后才出现的冒牌』：openNode 预点基线 0 过、点后域内 count=2 证不出归因；
  //     set/select 域级 count=2 → ambiguous；
  //   twinghost（评审修订新增）：单击节点不开抽屉（drawernone 半形态，画布外预挂冒牌）+ 冒牌抽屉含节点
  //     标题精确文本但该文本 display:none 隐藏——钉『隐藏文本命中』假绿（标题文本自身须可见才算命中）。
  //   twindelay（实现评审 r1 修复新增，codex HIGH#1 检查后窗口）：单击节点开真抽屉（ddempty 形态），
  //     延时 3000ms 后把含该节点标题精确可见文本的冒牌抽屉（带同 placeholder 字段 + 「请选择」触发器）
  //     【前插】到真抽屉之前（DOM 序更早）——复现『域计数后到 click/fill 前同标题抽屉动态前插』：
  //     旧实现 root=structural.nth(0) 惰性重解析会在字段/触发器 5s 可见等待里漂移到冒牌抽屉且不重判
  //     三态，落笔+回读成立=假绿；延时晚于域计数（点击后约 1s 内发生）、早于 5s 等待超时，落在窗口正中。
  //   ghostdup（实现评审 r1 修复新增，codex/pi 双路 MED#1 合法正面）：真节点抽屉正常打开（缺省形态：
  //     标题+字段+下拉都在），但标题元素之前先挂一个 display:none 的同文案隐藏节点（占 DOM 序更早）——
  //     钉『隐藏同文案在前+可见真标题在后』的合法抽屉不得被误拒：可见性判定只查首命中会把该抽屉整个
  //     排出域（fail-closed 假阴），须遍历全部命中任一可见即纳入。
  //   pinclone（实现评审 r2 修复新增，codex r2 HIGH）：单击节点开真抽屉（ddempty 形态）；页面装
  //     MutationObserver 监听 data-casey-domain-pin 属性——真抽屉一被钉上 pin，同一 JS 任务的微任务里
  //     同步把 pin 值【复制】到画布外新建冒牌抽屉（无标题、带同占位符字段+「请选择」触发器、前插）。
  //     显式阶段握手（以 stamp 动作本身为相位信号）、零时序依赖。钉『pin 属性可被页面复制』：按属性
  //     选择器定根且不验物理同一/全页唯一的实现会把冒牌纳入定位、其唯一字段/触发器被当域内唯一而
  //     落笔（假绿）；物理句柄绑定 + pin 全页唯一重验后复制即被识破、拒动。
  //   fieldmove（实现评审 r3 前置独立审查 HIGH）：字段 focus 时把同一物理 input 搬到无标题冒牌抽屉，
  //     钉 fill 动作窗口仍须重验物理包含；拒填后冒牌字段保持空值。
  //   triggermove（实现评审 r3 前置独立审查 HIGH）：触发器 click 既有监听先开选项浮层，随后监听把
  //     同一物理触发器搬到无标题冒牌抽屉，钉真正点选项前仍须重验物理包含；拒选后值保持「请选择」。
  //   pinmove（实现评审 r4 汇裁 A2 HIGH）：真抽屉 A（可见标题）含两个同占位符字段，其一包在 A 内部
  //     无标题、同类名 .hr-drawer__content-wrapper 的嵌套子容器 B 里；MutationObserver 监听 pin 属性——
  //     A 一被钉，同一微任务里摘下 A 的 pin、以同值挂到 B（全页始终恰一，零时序依赖）。钉『pin 搬到
  //     无标题嵌套 wrapper』：域计数仍唯一（B 无标题不入域）、pin 全页仍恰一，唯挂点闸（唯一 pin 承载者
  //     须与被钉物理节点同一）能识破；否则 bound.root 按 pin 定位到 B、候选域 2→1 洗成 unique 假绿。
  'twinfield', 'twinboth', 'twintitle', 'twinlate', 'twinghost', 'twindelay', 'ghostdup', 'pinclone',
  'fieldmove', 'triggermove', 'pinmove',
  // replay-settle-mount：回放代表步采集前有界静默点考场。
  //   mountdelay：详情页先渲静态占位「页面加载中」→ fetch /api/process/editorData（服务端延迟可配 mountDelayMs
  //     缺省 800）→ 应答后替换渲染编辑器（保存按钮 + 画布）。复现真机数据请求驱动的 SPA 挂载 + 静态占位
  //     （占位期 DOM 静止=纯两拍判据反例考场，在途请求撑住复合判据 A）；确认按钮「新增成功」toast 3000ms 自动消隐。
  //   churn：编辑器即时挂载后 DOM 每 100ms 追加变长 + 背景轮询 300ms（denylist 内）——走时上界考场（判据 A 归零故兜底跳过）。
  'mountdelay', 'churn',
  // entity-ui-wiring W2（workflow.bindAgent 原子接线）：节点配置抽屉纯加法补「智能体」选择控件，三形态
  //   对抗场景（唯一选项 / 同名双选项 / 目标选项缺席）——钉 bindAgent 回放选中精确回读 + 缺席/多匹配
  //   fail-closed 绝不 first（A7）。控件类名 .agent-bind-select 与节点下拉 .hr-select、可填字段 .hr-input
  //   均异名，不进 selectNodeDropdown/setNodeField 任一域锁计数门；仅本三场景渲染，既有场景零行为差。
  //   bindagentone   智能体选择控件目标选项唯一（正常选中，触发器值精确回读=agentName）；
  //   bindagenttwin  同名双选项（浮层内目标 agentName 出现两次）——钉回放门 count=2 ambiguous 绝不 first；
  //   bindagentabsent 目标选项缺席（浮层不含 agentName）——钉回放门 count=0 缺席守卫硬阻断。
  'bindagentone', 'bindagenttwin', 'bindagentabsent',
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
    // mountdelay：复现真机 toast 自动消隐（典型窗 3000ms）——延采不丢典型 toast 的回归锁考场；既有场景 toast 常驻零行为差。
    if (scenario === 'mountdelay') setTimeout(function () { t.remove(); }, 3000);
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
      // 行名可点进详情（wf-open-smoke 加法通路：workflow.open 文本精确点开考场；既有场景无人点行名零行为差）。
      var nameTd = el('td', null, rows[i]);
      nameTd.addEventListener('click', (function (nm) { return function () { window.__OPENED__ = nm; go('/ai-manager/process/detail'); }; })(rows[i]));
      tr.appendChild(nameTd);
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
    // 编辑器挂载（保存按钮 + 画布）——既有场景同步调此挂载，DOM 与旧版逐字一致（零行为差）；
    //   mountdelay/churn 走各自延迟/扰动分支后再调此挂载（replay-settle-mount 加法）。
    function mountEditor() {
      app.innerHTML = '';
      // 身份闭环（wf-open-smoke）：经行名打开时渲染被打开名——仅 __OPENED__ 置位才渲，既有通路（抽屉新增→详情）零行为差。
      if (window.__OPENED__) { app.appendChild(el('div', { class: 'wf-open-title' }, window.__OPENED__)); }
      app.appendChild(mkSave());
      // ambiguous：渲染第二个同名保存按钮 → 语义定位器多匹配 → 通用门 gateAndAct count>1 → resolution=ambiguous
      //   （CONTEXT.md 第 79 行：多匹配唯一合法字面量=ambiguous；旧写法 fallback_first 在动作轴/裁定链语境已弃用）。
      if (scenario === 'ambiguous') app.appendChild(mkSave());
      // 画布通路（wf-add-node）：详情页尾部加法渲染，既有场景无人碰画布零行为差（wf-open-smoke 行名先例）。
      renderCanvas();
    }
    // mountdelay（replay-settle-mount）：先渲静态占位「页面加载中」→ 数据请求驱动异步挂载编辑器。
    //   占位期 DOM 静止（纯两拍判据会早退），在途 editorData 请求撑住判据 A——正是复合判据的反例考场。
    if (scenario === 'mountdelay') {
      app.appendChild(el('div', { class: 'hr-loading' }, '页面加载中'));
      fetch('/api/process/editorData').then(function (r) { return r.json(); }).then(function () { mountEditor(); }).catch(function () {});
      return;
    }
    // churn（replay-settle-mount）：编辑器即时挂载后，DOM 每 100ms 追加变长——两拍稳定永不达成、走时上界考场。
    if (scenario === 'churn') {
      mountEditor();
      var grow = 0;
      setInterval(function () {
        grow += 1;
        var pad = '';
        for (var z = 0; z < grow; z++) pad += '.';
        app.appendChild(el('div', { class: 'churn-row' }, 'churn-' + grow + pad));
      }, 100);
      return;
    }
    mountEditor();
  }

  // —— 画布通路（wf-add-node，LogicFlow 形态假画布）——
  // 真机实采对齐：`添加节点` 钮（role=button name=添加节点）点开面板 → .node-item 21 项 →
  //   mouse 三段式（mousedown 在面板项 / mousemove 位移过阈值 / mouseup 落在画布界内）落 .lf-node（节点名进 .lf-node-content）；
  //   单击/双击面板项【不】落节点（真机否定行为，金牌拿它当反证）。纯 DOM 零网络（取证中性，进不了 forensics）。
  // 前 4 名为真机实采名（开始节点/结束节点/脚本转换/模型节点），余 17 为合成名凑真机面板项数 21。
  var NODE_TYPES = ['开始节点', '结束节点', '脚本转换', '模型节点', '真并行网关开始', '循环节点', '并行网关', '汇聚网关', 'HTTP请求', 'SQL查询', '消息推送', '人工审核', '子流程', '定时等待', '数据映射', '知识检索', '意图识别', '文本抽取', '报表输出', '邮件通知', '异常处理'];
  var DRAG_MIN_PX = 12; // 位移阈值：低于它按点击论（单击不落节点的机制保证之一；另一保证是落点须在画布界内）
  var nodeSeq = 0; // 跨重渲递增，节点 id 不复用

  function renderCanvas() {
    var wrap = el('div', { class: 'lf-canvas-wrap' });
    var graph = el('div', { class: 'lf-graph', 'data-node-count': '0' });
    var overlay = el('div', { class: 'lf-canvas-overlay' });
    graph.appendChild(overlay);

    // 拖拽机：mousedown（面板项）时才挂 document 级 move/up 监听、mouseup 即卸——重渲不累积监听。
    function beginDrag(name, ev) {
      ev.preventDefault(); // 压掉原生文本选择，对齐 LogicFlow 拖拽手感
      var sx = ev.clientX, sy = ev.clientY, moved = false;
      function onMove(m) { if (Math.abs(m.clientX - sx) + Math.abs(m.clientY - sy) >= DRAG_MIN_PX) moved = true; }
      function onUp(u) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        var r = graph.getBoundingClientRect();
        var inside = u.clientX >= r.left && u.clientX <= r.right && u.clientY >= r.top && u.clientY <= r.bottom;
        if (!moved || !inside) return; // 单击/双击/微动/落点出画布 → 不落节点（真机否定行为）
        var lx = u.clientX - r.left, ty = u.clientY - r.top;
        // 真并行网关开始：真机一次拖拽生成 start/end 两节点（.lf-node +2）；其余节点 +1（对齐 addNode expectedNodeDelta）。
        var drops = name === '真并行网关开始'
          ? [{ nm: '真并行网关开始', dx: 0, dy: 0 }, { nm: '真并行网关结束', dx: 140, dy: 0 }]
          : [{ nm: name, dx: 0, dy: 0 }];
        drops.forEach(function (d) {
          nodeSeq += 1;
          var node = el('div', { class: 'lf-node', id: 'lf_node_' + nodeSeq });
          node.style.left = (lx + d.dx) + 'px';
          node.style.top = (ty + d.dy) + 'px';
          node.appendChild(el('div', { class: 'lf-node-content' }, d.nm));
          var anchor = el('div', { class: 'lf-node-anchor-hover' });
          anchor.addEventListener('mousedown', function (ev3) { beginEdge(node, ev3); });
          node.appendChild(anchor);
          overlay.appendChild(node);
        });
        graph.setAttribute('data-node-count', String(overlay.querySelectorAll('.lf-node').length)); // 计数一致：以 DOM 实数为准
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function beginEdge(fromNode, ev) {
      ev.preventDefault();
      ev.stopPropagation();
      function onUp(u) {
        document.removeEventListener('mouseup', onUp);
        var target = document.elementFromPoint(u.clientX, u.clientY);
        var toNode = target && target.closest ? target.closest('.lf-node') : null;
        if (!toNode || toNode === fromNode) return;
        overlay.appendChild(el('div', { class: 'lf-edge' }));
      }
      document.addEventListener('mouseup', onUp);
    }

    // 节点配置抽屉（wf-open-node，registry 真机 SOP 最小复现）：单击节点体开右侧抽屉（含节点标题）。
    // 锚点单击不开（连线专属）；连线拖拽 down/up 目标不同元素 → click 落共同祖先 overlay、closest
    // 不中节点 → 零干扰既有 addNode/connectNodes 通路（DOM 规范行为，纯加法）。
    var nodeDrawer = null;
    // 抽屉反面模式（wf-open-node 评审 F3/coverage 覆盖缺口）：由 fixture 场景控反面考场——replay 的 nav 走 pathOf
    // 剥 query（bin/replay.mjs:382），故不能用 URL query，改用场景（既有场景一律缺省行为、零影响）：
    //   缺省场景（happy 等）单击节点开抽屉、标题 = 节点名（精确）；
    //   'drawernone'     单击节点不开抽屉（模拟 app 无响应——「点了不开」反面，钉回放 action_failed）；
    //   'drawersuperset' 单击节点开抽屉、标题 = 节点名 + '副本'（含 label 子串但非精确——substring 假绿考场，钉 F1 精确回读）；
    //   'twintitle'      单击节点不开抽屉（drawernone 半形态复用）——冒牌抽屉另含节点标题精确文本钉 openNode 开错抽屉归因假绿。
    //   'twinghost'      单击节点不开抽屉（drawernone 半形态复用）——冒牌抽屉另含节点标题精确文本但该文本 display:none 隐藏。
    var drawerMode = scenario === 'drawersuperset' ? 'superset' : (scenario === 'drawernone' || scenario === 'twintitle' || scenario === 'twinghost') ? 'none' : '';
    var twinlateFakeDrawer = null; // twinlate：点击同刻动态挂出的冒牌抽屉（点击前不存在，与预挂的 twinfield/twinboth/twintitle/twinghost 冒牌不同）
    var twindelayScheduled = false; // twindelay：延时前插冒牌只排程一次（singleton，同 twinlateFakeDrawer 先例）
    var pinmoveObserving = false; // pinmove：pin 搬移观察器只装一次（singleton，同 pinclone 先例）

    // —— 节点抽屉「请选择」下拉（wf-select-node-dropdown，registry SOP 最小复现）——
    // 触发器 = .hr-select（初值「请选择」，值放 .hr-select__value 子 span 便于精确回读）；点触发器弹可见浮层
    //   .hr-select-option 选项（teleport 到 body，复现真机浮层脱离抽屉、防全局 text 撞列表页）；点选项 →
    //   触发器值改该选项（身份回读地面真值），并移除浮层（下拉收起）。ddMode 场景控反面（fixture 场景控、
    //   非 URL query——replay nav 剥 query）：ddmulti 目标选项两处、ddabsent 浮层不含目标、ddwrong 选后值更成
    //   「选项+副本」（含子串非精确）、ddtwin 抽屉挂两触发器 + 预挂一层 stale 隐藏浮层含目标（两浮层各现一次）。
    var DD_OPT = '订单库';
    var SET_FIELD_PLACEHOLDER = '请输入接口的URL'; // registry :252 setNodeField 占位符例（HTTP 节点 URL 字段）
    var ddMode = (scenario === 'ddmulti' || scenario === 'ddabsent' || scenario === 'ddwrong' || scenario === 'ddtwin') ? scenario : '';
    function ddOptionsFor(mode) {
      if (mode === 'ddmulti') return [DD_OPT, DD_OPT, '用户库']; // 目标选项浮层内出现两次 → 多匹配
      if (mode === 'ddabsent') return ['用户库', '日志库'];      // 浮层不含目标 → 缺席
      return [DD_OPT, '用户库', '日志库'];                        // 缺省/happy/ddwrong/ddtwin：目标唯一
    }
    function buildNodeSelect(container, mode) {
      var trig = el('div', { class: 'hr-select' });
      var val = el('span', { class: 'hr-select__value' }, '请选择');
      trig.appendChild(val);
      var layer = null;
      trig.addEventListener('click', function () {
        if (layer) { layer.remove(); layer = null; return; } // 再点收起（toggle）
        layer = el('div', { class: 'hr-select-dropdown' });
        var opts = ddOptionsFor(mode);
        for (var k = 0; k < opts.length; k++) {
          var o = el('div', { class: 'hr-select-option' }, opts[k]);
          o.addEventListener('click', (function (txt) { return function () {
            val.textContent = (mode === 'ddwrong') ? (txt + '副本') : txt; // ddwrong：值含子串非精确
            if (layer) { layer.remove(); layer = null; }
          }; })(opts[k]));
          layer.appendChild(o);
        }
        document.body.appendChild(layer); // teleport 到 body（复现真机浮层脱离抽屉）
      });
      container.appendChild(trig);
      return trig;
    }

    // —— 节点抽屉「智能体」选择控件（entity-ui-wiring W2，bindAgent 原子的接线面）——纯加法：
    //   触发器 = .agent-bind-select（初值「请选择智能体」，值放 .agent-bind-select__value 子 span 便于精确
    //   回读）；点触发器弹可见浮层 .agent-bind-option 选项（teleport 到 body，复现真机浮层脱离抽屉、防全局
    //   text 撞列表页/孪生浮层）；点选项 → 触发器值改该选项（身份回读地面真值），并移除浮层。类名与节点
    //   下拉 .hr-select、可填字段 .hr-input 均异名，绝不进 selectNodeDropdown/setNodeField 域锁计数门。
    //   三形态（fixture 场景控、非 URL query——replay nav 剥 query）：bindagenttwin 目标 agentName 浮层内两处
    //   → 多匹配；bindagentabsent 浮层不含目标 → 缺席；bindagentone/缺省 目标唯一。
    var AGENT_TARGET = '订单智能体'; // 目标智能体（回放选中 + 精确回读锚；与 DD_OPT「订单库」异名，防跨控件误命中）
    var AGENT_SELECT_PLACEHOLDER = '请选择智能体'; // 触发器初值（与节点下拉「请选择」异串，防全页门跨控件撞）
    function agentOptionsFor(mode) {
      if (mode === 'bindagenttwin') return [AGENT_TARGET, AGENT_TARGET, '客服智能体']; // 目标浮层内出现两次 → 多匹配
      if (mode === 'bindagentabsent') return ['客服智能体', '风控智能体'];              // 浮层不含目标 → 缺席
      return [AGENT_TARGET, '客服智能体', '风控智能体'];                                 // bindagentone/缺省：目标唯一
    }
    function buildAgentSelect(container, mode) {
      var trig = el('div', { class: 'agent-bind-select' });
      var val = el('span', { class: 'agent-bind-select__value' }, AGENT_SELECT_PLACEHOLDER);
      trig.appendChild(val);
      var layer = null;
      trig.addEventListener('click', function () {
        if (layer) { layer.remove(); layer = null; return; } // 再点收起（toggle）
        layer = el('div', { class: 'agent-bind-dropdown' });
        var opts = agentOptionsFor(mode);
        for (var k = 0; k < opts.length; k++) {
          var o = el('div', { class: 'agent-bind-option' }, opts[k]);
          o.addEventListener('click', (function (txt) { return function () {
            val.textContent = txt; // 身份回读地面真值（触发器值精确改该选项）
            if (layer) { layer.remove(); layer = null; }
          }; })(opts[k]));
          layer.appendChild(o);
        }
        document.body.appendChild(layer); // teleport 到 body（复现真机浮层脱离抽屉）
      });
      container.appendChild(trig);
      return trig;
    }

    function moveTargetToFakeDrawer(target) {
      if (!target || !target.parentNode) return;
      var actionFakeDrawer = el('div', { class: 'hr-drawer__content-wrapper action-window-fake' });
      wrap.insertBefore(actionFakeDrawer, nodeDrawer);
      actionFakeDrawer.appendChild(target);
    }

    overlay.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest || t.closest('.lf-node-anchor-hover')) return;
      var node = t.closest('.lf-node');
      if (!node) return;
      if (drawerMode === 'none') return; // 点了不开抽屉
      var title = node.querySelector('.lf-node-content');
      var titleText = title ? title.textContent : '';
      if (drawerMode === 'superset') titleText = titleText + '副本'; // 开错抽屉：标题含 label 非精确
      if (!nodeDrawer) { nodeDrawer = el('div', { class: 'hr-drawer__content-wrapper' }); wrap.appendChild(nodeDrawer); }
      nodeDrawer.textContent = '';
      // ghostdup（实现评审 r1 修复新增，codex/pi 双路 MED#1 合法正面）：真抽屉里、可见标题【之前】先挂
      //   一个 display:none 的同文案隐藏节点（真机形态如抽屉头部隐藏提示文本/占位副本先于可见标题渲染）。
      //   抽屉本身完全合法（标题可见、字段/下拉照常）——钉『可见性判定只查首命中』的误拒假阴：首命中是
      //   隐藏节点时整抽屉被排出域，合法操作被硬阻断；判定须遍历全部命中任一可见即纳入。既有场景零行为差。
      if (scenario === 'ghostdup') {
        var ghostDup = el('div', { class: 'lf-node-drawer__ghost' }, titleText);
        ghostDup.setAttribute('style', 'display:none');
        nodeDrawer.appendChild(ghostDup);
      }
      nodeDrawer.appendChild(el('div', { class: 'lf-node-drawer__title' }, titleText));
      // entity-ui-wiring W2（bindAgent 接线面，纯加法）：bindagent* 场景抽屉只渲标题 + 「智能体」选择控件
      //   （早返避开既有节点下拉/字段/twin 逻辑，既有场景一律不入本支、零行为差）。openNode 域锁读回仍按
      //   .hr-drawer__content-wrapper + .lf-node-drawer__title 双证过（结构与既有抽屉同构）。
      if (scenario === 'bindagentone' || scenario === 'bindagenttwin' || scenario === 'bindagentabsent') {
        buildAgentSelect(nodeDrawer, scenario);
        return;
      }
      // pinmove（实现评审 r4 汇裁 A2 HIGH）：真抽屉 A（含可见标题）挂两个同占位符字段，其一（field1）
      //   直接在 A 内、另一（field2）包在 A 内部无标题、同类名 .hr-drawer__content-wrapper 的嵌套子容器 B
      //   里。MutationObserver 监听 A 的 pin 属性——A 一被回放/编译门钉上 pin，同一微任务里摘下 A 的 pin、
      //   以同值挂到 B（全页始终恰一，以 stamp 为相位信号=确定性握手、零时序依赖）。钉『pin 搬到无标题
      //   嵌套 wrapper』：域计数仍唯一（B 无标题不入域）、pin 全页仍恰一——唯挂点闸（唯一 pin 承载者须与
      //   被钉物理节点同一）能识破。修前 bound.root 按 pin 定位到 B、候选域 2→1 洗成 unique 假绿；修后
      //   下一个重判点即拒（action_failed），两字段零落笔。只装一次观察器（singleton）。
      if (scenario === 'pinmove') {
        nodeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER })); // field1：直接在 A 内
        var nestedWrapper = el('div', { class: 'hr-drawer__content-wrapper' }); // B：A 内部无标题嵌套子容器
        nestedWrapper.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER })); // field2：包在 B 里
        nodeDrawer.appendChild(nestedWrapper);
        if (!pinmoveObserving) {
          pinmoveObserving = true;
          var pinmoveDone = false;
          new MutationObserver(function () {
            if (pinmoveDone) return;
            var pinVal = nodeDrawer.getAttribute('data-casey-domain-pin');
            if (!pinVal) return;
            pinmoveDone = true;
            nodeDrawer.removeAttribute('data-casey-domain-pin'); // 摘下 A 的 pin
            nestedWrapper.setAttribute('data-casey-domain-pin', pinVal); // 以同值挂到 B（全页始终恰一）
          }).observe(nodeDrawer, { attributes: true, attributeFilter: ['data-casey-domain-pin'] });
        }
        return;
      }
      // twindelay（实现评审 r1 修复新增，codex HIGH#1 检查后 TOCTOU 窗口）：真抽屉打开后延时 3000ms 把
      //   含该节点标题精确可见文本的冒牌抽屉【前插】到真抽屉之前（DOM 序更早，wrap.insertBefore）——
      //   与 twinlate 的『同刻挂出、DOM 序更晚』互补，专钉『域计数通过之后、click/fill 之前』动态前插：
      //   旧实现 root=structural.nth(0) 惰性重解析，字段/触发器 5s 可见等待里会漂移到冒牌抽屉且不重判
      //   三态。冒牌带同 placeholder 字段 + 「请选择」触发器（与 twinlate 冒牌同构，共用构建函数不特判）。
      //   延时窗口依据：回放/编译门的初次域计数在点击后约 1s 内发生（respWait 600ms + 因果窗 150ms +
      //   静默点），3000ms 晚于它、早于字段/触发器 5s 可见等待超时（约点击后 6s），落在窗口正中。
      if (scenario === 'twindelay' && !twindelayScheduled) {
        twindelayScheduled = true;
        setTimeout(function () {
          var lateFake = el('div', { class: 'hr-drawer__content-wrapper' });
          lateFake.appendChild(el('div', { class: 'fake-node-title' }, titleText));
          lateFake.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
          buildNodeSelect(lateFake, '');
          wrap.insertBefore(lateFake, nodeDrawer);
        }, 3000);
      }
      // twinlate（D7 评审修订新增）：真抽屉打开的同一次点击事件处理器内，同刻动态挂出含该节点标题
      //   精确可见文本的冒牌抽屉（点击前不存在——与 twinfield/twinboth/twintitle/twinghost 的『预挂』
      //   冒牌不同，钉『点击后才出现的冒牌』这条评审新增支线）。只挂一次（singleton，同 nodeDrawer 先例）。
      if (scenario === 'twinlate' && !twinlateFakeDrawer) {
        twinlateFakeDrawer = el('div', { class: 'hr-drawer__content-wrapper' });
        twinlateFakeDrawer.appendChild(el('div', { class: 'fake-node-title' }, titleText));
        twinlateFakeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
        buildNodeSelect(twinlateFakeDrawer, '');
        wrap.appendChild(twinlateFakeDrawer);
      }
      // ddempty/twinfield/twinlate/twindelay/pinclone：抽屉开但无字段无下拉——域内触发器/字段 count=0（execute 预检的「无下拉/无字段」半边；
      //   twinfield/twinlate/twindelay/pinclone 复用此缺席半边，真节点抽屉空、跨抽屉误命中的唯一候选靠冒牌抽屉，D7 定）。
      if (scenario === 'ddempty' || scenario === 'twinfield' || scenario === 'twinlate' || scenario === 'twindelay' || scenario === 'pinclone') return;
      // 节点抽屉下拉纯加法：缺省单下拉；ddtwin 挂两触发器 + 预挂一层 stale 隐藏浮层含目标（两浮层各现一次）。
      // ddhidden（replay-nth-visible-hardening fix#2 复现）：先挂一枚 display:none 的隐藏 .hr-select 触发器占
      //   DOM 序 index 0，再挂真·可见触发器——触发器域锁未限可见时 .hr-select count=2、nth=0 误命中隐藏触发器
      //   （点不动落 action_failed）；限 .hr-select:visible 后 count=1、nth=0 只命中真可见触发器。既有场景零行为差。
      if (scenario === 'ddhidden') {
        var ddHiddenTrig = el('div', { class: 'hr-select' });
        ddHiddenTrig.setAttribute('style', 'display:none');
        ddHiddenTrig.appendChild(el('span', { class: 'hr-select__value' }, '请选择'));
        nodeDrawer.appendChild(ddHiddenTrig); // 隐藏触发器占 DOM 序 index 0（全页门数得到、可见门数不到）
      }
      var nodeTrigger = buildNodeSelect(nodeDrawer, ddMode);
      if (scenario === 'triggermove') {
        // 动作窗口确定性反例：既有 click listener 先打开浮层，本 listener 随后把同一物理触发器搬到无标题
        // 冒牌抽屉。只做动作前 contains、动作后仍按同句柄回读的实现会选中并假报 unique。
        nodeTrigger.addEventListener('click', function moveTriggerOnce() {
          nodeTrigger.removeEventListener('click', moveTriggerOnce);
          moveTargetToFakeDrawer(nodeTrigger);
        });
      }
      if (ddMode === 'ddtwin') {
        buildNodeSelect(nodeDrawer, ddMode); // 第二个「请选择」触发器（孪生）
        var stale = el('div', { class: 'hr-select-dropdown' });
        stale.setAttribute('style', 'display:none'); // 隐藏 stale 浮层（teleport 未清理）：全页门数得到、可见门数不到
        stale.appendChild(el('div', { class: 'hr-select-option' }, DD_OPT));
        document.body.appendChild(stale);
      }
      // —— 节点抽屉可填字段（wf-set-node-field，registry SOP 最小复现）——纯加法：抽屉里渲一个可填 input
      //   （.hr-input，placeholder「请输入接口的URL」= registry HTTP 节点 URL 字段例）；真 input 元素，
      //   Playwright .fill() 直改其 .value → inputValue() 回读地面真值。setmulti 挂两个同占位符 input →
      //   域内 count=2（多匹配未给 nth ambiguous 绝不填首项）；setclash 抽屉内单字段（域外另有孪生，见下）。
      var setInp = el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER });
      if (scenario === 'fieldmove') {
        // 动作窗口确定性反例：Playwright fill 的 focus 阶段把同一物理字段搬到无标题冒牌抽屉；若只在
        // fill 前验 contains、fill 后只读同句柄 value，会把写错抽屉误报 unique。
        setInp.addEventListener('focus', function moveFieldOnce() {
          setInp.removeEventListener('focus', moveFieldOnce);
          moveTargetToFakeDrawer(setInp);
        });
      }
      if (scenario === 'setsuffix') {
        // 精确回读律钉桩：input 事件里给 value 追加尾巴 → Playwright .fill(want) 后 inputValue() 成 want+'#tail'
        //   （含 want 的超集、非等 want）。精确门 got!==want → action_failed（拒认）；若退成 includes 会误判填对假绿。
        setInp.addEventListener('input', function () {
          var SUF = '#tail';
          if (setInp.value && setInp.value.indexOf(SUF) === -1) setInp.value = setInp.value + SUF;
        });
      }
      nodeDrawer.appendChild(setInp);
      if (scenario === 'setmulti') nodeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
    });

    var panel = null;
    var addBtn = el('button', { class: 'lf-add-node-btn', type: 'button' }, '添加节点');
    addBtn.addEventListener('click', function () {
      if (panel) { panel.remove(); panel = null; return; } // 再点收起（toggle）
      panel = el('div', { class: 'node-panel' });
      for (var i = 0; i < NODE_TYPES.length; i++) {
        var item = el('div', { class: 'node-item' }, NODE_TYPES[i]);
        item.addEventListener('mousedown', (function (nm) { return function (ev2) { beginDrag(nm, ev2); }; })(NODE_TYPES[i]));
        panel.appendChild(item);
      }
      wrap.insertBefore(panel, graph); // 面板在画布上方，几何不重叠（落点判定干净）
    });

    wrap.appendChild(addBtn);
    wrap.appendChild(graph);
    // setclash（域锁反例，selectNodeDropdown ddtwin 的填值版）：详情页在抽屉【外】再挂一个同占位符 input →
    //   全页 getByPlaceholder count=2 必 ambiguous、唯域锁 .hr-drawer__content-wrapper 内 count=1 才 unique，
    //   钉「回放走域锁专用门 doSetNodeField、非全页门」。纯加法、只 setclash 场景挂、既有场景零影响。
    if (scenario === 'setclash') wrap.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
    // —— 冒牌抽屉（drawer-lock-hardening D7，纯加法反面场景）——详情页画布外（挂 wrap，同 setclash 位置
    //   先例）再挂第二个可见 .hr-drawer__content-wrapper，真机形态如同页测试面板/新增抽屉并存；字段/
    //   触发器与真节点抽屉共用构建函数 buildNodeSelect 不特判。本块只覆盖『点击前已预挂』的四场景
    //   （twinfield/twinboth/twintitle/twinghost）；twinlate 的冒牌是点击同刻动态挂出，见上方 overlay
    //   click 处理器内 twinlateFakeDrawer。既有场景（非 twin*）零行为差。
    var TWIN_TITLE_NODE = '模型节点'; // twintitle/twinghost 冒牌抽屉标题固定复用面板项名（金牌据此选同名节点考场）
    if (scenario === 'twinfield' || scenario === 'twinboth' || scenario === 'twintitle' || scenario === 'twinghost') {
      var fakeDrawer = el('div', { class: 'hr-drawer__content-wrapper' });
      if (scenario === 'twintitle') {
        // 冒牌抽屉含节点标题精确文本——钉 openNode 回读假绿：另一可见抽屉恰含 label（不含字段/触发器，
        // 本场景只考 openNode 自身，select/set 两原子不会被前置门放行到达）。
        fakeDrawer.appendChild(el('div', { class: 'fake-node-title' }, TWIN_TITLE_NODE));
      } else if (scenario === 'twinghost') {
        // twinghost（评审修订新增）：冒牌抽屉含节点标题精确文本，但该文本节点自身 display:none 隐藏
        // ——wrapper 可见但文本不可见，钉『标题文本自身须可见』收紧（D2 修订）。同时补挂一个同 placeholder
        // 字段 + 一个「请选择」触发器（与 twinfield 同构）：若只挂隐藏标题不挂字段/触发器，旧宽域锁在这
        // 具体夹具里也会因「压根没有字段」而巧合吐 none——不构成红证；补字段/触发器后，旧宽域锁（不问
        // 标题、只问「抽屉可见」）会真把这唯一字段/触发器当成域内命中，走完全程真假绿，红证成立。
        var titleEl = el('div', { class: 'fake-node-title' }, TWIN_TITLE_NODE);
        titleEl.setAttribute('style', 'display:none');
        fakeDrawer.appendChild(titleEl);
        fakeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
        buildNodeSelect(fakeDrawer, '');
      } else {
        // twinfield/twinboth：冒牌抽屉不含节点标题，只挂同 placeholder 字段（钉 setNodeField/
        // selectNodeDropdown 跨抽屉误命中）+ 一个「请选择」触发器（可点可选可回读，让旧宽域锁走完
        // 全程真假绿；评审修订：twinboth 冒牌也补挂触发器，钉 selectNodeDropdown 域内唯一才动手的
        // 正面半边——真节点抽屉此时是 ddempty 形态，无字段无下拉）。
        fakeDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
        if (scenario === 'twinfield' || scenario === 'twinboth') buildNodeSelect(fakeDrawer, '');
      }
      wrap.appendChild(fakeDrawer);
    }
    // pinclone（实现评审 r2 修复新增，codex r2 HIGH『pin 属性可被页面复制』）：MutationObserver 监听
    //   data-casey-domain-pin 属性变化——真抽屉一被回放/编译门钉上 pin，观察器回调（同一 JS 任务的微任务）
    //   同步新建冒牌抽屉（无标题、带同占位符字段+「请选择」触发器，字段/触发器共用构建函数不特判）、
    //   把 pin 值原样复制上去并【前插】到被钉节点之前。以 stamp 动作本身为相位信号 = 显式阶段握手、
    //   零时序依赖（评审 r2 MED 对 twindelay 时基延时的确定性补强）。只克隆一次（singleton）。
    if (scenario === 'pinclone') {
      var pincloneDone = false;
      new MutationObserver(function (muts) {
        if (pincloneDone) return;
        for (var mi = 0; mi < muts.length; mi++) {
          var mt = muts[mi].target;
          if (!mt || !mt.getAttribute) continue;
          var pinVal = mt.getAttribute('data-casey-domain-pin');
          if (!pinVal) continue;
          pincloneDone = true;
          var pinCloneDrawer = el('div', { class: 'hr-drawer__content-wrapper' });
          pinCloneDrawer.setAttribute('data-casey-domain-pin', pinVal);
          pinCloneDrawer.appendChild(el('input', { class: 'hr-input', placeholder: SET_FIELD_PLACEHOLDER }));
          buildNodeSelect(pinCloneDrawer, '');
          mt.parentNode.insertBefore(pinCloneDrawer, mt);
          break;
        }
      }).observe(wrap, { attributes: true, subtree: true, attributeFilter: ['data-casey-domain-pin'] });
    }
    app.appendChild(wrap);
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
  // versioned 场景：入口脚本 src 带 ?v= 发版号（capturedAgainstBuild 提取考场）；其余场景零动。
  const versionTag = scenario === 'versioned' ? '<script src="/api-config.js?v=9.9.9-test"></script>' : '';
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>假 SUT</title>'
    + '<style>.hr-toast{position:fixed;top:8px;right:8px}.hr-drawer__content-wrapper{border:1px solid #ccc}'
    + '.node-panel{display:flex;flex-wrap:wrap;gap:4px;max-width:840px;margin-top:8px}'
    + '.node-item{border:1px solid #bbb;padding:4px 8px;cursor:grab;user-select:none}'
    + '.lf-graph{position:relative;height:320px;border:1px solid #ddd;margin-top:8px}'
    + '.lf-canvas-overlay{position:absolute;left:0;top:0;right:0;bottom:0}'
    + '.lf-node{position:absolute;border:1px solid #567;padding:2px 18px 2px 6px;background:#fff}'
    + '.lf-node-anchor-hover{position:absolute;right:-6px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#2f80ed}'
    + '.lf-edge{position:absolute;left:0;top:0;width:20px;height:1px;background:#888}'
    + '.hr-select{display:inline-block;min-width:120px;border:1px solid #bbb;padding:2px 8px;margin-top:6px;cursor:pointer}'
    + '.hr-select-dropdown{position:fixed;left:8px;bottom:8px;border:1px solid #999;background:#fff;z-index:9}'
    + '.hr-select-option{padding:2px 8px;cursor:pointer}'
    + '.agent-bind-select{display:inline-block;min-width:140px;border:1px solid #a6c;padding:2px 8px;margin-top:6px;cursor:pointer}'
    + '.agent-bind-dropdown{position:fixed;left:8px;top:40px;border:1px solid #99a;background:#fff;z-index:9}'
    + '.agent-bind-option{padding:2px 8px;cursor:pointer}</style>'
    + versionTag
    + '</head><body><div id="app"></div>'
    + '<script>window.__CFG__=' + cfg + ';</script>'
    + '<script>(' + clientMain.toString() + ')();</script>'
    + '</body></html>';
}

function makeHandler(scenario, mountDelayMs = 800) {
  return function handle(req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const p = u.pathname;
    // 后端路由
    if (p === '/api/process/saveOrModifyProcessData' && req.method === 'POST') return saveResponse(res, scenario);
    // mountdelay：编辑器数据请求，服务端延迟 mountDelayMs 后应答（驱动 SPA 异步挂载；其余场景不发此请求，延迟 0 无副作用）。
    if (p === '/api/process/editorData') {
      const delay = scenario === 'mountdelay' ? mountDelayMs : 0;
      setTimeout(() => json(res, 200, { status: 200, data: { mounted: true } }), delay);
      return;
    }
    if (p === '/api/auths/poll') {
      // 背景轮询：background401 与 stale_bg401 回 401（body 用 status 形态、actual=401，复现 observed-reality 的 poll 记录）。
      var poll401 = scenario === 'background401' || scenario === 'stale_bg401';
      return json(res, poll401 ? 401 : 200, poll401 ? { status: 401, msg: '登录态过期' } : { status: 200 });
    }
    if (p === '/api/process/listProcessData') return json(res, 200, { status: 200, data: { list: ['atl_目录CRUD_a', 'atl_目录CRUD_b'] } });
    if (p === '/api/llm/streamReply') return streamReply(res);
    if (p === '/api-config.js') { // versioned 场景的发版号脚本（内容无关，只为 src 的 ?v= 查询串）
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
      return res.end('/* fake api-config */');
    }
    // 其余一律回单页应用（客户端按 pathname 渲染，覆盖 /ai-manager/process/list|detail 等）
    const body = pageHtml(scenario);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
  };
}

// 假 SUT 起在【独立子进程】（fork）。关键：golden 用同步 execFileSync 跑 replay 会冻住调用进程的事件循环；
// 假 SUT 若在同进程内，replay 期间就答不了浏览器请求（goto 卡死）。fork 到独立进程即不受阻塞——
// 假被测系统本就该是独立进程。行为（8 态路由 + 客户端）一字未改，只把承载进程移出去。
export function startFakeSut({ scenario = 'happy', port = 0, mountDelayMs = 800 } = {}) {
  if (!SCENARIOS.has(scenario)) throw new Error('未知 fixture 场景: ' + scenario + '（合法: ' + [...SCENARIOS].join('/') + '）');
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--scenario', scenario, '--port', String(port), '--mountdelay', String(mountDelayMs)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
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
  const mdIdx = argv.indexOf('--mountdelay');
  const mountDelayMs = mdIdx >= 0 && Number.isFinite(Number(argv[mdIdx + 1])) ? Number(argv[mdIdx + 1]) : 800;
  const server = http.createServer(makeHandler(scenario, mountDelayMs));
  server.listen(port, '127.0.0.1', () => {
    if (process.send) process.send({ ready: true, port: server.address().port });
  });
}

// run-as-main 检测：仅 fork 出的 --serve 子进程跑 serveMain；被 import（golden/smoke）时无副作用。
const isServeMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--serve');
if (isServeMain) serveMain();
