#!/usr/bin/env node
// real-uat-attestation · 见证完整性金牌（zero-SUT，纯 node，只读）。
// codex R1-R5 修单版：不再「读账本自证账本」——checksum 核到值、人签核到件、真机产物（axes/verdict/
// 报告附件/录屏/视觉复核）深核到内容、账实 sha 逐条对照。
// 【绑见证机】run-2 真机产物在本机 cases/、runs/（gitignore 不入库）；异机跑本金牌红=如实
// （见证不可迁移），不是 flake——见证的机器可核面只在产物所在机成立（ADR-0009 终局仍人签）。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = 'real-uat-attestation';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE = join(ROOT, 'docs', 'plans', 'real-uat-attestation', 'evidence', 'uat-run.md');
const SIGNOFF = join(ROOT, 'docs', 'plans', 'real-uat-attestation', 'evidence', 'uat-signoff.md');
const CLEANLOG = join(ROOT, 'docs', 'plans', 'real-uat-attestation', 'evidence', 'cleanup-run2.log');
const TC_PRD = join(ROOT, 'loop', 'prd-tc_agent_id_readback_real_uat_v1.json');
const OWNER_PRD = join(ROOT, 'loop', 'prd-agent-id-readback.json');
const GRILL = join(ROOT, 'docs', 'plans', 'real-uat-attestation', 'GRILL.md');
const CASE_DIR = join(ROOT, 'cases', 'tc_agent_id_readback_real_uat_v1');
const RUN = join(ROOT, 'runs', 'real-uat-attestation', 'tc_agent_id_readback_real_uat_v1');

let failures = 0; let passes = 0;
const red = (l, d) => { failures += 1; console.error(`RED  ${TAG}: ${l}: ${d}`); };
const ok = (l) => { passes += 1; console.log(`ok   ${TAG}: ${l}`); };
class CheckFail extends Error {}
const must = (c, d) => { if (!c) throw new CheckFail(d); };
const check = (l, fn) => { try { fn(); ok(l); } catch (e) { red(l, e instanceof CheckFail ? e.message : `异常：${e?.stack?.split('\n')[0]}`); } };
const sha8 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 8); // 证据文档记 8 位前缀（脱敏简写）；完整 sha 由 V2 对 prd 冻结账核到全长
const jread = (p) => JSON.parse(readFileSync(p, 'utf8'));

check('V1 证据文档四步账+run-2 交付权威节齐全', () => {
  must(existsSync(EVIDENCE), 'uat-run.md 缺席');
  const t = readFileSync(EVIDENCE, 'utf8');
  for (const m of ['### ① ', '### ② ', '### ③ ', '### ④ ', '## run-2（']) must(t.includes(m), `缺${m.trim()}节`);
  must(t.includes('三面归零') && t.includes('cleanup-run2.log'), '清理归零账不在');
});

check('V2 tc prd 冻结账核到值（authority/frozen/locks 三件 sha 与实际文件相等）', () => {
  const j = jread(TC_PRD);
  const entries = Object.entries(j.testChecksums || {});
  must(entries.length >= 3, 'checksum 条目不足');
  for (const [rel, expected] of entries) {
    const p = join(ROOT, rel);
    must(existsSync(p), `冻结件缺席：${rel}`);
    const actual = createHash('sha256').update(readFileSync(p)).digest('hex');
    must(actual === expected, `${rel} sha 不等（账 ${expected.slice(0, 12)}… 实 ${actual.slice(0, 12)}…）`);
  }
  must(j.expectedFrozenPath === 'cases/tc_agent_id_readback_real_uat_v1/expected.frozen.json', 'expectedFrozenPath 未设/不符');
});

check('V3 绑定与人签闭合（uatCaseId ↔ tc prd ↔ GRILL 裁决 ↔ 终局签认件）', () => {
  const owner = jread(OWNER_PRD);
  const row = (owner.observability || []).find((o) => o && o.uatCaseId);
  must(row && row.uatCaseId === 'tc_agent_id_readback_real_uat_v1', 'owner prd uatCaseId 缺失/不符');
  must(typeof row.uatDefinition === 'string' && row.uatDefinition.includes('AMBIGUOUS'), 'uatDefinition 冻结文缺失');
  must(jread(TC_PRD).caseId === row.uatCaseId, 'tc prd caseId 与 uatCaseId 不符');
  must(existsSync(GRILL) && readFileSync(GRILL, 'utf8').includes('三分岔全 A'), 'GRILL 裁决记录缺席');
  must(existsSync(SIGNOFF), '终局签认件缺席');
  const s = readFileSync(SIGNOFF, 'utf8');
  must(s.includes('Steven') && s.includes('过闸') && s.includes('SUT_DEFECT'), '签认件缺过闸/503 采认要素');
});

