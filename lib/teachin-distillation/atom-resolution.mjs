// 已有 atom 优先的确定性解析：内置 known recipe + 注册表声明 recipe，恰一条命中才 resolved。
// 纯核心：零 browser、零 fs、零 network、零 LLM。recipe 只决定 atom 与参数，
// 绝不产生 expected、identity 或 effect 结论（设计 §2.4）。

const RESOLUTION_STATE = new WeakMap();

// resolution 当前理解的业务动作种类。不在其中的已准入动作固定 UNSUPPORTED_ACTION，
// 在其中但没命中确定性 recipe 的固定 KNOWN_RECIPE_MISSING，两者不得互换。
const SUPPORTED_ACTIONS = new Set(['click', 'dblclick', 'fill']);

// 内置 known recipe：只登记现役 frozen policy 已判为只读且不要求身份绑定的导航原子。
const BUILTIN_RECIPES = Object.freeze([
  Object.freeze({
    ruleId: 'known-nav-workflow-management',
    actions: Object.freeze(['click']),
    requiresSemanticEvidence: true,
    textAnyOf: Object.freeze(['流程管理', '工作流管理']),
    atom: 'nav.workflowManagement',
    params: Object.freeze({}),
  }),
  // 真机侧栏默认折叠：导航录制恒为「展开组 → 点条目」两击。槽位白名单逐位约束
  // （槽 0 菜单组、槽 1 条目），松匹配会把无关首击吸收成假绿（GRILL D1 v2）。
  // 扩组与菜单改名属冻结策略修订面，走 amendment 重签，不在此就地放宽。
  Object.freeze({
    ruleId: 'known-nav-workflow-management-grouped',
    actions: Object.freeze(['click', 'click']),
    requiresSemanticEvidence: true,
    slots: Object.freeze([
      Object.freeze({ textAnyOf: Object.freeze(['智能应用']) }),
      Object.freeze({ textAnyOf: Object.freeze(['流程管理', '工作流管理']) }),
    ]),
    atom: 'nav.workflowManagement',
    params: Object.freeze({}),
  }),
]);

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 槽位白名单：与 actions 逐位对齐的语义文本约束。形状非法即整条配方弃用（fail-closed），
// 绝不静默降级成「忽略 slots 的松匹配配方」——那会让非法声明反而拿到更宽的匹配面。
function normalizeSlots(raw, actionCount) {
  if (raw === undefined) return frozen({ ok: true, slots: null });
  if (!Array.isArray(raw) || raw.length !== actionCount) return frozen({ ok: false, slots: null });
  const slots = [];
  for (const slot of raw) {
    if (!isPlainRecord(slot)) return frozen({ ok: false, slots: null });
    if (!Array.isArray(slot.textAnyOf) || slot.textAnyOf.length === 0) {
      return frozen({ ok: false, slots: null });
    }
    if (!slot.textAnyOf.every((text) => typeof text === 'string' && text)) {
      return frozen({ ok: false, slots: null });
    }
    slots.push(frozen({ textAnyOf: frozen([...slot.textAnyOf]) }));
  }
  return frozen({ ok: true, slots: frozen(slots) });
}

// 注册表声明的 recipe 只可声明 action 序列与 emit atom/params；
// 自报的 effect/identity 字段一律忽略，不进入任何策略面（设计 G13）。
function normalizeRegistryRecipe(atom, raw) {
  if (!isPlainRecord(raw)) return null;
  const match = raw.match;
  const emit = raw.emit;
  if (!isPlainRecord(match) || !isPlainRecord(emit)) return null;
  if (!Array.isArray(match.actions) || match.actions.length === 0) return null;
  if (!match.actions.every((action) => typeof action === 'string' && action)) return null;
  if (typeof emit.atom !== 'string' || emit.atom !== atom) return null;
  if (emit.params !== undefined && !isPlainRecord(emit.params)) return null;
  const textAnyOf = Array.isArray(match.textAnyOf)
    && match.textAnyOf.every((text) => typeof text === 'string' && text)
    ? frozen([...match.textAnyOf])
    : null;
  const slots = normalizeSlots(match.slots, match.actions.length);
  if (!slots.ok) return null;
  return frozen({
    ruleId: typeof raw.ruleId === 'string' && raw.ruleId ? raw.ruleId : `registry-${atom}`,
    actions: frozen([...match.actions]),
    requiresSemanticEvidence: match.requiresSemanticEvidence === true,
    textAnyOf,
    slots: slots.slots,
    atom,
    params: frozen(emit.params ? structuredClone(emit.params) : {}),
  });
}

