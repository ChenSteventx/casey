#!/usr/bin/env node
// plan-debt-sweep 的纯后继：sign 冻结 lint 与术语注册表；不启动/连接 SUT、浏览器或 listener。
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// sourceObligationId:hg-plan-debt-sweep-c2 unitCheckId:plan-debt-sweep-unit-c2
// lifecycle-successor: {"sourceObligationId":"hg-plan-debt-sweep-c2","unitCheckId":"plan-debt-sweep-unit-c2"}
// sourceObligationId:hg-plan-debt-sweep-c3 unitCheckId:plan-debt-sweep-unit-c3
// lifecycle-successor: {"sourceObligationId":"hg-plan-debt-sweep-c3","unitCheckId":"plan-debt-sweep-unit-c3"}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-plan-debt-sweep-unit-'));
const failures = [];
let passed = 0;

function run(args) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000 });
}
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}
async function check(unitCheckId, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${unitCheckId}`);
  } catch (error) {
    failures.push(`${unitCheckId}: ${String(error?.message || error).slice(-500)}`);
  }
}

await check('plan-debt-sweep-unit-c2', () => {
  const mkDraft = (value, name) => writeJson(join(tmp, name), {
    caseId: 'tc_debt_sweep',
    intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value, soft: false }] }],
    globalAssertions: [], pending: [],
  });
  const mkPrd = (name) => writeJson(join(tmp, name), { schemaVersion: 2, caseId: 'tc_debt_sweep', task: '欠账清洗夹具', testChecksums: {}, stories: [] });
  const signArgs = (draft, prd, out) => [SIGN, 'tc_debt_sweep', '--draft', draft, '--prd', prd, '--frozen-out', out, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-07T00:00:00.000Z'];
  const badLiteral = join(tmp, 'frozen-bad1.json');
  const first = run(signArgs(mkDraft('创建成功 atl_wf_a', 'd-bad1.json'), mkPrd('p-bad1.json'), badLiteral));
  if (first.status !== 65) throw new Error(`裸 atl_ 字面量应 sign exit 65（冻结期 lint），实际 ${first.status}`);
  if (existsSync(badLiteral)) throw new Error('lint 拒应零落盘');
  const second = run(signArgs(mkDraft('单号 1234567890 已生成', 'd-bad2.json'), mkPrd('p-bad2.json'), join(tmp, 'frozen-bad2.json')));
  if (second.status !== 65) throw new Error(`9+ 位数字长串应 sign exit 65，实际 ${second.status}`);
  const third = run(signArgs(mkDraft('新增 atl_{{uniqueName}} 成功', 'd-ok.json'), mkPrd('p-ok.json'), join(tmp, 'frozen-ok.json')));
  if (third.status !== 0) throw new Error(`模板形态应照签 exit 0，实际 ${third.status}：${String(third.stderr || '').slice(-200)}`);
});

await check('plan-debt-sweep-unit-c3', () => {
  const lint = run([CASEY, 'lint', '--registry']);
  if (lint.status !== 0) throw new Error(`term-lint --registry 应 exit 0，实际 ${lint.status}`);
  const text = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8');
  const row = (name) => text.split('\n').find((line) => line.includes(`\`${name}\``) && line.startsWith('|'));
  const verdict = row('verdict.json');
  if (!verdict) throw new Error('CONTEXT 缺 verdict.json 词条');
  if (verdict.includes('passes')) throw new Error('verdict.json 词条不得再声称含 passes（冻结实现是最小五字段）');
  if (!verdict.includes('report-model')) throw new Error('verdict.json 词条应指明富信息在 report-model');
  const trace = row('trace');
  if (!trace?.includes('未建')) throw new Error('trace 词条应注明未建挂账');
  const recorder = text.split('\n').find((line) => line.includes('recorder-as-library') && line.startsWith('|'));
  if (!recorder?.includes('取代')) throw new Error('recorder-as-library 词条应标已被取代（ADR-0006）');
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`plan-debt-sweep unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`plan-debt-sweep unit: ${passed}/${passed} passed`);
