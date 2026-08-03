#!/usr/bin/env node
// teach-in cycle 成功等价收据持久化：零 SUT/browser/network/LLM。
// 新功能红先行：生产模块与 record 接线在实现前应缺席，整体 exit 1。

import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync,
  rmdirSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const TAG = 'teachin-cycle-equivalence-receipt';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const ISOLATION_ENV = 'CASEY_CYCLE_RECEIPT_ISOLATION_ROOT';

function dropLink(path) {
  try { unlinkSync(path); return; } catch { /* Windows junction 走 rmdir */ }
  try { rmdirSync(path); } catch { /* 临时根留给系统清理 */ }
}

// 输出闸会复用现役 credentialGate；隔离根确保金牌只见合成凭据，不读真仓凭据。
if (!process.env[ISOLATION_ENV]) {
  const isolationRoot = mkdtempSync(join(tmpdir(), 'casey-cycle-receipt-iso-'));
  const links = [];
  try {
    mkdirSync(join(isolationRoot, '.auth'), { recursive: true });
    writeFileSync(join(isolationRoot, '.auth', 'credentials.json'), `${JSON.stringify({
      username: 'FAKE_CYCLE_RECEIPT_USER', password: 'FAKE_CYCLE_RECEIPT_PASS',
    })}\n`, 'utf8');
    writeFileSync(join(isolationRoot, 'site.json'), `${JSON.stringify({
      baseUrl: 'FAKE_CYCLE_RECEIPT_TARGET',
    })}\n`, 'utf8');
    for (const name of ['lib', 'bin', 'tests', 'node_modules']) {
      const target = join(ROOT, name);
      if (!existsSync(target)) continue;
      const link = join(isolationRoot, name);
      symlinkSync(target, link, 'junction');
      links.push(link);
    }
    const child = spawnSync(process.execPath, [
      '--preserve-symlinks', '--preserve-symlinks-main',
      join(isolationRoot, 'tests', '_golden', 'teachin-cycle-equivalence-receipt.zero-sut.golden.mjs'),
    ], {
      stdio: 'inherit',
      env: { ...process.env, [ISOLATION_ENV]: isolationRoot },
    });
    process.exitCode = child.status === null ? 1 : child.status;
  } catch (error) {
    console.error(`RED  ${TAG}: 隔离根搭建失败：${String(error?.code || 'UNKNOWN')}`);
    process.exitCode = 1;
  } finally {
    for (const link of links) dropLink(link);
    for (const rel of ['site.json', join('.auth', 'credentials.json')]) {
      try { unlinkSync(join(isolationRoot, rel)); } catch { /* 已不在即可 */ }
    }
    try { rmdirSync(join(isolationRoot, '.auth')); } catch { /* 同上 */ }
    try { rmdirSync(isolationRoot); } catch { /* 同上 */ }
  }
  process.exit(process.exitCode || 0);
}

const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const message = String(error?.message || error).slice(-700);
    failures.push(`${name}: ${message}`);
    console.error(`RED  ${TAG}: ${name}: ${message}`);
  }
}

let api = null;
let importError = null;
try {
  api = await import('../../lib/teachin/cycle-equivalence-receipt-output.mjs');
} catch (error) {
  importError = error;
}

function production() {
  assert(typeof api?.persistTeachinCycleEquivalenceReceipt === 'function',
    `缺生产 API persistTeachinCycleEquivalenceReceipt：${String(importError?.code || importError?.message || 'NOT_EXPORTED').slice(-180)}`);
  return api;
}

