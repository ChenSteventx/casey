#!/usr/bin/env node
// worktree-baton.golden.mjs —— worktree 化 baton 并行漂移锁（worktree-baton，full）红金牌。
// 复现真接缝（memory「别倒着裁夹具、复现已冻接缝」）：驱真 loop-kit/bin/contract.mjs CLI + 真 git worktree。
// 纯函数层 hermetic 直测（isValidSlug/defaultWorktreePath/parseWorktreePorcelain/describeBaton/slugTaken）；
// 起树/list/隔离走真 git worktree，用完 worktree remove + branch -D 清理。
// 锁：G1 起树脚手架 / G2 slug 唯一硬拒 / G3 slug 穿越拒 / G4 跨树 list / G5 list 健壮降级 / G6 back-compat / G7 每树隔离。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../../loop-kit/bin/contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CLI = join(ROOT, 'loop-kit', 'bin', 'contract.mjs');
const node = process.execPath;
function fail(m) { console.error(`worktree-baton golden failed: ${m}`); cleanupAll(); process.exit(1); }
function assert(c, m) { if (!c) fail(m); }
// contract.mjs CLI（可带 env 隔离到临时槽，避免动真 active-contract.json）。
function run(args, env = {}) { return spawnSync(node, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } }); }
function git(args) { return spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }); }

// 固定测试名 + 起始/收尾双清（防崩溃残留卡住下轮 worktree add -b）。
const WT_A = 'wtb-selftest-a', WT_B = 'wtb-selftest-b', WT_BAD = 'wtb-selftest-bad';
const TESTS = [WT_A, WT_B, WT_BAD];
const wtPaths = [];
// 防御性清：守卫本该拒起这些 victim 落点（exit 3、零副作用），但若实现回归让它们落进仓内，也清干净。
const VICTIM_BRANCHES = ['victiminroot', 'victiminroot2', 'victimviasym', 'victimviamid'];
function cleanupAll() {
  for (const p of wtPaths) { try { git(['worktree', 'remove', '--force', p]); } catch { /* ignore */ } }
  for (const b of TESTS) { try { git(['worktree', 'remove', '--force', b]); } catch { /* ignore */ } try { git(['branch', '-D', b]); } catch { /* ignore */ } }
  for (const victim of ['subviasym', join('nomid', 'leaf'), 'nomid']) { try { git(['worktree', 'remove', '--force', join(ROOT, victim)]); } catch { /* ignore */ } }
  for (const b of VICTIM_BRANCHES) { try { git(['branch', '-D', b]); } catch { /* ignore */ } }
  try { git(['worktree', 'prune']); } catch { /* ignore */ }
}
cleanupAll(); // 起始清

