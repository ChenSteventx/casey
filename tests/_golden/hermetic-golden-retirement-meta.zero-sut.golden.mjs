#!/usr/bin/env node
// zero-SUT acceptance：先机械确认规范墓碑，才允许 spawn；旧行为 body 永不执行。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE_ROOT = join(ROOT, 'tests/_golden/fixtures/hermetic-golden-retired');
const OBLIGATIONS = join(FIXTURE_ROOT, 'source-obligations.json');
const RECEIPTS = join(FIXTURE_ROOT, 'retirement-receipts.json');
const MARKER = 'HERMETIC_GOLDEN_RETIRED_TO_REAL_UAT_TOMBSTONE';
const failures = [];
let passed = 0;

function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}

function assertCanonicalTombstone(source) {
  const normalized = source.replaceAll('\r\n', '\n');
  if (!normalized.includes(MARKER)) throw new Error('marker 缺失');
  if (/\b(?:import|export|require|await|async|function|class|new)\b/.test(normalized)) throw new Error('墓碑含可执行扩展语法');
  if (/\b(?:fs|child_process|http|https|net|playwright|chromium|firefox|webkit)\b/.test(normalized)) throw new Error('墓碑含 I/O 或浏览器能力');
  const statements = normalized.split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#!') && !line.startsWith('//'));
  if (statements.length !== 2
    || !/^console\.error\(['"][^'"]+['"]\);?$/.test(statements[0])
    || !/^process\.exit\(78\);?$/.test(statements[1])) {
    throw new Error('墓碑体不符合 console.error + exit 78 两语句模板');
  }
}

check('规范墓碑判据的突变电池逐个必红', () => {
  const valid = `#!/usr/bin/env node\n// ${MARKER}\nconsole.error('retired to named successor');\nprocess.exit(78);\n`;
  assertCanonicalTombstone(valid);
  const mutations = [
    valid.replace(MARKER, 'MARKER_REMOVED'),
    valid.replace('process.exit(78)', 'process.exit(0)'),
    valid.replace("console.error('retired to named successor');", "import 'node:fs';\nconsole.error('retired to named successor');"),
    valid.replace("console.error('retired to named successor');", "process.stdout.write('side effect');\nconsole.error('retired to named successor');"),
  ];
  for (const source of mutations) {
    let rejected = false;
    try { assertCanonicalTombstone(source); } catch { rejected = true; }
    if (!rejected) throw new Error('墓碑突变未被拒绝');
  }
});

check('退役闭集只含 full/retire，归档与收据血缘逐项闭合', () => {
  if (!existsSync(OBLIGATIONS) || !existsSync(RECEIPTS)) throw new Error('退役 fixtures 尚未实现');
  const obligations = JSON.parse(readFileSync(OBLIGATIONS, 'utf8')).obligations;
  const receipts = JSON.parse(readFileSync(RECEIPTS, 'utf8')).receipts;
  if (!Array.isArray(obligations) || !Array.isArray(receipts)) throw new Error('fixtures 形状错误');
  const retired = obligations.filter((entry) => entry.lifecycle === 'retire');
  if (retired.some((entry) => entry.coverageRelation !== 'full')) throw new Error('非 full 义务偷进 retire');
  const byId = new Map(retired.map((entry) => [entry.obligationId, entry]));
  if (byId.size !== retired.length || receipts.length !== retired.length) throw new Error('退役闭集数量/唯一性不等');
  for (const receipt of receipts) {
    const obligation = byId.get(receipt.obligationId);
    if (!obligation) throw new Error(`收据无源义务 ${receipt.obligationId}`);
    if (receipt.ratchetStatus !== 'superseded-tombstoned-not-pass') throw new Error('收据状态不是 not-pass');
    const executable = join(ROOT, receipt.executablePath);
    const archive = join(ROOT, receipt.archivePath);
    if (!existsSync(executable) || !existsSync(archive)) throw new Error('墓碑或归档缺失');
    const source = readFileSync(executable, 'utf8');
    assertCanonicalTombstone(source);
    const original = gunzipSync(readFileSync(archive));
    if (sha(original) !== receipt.originalSha256 || sha(original) !== obligation.originalFileSha256) throw new Error('原字节摘要不闭合');
    if (sha(source) !== receipt.tombstoneSha256) throw new Error('墓碑摘要不闭合');
    const result = spawnSync(process.execPath, [executable], { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
    if (result.error || result.status !== 78) throw new Error(`墓碑未 exit 78: ${receipt.executablePath}`);
  }
});

if (failures.length) {
  console.error(`\nhermetic retirement meta: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nhermetic retirement meta: ${passed}/2 passed`);
