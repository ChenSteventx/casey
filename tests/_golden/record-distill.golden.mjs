#!/usr/bin/env node
// record-distill.golden.mjs —— 示教蒸馏漂移锁（record-distill，full）红金牌。
//
// B2 改形（flow-bridge-golden-refit v5）：05573d1/edea1f9 收紧后真 record CLI 只产单文件 capture，
// 不再产完整三件套（capture + identity-observations.json 旁车 + teach-in-package.json 清单）；
// seamAccepted() 因此从「真 record --from-events --no-login → 真 intake」改形为
// 「租约固定根（acquireCanonicalCaseLease）+ 手造合法三件套（动态签 platform-identity-readback-receipt，
// support/ephemeral-driver-publication.mjs）→ 真 bin/intake.mjs（--experimental-loader）→
// 真 bin/distill.mjs（同 loader）」。三件套仍经生产安全构造闸产出（buildTeachInCapture →
// bindCaptureIdentityObservations，两者内部真调 reviewCapture）——手造的是「谁来产」（测试脚本 vs
// record CLI），不是「绕过闸」。
//
// 权威归列（三列账）以审计件为准，本文件逐 check 落其结论，不越权重判：
// docs/plans/flow-bridge-golden-refit/accept/b2-migration-table.md
//   保留 11：C1/C3/C5/C6/C2a/C2b/C2c/C4/C2g/C4f/C7（同一拒因字符串或结构上不受改形影响）。
//   迁移 3：C2d 改断 CAPTURE_URL_LEAK（新执法点 lib/teachin-identity-package-validator.mjs 的
//     reviewClosedIdentityObservationPackage，经 lib/teachin-observation-authority-root.mjs 的
//     readPackage 在 intake/distill 两侧统一调用）；C2f/C2h 改断 CRED_GATE_HIT（同一执法点），
//     另加一条直调该纯函数的红证 check（零 SUT、零 I/O）。
//   丢失 4（挂账 record-three-piece-producer，机器可做、非 route:human，接手条件见审计件 §3，
//     已入 loop/prd-record-distill.json，本文件不补测试）：
//     ① record producer 段真 CLI 产出三件套（bin/record.mjs 现只产单文件）
//     ② record→intake 字节接缝（capture 字节从真 record 原样直喂 intake）
//     ③ 旧单文件布局兼容（隐性成立→隐性作废，无显式负例）
//     ④ distill 内联本地编码门（bin/distill.mjs:130-135）的行为级覆盖（未导出、import 即跑 main，
//        生产零改前提下不可直调；接手条件=后续契约导出该 helper 或与 producer 契约一并处置）
//
// 锁：TOCTOU 硬门 / 零 LLM 全 pending 投影 / 采集忠实闸 / 降权不直通 / 输出卫生。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { reviewClosedIdentityObservationPackage } from '../../lib/teachin-identity-package-validator.mjs';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';
import { createEphemeralDriverPublication } from './support/ephemeral-driver-publication.mjs';

const ROOT = process.cwd();
const node = process.execPath;
const CLI = join(ROOT, 'bin', 'casey.mjs');
const INTAKE = join(ROOT, 'bin', 'intake.mjs');
const DISTILL = join(ROOT, 'bin', 'distill.mjs');

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readJson(f) { return JSON.parse(readFileSync(f, 'utf8')); }
function readLedger(p) { return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []; }
function hash(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
function emptyDir(d) { return !existsSync(d) || readdirSync(d).length === 0; }
function ddir(out, caseId) { return join(out, caseId, 'distill'); }

// 真三件套/真 CLI 都经生产验签路径；driverPub 提供临时 Ed25519 密钥 + 临时发布模块 + 隔离 loader
// （共用 support 件，三金牌同源）；scratch 只装 --out-dir / --mapping 之类非 cases/ 产物。
const driverPub = createEphemeralDriverPublication({});
const scratch = mkdtempSync(join(tmpdir(), 'casey-record-distill-'));

// 经生产 casey.mjs 薄壳转发（无 loader）——只用于纯用法/help/ingest/selftest 等不触达驱动验签的调用。
function runCli(args) { return spawnSync(node, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 30000 }); }
// 直调 bin/intake.mjs / bin/distill.mjs，带 --experimental-loader 挂临时发布模块（真验签路径）。
function run(script, args) {
  return spawnSync(node, ['--experimental-loader', driverPub.loaderPath, script, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000, env: { ...process.env },
  });
}