check('V4 发现账齐全（503 缺陷+实例相关性精化+drafter 工装缝+人签闸）', () => {
  const t = readFileSync(EVIDENCE, 'utf8');
  must(t.includes('503') && t.includes('相关性精化'), 'SUT 缺陷账/精化不在');
  must(t.includes('intentId') && t.includes('孤儿'), 'drafter 工装缝不在账');
  must(t.includes('ADR-0009') && t.includes('人签'), '人签闸不在账');
});

check('V5 真机产物深核：签署件/两放 axes·verdict 实际内容与判据相等', () => {
  const locks = jread(join(CASE_DIR, 'entity-locks.frozen.json'));
  must(locks.schemaVersion === 2 && locks.replayReady === true && (locks.identityObservations || []).length === 1, 'locks 非 v2/未就绪/观察行数≠1');
  must(/^[0-9]{19}$/.test(locks.identityObservations[0].platformId), 'platformId 非 19 位纯数字');
  const v1 = jread(join(RUN, 'run2-replay1', 'verdict.json'));
  must(v1.steps.length === 2 && v1.steps.every((s) => s.verdict === 'PASS'), `回放①应 2/2 PASS，实 ${JSON.stringify(v1.steps.map((s) => s.verdict))}`);
  const a1 = jread(join(RUN, 'run2-replay1', 'axes.json'));
  must(a1.steps[1].action.resolution === 'unique' && a1.steps[1].action.identityReadback?.ok === true, '回放①动作轴非 unique+回读 ok');
  const v2 = jread(join(RUN, 'run2-replay2', 'verdict.json'));
  must(v2.steps[1].verdict === 'NEEDS_HUMAN' && v2.steps[1].reason === 'AMBIGUOUS_ACTION', '回放②非 AMBIGUOUS_ACTION');
  const a2 = jread(join(RUN, 'run2-replay2', 'axes.json'));
  must(a2.steps[1].action.resolution === 'ambiguous' && a2.steps[1].action.candidateCount === 2, '回放②动作轴非 ambiguous×2');
  const url2 = a2.steps[1].postAssertions.find((p) => p.kind === 'urlPathname');
  must(url2 && url2.actual === '/heren/aimanagement/agent/list', '回放②不点击证据（URL 停列表）不成立');
});

check('V6 报告交付四项齐：录屏+视觉复核+附件实存+账实 sha 对照', () => {
  const evid = readFileSync(EVIDENCE, 'utf8');
  for (const n of [1, 2]) {
    const d = join(RUN, `run2-replay${n}`);
    for (const f of ['tc_agent_id_readback_real_uat_v1.report.html', 'tc_agent_id_readback_real_uat_v1.report.json', 'tc_agent_id_readback_real_uat_v1.report.md', 'verdict.json', 'axes.json', 'run-history.jsonl', 'run-metrics.json', 'video.json', 'video.webm', 'visual-review.json']) {
      must(existsSync(join(d, f)), `run2-replay${n} 附件缺席：${f}`);
    }
    const rm = jread(join(d, 'report-model.json'));
    must(rm.replayVideo && rm.replayVideo.file === 'video.webm', `run2-replay${n} 报告缺录屏元数据`);
    must(rm.visualReview && rm.visualReview.status === 'CONSISTENT', `run2-replay${n} 视觉复核缺席/非 CONSISTENT`);
    for (const f of ['axes.json', 'verdict.json', 'video.webm', 'tc_agent_id_readback_real_uat_v1.report.json']) {
      must(evid.includes(sha8(join(d, f))), `账实不符：run2-replay${n}/${f} 的 sha 前缀未见于证据文档`);
    }
  }
  must(existsSync(CLEANLOG) && readFileSync(CLEANLOG, 'utf8').includes('CLEANUP-OK（名称+逐编码三面归零）'), '清理日志缺席/未三面归零');
});

const total = passes + failures;
if (failures > 0) { console.error(`RED  ${TAG}: ${failures}/${total} 检查未过`); process.exit(1); }
console.log(`ok   ${TAG}: ${total}/${total} 检查全过（见证账实一致；终局采认见 uat-signoff.md）`);
process.exit(0);
