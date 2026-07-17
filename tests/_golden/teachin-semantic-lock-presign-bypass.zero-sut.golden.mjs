#!/usr/bin/env node
// 冻结验收：compile execute/verify 在任何浏览器或 replay spawn 前各自通过正确身份签署门。
// 只调用纯函数并静态读源码；禁止启动进程、浏览器、网络、fake 或 fixture SUT。

import { readFileSync } from 'node:fs';
import { checkCompileIdentityAdmission } from '../../lib/entity-semantic-lock-preflight.mjs';

function fail(message) { throw new Error(message); }
const deniedExecute = checkCompileIdentityAdmission({
  mode: 'execute', caseId: 'tc-presign', containsEntityMutation: true,
  signedAuthority: null, frozenLocks: null,
});
if (deniedExecute.ok || deniedExecute.allowBrowserLaunch !== false || !deniedExecute.reason || !deniedExecute.nextAction) fail('execute 缺 pre-execution authority 必须零浏览器拒绝');

const deniedVerify = checkCompileIdentityAdmission({
  mode: 'verify', caseId: 'tc-presign', containsEntityMutation: true,
  signedAuthority: null, frozenLocks: null,
});
if (deniedVerify.ok || deniedVerify.allowBrowserLaunch !== false || !deniedVerify.reason || !deniedVerify.nextAction) fail('verify 缺最终 frozen locks 必须零浏览器拒绝');
if (deniedExecute.reason === deniedVerify.reason) fail('execute authority 与 verify frozen locks 不得混为同一门');

const src = readFileSync(new URL('../../bin/compile.mjs', import.meta.url), 'utf8');
const executeStart = src.indexOf('async function executeMode');
const verifyStart = src.indexOf('function verifyMode');
if (executeStart < 0 || verifyStart < 0) fail('compile execute/verify 函数边界缺失');
const executeSrc = src.slice(executeStart, verifyStart);
const verifySrc = src.slice(verifyStart);
const executeAdmission = executeSrc.indexOf('checkCompileIdentityAdmission(');
const browserLaunch = executeSrc.indexOf('chromium.launch');
if (executeAdmission < 0 || browserLaunch < 0 || executeAdmission > browserLaunch) fail('execute 身份 admission 必须早于 chromium.launch');
const verifyAdmission = verifySrc.indexOf('checkCompileIdentityAdmission(');
const replaySpawn = verifySrc.indexOf("join(PROJECT_ROOT, 'bin', 'replay.mjs')");
if (verifyAdmission < 0 || replaySpawn < 0 || verifyAdmission > replaySpawn) fail('verify 身份 admission 必须早于 replay spawn');
for (const token of ['entity-authority', 'entity-locks']) if (!src.includes(token)) fail(`compile 公共参数缺 ${token}`);
if (/allowUnsignedEntityLocks|skipEntityLock|--allow-unsigned/i.test(src)) fail('compile 不得提供未签直通开关');

console.log('ok   teachin-semantic-lock-presign-bypass: execute authority / verify frozen locks 前置拒旁路（零 SUT）');
