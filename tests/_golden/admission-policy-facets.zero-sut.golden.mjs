#!/usr/bin/env node
// 准入策略「三面拆分」金牌：纯函数 + 静态源码 + 行为语料回放；零 SUT、零浏览器、零网络、零子进程、零随机。
//
// 判什么（对应 docs/plans/admission-policy-facets/plan.md）：
//   equivalence —— 改写前采的 672 条行为基线逐字节复现（现役行为零改变的判据）
//   facets      —— 三件事真的被分开表达了（三面各自独立可变、两个目标原子可如实描述、旧 effect 是有损投影）
//   authority   —— 三面派生出的 { effect, requiredRoles } 与人签冻结权威源逐字节相等（镜像≡权威）
//   wiring      —— 旧表由三面派生而来，仓里不存在第二张手写 effect 表（防「只换字段名、事实源还是老的」）
//
// 红先行：实现前 facets/authority/wiring 三段必红（导出面不存在），equivalence 段必绿（还没改，当然等价）。

import { readFileSync } from 'node:fs';
import * as admission from '../../lib/entity-semantic-lock-preflight.mjs';
import { runCorpus } from './fixtures/admission-policy-facets/corpus.mjs';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'equivalence', 'facets', 'authority', 'wiring']);
if (!SECTIONS.has(SECTION)) process.exit(2);

const SOURCE_URL = new URL('../../lib/entity-semantic-lock-preflight.mjs', import.meta.url);
const source = readFileSync(SOURCE_URL, 'utf8');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/admission-policy-facets/behavior-baseline.json', import.meta.url), 'utf8'));
const frozenPolicy = JSON.parse(readFileSync(new URL('./fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json', import.meta.url), 'utf8'));

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const json = (value) => JSON.stringify(value);
const facetsOf = (atom) => admission.admissionFacetsForAtom?.(atom);
const ruleOf = (facets) => admission.deriveAdmissionRule?.(facets);

