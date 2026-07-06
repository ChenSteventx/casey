// caseid-echo-mask.golden.mjs —— 姊妹 CLI 拒绝分支原值回显封缝（direct）红金牌。实现前六处全红（现回显原值）。
// 缝（ingest 契约 codex R2-F2 同族）：CLI 参数在凭据兜底门扫描面外（门只扫「将写的文本」），
// 非法参数拒绝分支把原值打进 stderr 即泄漏面。修法镜像 bin/ingest.mjs:29：只报字符集 + 原值不回显。
// 六处闸序全 args-first（读任何文件之前）——假路径直打拒绝分支即可，无需真产物。
// C1 compile caseId；C2 draft caseId；C3 flow-bridge caseId；C4 sign caseId；C5 sign signer；C6 sign against-build。
// 各断言三件：exit 65（拒绝分支、非读文件失败）+ 输出含「非法字符"（打中该闸）+ 不含哨兵（不回显）。
import { mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BIN = (n) => join(ROOT, 'bin', n);
const tmp = mkdtempSync(join(tmpdir(), 'casey-echo-mask-'));
const DUMMY = join(tmp, 'no-such-file.json'); // 闸序 args-first：假路径不会先被读

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-300)}`); } }
function run(args) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000 }); }

const SENTINEL = 'hunter2'; // 哨兵片段：断言绝不出现在任何输出通道
function assertMasked(r, label) {
  if (r.status !== 65) throw new Error(`${label} 应 exit 65（拒绝分支），实际 ${r.status}`);
  const out = (r.stdout || '') + (r.stderr || '');
  if (!out.includes('非法字符')) throw new Error(`${label} 应点名「非法字符」（证打中该闸非旁路）`);
  if (out.includes(SENTINEL)) throw new Error(`${label} 回显了原值哨兵（CLI 参数在凭据门扫描面外，不得回显）`);
}

// ---------- C1 compile caseId ----------
check('C1 compile 非法 caseId 拒绝分支不回显原值', () => {
  assertMasked(run([BIN('compile.mjs'), `x=${SENTINEL}`, '--testcase', DUMMY, '--flow', DUMMY, '--out-dir', tmp]), 'compile');
});

// ---------- C2 draft caseId ----------
check('C2 draft 非法 caseId 拒绝分支不回显原值', () => {
  assertMasked(run([BIN('draft.mjs'), `x=${SENTINEL}`, '--observed', DUMMY, '--compile-report', DUMMY, '--out-dir', tmp]), 'draft');
});

// ---------- C3 flow-bridge caseId ----------
check('C3 flow-bridge 非法 caseId 拒绝分支不回显原值', () => {
  assertMasked(run([BIN('flow-bridge.mjs'), `x=${SENTINEL}`, '--testcase', DUMMY, '--mapping', DUMMY, '--out-dir', tmp]), 'flow-bridge');
});

// ---------- C4/C5/C6 sign caseId / signer / against-build ----------
const signBase = (caseId, signer, build) => [BIN('sign.mjs'), caseId, '--draft', DUMMY, '--prd', DUMMY, '--frozen-out', join(tmp, 'expected.frozen.json'), '--signer', signer, '--against-build', build];
check('C4 sign 非法 caseId 拒绝分支不回显原值', () => {
  assertMasked(run(signBase(`x=${SENTINEL}`, 'Steven', '1.1.2')), 'sign caseId');
});
check('C5 sign 非法 signer 拒绝分支不回显原值', () => {
  assertMasked(run(signBase('tc_ok', `a/${SENTINEL}`, '1.1.2')), 'sign signer');
});
check('C6 sign 非法 against-build 拒绝分支不回显原值', () => {
  assertMasked(run(signBase('tc_ok', 'Steven', `../${SENTINEL}`)), 'sign against-build');
});

console.log(`caseid-echo-mask golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
