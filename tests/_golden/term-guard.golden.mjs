#!/usr/bin/env node
// tests/_golden/term-guard.golden.mjs — 统一语言强制兜底（term-guard）回归锁。
// 甲 bin/term-guard.mjs（零 LLM，确定性）：比喻格式 R3 / 弃用别名与加粗英文 R6 / 引用豁免（仅反引号代码体，
//   自然语言引号不豁免）/ 中英混合加粗漏检回归（补 term-lint 缺口）。R5（英文是否需描述）语义模糊、已从甲硬拦撤除
//   （实测对专名/文件名/标签/常用词全误拦，HANDOFF 459 处），只留带中文括号描述者作机翻候选交乙。
// 乙 bin/term-judge.mjs（LLM 评分员，只对甲候选跑）：打桩验外层——违例拦、不确定/不可达路由人、空候选不调。
// CLI 契约（本 golden 冻结，实现照此复现）：
//   node bin/term-guard.mjs --text <file> [--emit-candidates <out>]  → exit 0 干净 / 非零 违例；候选写 out（JSON 数组）
//   node bin/term-judge.mjs --candidates <file> --stub <violate|uncertain|unreachable> [--inbox <file>]
//       violate → 非零（拦）；uncertain|unreachable → exit 0 且写 inbox 一行（路由人，不拦不放）；
//       空候选文件 → exit 0、不调 LLM、不写 inbox。
// 改本文件 = Test Ratchet 判红。
import { existsSync, writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { parseRegistry } from '../../loop-kit/bin/term-lint.mjs';
import { scanDeniedAliases } from '../../bin/term-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const GUARD = join(ROOT, 'bin', 'term-guard.mjs');
const JUDGE = join(ROOT, 'bin', 'term-judge.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-tg-'));
const B = '*'.repeat(2); // 运行时构造加粗标记，避免本 golden 源码出现字面加粗英文（防 term-lint 误扫本文件）

const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); };

let n = 0;
const write = (content) => { const p = join(tmp, `f${n++}`); writeFileSync(p, content); return p; };
function run(script, args) {
  if (!existsSync(script)) return { ran: false, code: null, stdout: '' };
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  if (r.error) return { ran: false, code: null, stdout: r.stdout || '' };
  return { ran: true, code: r.status, stdout: r.stdout || '' };
}
const guard = (text, extra = []) => run(GUARD, ['--text', write(text), ...extra]);

// ===== 甲：确定性正反向 =====
let r;
r = guard('说明。\n本体：单活契约槽\n喻体：接力棒\n关联是：同一时刻只一个持有者\n联系是：交棒才能换持有者\n');
ok('R3 正：合规比喻块放行', r.ran && r.code === 0);

r = guard('说明。\n本体：单活契约槽\n喻体：接力棒\n'); // 缺 关联是/联系是
ok('R3 反：缺字段比喻块判红', r.ran && r.code !== 0);

r = guard(`这是 ${B}baton${B} 测试`);
ok('R6 反：加粗未登记英文判红', r.ran && r.code !== 0);

r = guard(`一句：${B}baton = 槽${B} 收尾`);
ok('R6 反：中英混合加粗判红（补 term-lint 漏检）', r.ran && r.code !== 0);

r = guard('举例 `' + B + 'baton' + B + '` 收尾');
ok('引用豁免：代码体内加粗英文不判 R6', r.ran && r.code === 0);

r = guard('跑 gate 看 golden，作者 Eric Evans，文件 CONTEXT.md，阶段 R5/P7');
ok('甲不做 R5：裸英文/专名/文件名/标签整段放行（exit 0）', r.ran && r.code === 0);

const candOut = join(tmp, 'cand.json');
r = guard('这相当于把任务整个交出去', ['--emit-candidates', candOut]);
ok('预筛：信号词文本 emit 非空候选',
  r.ran && existsSync(candOut) && Array.isArray(JSON.parse(readFileSync(candOut, 'utf8'))) && JSON.parse(readFileSync(candOut, 'utf8')).length > 0);

// ── codex 异构评审 FAIL 修复回归（2026-07-01）──
const U = '_'.repeat(2);
r = guard('这是 ' + U + 'baton' + U + ' 测试');
ok('R6 下划线粗体判红', r.ran && r.code !== 0);

r = guard('这是 ' + B + 'baton\n= 槽' + B + ' 测试');
ok('R6 多行粗体判红', r.ran && r.code !== 0);

r = guard('这是 ' + B + 'baton ' + 'x'.repeat(90) + B);
ok('R6 超 80 字粗体判红', r.ran && r.code !== 0);

r = guard('实际采用「' + B + 'unregEnglishXyz' + B + '」作模块名');
ok('R6 加粗英文在自然语言引号内仍判红（引号不豁免，codex round5 #3）', r.ran && r.code !== 0);

r = guard('这是 ' + B + 'X' + B + ' 测试');
ok('R6 单字母加粗英文判红（codex round6）', r.ran && r.code !== 0);

r = guard('喻体：接力棒\n关联是：只一个持有者\n联系是：交棒才换\n');
ok('R3 以喻体起（无本体）判红', r.ran && r.code !== 0);

r = guard('说明 本体：单活契约槽\n喻体：接力棒\n');
ok('R3 本体不限行首 + 缺字段判红', r.ran && r.code !== 0);

