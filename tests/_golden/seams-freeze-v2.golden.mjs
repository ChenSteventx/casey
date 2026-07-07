#!/usr/bin/env node
// 冻结黄金标准（排期 v3 轨 P·借鉴接缝 v2 增冻）：校验四条接缝 schema + 合成 fixture 的解析与关键不变量。
// 钉死 run-history / action-vocabulary / failure-ledger-entry / channel-driver 四组接缝。
// 动作真值源读已冻 events.schema 的 action 枚举（决策 2.1），四接缝的 action ⊆ 它。
// 纯结构 + 不变量校验 + 内置 draft-07 子集校验器（零依赖 hermetic，R3-F4）。改本文件 = Test Ratchet 判红。
// codex 异构评审 R1 续钉：hard invariant 须在 schema 层钉住（非仅抽查 fixture）——
//   补 schema-encoding 元检查：coordinateFallback.allowed const:false / channel web coordinateSpace if-then null（ADR-0003）、
//   run-history valueRef pattern（护栏 #7 value 侧）、failure-ledger failedAssertion⟺assertionKind allOf（护栏 #17）；及 valueRef 值内容校验。
//   跨字段相等（fingerprintInputs 与顶层）与跨文件互链（driverId）draft-07 表达不了，仍由本 golden 校验（已在四接缝块）。
// codex 异构评审 R2 续钉：F1 failedAssertion.kind/op 与 fingerprintInputs 值相等（非仅存在性）；
//   F2 fingerprint 真算——复算 sha256(canonicalJSON(fingerprintInputs)) 比对，fixture 指纹从合成占位升级为真值（运行期同函数 route:human）；
//   F3 评估后拒删 run-history coord_fallback，代之以可表征锁（词汇与 StepAxes 动作轴 resolution 同源对齐，措辞见 R3 修正）。
// codex 异构评审 R3 续钉：互链改双向（vocabulary→driver 反向存在性也校）；assertionKind/assertionOp 成对（null 同 null，schema+golden 双层）；
//   whenUnsupported=NEEDS_HUMAN ⟹ needsHumanReason 必填子类（护栏 #14 schema 层机制化）；
//   F4 收口——内置 draft-07 子集校验器把四 fixture 真过各自 schema（fail-closed：未实现关键字/format 即报错、绝不静默欠校验），撤「hermetic 无 validator」挂账；
//   coord_fallback 措辞修正：强制 ambiguous→NEEDS_HUMAN 发生在 点击身份门→StepAxes 动作轴→verdict.mjs 链上；run-history 是只读诊断台账、绝不进裁判，仅以同一词汇如实记录该结局。
// codex 异构评审 R4 续钉：护栏 #7 value 侧——urlTemplate pattern 拒 query 串凭据 + signatureTemplate pattern 拒 raw CSS/坐标（均 schema 层）
//   + golden 四 fixture 字符串值现实形状扫描（query/kv 凭据、授权头、邮箱、密钥前缀；多词短语/本地化 PII 依 layer3-wiring 评审裁决出此层范围、由运行期凭据兜底门按 site.json 字面量兜真凭据）；
//   join 一致性补包含关系：vocabulary entry 声明的驱动，其 actionSpace 必须真含该 action（防「词汇表声称有实现、驱动能力表不支持」的矛盾治理面）。
// codex 异构评审 R5 续钉：F1 校验器 fail-closed 补 walkSchema 全量预扫——validateSchema 只走 fixture 实际触达的分支，
//   未触达分支里的未知关键字/format 会静默漏过；预扫与数据无关、递归遍历 schema 全部节点先拦，兑现「绝不静默欠校验」。
//   F2 coordinateFallback.onlyVia 入 required（省略字段绕 const:null 的口子封死）+ 元检查断言 required 含 onlyVia；
//   F3 signatureTemplate pattern 负向收紧：name 段拒 css=/xpath=/nth-child/坐标对（x=1,y=2）偷渡 + 金丝雀扩负向变体；
//   F4 治理面唯一性：entries[].action / drivers[].driverId / actionSpace[].action 拒重复（draft-07 表达不了按 key 唯一，
//   uniqueItems 只拒全同对象、拒不了同 action 不同治理的冲突条目，归 golden——同跨字段相等/跨文件互链惯例；schema 辅以 entries maxItems 镜像 7 枚举）。
// codex 异构评审 R6 续钉：F1 value 扫描第一条正则漏字符串起始 kv 凭据（token=… 无前缀分隔符不中）——改 (^|[?&#;\s]) 边界 + 扫描器自测金丝雀（防被静默放宽）；
//   F2 signatureTemplate name 段再收紧：拒结构字符 []>+~ 与大小写 css=/xpath= 变体（[data-testid=…]/button.primary>span/CSS= 偷渡）+ 金丝雀扩变体；
//   F3 join 补通道一致性：entry 所指驱动的实际 channel 必须 ∈ entry.channels（防「词汇表说 web 可用、驱动实际 cef」矛盾治理面；
//   多 channel 全覆盖校验——每个声明 channel 都有对应驱动能力——随真机多驱动落地 route:human，当前 entry.driver 单指针先钉包含关系）。
// codex 异构评审 R7 续钉：F1 禁字段 key 扫描由精确匹配改子串匹配（accessToken/client_secret/sessionCookie 等复合字段名此前漏检）+ 扫描器自测金丝雀；
//   F2 signatureTemplate name 段改保守负字符集：加禁 =/.:,'\"()* 与 /（button.primary、//button、:has-text(…)、left=742,top=318 无处容身）；
//   F3 walkSchema 预扫补关键字值元校验：pattern 必须可编译、required/enum/type/properties 等形态必须合法、文档内 $ref 必须可解析（未触达分支的坏 schema 也拦）；
//   F4 schema 硬编码 action 枚举与真值源全等比对：run-history/action-vocabulary/channel-driver 三处 enum 必须 === events.schema 枚举、entries.maxItems === 枚举长度（防 schema 私自扩 tap 而 fixture 不用、assertValid 仍绿的治理边界破口）。
// codex 异构评审 R8 续钉：F1 value 侧 kv 凭据检测由固定词表正则升级为「kv key 提取 + normalize 子串匹配」（client_secret=/refresh_token=/access-token=/session_id= 等复合变体此前全漏）；
//   F2 校验器/预扫对 null 子 schema 拒收（null 不是合法 draft-07 schema——把属性 schema 改 null 即静默移除约束）+ properties/definitions 须非数组 object、allOf/anyOf/oneOf 须数组、数组边界须非负整数；
//   F3 failure-ledger 顶层 required 补 atom/failedAssertion/forensicsRef（「无则 null」的稳定形状字段必须显式出现，省略即削弱台账形状稳定与 fingerprintInputs 同名一致防漂移）+ 元检查钉住。
// codex 异构评审 R9 续钉：F1（修正采纳）SUT_DEFECT 须至少携一个非 null 证据指针（failedAssertion 或 forensicsRef，schema anyOf + golden 双层）——
//   codex 原建议「必须 failedAssertion」被否：按 ADR-0002 与 layer3-wiring 评审裁决，SUT_DEFECT 可仅由 5xx/pageerror/crash 背书而无失败断言；零证据指针才违「证不出→NEEDS_HUMAN」。
//   F2 预扫补 schema 属性名禁字段扫描（schema 声明可选 accessToken 字段、fixture 不用则此前不红，producer 却可合法产出）；
//   F3 kv 提取升级 [:=] 双分隔符 + 可选引号（token: SECRET / "accessToken":"SECRET" / X-Api-Key: abc 此前全漏）；
//   F4 allOf/anyOf/oneOf 拒空数组（draft-07 非法且真空放行，未钉分支可被清空约束）；F5 join 补 call 全等（词汇表与驱动两处实现指针防漂移）。
// codex 异构评审 R10 续钉：F1 SUT_DEFECT 的取证背书须真信号非装饰——forensicsRef 支钉 attributedStepId 必填 string（pattern atstep_N）
//   + 失败信号 anyOf（status≥500 / status 0 / 错误信封字段 string），golden 再验归因等于本步 stepId（镜像 verdict.mjs 背书语义）；
//   F2 字段名字符串扫描——禁字段名可编码成字符串值绕过 key 扫描（requiredEventFields:["accessToken"]、fieldPath 路径段、errorEnvelopeField），
//   normalize 追加去点号（api.key 形态此前绕过 findForbiddenKey）；F3 run-metrics 聚合复算——totalSteps/passedActions/caseId/locatorHitRate
//   与 runHistoryLines 逐项对账、totalDurationMs≥Σ durationMs、quietPointWaitMs≤totalDurationMs（不复算即可冻结自相矛盾的诊断接缝）。
// codex 异构评审 R11 续钉：F1 空串证据封口——kind/op/fieldPath/assertionKind/assertionOp/errorEnvelopeField 加非空白 pattern，
//   SUT_DEFECT 的断言证据支再要求 expectedTemplate/actualTemplate 不得同时为 null（空壳诊断快照不当证据）；
//   F2 混合证据也钉——SUT_DEFECT 携任何非 null forensicsRef 都须真背书（归因本步 + 失败信号），golden 去掉「仅 forensicsRef-only 才查」的条件；
//   F3 locatorResolution 与 action 类别绑定——nav/newpage/press ⟹ null、click/dblclick/fill/selectOption ⟹ 非 null（schema if/then + golden 逐行），
//   防无定位动作污染 locatorHitRate 分母；F4 占位符携名封口——valueRef 的 {{...}} 内部名过字段名扫描（{{accessToken}} 不再绕过护栏 #7 key 侧）。
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const S = (p) => join(ROOT, 'tests', '_golden', 'schemas', p);
const F = (p) => join(ROOT, 'tests', '_golden', 'fixtures', 'seams-v2', p);

