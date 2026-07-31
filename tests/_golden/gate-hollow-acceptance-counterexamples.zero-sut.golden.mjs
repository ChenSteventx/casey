#!/usr/bin/env node
// 门禁空心验收反例钉（红先行）—— 契约 hollow-acceptance-audit-and-gate-nails。
//
// 钉住 loop-kit/bin/gate.mjs 四个让「验收面被掏空或失效」照样翻绿的机制口子。四钉断言的都是
// 【应然】行为；应然目前不成立，所以本金牌现在必须是红的。第三步修完门禁后它自然转绿。
//
// 本金牌【不修】gate.mjs——先有反例才有资格改门禁。也【不得】被挂进任何 prd 的 acceptance，
// 挂进去会让承载它的 story 立刻转红，那属于处置，是第二步与第三步的活。
//
// 零 SUT：每钉在系统临时目录里造一个合成最小根（只含 loop/config.json、合成契约与两个平凡退出码
// 脚本），用 LOOP_KIT_ROOT 把真 gate.mjs 二进制指过去执行。不启动夹具 SUT、不启动浏览器、
// 不读 .auth/ 与 site.json、不写真仓任何文件（对真仓只读一次 loop/prd.schema.json 取 minItems 声明）。
// 判红只信退出码与 gate.mjs 自己的输出，不 grep 失败标记串。
//
// 义务出处：docs/plans/isolated-golden-acceptance-revocation/hollow-acceptance-audit.md
// 与 CONSULT-sol-max-hollow-acceptance.md 第 4 节。

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const NAME = 'gate-hollow-acceptance';

const failures = [];
const fail = (nail, message) => failures.push(`${nail}  ${message}`);
const notes = [];

// ── gate.mjs 定位 ─────────────────────────────────────────────
// 必须打到【独立包】的真实现，不能打到消费树内的薄转发层：转发层把 ROOT 硬钉成自己所在的消费树
// （boot.mjs 的 TREE_ROOT 由 shim 自身位置推出、并以显式参数认领），LOOP_KIT_ROOT 指不动它，
// 合成根会被无声忽略、gate 转而去读真仓契约并以 exit 64 收场——那正是本轮实测踩到的假绿口。
// 拓扑约定同 boot.mjs：LOOP_KIT_PKG 优先，否则消费树的兄弟目录 ../loop-kit。
const isShim = (p) => { try { return /lib\/boot\.mjs/.test(readFileSync(p, 'utf8')); } catch { return true; } };
const GATE = [
  process.env.LOOP_KIT_PKG ? join(process.env.LOOP_KIT_PKG, 'bin', 'gate.mjs') : null,
  join(ROOT, '..', 'loop-kit', 'bin', 'gate.mjs'),
].filter(Boolean).find((p) => existsSync(p) && !isShim(p));

if (!GATE) {
  console.error(`RED  ${NAME}: 找不到独立包的 gate.mjs 真实现（试过 LOOP_KIT_PKG 与兄弟目录 ../loop-kit；消费树内的薄转发层不可用，它无法被 LOOP_KIT_ROOT 重定向）`);
  process.exit(64);
}

const roots = [];
function makeRoot(prd) {
  const root = mkdtempSync(join(tmpdir(), 'gate-hollow-nail-'));
  roots.push(root);
  mkdirSync(join(root, 'loop'), { recursive: true });
  writeFileSync(join(root, 'loop', 'config.json'), JSON.stringify({
    schemaVersion: 1,
    qualityGate: { prd: 'loop/prd-nail.json', termLint: false, commandTimeoutMs: 60000 },
  }, null, 2) + '\n');
  writeFileSync(join(root, 'ok.mjs'), 'process.exit(0);\n');
  writeFileSync(join(root, 'ok2.mjs'), 'process.exit(0);\n');
  writeFileSync(join(root, 'loop', 'prd-nail.json'), JSON.stringify(prd, null, 2) + '\n');
  return root;
}

