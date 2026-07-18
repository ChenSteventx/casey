#!/usr/bin/env node
// Canonical teach-in intake CLI：唯一成功路径是 authority-root 的 signed append transaction。
// 命令行层先派生并校验固定同级三件套（capture + identity-observations.json 旁车 + teach-in-package.json 清单），
// 再委托权威根 appendAcceptedObservationPackage 落 committed 事务；三件套预检对齐 bin/distill.mjs 的消费方式，
// 权威内核 lib/teachin-observation-authority-root.mjs 与判别内核零触碰。退出码 64（用法）/65（数据/规格）。
import { resolve, basename, dirname } from 'node:path';
import { readFileSync, lstatSync } from 'node:fs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { appendAcceptedObservationPackage } from '../lib/teachin-observation-authority-root.mjs';
import { deriveTeachInPackagePaths, verifyTeachInPackage } from '../lib/entity-semantic-lock-package.mjs';

function parseArgs(argv) {
  const out = { pos: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      out[key] = index + 1 < argv.length && !argv[index + 1].startsWith('--') ? argv[++index] : true;
    } else out.pos.push(arg);
  }
  return out;
}

function dieUsage(message) {
  console.error(`intake: ${message}`);
  console.error('用法: casey intake <caseId> --capture <teach-in-capture.json>');
  process.exit(64);
}

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
if (!caseId) dieUsage('缺 caseId');
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) {
  console.error('intake: caseId 含非法字符（仅限字母数字_-；原值不回显）');
  process.exit(65);
}
if (!credentialGate({ caseId }).ok) {
  console.error('intake: caseId 命中凭据门（原值不回显）');
  process.exit(65);
}
if (args.capture !== undefined && typeof args.capture !== 'string') dieUsage('--capture 须带值');
if (!args.capture) dieUsage('缺 --capture');

const capturePath = resolve(args.capture);

// ── 布局 + 软链硬化（预读 fail-closed 守卫，对齐 bin/distill.mjs 纪律）──
if (basename(capturePath) !== 'teach-in-capture.json'
  || basename(dirname(capturePath)) !== 'record-capture'
  || basename(dirname(dirname(capturePath))) !== caseId) {
  console.error('intake: --capture 须为 <caseId>/record-capture/teach-in-capture.json 规范布局（路径不回显）');
  process.exit(65);
}
let captureStat;
try { captureStat = lstatSync(capturePath); }
catch (error) { console.error(`intake: --capture 不可读（errno=${error?.code || 'UNKNOWN'}；路径不回显）`); process.exit(65); }
if (captureStat.isSymbolicLink()) { console.error('intake: --capture 是符号链接（拒跟随；路径不回显）'); process.exit(65); }
try { if (lstatSync(dirname(capturePath)).isSymbolicLink()) { console.error('intake: record-capture 目录是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 略过 */ }
try { if (lstatSync(dirname(dirname(capturePath))).isSymbolicLink()) { console.error('intake: caseId 目录是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 略过 */ }

// ── 从已校验 capturePath 固定推导同级三件套；软链硬化后读三份原始最终字节 ──
const { manifestPath, sidecarPath } = deriveTeachInPackagePaths({ capturePath });
for (const [label, siblingPath] of [['identity-observations.json', sidecarPath], ['teach-in-package.json', manifestPath]]) {
  try {
    if (lstatSync(siblingPath).isSymbolicLink()) {
      console.error(`intake: 示教三件套 ${label} 是符号链接（拒跟随；路径不回显）`);
      process.exit(65);
    }
  } catch {
    console.error(`intake: 示教三件套缺 ${label}（规范同级旁车/清单缺失或不可读；须先关窗产完整三件套；路径不回显）`);
    process.exit(65);
  }
}
let captureBytes;
let manifestBytes;
let sidecarBytes;
try {
  captureBytes = readFileSync(capturePath);
  manifestBytes = readFileSync(manifestPath);
  sidecarBytes = readFileSync(sidecarPath);
} catch (error) {
  console.error(`intake: 示教三件套不可读（errno=${error?.code || 'UNKNOWN'}；路径与内容不回显）`);
  process.exit(65);
}

// ── 三件套联合闸：capture/sidecar/manifest 最终字节 + 观察元数据一致才放行 ──
const packageReview = verifyTeachInPackage({ caseId, captureBytes, sidecarBytes, manifestBytes });
if (!packageReview.ok) {
  console.error(`intake: 示教三件套联合闸拒（${packageReview.reason}）——绝不入账。`);
  process.exit(65);
}
const { captureSha256, sidecarSha256, manifestSha256, observationCount, observationSchemaVersion } = packageReview;

// ── canonical 权威根 append transaction（固定 cases 根 + signed driver receipt + committed ledger）──
// 命令行层预检的五字段事实作为 expectedFacts 交给权威内核：内核在事务内、committed 之前把落账事实
// 与之逐一比对，不符即在写台账前拒（防 CLI 读后、内核 commit 前换包 TOCTOU）。一致性检查在原子事务内
// 完成，落账与返回不再可能相反——失败必然干净（accepted 台账零新增）。
const accepted = appendAcceptedObservationPackage({
  caseId,
  capturePath,
  expectedFacts: { captureSha256, sidecarSha256, manifestSha256, observationCount, observationSchemaVersion },
});
if (!accepted.ok) {
  console.error(`intake: canonical signed transaction 拒绝（${accepted.reason || 'AUTHORITY_ROOT_ERROR'}）；零 accepted 台账。`);
  process.exit(65);
}

console.log('intake: 已以 canonical signed transaction 入账 → <case-dir>/record-capture/intake-ledger.jsonl');
console.log('intake: 已登记进蒸馏前置队列；仍须蒸馏 + L0 复核 + 人签，不直通回放。');
process.exit(0);
