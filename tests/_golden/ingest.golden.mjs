// ingest.golden.mjs —— 相0 归一（ingest，full）红金牌。实现前 lib/bin 缺席 → C1 起全红（C15 schema 自守除外，冻结即绿的回归锁）。
// 归一：LLM 在 CLI 外把杂乱原文归一成候选 JSON；bin/ingest.mjs 是 L0 确定性校验器（parseTestCase）——
// 过闸落 testcase-<caseId>.json（相1 flow-bridge 的 --testcase 输入），任一闸拒零落盘 fail-closed。
// 真值源纪律：必填集/enum 逐条从 tests/_golden/schemas/testcase.schema.json 读取比对，不抄副本（锁 lib↔schema 同刻）。
// C1 件在册；C2 happy + ingestedAt 落章/保留；C3【载荷核心】round-trip 相0→相1→compile gate；C4【真值源】逐必填字段拒 + enum 外值拒；
// C5 intentId 语义闸；C6 caseId 三向；C7 uniquePrefix 空/纯空白拒；C8 preconditions 形态；C9 route:human 三态；
// C10 未知键拒；C11 凭据门前置 + 零目录副作用；C12 半份安全；C13 契约码 64/65；C14 schemaVersion + 断言形态；
// C15 schema 自守（additionalProperties/凭据形键名/关键字允许集）；C16 casey 接线真跑非桩。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const INGEST = join(ROOT, 'bin', 'ingest.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SCHEMA_FILE = join(HERE, 'schemas', 'testcase.schema.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-ingest-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
function run(args) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// good 候选：与 flow-bridge golden 的 TESTCASE 同构（保 C3 round-trip 复用同款 mapping/前缀/前置状态）。
const CASE_ID = 'tc_ingest';
const GOOD = {
  schemaVersion: 1, caseId: CASE_ID, title: '工作流创建保存（归一样例）',
  source: { kind: 'freetext', raw: '在工作流管理里新增一条名为 atl_xx 的工作流并保存' },
  target: { startUrl: 'http://sut.invalid/ai-manager/process/list', auth: 'ref:site.json', channel: 'web' },
  preconditions: ['已登录'],
  steps: [
    { intentId: 'intent_create', intent: '新增工作流 atl_{{uniqueName}}', actionHint: 'fill', inputValue: 'atl_{{uniqueName}}', uniqueGuard: true, expected: [{ kind: 'textVisible', op: 'appears', value: '新增成功' }] },
    { intentId: 'intent_save', intent: '保存工作流', actionHint: 'click', expected: [] },
  ],
  globalAssertions: [{ kind: 'noPageError' }],
  uniquePrefix: 'atl_',
};
const MAPPING = [
  { intentId: 'intent_create', atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' }, entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }] },
  { intentId: 'intent_save', atom: 'workflow.save', params: {}, entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }] },
];
function writeCand(obj, name) { const f = join(tmp, name); writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; }
function ingest(caseId, inFile, outDir) { mkdirSync(outDir, { recursive: true }); return run([INGEST, caseId, '--in', inFile, '--out-dir', outDir]); }
const tcOut = (outDir, caseId = CASE_ID) => join(outDir, `testcase-${caseId}.json`);
// 变体候选生成器：结构化克隆后就地改。
const variant = (mut, name) => { const c = structuredClone(GOOD); mut(c); return writeCand(c, name); };

// ---------- C1 件在册 ----------
await checkAsync('C1 lib/parse-testcase 导出 parseTestCase；schema 在册 draft-07 + $id', async () => {
  const pt = await import(`file://${join(ROOT, 'lib', 'parse-testcase.mjs').replace(/\\/g, '/')}`);
  if (typeof pt.parseTestCase !== 'function') throw new Error('parse-testcase 未导出 parseTestCase');
  const schema = readJson(SCHEMA_FILE);
  if (!String(schema.$schema).includes('draft-07')) throw new Error('schema 须 draft-07');
  if (schema.$id !== 'casey/testcase.json') throw new Error(`$id 须 casey/testcase.json，实际 ${schema.$id}`);
});

