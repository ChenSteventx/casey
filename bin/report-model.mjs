#!/usr/bin/env node
// bin/report-model.mjs —— 报表模型装配薄 CLI（相6 上游一步）。零 LLM。
// 冻结 CLI：node bin/report-model.mjs --verdict <f> --axes <f> --out <report-model.json>
//           [--observed <f>] [--events <f>] [--case-meta <f>] [--generated-at <iso>]
// --case-meta：可选 JSON，含 { caseId?, channel?, title?, signedAgainstBuild?, signerId?, passes?, intentTextByIntent? }
//   设计取舍（plan §2 原写 --expected）：report-model 的期望侧只需 intentText + 人签字段（signedAgainstBuild/signerId/passes），
//   均由 case-meta 投影承载；不把整份冻结 expected 契约传进装配器。完整 verdict⋈axes⋈observed⋈expected 的 expected join
//   （真 intentText 从 expected.frozen 取）押后真机 bring-up（P3）——本 hermetic 骨架 intentText 可缺省 null。
// 退出码：0 成功；64 缺必填参；1 装配/读写失败（fail-closed，不吞错）。装配器自守 schema 不变量（无 ajv、见 lib/report-model.mjs）。
import { readFileSync, writeFileSync } from 'node:fs';
import { assembleReportModel } from '../lib/report-model.mjs';

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts[a.slice(2)] = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.verdict || !opts.axes || !opts.out) {
  console.error('用法: report-model --verdict <f> --axes <f> --out <f> [--observed <f>] [--events <f>] [--case-meta <f>] [--generated-at <iso>]');
  process.exit(64);
}

try {
  const verdict = JSON.parse(readFileSync(opts.verdict, 'utf8'));
  const axes = JSON.parse(readFileSync(opts.axes, 'utf8'));
  const observed = opts.observed ? JSON.parse(readFileSync(opts.observed, 'utf8')) : null;
  const events = opts.events ? JSON.parse(readFileSync(opts.events, 'utf8')) : null;
  const caseMeta = opts['case-meta'] ? JSON.parse(readFileSync(opts['case-meta'], 'utf8')) : {};
  const meta = { generatedAt: opts['generated-at'] || new Date().toISOString(), ...caseMeta };
  const model = assembleReportModel({
    caseId: caseMeta.caseId || verdict.caseId || axes.caseId,
    channel: caseMeta.channel || 'web',
    verdict,
    axes,
    observed,
    events,
    meta,
  });
  writeFileSync(opts.out, JSON.stringify(model, null, 2) + '\n', 'utf8');
  process.exit(0);
} catch (e) {
  console.error('report-model 装配失败：' + ((e && e.message) || e));
  process.exit(1);
}
