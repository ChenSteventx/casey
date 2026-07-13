#!/usr/bin/env node
// hash-tree.mjs —— 包全清单哈希器（除 .git 外全部常规文件，递归，posix 相对路径排序）。
// 被 kit-lock.json 生成与 loop-kit-extract.golden.mjs 的 C0/C4 共用，防「生成」与「校验」各自长出一套算法。
// 非常规文件（软链接、设备文件等）单独收集于 irregular——按严格集合语义应判失配，不计入 files。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function hashTree(dir) {
  const files = {};
  const irregular = [];
  function walk(cur, relPrefix) {
    const entries = readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git') continue;
      const abs = join(cur, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) { walk(abs, rel); continue; }
      if (ent.isFile()) {
        files[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
        continue;
      }
      irregular.push(rel);
    }
  }
  walk(dir, '');
  return { files, irregular, paths: Object.keys(files).sort() };
}