function runGate(root) {
  const r = spawnSync(process.execPath, [GATE, '--prd', 'loop/prd-nail.json'], {
    cwd: root, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, LOOP_KIT_ROOT: root },
  });
  let prd = null;
  try { prd = JSON.parse(readFileSync(join(root, 'loop', 'prd-nail.json'), 'utf8')); } catch { /* 保持 null */ }
  return { status: r.status, stdout: String(r.stdout || ''), stderr: String(r.stderr || ''), prd };
}

const story = (over = {}) => ({ id: 's1', desc: '合成钉用 story', lane: 'toil', acceptance: ['node ok.mjs'], passes: false, ...over });
const prdOf = (over = {}) => ({ id: 'nail', title: '合成钉用契约', stories: [story()], ...over });

// 通用前提闸：gate.mjs 只有一路跑到底才会打印收尾摘要行 `gate: GREEN|RED —— story x/y 过`。
// 缺这行说明工装没把 gate 送进被测路径（合成根没生效、包缺失、引导失败等），此时任何「钉子没报红」
// 都是假绿。本轮实测：转发层无声吃掉 LOOP_KIT_ROOT → gate exit 64 → N1/N2/N3 三钉全部静默「通过」。
// 所以前提不成立一律当红报出，绝不让它冒充绿。
function harnessOk(nail, g) {
  if (/gate:\s*(GREEN|RED)/.test(g.stdout)) return true;
  fail(nail, `工装前提不成立：gate 未跑到收尾摘要行（exit ${g.status}）。stdout=${JSON.stringify(g.stdout.slice(0, 200))} stderr=${JSON.stringify(g.stderr.slice(0, 200))}`);
  return false;
}

