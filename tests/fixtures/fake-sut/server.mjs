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
  'twinfield', 'twinboth', 'twintitle', 'twinlate', 'twinghost',
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
    // 身份闭环（wf-open-smoke）：经行名打开时渲染被打开名——仅 __OPENED__ 置位才渲，既有通路（抽屉新增→详情）零行为差。
    if (window.__OPENED__) { app.appendChild(el('div', { class: 'wf-open-title' }, window.__OPENED__)); }
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
    // ambiguous：渲染第二个同名保存按钮 → 语义定位器多匹配 → 通用门 gateAndAct count>1 → resolution=ambiguous
    //   （CONTEXT.md 第 79 行：多匹配唯一合法字面量=ambiguous；旧写法 fallback_first 在动作轴/裁定链语境已弃用）。
    if (scenario === 'ambiguous') app.appendChild(mkSave());
    // 画布通路（wf-add-node）：详情页尾部加法渲染，既有场景无人碰画布零行为差（wf-open-smoke 行名先例）。
    renderCanvas();
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
      nodeDrawer.appendChild(el('div', { class: 'lf-node-drawer__title' }, titleText));
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
      // ddempty/twinfield/twinlate：抽屉开但无字段无下拉——域内触发器/字段 count=0（execute 预检的「无下拉/无字段」半边；
      //   twinfield/twinlate 复用此缺席半边，真节点抽屉空、跨抽屉误命中的唯一候选靠冒牌抽屉，D7 定）。
      if (scenario === 'ddempty' || scenario === 'twinfield' || scenario === 'twinlate') return;
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
      buildNodeSelect(nodeDrawer, ddMode);
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
        // 标题、只问「抽屉可见」）会真把这唯一字段/触发器当成домen 命中，走完全程真假绿，红证成立。
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
    + '.hr-select-option{padding:2px 8px;cursor:pointer}</style>'
    + versionTag
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
