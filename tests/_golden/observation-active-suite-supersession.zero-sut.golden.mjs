#!/usr/bin/env node
// zero-SUT coverage-freeze：保留旧 safe v2 的有效断言，机器化说明 production 11/17 与 test publication 16/17。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SAFE_V2 = join(ROOT, 'tests/_golden/teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs');
const LOADER = join(ROOT, 'tests/_golden/fixtures/observation-runtime-trust-root/test-driver-publication-loader.mjs');
const suite = JSON.parse(readFileSync(new URL('./fixtures/observation-runtime-trust-root/active-suite.json', import.meta.url), 'utf8'));

function run(args) {
  // SAFE_V2 在 9p/DrvFs（WSL /mnt/d）主树实测 ~47s（isolated ~61s），旧 30s timeout 确定性 ETIMEDOUT。
  // 放宽到 180s 留 DrvFs 裕度（慢观测 61s + 9p 尖峰 + 机器负载）；耗时主体是 ~20 轮 canonical 循环，非 SUT。
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
function assertIds(output, prefix, ids, label) {
  for (const id of ids) if (!output.includes(`${prefix} ${id} `)) throw new Error(`${label} 缺 ${prefix.trim()} ${id}`);
}

if (suite?.historicalPassesMutation !== 'forbidden') throw new Error('历史 PRD mutation policy 漂移');
const production = run([SAFE_V2]);
if (production.status !== 1 || !production.output.includes('11 过 / 6 失败')) {
  throw new Error(`production default 非精确 11/17: exit=${production.status}`);
}
assertIds(production.output, 'ok  ', suite.productionDefault.retainedAssertions, 'production retained');
assertIds(production.output, 'FAIL', suite.productionDefault.supersededAssertions, 'production superseded');
console.log('ok   active production default 明示 11/17，保留 11 个非空断言');

const isolated = run(['--experimental-loader', LOADER, SAFE_V2]);
if (isolated.status !== 1 || !isolated.output.includes('16 过 / 1 失败')) {
  throw new Error(`isolated test publication 非精确 16/17: exit=${isolated.status}`);
}
assertIds(isolated.output, 'ok  ', suite.isolatedTestPublication.retainedKeyAssertions, 'isolated retained key');
assertIds(isolated.output, 'FAIL', ['D7'], 'isolated revoked checksum');
console.log('ok   isolated test publication 明示 16/17，key 相关 5 个断言继续执行');

const replacements = Object.keys(suite.replacementMap || {}).sort().join(',');
if (replacements !== 'D2,D3,D6,D7,T6,T8') throw new Error('replacementMap 不闭合');
if (suite.isolatedTestPublication.testKeyProductionEligible !== false
  || suite.revokedExecutablesNeverRun?.length !== 2) throw new Error('active suite 安全声明不闭合');
console.log('ok   replacement map 闭合；旧 PRD 历史不改；撤销 executable 不进入 active suite');
console.log('\nobservation active-suite supersession: 3/3 passed (coverage-freeze)');
