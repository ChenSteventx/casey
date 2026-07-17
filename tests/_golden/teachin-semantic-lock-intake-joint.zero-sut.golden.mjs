#!/usr/bin/env node
// 冻结验收：intake 联合验证固定同级三件套，台账与 distill 同时绑定三份原始字节。
// 仅静态读取源码；禁止启动进程、浏览器、网络、fake 或 fixture SUT。

import { readFileSync } from 'node:fs';

function fail(message) { throw new Error(message); }
const intakeBin = readFileSync(new URL('../../bin/intake.mjs', import.meta.url), 'utf8');
const intakeLib = readFileSync(new URL('../../lib/record-intake.mjs', import.meta.url), 'utf8');
const distillBin = readFileSync(new URL('../../bin/distill.mjs', import.meta.url), 'utf8');
const distillLib = readFileSync(new URL('../../lib/record-distill.mjs', import.meta.url), 'utf8');
const all = [intakeBin, intakeLib, distillBin, distillLib].join('\n');

for (const token of ['deriveTeachInPackagePaths', 'verifyTeachInPackage', 'teach-in-package.json', 'identity-observations.json']) {
  if (!intakeBin.includes(token)) fail(`intake 未联合接线：缺 ${token}`);
}
if (!/deriveTeachInPackagePaths\s*\(\s*\{[^}]*capturePath/s.test(intakeBin)) fail('intake 必须只从已校验 capturePath 推导另外两文件');
if (!/readFileSync\s*\([^)]*manifestPath/s.test(intakeBin) || !/readFileSync\s*\([^)]*sidecarPath/s.test(intakeBin)) fail('intake 必须读取 manifest/sidecar 原始最终字节');
if (/--(?:manifest|sidecar)\b/.test(all) || /args\[['"](?:manifest|sidecar)['"]\]/.test(all)) fail('intake/distill 不得接受 manifest/sidecar 任意路径参数');

for (const field of ['captureSha256', 'sidecarSha256', 'manifestSha256', 'observationCount', 'observationSchemaVersion']) {
  if (!intakeLib.includes(field) || !intakeBin.includes(field)) fail(`accepted 台账未联合绑定 ${field}`);
}
for (const field of ['currentCaptureSha256', 'currentSidecarSha256', 'currentManifestSha256']) {
  if (!distillLib.includes(field) || !distillBin.includes(field)) fail(`distill TOCTOU 未联合重验 ${field}`);
}
if (!/verifyIntakenPackage\s*\(/.test(distillBin)) fail('distill 未调用三件套 accepted 台账复核器');

console.log('ok   teachin-semantic-lock-intake-joint: 固定路径三件套联合 intake/TOCTOU（零 SUT）');
