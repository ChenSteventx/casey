// 实体身份观察准入闭集注册表（C0 地基，per-kind channel/observer 单一事实源）。
//
// 今天 bin/sign.mjs 把「哪个原子产身份观察、观察行必须是什么 kind、来源信封是什么」写死成 agent
// （常量 agent.searchOpen + 硬校验 kind==='agent'）。C0 把这条独木桥泛化成一张按对象种类查的闭集注册表：
//   action policy 声明的原子 → 绑定 kind / required role → provenance 不变量 → 允许的 observation 签发信封。
// 签署时按注册表校验观察行的角色、数量、来源、关联 ID 恰好匹配，不匹配 fail-closed 拒。
// compile 侧则按已登记 kind 的对应 profile 通道数据驱动注入身份 ledger（见 ENTITY_KIND_COMPILE_CHANNELS）。
//
// C0 边界：只登记 agent（agent.searchOpen→agent/subject，与今日 sign.mjs 硬钉逐字等价）；
//   【不登记 workflow 观察原子】（观察通道泛化=C2）、不碰 v2 形式收据链、不加编译器、不改裁定四态。
// provenance 维度锚既有收据内核 lib/entity-semantic-lock.mjs（BINDING_MODES/SOURCES 及其不变量），非新造字段：
//   existing → user-confirmed（母规格「user-approval」即此）；created-in-run → platform-readback。
//
// ── 信任边界（codex R5；写头不镀金）───────────────────────────────────────────────────────────
// 本验证器输入是 Casey compile/确认相产出的【JSON 解析产物】——纯对象/数组/string/number，非任意对抗 JS 对象。
// 故字段校验按 JSON 值域展开：身份 ID 须为非空 string（顺带拒 BigInt/number 型 ID，见 fix「身份字段须非空 string」）。
// codex R5 提的 BigInt/恶意 getter/Proxy 抛异常属【进程内注入】、超出本验证器信任模型：这些不会出现在 JSON 输入面
// （JSON.parse 产物无 getter/Proxy，数字非 BigInt），要挡它们是调用者进程隔离的职责、非本纯函数职责。本模块只对
// 「结构良构但语义 fail-open」的 JSON 输入 fail-closed；对进程内注入型对抗对象不设防（也无从设防，那是另一层边界）。
// 实体 kind 词表：agent 已开观察通道；workflow 入词表但观察原子未登记（C2 才开）。
// 区分「词表内但非该原子绑定 kind」（拒 OBSERVATION_KIND_NOT_BOUND_TO_ATOM）与「词表外 kind」（拒 OBSERVATION_KIND_UNSUPPORTED）。
export const SUPPORTED_ENTITY_KINDS = new Set(['agent', 'workflow']);

function frozenEntry(entry) {
  return Object.freeze({
    boundKind: entry.boundKind,
    requiredRoles: Object.freeze([...entry.requiredRoles]),
    issuer: Object.freeze({ sourceKind: entry.issuer.sourceKind, atom: entry.issuer.atom }),
    allowedBindingModes: Object.freeze([...entry.allowedBindingModes]),
    provenanceByBindingMode: Object.freeze({ ...entry.provenanceByBindingMode }),
  });
}

// 键 = action policy 声明的原子；值 = 该原子的观察准入闭集条目。
// C0 只登记 agent.searchOpen（默认 mutation/subject 单角色，同 sign.mjs 今日语义）。
export const ENTITY_OBSERVATION_REGISTRY = new Map([
  ['agent.searchOpen', frozenEntry({
    boundKind: 'agent',                                              // 该原子绑定的实体 kind
    requiredRoles: ['subject'],                                     // 恰好角色集（终端 click 单 subject 观察）
    issuer: { sourceKind: 'compile-envelope', atom: 'agent.searchOpen' }, // 允许的 observation 签发信封
    allowedBindingModes: ['existing', 'created-in-run'],            // 允许的 bindingMode（锚收据内核 BINDING_MODES 子集）
    provenanceByBindingMode: { existing: 'user-confirmed', 'created-in-run': 'platform-readback' }, // 每 mode 强制的 provenance
  })],
]);

