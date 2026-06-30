// 断言轴评估（相3/4 page 上下文执行）：每条 typed 断言算 ok；verdict 对 kind 不可知、只消费 ok/soft（护栏 #17）。
// 未实现 / 证不出的 kind 一律 ok:false（fail-safe，绝不静默判真）。
export function evaluateAssertions(assertions, c) {
  return (assertions || []).map((a) => ({ kind: a.kind, op: a.op, value: a.value, soft: a.soft === true, ok: evalOne(a, c) }));
}

function evalOne(a, c) {
  const net = c.netRecords || [];
  switch (a.kind) {
    case 'noErrorEnvelope': {
      // 本 intent 的关键写请求（save）信封 ok。无信封记录 → 证不出 → false。
      const rec = net.find((n) => n.errorEnvelope != null && /saveOrModifyProcessData/.test(n.url));
      return !!(rec && rec.errorEnvelope.ok === true);
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
      const d = (c.countAfter || 0) - (c.countBefore || 0);
      if (a.op === 'up') return a.value == null ? d > 0 : d === Number(a.value);
      if (a.op === 'down') return a.value == null ? d < 0 : d === -Number(a.value);
      if (a.op === 'equals') return (c.countAfter || 0) === Number(a.value);
      return false;
    }
    case 'noPageError': return c.pageErrored !== true;
    case 'noErrorToast': return c.errorToast !== true;
    default: return false;
  }
}
