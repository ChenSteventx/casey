#!/usr/bin/env node
// record-distill.golden.mjs —— 示教蒸馏漂移锁（record-distill，full）红金牌。
// 复现真接缝（memory「别倒着裁夹具、复现已冻接缝」）：真 record --from-events --no-login → 真 intake accept → distill。
// 对抗输入（换包/软链/脏 mapping/跳 intake）在真接缝上做最小扰动。C2d/C2e 允许手造台账+包以复现「哈希对但仍须拒」
// 的 TOCTOU 边角（非倒裁 distill 结论）。锁：TOCTOU 硬门 / 零 LLM 全 pending 投影 / 采集忠实闸 / 降权不直通 / 输出卫生。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const node = process.execPath;
const cli = join(ROOT, 'bin', 'casey.mjs');
function run(args) { return spawnSync(node, [cli, ...args], { cwd: ROOT, encoding: 'utf8' }); }
function fail(m) { console.error(`record-distill golden failed: ${m}`); process.exit(1); }
function assert(c, m) { if (!c) fail(m); }
function readJson(f) { return JSON.parse(readFileSync(f, 'utf8')); }
function readLedger(p) { return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []; }
function sha256(f) { return createHash('sha256').update(readFileSync(f, 'utf8')).digest('hex'); }

const CLEAN_EVENTS = {
  startUrl: 'http://127.0.0.1:15519/heren/aimanagement/process/list?tab=mine',
  events: [
    { action: 'click', url: 'http://127.0.0.1:15519/heren/aimanagement/process/list', selector: 'button.new', text: '新增工作流', tagName: 'button' },
    { action: 'fill', url: 'http://127.0.0.1:15519/heren/aimanagement/process/edit', selector: 'input[name="name"]', fieldLabel: '名称', value: 'atl_demo' },
    { action: 'nav', path: '/heren/aimanagement/process/edit' },
    { action: 'press', path: '/heren/aimanagement/process/edit', key: 'Enter' },
  ],
};
const N = CLEAN_EVENTS.events.length;

// 真接缝：record --from-events → intake accept → 返回 capturePath。
function seamAccepted(tmp, caseId) {
  const capOut = join(tmp, `cap-${caseId}`);
  const ev = join(tmp, `ev-${caseId}.json`);
  writeFileSync(ev, JSON.stringify(CLEAN_EVENTS), 'utf8');
  const rec = run(['record', caseId, '--sut', 'http://127.0.0.1:15519', '--out-dir', capOut, '--no-login', '--from-events', ev]);
  assert(rec.status === 0, `前置 record 应 exit 0（${caseId}）stderr=${rec.stderr}`);
  const cap = join(capOut, caseId, 'record-capture', 'teach-in-capture.json');
  assert(existsSync(cap), `record 须产 capture（${caseId}）`);
  const ik = run(['intake', caseId, '--capture', cap]);
  assert(ik.status === 0, `前置 intake 应 exit 0（${caseId}）stderr=${ik.stderr}`);
  return cap;
}
const ddir = (out, caseId) => join(out, caseId, 'distill');
const emptyDir = (d) => !existsSync(d) || readdirSync(d).length === 0;

