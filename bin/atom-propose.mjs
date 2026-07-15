#!/usr/bin/env node
// 已入账示教 + 标准真实 PASS 证据 → pending 候选原子。零 LLM，不写 registry。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { proposeCandidate, stableSha256 } from '../lib/capture-atom-promotion.mjs';
import { captureSha256Of, verifyIntaken } from '../lib/record-distill.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { PROJECT_ROOT } from '../lib/paths.mjs';

function parseArgs(argv) {
  const out = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else out.pos.push(a);
  }
  return out;
}
function die(code, msg) { console.error(`atom-propose: ${msg}`); process.exit(code); }
function readText(path, label) { try { return readFileSync(resolve(String(path)), 'utf8'); } catch { die(65, `${label} 不可读/非文本（路径与内容不回显）`); } }
function readJson(path, label) { const raw = readText(path, label); try { return { raw, doc: JSON.parse(raw) }; } catch { die(65, `${label} 非合法 JSON（内容不回显）`); } }

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
const required = ['definition', 'capture', 'intake-ledger', 'manifest', 'mapping', 'expected', 'events', 'axes', 'verdict', 'video-meta', 'video', 'out-dir'];
if (!caseId || required.some((k) => typeof args[k] !== 'string')) die(64, '用法错误：须给 caseId、definition/capture/intake-ledger/manifest/mapping/expected/events/axes/verdict/video-meta/video/out-dir');
for (const k of ['provenance', 'run-id', 'link-signer', 'link-against-build', 'link-signed-at']) if (args[k] !== undefined && typeof args[k] !== 'string') die(64, `--${k} 须带值`);
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) die(65, 'caseId 非法（仅字母数字_-；原值不回显）');

const definition = readJson(args.definition, 'definition');
const captureRaw = readText(args.capture, 'capture');
const intakeLedgerRaw = readText(args['intake-ledger'], 'intake-ledger');
const manifestRaw = readText(args.manifest, 'manifest');
const mappingRaw = readText(args.mapping, 'mapping');
const expectedRaw = readText(args.expected, 'expected');
const eventsRaw = readText(args.events, 'events');
const axesRaw = readText(args.axes, 'axes');
const verdictRaw = readText(args.verdict, 'verdict');
const videoMetaRaw = readText(args['video-meta'], 'video-meta');
let provenanceRaw = args.provenance ? readText(args.provenance, 'provenance') : null;
let videoBytes;
try { videoBytes = readFileSync(resolve(String(args.video))); } catch { die(65, 'video 不可读（路径不回显）'); }
if (!provenanceRaw) {
  let runDocs;
  try { runDocs = [eventsRaw, axesRaw, verdictRaw, videoMetaRaw].map((raw) => JSON.parse(raw)); }
  catch { die(65, 'run 证据非合法 JSON（内容不回显）'); }
  const ids = runDocs.map((doc) => typeof doc?.runId === 'string' && doc.runId.trim() ? doc.runId.trim() : null);
  const any = ids.some(Boolean);
  const allSame = any && ids.every((id) => id === ids[0]);
  if (any && !allSame) die(65, 'run 证据的 runId 部分缺失或互相冲突，拒绝绑定');
  let runId = allSame ? ids[0] : null;
  let attestation;
  if (!allSame) {
    if (![args['run-id'], args['link-signer'], args['link-against-build']].every((v) => typeof v === 'string' && v.trim())) {
      die(66, '旧产物无共同 runId：须人在场确认同 run，并提供 run-id/link-signer/link-against-build；机器不会自行猜');
    }
    runId = args['run-id'].trim();
    attestation = {
      signerId: args['link-signer'].trim(),
      signedAgainstBuild: args['link-against-build'].trim(),
      signedAt: args['link-signed-at'] || new Date().toISOString(),
    };
  }
  const hashes = {
    captureSha256: stableSha256(captureRaw), manifestSha256: stableSha256(manifestRaw), mappingSha256: stableSha256(mappingRaw),
    expectedSha256: stableSha256(expectedRaw), eventsSha256: stableSha256(eventsRaw), axesSha256: stableSha256(axesRaw),
    verdictSha256: stableSha256(verdictRaw), videoMetaSha256: stableSha256(videoMetaRaw), videoSha256: stableSha256(videoBytes),
  };
  provenanceRaw = JSON.stringify({ schemaVersion: 1, artifactKind: 'capture-replay-provenance', caseId, runId, formalVerdictEligible: true, hashes, ...(attestation ? { attestation } : {}) }, null, 2) + '\n';
}
const baseRegistry = readJson(join(PROJECT_ROOT, 'lib', 'atoms-registry.snapshot.json'), '内置原子注册表').doc;
const inputs = { definition: definition.raw, captureRaw, intakeLedgerRaw, manifestRaw, mappingRaw, expectedRaw, eventsRaw, axesRaw, verdictRaw, videoMetaRaw, provenanceRaw };
const cg = credentialGate(inputs);
if (!cg.ok) die(1, '输入命中凭据门（护栏 #7），拒绝处理');
let ledgerEntries;
try { ledgerEntries = intakeLedgerRaw.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line)); }
catch { die(65, 'intake-ledger 非合法 JSONL（内容不回显）'); }
const intake = verifyIntaken({ caseId, ledgerEntries, currentSha256: captureSha256Of(captureRaw) });
if (!intake.ok) die(65, `intake 同哈希门拒（${intake.reason}）`);

const result = proposeCandidate({ caseId, definition: definition.doc, captureRaw, intakeLedgerRaw, manifestRaw, mappingRaw, expectedRaw, eventsRaw, axesRaw, verdictRaw, videoMetaRaw, videoBytes, provenanceRaw, baseRegistry });
if (!result.ok) die(65, `候选门拒（${result.problems.slice(0, 6).join(' / ')}）`);
const outDir = resolve(String(args['out-dir']), caseId, 'atom-learning');
const outFile = join(outDir, 'atom-candidate.json');
const provenanceFile = join(outDir, 'capture-replay-provenance.json');
const text = JSON.stringify(result.candidate, null, 2) + '\n';
if (!credentialGate({ candidate: text, provenance: provenanceRaw }).ok) die(1, '候选或 provenance 命中输出凭据门，拒绝落盘');
try {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(provenanceFile, provenanceRaw, 'utf8');
  writeFileSync(outFile, text, 'utf8');
}
catch (e) { die(1, `候选写盘失败（errno=${e?.code || 'UNKNOWN'}；路径不回显）`); }
console.log(`atom-propose: pending 候选已写入 <out-dir>/${caseId}/atom-learning/atom-candidate.json`);
console.log(`atom-propose: 证据绑定收据已写入 <out-dir>/${caseId}/atom-learning/capture-replay-provenance.json`);
console.log('atom-propose: 尚未人签、尚未进入 registry；LLM/视觉建议不能改变 verdict。');
