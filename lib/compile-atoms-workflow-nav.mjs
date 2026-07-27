// Navigation, open, and canvas compile atoms.
import { instantiate } from './instantiate.mjs';
import { resolveAgentCardTarget } from './agent-search-gate.mjs';
import { ENTITY_KIND_COMPILE_CHANNELS } from './entity-observation-registry.mjs';
import { AGENT_MENU_ITEM_CSS, AGENT_SEARCH_NAME, canvasBox, dragConnectByLabels, exactTextRe, nodeDragSource, workflowNodeBox } from './compile-atoms-support.mjs';

export async function compileNavAgentManagement(run) {
  const i = run.newIntent();
  const waitSearchbox = () => run.page.getByRole('textbox', { name: AGENT_SEARCH_NAME }).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (run.agentListRoute) {
    // 路由导航优先（chief-bringup G1）：真机点击通路被 hr-submenu/spacer 拦截且父 li 多匹配（探针实证），
    // 直接路由一击即中；routes.agentList 属通道剖面非凭据路径段。
    const r = await run.emit({ intentId: i, atom: 'nav.agentManagement', action: 'nav', url: `{{baseUrl}}${run.agentListRoute}` });
    if (r.resolution === 'unique') await waitSearchbox(); // 失败步不堆等（G2）：立即让 fail-closed 走到头
    return;
  }
  // 无路由兜底：点击通路（已知脆：submenu/spacer 拦截风险，真机优先配 routes.agentList）。
  // 壳页锚 = run.listRoute（真机裸根未必渲染应用壳，列表页已证含侧栏）。
  await run.emit({ intentId: i, atom: 'nav.agentManagement', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });
  const r = await run.emit({ intentId: i, atom: 'nav.agentManagement', action: 'click', text: '智能体管理', fallbackCss: AGENT_MENU_ITEM_CSS });
  // 后置条件（registry：provides 在智能体管理页）：搜索框可见；仅本步 unique 才等（G2 失败步不堆等）。
  if (r.resolution === 'unique') await waitSearchbox();
}

// nav.workflowManagement（wf-open-smoke）：路由导航一击即中——工作流列表是缺省着陆页（listRoute =
// profile.routes.workflowList 缺省 ROUTE_LIST，真机路由已实证），不设点击兜底通路（镜像 nav.agentManagement
// 的路由优先形态、简去其兜底半边）。后置锚 = 列表记录容器可见（表格行/卡片双布局口径同 auditDeleteCount）；
// 仅本步 unique 才等（G2 失败步不堆等）。
export async function compileNavWorkflowManagement(run) {
  const i = run.newIntent();
  const r = await run.emit({ intentId: i, atom: 'nav.workflowManagement', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });
  if (r.resolution === 'unique') {
    await run.page.locator('.hr-table-row, .hr-card.hr-card--bordered').first()
      .waitFor({ state: 'visible', timeout: 30000 }).catch(() => { /* 后置锚等不到不堆错：fail-closed 由后续步走到头 */ });
  }
}

