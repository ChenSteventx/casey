#!/usr/bin/env node
// bin/promptset-seed.mjs —— 被测参数合成种子模板薄 CLI（零 LLM、零真机、零网络）。
// 决策 docs/plans/gen-prompts/proposed/GRILL.md（D1-D3、D9）。
//
//   node bin/promptset-seed.mjs --agent-name <被测 agent 中文名> [--embedded <系统提示词文件>]
//        [--n <条数，默认 6，1..50>] --out <种子模板输出路径.md>
//
// 零 LLM 确定性产一份「合成种子模板」（生成指引 + 候选产物格式说明），交给 CLI 外 LLM（当前协助你的会话）
// 按模板合成被测参数候选，再跑 casey promptset-freeze 校验冻结。本 CLI 全程不碰模型与网络、不接凭据。
// 退出码：0 成功；64 缺参/裸旗标/--n 越界；65 路径闸/agent-name 凭据门/读文件/落盘失败；1 内容侧凭据门或私网地址扫描命中。
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { PROJECT_ROOT } from '../lib/paths.mjs';
import { buildSeedTemplate, atomicWriteFileSync, scanPrivateAddress, isProtectedPath } from '../lib/promptset-authoring.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';

const USAGE = '用法: casey promptset-seed --agent-name <被测 agent 中文名> [--embedded <系统提示词文件>] [--n <条数，默认 6，1..50>] --out <种子模板输出路径.md>（旗标须带值）';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true; }
  }
  return o;
}
function die(code, msg) { console.error(`promptset-seed: ${msg}`); process.exit(code); }

// 路径闸（GRILL D9）：canonical 化——从最深已存在祖先 realpath，再把不存在的后缀词法接回，
// 封「符号链接祖先指向保护面」（包括祖先本身尚不存在的中间目录）绕过。
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

const args = parseArgs(process.argv.slice(2));

if (typeof args['agent-name'] !== 'string' || !args['agent-name'] || typeof args['out'] !== 'string' || !args['out']) die(64, USAGE);
if (args['embedded'] === true) die(64, USAGE);
if (args['n'] === true) die(64, USAGE);

let n = 6;
if (args['n'] !== undefined) {
  n = Number(args['n']);
  if (!Number.isInteger(n) || n < 1 || n > 50) die(64, `--n 非法（须 1..50 整数）\n${USAGE}`);
}

const agentName = args['agent-name'];
const outArg = String(args['out']);

// --out 后缀闸（65）。
if (!outArg.endsWith('.md')) die(65, '--out 须以 .md 结尾');

// agent-name 凭据门（65，镜像 scaffold-case 的 caseId 门：identifier 类小输入命中即 65，原值不回显）。
if (!credentialGate({ '被测 agent 名': agentName }).ok) die(65, '--agent-name 命中凭据兜底门（护栏 #7；原值不回显）');

// --out 路径闸：canonical 化后拒写保护面；已存在文件拒绝覆盖（65）。
const outAbs = resolve(outArg);
const outCanonical = canonicalizeForGuard(outAbs);
if (isProtectedPath(outCanonical, PROJECT_ROOT)) die(65, '--out 指向保护面（.auth/site.json/bin/lib/loop/loop-kit/mcp/tests/_golden/prompts/_lib 之一），拒绝写入');
if (existsSync(outAbs)) die(65, '--out 已存在，拒绝覆盖（种子模板不得覆盖既有文件）');

// 读 embedded（若给）。读失败只回显 errno，不回显路径（护栏 #7，镜像 scaffold-case）。
let embedded = '';
if (typeof args['embedded'] === 'string' && args['embedded']) {
  try { embedded = readFileSync(args['embedded'], 'utf8'); }
  catch (e) { die(65, `读 --embedded 失败（${e.code || 'ERR'}；路径不回显）`); }
}

// 内容侧门（在任何截断/规范化之前，对全文原文扫描——防凭据藏在截断点之后溜过，GRILL D3 修订）：
// 先凭据兜底门（exit 1），再私网地址负向扫描（exit 1，credentialGate 非地址门，独立扫描）。
if (embedded) {
  const cg = credentialGate({ '内嵌系统提示词原文': embedded });
  if (!cg.ok) { console.error(`promptset-seed: 凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝处理`); process.exit(1); }
  const addr = scanPrivateAddress(embedded);
  if (addr.hit) { console.error(`promptset-seed: 私网地址扫描拦截（命中 ${addr.kind}）；拒绝处理`); process.exit(1); }
}

const template = buildSeedTemplate({ agentName, embedded, n });

// 输出侧门（防御纵深）+ 零裸 :// 硬约束。
{
  const cg = credentialGate({ 合成种子模板: template });
  if (!cg.ok) { console.error(`promptset-seed: 凭据兜底门拦截输出（护栏 #7）：${cg.hit}；拒绝落盘`); process.exit(1); }
  const addr = scanPrivateAddress(template);
  if (addr.hit) { console.error(`promptset-seed: 私网地址扫描拦截输出（命中 ${addr.kind}）；拒绝落盘`); process.exit(1); }
  if (template.includes('://')) die(65, '产物含裸 ://（不应发生，内部一致性检查失败）');
}

try { atomicWriteFileSync(outAbs, template); }
catch (e) { die(65, `落盘失败（${e.code || 'ERR'}；路径不回显）`); }

console.log('promptset-seed: 合成种子模板已落盘。');
console.log('promptset-seed: 请按模板指引在本会话（CLI 外 LLM）合成候选、存成 JSON 文件，再跑 casey promptset-freeze --candidates <f> --promptset <promptset.json> 完成校验与幂等冻结（合成在 CLI 外，本命令全程零 LLM 零网络）。');
