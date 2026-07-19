#!/usr/bin/env node
// 铸造工具（开发期，非运行时依赖）：为 hermetic 金牌产出准入门测试签名件。
// 只 import 内核公开导出（签名计算/字节哈希/flow bindings 推导），零改内核；
// 产物合法性最终由准入门自身判定（bindings 推导若与门内 policy 失配，门会拒、金牌红）。
//   lock 模式：  node mint-admission-authority.mjs lock --events <f> --out <f> [--signer <id>] [--signed-at <iso>]
//   execute 模式：node mint-admission-authority.mjs execute --flow <f> --testcase <f> --out <f> [--case-id <id>] [--signer <id>] [--signed-at <iso>]
// receiptHash 为占位格式值（门的读路只校格式不验收据内容）；真机路仍走真实人签与真收据，互不削弱。

import { readFileSync, writeFileSync } from 'node:fs';
import {
  calculateIdentityAdmissionSignature,
  hashIdentityAdmissionBytes,
  requiredFlowEntityBindings,
} from '../../../lib/entity-semantic-lock-preflight.mjs';

const args = process.argv.slice(2);
const mode = args[0];
const opt = {};
for (let i = 1; i < args.length; i += 2) {
  if (!args[i].startsWith('--') || args[i + 1] == null) fail(`旗标解析失败：${args[i]}`);
  opt[args[i].slice(2)] = args[i + 1];
}
const SIGNER = opt.signer || 'hermetic-migration-fixture';
const SIGNED_AT = opt['signed-at'] || '2026-07-19T00:00:00.000Z';
const RECEIPT_PLACEHOLDER = 'sha256:' + 'd'.repeat(64);

function fail(msg) {
  console.error(`mint-admission-authority: ${msg}`);
  process.exit(1);
}
function emit(outPath, artifact) {
  const value = { ...artifact };
  delete value.signature;
  value.signature = calculateIdentityAdmissionSignature(value);
  writeFileSync(outPath, JSON.stringify(value, null, 2) + '\n');
  console.log(`minted ${value.artifactKind} caseId=${value.caseId} → ${outPath}`);
}

// 与门内 SIDE_EFFECT_POLICY 对齐的最小投影（门自身是最终裁判）：
// read 白名单两原子零 binding；workflow.bindAgent 关系原子 source+target；其余（含未登记默认 mutation）单 subject。
function rolesForAtom(atom) {
  if (atom === 'nav.workflowManagement' || atom === 'assert.textVisible') return [];
  if (atom === 'workflow.bindAgent') return ['source', 'target'];
  return ['subject'];
}

if (mode === 'lock') {
  if (!opt.events || !opt.out) fail('lock 模式需 --events 与 --out');
  const eventsBytes = readFileSync(opt.events);
  const doc = JSON.parse(eventsBytes);
  if (!doc.caseId) fail('events 文档缺 caseId');
  const events = doc.events || [];
  if (events.length === 0) fail('events 为空，无锁可铸（空 events 案须在金牌侧对号处置）');
  const bindings = [];
  for (const e of events) {
    for (const role of rolesForAtom(e.atom)) {
      bindings.push({
        stepId: e.stepId,
        intentId: e.intentId,
        atom: e.atom,
        role,
        candidateId: `candidate-${e.stepId}-${role}`,
        lockId: `lock-${e.stepId}-${role}`,
        receiptHash: RECEIPT_PLACEHOLDER,
      });
    }
  }
  emit(opt.out, {
    schemaVersion: 1,
    artifactKind: 'entity-locks-frozen',
    caseId: doc.caseId,
    signed: true,
    replayReady: true,
    signerId: SIGNER,
    signedAt: SIGNED_AT,
    eventsSha256: hashIdentityAdmissionBytes(eventsBytes),
    bindings,
  });
} else if (mode === 'execute') {
  if (!opt.flow || !opt.testcase || !opt.out) fail('execute 模式需 --flow/--testcase/--out');
  const flowBytes = readFileSync(opt.flow);
  const testcaseBytes = readFileSync(opt.testcase);
  const flowDoc = JSON.parse(flowBytes);
  const tc = JSON.parse(testcaseBytes);
  const caseId = opt['case-id'] || tc.caseId || flowDoc.caseId;
  if (!caseId) fail('定不出 caseId（--case-id 或 testcase/flow 的 caseId 字段）');
  const bindings = requiredFlowEntityBindings(flowDoc.flow || flowDoc);
  if (!Array.isArray(bindings) || bindings.length === 0) {
    fail('flow 推不出实体 bindings（requiredFlowEntityBindings 空）——该 flow 夹具须先补实体元数据，不硬造');
  }
  emit(opt.out, {
    schemaVersion: 1,
    artifactKind: 'entity-pre-execution-authority',
    authorizedFor: 'compile-execute',
    caseId,
    signed: true,
    signerId: SIGNER,
    signedAt: SIGNED_AT,
    flowSha256: hashIdentityAdmissionBytes(flowBytes),
    testcaseSha256: hashIdentityAdmissionBytes(testcaseBytes),
    bindings: JSON.parse(JSON.stringify(bindings)),
  });
} else {
  fail('模式须为 lock 或 execute');
}
