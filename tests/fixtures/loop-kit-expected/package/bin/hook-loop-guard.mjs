#!/usr/bin/env node
// PreToolUse hook —— Loop Contract 阶段前置互锁（硬层，防「需要 loop 却不走 loop」）。
// 缺上一阶段交付物 → exit 2 拦（stderr 反馈 Claude）。范围：写/Bash-写 prd·lib·bin·web·loop-kit；git commit 动实现。
// lane=direct 只剩地板；非守卫动作放行；hook 自身故障不阻塞（fail-open，同 hook-posttool 约定）。
import { readFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actionFromTool, touchesImpl, checkAction, commitArgs, stripPathspec } from './contract.mjs';
import { resolveRoot } from '../lib/root.mjs';

const ROOT = resolveRoot();
const rel = (fp) => relative(ROOT, resolve(ROOT, fp)).replace(/\\/g, '/');

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const tn = input.tool_name;
  const ti = input.tool_input || {};

  let action = null;
  if (tn === 'Write' || tn === 'Edit' || tn === 'NotebookEdit') {
    if (!ti.file_path) process.exit(0);
    const r = rel(ti.file_path);                 // 归一成仓库相对路径（评审 #5：绝对路径/仓库外不误判）
    if (r.startsWith('..')) process.exit(0);      // 仓库外，不管
    action = actionFromTool(tn, { file_path: r }).kind;
  } else if (tn === 'Bash') {
    action = actionFromTool('Bash', { command: ti.command }).kind; // Bash-写 impl/commit（评审 #1/#2）
  }
  if (!action) process.exit(0);

  const cf = process.env.LOOP_CONTRACT_FILE || join(ROOT, 'loop', 'active-contract.json');
  let contract = null;
  try { contract = JSON.parse(readFileSync(cf, 'utf8')); } catch { /* 无/坏 → 走地板 */ }
  if (!contract) {
    console.error('阶段互锁：无活动 Loop Contract。动手前先声明入口分流：\n  node loop-kit/bin/contract.mjs init <slug> --lane direct|light|full --reason "<一句理由>"\n（防「需要 loop 却不走 loop」——直干也要先有一句声明。）');
    process.exit(2);
  }

  // commit：算影响面（暂存 ∪ -a 未暂存 ∪ pathspec）。不触实现 → 放行；触了 → 按 commit-impl 判（评审 #2）。
  if (action === 'commit') {
    const { all, pathspecs, fromFile } = commitArgs(ti.command || '');
    const files = [];
    if (fromFile) files.push('lib/__pathspec_from_file__'); // 无法解析文件内 pathspec → fail-closed 当触实现
    try { files.push(...execSync('git diff --cached --name-only', { cwd: ROOT }).toString().split('\n').filter(Boolean)); } catch { /* ignore */ }
    if (all) { try { files.push(...execSync('git diff --name-only', { cwd: ROOT }).toString().split('\n').filter(Boolean)); } catch { files.push('lib/__undetermined__'); } }
    if (pathspecs.length) {
      // 把 pathspec（含裸目录 lib / 点 . / 通配）经 git 展开成实际文件（暂存+未暂存），评审 round-5 修。
      let expanded = false;
      for (const args of [['diff', '--name-only', '--', ...pathspecs], ['diff', '--cached', '--name-only', '--', ...pathspecs]]) {
        const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
        if (r.status === 0) { files.push(...String(r.stdout).split('\n').filter(Boolean)); expanded = true; }
      }
      if (!expanded) { // git 失败 → fallback：正向 pathspec 归一后判；排除类 magic(:!/:(exclude)) 无法本地判 → fail-closed
        for (const p of pathspecs) {
          if (/^:(?:!|\(exclude\))/.test(p)) files.push('lib/__exclude_magic__');
          else files.push(stripPathspec(p));
        }
      }
    }
    if (!touchesImpl(files)) process.exit(0);
    action = 'commit-impl';
  }

  const d = checkAction(contract, action);
  if (!d.allow) {
    console.error(`阶段互锁拦截：动作「${action}」需先完成阶段「${d.missing}」（lane=${contract.lane}，slug=${contract.slug}）。\n补齐该阶段交付物后：node loop-kit/bin/contract.mjs advance ${d.missing} --artifact <...>；若入口分流判断有变，改 contract 的 lane。`);
    process.exit(2);
  }
  process.exit(0);
} catch {
  process.exit(0); // hook 自身故障不得阻塞正常动作
}
