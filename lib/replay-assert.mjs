// 断言轴评估（相3/4 page 上下文执行）：每条 typed 断言算 ok；verdict 对 kind 不可知、只消费 ok/soft（护栏 #17）。
// 未实现 / 证不出的 kind 一律 ok:false（fail-safe，护栏 #14：证不出绝不判真）。

// 已实现 kind 集（p4-drafter D2 消费：不在此集的草拟断言标 soft、补实现后重签提 hard）。
// 与下方 evalOne 的 case 分支一一对应——新实现一种 kind，这里同步加一行（唯一供源，别处不建副本）。
export const IMPLEMENTED_KINDS = new Set(['noErrorEnvelope', 'urlPathname', 'streamReplyReceived', 'countChange', 'noPageError']);

export function evaluateAssertions(assertions, c) {
  return (assertions || []).map((a) => ({ kind: a.kind, op: a.op, value: a.value, soft: a.soft === true, ok: evalOne(a, c) }));
}

function evalOne(a, c) {
  const net = c.netRecords || [];
  switch (a.kind) {
    case 'noErrorEnvelope': {
      // 缺席语义（noerrenv-absence 人签修正 2026-07-02，镜像 noPageError 范式）：本步归因记录中
      // 不存在坏信封（ok===false）即过；零信封记录 = 无错可言 = 过。坏信封归因本步必败
      // （inject500 / HTTP200 软失败方向不变）。原实现硬编码 /saveOrModifyProcessData/ 是
      // p5 假 SUT 夹具捷径——真机无该请求的步必假败（相2 首航实证 3/4 步 NEEDS_HUMAN）。
      return !net.some((n) => n.errorEnvelope != null && n.errorEnvelope.ok === false);
    }
    case 'urlPathname': {
      const p = c.urlPath || '';
      if (a.op === 'startsWith') return typeof a.value === 'string' && p.startsWith(a.value);
      if (a.op === 'matches') { try { return new RegExp(a.value).test(p); } catch { return false; } }
      return false;
    }
    case 'streamReplyReceived': {
      const s = net.find((n) => /streamReply/.test(n.url) && n.streamFinished === true);
      return !!(s && (a.value == null || Number(s.streamStatus) === Number(a.value)));
    }
    case 'countChange': {
      // 计数采集失败（null=未知）一律证不出 → false（fail-safe，finding 7）。
      const before = c.countBefore, after = c.countAfter;
      if (a.op === 'equals') return after != null && after === Number(a.value);
      if (before == null || after == null) return false;
      const d = after - before;
      if (a.op === 'up') return a.value == null ? d > 0 : d === Number(a.value);
      if (a.op === 'down') return a.value == null ? d < 0 : d === -Number(a.value);
      return false;
    }
    case 'noPageError':
      // 按本 intent 归因的 pageerror 判（非全局布尔，finding 4）。
      return (c.pageErrors || []).length === 0;
    // 其余 kind（noErrorToast / textVisible / textHidden / inputReadback / dropdownReadback /
    //   requiredFilled / replyContains / replyMatches / buttonState / switchState）尚未在 P5 命令化层实现：
    //   一律 fail-safe ok=false（证不出绝不判真，护栏 #14）；真实现属相3/4 + tier-2 route:human 的后续加法。
    default:
      return false;
  }
}
