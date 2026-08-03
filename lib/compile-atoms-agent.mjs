// Agent, picker, and chat compile atoms.
import { instantiate } from './instantiate.mjs';
import { buildAgentToolAtomEvents } from './agent-tool-compile.mjs';
import { isAgentToolSpecialAction, performAgentToolAction } from './agent-tool-actions.mjs';
import { destructiveTargetKind, requiresTargetContinuityRef, selectObservationForDestructiveTarget } from './entity-destructive-continuity.mjs';
import { mintDestructiveTargetContinuity } from './entity-destructive-continuity-wiring.mjs';
import { clickAgentCardWithin, resolveAgentCardTarget, resolveAgentSearchTarget } from './agent-search-gate.mjs';
import { ENTITY_OBSERVATION_REGISTRY } from './entity-observation-registry.mjs';
import { AGENT_SEARCH_NAME, CHAT_DRAWER_CLOSE, CHAT_REPLY_SELECTOR, CHAT_SEND_ICON, CHAT_STREAM_ROUTE, sleep } from './compile-atoms-support.mjs';
import { recordPersistentActionEvidence } from './compile-execution-failure.mjs';

async function waitReplyStableCompile(page, selector, { stableMs = 2000, budgetMs = 10000 } = {}) {
  const t0 = Date.now();
  let prev = null;
  let since = Date.now();
  while (Date.now() - t0 < budgetMs) {
    let cur = null;
    try {
      const loc = page.locator(selector).last();
      cur = (await loc.count()) ? await loc.innerText({ timeout: 500 }) : null;
    } catch { cur = null; }
    if (cur !== prev) { prev = cur; since = Date.now(); }
    else if (cur != null && Date.now() - since >= stableMs) return cur;
    await sleep(250);
  }
  return prev;
}