const digest = (value) => `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
const captureBytes = Buffer.from('{"artifactKind":"teach-in-capture","events":[]}\n');
const captureSha256 = createHash('sha256').update(captureBytes).digest('hex');
const dimensions = Object.freeze([
  'intent-verdict', 'terminal-hard-predicate', 'topology', 'entity', 'effect', 'cleanup',
]);

function validCycle() {
  return {
    ok: true,
    developmentOnly: true,
    promotionReady: false,
    equivalenceReceipt: {
      schemaVersion: 1,
      artifactKind: 'dual-replay-equivalence-receipt',
      pairId: 'pair_zero_sut',
      scope: 'read-only-v1',
      sourceReceiptSha256: digest('source'),
      distilledReceiptSha256: digest('distilled'),
      comparedDimensions: [...dimensions],
    },
  };
}

function files(dir) {
  return readdirSync(dir).sort();
}

await check('E1 仅成功闭环落安全 receipt，逐字绑定 capture 摘要、两份 receipt 摘要与六维', () => {
  const dir = mkdtempSync(join(tmpdir(), 'casey-cycle-receipt-ok-'));
  const cycle = validCycle();
  const result = production().persistTeachinCycleEquivalenceReceipt({
    outDir: dir, captureBytes, cycle,
  });
  assert(result?.ok === true && typeof result.fileName === 'string',
    `合法闭环须写成功：${JSON.stringify(result)}`);
  assert(files(dir).length === 1 && files(dir)[0] === result.fileName,
    `成功只能落单一目标且零临时件：${JSON.stringify(files(dir))}`);
  const doc = JSON.parse(readFileSync(join(dir, result.fileName), 'utf8'));
  assert(JSON.stringify(Object.keys(doc).sort()) === JSON.stringify([
    'artifactKind', 'captureSha256', 'comparedDimensions', 'developmentOnly',
    'distilledReceiptSha256', 'promotionReady', 'schemaVersion', 'sourceReceiptSha256',
  ].sort()), `receipt 顶层须 exact-key：${JSON.stringify(Object.keys(doc))}`);
  assert(doc.schemaVersion === 1 && doc.artifactKind === 'teachin-cycle-equivalence-receipt',
    'receipt 身份字段错误');
  assert(doc.captureSha256 === captureSha256
    && doc.developmentOnly === true && doc.promotionReady === false,
  'capture/候选身份绑定错误');
  assert(doc.sourceReceiptSha256 === cycle.equivalenceReceipt.sourceReceiptSha256
    && doc.distilledReceiptSha256 === cycle.equivalenceReceipt.distilledReceiptSha256,
  '上下游 receipt 摘要未逐字绑定');
  assert(JSON.stringify(doc.comparedDimensions) === JSON.stringify(dimensions),
    '比较维度未逐字绑定');
});

await check('E2 cycle 非成功或候选旗标换形一律零落盘', () => {
  for (const mutate of [
    (cycle) => { cycle.ok = false; cycle.reason = 'PAIR_NOT_EQUIVALENT'; },
    (cycle) => { cycle.developmentOnly = false; },
    (cycle) => { cycle.promotionReady = true; },
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'casey-cycle-receipt-denied-'));
    const cycle = validCycle();
    mutate(cycle);
    const result = production().persistTeachinCycleEquivalenceReceipt({
      outDir: dir, captureBytes, cycle,
    });
    assert(result?.ok === false && files(dir).length === 0,
      `非成功闭环必须拒写：${JSON.stringify(result)} / ${JSON.stringify(files(dir))}`);
  }
});

await check('E3 等价收据畸形、摘要换形、维度缺失/乱序/增员一律零落盘', () => {
  const mutations = [
    (receipt) => { receipt.extra = 'forbidden'; },
    (receipt) => { receipt.sourceReceiptSha256 = 'not-a-digest'; },
    (receipt) => { receipt.distilledReceiptSha256 = digest('source'); },
    (receipt) => { receipt.comparedDimensions.pop(); },
    (receipt) => { receipt.comparedDimensions.reverse(); },
    (receipt) => { receipt.comparedDimensions.push('private-body'); },
  ];
  for (const mutate of mutations) {
    const dir = mkdtempSync(join(tmpdir(), 'casey-cycle-receipt-malformed-'));
    const cycle = validCycle();
    mutate(cycle.equivalenceReceipt);
    const result = production().persistTeachinCycleEquivalenceReceipt({
      outDir: dir, captureBytes, cycle,
    });
    assert(result?.ok === false && files(dir).length === 0,
      `畸形 receipt 必须拒写：${JSON.stringify(result)} / ${JSON.stringify(files(dir))}`);
  }
});

await check('E4 写失败返回固定失败且不遗留临时件', () => {
  const parent = mkdtempSync(join(tmpdir(), 'casey-cycle-receipt-write-fail-'));
  const missing = join(parent, 'missing');
  const result = production().persistTeachinCycleEquivalenceReceipt({
    outDir: missing, captureBytes, cycle: validCycle(),
  });
  assert(result?.ok === false && result.reason === 'CYCLE_EQUIVALENCE_RECEIPT_WRITE_FAILED',
    `写失败须固定拒付：${JSON.stringify(result)}`);
  assert(files(parent).length === 0, `写失败不得遗留临时件：${JSON.stringify(files(parent))}`);
});

await check('E5 record 生产入口只在 cycle 后持久化，失败必须设置 CLI 非零', () => {
  const src = readFileSync(resolve(ROOT, 'bin', 'record.mjs'), 'utf8');
  assert(/cycle-equivalence-receipt-output/.test(src)
    && /persistTeachinCycleEquivalenceReceipt\s*\(/.test(src),
  'record 须接入成功等价收据持久化 API');
  const callAt = src.search(/persistTeachinCycleEquivalenceReceipt\s*\(/);
  const cycleAt = src.search(/const cycle\s*=\s*await runWithCycleEvidence/);
  assert(cycleAt >= 0 && callAt > cycleAt, 'receipt 只能在 cycle 返回之后持久化');
  const tail = src.slice(callAt, callAt + 1800);
  assert(/captureBytes\s*:\s*exactCaptureBytes/.test(tail)
    && /cycle\s*[,}]/.test(tail)
    && /outDir\s*:\s*dirname\(captureFile\)/.test(tail),
  'record 须绑定同次 exact capture、同次 cycle 与 capture dir');
  assert(/process\.exitCode\s*=\s*1/.test(tail),
    'receipt 拒写/写失败必须令 CLI 非零');
});

if (failures.length > 0) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
