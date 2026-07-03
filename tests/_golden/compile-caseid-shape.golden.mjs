#!/usr/bin/env node
// 冻结黄金标准（compile-caseid-shape · hermetic）：两条同型输入形状缝收口（direct 小契约）。
// ① compile.mjs caseId 拼产物文件名未验形状（draft-cli 评审 R1-F2 同型缝，镜像 bin/draft.mjs 先例）：
//    穿越形态 caseId 可把 flow-<caseId>.json 写出 out-dir 之外。
// ② replay-assert urlPathname matches 缺 value：new RegExp(undefined) 空正则匹配一切 → 假绿
//    （chiefcomplaint-smoke 评审 R1-F1 同型缝挂账兑现，fail-safe 护栏 #14）。
// 实现前必红：C1 穿越写出成功 exit 0、C2 缺 value 判 true。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { evaluateAssertions } from '../../lib/replay-assert.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const COMPILE = join(ROOT, 'bin', 'compile.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-cshape-'));
const run = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 });

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-300)}`); }
}

const FLOW = { id: 'x', name: '形状考场', category: 'normal', steps: [{ atom: 'login', params: {} }] };
function tcDoc(caseId) {
  return { schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'], source: 'golden', intents: [] };
}

check('C1 穿越形态 caseId 拒于门外（exit 65 + 产物不落 out-dir 之外）', () => {
  const evil = 'x/../../evil';
  const outDir = join(tmp, 'c1', 'deep', 'out');
  mkdirSync(outDir, { recursive: true });
  const tcF = join(tmp, 'c1-tc.json');
  const flowF = join(tmp, 'c1-flow.json');
  writeFileSync(tcF, JSON.stringify(tcDoc(evil)));
  writeFileSync(flowF, JSON.stringify(FLOW));
  const r = run([COMPILE, evil, '--testcase', tcF, '--flow', flowF, '--out-dir', outDir]);
  if (r.status !== 65) throw new Error(`应 exit 65（fail-closed），实际 ${r.status}：${(r.stderr || '').slice(-150)}`);
  const escaped = join(tmp, 'c1', 'evil.json'); // join(outDir, 'flow-x/../../evil.json') 的归一落点
  if (existsSync(escaped)) throw new Error(`产物写出 out-dir 之外：${escaped}`);
});

check('C1b 合法 caseId 不误伤（闸段照常 exit 0）', () => {
  const outDir = join(tmp, 'c1b-out');
  mkdirSync(outDir, { recursive: true });
  const tcF = join(tmp, 'c1b-tc.json');
  const flowF = join(tmp, 'c1b-flow.json');
  writeFileSync(tcF, JSON.stringify(tcDoc('tc_ok_1')));
  writeFileSync(flowF, JSON.stringify(FLOW));
  const r = run([COMPILE, 'tc_ok_1', '--testcase', tcF, '--flow', flowF, '--out-dir', outDir]);
  if (r.status !== 0) throw new Error(`合法 caseId 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-150)}`);
  if (!existsSync(join(outDir, 'flow-tc_ok_1.json'))) throw new Error('闸段产物缺失');
});

check('C2 urlPathname matches 缺 value → 证不出（空正则假绿封死）', () => {
  const noVal = evaluateAssertions([{ kind: 'urlPathname', op: 'matches' }], { urlPath: '/any/path' })[0];
  if (noVal.ok !== false) throw new Error(`缺 value 应 false（fail-safe），实际 ${noVal.ok}`);
  const legit = evaluateAssertions([{ kind: 'urlPathname', op: 'matches', value: '^/any' }], { urlPath: '/any/path' })[0];
  if (legit.ok !== true) throw new Error(`合法正则不误伤，应 true，实际 ${legit.ok}`);
});

if (fails.length) {
  for (const f of fails) console.error(`RED  compile-caseid-shape: ${f}`);
  console.error(`RED  compile-caseid-shape: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   compile-caseid-shape: ${pass}/${pass} 全过（穿越拒门 + 合法不误伤 + 空正则封死）`);
process.exit(0);
