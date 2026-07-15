// lib/sign-gate.mjs —— 人签门确定性字段校验（零 LLM、纯函数、可 golden）。
//
// 人签是 CASE_DEFECT 与 SUT_DEFECT 的分水岭（design §4.3）、gate 绿 ≠ 完成（护栏 #16）。
// 真人签本身是 route:human（CLI --sign 形态、签署人身份核验，design §11 项 1，不在本骨架）；
// 本模块只做确定性前置：每条冻结断言必须 signedAt(ISO 8601) / signedAgainstBuild / signerId 三者齐全且非空，
// 否则视为未签，裁定流程拒「算数」（fail-closed，护栏 #14）。
//
//   isSigned(frozenAssertion) -> boolean
//   assertSignedContract(expectedFrozen) -> { ok: boolean, problems: string[] }
//
// 注意：本模块零 LLM、不碰已冻内核，也不回写冻结契约（runtime 的 actual/ok 永不进契约，护栏 #15）。

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// 非空字符串：去空白后仍有内容。
function nonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0; }

// signedAt 须是非空且形如 ISO 8601（期望版本化锚点之一，design §4.3）；不解析为真实时刻，只确定性校形状。
function validSignedAt(v) { return nonEmptyStr(v) && ISO_RE.test(v.trim()); }

export function isSigned(frozenAssertion) {
  if (!frozenAssertion || typeof frozenAssertion !== 'object') return false;
  return validSignedAt(frozenAssertion.signedAt)
    && nonEmptyStr(frozenAssertion.signedAgainstBuild)
    && nonEmptyStr(frozenAssertion.signerId);
}

// 单条断言的具名缺失落点（人签门责任落点：哪条、缺什么）。
function problemsFor(label, a) {
  const out = [];
  if (!a || typeof a !== 'object') { out.push(`${label}: 断言不是对象`); return out; }
  if (!validSignedAt(a.signedAt)) out.push(`${label}: signedAt 缺失或非 ISO 8601（未签）`);
  if (!nonEmptyStr(a.signedAgainstBuild)) out.push(`${label}: signedAgainstBuild 缺失或空（未签，期望版本化锚点）`);
  if (!nonEmptyStr(a.signerId)) out.push(`${label}: signerId 缺失或空（未签，人签责任落点）`);
  return out;
}

export function assertSignedContract(expectedFrozen) {
  const problems = [];
  if (!expectedFrozen || typeof expectedFrozen !== 'object') {
    return { ok: false, problems: ['expected.frozen 不是对象'] };
  }
  const caseId = expectedFrozen.caseId ?? '<no-caseId>';
  const intents = expectedFrozen.intents ?? [];
  for (const intent of intents) {
    const iid = intent.intentId ?? '<no-intentId>';
    const expected = intent.expected ?? [];
    expected.forEach((a, k) => {
      problems.push(...problemsFor(`${caseId}/${iid}/expected[${k}](kind=${a?.kind ?? '?'})`, a));
    });
  }
  (expectedFrozen.globalAssertions ?? []).forEach((a, k) => {
    problems.push(...problemsFor(`${caseId}/globalAssertions[${k}](kind=${a?.kind ?? '?'})`, a));
  });
  return { ok: problems.length === 0, problems };
}