// ---------- C2 happy + ingestedAt 落章/保留 ----------
await checkAsync('C2 happy：exit 0 落 testcase-<caseId>.json 字段全保；缺席 ingestedAt 落章、在场原样保留', async () => {
  const od = join(tmp, 'c2');
  const r = ingest(CASE_ID, writeCand(GOOD, 'good-c2.json'), od);
  if (r.status !== 0) throw new Error(`happy 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const out = readJson(tcOut(od));
  if (out.caseId !== CASE_ID || out.title !== GOOD.title || out.uniquePrefix !== 'atl_') throw new Error('标量字段须全保');
  if (JSON.stringify(out.steps) !== JSON.stringify(GOOD.steps)) throw new Error('steps 须逐字段保留');
  if (JSON.stringify(out.preconditions) !== JSON.stringify(GOOD.preconditions)) throw new Error('preconditions 须保留');
  if (out.source.kind !== 'freetext' || out.source.raw !== GOOD.source.raw) throw new Error('source.kind/raw 须保留（D6 存 raw）');
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(out.source.ingestedAt))) throw new Error(`缺席 ingestedAt 应落章 ISO 时刻，实际 ${out.source.ingestedAt}`);
  const od2 = join(tmp, 'c2b');
  const pinned = '2026-07-06T00:00:00.000Z';
  const f2 = variant((c) => { c.source.ingestedAt = pinned; }, 'good-c2b.json');
  if (ingest(CASE_ID, f2, od2).status !== 0) throw new Error('带 ingestedAt 的 happy 应 exit 0');
  if (readJson(tcOut(od2)).source.ingestedAt !== pinned) throw new Error('在场 ingestedAt 应原样保留（golden 可字节确定）');
});

// ---------- C3 载荷核心：round-trip 相0→相1→compile gate ----------
await checkAsync('C3 round-trip：ingest 产物 → casey flow-bridge exit 0 → casey compile --flow gate 段 exit 0', async () => {
  const od = join(tmp, 'c3');
  if (ingest(CASE_ID, writeCand(GOOD, 'good-c3.json'), od).status !== 0) throw new Error('ingest 应 exit 0');
  const mf = writeCand(MAPPING, 'mapping-c3.json');
  const od2 = join(tmp, 'c3-bridge'); mkdirSync(od2, { recursive: true });
  const rb = run([CASEY, 'flow-bridge', CASE_ID, '--testcase', tcOut(od), '--mapping', mf, '--out-dir', od2]);
  if (rb.status !== 0) throw new Error(`flow-bridge 应 exit 0，实际 ${rb.status}：${(rb.stderr || '').slice(-200)}`);
  const od3 = join(tmp, 'c3-compile'); mkdirSync(od3, { recursive: true });
  const rc = run([CASEY, 'compile', CASE_ID, '--testcase', tcOut(od), '--flow', join(od2, `flow-${CASE_ID}.json`), '--out-dir', od3]);
  if (rc.status !== 0) throw new Error(`compile gate 段应 exit 0，实际 ${rc.status}：${(rc.stderr || '').slice(-200)}`);
});

// ---------- C4 真值源防漂移：逐必填字段拒 + enum 外值拒 ----------
await checkAsync('C4 从 schema 读必填集逐字段删除必拒；source.kind 读 enum 枚举外值拒', async () => {
  const schema = readJson(SCHEMA_FILE);
  const required = schema.required;
  if (!Array.isArray(required) || required.length < 5) throw new Error(`schema.required 应含 5 必填，实际 ${JSON.stringify(required)}`);
  for (const field of required) {
    const f = variant((c) => { delete c[field]; }, `c4-miss-${field}.json`);
    const r = ingest(CASE_ID, f, join(tmp, `c4-${field}`));
    if (r.status !== 65) throw new Error(`缺必填 ${field} 应 exit 65，实际 ${r.status}`);
  }
  const srcReq = schema.definitions.source.required;
  if (!srcReq.includes('kind')) throw new Error('schema source.required 应含 kind（D3 已签）');
  const fNoKind = variant((c) => { delete c.source.kind; }, 'c4-nokind.json');
  if (ingest(CASE_ID, fNoKind, join(tmp, 'c4-nokind')).status !== 65) throw new Error('缺 source.kind 应 exit 65');
  const kinds = schema.definitions.source.properties.kind.enum;
  if (!Array.isArray(kinds) || kinds.length !== 4) throw new Error('source.kind enum 应恰 4 模态');
  const fBadKind = variant((c) => { c.source.kind = 'csv'; }, 'c4-badkind.json');
  if (ingest(CASE_ID, fBadKind, join(tmp, 'c4-badkind')).status !== 65) throw new Error('enum 外 source.kind 应 exit 65');
});

// ---------- C5 intentId 语义闸 ----------
await checkAsync('C5 intentId：重复拒 / 缺拒 / 空拒 / 纯空白拒', async () => {
  const cases = [
    ['dup', (c) => { c.steps[1].intentId = 'intent_create'; }],
    ['missing', (c) => { delete c.steps[1].intentId; }],
    ['empty', (c) => { c.steps[1].intentId = ''; }],
    ['blank', (c) => { c.steps[1].intentId = '   '; }],
  ];
  for (const [tag, mut] of cases) {
    const r = ingest(CASE_ID, variant(mut, `c5-${tag}.json`), join(tmp, `c5-${tag}`));
    if (r.status !== 65) throw new Error(`intentId ${tag} 应 exit 65，实际 ${r.status}`);
  }
});

// ---------- C6 caseId 三向 ----------
await checkAsync('C6 caseId：CLI 穿越形态 65 / 候选与 CLI 不一致 65 / 候选 pattern 违例 65', async () => {
  const good = writeCand(GOOD, 'good-c6.json');
  const r1 = ingest('x/../../evil', good, join(tmp, 'c6a'));
  if (r1.status !== 65) throw new Error(`CLI caseId 穿越应 exit 65，实际 ${r1.status}`);
  const r2 = ingest('tc_other', good, join(tmp, 'c6b'));
  if (r2.status !== 65) throw new Error(`caseId 不一致应 exit 65，实际 ${r2.status}`);
  const fBad = variant((c) => { c.caseId = 'tc evil!'; }, 'c6-badid.json');
  const r3 = ingest('tc_ingest', fBad, join(tmp, 'c6c'));
  if (r3.status !== 65) throw new Error(`候选 caseId pattern 违例应 exit 65，实际 ${r3.status}`);
});

// ---------- C7 uniquePrefix 缝 ----------
await checkAsync('C7 uniquePrefix：空串拒、纯空白拒（封 compile 长度闸缝）', async () => {
  for (const [tag, v] of [['empty', ''], ['blank', '  ']]) {
    const r = ingest(CASE_ID, variant((c) => { c.uniquePrefix = v; }, `c7-${tag}.json`), join(tmp, `c7-${tag}`));
    if (r.status !== 65) throw new Error(`uniquePrefix ${tag} 应 exit 65，实际 ${r.status}`);
  }
});

// ---------- C8 preconditions 形态（下游静默吞，唯一守点） ----------
await checkAsync('C8 preconditions：非数组拒、元素非 string 拒', async () => {
  const r1 = ingest(CASE_ID, variant((c) => { c.preconditions = '已登录'; }, 'c8a.json'), join(tmp, 'c8a'));
  if (r1.status !== 65) throw new Error(`preconditions 非数组应 exit 65，实际 ${r1.status}`);
  const r2 = ingest(CASE_ID, variant((c) => { c.preconditions = [123]; }, 'c8b.json'), join(tmp, 'c8b'));
  if (r2.status !== 65) throw new Error(`preconditions 元素非 string 应 exit 65，实际 ${r2.status}`);
});

// ---------- C9 route:human 三态 ----------
await checkAsync('C9 route:human：缺 reason 拒 / 带 reason 过且产物保留 / 枚举外 route 拒', async () => {
  const r1 = ingest(CASE_ID, variant((c) => { c.steps[1].route = 'human'; }, 'c9a.json'), join(tmp, 'c9a'));
  if (r1.status !== 65) throw new Error(`route:human 缺 reason 应 exit 65，实际 ${r1.status}`);
  const od = join(tmp, 'c9b');
  const r2 = ingest(CASE_ID, variant((c) => { c.steps[1].route = 'human'; c.steps[1].reason = '需人工核对保存结果'; }, 'c9b.json'), od);
  if (r2.status !== 0) throw new Error(`route:human 带 reason 应 exit 0，实际 ${r2.status}`);
  const step = readJson(tcOut(od)).steps[1];
  if (step.route !== 'human' || !step.reason) throw new Error('产物须原样保留 route/reason（相1 跳过通道靠它）');
  const r3 = ingest(CASE_ID, variant((c) => { c.steps[1].route = 'humann'; c.steps[1].reason = 'x'; }, 'c9c.json'), join(tmp, 'c9c'));
  if (r3.status !== 65) throw new Error(`枚举外 route（typo）应 exit 65，实际 ${r3.status}`);
});

// ---------- C10 未知键拒（additionalProperties:false 语义） ----------
await checkAsync('C10 未知键：顶层/step 级/source 级各拒', async () => {
  const cases = [
    ['top', (c) => { c.mystery = 1; }],
    ['step', (c) => { c.steps[0].mystery = 1; }],
    ['source', (c) => { c.source.mystery = 1; }],
  ];
  for (const [tag, mut] of cases) {
    const r = ingest(CASE_ID, variant(mut, `c10-${tag}.json`), join(tmp, `c10-${tag}`));
    if (r.status !== 65) throw new Error(`${tag} 级未知键应 exit 65，实际 ${r.status}`);
  }
});

// ---------- C11 凭据门前置 + 零目录副作用 ----------
await checkAsync('C11 凭据门：候选原文含凭据关键词 → exit 1、零落盘、全新 out-dir 不被创建', async () => {
  const f = variant((c) => { c.source.raw = '登录后 password=hunter2 直接进列表页'; }, 'c11.json');
  const od = join(tmp, 'c11-fresh'); // 不预建（ingest 助手会 mkdir，故直调）
  const r = run([INGEST, CASE_ID, '--in', f, '--out-dir', od]);
  if (r.status !== 1) throw new Error(`凭据门应 exit 1，实际 ${r.status}`);
  if (!/凭据|护栏/.test(r.stderr || '')) throw new Error('exit 1 须出自凭据门点名（防与 MODULE_NOT_FOUND 撞码假绿）');
  if (existsSync(od)) throw new Error('凭据拒不得创建 out-dir（零目录副作用）');
});

// ---------- C12 半份安全 ----------
await checkAsync('C12 半份安全：任一闸拒 → out-dir 无 testcase-*.json 残留', async () => {
  const od = join(tmp, 'c12');
  ingest(CASE_ID, variant((c) => { c.uniquePrefix = ''; }, 'c12.json'), od);
  const residue = existsSync(od) ? readdirSync(od).filter((n) => n.startsWith('testcase-')) : [];
  if (residue.length) throw new Error(`闸拒不得留半份：${residue.join(',')}`);
});

// ---------- C13 契约码 ----------
await checkAsync('C13 契约码：坏 JSON exit 65（非未捕获 1）；缺参 exit 64', async () => {
  const f = writeCand('not json {', 'c13.json');
  const r1 = ingest(CASE_ID, f, join(tmp, 'c13'));
  if (r1.status !== 65) throw new Error(`坏 JSON 应 exit 65，实际 ${r1.status}`);
  const r2 = run([INGEST]);
  if (r2.status !== 64) throw new Error(`零参应 exit 64，实际 ${r2.status}`);
  const r3 = run([INGEST, CASE_ID]);
  if (r3.status !== 64) throw new Error(`缺 --in/--out-dir 应 exit 64，实际 ${r3.status}`);
});

// ---------- C14 schemaVersion + 断言形态（词表归相2） ----------
await checkAsync('C14 schemaVersion≠1 拒；断言缺 kind / value 非法类型拒；未知 kind 不拒', async () => {
  const r1 = ingest(CASE_ID, variant((c) => { c.schemaVersion = 2; }, 'c14a.json'), join(tmp, 'c14a'));
  if (r1.status !== 65) throw new Error(`schemaVersion≠1 应 exit 65，实际 ${r1.status}`);
  const r2 = ingest(CASE_ID, variant((c) => { c.steps[0].expected = [{ op: 'appears' }]; }, 'c14b.json'), join(tmp, 'c14b'));
  if (r2.status !== 65) throw new Error(`断言缺 kind 应 exit 65，实际 ${r2.status}`);
  const r3 = ingest(CASE_ID, variant((c) => { c.steps[0].expected = [{ kind: 'textVisible', value: { a: 1 } }]; }, 'c14c.json'), join(tmp, 'c14c'));
  if (r3.status !== 65) throw new Error(`断言 value 非标量应 exit 65，实际 ${r3.status}`);
  const r4 = ingest(CASE_ID, variant((c) => { c.steps[0].expected = [{ kind: 'totallyUnknownKind99' }]; }, 'c14d.json'), join(tmp, 'c14d'));
  if (r4.status !== 0) throw new Error(`未知 kind 不应拒（词表归相2，护栏 #17），实际 ${r4.status}`);
});

// ---------- C15 schema 自守（冻结即绿的回归锁） ----------
await checkAsync('C15 schema 自守：对象节点全 additionalProperties:false；键名无凭据形；关键字全在允许集', async () => {
  const { FORBIDDEN_KEYWORDS } = await import(`file://${join(ROOT, 'lib', 'cred-gate.mjs').replace(/\\/g, '/')}`);
  const schema = readJson(SCHEMA_FILE);
  const KNOWN = new Set(['$ref', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'pattern', 'minimum', 'maximum', 'format', 'allOf', 'anyOf', 'oneOf', 'if', 'then', 'else', '$schema', '$id', 'title', 'description', 'definitions', 'default', 'examples']);
  const problems = [];
  (function walk(node, path) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    for (const k of Object.keys(node)) {
      if (!KNOWN.has(k) && !path.endsWith('properties') && path.split('.').pop() !== 'definitions') problems.push(`${path}.${k} 关键字不在允许集`);
    }
    if (node.properties) {
      if (node.additionalProperties !== false) problems.push(`${path} 有 properties 但 additionalProperties 非 false`);
      for (const key of Object.keys(node.properties)) {
        const lk = key.toLowerCase();
        for (const kw of FORBIDDEN_KEYWORDS) if (lk.includes(kw.trim())) problems.push(`属性名 ${path}.properties.${key} 含凭据形关键词「${kw}」`);
        walk(node.properties[key], `${path}.properties.${key}`);
      }
    }
    if (node.definitions) for (const d of Object.keys(node.definitions)) walk(node.definitions[d], `${path}.definitions.${d}`);
    if (node.items) walk(node.items, `${path}.items`);
    for (const comb of ['allOf', 'anyOf', 'oneOf']) if (Array.isArray(node[comb])) node[comb].forEach((s, i) => walk(s, `${path}.${comb}[${i}]`));
    for (const cond of ['if', 'then', 'else']) if (node[cond] && typeof node[cond] === 'object') walk(node[cond], `${path}.${cond}`);
  })(schema, '$');
  if (problems.length) throw new Error(problems.join('；'));
});

