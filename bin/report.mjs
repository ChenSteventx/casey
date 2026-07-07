#!/usr/bin/env node
// bin/report.mjs —— 报告渲染器薄壳：读 report-model.json 文件 → 调 lib/report.mjs 纯函数 → 落 HTML/MD/json。
//
//   node bin/report.mjs --model <report-model.json> --out <dir>
//     落 <out>/<caseId>.report.html / .report.md / .report.json
//
// 凭据兜底门（落盘前，护栏 #7）：对将落盘的三份产物做凭据/禁字段深扫——命中 token/authorization/cookie/
// password/secret/apikey 等关键词，或 .auth/site.json 的敏感字面量混入输出，即 fail-closed 拒绝落盘、非 0 退出。
// 渲染逻辑全在 lib/report.mjs（纯函数、可 golden）；本壳只做 IO 编排 + 凭据门。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../lib/report.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';

// 凭据兜底门已抽共享件 lib/cred-gate.mjs（G5 取 B，语义一字不变）；
// 此处保留 re-export——p7-credgate-coverage.golden（冻结）从本文件 import。
export { credentialGate };

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); o[k] = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
  }
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.model || opts.model === true) { console.error('用法: node bin/report.mjs --model <report-model.json> --out <dir>'); process.exit(64); }
  const modelPath = resolve(String(opts.model));
  let model;
  try { model = JSON.parse(readFileSync(modelPath, 'utf8')); } catch (e) { console.error(`读/解析 report-model 失败：${e.message}`); process.exit(1); }

  // 回放诊断旁件（report-diagnostics 路 B，可选）：不传零行为差；传了但缺/坏 = fail-closed exit 1
  // 零落盘（报告宁缺不糊，M1）。渲染逻辑仍全在 lib（纯函数），本壳只做 IO。
  let diagnostics = null;
  if (opts['run-history'] || opts['run-metrics']) {
    diagnostics = {};
    if (opts['run-metrics']) {
      try { diagnostics.metrics = JSON.parse(readFileSync(resolve(String(opts['run-metrics'])), 'utf8')); }
      catch (e) { console.error(`读/解析 run-metrics 失败（fail-closed，宁缺不糊）：${e.message}`); process.exit(1); }
      // 坏件语义收紧（codex R2）：合法 JSON 但非对象（null/数字/数组）= 坏件，同 fail-closed 拒（不静默降级）。
      const m = diagnostics.metrics;
      if (!m || typeof m !== 'object' || Array.isArray(m)) {
        console.error('run-metrics 坏件（非对象），拒渲染（fail-closed，宁缺不糊）');
        process.exit(1);
      }
    }
    if (opts['run-history']) {
      try {
        diagnostics.history = readFileSync(resolve(String(opts['run-history'])), 'utf8')
          .split('\n').filter((s) => s.trim()).map((s) => JSON.parse(s));
      } catch (e) { console.error(`读/解析 run-history 失败（fail-closed，宁缺不糊）：${e.message}`); process.exit(1); }
      // 坏行定义收紧（codex R1-F3）：合法 JSON 但非对象、或缺 stepId/intentId 字符串键 = 坏行——
      // 同 fail-closed 拒（呈现层不猜半截行；生产端 schema 本就要求这两键）。
      for (const l of diagnostics.history) {
        if (!l || typeof l !== 'object' || Array.isArray(l) || typeof l.stepId !== 'string' || typeof l.intentId !== 'string') {
          console.error('run-history 坏行（非对象或缺 stepId/intentId），拒渲染（fail-closed，宁缺不糊）');
          process.exit(1);
        }
      }
    }
  }

  let out;
  try { out = renderReport(model, diagnostics); } catch (e) { console.error(`渲染失败：${e.message}`); process.exit(1); }

  const outputs = {
    [`${model.caseId}.report.html`]: out.html,
    [`${model.caseId}.report.md`]: out.markdown,
    [`${model.caseId}.report.json`]: out.json,
  };

  // 凭据兜底门：落盘前。fail-closed。
  const gate = credentialGate(outputs);
  if (!gate.ok) { console.error(`凭据兜底门拦截（护栏 #7）：${gate.hit}；拒绝落盘`); process.exit(1); }

  const outDir = resolve(String(opts.out || join('loop', 'reports', model.caseId)));
  try { mkdirSync(outDir, { recursive: true }); } catch (e) { console.error(`建目录失败：${e.message}`); process.exit(1); }
  const written = [];
  for (const [name, text] of Object.entries(outputs)) {
    const p = join(outDir, name);
    try { writeFileSync(p, text, 'utf8'); written.push(p); } catch (e) { console.error(`写 ${name} 失败：${e.message}`); process.exit(1); }
  }
  console.log(`报告已生成（${written.length}）：`);
  for (const p of written) console.log(`  ${p}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