// workflow.open（wf-open-smoke，只读零破坏）：列表按 openName 点开进详情。语义 = 文本精确命中
// （表格行 td / 卡片标题均以纯名渲染，同 deleteByName 点「删除」的 text 语义先例）；点击身份门唯一才 acted，
// 多匹配 fail-closed 交回放期。非破坏性原子不带 uniquePrefix 闸。后置 = 详情路由（真机 /process/detail
// 已实证）；仅 unique 才等（G2）。
export async function compileWorkflowOpen(run, params) {
  const i = run.newIntent();
  // 容器归属闸（codex R1-F1）：text-exact 全页唯一还不够——命中元素须在列表记录容器内（表格行/卡片
  // 双布局口径同 auditDeleteCount），否则同名非行控件（按钮/菜单）碰撞会被点。容器外命中 = 硬阻断
  // fail-closed 不点（executeMode 据 blockers 截断、不产成功产物）；证不出（采样异常）同阻断。
  const probe = run.page.getByText(instantiate(params.openName, run.ctx), { exact: true });
  const n = await probe.count().catch(() => null);
  if (n === 1) {
    const inContainer = await probe.evaluate((el) => !!el.closest('.hr-table-row, .hr-card.hr-card--bordered')).catch(() => null);
    if (inContainer !== true) {
      run.blockers.push(`workflow.open「${params.openName}」text-exact 唯一命中但在列表记录容器外（同名非行控件碰撞）→ 硬阻断 fail-closed 不点（route:human）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
  } // n!==1（0/多/证不出）交 emit 的点击身份门走既有 fail-closed 通道（多匹配不点、缺席不 acted）。
  const r = await run.emit({ intentId: i, atom: 'workflow.open', action: 'click', semantic: { kind: 'text', name: params.openName, exact: true }, text: params.openName });
  if (r.resolution === 'unique') {
    await run.page.waitForURL('**/process/detail**', { timeout: 30000 }).catch(() => { /* 同上：不堆等 */ });
  }
  // C2 source 读回武装（母规格 point 3）：剖面声明 workflows.listApi（run.identityLedger 在）时，打开工作流后
  // re-query 读回其平台 ID，武装 run.pendingIdentityObservation 交 compileFlow 归档 join 到 source binding。
  // 未声明身份通道零行为差（既有 workflow.open/删除链字节零漂移）。
  if (run.identityLedger && run.profile && run.profile.workflows && run.profile.workflows.listApi) {
    const readback = await armWorkflowSourceReadback(run, {
      intentId: i, atom: 'workflow.open', evidenceStepId: r.stepId, openName: params.openName, code: params.code,
    });
    if (readback) run.pendingIdentityObservation = readback;
  }
}

// workflow.addNode（wf-add-node，画布维度首原子；GRILL D3/D4，真机二号探针 2026-07-07 乙案实证——
// 面板项单击/双击不落节点、mouse 三段式拖拽落 .lf-node）：条件步线性化开面板（「添加节点」钮，镜像 create
// 下拉分支先例）→ dragTo 本体（源=面板项 text-exact 身份门、落点 ox/oy=registry x/y 直译内容参数、出界不
// clamp）→ 后置核验 .lf-node 计数 +1，不过进 run.blockers 硬阻断（镜像 workflow.open 容器归属闸先例）。
// window.lf 图对象真机缺席（globals 仅 __VUE__），取证只靠 DOM 计数 + 网络切片如实归因。
export async function compileWorkflowAddNode(run, params) {
  const i = run.newIntent();
  const nodeName = String(params.nodeName || '');
  const ox = Number.isFinite(params.x) ? params.x : 600;
  const oy = Number.isFinite(params.y) ? params.y : 280;
  const expectedDelta = Number.isFinite(params.expectedNodeDelta)
    ? Number(params.expectedNodeDelta)
    : nodeName === '真并行网关开始' ? 2 : 1;
  const nodeCount = () => run.page.locator('.lf-node').count().catch(() => null);
  const before = await nodeCount();
  // 面板项锚：.node-item 内文本精确命中（锚定用正则钉全等，防「并行网关」子串撞「真并行网关开始」）。
  const panelItem = () => run.page.locator('.node-item').filter({ hasText: exactTextRe(nodeName) });
  // 条件步：面板项不可见才点「添加节点」开面板（面板已开则跳过——线性化，镜像 create 下拉分支先例）。
  const panelOpen = await panelItem().first().isVisible().catch(() => false);
  if (!panelOpen) {
    await run.emit({ intentId: i, atom: 'workflow.addNode', action: 'click', semantic: { kind: 'role', role: 'button', name: '添加节点', exact: true }, text: '添加节点' });
  }
  await panelItem().first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await run.page.waitForTimeout(500);
  // 源身份门（emit 的 customAct 通路不走定位核验，此处自证）：count===1 才拖；缺席/多匹配/证不出 →
  // 硬阻断 fail-closed 不拖、点名进 blockers（executeMode 据此截断、不产成功产物）。
  const source = await nodeDragSource(run.page, nodeName);
  const n = source.count;
  if (n !== 1) {
    run.blockers.push(`workflow.addNode 源面板项「${nodeName}」count=${n ?? '证不出'} 非唯一/缺席 → 硬阻断 fail-closed 不拖（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  await run.emit({ intentId: i, atom: 'workflow.addNode', action: 'dragTo', semantic: { kind: 'text', name: nodeName, exact: true }, text: nodeName, nodeName, ox, oy }, async () => {
    const gbox = await canvasBox(run.page);
    const freshSource = await nodeDragSource(run.page, nodeName);
    const sbox = freshSource.box;
    if (!gbox || !sbox) throw new Error('源/画布 boundingBox 证不出');
    await run.page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
    await run.page.mouse.down();
    try {
      await run.page.mouse.move(gbox.x + ox, gbox.y + oy, { steps: 20 });
      await run.page.waitForTimeout(300);
    } finally { await run.page.mouse.up(); }
    await run.page.waitForTimeout(500);
  });
  // 后置核验（registry post：画布节点数增加）：真并行网关开始在 Heren 真机一次拖拽生成 start/end 两节点（+2），
  // 其他节点默认 +1；计数不符（含出界未落、基线/终值证不出）→ blockers 硬阻断。
  const after = await nodeCount();
  if (before == null || after == null || after !== before + expectedDelta) {
    run.blockers.push(`workflow.addNode「${nodeName}」后置核验 .lf-node 计数 ${before ?? '证不出'}→${after ?? '证不出'} 非 +${expectedDelta} → 硬阻断（fail-closed，落点不 clamp、落不进如实阻断）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.addNode「${nodeName}」.lf-node 计数 ${before}→${after}（+${expectedDelta} 后置核验过）`);
}

// workflow.connectNodes（画布连线原子）：hover 源节点 → 取 .lf-node-anchor-hover 真锚点 → 拖到目标节点中心。
// 仍复用 events.action=dragTo，不扩动作枚举；目标节点名落既有 nodeName 字段，ox/oy 写目标中心相对画布的
// 内容坐标作为诊断/兜底锚。动作成功以 .lf-edge 计数 +1 为身份回读，防“鼠标动了但没连上”假 unique。
export async function compileWorkflowConnectNodes(run, params) {
  const i = run.newIntent();
  const fromLabel = String(params.fromLabel || '');
  const toLabel = String(params.toLabel || '');
  const edgeCount = () => run.page.locator('.lf-edge').count().catch(() => null);
  const before = await edgeCount();
  const canvas = await canvasBox(run.page);
  // 预检两端在场（codex R2-F2）：源/目标节点或画布证不出 → 硬阻断 fail-closed 带诊断（镜像 addNode 干净预检，
  // 不让 workflowNodeBox 抛穿出跳产物块）；避免 ox/oy 走 :0 兜底（落点默认 0 假绿向同型缝，一并收）。
  const source = await workflowNodeBox(run.page, fromLabel);
  const target = await workflowNodeBox(run.page, toLabel);
  if (!canvas || !source || !target) {
    run.blockers.push(`workflow.connectNodes「${fromLabel}→${toLabel}」画布/源/目标节点证不出（canvas=${!!canvas}/source=${!!source}/target=${!!target}）→ 硬阻断 fail-closed 不连（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const ox = target.x + target.w / 2 - canvas.x;
  const oy = target.y + target.h / 2 - canvas.y;

  await run.emit({
    intentId: i,
    atom: 'workflow.connectNodes',
    action: 'dragTo',
    semantic: { kind: 'text', name: fromLabel, exact: true },
    text: fromLabel,
    nodeName: toLabel,
    ox,
    oy,
  }, async () => {
    await dragConnectByLabels(run.page, fromLabel, toLabel);
    const after = await edgeCount();
    if (before == null || after == null || after !== before + 1) {
      throw new Error(`连线后置核验 .lf-edge 计数 ${before ?? '证不出'}→${after ?? '证不出'} 非 +1`);
    }
  });

  const after = await edgeCount();
  if (before == null || after == null || after !== before + 1) {
    run.blockers.push(`workflow.connectNodes「${fromLabel}→${toLabel}」后置核验 .lf-edge 计数 ${before ?? '证不出'}→${after ?? '证不出'} 非 +1 → 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.connectNodes「${fromLabel}→${toLabel}」.lf-edge 计数 ${before}→${after}（+1 后置核验过）`);
}

// workflow.openNode（画布节点配置抽屉原子；GRILL D1 单击节点中心定案——registry 真机 SOP 为准、
// HANDOFF「双击」查无实证按笔误处理 + drawer-lock-hardening GRILL D2/D3/D5）：节点标题同时活在面板
// .node-item 与画布 .lf-node-content，全页身份门必撞多匹配——预检域锁 .lf-canvas-overlay 内 label 恰 1
// 才点（与回放 doOpenNode 同一扇门）→ D5 预点基线归因守卫（单击前先数「可见且含精确、且标题文本自身
// 可见」的抽屉，count>0 即证不出点后归因，绝不背书）→ mouse 单击节点箱中心 → D5 点后恰一（回读要求
// 标题锚域内恰 1，0 或 >1 同样证不出归因），证不出进 blockers 硬阻断（镜像 addNode/connectNodes 先例）。
// 成功后把当前节点标题写入 run.nodeDrawerLabel（D3，后开覆盖先开），供 selectNodeDropdown/setNodeField
// 读取作标题锚域锁。抽屉族原子的共同前置。registry「点空重点一次」重试启发式不进确定性原子（差异挂
// observability 真机复核）。

export async function armWorkflowSourceReadback(run, { intentId, atom, evidenceStepId, openName, code }) {
  const ledger = run.identityLedger;
  const wf = (run.profile && run.profile.workflows) || {};
  const target = instantiate(String(openName ?? ''), run.ctx);
  const token = ledger.arm({ intentId, expectedQuery: target });
  // 重查触发 workflows.listApi（真搜索框选择器 route:human；未声明则依赖既有列表查询回声入事务）。
  if (typeof wf.searchBox === 'string' && wf.searchBox.trim() !== '') {
    await run.emit({ intentId, atom, action: 'fill', fallbackCss: wf.searchBox, value: target });
    await run.emit({ intentId, atom, action: 'press', key: 'Enter', fallbackCss: wf.searchBox });
  }
  const { resolveDualIdentity } = await import('./agent-identity-gate.mjs');
  await ledger.settle(token, { timeoutMs: 5000 });
  ledger.seal(token);
  const envelope = ledger.consume(token);
  // 物理卡片双锚（同 agent 同卡读 name+code；容器/子选择器由 profile.workflows 声明，缺则 bin/compile.mjs 通道门已 fail-closed）。
  const cardGate = await resolveAgentCardTarget(run.page, {
    openName: target, containerSelector: wf.itemContainer, cardFields: wf.cardFields,
  });
  try {
    const dual = resolveDualIdentity({
      dom: { status: cardGate.resolution === 'container-out' ? 'failed' : cardGate.resolution, name: cardGate.name, code: cardGate.code },
      envelope,
      expected: { openName: target, code: typeof code === 'string' && code.trim() !== '' ? instantiate(code, run.ctx) : null },
    });
    run.identityGateOutcome = { resolution: dual.resolution, reason: dual.reason ?? null };
    if (dual.resolution !== 'unique') {
      run.blockers.push(`${atom} source 读回双证门裁定 ${dual.resolution}（${dual.reason}）→ 硬阻断 fail-closed（source 读回不齐绝不武装观察，DOM 唯一不豁免）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return null;
    }
    const channelSpec = ENTITY_KIND_COMPILE_CHANNELS.get('workflow');
    const profileKey = channelSpec && channelSpec.profileKey;
    const sourcePath = (profileKey && run.profile && run.profile[profileKey]
      && run.profile[profileKey].listApi && run.profile[profileKey].listApi.pathname) || 'unknown';
    return { matched: dual.matched, evidenceStepId, kind: 'workflow', sourcePath };
  } finally {
    if (cardGate.card) await cardGate.card.dispose().catch(() => {});
  }
}
