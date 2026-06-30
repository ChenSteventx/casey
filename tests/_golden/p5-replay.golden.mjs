#!/usr/bin/env node
// 冻结黄金标准（P5 回放内核）：真回放假 SUT（被测系统）→ 产 axes（三轴）→ 喂已冻 verdict.mjs（多态裁定）→ 断言四态。
// 角色：证明「真回放能重现已冻的合成真值」，而非另立一套预期。故：
//   · verdict（裁定）四态一律映射到 verdict-cases.json 已冻八案（见每 case 的 groundedIn）；
//   · drift（locator 漂移）信号照 drift-patch.fixture.json 的 canonical（规范稳定签名）复刻、逐字断言。
// 冻结 runner（回放器）CLI：node bin/replay.mjs --events <f> --sut <baseUrl> --expected <f> --profile <f> --out <axes.json>
//   --profile = 通道剖面（Channel Profile，非凭据）：{ background:[denylist], successField, successValue }；watchNetworkForensics 据此对每条网络记录算错误信封。
//   axes.json = { caseId, steps: [ StepAxes ] }（与 verdict.mjs 输入同形态）
// 实现前必须红：bin/replay.mjs 不存在 → execFileSync 抛 → 本测试退非 0。改本文件 = Test Ratchet（测试棘轮）判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const CASES = JSON.parse(readFileSync(join(HERE, 'fixtures', 'p5', 'replay-cases.json'), 'utf8')).cases;
const tmp = mkdtempSync(join(tmpdir(), 'casey-p5replay-'));

// 解析 events（事件序列）：eventsRef 读已冻文件、否则用内联 events。
function resolveEvents(c) {
  if (c.eventsRef) return JSON.parse(readFileSync(join(ROOT, c.eventsRef), 'utf8'));
  return { schemaVersion: 2, channel: 'web', caseId: 'tc_workflow_create_smoke', events: c.events, nodes: [] };
}
// expected（期望断言）→ expected-frozen 形态：按 intentId 聚合。
function toExpectedContract(c) {
  const byIntent = new Map();
  for (const a of c.expected || []) {
    const { intentId, ...assertion } = a;
    if (!byIntent.has(intentId)) byIntent.set(intentId, []);
    byIntent.get(intentId).push(assertion);
  }
  return {
    caseId: 'tc_workflow_create_smoke', channel: 'web',
    intents: [...byIntent.entries()].map(([intentId, expected]) => ({ intentId, expected })),
    globalAssertions: c.globalAssertions || [],
  };
}

const fails = [];
let pass = 0;

