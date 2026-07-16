#!/usr/bin/env node
// bin/report.mjs —— 报告渲染器薄壳：读 report-model.json 文件 → 调 lib/report.mjs 纯函数 → 落 HTML/MD/json。
//
//   node bin/report.mjs --model <report-model.json> --out <dir>
//     落 <out>/<caseId>.report.html / .report.md / .report.json
//
// 凭据兜底门（落盘前，护栏 #7）：对将落盘的三份产物做凭据/禁字段深扫——命中 token/authorization/cookie/
// password/secret/apikey 等关键词，或 .auth/site.json 的敏感字面量混入输出，即 fail-closed 拒绝落盘、非 0 退出。
// 渲染逻辑全在 lib/report.mjs（纯函数、可 golden）；本壳只做 IO 编排 + 凭据门。
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, renderAggregate } from '../lib/report.mjs';
import { assembleAggregateModel } from '../lib/report-model.mjs';
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

// 多用例聚合（regress-promptset，兑现 report-spec §7）：扫 <dir>/*/<caseId>.report.json 旁车 →
// assembleAggregateModel（纯函数）→ renderAggregate（三形态）→ credentialGate → 落 index.report.{html,md,json}。
// 排除聚合自身 index.report.json（在 <dir> 根、非子目录，*/ 扫描天然不含）。畸形/坏 JSON fail-closed exit 1。
function aggregateMain(opts) {
  const dir = resolve(String(opts.aggregate));
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { console.error('report --aggregate: 目录不可读'); process.exit(1); }
  // 子目录名（= promptId）稳定排序后再装配：readdirSync 无顺序契约（各 OS/文件系统 order 不一——
  // Casey 覆盖 win/wsl/linux/macos），不排序则聚合行序/横幅序随文件系统漂移，破 byte-identical 确定性可回放。
  // 内层 files.sort() 已排，外层子目录同款按名排齐（assembleAggregateModel 忠实沿 reports[] 序出横幅+组内序）。
  const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const reports = [];
  for (const name of subdirs) {
    const sub = join(dir, name);
    let files;
    try { files = readdirSync(sub); } catch { continue; }
    for (const f of files.sort()) {
      if (!f.endsWith('.report.json')) continue;
      if (!/^(?!\.+$)[A-Za-z0-9._-]+$/.test(name) || !/^(?!\.+$)[A-Za-z0-9._-]+$/.test(f)) {
        console.error('report --aggregate: 旁车路径非法（内容不回显），fail-closed');
        process.exit(1);
      }
      try {
        const report = JSON.parse(readFileSync(join(sub, f), 'utf8'));
        report.reportHref = `${name}/${f.replace(/\.report\.json$/, '.report.html')}`;
        reports.push(report);
      }
      catch { console.error('report --aggregate: 旁车不是合法 JSON（内容不回显），fail-closed'); process.exit(1); }
    }
  }
  if (reports.length === 0) { console.error('report --aggregate: 未找到 <dir>/*/*.report.json 旁车'); process.exit(1); }
  let aggModel; let out;
  try { aggModel = assembleAggregateModel({ reports, generatedAt: opts['generated-at'] || new Date().toISOString() }); }
  catch (e) { console.error(`report --aggregate 装配失败（fail-closed）：${e.message}`); process.exit(1); }
  try { out = renderAggregate(aggModel); } catch (e) { console.error(`聚合渲染失败：${e.message}`); process.exit(1); }
  const outputs = { 'index.report.html': out.html, 'index.report.md': out.markdown, 'index.report.json': out.json };
  const gate = credentialGate(outputs);
  if (!gate.ok) { console.error(`凭据兜底门拦截（护栏 #7）：${gate.hit}；拒绝落盘`); process.exit(1); }
  const outDir = resolve(String(opts.out || dir));
  try { mkdirSync(outDir, { recursive: true }); } catch (e) { console.error(`建目录失败：${e.message}`); process.exit(1); }
  const written = [];
  for (const [name, text] of Object.entries(outputs)) {
    const p = join(outDir, name);
    try { writeFileSync(p, text, 'utf8'); written.push(p); } catch (e) { console.error(`写 ${name} 失败：${e.message}`); process.exit(1); }
  }
  console.log(`聚合报告已生成（${written.length}）：`);
  for (const p of written) console.log(`  ${p}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aggregate && opts.aggregate !== true) return aggregateMain(opts);
  if (!opts.model || opts.model === true) { console.error('用法: node bin/report.mjs --model <report-model.json> --out <dir>  |  --aggregate <dir> [--out <dir>]'); process.exit(64); }
  const modelPath = resolve(String(opts.model));
  let model;
  try { model = JSON.parse(readFileSync(modelPath, 'utf8')); } catch { console.error('读/解析 report-model 失败（不是合法 JSON 或不可读，内容不回显）'); process.exit(1); }
  // output-seal A12（穿越面）：model.caseId 进 <caseId>.report.* 文件名与缺省 outDir 路径构造——五 CLI 的
  // 字符集闸在这条链集体缺席（report-model 装配处也无校验）。此处补同款 fail-closed 闸：非法即 exit 65 零落盘、原值不回显。
  if (typeof model?.caseId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(model.caseId)) {
    console.error('report: report-model.caseId 含非法字符或缺失（仅限字母数字_-，值进文件名/路径构造须防穿越；原值不回显）');
    process.exit(65);
  }

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