const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'b'.repeat(64)}`;
const CLEAN_EVENTS = {
  startUrl: '/heren/aimanagement/process/list?tab=mine',
  events: [
    { action: 'click', path: '/heren/aimanagement/process/list', selector: 'button.new', text: '新增工作流', tagName: 'button' },
    { action: 'fill', path: '/heren/aimanagement/process/edit', selector: 'input[name="name"]', fieldLabel: '名称', value: 'atl_demo' },
    { action: 'nav', path: '/heren/aimanagement/process/edit' },
    { action: 'press', path: '/heren/aimanagement/process/edit', key: 'Enter' },
  ],
};
const N = CLEAN_EVENTS.events.length;

function observation(overrides = {}) {
  return {
    kind: 'workflow', name: '新增工作流', code: 'wf-001', platformId: 'atl-platform-0001',
    scopeFingerprint: SCOPE, parent: null, evidenceKind: 'detail-dual-anchor-readback', eventSeq: 1,
    evidenceSha256: EVIDENCE, ...overrides,
  };
}

// 手造合法三件套：capture 经生产安全构造闸产出（buildTeachInCapture → bindCaptureIdentityObservations，
// 两者内部真调 reviewCapture）——只换了「谁来产」，不绕闸。
function bundle({ caseId, events = CLEAN_EVENTS.events, startUrl = CLEAN_EVENTS.startUrl, observations = [observation()] }) {
  const sidecarDoc = identityApi.buildIdentityObservationSidecar({ caseId, observations });
  const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecarDoc);
  const capture = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({ caseId, startUrl, createdAt: '2026-01-01T00:00:00.000Z', events }),
    observationRaw: sidecarRaw,
  });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId, captureBytes: captureRaw, sidecarBytes: sidecarRaw,
    observationCount: sidecarDoc.observations.length, observationSchemaVersion: sidecarDoc.schemaVersion,
  });
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  return {
    captureRaw, sidecarRaw, manifestRaw, sidecarDoc,
    captureSha256: hash(captureRaw), sidecarSha256: hash(sidecarRaw), manifestSha256: hash(manifestRaw),
  };
}

function signReceiptFor(built, { caseId, sessionNonce }) {
  const obs = built.sidecarDoc.observations[0];
  return driverPub.signReceipt({
    schemaVersion: 1,
    artifactKind: 'platform-identity-readback-receipt',
    source: 'platform-runtime',
    keyId: driverPub.keyId,
    algorithm: 'Ed25519',
    sessionNonce,
    caseId,
    captureSha256: built.captureSha256,
    sidecarSha256: built.sidecarSha256,
    manifestSha256: built.manifestSha256,
    eventSeq: obs.eventSeq,
    kind: obs.kind,
    name: obs.name,
    code: obs.code,
    platformId: obs.platformId,
    scopeFingerprint: obs.scopeFingerprint,
    evidenceSha256: obs.evidenceSha256,
  });
}

// 写三件套（+ 可选签名 receipt）进租约固定根；withReceipt:false 用于 C2d/C2h——读包闸在信签之前
// 已拒（readPackage 先于 rehydrate 的 receipt 校验），造签是浪费。
function writePackage(lease, built, { sessionNonce = `${lease.caseId}-session`, withReceipt = true } = {}) {
  mkdirSync(lease.packageDir, { recursive: true });
  const capturePath = join(lease.packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, built.captureRaw);
  writeFileSync(join(lease.packageDir, 'identity-observations.json'), built.sidecarRaw);
  writeFileSync(join(lease.packageDir, 'teach-in-package.json'), built.manifestRaw);
  if (withReceipt) {
    const receipt = signReceiptFor(built, { caseId: lease.caseId, sessionNonce });
    writeFileSync(join(lease.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  return capturePath;
}

try {
  // ── C1 门面 + 用法错 ──
  check('C1 门面+用法错', () => {
    const helpSrc = readFileSync(CLI, 'utf8');
    assert(helpSrc.includes('casey distill'), 'C1a help 须暴露 casey distill');
    assert(!runCli(['help']).stdout.includes('--sut <url>'), 'C1g help 输出无过时 --sut <url> 黑名单形态');
    assert(runCli(['distill']).status === 64, 'C1b 缺 caseId 须 exit 64');
    const lease = acquireCanonicalCaseLease({ caseId: 'tc_d_usage' });
    try {
      const cap = writePackage(lease, bundle({ caseId: 'tc_d_usage' }));
      const ik = run(INTAKE, ['tc_d_usage', '--capture', cap]);
      assert(ik.status === 0, `C1 前置 intake 应 exit 0 stderr=${ik.stderr}`);
      assert(runCli(['distill', 'tc_d_usage']).status === 64, 'C1c 缺 --capture 须 exit 64');
      assert(runCli(['distill', 'tc_d_usage', '--capture', cap]).status === 64, 'C1c 缺 --out-dir 须 exit 64');
      assert(runCli(['distill', 'tc_d_usage', '--capture', '--out-dir', join(scratch, 'o')]).status === 64, 'C1d 裸 --capture 须 exit 64');
      assert(runCli(['distill', '../../escape', '--capture', cap, '--out-dir', join(scratch, 'o')]).status === 65, 'C1e caseId 穿越须 exit 65');
      assert(runCli(['distill', 'a/b', '--capture', cap, '--out-dir', join(scratch, 'o')]).status === 65, 'C1e caseId 斜杠须 exit 65');
      assert(runCli(['distill', 'tc_token_x', '--capture', cap, '--out-dir', join(scratch, 'o')]).status === 65, 'C1f caseId 凭据关键词须 exit 65');
    } finally {
      const cleaned = lease.cleanup();
      if (!cleaned.ok) failures.push(`lease cleanup（tc_d_usage）拒绝: ${cleaned.reason}`);
    }
  });

  // ── C3 happy 投影 / C5 降权硬不变量 / C6 输出卫生 / C4 采集忠实闸（共用 tc_d_ok 一次 accept）──
  {
    let okLease;
    try { okLease = acquireCanonicalCaseLease({ caseId: 'tc_d_ok' }); }
    catch (error) { failures.push(`tc_d_ok lease 获取失败: ${error.message}`); }
    if (okLease) {
      try {
        const built = bundle({ caseId: 'tc_d_ok' });
        const capturePath = writePackage(okLease, built);
        const ik = run(INTAKE, ['tc_d_ok', '--capture', capturePath]);
        if (ik.status !== 0) {
          failures.push(`tc_d_ok 前置 intake 应 exit 0 stderr=${ik.stderr}`);
        } else {
          const acceptedSha = readLedger(join(okLease.packageDir, 'intake-ledger.jsonl')).find((e) => e.intakeStatus === 'accepted').captureSha256;
          let tc, map, man, tcPath, mapPath, manPath, distillOut, happyRun;

          check('C3 happy 投影', () => {
            distillOut = join(scratch, 'distillout');
            happyRun = run(DISTILL, ['tc_d_ok', '--capture', capturePath, '--out-dir', distillOut]);
            assert(happyRun.status === 0, `C3 happy distill 应 exit 0，stderr=${happyRun.stderr}`);
            const dd = ddir(distillOut, 'tc_d_ok');
            const files = readdirSync(dd).sort();
            assert(files.length === 3, `C3a 恰产三候选，实得 ${JSON.stringify(files)}`);
            tcPath = join(dd, 'distill-candidate-testcase-tc_d_ok.json');
            mapPath = join(dd, 'distill-candidate-mapping-tc_d_ok.json');
            manPath = join(dd, 'distill-manifest-tc_d_ok.json');
            assert(existsSync(tcPath) && existsSync(mapPath) && existsSync(manPath), 'C3a 三候选定名齐');
            assert(!files.includes('events.json') && !files.includes('expected.frozen.json'), 'C3a 不产正式回放产物');
            tc = readJson(tcPath); map = readJson(mapPath); man = readJson(manPath);
            assert(tc.schemaVersion === 1 && tc.caseId === 'tc_d_ok' && tc.source && tc.source.kind === 'json' && tc.uniquePrefix === 'atl_', 'C3b 候选 TestCase 骨架形态');
            assert(Array.isArray(tc.steps) && tc.steps.length === N, `C3b 1:1 步数 ${N}`);
            assert(tc.steps.every((s, i) => s.intentId === 'i' + (i + 1)), 'C3b intentId=i+seq');
            assert(!('expected' in tc) && !('target' in tc), 'C3b 候选无 expected/target');
            assert(tc.steps[0].actionHint === 'click' && tc.steps[1].actionHint === 'fill' && tc.steps[2].actionHint === 'navigate', 'C3c actionHint 忠实映射 click/fill/nav');
            assert(!('actionHint' in tc.steps[3]), 'C3c press 步无 actionHint（不臆造）');
            assert(Array.isArray(map) && map.length === 0, 'C3d v1 候选 mapping 为空数组');
            assert(tc.steps.every((s) => s.route === 'human' && typeof s.reason === 'string' && s.reason), 'C3d 每步 route:human + 非空 reason');
            assert(Array.isArray(man.pending) && man.pending.length === N, 'C3d manifest pending 全覆盖');
            assert(man.pending.every((p) => p.intentId && Number.isInteger(p.eventSeq) && typeof p.reason === 'string'), 'C3d pending 条目形态');
            const pendIds = new Set(man.pending.map((p) => p.intentId));
            const humanIds = new Set(tc.steps.filter((s) => s.route === 'human').map((s) => s.intentId));
            assert(pendIds.size === humanIds.size && [...pendIds].every((x) => humanIds.has(x)), 'C3d pending intentId 集 == route:human 步集');
            assert(man.artifactKind === 'distill-candidate' && man.captureSha256 === acceptedSha && man.captureSha256 === built.captureSha256, 'C3f manifest artifactKind + sha 三方一致');
            assert(Array.isArray(man.projection) && man.projection.length === N, 'C3f projection 全覆盖');
            assert(man.projection.every((p) => p.intentId && typeof p.pathHint === 'string' && p.pathHint.startsWith('/') && !p.pathHint.includes('://')), 'C3f projection pathHint 相对无 ://');
            const ig = runCli(['ingest', 'tc_d_ok', '--in', tcPath, '--out-dir', join(scratch, 'ingestout')]);
            assert(ig.status === 0, `C3e 候选须真过 ingest（parseTestCase），stderr=${ig.stderr}`);
            const distillOut2 = join(scratch, 'distillout2');
            const d2 = run(DISTILL, ['tc_d_ok', '--capture', capturePath, '--out-dir', distillOut2]);
            assert(d2.status === 0, 'C3g 第二次 distill exit 0');
            assert(readFileSync(join(ddir(distillOut2, 'tc_d_ok'), 'distill-candidate-testcase-tc_d_ok.json'), 'utf8') === readFileSync(tcPath, 'utf8'), 'C3g 候选 TestCase 两次字节一致');
          });

          check('C5 降权硬不变量', () => {
            const allText = readFileSync(tcPath, 'utf8') + readFileSync(mapPath, 'utf8') + readFileSync(manPath, 'utf8');
            assert(!/"signed"\s*:\s*true/.test(allText) && !/"replayReady"\s*:\s*true/.test(allText), 'C5a 候选无 signed/replayReady true');
            assert(Array.isArray(map), 'C5b 候选 mapping 是裸数组（flow-bridge 形态）');
            assert(typeof man.note === 'string' && man.note, 'C5c manifest 降权 note 在场');
            const srcKeys = Object.keys(tc.source).sort().join(',');
            assert(!('signed' in tc.source) && !('replayReady' in tc.source), `C5d 候选 source 无 signed/replayReady（实得键 ${srcKeys}）`);
          });

          check('C6 输出卫生', () => {
            const allText = readFileSync(tcPath, 'utf8') + readFileSync(mapPath, 'utf8') + readFileSync(manPath, 'utf8');
            assert(!allText.includes('://'), 'C6a 候选全文无 ://');
            assert(!happyRun.stdout.includes(distillOut), 'C6b 成功 stdout 不含 out-dir 绝对路径');
          });

          check('C4 采集忠实闸', () => {
            const emptyMap = join(scratch, 'map-empty.json'); writeFileSync(emptyMap, '[]');
            const ok = run(DISTILL, ['tc_d_ok', '--capture', capturePath, '--out-dir', distillOut, '--verify', '--mapping', emptyMap]);
            assert(ok.status === 0, `C4c 忠实 mapping 应 exit 0，stderr=${ok.stderr}`);
            const ghostMap = join(scratch, 'map-ghost.json'); writeFileSync(ghostMap, JSON.stringify([{ intentId: 'i999', atom: 'workflow.save' }]));
            const bad = run(DISTILL, ['tc_d_ok', '--capture', capturePath, '--out-dir', distillOut, '--verify', '--mapping', ghostMap]);
            assert(bad.status === 65, `C4a 凭空 atom 须 exit 65，实得 ${bad.status}`);
            const badShape = join(scratch, 'map-badshape.json'); writeFileSync(badShape, '{"not":"array"}');
            const bs = run(DISTILL, ['tc_d_ok', '--capture', capturePath, '--out-dir', distillOut, '--verify', '--mapping', badShape]);
            assert(bs.status === 65, `C4d 畸形 mapping 须 fail-closed exit 65，实得 ${bs.status}`);
          });
        }
      } finally {
        const cleaned = okLease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_d_ok）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C2a NOT_INTAKEN（合法三件套 + 合法签名 receipt 齐备，但刻意跳过 intake）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_noik' }); }
    catch (error) { failures.push(`tc_noik lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C2a NOT_INTAKEN（跳过 intake）', () => {
          const built = bundle({ caseId: 'tc_noik' });
          const capturePath = writePackage(lease, built, { sessionNonce: 'tc_noik-session' });
          const r = run(DISTILL, ['tc_noik', '--capture', capturePath, '--out-dir', join(scratch, 'o-noik')]);
          assert(r.status === 65, `C2a 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
          assert(/NOT_INTAKEN/.test(r.stderr), `C2a 须精确命中 NOT_INTAKEN 拒因，实得 stderr=${r.stderr}`);
          assert(emptyDir(ddir(join(scratch, 'o-noik'), 'tc_noik')), 'C2a 零候选落盘');
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_noik）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C2b CAPTURE_SWAPPED（intake 后整体换成另一份内部自洽的合法包，ledger 仍指旧包）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_swap' }); }
    catch (error) { failures.push(`tc_swap lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C2b CAPTURE_SWAPPED', () => {
          const built1 = bundle({ caseId: 'tc_swap' });
          const capturePath = writePackage(lease, built1, { sessionNonce: 'tc_swap-session-1' });
          const ik = run(INTAKE, ['tc_swap', '--capture', capturePath]);
          assert(ik.status === 0, `C2b 前置 intake 应 exit 0，stderr=${ik.stderr}`);
          // 换一份内容不同、但自身内部自洽（自签 receipt 精确匹配新哈希）的合法三件套，
          // ledger 不动——TOCTOU：ledger 仍指旧 captureSha256，权威根须据此拒绝，绝不信
          // 「当前包结构自洽」。
          const built2 = bundle({
            caseId: 'tc_swap',
            events: [...CLEAN_EVENTS.events.slice(0, 3), { action: 'press', path: '/heren/aimanagement/process/edit', key: 'Escape' }],
          });
          writePackage(lease, built2, { sessionNonce: 'tc_swap-session-2' });
          const r = run(DISTILL, ['tc_swap', '--capture', capturePath, '--out-dir', join(scratch, 'o-swap')]);
          assert(r.status === 65, `C2b 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
          assert(/CAPTURE_SWAPPED/.test(r.stderr), `C2b 须精确命中 CAPTURE_SWAPPED 拒因，实得 stderr=${r.stderr}`);
          assert(emptyDir(ddir(join(scratch, 'o-swap'), 'tc_swap')), 'C2b 零候选落盘');
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_swap）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C2c 软链拒（capture 文件是符号链接，预读守卫先于任何 package/authority 逻辑，不受改形影响，无需 cases/ 租约）──
  check('C2c 软链拒', () => {
    const realCap = join(scratch, 'c2c-real', 'teach-in-capture.json');
    mkdirSync(dirname(realCap), { recursive: true });
    writeFileSync(realCap, bundle({ caseId: 'tc_dlink_src' }).captureRaw);
    const cd = join(scratch, 'tc_dlink', 'record-capture');
    mkdirSync(cd, { recursive: true });
    symlinkSync(realCap, join(cd, 'teach-in-capture.json'));
    const r = run(DISTILL, ['tc_dlink', '--capture', join(cd, 'teach-in-capture.json'), '--out-dir', join(scratch, 'o-link')]);
    assert(r.status === 65, `C2c 软链 capture 须 exit 65，实得 ${r.status}`);
  });

  // ── C2d 迁移：authority 闭合包路径的实测精确拒因 CAPTURE_URL_LEAK
  //     （accept/b2-migration-table.md §2 静态预核，本 check 即该预核的实测定谳；见文末实录）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_urlleak' }); }
    catch (error) { failures.push(`tc_urlleak lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C2d authority 闭合包路径精确拒因 CAPTURE_URL_LEAK（迁移）', () => {
          // 手造（绕开 bindCaptureIdentityObservations——它自身会先 reviewCapture 拒同一个坏
          // startPath，没法用它构造出「闭合包已建成、内容仍须拒」的场景，故直拼最终字节）。
          const sidecarDoc = identityApi.buildIdentityObservationSidecar({ caseId: 'tc_urlleak', observations: [] });
          const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecarDoc);
          const badCapture = {
            schemaVersion: 2, artifactKind: 'teach-in-capture', caseId: 'tc_urlleak',
            createdAt: '2026-01-01T00:00:00.000Z', startPath: 'https://victim-host.example.com/x',
            source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
            events: [{ seq: 1, action: 'click', path: '/x' }],
            identityObservations: { fileName: 'identity-observations.json', sha256: hash(sidecarRaw), count: 0 },
          };
          const captureRaw = `${JSON.stringify(badCapture, null, 2)}\n`;
          const manifest = packageApi.buildTeachInPackageManifest({
            caseId: 'tc_urlleak', captureBytes: captureRaw, sidecarBytes: sidecarRaw,
            observationCount: 0, observationSchemaVersion: 1,
          });
          const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
          mkdirSync(lease.packageDir, { recursive: true });
          const capturePath = join(lease.packageDir, 'teach-in-capture.json');
          writeFileSync(capturePath, captureRaw);
          writeFileSync(join(lease.packageDir, 'identity-observations.json'), sidecarRaw);
          writeFileSync(join(lease.packageDir, 'teach-in-package.json'), manifestRaw);
          // 无需 receipt/无需 intake：readPackage 内 CAPTURE_URL_LEAK 早于两者触发。
          const r = run(DISTILL, ['tc_urlleak', '--capture', capturePath, '--out-dir', join(scratch, 'o-urlleak')]);
          assert(r.status === 65, `C2d 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
          assert(/CAPTURE_URL_LEAK/.test(r.stderr), `C2d 须精确命中 CAPTURE_URL_LEAK（实测定谳），实得 stderr=${r.stderr}`);
          assert(emptyDir(ddir(join(scratch, 'o-urlleak'), 'tc_urlleak')), 'C2d 零候选落盘');
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_urlleak）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C2f 迁移：编码凭据穿输出门 PoC，现断精确 CRED_GATE_HIT（同一新执法点）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_enc' }); }
    catch (error) { failures.push(`tc_enc lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C2f 编码凭据穿输出门 PoC：CRED_GATE_HIT（迁移）', () => {
          const built = bundle({
            caseId: 'tc_enc',
            events: [{ action: 'click', path: '/x', text: '%70%61%73%73%77%6f%72%64%3d%73%65%63%72%65%74' }],
          });
          const capturePath = writePackage(lease, built, { withReceipt: false });
          const r = run(DISTILL, ['tc_enc', '--capture', capturePath, '--out-dir', join(scratch, 'o-enc')]);
          assert(r.status === 65, `C2f 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
          assert(/CRED_GATE_HIT/.test(r.stderr), `C2f 须精确命中 CRED_GATE_HIT，实得 stderr=${r.stderr}`);
          assert(emptyDir(ddir(join(scratch, 'o-enc'), 'tc_enc')), 'C2f 零候选落盘');
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_enc）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C2h 迁移：超深(21 层)编码凭据不收敛，现断精确 CRED_GATE_HIT（!decoded.converged 同门）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_deep' }); }
    catch (error) { failures.push(`tc_deep lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C2h 超深编码凭据不收敛：CRED_GATE_HIT fail-closed（迁移）', () => {
          const encChar = (s) => [...s].map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
          let deep = encChar('password=secret');
          for (let i = 0; i < 20; i++) deep = deep.replace(/%/g, '%25'); // 21 层
          // 手造（同 C2d 理由：不收敛的 event.text 会先被 bindCaptureIdentityObservations 内部
          // reviewCapture 的 hasUrlLeak(!converged⇒true) 判 DIRTY_EVENT 拒在构造期，没法借它产出
          // 「闭合包已建成、仍须在 CRED_GATE_HIT 拒」的场景）。
          const sidecarDoc = identityApi.buildIdentityObservationSidecar({ caseId: 'tc_deep', observations: [] });
          const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecarDoc);
          const deepCapture = {
            schemaVersion: 2, artifactKind: 'teach-in-capture', caseId: 'tc_deep',
            createdAt: '2026-01-01T00:00:00.000Z', startPath: '/x',
            source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
            events: [{ seq: 1, action: 'click', path: '/x', text: deep }],
            identityObservations: { fileName: 'identity-observations.json', sha256: hash(sidecarRaw), count: 0 },
          };
          const captureRaw = `${JSON.stringify(deepCapture, null, 2)}\n`;
          const manifest = packageApi.buildTeachInPackageManifest({
            caseId: 'tc_deep', captureBytes: captureRaw, sidecarBytes: sidecarRaw,
            observationCount: 0, observationSchemaVersion: 1,
          });
          const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
          mkdirSync(lease.packageDir, { recursive: true });
          const capturePath = join(lease.packageDir, 'teach-in-capture.json');
          writeFileSync(capturePath, captureRaw);
          writeFileSync(join(lease.packageDir, 'identity-observations.json'), sidecarRaw);
          writeFileSync(join(lease.packageDir, 'teach-in-package.json'), manifestRaw);
          const r = run(DISTILL, ['tc_deep', '--capture', capturePath, '--out-dir', join(scratch, 'o-deep')]);
          assert(r.status === 65, `C2h 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
          assert(/CRED_GATE_HIT/.test(r.stderr), `C2h 须精确命中 CRED_GATE_HIT，实得 stderr=${r.stderr}`);
          assert(emptyDir(ddir(join(scratch, 'o-deep'), 'tc_deep')), 'C2h 零候选落盘');
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_deep）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C2g 写盘错误捕获（第二产物路径被目录占位）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_wfail' }); }
    catch (error) { failures.push(`tc_wfail lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C2g 写盘错误捕获', () => {
          const built = bundle({ caseId: 'tc_wfail' });
          const capturePath = writePackage(lease, built);
          const ik = run(INTAKE, ['tc_wfail', '--capture', capturePath]);
          assert(ik.status === 0, `C2g 前置 intake 应 exit 0，stderr=${ik.stderr}`);
          const wout = join(scratch, 'o-wfail');
          mkdirSync(join(wout, 'tc_wfail', 'distill', 'distill-candidate-mapping-tc_wfail.json'), { recursive: true });
          const r = run(DISTILL, ['tc_wfail', '--capture', capturePath, '--out-dir', wout]);
          assert(r.status === 1, `C2g 写盘失败须 exit 1，实得 ${r.status}`);
          assert(!r.stderr.includes(wout), 'C2g stderr 不回显 out-dir 绝对路径');
          const dfiles = existsSync(ddir(wout, 'tc_wfail')) ? readdirSync(ddir(wout, 'tc_wfail')) : [];
          assert(!dfiles.includes('distill-candidate-testcase-tc_wfail.json'), 'C2g 无半份候选（testcase 不残留）');
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_wfail）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C4f --verify 复用 capture 硬门（篡改后须重跑 TOCTOU，不信旧 manifest）──
  {
    let lease;
    try { lease = acquireCanonicalCaseLease({ caseId: 'tc_vswap' }); }
    catch (error) { failures.push(`tc_vswap lease 获取失败: ${error.message}`); }
    if (lease) {
      try {
        check('C4f --verify 复用 capture 硬门', () => {
          const built = bundle({ caseId: 'tc_vswap' });
          const capturePath = writePackage(lease, built);
          const ik = run(INTAKE, ['tc_vswap', '--capture', capturePath]);
          assert(ik.status === 0, `C4f 前置 intake 应 exit 0，stderr=${ik.stderr}`);
          const vout = join(scratch, 'o-vswap');
          assert(run(DISTILL, ['tc_vswap', '--capture', capturePath, '--out-dir', vout]).status === 0, 'C4f 前置 distill exit 0');
          const em = join(scratch, 'map-vswap.json'); writeFileSync(em, '[]');
          assert(run(DISTILL, ['tc_vswap', '--capture', capturePath, '--out-dir', vout, '--verify', '--mapping', em]).status === 0, 'C4f 干净 --verify exit 0');
          const doc = readJson(capturePath); doc.events[0].text = '篡改'; writeFileSync(capturePath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
          const r = run(DISTILL, ['tc_vswap', '--capture', capturePath, '--out-dir', vout, '--verify', '--mapping', em]);
          assert(r.status === 65, `C4f 篡改后 --verify 须 exit 65（复用 TOCTOU 硬门，不信旧 manifest），实得 ${r.status}（stderr=${r.stderr}）`);
        });
      } finally {
        const cleaned = lease.cleanup();
        if (!cleaned.ok) failures.push(`lease cleanup（tc_vswap）拒绝: ${cleaned.reason}`);
      }
    }
  }

  // ── C7 门面回归 ──
  check('C7 门面回归', () => {
    assert(runCli(['selftest', '--tier1']).status === 0, 'C7 selftest --tier1 无回归');
  });

  // ── 直调纯函数红证：复核 C2f/C2h 同一新执法点（零 SUT、零 I/O）──
  check('直调 reviewClosedIdentityObservationPackage 红证：编码凭据/不收敛输入判 CRED_GATE_HIT', () => {
    const caseId = 'tc_validator_direct_probe';
    const sidecarDoc = identityApi.buildIdentityObservationSidecar({ caseId, observations: [] });
    const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecarDoc);

    const encCaptureRaw = JSON.stringify({
      schemaVersion: 2, artifactKind: 'teach-in-capture', caseId,
      createdAt: '2026-01-01T00:00:00.000Z', startPath: '/x',
      source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
      events: [{ seq: 1, action: 'click', path: '/x', text: '%70%61%73%73%77%6f%72%64%3d%73%65%63%72%65%74' }],
      identityObservations: { fileName: 'identity-observations.json', sha256: hash(sidecarRaw), count: 0 },
    });
    const encReview = reviewClosedIdentityObservationPackage({ caseId, captureRaw: encCaptureRaw, observationRaw: sidecarRaw });
    assert(encReview.ok === false && encReview.reason === 'CRED_GATE_HIT', `编码凭据输入须判 {ok:false,reason:'CRED_GATE_HIT'}，实得 ${JSON.stringify(encReview)}`);

    const encChar = (s) => [...s].map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    let deep = encChar('password=secret');
    for (let i = 0; i < 20; i++) deep = deep.replace(/%/g, '%25');
    const deepCaptureRaw = JSON.stringify({
      schemaVersion: 2, artifactKind: 'teach-in-capture', caseId,
      createdAt: '2026-01-01T00:00:00.000Z', startPath: '/x',
      source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
      events: [{ seq: 1, action: 'click', path: '/x', text: deep }],
      identityObservations: { fileName: 'identity-observations.json', sha256: hash(sidecarRaw), count: 0 },
    });
    const deepReview = reviewClosedIdentityObservationPackage({ caseId, captureRaw: deepCaptureRaw, observationRaw: sidecarRaw });
    assert(deepReview.ok === false && deepReview.reason === 'CRED_GATE_HIT', `不收敛输入须判 {ok:false,reason:'CRED_GATE_HIT'}，实得 ${JSON.stringify(deepReview)}`);
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
  const cleaned = driverPub.cleanup();
  if (!cleaned.ok) failures.push(`ephemeral driver publication cleanup 拒绝: ${cleaned.reason || 'unknown'}`);
}

if (failures.length) {
  console.error(`\nrecord-distill golden: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nrecord-distill golden: ${passed} passed, GREEN`);
process.exit(0);
