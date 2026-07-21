#!/usr/bin/env node
// 纯函数/静态验收：禁止启动浏览器、fixture、fake-SUT 或连接任何 SUT。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AGENT_TOOL_ADD_ATOMS,
  buildAgentToolAtomEvents,
  createAgentToolCompileState,
} from '../../lib/agent-tool-compile.mjs';
import { COMPILE_KNOWN_ATOMS, isCompilableAtom } from '../../lib/compile-atoms.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let passed = 0;
const checks = [];

function check(name, fn) {
  try { fn(); passed += 1; checks.push(`PASS ${name}`); }
  catch (error) { checks.push(`FAIL ${name}: ${error.message}`); }
}
function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
}
function rejects(fn, pattern, label) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  if (!error || !pattern.test(String(error.message))) throw new Error(`${label}: 未按预期拒绝`);
}

check('A1 首纵切原子清单恰七个且顺序固定', () => {
  equal(AGENT_TOOL_ADD_ATOMS, [
    'agent.create',
    'agent.openToolPicker',
    'picker.search',
    'picker.expandPrimary',
    'picker.selectFirstTool',
    'agent.confirmToolPicker',
    'agent.delete',
  ], '原子清单');
});

check('A2 七原子进入单一编译分派表，命名原子 18→25，未知仍拒绝', () => {
  for (const atom of AGENT_TOOL_ADD_ATOMS) if (!isCompilableAtom(atom)) throw new Error(`${atom} 未接编译分派`);
  if (COMPILE_KNOWN_ATOMS.size !== 26) throw new Error(`命名编译原子应 26（entity-ui-wiring bindAgent +1），实际 ${COMPILE_KNOWN_ATOMS.size}`);
  if (isCompilableAtom('agent.unreviewedLegacyAtom')) throw new Error('未知遗产原子被放行');
});

check('A3 agent.create 产真实表单事件，实体模板只用 atl_ + uniqueName', () => {
  const state = createAgentToolCompileState();
  const events = buildAgentToolAtomEvents('agent.create', {
    name: 'atl_agent_tool_add', role: 'atl_test_role', outputType: '流式输出', agentType: '数据获取',
  }, state);
  if (events.length < 8) throw new Error(`create 事件过少：${events.length}`);
  const fills = events.filter((event) => event.action === 'fill');
  const name = fills.find((event) => event.fieldLabel === '智能体名称')?.value;
  const code = fills.find((event) => event.fieldLabel === '智能体编码')?.value;
  if (name !== 'atl_agent_tool_add_{{uniqueName}}') throw new Error(`名称模板错误：${name}`);
  if (code !== 'atl_agent_{{uniqueName}}') throw new Error(`编码模板错误：${code}`);
  if (state.agentNameTemplate !== name) throw new Error('创建目标未写入编译状态');
});

check('A4 agent.create 参数 fail-closed', () => {
  rejects(() => buildAgentToolAtomEvents('agent.create', {
    name: 'legacy_name', role: 'atl_test_role', outputType: '流式输出', agentType: '数据获取',
  }, createAgentToolCompileState()), /atl_/, '非保留前缀名称');
  rejects(() => buildAgentToolAtomEvents('agent.create', {
    name: 'atl_ok', role: 'atl_test_role', outputType: '未知输出', agentType: '数据获取',
  }, createAgentToolCompileState()), /outputType/, '未知输出类型');
});

check('A5 open/search/expand/select/confirm 均产事件且保留目标参数', () => {
  const state = createAgentToolCompileState();
  const open = buildAgentToolAtomEvents('agent.openToolPicker', {}, state);
  const search = buildAgentToolAtomEvents('picker.search', { keyword: '预约挂号', expectCount: 1, expectName: '预约挂号' }, state);
  const expand = buildAgentToolAtomEvents('picker.expandPrimary', { name: '预约挂号' }, state);
  const select = buildAgentToolAtomEvents('picker.selectFirstTool', {}, state);
  const confirm = buildAgentToolAtomEvents('agent.confirmToolPicker', {}, state);
  if (open.length !== 1 || open[0].action !== 'click') throw new Error('openToolPicker 非真实 click');
  equal(search.map((event) => event.action), ['fill', 'press'], 'search 动作');
  if (search[1].value !== '预约挂号' || search[1].text !== '预约挂号') throw new Error('search 目标未绑定');
  if (expand[0].text !== '预约挂号') throw new Error('expand 目标未绑定');
  if (select[0].nodeName !== '预约挂号' || select[0].nth !== 0) throw new Error('select 未绑定前序一级');
  if (confirm.length !== 1 || confirm[0].action !== 'click') throw new Error('confirm 非真实 click');
});

check('A6 agent.delete 与 create 同目标并含删除后复查；无创建上下文拒绝', () => {
  const state = createAgentToolCompileState();
  buildAgentToolAtomEvents('agent.create', {
    name: 'atl_agent_tool_add', role: 'atl_test_role', outputType: '流式输出', agentType: '数据获取',
  }, state);
  const events = buildAgentToolAtomEvents('agent.delete', {}, state);
  if (!events.some((event) => event.action === 'nav')) throw new Error('delete 缺列表导航');
  if (events.filter((event) => event.action === 'press').length < 2) throw new Error('delete 缺删除后复查搜索');
  if (!events.every((event) => !event.value || event.value !== 'ctxtest_加工具')) throw new Error('复制了遗产实体字面量');
  if (!events.some((event) => event.value === state.agentNameTemplate)) throw new Error('delete 未绑定 create 目标');
  rejects(() => buildAgentToolAtomEvents('agent.delete', {}, createAgentToolCompileState()), /创建目标|name/, '缺清理目标');
});

check('A7 事件字段均在冻结 schema 允许集内，且不含地址/凭据', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'tests/_golden/schemas/events.schema.json'), 'utf8'));
  const allowed = new Set(Object.keys(schema.definitions.event.properties));
  const state = createAgentToolCompileState();
  const batches = [
    buildAgentToolAtomEvents('agent.create', { name: 'atl_agent_tool_add', role: 'atl_test_role', outputType: '流式输出', agentType: '数据获取' }, state),
    buildAgentToolAtomEvents('agent.openToolPicker', {}, state),
    buildAgentToolAtomEvents('picker.search', { keyword: '预约挂号', expectCount: 1, expectName: '预约挂号' }, state),
    buildAgentToolAtomEvents('picker.expandPrimary', { name: '预约挂号' }, state),
    buildAgentToolAtomEvents('picker.selectFirstTool', {}, state),
    buildAgentToolAtomEvents('agent.confirmToolPicker', {}, state),
    buildAgentToolAtomEvents('agent.delete', {}, state),
  ];
  for (const event of batches.flat()) {
    for (const key of Object.keys(event)) if (!allowed.has(key)) throw new Error(`schema 未允许字段 ${key}`);
  }
  const text = JSON.stringify(batches);
  if (/https?:\/\//i.test(text) || /password|cookie|authorization/i.test(text)) throw new Error('事件含地址或凭据');
});

console.log(checks.join('\n'));
console.log(`${passed}/7 passed`);
process.exit(passed === 7 ? 0 : 1);
