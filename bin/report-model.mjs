#!/usr/bin/env node
// bin/report-model.mjs —— 报表模型装配薄 CLI（相6 上游一步）。零 LLM。
// 冻结 CLI：node bin/report-model.mjs --verdict <f> --axes <f> --out <report-model.json>
//           [--observed <f>] [--events <f>] [--case-meta <f>] [--generated-at <iso>] [--video-meta <f>]
// --case-meta：可选 JSON，含 { caseId?, channel?, title?, signedAgainstBuild?, signerId?, passes?, intentTextByIntent? }
//   设计取舍（plan §2 原写 --expected）：report-model 的期望侧只需 intentText + 人签字段（signedAgainstBuild/signerId/passes），
//   均由 case-meta 投影承载；不把整份冻结 expected 契约传进装配器。
// --expected（report-fidelity G1，2026-07-02 兑现原「押后真机 bring-up」取舍）：可选读冻结 expected 契约，
//   全部断言过 sign-gate isSigned 且 signedAgainstBuild/signerId 均一才投影（任一未签/混签不投影、
//   报告如实「未签」，fail-closed 不粉饰）；--case-meta 显式字段恒优先，expected 只补缺。
//   intentText 源在 TestCase 非 expected，不在此接。
// --video-meta（replay-video GRILL D2/M3）：可选读 replay 落的视频元数据旁件，逐步填 attachments{video,videoAt}
//   （schema 预留位）与败步 defectTicket.videoAt；缺席零行为差；坏件 fail-closed exit 1 零落盘（report-diagnostics 同律）。
// 退出码：0 成功；64 缺必填参；1 装配/读写失败（fail-closed，不吞错）。装配器自守 schema 不变量（无 ajv、见 lib/report-model.mjs）。
import { readFileSync, writeFileSync } from 'node:fs';
import { assembleReportModel } from '../lib/report-model.mjs';
import { isSigned } from '../lib/sign-gate.mjs';

// 视频元数据旁件语义校验（fail-closed：任一不合抛错→exit 1 零落盘）。
// 冻结形状：{ schemaVersion:1, file: 纯相对文件名（零 :// 零路径段）, startedAt: 有限数, steps: [{stepId, videoAt>=0}] }
function validateVideoMeta(v) {
  const bad = (m) => { throw new Error(`视频元数据旁件非法（fail-closed）：${m}`); };
  if (!v || typeof v !== 'object' || Array.isArray(v)) bad('须为对象');
  if (v.schemaVersion !== 1) bad(`schemaVersion 须 1（实为 ${v.schemaVersion}）`);
  // 纯文件名白名单（codex R2 口径 + R3-N5 收窄）：任意冒号/斜杠/反斜杠/编码字符/全点名一律拒。
  if (typeof v.file !== 'string' || !/^(?!\.+$)[A-Za-z0-9._-]+$/.test(v.file)) bad('file 须纯文件名（白名单 [A-Za-z0-9._-] 且非全点）');
  if (typeof v.startedAt !== 'number' || !Number.isFinite(v.startedAt)) bad('startedAt 须有限数');
  if (!Array.isArray(v.steps)) bad('steps 须数组');
  for (const r of v.steps) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) bad('steps 行须对象');
    if (typeof r.stepId !== 'string' || !r.stepId) bad('steps 行缺 stepId');
    if (typeof r.videoAt !== 'number' || !Number.isFinite(r.videoAt) || r.videoAt < 0) bad(`步 ${r.stepId} 的 videoAt 须非负有限数`);
  }
  return { file: v.file, steps: v.steps.map((r) => ({ stepId: r.stepId, videoAt: r.videoAt })) };
}

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
  console.error('用法: report-model --verdict <f> --axes <f> --out <f> [--observed <f>] [--events <f>] [--expected <f>] [--case-meta <f>] [--generated-at <iso>] [--video-meta <f>]');
  process.exit(64);
}

try {
  const verdict = JSON.parse(readFileSync(opts.verdict, 'utf8'));
  const axes = JSON.parse(readFileSync(opts.axes, 'utf8'));
  const observed = opts.observed ? JSON.parse(readFileSync(opts.observed, 'utf8')) : null;
  const events = opts.events ? JSON.parse(readFileSync(opts.events, 'utf8')) : null;
  const caseMeta = opts['case-meta'] ? JSON.parse(readFileSync(opts['case-meta'], 'utf8')) : {};
  // 视频元数据旁件：读 + 语义校验（坏 JSON/坏形状均落 catch → exit 1 零落盘）；缺席零行为差。
  const videoMeta = opts['video-meta'] && typeof opts['video-meta'] === 'string'
    ? validateVideoMeta(JSON.parse(readFileSync(opts['video-meta'], 'utf8')))
    : null;
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
    videoMeta,
  });
  writeFileSync(opts.out, JSON.stringify(model, null, 2) + '\n', 'utf8');
  process.exit(0);
} catch (e) {
  // output-seal B4：大 catch 吞六路 JSON.parse（case-meta 人给）——V8 报文携内容片段；只报 errno/固定文案，内容不回显。
  console.error('report-model 装配失败（' + ((e && e.code) || 'ERR') + '；输入不是合法 JSON 或装配异常，内容不回显）');
  process.exit(1);
}
