// Workflow create, save, publish, and delete compile atoms.
import { instantiate } from './instantiate.mjs';
import { inspectWorkflowDeleteConfirm, inspectWorkflowDeleteTarget, performWorkflowDeleteConfirm, performWorkflowDeleteTrigger } from './workflow-delete-domain.mjs';
import { armDestructiveTargetContinuity } from './compile-atoms-agent.mjs';
import { ROUTE_LIST, SEARCH_BOX_NAME, auditDeleteCount } from './compile-atoms-support.mjs';

export async function compileWorkflowCreate(run, params) {
  const iNav = run.newIntent();
  await run.emit({ intentId: iNav, atom: 'workflow.create', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });

  const iCreate = run.newIntent();
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true }, text: '新增工作流',
  });
  // 下拉菜单分支线性化（约定 4）：真机若开菜单则多一步 menuitem 点击；直开抽屉则无本步。
  const menuitem = run.page.getByRole('menuitem', { name: '新增工作流' });
  await sleep(250);
  if ((await menuitem.count().catch(() => 0)) >= 1) {
    await run.emit({
      intentId: iCreate, atom: 'workflow.create', action: 'click',
      semantic: { kind: 'role', role: 'menuitem', name: '新增工作流', exact: true }, text: '新增工作流',
    });
  } else {
    // Heren 真机（2026-07-02 实采）：下拉菜单无 menuitem 角色（.hr-dropdown__menu div 汤，隐藏副本多份）——
    // 限定可见菜单容器锚定；裸 text 不进 semantic（全局同名 3 处，避免回放多命中 ambiguous）。
    const itemCss = '.hr-dropdown__menu:visible .hr-dropdown__item-text:text-is("新增工作流")';
    if ((await run.page.locator(itemCss).count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', text: '新增工作流', fallbackCss: itemCss });
    }
  }
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'fill',
    semantic: { kind: 'label', name: '工作流名称' }, fieldLabel: '工作流名称', required: true,
    value: params.name, uniqueGuard: true,
    // Heren 真机（2026-07-02 实采）：表单标签是 div、无程序化关联（getByLabel 必 0）——form__item 容器锚定（count=1 亲验）。
    fallbackCss: '.hr-form__item:has(label:text-is("工作流名称")) input',
  });
  if (params.desc) {
    // 描述 textarea 标签锚定可行性 = route:human ④：锚不上则不落步、记录。真机标签实名「工作流描述」（必填）。
    const descCss = '.hr-form__item:has(label:has-text("工作流描述")) textarea';
    if ((await run.page.getByLabel('描述').count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'fill', semantic: { kind: 'label', name: '描述' }, fieldLabel: '描述', value: params.desc });
    } else if ((await run.page.locator(descCss).count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'fill', semantic: { kind: 'label', name: '工作流描述' }, fieldLabel: '工作流描述', value: params.desc, fallbackCss: descCss });
    } else {
      run.notes.push('描述 textarea 无标签锚定（route:human ④）：本步不落 event');
    }
  }
  if (params.category) {
    const sel = (run.site && run.site.select) || {};
    const combo = run.page.getByRole('combobox', { name: '分类' });
    if ((await combo.count().catch(() => 0)) >= 1) {
      await run.emit({
        intentId: iCreate, atom: 'workflow.create', action: 'selectOption',
        dropdownUnit: {
          fieldLabel: '分类', optionText: params.category,
          scope: (sel.scopes && sel.scopes[0]) || '.hr-drawer__content-wrapper',
          optionListSelector: sel.optionList || '.hr-select__list',
          native: false,
        },
      });
    } else {
      // Heren 真机（2026-07-02 实采）：分类下拉无 combobox 角色（input placeholder=请选择）→ 线性化两击（约定 4）。
      // 回放侧 doSelect 只认 combobox，selectOption 事件在此 DOM 不可回放；选项浮层 teleport 到 body、
      // 全局 text 会撞列表页分类 tab（抽屉遮罩拦点），必须限定可见选项列表作用域。
      const shellCss = '.hr-form__item:has(label:has-text("分类")) input';
      const optCss = `${sel.optionList || '.hr-select__list'}:visible :text-is(${JSON.stringify(params.category)})`;
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', fieldLabel: '分类', fallbackCss: shellCss });
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', text: params.category, fallbackCss: optCss });
    }
  }
  // 抽屉确认按钮文本实采（确定/确认，route:human ⑤ 的编译期核验位）。
  let confirmName = null;
  for (const cand of ['确定', '确认']) {
    if ((await run.page.getByRole('button', { name: cand, exact: true }).count().catch(() => 0)) >= 1) { confirmName = cand; break; }
  }
  if (confirmName) {
    await run.emit({
      intentId: iCreate, atom: 'workflow.create', action: 'click',
      semantic: { kind: 'role', role: 'button', name: confirmName, exact: true }, text: confirmName,
      fallbackCss: '.hr-drawer__footer button.hr-button--primary',
    });
  } else {
    // Heren 真机（2026-07-02 实采）：抽屉 footer 是 div 按钮（hr-button--theme-primary，role=button 采样必 0）——
    // footer 主按钮锚定；实采文本记 compile-report（route:human ⑤ 证据）。
    const footCss = '.hr-drawer:visible .hr-drawer__footer .hr-button--theme-primary';
    const footN = await run.page.locator(footCss).count().catch(() => 0);
    if (footN >= 1) {
      const footText = ((await run.page.locator(footCss).first().textContent().catch(() => '')) || '').trim() || '确定';
      run.notes.push(`抽屉确认按钮实采（div 按钮）：文本「${footText}」count=${footN}（route:human ⑤ 证据）`);
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'click', text: footText, fallbackCss: footCss });
    } else {
      run.notes.push('抽屉确认按钮文本实采失败（确定/确认均 0 命中）→ route:human ⑤');
      await run.emit({
        intentId: iCreate, atom: 'workflow.create', action: 'click',
        semantic: { kind: 'role', role: 'button', name: '确定', exact: true }, text: '确定',
        fallbackCss: '.hr-drawer__footer button.hr-button--primary',
      });
    }
  }
  // C2 source 读回武装（母规格 point 3）：剖面声明 workflows.listApi（run.identityLedger 在）时，创建确认后
  // re-query 平台读回工作流 ID（created-in-run→platform-readback），武装 run.pendingIdentityObservation 交
  // compileFlow 归档 join 到 source binding。evidenceStepId=确认 click（最后一个已发事件，武装前捕获，避免被
  // 读回自身的搜索 fill/press 事件顶替）。未声明身份通道零行为差（既有 workflow.create 字节零漂移）。
  if (run.identityLedger && run.profile && run.profile.workflows && run.profile.workflows.listApi) {
    const terminalStep = run.events.length ? run.events[run.events.length - 1] : null;
    const readback = await armWorkflowSourceReadback(run, {
      intentId: iCreate, atom: 'workflow.create',
      evidenceStepId: terminalStep ? terminalStep.stepId : null, openName: params.name,
    });
    if (readback) run.pendingIdentityObservation = readback;
  }
}

