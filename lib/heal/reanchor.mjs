// lib/heal/reanchor.mjs —— S2 零 LLM 确定性重锚提案（纯数据、零 IO、零浏览器、零 LLM）。
//
// GRILL D9「写读同形」：产出的语义锚必须是回放器**实际消费**的定位形状，照抄现役消费面，
// 不发明新形状。实现前已逐字对照三处现役事实源（对照笔记见下），本模块只做形状搬运：
//
//   ① 回放消费面 lib/replay-actions.mjs::semanticLocator —— 只认
//        semantic.kind==='role' → page.getByRole(role, { name, exact })
//        semantic.kind==='label'/'text'、ev.role+ev.accessibleName、ev.fieldLabel 为兜底分支。
//      故重锚一律落 strategy:'role'（语义策略），绝不退化 coord/css。
//   ② 探针面 lib/drift-probe.mjs —— 规范签名 `role=<role>|name=<name>|withinRow=<targetName>`，
//      只读定位形是「targetName 所在 row 内的 role+name 元素」：
//        page.getByRole('row', { name: /targetName/ }).getByRole(role, { name })
//      重锚后的 within 语境必须保留这一层行限定（D9 明令 withinRow 不得丢）。
//   ③ 已冻接缝 tests/_golden/fixtures/seams/drift-patch.fixture.json + schemas/drift-patch.schema.json ——
//      locatorAfter 形如 { strategy:'role', role, accessibleName, within:'row:has-text("…")', raw }；
//      locator 的 additionalProperties:false，字段只能取 schema 白名单内的键。
//
// 补丁字节由现役纯函数 lib/drift-patch.mjs::buildDriftPatch 构造（P5 已落地、产物符合已冻
// schema），本模块不复刻它的不变量校验（稳定签名 before===after / 不得退化 coord / 正向探针
// 三件），只补它拿不到的两处上下文：真实 events 路径与真实事件下标。

import { buildDriftPatch } from '../drift-patch.mjs';

/** 规范签名串 → { role, name, withinRow }；形状不符回 null（fail-closed，不猜）。 */
export function parseCanonical(canonical) {
  const m = /^role=(.*)\|name=(.*)\|withinRow=(.*)$/.exec(String(canonical || ''));
  if (!m) return null;
  return { role: m[1], name: m[2], withinRow: m[3] };
}

/** 现役（录制期）定位形：由准入门确证的纯语义定位对直译，不夹带未投影字段。 */
export function locatorBeforeOf({ role, accessibleName }) {
  return {
    strategy: 'role',
    role,
    accessibleName,
    raw: `page.getByRole('${role}', { name: '${accessibleName}', exact: true })`,
  };
}

/** 重锚后的定位形：探针只读确证的「行内唯一同签名元素」，withinRow 语境保留在 within 里。 */
export function locatorAfterOf({ role, name, withinRow }) {
  return {
    strategy: 'role',
    role,
    accessibleName: name,
    within: `row:has-text("${withinRow}")`,
    raw: `page.getByRole('row', { name: /${withinRow}/ }).getByRole('${role}', { name: '${name}' })`,
  };
}

/** 稳定签名构成（schema $defs/signature 白名单：role/accessibleName/semanticName）。 */
function signatureOf({ role, name }) {
  return { role, accessibleName: name, semanticName: '' };
}

/** 定位等价判据：忽略仅供人读的 raw，其余定位字段逐字节同 → 重锚无实质变化。 */
export function locatorsEquivalent(a, b) {
  const norm = (l) => {
    const { raw, ...rest } = l || {};
    return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
  };
  return norm(a) === norm(b);
}

/** events 底座指纹（对齐 drift-patch.fixture 的 `recordedAt=…|length=…` 形）。 */
function fingerprintOf(eventsDoc) {
  const recordedAt = typeof eventsDoc.recordedAt === 'string' ? eventsDoc.recordedAt : '';
  return `recordedAt=${recordedAt}|length=${eventsDoc.events.length}`;
}

/**
 * 产出单步重锚补丁（proposed 态，人签前原 spec 一字不动）。
 * 入参全部来自上游既有事实（准入门的 target + CLI 的路径与 ts），自愈不二次推断裁定。
 *
 * 回 { noop:true, reason:'HEAL_REANCHOR_NOOP', detail } —— 与现役定位等价，无可重锚之处；
 *    { noop:false, patch }                            —— 待落盘的补丁对象。
 */
export function proposeReanchor({ target, verdictPath, eventsPath, eventsDoc, tsToken }) {
  const sig = parseCanonical(target.canonical);
  if (!sig) {
    // 准入门已确证 canonical 与 events 重算一致，走到这里说明上游契约被破坏 —— fail-closed。
    throw new Error('reanchor: 规范签名形状不可解析（探针面契约被破坏）');
  }
  const locatorBefore = locatorBeforeOf({ role: target.role, accessibleName: target.accessibleName });
  const locatorAfter = locatorAfterOf(sig);
  if (locatorsEquivalent(locatorBefore, locatorAfter)) {
    return {
      noop: true,
      reason: 'HEAL_REANCHOR_NOOP',
      detail: '重锚结果与现役定位等价，无可自愈的定位漂移',
    };
  }

  const probe = target.axesStep.action.driftProbe;
  const patch = buildDriftPatch({
    verdictStep: {
      stepId: target.stepId,
      intentId: target.intentId,
      atom: target.atom,
      verdict: 'HARNESS_ERROR',
      reason: target.verdictStep.reason == null ? null : target.verdictStep.reason,
      caseId: eventsDoc.caseId,
      verdictPath,
      channel: typeof eventsDoc.channel === 'string' ? eventsDoc.channel : 'web',
    },
    driftProbe: probe,
    locatorBefore,
    locatorAfter,
    stableSignature: {
      canonical: target.canonical,
      before: signatureOf(sig),
      after: signatureOf(sig),
    },
    tsToken,
  });

  // buildDriftPatch 只知道约定路径与 atstep_i 序号；这里补真实底座事实（S4 应用时按此改写）。
  patch.specTarget = {
    eventsPath,
    eventIndex: target.eventIndex,
    fingerprintBefore: fingerprintOf(eventsDoc),
  };
  return { noop: false, patch };
}
