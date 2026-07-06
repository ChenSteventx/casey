// lib/parse-testcase.mjs —— 相0 归一核心（纯函数、零 LLM、零真机、零运行期 schema 加载）。决策 docs/plans/ingest/proposed/GRILL.md。
//
//   parseTestCase(candidate, { caseId }) -> { ok, testcase, problems }
//
// LLM 在 CLI 外把杂乱原文归一成候选 JSON；本件是 L0 确定性校验器（design §1：不合规 fail-closed）。
// 手写字段闸与 tests/_golden/schemas/testcase.schema.json 同刻（项目习惯无 ajv；金牌 C4 从 schema 文件
// 读必填集/enum 逐条比对，锁双源同刻）；语义闸（JSON Schema 表达不了）：steps[].intentId 全局唯一 +
// candidate.caseId === 命令行 caseId。全 problems 汇总逐条回显、结构坏时短路防 TypeError（镜像 flow-bridge）。
// 不变异输入；ok:false 时 testcase:null。

const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/; // format date-time 形态
const SOURCE_KINDS = new Set(['excel', 'json', 'txt', 'freetext']);
const CHANNELS = new Set(['web', 'cef', 'arbitrary']);
const ACTION_HINTS = new Set(['click', 'fill', 'select', 'send', 'navigate', 'assert']);
// 允许键集（additionalProperties:false 同刻）——Object.create(null) 免原型链键干扰（同 compile-atoms 纪律）。
const TOP_KEYS = new Set(['schemaVersion', 'caseId', 'title', 'source', 'target', 'preconditions', 'steps', 'globalAssertions', 'uniquePrefix', 'boundContract']);
const SOURCE_KEYS = new Set(['kind', 'raw', 'ingestedAt']);
const TARGET_KEYS = new Set(['startUrl', 'auth', 'channel']);
const STEP_KEYS = new Set(['intentId', 'intent', 'actionHint', 'inputValue', 'uniqueGuard', 'expected', 'route', 'reason']);
const ASSERTION_KEYS = new Set(['kind', 'op', 'value']);

// 普通/null 原型才算 JSON 对象——原型链继承属性可满足必填但序列化缺字段（codex R3-F3；CLI 经 JSON.parse
// 不可达，导出面须守，同 flow-bridge 分派表原型链键先例）。
const isObj = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === null || p === Object.prototype;
};

// JSON 数据投影器（codex R5-F1：JSON.stringify 会调 toJSON、稀疏洞走原型 [[Get]]——不能用 round-trip 当投影）。
// 只取 own enumerable data property（accessor 拒）、数组须 0..length-1 全 own 且原型恰 Array.prototype、
// 对象原型恰 Object.prototype/null；函数/undefined/symbol 值/BigInt/其余形态一律 BAD fail-closed。
// symbol 键忽略（JSON 语义不可见，校验与落盘同盲）。投影产物是全新普通对象——落盘 stringify 不再触碰输入。
const BAD = Symbol('non-json');
function projectJson(v) {
  if (v === null) return null;
  const t = typeof v;
  if (t === 'string' || t === 'boolean' || t === 'number') return v; // 非有限数留给字段闸点名
  if (t !== 'object') return BAD;
  if (Array.isArray(v)) {
    if (Object.getPrototypeOf(v) !== Array.prototype) return BAD;
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
      const d = Object.getOwnPropertyDescriptor(v, i);
      if (!d || !('value' in d)) return BAD; // 稀疏洞 / accessor
      const p = projectJson(d.value);
      if (p === BAD) return BAD;
      out[i] = p;
    }
    return out;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== null && proto !== Object.prototype) return BAD;
  // Object.create(null) 建投影（codex R6-F1，同 flow-bridge 分派表先例）：JSON.parse 会把 "__proto__" 建成
  // own 键，普通字面量 out[k]=p 赋值会触发原型 setter——字段进原型链、校验读得到而落盘成空壳。
  // null 原型下 __proto__ 只是普通 own 键，交 additionalProperties 未知键闸拒。
  const out = Object.create(null);
  for (const k of Object.keys(v)) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (!d || !('value' in d)) return BAD; // accessor
    const p = projectJson(d.value);
    if (p === BAD) return BAD;
    out[k] = p;
  }
  return out;
}
const nonBlank = (v) => typeof v === 'string' && /\S/.test(v); // pattern \S 同刻
// format date-time 同刻：正则形态 + 历法组件语义双校（codex R1-F1：2026-99-99 形态过但语义非法须拒；
// 注意 V8 Date.parse 对 2026-02-30 会翻卷不判非法，故按当月天数自算，不依赖 Date.parse）。
function isDateTime(v) {
  if (typeof v !== 'string') return false;
  const m = DATE_TIME_RE.exec(v);
  if (!m) return false;
  const [, y, mo, d, h, mi, s, tz, tzh, tzm] = m;
  if (+mo < 1 || +mo > 12) return false;
  const daysInMonth = new Date(Date.UTC(+y, +mo, 0)).getUTCDate();
  if (+d < 1 || +d > daysInMonth) return false;
  if (+h > 23 || +mi > 59 || +s > 59) return false;
  if (tz !== 'Z' && (+tzh > 23 || +tzm > 59)) return false;
  return true;
}

