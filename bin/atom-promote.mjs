#!/usr/bin/env node
// 已签候选 → 学习原子注册表。原子写入、内置冲突拒、去重与 revision 由纯函数内核负责。
import { existsSync, lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promoteCandidate } from '../lib/capture-atom-promotion.mjs';
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
function die(code, msg) { console.error(`atom-promote: ${msg}`); process.exit(code); }
function readJson(path, label) { try { const raw = readFileSync(path, 'utf8'); return { raw, doc: JSON.parse(raw) }; } catch { die(65, `${label} 不可读或非合法 JSON（路径与内容不回显）`); } }
function readText(path, label) { try { return readFileSync(resolve(String(path)), 'utf8'); } catch { die(65, `${label} 不可读/非文本（路径与内容不回显）`); } }

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
const evidenceArgs = ['capture', 'intake-ledger', 'manifest', 'mapping', 'expected', 'events', 'axes', 'verdict', 'video-meta', 'video', 'provenance'];
if (!caseId || !/^[A-Za-z0-9_-]+$/.test(caseId) || typeof args.signed !== 'string' || evidenceArgs.some((key) => typeof args[key] !== 'string')) die(64, '用法错误：须给合法 caseId、--signed 与 atom-propose 的完整原始 evidence/provenance');
const signed = readJson(args.signed, 'signed candidate');
if (signed.doc?.candidate?.caseId !== caseId) die(65, 'signed candidate.caseId 与命令行不一致（文件值不回显）');
if (!credentialGate({ signedCandidate: signed.raw }).ok) die(1, '签署物命中凭据门（护栏 #7），拒绝处理');
const basePath = join(PROJECT_ROOT, 'lib', 'atoms-registry.snapshot.json');
const learnedPath = join(PROJECT_ROOT, 'lib', 'learned-atoms.registry.json');
if (existsSync(learnedPath) && lstatSync(learnedPath).isSymbolicLink()) die(65, '学习原子注册表是符号链接，拒绝写入');
const base = readJson(basePath, '内置原子注册表');
const learned = readJson(learnedPath, '学习原子注册表');
const evidenceInput = {
  definition: signed.doc?.candidate?.definition,
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
  baseRegistry: base.doc,
};
try { evidenceInput.videoBytes = readFileSync(resolve(String(args.video))); } catch { die(65, 'video 不可读（路径不回显）'); }
if (!credentialGate({ signedCandidate: signed.raw, ...evidenceInput, videoBytes: '<binary>' }).ok) die(1, '签署物或 evidence 命中凭据门（护栏 #7），拒绝处理');
const result = promoteCandidate({ signed: signed.doc, evidenceInput, learnedRegistry: learned.doc, baseRegistry: base.doc });
if (!result.ok) die(65, `晋升门拒（${result.problems.slice(0, 6).join(' / ')}）`);
if (result.idempotent) { console.log('atom-promote: 已存在相同定义，幂等完成；registry version 未变化。'); process.exit(0); }
const text = JSON.stringify(result.registry, null, 2) + '\n';
if (!credentialGate({ learnedRegistry: text }).ok) die(1, '学习原子注册表命中输出凭据门，拒绝写入');
const temp = `${learnedPath}.tmp-${process.pid}`;
try { writeFileSync(temp, text, { encoding: 'utf8', flag: 'wx' }); renameSync(temp, learnedPath); }
catch (e) { die(1, `registry 原子写失败（errno=${e?.code || 'UNKNOWN'}；路径不回显）`); }
console.log(`atom-promote: 已晋升 ${caseId} 的签署候选；registry version=${result.registry.version}，历史 revision 已保留。`);
