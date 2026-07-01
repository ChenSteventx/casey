#!/usr/bin/env node
// tests/_golden/model-lane-guard.golden.mjs — 模型分层强制兜底（model-lane-guard）回归锁。
// 把 2026-07-01 锁定的模型分层两不变量从文档策略变成机制强制（决策见 HANDOFF「模型分层升级 + 三级兜底」）。
// I2 config 异构守卫 bin/config-lane-guard.mjs：读 loop/config.json 断言——
//   (a) review 主 model 家族 != implementation 主 model 家族；
//   (b) Claude 族(sonnet/opus/haiku/fable)不当 review 主 model、只能待 review.fallback；
//   (c) review.diversity === 'dissimilar'。违反→非零 + stderr 指明违反条；合规→0。
// I1 verdict 零 LLM 守卫 bin/verdict-purity-guard.mjs：静态扫 --entry 的传递依赖闭包（跟随仓内相对
//   import、bare/node: 说明符作叶子查禁），闭包内出现 LLM/网络客户端(anthropic/openai/deepseek/undici/
//   axios/node-fetch/ws/got 与 node:http(s)/net/dgram/tls、node:child_process 出网旁路)→非零；干净→0。
//   护栏 #15 裁判零 LLM 机器守；现网真值扫真 bin/verdict.mjs（R-I1 已核实闭包=单文件+node:fs）。
// hook 活证 bin/config-lane-guard-hook.mjs：读 stdin 的 PostToolUse 载荷，file_path 命中 loop/config.json
//   时跑 I2 守卫、违反→非零回合内可见拦；非 config 或合规→0。
// CLI 契约（本 golden 冻结，实现照此复现，不倒着裁）：
//   node bin/config-lane-guard.mjs --config <file>    → 0 合规 / 非零 违反（stderr 指明违反条）
//   node bin/verdict-purity-guard.mjs --entry <file>  → 0 闭包干净 / 非零 命中客户端（stderr 指明 file:说明符）
//   node bin/config-lane-guard-hook.mjs  (stdin=PostToolUse JSON) → 命中 config.json 且违反→非零；否则 0
// 反向红一律用合成夹具（合成坏 config / 合成坏依赖闭包），绝不改真 loop/config.json、绝不改真 bin/verdict.mjs。
// 改本文件 = Test Ratchet 判红。
import { existsSync, writeFileSync, mkdtempSync, mkdirSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CFG_GUARD = join(ROOT, 'bin', 'config-lane-guard.mjs');
const PURITY = join(ROOT, 'bin', 'verdict-purity-guard.mjs');
const HOOK = join(ROOT, 'bin', 'config-lane-guard-hook.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-mlg-'));

