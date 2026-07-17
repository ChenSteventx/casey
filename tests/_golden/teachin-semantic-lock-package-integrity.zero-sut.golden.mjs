#!/usr/bin/env node
// 冻结验收：第三 package manifest 绑定 capture/sidecar 最终完整字节，二者无 hash 环。
// 只调用纯函数；禁止启动浏览器、网络、fake 或 fixture SUT。

import { createHash } from 'node:crypto';
import {
  buildTeachInPackageManifest,
  serializeTeachInPackageManifest,
  verifyTeachInPackage,
  deriveTeachInPackagePaths,
} from '../../lib/entity-semantic-lock-package.mjs';

function sha(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
function fail(message) { throw new Error(message); }

const captureBytes = Buffer.from('{"schemaVersion":1,"caseId":"tc-package","identityObservations":{"filename":"identity-observations.json","present":true}}\n');
const sidecarBytes = Buffer.from('{"schemaVersion":2,"artifactKind":"identity-observations","caseId":"tc-package","observations":[{"kind":"workflow","name":"审批","code":"wf-1"},{"kind":"agent","name":"助手","code":"ag-1"}]}\n');
const captureBefore = Buffer.from(captureBytes);
const sidecarBefore = Buffer.from(sidecarBytes);
const expected = {
  schemaVersion: 1,
  artifactKind: 'teach-in-package-manifest',
  caseId: 'tc-package',
  capture: { filename: 'teach-in-capture.json', sha256: sha(captureBytes) },
  sidecar: {
    filename: 'identity-observations.json',
    sha256: sha(sidecarBytes),
    observationCount: 2,
    observationSchemaVersion: 2,
  },
};
const expectedBytes = Buffer.from(JSON.stringify(expected, null, 2) + '\n');

const manifest = buildTeachInPackageManifest({
  caseId: 'tc-package', captureBytes, sidecarBytes,
  observationCount: 2, observationSchemaVersion: 2,
});
const manifestBytes = Buffer.from(serializeTeachInPackageManifest(manifest));
if (!manifestBytes.equals(expectedBytes)) fail('manifest 最终字节不确定或 schema/order/换行漂移');
if (!captureBytes.equals(captureBefore) || !sidecarBytes.equals(sidecarBefore)) fail('构建 manifest 不得回写 capture/sidecar 最终字节');
if (captureBytes.includes(Buffer.from(sha(sidecarBytes))) || sidecarBytes.includes(Buffer.from(sha(captureBytes)))) fail('capture 与 sidecar 不得互含对方 hash');

const ok = verifyTeachInPackage({ caseId: 'tc-package', captureBytes, sidecarBytes, manifestBytes });
if (!ok.ok || ok.captureSha256 !== sha(captureBytes) || ok.sidecarSha256 !== sha(sidecarBytes)) fail('合法三件套未按最终完整字节通过');

const tamperedSidecar = Buffer.from(sidecarBytes);
tamperedSidecar[tamperedSidecar.length - 2] = 0x20;
const bad = verifyTeachInPackage({ caseId: 'tc-package', captureBytes, sidecarBytes: tamperedSidecar, manifestBytes });
if (bad.ok || bad.allowIntake !== false || !bad.reason || !bad.nextAction) fail('sidecar 单字节篡改必须结构化拒绝 intake');

const paths = deriveTeachInPackagePaths({ capturePath: '/safe/tc-package/record-capture/teach-in-capture.json' });
if (paths.manifestPath !== '/safe/tc-package/record-capture/teach-in-package.json') fail('manifest 必须从 capture 同级固定名推导');
if (paths.sidecarPath !== '/safe/tc-package/record-capture/identity-observations.json') fail('sidecar 必须从 capture 同级固定名推导');
for (const unsafe of ['/safe/tc-package/record-capture/other.json', '../teach-in-capture.json']) {
  let threw = false;
  try { deriveTeachInPackagePaths({ capturePath: unsafe }); } catch { threw = true; }
  if (!threw) fail('非规范 capture 路径不得推导 package 路径');
}

console.log('ok   teachin-semantic-lock-package-integrity: 第三 manifest 最终字节 hash 无环（零 SUT）');
