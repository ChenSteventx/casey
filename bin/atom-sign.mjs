#!/usr/bin/env node
// pending 候选原子 → 显式人工签署物。可信授权输入先例同 casey sign；本命令不认证真人身份。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { signCandidate } from '../lib/capture-atom-promotion.mjs';
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
function die(code, msg) { console.error(`atom-sign: ${msg}`); process.exit(code); }
function readText(path, label) { try { return readFileSync(resolve(String(path)), 'utf8'); } catch { die(65, `${label} 不可读/非文本（路径与内容不回显）`); } }
function readJson(path, label) { const raw = readText(path, label); try { return { raw, doc: JSON.parse(raw) }; } catch { die(65, `${label} 非合法 JSON（内容不回显）`); } }

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
const evidenceArgs = ['capture', 'intake-ledger', 'manifest', 'mapping', 'expected', 'events', 'axes', 'verdict', 'video-meta', 'video', 'provenance'];
for (const k of ['candidate', 'out-dir', 'signer', 'against-build', ...evidenceArgs]) if (typeof args[k] !== 'string') die(64, '用法错误：须给 caseId、candidate/out-dir/signer/against-build 与 atom-propose 的完整原始 evidence/provenance');
if (!caseId || !/^[A-Za-z0-9_-]+$/.test(caseId)) die(65, 'caseId 缺失或非法（原值不回显）');
if (args['signed-at'] !== undefined && typeof args['signed-at'] !== 'string') die(64, '--signed-at 须带值');
const candidateFile = readJson(args.candidate, 'candidate');
const candidate = candidateFile.doc;
if (candidate?.caseId !== caseId) die(65, 'candidate.caseId 与命令行不一致（文件值不回显）');
const evidenceInput = {
  definition: candidate.definition,
  captureRaw: readText(args.capture, 'capture'),
  intakeLedgerRaw: readText(args['intake-ledger'], 'intake-ledger'),
  manifestRaw: readText(args.manifest, 'manifest'),
  mappingRaw: readText(args.mapping, 'mapping'),
  expectedRaw: readText(args.expected, 'expected'),
  eventsRaw: readText(args.events, 'events'),
  axesRaw: readText(args.axes, 'axes'),
  verdictRaw: readText(args.verdict, 'verdict'),
  videoMetaRaw: readText(args['video-meta'], 'video-meta'),
  provenanceRaw: readText(args.provenance, 'provenance'),
  baseRegistry: readJson(join(PROJECT_ROOT, 'lib', 'atoms-registry.snapshot.json'), '内置原子注册表').doc,
};
try { evidenceInput.videoBytes = readFileSync(resolve(String(args.video))); } catch { die(65, 'video 不可读（路径不回显）'); }
if (!credentialGate({ candidate: candidateFile.raw, signerId: args.signer, build: args['against-build'], ...evidenceInput, videoBytes: '<binary>' }).ok) die(1, '输入命中凭据门（护栏 #7），拒绝处理');
const result = signCandidate(candidate, {
  signerId: args.signer,
  signedAgainstBuild: args['against-build'],
  signedAt: args['signed-at'] || new Date().toISOString(),
}, evidenceInput);
if (!result.ok) die(65, `人签门拒（${result.problems.join(' / ')}）`);
const outDir = resolve(args['out-dir'], caseId, 'atom-learning');
const outFile = join(outDir, 'atom-candidate.signed.json');
const text = JSON.stringify(result.signed, null, 2) + '\n';
if (!credentialGate({ signedCandidate: text }).ok) die(1, '签署物命中输出凭据门，拒绝落盘');
try { mkdirSync(outDir, { recursive: true }); writeFileSync(outFile, text, 'utf8'); }
catch (e) { die(1, `签署物写盘失败（errno=${e?.code || 'UNKNOWN'}；路径不回显）`); }
console.log(`atom-sign: 人签候选已写入 <out-dir>/${caseId}/atom-learning/atom-candidate.signed.json`);
console.log('atom-sign: 签署不等于晋升；须另行显式 atom-promote。');