// ---------- C17 codex R1 钉红：date-time 语义 + 输出通道泄漏面 ----------
await checkAsync('C17 R1-F1 非法日期时间（2026-99-99T99:99:99Z）拒；R1-F2 stdout 不回显 out-dir 用户可控文本', async () => {
  // F1：形态像 date-time 但语义非法 → 须拒（与 schema format:date-time 同刻，非纯正则形态）。
  const r1 = ingest(CASE_ID, variant((c) => { c.source.ingestedAt = '2026-99-99T99:99:99Z'; }, 'c17a.json'), join(tmp, 'c17a'));
  if (r1.status !== 65) throw new Error(`非法日期时间应 exit 65，实际 ${r1.status}`);
  const r1b = ingest(CASE_ID, variant((c) => { c.source.ingestedAt = '2026-02-30T10:00:00Z'; }, 'c17a2.json'), join(tmp, 'c17a2'));
  if (r1b.status !== 65) throw new Error(`不存在的日期（2月30日）应 exit 65，实际 ${r1b.status}`);
  // F2：报错/成功通道也是泄漏面——out-dir 名含凭据形文本，happy 跑通但 stdout/stderr 不得回显该文本。
  const od = join(tmp, 'c17-password=dir');
  const r2 = ingest(CASE_ID, writeCand(GOOD, 'good-c17.json'), od);
  if (r2.status !== 0) throw new Error(`happy 应 exit 0，实际 ${r2.status}`);
  if (!existsSync(tcOut(od))) throw new Error('产物应落在指定 out-dir');
  const echoed = (r2.stdout || '') + (r2.stderr || '');
  if (echoed.includes('password=')) throw new Error('stdout/stderr 不得回显 out-dir 用户可控文本（输出通道也是泄漏面，护栏 #7）');
});

