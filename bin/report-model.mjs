#!/usr/bin/env node
// bin/report-model.mjs —— 报表模型装配薄 CLI（相6 上游一步）。零 LLM。
// 冻结 CLI：node bin/report-model.mjs --verdict <f> --axes <f> --out <report-model.json>
//           [--observed <f>] [--events <f>] [--case-meta <f>] [--generated-at <iso>]
// --case-meta：可选 JSON，含 { caseId?, channel?, title?, signedAgainstBuild?, signerId?, passes?, intentTextByIntent? }
//   设计取舍（plan §2 原写 --expected）：report-model 的期望侧只需 intentText + 人签字段（signedAgainstBuild/signerId/passes），
//   均由 case-meta 投影承载；不把整份冻结 expected 契约传进装配器。
// --expected（report-fidelity G1，2026-07-02 兑现原「押后真机 bring-up」取舍）：可选读冻结 expected 契约，
//   全部断言过 sign-gate isSigned 且 signedAgainstBuild/signerId 均一才投影（任一未签/混签不投影、
//   报告如实「未签」，fail-closed 不粉饰）；--case-meta 显式字段恒优先，expected 只补缺。
//   intentText 源在 TestCase 非 expected，不在此接。
// 退出码：0 成功；64 缺必填参；1 装配/读写失败（fail-closed，不吞错）。装配器自守 schema 不变量（无 ajv、见 lib/report-model.mjs）。
import { readFileSync, writeFileSync } from 'node:fs';
import { assembleReportModel } from '../lib/report-model.mjs';
import { isSigned } from '../lib/sign-gate.mjs';

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
  console.error('用法: report-model --verdict <f> --axes <f> --out <f> [--observed <f>] [--events <f>] [--expected <f>] [--case-meta <f>] [--generated-at <iso>]');
  process.exit(64);
}

try {
  const verdict = JSON.parse(readFileSync(opts.verdict, 'utf8'));
  const axes = JSON.parse(readFileSync(opts.axes, 'utf8'));
  const observed = opts.observed ? JSON.parse(readFileSync(opts.observed, 'utf8')) : null;
  const events = opts.events ? JSON.parse(readFileSync(opts.events, 'utf8')) : null;
  const caseMeta = opts['case-meta'] ? JSON.parse(readFileSync(opts['case-meta'], 'utf8')) : {};
  const meta = { generatedAt: opts['generated-at'] || new Date().toISOString(), ...caseMeta };
  // G1 签署投影：全签且均一才投影；case-meta 显式优先（expected 只补缺）；否则不投影（如实「未签」）。
  if (opts.expected && typeof opts.expected === 'string') {
    const exp = JSON.parse(readFileSync(opts.expected, 'utf8'));
    const all = [...(exp.intents || []).flatMap((it) => it.expected || []), ...(exp.globalAssertions || [])];
    if (all.length && all.every(isSigned)) {
      const builds = new Set(all.map((a) => a.signedAgainstBuild));
      const signers = new Set(all.map((a) => a.signerId));
      // R1-F1：联合均一才投影——任一字段混签则两字段都不投影（不许挑均一的那半粉饰，fail-closed）。
      // R2-F1：签署元组原子性（跨源拼合禁）——两字段全缺才整组投影；单缺时仅当显式那半与
      // expected 元组吻合才补缺；显式对与 expected 不符则一概不补，绝不拼合两源都未背书的元组
      // （如 case-meta 版本 9.9.9 + expected 签 Steven@1.1.2 → 不得输出「Steven 签 9.9.9」）。
      if (builds.size === 1 && signers.size === 1) {
        const b = [...builds][0], s = [...signers][0];
        if (meta.signedAgainstBuild == null && meta.signerId == null) { meta.signedAgainstBuild = b; meta.signerId = s; }
        else if (meta.signedAgainstBuild == null && meta.signerId === s) meta.signedAgainstBuild = b;
        else if (meta.signerId == null && meta.signedAgainstBuild === b) meta.signerId = s;
      }
    }
  }
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