export async function compileWorkflowSave(run) {
  const iSave = run.newIntent();
  await run.emit({
    intentId: iSave, atom: 'workflow.save', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '保存', exact: true }, text: '保存',
  });
}

// workflow.publish（wf-publish-states GRILL M4）：照 workflow.save 形状——单击编辑器「发布」；
// 不强断后置（regress 同款：完整=发布成功、不完整=校验拦，交 assert.* 判定）。破坏性但无名参，
// 清理由同 flow 的 deleteByName 承担（uniqueName 纪律）。
export async function compileWorkflowPublish(run) {
  const iPub = run.newIntent();
  await run.emit({
    intentId: iPub, atom: 'workflow.publish', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '发布', exact: true }, text: '发布',
  });
}

// workflow.clickEditorButton（wf-history-version D1）：点编辑器只读类按钮（历史版本等）——
// 照 clickEditorButton regress 形状，semantic role button exact 语义锚定（casey 纪律）。
export async function compileWorkflowClickEditorButton(run, params) {
  const i = run.newIntent();
  await run.emit({
    intentId: i, atom: 'workflow.clickEditorButton', action: 'click',
    semantic: { kind: 'role', role: 'button', name: params.name, exact: true }, text: params.name,
  });
}

// workflow.closeDrawer（wf-history-version D2）：Esc 关弹窗/抽屉——press Escape 锚 body（count 恒 1
// 过身份门；Playwright press 先 focus 再发键，Esc 冒泡关弹窗，与 regress keyboard.press 等效）。
export async function compileWorkflowCloseDrawer(run) {
  const i = run.newIntent();
  await run.emit({
    intentId: i, atom: 'workflow.closeDrawer', action: 'press', key: 'Escape',
    fallbackCss: 'body',
  });
}