// ---------- C18 codex R2 钉红：valueless 旗标 / CLI 原值回显 / 落盘异常泄漏面 ----------
await checkAsync('C18 R2：旗标缺值 64；非法 caseId 不回显原值；落盘失败 65 且不回显 out-dir 路径', async () => {
  const good = writeCand(GOOD, 'good-c18.json');
  const r1 = run([INGEST, CASE_ID, '--in', good, '--out-dir']);
  if (r1.status !== 64) throw new Error(`--out-dir 缺值应 exit 64（不得写到 ./true），实际 ${r1.status}`);
  const r1b = run([INGEST, CASE_ID, '--in', '--out-dir', join(tmp, 'c18')]);
  if (r1b.status !== 64) throw new Error(`--in 缺值应 exit 64，实际 ${r1b.status}`);
  const r2 = run([INGEST, 'password=hunter2', '--in', good, '--out-dir', join(tmp, 'c18b')]);
  if (r2.status !== 65) throw new Error(`非法 caseId 应 exit 65，实际 ${r2.status}`);
  if (((r2.stderr || '') + (r2.stdout || '')).includes('hunter2')) throw new Error('非法 caseId 报错不得回显原值（CLI 参数在凭据门扫描面外）');
  const r3 = run([INGEST, CASE_ID, '--in', good, '--out-dir', '/dev/null/password=hunter2']);
  if (r3.status !== 65) throw new Error(`落盘失败应 exit 65（契约码，非未捕获 1 与凭据门撞码），实际 ${r3.status}`);
  if (((r3.stderr || '') + (r3.stdout || '')).includes('password=')) throw new Error('落盘失败报错不得回显 out-dir 路径（输出通道也是泄漏面）');
});

