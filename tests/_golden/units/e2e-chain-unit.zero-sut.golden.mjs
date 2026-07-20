#!/usr/bin/env node
// e2e-chain 相0 ingest 的纯后继；不启动/连接 SUT、浏览器或 listener。
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// sourceObligationId:hg-e2e-chain-c1 unitCheckId:e2e-chain-unit-c1
// lifecycle-successor: {"sourceObligationId":"hg-e2e-chain-c1","unitCheckId":"e2e-chain-unit-c1"}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-e2e-chain-unit-'));
const CASE_ID = 'tc_e2e_chain';
const work = join(tmp, 'work');
const testcaseFile = join(work, `testcase-${CASE_ID}.json`);
const failures = [];
let passed = 0;

const candidate = {
  schemaVersion: 1, caseId: CASE_ID, title: '工作流创建保存（hermetic 全链）',
  source: { kind: 'freetext', raw: '在工作流管理里新增一条名为 atl_ 前缀的工作流（分类：测试分类）并保存，保存后不应出现错误提示' },
  preconditions: ['已登录'],
  steps: [
    { intentId: 'intent_create', intent: '新增工作流 atl_{{uniqueName}}（分类 测试分类）', actionHint: 'fill', inputValue: 'atl_{{uniqueName}}', uniqueGuard: true },
    { intentId: 'intent_save', intent: '保存工作流', actionHint: 'click' },
  ],
  uniquePrefix: 'atl_',
};
const deepEq = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}
const siteFile = writeJson(join(tmp, 'site.synthetic.json'), {});
const environment = { ...process.env, AT_SITE_JSON: siteFile, AT_CREDS_FILE: join(tmp, 'no-creds-here.json') };
delete environment.AT_CREDS_USER;
delete environment.AT_CREDS_PASS;
function run(args) {
  return spawnSync(process.execPath, args, { cwd: tmp, encoding: 'utf8', timeout: 120000, env: environment });
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

await check('e2e-chain-unit-c1', () => {
  const candidateFile = writeJson(join(tmp, 'candidate.json'), candidate);
  const result = run([CASEY, 'ingest', CASE_ID, '--in', candidateFile, '--out-dir', work]);
  if (result.status !== 0) throw new Error(`ingest 应 exit 0，实际 ${result.status}：${String(result.stderr || '').slice(-200)}`);
  const got = readJson(testcaseFile);
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(got.source.ingestedAt))) throw new Error(`ingestedAt 落章非法：${got.source.ingestedAt}`);
  const stripped = { ...got, source: Object.fromEntries(Object.entries(got.source).filter(([key]) => key !== 'ingestedAt')) };
  if (!deepEq(stripped, candidate)) throw new Error(`TestCase 产物须与候选逐字段深等（防归一静默丢字段），实际 ${JSON.stringify(stripped).slice(0, 300)}`);
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`e2e-chain unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`e2e-chain unit: ${passed}/${passed} passed`);
