#!/usr/bin/env node
// 冻结黄金标准（sign 生成路径 · 契约类别字段 · 零 SUT hermetic）——红先行反例钉。
//
// 被证义务（Steven 2026-07-31 裁定「加显式类型字段」的配套第 3 条）：
//   bin/sign.mjs 是真机人签登记账的【生成路径】。它产出的 prd 恒为「sv2 + caseId + 空 stories」
//   （HANDOFF.md 已锁纪律），属登记账、无可执行义务。生成时必须显式写 contractKind=registry，
//   否则 sign 会持续造出没有类别字段的新件，质量门禁只能靠形状猜——这正是本轮要堵的口。
//
// 红线（本金牌一并钉住）：类别字段【只决定门禁调哪套校验，绝不授予绿】。故本金牌除了断言字段被
//   写出，还要断言【被写出的那份 prd 拿去喂真 gate.mjs 时是 exit 64、不是 exit 0】——只验字段
//   写没写是纯字符串断言，证不了这个字段没被做成后门。
//
// 零 SUT：只 spawn 真 bin/sign.mjs 与真 gate.mjs，全部产物落系统临时目录；不启夹具 SUT、不启
//   浏览器、不读 .auth/ 与 site.json、不写真仓任何文件。判红只信退出码与产物字节。
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const FIX = join(HERE, 'fixtures', 'seams', 'expected-draft.fixture.json');
const NAME = 'sign-contract-kind';
// caseId 必须与冻结夹具一致——sign 有 caseId 端到端绑定门（bin/sign.mjs 拒不一致），
// 不许为了跑通把夹具改成迁就本钉：复现既有接缝，不倒着裁夹具。
const CASE_ID = 'tc_sign_probe';

const failures = [];
const fail = (nail, msg) => failures.push(`${nail}  ${msg}`);
const tmp = mkdtempSync(join(tmpdir(), 'casey-sign-kind-'));
const roots = [tmp];

// gate.mjs 定位：必须打到独立包的真实现，主动拒绝消费树内的薄转发层（转发层按自身位置认领根、
// LOOP_KIT_ROOT 指不动它）。读不出内容一律当转发层（fail-closed）。
const isShim = (p) => {
  try { const s = readFileSync(p, 'utf8'); return /lib\/boot\.mjs/.test(s) || /boot\.runCli/.test(s); }
  catch { return true; }
};
const GATE = [
  process.env.LOOP_KIT_PKG ? join(process.env.LOOP_KIT_PKG, 'bin', 'gate.mjs') : null,
  join(ROOT, '..', 'loop-kit', 'bin', 'gate.mjs'),
].filter(Boolean).find((p) => existsSync(p) && !isShim(p));

