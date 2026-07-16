// regress workflow/canvas 第一条遗产迁移：脚本转换节点字段值冻结断言。
// 零 SUT：只跑纯函数、模块允许集与静态接线，不启动浏览器/fixture/fake-SUT。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const failures = [];
let passed = 0;
async function check(name, fn) {
  try { await fn(); passed += 1; }
  catch (error) { failures.push(`${name}: ${String(error && error.message || error)}`); }
}
const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const compile = await import('../../lib/compile-atoms.mjs');
const compileGate = await import('../../lib/compile-gate.mjs');
const draft = await import('../../lib/assertion-draft.mjs');
const replayAssert = await import('../../lib/replay-assert.mjs');

await check('C1 命名断言可编译但不进入动作分派表', () => {
  if (!compile.isCompilableAtom('workflow.assertNodeFieldValue')) throw new Error('命名断言仍被桥前置拦截');
  if (compile.COMPILE_KNOWN_ATOMS.has('workflow.assertNodeFieldValue')) throw new Error('纯断言不得伪装成动作编译器');
  if (compile.COMPILE_KNOWN_ATOMS.size !== 25) throw new Error(`组合后动作编译器数量应保持 25，实际 ${compile.COMPILE_KNOWN_ATOMS.size}`);
});

await check('C2 编译只留断言原子且不产生 event', async () => {
  const run = { lastIntentId: 'intent_script', assertionAtoms: [], events: [] };
  await compile.compileFlow(run, { steps: [{
    atom: 'workflow.assertNodeFieldValue',
    params: { nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1}" },
  }] });
  if (run.events.length !== 0) throw new Error('断言原子不得产生动作事件');
  if (!deepEqual(run.assertionAtoms, [{
    intentId: 'intent_script',
    atom: 'workflow.assertNodeFieldValue',
    params: { nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1}" },
  }])) throw new Error(`断言留痕不符：${JSON.stringify(run.assertionAtoms)}`);
});

