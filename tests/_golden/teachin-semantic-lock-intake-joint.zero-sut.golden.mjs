#!/usr/bin/env node
// 冻结验收（trust-root 现役模型）：intake 与 distill 命令行都从规范 capture 同级固定推导三件套并联合验证。
// intake 走 canonical 权威根 append transaction 落 committed 台账（联合绑三 hash + 观察元数据）；
// distill 以 rehydrateAcceptedObservationTransaction 跨进程重铸，禁旧 plain-ledger 复核器 verifyIntakenPackage。
// 仅静态读取源码；禁止启动进程、浏览器、网络、fake 或 fixture SUT。
// 对齐 observation-cli-authority-wiring.zero-sut.golden.mjs 的 distill 源码约束（含 rehydrate、禁 verifyIntakenPackage）。

import { readFileSync } from 'node:fs';

function fail(message) { throw new Error(message); }
const intakeBin = readFileSync(new URL('../../bin/intake.mjs', import.meta.url), 'utf8');
const intakeLib = readFileSync(new URL('../../lib/record-intake.mjs', import.meta.url), 'utf8');
const distillBin = readFileSync(new URL('../../bin/distill.mjs', import.meta.url), 'utf8');
const distillLib = readFileSync(new URL('../../lib/record-distill.mjs', import.meta.url), 'utf8');
const all = [intakeBin, intakeLib, distillBin, distillLib].join('\n');

// ── intake 侧：命令行层派生并校验固定同级三件套，走 canonical 权威根，不接受任意三件套路径参数 ──
for (const token of ['deriveTeachInPackagePaths', 'verifyTeachInPackage', 'teach-in-package.json', 'identity-observations.json', 'appendAcceptedObservationPackage']) {
  if (!intakeBin.includes(token)) fail(`intake 未联合接线：缺 ${token}`);
}
if (intakeBin.includes('appendIntakeLedger')) fail('intake 绕过 canonical append transaction（trust-root 禁命令行层直写 plain 入账台账）');
if (!/deriveTeachInPackagePaths\s*\(\s*\{[^}]*capturePath/s.test(intakeBin)) fail('intake 必须只从已校验 capturePath 推导另外两文件');
if (!/readFileSync\s*\([^)]*manifestPath/s.test(intakeBin) || !/readFileSync\s*\([^)]*sidecarPath/s.test(intakeBin)) fail('intake 必须读取 manifest/sidecar 原始最终字节');
if (/--(?:manifest|sidecar)\b/.test(all) || /args\[['"](?:manifest|sidecar)['"]\]/.test(all)) fail('intake/distill 不得接受 manifest/sidecar 任意路径参数');

// accepted 台账联合绑三 hash + 观察元数据（intakeLib 造记录、intakeBin 命令行层持有并交叉核对同一组事实）。
for (const field of ['captureSha256', 'sidecarSha256', 'manifestSha256', 'observationCount', 'observationSchemaVersion']) {
  if (!intakeLib.includes(field) || !intakeBin.includes(field)) fail(`accepted 台账未联合绑定 ${field}`);
}

// ── distill 侧：三件套 TOCTOU 当前字节重验 + trust-root 权威消费（对齐 observation 金牌 L92-93）──
for (const token of ['deriveTeachInPackagePaths', 'verifyTeachInPackage', 'rehydrateAcceptedObservationTransaction']) {
  if (!distillBin.includes(token)) fail(`distill 未接线：缺 ${token}`);
}
if (distillBin.includes('verifyIntakenPackage')) fail('distill 仍信旧 plain-ledger accepted 复核器 verifyIntakenPackage（trust-root 已下移进权威内核）');
for (const field of ['currentCaptureSha256', 'currentSidecarSha256', 'currentManifestSha256']) {
  if (!distillBin.includes(field)) fail(`distill TOCTOU 未联合重验 ${field}`);
}

console.log('ok   teachin-semantic-lock-intake-joint: 固定路径三件套联合 intake/TOCTOU（trust-root，零 SUT）');
