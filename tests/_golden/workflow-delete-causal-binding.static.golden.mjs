#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(ROOT, 'lib/workflow-delete-domain.mjs'), 'utf8');
const mod = await import('../../lib/workflow-delete-domain.mjs');

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    if (!await fn()) throw new Error('断言返回 false');
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const samePhysical = async (left, right) => left.nodeId === right.nodeId;
const oldA = { handle: 'old-a-1', nodeId: 'old-a' };
const oldAWrapper = { handle: 'old-a-2', nodeId: 'old-a' };
const freshB = { handle: 'fresh-b', nodeId: 'fresh-b' };
const freshC = { handle: 'fresh-c', nodeId: 'fresh-c' };

await check('C1 旧弹层的不同句柄包装不算新弹层', async () => {
  const result = await mod.classifyCausalDialog([oldA], [oldAWrapper], samePhysical);
  return result.resolution === 'none' && result.candidateCount === 0 && result.dialog === null;
});

await check('C2 恰有一个新物理弹层时唯一授权', async () => {
  const result = await mod.classifyCausalDialog([oldA], [oldAWrapper, freshB], samePhysical);
  return result.resolution === 'unique' && result.candidateCount === 1 && result.dialog === freshB;
});

await check('C2 多个新物理弹层时拒绝授权', async () => {
  const result = await mod.classifyCausalDialog([oldA], [freshB, freshC], samePhysical);
  return result.resolution === 'ambiguous' && result.candidateCount === 2 && result.dialog === null;
});

await check('C2 无前置弹层且无后置弹层时拒绝授权', async () => {
  const result = await mod.classifyCausalDialog([], [], samePhysical);
  return result.resolution === 'none' && result.candidateCount === 0 && result.dialog === null;
});

await check('C3 身份比较器异常时 fail-closed', async () => {
  const result = await mod.classifyCausalDialog([oldA], [oldAWrapper], async () => { throw new Error('identity unavailable'); });
  return result.resolution === 'action_failed' && result.candidateCount === 0 && result.dialog === null;
});

await check('C4 删除触发前快照弹层且触发后选择因果弹层', () => {
  const triggerStart = source.indexOf('export async function performWorkflowDeleteTrigger');
  const confirmStart = source.indexOf('export async function inspectWorkflowDeleteConfirm');
  const trigger = source.slice(triggerStart, confirmStart);
  const baseline = trigger.indexOf('baselineDialogs = await dialogDomains(page)');
  const click = trigger.indexOf('performLockedAction(page');
  const causal = trigger.indexOf('waitForCausalDialog(page, baselineDialogs)');
  return baseline >= 0 && click > baseline && causal > click;
});

await check('C4 页级授权同时保存目标名、物理弹层和 pin', () => (
  /pendingDeleteByPage\.set\(page,\s*\{[\s\S]*targetName:[\s\S]*dialog:[\s\S]*dialogPin:/.test(source)
));

await check('C4 确认发现只读取授权弹层', () => {
  const inspectStart = source.indexOf('export async function inspectWorkflowDeleteConfirm');
  const confirmStart = source.indexOf('export async function performWorkflowDeleteConfirm');
  const inspect = source.slice(inspectStart, confirmStart);
  return inspect.includes('pendingDeleteByPage.get(page)')
    && inspect.includes('pending.dialog')
    && !inspect.includes('const domains = await dialogDomains(page)');
});

await check('C5 确认执行在点击前一次性消费授权', () => {
  const confirmStart = source.indexOf('export async function performWorkflowDeleteConfirm');
  const confirm = source.slice(confirmStart);
  const read = confirm.indexOf('pendingDeleteByPage.get(page)');
  const consume = confirm.indexOf('pendingDeleteByPage.delete(page)');
  const click = confirm.indexOf('performLockedAction(page');
  return read >= 0 && consume > read && click > consume;
});

await check('C5 确认执行绑定授权句柄并在 finally 清理', () => {
  const confirmStart = source.indexOf('export async function performWorkflowDeleteConfirm');
  const confirm = source.slice(confirmStart);
  return confirm.includes('root: pending.dialog')
    && confirm.includes('rescan: () => authorizedDialogDomains(page, pending.dialog)')
    && /finally\s*\{[\s\S]*releasePendingDelete\(page, pending\)/.test(confirm);
});

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