await check('C3 草拟为已实现的硬 inputReadback equals', () => {
  const skeleton = draft.synthesizeSkeleton({ caseId: 'tc_wf_node_script', steps: [] }, [{
    intentId: 'intent_script',
    atom: 'workflow.assertNodeFieldValue',
    params: { nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1}" },
  }]);
  const expected = skeleton.intents[0] && skeleton.intents[0].expected[0];
  const encoded = replayAssert.encodeInputReadback({ nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1}" });
  if (!deepEqual(expected, { kind: 'inputReadback', op: 'equals', value: encoded })) {
    throw new Error(`映射不符：${JSON.stringify(expected)}`);
  }
  if (skeleton.pending.length !== 0) throw new Error('完整参数不应 route:human');
  if (!replayAssert.IMPLEMENTED_KINDS.has('inputReadback')) throw new Error('inputReadback 尚未列为已实现');
});

await check('C4 缺 placeholder 或 value 不猜测并转人工', () => {
  for (const params of [
    { placeholder: '请输入python脚本', value: 'x' },
    { nodeName: '脚本转换', value: 'x' },
    { nodeName: '脚本转换', placeholder: '请输入python脚本' },
    { nodeName: '', placeholder: '请输入python脚本', value: 'x' },
    { nodeName: '脚本转换', placeholder: '', value: 'x' },
  ]) {
    const skeleton = draft.synthesizeSkeleton({ caseId: 'tc_wf_node_script', steps: [] }, [{
      intentId: 'intent_script', atom: 'workflow.assertNodeFieldValue', params,
    }]);
    if (skeleton.intents.length !== 0 || skeleton.pending.length !== 1) throw new Error(`坏参数应只进 pending：${JSON.stringify(params)}`);
  }
});

await check('C5 动作轴回读只接受唯一、成功、字符串 actual', () => {
  if (typeof replayAssert.inputReadbackFromAction !== 'function') throw new Error('缺 inputReadbackFromAction');
  const encoded = replayAssert.encodeInputReadback({ nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1}" });
  const good = { resolution: 'unique', identityReadback: { ok: true, actual: encoded } };
  if (replayAssert.inputReadbackFromAction(good) !== encoded) throw new Error('合法物理回读未被接收');
  const bad = [
    null,
    { resolution: 'ambiguous', identityReadback: { ok: true, actual: 'x' } },
    { resolution: 'unique', identityReadback: { ok: false, actual: 'x' } },
    { resolution: 'unique', identityReadback: { ok: true, actual: 1 } },
  ];
  if (bad.some((value) => replayAssert.inputReadbackFromAction(value) !== undefined)) throw new Error('矛盾/非唯一回读被 fail-open 接收');
});

await check('C6 inputReadback 精确相等才通过', () => {
  const encoded = replayAssert.encodeInputReadback({ nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1}" });
  const assertion = [{ kind: 'inputReadback', op: 'equals', value: encoded }];
  const ok = replayAssert.evaluateAssertions(assertion, { inputReadback: encoded })[0];
  const suffix = replayAssert.evaluateAssertions(assertion, { inputReadback: replayAssert.encodeInputReadback({ nodeName: '脚本转换', placeholder: '请输入python脚本', exact: true, value: "result = {'casey': 1} # extra" }) })[0];
  const wrongField = replayAssert.evaluateAssertions(assertion, { inputReadback: replayAssert.encodeInputReadback({ nodeName: '脚本转换', placeholder: '请输入脚本', exact: true, value: "result = {'casey': 1}" }) })[0];
  const absent = replayAssert.evaluateAssertions(assertion, {})[0];
  if (ok.ok !== true || ok.actual !== encoded) throw new Error(`精确值应通过：${JSON.stringify(ok)}`);
  if (suffix.ok !== false || wrongField.ok !== false || absent.ok !== false || absent.actual !== null) throw new Error('超集、错误字段或缺采集必须失败');
});

await check('C7 回放接线取代表事件动作轴，不另猜 DOM', () => {
  const source = readFileSync(join(ROOT, 'bin', 'replay.mjs'), 'utf8');
  if (!source.includes('inputReadbackFromAction')) throw new Error('replay 未接动作轴回读提取器');
  if (!source.includes('inputReadback: intentInputReadback.get(iid)')) throw new Error('evaluateAssertions 未接 intentInputReadback');
  const actionSource = readFileSync(join(ROOT, 'lib', 'replay-actions.mjs'), 'utf8');
  if (!actionSource.includes('encodeInputReadback({ nodeName: label, placeholder, exact, value: got })')) throw new Error('setNodeField 成功轴未携字段身份规范值');
});

await check('C8 迁移候选只迁业务语义并保持真机待验', () => {
  const plan = readFileSync(join(ROOT, 'docs', 'plans', 'regress-wf-node-script', 'plan.md'), 'utf8');
  for (const text of ['atl_{{uniqueName}}', 'workflow.assertNodeFieldValue', 'route:human', '独立\nHTML']) {
    if (!plan.includes(text)) throw new Error(`迁移计划缺约束：${text}`);
  }
  if (/trace\.zip|report\.html/.test(plan)) throw new Error('迁移计划不得收编旧报告或 trace 附件');
  const flow = JSON.parse(readFileSync(join(ROOT, 'docs', 'plans', 'regress-wf-node-script', 'proposed', 'flow-tc_wf_node_script.json'), 'utf8'));
  const atoms = flow.steps.map((step) => step.atom);
  const expectedAtoms = ['login', 'nav.workflowManagement', 'workflow.create', 'workflow.addNode', 'workflow.openNode', 'workflow.setNodeField', 'workflow.assertNodeFieldValue', 'workflow.closeDrawer', 'workflow.deleteByName'];
  if (!deepEqual(atoms, expectedAtoms)) throw new Error(`迁移原子序不符：${JSON.stringify(atoms)}`);
  const encoded = JSON.stringify(flow);
  if (!encoded.includes('atl_{{uniqueName}}') || encoded.includes('ctxtest_') || /report|trace/i.test(encoded)) throw new Error('候选须用保留前缀模板且不得携旧报告/trace');
  const registry = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
  const gated = compileGate.validateDraft(flow, { prefix: 'atl_', registry, initialStates: ['已登录'] });
  if (!gated.ok) throw new Error(`迁移候选不过结构/状态/破坏性前缀闸：${JSON.stringify(gated.problems)}`);
});

await check('C9 注册表与实现同为精确回读语义', () => {
  const registry = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
  const atom = registry.atoms && registry.atoms['workflow.assertNodeFieldValue'];
  const text = JSON.stringify(atom);
  if (!atom || !text.includes('精确等于') || text.includes('含期望子串')) throw new Error(`注册表仍与 equals 实现漂移：${text}`);
});

await check('C10 模板化 inputReadback 须规范编码并走硬断言', () => {
  const value = replayAssert.encodeInputReadback({
    nodeName: '脚本转换',
    placeholder: '请输入python脚本',
    exact: true,
    value: 'atl_{{uniqueName}}',
  });
  const hard = {
    caseId: 'tc_wf_node_script',
    intents: [{ intentId: 'intent_script', expected: [{ kind: 'inputReadback', op: 'equals', value }] }],
    globalAssertions: [],
  };
  const accepted = draft.validateDraft(hard);
  if (!accepted.ok) throw new Error(`规范模板硬断言应放行：${JSON.stringify(accepted.problems)}`);
  const bypass = draft.validateDraft({
    ...hard,
    intents: [{ intentId: 'intent_script', expected: [{ kind: 'inputReadback', op: 'equals', value, soft: true }] }],
  });
  if (bypass.ok || !bypass.problems.some((problem) => problem.includes('不得标 soft'))) {
    throw new Error('已实现 inputReadback 标 soft:true 应被拒，不能绕过硬裁定');
  }
  const malformedHard = draft.validateDraft({
    ...hard,
    intents: [{ intentId: 'intent_script', expected: [{ kind: 'inputReadback', op: 'equals', value: 'raw' }] }],
  });
  if (malformedHard.ok || !malformedHard.problems.some((problem) => problem.includes('规范载荷'))) {
    throw new Error('非规范 inputReadback 不得硬入场');
  }
});

console.log(`regress-wf-node-script zero-sut golden: ${passed} 过 / ${failures.length} 败`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