// per-kind compile 通道绑定（bin/compile.mjs ledger 注入的数据驱动源）：
// 已登记观察通道的 kind → 其身份通道在 profile 里的字段名。C0 只登记 agent→profile.agents。
// workflow 虽在 SUPPORTED_ENTITY_KINDS 词表但无观察原子、无 compile 通道（C2 才补）。
export const ENTITY_KIND_COMPILE_CHANNELS = new Map([
  ['agent', Object.freeze({ profileKey: 'agents' })],
]);

const OK = Object.freeze({ ok: true, rejectCode: null });
const reject = (rejectCode) => Object.freeze({ ok: false, rejectCode });

// 身份字段闭集判据（codex R5-Critical①）：身份 ID 须为非空 string（同 preflight nonEmpty 口径 typeof+trim）。
// 顺带拒 undefined/null/空串/纯空白/number/BigInt 型 ID——杜绝两侧同缺时 undefined===undefined 令关联/锚定误成立。
const isNonEmptyString = (value) => typeof value === 'string' && Boolean(value.trim());
// binding / row / 终端 event 各自的身份字段闭集（键构造与五元 join 前先逐字段校验为非空 string）。
const BINDING_IDENTITY_FIELDS = ['intentId', 'stepId', 'atom', 'sourceIntentId', 'candidateId', 'role'];
const ROW_IDENTITY_FIELDS = ['evidenceStepId', 'atom', 'sourceIntentId', 'candidateId', 'role', 'kind'];
const TERMINAL_IDENTITY_FIELDS = ['intentId', 'stepId', 'atom'];

function rolesMatchMultiset(actualRoles, requiredRoles) {
  if (actualRoles.length !== requiredRoles.length) return false;
  const need = [...requiredRoles].sort();
  const got = [...actualRoles].sort();
  return need.every((role, i) => role === got[i]);
}

