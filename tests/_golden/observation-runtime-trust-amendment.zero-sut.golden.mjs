#!/usr/bin/env node
// zero-SUT：runtime trust PRD 的 archive 形态 amendment；不执行旧 unsafe body。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PRD_PATH = join(ROOT, 'loop/prd-observation-runtime-trust-root.json');
const AMENDMENT_PATH = join(ROOT, 'docs/plans/observation-contract-closure/runtime-trust-root-amendment.json');
const REVOCATION_PATH = join(ROOT, 'tests/_golden/fixtures/observation-runtime-trust-root/security-revocation.json');
const prd = JSON.parse(readFileSync(PRD_PATH, 'utf8'));
const amendment = JSON.parse(readFileSync(AMENDMENT_PATH, 'utf8'));
const revocation = JSON.parse(readFileSync(REVOCATION_PATH, 'utf8'));
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

if (/Base64|originalBase64/.test(prd.task) || !/gzip/.test(prd.task)
  || prd.amendment !== 'docs/plans/observation-contract-closure/runtime-trust-root-amendment.json') {
  throw new Error('runtime trust PRD task 尚未按 amendment 正名为 gzip');
}
if (amendment?.artifactKind !== 'prd-factual-amendment'
  || amendment?.targetPrd !== 'loop/prd-observation-runtime-trust-root.json'
  || amendment?.incorrectDescription !== 'Base64 JSON/originalBase64'
  || amendment?.effectiveDescription !== 'gzip archive/gunzip sha256 verification'
  || amendment?.priorAttemptRecordedPass !== false) {
  throw new Error('formal amendment receipt 不闭合');
}
if (revocation.oldFrozenAssetPolicy !== 'explicit-security-exception-gzip-binary-container-preserves-original-bytes-and-sha') {
  throw new Error('security revocation receipt 未声明 gzip policy');
}
for (const entry of revocation.revoked) {
  const decoded = gunzipSync(readFileSync(join(ROOT, entry.archivePath)));
  if (sha(decoded) !== entry.originalSha256) throw new Error(`${entry.archivePath} gunzip sha 不匹配`);
}
console.log('observation runtime trust amendment: 3/3 passed');