// ---------- C19 codex R3 钉红：非有限数 / 无 route 空白 reason / 原型链候选 ----------
await checkAsync('C19 R3：value 非有限数拒；无 route 空白 reason 拒；原型链继承属性不得满足必填（lib 级）', async () => {
  // F1：JSON 文本 1e999 经 JSON.parse 得 Infinity，typeof number 放行则落盘 stringify 变 null 自违 schema。
  const raw = JSON.stringify(structuredClone(GOOD)).replace('"新增成功"', '1e999');
  const r1 = ingest(CASE_ID, writeCand(raw, 'c19a.json'), join(tmp, 'c19a'));
  if (r1.status !== 65) throw new Error(`value:1e999（Infinity）应 exit 65，实际 ${r1.status}`);
  // F2：schema 的 reason pattern \S 不分有无 route——无 route 的空白 reason 同拒（手写闸与 schema 同刻）。
  const r2 = ingest(CASE_ID, variant((c) => { c.steps[1].reason = '   '; }, 'c19b.json'), join(tmp, 'c19b'));
  if (r2.status !== 65) throw new Error(`无 route 空白 reason 应 exit 65，实际 ${r2.status}`);
  // F3：原型链继承属性满足必填 = 校验过但序列化缺字段（CLI 经 JSON.parse 不可达；导出面须守，同 flow-bridge 原型链键先例）。
  const pt = await import(`file://${join(ROOT, 'lib', 'parse-testcase.mjs').replace(/\\/g, '/')}`);
  const ghost = Object.create(structuredClone(GOOD));
  const r3 = pt.parseTestCase(ghost, { caseId: CASE_ID });
  if (r3.ok) throw new Error('原型链候选不得过闸（Object.keys 全空、落盘将缺全部必填）');
});

