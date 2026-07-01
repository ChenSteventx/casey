#!/usr/bin/env node
// bin/report-model.mjs —— 报表模型装配薄 CLI（相6 上游一步）。零 LLM。
// 冻结 CLI：node bin/report-model.mjs --verdict <f> --axes <f> --out <report-model.json>
//           [--observed <f>] [--events <f>] [--case-meta <f>] [--generated-at <iso>]
// --case-meta：可选 JSON，含 { caseId?, channel?, title?, signedAgainstBuild?, signerId?, passes?, intentTextByIntent? }
// 退出码：0 成功；64 缺必填参；1 装配/读写失败（fail-closed，不吞错）。
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
