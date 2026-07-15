#!/usr/bin/env node
// CEF 机械回放：只消费已 intake 的真人示教包，产降权收据 + screencast；绝不产 axes/verdict/PASS。
import { readFileSync, writeFileSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { credentialGate } from '../lib/cred-gate.mjs';
import { reviewCapture, intakeLedgerPath } from '../lib/record-intake.mjs';
import { verifyIntaken, captureSha256Of } from '../lib/record-distill.mjs';
import { resolveCefProfile } from '../lib/cef-profile.mjs';
import { discoverCefTarget, CdpClient } from '../lib/cef-transport.mjs';
import { CefScreencast } from '../lib/cef-screencast.mjs';
import { buildCefSpecFromCapture, replayCefSpec, buildReplayReceipt, buildVisualReviewRequest, renderCefReplayHtml } from '../lib/cef-teach-replay.mjs';

function parseArgs(argv) {
  const out = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
      else out[key] = true;
    } else out.pos.push(arg);
  }
  return out;
}

function usage(message) {
  if (message) console.error(`cef-replay: ${message}`);
  console.error('用法: casey cef-replay <caseId> --capture <f> --profile <f> --out-dir <d> --safe-session');
  process.exit(64);
}

function fixedCode(error) {
  const message = String(error?.message || 'CEF_REPLAY_FAILED');
  return /^[A-Z0-9_]+$/.test(message) ? message : 'CEF_REPLAY_FAILED';
}

function readProfile(path) {
  let raw, doc;
  try { raw = readFileSync(resolve(String(path)), 'utf8'); doc = JSON.parse(raw); }
  catch { throw new Error('CEF_PROFILE_UNREADABLE'); }
  if (!credentialGate({ profile: raw }).ok) throw new Error('CEF_PROFILE_REJECTED');
  return { raw, resolved: resolveCefProfile(doc) };
}