for (const c of CASES) {
  let sut;
  try {
    sut = await startFakeSut({ scenario: c.scenario });
    const evFile = join(tmp, `${c.name}.events.json`);
    const expFile = join(tmp, `${c.name}.expected.json`);
    const profFile = join(tmp, `${c.name}.profile.json`);
    const axFile = join(tmp, `${c.name}.axes.json`);
    const vdFile = join(tmp, `${c.name}.verdict.json`);
    writeFileSync(evFile, JSON.stringify(resolveEvents(c)));
    writeFileSync(expFile, JSON.stringify(toExpectedContract(c)));
    // 通道剖面（非凭据）：背景 denylist + 错误信封成功字段/值（web/Heren = body.status===200）。site.json 凭据不进 hermetic。
    writeFileSync(profFile, JSON.stringify({ background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 }));

    // ① runner 真回放假 SUT 产 axes（实现前在此抛 → 红）
    execFileSync(process.execPath, [REPLAY, '--events', evFile, '--sut', sut.url, '--expected', expFile, '--profile', profFile, '--out', axFile], { stdio: 'pipe' });
    const axes = JSON.parse(readFileSync(axFile, 'utf8'));
    const anchorAx = (axes.steps || []).find((s) => s.intentId === c.anchor.intentId);
    if (!anchorAx) throw new Error(`axes 缺锚点 intent=${c.anchor.intentId} 的 StepAxes`);
    for (const k of ['action', 'postAssertions', 'forensics']) {
      if (!(k in anchorAx)) throw new Error(`StepAxes 缺三轴之一: ${k}`);
    }

    // ② drift/vanished 场景：漂移信号逐字对齐已冻 canonical（含 candidateCount，堵把信号硬编码成 present:true）
    if (c.wantDriftSignal) {
      const dp = anchorAx.action && anchorAx.action.driftProbe;
      const w = c.wantDriftSignal;
      if (!dp) throw new Error(`漂移场景缺 action.driftProbe：${c.name}`);
      if (dp.sameSignatureUniquePresent !== w.sameSignatureUniquePresent) throw new Error(`漂移 sameSignatureUniquePresent 不符：期望 ${w.sameSignatureUniquePresent}，实际 ${dp.sameSignatureUniquePresent}`);
      if ('candidateCount' in w && dp.candidateCount !== w.candidateCount) throw new Error(`漂移 candidateCount 不符：期望 ${w.candidateCount}，实际 ${dp.candidateCount}（堵硬编码）`);
      if (w.matchedSignature != null && dp.matchedSignature !== w.matchedSignature) throw new Error(`漂移 matchedSignature 不符已冻 canonical：期望 ${w.matchedSignature}，实际 ${dp.matchedSignature}`);
    }

    // ②b 取证轴关键归因硬断言：背景请求归 null、错误信封 ok/http status（命门，不只靠下游 verdict 间接暴露）
    if (c.wantForensics && Array.isArray(c.wantForensics.network)) {
      const allNet = (axes.steps || []).flatMap((s) => (s.forensics && s.forensics.network) || []);
      const anchorNet = (anchorAx.forensics && anchorAx.forensics.network) || [];
      for (const w of c.wantForensics.network) {
        const pool = w.atAnchor ? anchorNet : allNet;
        const rec = pool.find((n) => n && typeof n.url === 'string' && n.url.includes(w.urlIncludes));
        if (!rec) throw new Error(`取证轴缺 url 含「${w.urlIncludes}」的网络记录（${w.atAnchor ? '锚点步' : '全步'}）`);
        if ('attributedStepId' in w && rec.attributedStepId !== w.attributedStepId) throw new Error(`取证归因不符：${w.urlIncludes} 期望 attributedStepId=${w.attributedStepId}，实际 ${rec.attributedStepId}`);
        if ('httpStatus' in w && Number(rec.status) !== w.httpStatus) throw new Error(`取证 status 不符：${w.urlIncludes} 期望 ${w.httpStatus}，实际 ${rec.status}`);
        if ('envelopeOk' in w && !(rec.errorEnvelope && rec.errorEnvelope.ok === w.envelopeOk)) throw new Error(`错误信封 ok 不符：${w.urlIncludes} 期望 ${w.envelopeOk}，实际 ${rec.errorEnvelope && rec.errorEnvelope.ok}`);
      }
    }

    // ③ 喂已冻 verdict.mjs，断言锚点四态 = 所映射的冻结案
    execFileSync(process.execPath, [VERDICT, '--axes', axFile, '--out', vdFile], { stdio: 'pipe' });
    const verdict = JSON.parse(readFileSync(vdFile, 'utf8'));
    const anchorV = (verdict.steps || []).find((s) => s.intentId === c.anchor.intentId);
    if (!anchorV) throw new Error(`verdict 缺锚点 intent=${c.anchor.intentId}`);
    if (anchorV.verdict !== c.anchor.wantVerdict) throw new Error(`期望 verdict=${c.anchor.wantVerdict}（${c.groundedIn}），实际 ${anchorV.verdict}`);
    if (c.anchor.wantReason != null && anchorV.reason !== c.anchor.wantReason) throw new Error(`期望 reason=${c.anchor.wantReason}，实际 ${anchorV.reason}`);
    pass++;
  } catch (e) {
    fails.push(`case「${c.name}」(${c.groundedIn}): ${String(e.stderr || e.message).slice(-300)}`);
  } finally {
    if (sut) await sut.close();
  }
}

if (fails.length) {
  for (const f of fails) console.error(`RED  p5-replay: ${f}`);
  process.exit(1);
}
console.log(`ok   p5-replay: ${pass}/${CASES.length} 场景全中（裁定四态映射 verdict-cases、drift 复刻 drift-patch）`);
process.exit(0);
