#!/usr/bin/env node
// Deterministic authoring/signing boundary for exact-byte entity authorities.
// The draft command never signs. Freeze re-derives the draft from the exact
// source bytes before adding the human-supplied signer metadata.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { credentialGate } from '../lib/cred-gate.mjs';
import {
  calculateIdentityAdmissionSignature,
  hashIdentityAdmissionBytes,
  requiredFlowEntityBindings,
} from '../lib/entity-semantic-lock-preflight.mjs';
import {
  freezeCreatedWorkflowOwnershipAuthority,
  prepareCreatedWorkflowOwnershipDraft,
} from '../lib/entity-created-workflow-continuity-v3.mjs';
import {
  REPLAY_GRANT_ARTIFACT_KIND,
  authorCreatedWorkflowReplayGrantDraft,
  freezeCreatedWorkflowReplayGrant,
} from '../lib/entity-created-workflow-replay-grant.mjs';

function parseArgs(argv) {
  const opts = {};
  const pos = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) pos.push(arg);
    else if (index + 1 < argv.length && !argv[index + 1].startsWith('--')) opts[arg.slice(2)] = argv[++index];
    else opts[arg.slice(2)] = true;
  }
  return { opts, pos };
}

function fail(message, code = 64) {
  console.error(`entity-authority: ${message}`);
  process.exit(code);
}

function bytes(path, label) {
  if (typeof path !== 'string' || !path) fail(`缺 ${label}`);
  try { return readFileSync(resolve(path)); } catch { return fail(`${label} 不可读`, 65); }
}

