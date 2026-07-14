#!/usr/bin/env node
// bin/promptset-freeze.mjs —— 被测参数候选校验 + 幂等冻结薄 CLI（零 LLM、零真机、零网络）。
// 决策 docs/plans/gen-prompts/proposed/GRILL.md（D1、D4、D9）。
//
//   node bin/promptset-freeze.mjs --candidates <候选 JSON 文件> --promptset <promptset.json 路径> [--dry-run]
//
// 校验 CLI 外 LLM 合成的被测参数候选（闭合白名单 fail-closed）、幂等冻结追加进 promptset.json：
// 已有 id 绝不覆盖（深等跳过、内容冲突整批拒）、强制标 source:'llm' 可追溯、原子写、任一失败不写盘不留半份。
// 退出码：0 成功（含 0 新增幂等 / --dry-run）；64 缺参/裸旗标；65 路径闸/读取解析失败/候选校验失败/自检失败/落盘失败；
//        1 凭据兜底门或私网地址扫描命中（输入侧或输出侧）。
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { PROJECT_ROOT } from '../lib/paths.mjs';
import { freezeMergePromptset, atomicWriteFileSync, scanPrivateAddress, isProtectedPath } from '../lib/promptset-authoring.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { parsePromptset, loadBuiltinLibs, mergeCases } from '../lib/promptset.mjs';

const USAGE = '用法: casey promptset-freeze --candidates <候选 JSON 文件> --promptset <promptset.json 路径> [--dry-run]（旗标须带值）';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true; }
  }
  return o;
}
function die(code, msg) { console.error(`promptset-freeze: ${msg}`); process.exit(code); }