const fail = (m) => { console.error(`RED  seams-freeze-v2: ${m}`); process.exit(1); };
const load = (p, label) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`${label} 读/解析失败（${p}）：${e.message}`); } };

// 指纹参考 canonicalization（codex 评审 R1-F2）：递归排序 key 的稳定序列化 + sha256 复算。
// 冻结层用它把 fixture 的 fingerprint 从「合成占位」升级为真算值、并在 golden 复算比对（让冻结层指纹非装饰）；
// 运行期 producer 复用同一 canonicalization 仍走 route:human（prd observability 明列「fingerprint 哈希函数确定性随真机集成落地」）。
const stableStringify = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
};
const fingerprintOf = (inputs) => 'sha256:' + createHash('sha256').update(stableStringify(inputs), 'utf8').digest('hex');

// draft-07 子集校验器（codex R3-F4 闭合）：fixture 真过 schema、不再只解析+手写抽查。
// 零依赖 hermetic；fail-closed——遇未实现的校验关键字/format 一律报错（绝不静默欠校验），
// schema 将来用到新关键字时本 golden 必须同步扩展（Test Ratchet 锁改动）。
const ANNOTATION_KEYS = new Set(['$schema', '$id', 'title', 'description', 'definitions', 'default', 'examples']);
const KNOWN_KEYS = new Set(['$ref', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'pattern', 'minimum', 'maximum', 'format', 'allOf', 'anyOf', 'oneOf', 'if', 'then', 'else']);
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : (typeof v === 'number' && Number.isInteger(v)) ? 'integer' : typeof v);
const sameJson = (a, b) => stableStringify(a) === stableStringify(b);
function validateSchema(schema, data, root, path, errs) {
  if (schema === true) return;
  if (schema === false) { errs.push(`${path}: schema false 拒绝一切`); return; }
  // codex R8-F2：null 不是合法 draft-07 schema——当 true 放行等于「把属性 schema 改 null 即静默移除约束」，fail-closed 拒收。
  if (schema == null || typeof schema !== 'object' || Array.isArray(schema)) { errs.push(`${path}: 非法 schema 节点（须 object/boolean，实为 ${schema === null ? 'null' : Array.isArray(schema) ? 'array' : typeof schema}）`); return; }
  for (const k of Object.keys(schema)) {
    if (!ANNOTATION_KEYS.has(k) && !KNOWN_KEYS.has(k)) { errs.push(`${path}: 校验器未实现 schema 关键字「${k}」（fail-closed，须同步扩展本 golden）`); return; }
  }
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/')) { errs.push(`${path}: 只支持文档内 $ref（${schema.$ref}）`); return; }
    let t = root; for (const seg of schema.$ref.slice(2).split('/')) t = t && t[seg];
    if (!t) { errs.push(`${path}: $ref ${schema.$ref} 解析失败`); return; }
    validateSchema(t, data, root, path, errs); return; // draft-07：$ref 生效时同级其余关键字忽略
  }
  const dt = typeOf(data);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => t === dt || (t === 'number' && dt === 'integer'))) { errs.push(`${path}: type 期望 ${types.join('|')}，实为 ${dt}`); return; }
  }
  if ('const' in schema && !sameJson(data, schema.const)) errs.push(`${path}: const 不匹（期望 ${JSON.stringify(schema.const)}，实为 ${JSON.stringify(data)}）`);
  if (schema.enum && !schema.enum.some((v) => sameJson(v, data))) errs.push(`${path}: 值 ${JSON.stringify(data)} 不在 enum`);
  if (schema.pattern != null && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) errs.push(`${path}: 不匹 pattern ${schema.pattern}`);
  if (schema.minLength != null && typeof data === 'string' && data.length < schema.minLength) errs.push(`${path}: 长度小于 minLength ${schema.minLength}`);
  if (schema.minimum != null && typeof data === 'number' && data < schema.minimum) errs.push(`${path}: 小于 minimum ${schema.minimum}`);
  if (schema.maximum != null && typeof data === 'number' && data > schema.maximum) errs.push(`${path}: 大于 maximum ${schema.maximum}`);
  if (schema.format != null && typeof data === 'string') {
    if (schema.format !== 'date-time') errs.push(`${path}: 校验器未实现 format「${schema.format}」（fail-closed）`);
    else if (!RFC3339.test(data) || Number.isNaN(Date.parse(data))) errs.push(`${path}: 非合法 RFC3339 date-time「${data}」`);
  }
  if (dt === 'object') {
    for (const r of schema.required || []) if (!(r in data)) errs.push(`${path}: 缺必填 ${r}`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(data)) {
      if (k in props) validateSchema(props[k], v, root, `${path}.${k}`, errs);
      else if (schema.additionalProperties === false) errs.push(`${path}: 未声明字段「${k}」被 additionalProperties:false 拒绝`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateSchema(schema.additionalProperties, v, root, `${path}.${k}`, errs);
    }
  }
  if (dt === 'array') {
    if (schema.minItems != null && data.length < schema.minItems) errs.push(`${path}: 项数小于 minItems ${schema.minItems}`);
    if (schema.maxItems != null && data.length > schema.maxItems) errs.push(`${path}: 项数大于 maxItems ${schema.maxItems}`);
    if (schema.items) for (let i = 0; i < data.length; i++) validateSchema(schema.items, data[i], root, `${path}[${i}]`, errs);
  }
  for (const [i, sub] of (schema.allOf || []).entries()) validateSchema(sub, data, root, `${path}(allOf[${i}])`, errs);
  if (schema.anyOf && !schema.anyOf.some((sub) => { const e = []; validateSchema(sub, data, root, path, e); return e.length === 0; })) errs.push(`${path}: anyOf 全不匹`);
  if (schema.oneOf) { const n = schema.oneOf.filter((sub) => { const e = []; validateSchema(sub, data, root, path, e); return e.length === 0; }).length; if (n !== 1) errs.push(`${path}: oneOf 命中 ${n} 个（须恰 1）`); }
  if (schema.if) {
    const e = []; validateSchema(schema.if, data, root, path, e);
    const branch = e.length === 0 ? schema.then : schema.else;
    if (branch) validateSchema(branch, data, root, `${path}(${e.length === 0 ? 'then' : 'else'})`, errs);
  }
}
const assertValid = (schema, data, root, label) => {
  const errs = [];
  validateSchema(schema, data, root, label, errs);
  if (errs.length) fail(`${label} 未过 schema 真校（codex R3-F4）：${errs[0]}${errs.length > 1 ? `（另 ${errs.length - 1} 处）` : ''}`);
};

