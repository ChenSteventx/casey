#!/usr/bin/env node
// sign 多文件发布恢复门：动态内存 I/O + 静态 CLI 接线；禁止子进程、SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SECTION = process.argv[2] ?? 'all';
if (!new Set(['all', 'interrupt-recover', 'mismatch-authority', 'cleanup-retry', 'cli-wiring']).has(SECTION)) process.exit(2);
let publication = null;
try { publication = await import('../../lib/sign-publication.mjs'); } catch { publication = null; }

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function memoryIo(initial = {}) {
  const files = new Map(Object.entries(initial));
  const log = [];
  const faults = { renameTarget: null, renameRemaining: 0, removeTarget: null, removeRemaining: 0 };
  return {
    files, log, faults,
    exists(path) { return files.has(path); },
    read(path) { if (!files.has(path)) throw new Error('ENOENT'); return files.get(path); },
    writeExclusive(path, text) { if (files.has(path)) throw new Error('EEXIST'); files.set(path, text); log.push(['write', path]); },
    rename(from, to) {
      if (faults.renameTarget === to && faults.renameRemaining > 0) { faults.renameRemaining -= 1; throw new Error('INJECT_RENAME'); }
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from)); files.delete(from); log.push(['rename', to]);
    },
    remove(path) {
      if (faults.removeTarget === path && faults.removeRemaining > 0) { faults.removeRemaining -= 1; throw new Error('INJECT_REMOVE'); }
      files.delete(path); log.push(['remove', path]);
    },
  };
}

const BASE = Object.freeze({
  signedAt: '2026-07-17T06:00:00.000Z',
  journalPath: '/case/entity-locks.frozen.json.publish.json',
  authorityPath: '/repo/loop/prd-tc.json',
  writes: Object.freeze([
    Object.freeze({ path: '/case/expected.frozen.json', text: 'frozen-v2\n' }),
    Object.freeze({ path: '/case/entity-locks.frozen.json', text: 'locks-v1\n' }),
    Object.freeze({ path: '/repo/loop/prd-tc.json', text: 'prd-new\n' }),
  ]),
});
const fresh = () => ({ ...BASE, writes: BASE.writes.map((row) => ({ ...row })) });
function engine(io) {
  assert(typeof publication?.createSignPublicationEngine === 'function', '缺 createSignPublicationEngine');
  return publication.createSignPublicationEngine(io);
}

test('interrupt-recover', 'J1 locks 后、PRD 前中断不成功且同输入可续跑', () => {
  const io = memoryIo({ [BASE.authorityPath]: 'prd-old\n' });
  io.faults.renameTarget = BASE.authorityPath; io.faults.renameRemaining = 1;
  const publish = engine(io);
  const first = publish(fresh());
  assert(first?.ok === false && first.retryable === true, '中断被宣称成功或不可恢复');
  assert(io.files.get('/case/entity-locks.frozen.json') === 'locks-v1\n', '未到 locks 后断点');
  assert(io.files.get(BASE.authorityPath) === 'prd-old\n', 'PRD 在断点前被更新');
  assert(io.files.has(BASE.journalPath), '中断未保留 journal');
  const second = publish(fresh());
  assert(second?.ok === true && io.files.get(BASE.authorityPath) === 'prd-new\n', '同输入未完成恢复');
  assert(!io.files.has(BASE.journalPath), '成功后 journal 未清');
});

test('mismatch-authority', 'J2 journal 后不同输入拒绝且不继续 rename', () => {
  const io = memoryIo({ [BASE.authorityPath]: 'prd-old\n' });
  io.faults.renameTarget = BASE.authorityPath; io.faults.renameRemaining = 1;
  const publish = engine(io);
  assert(publish(fresh())?.ok === false, '未制造中断');
  const renameCount = io.log.filter(([kind]) => kind === 'rename').length;
  const changed = fresh(); changed.writes[1].text = 'locks-changed\n';
  const denied = publish(changed);
  assert(denied?.ok === false && denied.retryable === false, '不同输入未 fail-closed');
  assert(io.log.filter(([kind]) => kind === 'rename').length === renameCount, '拒绝后仍继续 rename');
  assert(io.files.get(BASE.authorityPath) === 'prd-old\n', '不同输入改写 PRD');
});

test('mismatch-authority', 'J2 PRD 必须最后且半提交不铸造新 authority', () => {
  const bad = fresh();
  [bad.writes[1], bad.writes[2]] = [bad.writes[2], bad.writes[1]];
  const badIo = memoryIo({ [BASE.authorityPath]: 'prd-old\n' });
  const rejected = engine(badIo)(bad);
  assert(rejected?.ok === false && badIo.log.length === 0, '非 PRD-last 计划产生写副作用');

  const io = memoryIo({ [BASE.authorityPath]: 'prd-old\n' });
  const publish = engine(io);
  assert(publish(fresh())?.ok === true, '正常发布失败');
  const outputRenames = io.log.filter(([kind, path]) => kind === 'rename' && path !== BASE.journalPath).map(([, path]) => path);
  assert(outputRenames.at(-1) === BASE.authorityPath, 'PRD 不是最后 rename');
  assert(io.files.get(BASE.authorityPath) === 'prd-new\n', '新 authority 未到最终字节');
});

test('cleanup-retry', 'J3 journal cleanup 失败不报成功，同输入重试收口', () => {
  const io = memoryIo({ [BASE.authorityPath]: 'prd-old\n' });
  io.faults.removeTarget = BASE.journalPath; io.faults.removeRemaining = 1;
  const publish = engine(io);
  const first = publish(fresh());
  assert(first?.ok === false && first.retryable === true, 'cleanup 失败被宣称成功/不可恢复');
  assert(io.files.get(BASE.authorityPath) === 'prd-new\n' && io.files.has(BASE.journalPath), 'cleanup 断点状态不完整');
  const renameCount = io.log.filter(([kind]) => kind === 'rename').length;
  const second = publish(fresh());
  assert(second?.ok === true && !io.files.has(BASE.journalPath), 'cleanup 重试未收口');
  assert(io.log.filter(([kind]) => kind === 'rename').length === renameCount, '已到位目标在 cleanup 重试中被重复 rename');
});

test('cli-wiring', 'J4 CLI 接 publication engine、PRD authorityPath 与残留 checksum 拒绝', () => {
  const source = readFileSync(new URL('../../bin/sign.mjs', import.meta.url), 'utf8');
  assert(source.includes("from '../lib/sign-publication.mjs'"), 'sign 未接独立 publication engine');
  assert(source.includes('authorityPath: prdPath'), 'sign 未显式绑定规范 PRD 为最后 authority');
  assert(source.includes('PRD 已含 entity-locks checksum'), '首次发布未拒潜伏旧 checksum');
  assert(!/多文件(?:\s|OS\s*)?原子(?![^\n]*(?:不声称|不是))/.test(source), 'sign 仍声称多文件原子');
  const hash = createHash('sha256').update(source).digest('hex');
  assert(/^[0-9a-f]{64}$/.test(hash), '静态读取异常');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  sign-publication-recovery: ${failure}`);
  console.error(`RED  sign-publication-recovery/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   sign-publication-recovery/${SECTION}: ${passed}/${passed} 全过（动态内存 I/O/静态，零 SUT）`);
