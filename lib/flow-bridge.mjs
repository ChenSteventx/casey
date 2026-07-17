// lib/flow-bridge.mjs —— 相1 LLM flow 草拟桥核心（纯函数、零 LLM、零真机）。决策 docs/plans/flow-bridge/proposed/GRILL.md。
//
//   buildFlow(testcase, mapping) -> flow（{id,name,category,steps:[{atom,params,sourceIntentId,entityBindings?}]}）
//   validateBridge(testcase, mapping, { registry }) -> { ok, problems }
//
// LLM 在 CLI 外把 TestCase.steps 的 intent 映射成 mapping（[{intentId, atom, params}]）；桥是 L0 确定性复核器。
// 三闸：投影忠实（每 TestCase.steps[].intentId 被覆盖，除非该步显式 route:human 跳过；无凭空 intentId）+
// 编译知识允许集（atom 可编译，补 compile-gate 放行册内无编译知识原子的缝）+ 复用 compile-gate.validateDraft
// （结构 + 破坏性前缀 + 状态机）。flow 步不带 intentId——compile 自生（run.newIntent），mapping 的 intentId 仅供投影校验。
import { validateDraft } from './compile-gate.mjs';
import { isCompilableAtom } from './compile-atoms.mjs';

// caseId → flow.id 确定性派生（^[a-z0-9_]+$）：小写化 + 非法字符归 _。
export function deriveFlowId(caseId) {
  return String(caseId).toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

const ENTITY_BINDING_ROLES = new Set(['source', 'target']);

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyEntityBindings(bindings, mappingIndex) {
  if (!Array.isArray(bindings)) throw new TypeError(`mapping[${mappingIndex}].entityBindings 须为数组`);
  return bindings.map((binding, bindingIndex) => {
    const label = `mapping[${mappingIndex}].entityBindings[${bindingIndex}]`;
    if (!isPlainRecord(binding)) throw new TypeError(`${label} 须为对象`);
    if (!Object.hasOwn(binding, 'candidateId') || typeof binding.candidateId !== 'string' || !binding.candidateId.trim()) {
      throw new TypeError(`${label}.candidateId 须为非空字符串`);
    }
    // source/target 是上游显式语义：缺失或未知角色必须拒绝，不得按顺序猜测。
    if (!Object.hasOwn(binding, 'role') || !ENTITY_BINDING_ROLES.has(binding.role)) {
      throw new TypeError(`${label}.role 必须显式为 source 或 target`);
    }
    return { candidateId: binding.candidateId, role: binding.role };
  });
}

export function buildFlow(testcase, mapping) {
  if (!isPlainRecord(testcase) || typeof testcase.caseId !== 'string' || !testcase.caseId) {
    throw new TypeError('TestCase 非法：caseId 须为非空字符串');
  }
  if (!Array.isArray(mapping)) throw new TypeError('mapping 须为数组');

  return {
    id: deriveFlowId(testcase.caseId),
    name: (typeof testcase.title === 'string' && testcase.title.trim()) ? testcase.title : String(testcase.caseId),
    category: 'normal',
    steps: mapping.map((m, i) => {
      if (!isPlainRecord(m)) throw new TypeError(`mapping[${i}] 须为对象`);
      if (!Object.hasOwn(m, 'intentId') || typeof m.intentId !== 'string' || !m.intentId) {
        throw new TypeError(`mapping[${i}].intentId 须为非空字符串`);
      }
      if (!Object.hasOwn(m, 'atom') || typeof m.atom !== 'string' || !m.atom) {
        throw new TypeError(`mapping[${i}].atom 须为非空字符串`);
      }
      const params = Object.hasOwn(m, 'params') ? m.params : {};
      if (!isPlainRecord(params)) throw new TypeError(`mapping[${i}].params 须为对象`);

      const step = {
        atom: m.atom,
        params: structuredClone(params),
        sourceIntentId: m.intentId,
      };
      if (Object.hasOwn(m, 'entityBindings')) step.entityBindings = copyEntityBindings(m.entityBindings, i);
      return step;
    }),
  };
}

export function validateBridge(testcase, mapping, { registry } = {}) {
  const problems = [];
  const skipped = []; // route:human 跳过通道留痕（绝不静默丢，codex R1-F2）
  if (!testcase || typeof testcase !== 'object' || !Array.isArray(testcase.steps)) return { ok: false, problems: ['TestCase 非法：缺 steps 数组'], skipped };
  if (!Array.isArray(mapping)) return { ok: false, problems: ['mapping 须为数组'], skipped };

  // TestCase.steps[].intentId 必唯一（codex R1-F3）：重复会让一条 mapping 同时「覆盖」两步、投影忠实退化。
  const seenIntent = new Set();
  for (const s of testcase.steps) {
    if (!s || typeof s.intentId !== 'string' || !s.intentId) { problems.push('TestCase.steps[] 缺 intentId'); continue; }
    if (seenIntent.has(s.intentId)) problems.push(`TestCase.steps[].intentId 重复「${s.intentId}」（须唯一，防投影忠实退化）`);
    seenIntent.add(s.intentId);
  }

  // mapping 结构 + 编译知识允许集。structOk：全元素是带 string atom 的对象——false 时不进 buildFlow/validateDraft
  // （防 mapping:[null] 在 buildFlow 的 m.atom 处抛 TypeError → 变 exit 1 而非契约 exit 65，codex R2）。
  let structOk = true;
  mapping.forEach((m, i) => {
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.intentId !== 'string' || !m.intentId) { problems.push(`mapping[${i}]：非法条目（须 {intentId, atom, params?} 对象）`); structOk = false; return; }
    if (typeof m.atom !== 'string' || !m.atom) { problems.push(`mapping[${i}]：缺 atom`); structOk = false; return; }
    if (m.params !== undefined && (typeof m.params !== 'object' || m.params === null || Array.isArray(m.params))) {
      problems.push(`mapping[${i}] (${m.atom})：params 须为对象`);
      structOk = false;
    }
    if (Object.hasOwn(m, 'entityBindings')) {
      try { copyEntityBindings(m.entityBindings, i); }
      catch (error) { problems.push(error.message); structOk = false; }
    }
    // 编译知识允许集闸：不在注册表由 validateDraft 报，此处专挡「册内但无编译知识」（真缝）——点名区分。
    const inRegistry = !!(registry && registry.atoms && registry.atoms[m.atom]);
    if (inRegistry && !isCompilableAtom(m.atom)) problems.push(`mapping[${i}]：原子「${m.atom}」在册但暂无编译知识（扩表走飞轮排期，桥前置拦，护栏 #17）`);
  });

  // 投影忠实：每个非跳过 TestCase.steps[].intentId 须被 ≥1 mapping 覆盖；mapping 不得造 TestCase 不存在的 intentId。
  const tcIntentIds = new Set(testcase.steps.map((s) => s && s.intentId).filter(Boolean));
  const mappedIds = new Set(mapping.map((m) => m && m.intentId).filter(Boolean));
  for (const s of testcase.steps) {
    if (!s || typeof s.intentId !== 'string' || !s.intentId) continue; // 已在唯一性循环报缺
    if (s.route === 'human') {
      // 显式 route:human 跳过通道（不可自动化步）：须带非空 reason 留痕（绝不静默丢，codex R1-F2）；
      // 且不得再被 mapping 覆盖（跳过与映射矛盾）。
      if (typeof s.reason !== 'string' || !s.reason.trim()) { problems.push(`投影忠实：intent「${s.intentId}」标 route:human 跳过但缺 reason（须留痕，别静默丢）`); continue; }
      if (mappedIds.has(s.intentId)) { problems.push(`投影忠实：intent「${s.intentId}」既标 route:human 跳过又被 mapping 覆盖（矛盾）`); continue; }
      skipped.push({ intentId: s.intentId, reason: s.reason.trim() });
      continue;
    }
    if (!mappedIds.has(s.intentId)) problems.push(`投影忠实：TestCase intent「${s.intentId}」未被任何 flow 原子覆盖（漏译；不可自动化须显式 route:human + reason）`);
  }
  for (const id of mappedIds) if (!tcIntentIds.has(id)) problems.push(`投影忠实：mapping intentId「${id}」不在 TestCase.steps 中（凭空造步）`);

  // 复用 compile-gate.validateDraft：结构 + 破坏性前缀（TestCase.uniquePrefix）+ 状态机（TestCase.preconditions 种初态）。
  // 仅在 mapping 结构 ok 时进（否则 buildFlow 会在坏条目抛错；结构问题已记，直接 fail-closed，codex R2）。
  if (!registry) problems.push('缺 registry：无法跑 compile-gate 结构/前缀/状态机闸');
  else if (structOk) {
    const flow = buildFlow(testcase, mapping);
    const { ok, problems: dp } = validateDraft(flow, { prefix: testcase.uniquePrefix, registry, initialStates: testcase.preconditions || [] });
    if (!ok) problems.push(...dp);
  }

  return { ok: problems.length === 0, problems, skipped };
}
