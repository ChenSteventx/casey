#!/usr/bin/env node
// bin/flow-bridge.mjs —— 相1 LLM flow 草拟桥薄 CLI（零 LLM、零真机）。决策 docs/plans/flow-bridge/proposed/GRILL.md。
//
//   node bin/flow-bridge.mjs <caseId> --testcase <TestCase.json> --mapping <mapping.json> --out-dir <d>
//     mapping = LLM 在 CLI 外产的 [{intentId, atom, params}]（本 CLI 是 L0 复核器，不产内容）；
//     过桥三闸（投影忠实 + 编译知识允许集 + compile-gate.validateDraft）→ 落 flow-<caseId>.json（compile 的 --flow 输入）。
//     任一闸拒 exit 65 且零落盘（半份比没有更危险）；所有落盘过 lib/cred-gate.mjs（护栏 #7）。
// 退出码：0 成功；64 缺参；65 输入坏/闸拒；1 凭据兜底门拦截。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFlow, validateBridge } from '../lib/flow-bridge.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_FILE = join(ROOT, 'lib', 'atoms-registry.snapshot.json');

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true; } else o.pos.push(a); }
  return o;
}
function die(code, msg) { console.error('flow-bridge: ' + msg); process.exit(code); }
function readJson(f, label) { try { return JSON.parse(readFileSync(f, 'utf8')); } catch (e) { die(65, `读/解析 ${label} 失败（${f}）：${e.message}`); } }

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
if (!caseId || !args.testcase || !args.mapping || !args['out-dir']) {
  die(64, '用法: casey flow-bridge <caseId> --testcase <f> --mapping <f> --out-dir <d>');
}
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) die(65, 'caseId 含非法字符（仅限字母数字_-；原值不回显——CLI 参数在凭据门扫描面外）'); // 路径安全（同 draft.mjs）

const tcText = (() => { try { return readFileSync(String(args.testcase), 'utf8'); } catch (e) { die(65, `读 TestCase 失败：${e.message}`); } })();
const mapText = (() => { try { return readFileSync(String(args.mapping), 'utf8'); } catch (e) { die(65, `读 mapping 失败：${e.message}`); } })();
// 凭据兜底门前置（codex R1-F4/F5）：先扫输入原文——含凭据即 exit 1 零落盘，早于任何 mkdir、也早于闸拒时
// 逐条回显问题（validateDraft 的破坏性实体名错误会回显原始值，前置门防敏感值进 stderr）。
const inCg = credentialGate({ '输入 testcase': tcText, '输入 mapping': mapText }); // output-seal C：键用固定标签、不携 --testcase/--mapping 原始路径
if (!inCg.ok) { console.error(`flow-bridge: 凭据兜底门拦截输入（护栏 #7）：${inCg.hit}；拒绝处理`); process.exit(1); }

let testcase, mapping;
try { testcase = JSON.parse(tcText); } catch (e) { die(65, `解析 TestCase 失败：${e.message}`); }
try { mapping = JSON.parse(mapText); } catch (e) { die(65, `解析 mapping 失败：${e.message}`); }
if (testcase.caseId !== caseId) die(65, `TestCase.caseId（${testcase.caseId ?? '(缺)'}）与命令行 caseId（${caseId}）不一致`);
const registry = readJson(SNAPSHOT_FILE, '原子注册表快照');

const gate = validateBridge(testcase, mapping, { registry });
if (!gate.ok) {
  console.error(`flow-bridge: 桥闸拒（${gate.problems.length} 问题，fail-closed 不落 flow）：`);
  for (const p of gate.problems) console.error(`  - ${p}`);
  process.exit(65);
}

const flow = buildFlow(testcase, mapping);
const outFile = join(resolve(String(args['out-dir'])), `flow-${caseId}.json`);
const text = JSON.stringify(flow, null, 2) + '\n';
// 输出侧凭据门（防御纵深）+ 通过后才 mkdir 落盘（codex R1-F4：cred 拒零目录副作用）。
const cg = credentialGate({ [outFile]: text });
if (!cg.ok) { console.error(`flow-bridge: 凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝落盘`); process.exit(1); }
mkdirSync(resolve(String(args['out-dir'])), { recursive: true });
writeFileSync(outFile, text, 'utf8');
console.log(`flow-bridge: ${flow.steps.length} 步过桥三闸 → ${outFile}（下一步 casey compile --flow）`);
for (const s of gate.skipped || []) console.log(`  ⚠ route:human 跳过 intent「${s.intentId}」：${s.reason}（不进 flow，人工处理）`);
