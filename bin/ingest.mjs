#!/usr/bin/env node
// bin/ingest.mjs —— 相0 归一薄 CLI（零 LLM、零真机）。决策 docs/plans/ingest/proposed/GRILL.md。
//
//   node bin/ingest.mjs <caseId> --in <candidate.json> --out-dir <d>
//     候选 = LLM 在 CLI 外把杂乱原文（excel/json/txt/自由文本）归一成的 JSON（本 CLI 是 L0 校验器，不产内容）；
//     过 parseTestCase 闸 → 落 testcase-<caseId>.json（相1 casey flow-bridge 的 --testcase 输入）。
//     任一闸拒 exit 65 零落盘（半份比没有更危险）；凭据门前置扫输入原文——自由文本最可能贴凭据，
//     相0 是凭据入口第一道闸（护栏 #7），早于 JSON.parse、早于闸拒逐条回显、早于任何 mkdir。
// 退出码：0 成功；64 缺参；65 输入坏/闸拒；1 凭据兜底门拦截。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTestCase } from '../lib/parse-testcase.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true; } else o.pos.push(a); }
  return o;
}
function die(code, msg) { console.error('ingest: ' + msg); process.exit(code); }

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
// 旗标须带值：valueless 旗标被 parseArgs 解析成 true，放行会写到 ./true（codex R2-F1）——一律 64。
if (!caseId || typeof args.in !== 'string' || !args.in || typeof args['out-dir'] !== 'string' || !args['out-dir']) {
  die(64, '用法: casey ingest <caseId> --in <candidate.json> --out-dir <d>（旗标须带值）');
}
// 路径安全（同 draft.mjs）；报错不回显原值——CLI 参数在凭据门扫描面外（codex R2-F2，护栏 #7）。
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) die(65, 'caseId 含非法字符（仅限字母数字_-；原值不回显）');

// 读失败只回显 errno 不回显原始路径——路径是用户可控文本、凭据门扫不到它（codex R1-F2 同类，输出通道也是泄漏面）。
const inText = (() => { try { return readFileSync(String(args.in), 'utf8'); } catch (e) { die(65, `读候选失败（${e.code || 'ERR'}；路径不回显）`); } })();
// 凭据兜底门前置（同 flow-bridge 先例）：先扫输入原文——命中即 exit 1 零落盘零目录副作用，
// 也早于闸拒逐条回显（problems 会回显原始值，前置门防敏感值进 stderr）。
const inCg = credentialGate({ '输入候选': inText }); // output-seal C：键用固定标签、不携 --in 原始路径（与 :32/:61「路径不回显」政策一致）
if (!inCg.ok) { console.error(`ingest: 凭据兜底门拦截输入（护栏 #7）：${inCg.hit}；拒绝处理`); process.exit(1); }

let candidate;
try { candidate = JSON.parse(inText); } catch (e) { die(65, `解析候选失败：${e.message}`); }

const gate = parseTestCase(candidate, { caseId });
if (!gate.ok) {
  console.error(`ingest: 归一闸拒（${gate.problems.length} 问题，fail-closed 不落 TestCase）：`);
  for (const p of gate.problems) console.error(`  - ${p}`);
  process.exit(65);
}

const testcase = gate.testcase;
// 缺席 ingestedAt 落章（在场原样保留，金牌可字节确定）。
if (testcase.source.ingestedAt === undefined) testcase.source.ingestedAt = new Date().toISOString();

const outFile = join(resolve(String(args['out-dir'])), `testcase-${caseId}.json`);
const text = JSON.stringify(testcase, null, 2) + '\n';
// 输出侧凭据门（防御纵深）+ 通过后才 mkdir 落盘（cred 拒零目录副作用，同 flow-bridge 先例）。
const cg = credentialGate({ [outFile]: text });
if (!cg.ok) { console.error(`ingest: 凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝落盘`); process.exit(1); }
// 落盘异常捕获：未捕获 throw 会把用户可控 out-dir 全路径打进 stderr、且 exit 1 与凭据门码撞车（codex R2-F3）。
try {
  mkdirSync(resolve(String(args['out-dir'])), { recursive: true });
  writeFileSync(outFile, text, 'utf8');
} catch (e) { die(65, `落盘失败（${e.code || 'ERR'}；路径不回显）`); }
// 只回显定名产物文件（caseId 已过 ^[A-Za-z0-9_-]+$ 闸），不回显 out-dir 用户可控全路径（codex R1-F2，护栏 #7）。
console.log(`ingest: ${testcase.steps.length} 步归一过闸 → testcase-${caseId}.json（落 --out-dir 下；下一步 casey flow-bridge）`);
