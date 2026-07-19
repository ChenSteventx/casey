#!/usr/bin/env node
// 台账断言（zero-SUT）：五个受准入门影响的 prd 全部 story 由 gate 写为 passes:true 才绿。
// 只读 prd 台账，不跑 gate、不写任何文件；passes 唯一写者仍是 gate.mjs。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const AFFECTED = [
  'loop/prd-p5-replay.json',
  'loop/prd-wf-publish-states.json',
  'loop/prd-replay-settle-mount.json',
  'loop/prd-drawer-lock-hardening.json',
  'loop/prd-replay-nth-visible-hardening.json',
];

const problems = [];
for (const rel of AFFECTED) {
  let prd;
  try {
    prd = JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
  } catch (error) {
    problems.push(`${rel}: 读取失败（${String(error?.message || error).slice(0, 120)}）`);
    continue;
  }
  const stories = Array.isArray(prd.stories) ? prd.stories : [];
  if (stories.length === 0) {
    problems.push(`${rel}: 无 stories`);
    continue;
  }
  for (const s of stories) {
    if (s.passes !== true) problems.push(`${rel}: story ${s.id} passes=${JSON.stringify(s.passes)}`);
  }
}

if (problems.length > 0) {
  console.error(`受影响 gate 台账未全绿（${problems.length} 处）：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('五个受影响 prd 台账全绿');
