// Drawer-scoped workflow compile atoms.
import { instantiate } from './instantiate.mjs';
import { disposeDomain, disposeHandle, exactTextRe, handleInsideRoot, locatorStillBound, nodeDrawerDomain, nodeDrawerLabelInvalid, pinNodeDrawer, readBoundAgentSelectValue, verifyPinnedNodeDrawer, workflowNodeBox } from './compile-atoms-support.mjs';

export async function compileWorkflowOpenNode(run, params) {
  const i = run.newIntent();
  const label = String(params.label || '');
  // 尝试开始即失效旧 run 态标题（实现评审 r1 codex HIGH#2）：A 开成后 B 开败（任一失败路径：预检
  // blocker/点击失败/点后非恰一）时，若旧值不失效，后续 select/set 会借 A 的旧标题过域锁、对仍开着的
  // A 抽屉真落笔——即使整体 exit 65 零 events，编译执行期已对错误抽屉产生副作用（违 fail-safe）。
  // 故进本函数即清空，仅下方「点后恰一」确证成功才写回（G13 钉此语义）。
  run.nodeDrawerLabel = null;
  // trim 空门（codex r5 fail-open，与回放门 doOpenNode 同刻）：纯空白 label 经 nodeDrawerDomain 的 norm
  // 归一成空串会借空 target 命中画布/抽屉空文本节点假绿——trim 空即非法标题，硬阻断 fail-closed。
  if (label.trim() === '') {
    run.blockers.push(`workflow.openNode label 缺失或纯空白（trim 后为空，非法标题）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 预检域锁身份门（emit 的 customAct 通路不走定位核验，此处自证——镜像 addNode 源身份门）：
  const domain = run.page.locator('.lf-canvas-overlay').getByText(label, { exact: true });
  const n = await domain.count().catch(() => null);
  if (n !== 1) {
    run.blockers.push(`workflow.openNode「${label}」画布域内 count=${n ?? '证不出'} 非唯一/缺席 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const box = await workflowNodeBox(run.page, label);
  if (!box) {
    run.blockers.push(`workflow.openNode「${label}」节点 boundingBox 证不出 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // D5 预点基线归因守卫（评审修订同刻）：另一可见抽屉恰含节点标题文本时，点了没开也可能回读成立 → 假绿；
  // 单击前先证明「域内本无此标题」，才能把点后的抽屉归因于本次单击。
  const baseline = await nodeDrawerDomain(run.page, label);
  const baselineCount = baseline.length;
  await disposeDomain(baseline); // A1 释放纪律：只用计数即释放
  if (baselineCount > 0) {
    run.blockers.push(`workflow.openNode「${label}」预点基线：单击前已有 ${baselineCount} 个可见且含精确标题的抽屉，证不出点后归因 → 硬阻断（fail-closed，route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  await run.emit({ intentId: i, atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: label, exact: true }, text: label }, async () => {
    await run.page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); // registry SOP「点中心」
    // 点后等待：轮询标题锚域内计数直到 ≥1 或超时（需要的是计数、不止存在性，故不用单点 waitFor）。
    const t0 = Date.now();
    for (;;) {
      const cur = await nodeDrawerDomain(run.page, label);
      const curCount = cur.length;
      await disposeDomain(cur); // A1 释放纪律：轮询每拍即释放
      if (curCount >= 1 || Date.now() - t0 > 5000) break;
      await sleep(100);
    }
  });
  // D5 点后恰一（评审修订同刻）：回读要求标题锚域内恰 1（0 或 >1 同样证不出归因，绝不背书；子串/隐藏
  // 文本已被 nodeDrawerDomain 的精确+可见双限定堵死，评审 F1/D2）。
  const after = await nodeDrawerDomain(run.page, label);
  const afterCount = after.length;
  await disposeDomain(after); // A1 释放纪律
  if (afterCount !== 1) {
    run.blockers.push(`workflow.openNode「${label}」后置核验：点后域内含精确标题的可见抽屉 count=${afterCount}（非恰一）证不出归因 → 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.nodeDrawerLabel = label; // D3：编译期 run 态记当前节点标题，供 select/set 两原子域锁读取（后开覆盖先开）
  run.notes.push(`workflow.openNode「${label}」节点配置抽屉已开（可见+含标题双证过，预点基线 0、点后恰一）`);
}

// workflow.selectNodeDropdown（画布节点抽屉下拉原子；GRILL D1/D3/D4/D5 + drawer-lock-hardening
// GRILL D2/D3/D4/D6）：抽屉族第二原子（前置必先 workflow.openNode 开抽屉——registry
// requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=click（零冻结 schema：nth 载下拉下标、
// text 载 option、semantic 载触发器锚、nodeName 载当前节点标题）——不走 selectOption（冻结 schema 的
// allOf 强制 selectOption 带 dropdownUnit，而 dropdownUnit 无 nth 槽、required fieldLabel/optionText 与
// 节点 nth 定位冲突）。先读 run.nodeDrawerLabel 作标题锚域锁（D3；缺失/非 string/trim 空 → blocker
// fail-closed，D4 修订、D3 run 态缺失分支实钉）——域内 count===0/>1 → blocker（D6 三态）；count===1 才
// 以该抽屉为根，预检域内第 nth 个【可见】.hr-select:visible 触发器（nth<count，路 A 确定性位置消歧；
// 非法 nth（在场但非非负整数）/ count=0 无下拉 / nth 越界 → blocker 硬阻断，fail-closed）→ customAct
// 点第 nth 触发器 + 限【可见浮层】.hr-select-option 唯一才点（多匹配/缺席 throw → emit 落 action_failed）
// → 后置触发器值回读（不再「请选择」且精确含 option）。编译门与回放门 doSelectNodeDropdown 同刻（同域锁
// + 同可见浮层作用域 + 同精确回读）。registry「点松回读紧」（点选项容 registry 子串但须唯一，回读精确）。
export async function compileWorkflowSelectNodeDropdown(run, params) {
  const i = run.newIntent();
  // nth 校验（fix#1）：缺省 → 合法默认 0；在场但非「非负整数」→ blocker 硬阻断 fail-closed 零 events
  // （绝不降级 index 0 猜首项——与「越界→blocker」同口径，fail-safe 不 fail-open）。
  if (params.nth !== undefined && (!Number.isInteger(params.nth) || params.nth < 0)) {
    run.blockers.push(`workflow.selectNodeDropdown nth=${JSON.stringify(params.nth)} 非法（在场但非非负整数）→ 硬阻断 fail-closed 不点（route:human，绝不降级 index 0）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const nth = params.nth === undefined ? 0 : params.nth;
  const option = params.option != null ? String(params.option) : null;
  // D3/D4 修订：run 态当前节点标题缺失/非 string/trim 后空白 → 硬阻断 fail-closed（理论不可达，flow gate
  // 已强制前序 openNode；openNode 若被自身 blocker 截会让 run 态维持缺失，此处兜底截断级联，D3 run 态
  // 缺失分支实钉）。
  if (nodeDrawerLabelInvalid(run.nodeDrawerLabel)) {
    run.blockers.push(`workflow.selectNodeDropdown run 态节点抽屉标题缺失或空白（openNode 未成功开抽屉或标题空白）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const label = run.nodeDrawerLabel;
  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续触发器定位/落笔全以 pin 锚为根——
  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝，与回放门 doSelectNodeDropdown 同刻）。
  const bound = await pinNodeDrawer(run.page, label);
  if (bound.status === 'none') {
    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status === 'ambiguous') {
    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」标题锚域内可见抽屉 count=${bound.count}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status !== 'ok') {
    run.blockers.push(`workflow.selectNodeDropdown 当前节点「${label}」抽屉抗漂移绑定证不出（钉后重判失配）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  let actedTrigHandle = null;
  let actedOptHandle = null;
  let exactTextHandle = null;
  try {
  const root = bound.root;
  // 预检域锁触发器门（emit 的 customAct 通路不走定位核验，此处自证——镜像 openNode 域锁 + addNode 源身份门）；
  // 触发器域锁限【可见浮层】(fix#2)：照选项侧 .hr-select-option:visible 先例，封隐藏/teleport 触发器误命中。
  const triggers = root.locator('.hr-select:visible');
  // 可见等待守卫（codex 异构冗余评审 F2）：域锁改 :visible 后计数变时序敏感——抽屉/触发器异步渲染的短暂
  // 不可见窗口会让裸 count() 得 0 误落越界 blocker（fail-closed 假阴、破「两门同刻」）。补 doSelectNodeDropdown
  // 回放门同款有界 waitFor（抛不穿出、5s 上界），对既有全可见触发器场景恒等无行为差、对 ddempty 只多等即同判。
  try { await triggers.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const tcount = await triggers.count().catch(() => null);
  if (tcount == null || tcount === 0) {
    run.blockers.push(`workflow.selectNodeDropdown 节点抽屉域内「请选择」触发器 count=${tcount ?? '证不出'}（抽屉无下拉）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (nth >= tcount) {
    run.blockers.push(`workflow.selectNodeDropdown nth=${nth} ≥ 抽屉域内触发器 count=${tcount} 越界 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  try { actedTrigHandle = await triggers.nth(nth).elementHandle({ timeout: 3000 }); } catch { actedTrigHandle = null; }
  if (!actedTrigHandle) {
    run.blockers.push(`workflow.selectNodeDropdown 触发器物理绑定证不出（count=${tcount}，nth=${nth}）→ 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 动作时刻重判（r1 HIGH#1 + r2 物理化）：点触发器前重验域内唯一性 + 物理同一 + pin 全页恰一——
  // 预检到落笔之间的窗口冒出同标题冒牌/pin 被复制 → 证不出归属，绝不带疑落笔（与回放门同刻；
  // emit 内亦有落笔时刻重判兜底）。
  const preClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
  if (preClick.status !== 'ok') {
    run.blockers.push(`workflow.selectNodeDropdown 落笔前重判：当前节点「${label}」标题锚域 count=${preClick.count}${preClick.status === 'action_failed' ? '（物理绑定证不出：被钉抽屉漂移/被替换或 pin 被复制）' : ''} 证不出归属 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (!(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
    || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) {
    run.blockers.push(`workflow.selectNodeDropdown 触发器候选在落笔前发生漂移或已离开被钉抽屉 → 硬阻断 fail-closed 不点（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const spec = { intentId: i, atom: 'workflow.selectNodeDropdown', action: 'click', nth, semantic: { kind: 'text', name: '请选择', exact: true }, nodeName: label };
  if (option) spec.text = option;
  const emitResult = await run.emit(spec, async () => {
    // 落笔时刻重判兜底（r1 HIGH#1 + r2 物理化）：emit 记账与动作之间仍有窗口，抛错走 emit 既有
    // action_failed 通道（随后触发器值回读必证不出 → blocker，fail-closed 收口）。
    const atAct = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (atAct.status !== 'ok') throw new Error(`落笔时刻标题锚域重判失败（count=${atAct.count}，${atAct.status}），拒点`);
    if (!(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) throw new Error('触发器候选漂移或不在被钉抽屉物理节点内，拒点');
    await actedTrigHandle.click({ timeout: 3000 });
    const afterTriggerClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterTriggerClick.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) throw new Error('触发器点击后漂移或离开被钉抽屉，拒认');
    // 可见浮层作用域（防浮层 teleport 到 body 全局 text 撞列表页/孪生浮层）：限可见 .hr-select-option。
    const visibleOptions = run.page.locator('.hr-select-option:visible');
    await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 });
    const target = option ? visibleOptions.filter({ hasText: exactTextRe(option) }) : visibleOptions;
    const oc = await target.count().catch(() => 0);
    if (oc !== 1) throw new Error(`浮层内目标选项「${option ?? '首项'}」可见 count=${oc} 非唯一/缺席，拒点`);
    actedOptHandle = await target.first().elementHandle({ timeout: 3000 });
    if (!actedOptHandle) throw new Error('浮层目标选项物理绑定证不出，拒点');
    // 选项单击才是真正改写触发器值的落笔，浮层开着的窗口同样重判（与回放门 preOpt 同刻）。浮层
    // teleport 到 body 无祖先物理包含可验——靠 oc===1 唯一闸 + 触发器物理句柄回读兜底。
    const atOpt = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (atOpt.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))
      || !(await locatorStillBound(run.page, target, 0, actedOptHandle, 1))) throw new Error(`选项落笔前物理绑定重判失败（count=${atOpt.count}，${atOpt.status}），拒点`);
    await actedOptHandle.click({ timeout: 3000 });
    const afterOptionClick = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterOptionClick.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, nth, actedTrigHandle))
      || !(await handleInsideRoot(actedTrigHandle, bound.rootHandle))) throw new Error('选项点击后触发器漂移或离开被钉抽屉，拒认');
  });
  // 后置核验（触发器值回读，物理句柄口径；registry post：该下拉已选中含 option 的项）：重读被点的
  // 同一物理触发器——不再「请选择」且【精确】含 option（text= 引擎带引号=规范化精确匹配，非子串——
  // openNode F1 教训下拉版：子串会把「选错项/写错值」误判选对）。
  let val = null;
  try { val = actedTrigHandle ? (await actedTrigHandle.innerText({ timeout: 2000 })).trim() : null; } catch { val = null; }
  let exactHit = 0;
  if (option) {
    try {
      exactTextHandle = actedTrigHandle ? await actedTrigHandle.$(`text=${JSON.stringify(option)}`) : null;
      exactHit = exactTextHandle ? 1 : 0;
    } catch { exactHit = 0; }
  } else {
    exactHit = val && val !== '请选择' ? 1 : 0;
  }
  const afterReadback = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
  const triggerStillBound = await locatorStillBound(run.page, triggers, nth, actedTrigHandle);
  const triggerStillInside = await handleInsideRoot(actedTrigHandle, bound.rootHandle);
  if (emitResult.resolution !== 'unique' || afterReadback.status !== 'ok' || !triggerStillBound || !triggerStillInside
    || !val || val === '请选择' || exactHit !== 1) {
    run.blockers.push(`workflow.selectNodeDropdown 后置核验触发器值回读证不出（值=${val ?? '证不出'}，精确含 option=${option ? exactHit === 1 : 'n/a'}）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.selectNodeDropdown 节点下拉已选中（nth=${nth}/${option ?? '首项'}，触发器值「${val}」精确回读过，域锁「${label}」）`);
  } finally {
    await disposeHandle(exactTextHandle);
    await disposeHandle(actedOptHandle);
    await disposeHandle(actedTrigHandle);
    await disposeHandle(bound.rootHandle);
  }
}

// workflow.setNodeField（画布节点抽屉可填字段原子；GRILL D1/D3/D4/D5 + drawer-lock-hardening
// GRILL D2/D3/D4/D6）：抽屉族第三原子（前置必先 workflow.openNode 开抽屉——registry
// requires:[节点抽屉已开]，flow 门已强制）。复用 events.action=fill（零冻结 schema：value 载填入值、
// semantic:{kind:label,name:placeholder,exact} 载占位符锚 + 精确开关、nth 仅显式给时载字段下标消歧、
// nodeName 载当前节点标题）——冻结 schema 的 allOf 对 fill 只要求 value。先读 run.nodeDrawerLabel 作
// 标题锚域锁（D3；缺失/非 string/trim 空 → blocker fail-closed，D4 修订、D3 run 态缺失分支实钉）——
// 域内 count===0/>1 → blocker（D6 三态）；count===1 才以该抽屉为根，预检域内 getByPlaceholder(placeholder,
// {exact})（占位符锚非 semanticLocator 命中口径，故按 ev.atom 分发专用回放门 doSetNodeField）。字段级
// 唯一闸（D4，fail-safe 核心）：count=0 缺席 / 未给 nth 且 count>1 多匹配 ambiguous 绝不填首项 / 给 nth 越界
// → blocker 硬阻断（fail-closed）；唯一或显式 nth 合法才填。emit customAct = target.fill（填值内聚，镜像
// doSelectNodeDropdown 两击内聚）→ 后置字段 value 回读（inputValue() 精确等于实例化后填入值，非 includes
// 子串——F1 教训子串会把填错值/半填误判填对）证不出 → blocker 硬阻断。编译门与回放门 doSetNodeField 同刻。
export async function compileWorkflowSetNodeField(run, params) {
  const i = run.newIntent();
  const placeholder = String(params.placeholder || '');
  const value = String(params.value != null ? params.value : '');
  const exact = params.exact === true;
  // nth 校验（HIGH fix，镜像 selectNodeDropdown fix#1）：缺省（undefined）→ 合法默认 0；在场但非「非负整数」
  // → blocker 硬阻断 fail-closed 零 events（绝不降级 index 0 猜首项——静默取 0 会替用户填错第一格还返 unique
  // 假绿，违「fail-safe 不 fail-open」+ ADR-0007；与「越界→blocker」同口径）。
  if (params.nth !== undefined && (!Number.isInteger(params.nth) || params.nth < 0)) {
    run.blockers.push(`workflow.setNodeField nth=${JSON.stringify(params.nth)} 非法（在场但非非负整数）→ 硬阻断 fail-closed 不填（route:human，绝不降级 index 0）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const hasNth = params.nth !== undefined;
  const nth = hasNth ? params.nth : 0;
  if (!placeholder || params.value == null) {
    run.blockers.push(`workflow.setNodeField placeholder/value 证不出（placeholder=「${placeholder}」value=${params.value == null ? '缺' : '有'}）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // D3/D4 修订：run 态当前节点标题缺失/非 string/trim 后空白 → 硬阻断 fail-closed。
  if (nodeDrawerLabelInvalid(run.nodeDrawerLabel)) {
    run.blockers.push(`workflow.setNodeField run 态节点抽屉标题缺失或空白（openNode 未成功开抽屉或标题空白）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const label = run.nodeDrawerLabel;
  // 域三态 + 抗漂移绑定（r1 HIGH#1）：域内恰一才钉 pin，后续字段定位/落笔全以 pin 锚为根——
  // 检查后窗口前插的同标题冒牌接不到动作（twindelay 反面钉此缝，与回放门 doSetNodeField 同刻）。
  const bound = await pinNodeDrawer(run.page, label);
  if (bound.status === 'none') {
    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=0（抽屉缺席或标题不可见）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status === 'ambiguous') {
    run.blockers.push(`workflow.setNodeField 当前节点「${label}」标题锚域内可见抽屉 count=${bound.count}（多个抽屉同显该节点标题，证不出归属）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (bound.status !== 'ok') {
    run.blockers.push(`workflow.setNodeField 当前节点「${label}」抽屉抗漂移绑定证不出（钉后重判失配）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  let actedFieldHandle = null;
  try {
  const root = bound.root;
  // 预检域锁字段门（emit 的 customAct 通路不走定位核验，此处自证——镜像 selectNodeDropdown 域锁 + openNode 源身份门）：
  const fields = root.getByPlaceholder(placeholder, { exact });
  const fcount = await fields.count().catch(() => null);
  if (fcount == null || fcount === 0) {
    run.blockers.push(`workflow.setNodeField 节点抽屉域内占位符「${placeholder}」字段 count=0（抽屉无该字段）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (!hasNth && fcount > 1) {
    run.blockers.push(`workflow.setNodeField 节点抽屉域内占位符「${placeholder}」多匹配 count=${fcount} 未给 nth → ambiguous 硬阻断 fail-closed 绝不填首项（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  if (hasNth && nth >= fcount) {
    run.blockers.push(`workflow.setNodeField nth=${nth} ≥ 抽屉域内占位符「${placeholder}」字段 count=${fcount} 越界 → 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const targetIndex = hasNth ? nth : 0;
  const target = fields.nth(targetIndex);
  try { actedFieldHandle = await target.elementHandle({ timeout: 3000 }); } catch { actedFieldHandle = null; }
  if (!actedFieldHandle) {
    run.blockers.push(`workflow.setNodeField 字段物理绑定证不出（count=${fcount}，nth=${targetIndex}）→ 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 动作时刻重判（r1 HIGH#1 + r2 物理化）：落笔（fill）前重验域内唯一性 + 物理同一 + pin 全页恰一——
  // 预检到落笔之间的窗口冒出同标题冒牌/pin 被复制 → 证不出归属，绝不带疑落笔（与回放门同刻；
  // emit 内亦有落笔时刻重判兜底）。
  const preFill = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
  if (preFill.status !== 'ok') {
    run.blockers.push(`workflow.setNodeField 落笔前重判：当前节点「${label}」标题锚域 count=${preFill.count}${preFill.status === 'action_failed' ? '（物理绑定证不出：被钉抽屉漂移/被替换或 pin 被复制）' : ''} 证不出归属 → 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const exactCount = hasNth ? null : 1;
  if (!(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
    || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) {
    run.blockers.push(`workflow.setNodeField 字段候选在落笔前发生漂移或已离开被钉抽屉 → 硬阻断 fail-closed 不填（route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const spec = { intentId: i, atom: 'workflow.setNodeField', action: 'fill', value, semantic: { kind: 'label', name: placeholder, exact }, nodeName: label };
  if (hasNth) spec.nth = nth;
  const emitResult = await run.emit(spec, async () => {
    // 落笔时刻重判兜底（r1 HIGH#1 + r2 物理化）：emit 记账与动作之间仍有窗口，抛错走 emit 既有
    // action_failed 通道（随后字段值回读必证不出 → blocker，fail-closed 收口）。
    const atAct = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (atAct.status !== 'ok') throw new Error(`落笔时刻标题锚域重判失败（count=${atAct.count}，${atAct.status}），拒填`);
    if (!(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
      || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) throw new Error('字段候选漂移或不在被钉抽屉物理节点内，拒填');
    await actedFieldHandle.focus();
    const afterFocus = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterFocus.status !== 'ok'
      || !(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
      || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) throw new Error('字段 focus 后漂移或离开被钉抽屉，拒填');
    await actedFieldHandle.fill(instantiate(value, run.ctx), { timeout: 3000 });
    const afterFill = await verifyPinnedNodeDrawer(run.page, label, bound.pin, bound.rootHandle);
    if (afterFill.status !== 'ok'
      || !(await locatorStillBound(run.page, fields, targetIndex, actedFieldHandle, exactCount))
      || !(await handleInsideRoot(actedFieldHandle, bound.rootHandle))) throw new Error('字段 fill 后漂移或离开被钉抽屉，拒认');
  });
  // 后置核验（registry post：该字段被填入值，物理句柄口径）：重读被填的同一物理字段，value 回读
  // 【精确】等于实例化后填入值（非 includes 子串——openNode/selectNodeDropdown F1 精确回读同律：
  // 子串会把填错值/半填/value副本超集误判填对，fail-open 假绿）。
  const want = instantiate(value, run.ctx);
  let got = null;
  try { got = actedFieldHandle ? await actedFieldHandle.inputValue({ timeout: 2000 }) : null; } catch { got = null; }
  if (emitResult.resolution !== 'unique' || got !== want) {
    run.blockers.push(`workflow.setNodeField 后置核验字段值回读证不出（占位符「${placeholder}」回读值=${got == null ? '证不出' : `「${got}」`}，期望精确「${want}」）→ 硬阻断（fail-closed）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  run.notes.push(`workflow.setNodeField 节点字段已填入（〈${placeholder}〉=〈${want}〉，value 精确回读过，域锁「${label}」）`);
  } finally {
    await disposeHandle(actedFieldHandle);
    await disposeHandle(bound.rootHandle);
  }
}

// workflow.bindAgent（entity-ui-wiring W2，关系原子 relation/[source,target]——策略 preflight:51 已冻结，
// 四层锁链数据驱动零改动）：在已打开的节点配置抽屉里把智能体绑定为 agentName。配方按 fake-sut 抽屉模式
// hermetic 先行（GRILL D1，真机配方四停站复核挂 prd observability route:human）：触发器（.agent-bind-select
// 可见恰一）→ 选项浮层精确选中（多匹配/缺席经点击身份门 fail-closed，绝不 first）→ 触发器值【精确】回读
// 双证（openNode/selectNodeDropdown F1 精确回读同律：子串会把选错/半选误判选对）。
export async function compileWorkflowBindAgent(run, params) {
  const i = run.newIntent();
  const nodeLabel = String(params.nodeLabel ?? '');
  const agentTemplate = String(params.agentName ?? '');
  const agentName = instantiate(agentTemplate, run.ctx);
  if (!nodeLabel.trim() || !agentName.trim()) {
    run.blockers.push('workflow.bindAgent 参数缺失（nodeLabel/agentName 空）→ 硬阻断 fail-closed');
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // 抽屉标题域锁（codex R1-H2/R2）：钉 nodeLabel 对应抽屉，触发器/选项/回读全程「落笔前-落笔时-落笔后」
  // 重判（verifyPinnedNodeDrawer + 物理句柄绑定三闸，与 selectNodeDropdown 同协议、与回放门同刻）——
  // 初始钉扎后窗口冒出同标题抽屉/被钉抽屉被替换/句柄漂移，一律证不出归属硬阻断，绝不带疑落笔。
  const bound = await pinNodeDrawer(run.page, nodeLabel);
  if (bound.status !== 'ok') {
    run.blockers.push(`workflow.bindAgent「${nodeLabel}」节点抽屉域锁 ${bound.status}（count=${bound.count}）→ 硬阻断 fail-closed 不点`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  let trigHandle = null;
  let optHandle = null;
  try {
    // 触发器身份门：被钉抽屉域内可见恰一 + 物理句柄绑定。
    const triggers = bound.root.locator('.agent-bind-select:visible');
    const tcount = await triggers.count().catch(() => null);
    if (tcount !== 1) {
      run.blockers.push(`workflow.bindAgent「${nodeLabel}」智能体选择控件被钉抽屉域内可见计数=${tcount ?? '证不出'}（期望恰 1）→ 硬阻断 fail-closed 不点`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    try { trigHandle = await triggers.first().elementHandle({ timeout: 3000 }); } catch { trigHandle = null; }
    if (!trigHandle) {
      run.blockers.push(`workflow.bindAgent「${nodeLabel}」触发器物理绑定证不出 → 硬阻断 fail-closed`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    // 落笔前重判（三闸）。
    const preClick = await verifyPinnedNodeDrawer(run.page, nodeLabel, bound.pin, bound.rootHandle);
    if (preClick.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, 0, trigHandle))
      || !(await handleInsideRoot(trigHandle, bound.rootHandle))) {
      run.blockers.push(`workflow.bindAgent「${nodeLabel}」落笔前重判失败（count=${preClick.count}，${preClick.status}）→ 硬阻断 fail-closed 不点`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    // 绑定动作事件只有「选中智能体」一步（触发器展开是条件步、不产 event——镜像 addNode 开面板先例）；
    // 落笔时刻重判走 emit 动作回调（抛错落 emit 既有 action_failed 通道，与 selectNodeDropdown 同法）。
    const r2 = await run.emit({ intentId: i, atom: 'workflow.bindAgent', action: 'click', semantic: { kind: 'text', name: agentTemplate, exact: true }, text: agentTemplate, value: agentTemplate, nodeName: nodeLabel }, async () => {
      const atAct = await verifyPinnedNodeDrawer(run.page, nodeLabel, bound.pin, bound.rootHandle);
      if (atAct.status !== 'ok'
        || !(await locatorStillBound(run.page, triggers, 0, trigHandle))
        || !(await handleInsideRoot(trigHandle, bound.rootHandle))) throw new Error(`落笔时刻抽屉域重判失败（count=${atAct.count}，${atAct.status}），拒点`);
      if ((await run.page.locator('.agent-bind-option:visible').count().catch(() => 0)) === 0) {
        await trigHandle.click({ timeout: 3000 }); // 条件展开（脚手架步）
      }
      const visibleOptions = run.page.locator('.agent-bind-option:visible');
      await visibleOptions.first().waitFor({ state: 'visible', timeout: 5000 });
      const target = visibleOptions.filter({ hasText: exactTextRe(agentName) });
      const oc = await target.count().catch(() => 0);
      if (oc !== 1) throw new Error(`浮层内智能体选项「${agentName}」可见 count=${oc} 非唯一/缺席，拒点（多匹配绝不 first）`);
      optHandle = await target.first().elementHandle({ timeout: 3000 });
      if (!optHandle) throw new Error('浮层选项物理绑定证不出，拒点');
      // 浮层 teleport 到 body 无祖先物理包含可验——靠可见唯一闸 + 选项物理句柄 + 抽屉域重判兜底。
      const atOpt = await verifyPinnedNodeDrawer(run.page, nodeLabel, bound.pin, bound.rootHandle);
      if (atOpt.status !== 'ok'
        || !(await locatorStillBound(run.page, triggers, 0, trigHandle))
        || !(await handleInsideRoot(trigHandle, bound.rootHandle))
        || !(await locatorStillBound(run.page, target, 0, optHandle, 1))) throw new Error(`选项落笔前重判失败（count=${atOpt.count}，${atOpt.status}），拒点`);
      await optHandle.click({ timeout: 3000 });
      const afterClick = await verifyPinnedNodeDrawer(run.page, nodeLabel, bound.pin, bound.rootHandle);
      if (afterClick.status !== 'ok'
        || !(await locatorStillBound(run.page, triggers, 0, trigHandle))
        || !(await handleInsideRoot(trigHandle, bound.rootHandle))) throw new Error(`选项点击后抽屉域重判失败（count=${afterClick.count}，${afterClick.status}），拒认`);
    });
    if (r2.resolution !== 'unique') {
      // 同名双选项 ambiguous / 缺席 none / 回调重判抛错 action_failed：身份门 fail-closed 绝不 first。
      run.blockers.push(`workflow.bindAgent 域内智能体选项「${agentName}」resolution=${r2.resolution}（count=${r2.candidateCount}）→ 硬阻断 fail-closed（多匹配绝不 first、缺席绝不猜、重判失败绝不带疑落笔）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    // 回读前重判 + 后置核验（codex R1-H1）：被钉抽屉域内【可见】选中值恰一 + 精确等值。
    const atRead = await verifyPinnedNodeDrawer(run.page, nodeLabel, bound.pin, bound.rootHandle);
    if (atRead.status !== 'ok'
      || !(await locatorStillBound(run.page, triggers, 0, trigHandle))
      || !(await handleInsideRoot(trigHandle, bound.rootHandle))) {
      run.blockers.push(`workflow.bindAgent 回读前重判失败（count=${atRead.count}，${atRead.status}）→ 硬阻断（fail-closed）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    // 回读走已绑定触发器物理句柄内查询（codex R3-H2：封「原触发器隐藏保连接、替身顶上」——惰性 locator 会读到
    // 替身；物理句柄内可见恰一在页内计算，与 nodeDrawerDomain 可见判据同口径）。
    const got = await readBoundAgentSelectValue(trigHandle);
    if (got !== agentName) {
      run.blockers.push(`workflow.bindAgent 后置核验选中值回读证不出（物理触发器内可见值=${got == null ? '证不出/非恰一' : `「${got}」`}，期望可见恰一且精确「${agentName}」）→ 硬阻断（fail-closed）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    run.notes.push(`workflow.bindAgent 智能体已选中（节点「${nodeLabel}」，选中值〈${agentName}〉可见恰一精确回读过，域锁+三闸重判+身份门+回读双证）`);
  } finally {
    await disposeHandle(trigHandle);
    await disposeHandle(optHandle);
    await disposeHandle(bound.rootHandle);
  }
}