// 闭集准入判定（纯函数、零 IO、通道无关）。
//   events      —— 编译事件流（推导观察义务：已登记身份原子的终端 click；R1-H5 义务源自 events 非 obs 自报）。
//   observation —— 单信封 { source:{kind,atom}, observations:[row...] }、单信封列表 [信封...] 或 null。
//                  单信封=单原子；C2 加 workflow 时每原子一独立信封、传信封列表即可（codex R3-High）。
//   bindings    —— 绑定草稿行（五元 join 的事实源，且是唯一同持事件 intentId 与观察行 sourceIntentId 的桥）。
//   registry/supportedKinds —— 可注入以便测试；缺省用本模块闭集。
// 返回 { ok, rejectCode }：ok 时 rejectCode=null；拒时 rejectCode 为闭集具名码之一。
//
// ── 可证的双向函数双射（codex R4-Critical①）──────────────────────────────────────────────────
// 把「观察行集合 ↔ 终端义务集合」建成一个双向函数：① 每条观察行恰锚 1 个终端（0 拒 ROW_NOT_ANCHORED、
// >1 拒 ROW_ANCHORS_MULTIPLE_TERMINALS——旧实现只查「存在」匹配 binding，两 binding 仅 intentId 异时一行同时锚
// A/B 两终端仍过=非函数）；② 每个终端恰被 requiredRoles 数量、互不重复的行覆盖（多/少/重复皆拒 ROLE_COUNT_MISMATCH）。
// 行→终端是单值全函数（terminalOfRow 显式配对）、终端→行是 requiredRoles 值函数，二者合成 行↔角色槽 的真双射。
// ── 整体输入 fail-closed（codex R4-High②）──────────────────────────────────────────────────
// 进入配对前先过「结构 + issuer」闸，且不论义务多少都跑：非 null/数组/对象的 observation、畸形信封、非数组
// observations 一律拒 ENVELOPE_MALFORMED；邪恶/越界 source 一律拒 ISSUER_NOT_ALLOWED。杜绝零义务时邪恶空信封
// 早退过关（旧实现零义务只查 allRows.length，邪恶空信封 allRows=0 即 OK）。
// ── 规范信封形式（codex R4-High③）──────────────────────────────────────────────────────────
// 每原子恰一信封（重复原子信封拒 DUPLICATE_ATOM_ENVELOPE——杜绝把多角色拆到多个同原子信封经全局并集蒙混）；
// 每信封原子须有对应终端义务（无对应终端的孤儿信封拒 UNEXPECTED_WITHOUT_OBLIGATION，含零义务时任何信封在场）。
// ── 重复终端不去重（codex R4-High④）────────────────────────────────────────────────────────
// 完全相同的 click 事件三元组 {intentId, stepId, atom} 重复 → 拒 DUPLICATE_TERMINAL（不折叠成一义务令一行满足多
// 事件）；agent 正常事件 stepId 唯一，拒重复对 agent 安全（preflight buildEntityBindingsDraft 亦已拒重复三元组）。
export function validateObservationAdmission({
  events,
  observation,
  bindings,
  registry = ENTITY_OBSERVATION_REGISTRY,
  supportedKinds = SUPPORTED_ENTITY_KINDS,
} = {}) {
  // 0) 整体输入 fail-closed（codex R5-High③）：非数组 events/bindings 不再静默归一 []（旧实现静默吞 → 空义务/空桥
  //    令后续闸空过、缺字段绕过），改具名拒 OBSERVATION_INPUT_MALFORMED。observation 的畸形在 2) 由 ENVELOPE_MALFORMED 兜。
  if (!Array.isArray(events)) return reject('OBSERVATION_INPUT_MALFORMED');
  if (!Array.isArray(bindings)) return reject('OBSERVATION_INPUT_MALFORMED');
  const evts = events;
  const binds = bindings;

  // 0b) 前瞻不变量（codex R5-Medium④）：注册表每条目 requiredRoles 须为非空数组且 role 无重复。畸形条目（空角色集/
  //     重复 role）是配置错误——空集令终端义务恒被 0 行满足、重复 role 令角色多重集恒失真，fail-closed 拒（C2 增广
  //     注册表数据驱动加原子时的护栏）。默认 ENTITY_OBSERVATION_REGISTRY 恒合规、代价仅遍历闭集小 Map。
  for (const [, entry] of registry) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.requiredRoles) || entry.requiredRoles.length === 0
      || new Set(entry.requiredRoles).size !== entry.requiredRoles.length) {
      return reject('OBSERVATION_REGISTRY_ENTRY_INVALID');
    }
  }

  // 0c) 身份字段闭集校验——binding（codex R5-Critical①）：每条 binding 的五元 join 键 + intentId 须为非空 string。
  //     旧实现两侧字段皆缺时 undefined===undefined 让五元关联/终端锚定成立，缺全部身份 ID 的 binding 能桥接出 OK。
  //     binding 是五元 join 的事实源，桥断则整条终端义务落空，故对全部 binding fail-closed（含未被引用的越界 binding）。
  for (const b of binds) {
    if (!b || typeof b !== 'object' || Array.isArray(b) || !BINDING_IDENTITY_FIELDS.every((f) => isNonEmptyString(b[f]))) {
      return reject('OBSERVATION_BINDING_FIELD_INVALID');
    }
  }

  // 1) 从 events 独立推导观察义务：每个「已登记身份原子」的终端 click，用全键 {intentId, stepId, atom} 标识。
  //    未登记原子（孤儿 policy，如 agent.removeToolByName——有 policy 无编译器/无观察通道）不产义务，
  //    不被索要 observation（GRILL D4：策略驱动逻辑不得假设每个 policy 键都有编译器/观察通道）。
  //    codex R4-High④：完全相同的 click 三元组重复 → 拒（旧实现 continue 去重令一行满足多事件）。
  const terminals = []; // { intentId, stepId, atom }
  const seenTerminal = new Set();
  for (const ev of evts) {
    if (!ev || typeof ev !== 'object') continue;
    if (ev.action !== 'click') continue;
    if (!registry.has(ev.atom)) continue;
    // 身份字段闭集校验——终端 event（codex R5-Critical①）：用于终端的 click event 的 intentId/stepId/atom 须为非空
    // string——键构造【前】先闭集校验为 string，消除 JSON.stringify 键歧义（undefined 序列化成 null 令异 event 撞同键/
    // 缺 intentId 的终端令 rowAnchorsTerminal 的 binding.intentId 对齐失真）。
    if (!TERMINAL_IDENTITY_FIELDS.every((f) => isNonEmptyString(ev[f]))) return reject('OBSERVATION_TERMINAL_FIELD_INVALID');
    const key = JSON.stringify([ev.intentId, ev.stepId, ev.atom]);
    if (seenTerminal.has(key)) return reject('OBSERVATION_DUPLICATE_TERMINAL'); // 不去重：重复终端三元组即拒。
    seenTerminal.add(key);
    terminals.push({ intentId: ev.intentId, stepId: ev.stepId, atom: ev.atom });
  }

  // 2) 整体输入结构 + issuer fail-closed 闸（codex R4-High②）：不论义务多少，先规范化并校验每个信封的结构与
  //    签发信封（issuer）合法性。observation 只许 null/单信封对象/信封列表——其余（字符串/数字等真值非对象）拒。
  let envelopes;
  if (observation == null) envelopes = [];
  else if (Array.isArray(observation)) envelopes = observation;
  else if (typeof observation === 'object') envelopes = [observation];
  else return reject('OBSERVATION_ENVELOPE_MALFORMED'); // 真值但非数组/对象（如字符串）：畸形整体输入。
  for (const env of envelopes) {
    if (!env || typeof env !== 'object' || Array.isArray(env)) return reject('OBSERVATION_ENVELOPE_MALFORMED');
    const src = env.source;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return reject('OBSERVATION_ENVELOPE_MALFORMED');
    if (!Array.isArray(env.observations)) return reject('OBSERVATION_ENVELOPE_MALFORMED'); // 非数组 observations 一律拒。
    // 签发信封精确双锚（codex R2-High）：obs.source 须精确等于其 source.atom 在注册表登记的 issuer{sourceKind,atom}。
    const issuerEntry = registry.get(src.atom);
    if (!issuerEntry || issuerEntry.issuer.sourceKind !== src.kind || issuerEntry.issuer.atom !== src.atom) {
      return reject('OBSERVATION_ISSUER_NOT_ALLOWED'); // 邪恶/越界 source（含零义务时的邪恶空信封）即拒。
    }
  }

  // 3) 规范信封形式（codex R4-High③）：每原子恰一信封、每信封原子须有对应终端义务。obligationAtoms=义务原子集；
  //    重复原子信封（把多角色拆到多个同原子信封蒙混）拒；孤儿信封（原子无对应终端，含零义务时任何信封在场）拒。
  const obligationAtoms = new Set(terminals.map((t) => t.atom));
  const seenEnvelopeAtom = new Set();
  for (const env of envelopes) {
    const atom = env.source.atom;
    if (seenEnvelopeAtom.has(atom)) return reject('OBSERVATION_DUPLICATE_ATOM_ENVELOPE'); // 同原子二次信封：拒。
    seenEnvelopeAtom.add(atom);
    if (!obligationAtoms.has(atom)) return reject('OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION'); // 原子无对应终端：孤儿信封。
  }

  // 4) 逐信封逐观察行校验（单信封单原子 / kind / 五元关联 / bindingMode / provenance）。信封结构已在 2) 保证。
  const allRows = [];
  for (const env of envelopes) {
    const issuerAtom = env.source.atom;
    for (const row of env.observations) {
      allRows.push(row);
      if (!row || typeof row !== 'object' || Array.isArray(row)) return reject('OBSERVATION_CORRELATION_MISMATCH');
      // 身份字段闭集校验——观察 row（codex R5-Critical①）：五元 join 键 evidenceStepId/sourceIntentId/candidateId/role/
      // atom + kind 须为非空 string——旧实现两侧字段皆缺时 undefined===undefined 让五元关联/终端锚定成立，缺全部身份
      // ID 的 row 能返 OK。bindingMode/provenance 不入此闸：其专属语义闸（allowedBindingModes / provenanceByBindingMode）
      // 已对缺/空/非 string fail-closed（undefined ∉ 允许集→BINDING_MODE_NOT_ALLOWED；缺 provenance→PROVENANCE_INVALID），
      // 保 c5 具名码不被此通用闸抢先（信任边界注释同款口径：只对 JSON 值域 fail-closed）。
      if (!ROW_IDENTITY_FIELDS.every((f) => isNonEmptyString(row[f]))) return reject('OBSERVATION_ROW_FIELD_INVALID');
      const entry = registry.get(row.atom);
      if (!entry) return reject('OBSERVATION_CORRELATION_MISMATCH'); // 行自报未登记原子 = 五元关联不成立。

      // 单信封单原子（codex R2-High）：一个信封只承载它自己 issuer 原子的行；跨原子混装拒。
      // C2 多身份原子的用例须各自独立信封（本次由信封列表承载），不共信封。
      if (row.atom !== issuerAtom) return reject('OBSERVATION_ISSUER_ATOM_MISMATCH');

      // kind：先词表越界（→UNSUPPORTED），再词表内但非该原子 bound kind（→NOT_BOUND_TO_ATOM）。
      if (!supportedKinds.has(row.kind)) return reject('OBSERVATION_KIND_UNSUPPORTED');
      if (row.kind !== entry.boundKind) return reject('OBSERVATION_KIND_NOT_BOUND_TO_ATOM');

      // 五元关联：evidenceStepId/sourceIntentId/candidateId/role/atom 必须 join 到某 binding 行。
      const correlated = binds.some((b) => b
        && b.stepId === row.evidenceStepId
        && b.sourceIntentId === row.sourceIntentId
        && b.candidateId === row.candidateId
        && b.role === row.role
        && b.atom === row.atom);
      if (!correlated) return reject('OBSERVATION_CORRELATION_MISMATCH');

      // bindingMode 显式允许集（codex R2-Medium）：直接读 allowedBindingModes——不再依赖 provenanceByBindingMode
      // 恰好缺项间接拒。两字段一旦不一致（声明不允许却在 provenance 表登记），此处仍 fail-closed 拒。
      if (!entry.allowedBindingModes.includes(row.bindingMode)) return reject('OBSERVATION_BINDING_MODE_NOT_ALLOWED');

      // bindingMode 换轨闸（codex R5-Critical②）：row.bindingMode 须与其五元 join 命中的 binding 的【权威】bindingMode
      // 一致。bindingMode 是【绑定事实】、活在确认收据里——sign 侧从收据按 binding 五元键富化写进 binding.bindingMode
      // （权威源见 bin/sign.mjs 富化点：row 与 binding 富化自同一收据、五元键相等 → 生产恒一致、逐语义等价零漂移）；
      // 纯函数侧由夹具携 binding.bindingMode。binding 实为 existing 时 row 不得自报 created-in-run+platform-readback 蒙混
      // （provenance 随之绑定绑定事实而非仅行自洽）。置于 allowedBindingModes 之后：c11 越注册表允许集先由上闸具名拒。
      const modeConsistent = binds.some((b) => b
        && b.stepId === row.evidenceStepId
        && b.sourceIntentId === row.sourceIntentId
        && b.candidateId === row.candidateId
        && b.role === row.role
        && b.atom === row.atom
        && b.bindingMode === row.bindingMode);
      if (!modeConsistent) return reject('OBSERVATION_BINDING_MODE_MISMATCH');

      // provenance：须与 bindingMode 匹配注册表登记的不变量（缺失/错配均拒）。
      const expectedProvenance = entry.provenanceByBindingMode[row.bindingMode];
      if (!row.provenance || expectedProvenance == null || row.provenance !== expectedProvenance) {
        return reject('OBSERVATION_PROVENANCE_INVALID');
      }
    }
  }

  // 4b) 反向覆盖（codex R5-Medium⑤）：每义务原子须有对应信封（obligationAtoms ⊆ seenEnvelopeAtom）。旧实现只查
  //     seenEnvelopeAtom ⊆ obligationAtoms（信封→义务方向），缺信封的义务原子仅靠 6) 角色计数 0≠N 间接兜；此处显式正证
  //     双向一一对应。置于逐行校验【后】：在场行的 issuer/kind/关联违规（如 c16 跨原子夹带行）先由 4) 具名拒，此闸只兜
  //     「义务原子整缺信封」（与 c26「信封在场但空 → 终端 0 行 ROLE_COUNT_MISMATCH」互补——那是空信封、此为信封整缺）。
  for (const atom of obligationAtoms) {
    if (!seenEnvelopeAtom.has(atom)) return reject('OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION');
  }

  // 行↔终端锚定谓词（codex R3-Critical① 全键双射核心）：行经其五元 join 命中的 binding 桥到终端。要求存在一条
  // binding，其 {intentId, stepId, atom} 等于终端 t 的全键，且其 {sourceIntentId, candidateId, role} 等于观察行——
  // 即「行 → binding → binding.intentId → 终端 t」。row 只带 sourceIntentId、t 只带 intentId，唯 binding 同持两者，
  // 故 intent 维用 binding.intentId 对齐（非把 sourceIntentId 误当 intentId）。
  const rowAnchorsTerminal = (row, t) =>
    row && row.evidenceStepId === t.stepId && row.atom === t.atom
    && binds.some((b) => b
      && b.intentId === t.intentId && b.stepId === t.stepId && b.atom === t.atom
      && b.sourceIntentId === row.sourceIntentId && b.candidateId === row.candidateId && b.role === row.role);

  // 5) 行→终端是单值全函数（codex R4-Critical①）：每条观察行恰锚 1 个终端。0 个 → ROW_NOT_ANCHORED（额外非终端
  //    步的身份行）；>1 个 → ROW_ANCHORS_MULTIPLE_TERMINALS（两 binding 仅 intentId 异时一行同时锚 A/B=非函数）。
  //    terminalOfRow 记下每行的【唯一】终端，供 6) 反向计数令每行恰计一次（真双射，非旧「存在即计」的关系）。
  const terminalOfRow = new Map();
  for (const row of allRows) {
    const matched = terminals.filter((t) => rowAnchorsTerminal(row, t));
    if (matched.length === 0) return reject('OBSERVATION_ROW_NOT_ANCHORED');
    if (matched.length > 1) return reject('OBSERVATION_ROW_ANCHORS_MULTIPLE_TERMINALS');
    terminalOfRow.set(row, matched[0]);
  }

  // 6) 终端→行是 requiredRoles 值函数（codex R4-Critical①）：每个终端 click（全键 {intentId, stepId, atom}）恰被
  //    requiredRoles 数量、互不重复的行覆盖。用 5) 定的 terminalOfRow 唯一归属计数——每行恰计一次，故多/少/重复
  //    锚同一终端均越界 ROLE_COUNT_MISMATCH。与 5) 合成 行↔角色槽 的真双射。
  for (const terminal of terminals) {
    const entry = registry.get(terminal.atom);
    const assignedRoles = allRows.filter((r) => terminalOfRow.get(r) === terminal).map((r) => r.role);
    if (!rolesMatchMultiset(assignedRoles, entry.requiredRoles)) return reject('OBSERVATION_ROLE_COUNT_MISMATCH');
  }

  return OK;
}