// ---------- C20 codex R4 钉红：校验对象=落盘对象（稀疏洞 / 非枚举 own） ----------
await checkAsync('C20 R4：稀疏 steps 拒；非枚举 own caseId 不得满足必填（校验↔序列化同一性）', async () => {
  const pt = await import(`file://${join(ROOT, 'lib', 'parse-testcase.mjs').replace(/\\/g, '/')}`);
  // F1：new Array(1) 稀疏洞被 forEach 跳过、落盘 stringify 变 [null]（JSON.parse 不产稀疏，导出面守）。
  const sparse = structuredClone(GOOD); sparse.steps = new Array(1);
  if (pt.parseTestCase(sparse, { caseId: CASE_ID }).ok) throw new Error('稀疏 steps（new Array(1)）不得过闸（落盘变 [null]）');
  // F2：非枚举 own 属性校验读得到、stringify 省掉——校验过但产物缺必填。
  const hidden = structuredClone(GOOD); delete hidden.caseId;
  Object.defineProperty(hidden, 'caseId', { value: CASE_ID, enumerable: false });
  if (pt.parseTestCase(hidden, { caseId: CASE_ID }).ok) throw new Error('非枚举 own caseId 不得满足必填（stringify 会省掉该字段）');
});

// ---------- C21 codex R5 钉红：toJSON 合成 / accessor / 数组原型借元素 ----------
await checkAsync('C21 R5：toJSON 不得合成合法 TestCase；accessor own 属性拒；投影不调 JSON 钩子', async () => {
  const pt = await import(`file://${join(ROOT, 'lib', 'parse-testcase.mjs').replace(/\\/g, '/')}`);
  // F1 主 PoC：JSON.stringify 会调 toJSON——无必填字段的对象不得借它合成合法投影。
  const forged = { toJSON: () => structuredClone(GOOD) };
  if (pt.parseTestCase(forged, { caseId: CASE_ID }).ok) throw new Error('toJSON 钩子不得合成合法 TestCase（投影须为不调钩子的 own enumerable data）');
  // accessor own 属性：getter 取值快照会掩盖「校验时机与序列化时机取值可不同」——一律拒。
  const acc = structuredClone(GOOD); delete acc.title;
  Object.defineProperty(acc, 'title', { enumerable: true, configurable: true, get() { return '看着合法'; } });
  if (pt.parseTestCase(acc, { caseId: CASE_ID }).ok) throw new Error('accessor own 属性应拒（非 data property）');
  // 嵌套 toJSON：source 节点借钩子变形同拒。
  const nested = structuredClone(GOOD); nested.source = { toJSON: () => ({ kind: 'txt' }) };
  if (pt.parseTestCase(nested, { caseId: CASE_ID }).ok) throw new Error('嵌套 toJSON 同拒（函数值非 JSON 数据形态）');
});

