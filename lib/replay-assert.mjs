// 断言轴评估（相3/4 page 上下文执行）：每条 typed 断言算 ok；verdict 对 kind 不可知、只消费 ok/soft（护栏 #17）。
// 未实现 / 证不出的 kind 一律 ok:false（fail-safe，护栏 #14：证不出绝不判真）。

// 已实现 kind 集（p4-drafter D2 消费：不在此集的草拟断言标 soft、补实现后重签提 hard）。
// 与下方 evalOne 的 case 分支一一对应——新实现一种 kind，这里同步加一行（唯一供源，别处不建副本）。
// kinds-harden（2026-07-02）：+textVisible/+noErrorToast（5→7，采集见 bin/replay.mjs 代表步静默点）。
export const IMPLEMENTED_KINDS = new Set(['noErrorEnvelope', 'urlPathname', 'streamReplyReceived', 'countChange', 'noPageError', 'textVisible', 'noErrorToast']);

// noErrorToast 词表（GRILL G1 人签取词表判）：实采 toast 文本命中即错误弹窗在场。
// 结构类名判留观察挂账（真机错误形态采样 route:human 后收紧）。
const ERROR_TOAST_RE = /失败|错误|异常/;

export function evaluateAssertions(assertions, c) {
  // actual 回填（report-fidelity G3，加性）：每条带标量实测值供报告「期望对实际」；未实现 kind 恒 null 不硬凑。
  return (assertions || []).map((a) => {
    const r = evalOne(a, c);
    return { kind: a.kind, op: a.op, value: a.value, soft: a.soft === true, ok: r.ok, actual: r.actual ?? null };
  });
}

// 每分支返回 { ok, actual }：ok 判定语义与历史一字不变；actual 是该 kind 的标量实测锚
// （urlPathname→实测 pathname / countChange→before→after / 取证类→归因计数 / 流→状态码）。
function evalOne(a, c) {
  const net = c.netRecords || [];
  switch (a.kind) {
    case 'noErrorEnvelope': {
      // 缺席语义（noerrenv-absence 人签修正 2026-07-02，镜像 noPageError 范式）：本步归因记录中
      // 不存在坏信封（ok===false）即过；零信封记录 = 无错可言 = 过。坏信封归因本步必败
      // （inject500 / HTTP200 软失败方向不变）。原实现硬编码 /saveOrModifyProcessData/ 是
      // p5 假 SUT 夹具捷径——真机无该请求的步必假败（相2 首航实证 3/4 步 NEEDS_HUMAN）。
      const bad = net.filter((n) => n.errorEnvelope != null && n.errorEnvelope.ok === false).length;
      return { ok: bad === 0, actual: bad };
    }
    case 'urlPathname': {
      const p = c.urlPath || '';
      if (a.op === 'startsWith') return { ok: typeof a.value === 'string' && p.startsWith(a.value), actual: p };
      if (a.op === 'matches') { try { return { ok: new RegExp(a.value).test(p), actual: p }; } catch { return { ok: false, actual: p }; } }
      return { ok: false, actual: p };
    }
    case 'streamReplyReceived': {
      const s = net.find((n) => /streamReply/.test(n.url) && n.streamFinished === true);
      const actual = s && s.streamStatus != null ? Number(s.streamStatus) : null;
      return { ok: !!(s && (a.value == null || Number(s.streamStatus) === Number(a.value))), actual };
    }
    case 'countChange': {
      // 计数采集失败（null=未知）一律证不出 → false（fail-safe，finding 7）。
      const before = c.countBefore, after = c.countAfter;
      const actual = `${before ?? 'null'}→${after ?? 'null'}`;
      if (a.op === 'equals') return { ok: after != null && after === Number(a.value), actual };
      if (before == null || after == null) return { ok: false, actual };
      const d = after - before;
      if (a.op === 'up') return { ok: a.value == null ? d > 0 : d === Number(a.value), actual };
      if (a.op === 'down') return { ok: a.value == null ? d < 0 : d === -Number(a.value), actual };
      return { ok: false, actual };
    }
    case 'noPageError': {
      // 按本 intent 归因的 pageerror 判（非全局布尔，finding 4）。
      const n = (c.pageErrors || []).length;
      return { ok: n === 0, actual: n };
    }
    case 'textVisible': {
      // 代表步静默点采的命中计数（bin/replay.mjs 现场采：getByText + toast 文本双通道）。
      // 缺采集（上下文无该值条目）= 证不出 → false/null（护栏 #14）。
      const hits = c.textHits ? c.textHits[a.value] : undefined;
      if (typeof hits !== 'number') return { ok: false, actual: null };
      return { ok: hits > 0, actual: hits };
    }
    case 'noErrorToast': {
      // 词表判（G1 人签）：代表步静默点实采 toast 文本命中 失败|错误|异常 即败；
      // actual 携实采文本串（；连接）供人核，脱敏由装配器既有通道管。缺采集 = 证不出。
      const toasts = c.toastTexts;
      if (!Array.isArray(toasts)) return { ok: false, actual: null };
      const bad = toasts.filter((t) => ERROR_TOAST_RE.test(String(t)));
      return { ok: bad.length === 0, actual: toasts.join('；') };
    }
    // 其余 kind（textHidden / inputReadback / dropdownReadback / requiredFilled /
    //   replyContains / replyMatches / buttonState / switchState）尚未实现：
    //   一律 fail-safe ok=false（证不出绝不判真，护栏 #14）、actual=null（不硬凑）；真实现属后续加法。
    default:
      return { ok: false, actual: null };
  }
}
