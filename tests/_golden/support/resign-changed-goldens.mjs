#!/usr/bin/env node
// 确定性复签 sweep（开发期工具，非运行时依赖）：金牌字节改动后，把其 sha256 更新到【全部冻结它的 prd】的 testChecksums。
// 安全边界：只更新【显式白名单文件】的条目，逐处报告 旧→新，绝不碰任何其他键（防掩盖既有漂移）。
// 白名单来自命令行参数（项目相对路径），或 --from-file <清单.txt>（每行一路径）。
//   node resign-changed-goldens.mjs [--apply] tests/_golden/a.golden.mjs tests/_golden/b.golden.mjs ...
//   缺 --apply = dry-run 只报告不写盘。
// 只处理值形如裸 64hex 的 testChecksums 条目（bare sha256，与准入门 BARE_HASH_RE 一致）；
// 若某 prd 里目标键的值不是裸 hex（异常），跳过并告警、不猜。

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const BARE_HASH_RE = /^[a-f0-9]{64}$/;

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const whitelist = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--apply') continue;
  if (argv[i] === '--from-file') {
    const f = argv[++i];
    for (const line of readFileSync(resolve(ROOT, f), 'utf8').split('\n')) {
      const t = line.trim();
      if (t) whitelist.push(t);
    }
    continue;
  }
  whitelist.push(argv[i]);
}
if (whitelist.length === 0) {
  console.error('用法：resign-changed-goldens.mjs [--apply] <项目相对金牌路径>... | --from-file <清单>');
  process.exit(2);
}

// 计算白名单文件实际 sha256（缺文件=错误，不静默）
const wantSha = new Map();
for (const rel of whitelist) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { console.error(`✗ 白名单文件不存在：${rel}`); process.exit(1); }
  wantSha.set(rel, createHash('sha256').update(readFileSync(abs)).digest('hex'));
}

const prdDir = join(ROOT, 'loop');
const changes = [];
const warnings = [];
for (const name of readdirSync(prdDir)) {
  if (!/^prd-.*\.json$/.test(name)) continue;
  const path = join(prdDir, name);
  let d;
  try { d = JSON.parse(readFileSync(path, 'utf8')); } catch { warnings.push(`${name}: JSON 解析失败，跳过`); continue; }
  const tc = d.testChecksums;
  if (!tc || typeof tc !== 'object') continue;
  let dirty = false;
  for (const rel of whitelist) {
    if (!(rel in tc)) continue; // 该 prd 不冻结此文件
    const cur = tc[rel];
    const next = wantSha.get(rel);
    if (!BARE_HASH_RE.test(String(cur))) { warnings.push(`${name}: 键 ${rel} 现值非裸sha256(${cur})，跳过不猜`); continue; }
    if (cur === next) continue; // 已一致
    changes.push({ prd: name, key: rel, old: cur, next });
    if (apply) { tc[rel] = next; dirty = true; }
  }
  if (apply && dirty) writeFileSync(path, JSON.stringify(d, null, 2) + '\n');
}

console.log(`复签 sweep（${apply ? 'APPLY 已写盘' : 'DRY-RUN 未写盘'}）：白名单 ${whitelist.length} 文件，命中 ${changes.length} 处 checksum 变更、${warnings.length} 告警`);
for (const c of changes) console.log(`  ${c.prd}  ${c.key}\n    ${c.old.slice(0, 12)} → ${c.next.slice(0, 12)}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (warnings.length > 0) process.exit(3);
