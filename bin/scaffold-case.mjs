#!/usr/bin/env node
// bin/scaffold-case.mjs —— 相0 前段脚手架薄 CLI（零 LLM、零真机）。决策 docs/plans/ingest-scaffold/proposed/GRILL.md。
//
//   node bin/casey.mjs scaffold-case <caseId> --from-text <text-file> --out-dir <d>
//     读一段自由文本用例 → 零 LLM 包成 schema 合规的候选骨架（source.kind:'freetext' + source.raw 泊原文 +
//     一条 route:human 占位步），开箱过 parseTestCase → 落 <out-dir>/scaffold-candidate-<caseId>.json。
//     候选非权威：须 CLI 外 LLM 按归一提示模板把 source.raw 归一成真实意图步 → 经 casey ingest 重新入场 →
//     重走 flow-bridge→compile→draft→人签才算数（护栏 #16）。自由文本是头号凭据粘贴向量，前置凭据门
//     早于任何回显与 mkdir（护栏 #7）；任一闸拒零骨架落盘（半份比没有更危险）。
// 退出码：0 成功；64 缺参/裸旗标；65 输入坏·闸拒（caseId 形状/凭据、读文件、green-by-construction 自检、落盘）；1 前置凭据门命中。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildCandidateSkeleton } from '../lib/ingest-scaffold.mjs';
import { parseTestCase } from '../lib/parse-testcase.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true; } else o.pos.push(a); }
  return o;
}
function die(code, msg) { console.error('scaffold-case: ' + msg); process.exit(code); }

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
// 旗标须带值：valueless 旗标被 parseArgs 解析成 true，放行会写到 ./true（同 ingest 先例）——一律 64。
if (!caseId || typeof args['from-text'] !== 'string' || !args['from-text'] || typeof args['out-dir'] !== 'string' || !args['out-dir']) {
  die(64, '用法: casey scaffold-case <caseId> --from-text <text-file> --out-dir <d>（旗标须带值）');
}
// 路径安全（同 ingest.mjs:29）；报错不回显原值——CLI 参数在凭据门扫描面外（护栏 #7）。
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) die(65, 'caseId 含非法字符（仅限字母数字_-；原值不回显）');
// caseId 会落进过凭据门的候选文件名与产物——含凭据关键词或敏感字面量前置用同一门判、清晰 exit 65（镜像 intake.mjs:36）。
if (!credentialGate({ caseId }).ok) die(65, 'caseId 命中凭据门（含凭据关键词或敏感字面量；请改 caseId 后重试；原值不回显）');

// 读失败只回显 errno 不回显原始路径——路径是用户可控文本、凭据门扫不到它（护栏 #7，同 ingest.mjs:32）。
const raw = (() => { try { return readFileSync(String(args['from-text']), 'utf8'); } catch (e) { die(65, `读自由文本失败（${e.code || 'ERR'}；路径不回显）`); } })();

// 前置凭据门（护栏 #7，GRILL D7）：自由文本是头号凭据粘贴向量——读入后、包骨架前先扫原文，命中即 exit 1
// 零骨架落盘零目录副作用（早于任何回显与 mkdir，镜像 ingest.mjs:35）。存下的必是干净原文。
const inCg = credentialGate({ '输入自由文本': raw }); // output-seal：键用固定标签、不携 --from-text 原始路径
if (!inCg.ok) { console.error(`scaffold-case: 凭据兜底门拦截输入（护栏 #7）：${inCg.hit}；拒绝处理`); process.exit(1); }

const skeleton = buildCandidateSkeleton(raw, { caseId });

// green-by-construction 自检（GRILL D8，纵深）：脚手架落盘前对自己产的骨架自跑 parseTestCase（零 LLM）；
// 若竟不过（骨架 bug）→ fail-closed exit 65 拒落盘，绝不落半份。把「脚手架产的候选必过 parseTestCase」
// 变成运行期不变量、不只金牌指望；脚手架绝不在 parseTestCase 之外另开旁路。
const selfCheck = parseTestCase(skeleton, { caseId });
if (!selfCheck.ok) {
  console.error('scaffold-case: 候选骨架 green-by-construction 自检未过（骨架自违 parseTestCase 契约，fail-closed 拒落盘）：');
  for (const p of selfCheck.problems) console.error(`  - ${p}`);
  process.exit(65);
}

const outFile = join(resolve(String(args['out-dir'])), `scaffold-candidate-${caseId}.json`);
const text = JSON.stringify(skeleton, null, 2) + '\n';
// 输出侧凭据门（防御纵深，命中 exit 1 零落盘，镜像 ingest.mjs:55）。source.raw 泊的 authoring URL 是合法内容、
// 不剥（GRILL D7，与 distill C6a 差异）；凭据值由本门拦。
const outCg = credentialGate({ [outFile]: text });
if (!outCg.ok) { console.error(`scaffold-case: 凭据兜底门拦截（护栏 #7）：${outCg.hit}；拒绝落盘`); process.exit(1); }
// 落盘异常捕获：未捕获 throw 会把用户可控 out-dir 全路径打进 stderr、且 exit 1 与凭据门码撞车（同 ingest.mjs:58）。
try {
  mkdirSync(resolve(String(args['out-dir'])), { recursive: true }); // 通过后才 mkdir：前置闸拒时零目录副作用
  writeFileSync(outFile, text, 'utf8');
} catch (e) { die(65, `落盘失败（${e.code || 'ERR'}；路径不回显）`); }
// 成功不回显 --from-text/--out-dir 绝对路径（output-seal），只报定名产物 + 降权落地提示（护栏 #7/#16）。
console.log(`scaffold-case: 候选骨架已落 → scaffold-candidate-${caseId}.json（落 --out-dir 下）`);
console.log('scaffold-case: 候选非权威——须 CLI 外 LLM 按归一提示模板把 source.raw 归一成真实意图步 → 经 casey ingest 重新入场 → 重走 flow-bridge→compile→draft→人签才算数；本脚手架不签署、不回放。');
