#!/usr/bin/env node
// raw proof output：复用现役 atomic writer，凭据门先于 I/O，失败不留半份。
// 只用本地临时目录与注入 double；零 SUT/browser/network/LLM，且不读取真实配置。

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { atomicWriteFileSync as existingAtomicWrite } from '../../lib/promptset-authoring.mjs';

const TAG = 'teachin-replayability-raw-output-seal';
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
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

let api;
try {
  api = await import('../../lib/teachin/raw-proof-output.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-300)}`);
}

const required = ['createRawProofOutputWriter', 'writeRawReplayProof'];
const proofBytes = Buffer.from(`${JSON.stringify({
  schemaVersion: 1,
  artifactKind: 'teach-in-raw-replay-proof',
  caseId: 'tc_output',
  status: 'CLEAN',
  developmentOnly: true,
  promotionReady: false,
})}\n`);

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
  assert(Object.keys(result).sort().join(',') === 'ok,reason',
    `${label} 失败形状必须闭合：${JSON.stringify(result)}`);
}

if (api && required.every((name) => typeof api[name] === 'function')) {
  await check('O1 safe exact bytes 只在 credential gate 后交给 atomic writer', () => {
    const calls = [];
    const writer = api.createRawProofOutputWriter({
      credentialGate: (outputs) => {
        calls.push(['gate', outputs]);
        return { ok: true };
      },
      atomicWriteFileSync: (path, text) => calls.push(['write', path, text]),
    });
    const result = writer.writeRawReplayProof({
      outputPath: '/synthetic/raw-proof.json',
      proofBytes,
    });
    assert(JSON.stringify(result) === '{"ok":true}',
      `成功形状必须闭合：${JSON.stringify(result)}`);
    assert(calls.length === 2 && calls[0][0] === 'gate' && calls[1][0] === 'write',
      `gate 必须先于 write 且各一次：${JSON.stringify(calls)}`);
    assert(Object.keys(calls[0][1]).join(',') === 'teach-in-raw-replay-proof'
      && calls[0][1]['teach-in-raw-replay-proof'] === proofBytes.toString('utf8'),
    'credential gate 必须接 exact proof 文本与固定非路径 label');
    assert(calls[1][1] === '/synthetic/raw-proof.json'
      && calls[1][2] === proofBytes.toString('utf8'),
    'atomic writer 必须收到 exact path/text，不重排 proof bytes');
  });

  await check('O2 credential reject 在 I/O 前闭合失败且不回显输入', () => {
    let writes = 0;
    const writer = api.createRawProofOutputWriter({
      credentialGate: () => ({ ok: false, hit: 'POISON_SECRET_DETAIL' }),
      atomicWriteFileSync: () => { writes += 1; },
    });
    const result = writer.writeRawReplayProof({
      outputPath: '/private/POISON_PATH/raw-proof.json',
      proofBytes: Buffer.from('POISON_SECRET_VALUE'),
    });
    expectReason(result, 'RAW_PROOF_OUTPUT_REJECTED', '凭据拒绝');
    assert(writes === 0, '凭据拒绝后 atomic writer 调用数必须为 0');
    assert(!JSON.stringify(result).includes('POISON'), '失败结果不得回显路径、内容或 gate detail');
  });

  await check('O3 现役 atomic writer rename 失败保留原目标且清理 sidecar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'casey-raw-proof-output-'));
    try {
      const target = join(dir, 'raw-proof.json');
      writeFileSync(target, 'ORIGINAL', 'utf8');
      const writer = api.createRawProofOutputWriter({
        credentialGate: () => ({ ok: true }),
        atomicWriteFileSync: (path, text) => existingAtomicWrite(path, text, {
          renameFn: () => { throw new Error('POISON_RENAME_DETAIL'); },
        }),
      });
      const result = writer.writeRawReplayProof({ outputPath: target, proofBytes });
      expectReason(result, 'RAW_PROOF_WRITE_FAILED', 'rename 失败');
      assert(readFileSync(target, 'utf8') === 'ORIGINAL', 'rename 失败必须保留原目标 bytes');
      assert(JSON.stringify(readdirSync(dir).sort()) === '["raw-proof.json"]',
        `rename 失败不得残留 sidecar：${JSON.stringify(readdirSync(dir))}`);
      assert(!JSON.stringify(result).includes('POISON'), '失败结果不得回显 atomic 异常');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  await check('O4 canonical 模块与 CLI 静态复用现役 output seal', async () => {
    const moduleSource = await readFile(
      new URL('../../lib/teachin/raw-proof-output.mjs', import.meta.url),
      'utf8',
    );
    const cliUrl = new URL('../../bin/teachin-raw-replay.mjs', import.meta.url);
    assert(existsSync(cliUrl), '缺 bin/teachin-raw-replay.mjs');
    const cliSource = await readFile(cliUrl, 'utf8');
    assert(/import\s*\{[^}]*\bcredentialGate\b[^}]*\}\s*from\s*['"]\.\.\/cred-gate\.mjs['"]/s
      .test(moduleSource),
    'raw-proof-output 必须静态复用 canonical credentialGate');
    assert(/import\s*\{[^}]*\batomicWriteFileSync\b[^}]*\}\s*from\s*['"]\.\.\/promptset-authoring\.mjs['"]/s
      .test(moduleSource),
    'raw-proof-output 必须静态复用现役 atomicWriteFileSync');
    assert(/import\s*\{[^}]*\bwriteRawReplayProof\b[^}]*\}\s*from\s*['"]\.\.\/lib\/teachin\/raw-proof-output\.mjs['"]/s
      .test(cliSource),
    'raw CLI 必须调用 canonical raw proof writer');
    assert(!/\b(?:writeFileSync|renameSync)\s*\(/.test(cliSource),
      'raw CLI 禁止自建第二套直接写/rename 协议');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