r = guard('本体：\n喻体：\n关联是：\n联系是：\n');
ok('R3 字段全空内容判红', r.ran && r.code !== 0);

r = guard('本体：A 喻体：B 关联是：C 联系是：D');
ok('R3 四字段挤一行判红（须各独占一行）', r.ran && r.code !== 0);

r = guard('本体：A 喻体：B\n关联是：C 联系是：D');
ok('R3 两字段共一行判红', r.ran && r.code !== 0);

r = guard('本体：A 喻体：BAD\n喻体：B\n关联是：C\n联系是：D');
ok('R3 重复字段/同行多标记判红（各字段虽都独占行首）', r.ran && r.code !== 0);

r = guard('本体：A\n本体：BAD\n喻体：B\n关联是：C\n联系是：D');
ok('R3 同字段重复独占多行判红', r.ran && r.code !== 0);

r = guard('本体：\n本体：A\n喻体：B\n关联是：C\n联系是：D');
ok('R3 空字段被同名非空补票判红', r.ran && r.code !== 0);

r = guard('`本体：`A\n`本体：`BAD\n`喻体：`B\n`关联是：`C\n`联系是：`D');
ok('R3 反引号包住的声明块仍判红（豁免不绕过，codex round5 #1）', r.ran && r.code !== 0);

r = guard('关联是：同一时刻只一个持有者\n联系是：交棒才能换持有者\n');
ok('R3 只写关联是/联系是的残块也判红（任一标记触发，codex round7）', r.ran && r.code !== 0);

const camelOut = join(tmp, 'camel.json');
r = guard('新增 IngestionEnvelope 聚合根负责归一', ['--emit-candidates', camelOut]);
const camelCands = JSON.parse(readFileSync(camelOut, 'utf8'));
ok('R5 撤后：裸 CamelCase 外抛乙候选', r.ran && r.code === 0 && camelCands.some((c) => c.type === 'newterm' && /IngestionEnvelope/.test(c.term || '')));

const lowerOut = join(tmp, 'lower.json');
r = guard('跑 gate 看 golden', ['--emit-candidates', lowerOut]);
ok('裸小写常用词不外抛乙（免淹没）', r.ran && r.code === 0 && !JSON.parse(readFileSync(lowerOut, 'utf8')).some((c) => c.type === 'newterm'));

const _deny = parseRegistry().deny || [];
const _cjkAlias = (_deny.find((d) => /[一-鿿]/.test(d.alias)) || {}).alias;
if (_cjkAlias) {
  r = guard('实际方案采用「' + _cjkAlias + '」当模块名');
  ok('别名在自然语言引号内仍判（引用豁免收窄）', r.ran && r.code !== 0);
  const aliasRefOut = join(tmp, 'aliasref.json');
  r = guard('讨论 `' + _cjkAlias + '` 这个用法', ['--emit-candidates', aliasRefOut]);
  ok('别名在反引号代码体内：甲放行（不硬拦）', r.ran && r.code === 0);
  ok('别名在反引号内：外抛乙 alias-ref 候选（伪装使用交语义层判，codex round5 #2）',
    JSON.parse(readFileSync(aliasRefOut, 'utf8')).some((c) => c.type === 'alias-ref'));
}

// 别名多形态（合成 deny，codex round8）：含空格/特殊字符的 ASCII 别名也命中；词界防子串误报
ok('别名含空格的 ASCII 也命中',
  scanDeniedAliases('实际采用「old alias」当名', [{ alias: 'old alias', canonical: 'CANON' }]).length > 0);
ok('别名词界：aggregate 不误命中子串 gate',
  scanDeniedAliases('aggregate 聚合根', [{ alias: 'gate', canonical: 'CANON' }]).length === 0);
ok('别名 ASCII 大小写不敏感',
  scanDeniedAliases('用 OLD-ALIAS 了', [{ alias: 'old-alias', canonical: 'CANON' }]).length > 0);

// ===== 乙：打桩外层（hermetic）=====
const cand = write(JSON.stringify([{ span: '相当于把任务整个交出去', type: 'metaphor' }]));
const empty = write(JSON.stringify([]));
const judge = (candPath, stub, inbox) => run(JUDGE, ['--candidates', candPath, '--stub', stub, ...(inbox ? ['--inbox', inbox] : [])]);

r = judge(cand, 'violate');
ok('乙：桩判违例→拦（非零）', r.ran && r.code !== 0);

let ib = join(tmp, 'inbox-u.md');
r = judge(cand, 'uncertain', ib);
ok('乙：桩判不确定→路由人（放行且写 inbox）', r.ran && r.code === 0 && existsSync(ib) && readFileSync(ib, 'utf8').trim().length > 0);

ib = join(tmp, 'inbox-n.md');
r = judge(cand, 'unreachable', ib);
ok('乙：桩不可达→路由人（不 fail-open）', r.ran && r.code === 0 && existsSync(ib) && readFileSync(ib, 'utf8').trim().length > 0);

ib = join(tmp, 'inbox-e.md');
r = judge(empty, 'violate', ib);
ok('乙：空候选→不调评分员、放行、不写 inbox', r.ran && r.code === 0 && !existsSync(ib));

// ===== 汇总 =====
if (fails.length) { console.error('term-guard.golden FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('term-guard.golden OK'); process.exit(0);