// schema 全量预扫（codex R5-F1）：validateSchema 只走 fixture 实际触达的分支——未触达的 optional 分支里
// 未知关键字/未实现 format 会静默漏过，「fail-closed」就没兑现。此预扫与数据无关，递归遍历 schema 全部
// 节点（definitions/properties/items/additionalProperties/allOf/anyOf/oneOf/if/then/else）先全量拒，
// 再跑 fixture 数据校验。schema 用到新关键字时本 golden 必须同步扩展（Test Ratchet 锁改动）。
const SUBSCHEMA_MAPS = ['properties', 'definitions'];
const SUBSCHEMA_SINGLE = ['items', 'additionalProperties', 'if', 'then', 'else'];
const SUBSCHEMA_LISTS = ['allOf', 'anyOf', 'oneOf'];
function walkSchema(schema, root, path, errs) {
  if (typeof schema === 'boolean') return;
  // codex R8-F2：null/非 object 子 schema 一律拒收（null 会静默移除约束），与 validateSchema 同口径 fail-closed。
  if (schema == null || typeof schema !== 'object' || Array.isArray(schema)) { errs.push(`${path}: 非法 schema 节点（须 object/boolean，实为 ${schema === null ? 'null' : Array.isArray(schema) ? 'array' : typeof schema}）`); return; }
  for (const k of Object.keys(schema)) {
    if (!ANNOTATION_KEYS.has(k) && !KNOWN_KEYS.has(k)) errs.push(`${path}: 未知 schema 关键字「${k}」（fail-closed 预扫，须同步扩展本 golden）`);
  }
  if (typeof schema.format === 'string' && schema.format !== 'date-time') errs.push(`${path}: 未实现 format「${schema.format}」（fail-closed 预扫）`);
  // codex R7-F3：关键字值元校验——只查关键字名不查值，未触达分支的坏 pattern/坏形态会静默滑过（数据校验触达才炸或永不炸）。
  if ('pattern' in schema) {
    if (typeof schema.pattern !== 'string') errs.push(`${path}: pattern 须 string`);
    else { try { new RegExp(schema.pattern); } catch (e) { errs.push(`${path}: pattern 编译失败（${e.message}）`); } }
  }
  if ('required' in schema && !(Array.isArray(schema.required) && schema.required.every((r) => typeof r === 'string'))) errs.push(`${path}: required 须 string 数组`);
  if ('enum' in schema && !(Array.isArray(schema.enum) && schema.enum.length > 0)) errs.push(`${path}: enum 须非空数组`);
  if ('type' in schema) {
    const VALID_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
    const ts = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!ts.length || !ts.every((t) => VALID_TYPES.has(t))) errs.push(`${path}: type 含非法类型名 ${JSON.stringify(schema.type)}`);
  }
  for (const nk of ['minItems', 'maxItems', 'minLength']) if (nk in schema && (!Number.isInteger(schema[nk]) || schema[nk] < 0)) errs.push(`${path}: ${nk} 须非负整数`);
  for (const nk of ['minimum', 'maximum']) if (nk in schema && typeof schema[nk] !== 'number') errs.push(`${path}: ${nk} 须 number`);
  if ('additionalProperties' in schema && !(typeof schema.additionalProperties === 'boolean' || (schema.additionalProperties != null && typeof schema.additionalProperties === 'object' && !Array.isArray(schema.additionalProperties)))) errs.push(`${path}: additionalProperties 须 boolean 或 schema object`);
  if ('$ref' in schema) {
    if (typeof schema.$ref !== 'string' || !schema.$ref.startsWith('#/')) errs.push(`${path}: $ref 须文档内引用（#/…）`);
    else { let t = root; for (const seg of schema.$ref.slice(2).split('/')) t = t && t[seg]; if (!t) errs.push(`${path}: $ref ${schema.$ref} 解析失败（悬空引用）`); }
  }
  // codex R8-F2：容器形态显式校验——properties/definitions 须非数组 object、allOf/anyOf/oneOf 须数组，
  // 子 schema（含 null）一律进 walkSchema 拒收；此前 truthy 守卫会把 null/坏形态静默跳过。
  for (const key of SUBSCHEMA_MAPS) if (key in schema) {
    if (schema[key] == null || typeof schema[key] !== 'object' || Array.isArray(schema[key])) errs.push(`${path}: ${key} 须非数组 object`);
    else {
      // codex R9-F2：schema 声明的字段名也过禁字段扫描——schema 里挂一个可选 accessToken 字段、
      // fixture 不用则数据层永不触达，producer 却可合法产出（护栏 #7 key 侧在 schema 声明层的缺口）。
      if (key === 'properties') for (const k of Object.keys(schema[key])) {
        const norm = k.toLowerCase().replace(/[_.\-]/g, '');
        if (FORBIDDEN.some((f) => norm.includes(f))) errs.push(`${path}/properties/${k}: schema 声明凭据/PII 禁字段名（fixture 可不触达、producer 可合法产出；codex R9-F2+R10-F2）`);
      }
      for (const [k, v] of Object.entries(schema[key])) walkSchema(v, root, `${path}/${key}/${k}`, errs);
    }
  }
  for (const key of SUBSCHEMA_SINGLE) if (key in schema) walkSchema(schema[key], root, `${path}/${key}`, errs);
  for (const key of SUBSCHEMA_LISTS) if (key in schema) {
    if (!Array.isArray(schema[key])) errs.push(`${path}: ${key} 须 schema 数组`);
    // codex R9-F4：draft-07 组合关键字须非空数组——空 allOf/anyOf/oneOf 真空放行，未钉分支可被清空约束。
    else if (schema[key].length === 0) errs.push(`${path}: ${key} 不得为空数组（draft-07 非法且真空放行；codex R9-F4）`);
    else schema[key].forEach((v, i) => walkSchema(v, root, `${path}/${key}[${i}]`, errs));
  }
}
const assertSchemaClean = (schemaDoc, label) => {
  const errs = [];
  walkSchema(schemaDoc, schemaDoc, label, errs);
  if (errs.length) fail(`${label} 全量预扫未过（codex R5-F1+R7-F3）：${errs[0]}${errs.length > 1 ? `（另 ${errs.length - 1} 处）` : ''}`);
};

