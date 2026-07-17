#!/usr/bin/env node
// TEST-ONLY same-process probe; caller must install isolated test publication loader.
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  rehydrateAcceptedObservationTransaction,
  verifyObservationTransactionPair,
} from '../../../../lib/teachin-observation-authority-root.mjs';
import { verifyAcceptedIdentityObservationBundle } from '../../../../lib/teachin-identity-observations.mjs';

const [caseId, rawCapturePath] = process.argv.slice(2);
const capturePath = resolve(String(rawCapturePath || ''));
const packageDir = dirname(capturePath);
const sidecarPath = join(packageDir, 'identity-observations.json');
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
const pair = verifyObservationTransactionPair({
  acceptedIntakeAuthority: rehydrated.authority,
  platformReadbackReceipt: rehydrated.receipt,
});
if (!pair.ok) fail(`pair failed: ${pair.reason}`);
const trusted = verifyAcceptedIdentityObservationBundle({
  caseId, captureRaw, observationRaw, pathFacts,
  acceptedIntakeAuthority: rehydrated.authority,
  platformReadbackReceipt: rehydrated.receipt,
});
if (!trusted.ok || trusted.trusted !== true || trusted.identityStatus !== 'observed') {
  fail(`identity consumer rejected: ${trusted.reason}`);
}
console.log('ok   rehydrated pair enters trusted identity consumer');

const tamperedDoc = JSON.parse(observationRaw);
tamperedDoc.observations[0].code = 'wf-tampered';
const tampered = verifyAcceptedIdentityObservationBundle({
  caseId, captureRaw, observationRaw: `${JSON.stringify(tamperedDoc, null, 2)}\n`, pathFacts,
  acceptedIntakeAuthority: rehydrated.authority,
  platformReadbackReceipt: rehydrated.receipt,
});
if (tampered.ok || tampered.trusted === true) fail('tampered observation became trusted');
console.log('ok   tampered observation remains rejected');

