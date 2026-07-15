#!/usr/bin/env node
// 纯静态策略锁：不执行 CLI、不启动浏览器、端口或任何 SUT。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const cli = readFileSync(resolve(root, 'bin/casey.mjs'), 'utf8');
const skill = readFileSync(resolve(root, '.claude/skills/casey/SKILL.md'), 'utf8');
const prd = JSON.parse(readFileSync(resolve(root, 'loop/prd-cli-mcp-face.json'), 'utf8'));

assert.match(cli, /case 'gate': return blockedByRealSutOnlyPolicy\('gate'\)/);
assert.match(cli, /case 'demo': return blockedByRealSutOnlyPolicy\('demo'\)/);
assert.doesNotMatch(cli, /case 'demo': \{ const r = runNode\(path\.join\(PROJECT_ROOT, 'bin', 'demo\.mjs'/);
assert.match(skill, /不得运行历史 `casey demo`/);
for (const story of prd.stories) {
  assert.equal(story.passes, false);
  assert.deepEqual(story.acceptance, []);
  assert.match(story.evidence, /REVOKED@2026-07-15/);
}

console.log('real-sut-only CLI static golden: PASS（零 SUT 连接）');
