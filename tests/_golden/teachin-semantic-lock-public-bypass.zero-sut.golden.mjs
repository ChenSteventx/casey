#!/usr/bin/env node
// 冻结验收：promptset、CLI 与 MCP 公共入口显式传递身份 authority/frozen locks。
// 仅静态读取源码；禁止启动进程、浏览器、网络、fake 或 fixture SUT。

import { readFileSync } from 'node:fs';

function fail(message) { throw new Error(message); }
const promptset = readFileSync(new URL('../../bin/promptset.mjs', import.meta.url), 'utf8');
const cli = readFileSync(new URL('../../bin/casey.mjs', import.meta.url), 'utf8');
const mcp = readFileSync(new URL('../../mcp/casey-server.mjs', import.meta.url), 'utf8');

if (!/const need\s*=\s*\[[^\]]*['"]entity-locks['"]/s.test(promptset)) fail('promptset 未把 --entity-locks 列为必填');
if (!/['"]--entity-locks['"]\s*,\s*(?:path\.resolve\()?opts\[['"]entity-locks['"]\]/s.test(promptset)) fail('promptset 未逐行把 frozen locks 传给 replay');
if (!/entity-locks/.test(cli) || !/runPipeline[\s\S]*entity-locks/.test(cli)) fail('casey run/replay 门面未消费 frozen locks');

for (const tool of ['casey_compile', 'casey_sign', 'casey_replay', 'casey_run']) {
  const start = mcp.indexOf(`name: '${tool}'`);
  if (start < 0) fail(`MCP 缺 ${tool}`);
  const end = mcp.indexOf("\n  {\n    name:", start + 1);
  const block = mcp.slice(start, end < 0 ? mcp.length : end);
  if (tool === 'casey_compile' && (!block.includes('entityAuthority') || !block.includes('entityLocks'))) fail('MCP compile 未区分 execute authority 与 verify locks');
  if (tool === 'casey_sign' && (!block.includes('entityLocksDraft') || !block.includes('entityLocksFrozen'))) fail('MCP sign 未接身份锁草稿/冻结产物');
  if ((tool === 'casey_replay' || tool === 'casey_run') && (!block.includes("required:") || !block.includes("'entityLocks'") || !block.includes("flag('entity-locks', a.entityLocks)"))) fail(`MCP ${tool} 未强制并传递 entityLocks`);
}
if (/allowUnsignedEntityLocks|skipEntityLock|allow-unsigned/i.test(promptset + cli + mcp)) fail('公共入口不得提供未签直通开关');

console.log('ok   teachin-semantic-lock-public-bypass: promptset/CLI/MCP 无 frozen locks 绕行（零 SUT）');
