#!/usr/bin/env node
// bin/distill.mjs -- teach-in distillation CLI（薄壳，fail-closed 前置，退出码 GRILL D13）。
// 把已入账 capture 蒸馏成候选流程（v1 零 LLM 全 pending），重走 ingest→compile→draft→sign，绝不直通回放。
import { readFileSync, lstatSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { credentialGate } from '../lib/cred-gate.mjs';
import { reviewCapture, intakeLedgerPath, normConverge, hasDuplicateKeys } from '../lib/record-intake.mjs';
import { verifyIntaken, projectCapture, validateCaptureFidelity, buildDistillManifest, captureSha256Of } from '../lib/record-distill.mjs';

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
      else o[k] = true;
    } else o.pos.push(a);
  }
  return o;
}
function dieUsage(msg) {
  console.error(`distill: ${msg}`);
  console.error('用法: casey distill <caseId> --capture <teach-in-capture.json> --out-dir <dir> [--verify --mapping <f>]');
  process.exit(64);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!caseId) dieUsage('缺 caseId');
  if (!/^[A-Za-z0-9_-]+$/.test(caseId)) { console.error('distill: caseId 含非法字符（仅限字母数字_-；原值不回显）'); process.exit(65); }
  if (!credentialGate({ caseId }).ok) { console.error('distill: caseId 命中凭据门（含凭据关键词或敏感字面量；请改 caseId 后重试；原值不回显）'); process.exit(65); }
  for (const k of ['capture', 'out-dir', 'mapping']) if (args[k] !== undefined && typeof args[k] !== 'string') dieUsage(`--${k} 须带值`);
  if (!args.capture) dieUsage('缺 --capture');
  if (!args['out-dir']) dieUsage('缺 --out-dir');
  if (args.verify && !args.mapping) dieUsage('--verify 须带 --mapping <f>');

  const capturePath = resolve(String(args.capture));
  const outDir = resolve(String(args['out-dir']));
  const distillDir = join(outDir, caseId, 'distill');

  // ── 布局 + 软链硬化（预读 fail-closed 守卫，复用 intake 纪律；--verify 与常规同门，异构评审 F1）──
  if (basename(capturePath) !== 'teach-in-capture.json'
    || basename(dirname(capturePath)) !== 'record-capture'
    || basename(dirname(dirname(capturePath))) !== caseId) {
    console.error('distill: --capture 须为 <caseId>/record-capture/teach-in-capture.json 规范布局（路径不回显）');
    process.exit(65);
  }
  let capStat;
  try { capStat = lstatSync(capturePath); }
  catch (e) { console.error(`distill: --capture 不可读（errno=${e?.code || 'UNKNOWN'}；路径不回显）`); process.exit(1); }
  if (capStat.isSymbolicLink()) { console.error('distill: --capture 是符号链接（拒跟随；路径不回显）'); process.exit(65); }
  try { if (lstatSync(dirname(capturePath)).isSymbolicLink()) { console.error('distill: record-capture 目录是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 略过 */ }
  try { if (lstatSync(dirname(dirname(capturePath))).isSymbolicLink()) { console.error('distill: caseId 目录是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 略过 */ }
  const ledgerPath = intakeLedgerPath({ capturePath });
  try { if (lstatSync(ledgerPath).isSymbolicLink()) { console.error('distill: intake-ledger.jsonl 是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 台账不存在=正常 */ }

  let raw;
  try { raw = readFileSync(capturePath, 'utf8'); }
  catch (e) { console.error(`distill: --capture 不可读（errno=${e?.code || 'UNKNOWN'}；路径与内容不回显）`); process.exit(1); }
  const currentSha256 = captureSha256Of(raw);

  // ── 凭据 battery == intake（异构评审 F4）：raw + 重复键 + canon + normConverge 解码，封 %HH/\u/编码凭据
  //    穿 distill 输出面（候选 step.intent/pathHint）；distill 重验证等同 intake 入账 battery，不留半道。──
  if (!credentialGate({ capture: raw }).ok) { console.error('distill: capture 命中凭据门（护栏 #7）；拒绝蒸馏、零落盘。'); process.exit(1); }
  if (hasDuplicateKeys(raw)) { console.error('distill: capture 含 JSON 重复键（脏内容可藏被丢弃键；拒蒸馏，零落盘）'); process.exit(65); }

  // ── TOCTOU 硬门（GRILL D4）：读台账 verifyIntaken 校 accepted + sha 匹配 ──
  let ledgerEntries = [];
  try { ledgerEntries = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)); }
  catch { ledgerEntries = []; }
  const vi = verifyIntaken({ caseId, ledgerEntries, currentSha256 });
  if (!vi.ok) { console.error(`distill: intake→distill 硬门拒（${vi.reason}）——未入账或换包，绝不蒸馏。`); process.exit(65); }

  let doc;
  try { doc = JSON.parse(raw); }
  catch { console.error('distill: capture 非合法 JSON（PARSE_ERROR；内容不回显）'); process.exit(65); }

  // canon + 解码凭据门（== intake:101-103）：拒 %HH/\u 编码英文凭据（reviewCapture 只查 URL/scheme 不查关键词）。
  const canon = JSON.stringify(doc);
  const dec = normConverge(canon);
  // !dec.converged fail-closed（异构评审 R2-F4）：超 20 层嵌套编码不收敛，解码后仍编码态、凭据门扫不到——
  // 与 record-intake hasUrlLeak 的不收敛判泄漏同口径，凭据门也不收敛即拒。
  if (!dec.converged || !credentialGate({ capture: canon }).ok || !credentialGate({ capture: dec.s }).ok) { console.error('distill: capture 含编码凭据/超深不收敛编码（canon/解码扫；护栏 #7）；拒蒸馏、零落盘。'); process.exit(1); }

  // 当前字节重跑 reviewCapture（belt-and-suspenders，GRILL D4 步骤 4）。
  const review = reviewCapture(doc, { caseId });
  if (!review.ok) { console.error(`distill: 当前 capture 重跑复核不过（REREVIEW_FAILED:${review.reason}）——绝不蒸馏。`); process.exit(65); }

  // 零 LLM 投影（--verify 与常规都从**当前 capture** 重投影，不信可变 manifest，异构评审 F1）。
  const { candidateTestCase, candidateMapping, pending, projection } = projectCapture(doc);

  // ── --verify 采集忠实闸模态（GRILL D9）：以当前 capture 重投影的 projection/pending 校 --mapping ──
  if (args.verify) {
    let mapping;
    try { mapping = JSON.parse(readFileSync(resolve(String(args.mapping)), 'utf8')); }
    catch { console.error('distill --verify: --mapping 不可读/非 JSON（内容不回显）'); process.exit(65); }
    const v = validateCaptureFidelity({ mapping, projection, pending });
    if (!v.ok) { console.error(`distill --verify: 采集忠实闸拒（${v.problems.join(' / ')}）——mapping 对 capture 不忠实。`); process.exit(65); }
    console.log('distill --verify: 采集忠实闸通过（mapping 每 atom 有 capture 证据、每 event 被覆盖或落 pending）。');
    process.exit(0);
  }

  // ── 常规：产候选 + manifest，逐一过输出凭据门（+ 解码扫），全过再写；写盘失败清理不留半份（异构评审 F2/F4）──
  const manifest = buildDistillManifest({ caseId, captureSha256: currentSha256, projection, pending });
  const products = [
    [`distill-candidate-testcase-${caseId}.json`, candidateTestCase],
    [`distill-candidate-mapping-${caseId}.json`, candidateMapping],
    [`distill-manifest-${caseId}.json`, manifest],
  ].map(([name, obj]) => [name, JSON.stringify(obj, null, 2) + '\n']);
  for (const [name, text] of products) {
    const { s: decText, converged: dtConv } = normConverge(text);
    if (!dtConv || !credentialGate({ [name]: text }).ok || !credentialGate({ [name]: decText }).ok) { console.error(`distill: 候选 ${name} 命中输出凭据门（护栏 #7，含解码扫/不收敛 fail-closed）；拒绝落盘、零候选。`); process.exit(1); }
  }
  try {
    mkdirSync(distillDir, { recursive: true });
    for (const [name, text] of products) writeFileSync(join(distillDir, name), text, 'utf8');
  } catch (e) {
    for (const [name] of products) { try { rmSync(join(distillDir, name), { recursive: true, force: true }); } catch { /* ignore */ } }
    console.error(`distill: 候选写盘失败（errno=${e?.code || 'UNKNOWN'}；路径不回显）；已清理，无半份候选。`);
    process.exit(1);
  }

  console.log(`distill: 已蒸馏候选（非权威）→ <out-dir>/${caseId}/distill/ 三件（testcase/mapping/manifest）`);
  console.log(`distill: ${pending.length} 步全 pending（route:human）——v1 零 LLM 未产候选 atom；须重走 ingest→compile→draft→人签，绝不直通回放。`);
  process.exit(0);
}

main();