export async function compileAgentSearchOpen(run, params) {
  const i = run.newIntent();
  const SEARCH = { kind: 'role', role: 'textbox', name: AGENT_SEARCH_NAME, exact: true };
  // 身份观察事务（agent-id-readback plan §5）：剖面声明身份通道时 fill 前武装、Enter 后 settle、点击前双证。
  const ledger = run.identityLedger;
  const target = instantiate(String(params.openName ?? ''), run.ctx);
  // 双证完整性修正（sol）+ 查询回声闭环（codex R1-H2）：身份通道声明时搜索框固定填 openName 做
  // 完整性取证（码只作唯一行联合判据），expectedQuery 在 arm 时刻冻结为同一实例化名——采集侧
  // queryEcho 不符的请求不入事务。未声明维持编码收敛既有行为（entity-ui-wiring D2，零回归）。
  const idToken = ledger ? ledger.arm({ intentId: i, expectedQuery: target }) : null;
  const keyword = ledger
    ? String(params.openName ?? '')
    : (typeof params.code === 'string' && params.code.trim() !== '' ? params.code : params.searchKeyword);
  await run.emit({ intentId: i, atom: 'agent.searchOpen', action: 'fill', semantic: SEARCH, value: keyword });
  // 搜索需回车触发过滤（regress 实测）。
  await run.emit({ intentId: i, atom: 'agent.searchOpen', action: 'press', key: 'Enter', semantic: SEARCH });

  if (!ledger) {
    // 旧路径（未声明身份通道，零行为差）：共享门（精确锚+容器归属闸）→ 非唯一硬阻断 → 文本锚点击。
    const container = (run.profile && run.profile.agents && run.profile.agents.itemContainer) || '.agent-item';
    const gate = await resolveAgentSearchTarget(run.page, { openName: target, containerSelector: container });
    if (gate.resolution !== 'unique') {
      run.blockers.push(`agent.searchOpen「${params.openName}」共享门裁定 ${gate.resolution}（candidateCount=${gate.candidateCount}）→ 硬阻断 fail-closed 不点（多匹配/缺席/容器外绝不 first）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    const r = await run.emit({ intentId: i, atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: params.openName, exact: true }, text: params.openName });
    // 后置条件（registry：provides 智能体详情已开）：「测试」按钮可见；仅本步 unique 才等（G2 失败步不堆等）。
    if (r.resolution === 'unique') await run.page.getByRole('button', { name: '测试' }).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    return;
  }

  // 身份双证路径。判定序修正（codex R1-M2）：先取信封终态，再采 DOM 物理卡片，二者一并交给
  // 纯函数门裁定——完整性先决优先于 DOM 分类，信封失败叠加 DOM 多卡必须 action_failed 不是 ambiguous。
  // 身份模块按需动态加载（poison spy 面：未声明路径零加载）。
  const { resolveDualIdentity } = await import('./agent-identity-gate.mjs');
  await ledger.settle(idToken, { timeoutMs: 5000 });
  ledger.seal(idToken);
  const envelope = ledger.consume(idToken);
  // 物理卡片双锚门（codex R1-H1）：同一卡片读 name+code、句柄留给点击——绝不全页重定位。
  const agents = run.profile && run.profile.agents ? run.profile.agents : {};
  const cardGate = await resolveAgentCardTarget(run.page, {
    mode: agents.identityMode,
    openName: target,
    containerSelector: agents.itemContainer,
    cardFields: agents.cardFields,
  });
  // 句柄出账（codex R3-H1）：命中卡 ElementHandle 成功/双证拒/点击失败全路径 finally 释放，
  // 不许持有到页面关闭（clickAgentCardWithin 只释放自建 name 子句柄，命中卡句柄的账在调用方）。
  try {
    const dual = resolveDualIdentity({
      mode: agents.identityMode,
      dom: { status: cardGate.resolution === 'container-out' ? 'failed' : cardGate.resolution, name: cardGate.name, code: cardGate.code },
      envelope,
      expected: { openName: target, code: typeof params.code === 'string' && params.code.trim() !== '' ? instantiate(params.code, run.ctx) : null },
    });
    // 结构化裁定出口（compile-report.identityGate）：硬阻断的类别可机器断言，不靠 blocker 文案。
    run.identityGateOutcome = { resolution: dual.resolution, reason: dual.reason ?? null };
    if (dual.resolution !== 'unique') {
      run.blockers.push(`agent.searchOpen「${params.openName}」双证门裁定 ${dual.resolution}（${dual.reason}）→ 硬阻断 fail-closed 不点（双证不齐绝不点击，DOM 唯一不豁免）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    // 句柄内点击（TOCTOU 封缝）：点击前同卡重验 connected/可见/name/code，任一不符按 action_failed。
    const r = await run.emit(
      { intentId: i, atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: params.openName, exact: true }, text: params.openName },
      async () => {
        const acted = await clickAgentCardWithin(cardGate.card, {
          mode: agents.identityMode,
          cardFields: agents.cardFields, name: dual.matched.name, code: dual.matched.code,
        });
        return acted
          ? { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } }
          : { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
      },
    );
    if (r.resolution !== 'unique') {
      run.identityGateOutcome = { resolution: 'action_failed', reason: 'card-click-revalidation-failed' };
      run.blockers.push(`agent.searchOpen「${params.openName}」句柄内点击重验失败 → 硬阻断 fail-closed（检查卡与点击卡必须同一物理句柄）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return;
    }
    // 观察行待 compileFlow 按 flow 步 provenance（sourceIntentId/candidateId/role）归档；evidenceStepId=终端 click。
    run.pendingIdentityObservation = { matched: dual.matched, evidenceStepId: r.stepId };
    // 后置条件（registry：provides 智能体详情已开）：「测试」按钮可见；仅本步 unique 才等（G2 失败步不堆等）。
    await run.page.getByRole('button', { name: '测试' }).waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  } finally {
    if (cardGate.card) await cardGate.card.dispose().catch(() => {});
  }
}

// C2 workflow source 读回武装（母规格 point 3；镜像 compileAgentSearchOpen 身份双证事务）──────────────
// 剖面声明 workflows.listApi（run.identityLedger=工作流通道账本，bin/compile.mjs 单通道保证）时：arm 冻结
// expectedQuery=工作流名 → 按 name 重查列表触发 workflows.listApi 信封 → settle/consume 完整性先决 → 物理卡片
// 双锚 DOM → resolveDualIdentity → 唯一才返回观察（source 侧，created-in-run→platform-readback），交调用方武装
// run.pendingIdentityObservation、compileFlow 归档 join 到 source binding。调用点已 gate（run.identityLedger &&
// profile.workflows.listApi），未声明身份通道零行为差。真列表搜索框/卡片类名/响应字段名 = route:human
// （profile.workflows 配置面占位，GRILL D4 先采不猜）；行为端到端真证 = loop 浏览器金牌（workflow-sut fixture）——
// 本函数体不被任何 hermetic 金牌执行（无夹具设 profile.workflows.listApi，compile-channel 金牌在 launch 前哨即短路）。

export async function compileAgentOpenTestPanel(run) {
  const i = run.newIntent();
  // 真机实证（chief-bringup 彩排）：详情页仍在加载时点「测试」会被重渲染间歇吞掉——networkidle 前置
  // + 点空重点（regress 全款搬回；原 GRILL D6「不搬自愈」被真机证伪、修订记档）。重点属编译期采集
  // 自愈、不产 event；回放期单击吞点风险由 fail-safe 兜（NEEDS_HUMAN 绝不假绿），挂账真机观察。
  // 有界（codex bring-up R1）：networkidle 对带背景轮询的 SPA 可能永不达成（CONTEXT 既有定论）——
  // 5s 上界后放行点击，靠点空重点兜底；无界等待会复活「看门狗先于诊断死」的病。
  await run.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  const r = await run.emit({ intentId: i, atom: 'agent.openTestPanel', action: 'click', semantic: { kind: 'role', role: 'button', name: '测试', exact: true }, text: '测试' });
  // 仅本步 unique 才等（G2 失败步不堆等）。
  if (r.resolution === 'unique') {
    const msgBox = run.page.getByRole('textbox', { name: '请输入消息' }); // 非 exact：真名带省略号
    try {
      await msgBox.first().waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      run.notes.push('openTestPanel 首击被吞（真机间歇性），编译期采集自愈重点一次（不产 event）');
      if (!(await run.admitPageOrigin('agent.openTestPanel 重点前'))) return;
      try {
        await run.page.getByRole('button', { name: '测试' }).first().click({ timeout: 3000 });
      } catch { /* 后续步计数如实暴露 */ }
      if (!(await run.admitPageOrigin('agent.openTestPanel 重点后'))) return;
      await msgBox.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }
  }
}

// regress agent_tool_add 首纵切：配方由 lib/agent-tool-compile.mjs 单点生成，编译与回放共用
// lib/agent-tool-actions.mjs 的专用动作身份门。未真机复核前只产候选 events，行为状态仍 route:human。
export async function compileAgentToolRecipe(run, atom, params) {
  let recipes;
  try {
    recipes = buildAgentToolAtomEvents(atom, params, run.agentToolState);
  } catch {
    run.blockers.push(`${atom} 参数或前序状态非法 → 硬阻断（fail-closed，route:human）`);
    run.notes.push(run.blockers[run.blockers.length - 1]);
    return [];
  }
  // C3 破坏性/targeting 原子（agent.delete / agent.confirmToolPicker / picker.selectFirstTool）编译期连续性守卫
  // （Steven 2026-07-24 (A)；codex round-3 Critical 收口）：真 performAction 破坏 recipe【之前】按 platformId 唯一命中的
  // 身份观察铸目标连续性 ref（agent.delete 目标观察由前序 agent.searchOpen 采集）；铸不出 → 硬阻断、绝不裸执行破坏 recipe
  // （fail-closed，route:human 补破坏链身份采集）。绝不「破坏后补铸」（旧实现循环结束才铸 ref = 零保护 fail-open）。
  if (requiresTargetContinuityRef(atom)) {
    const armed = armDestructiveTargetContinuity(run, atom, params.name ?? params.toolName ?? params.under ?? null);
    if (!armed || !armed.ok) {
      run.blockers.push(`${atom} 目标连续性 ref 铸造失败（无唯一 platformId 身份观察）→ 破坏动作硬阻断、绝不裸执行（fail-closed，route:human 补破坏链身份采集）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
      return [];
    }
  }
  const intentId = run.newIntent();
  const results = [];
  for (let index = 0; index < recipes.length; index += 1) {
    let recipe = recipes[index];
    // 新增智能体可能是“按钮直开抽屉”或“按钮→菜单项”两种布局；仅当首击后抽屉未开才落菜单项事件。
    if (atom === 'agent.create' && index === 1) {
      const drawerOpen = await run.page.locator('.hr-drawer.hr-drawer--open:visible').count().catch(() => 0);
      if (drawerOpen === 1) continue;
    }
    // agent 列表路由以当前通道剖面为准；冻结 spec 只留 {{baseUrl}}+非凭据路径段。
    if (atom === 'agent.delete' && recipe.action === 'nav') {
      const route = run.agentListRoute || '/agent/list';
      recipe = { ...recipe, url: `{{baseUrl}}${route}` };
    }
    // 删除确认文本从本次因果弹层实采，拒用全页最后一个按钮。
    if (atom === 'agent.delete' && recipe.action === 'click' && recipe.text === '确定') {
      const inspected = await inspectWorkflowDeleteConfirm(run.page);
      if (inspected.resolution !== 'unique' || !inspected.confirmName) {
        run.blockers.push('agent.delete 因果确认弹层内确认按钮非唯一/缺席 → 硬阻断（fail-closed，route:human）');
        run.notes.push(run.blockers[run.blockers.length - 1]);
        return results;
      }
      recipe = { ...recipe, text: inspected.confirmName };
    }
    const spec = { intentId, ...recipe };
    const result = isAgentToolSpecialAction(spec)
      ? await run.emit(spec, () => performAgentToolAction(run.page, spec, run.ctx))
      : await run.emit(spec);
    results.push(result);
  }
  // （目标连续性 ref 已在破坏 recipe 前武装并把关，见函数开头守卫；此处不再破坏后补铸。）
  return results;
}

// C3 目标连续性 ref 武装：破坏性/targeting 原子编译处，由 run.identityObservations 里匹配目标名的观察铸 ref
// （携 platformId），经 mintDestructiveTargetContinuity 补 profile 指纹/scope/请求关联/步序——【非按名再生成预期值】，
// platformId 恒取自观察。加法式、gated：无匹配观察或缺必填 → 不武装（当前 hermetic 删除用例字节零漂移；
// 破坏性目标的 observation 由删除链身份采集补齐属 C2/C3 集成，其真机形态走 route:human）。
export function armDestructiveTargetContinuity(run, atom, name) {
  if (!requiresTargetContinuityRef(atom)) return null;
  const targetName = name == null ? null : instantiate(name, run.ctx);
  if (targetName == null) return null;
  // High-2：按目标名【唯一】命中带 platformId 的观察，同名多条即不武装（绝不取 first）——把「同名不取 first」
  // 落到铸 ref 的观察选取处（0 命中=当前 hermetic 删除用例常态，零漂移；>1 命中=毒化面，fail-closed 不武装）。
  // codex round-5 Critical【跨 kind 绕过】收口：按破坏原子的目标实体 kind（destructiveTargetKind）跨 kind 硬闸选观察——
  // 同名但 kind 不符的观察绝不入选、更不得铸错目标 ref（防同名 agent 观察给 workflow.deleteByName 铸 ref → 错目标真删）。
  const boundKind = destructiveTargetKind(atom);
  if (boundKind == null) return null; // 破坏原子无从判定目标 kind → fail-closed 不武装（requires 集恒有 kind，此为防御纵深）
  const selected = selectObservationForDestructiveTarget({ observations: run.identityObservations || [], targetName, boundKind });
  if (!selected.ok) {
    if (selected.reason === 'OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME') {
      run.notes.push(`C3 破坏性目标连续性：同名观察多条（${targetName}）→ 不取 first、不武装 ref（fail-closed，route:human 甄别真目标）`);
    }
    return null;
  }
  const observation = selected.observation;
  const listApi = run.profile && run.profile.agents && run.profile.agents.listApi;
  const minted = mintDestructiveTargetContinuity(observation, {
    profileFingerprint: run.identityProfileDigest || null,
    scope: (listApi && listApi.pathname) || run.listRoute || null,
    requestCorrelationId: `corr-${atom}-${run.identityObservations.indexOf(observation)}`,
    stepOrder: run.events.length,
  });
  if (minted && minted.ok) run.targetContinuityRefs.push({ atom, targetName, ref: minted.ref });
  return minted;
}

export async function compileAgentCreate(run, params) {
  const results = await compileAgentToolRecipe(run, 'agent.create', params);
  if (!results.length || results.some((result) => result.resolution !== 'unique')) return;
  const path = (() => { try { return new URL(run.page.url()).pathname; } catch { return ''; } })();
  if (!path.includes('/agent/detail')) {
    run.blockers.push('agent.create 后置 URL 未进入 /agent/detail → 硬阻断（fail-closed，route:human）');
    run.notes.push(run.blockers[run.blockers.length - 1]);
  }
}

export async function compileAgentOpenToolPicker(run, params) {
  await compileAgentToolRecipe(run, 'agent.openToolPicker', params);
}

export async function compilePickerSearch(run, params) {
  const results = await compileAgentToolRecipe(run, 'picker.search', params);
  if (!results.length || results.some((result) => result.resolution !== 'unique')) return;
  if (params.expectCount !== undefined) {
    const panels = run.page.locator('.hr-dialog:visible').filter({ hasText: '仅显示已选' }).locator('.hr-collapse-panel:visible');
    const count = await panels.count().catch(() => null);
    if (count !== params.expectCount) {
      run.blockers.push(`picker.search 后置一级卡片数不符（期望 ${params.expectCount}，实际 ${count == null ? '证不出' : count}）→ 硬阻断（route:human）`);
      run.notes.push(run.blockers[run.blockers.length - 1]);
    }
  }
}

export async function compilePickerExpandPrimary(run, params) {
  await compileAgentToolRecipe(run, 'picker.expandPrimary', params);
}

export async function compilePickerSelectFirstTool(run, params) {
  await compileAgentToolRecipe(run, 'picker.selectFirstTool', params);
}

export async function compileAgentConfirmToolPicker(run, params) {
  await compileAgentToolRecipe(run, 'agent.confirmToolPicker', params);
}

export async function compileAgentDelete(run, params) {
  await compileAgentToolRecipe(run, 'agent.delete', params);
}

export async function compileChatSendAndWait(run, params) {
  const i = run.newIntent();
  recordPersistentActionEvidence(run, {
    atom: 'chat.sendAndWait', status: 'NOT_ATTEMPTED', stage: 'input-preparation',
  });
  const streamUrlPattern = params.streamUrlPattern || CHAT_STREAM_ROUTE;
  const replySelector = params.replySelector || CHAT_REPLY_SELECTOR;
  // reply 陈迹基线（codex R1-F3，同构 bin/replay.mjs）：只在「新气泡出现或末泡文本变化」时回填，
  // 旧气泡陈迹绝不当新回复；基线证不出则不回填（fail-safe）。
  let replyBase = null;
  try {
    const bl = run.page.locator(replySelector);
    const bn = await bl.count();
    replyBase = { n: bn, text: bn ? await bl.last().innerText({ timeout: 500 }) : null };
  } catch { replyBase = null; }
  const MSG = { kind: 'role', role: 'textbox', name: '请输入消息', exact: false }; // 真名「请输入消息...」带省略号（真机实采），exact 必 0 命中
  await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'fill', semantic: MSG, value: params.prompt });
  // keydown 触发垫（GRILL D3，Steven 拍板）：fill 不触发 keydown、发送钮保持 disabled（regress 真机实测）；
  // Space+Backspace 发 keydown、终文本不变，全在冻结 events 枚举内、确定性可复放。
  await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'press', key: 'Space', semantic: MSG });
  await run.emit({ intentId: i, atom: 'chat.sendAndWait', action: 'press', key: 'Backspace', semantic: MSG });
  const recMark = run.forensics.records().length;
  recordPersistentActionEvidence(run, {
    atom: 'chat.sendAndWait', status: 'NOT_ATTEMPTED', stage: 'before-click-call',
  });
  const clickR = await run.emit(
    { intentId: i, atom: 'chat.sendAndWait', action: 'click', fallbackCss: params.sendIconSelector || CHAT_SEND_ICON },
    undefined,
    { persistentActionBoundary: true },
  );
  // 流等待（地面真值采集；codex R1-F2 同构收紧）：只等本次点击后新增、命中 streamUrlPattern 的流
  // 走到 finished（或 30s 上界）；5s 内没开流即证不出、不干等（背景/历史长流绝不拖本步）。
  // 点击未成不等（G2 失败步不堆等）。
  if (clickR.resolution === 'unique') {
    if (clickR.acted === true) recordPersistentActionEvidence(run, {
      atom: 'chat.sendAndWait', status: 'CONFIRMED', stage: 'waiting-for-reply',
    });
    const swT = Date.now();
    for (;;) {
      const mine = run.forensics.records().slice(recMark).filter((r) => r.type === 'EventSource' && String(r.url).includes(streamUrlPattern));
      if (mine.length && mine.every((r) => r.streamFinished === true)) break;
      if (!mine.length && Date.now() - swT > 5000) break;
      if (Date.now() - swT > 30000) break;
      await sleep(200);
    }
  }
  const replyText = clickR.resolution === 'unique' ? await waitReplyStableCompile(run.page, replySelector) : null;
  // 回填本原子代表步 observed 的 replyText/replyStreamUrl（schema 字段既有、此前恒 null；GRILL D5）。
  const last = run.observed[run.observed.length - 1];
  if (last) {
    const n = await run.page.locator(replySelector).count().catch(() => 0);
    const changed = replyBase != null && replyText != null && (n > replyBase.n || replyText !== replyBase.text);
    last.replyText = changed ? replyText : null;
    const streamRec = run.forensics.records().slice(recMark).filter((r) => String(r.url).includes(streamUrlPattern)).slice(-1)[0];
    last.replyStreamUrl = streamRec ? requestLogPath(streamRec.url) : null;
  }
}

export async function compileChatCloseTestPanel(run) {
  const i = run.newIntent();
  await run.emit({ intentId: i, atom: 'chat.closeTestPanel', action: 'click', fallbackCss: CHAT_DRAWER_CLOSE });
}

// workflow.create：拆两 intent（进列表 + 新增）——对齐重表达清单草稿一。
