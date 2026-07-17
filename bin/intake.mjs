#!/usr/bin/env node
// bin/intake.mjs -- teach-in intake: review a capture against safety invariants, record to ledger.
// 只复核登记，不转形/不签署/不回放（GRILL D1）。蒸馏由后续 record-distill 契约消费『已入账』capture。
import { readFileSync, lstatSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { credentialGate } from '../lib/cred-gate.mjs';
import { reviewCapture, intakeLedgerPath, buildIntakeRecord, appendIntakeLedger, normConverge, hasDuplicateKeys } from '../lib/record-intake.mjs';
import { deriveTeachInPackagePaths, verifyTeachInPackage } from '../lib/entity-semantic-lock-package.mjs';

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

function usage() {
  console.error('用法: casey intake <caseId> --capture <teach-in-capture.json>');
}
function dieUsage(msg) { console.error(`intake: ${msg}`); usage(); process.exit(64); }

function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!caseId) dieUsage('缺 caseId');
  // caseId 进用户可见台账内容与包内比对——限路径安全字符，拒穿越（预读 fail-closed 守卫，镜像 record.mjs:174）。
  if (!/^[A-Za-z0-9_-]+$/.test(caseId)) { console.error('intake: caseId 含非法字符（仅限字母数字_-；原值不回显）'); process.exit(65); }
  // caseId 会落进过凭据门的台账——含凭据关键词或动态 secret literal 会致台账行晚期自触门 exit 1；
  // 前置用同一凭据门判、清晰 exit 65（异构评审 F6 + R2-F6：覆盖关键词与 secret literal 两类）。
  if (!credentialGate({ caseId }).ok) {
    console.error('intake: caseId 命中凭据门（含凭据关键词或敏感字面量；请改 caseId 后重试；原值不回显）');
    process.exit(65);
  }
  // 必填/带值旗标须真带值——裸旗标（parseArgs 记 true）不得静默降级（镜像 record.mjs:176）。
  if (args.capture !== undefined && typeof args.capture !== 'string') dieUsage('--capture 须带值');
  if (!args.capture) dieUsage('缺 --capture');

  const capturePath = resolve(String(args.capture));
  // --capture 须落规范布局 <caseId>/record-capture/teach-in-capture.json：绑 capture 于其 caseId，
  // 挡异位/越界写台账（预读 fail-closed 守卫；GRILL D3 兑现、异构评审 F5）。
  if (basename(capturePath) !== 'teach-in-capture.json'
    || basename(dirname(capturePath)) !== 'record-capture'
    || basename(dirname(dirname(capturePath))) !== caseId) {
    console.error('intake: --capture 须为 <caseId>/record-capture/teach-in-capture.json 规范布局（路径不回显）');
    process.exit(65);
  }
  // symlink 硬化（异构评审 R2-F5）：capture 文件或 record-capture 目录是软链会绕过物理布局校验、
  // 把台账 append 到软链目标——lstat 拒软链（不跟随）。
  let capStat;
  try { capStat = lstatSync(capturePath); }
  catch (e) { console.error(`intake: --capture 不可读（errno=${e?.code || 'UNKNOWN'}；路径不回显）`); process.exit(1); }
  if (capStat.isSymbolicLink()) { console.error('intake: --capture 是符号链接（拒跟随；路径不回显）'); process.exit(65); }
  try { if (lstatSync(dirname(capturePath)).isSymbolicLink()) { console.error('intake: record-capture 目录是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 目录 stat 失败留给下方读处理 */ }
  // caseId 目录本身是软链也拒（否则台账写到软链目标；异构评审 R3-#3）。
  try { if (lstatSync(dirname(dirname(capturePath))).isSymbolicLink()) { console.error('intake: caseId 目录是符号链接（拒；路径不回显）'); process.exit(65); } } catch { /* 祖父 stat 失败略过 */ }
  const packagePaths = deriveTeachInPackagePaths({ capturePath });
  const { manifestPath, sidecarPath } = packagePaths;
  for (const [label, packagePath] of [['teach-in-package.json', manifestPath], ['identity-observations.json', sidecarPath]]) {
    try {
      if (lstatSync(packagePath).isSymbolicLink()) {
        console.error(`intake: ${label} 是符号链接（拒跟随；路径不回显）`);
        process.exit(65);
      }
    } catch (e) {
      console.error(`intake: ${label} 不可读（errno=${e?.code || 'UNKNOWN'}；路径不回显）`);
      process.exit(1);
    }
  }
  const captureName = basename(capturePath);
  const ledgerPath = intakeLedgerPath({ capturePath });
  // 既有台账是软链则拒 append 跟随到软链目标（异构评审 R3-#3）；不存在则 lstat 抛、略过。
  try { if (lstatSync(ledgerPath).isSymbolicLink()) { console.error('intake: intake-ledger.jsonl 是符号链接（拒 append 跟随；路径不回显）'); process.exit(65); } } catch { /* 台账尚不存在 = 正常 */ }

  let captureBytes;
  let manifestBytes;
  let sidecarBytes;
  try {
    captureBytes = readFileSync(capturePath);
    manifestBytes = readFileSync(manifestPath);
    sidecarBytes = readFileSync(sidecarPath);
  } catch (e) {
    console.error(`intake: 示教三件套不可读（errno=${e?.code || 'UNKNOWN'}；路径与内容不回显）`);
    process.exit(1);
  }
  const raw = captureBytes.toString('utf8');
  // capture 字节 sha256：accept/reject 条目均绑此哈希，distill 消费前校验未换包（TOCTOU 防线，异构评审 F1）。
  let captureSha256 = `sha256:${createHash('sha256').update(captureBytes).digest('hex')}`;

  const reject = (reason, eventCount = null) => {
    try {
      appendIntakeLedger({ ledgerPath, record: buildIntakeRecord({ caseId, status: 'rejected', reason, eventCount, captureName, captureSha256 }) });
    } catch (e) {
      console.error(`intake: 拒账台账写入受阻（${e?.code || 'ERR'}；路径与内容不回显）`);
      process.exit(1);
    }
    console.error(`intake: 录制包拒账（${reason}）——未入蒸馏前置队列。`);
    process.exit(65);
  };

  // package 联合闸先按三份最终原始字节核对；manifest/sidecar 路径只能由规范 capturePath 同级固定推导。
  const packageReview = verifyTeachInPackage({ caseId, captureBytes, sidecarBytes, manifestBytes });
  if (!packageReview.ok) reject(packageReview.reason);
  captureSha256 = packageReview.captureSha256;

  // 前置凭据门（纵深防御，早于 parse 与任何回显）：命中即拒，台账只记类别码、零脏内容落盘。
  if (!credentialGate({ capture: raw }).ok) reject('CRED_GATE_HIT');

  // 重复键拒（异构评审 R8）：JSON.parse 取最后一个、重复键可把脏内容藏进被丢弃的键——早于 parse 拒，
  // 保证 parsed doc 即完整内容、后续 parsed-doc 检查系统完备。
  if (hasDuplicateKeys(raw)) reject('DUPLICATE_KEY');

  let doc;
  try { doc = JSON.parse(raw); } catch { reject('PARSE_ERROR'); }

  // parse 后 canonical + normConverge 解码后双扫凭据门：JSON \u 转义（raw 门漏）与 %HH 编码（canonical 字面漏）
  // 的英文凭据在此现形（异构评审 R6 + R7）。超深不收敛的编码内容由 reviewCapture 逐字段 hasUrlLeak/isPathOnly
  // fail-closed 兜（URL_LEAK/DIRTY_EVENT），故此处只按凭据关键词命中判、不因不收敛误归 CRED_GATE_HIT。
  const canon = JSON.stringify(doc);
  const dec = normConverge(canon);
  if (!credentialGate({ capture: canon }).ok || !credentialGate({ capture: dec.s }).ok) reject('CRED_GATE_HIT');

  const review = reviewCapture(doc, { caseId });
  if (!review.ok) reject(review.reason, review.eventCount);

  try {
    appendIntakeLedger({
      ledgerPath,
      record: buildIntakeRecord({
        caseId,
        status: 'accepted',
        eventCount: review.eventCount,
        captureName,
        captureSha256,
        sidecarSha256: packageReview.sidecarSha256,
        manifestSha256: packageReview.manifestSha256,
        observationCount: packageReview.observationCount,
        observationSchemaVersion: packageReview.observationSchemaVersion,
      }),
    });
  } catch (e) {
    console.error(`intake: 入账台账写入受阻（${e?.code || 'ERR'}；路径与内容不回显）`);
    process.exit(1);
  }
  // 成功侧不回显用户绝对路径（output-seal 纪律）；只报定名产物与降权提示。
  console.log('intake: 已入账（accepted）→ <case-dir>/record-capture/intake-ledger.jsonl');
  console.log(`intake: ${review.eventCount} 条事件已登记进蒸馏前置队列；仍须经蒸馏 + L0 复核 + 人签，不直通回放。`);
  process.exit(0);
}

main();