function readAcceptedCapture(path, caseId) {
  const capturePath = resolve(String(path));
  if (basename(capturePath) !== 'teach-in-capture.json'
    || basename(dirname(capturePath)) !== 'record-capture'
    || basename(dirname(dirname(capturePath))) !== caseId) throw new Error('CEF_CAPTURE_LAYOUT_INVALID');
  try {
    if (lstatSync(capturePath).isSymbolicLink() || lstatSync(dirname(capturePath)).isSymbolicLink() || lstatSync(dirname(dirname(capturePath))).isSymbolicLink()) throw new Error('CEF_CAPTURE_SYMLINK');
  } catch (error) {
    if (error?.message === 'CEF_CAPTURE_SYMLINK') throw error;
    throw new Error('CEF_CAPTURE_UNREADABLE');
  }
  let raw, doc;
  try { raw = readFileSync(capturePath, 'utf8'); doc = JSON.parse(raw); }
  catch { throw new Error('CEF_CAPTURE_UNREADABLE'); }
  if (!credentialGate({ capture: raw }).ok) throw new Error('CEF_CAPTURE_REJECTED');
  const review = reviewCapture(doc, { caseId });
  if (!review.ok) throw new Error('CEF_CAPTURE_REVIEW_REJECTED');
  const captureSha256 = captureSha256Of(raw);
  let ledger = [];
  try { ledger = readFileSync(intakeLedgerPath({ capturePath }), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch { ledger = []; }
  const intake = verifyIntaken({ caseId, ledgerEntries: ledger, currentSha256: captureSha256 });
  if (!intake.ok) throw new Error(intake.reason === 'CAPTURE_SWAPPED' ? 'CEF_CAPTURE_SWAPPED' : 'CEF_CAPTURE_NOT_INTAKEN');
  return { doc, raw, captureSha256 };
}

function writeSafe(path, doc) {
  const body = JSON.stringify(doc, null, 2) + '\n';
  if (!credentialGate({ artifact: body }).ok) throw new Error('CEF_REPLAY_OUTPUT_REJECTED');
  writeFileSync(path, body, 'utf8');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!/^tc_[a-z0-9_]+$/.test(caseId || '')) usage('caseId 须为 tc_ 开头的小写安全标识');
  for (const key of ['capture', 'profile', 'out-dir']) if (args[key] !== undefined && typeof args[key] !== 'string') usage(`--${key} 须带值`);
  if (!args.capture || !args.profile || !args['out-dir']) usage('缺 --capture、--profile 或 --out-dir');
  if (args['safe-session'] !== true) usage('缺 --safe-session（须先人工确认专用测试账户、已登录且窗口无真实患者数据）');
  const { doc: capture, raw: captureRaw, captureSha256 } = readAcceptedCapture(args.capture, caseId);
  const spec = buildCefSpecFromCapture(capture);
  const { raw: profileRaw, resolved: profile } = readProfile(args.profile);
  const profileSha256 = createHash('sha256').update(profileRaw).digest('hex');
  const replayDir = join(resolve(String(args['out-dir'])), caseId, 'cef-replay');
  const target = await discoverCefTarget(profile.baseUrl, {
    titlePattern: profile.titlePattern,
    pathPattern: profile.pathPattern,
    timeoutMs: profile.timeouts.discoveryMs,
  });
  const cdp = new CdpClient(target.webSocketUrl, { connectTimeoutMs: profile.timeouts.connectMs, commandTimeoutMs: profile.timeouts.commandMs });
  let screencast;
  let steps = [];
  let video = null;
  try {
    await cdp.connect();
    screencast = new CefScreencast(cdp, { outDir: join(replayDir, 'cef-screencast'), config: profile.screencast });
    await screencast.start();
    steps = await replayCefSpec(cdp, spec, { actionQuietMs: profile.timeouts.actionQuietMs, screencast });
    video = await screencast.stop();
  } finally {
    try { video ||= await screencast?.stop(); } catch { /* receipt still records absent video */ }
    cdp.close();
  }
  const receipt = buildReplayReceipt({ caseId, profileSha256, captureSha256, steps, expectedStepCount: spec.events.length, video });
  // 再钉一次物理隔离：本入口产物永远不具正式裁定资格。
  if (receipt.formalVerdictEligible !== false || receipt.verdict !== null) throw new Error('CEF_REPLAY_VERDICT_BOUNDARY');
  writeSafe(join(replayDir, 'cef-replay-receipt.json'), receipt);
  writeSafe(join(replayDir, 'cef-replay-spec.json'), spec);
  writeSafe(join(replayDir, 'visual-review-request.json'), buildVisualReviewRequest({
    caseId,
    replayReceipt: 'cef-replay-receipt.json',
    frameIndex: 'cef-screencast/frames.json',
  }));
  const attachmentDir = join(replayDir, 'attachments');
  mkdirSync(attachmentDir, { recursive: true });
  if (!credentialGate({ capture: captureRaw }).ok) throw new Error('CEF_REPLAY_OUTPUT_REJECTED');
  writeFileSync(join(attachmentDir, 'teach-in-capture.json'), captureRaw, 'utf8');
  const attachments = [
    'cef-replay.report.html',
    'cef-replay-receipt.json',
    'cef-replay-spec.json',
    'attachments/teach-in-capture.json',
    'visual-review-request.json',
    'cef-screencast/recording.html',
    'cef-screencast/frames.json',
    'cef-screencast/video.json',
  ];
  writeSafe(join(replayDir, 'attachments.json'), { schemaVersion: 1, artifactKind: 'cef-replay-attachments', caseId, attachments });
  const reportHtml = renderCefReplayHtml({ caseId, spec, receipt, attachments: [...attachments, 'attachments.json'] });
  if (!credentialGate({ 'cef-replay.report.html': reportHtml }).ok) throw new Error('CEF_REPLAY_OUTPUT_REJECTED');
  writeFileSync(join(replayDir, 'cef-replay.report.html'), reportHtml, 'utf8');
  console.log(`cef-replay: 机械回放收据 → <out-dir>/${caseId}/cef-replay/cef-replay-receipt.json`);
  console.log(`cef-replay: 单例 HTML（非正式 PASS）→ <out-dir>/${caseId}/cef-replay/cef-replay.report.html`);
  console.log(`cef-replay: 动作 ${steps.filter((step) => step.actionPerformed).length}/${spec.events.length} 已派发回读；录屏 → <case-dir>/cef-replay/cef-screencast/recording.html`);
  console.log('cef-replay: formalVerdictEligible=false；这不是正式 PASS，LLM 视觉只能复核、不能裁定。');
  if (!receipt.allActionsPerformed || steps.length !== spec.events.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error(`cef-replay: 执行失败（${fixedCode(error)}；地址、页面和输入内容不回显）`);
  process.exit(1);
});
