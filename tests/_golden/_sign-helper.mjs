// 测试辅助：把未签 expected（draft 形态）深盖签署字段转成已签契约形态，供 sign 契约的涟漪金牌
// （回放侧喂已签 expected，相2 sign 上线后 replay 前置闸要求非空断言契约已签）与 p2-sign 的正例复用。
// 非产品代码——只在 golden 里造「已签测试输入」，绝不替代 bin/sign.mjs 的真实签发逻辑。
const DEFAULTS = { signer: 'qa.hermetic', build: 'hermetic-b0', at: '2026-07-06T00:00:00.000Z' };

function stamp(a, s) {
  return { ...a, signedAt: s.at, signedAgainstBuild: s.build, signerId: s.signer };
}

// 深盖签署字段：逐条 intents[].expected[] 与 globalAssertions[]；去掉 draft-only 的 pending 顶层字段。
export function signExpected(expected, opts = {}) {
  const s = { ...DEFAULTS, ...opts };
  const out = { caseId: expected.caseId };
  if (expected.channel !== undefined) out.channel = expected.channel;
  out.intents = (expected.intents || []).map((it) => ({
    intentId: it.intentId,
    ...(it.intent !== undefined ? { intent: it.intent } : {}),
    expected: (it.expected || []).map((a) => stamp(a, s)),
    ...(it.expectedVerdict !== undefined ? { expectedVerdict: it.expectedVerdict } : {}),
  }));
  if (expected.globalAssertions !== undefined) {
    out.globalAssertions = (expected.globalAssertions || []).map((a) => stamp(a, s));
  }
  return out;
}
