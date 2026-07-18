#!/usr/bin/env node
// record-intake.golden.mjs —— 示教入账命令行门面 + trust-root 固定根 canonical 路径契约（record-intake，full）。
// 现役模型：intake 唯一成功路径是权威内核 appendAcceptedObservationPackage 的固定路径 signed append transaction
// （capture 必须落在 <PROJECT_ROOT>/cases/<caseId>/record-capture/teach-in-capture.json，同级完整三件套 + signed
//  driver readback receipt）。本金牌只锁命令行门面 fail-closed 面：门面参数校验、非规范布局拒、命令行层三件套预检
// 对缺件人话报错。固定根 + 完整签名三件套的跨进程 happy/off-root/拒账全套由 observation-cli-authority-wiring 金牌
// 覆盖，本金牌不重造。跑真命令行、hermetic（仅 tmpdir）；无浏览器、无网络、无 fake、无 fixture SUT。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const node = process.execPath;
const cli = join(ROOT, 'bin', 'casey.mjs');

function run(args, opts = {}) {
  return spawnSync(node, [cli, ...args], { cwd: ROOT, encoding: 'utf8', ...opts });
}
function fail(msg) { console.error(`record-intake golden failed: ${msg}`); process.exit(1); }
function assert(cond, msg) { if (!cond) fail(msg); }

// 最小合法示教 capture（happy accept 由 observation 金牌以完整签名三件套覆盖，本金牌只到命令行门面/三件套预检面）。
function minimalCapture(caseId = 'tc_x') {
  return JSON.stringify({
    schemaVersion: 1, artifactKind: 'teach-in-capture', caseId,
    createdAt: '2026-01-01T00:00:00.000Z', startPath: '/heren/aimanagement/process/list',
    source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
    events: [{ seq: 1, action: 'click', path: '/heren/aimanagement/process/list', text: '新增工作流' }],
  }, null, 2) + '\n';
}
// 规范同级布局 <dir>/<caseId>/record-capture/teach-in-capture.json（trailing 规范，落 tmpdir 即 off 固定根）。
function writeCanonicalTrailingCapture(dir, caseId) {
  const p = join(dir, caseId, 'record-capture', 'teach-in-capture.json');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, minimalCapture(caseId), 'utf8');
  return p;
}
function ledgerPathFor(capturePath) { return join(dirname(capturePath), 'intake-ledger.jsonl'); }

const tmp = mkdtempSync(join(tmpdir(), 'casey-record-intake-'));
try {
  // ── C1 门面：help 暴露命令 + 用法错 exit 64 + caseId 形状/凭据关键词 exit 65 ─────────────
  const helpSrc = readFileSync(cli, 'utf8');
  assert(helpSrc.includes('casey intake'), 'help 须暴露 casey intake');
  assert(run(['intake']).status === 64, 'intake 缺 caseId 须 exit 64');
  assert(run(['intake', 'tc_x']).status === 64, 'intake 缺 --capture 须 exit 64');
  {
    const cap = writeCanonicalTrailingCapture(join(tmp, 'shapeok'), 'tc_shape');
    assert(run(['intake', '../../escape', '--capture', cap]).status === 65, 'caseId ../.. 穿越须 exit 65');
    assert(run(['intake', 'a/b', '--capture', cap]).status === 65, 'caseId 含 / 须 exit 65');
    // caseId 含凭据关键词子串（合法 shape 但含 token）须清晰前置拒 exit 65，不 late 自触台账门。
    assert(run(['intake', 'tc_token_x', '--capture', cap]).status === 65, 'caseId 含凭据关键词须 exit 65');
  }

  // ── C2 非规范布局：capture 不在 <caseId>/record-capture/teach-in-capture.json → exit 65 预读拒、不越界写台账 ──
  {
    const stray = join(tmp, 'stray', 'teach-in-capture.json');
    mkdirSync(dirname(stray), { recursive: true });
    writeFileSync(stray, minimalCapture('tc_stray'), 'utf8');
    const r = run(['intake', 'tc_stray', '--capture', stray]);
    assert(r.status === 65, `C2 非规范布局须 exit 65，实得 ${r.status}`);
    assert(!existsSync(join(tmp, 'stray', 'intake-ledger.jsonl')), 'C2 非规范布局不得越界写台账');
  }

  // ── C3 命令行层三件套预检（红先行）：规范 trailing 布局但同级缺旁车/清单 → 命令行层以人话点名缺失三件套拒，
  //    不把权威内核码 CAPTURE_PATH_NOT_CANONICAL 原样透传。exit 65、零台账残留、零凭据、零裸协议前缀、不回显绝对路径。
  {
    const cap = writeCanonicalTrailingCapture(join(tmp, 'triad'), 'tc_triad'); // 仅 capture，无 identity-observations.json / teach-in-package.json
    const r = run(['intake', 'tc_triad', '--capture', cap]);
    const err = `${r.stderr || ''}${r.stdout || ''}`;
    assert(r.status === 65, `C3 缺三件套须 exit 65，实得 ${r.status}`);
    assert(err.includes('identity-observations.json'),
      'C3 命令行层须点名缺失的示教三件套旁车 identity-observations.json（非把内核码原样透传）');
    assert(!err.includes('CAPTURE_PATH_NOT_CANONICAL'),
      'C3 须由命令行层三件套预检拒（点名旁车），而非权威内核 CAPTURE_PATH_NOT_CANONICAL 透传');
    assert(!existsSync(ledgerPathFor(cap)), 'C3 缺三件套不得留 accepted 台账残留');
    assert(!err.includes('://'), 'C3 报错全文不得含裸协议前缀');
    assert(!/[Pp]assword|[Ss]ecret|凭据值/.test(err) && !/token=/i.test(err), 'C3 报错全文不得含凭据');
    assert(!err.includes(tmp), 'C3 报错不得回显 tmp 绝对路径（output-seal 纪律）');
  }

  console.log('record-intake golden: GREEN');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