const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); };
let n = 0;
const wf = (content, name) => {
  const p = name ? join(tmp, name) : join(tmp, `f${n++}`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
};
function run(script, args, stdin) {
  if (!existsSync(script)) return { ran: false, code: null, stdout: '', stderr: '' };
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', input: stdin || '' });
  if (r.error) return { ran: false, code: null, stdout: r.stdout || '', stderr: r.stderr || '' };
  return { ran: true, code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// 合成最小合规 config（不改真 loop/config.json；反向红在此上变异）
const mkConfig = (o = {}) => {
  const review = { model: o.reviewModel || 'codex:gpt-5.5', fallback: o.fallback || ['deepseek-v4-pro', 'sonnet'] };
  if (!o.omitDiversity) review.diversity = o.diversity || 'dissimilar';
  return JSON.stringify({ schemaVersion: 1, lanes: { implementation: { model: o.implModel || 'opus' }, review } }, null, 2);
};
const cfgGuard = (path) => run(CFG_GUARD, ['--config', path]);

let r;

// ===== I2：现网真值 + 合成合规 =====
r = cfgGuard(join(ROOT, 'loop', 'config.json'));
ok('I2 现网真值：真 config.json 合规放行（exit 0）', r.ran && r.code === 0);

r = cfgGuard(wf(mkConfig(), 'ok.json'));
ok('I2 合成合规 config 放行', r.ran && r.code === 0);

// ===== I2：反向红（合成坏 config）=====
r = cfgGuard(wf(mkConfig({ reviewModel: 'sonnet' }), 'bad-claude-review.json'));
ok('I2 反：review 主为 Claude 族(sonnet) 判非零', r.ran && r.code !== 0);

r = cfgGuard(wf(mkConfig({ reviewModel: 'opus' }), 'bad-opus-review.json'));
ok('I2 反：review 主为 opus(Claude 族) 判非零', r.ran && r.code !== 0);

r = cfgGuard(wf(mkConfig({ implModel: 'codex:gpt-6', reviewModel: 'codex:gpt-5.5' }), 'bad-same-openai.json'));
ok('I2 反：review 与 implementation 同族(都 OpenAI) 判非零', r.ran && r.code !== 0);

r = cfgGuard(wf(mkConfig({ diversity: 'similar' }), 'bad-diversity.json'));
ok('I2 边界：diversity 非 dissimilar 判非零', r.ran && r.code !== 0);

r = cfgGuard(wf(mkConfig({ omitDiversity: true }), 'bad-diversity-missing.json'));
ok('I2 边界：diversity 缺失判非零', r.ran && r.code !== 0);

r = cfgGuard(wf(mkConfig({ reviewModel: 'sonnet' }), 'bad-stderr.json'));
ok('I2 反：违反时 stderr 非空指明违反条', r.ran && r.code !== 0 && (r.stderr || '').trim().length > 0);

// ===== I1：现网真值（扫真 verdict.mjs）=====
r = run(PURITY, ['--entry', join(ROOT, 'bin', 'verdict.mjs')]);
ok('I1 现网真值：verdict.mjs 闭包零 LLM/网络（exit 0）', r.ran && r.code === 0);

// ===== I1：反向红（合成坏依赖闭包，不动真 verdict.mjs）=====
const evilNet = wf("import { request } from 'node:http';\nexport const x = request;\n", 'evil-net.mjs');
const entryNet = wf("import { x } from './evil-net.mjs';\nexport default x;\n", 'entry-net.mjs');
r = run(PURITY, ['--entry', entryNet]);
ok('I1 反：闭包内 node:http 网络 import 判非零', r.ran && r.code !== 0);

const midT = wf("import { x } from './evil-net.mjs';\nexport const y = x;\n", 'mid.mjs');
const entryTrans = wf("import { y } from './mid.mjs';\nexport default y;\n", 'entry-trans.mjs');
r = run(PURITY, ['--entry', entryTrans]);
ok('I1 反：传递闭包深层网络 import 也判非零（证递归跟随非只看入口）', r.ran && r.code !== 0);

const evilLlm = wf("import OpenAI from 'openai';\nexport default OpenAI;\n", 'evil-llm.mjs');
const entryLlm = wf("import z from './evil-llm.mjs';\nexport default z;\n", 'entry-llm.mjs');
r = run(PURITY, ['--entry', entryLlm]);
ok('I1 反：闭包内 openai 客户端 import 判非零', r.ran && r.code !== 0);

const cleanDep = wf("import { readFileSync } from 'node:fs';\nexport const rf = readFileSync;\n", 'clean-dep.mjs');
const entryClean = wf("import { rf } from './clean-dep.mjs';\nexport default rf;\n", 'entry-clean.mjs');
r = run(PURITY, ['--entry', entryClean]);
ok('I1 正：合成干净闭包(只 node:fs)放行 exit 0', r.ran && r.code === 0);

// ===== hook 活证：PostToolUse 载荷（stdin JSON）=====
const badCfg = wf(mkConfig({ reviewModel: 'sonnet' }), 'a/loop/config.json');
r = run(HOOK, [], JSON.stringify({ tool_name: 'Write', tool_input: { file_path: badCfg } }));
ok('hook 活证：载荷指向坏 config.json → 拦（非零）', r.ran && r.code !== 0);

const okCfg = wf(mkConfig(), 'b/loop/config.json');
r = run(HOOK, [], JSON.stringify({ tool_name: 'Write', tool_input: { file_path: okCfg } }));
ok('hook 活证：载荷指向合规 config.json → 放行 exit 0', r.ran && r.code === 0);

const other = wf('hello', 'notes.txt');
r = run(HOOK, [], JSON.stringify({ tool_name: 'Write', tool_input: { file_path: other } }));
ok('hook 活证：非 config 文件 → 不触发、放行 exit 0', r.ran && r.code === 0);

// ── codex 异构评审 FAIL 修复回归（2026-07-01，逐条钉红防回退 fail-open）──
// H1：I1 漏检全局 fetch/网络调用（无 import 说明符）
r = run(PURITY, ['--entry', wf("const r = fetch('https://api.openai.com/v1/x');\nexport default r;\n", 'ev-fetch.mjs')]);
ok('I1 反：全局 fetch 网络调用判非零（codex H1）', r.ran && r.code !== 0);

// H2：I1 漏检计算式 import（非字面量参数）与变量 require → fail-closed
r = run(PURITY, ['--entry', wf("const m = import('node:' + 'http');\nexport default m;\n", 'ev-comp.mjs')]);
ok('I1 反：计算式 import(拼接) 判非零 fail-closed（codex H2）', r.ran && r.code !== 0);

r = run(PURITY, ['--entry', wf("const p = 'openai';\nexport const m = require(p);\n", 'ev-varreq.mjs')]);
ok('I1 反：变量 require 判非零 fail-closed（codex H2）', r.ran && r.code !== 0);

// H3：I1 禁清单漏 node:http2 网络 builtin
r = run(PURITY, ['--entry', wf("import { connect } from 'node:http2';\nexport default connect;\n", 'ev-http2.mjs')]);
ok('I1 反：node:http2 网络 builtin 判非零（codex H3）', r.ran && r.code !== 0);

// M1：I1 未解析的仓内相对边 → fail-closed（不静默跳过）
r = run(PURITY, ['--entry', wf("import { z } from './does-not-exist.mjs';\nexport default z;\n", 'ev-unres.mjs')]);
ok('I1 反：未解析仓内相对 import 判非零 fail-closed（codex M1）', r.ran && r.code !== 0);

// H4：I2 DeepSeek 变体不被误判成 OpenAI（deepseek 优先于 includes(openai)）
r = cfgGuard(wf(mkConfig({ implModel: 'deepseek-v4-pro', reviewModel: 'deepseek-openai-compatible' }), 'bad-deepseek-same.json'));
ok('I2 反：deepseek 变体与 deepseek-openai-compatible 同族判非零（codex H4）', r.ran && r.code !== 0);

// M2：hook 路径边界——myloop/config.json 非真目标、不误拦（即便内容坏也放行）
r = run(HOOK, [], JSON.stringify({ tool_name: 'Write', tool_input: { file_path: wf(mkConfig({ reviewModel: 'sonnet' }), 'myloop/config.json') } }));
ok('hook 边界：myloop/config.json 非真目标 → 不误拦 exit 0（codex M2）', r.ran && r.code === 0);

// ── codex 异构评审第 2 轮 FAIL 修复回归（2026-07-01，更深 fail-open 边界）──
// R2-H1：全局网络检测漏 globalThis./成员/可选链形式
r = run(PURITY, ['--entry', wf("const r = globalThis.fetch('https://api.openai.com');\nexport default r;\n", 'ev-gfetch.mjs')]);
ok('I1 反：globalThis.fetch 判非零（codex R2-H1）', r.ran && r.code !== 0);

// R2-H2：注释插入绕过 import 说明符正则
r = run(PURITY, ['--entry', wf("import { request } from /* c */ 'node:http';\nexport default request;\n", 'ev-cmt.mjs')]);
ok('I1 反：注释插入的 import node:http 仍判非零（codex R2-H2）', r.ran && r.code !== 0);

// R2-H3：目录 import 漏扫其 index（须解析到 index 并 fail-closed）
wf("import 'node:http';\nexport const x = 1;\n", 'netdir/index.js');
r = run(PURITY, ['--entry', wf("import './netdir';\nexport const y = 1;\n", 'ev-dir.mjs')]);
ok('I1 反：目录 import 解析到 index.js 扫出 node:http（codex R2-H3）', r.ran && r.code !== 0);

// R2-H4：includes(openai) 把未映射族误判 openai，破坏 unknown→fail-closed
r = cfgGuard(wf(mkConfig({ implModel: 'opus', reviewModel: 'qwen-openai-compatible' }), 'bad-unknown-fam.json'));
ok('I2 反：未映射族(qwen-openai-compatible)→unknown fail-closed 判非零（codex R2-H4）', r.ran && r.code !== 0);

// R2-H5：hook 路径穿越 loop/./config.json 归一后仍指真目标 → 拦
const travBad = wf(mkConfig({ reviewModel: 'sonnet' }), 'trav/loop/config.json');
const travPath = travBad.replace('/loop/config.json', '/loop/./config.json');
r = run(HOOK, [], JSON.stringify({ tool_name: 'Write', tool_input: { file_path: travPath } }));
ok('hook 边界：loop/./config.json 归一后拦坏 config（codex R2-H5）', r.ran && r.code !== 0);

// ── codex 异构评审第 3 轮 FAIL 修复回归（2026-07-01，minified 与 symlink 边界）──
// R3-H1：无空白 minified 静态 import/export-from
r = run(PURITY, ['--entry', wf("import{connect}from'node:http2';export const c=connect;\n", 'ev-min.mjs')]);
ok('I1 反：minified import{x}from(无空白) node:http2 判非零（codex R3-H1）', r.ran && r.code !== 0);

r = run(PURITY, ['--entry', wf("export*from'node:net';\n", 'ev-minexp.mjs')]);
ok('I1 反：minified export*from(无空白) node:net 判非零（codex R3-H1）', r.ran && r.code !== 0);

wf("import{connect}from'node:http';export const q=connect;\n", 'mindep.mjs');
r = run(PURITY, ['--entry', wf("import{q}from'./mindep.mjs';export default q;\n", 'ev-minrel.mjs')]);
ok('I1 反：minified 相对边递归扫出深层 node:http（codex R3-H1）', r.ran && r.code !== 0);

// R3-M2：符号链接别名指向真 config → realpath 后仍拦（文件系统不支持 symlink 则跳过）
try {
  const realBad = wf(mkConfig({ reviewModel: 'sonnet' }), 'symreal/loop/config.json');
  const linkPath = join(tmp, 'cfg-link.json');
  symlinkSync(realBad, linkPath);
  r = run(HOOK, [], JSON.stringify({ tool_name: 'Write', tool_input: { file_path: linkPath } }));
  ok('hook 边界：symlink 别名指向真 config → realpath 后拦（codex R3-M2）', r.ran && r.code !== 0);
} catch { /* 文件系统不支持 symlink：跳过该断言 */ }

// ===== 汇总 =====
if (fails.length) { console.error('model-lane-guard.golden FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('model-lane-guard.golden OK'); process.exit(0);