const tmp = mkdtempSync(join(tmpdir(), 'casey-wtb-'));
try {
  // ══ 纯函数层（hermetic，零 git）══
  // G3 slug 校验：合法/非法边界
  assert(C.isValidSlug('foo-bar_1') === true, 'G3 合法 slug 应过');
  assert(C.isValidSlug('../evil') === false, 'G3 slug 含 .. 应拒');
  assert(C.isValidSlug('a/b') === false, 'G3 slug 含 / 应拒');
  assert(C.isValidSlug('') === false, 'G3 空 slug 应拒');

  // defaultWorktreePath：兄弟目录 ../<basename>-<slug>
  assert(C.defaultWorktreePath('/x/casey', 'foo') === resolve('/x/casey', '..', 'casey-foo'), 'defaultWorktreePath 兄弟目录');

  // R3-F1 containment 谓词：..name 仓内合法名不误判为外部（!startsWith('..') 经典假阴性，codex R3-F1）
  assert(C.isPathInsideRepo('/repo', '/repo/sub') === true, 'R3-F1 仓内子路径 → inside');
  assert(C.isPathInsideRepo('/repo', join('/repo', '..wt')) === true, 'R3-F1 ..name 仓内名 → inside（不误判外部）');
  assert(C.isPathInsideRepo('/repo', join('/repo', '...x')) === true, 'R3-F1 ...name 仓内名 → inside');
  assert(C.isPathInsideRepo('/repo', '/repo') === true, 'R3-F1 等于 root → inside');
  assert(C.isPathInsideRepo('/repo', '/repo-sib') === false, 'R3-F1 兄弟目录 → outside');
  assert(C.isPathInsideRepo('/repo', resolve('/repo', '..', 'other')) === false, 'R3-F1 真父级跳出 → outside');

  // parseWorktreePorcelain（G4/G5 解析牙，喂 fixture 文本）
  const porc = 'worktree /a/main\nHEAD abc\nbranch refs/heads/dev\n\nworktree /a/casey-foo\nHEAD def\nbranch refs/heads/foo\n\nworktree /a/casey-det\nHEAD 999\ndetached\n';
  const wl = C.parseWorktreePorcelain(porc);
  assert(wl.length === 3, `parseWorktreePorcelain 应解出 3 树，实得 ${wl.length}`);
  assert(wl[0].path === '/a/main' && wl[0].branch === 'dev', 'parse 主树 path/branch');
  assert(wl[1].path === '/a/casey-foo' && wl[1].branch === 'foo', 'parse 次树 path/branch');
  assert(wl[2].branch === null, 'parse detached 树 branch=null');

  // describeBaton（G5 健壮降级牙）
  assert(C.describeBaton(null).label === '(无活 baton)', 'describeBaton null → 无活 baton');
  assert(C.describeBaton('{坏json').label === '(坏契约)', 'describeBaton 坏 JSON → 坏契约 不抛');
  const good = C.describeBaton(JSON.stringify({ slug: 'foo', lane: 'full', stages: { grill: { done: true }, plan: { done: true }, accept: { done: false }, loop: { done: false }, review: { done: false }, learn: { done: false } } }));
  assert(good.slug === 'foo' && good.lane === 'full', 'describeBaton good → slug/lane');
  assert(good.ok === true, 'F3 合法契约 describeBaton.ok=true');
  assert(/foo/.test(good.label) && /2\/6/.test(good.label), `describeBaton good label 含 slug + 2/6，实得 ${good.label}`);
  // F3 合法 JSON 但坏 schema（{}/null/123/"hi"/[]/坏 lane）→ 坏契约、不计活 baton（codex R1-F3 + 同族兜底判据5）
  for (const bad of ['{}', 'null', '123', '"hi"', '[]', '{"slug":123}', '{"slug":"x","lane":"bad","stages":{}}']) {
    assert(C.describeBaton(bad).ok !== true, `F3 坏 schema 不计活 baton：${bad}`);
    assert(C.describeBaton(bad).label === '(坏契约)', `F3 坏 schema → 坏契约：${bad}`);
  }

  // slugTaken（D5 守卫牙，喂临时 root）
  const takenRoot = join(tmp, 'rootA'); mkdirSync(join(takenRoot, 'loop'), { recursive: true }); mkdirSync(join(takenRoot, 'docs', 'plans', 'occupied'), { recursive: true });
  writeFileSync(join(takenRoot, 'loop', 'prd-byprd.json'), '{}', 'utf8');
  assert(C.slugTaken(takenRoot, 'occupied') === true, 'slugTaken docs/plans/<slug> 存在 → true');
  assert(C.slugTaken(takenRoot, 'byprd') === true, 'slugTaken loop/prd-<slug>.json 存在 → true');
  assert(C.slugTaken(takenRoot, 'free') === false, 'slugTaken 未占用 → false');
  // F2 dangling symlink 目录项须算占用（lstat 非 existsSync——existsSync 跟随软链、对断链返 false 绕过守卫，codex R1-F2）
  symlinkSync('/nonexistent-target-xyz-abc-123', join(takenRoot, 'docs', 'plans', 'danglesym'));
  assert(C.slugTaken(takenRoot, 'danglesym') === true, 'F2 dangling symlink 目录项须算占用（守卫不被断链绕过）');

  // ══ CLI 层：守卫（不起真树，无副作用）══
  // G3 slug 穿越：contract worktree ../evil → 拒 exit 3、不起树
  assert(run(['worktree', '../evil', '--lane', 'light', '--reason', 'x']).status === 3, 'G3 CLI slug 穿越须 exit 3');
  assert(run(['worktree', 'a/b', '--lane', 'light', '--reason', 'x']).status === 3, 'G3 CLI slug 斜杠须 exit 3');
  // G2 slug 唯一硬拒：worktree-baton 本身有 docs/plans/worktree-baton/（+ 将有 prd）→ 拒 exit 3、不起树
  const g2 = run(['worktree', 'worktree-baton', '--lane', 'full', '--reason', 'x']);
  assert(g2.status === 3, `G2 已占用 slug 须硬拒 exit 3，实得 ${g2.status}`);
  assert(!existsSync(resolve(ROOT, '..', basename(ROOT) + '-worktree-baton')), 'G2 硬拒后不得起树');
  // F1 --path 落仓库内部须由守卫拒（防在主树嵌套建树污染共享命名空间，codex R1-F1）——用已存在的仓库内目录，
  // 守卫先于 existsSync/git，零污染；stderr「仓库内部」是唯有本修复才产的判别子（未修时是「落点已存在」）。
  const f1a = run(['worktree', 'victiminroot', '--lane', 'light', '--reason', 'x', '--path', join(ROOT, 'docs')]);
  assert(f1a.status === 3 && /仓库内部/.test(f1a.stderr), `F1 --path=<ROOT>/docs 须守卫拒（stderr 含仓库内部），实得 status=${f1a.status}`);
  const f1b = run(['worktree', 'victiminroot2', '--lane', 'light', '--reason', 'x', '--path', join(ROOT, 'loop')]);
  assert(f1b.status === 3 && /仓库内部/.test(f1b.stderr), 'F1 --path=<ROOT>/loop 须守卫拒');
  // R2-F1 软链父目录别名指回 ROOT：词法 relative 看着在仓外、放行，git 沿软链落回仓内污染——真实路径守卫须拒（codex R2-F1）
  const rootAlias = join(tmp, 'root-alias');
  symlinkSync(ROOT, rootAlias);
  const f1c = run(['worktree', 'victimviasym', '--lane', 'light', '--reason', 'x', '--path', join(rootAlias, 'subviasym')]);
  assert(f1c.status === 3 && /仓库内部/.test(f1c.stderr), `R2-F1 软链别名落点须真实路径守卫拒，实得 status=${f1c.status} stderr=${f1c.stderr}`);
  assert(!existsSync(join(ROOT, 'subviasym')), 'R2-F1 拒后不得经软链在仓内建 subviasym');
  // R3-F1#2 软链祖先 + 不存在中间目录：projectRealPath 须上溯 realpath 祖先投影，落回仓内仍拒（codex R3-F1 #2）
  const f1d = run(['worktree', 'victimviamid', '--lane', 'light', '--reason', 'x', '--path', join(rootAlias, 'nomid', 'leaf')]);
  assert(f1d.status === 3 && /仓库内部/.test(f1d.stderr), `R3-F1#2 软链祖先+缺中间目录落点须拒，实得 status=${f1d.status}`);
  assert(!existsSync(join(ROOT, 'nomid')), 'R3-F1#2 拒后不得经软链在仓内建 nomid');

  // ══ CLI 层：back-compat（env 隔离到临时槽，不动真 active-contract.json，G6）══
  const slot = join(tmp, 'bc-active.json');
  const env = { LOOP_CONTRACT_FILE: slot };
  assert(run(['init', 'bctest', '--lane', 'light', '--reason', 'back-compat 回归'], env).status === 0, 'G6 init 到隔离槽应 exit 0');
  assert(JSON.parse(readFileSync(slot, 'utf8')).slug === 'bctest', 'G6 init 写隔离槽 slug=bctest');
  const showj = JSON.parse(run(['show'], env).stdout);
  assert(showj.slug === 'bctest' && showj.stages.grill.done === false, 'G6 show 隔离槽状态一致');
  // 真 active-contract.json 未被污染（仍是 worktree-baton）
  assert(JSON.parse(readFileSync(join(ROOT, 'loop', 'active-contract.json'), 'utf8')).slug === 'worktree-baton', 'G6 真槽未被隔离测试污染');

  // ══ E2E 真 git worktree（G1 起树 + G7 隔离）══
  const pathA = join(tmp, 'wt-a');
  const r1 = run(['worktree', WT_A, '--lane', 'light', '--reason', 'e2e 起树', '--path', pathA]);
  wtPaths.push(pathA);
  assert(r1.status === 0, `G1 起树应 exit 0，实得 ${r1.status} stderr=${r1.stderr}`);
  assert(existsSync(join(pathA, 'loop', 'active-contract.json')), 'G1 新树须落 active-contract.json');
  assert(JSON.parse(readFileSync(join(pathA, 'loop', 'active-contract.json'), 'utf8')).slug === WT_A, 'G1 新树 baton slug 正确');
  // G7 隔离：起树未动主树 baton
  assert(JSON.parse(readFileSync(join(ROOT, 'loop', 'active-contract.json'), 'utf8')).slug === 'worktree-baton', 'G7 起树后主树 baton 仍 worktree-baton');

  // ══ E2E 跨树 list（G4 + G5）══
  const pathB = join(tmp, 'wt-b');
  const r2 = run(['worktree', WT_B, '--lane', 'full', '--reason', 'e2e list', '--path', pathB]);
  wtPaths.push(pathB);
  assert(r2.status === 0, `G4 第二树起树应 exit 0，stderr=${r2.stderr}`);
  // 坏契约树：手造一棵 worktree、塞坏 JSON active-contract（验 list 降级不崩）
  const pathBad = join(tmp, 'wt-bad');
  assert(git(['worktree', 'add', '-b', WT_BAD, pathBad, 'HEAD']).status === 0, 'G5 前置 worktree add 应成功');
  wtPaths.push(pathBad);
  writeFileSync(join(pathBad, 'loop', 'active-contract.json'), '{坏 json 不合法', 'utf8');
  const lst = run(['list']);
  assert(lst.status === 0, `G4 list 应 exit 0，stderr=${lst.stderr}`);
  assert(lst.stdout.includes(WT_A) && lst.stdout.includes(WT_B), 'G4 list 须列出两并行 baton slug');
  assert(/坏契约/.test(lst.stdout), 'G5 list 遇坏契约树须降级显示（坏契约）不崩');
  assert(/worktree|baton/i.test(lst.stdout), 'G4 list 应含汇总/表头');

  console.log('worktree-baton golden: GREEN');
  cleanupAll();
  rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
} catch (e) {
  fail(`未捕获异常：${e && e.stack ? e.stack : e}`);
}
