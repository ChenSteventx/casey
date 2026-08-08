#!/usr/bin/env node
// credgate-lineage-keys 验收金牌：凭据门对域定义世系键（batchToken/uniqueNameToken）
// 键感知 + 严格值形状中和（只动扫描副本、产物字节零动；Steven 裁 2026-08-08 门学形状豁免）。
//
// ── 咬什么（第十例「从未走通过」的封口）──────────────────────────────────────
// v3 清理取证字段名含 token 子串，credentialGate 全文包含匹配把合法 axes 拒写
// （AXES_CREDENTIAL_GATE_REJECTED→ReplayFinalizeAbort，票据 c/d 两跑实证）。本金牌钉：
//   G1 合形键值对放行（string/null 两态）        G2 值形状不符照拦（不中和）
//   G3 非闭集键 accessToken 零豁免               G4 既有关键词表本体零动
//   G5 敏感字面量作世系值仍被字面量分支拦（扫原文；真凭据在场则跳过并明记）
//   G6 真投影器（projectReplayAxes + cleanup 块）产文本推门放行——生产文本形状端到端
// 纯函数金牌（门与投影器皆纯、零 SUT 零浏览器）；真机端到端真证=合入后重跑 replay
// （prd observability route:human）。判绿只信退出码；改本文件=Test Ratchet 判红。

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { credentialGate } from '../../lib/cred-gate.mjs';
import { projectReplayAxes } from '../../lib/replay-axes.mjs';
import { AUTH_DIR, PROJECT_ROOT } from '../../lib/paths.mjs';

const failures = [];
let passed = 0;
const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); }
};

const clean = () => ({ 'axes.json': '{\n  "caseId": "tc_cg_lineage",\n  "steps": []\n}\n' });
const withLine = (line) => {
  const out = clean();
  out['axes.json'] = out['axes.json'].replace('"steps"', `${line}\n  "steps"`);
  return out;
};

test('G1 合形世系键值对放行（string 与 null 两态）', () => {
  const r1 = credentialGate(withLine('"batchToken": "b4replay0808d",'));
  check(r1.ok === true, `合形 batchToken 应放行，实得 ${JSON.stringify(r1)}`);
  const r2 = credentialGate(withLine('"uniqueNameToken": "b4replay0808d-case-1",'));
  check(r2.ok === true, `合形 uniqueNameToken 应放行，实得 ${JSON.stringify(r2)}`);
  const r3 = credentialGate(withLine('"batchToken": null,'));
  check(r3.ok === true, `null 值应放行，实得 ${JSON.stringify(r3)}`);
});

test('G2 值形状不符照拦（不中和）', () => {
  for (const bad of ['"has space"', `"${'x'.repeat(65)}"`, '""', '"-leading"']) {
    const r = credentialGate(withLine(`"batchToken": ${bad},`));
    check(r.ok === false && String(r.hit).includes('token'), `非法值 ${bad.slice(0, 12)}… 应仍拦 token，实得 ${JSON.stringify(r)}`);
  }
});

test('G3 非闭集键零豁免', () => {
  const r = credentialGate(withLine('"accessToken": "abc123",'));
  check(r.ok === false && String(r.hit).includes('token'), `accessToken 应仍拦，实得 ${JSON.stringify(r)}`);
});

test('G4 既有关键词表本体零动（大写注入 + 裸 bearer ）', () => {
  for (const kw of ['authorization', 'set-cookie', 'password', 'secret', 'credential', 'bearer ']) {
    const out = clean();
    out['axes.json'] += `\n${kw.toUpperCase()}: 不慎混入\n`;
    const r = credentialGate(out);
    check(r.ok === false && String(r.hit).includes(kw), `关键词「${kw}」应仍拦，实得 ${JSON.stringify(r)}`);
  }
});

test('G5 敏感字面量作世系值仍被字面量分支拦（扫原文）', () => {
  const SITE = join(AUTH_DIR, 'site.json');
  if (existsSync(SITE) || existsSync(join(PROJECT_ROOT, 'site.json'))) {
    // 真凭据在场——绝不触碰、绝不覆盖（p7-credgate 同款跳过分支，收据明记；
    // 该分支由突变 M-c′ 与真机重跑兜底）。
    console.log('     （真凭据文件在场，G5 合成注入跳过——p7 先例同款，明记不装绿）');
    return;
  }
  const createdDir = !existsSync(AUTH_DIR);
  const LIT = 'FAKE-LINEAGE-LIT-9f2c7b1e'; // ≥6 字符、合世系值形状、不含任一关键词子串
  try {
    if (createdDir) mkdirSync(AUTH_DIR, { recursive: true });
    writeFileSync(SITE, JSON.stringify({ session: LIT }), 'utf8');
    const r = credentialGate(withLine(`"batchToken": "${LIT}",`));
    check(r.ok === false && String(r.hit).includes('敏感字面量'), `字面量作世系值应仍拦，实得 ${JSON.stringify(r)}`);
  } finally {
    rmSync(SITE, { force: true });
    if (createdDir) rmSync(AUTH_DIR, { recursive: true, force: true });
  }
});

test('G6 真投影器 cleanup 块产文本推门放行（生产文本形状端到端）', () => {
  const axesText = projectReplayAxes({
    caseId: 'tc_cg_lineage',
    records: [],
    intentOrder: ['intent_cleanup'],
    intentEvents: new Map([['intent_cleanup', [
      { stepId: 'atstep_1', intentId: 'intent_cleanup', atom: 'workflow.deleteByName', action: 'click', text: '确认' },
    ]]]),
    reprStepOf: new Map([['intent_cleanup', 'atstep_1']]),
    actionByStep: new Map(),
    pageErrors: [],
    intentCount: new Map([['intent_cleanup', 1]]),
    expectedByIntent: new Map(),
    globalAssertions: [],
    intentUrl: new Map(),
    intentToasts: new Map(),
    intentTextHits: new Map(),
    intentButtonHits: new Map(),
    intentButtonSeen: new Map(),
    intentButtonDisabledHits: new Map(),
    intentReply: new Map(),
    intentInputReadback: new Map(),
    chatCfg: null,
    allStepIds: new Set(['atstep_1']),
    cleanupEvidence: {
      ok: true, cleanupSatisfied: true, reason: null, sampleCount: 3, windowMs: 3200,
      batchToken: 'b4replay0808d', uniqueNameToken: 'b4replay0808d-case-1',
      entityName: 'atl_b4replay0808d-case-1',
    },
  });
  check(axesText.includes('"batchToken"'), 'G6 前提：投影文本须真含世系键（防夹具跑偏）');
  const r = credentialGate({ 'axes.json': axesText });
  check(r.ok === true, `真形状 axes 文本应放行，实得 ${JSON.stringify(r)}`);
});

console.log(`credgate-lineage-keys: ${passed}/${passed + failures.length}`);
if (failures.length) process.exit(1);
console.log('ok   credgate-lineage-keys: 世系键键感知形状中和——放行面恰两键合形、拦截面零放松（纯函数门 + 真投影器文本）');