// 凭据/PII 禁字段（源自 seams-freeze.golden.mjs 的 findForbiddenKey 口径，护栏 #7）。
// codex R7-F1：精确匹配升子串匹配——normalize（小写去 _-）后含禁词即中，覆盖 camelCase/snake_case/kebab-case
// 复合字段名（accessToken/client_secret/sessionCookie/authorizationHeader）；精确匹配对复合名全漏、
// 而 wrapper 形态 fixture 顶层不整体过 schema，key 扫描就是主要兜底，漏检即护栏 #7 key 侧 fail-open。
const FORBIDDEN = ['body', 'headers', 'header', 'cookie', 'cookies', 'setcookie', 'token', 'authorization', 'password', 'secret', 'credential', 'apikey'];
function findForbiddenKey(node, path = '') {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const r = findForbiddenKey(node[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const norm = k.toLowerCase().replace(/[_.\-]/g, '');
      if (FORBIDDEN.some((f) => norm.includes(f))) return `${path}.${k}`;
      const r = findForbiddenKey(node[k], `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}

// codex R10-F2：字段名字符串扫描——禁字段名可被编码成字符串值绕过 key 扫描
// （requiredEventFields:["accessToken"]、fieldPath:"response.headers.authorization"、errorEnvelopeField:"set-cookie"）。
// normalize 口径同 findForbiddenKey 并追加去路径段字符 /[]（点号两器同步去，api.key 形态不再绕过）。
function findForbiddenFieldName(str) {
  if (typeof str !== 'string') return null;
  const norm = str.toLowerCase().replace(/[_.\-/\[\]]/g, '');
  return FORBIDDEN.some((f) => norm.includes(f)) ? str : null;
}
// 字段名扫描器自测金丝雀（codex R10-F2）。
{
  for (const bad of ['accessToken', 'response.headers.authorization', 'set-cookie', 'api.key']) {
    if (!findForbiddenFieldName(bad)) fail(`findForbiddenFieldName 自测：字段名金丝雀「${bad}」未被拦（codex R10-F2）`);
  }
  for (const good of ['urlPathnameAfter', 'requestLog[].errorEnvelope.status', 'status', 'urlPathnameBefore']) {
    if (findForbiddenFieldName(good)) fail(`findForbiddenFieldName 自测：合法字段名「${good}」被误拦`);
  }
}

// 护栏 #7 value 侧现实形状扫描（codex R4）：key 扫描抓不到值内容——字符串值里的 query/kv 形态凭据、
// 授权头、邮箱、密钥前缀在此拦。范围收敛沿 layer3-wiring 评审裁决：多词 key 短语与本地化 PII（手机号等）
// 不在冻结层扫（业务中台不产生此内容 + 运行期 report.mjs 凭据兜底门按 site.json 字面量精确兜真凭据）。
const SENSITIVE_VALUE_RES = [
  [/\b(bearer|basic)\s+[a-z0-9._\-+/=]{8,}/i, '授权头形态'],
  [/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i, '邮箱 PII'],
  [/\bsk_(live|test)_[a-z0-9]+/i, '密钥前缀形态'],
];
// codex R6-F1+R8-F1+R9-F3：kv 形态凭据不走固定词表正则（固定词表漏 client_secret/refresh_token/access-token/
// session_id 等复合变体），改为提取每个 kv 的 key、normalize（小写去 _-.）后按禁词子串匹配——与 findForbiddenKey
// 同口径，key 侧与 value 内嵌 kv 侧共用同一套禁词语义。边界含字符串起始/空白/JSON 分隔（R6-F1+R9-F3）；
// 分隔符 [:=] 双支持 + key 可带引号（token: SECRET / "accessToken":"SECRET" / X-Api-Key: abc 形态全拦，R9-F3）。
const KV_KEY_RE = /(^|[?&#;,{\s])\s*["']?([A-Za-z0-9_.\-]{1,64})["']?\s*[:=]/g;
const KV_FORBIDDEN = [...FORBIDDEN, 'session', 'auth', 'passwd', 'pwd'];
function findSensitiveKvKey(str) {
  for (const m of str.matchAll(KV_KEY_RE)) {
    const norm = m[2].toLowerCase().replace(/[_.\-]/g, '');
    if (KV_FORBIDDEN.some((f) => norm.includes(f))) return m[2];
  }
  return null;
}
// codex R11-F4：占位符携名封口——{{accessToken}} 这类占位符把凭据字段名藏进 value，key 扫描与 kv 提取都看不见。
const PLACEHOLDER_RE = /\{\{([^}]{1,64})\}\}/g;
function findSensitiveValue(node, path = '') {
  if (typeof node === 'string') {
    const kv = findSensitiveKvKey(node); if (kv) return `${path}（kv 形态凭据 key「${kv}」）`;
    for (const m of node.matchAll(PLACEHOLDER_RE)) { if (findForbiddenFieldName(m[1])) return `${path}（占位符携禁字段名「${m[1]}」；codex R11-F4）`; }
    for (const [re, label] of SENSITIVE_VALUE_RES) if (re.test(node)) return `${path}（${label}）`; return null;
  }
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const r = findSensitiveValue(node[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (node && typeof node === 'object') { for (const k of Object.keys(node)) { const r = findSensitiveValue(node[k], `${path}.${k}`); if (r) return r; } }
  return null;
}

// 禁字段扫描器自测金丝雀（codex R7-F1）：复合字段名（camelCase/snake_case/kebab-case 里嵌禁词）必中，
// 领域合法字段必不中——防 key 扫描被退回精确匹配后复合凭据字段静默入冻结产物（护栏 #7 key 侧）。
{
  for (const bad of ['accessToken', 'client_secret', 'sessionCookie', 'authorizationHeader', 'x-auth-token', 'apiKeyRef', 'api.key']) {
    if (!findForbiddenKey({ [bad]: 'x' })) fail(`findForbiddenKey 自测：复合禁字段金丝雀「${bad}」未被拦（key 扫描被放宽；codex R7-F1+R10-F2）`);
  }
  for (const good of ['accessibleName', 'observationCapabilities', 'attributedStepId', 'locatorBinding', 'capturedAgainstBuild', 'errorEnvelopeField']) {
    if (findForbiddenKey({ [good]: 'x' })) fail(`findForbiddenKey 自测：合法字段「${good}」被误拦（key 扫描过宽误伤）`);
  }
}

// 扫描器自测金丝雀（codex R6-F1）：防 SENSITIVE_VALUE_RES 被静默放宽——正例必中、负例必不中，扫描器本身也上锁。
{
  for (const bad of ['token=SECRET123', 'password=hunter2', 'api_key=abc12345', '/api/save?token=x', 'Bearer abcdef0123', 'a@b.example.com', 'sk_live_abc123', 'client_secret=abc', 'refresh_token=xyz', 'access-token=1', 'api-key=2', 'session_id=3', 'sessionToken=4', 'token: SECRET', '"accessToken":"SECRET123"', 'X-Api-Key: abc12345', "{'apikey': 'zzz'}", '{{accessToken}}', '{{client_secret}}']) {
    if (!findSensitiveValue(bad)) fail(`findSensitiveValue 自测：凭据形态金丝雀「${bad}」未被拦（扫描器被放宽；codex R6-F1+R8-F1+R9-F3+R11-F4）`);
  }
  for (const good of ['workflow.save', '保存后回列表页', '/ai-manager/process/saveOrModifyProcessData', 'role=button;name=保存', 'sha256:abcdef0123456789', 'https://example.internal/path', '2026-06-30T08:14:09.220Z', '备注: 保存后回列表', '{{workflow.name}}', '<redacted:fill-value>']) {
    if (findSensitiveValue(good)) fail(`findSensitiveValue 自测：合法值「${good}」被误拦（扫描器过宽误伤）`);
  }
}

const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const NH_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);

let checks = 0;
const ok = () => { checks++; };

// --- 动作真值源：读已冻 events.schema 的 action 枚举（决策 2.1，非硬编码）---
const eventsSchema = load(S('events.schema.json'), 'events.schema（真值源）');
const ACTION_ENUM = eventsSchema?.definitions?.event?.properties?.action?.enum;
if (!Array.isArray(ACTION_ENUM) || ACTION_ENUM.length !== 8) fail('events.schema: action 枚举缺失或非 8 项（真值源被破坏）');
const ACTIONS = new Set(ACTION_ENUM);
ok();

// --- 四条 schema 都要解析为带 $schema 的合法 JSON Schema ---
for (const s of ['run-history', 'action-vocabulary', 'failure-ledger-entry', 'channel-driver']) {
  const j = load(S(`${s}.schema.json`), `schema ${s}`);
  if (!j || typeof j !== 'object' || !j.$schema) fail(`schema ${s}: 非合法 JSON Schema（缺 $schema）`);
}
ok();

// --- seam1 run-history：无 method/cacheStatus、action⊆枚举、intentId 非空、反例 passedActions<totalSteps ---
{
  const fx = load(F('run-history.fixture.json'), 'run-history fixture');
  if (!Array.isArray(fx.runHistoryLines) || fx.runHistoryLines.length === 0) fail('run-history: runHistoryLines 须非空数组');
  for (const [i, ln] of fx.runHistoryLines.entries()) {
    if ('method' in ln) fail(`run-history line[${i}]: 残留弃用字段 method（应为 action，决策 1.2）`);
    if ('cacheStatus' in ln) fail(`run-history line[${i}]: 残留已删字段 cacheStatus（决策 1.1）`);
    if (!ACTIONS.has(ln.action)) fail(`run-history line[${i}]: action ${ln.action} 不在 events.schema 7 枚举`);
    if (typeof ln.intentId !== 'string' || ln.intentId.length < 1) fail(`run-history line[${i}]: intentId 须非空 string（决策 1.3 minLength:1）`);
    for (const r of ['timestamp', 'caseId', 'stepId', 'quietPointReached', 'durationMs', 'result']) if (!(r in ln)) fail(`run-history line[${i}]: 缺必填 ${r}`);
    // codex R11-F3：locatorResolution 与 action 类别绑定——nav/newpage/press 无定位需求恒 null、
    // 交互动作恒非 null；否则无定位动作可污染 locatorHitRate 分母。
    if (['nav', 'newpage', 'press'].includes(ln.action) && ln.locatorResolution != null) fail(`run-history line[${i}]: ${ln.action} 无定位需求、locatorResolution 须 null（防污染 locatorHitRate 分母；codex R11-F3）`);
    if (['click', 'dblclick', 'fill', 'selectOption'].includes(ln.action) && typeof ln.locatorResolution !== 'string') fail(`run-history line[${i}]: ${ln.action} 是交互动作、locatorResolution 须非 null（codex R11-F3）`);
  }
  const m = fx.runMetrics;
  if (!m) fail('run-history: 缺 runMetrics 聚合');
  if ('cacheHitRate' in m) fail('run-metrics: 残留已删字段 cacheHitRate（决策 1.1）');
  if (!(m.passedActions < m.totalSteps)) fail('run-metrics: 反例应示范 passedActions < totalSteps（result 非四态、跑到底≠PASS）');
  // codex R10-F3：run-metrics 是 runHistoryLines 的聚合——不复算即可冻结自相矛盾的诊断接缝。
  const okCount = fx.runHistoryLines.filter((l) => l.result === 'ok').length;
  if (m.totalSteps !== fx.runHistoryLines.length) fail(`run-metrics: totalSteps ${m.totalSteps} ≠ 行数 ${fx.runHistoryLines.length}（聚合失真；codex R10-F3）`);
  if (m.passedActions !== okCount) fail(`run-metrics: passedActions ${m.passedActions} ≠ result=ok 行数 ${okCount}（codex R10-F3）`);
  if (!fx.runHistoryLines.every((l) => l.caseId === m.caseId)) fail('run-metrics: caseId 与各行不一致（codex R10-F3）');
  const locLines = fx.runHistoryLines.filter((l) => l.locatorResolution != null);
  const hitRate = locLines.length ? locLines.filter((l) => l.locatorResolution === 'unique').length / locLines.length : null;
  if (m.locatorHitRate !== hitRate) fail(`run-metrics: locatorHitRate ${m.locatorHitRate} ≠ 按行复算 ${hitRate}（分母=有定位需求的行；codex R10-F3）`);
  const sumDur = fx.runHistoryLines.reduce((a, l) => a + l.durationMs, 0);
  if (!(m.totalDurationMs >= sumDur)) fail(`run-metrics: totalDurationMs ${m.totalDurationMs} 小于各行 durationMs 之和 ${sumDur}（总耗时含运行开销、不可小于逐步之和；codex R10-F3）`);
  if (!(m.quietPointWaitMs <= m.totalDurationMs)) fail('run-metrics: quietPointWaitMs 大于 totalDurationMs（等待是总耗时子集；codex R10-F3）');
  const fk = findForbiddenKey(fx); if (fk) fail(`run-history fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
  const sv = findSensitiveValue(fx); if (sv) fail(`run-history fixture: 字符串值命中凭据/PII 现实形状 ${sv}（护栏 #7 value 侧；codex R4）`);
}
ok();

// --- seam2 action-vocabulary：action⊆枚举、覆盖全7、web坐标兜底false、failClosed红线、无golden不入表 ---
{
  const fx = load(F('action-vocabulary.fixture.json'), 'action-vocabulary fixture');
  if (!fx.source || String(fx.source.enumPath).indexOf('events.json') < 0) fail('action-vocab: source.enumPath 须指向 events.json 枚举（决策 2.1）');
  if (!Array.isArray(fx.entries) || fx.entries.length === 0) fail('action-vocab: entries 须非空');
  const seen = new Set();
  for (const [i, e] of fx.entries.entries()) {
    if (!ACTIONS.has(e.action)) fail(`action-vocab entry[${i}]: action ${e.action} 不在 events.schema 枚举（决策 2.1/Q3）`);
    // codex R5-F4：治理面每动作恰一条——重复登记 = 同一 action 两份可能互斥的治理声明，Set 塌重即静默掩盖冲突。
    if (seen.has(e.action)) fail(`action-vocab entry[${i}]: action ${e.action} 重复登记（治理面须每动作恰一条，重复即冲突声明；codex R5-F4）`);
    seen.add(e.action);
    if (!e.coordinateFallback || e.coordinateFallback.allowed !== false) fail(`action-vocab entry[${i}] (${e.action}): web 坐标兜底 allowed 须 false（禁纯坐标步）`);
    if (!e.failClosed || e.failClosed.neverSubstitute !== true || e.failClosed.neverSelfHeal !== true) fail(`action-vocab entry[${i}]: failClosed 红线 neverSubstitute/neverSelfHeal 须 true（护栏 #13/#14）`);
    if (!Array.isArray(e.golden) || e.golden.length < 1) fail(`action-vocab entry[${i}]: 无 golden 不得入表（动作侧棘轮）`);
    // codex R10-F2：paramSchema 登记的 event 字段名过字段名扫描——字符串形态的禁字段名绕不过。
    for (const fn of [...(e.paramSchema && e.paramSchema.requiredEventFields || []), ...(e.paramSchema && e.paramSchema.optionalEventFields || [])]) {
      if (findForbiddenFieldName(fn)) fail(`action-vocab entry[${i}] (${e.action}): paramSchema 字段名「${fn}」命中凭据/PII 禁词（字段名字符串绕过 key 扫描；codex R10-F2）`);
    }
  }
  if (seen.size !== ACTIONS.size) fail(`action-vocab: fixture 应覆盖全 ${ACTIONS.size} 动作，实覆盖 ${seen.size}`);
  const fk = findForbiddenKey(fx); if (fk) fail(`action-vocab fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
  const sv = findSensitiveValue(fx); if (sv) fail(`action-vocab fixture: 字符串值命中凭据/PII 现实形状 ${sv}（护栏 #7 value 侧；codex R4）`);
}
ok();

// --- seam3 failure-ledger：三条 fail-safe、fingerprintInputs 与顶层一致、failedAssertion⟺assertionKind ---
{
  const fx = load(F('failure-ledger.fixture.json'), 'failure-ledger fixture');
  if (!Array.isArray(fx.entries) || fx.entries.length === 0) fail('failure-ledger: entries 须非空');
  for (const [i, e] of fx.entries.entries()) {
    if (TERMINAL.has(e.verdict) && e.verdict !== 'PASS') { if (e.reason !== null) fail(`fle[${i}]: 终判 ${e.verdict} 的 reason 须 null（fail-safe）`); }
    if (e.verdict === 'NEEDS_HUMAN' && !NH_REASONS.has(e.reason)) fail(`fle[${i}]: NEEDS_HUMAN 须带 reason 子类（catch-all 落 INDETERMINATE）`);
    if (e.humanResolution && e.humanResolution.decision === 'drift-healed' && e.verdict !== 'HARNESS_ERROR') fail(`fle[${i}]: drift-healed 仅 HARNESS_ERROR 合法（护栏 #13/#15）`);
    // codex R9-F1（修正采纳）：SUT_DEFECT 是须取证背书的终判，至少携一个非 null 证据指针；
    // 不强制 failedAssertion——SUT_DEFECT 可仅由 5xx/pageerror/crash 背书而无失败断言（ADR-0002/layer3 裁决）。
    if (e.verdict === 'SUT_DEFECT' && !(e.failedAssertion || e.forensicsRef)) fail(`fle[${i}]: SUT_DEFECT 零证据指针（failedAssertion 与 forensicsRef 全 null，违「证不出→NEEDS_HUMAN」护栏 #14；codex R9-F1）`);
    // codex R10-F1 + R11-F2：取证指针须真背书非装饰、混合证据同锁——SUT_DEFECT 携任何非 null forensicsRef
    // 都须归因本步 + 携失败信号（不许「断言证据打掩护、装饰性取证指针随行」）。
    if (e.verdict === 'SUT_DEFECT' && e.forensicsRef) {
      if (e.forensicsRef.attributedStepId !== e.stepId) fail(`fle[${i}]: SUT_DEFECT 取证背书 attributedStepId「${e.forensicsRef.attributedStepId}」须等于本步 stepId「${e.stepId}」（归因本步才背书本步；codex R10-F1+R11-F2）`);
      if (!(e.forensicsRef.status === 0 || e.forensicsRef.status >= 500 || (typeof e.forensicsRef.errorEnvelopeField === 'string' && e.forensicsRef.errorEnvelopeField.trim().length > 0))) fail(`fle[${i}]: SUT_DEFECT 取证背书须携失败信号（status 0/≥500 或非空错误信封字段），status=${e.forensicsRef.status} 是装饰性指针（codex R10-F1+R11-F1）`);
    }
    // codex R11-F1：断言证据不许空壳——kind/op/fieldPath 非空白、expected/actual 不得同时 null。
    if (e.verdict === 'SUT_DEFECT' && e.failedAssertion) {
      for (const k of ['kind', 'op', 'fieldPath']) {
        if (typeof e.failedAssertion[k] !== 'string' || !e.failedAssertion[k].trim().length) fail(`fle[${i}]: SUT_DEFECT 断言证据 failedAssertion.${k} 须非空白 string（空壳快照不当证据；codex R11-F1）`);
      }
      if (e.failedAssertion.expectedTemplate === null && e.failedAssertion.actualTemplate === null) fail(`fle[${i}]: SUT_DEFECT 断言证据 expectedTemplate/actualTemplate 不得同时为 null（无内容对照不成证据；codex R11-F1）`);
    }
    // codex R10-F2：字段名字符串扫描应用——诊断快照的 fieldPath 与信封字段名不得携禁字段名。
    if (e.failedAssertion && findForbiddenFieldName(e.failedAssertion.fieldPath)) fail(`fle[${i}]: failedAssertion.fieldPath「${e.failedAssertion.fieldPath}」命中凭据/PII 禁词（codex R10-F2）`);
    if (e.forensicsRef && e.forensicsRef.errorEnvelopeField != null && findForbiddenFieldName(e.forensicsRef.errorEnvelopeField)) fail(`fle[${i}]: forensicsRef.errorEnvelopeField「${e.forensicsRef.errorEnvelopeField}」命中凭据/PII 禁词（codex R10-F2）`);
    if (!e.fingerprintInputs) fail(`fle[${i}]: 缺 fingerprintInputs`);
    for (const k of ['channel', 'verdict', 'reason', 'atom']) if (e.fingerprintInputs[k] !== e[k]) fail(`fle[${i}]: fingerprintInputs.${k} 与顶层不一致（防指纹与记录漂移）`);
    const hasFA = e.failedAssertion != null;
    const hasKind = e.fingerprintInputs.assertionKind != null;
    if (hasFA !== hasKind) fail(`fle[${i}]: failedAssertion 非空 ⟺ assertionKind 非空（断言失败才有断言快照）`);
    // codex R3：kind/op 成对——assertionKind 为 null 时 assertionOp 必 null，非断言失败绝不携断言 op 污染聚类。
    if (!hasKind && e.fingerprintInputs.assertionOp !== null) fail(`fle[${i}]: assertionKind 为 null 时 assertionOp 须 null（非断言失败不得携断言 op；codex R3）`);
    if (hasFA) {
      // codex R1-F1：不止存在性同真假，值也须相等——防诊断快照与指纹输入漂移（producer 可能存在性一致但 kind/op 值互异）。
      if (e.failedAssertion.kind !== e.fingerprintInputs.assertionKind) fail(`fle[${i}]: failedAssertion.kind「${e.failedAssertion.kind}」须等于 fingerprintInputs.assertionKind「${e.fingerprintInputs.assertionKind}」（codex R1-F1）`);
      if (e.failedAssertion.op !== e.fingerprintInputs.assertionOp) fail(`fle[${i}]: failedAssertion.op「${e.failedAssertion.op}」须等于 fingerprintInputs.assertionOp「${e.fingerprintInputs.assertionOp}」（codex R1-F1）`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(e.fingerprint)) fail(`fle[${i}]: fingerprint 格式须 ^sha256:[0-9a-f]{64}$`);
    // codex R1-F2：指纹须真算、非合成占位——复算 sha256(canonicalJSON(fingerprintInputs)) 与落盘值比对，机制化确定性/可复现不变量。
    const recomputed = fingerprintOf(e.fingerprintInputs);
    if (e.fingerprint !== recomputed) fail(`fle[${i}]: fingerprint 与 sha256(canonicalJSON(fingerprintInputs)) 复算不一致（须真算、非占位；codex R1-F2）。期望 ${recomputed}`);
  }
  const fk = findForbiddenKey(fx); if (fk) fail(`failure-ledger fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
  const sv = findSensitiveValue(fx); if (sv) fail(`failure-ledger fixture: 字符串值命中凭据/PII 现实形状 ${sv}（护栏 #7 value 侧；codex R4）`);
}
ok();

// --- seam4 channel-driver：actionSpace⊆枚举、web⟹coordinateSpace null、driverId 与 action-vocab 互链、profileRef 指针 ---
{
  const fx = load(F('channel-driver.fixture.json'), 'channel-driver fixture');
  const av = load(F('action-vocabulary.fixture.json'), 'action-vocabulary fixture（互链）');
  const avDrivers = new Set((av.entries || []).map((e) => e.driver && e.driver.channelDriver));
  if (!fx.actionSource || String(fx.actionSource.enumPath).indexOf('events.json') < 0) fail('channel-driver: actionSource.enumPath 须指向 events.json（决策 2.1）');
  if (!Array.isArray(fx.drivers) || fx.drivers.length === 0) fail('channel-driver: drivers 须非空');
  // codex R5-F4：driverId / 单驱动 actionSpace 内 action 拒重复——重复即冲突能力声明，Map/Set join 会按遍历序静默取一。
  const seenDrv = new Set();
  for (const [i, d] of fx.drivers.entries()) {
    if (seenDrv.has(d.driverId)) fail(`channel-driver driver[${i}]: driverId ${d.driverId} 重复登记（一个端口适配器恰一条能力声明；codex R5-F4）`);
    seenDrv.add(d.driverId);
    if (d.channel === 'web' && d.coordinateSpace !== null) fail(`channel-driver driver[${i}]: web 的 coordinateSpace 须 null（禁纯坐标步，决策 Q3）`);
    if (!(d.profileRef === null || typeof d.profileRef === 'string')) fail(`channel-driver driver[${i}]: profileRef 须字符串指针或 null（不内嵌 profile，决策 Q2）`);
    if (!Array.isArray(d.actionSpace) || d.actionSpace.length === 0) fail(`channel-driver driver[${i}]: actionSpace 须非空`);
    const seenAct = new Set();
    for (const [j, a] of d.actionSpace.entries()) {
      if (!ACTIONS.has(a.action)) fail(`channel-driver driver[${i}].actionSpace[${j}]: action ${a.action} 不在 events.schema 枚举（决策 2.1/Q3）`);
      if (seenAct.has(a.action)) fail(`channel-driver driver[${i}].actionSpace[${j}]: action ${a.action} 在同一驱动 actionSpace 重复（重复即冲突实现入口；codex R5-F4）`);
      seenAct.add(a.action);
      if (typeof a.call !== 'string' || !a.call.length) fail(`channel-driver driver[${i}].actionSpace[${j}]: call 须非空 string`);
    }
    if (!avDrivers.has(d.driverId)) fail(`channel-driver driver[${i}]: driverId ${d.driverId} 未在 action-vocabulary driver.channelDriver 出现（互链漂移，决策 Q2）`);
  }
  // codex R3：互链须双向——每个 vocabulary entry 指的驱动也必须真实存在于 channel-driver 登记，
  // 否则冻结出「动作指向不存在驱动」的治理表（单向校验只保 driverId 被引用、不保引用有落点）。
  const cdIds = new Set(fx.drivers.map((d) => d.driverId));
  for (const [i, e] of (av.entries || []).entries()) {
    const ref = e.driver && e.driver.channelDriver;
    if (!cdIds.has(ref)) fail(`action-vocab entry[${i}] (${e.action}): driver.channelDriver「${ref}」不存在于 channel-driver drivers[].driverId（互链须双向；codex R3）`);
  }
  // codex R4：join 一致性补包含关系——entry 声明的驱动，其 actionSpace 必须真含该 action；
  // 只校 id 存在会冻结出「词汇表声称有实现、驱动能力表不支持」的矛盾治理面，编译门/回放据之误判支持。
  const cdById = new Map(fx.drivers.map((d) => [d.driverId, d]));
  for (const [i, e] of (av.entries || []).entries()) {
    const drv = cdById.get(e.driver && e.driver.channelDriver);
    if (drv && !(drv.actionSpace || []).some((a) => a.action === e.action)) fail(`action-vocab entry[${i}] (${e.action}): 所指驱动「${drv.driverId}」的 actionSpace 不含此 action（词汇表与驱动能力矛盾；codex R4）`);
    // codex R6-F3：join 补通道一致性——所指驱动的实际 channel 必须在 entry 声明的 channels 里，
    // 否则冻结出「词汇表说 web 可用、驱动实际 cef」的矛盾治理面。多 channel 全覆盖校验
    //（每个声明 channel 都有对应驱动能力）随真机多驱动落地 route:human，当前 entry.driver 单指针先钉包含关系。
    if (drv && !(Array.isArray(e.channels) && e.channels.includes(drv.channel))) fail(`action-vocab entry[${i}] (${e.action}): 所指驱动「${drv.driverId}」channel「${drv.channel}」不在 entry.channels（通道声明与驱动通道矛盾；codex R6-F3）`);
    // codex R9-F5：join 补 call 全等——词汇表 driver.call 与驱动 actionSpace[].call 是同一实现指针的两处登记，
    // 只校存在/包含不校值，两处可各自漂移而 join 全绿（provenance 失真）。
    if (drv) {
      const cap = (drv.actionSpace || []).find((a) => a.action === e.action);
      if (cap && e.driver.call !== cap.call) fail(`action-vocab entry[${i}] (${e.action}): driver.call「${e.driver.call}」≠ 驱动 actionSpace 同动作 call「${cap.call}」（实现指针两处漂移；codex R9-F5）`);
    }
  }
  const fk = findForbiddenKey(fx); if (fk) fail(`channel-driver fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
  const sv = findSensitiveValue(fx); if (sv) fail(`channel-driver fixture: 字符串值命中凭据/PII 现实形状 ${sv}（护栏 #7 value 侧；codex R4）`);
}
ok();

// --- schema 层硬不变量机制化自守（codex 评审 R1：hard invariant 须在 schema 钉住、非仅 golden 抽查 fixture；真实 producer 只跑 schema 也被拦）---
{
  const av = load(S('action-vocabulary.schema.json'), 'action-vocabulary schema');
  const cf = av && av.definitions && av.definitions.actionEntry && av.definitions.actionEntry.properties && av.definitions.actionEntry.properties.coordinateFallback && av.definitions.actionEntry.properties.coordinateFallback.properties;
  if (!cf || cf.allowed.const !== false) fail('action-vocabulary.schema: coordinateFallback.allowed 须 const:false（禁纯坐标步 ADR-0003 机制化、非 type:boolean）');
  if (cf.onlyVia.const !== null) fail('action-vocabulary.schema: coordinateFallback.onlyVia 须 const:null');
  // codex R5-F2：const 只约束「出现时的值」——省略字段即绕过；required 封死省略口，const 钉死才真闭合。
  const cfReq = av.definitions.actionEntry.properties.coordinateFallback.required;
  if (!Array.isArray(cfReq) || !cfReq.includes('onlyVia')) fail('action-vocabulary.schema: coordinateFallback.required 须含 onlyVia（省略字段可绕 const:null；codex R5-F2）');

  const cd = load(S('channel-driver.schema.json'), 'channel-driver schema');
  const drvAllOf = cd && cd.definitions && cd.definitions.driver && cd.definitions.driver.allOf;
  const webNull = Array.isArray(drvAllOf) && drvAllOf.some((r) => r && r.if && r.if.properties && r.if.properties.channel && r.if.properties.channel.const === 'web' && r.then && r.then.properties && r.then.properties.coordinateSpace && r.then.properties.coordinateSpace.const === null);
  if (!webNull) fail('channel-driver.schema: driver.allOf 须含 if channel=web then coordinateSpace const:null（ADR-0003 机制化）');

  const rh = load(S('run-history.schema.json'), 'run-history schema');
  const vr = rh && rh.definitions && rh.definitions.runHistoryLine && rh.definitions.runHistoryLine.properties && rh.definitions.runHistoryLine.properties.parameters && rh.definitions.runHistoryLine.properties.parameters.properties && rh.definitions.runHistoryLine.properties.parameters.properties.valueRef;
  if (!vr || typeof vr.pattern !== 'string' || !vr.pattern.length) fail('run-history.schema: parameters.valueRef 须带 pattern 钉死脱敏引用形态（护栏 #7 value 侧红线）');

  // codex R1-F3 评估→拒删 coord_fallback、代之以可表征锁（R3 措辞修正：run-history 绝不进 verdict.mjs——
  // 强制 ambiguous→NEEDS_HUMAN 由 点击身份门 落 StepAxes 动作轴、经 verdict.mjs 裁定，发生在裁定链上；
  // run-history 是只读诊断台账，仅以同一解析词汇如实记录该结局。删掉枚举=台账无法表征坐标/首命中兜底、
  // 漏记即诊断层 fail-open；保留枚举同时防与动作轴词汇漂移。绝不得据此把 run-history 接进裁判进程（护栏 #15）。
  const lr = rh && rh.definitions && rh.definitions.runHistoryLine && rh.definitions.runHistoryLine.properties && rh.definitions.runHistoryLine.properties.locatorResolution && rh.definitions.runHistoryLine.properties.locatorResolution.enum;
  if (!Array.isArray(lr) || !lr.includes('coord_fallback') || !lr.includes('fallback_first')) fail('run-history.schema: locatorResolution enum 须保留 coord_fallback/fallback_first（可表征即 fail-safe：坐标/首命中兜底这一结局须能被只读台账如实记录、删则漏记=诊断层 fail-open；裁定链上由 点击身份门→StepAxes→verdict.mjs 强制 ambiguous→NEEDS_HUMAN，run-history 本身绝不进裁判；codex R1-F3 可表征锁 + R3 措辞修正）');

  const fle = load(S('failure-ledger-entry.schema.json'), 'failure-ledger schema');
  const faKind = Array.isArray(fle && fle.allOf) && fle.allOf.some((r) => r && r.if && r.if.properties && r.if.properties.failedAssertion && r.if.properties.failedAssertion.type === 'object' && r.then && r.then.properties && r.then.properties.fingerprintInputs && r.then.properties.fingerprintInputs.properties && r.then.properties.fingerprintInputs.properties.assertionKind && r.then.properties.fingerprintInputs.properties.assertionKind.type === 'string');
  if (!faKind) fail('failure-ledger.schema: allOf 须含 failedAssertion=object ⟹ fingerprintInputs.assertionKind:string（护栏 #17 断言侧机制化）');

  // codex R8-F3：「无则 null」的稳定形状字段必须显式出现——省略 atom 则 fingerprintInputs.atom 与顶层同名
  // 一致性失去对照物、省略 failedAssertion/forensicsRef 则台账形状漂移；required 强制显式、null 类型保留语义。
  for (const rk of ['atom', 'failedAssertion', 'forensicsRef']) {
    if (!Array.isArray(fle.required) || !fle.required.includes(rk)) fail(`failure-ledger.schema: 顶层 required 须含 ${rk}（显式 nullable、不许省略；codex R8-F3）`);
  }

  // codex R9-F1（修正采纳）：证据背书也钉 schema 层——SUT_DEFECT ⟹ anyOf(failedAssertion object | forensicsRef object)。
  const sdBranch = fle.allOf.find((r) => r && r.if && r.if.properties && r.if.properties.verdict && r.if.properties.verdict.const === 'SUT_DEFECT' && r.then && Array.isArray(r.then.anyOf) && r.then.anyOf.length >= 2);
  if (!sdBranch) fail('failure-ledger.schema: allOf 须含 SUT_DEFECT ⟹ anyOf(failedAssertion object | forensicsRef object) 证据背书（零证据终判违护栏 #14；codex R9-F1 修正采纳）');
  // codex R10-F1：forensicsRef 支须钉真背书语义——required attributedStepId(string) + 失败信号 anyOf（status≥500 / status 0 / 错误信封字段 string），防装饰性取证指针过 schema。
  const frBranch = sdBranch.then.anyOf.find((b) => b && b.properties && b.properties.forensicsRef);
  const frSpec = frBranch && frBranch.properties.forensicsRef;
  const frOk = frSpec && Array.isArray(frSpec.required) && frSpec.required.includes('attributedStepId') && frSpec.properties && frSpec.properties.attributedStepId && frSpec.properties.attributedStepId.type === 'string' && Array.isArray(frSpec.anyOf) && frSpec.anyOf.length >= 3;
  if (!frOk) fail('failure-ledger.schema: SUT_DEFECT 证据的 forensicsRef 支须钉真背书语义（required attributedStepId:string + 失败信号 anyOf ≥3 支；codex R10-F1）');
  const stepIdPat = fle.properties.forensicsRef.properties.attributedStepId.pattern;
  if (typeof stepIdPat !== 'string' || !new RegExp(stepIdPat).test('atstep_2') || new RegExp(stepIdPat).test('别步')) fail('failure-ledger.schema: forensicsRef.attributedStepId 须带 ^atstep_[0-9]+$ 形态 pattern（codex R10-F1）');

  // codex R11-F1：空串证据封口——诊断/信号字段须带非空白 pattern（空串与纯空白都过不了）。
  for (const [spec, label] of [
    [fle.properties.failedAssertion.properties.kind, 'failedAssertion.kind'],
    [fle.properties.failedAssertion.properties.op, 'failedAssertion.op'],
    [fle.properties.failedAssertion.properties.fieldPath, 'failedAssertion.fieldPath'],
    [fle.properties.fingerprintInputs.properties.assertionKind, 'fingerprintInputs.assertionKind'],
    [fle.properties.fingerprintInputs.properties.assertionOp, 'fingerprintInputs.assertionOp'],
    [fle.properties.forensicsRef.properties.errorEnvelopeField, 'forensicsRef.errorEnvelopeField'],
  ]) {
    if (!spec || typeof spec.pattern !== 'string' || new RegExp(spec.pattern).test('') || new RegExp(spec.pattern).test('   ') || !new RegExp(spec.pattern).test('urlPathname')) fail(`failure-ledger.schema: ${label} 须带非空白 pattern（空串证据封口；codex R11-F1）`);
  }
  // codex R11-F1：SUT_DEFECT 断言证据支须要求 expected/actual 不同时 null。
  const faBranch = sdBranch.then.anyOf.find((b) => b && b.properties && b.properties.failedAssertion);
  const faOk = faBranch && Array.isArray(faBranch.properties.failedAssertion.anyOf) && faBranch.properties.failedAssertion.anyOf.length >= 2;
  if (!faOk) fail('failure-ledger.schema: SUT_DEFECT 断言证据支须 anyOf 要求 expectedTemplate/actualTemplate 至少一个非 null（空壳快照不当证据；codex R11-F1）');
  // codex R11-F2：混合证据独立 allOf——SUT_DEFECT 携非 null forensicsRef（无论有无断言证据）都须真背书。
  const mixBranch = fle.allOf.some((r) => r && r.if && r.if.properties && r.if.properties.verdict && r.if.properties.verdict.const === 'SUT_DEFECT' && r.if.properties.forensicsRef && r.if.properties.forensicsRef.type === 'object' && r.then && r.then.properties && r.then.properties.forensicsRef && Array.isArray(r.then.properties.forensicsRef.required) && r.then.properties.forensicsRef.required.includes('attributedStepId') && Array.isArray(r.then.properties.forensicsRef.anyOf));
  if (!mixBranch) fail('failure-ledger.schema: allOf 须含「SUT_DEFECT 且 forensicsRef 为 object ⟹ 真背书语义」独立分支（混合证据不锁则装饰性指针可随断言证据混入；codex R11-F2）');

  // codex R11-F3：locatorResolution 与 action 类别绑定也钉 schema 层。
  const rhLine = rh.definitions.runHistoryLine;
  const rhAllOf = Array.isArray(rhLine.allOf) ? rhLine.allOf : [];
  const noLocBranch = rhAllOf.some((r) => r && r.if && r.if.properties && r.if.properties.action && Array.isArray(r.if.properties.action.enum) && ['nav', 'newpage', 'press'].every((a) => r.if.properties.action.enum.includes(a)) && r.then && r.then.properties && r.then.properties.locatorResolution && r.then.properties.locatorResolution.const === null);
  const locBranch = rhAllOf.some((r) => r && r.if && r.if.properties && r.if.properties.action && Array.isArray(r.if.properties.action.enum) && ['click', 'dblclick', 'fill', 'selectOption'].every((a) => r.if.properties.action.enum.includes(a)) && r.then && r.then.properties && r.then.properties.locatorResolution && r.then.properties.locatorResolution.type === 'string');
  if (!noLocBranch || !locBranch) fail('run-history.schema: runHistoryLine.allOf 须含动作类别⟹locatorResolution 绑定两支（nav/newpage/press⟹null、交互⟹string；codex R11-F3）');

  // codex R3：kind/op 成对也须钉在 schema 层（真实 producer 只跑 schema 也被拦）。
  const kindOpPair = fle.allOf.some((r) => r && r.if && r.if.properties && r.if.properties.fingerprintInputs && r.if.properties.fingerprintInputs.properties && r.if.properties.fingerprintInputs.properties.assertionKind && r.if.properties.fingerprintInputs.properties.assertionKind.const === null && r.then && r.then.properties && r.then.properties.fingerprintInputs && r.then.properties.fingerprintInputs.properties && r.then.properties.fingerprintInputs.properties.assertionOp && r.then.properties.fingerprintInputs.properties.assertionOp.const === null);
  if (!kindOpPair) fail('failure-ledger.schema: allOf 须含 assertionKind=null ⟹ assertionOp=null（kind/op 成对，防非断言失败携断言 op 污染聚类；codex R3）');

  // codex R7-F4：三处 schema 硬编码 action enum 与真值源全等比对——golden 此前只校 fixture ⊆ 枚举，
  // schema 私自扩 tap 而 fixture 不用时 assertValid 仍绿、真实 producer 按 schema 校验会收下枚举外动作，
  // 治理边界（决策 2.1「action 名权威唯一活在 events.schema」）就破了。maxItems 同步镜像枚举长度。
  const enumEq = (arr) => Array.isArray(arr) && arr.length === ACTION_ENUM.length && arr.every((v, i) => v === ACTION_ENUM[i]);
  if (!enumEq(av.definitions.actionEntry.properties.action.enum)) fail('action-vocabulary.schema: actionEntry.action.enum 须与 events.schema action 枚举全等（防私自扩动作；codex R7-F4）');
  if (!enumEq(cd.definitions.actionCapability.properties.action.enum)) fail('channel-driver.schema: actionCapability.action.enum 须与 events.schema action 枚举全等（codex R7-F4）');
  if (!enumEq(rh.definitions.runHistoryLine.properties.action.enum)) fail('run-history.schema: runHistoryLine.action.enum 须与 events.schema action 枚举全等（codex R7-F4）');
  if (av.properties.entries.maxItems !== ACTION_ENUM.length) fail('action-vocabulary.schema: entries.maxItems 须等于 events.schema action 枚举长度（镜像随棘轮同走；codex R7-F4）');

  // codex R3：护栏 #14 机制化——whenUnsupported=NEEDS_HUMAN 时 needsHumanReason 必填且为子类 string。
  const fcAllOf = av.definitions && av.definitions.actionEntry && av.definitions.actionEntry.properties && av.definitions.actionEntry.properties.failClosed && av.definitions.actionEntry.properties.failClosed.allOf;
  const nhReason = Array.isArray(fcAllOf) && fcAllOf.some((r) => r && r.if && r.if.properties && r.if.properties.whenUnsupported && r.if.properties.whenUnsupported.const === 'NEEDS_HUMAN' && r.then && Array.isArray(r.then.required) && r.then.required.includes('needsHumanReason') && r.then.properties && r.then.properties.needsHumanReason && r.then.properties.needsHumanReason.type === 'string');
  if (!nhReason) fail('action-vocabulary.schema: failClosed.allOf 须含 whenUnsupported=NEEDS_HUMAN ⟹ needsHumanReason 必填非空子类（NEEDS_HUMAN 恒带 reason，护栏 #14；codex R3）');

  // codex R4：护栏 #7 value 侧两条 pattern 也钉在 schema 层、golden 用金丝雀值功能性验证（防 pattern 被静默放宽）。
  const ut = fle.properties && fle.properties.forensicsRef && fle.properties.forensicsRef.properties && fle.properties.forensicsRef.properties.urlTemplate;
  if (!ut || typeof ut.pattern !== 'string' || new RegExp(ut.pattern).test('/api/save?token=sk_live_x&patientId=123') || !new RegExp(ut.pattern).test('/ai-manager/process/saveOrModifyProcessData')) fail('failure-ledger.schema: forensicsRef.urlTemplate 的 pattern 须拒 query 串凭据金丝雀、放行纯路径（护栏 #7 value 侧；codex R4）');
  const st = fle.properties && fle.properties.fingerprintInputs && fle.properties.fingerprintInputs.properties && fle.properties.fingerprintInputs.properties.signatureTemplate;
  if (!st || typeof st.pattern !== 'string') fail('failure-ledger.schema: fingerprintInputs.signatureTemplate 须带 pattern（raw locator 不进指纹输入；codex R4）');
  // codex R5-F3：R4 金丝雀只测整串 raw 形态、过窄——name 段仍可偷渡 css=/坐标对/xpath。负向变体全须被拒。
  // codex R6-F2：再扩——结构字符 []>+~（属性/组合器选择器）与大小写变体（CSS=/XPATH=/X=）也拒。
  // codex R7-F2：再扩——不带前缀标记的裸选择器/坐标变体（button.primary、//button、:has-text(…)、left=742,top=318）也拒。
  const stRe = new RegExp(st.pattern);
  for (const bad of ['css=#save:nth-child(3);x=742;y=318', 'role=button;name=css=.save:nth-child(3)', 'role=button;name=x=742,y=318', 'role=button;name=xpath=//div[3]', 'role=button;name=[data-testid=save]', 'role=button;name=button.primary > span', 'role=button;name=CSS=.save', 'role=button;name=X=742,Y=318', 'role=button;name=li~p', 'role=button;name=a+b', 'role=button;name=button.primary', 'role=button;name=//button', 'role=button;name=button:has-text("保存")', 'role=button;name=left=742,top=318']) {
    if (stRe.test(bad)) fail(`failure-ledger.schema: signatureTemplate pattern 放过 raw locator/坐标金丝雀「${bad}」（name 段偷渡；codex R4+R5-F3+R6-F2+R7-F2）`);
  }
  for (const good of ['role=button;name=保存', 'role=textbox;name=主诉描述']) {
    if (!stRe.test(good)) fail(`failure-ledger.schema: signatureTemplate pattern 误拒合法形态「${good}」（收紧不得伤及 role=…;name=… 正身）`);
  }
}
ok();

// --- run-history fixture valueRef 值须匹 schema pattern（value 侧红线，此前 golden 只扫 key 名不扫值内容）---
{
  const rh = load(S('run-history.schema.json'), 'run-history schema');
  const vrPat = new RegExp(rh.definitions.runHistoryLine.properties.parameters.properties.valueRef.pattern);
  const fx = load(F('run-history.fixture.json'), 'run-history fixture');
  for (const [i, ln] of fx.runHistoryLines.entries()) {
    const vr = ln.parameters && ln.parameters.valueRef;
    if (vr != null && !vrPat.test(vr)) fail(`run-history line[${i}]: valueRef「${vr}」不匹脱敏引用 pattern（护栏 #7，恐落 fill/press 字面量）`);
  }
}
ok();

// --- 四 schema 全量预扫（codex R5-F1）：与数据无关，未触达分支的未知关键字/format 也拦，先扫后校 ---
{
  for (const s of ['run-history', 'action-vocabulary', 'failure-ledger-entry', 'channel-driver']) {
    assertSchemaClean(load(S(`${s}.schema.json`), `schema ${s}`), `schema ${s}`);
  }
}
ok();

// --- 四 fixture 真过各自 schema（codex R3-F4 闭合：解析+抽查升级为逐字段 schema 校验，schema/fixture 漂移不再静默放过）---
{
  const rh = load(S('run-history.schema.json'), 'run-history schema');
  const rhFx = load(F('run-history.fixture.json'), 'run-history fixture');
  for (const [i, ln] of rhFx.runHistoryLines.entries()) assertValid(rh.definitions.runHistoryLine, ln, rh, `run-history line[${i}]`);
  assertValid(rh.definitions.runMetrics, rhFx.runMetrics, rh, 'run-metrics');
  ok();

  const av = load(S('action-vocabulary.schema.json'), 'action-vocabulary schema');
  assertValid(av, load(F('action-vocabulary.fixture.json'), 'action-vocabulary fixture'), av, 'action-vocabulary fixture');
  ok();

  const fle = load(S('failure-ledger-entry.schema.json'), 'failure-ledger schema');
  const fleFx = load(F('failure-ledger.fixture.json'), 'failure-ledger fixture');
  for (const [i, e] of fleFx.entries.entries()) assertValid(fle, e, fle, `failure-ledger entry[${i}]`);
  ok();

  const cd = load(S('channel-driver.schema.json'), 'channel-driver schema');
  assertValid(cd, load(F('channel-driver.fixture.json'), 'channel-driver fixture'), cd, 'channel-driver fixture');
  ok();
}

console.log(`ok   seams-freeze-v2: ${checks} 组接缝 schema+fixture 解析与不变量全过`);
process.exit(0);