// ---------- C22 codex R6 钉红：__proto__ own 键（CLI 可达！JSON.parse 建 own 键、投影赋值触发原型 setter） ----------
await checkAsync('C22 R6：顶层/嵌套 "__proto__" 键候选文件必拒（防校验读原型链、落盘成空壳）', async () => {
  // 顶层：全部必填藏在 __proto__ 值里——投影若走原型 setter，校验全过而产物是 {}。
  const rawTop = `{"__proto__":${JSON.stringify(structuredClone(GOOD))}}`;
  const od1 = join(tmp, 'c22a');
  const r1 = ingest(CASE_ID, writeCand(rawTop, 'c22a.json'), od1);
  if (r1.status !== 65) throw new Error(`顶层 __proto__ 候选应 exit 65（未知键闸），实际 ${r1.status}`);
  if (existsSync(tcOut(od1))) throw new Error('拒应零落盘（不得写出空壳产物）');
  // 嵌套：source 内带 __proto__ 键同拒（additionalProperties:false 语义盖全嵌套面）。
  const rawNested = JSON.stringify(structuredClone(GOOD)).replace('"source":{"kind":"freetext"', '"source":{"__proto__":{"kind":"txt"},"kind":"freetext"');
  const r2 = ingest(CASE_ID, writeCand(rawNested, 'c22b.json'), join(tmp, 'c22b'));
  if (r2.status !== 65) throw new Error(`嵌套 __proto__ 候选应 exit 65，实际 ${r2.status}`);
});

// ---------- C16 casey 接线真跑非桩 ----------
await checkAsync('C16 casey ingest 分发真跑：零参 exit 64 非桩 exit 3，用法串含 --in/--out-dir', async () => {
  const r = run([CASEY, 'ingest']);
  if (r.status === 3) throw new Error('casey ingest 仍是 notImplemented 桩（exit 3）');
  if (r.status !== 64) throw new Error(`casey ingest 零参应透传 exit 64，实际 ${r.status}`);
  const txt = (r.stderr || '') + (r.stdout || '');
  if (!txt.includes('--in') || !txt.includes('--out-dir')) throw new Error('用法串应含 --in/--out-dir 真实旗标');
});

console.log(`ingest golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