export function collectRecipes(registry) {
  const recipes = [...BUILTIN_RECIPES];
  // ruleId 是配方身份：下游按 ruleId 反查配方取语义标签，重名会让影子配方冒名顶替
  // 真配方的标签（联审 code-r1 F1 实锤语义错绑假绿）。builtin 先收故恒为权威家，
  // 后到的重名者整条弃用；注册表内部重名同样先到者胜，与 normalizeRegistryRecipe
  // 静默弃无效项同模式。
  const ruleIds = new Set(recipes.map((recipe) => recipe.ruleId));
  const atoms = isPlainRecord(registry) && isPlainRecord(registry.atoms)
    ? registry.atoms
    : null;
  if (!atoms) return frozen(recipes);
  for (const [atom, definition] of Object.entries(atoms)) {
    if (!isPlainRecord(definition) || !Array.isArray(definition.teachinRecipes)) continue;
    for (const raw of definition.teachinRecipes) {
      const recipe = normalizeRegistryRecipe(atom, raw);
      if (!recipe || ruleIds.has(recipe.ruleId)) continue;
      ruleIds.add(recipe.ruleId);
      recipes.push(recipe);
    }
  }
  return frozen(recipes);
}

// 原子的 action 序列契约：mapping 行的证据动作序列必须与该原子某条 recipe 完全一致。
export function atomAcceptsActionSequence(recipes, atom, actions) {
  return recipes.some((recipe) => recipe.atom === atom
    && recipe.actions.length === actions.length
    && recipe.actions.every((action, index) => action === actions[index]));
}

// 多击配方跨 authored intent 防合并（GRILL D6）：调用方用 boundIntents 声明哪些事件的
// intentId 是 authored 绑定而非合成序数；跨度内含任一已绑定事件且 intentId 不一致，
// 说明这几击分属不同 authored 步，按不匹配处理（fail-closed 落 pending）。
// 不传 boundIntents 时本守卫整条不生效，默认语义零变化。
function spanCrossesBoundIntents(span, boundIntents) {
  if (!boundIntents || span.length < 2) return false;
  if (!span.some((event) => boundIntents.has(event.eventSeq))) return false;
  return new Set(span.map((event) => event.intentId)).size > 1;
}

// 投影行畸形（缺 evidence 或 evidence 非对象）一律按「无语义证据」处理：要求语义证据的
// 配方随即不匹配、事件诚实落 pending，绝不让属性访问抛异常炸穿整个解析
// （联审 code-r1 F3）。
function hasSemanticEvidence(event) {
  const evidence = event?.evidence;
  return isPlainRecord(evidence) && evidence.semanticTextPresent === true;
}

function matchesAt(recipe, businessEvents, start, boundIntents) {
  if (start + recipe.actions.length > businessEvents.length) return false;
  for (let offset = 0; offset < recipe.actions.length; offset += 1) {
    const event = businessEvents[start + offset];
    if (event.action !== recipe.actions[offset]) return false;
    if (recipe.requiresSemanticEvidence && !hasSemanticEvidence(event)) return false;
    // 带槽配方逐位校验语义文本白名单（GRILL D3 v2）；无槽配方行为零变化。
    if (recipe.slots && !recipe.slots[offset].textAnyOf.includes(event.semanticText)) return false;
  }
  // 跨度级 textAnyOf 只对无槽配方生效：带槽配方已逐位判过，不再放宽成「跨度任一命中」。
  if (!recipe.slots && recipe.textAnyOf) {
    const covered = businessEvents
      .slice(start, start + recipe.actions.length)
      .some((event) => recipe.textAnyOf.includes(event.semanticText));
    if (!covered) return false;
  }
  if (spanCrossesBoundIntents(
    businessEvents.slice(start, start + recipe.actions.length), boundIntents,
  )) return false;
  return true;
}

