// lib/compile-gate.mjs —— 意图到 atomId 编译门（双闸，零 LLM、纯函数、可 golden）。
//
// 复制并参数化 regress `scripts/_flow-authoring.mjs` 的双闸（ADR-0006 复用 regress 工装）。
// 唯一行为改动 = 破坏性硬闸的实体名前缀，从写死 `ctxtest_` 改为按 `TestCase.uniquePrefix` 注入（R12 前缀解耦）。
// 坐落在 LLM 选 atomId 之后、冻结之前；fail-closed —— 挡「选错原子 / 缺参 / 序对错 / 实体名漏前缀」。
//
//   validateDraft(draft, { prefix, registry }) -> { ok: boolean, problems: string[] }
//     闸一(结构)：atomId 在册 / 必填参数齐 / 类型对 / 无未声明参数；
//     闸二(状态机)：requires ⊆ 当前集 / exclusiveGroups 互斥 / 带 entityNameParam 的实体名须带注入 prefix。
//
// 注意：regress 另有 `_flow-runner.ts:validateFlow` 是收集期 .ts 镜像；前缀参数化落地须同步两份镜像（R12）。

const ID_RE = /^[a-z0-9_]+$/;
const CATEGORIES = ['normal', 'boundary', 'security'];

export function typeOk(type, v) {
  switch (type) {
    case 'string': return typeof v === 'string';
    case 'string[]': return Array.isArray(v) && v.every((x) => typeof x === 'string');
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    default: return true;
  }
}

// 反查：哪些原子能 provide 某状态（报错给「谁能提供」修复提示用）。
export function providersOf(atomDefs, state) {
  return Object.entries(atomDefs)
    .filter(([, d]) => (d.provides ?? []).includes(state))
    .map(([id]) => id);
}

// 闸一·结构校验。返回问题列表。
export function validateStructural(f, reg) {
  const problems = [];
  const atomDefs = reg?.atoms ?? {};
  if (!f || typeof f !== 'object') return ['draft 必须是对象'];
  if (typeof f.id !== 'string' || !ID_RE.test(f.id)) problems.push(`id 非法（需 ^[a-z0-9_]+$）：${JSON.stringify(f.id)}`);
  if (typeof f.name !== 'string' || !f.name.trim()) problems.push('name 必须是非空字符串');
  if (f.category !== undefined && !CATEGORIES.includes(f.category)) problems.push(`category 非法（只能 ${CATEGORIES.join('|')}）`);
  if (!Array.isArray(f.steps) || f.steps.length === 0) problems.push('steps 必须是非空数组');
  else {
    f.steps.forEach((step, i) => {
      if (!step || typeof step.atom !== 'string') { problems.push(`step[${i}]：缺 atom 字段`); return; }
      const def = atomDefs[step.atom];
      if (!def) { problems.push(`step[${i}]：未知原子「${step.atom}」（不在注册表）`); return; }
      const declared = def.params ?? {};
      const given = step.params ?? {};
      for (const [pname, pdef] of Object.entries(declared)) {
        const has = Object.prototype.hasOwnProperty.call(given, pname) && given[pname] !== undefined && given[pname] !== null;
        if (pdef.required && !has) problems.push(`step[${i}] (${step.atom})：缺必填参数「${pname}」`);
        if (has && !typeOk(pdef.type, given[pname])) problems.push(`step[${i}] (${step.atom})：参数「${pname}」类型应为 ${pdef.type}`);
      }
      for (const key of Object.keys(given)) {
        if (!(key in declared)) problems.push(`step[${i}] (${step.atom})：未声明的参数「${key}」`);
      }
    });
  }
  return problems;
}

// 闸二·状态机模拟。前提：闸一已过。返回问题列表。
// initialStates（加性，缺省 = 空集不改旧行为）：TestCase.preconditions 投影的初始状态种子——
// 「已登录」由登录预备动作在 flow 之外建立（G2，凭据红线），状态机据此不再要求 flow 内含 login 原子。
export function checkStateMachine(flow, reg, initialStates = []) {
  const problems = [];
  const atomDefs = reg.atoms;
  const groups = reg.exclusiveGroups ?? [];
  const cur = new Set(Array.isArray(initialStates) ? initialStates.filter((s) => typeof s === 'string') : []);
  flow.steps.forEach((step, i) => {
    const def = atomDefs[step.atom];
    for (const s of def.requires ?? []) {
      if (!cur.has(s)) {
        const prov = providersOf(atomDefs, s);
        problems.push(`step[${i}] (${step.atom})：需要〈${s}〉，但前序无原子提供（可提供它的原子：${prov.join(' / ') || '无'}）`);
        cur.add(s); // 视为已满足继续模拟，防一个缺口连锁误报后续所有步
      }
    }
    for (const s of def.provides ?? []) {
      for (const g of groups) if (g.includes(s)) for (const other of g) if (other !== s) cur.delete(other);
      cur.add(s);
    }
    for (const s of def.removes ?? []) cur.delete(s);
  });
  return problems;
}

// 破坏性硬闸（前缀参数化）—— 独立于状态机：凡带 entityNameParam 的原子，不论注册表有无 states
// 都强制实体名非空且带注入前缀（护栏 #14 fail-closed，防误删真实数据/污染共享环境）。
// 真异构评审 B4/B5（2026-06-29 codex gpt-5.5）：原先此闸裹在 checkStateMachine 里、只在 registry.states
//   存在时才跑 —— 无 states 注册表会把整条破坏性硬闸静默绕过；且空/缺实体名旧版直接放行。皆属最危险 fail-open。
export function checkDestructivePrefix(flow, reg, prefix) {
  const problems = [];
  const atomDefs = reg.atoms ?? {};
  flow.steps.forEach((step, i) => {
    const def = atomDefs[step.atom];
    if (!def || !def.entityNameParam) return;
    if (typeof prefix !== 'string' || prefix.trim() === '') {
      // startsWith('') 恒真会把硬闸静默清零 —— 前缀缺失/为空一律拒。
      problems.push(`step[${i}] (${step.atom})：破坏性硬闸前缀缺失/为空，拒绝放行（uniquePrefix 必须是非空字符串）`);
      return;
    }
    const v = (step.params ?? {})[def.entityNameParam];
    if (typeof v !== 'string' || v.trim() === '') {
      // 空/缺实体名无从证明带前缀 —— fail-closed，绝不放行破坏性原子。
      problems.push(`step[${i}] (${step.atom})：破坏性原子实体名「${def.entityNameParam}」缺失/为空，拒绝放行（须非空且带前缀「${prefix}」）`);
    } else if (!v.startsWith(prefix)) {
      problems.push(`step[${i}] (${step.atom})：实体名「${v}」必须带前缀「${prefix}」（破坏性硬闸，防误删真实数据/污染环境）`);
    }
  });
  return problems;
}

// 三闸合一：闸一(结构) → 破坏性前缀硬闸(不依赖 states、永远跑) →（注册表 v2 含 states 时）状态机。
// 前缀从参数注入、非写死。破坏性闸独立确保无 states 注册表也挡得住裸名/空名破坏性原子（B4/B5）。
export function validateDraft(draft, { prefix, registry, initialStates } = {}) {
  const problems = validateStructural(draft, registry);
  if (problems.length === 0 && registry) {
    problems.push(...checkDestructivePrefix(draft, registry, prefix));
    if (registry.states) problems.push(...checkStateMachine(draft, registry, initialStates));
  }
  return { ok: problems.length === 0, problems };
}