function checkUnknownKeys(obj, allowed, where, problems) {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) problems.push(`${where} 未知键「${k}」（形态契约 additionalProperties:false）`);
}

// 断言元素形态（相0 只校形态不校词表——kind 枚举归相2 check.mjs，护栏 #17）。
function checkAssertion(a, where, problems) {
  if (!isObj(a)) { problems.push(`${where} 须为对象`); return; }
  checkUnknownKeys(a, ASSERTION_KEYS, where, problems);
  if (!nonBlank(a.kind)) problems.push(`${where} 缺 kind（非空字符串；词表校验归相2）`);
  if (a.op !== undefined && typeof a.op !== 'string') problems.push(`${where} op 须为字符串`);
  // number 须有限：JSON 文本 1e999 经 JSON.parse 得 Infinity，放行则落盘 stringify 变 null 自违 schema（codex R3-F1）。
  if (a.value !== undefined && (!['string', 'number', 'boolean'].includes(typeof a.value) || (typeof a.value === 'number' && !Number.isFinite(a.value)))) problems.push(`${where} value 须为 string|有限 number|boolean 标量`);
}

export function parseTestCase(input, { caseId } = {}) {
  // 校验↔落盘同一性（codex R4-F1/F2、R5-F1）：先取手写 JSON 数据投影（不调 toJSON 钩子、只取 own
  // enumerable data、数组稠密 own、accessor/函数/undefined/BigInt/异常原型一律拒），只校验投影、只返回投影
  // ——稀疏洞/非枚举/getter/原型链/toJSON 合成等「校验可见与序列化可见不同」的整族缝按构造封死。
  // 投影是全新普通对象，落盘 stringify 不再触碰输入（Proxy 撒谎/递归爆栈由 try 兜 fail-closed）。
  // CLI 经 JSON.parse 的输入天然即投影（恒等变换，行为零差）。
  if (!isObj(input)) return { ok: false, testcase: null, problems: ['候选须为 JSON 对象'] };
  let candidate;
  try { candidate = projectJson(input); } catch { candidate = BAD; }
  if (candidate === BAD) return { ok: false, testcase: null, problems: ['候选含非 JSON 数据形态（函数/undefined/访问器/稀疏洞/toJSON 钩子/非常规原型等），fail-closed 拒'] };
  const problems = [];
  checkUnknownKeys(candidate, TOP_KEYS, '顶层', problems);

  // schemaVersion const 1
  if (candidate.schemaVersion !== 1) problems.push(`schemaVersion 须为 1，实际 ${JSON.stringify(candidate.schemaVersion) ?? '(缺)'}`);

  // caseId：pattern + 一致闸（命令行 caseId 进产物文件名，防错配）
  if (typeof candidate.caseId !== 'string' || !CASE_ID_RE.test(candidate.caseId)) problems.push('caseId 须为 ^[A-Za-z0-9_-]+$ 非空字符串');
  // 不一致消息只回显候选侧（已过输入凭据门）；命令行原值在门扫描面外不回显（codex R2-F2 同类）。
  else if (caseId !== undefined && candidate.caseId !== caseId) problems.push(`caseId 不一致（候选 ${candidate.caseId}，与命令行参数不符；命令行原值不回显）`);

  if (candidate.title !== undefined && typeof candidate.title !== 'string') problems.push('title 须为字符串');

  // source 必填（其内 kind 必填，D3 已签；raw 存原文，D6 已签、前置凭据门兜底）
  if (!isObj(candidate.source)) problems.push('缺 source 对象（其内 kind 必填，来源模态）');
  else {
    checkUnknownKeys(candidate.source, SOURCE_KEYS, 'source', problems);
    if (!SOURCE_KINDS.has(candidate.source.kind)) problems.push(`source.kind 须 ∈ {excel,json,txt,freetext}，实际 ${JSON.stringify(candidate.source.kind) ?? '(缺)'}`);
    if (candidate.source.raw !== undefined && typeof candidate.source.raw !== 'string') problems.push('source.raw 须为字符串');
    if (candidate.source.ingestedAt !== undefined && !isDateTime(candidate.source.ingestedAt)) problems.push('source.ingestedAt 须为语义合法的 date-time 字符串');
  }

  // target 可选（真机 bring-up 才需，D3 已签 optional）
  if (candidate.target !== undefined) {
    if (!isObj(candidate.target)) problems.push('target 须为对象');
    else {
      checkUnknownKeys(candidate.target, TARGET_KEYS, 'target', problems);
      if (candidate.target.startUrl !== undefined && typeof candidate.target.startUrl !== 'string') problems.push('target.startUrl 须为字符串');
      if (candidate.target.auth !== undefined && typeof candidate.target.auth !== 'string') problems.push('target.auth 须为字符串（只存引用绝不存值，护栏 #7）');
      if (candidate.target.channel !== undefined && !CHANNELS.has(candidate.target.channel)) problems.push(`target.channel 须 ∈ {web,cef,arbitrary}，实际 ${JSON.stringify(candidate.target.channel)}`);
    }
  }

  // preconditions 可选——本闸是唯一守点：下游 compile-gate 对非数组静默吞成空种子、非 string 元素静默丢
  if (candidate.preconditions !== undefined) {
    if (!Array.isArray(candidate.preconditions)) problems.push('preconditions 须为字符串数组（下游对非数组静默吞成空种子，只有相0 能 fail-closed）');
    else candidate.preconditions.forEach((p, i) => { if (!nonBlank(p)) problems.push(`preconditions[${i}] 须为非空字符串`); });
  }

  // steps 必填 minItems 1；intentId 全局唯一（防相1 投影忠实退化）；route:human ⟹ reason 留痕
  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) problems.push('缺 steps 数组（minItems 1，聚合根主体）');
  else {
    const seenIntent = new Set();
    candidate.steps.forEach((s, i) => {
      const where = `steps[${i}]`;
      if (!isObj(s)) { problems.push(`${where} 须为对象`); return; }
      checkUnknownKeys(s, STEP_KEYS, where, problems);
      if (!nonBlank(s.intentId)) problems.push(`${where} 缺 intentId（非空字符串）`);
      else {
        if (seenIntent.has(s.intentId)) problems.push(`${where} intentId 重复「${s.intentId}」（须全局唯一，防相1 投影忠实退化）`);
        seenIntent.add(s.intentId);
      }
      if (s.intent !== undefined && typeof s.intent !== 'string') problems.push(`${where} intent 须为字符串`);
      if (s.actionHint !== undefined && !ACTION_HINTS.has(s.actionHint)) problems.push(`${where} actionHint 须 ∈ {click,fill,select,send,navigate,assert}，实际 ${JSON.stringify(s.actionHint)}`);
      if (s.inputValue !== undefined && typeof s.inputValue !== 'string') problems.push(`${where} inputValue 须为字符串`);
      if (s.uniqueGuard !== undefined && typeof s.uniqueGuard !== 'boolean') problems.push(`${where} uniqueGuard 须为布尔`);
      if (s.expected !== undefined) {
        if (!Array.isArray(s.expected)) problems.push(`${where} expected 须为数组`);
        else s.expected.forEach((a, j) => checkAssertion(a, `${where}.expected[${j}]`, problems));
      }
      if (s.route !== undefined) {
        if (s.route !== 'human') problems.push(`${where} route 只收 human（枚举 fail-closed，别把 typo 静默当普通步），实际 ${JSON.stringify(s.route)}`);
        else if (!nonBlank(s.reason)) problems.push(`${where} 标 route:human 但缺 reason（须留痕，别静默丢）`);
      }
      // reason 的 pattern \S 不分有无 route（schema 同刻，codex R3-F2）；route:human 分支只管缺席/空白留痕语义。
      if (s.reason !== undefined && !nonBlank(s.reason)) problems.push(`${where} reason 须为非空字符串`);
    });
  }

  if (candidate.globalAssertions !== undefined) {
    if (!Array.isArray(candidate.globalAssertions)) problems.push('globalAssertions 须为数组');
    else candidate.globalAssertions.forEach((a, i) => checkAssertion(a, `globalAssertions[${i}]`, problems));
  }

  // uniquePrefix：^\S+$ ——封「纯空白过 compile 长度闸、破坏性闸只在有破坏性原子时才兜」的缝
  if (typeof candidate.uniquePrefix !== 'string' || !/^\S+$/.test(candidate.uniquePrefix)) problems.push('uniquePrefix 须为无空白非空字符串（破坏性实体名前缀，如 atl_）');

  if (candidate.boundContract !== undefined && typeof candidate.boundContract !== 'string') problems.push('boundContract 须为字符串');

  const ok = problems.length === 0;
  return { ok, testcase: ok ? candidate : null, problems };
}