export function resolveCaptureAtoms(options = {}) {
  let projection;
  let registry;
  let boundIntents;
  try {
    if (!options || typeof options !== 'object') return denied('UNSAFE_DATA_SHAPE');
    ({ projection, registry, boundIntents } = options);
  } catch {
    return denied('UNSAFE_DATA_SHAPE');
  }
  if (!Array.isArray(projection)) return denied('UNSAFE_DATA_SHAPE');
  if (!isPlainRecord(registry) || !isPlainRecord(registry.atoms)) {
    return denied('MAPPING_ATOM_UNKNOWN');
  }

  const recipes = collectRecipes(registry);
  const businessEvents = projection.filter((event) => event.role === 'business');
  // 守卫入参 fail-closed（时点必须在业务事件集算出之后、主循环之前）：非 Set 直接拒；
  // 成员须正安全整数，且必须确实是本次投影里的业务事件 eventSeq。放行幽灵 seq 等于
  // 调用方以为声明了绑定、守卫却全程空转——静默失守比早失败危险得多。
  // 成员只经原生 Set.prototype.values 在原始接收者上读取，读完复制进内部原生 Set：
  // 实例 has/values 可被覆写、子类可重写、Proxy 可伪装（联审 code-r1 F2 实锤可绕守卫），
  // 缺 [[SetData]] 内部槽者（Proxy、Map、伪造对象）在此直接抛错转拒付。
  let boundSeqs = null;
  if (boundIntents !== undefined) {
    if (!(boundIntents instanceof Set)) return denied('UNSAFE_DATA_SHAPE');
    let members;
    try {
      members = [...Set.prototype.values.call(boundIntents)];
    } catch {
      return denied('UNSAFE_DATA_SHAPE');
    }
    const businessSeqs = new Set(businessEvents.map((event) => event.eventSeq));
    for (const seq of members) {
      if (!Number.isSafeInteger(seq) || seq <= 0) return denied('UNSAFE_DATA_SHAPE');
      if (!businessSeqs.has(seq)) return denied('UNSAFE_DATA_SHAPE');
    }
    boundSeqs = new Set(members);
  }
  const structural = projection.filter((event) => event.role === 'structural');
  const resolved = [];
  const pending = [];
  let cursor = 0;
  let mappingOrdinal = 0;

  while (cursor < businessEvents.length) {
    const hits = recipes.filter(
      (recipe) => matchesAt(recipe, businessEvents, cursor, boundSeqs),
    );
    const longest = hits.reduce(
      (max, recipe) => Math.max(max, recipe.actions.length),
      0,
    );
    const best = hits.filter((recipe) => recipe.actions.length === longest);
    if (best.length === 1) {
      const recipe = best[0];
      const span = businessEvents.slice(cursor, cursor + recipe.actions.length);
      mappingOrdinal += 1;
      resolved.push(frozen({
        mappingKey: `m${mappingOrdinal}`,
        intentId: span[0].intentId,
        atom: recipe.atom,
        params: frozen(structuredClone(recipe.params)),
        evidenceEventSeqs: frozen(span.map((event) => event.eventSeq)),
        evidenceCompoundKeys: frozen(span.map((event) => event.compoundKey)),
        resolution: 'known',
        ruleId: recipe.ruleId,
      }));
      cursor += recipe.actions.length;
      continue;
    }

    const event = businessEvents[cursor];
    let reason;
    if (best.length > 1) reason = 'KNOWN_RECIPE_AMBIGUOUS';
    else if (SUPPORTED_ACTIONS.has(event.action)) reason = 'KNOWN_RECIPE_MISSING';
    else reason = 'UNSUPPORTED_ACTION';
    pending.push(frozen({
      intentId: event.intentId,
      compoundKey: event.compoundKey,
      eventSeq: event.eventSeq,
      action: event.action,
      reason,
    }));
    cursor += 1;
  }

  const resolutionAuthority = frozen(Object.create(null));
  const record = frozen({
    recipes,
    resolved: frozen(resolved),
    pending: frozen(pending),
    structural: frozen(structural),
  });
  RESOLUTION_STATE.set(resolutionAuthority, record);
  return frozen({
    ok: true,
    atomResolutionAuthority: resolutionAuthority,
    recipes,
    resolved: record.resolved,
    pending: record.pending,
    structural: record.structural,
  });
}

export function readAtomResolutionAuthority(authority) {
  return authority && typeof authority === 'object'
    ? RESOLUTION_STATE.get(authority) || null
    : null;
}