try {
  if (!existsSync(FIX)) {
    fail('S0', `工装前提不成立：缺 draft 夹具 ${FIX}`);
  } else {
    // ── S1 sign 产出的 prd 必须带 contractKind=registry ────────────────
    const prdPath = join(tmp, `prd-${CASE_ID}.json`);
    const frozenOut = join(tmp, 'expected.frozen.json');
    writeFileSync(prdPath, JSON.stringify({
      schemaVersion: 2, caseId: CASE_ID, task: 'sign 契约类别钉', testChecksums: {}, stories: [],
    }, null, 2) + '\n');

    const r = spawnSync(process.execPath, [
      SIGN, CASE_ID, '--draft', FIX, '--prd', prdPath, '--frozen-out', frozenOut,
      '--signer', 'qa.probe', '--against-build', 'probe-b1', '--signed-at', '2026-07-31T00:00:00.000Z',
    ], { encoding: 'utf8', timeout: 60000 });

    if (r.status !== 0) {
      fail('S1', `工装前提不成立：sign 应 exit 0，实测 ${r.status}。stderr=${String(r.stderr || '').slice(-300)}`);
    } else {
      let signed = null;
      try { signed = JSON.parse(readFileSync(prdPath, 'utf8')); } catch { /* 保持 null */ }
      if (!signed) {
        fail('S1', 'sign 之后 prd 读不出/不是合法 JSON');
      } else {
        if (signed.contractKind !== 'registry') {
          fail('S1', `sign 生成路径必须写 contractKind=registry，实测 ${JSON.stringify(signed.contractKind)}——不写这个字段，门禁只能靠形状猜，sign 会持续造出无类别的新件`);
        }
        // 形状旁证：确认这确实是登记账形状（空 stories + expectedFrozenPath），否则上面那条断言
        // 可能是在给一份根本不是登记账的东西盖章。
        if (!Array.isArray(signed.stories) || signed.stories.length !== 0) {
          fail('S1', `工装前提不成立：sign 产物应为空 stories 的登记账，实测 stories=${JSON.stringify(signed.stories)}`);
        }
        if (typeof signed.expectedFrozenPath !== 'string') {
          fail('S1', '工装前提不成立：sign 产物应带 expectedFrozenPath');
        }

        // ── S2 红线：sign 产出的登记账喂给真 gate 必须 exit 64，绝不 exit 0 ──
        // 只断言「字段写出来了」证不了它没被做成后门；必须实测这份产物在门禁里拿不到绿。
        if (!GATE) {
          fail('S2', '工装前提不成立：找不到独立包的 gate.mjs 真实现（试过 LOOP_KIT_PKG 与兄弟目录 ../loop-kit；消费树内的薄转发层不可用）');
        } else {
          const groot = mkdtempSync(join(tmpdir(), 'casey-sign-kind-gate-'));
          roots.push(groot);
          mkdirSync(join(groot, 'loop'), { recursive: true });
          writeFileSync(join(groot, 'loop', 'config.json'), JSON.stringify({
            schemaVersion: 1,
            qualityGate: { prd: 'loop/prd-signed.json', termLint: false, commandTimeoutMs: 60000 },
          }, null, 2) + '\n');
          // 原样搬运 sign 的产物，但把 testChecksums 清空——本钉证的是【类别分流】，
          // 不是棘轮；留着指向临时目录的冻结项会让 gate 因文件缺失走别的红路，钉子就不纯了。
          writeFileSync(join(groot, 'loop', 'prd-signed.json'),
            JSON.stringify({ ...signed, testChecksums: {} }, null, 2) + '\n');

          const g = spawnSync(process.execPath, [GATE, '--prd', 'loop/prd-signed.json'], {
            cwd: groot, encoding: 'utf8', timeout: 120000,
            env: { ...process.env, LOOP_KIT_ROOT: groot, LOOP_KIT_PKG: undefined },
          });
          if (g.status === 0) {
            fail('S2', `红线破了：sign 产出的登记账在门禁里拿到 exit 0——类别字段成了后门。stdout=${JSON.stringify(String(g.stdout || '').slice(0, 300))}`);
          } else if (g.status !== 64) {
            fail('S2', `sign 产出的登记账应判 exit 64（登记账不进质量门禁），实测 exit ${g.status}。stdout=${JSON.stringify(String(g.stdout || '').slice(0, 300))}`);
          }
          if (/gate:\s*GREEN/.test(String(g.stdout || ''))) {
            fail('S2', '登记账不得让门禁打印 gate: GREEN');
          }
        }
      }
    }
  }
} finally {
  for (const r of roots) { try { rmSync(r, { recursive: true, force: true }); } catch { /* 清理失败不影响判定 */ } }
}

if (failures.length) {
  for (const m of failures) console.error(`RED  ${NAME}: ${m}`);
  console.error(`RED  ${NAME}: ${failures.length} 处未闭`);
  process.exit(1);
}
console.log(`ok   ${NAME}: sign 生成路径写 contractKind=registry，且其产物在真门禁里 exit 64——字段只分流、不授绿`);