try {
  // ── N1 空验收数组不得翻绿 ─────────────────────────────────────
  // schema 已写 minItems: 1，但门禁根本不校验 schema；循环从 storyGreen=true 起步，空数组真空翻绿。
  {
    let schemaDeclaresMinItems = false;
    try {
      const s = JSON.parse(readFileSync(join(ROOT, 'loop', 'prd.schema.json'), 'utf8'));
      schemaDeclaresMinItems = s?.properties?.stories?.items?.properties?.acceptance?.minItems === 1;
    } catch { /* 读不到就当未声明 */ }
    if (!schemaDeclaresMinItems) notes.push('N1 旁证：未在 loop/prd.schema.json 读到 acceptance 的 minItems: 1 声明（钉子仍按应然断言）');

    const g = runGate(makeRoot(prdOf({ stories: [story({ acceptance: [] })] })));
    const passes = g.prd?.stories?.[0]?.passes;
    if (!harnessOk('N1', g)) { /* 前提已报红，不再叠加误导性判定 */ } else if (g.status === 0) {
      fail('N1', `空 acceptance 数组时门禁应判红，实测 exit ${g.status}（schema minItems:1 声明存在=${schemaDeclaresMinItems}，门禁从不校验 schema）`);
    }
    if (passes === true) {
      fail('N1', `空 acceptance 数组不得让 story 翻绿，实测 passes 被写成 true，evidence=${JSON.stringify(g.prd?.stories?.[0]?.evidence)}`);
    }
  }

  // ── N2 空 stories 不得让门禁报 GREEN ──────────────────────────
  // 挂账（本步不判、留待人裁）：现役有 8 份 stories 为空的 prd
  // （prd-replay-admission-hermetic-migration 与 7 份 prd-tc_*），它们是用例级校验和登记账、
  // 不是可执行质量契约。本钉的断言对象是【合成契约】，不是那 8 份，本步不判它们违规。
  // 待裁问题：门禁没有任何字段可机械区分「可执行质量契约」与「登记账」，于是对二者一视同仁。
  // 收口方向应是给 prd 加显式类型字段把登记账分出去，而不是给空数组判据开例外。
  {
    const g = runGate(makeRoot(prdOf({ stories: [] })));
    const reportedGreen = /gate:\s*GREEN/.test(g.stdout);
    if (!harnessOk('N2', g)) { /* 前提已报红 */ } else if (g.status === 0 && reportedGreen) {
      fail('N2', `stories 为空数组时门禁不得报 GREEN，实测 exit ${g.status} 且输出含 "gate: GREEN"（story 0/0 过）`);
    }
  }

  // ── N3 全局红时不得给 story 回写有效 true ─────────────────────
  // 测试棘轮或术语检查已红时 red 置真，但 story 回写只看 storyGreen、完全不看全局 red。
  {
    const g = runGate(makeRoot(prdOf({
      testChecksums: { 'ok.mjs': '0'.repeat(64) }, // 故意错的摘要 → 棘轮判红
      stories: [story({ acceptance: ['node ok.mjs'] })],
    })));
    const passes = g.prd?.stories?.[0]?.passes;
    if (!harnessOk('N3', g)) { /* 前提已报红 */ } else if (g.status === 0) {
      fail('N3', `棘轮摘要不符时门禁应判红，实测 exit ${g.status}——钉子前提不成立，须先修本钉自身`);
    } else if (passes === true) {
      fail('N3', `全局判红（exit ${g.status}）时不得给 story 回写有效 true，实测 passes=true、evidence=${JSON.stringify(g.prd?.stories?.[0]?.evidence)}`);
    }
  }

  // ── N4 验收变更后旧 passes/evidence 应失效 ────────────────────
  // evidence 现在只有时间戳、不绑验收命令的摘要；b3bee6b 删掉验收命令却保留旧 true 正是本条的实例。
  {
    const accA = ['node ok.mjs'];
    const accB = ['node ok2.mjs', 'node ok.mjs'];
    const gA = runGate(makeRoot(prdOf({ stories: [story({ acceptance: accA })] })));
    const gB = runGate(makeRoot(prdOf({ stories: [story({ acceptance: accB })] })));
    const evA = String(gA.prd?.stories?.[0]?.evidence ?? '');
    const evB = String(gB.prd?.stories?.[0]?.evidence ?? '');

    const ok = [harnessOk('N4', gA), harnessOk('N4', gB)].every(Boolean);
    if (!ok) { /* 前提已报红 */ } else if (gA.status !== 0 || gB.status !== 0) {
      fail('N4', `钉子前提不成立：两个合成绿契约应 exit 0，实测 ${gA.status} / ${gB.status}`);
    } else {
      // N4a：evidence 应含验收数组的摘要，否则「验收变了」无从被机器发现。
      const digestA = createHash('sha256').update(JSON.stringify(accA)).digest('hex');
      if (!evA.includes(digestA.slice(0, 12))) {
        fail('N4a', `evidence 应绑验收数组摘要（前 12 位 ${digestA.slice(0, 12)}）才能在验收变更后失效，实测 evidence=${JSON.stringify(evA)} 不含任何验收摘要`);
      }
      // N4b：验收面完全不同的两条 story，evidence 去掉时间戳后不得逐字节相同。
      const strip = (s) => s.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/, '<ts>');
      if (strip(evA) === strip(evB)) {
        fail('N4b', `两条验收面不同的 story，evidence 去时间戳后逐字节相同（${JSON.stringify(strip(evA))}）——evidence 与验收内容零绑定，旧绿永不失效`);
      }
    }
  }
} finally {
  for (const r of roots) { try { rmSync(r, { recursive: true, force: true }); } catch { /* 临时目录清理失败不影响判定 */ } }
}

for (const n of notes) console.log(`note ${NAME}: ${n}`);
if (failures.length) {
  for (const m of failures) console.error(`RED  ${NAME}: ${m}`);
  console.error(`RED  ${NAME}: ${failures.length} 处机制缺口未修——本金牌为红先行反例，现在红是正确结果`);
  process.exit(1);
}
console.log(`ok   ${NAME}: 四钉全绿——空验收/空 stories/全局红回写/evidence 绑定四个口子已闭`);