// 路径闸 canonical 化（同 promptset-seed.mjs，镜像实现——保护面判定共用 lib/promptset-authoring.mjs 的
// isProtectedPath，只有 realpath 解析这段 I/O 各自内联，两新 bin 各自独立、互不 import）。
function canonicalizeForGuard(targetPath) {
  let cur = resolve(targetPath);
  const suffix = [];
  while (!existsSync(cur)) {
    suffix.unshift(basename(cur));
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  let real;
  try { real = realpathSync(cur); } catch { real = cur; }
  return suffix.length ? join(real, ...suffix) : real;
}

// 解析前原文扫描 helper：命中 exit 1（凭据）或 exit 1（地址），绝不进 JSON.parse（防 e.message 携原文走 stderr 旁路）。
function gateRawTextOrExit(label, text) {
  const cg = credentialGate({ [label]: text });
  if (!cg.ok) { console.error(`promptset-freeze: 凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝处理`); process.exit(1); }
  const addr = scanPrivateAddress(text);
  if (addr.hit) { console.error(`promptset-freeze: 私网地址扫描拦截（命中 ${addr.kind}）；拒绝处理`); process.exit(1); }
}

// 安全 JSON 解析：失败只出类别码与位置下标，绝不透传 e.message 原文节选（JSON.parse 的报错会携原文前缀）。
function safeJsonParse(text, label) {
  try { return JSON.parse(text); }
  catch (e) {
    const m = /position (\d+)/.exec(String(e && e.message));
    die(65, `${label} 不是合法 JSON（解析失败，位置 ${m ? m[1] : '未知'}；原文不回显）`);
  }
}

const args = parseArgs(process.argv.slice(2));

if (typeof args['candidates'] !== 'string' || !args['candidates'] || typeof args['promptset'] !== 'string' || !args['promptset']) die(64, USAGE);
if (args['dry-run'] !== undefined && args['dry-run'] !== true) die(64, USAGE);

const candidatesArg = String(args['candidates']);
const promptsetArg = String(args['promptset']);
const dryRun = args['dry-run'] === true;

// --promptset 路径闸（65）：后缀 + canonical 化保护面（既适用于新建也适用于覆盖既有）。
if (!promptsetArg.endsWith('.json')) die(65, '--promptset 须以 .json 结尾');
const promptsetAbs = resolve(promptsetArg);
const promptsetCanonical = canonicalizeForGuard(promptsetAbs);
if (isProtectedPath(promptsetCanonical, PROJECT_ROOT)) die(65, '--promptset 指向保护面（.auth/site.json/bin/lib/loop/loop-kit/mcp/tests/_golden/prompts/_lib 之一），拒绝写入');

// 读候选原文（65 兜读失败，路径不回显）。
const candidatesRaw = (() => { try { return readFileSync(candidatesArg, 'utf8'); } catch (e) { die(65, `读 --candidates 失败（${e.code || 'ERR'}；路径不回显）`); } })();
gateRawTextOrExit('候选文件原文', candidatesRaw);

// 读存量 promptset 原文（若存在），同样解析前先扫描。
const existingRaw = existsSync(promptsetAbs) ? (() => { try { return readFileSync(promptsetAbs, 'utf8'); } catch (e) { die(65, `读 --promptset 失败（${e.code || 'ERR'}；路径不回显）`); } })() : null;
if (existingRaw !== null) gateRawTextOrExit('已有 promptset 原文', existingRaw);

const candidates = safeJsonParse(candidatesRaw, '候选文件');
if (!Array.isArray(candidates)) die(65, '候选文件须为 JSON 数组');
if (candidates.length === 0) die(65, '候选文件须为非空数组');

const existing = existingRaw === null ? [] : safeJsonParse(existingRaw, '已有 promptset 文件');
if (!Array.isArray(existing)) die(65, '已有 promptset.json 非数组，拒绝合并（保护人写存量）');

// 候选校验错误 → 只出类别码 + 位置下标 + 固定中文说明，绝不透传 e.message 原文节选（D3 output-seal）：
// CandidateValidationError.message 内嵌未登记键名/非法字段取值等候选自带内容，即便"干净"（未命中凭据兜底门
// 关键词）也不该回显——防 LLM 候选借意外字段名/取值本身把内容送进 stderr，绕过只扫值的凭据门（round-1 HIGH A2）。
const VALIDATION_ERROR_HINT = {
  SHAPE: '候选须为对象',
  UNKNOWN_KEY: '候选含未登记键（闭合白名单 id/text/category/expect，不得自带 source）',
  ID_SHAPE: 'id 非法（须匹配 ^[a-z0-9_]+$）',
  ID_RESERVED_PREFIX: 'id 撞注入向量库保留前缀（bnd_/sec_）',
  TEXT_EMPTY: 'text 须为非空字符串',
  CATEGORY_MISSING: 'category 必填（须 normal|boundary|security）',
  CATEGORY_ENUM: 'category 非法（须 normal|boundary|security）',
  EXPECT_SHAPE: 'expect 须为对象',
  EXPECT_UNKNOWN_KEY: 'expect 含未登记键',
  EXPECT_FIELD_SHAPE: 'expect 子字段形状非法',
  BATCH_DUP_ID: '批内 id 重复',
  ID_CONFLICT: '候选与已有条目冲突（id 已存在但内容或来源不同）',
};
function sanitizeFreezeError(e) {
  // 结构化 code（CandidateValidationError）优先；freezeMergePromptset 里两处普通 Error（BATCH_DUP_ID/
  // ID_CONFLICT）没有 .code 属性，退化用正则从 message 头部提取方括号类别码——码本身是硬编码字面量、
  // 永不受候选取值影响（e.g. `候选校验失败[BATCH_DUP_ID]（第 i 条）：...`，方括号内容恒为开发者写死的
  // 枚举值，不是候选自带数据），故此提取不构成原值回显。
  const explicitCode = e && typeof e.code === 'string' ? e.code : null;
  const parsedCode = !explicitCode && e && typeof e.message === 'string' ? (/\[([A-Z_]+)\]/.exec(e.message) || [])[1] : null;
  const code = explicitCode || parsedCode;
  if (code && VALIDATION_ERROR_HINT[code]) {
    const at = Number.isInteger(e && e.index) ? `（第 ${e.index} 条）` : '';
    return `候选校验失败[${code}]${at}：${VALIDATION_ERROR_HINT[code]}（原始键名/字段取值不回显）`;
  }
  return '候选校验或合并失败（fail-closed 拒写；详情不回显，防原始字段取值经报错泄露）';
}

let merged, fresh, skippedExisting;
try { ({ merged, fresh, skippedExisting } = freezeMergePromptset({ existing, candidates })); }
catch (e) { die(65, sanitizeFreezeError(e)); }

// 新增候选条目文本零裸 ://（存量条目不追溯，GRILL D3 修订）——覆盖 text 与 expect 全部子字段（mustInclude/
// mustNotInclude/note），不止 text（漏 note 会放行 expect.note 夹带的裸 :// ）。
for (const c of fresh) {
  const expectStrings = c.expect ? [...(c.expect.mustInclude || []), ...(c.expect.mustNotInclude || []), ...(c.expect.note ? [c.expect.note] : [])] : [];
  if (c.text.includes('://') || expectStrings.some((s) => s.includes('://'))) {
    die(65, `新增候选「${c.id}」text/expect 含裸 ://，拒绝`);
  }
}

// green-by-construction 自检（写盘前对合并结果自跑 parsePromptset + 与随发注入向量库 mergeCases 无撞）——
// 无论 fresh 是否为空都跑（round-1 HIGH A4 修订：此前 0 新增分支在本自检之前就 exit 0，坏存量——如非法
// source 值或撞注入向量库保留前缀的既有条目——在幂等 no-op 重跑时被静默判成功，绕过了本应 fail-closed 的
// 自检）。报错只出固定类别说明，绝不透传 e.message 原文节选（D3 output-seal，round-1 HIGH A2：parsePromptset/
// mergeCases 的报错会内嵌存量原始字段取值，即便这是自检失败的边缘路径也不例外）。
try {
  const cases = parsePromptset(merged);
  const libs = loadBuiltinLibs(join(PROJECT_ROOT, 'prompts', '_lib'));
  mergeCases(cases, libs);
} catch { die(65, 'green-by-construction 自检未过（fail-closed 拒写；详情不回显，可能含存量原始字段取值）'); }

if (fresh.length === 0) {
  console.log(`promptset-freeze: 0 新增（已幂等跳过 ${skippedExisting.length} 条），未写盘。`);
  process.exit(0);
}

if (dryRun) {
  console.log(`promptset-freeze: --dry-run，新增 ${fresh.length} 条（未写盘）：`);
  for (const c of fresh) {
    console.log(`  - ${c.id}（category=${c.category}${c.expect ? '，含 expect 软期望' : ''}）`);
  }
  process.exit(0);
}

const finalText = `${JSON.stringify(merged, null, 2)}\n`;

// 输出侧门（防御纵深）。
gateOutputOrExit(finalText);
function gateOutputOrExit(text) {
  const cg = credentialGate({ '冻结后 promptset 全文': text });
  if (!cg.ok) { console.error(`promptset-freeze: 凭据兜底门拦截输出（护栏 #7）：${cg.hit}；拒绝落盘`); process.exit(1); }
  const addr = scanPrivateAddress(text);
  if (addr.hit) { console.error(`promptset-freeze: 私网地址扫描拦截输出（命中 ${addr.kind}）；拒绝落盘`); process.exit(1); }
}

try { atomicWriteFileSync(promptsetAbs, finalText); }
catch (e) { die(65, `落盘失败（${e.code || 'ERR'}；路径不回显）`); }

console.log(`promptset-freeze: 新增 ${fresh.length} 条（source 全 llm），幂等跳过 ${skippedExisting.length} 条，合计 ${merged.length} 条 → 已冻结。`);
