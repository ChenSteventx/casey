#!/usr/bin/env node
// Canonical teach-in intake CLI：唯一成功路径是 authority-root 的 signed append transaction。
import { resolve } from 'node:path';
import { credentialGate } from '../lib/cred-gate.mjs';
import { appendAcceptedObservationPackage } from '../lib/teachin-observation-authority-root.mjs';

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

const accepted = appendAcceptedObservationPackage({ caseId, capturePath: resolve(args.capture) });
if (!accepted.ok) {
  console.error(`intake: canonical signed transaction 拒绝（${accepted.reason || 'AUTHORITY_ROOT_ERROR'}）；零 accepted 台账。`);
  process.exit(65);
}
console.log('intake: 已以 canonical signed transaction 入账 → <case-dir>/record-capture/intake-ledger.jsonl');
console.log('intake: 已登记进蒸馏前置队列；仍须蒸馏 + L0 复核 + 人签，不直通回放。');
process.exit(0);
