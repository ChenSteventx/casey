#!/usr/bin/env node
// TEST-ONLY zero-SUT same-process probe；调用者必须安装隔离 test publication loader。
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { rehydrateAcceptedObservationTransaction } from '../../../../lib/teachin-observation-authority-root.mjs';
import { verifyAcceptedIdentityObservationBundle } from '../../../../lib/teachin-identity-observations.mjs';

const [caseId, rawCapturePath, rawExpectedCount] = process.argv.slice(2);
const capturePath = resolve(String(rawCapturePath || ''));
const packageDir = dirname(capturePath);
const sidecarPath = join(packageDir, 'identity-observations.json');
const expectedCount = Number(rawExpectedCount);
function identity(stat) { return `${stat.dev}:${stat.ino}`; }
function fail(message) { console.error(message); process.exit(1); }

const captureBefore = lstatSync(capturePath, { bigint: true });
const sidecarBefore = lstatSync(sidecarPath, { bigint: true });
const captureRaw = readFileSync(capturePath, 'utf8');
const observationRaw = readFileSync(sidecarPath, 'utf8');
const captureAfter = lstatSync(capturePath, { bigint: true });
const sidecarAfter = lstatSync(sidecarPath, { bigint: true });
const pathFacts = {
  capture: {
    regularFile: captureAfter.isFile(), symbolicLink: captureAfter.isSymbolicLink(), parentSymbolicLink: false,
    identityBefore: identity(captureBefore), identityAfter: identity(captureAfter),
  },
  observations: {
    regularFile: sidecarAfter.isFile(), symbolicLink: sidecarAfter.isSymbolicLink(), parentSymbolicLink: false,
    identityBefore: identity(sidecarBefore), identityAfter: identity(sidecarAfter),
  },
};
const rehydrated = rehydrateAcceptedObservationTransaction({ caseId, capturePath });
if (!rehydrated.ok) fail(`rehydrate failed: ${rehydrated.reason}`);
const trusted = verifyAcceptedIdentityObservationBundle({
  caseId,
  captureRaw,
  observationRaw,
  pathFacts,
  acceptedIntakeAuthority: rehydrated.authority,
  platformReadbackReceipt: rehydrated.receipt,
});
if (!trusted.ok || trusted.trusted !== true || trusted.observationCount !== expectedCount) {
  fail(`trusted multi consumer rejected: ${trusted.reason || 'COUNT_OR_TRUST_MISMATCH'}`);
}
console.log(`ok trusted multi identity consumer ${trusted.observationCount}/${expectedCount}`);