const tmp = mkdtempSync(join(tmpdir(), 'casey-record-distill-'));
try {
  // ── C1 门面 + 用法错 ──
  const helpSrc = readFileSync(cli, 'utf8');
  assert(helpSrc.includes('casey distill'), 'C1a help 须暴露 casey distill');
  assert(!run(['help']).stdout.includes('--sut <url>'), 'C1g help 输出无过时 --sut <url> 黑名单形态');
  assert(run(['distill']).status === 64, 'C1b 缺 caseId 须 exit 64');
  {
    const cap = seamAccepted(tmp, 'tc_d_usage');
    assert(run(['distill', 'tc_d_usage']).status === 64, 'C1c 缺 --capture 须 exit 64');
    assert(run(['distill', 'tc_d_usage', '--capture', cap]).status === 64, 'C1c 缺 --out-dir 须 exit 64');
    assert(run(['distill', 'tc_d_usage', '--capture', '--out-dir', join(tmp, 'o')]).status === 64, 'C1d 裸 --capture 须 exit 64');
    assert(run(['distill', '../../escape', '--capture', cap, '--out-dir', join(tmp, 'o')]).status === 65, 'C1e caseId 穿越须 exit 65');
    assert(run(['distill', 'a/b', '--capture', cap, '--out-dir', join(tmp, 'o')]).status === 65, 'C1e caseId 斜杠须 exit 65');
    assert(run(['distill', 'tc_token_x', '--capture', cap, '--out-dir', join(tmp, 'o')]).status === 65, 'C1f caseId 凭据关键词须 exit 65');
  }

  // ── C3 happy 投影（真接缝，后续 C4/C5/C6 复用其候选）──
  const distillOut = join(tmp, 'distillout');
  const okCap = seamAccepted(tmp, 'tc_d_ok');
  const acceptedSha = readLedger(join(dirname(okCap), 'intake-ledger.jsonl')).find((e) => e.intakeStatus === 'accepted').captureSha256;
  const d = run(['distill', 'tc_d_ok', '--capture', okCap, '--out-dir', distillOut]);
  assert(d.status === 0, `C3 happy distill 应 exit 0，stderr=${d.stderr}`);
  const dd = ddir(distillOut, 'tc_d_ok');
  const files = readdirSync(dd).sort();
  assert(files.length === 3, `C3a 恰产三候选，实得 ${JSON.stringify(files)}`);
  const tcPath = join(dd, 'distill-candidate-testcase-tc_d_ok.json');
  const mapPath = join(dd, 'distill-candidate-mapping-tc_d_ok.json');
  const manPath = join(dd, 'distill-manifest-tc_d_ok.json');
  assert(existsSync(tcPath) && existsSync(mapPath) && existsSync(manPath), 'C3a 三候选定名齐');
  assert(!files.includes('events.json') && !files.includes('expected.frozen.json'), 'C3a 不产正式回放产物');
  const tc = readJson(tcPath), map = readJson(mapPath), man = readJson(manPath);
  // C3b 骨架
  assert(tc.schemaVersion === 1 && tc.caseId === 'tc_d_ok' && tc.source && tc.source.kind === 'json' && tc.uniquePrefix === 'atl_', 'C3b 候选 TestCase 骨架形态');
  assert(Array.isArray(tc.steps) && tc.steps.length === N, `C3b 1:1 步数 ${N}`);
  assert(tc.steps.every((s, i) => s.intentId === 'i' + (i + 1)), 'C3b intentId=i+seq');
  assert(!('expected' in tc) && !('target' in tc), 'C3b 候选无 expected/target');
  // C3c actionHint 忠实
  assert(tc.steps[0].actionHint === 'click' && tc.steps[1].actionHint === 'fill' && tc.steps[2].actionHint === 'navigate', 'C3c actionHint 忠实映射 click/fill/nav');
  assert(!('actionHint' in tc.steps[3]), 'C3c press 步无 actionHint（不臆造）');
  // C3d pending 全 route:human
  assert(Array.isArray(map) && map.length === 0, 'C3d v1 候选 mapping 为空数组');
  assert(tc.steps.every((s) => s.route === 'human' && typeof s.reason === 'string' && s.reason), 'C3d 每步 route:human + 非空 reason');
  assert(Array.isArray(man.pending) && man.pending.length === N, 'C3d manifest pending 全覆盖');
  assert(man.pending.every((p) => p.intentId && Number.isInteger(p.eventSeq) && typeof p.reason === 'string'), 'C3d pending 条目形态');
  const pendIds = new Set(man.pending.map((p) => p.intentId));
  const humanIds = new Set(tc.steps.filter((s) => s.route === 'human').map((s) => s.intentId));
  assert(pendIds.size === humanIds.size && [...pendIds].every((x) => humanIds.has(x)), 'C3d pending intentId 集 == route:human 步集');
  // C3f manifest 溯源
  assert(man.artifactKind === 'distill-candidate' && man.captureSha256 === acceptedSha && man.captureSha256 === sha256(okCap), 'C3f manifest artifactKind + sha 三方一致');
  assert(Array.isArray(man.projection) && man.projection.length === N, 'C3f projection 全覆盖');
  assert(man.projection.every((p) => p.intentId && typeof p.pathHint === 'string' && p.pathHint.startsWith('/') && !p.pathHint.includes('://')), 'C3f projection pathHint 相对无 ://');
  // C3e 候选真被 ingest 收下（重走链贯通硬证）
  const ig = run(['ingest', 'tc_d_ok', '--in', tcPath, '--out-dir', join(tmp, 'ingestout')]);
  assert(ig.status === 0, `C3e 候选须真过 ingest（parseTestCase），stderr=${ig.stderr}`);
  // C3g 确定性可复现（两次候选 TestCase 字节一致）
  const d2 = run(['distill', 'tc_d_ok', '--capture', okCap, '--out-dir', join(tmp, 'distillout2')]);
  assert(d2.status === 0, 'C3g 第二次 distill exit 0');
  assert(readFileSync(join(ddir(join(tmp, 'distillout2'), 'tc_d_ok'), 'distill-candidate-testcase-tc_d_ok.json'), 'utf8') === readFileSync(tcPath, 'utf8'), 'C3g 候选 TestCase 两次字节一致');

  // ── C5 降权硬不变量 ──
  const allText = readFileSync(tcPath, 'utf8') + readFileSync(mapPath, 'utf8') + readFileSync(manPath, 'utf8');
  assert(!/"signed"\s*:\s*true/.test(allText) && !/"replayReady"\s*:\s*true/.test(allText), 'C5a 候选无 signed/replayReady true');
  assert(Array.isArray(map), 'C5b 候选 mapping 是裸数组（flow-bridge 形态）');
  assert(typeof man.note === 'string' && man.note, 'C5c manifest 降权 note 在场');
  const srcKeys = Object.keys(tc.source).sort().join(',');
  assert(!('signed' in tc.source) && !('replayReady' in tc.source), `C5d 候选 source 无 signed/replayReady（实得键 ${srcKeys}）`);

  // ── C6 输出卫生 ──
  assert(!allText.includes('://'), 'C6a 候选全文无 ://');
  assert(!d.stdout.includes(distillOut), 'C6b 成功 stdout 不含 out-dir 绝对路径');

  // ── C2 TOCTOU 硬门 ──
  // C2a NOT_INTAKEN（跳过 intake）
  {
    const capOut = join(tmp, 'cap-noik');
    const ev = join(tmp, 'ev-noik.json'); writeFileSync(ev, JSON.stringify(CLEAN_EVENTS));
    run(['record', 'tc_noik', '--sut', 'http://127.0.0.1:15519', '--out-dir', capOut, '--no-login', '--from-events', ev]);
    const cap = join(capOut, 'tc_noik', 'record-capture', 'teach-in-capture.json');
    const r = run(['distill', 'tc_noik', '--capture', cap, '--out-dir', join(tmp, 'o-noik')]);
    assert(r.status === 65, `C2a NOT_INTAKEN 须 exit 65，实得 ${r.status}`);
    assert(emptyDir(ddir(join(tmp, 'o-noik'), 'tc_noik')), 'C2a 零候选落盘');
  }
  // C2b CAPTURE_SWAPPED（intake 后篡改字节）
  {
    const cap = seamAccepted(tmp, 'tc_swap');
    const doc = readJson(cap); doc.events[0].text = '改过的文案'; writeFileSync(cap, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    const r = run(['distill', 'tc_swap', '--capture', cap, '--out-dir', join(tmp, 'o-swap')]);
    assert(r.status === 65, `C2b CAPTURE_SWAPPED 须 exit 65，实得 ${r.status}`);
    assert(emptyDir(ddir(join(tmp, 'o-swap'), 'tc_swap')), 'C2b 零候选落盘');
  }
  // C2c 软链（capture 文件是符号链接，预读守卫，无需 intake）
  {
    const realCap = join(tmp, 'realdcap', 'teach-in-capture.json');
    mkdirSync(dirname(realCap), { recursive: true }); writeFileSync(realCap, readFileSync(okCap));
    const cd = join(tmp, 'tc_dlink', 'record-capture'); mkdirSync(cd, { recursive: true });
    symlinkSync(realCap, join(cd, 'teach-in-capture.json'));
    const r = run(['distill', 'tc_dlink', '--capture', join(cd, 'teach-in-capture.json'), '--out-dir', join(tmp, 'o-link')]);
    assert(r.status === 65, `C2c 软链 capture 须 exit 65，实得 ${r.status}`);
  }
  // C2d REREVIEW_FAILED（手造 accept 台账，其 sha 精确等于一个当前 reviewCapture 会拒的包——复现「哈希对但复核不过」纵深）
  {
    const cd = join(tmp, 'tc_rrf', 'record-capture'); mkdirSync(cd, { recursive: true });
    const badDoc = { schemaVersion: 1, artifactKind: 'teach-in-capture', caseId: 'tc_rrf', createdAt: '2026-01-01T00:00:00.000Z', startPath: 'https://victim-host.example.com/x', source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true }, events: [{ seq: 1, action: 'click', path: '/x' }] };
    const badCap = join(cd, 'teach-in-capture.json'); writeFileSync(badCap, JSON.stringify(badDoc, null, 2) + '\n', 'utf8');
    const badSha = sha256(badCap);
    writeFileSync(join(cd, 'intake-ledger.jsonl'), JSON.stringify({ schemaVersion: 1, event: 'intake', intakeStatus: 'accepted', caseId: 'tc_rrf', intakedAt: '2026-01-01T00:00:00.000Z', eventCount: 1, reason: null, captureName: 'teach-in-capture.json', captureSha256: badSha }) + '\n', 'utf8');
    const r = run(['distill', 'tc_rrf', '--capture', badCap, '--out-dir', join(tmp, 'o-rrf')]);
    assert(r.status === 65, `C2d REREVIEW_FAILED 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
    assert(emptyDir(ddir(join(tmp, 'o-rrf'), 'tc_rrf')), 'C2d 零候选落盘');
  }

  // ── C4 采集忠实闸（--verify --mapping，基于 C3 的 manifest）──
  {
    // C4c 忠实通过：mapping=[]（v1 全 pending，空 mapping 合法）→ exit 0
    const emptyMap = join(tmp, 'map-empty.json'); writeFileSync(emptyMap, '[]');
    const ok = run(['distill', 'tc_d_ok', '--capture', okCap, '--out-dir', distillOut, '--verify', '--mapping', emptyMap]);
    assert(ok.status === 0, `C4c 忠实 mapping 应 exit 0，stderr=${ok.stderr}`);
    // C4a 凭空 atom（intentId 不在 projection）→ exit 65
    const ghostMap = join(tmp, 'map-ghost.json'); writeFileSync(ghostMap, JSON.stringify([{ intentId: 'i999', atom: 'workflow.save' }]));
    const bad = run(['distill', 'tc_d_ok', '--capture', okCap, '--out-dir', distillOut, '--verify', '--mapping', ghostMap]);
    assert(bad.status === 65, `C4a 凭空 atom 须 exit 65，实得 ${bad.status}`);
    // C4d 闸绝不抛：mapping 非数组 → 仍 exit 65（fail-closed）非崩
    const badShape = join(tmp, 'map-badshape.json'); writeFileSync(badShape, '{"not":"array"}');
    const bs = run(['distill', 'tc_d_ok', '--capture', okCap, '--out-dir', distillOut, '--verify', '--mapping', badShape]);
    assert(bs.status === 65, `C4d 畸形 mapping 须 fail-closed exit 65，实得 ${bs.status}`);
  }

  // ── C2f 编码凭据穿输出门（异构评审 F4，PoC）：老 intake 收下的 %HH 编码凭据包 + sha 匹配 accept 台账
  //     （版本漂移/台账篡改），distill 重验证须含 canon/decoded 凭据门（== intake battery）拒之 ──
  {
    const cd = join(tmp, 'tc_enc', 'record-capture'); mkdirSync(cd, { recursive: true });
    const encDoc = { schemaVersion: 1, artifactKind: 'teach-in-capture', caseId: 'tc_enc', createdAt: '2026-01-01T00:00:00.000Z', startPath: '/x', source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true }, events: [{ seq: 1, action: 'click', path: '/x', text: '%70%61%73%73%77%6f%72%64%3d%73%65%63%72%65%74' }] };
    const encCap = join(cd, 'teach-in-capture.json'); writeFileSync(encCap, JSON.stringify(encDoc, null, 2) + '\n', 'utf8');
    writeFileSync(join(cd, 'intake-ledger.jsonl'), JSON.stringify({ schemaVersion: 1, event: 'intake', intakeStatus: 'accepted', caseId: 'tc_enc', intakedAt: '2026-01-01T00:00:00.000Z', eventCount: 1, reason: null, captureName: 'teach-in-capture.json', captureSha256: sha256(encCap) }) + '\n', 'utf8');
    const r = run(['distill', 'tc_enc', '--capture', encCap, '--out-dir', join(tmp, 'o-enc')]);
    assert(r.status !== 0, `C2f 编码凭据须拒（非 exit 0），实得 ${r.status}`);
    assert(emptyDir(ddir(join(tmp, 'o-enc'), 'tc_enc')), 'C2f 编码凭据零候选落盘');
    const encStep = existsSync(join(ddir(join(tmp, 'o-enc'), 'tc_enc'), 'distill-candidate-testcase-tc_enc.json'));
    assert(!encStep, 'C2f 无候选（编码凭据不得进 step.intent）');
  }
  // ── C2h 超深(21 层)编码凭据不收敛（异构评审 R2-F4）：normConverge 20 轮 cap 内不收敛，凭据门须 !converged fail-closed 拒 ──
  {
    const encChar = (s) => [...s].map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    let deep = encChar('password=secret'); for (let i = 0; i < 20; i++) deep = deep.replace(/%/g, '%25'); // 21 层
    const cd = join(tmp, 'tc_deep', 'record-capture'); mkdirSync(cd, { recursive: true });
    const deepDoc = { schemaVersion: 1, artifactKind: 'teach-in-capture', caseId: 'tc_deep', createdAt: '2026-01-01T00:00:00.000Z', startPath: '/x', source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true }, events: [{ seq: 1, action: 'click', path: '/x', text: deep }] };
    const deepCap = join(cd, 'teach-in-capture.json'); writeFileSync(deepCap, JSON.stringify(deepDoc, null, 2) + '\n', 'utf8');
    writeFileSync(join(cd, 'intake-ledger.jsonl'), JSON.stringify({ schemaVersion: 1, event: 'intake', intakeStatus: 'accepted', caseId: 'tc_deep', intakedAt: '2026-01-01T00:00:00.000Z', eventCount: 1, reason: null, captureName: 'teach-in-capture.json', captureSha256: sha256(deepCap) }) + '\n', 'utf8');
    const r = run(['distill', 'tc_deep', '--capture', deepCap, '--out-dir', join(tmp, 'o-deep')]);
    // 钉死 F4 canon 门本身（异构评审 R3 codex 建议）：exit 1（凭据门，非 65 的 TOCTOU/parse/review）+ stderr 命中「不收敛」，
    // 防未来「非零但不是 F4 门」的假绿。
    assert(r.status === 1, `C2h 超深不收敛须在凭据门 exit 1（非 65/其他），实得 ${r.status}`);
    assert(/不收敛/.test(r.stderr), `C2h 须命中 F4 不收敛门（stderr 提不收敛），实得 stderr=${r.stderr}`);
    assert(emptyDir(ddir(join(tmp, 'o-deep'), 'tc_deep')), 'C2h 零候选落盘');
  }
  // ── C2g 写盘错误捕获（异构评审 F2）：第二产物路径是目录 → exit 1 errno、无半份候选、stderr 无绝对路径 ──
  {
    const cap = seamAccepted(tmp, 'tc_wfail');
    const wout = join(tmp, 'o-wfail');
    mkdirSync(join(wout, 'tc_wfail', 'distill', 'distill-candidate-mapping-tc_wfail.json'), { recursive: true });
    const r = run(['distill', 'tc_wfail', '--capture', cap, '--out-dir', wout]);
    assert(r.status === 1, `C2g 写盘失败须 exit 1，实得 ${r.status}`);
    assert(!r.stderr.includes(wout), 'C2g stderr 不回显 out-dir 绝对路径');
    const dfiles = existsSync(ddir(wout, 'tc_wfail')) ? readdirSync(ddir(wout, 'tc_wfail')) : [];
    assert(!dfiles.includes('distill-candidate-testcase-tc_wfail.json'), 'C2g 无半份候选（testcase 不残留）');
  }
  // ── C4f --verify 须复用 capture 硬门、不信可变 manifest（异构评审 F1）：distill 产 manifest 后篡改 capture，
  //     --verify 须 exit 65（TOCTOU 硬门重跑），非读旧 manifest 判 exit 0 ──
  {
    const cap = seamAccepted(tmp, 'tc_vswap');
    const vout = join(tmp, 'o-vswap');
    assert(run(['distill', 'tc_vswap', '--capture', cap, '--out-dir', vout]).status === 0, 'C4f 前置 distill exit 0');
    const em = join(tmp, 'map-vswap.json'); writeFileSync(em, '[]');
    assert(run(['distill', 'tc_vswap', '--capture', cap, '--out-dir', vout, '--verify', '--mapping', em]).status === 0, 'C4f 干净 --verify exit 0');
    const doc = readJson(cap); doc.events[0].text = '篡改'; writeFileSync(cap, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    assert(run(['distill', 'tc_vswap', '--capture', cap, '--out-dir', vout, '--verify', '--mapping', em]).status === 65, 'C4f 篡改后 --verify 须 exit 65（复用 TOCTOU 硬门，不信旧 manifest）');
  }

  // ── C7 门面回归 ──
  assert(run(['selftest', '--tier1']).status === 0, 'C7 selftest --tier1 无回归');

  console.log('record-distill golden: GREEN');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
