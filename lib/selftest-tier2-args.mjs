// lib/selftest-tier2-args.mjs —— casey selftest --tier2 专用严格解析器【纯层】
//   （p9-tier2-live-smoke GRILL D2 v3；codex 联审 r1 M1 收口）。
// 零 fs / 零 spawn / 零网络：吃 argv + 人签用例集成员上下文，出「拒付码 + 参数序号 + 脱敏类别」。
//
// 回显纪律（M1）：拒付回执一律不回显未校验的原始值——真实地址或凭据若被误放进命令行，
//   绝不能顺着用法错进日志。只有【通过安全形状校验的 caseId】（`^[A-Za-z0-9_]+$`，结构上
//   不可能含 :// 、路径分隔符、@ 或点号）才允许原样列出——「重复 --case 收数组且钉顺序」
//   这条冻结钉要的就是这个可见性；形状不合格的值只出脱敏类别，未知旗标只出序号。

const SAFE_CASE_ID = /^[A-Za-z0-9_]+$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
export const TIER2_DEFAULT_CASE_LIMIT = 4;

// 拒付码（稳定枚举；出口只出码、序号与类别）。
export const TIER2_ARG_CODES = Object.freeze([
  'TIER2_ARG_TIER1_CONFLICT',
  'TIER2_ARG_SUT_MISSING',
  'TIER2_ARG_SUT_VALUE_MISSING',
  'TIER2_ARG_SUT_DUPLICATE',
  'TIER2_ARG_SUT_NOT_LOOPBACK',
  'TIER2_ARG_CASE_VALUE_MISSING',
  'TIER2_ARG_CASE_DUPLICATE',
  'TIER2_ARG_CASE_ID_UNSAFE',
  'TIER2_ARG_CASE_NOT_MEMBER',
  'TIER2_ARG_CASE_LIMIT_EXCEEDED',
  'TIER2_ARG_MUTATION_VALUE_MISSING',
  'TIER2_ARG_MUTATION_DUPLICATE',
  'TIER2_ARG_MUTATION_ID_UNSAFE',
  'TIER2_ARG_MUTATION_NOT_MEMBER',
  'TIER2_ARG_MUTATION_EFFECT_MISMATCH',
  'TIER2_ARG_MUTATION_NOT_SELECTED',
  'TIER2_ARG_UNKNOWN_FLAG',
]);

export function isLoopbackBaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (u.username || u.password) return false;
    return LOOPBACK_HOSTS.has(u.hostname);
  } catch { return false; }
}

