#!/usr/bin/env node
// real-uat-attestation · 见证完整性金牌（zero-SUT，纯 node，只读已提交件）。
// 本金牌不重跑真机（真机产物在 cases/runs 本机留存、不入库）：它机器化核「见证账本自身的完整性」——
// 证据文档四步账齐全、关键判据字面在账、tc prd 冻结三件套在账且与 agent-id-readback 的 uatCaseId
// 绑定闭合。真机结论的最终采认=Steven 人签（ADR-0009，evidence 文档「发现与挂账」第 4 条）。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = 'real-uat-attestation';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE = join(ROOT, 'docs', 'plans', 'real-uat-attestation', 'evidence', 'uat-run.md');
const TC_PRD = join(ROOT, 'loop', 'prd-tc_agent_id_readback_real_uat_v1.json');
const OWNER_PRD = join(ROOT, 'loop', 'prd-agent-id-readback.json');
const GRILL = join(ROOT, 'docs', 'plans', 'real-uat-attestation', 'GRILL.md');

let failures = 0; let passes = 0;
const red = (l, d) => { failures += 1; console.error(`RED  ${TAG}: ${l}: ${d}`); };
const ok = (l) => { passes += 1; console.log(`ok   ${TAG}: ${l}`); };
class CheckFail extends Error {}
const must = (c, d) => { if (!c) throw new CheckFail(d); };
const check = (l, fn) => { try { fn(); ok(l); } catch (e) { red(l, e instanceof CheckFail ? e.message : `异常：${e?.stack?.split('\n')[0]}`); } };

check('V1 证据文档在场且四步账齐全（①②③④节+两放判据字面）', () => {
  must(existsSync(EVIDENCE), 'uat-run.md 缺席');
  const t = readFileSync(EVIDENCE, 'utf8');
  for (const m of ['### ① ', '### ② ', '### ③ ', '### ④ ']) must(t.includes(m), `缺${m.trim()}节`);
  must(t.includes('identityReadback:{ok:true}') && t.includes('resolution:unique'), '回放①双证 unique+回读 ok 判据不在账');
  must(t.includes('resolution:ambiguous') && t.includes('AMBIGUOUS_ACTION'), '回放②敌意 AMBIGUOUS 判据不在账');
  must(t.includes('仍停列表页') && t.includes('2→1→0'), '不点击物理证据/清理归零证据不在账');
  must(t.includes('19 长纯数字'), 'platformId 形态不在账');
});

check('V2 tc prd 冻结三件套在账（authority+expected.frozen+entity-locks）且 expectedFrozenPath 已设', () => {
  must(existsSync(TC_PRD), 'tc prd 缺席');
  const j = JSON.parse(readFileSync(TC_PRD, 'utf8'));
  const keys = Object.keys(j.testChecksums || {});
  must(keys.some((k) => k.endsWith('execute-authority.json')), '缺 authority checksum');
  must(keys.some((k) => k.endsWith('expected.frozen.json')), '缺 expected.frozen checksum');
  must(keys.some((k) => k.endsWith('entity-locks.frozen.json')), '缺 entity-locks checksum');
  must(j.expectedFrozenPath === 'cases/tc_agent_id_readback_real_uat_v1/expected.frozen.json', 'expectedFrozenPath 未设/不符');
});

check('V3 uatCaseId 绑定闭合（owner prd observability ↔ tc prd caseId ↔ GRILL 三分岔裁决在案）', () => {
  const owner = JSON.parse(readFileSync(OWNER_PRD, 'utf8'));
  const row = (owner.observability || []).find((o) => o && o.uatCaseId);
  must(row && row.uatCaseId === 'tc_agent_id_readback_real_uat_v1', 'owner prd uatCaseId 缺失/不符');
  must(typeof row.uatDefinition === 'string' && row.uatDefinition.includes('AMBIGUOUS'), 'uatDefinition 冻结文缺失');
  const tc = JSON.parse(readFileSync(TC_PRD, 'utf8'));
  must(tc.caseId === row.uatCaseId, 'tc prd caseId 与 uatCaseId 不符');
  must(existsSync(GRILL) && readFileSync(GRILL, 'utf8').includes('三分岔全 A'), 'GRILL 裁决记录缺席');
});

check('V4 发现账齐全（SUT 503 缺陷+drafter patch 工装缝+人签闸明记）', () => {
  const t = readFileSync(EVIDENCE, 'utf8');
  must(t.includes('503'), 'SUT 缺陷发现不在账');
  must(t.includes('intentId') && t.includes('孤儿'), 'drafter 工装缝不在账');
  must(t.includes('ADR-0009') && t.includes('人签'), '人签完成闸不在账');
});

const total = passes + failures;
if (failures > 0) { console.error(`RED  ${TAG}: ${failures}/${total} 检查未过`); process.exit(1); }
console.log(`ok   ${TAG}: ${total}/${total} 检查全过（见证账本完整；真机结论采认待 Steven 人签）`);
process.exit(0);
