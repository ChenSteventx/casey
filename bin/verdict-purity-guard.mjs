#!/usr/bin/env node
// bin/verdict-purity-guard.mjs — I1 verdict 零 LLM 守卫（model-lane-guard 契约，零 LLM 确定性静态扫描）。
// 静态扫 --entry 文件的传递依赖闭包：跟随仓内相对 import/require（./ ../），bare 与 node: 说明符作叶子查禁。
// 闭包内出现 LLM/网络客户端 → 退非零 + stderr 指明 file:说明符；干净 → 退 0。护栏 #15 裁判零 LLM 机器守。
// 只读扫描、不加载/执行被扫模块、不解析 node_modules（bare 说明符只查名不跟随）；不改被扫文件。
// 保守取向（源文本级）：宁可对形如 import 的注释/字符串误报（fail-closed），也不漏放真出网 import。
// 威胁模型：面向 verdict.mjs 这类小而干净文件的「意外回归」兜底（有人误加 LLM/网络依赖即拦），
//   非对抗蓄意混淆的健全沙箱——eval / new Function / Function('return fetch')() / unicode 转义说明符 /
//   运行时属性拼接等仍在射程外；要对抗健全需 AST 或真实模块加载（另论）。当前用源文本正则 + 去注释 + fail-closed
//   覆盖常见与近邻绕过（import/require/动态 import/全局 fetch 及成员/可选链/注释插入/目录 index/未解析边）。
// 接入 casey selftest --tier1 扫 bin/verdict.mjs。冻结契约见 tests/_golden/model-lane-guard.golden.mjs。
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 出网/LLM 能力清单（bare 或 node: 说明符命中即禁）
const DENIED_BUILTINS = new Set(['http', 'https', 'http2', 'net', 'dgram', 'dns', 'tls', 'child_process']);
const DENIED_PKGS = ['anthropic', '@anthropic-ai', 'openai', 'deepseek', 'undici', 'axios', 'node-fetch', 'ws', 'got'];

export function isDeniedSpecifier(spec) {
  const s = String(spec).toLowerCase().trim();
  const bare = s.replace(/^node:/, '');
  const root = bare.split('/')[0]; // node:dns/promises 等子路径归到根 dns（codex H3 邻域加固）
  if (DENIED_BUILTINS.has(root)) return true;
  return DENIED_PKGS.some((p) => s === p || s.startsWith(p + '/'));
}

// 抽出一个文件里所有 import / export-from / dynamic-import / require 的说明符
// \b 而非 \s：容 minified 无空白形式 import{x}from'y' / export*from'y'（codex R3-H1）
const SPEC_RE = /(?:import|export)\b[^;'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
function extractSpecifiers(text) {
  const out = [];
  let m;
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(text)) !== null) out.push(m[1] || m[2] || m[3]);
  return out;
}

// 计算式 import()/require()（参数非纯字符串字面量）→ 静态验不了真实说明符，fail-closed（codex H2）
const CALL_RE = /(?<![.\w$])(import|require)\s*\(([^)]*)\)/g;
const LITERAL_ARG = /^\s*(['"])[^'"]*\1\s*$/;
function extractComputedDynamic(text) {
  const out = [];
  let m;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(text)) !== null) {
    if (!LITERAL_ARG.test(m[2])) out.push(`${m[1]}(${m[2].trim().slice(0, 40)})`);
  }
  return out;
}

// 全局网络调用（无 import 说明符，如 fetch/XHR/WebSocket/EventSource，codex H1）
const GLOBAL_NET = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport'];
function extractGlobalNet(text) {
  const out = [];
  for (const name of GLOBAL_NET) {
    // \b 前界允许 globalThis./window./self./x.NAME 成员形式；(?:\?\.)? 容可选链 NAME?.()（codex R2-H1）
    if (new RegExp(`\\b${name}\\s*(?:\\?\\.)?\\s*\\(`).test(text)) out.push(name);
  }
  if (/\bsendBeacon\s*(?:\?\.)?\s*\(/.test(text)) out.push('sendBeacon');
  return out;
}

// 去块注释与行注释（防注释插入绕过说明符正则，codex R2-H2）。源文本级近似，非完整词法器。
function stripComments(text) {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, ' ');   // 块注释
  s = s.replace(/([^:'"\\])\/\/[^\n]*/g, '$1');      // 行注释（避开 :// 与紧邻引号/转义的粗启发）
  return s;
}

function resolveRelative(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const cands = [base, base + '.mjs', base + '.js', base + '.cjs', base + '/index.mjs', base + '/index.js', base + '/index.cjs'];
  for (const c of cands) {
    if (!existsSync(c)) continue;
    try { if (statSync(c).isDirectory()) continue; } catch { continue; } // 目录不算解析成功，继续试其 index.*（codex R2-H3）
    return c;
  }
  return null;
}

// 返回 { clean, hits:[{file, specifier}], visited:[file] }
export function scanClosure(entryPath) {
  const hits = [];
  const visited = new Set();
  const stack = [resolve(entryPath)];
  while (stack.length) {
    const file = stack.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    let raw;
    try { raw = readFileSync(file, 'utf8'); }
    catch { hits.push({ file, specifier: '(unreadable)', kind: 'unreadable-edge (fail-closed)' }); continue; } // codex R2-H3 邻域
    const text = stripComments(raw); // 去注释后再抽（codex R2-H2）
    for (const spec of extractSpecifiers(text)) {
      if (spec.startsWith('./') || spec.startsWith('../')) {
        const resolved = resolveRelative(file, spec);
        if (resolved) stack.push(resolved);
        else hits.push({ file, specifier: spec, kind: 'unresolved-internal-edge' }); // 仓内相对边解析不到：fail-closed（codex M1）
      } else if (isDeniedSpecifier(spec)) {
        hits.push({ file, specifier: spec, kind: 'denied-module' });
      }
      // 其余 bare 说明符（非禁）= 允许的叶子，不跟随、不判
    }
    for (const dyn of extractComputedDynamic(text)) hits.push({ file, specifier: dyn, kind: 'computed-dynamic-import' }); // codex H2
    for (const g of extractGlobalNet(text)) hits.push({ file, specifier: g, kind: 'global-network-call' }); // codex H1
  }
  return { clean: hits.length === 0, hits, visited: [...visited] };
}

function main() {
  const argv = process.argv.slice(2);
  const ei = argv.indexOf('--entry');
  if (ei < 0 || !argv[ei + 1]) { console.error('用法: verdict-purity-guard --entry <path>'); process.exit(2); }
  const entry = argv[ei + 1];
  if (!existsSync(resolve(entry))) { console.error(`verdict-purity-guard: entry 不存在 ${entry}（fail-closed）`); process.exit(1); }
  const { clean, hits } = scanClosure(entry);
  if (!clean) {
    console.error('verdict-purity-guard: 依赖闭包内出现 LLM/网络客户端（护栏 #15 裁判零 LLM）：');
    for (const h of hits) console.error(`  - ${h.file} : ${h.specifier} [${h.kind}]`);
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
