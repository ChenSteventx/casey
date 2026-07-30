#!/usr/bin/env node
// M5 复现探针：证明 codex code-r1 M5 的原判成立——在真仓根下直调金牌用到的末门
// screenCycleEvidenceText，传递依赖 credentialGate → collectSecretLiterals 会去读
// 真仓 .auth/credentials.json 与 site.json。
// 纪律：本探针只记录并回显「被读到的路径」，凭据内容一个字节都不读进输出、不落盘。
// 跑法：node --require ./m5-fs-access-probe.cjs m5-credential-reach.probe.mjs

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenCycleEvidenceText } from '../../../../lib/teachin/cycle-evidence-output.mjs';

const REAL_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const probe = globalThis.__caseyM5FsProbe;
if (!Array.isArray(probe)) {
  console.error('PROBE_RED: 未带 --require m5-fs-access-probe.cjs 启动，量不出读盘路径');
  process.exit(2);
}

const before = probe.length;
const screened = screenCycleEvidenceText(JSON.stringify({
  schemaVersion: 1, artifactKind: 'cycle-evidence', stages: [], events: [],
}));
const during = probe.slice(before);

// 只看凭据源候选路径，且只回显「相对真仓根的路径」，不回显任何内容。
const credentialReads = during
  .filter((row) => /(?:^|[\\/])(?:credentials\.json|site\.json)$/.test(row.path)
    || /[\\/]\.auth[\\/]/.test(row.path))
  .map((row) => ({
    api: row.api,
    relativeToRealRoot: row.path.startsWith(REAL_ROOT) ? row.path.slice(REAL_ROOT.length) : '<外部>',
    insideRealRepo: row.path.startsWith(REAL_ROOT),
  }));

console.log(JSON.stringify({
  screened,
  credentialReadCount: credentialReads.length,
  credentialReads,
}, null, 2));

if (credentialReads.some((row) => row.insideRealRepo)) {
  console.log('PROBE_REPRODUCED: 真仓根下跑，末门的传递依赖确实读到了真仓凭据面（codex code-r1 M5 成立）');
  process.exit(0);
}
console.log('PROBE_NOT_REPRODUCED: 本机真仓根下没有凭据件在场，本路复现不出（换有凭据件的机器再跑）');