// 脱敏类别：只描述「值长什么样」，绝不带值本身。
export function redactCategory(value) {
  const s = String(value == null ? '' : value);
  if (/:\/\//.test(s)) return '地址形态';
  if (/[/\\]/.test(s)) return '含路径分隔符';
  if (s.includes('..')) return '含上跳段';
  if (s.startsWith('-')) return '旗标形态';
  if (/[^A-Za-z0-9_]/.test(s)) return '含非法字符';
  return '形状不合格';
}

function err(code, argIndex, { category = null, safeValue = null, detail = null } = {}) {
  return { code, argIndex, category, safeValue, detail };
}

// 出口渲染：一行一条，只出码 + 序号 + 类别/安全值/计数。
export function formatTier2ArgErrors(errors) {
  return (Array.isArray(errors) ? errors : []).map((e) => {
    const pos = Number.isInteger(e.argIndex) && e.argIndex >= 0 ? `第 ${e.argIndex + 1} 个参数` : '整体用参';
    const tailParts = [];
    if (e.safeValue) tailParts.push(`用例 ${e.safeValue}`);
    if (e.category) tailParts.push(`值类别 ${e.category}（原值不回显）`);
    if (e.detail) tailParts.push(e.detail);
    return `- [${e.code}] ${pos}${tailParts.length ? '：' + tailParts.join('；') : ''}`;
  });
}

export function parseTier2Args(argv = [], ctx = {}) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const memberIds = new Set(Array.isArray(c.memberIds) ? c.memberIds.map(String) : []);
  const memberEffects = c.memberEffects && typeof c.memberEffects === 'object' ? c.memberEffects : {};
  const caseLimit = Number.isInteger(c.caseLimit) && c.caseLimit > 0 ? c.caseLimit : TIER2_DEFAULT_CASE_LIMIT;
  const args = (Array.isArray(argv) ? argv : []).map(String);
  const errors = [];
  const requestedCases = [];      // 收数组并钉给定顺序（现役通用解析器是后值覆盖前值，不能用）
  const requestedMutations = [];
  let sut = null;
  let sutSeen = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const at = i;
    const value = (code) => {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) { errors.push(err(code, at)); return null; }
      i += 1;
      return v;
    };
    if (a === '--tier2') continue;
    if (a === '--tier1') { errors.push(err('TIER2_ARG_TIER1_CONFLICT', at, { detail: '两层自检各跑一次，绝不混开' })); continue; }
    if (a === '--sut') {
      const v = value('TIER2_ARG_SUT_VALUE_MISSING');
      if (v !== null) {
        if (sutSeen) errors.push(err('TIER2_ARG_SUT_DUPLICATE', at));
        sutSeen = true;
        sut = v;
      }
      continue;
    }
    if (a === '--case') {
      const v = value('TIER2_ARG_CASE_VALUE_MISSING');
      if (v !== null) requestedCases.push({ value: v, argIndex: i });
      continue;
    }
    if (a === '--authorize-mutation') {
      const v = value('TIER2_ARG_MUTATION_VALUE_MISSING');
      if (v !== null) requestedMutations.push({ value: v, argIndex: i });
      continue;
    }
    // 未知旗标/游离位置参数：只出序号，绝不回显 token（可能是误放的地址或凭据）。
    errors.push(err('TIER2_ARG_UNKNOWN_FLAG', at, { category: redactCategory(a) }));
  }

  if (!sutSeen) errors.push(err('TIER2_ARG_SUT_MISSING', -1, { detail: '只吃隧道回环基址' }));
  else if (!isLoopbackBaseUrl(sut)) errors.push(err('TIER2_ARG_SUT_NOT_LOOPBACK', -1, { detail: '真目标地址绝不进命令行（原值不回显）' }));

  const seenCases = new Set();
  const safeCases = [];
  for (const item of requestedCases) {
    const { value: id, argIndex } = item;
    const safe = SAFE_CASE_ID.test(id);
    if (seenCases.has(id)) {
      errors.push(err('TIER2_ARG_CASE_DUPLICATE', argIndex, safe ? { safeValue: id } : { category: redactCategory(id) }));
      continue;
    }
    seenCases.add(id);
    if (!safe) { errors.push(err('TIER2_ARG_CASE_ID_UNSAFE', argIndex, { category: redactCategory(id) })); continue; }
    safeCases.push(id);
    if (!memberIds.has(id)) errors.push(err('TIER2_ARG_CASE_NOT_MEMBER', argIndex, { safeValue: id, detail: '零动态发现：只认人签用例集成员' }));
  }
  if (requestedCases.length > caseLimit) {
    errors.push(err('TIER2_ARG_CASE_LIMIT_EXCEEDED', -1, { detail: `给了 ${requestedCases.length} 条，上限 ${caseLimit}` }));
  }

  const seenMutations = new Set();
  for (const item of requestedMutations) {
    const { value: id, argIndex } = item;
    const safe = SAFE_CASE_ID.test(id);
    if (seenMutations.has(id)) {
      errors.push(err('TIER2_ARG_MUTATION_DUPLICATE', argIndex, safe ? { safeValue: id } : { category: redactCategory(id) }));
      continue;
    }
    seenMutations.add(id);
    if (!safe) { errors.push(err('TIER2_ARG_MUTATION_ID_UNSAFE', argIndex, { category: redactCategory(id) })); continue; }
    if (!memberIds.has(id)) { errors.push(err('TIER2_ARG_MUTATION_NOT_MEMBER', argIndex, { safeValue: id })); continue; }
    if (Object.keys(memberEffects).length && memberEffects[id] !== 'mutation') {
      errors.push(err('TIER2_ARG_MUTATION_EFFECT_MISMATCH', argIndex, { safeValue: id, detail: '非变更型成员无需逐次授权' }));
      continue;
    }
    if (requestedCases.length && !seenCases.has(id)) {
      errors.push(err('TIER2_ARG_MUTATION_NOT_SELECTED', argIndex, { safeValue: id }));
    }
  }

  return {
    ok: errors.length === 0,
    exitCode: errors.length === 0 ? 0 : 64,
    errors,
    errorCodes: errors.map((e) => e.code),
    sut,
    // 依给定次序的安全 caseId 列（拒付回执与执行选集共用；形状不合格的值不入列、不回显）
    requestedCases: safeCases,
    authorizedMutations: requestedMutations.filter((m) => SAFE_CASE_ID.test(m.value)).map((m) => m.value),
    caseLimit,
  };
}
