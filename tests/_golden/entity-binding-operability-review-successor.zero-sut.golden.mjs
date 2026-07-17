#!/usr/bin/env node
// 实现审查 successor：MCP/CLI sign 参数闭合 + archive no-follow 恢复。零 SUT/浏览器/server/网络。

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.CASEY_REVIEW_ROOT || join(HERE, '..', '..'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(message); };

const { TOOLS } = await import(pathToFileURL(join(ROOT, 'mcp', 'casey-server.mjs')).href);
const signTool = TOOLS.find((tool) => tool.name === 'casey_sign');
if (!signTool) fail('缺 casey_sign');
for (const key of ['events', 'entityBindingsDraft', 'entityConfirmations', 'entityLocksOut']) {
  if (!Object.hasOwn(signTool.inputSchema.properties, key)) fail(`casey_sign schema 缺 ${key}`);
}
const base = { caseId: 'tc', draft: 'expected.draft.json', prd: 'prd.json', frozenOut: 'expected.frozen.json', signer: 'human', againstBuild: 'build' };
const mapped = signTool.toArgs({
  ...base, events: 'events.json', entityBindingsDraft: 'entity-bindings.draft.json',
  entityConfirmations: 'entity-confirmations.json', entityLocksOut: 'entity-locks.frozen.json',
});
const suffix = ['--events', 'events.json', '--entity-bindings-draft', 'entity-bindings.draft.json', '--entity-confirmations', 'entity-confirmations.json', '--entity-locks-out', 'entity-locks.frozen.json'];
if (JSON.stringify(mapped.slice(-suffix.length)) !== JSON.stringify(suffix)) fail(`MCP 新四件套 argv 漂移：${JSON.stringify(mapped)}`);
if (mapped.some((arg) => ['--entity-locks-draft', '--entity-locks-confirm', '--entity-locks-frozen'].includes(arg))) fail('MCP 仍发废弃 CLI 旗标');
const legacy = signTool.toArgs({ ...base, entityLocksDraft: 'd', entityLocksConfirm: 'c', entityLocksFrozen: 'o' });
if (!legacy.includes('--entity-bindings-draft') || !legacy.includes('--entity-confirmations') || !legacy.includes('--entity-locks-out') || legacy.includes('--events')) fail('MCP 旧三字段映射伪造 events 或未转新旗标');
let conflictDenied = false;
try { signTool.toArgs({ ...base, entityBindingsDraft: 'new', entityLocksDraft: 'old' }); } catch { conflictDenied = true; }
if (!conflictDenied) fail('MCP 新旧字段冲突未拒');

const signSource = readFileSync(join(ROOT, 'bin', 'sign.mjs'), 'utf8');
const signArgsSource = readFileSync(join(ROOT, 'lib', 'sign-cli-args.mjs'), 'utf8');
for (const token of ['SIGN_VALUE_FLAGS', 'SIGN_BOOLEAN_FLAGS', 'invalidFlags', 'duplicateFlags']) {
  if (!signArgsSource.includes(token)) fail(`direct sign 参数面未闭合：缺 ${token}`);
}
for (const token of ['parseSignArgs', 'args.pos.length !== 1', 'entityLockArgCount !== 0 && entityLockArgCount !== entityLockArgs.length']) {
  if (!signSource.includes(token)) fail(`direct sign 参数面未闭合：缺 ${token}`);
}
for (const oldFlag of ['entity-locks-draft', 'entity-locks-confirm', 'entity-locks-frozen']) {
  const allowedBlock = signArgsSource.slice(signArgsSource.indexOf('const SIGN_VALUE_FLAGS'), signArgsSource.indexOf('export function'));
  if (allowedBlock.includes(`'${oldFlag}'`)) fail(`direct sign 仍允许废弃旗标 ${oldFlag}`);
}
const { parseSignArgs } = await import(pathToFileURL(join(ROOT, 'lib', 'sign-cli-args.mjs')).href);
for (const argv of [
  ['tc', '--entity-locks-draft', 'd'],
  ['tc', '--totally-unknown-sign-flag', 'x'],
]) if (parseSignArgs(argv).invalidFlags.length !== 1) fail(`direct sign 未标记未知/废弃旗标：${JSON.stringify(argv)}`);
if (parseSignArgs(['tc', '--draft', 'a', '--draft', 'b']).duplicateFlags.length !== 1) fail('direct sign 未标记重复旗标');
if (parseSignArgs(['tc', 'extra-positional']).pos.length !== 2) fail('direct sign 未保留多余位置参数供闭合门拒绝');
const parsedLegacyMcp = parseSignArgs(legacy.slice(1));
const entityKeys = ['events', 'entity-bindings-draft', 'entity-confirmations', 'entity-locks-out'];
if (entityKeys.filter((key) => typeof parsedLegacyMcp[key] === 'string').length !== 3) fail('MCP 旧三字段未落成 CLI 可成组拒绝的 3/4 状态');

const publicationModule = await import(pathToFileURL(join(ROOT, 'lib', 'sign-publication.mjs')).href);
const boundaryModule = await import(pathToFileURL(join(ROOT, 'lib', 'project-artifact-boundary.mjs')).href);
if (typeof boundaryModule.readPhysicalFileBytes !== 'function') fail('缺 archive 范围无关的物理文件 reader');
for (const token of ['readPhysicalFileBytes', 'readExisting']) if (!signSource.includes(token)) fail(`sign archive 恢复未接 ${token}`);

const external = mkdtempSync(join(tmpdir(), 'casey-archive-external-'));
const local = mkdtempSync(join(tmpdir(), 'casey-archive-publication-'));
try {
  const archive = join(local, 'archive.json');
  const authority = join(local, 'prd.json');
  const journal = join(local, 'entity-locks.frozen.json.publish.json');
  const archiveText = 'old frozen\n';
  const authorityText = 'new prd\n';
  const externalFile = join(external, 'old.json');
  writeFileSync(externalFile, archiveText);
  symlinkSync(externalFile, archive);
  const writes = [{ path: archive, text: archiveText }, { path: authority, text: authorityText }];
  writeFileSync(journal, JSON.stringify({
    schemaVersion: 1, artifactKind: 'casey-sign-publication', signedAt: '2026-07-17T00:00:00.000Z',
    authorityTargetHash: sha(resolve(authority)),
    entries: writes.map((row) => ({ targetHash: sha(resolve(row.path)), contentHash: sha(row.text) })),
  }) + '\n');
  const result = publicationModule.publishSignPublication({
    writes, journalPath: journal, signedAt: '2026-07-17T00:00:00.000Z', authorityPath: authority,
    readExisting: (path) => {
      if (resolve(path) !== resolve(archive) && resolve(path) !== `${resolve(archive)}.tmp`) return readFileSync(path, 'utf8');
      const physical = boundaryModule.readPhysicalFileBytes({ targetPath: path });
      if (!physical.ok) throw new Error(physical.reason);
      return physical.bytes.toString('utf8');
    },
  });
  if (result.ok === true || !existsSync(journal) || existsSync(authority)) fail('archive symlink 被当已到位并完成 authority 发布');

  const outsideRegular = boundaryModule.readPhysicalFileBytes({ targetPath: externalFile });
  if (!outsideRegular.ok || outsideRegular.bytes.toString('utf8') !== archiveText) fail('项目外普通 archive 被错误 containment 拒绝');
} finally {
  rmSync(local, { recursive: true, force: true });
  rmSync(external, { recursive: true, force: true });
}

console.log('ok   entity-binding-operability-review-successor: MCP/CLI 参数闭合 + archive no-follow（零 SUT）');
process.exit(0);
