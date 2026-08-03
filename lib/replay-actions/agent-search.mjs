import { instantiate } from '../instantiate.mjs';

export async function doAgentSearchOpen(page, ev, ctx, identityGate) {
  const {
    resolveAgentSearchTarget,
    resolveAgentCardTarget,
    clickAgentCardWithin,
  } = identityGate;
  const raw = ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : (typeof ev.text === 'string' ? ev.text : null);
  const name = raw == null ? null : instantiate(raw, ctx);
  if (!name || name.trim() === '') return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  // 身份双证路径（agent-id-readback plan §5；账本只随 v2 冻结权威激活，codex R1-M3）。判定序修正
  // （codex R1-M2）：先取信封终态，再采 DOM 物理卡片，一并交纯函数门——完整性先决优先于 DOM 分类。
  if (ctx && ctx.identityLedger) {
    const token = ctx.identityTokens ? ctx.identityTokens.get(ev.intentId) : null;
    if (!token) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
    // 已签三元组是 v2 回放的硬先决（codex R1-H5）：目标 click 缺 signed 期望=立即 action_failed，
    // 绝不按编译首采模式继续（首采语义只属于 compile，回放期一律对签比对）。
    const signed = ctx.identityExpectedByStep ? ctx.identityExpectedByStep.get(ev.stepId) : null;
    if (!signed) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
    const { resolveDualIdentity } = await import('../agent-identity-gate.mjs');
    await ctx.identityLedger.settle(token, { timeoutMs: 5000 });
    ctx.identityLedger.seal(token);
    const envelope = ctx.identityLedger.consume(token);
    // 消费即出账到调用方层（codex R3-M1）：账本 consume 已一次性，调用方 Map 不得继续强持已消费 token。
    if (ctx.identityTokens) ctx.identityTokens.delete(ev.intentId);
    const agents = (ctx.profile && ctx.profile.agents) || {};
    const cardGate = await resolveAgentCardTarget(page, {
      mode: agents.identityMode,
      openName: name, containerSelector: agents.itemContainer, cardFields: agents.cardFields,
    });
    // 句柄出账（codex R3-H1）：命中卡 ElementHandle 成功/双证拒/点击失败全路径 finally 释放，
    // 不许持有到页面关闭（clickAgentCardWithin 只释放自建 name 子句柄，命中卡句柄的账在调用方）。
    try {
      const dual = resolveDualIdentity({
        mode: agents.identityMode,
        dom: { status: cardGate.resolution === 'container-out' ? 'failed' : cardGate.resolution, name: cardGate.name, code: cardGate.code },
        envelope,
        expected: { openName: name, ...signed },
      });
      if (dual.resolution !== 'unique') {
        const mapped = dual.resolution === 'ambiguous' ? 'ambiguous' : 'action_failed';
        return { resolution: mapped, candidateCount: cardGate.candidateCount, identityReadback: { ok: false } };
      }
      // 句柄内点击（codex R1-H1 TOCTOU 封缝）：点击前同卡重验、句柄内落笔，绝不全页 getByText 重定位。
      const acted = await clickAgentCardWithin(cardGate.card, {
        mode: agents.identityMode,
        cardFields: agents.cardFields, name: dual.matched.name, code: dual.matched.code,
      });
      if (!acted) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
      return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
    } finally {
      if (cardGate.card) await cardGate.card.dispose().catch(() => {});
    }
  }
  // 旧路径（v1 件/未声明身份通道，零行为差）：共享门 + 文本锚点击。
  const container = (ctx && ctx.profile && ctx.profile.agents && ctx.profile.agents.itemContainer) || '.agent-item';
  const gate = await resolveAgentSearchTarget(page, { openName: name, containerSelector: container });
  if (gate.resolution === 'ambiguous') return { resolution: 'ambiguous', candidateCount: gate.candidateCount, identityReadback: { ok: false } };
  if (gate.resolution !== 'unique') return { resolution: 'none', candidateCount: gate.candidateCount, identityReadback: { ok: false } };
  try { await page.getByText(name, { exact: true }).click({ timeout: 10000 }); } catch {
    return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  }
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
}

// workflow.bindAgent 回放专用门（entity-ui-wiring W2）：单事件（选中智能体）；触发器展开是条件步
// （与编译配方同刻——编译侧同样不为展开产 event）。触发器域锁可见恰一；选项多匹配 ambiguous 绝不 first、
// 缺席 none、选中值【精确】回读不等即 action_failed（fail-closed）。

// bindAgent 选中值物理回读（codex R3-H2 同刻助手）：只在已绑定触发器物理句柄内查询可见 `.agent-bind-select__value`，
// 可见判据与 nodeDrawerDomain 同口径（computedStyle + 非零盒），恰一才返回文本，否则 null（证不出）。