// workflow.deleteByName（收尾清理线性化）：入口 = 列表搜索框；可证缺席（count===0）→ CASE_DEFECT 候选，
// 整个原子不落 event、编译继续（G1 附属人签形态）。
export async function compileWorkflowDelete(run, params) {
  const m = run.mark();
  const iDel = run.newIntent();
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'nav', url: `{{baseUrl}}${run.listRoute}` });
  const search = run.page.getByRole('textbox', { name: SEARCH_BOX_NAME });
  const n = await search.count().catch(() => 0);
  if (n === 0) {
    run.rollback(m);
    run.caseDefectCandidates.push({
      atom: 'workflow.deleteByName', params,
      evidence: { target: `role=textbox name=${SEARCH_BOX_NAME}`, count: 0 },
      note: '入口可证缺席：目标 role/text 全 DOM count===0；候选仅编译期/人签前有效（design §4.3）',
    });
    run.notes.push('workflow.deleteByName 入口可证缺席 → CASE_DEFECT 候选、不落该步、编译继续（G1 附属）');
    return;
  }
  const searchSemantic = { kind: 'role', role: 'textbox', name: SEARCH_BOX_NAME };
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'fill', semantic: searchSemantic, value: params.name });
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'press', semantic: searchSemantic, key: 'Enter' });
  // 计数口径对账（R1-F6，机械决策兑现）：搜索隔离后实采记录容器 count 与「删除」目标 count。
  // 真机可能是表格行，也可能是卡片布局；恒等才继续破坏性删除，不恒等升 route:human。
  run.countAudit = await auditDeleteCount(run.page, instantiate(params.name, run.ctx));
  if (!run.countAudit.equal) {
    // R2-F4：不恒等 = 证不出「删除按钮 ↔ 目标行」对应关系——破坏性点击一律不做，
    // 截断删除链路剩余步并硬阻断（executeMode 据 blockers fail-closed、不产成功产物）。
    run.blockers.push(`计数口径不恒等（布局=${run.countAudit.layout}，记录容器=${run.countAudit.recordContainers}，删除目标=${run.countAudit.deleteButtons}）→ 删除链路截断、route:human（接缝级）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // C3 破坏性 workflow.deleteByName 编译期连续性守卫（Steven 2026-07-24 (A)；codex round-3 Critical 收口）：
  // 真 performAction 破坏步【之前】按 platformId 唯一命中的身份观察铸目标连续性 ref；铸不出（无 workflow 身份观察——
  // 如 C2 workflow 身份通道尚未接采集）→ 硬阻断、绝不按名裸删（fail-closed，route:human 补 workflow 身份采集）。
  // 绝不「删后补铸」（codex：破坏动作之后铸 ref = 零保护 fail-open；本行把武装从确认落笔后前移到破坏步前）。
  const delRef = armDestructiveTargetContinuity(run, 'workflow.deleteByName', params.name);
  if (!delRef || !delRef.ok) {
    run.blockers.push('workflow.deleteByName 目标连续性 ref 铸造失败（无唯一 platformId 身份观察）→ 破坏动作硬阻断、绝不按名裸删（fail-closed，route:human 补 workflow 身份采集）');
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const trigger = await run.emit(
    { intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'text', name: '删除', exact: true }, text: '删除', value: params.name },
    () => performWorkflowDeleteTrigger(run.page, instantiate(params.name, run.ctx)),
  );
  if (trigger.resolution !== 'unique' || trigger.acted !== true) {
    run.blockers.push(`目标记录删除动作域锁失败（resolution=${trigger.resolution}，count=${trigger.candidateCount}）→ 删除链路截断、route:human`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }

  // 先只读发现唯一可见确认弹层与其域内唯一确认文案，事件仍保持既有 role/name 形状；
  // 真正落笔时共享 helper 从物理域重新扫描、pin 并重验，发现与执行之间变化则 action_failed。
  const confirm = await inspectWorkflowDeleteConfirm(run.page);
  if (confirm.resolution !== 'unique' || !confirm.confirmName) {
    run.blockers.push(`确认弹层域锁失败（resolution=${confirm.resolution}，count=${confirm.candidateCount}）→ 删除链路截断、route:human`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  const confirmResult = await run.emit(
    { intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'role', role: 'button', name: confirm.confirmName, exact: true }, text: confirm.confirmName, value: params.name },
    () => performWorkflowDeleteConfirm(run.page, confirm.confirmName, instantiate(params.name, run.ctx)),
  );
  if (confirmResult.resolution !== 'unique' || confirmResult.acted !== true) {
    run.blockers.push(`确认动作域锁失败（resolution=${confirmResult.resolution}，count=${confirmResult.candidateCount}）→ 删除链路截断、route:human`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return;
  }
  // （目标连续性 ref 已在破坏步前武装并把关，见上方守卫；此处不再删后补铸。）
  // 重搜（删后归零断言的取数前提，属动作不属断言）。
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'fill', semantic: searchSemantic, value: params.name });
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'press', semantic: searchSemantic, key: 'Enter' });
}