function json(path, label) {
  try { return JSON.parse(bytes(path, label).toString('utf8')); } catch { return fail(`${label} 不是合法 JSON`, 65); }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value == null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function sameDocument(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function writeArtifact(path, document) {
  if (typeof path !== 'string' || !path) fail('缺 --out');
  const target = resolve(path);
  const text = `${JSON.stringify(document, null, 2)}\n`;
  const gate = credentialGate({ [target]: text });
  if (!gate.ok) fail('输出未通过凭据兜底门', 65);
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.tmp`;
  if (existsSync(temp)) fail('输出临时文件已存在', 65);
  try {
    writeFileSync(temp, text, { encoding: 'utf8', flag: 'wx' });
    renameSync(temp, target);
  } catch {
    rmSync(temp, { force: true });
    fail('输出落盘失败', 74);
  }
  console.log(`entity-authority: 已写 ${target}`);
}

function sourceBundle(caseId, opts) {
  return {
    caseId,
    eventsBytes: bytes(opts.events, '--events'),
    flowBytes: bytes(opts.flow, '--flow'),
    testcaseBytes: bytes(opts.testcase, '--testcase'),
    profileBytes: bytes(opts.profile, '--profile'),
    compileProvenanceBytes: bytes(opts['compile-provenance'], '--compile-provenance'),
  };
}

function preparedCreatedWorkflow(caseId, opts) {
  const prepared = prepareCreatedWorkflowOwnershipDraft(sourceBundle(caseId, opts));
  if (!prepared.ok) fail(`created-workflow 草稿重建失败（${prepared.reason}）`, 65);
  return prepared.draft;
}

// 件种守卫：结构面与回放票据面互不可冒充，拒因必须具名到「件种」——
// 若只落到通用的「字节不一致」，钉不出两件的互斥（金牌 R3b）。
function refuseForeignArtifactKind(supplied, expectedKind, label) {
  const kind = supplied && typeof supplied === 'object' ? supplied.artifactKind : null;
  if (typeof kind === 'string' && kind !== expectedKind) {
    if (kind === REPLAY_GRANT_ARTIFACT_KIND) {
      fail(`${label} 收到的是回放授权票据而非本面草案（REPLAY_GRANT_ARTIFACT_KIND_INVALID）`, 65);
    }
    fail(`${label} 件种不符（收到 ${kind}）`, 65);
  }
}

// 多值收集：--case A --authority a --case B --authority b 成对出现，次序即配对次序。
function pairedCaseAuthorities(argv) {
  const pairs = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--case') continue;
    const caseId = argv[index + 1];
    if (typeof caseId !== 'string' || caseId.startsWith('--')) fail('--case 缺值');
    let authorityPath = null;
    for (let scan = index + 2; scan < argv.length; scan += 1) {
      if (argv[scan] === '--authority') { authorityPath = argv[scan + 1]; break; }
      if (argv[scan] === '--case') break;
    }
    if (typeof authorityPath !== 'string' || !authorityPath || authorityPath.startsWith('--')) {
      fail(`--case ${caseId} 缺配对的 --authority`);
    }
    pairs.push({ caseId, authorityBytes: bytes(authorityPath, `--authority(${caseId})`) });
  }
  if (!pairs.length) fail('缺 --case/--authority 配对');
  return pairs;
}

function replayGrantDraft(batchId, opts, argv) {
  if (!['test', 'production'].includes(opts.audience)) fail('--audience 须为 test 或 production');
  if (typeof opts['not-after'] !== 'string' || !opts['not-after'].trim()) {
    fail('缺 --not-after（失效时点由人写，机器不代算）');
  }
  const grantNonce = typeof opts['grant-nonce'] === 'string' && opts['grant-nonce']
    ? opts['grant-nonce']
    : randomBytes(16).toString('hex');
  const drafted = authorCreatedWorkflowReplayGrantDraft({
    batchId,
    audience: opts.audience,
    notAfter: opts['not-after'],
    grantNonce,
    cases: pairedCaseAuthorities(argv),
  });
  if (!drafted.ok) fail(`回放票据草稿重建失败（${drafted.reason}）`, 65);
  return drafted.draft;
}

function executeDraft(caseId, opts) {
  const flowBytes = bytes(opts.flow, '--flow');
  const testcaseBytes = bytes(opts.testcase, '--testcase');
  let flow;
  try { flow = JSON.parse(flowBytes.toString('utf8')); } catch { fail('--flow 不是合法 JSON', 65); }
  const flowBody = flow?.flow && Array.isArray(flow.flow.steps) ? flow.flow : flow;
  const bindings = requiredFlowEntityBindings(flowBody);
  if (!Array.isArray(bindings) || bindings.length === 0) fail('flow 未投影出实体绑定', 65);
  if (!['test', 'production'].includes(opts.audience)) fail('--audience 须为 test 或 production');
  return {
    schemaVersion: 1,
    artifactKind: 'entity-pre-execution-authority-draft',
    authorizedFor: 'compile-execute',
    caseId,
    signed: false,
    audience: opts.audience,
    flowSha256: hashIdentityAdmissionBytes(flowBytes),
    testcaseSha256: hashIdentityAdmissionBytes(testcaseBytes),
    bindings,
  };
}

const { opts, pos } = parseArgs(process.argv.slice(2));
const action = pos[0];
const caseId = pos[1];
if (!action || typeof caseId !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(caseId)) {
  fail('用法：entity-authority <execute-draft|execute-freeze|created-workflow-draft|created-workflow-freeze|replay-grant-draft|replay-grant-freeze> <caseId|batchId> ...');
}

if (action === 'execute-draft') {
  writeArtifact(opts.out, executeDraft(caseId, opts));
} else if (action === 'execute-freeze') {
  const regenerated = executeDraft(caseId, opts);
  const supplied = json(opts.draft, '--draft');
  if (!sameDocument(regenerated, supplied)) fail('execute draft 与当前精确 flow/TestCase 字节不一致', 65);
  if (typeof opts.signer !== 'string' || !opts.signer.trim() || typeof opts['signed-at'] !== 'string' || !opts['signed-at'].trim()) {
    fail('freeze 缺 --signer/--signed-at');
  }
  const unsigned = {
    schemaVersion: 1,
    artifactKind: 'entity-pre-execution-authority',
    authorizedFor: 'compile-execute',
    caseId,
    signed: true,
    signerId: opts.signer,
    signedAt: opts['signed-at'],
    audience: regenerated.audience,
    flowSha256: regenerated.flowSha256,
    testcaseSha256: regenerated.testcaseSha256,
    bindings: regenerated.bindings,
  };
  writeArtifact(opts.out, { ...unsigned, signature: calculateIdentityAdmissionSignature(unsigned) });
} else if (action === 'created-workflow-draft') {
  writeArtifact(opts.out, preparedCreatedWorkflow(caseId, opts));
} else if (action === 'created-workflow-freeze') {
  const regenerated = preparedCreatedWorkflow(caseId, opts);
  const supplied = json(opts.draft, '--draft');
  refuseForeignArtifactKind(supplied, 'created-workflow-ownership-authority', 'created-workflow-freeze');
  if (!sameDocument(regenerated, supplied)) fail('created-workflow draft 与当前五源精确字节不一致', 65);
  if (typeof opts.signer !== 'string' || !opts.signer.trim() || typeof opts['signed-at'] !== 'string' || !opts['signed-at'].trim()
    || !['test', 'production'].includes(opts.audience)) {
    fail('freeze 缺合法 --signer/--signed-at/--audience');
  }
  const frozen = freezeCreatedWorkflowOwnershipAuthority({
    draft: regenerated,
    signerId: opts.signer,
    signedAt: opts['signed-at'],
    audience: opts.audience,
  });
  if (!frozen.ok) fail(`created-workflow freeze 失败（${frozen.reason}）`, 65);
  writeArtifact(opts.out, frozen.authority);
} else if (action === 'replay-grant-draft') {
  writeArtifact(opts.out, replayGrantDraft(caseId, opts, process.argv.slice(2)));
} else if (action === 'replay-grant-freeze') {
  const supplied = json(opts.draft, '--draft');
  refuseForeignArtifactKind(supplied, REPLAY_GRANT_ARTIFACT_KIND, 'replay-grant-freeze');
  // 用当前精确字节重建草案再逐字比对（与 execute-freeze / created-workflow-freeze 同律）：
  // nonce 取自草案，否则重建必然不等、这条比对就成了摆设。
  const regenerated = replayGrantDraft(caseId, {
    ...opts, 'grant-nonce': supplied && supplied.grantNonce,
  }, process.argv.slice(2));
  if (!sameDocument(regenerated, supplied)) fail('replay-grant draft 与当前结构件精确字节不一致', 65);
  if (typeof opts.signer !== 'string' || !opts.signer.trim()
    || typeof opts['signed-at'] !== 'string' || !opts['signed-at'].trim()) {
    fail('freeze 缺 --signer/--signed-at');
  }
  const frozenGrant = freezeCreatedWorkflowReplayGrant({
    draft: regenerated, signerId: opts.signer, signedAt: opts['signed-at'],
  });
  if (!frozenGrant.ok) fail(`replay-grant freeze 失败（${frozenGrant.reason}）`, 65);
  writeArtifact(opts.out, frozenGrant.grant);
} else {
  fail('未知 action');
}
