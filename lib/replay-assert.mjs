// 断言轴评估（相3/4 page 上下文执行）：每条 typed 断言算 ok；verdict 对 kind 不可知、只消费 ok/soft（护栏 #17）。
// 未实现 / 证不出的 kind 一律 ok:false（fail-safe，护栏 #14：证不出绝不判真）。

// 已实现 kind 集（p4-drafter D2 消费：不在此集的草拟断言标 soft、补实现后重签提 hard）。
// 与下方 evalOne 的 case 分支一一对应——新实现一种 kind，这里同步加一行（唯一供源，别处不建副本）。
// kinds-harden（2026-07-02）：+textVisible/+noErrorToast（5→7，采集见 bin/replay.mjs 代表步静默点）。
// chiefcomplaint-smoke（2026-07-03，GRILL D1）：+replyContains/+replyMatches/+textHidden（7→10，
// reply 走 DOM 气泡通道 replyText、textHidden 复用 textHits 采集）。
// wf-publish-states（2026-07-03，GRILL D1/D2）：+buttonState（10→11，present/absent 双 op；
// 采集 = buttonHits 双通道合计，见 bin/replay.mjs 代表步静默点）。
export const IMPLEMENTED_KINDS = new Set(['noErrorEnvelope', 'urlPathname', 'streamReplyReceived', 'countChange', 'noPageError', 'textVisible', 'noErrorToast', 'replyContains', 'replyMatches', 'textHidden', 'buttonState']);

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
      // 缺 value 必拒（compile-caseid-shape 收口，同 replyMatches 缝）：new RegExp(undefined) 空正则匹配一切（护栏 #14）。
      if (a.op === 'matches') {
        if (typeof a.value !== 'string' || !a.value) return { ok: false, actual: p };
        try { return { ok: new RegExp(a.value).test(p), actual: p }; } catch { return { ok: false, actual: p }; }
      }
      return { ok: false, actual: p };
    }
    case 'streamReplyReceived': {
      // URL 谓词普化（GRILL D1）：通道剖面 profile.chat.streamUrlPattern 命中 或 legacy /streamReply/
      // 命中（加法兼容 p5 冻结夹具）；原写死 /streamReply/ 对真机流接口必假败（挂账兑现）。
      const isStream = (u) => (typeof c.streamUrlPattern === 'string' && c.streamUrlPattern && String(u).includes(c.streamUrlPattern)) || /streamReply/.test(u);
      const s = net.find((n) => isStream(n.url) && n.streamFinished === true);
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
    case 'textHidden': {
      // 缺席断言（GRILL D4 推荐映射负向语义）：代表步静默点全视图命中数为 0 才过；
      // 复用 textVisible 的 textHits 采集通道（bin/replay.mjs 采集循环已扩到本 kind 的值）。
      const hits = c.textHits ? c.textHits[a.value] : undefined;
      if (typeof hits !== 'number') return { ok: false, actual: null };
      return { ok: hits === 0, actual: hits };
    }
    case 'replyContains': {
      // reply 正文断言（GRILL D5：DOM 气泡通道）：代表步静默点采的 replyText 含 value 即过；
      // actual 携实采回复（截 300 字符）供人核。缺采集 = 证不出。
      if (typeof c.replyText !== 'string') return { ok: false, actual: null };
      const actual = c.replyText.slice(0, 300);
      return { ok: typeof a.value === 'string' && c.replyText.includes(a.value), actual };
    }
    case 'replyMatches': {
      if (typeof c.replyText !== 'string') return { ok: false, actual: null };
      const actual = c.replyText.slice(0, 300);
      // 缺 value 必拒（codex R1-F1）：new RegExp(undefined) 是空正则匹配一切——证不出绝不判真（护栏 #14）。
      if (typeof a.value !== 'string' || !a.value) return { ok: false, actual };
      try { return { ok: new RegExp(a.value).test(c.replyText), actual }; } catch { return { ok: false, actual }; }
    }
    case 'buttonState': {
      // 按钮存在性（wf-publish-states GRILL D2）：代表步静默点采的按钮命中合计（role 必采 +
      // profile.buttons.extraSelector 可选补采、双通道可见性口径，见 bin/replay.mjs）。present 合计>0、
      // absent 合计===0 且通道活性反证成立；缺采集 = 证不出（护栏 #14）。
      // enabled/disabled 遗留 op 不在词表、评估同证不出（挂账后补）。
      const hits = c.buttonHits ? c.buttonHits[a.value] : undefined;
      if (typeof hits !== 'number') return { ok: false, actual: null };
      if (a.op === 'present') return { ok: hits > 0, actual: hits };
      if (a.op === 'absent') {
        // 通道活性反证（codex R1-F1）：判「不存在」须同刻通道确实看得见按钮群（buttonSeen>0）——
        // role 盲区页（div 假按钮 + 未配补采）seen=0 → 证不出，绝不把「采不到」洗成「不存在」。
        const seen = typeof c.buttonSeen === 'number' ? c.buttonSeen : 0;
        return { ok: hits === 0 && seen > 0, actual: hits };
      }
      return { ok: false, actual: hits };
    }
    // 其余 kind（inputReadback / dropdownReadback / requiredFilled / switchState）
    //   尚未实现：一律 fail-safe ok=false（证不出绝不判真，护栏 #14）、actual=null（不硬凑）；真实现属后续加法。
    default:
      return { ok: false, actual: null };
  }
}