// 三面的期望值（逐原子人工核对冻结策略语义写死，不从实现反推——反推等于自证）。
const EXPECTED_FACETS = new Map([
  ['nav.workflowManagement', { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'none', allowedActions: ['nav'] }],
  ['assert.textVisible', { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'none', allowedActions: ['assert'] }],
  ['workflow.create', { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' }],
  ['workflow.addNode', { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' }],
  ['workflow.setNodeField', { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' }],
  ['workflow.setSwitch', { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' }],
  ['workflow.addNodeInputVar', { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' }],
  ['agent.removeToolByName', { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' }],
  ['workflow.bindAgent', { entityChange: 'relation', identityBindingRoles: ['source', 'target'], nonEntityEffect: 'none' }],
]);
const EXPECTED_UNREGISTERED_FACETS = { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'unknown' };

// 本次要能被如实描述的两个具体原子（本契约只证「表达得出」，不登记进人签冻结表）。
const SEND_AND_WAIT_FACETS = { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'persistent' };
const SEARCH_OPEN_FACETS = { entityChange: 'none', identityBindingRoles: ['subject'], nonEntityEffect: 'none' };

// ── equivalence：行为基线逐字节复现 ──────────────────────────────────────────
test('equivalence', 'Q1 行为语料条数与基线一致（语料被删空不能算等价）', () => {
  const rows = runCorpus(admission);
  assert(Array.isArray(baseline) && baseline.length >= 600, `基线语料过少：${baseline.length}`);
  assert(rows.length === baseline.length, `语料条数漂移：现 ${rows.length} / 基线 ${baseline.length}`);
});

test('equivalence', 'Q2 672 条准入行为逐条逐字节等价（现役行为零改变）', () => {
  const rows = runCorpus(admission);
  const drift = [];
  for (let i = 0; i < baseline.length; i += 1) {
    const expected = baseline[i];
    const actual = rows[i];
    if (!actual || actual.id !== expected.id) { drift.push(`#${i} id ${actual?.id} ≠ ${expected.id}`); continue; }
    if (json(actual.out) !== json(expected.out)) drift.push(`${expected.id}: 现 ${json(actual.out)} ≠ 基线 ${json(expected.out)}`);
  }
  assert(drift.length === 0, `行为漂移 ${drift.length} 条：${drift.slice(0, 5).join(' | ')}`);
});

test('equivalence', 'Q3 基线本身有判别力（覆盖放行/拒绝/绑定投影三类结局，不是一片同值）', () => {
  const kinds = new Set(baseline.map(({ out }) => (
    out === true || out === false ? `bool:${out}`
      : Array.isArray(out) ? 'bindings'
        : out && out.ok === true ? 'allow'
          : out && out.reason ? `deny:${out.reason}` : 'other')));
  assert(kinds.has('bool:true') && kinds.has('bool:false'), '基线缺副作用分类的正反两向');
  assert(kinds.has('allow') && kinds.has('bindings'), '基线缺放行/绑定投影结局');
  assert([...kinds].filter((k) => k.startsWith('deny:')).length >= 5, '基线拒绝原因种类过少，判别力不足');
});

// ── facets：三件事被分开表达 ────────────────────────────────────────────────
test('facets', 'F0 三面表达面已导出（admissionFacetsForAtom / deriveAdmissionRule / admissionFacetAtoms / admissionPolicyForAtom）', () => {
  for (const name of ['admissionFacetsForAtom', 'deriveAdmissionRule', 'admissionFacetAtoms', 'admissionPolicyForAtom']) {
    assert(typeof admission[name] === 'function', `缺导出 ${name}`);
  }
});

test('facets', 'F1 九个已登记原子的三面逐条如实（结构性变更 / 身份钉定角色 / 非实体持久副作用）', () => {
  for (const [atom, expected] of EXPECTED_FACETS) {
    const actual = facetsOf(atom);
    assert(actual, `${atom} 无三面`);
    assert(actual.entityChange === expected.entityChange, `${atom}.entityChange = ${actual.entityChange}，应 ${expected.entityChange}`);
    assert(json([...actual.identityBindingRoles]) === json(expected.identityBindingRoles), `${atom}.identityBindingRoles = ${json(actual.identityBindingRoles)}，应 ${json(expected.identityBindingRoles)}`);
    assert(actual.nonEntityEffect === expected.nonEntityEffect, `${atom}.nonEntityEffect = ${actual.nonEntityEffect}，应 ${expected.nonEntityEffect}`);
    if (expected.allowedActions) assert(json([...actual.allowedActions]) === json(expected.allowedActions), `${atom}.allowedActions 漂移`);
  }
});

test('facets', 'F2 三面互相独立：任一面单独变化都改变派生准入（没有一面是装饰）', () => {
  const clean = { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'none', allowedActions: ['nav'] };
  assert(ruleOf(clean)?.effect === 'read', '三面全清白应派生 read');
  assert(ruleOf(clean)?.admissionClass === 'unbound-read', '三面全清白应落 unbound-read 档');
  const changed = ruleOf({ entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none' });
  assert(changed?.effect === 'mutation', '结构性变更面失效：entity 未派生 mutation');
  const relation = ruleOf({ entityChange: 'relation', identityBindingRoles: ['source', 'target'], nonEntityEffect: 'none' });
  assert(relation?.effect === 'relation', '结构性变更面失效：relation 未派生 relation');
  const pinned = ruleOf({ entityChange: 'none', identityBindingRoles: ['subject'], nonEntityEffect: 'none' });
  assert(pinned?.effect !== 'read', '身份钉定面失效：要钉身份的原子仍走零绑定只读通道');
  assert(json([...pinned.requiredRoles]) === json(['subject']), '身份钉定面未落到 requiredRoles');
  const persistent = ruleOf({ entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'persistent' });
  assert(persistent?.effect !== 'read', '非实体持久副作用面失效：留痕原子仍走零绑定只读通道');
  const unknownEffect = ruleOf({ entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'unknown' });
  assert(unknownEffect?.effect !== 'read', '副作用未知也不得走只读通道（保守）');
});

test('facets', 'F2b 第四面（目标身份连续性）与身份钉定角色可分离，且由纯守卫单一供源', () => {
  const create = admission.admissionPolicyForAtom?.('workflow.create');
  assert(create, 'workflow.create 无聚合策略');
  assert(json([...create.identityBindingRoles]) === json(['subject']) && create.targetContinuity === 'none',
    '反例失效：workflow.create 要 subject 绑定但不要连续性——两面必须分开');
  const del = admission.admissionPolicyForAtom?.('agent.delete');
  assert(del?.targetContinuity === 'same-platform-id',
    '反例失效：agent.delete 不在策略表却要连续性——第四面必须由纯守卫供源');
  assert(!admission.admissionFacetAtoms().includes('agent.delete'), 'agent.delete 被重复登记进策略表（第四面被复制了一份）');
  assert(admission.admissionPolicyForAtom('agent.searchOpen')?.targetContinuity === 'none',
    'agent.searchOpen 是身份敏感读取但非破坏原子，不得被索要连续性');
});

test('facets', 'F3 chat.sendAndWait 可如实描述：不改业务实体 + 无身份可钉 + 有非实体持久副作用', () => {
  const rule = ruleOf(SEND_AND_WAIT_FACETS);
  assert(rule, 'chat.sendAndWait 的三面表达不出来（deriveAdmissionRule 拒收）');
  assert(rule.effect !== 'read', '有持久副作用却派生成只读，等于零绑定放行——fail-open');
  assert(rule.admissionClass === 'unsupported', '「有持久副作用但无身份可钉」必须落 unsupported 档（现无合法通道）');
  assert(rule.effect === null, 'unsupported 行不得有旧 effect 投影（否则退回实测过的 mutation + [] fail-open）');
  assert(json([...rule.requiredRoles]) === json([]), '无身份可钉的原子不得被索要虚构绑定角色');
});

test('facets', 'F3b unsupported 档在生产查表处一律 fail-closed，绝不退化成 mutation + 空角色集', () => {
  // 实测过的洞（scratchpad/probe-empty-roles2.mjs）：{effect:'mutation', requiredRoles:[]} 会被零绑定
  // 已签冻结件放行（inspectBindings 收空集 + expectedRoles 精确匹配零角色）——所以任何面组合都不许派生出这种行。
  const combos = [];
  for (const entityChange of ['none', 'entity', 'relation']) {
    for (const nonEntityEffect of ['none', 'persistent', 'unknown']) {
      for (const identityBindingRoles of [[], ['subject'], ['source', 'target']]) {
        combos.push({ entityChange, identityBindingRoles, nonEntityEffect });
      }
    }
  }
  for (const facets of combos) {
    const rule = ruleOf(facets.entityChange === 'none' && facets.identityBindingRoles.length === 0 && facets.nonEntityEffect === 'none'
      ? { ...facets, allowedActions: ['nav'] } : facets);
    assert(rule, `合法面组合被拒：${json(facets)}`);
    const zeroRoleNonRead = rule.effect !== 'read' && Array.isArray(rule.requiredRoles) && rule.requiredRoles.length === 0;
    assert(!zeroRoleNonRead || rule.admissionClass === 'unsupported',
      `面组合 ${json(facets)} 派生出 fail-open 行「非只读 + 空角色集」`);
    // unsupported 行没有合法旧投影：effect 必须是 null，读到它的消费方走各自的 !policy fail-closed 分支。
    assert(rule.admissionClass !== 'unsupported' || rule.effect === null,
      `unsupported 档仍给出旧 effect 投影（${rule.effect}）：会被当成普通 mutation 放行`);
  }
});

test('facets', 'F4 agent.searchOpen 可如实描述：不改业务实体 + 身份敏感读取 + 无持久副作用', () => {
  const rule = ruleOf(SEARCH_OPEN_FACETS);
  assert(rule, 'agent.searchOpen 的三面表达不出来（deriveAdmissionRule 拒收）');
  assert(rule.effect !== 'read', '身份敏感读取仍走零绑定只读通道 = 身份不被钉');
  assert(rule.admissionClass === 'entity-lock', '身份敏感读取应落实体锁档');
  assert(json([...rule.requiredRoles]) === json(['subject']), '身份敏感读取须钉 subject 身份');
  assert(SEARCH_OPEN_FACETS.entityChange === 'none' && SEND_AND_WAIT_FACETS.entityChange === 'none',
    '两个原子都不改业务实体，这一面必须与「要不要绑定」分开表达');
});

test('facets', 'F5 旧 effect 字段是有损投影：语义不同的两行塌成同一个旧读法，还有旧三值全描述不了的第三种', () => {
  const searchOpen = ruleOf(SEARCH_OPEN_FACETS);
  const create = ruleOf(EXPECTED_FACETS.get('workflow.create'));
  // ① 塌缩：身份敏感读取（不改业务实体）与真改业务实体，旧读法逐字节相同——旧字段分不开它们
  assert(json({ effect: searchOpen.effect, requiredRoles: [...searchOpen.requiredRoles] })
    === json({ effect: create.effect, requiredRoles: [...create.requiredRoles] }),
  '前提失效：agent.searchOpen 的旧投影本应与 workflow.create 逐字节相同');
  assert(SEARCH_OPEN_FACETS.entityChange !== EXPECTED_FACETS.get('workflow.create').entityChange,
    '三面必须能区分「身份敏感读取」与「真改业务实体」——否则拆分没发生');
  // ② 旧三值全错的第三种：有持久副作用但无身份可钉。read = 零绑定放行（fail-open）；
  //    非只读 + 空角色集 = 实测过的同一个 fail-open；索要 subject = 虚构绑定。三面才描述得了。
  const sendAndWait = ruleOf(SEND_AND_WAIT_FACETS);
  assert(!['read', 'mutation', 'relation'].includes(sendAndWait.effect),
    `旧三值之一被用来描述「有持久副作用但无身份可钉」：${sendAndWait.effect}`);
  assert(sendAndWait.admissionClass === 'unsupported', '第三种情形未落独立档，等于又被塞回旧三值');
  assert(SEND_AND_WAIT_FACETS.nonEntityEffect !== EXPECTED_FACETS.get('workflow.create').nonEntityEffect
    && SEND_AND_WAIT_FACETS.entityChange !== EXPECTED_FACETS.get('workflow.create').entityChange,
  '三面必须能区分「真改业务实体」与「只有持久副作用」——否则拆分没发生');
});

test('facets', 'F6 未登记原子的默认三面保守，且派生回拆分前的逐字节默认', () => {
  for (const atom of ['future.unknownAtom', 'chat.sendAndWait', 'agent.searchOpen', 'x.y']) {
    const facets = facetsOf(atom);
    assert(facets, `${atom} 无默认三面`);
    assert(facets.entityChange === EXPECTED_UNREGISTERED_FACETS.entityChange
      && json([...facets.identityBindingRoles]) === json(EXPECTED_UNREGISTERED_FACETS.identityBindingRoles)
      && facets.nonEntityEffect === EXPECTED_UNREGISTERED_FACETS.nonEntityEffect,
    `${atom} 默认三面被放松：${json(facets)}`);
    const rule = ruleOf(facets);
    assert(json({ effect: rule.effect, requiredRoles: [...rule.requiredRoles] })
      === json({ effect: 'mutation', requiredRoles: ['subject'] }),
    `${atom} 默认派生不再是 mutation + [subject]`);
  }
});

test('facets', 'F7 三面输入畸形一律 fail-closed（null，不猜、不降级）', () => {
  const bad = [
    null, undefined, 'read', 42, [],
    {},
    { entityChange: 'bogus', identityBindingRoles: [], nonEntityEffect: 'none' },
    { entityChange: 'none', identityBindingRoles: 'subject', nonEntityEffect: 'none' },
    { entityChange: 'none', identityBindingRoles: ['mystery'], nonEntityEffect: 'none' },
    { entityChange: 'none', identityBindingRoles: ['subject', 'subject'], nonEntityEffect: 'none' },
    { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'maybe' },
    { entityChange: 'none', identityBindingRoles: [] },
    { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'none', extra: 1 },
    // allowedActions 与只读档联锁：非只读行不得携、只读行必须携非空（顾问 Medium-3）
    { entityChange: 'entity', identityBindingRoles: ['subject'], nonEntityEffect: 'none', allowedActions: ['nav'] },
    { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'none', allowedActions: [] },
    { entityChange: 'none', identityBindingRoles: [], nonEntityEffect: 'none' },
  ];
  for (const value of bad) assert(ruleOf(value) === null, `畸形三面被接受：${json(value)}`);
  for (const value of ['', ' ', null, undefined, 42, {}]) {
    assert(facetsOf(value) === null, `畸形 atom 被接受：${json(value)}`);
  }
});

test('facets', 'F8 三面记录与派生结果均冻结（消费方改不动策略）', () => {
  const facets = facetsOf('workflow.bindAgent');
  assert(Object.isFrozen(facets) && Object.isFrozen(facets.identityRoles), '三面记录未冻结');
  const rule = ruleOf(facets);
  assert(Object.isFrozen(rule) && Object.isFrozen(rule.requiredRoles), '派生结果未冻结');
});

// ── authority：镜像 ≡ 人签冻结权威源 ────────────────────────────────────────
test('authority', 'A1 三面派生的 { effect, requiredRoles } 与人签冻结策略件逐字节相等', () => {
  assert(Array.isArray(frozenPolicy.atoms) && frozenPolicy.atoms.length === 9, '冻结策略件形态变了');
  for (const row of frozenPolicy.atoms) {
    const rule = ruleOf(facetsOf(row.atom));
    assert(rule, `${row.atom} 派生不出准入规则`);
    assert(rule.effect === row.effect, `${row.atom}.effect 镜像 ${rule.effect} ≠ 权威 ${row.effect}`);
    assert(json([...rule.requiredRoles]) === json(row.requiredRoles),
      `${row.atom}.requiredRoles 镜像 ${json(rule.requiredRoles)} ≠ 权威 ${json(row.requiredRoles)}`);
  }
});

test('authority', 'A2 生产镜像不得比人签权威多登记原子（加原子是 ADR-0004 人签事件）', () => {
  const mirrored = [...admission.admissionFacetAtoms()].sort();
  const authorized = frozenPolicy.atoms.map((row) => row.atom).sort();
  assert(json(mirrored) === json(authorized), `镜像原子集 ${json(mirrored)} ≠ 权威原子集 ${json(authorized)}`);
});

test('authority', 'A3 未登记原子的派生 effect 与权威件 unknownEffect 一致', () => {
  const rule = ruleOf(facetsOf('future.unknownAtom'));
  assert(rule.effect === frozenPolicy.unknownEffect, `未登记默认 ${rule.effect} ≠ 权威 unknownEffect ${frozenPolicy.unknownEffect}`);
});

test('authority', 'A4 三面本身也被人签权威源钉住（不是只签旧 effect、三面在镜像里自说自话）', () => {
  assert(frozenPolicy.schemaVersion === 2, '权威源未升到带三面的 schemaVersion 2');
  for (const row of frozenPolicy.atoms) {
    const facets = facetsOf(row.atom);
    assert(row.facets, `${row.atom} 权威源缺三面`);
    assert(facets.entityChange === row.facets.entityChange, `${row.atom}.entityChange 镜像 ≠ 权威`);
    assert(json([...facets.identityBindingRoles]) === json(row.facets.identityBindingRoles), `${row.atom}.identityBindingRoles 镜像 ≠ 权威`);
    assert(facets.nonEntityEffect === row.facets.nonEntityEffect, `${row.atom}.nonEntityEffect 镜像 ≠ 权威`);
    const mirroredActions = facets.allowedActions ? [...facets.allowedActions] : null;
    const authorizedActions = row.facets.allowedActions ? [...row.facets.allowedActions] : null;
    assert(json(mirroredActions) === json(authorizedActions), `${row.atom}.allowedActions 镜像 ≠ 权威`);
  }
  const unknown = facetsOf('future.unknownAtom');
  assert(frozenPolicy.unknownFacets, '权威源缺未登记原子的默认三面');
  assert(unknown.entityChange === frozenPolicy.unknownFacets.entityChange
    && json([...unknown.identityBindingRoles]) === json(frozenPolicy.unknownFacets.identityBindingRoles)
    && unknown.nonEntityEffect === frozenPolicy.unknownFacets.nonEntityEffect,
  '未登记默认三面 镜像 ≠ 权威');
});

// ── wiring：三面是唯一事实源 ────────────────────────────────────────────────
test('wiring', 'W1 策略表以三面声明（ATOM_ADMISSION_FACETS 在场）', () => {
  assert(/const\s+ATOM_ADMISSION_FACETS\s*=\s*new Map\(/.test(source), '未见三面策略表声明');
  for (const facet of ['entityChange', 'identityBindingRoles', 'nonEntityEffect']) {
    assert(source.includes(facet), `三面缺 ${facet}`);
  }
});

test('wiring', 'W2 旧 effect 表由三面派生，不是第二张手写表', () => {
  assert(/SIDE_EFFECT_POLICY\s*=\s*new Map\(\s*\[\s*\.\.\.\s*ATOM_ADMISSION_FACETS\s*\]/.test(source),
    '旧策略表不是从三面派生（仍是手写逐原子表 = 事实源没换）');
  const literalRows = source.match(/\[\s*'[a-z][A-Za-z]*\.[A-Za-z]+'\s*,\s*Object\.freeze\(\{\s*effect:/g) || [];
  assert(literalRows.length === 0, `仍有 ${literalRows.length} 行逐原子手写 effect 表`);
});

test('wiring', 'W3 旧读法的三个取值只在派生函数里被产出（唯一投影点）', () => {
  // 注释里写「等价于 effect !== 'read'」这类说明不算产出，扫描前按行剥注释（偏移一并在剥后文本上算）。
  const source = readFileSync(SOURCE_URL, 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
  const start = source.indexOf('export function deriveAdmissionRule');
  assert(start > 0, '缺 deriveAdmissionRule 派生函数');
  // 花括号配平定位函数体，别用「下一个换行加右花括号」那种脆定位。
  const bodyStart = source.indexOf('{', start);
  let depth = 0; let end = -1;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  assert(end > bodyStart, 'deriveAdmissionRule 函数体定位失败');
  const body = source.slice(bodyStart, end);
  for (const value of ["'read'", "'mutation'", "'relation'"]) {
    assert(body.includes(value), `派生函数里没有 ${value}，投影点不明`);
  }
  // 'mutation' 是纯投影值（不是任何面的取值、也没有别处比较它）：出现在派生函数外 = 第二处投影点。
  for (const match of [...source.matchAll(/'mutation'/g)]) {
    assert(match.index > bodyStart && match.index < end,
      `'mutation' 出现在派生函数外（偏移 ${match.index}）：第二处投影点会悄悄漂移`);
  }
  // 'read' 在别处只许作比较（policy.effect === 'read'），不许作产出（赋值/对象字面量/return）。
  // 产出 = 对象字面量 / 赋值 / return；比较（=== / !==）不算，故赋值号前不许再跟 = ! < >。
  for (const match of [...source.matchAll(/(?:effect:\s*|(?<![=!<>])=\s*|return\s+)'(?:read|relation)'/g)]) {
    assert(match.index > bodyStart && match.index < end,
      `旧读法取值在派生函数外被产出（偏移 ${match.index}）`);
  }
});

test('wiring', 'W4 副作用分类走三面判据（不是字符串比较），且连续性 ref 判据仍委派纯守卫', () => {
  assert(/function\s+containsMutation[\s\S]{0,400}?unboundReadAdmissible\(/.test(source),
    'containsMutation 未按三面判据分类');
  assert(source.includes("from './entity-destructive-continuity.mjs'") && source.includes('continuityRefRequired'),
    '目标身份连续性判据不再委派纯守卫（动作时刻那一面被并进策略表 = 又混一次）');
});

test('wiring', 'W5 unsupported 档在查表出口被判死（policyForAtom 返 null，走各消费点既有 fail-closed 分支）', () => {
  assert(/function\s+policyForAtom[\s\S]{0,400}?admissionClass\s*===\s*'unsupported'[\s\S]{0,80}?null/.test(source),
    'policyForAtom 未把 unsupported 档判成 null（会被当普通 mutation 放行）');
  assert(/function\s+legacyEventProjectionPolicyForAtom[\s\S]{0,500}?unsupported/.test(source),
    '遗留 event 投影未处理 unsupported 档');
  assert(/requiredRoles:\s*null/.test(source),
    '遗留 event 投影的「三角色任一且恰一个」默认被合并掉了（未登记 event 的 source/target 会由合法变 invalid）');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  admission-policy-facets: ${failure}`);
  console.error(`RED  admission-policy-facets/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   admission-policy-facets/${SECTION}: ${passed}/${passed} 全过（纯函数/静态，零 SUT）`);
