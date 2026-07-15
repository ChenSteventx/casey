#!/usr/bin/env node
// CEF 真人示教录制：连接已登录真实桌面窗口，抓动作 + screencast。只产蒸馏语料，不产 verdict。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { credentialGate } from '../lib/cred-gate.mjs';
import { writeTeachInCapture } from '../lib/record-capture.mjs';
import { resolveCefProfile } from '../lib/cef-profile.mjs';
import { discoverCefTarget, CdpClient } from '../lib/cef-transport.mjs';
import { CefScreencast } from '../lib/cef-screencast.mjs';
import { installCefTeachRecorder, normalizeCefRecordedEvents } from '../lib/cef-teach-replay.mjs';

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
  if (message) console.error(`cef-record: ${message}`);
  console.error('用法: casey cef-record <caseId> --profile <f> --out-dir <d> --safe-session [--max-ms <ms>]');
  process.exit(64);
}

function readProfile(path) {
  let raw, doc;
  try { raw = readFileSync(resolve(String(path)), 'utf8'); doc = JSON.parse(raw); }
  catch { throw new Error('CEF_PROFILE_UNREADABLE'); }
  if (!credentialGate({ profile: raw }).ok) throw new Error('CEF_PROFILE_REJECTED');
  return { raw, resolved: resolveCefProfile(doc) };
}

function fixedCode(error) {
  const message = String(error?.message || 'CEF_RECORD_FAILED');
  return /^[A-Z0-9_]+$/.test(message) ? message : 'CEF_RECORD_FAILED';
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!/^tc_[a-z0-9_]+$/.test(caseId || '')) usage('caseId 须为 tc_ 开头的小写安全标识');
  for (const key of ['profile', 'out-dir', 'max-ms']) if (args[key] !== undefined && typeof args[key] !== 'string') usage(`--${key} 须带值`);
  if (!args.profile || !args['out-dir']) usage('缺 --profile 或 --out-dir');
  if (args['safe-session'] !== true) usage('缺 --safe-session（须先人工确认专用测试账户、已登录且窗口无真实患者数据）');
  const { raw: profileRaw, resolved: profile } = readProfile(args.profile);
  const maxMs = args['max-ms'] === undefined ? profile.timeouts.recordMaxMs : Number(args['max-ms']);
  if (!Number.isInteger(maxMs) || maxMs < 1000 || maxMs > profile.timeouts.recordMaxMs) usage('--max-ms 须为正整数且不超过 profile 上限');
  const outDir = resolve(String(args['out-dir']));
  const recordDir = join(outDir, caseId, 'record-capture');
  const target = await discoverCefTarget(profile.baseUrl, {
    titlePattern: profile.titlePattern,
    pathPattern: profile.pathPattern,
    timeoutMs: profile.timeouts.discoveryMs,
  });
  const cdp = new CdpClient(target.webSocketUrl, { connectTimeoutMs: profile.timeouts.connectMs, commandTimeoutMs: profile.timeouts.commandMs });
  const events = [];
  let screencast;
  let session;
  try {
    await cdp.connect();
    screencast = new CefScreencast(cdp, { outDir: join(recordDir, 'cef-screencast'), config: profile.screencast });
    await screencast.start();
    session = await installCefTeachRecorder(cdp, { maxMs, onEvent: (event) => events.push(event) });
    console.error('cef-record: 已连接真实桌面窗口。请人工操作；按 F8 收口（地址与页面内容不回显）。');
    const stopReason = await session.finished;
    session.dispose();
    if (stopReason === 'iframe_unsupported') throw new Error('CEF_RECORD_IFRAME_UNSUPPORTED');
    const video = await screencast.stop();
    const normalizedEvents = normalizeCefRecordedEvents(events);
    if (normalizedEvents.length === 0) throw new Error('CEF_RECORD_EMPTY');
    const { doc } = writeTeachInCapture({ caseId, outDir, startUrl: target.urlPathname, events: normalizedEvents });
    const captureText = JSON.stringify(doc, null, 2) + '\n';
    const sidecar = {
      schemaVersion: 1,
      artifactKind: 'cef-teach-in-session',
      caseId,
      channel: 'cef',
      stoppedBy: stopReason,
      eventCount: doc.events.length,
      profileSha256: createHash('sha256').update(profileRaw).digest('hex'),
      captureSha256: createHash('sha256').update(captureText).digest('hex'),
      recording: video,
      signed: false,
      replayReady: false,
      distillRequired: true,
    };
    const text = JSON.stringify(sidecar, null, 2) + '\n';
    if (!credentialGate({ 'cef-session.json': text }).ok) throw new Error('CEF_RECORD_SIDECAR_REJECTED');
    writeFileSync(join(recordDir, 'cef-session.json'), text, 'utf8');
    console.log(`cef-record: 示教包已写入 → <out-dir>/${caseId}/record-capture/teach-in-capture.json`);
    console.log(`cef-record: ${doc.events.length} 条事件；录屏索引 → <case-dir>/record-capture/cef-screencast/recording.html`);
    console.log('cef-record: 仍须 intake；不是正式回放输入或测试报告。');
  } finally {
    try { session?.dispose(); } catch { /* fixed close */ }
    try { await screencast?.stop(); } catch { /* preserve primary result */ }
    cdp.close();
  }
}

run().catch((error) => {
  console.error(`cef-record: 执行失败（${fixedCode(error)}；地址、页面和输入内容不回显）`);
  process.exit(1);
});
