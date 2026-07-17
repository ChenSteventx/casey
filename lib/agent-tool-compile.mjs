// regress agent_tool_add → Casey 的零 LLM 编译配方。
// 只产 events.schema 已允许的事件字段；页面动作与后置回读由 compile-atoms/replay-actions 执行。

export const AGENT_TOOL_ADD_ATOMS = Object.freeze([
  'agent.create',
  'agent.openToolPicker',
  'picker.search',
  'picker.expandPrimary',
  'picker.selectFirstTool',
  'agent.confirmToolPicker',
  'agent.delete',
]);

const OUTPUT_TYPES = new Set(['流式输出', '非流式输出']);
const AGENT_LIST_ROUTE_FALLBACK = '/agent/list';
const PICKER_DIALOG = '.hr-dialog:visible:has-text("仅显示已选")';

export function createAgentToolCompileState() {
  return { agentNameTemplate: null, pickerPrimaryName: null };
}

function objectParams(params, atom) {
  if (params == null) return {};
  if (typeof params !== 'object' || Array.isArray(params)) throw new TypeError(`${atom} params 须为对象`);
  return params;
}

function assertKeys(params, allowed, atom) {
  const permit = new Set(allowed);
  for (const key of Object.keys(params)) {
    if (!permit.has(key)) throw new TypeError(`${atom} 未声明参数：${key}`);
  }
}

function stringParam(params, key, { required = false, fallback = '' } = {}) {
  const raw = params[key] === undefined ? fallback : params[key];
  if (typeof raw !== 'string') throw new TypeError(`${key} 须为 string`);
  const value = raw.trim();
  if (required && !value) throw new TypeError(`${key} 须为非空 string`);
  return value;
}

function nonNegativeInteger(params, key) {
  if (params[key] === undefined) return null;
  if (!Number.isInteger(params[key]) || params[key] < 0) throw new TypeError(`${key} 须为非负整数`);
  return params[key];
}

function exactLabelField(label) {
  return `.hr-drawer.hr-drawer--open .hr-form__item:has(label:text-is(${JSON.stringify(label)})) input`;
}

function drawerSelect(label) {
  return `.hr-drawer.hr-drawer--open .hr-form__item:has(*:text-is(${JSON.stringify(label)})) .hr-select:visible`;
}

function visibleSelectOption(option) {
  const q = JSON.stringify(option);
  return `.hr-select__dropdown:visible .hr-select-option:text-is(${q}), .hr-popup:visible .hr-select-option:text-is(${q})`;
}

function createEvents(params, state) {
  assertKeys(params, ['name', 'role', 'outputType', 'agentType'], 'agent.create');
  const name = stringParam(params, 'name', { required: true });
  const role = stringParam(params, 'role', { fallback: 'atl_test_role' });
  const outputType = stringParam(params, 'outputType', { required: true });
  const agentType = stringParam(params, 'agentType', { required: true });
  if (!name.startsWith('atl_')) throw new TypeError('agent.create name 必须以 atl_ 开头');
  if (!role.startsWith('atl_')) throw new TypeError('agent.create role 必须以 atl_ 开头');
  if (!OUTPUT_TYPES.has(outputType)) throw new TypeError(`agent.create outputType 不支持：${outputType}`);

  const nameTemplate = `${name}_{{uniqueName}}`;
  state.agentNameTemplate = nameTemplate;
  return [
    {
      atom: 'agent.create', action: 'click', text: '新增智能体',
      semantic: { kind: 'role', role: 'button', name: '新增智能体', exact: true },
      fallbackCss: '.hr-button:visible:has-text("新增智能体")',
    },
    {
      atom: 'agent.create', action: 'click', text: '新增智能体',
      semantic: { kind: 'role', role: 'menuitem', name: '新增智能体', exact: true },
      fallbackCss: '.hr-dropdown__menu:visible .hr-dropdown__item-text:text-is("新增智能体")',
    },
    { atom: 'agent.create', action: 'fill', fieldLabel: '智能体名称', value: nameTemplate, required: true, uniqueGuard: true, fallbackCss: exactLabelField('智能体名称') },
    { atom: 'agent.create', action: 'fill', fieldLabel: '智能体编码', value: 'atl_agent_{{uniqueName}}', required: true, uniqueGuard: true, fallbackCss: exactLabelField('智能体编码') },
    { atom: 'agent.create', action: 'fill', fieldLabel: '智能体角色编码', value: role, required: true, fallbackCss: exactLabelField('智能体角色编码') },
    { atom: 'agent.create', action: 'click', text: '输出类型', fallbackCss: drawerSelect('输出类型') },
    { atom: 'agent.create', action: 'click', text: outputType, fallbackCss: visibleSelectOption(outputType) },
    { atom: 'agent.create', action: 'click', text: '类型', fallbackCss: drawerSelect('类型') },
    { atom: 'agent.create', action: 'click', text: agentType, fallbackCss: visibleSelectOption(agentType) },
    {
      atom: 'agent.create', action: 'click', text: '确认',
      semantic: { kind: 'role', role: 'button', name: '确认', exact: true },
      fallbackCss: '.hr-drawer.hr-drawer--open .hr-drawer__footer .hr-button--theme-primary',
    },
  ];
}

function openPickerEvents(params) {
  if (Object.keys(params).length) throw new TypeError('agent.openToolPicker 不接受参数');
  return [{
    atom: 'agent.openToolPicker', action: 'click', text: '添加',
    fallbackCss: '.agent-detail:visible :text-is("添加")',
  }];
}

function searchEvents(params, state) {
  assertKeys(params, ['keyword', 'expectCount', 'expectName'], 'picker.search');
  const keyword = stringParam(params, 'keyword', { required: true });
  const expectCount = nonNegativeInteger(params, 'expectCount');
  const expectName = stringParam(params, 'expectName', { fallback: '' });
  if (expectCount === 0) throw new TypeError('picker.search 在 agent_tool_add 纵切中 expectCount 必须大于 0');
  state.pickerPrimaryName = expectName || keyword;
  const target = `${PICKER_DIALOG} input[placeholder="请输入关键字搜索"]`;
  return [
    { atom: 'picker.search', action: 'fill', value: keyword, fieldLabel: '请输入关键字搜索', fallbackCss: target },
    { atom: 'picker.search', action: 'press', key: 'Enter', value: keyword, text: state.pickerPrimaryName, fallbackCss: target },
  ];
}

function expandEvents(params, state) {
  assertKeys(params, ['name'], 'picker.expandPrimary');
  const name = stringParam(params, 'name', { required: true });
  if (state.pickerPrimaryName && state.pickerPrimaryName !== name) {
    throw new TypeError(`picker.expandPrimary name 与前序搜索目标不一致：${name}`);
  }
  state.pickerPrimaryName = name;
  return [{
    atom: 'picker.expandPrimary', action: 'click', text: name,
    fallbackCss: `${PICKER_DIALOG} .hr-collapse-panel__header`,
  }];
}

function selectEvents(params, state) {
  assertKeys(params, ['under'], 'picker.selectFirstTool');
  const under = stringParam(params, 'under', { fallback: '' });
  const primary = under || state.pickerPrimaryName;
  if (!primary) throw new TypeError('picker.selectFirstTool 缺前序一级目标 under');
  if (state.pickerPrimaryName && under && state.pickerPrimaryName !== under) {
    throw new TypeError(`picker.selectFirstTool under 与前序展开目标不一致：${under}`);
  }
  return [{
    atom: 'picker.selectFirstTool', action: 'click', text: '第一个工具', nodeName: primary, nth: 0,
    fallbackCss: `${PICKER_DIALOG} .tool-item:visible .hr-checkbox`,
  }];
}

function confirmEvents(params) {
  if (Object.keys(params).length) throw new TypeError('agent.confirmToolPicker 不接受参数');
  return [{
    atom: 'agent.confirmToolPicker', action: 'click', text: '确认',
    fallbackCss: `${PICKER_DIALOG} .hr-button:text-is("确认")`,
  }];
}

function deleteEvents(params, state) {
  assertKeys(params, ['name'], 'agent.delete');
  const explicit = stringParam(params, 'name', { fallback: '' });
  const createdBase = typeof state.agentNameTemplate === 'string'
    ? state.agentNameTemplate.replace(/_\{\{uniqueName\}\}$/, '')
    : '';
  if (explicit && state.agentNameTemplate && explicit !== createdBase && explicit !== state.agentNameTemplate) {
    throw new TypeError('agent.delete name 与前序创建目标不一致');
  }
  const target = state.agentNameTemplate || explicit;
  if (!target) throw new TypeError('agent.delete 缺 name 或前序创建目标');
  if (!state.agentNameTemplate && !target.includes('{{uniqueName}}')) {
    throw new TypeError('agent.delete 独立目标必须携 {{uniqueName}}，拒绝删除未由本次创建绑定的固定实体');
  }
  if (!target.startsWith('atl_')) throw new TypeError('agent.delete name 必须以 atl_ 开头');
  const search = { kind: 'role', role: 'textbox', name: '输入智能体名称或编码进行搜索', exact: true };
  return [
    { atom: 'agent.delete', action: 'nav', url: `{{baseUrl}}${AGENT_LIST_ROUTE_FALLBACK}`, value: target },
    { atom: 'agent.delete', action: 'fill', semantic: search, value: target },
    { atom: 'agent.delete', action: 'press', semantic: search, key: 'Enter', value: target },
    { atom: 'agent.delete', action: 'click', text: '删除', value: target },
    { atom: 'agent.delete', action: 'click', text: '确定', value: target },
    { atom: 'agent.delete', action: 'fill', semantic: search, value: target },
    { atom: 'agent.delete', action: 'press', semantic: search, key: 'Enter', value: target, text: 'post-delete-zero' },
  ];
}

export function buildAgentToolAtomEvents(atom, rawParams = {}, state = createAgentToolCompileState()) {
  const params = objectParams(rawParams, atom);
  if (!state || typeof state !== 'object') throw new TypeError('agent tool compile state 须为对象');
  if (atom === 'agent.create') return createEvents(params, state);
  if (atom === 'agent.openToolPicker') return openPickerEvents(params);
  if (atom === 'picker.search') return searchEvents(params, state);
  if (atom === 'picker.expandPrimary') return expandEvents(params, state);
  if (atom === 'picker.selectFirstTool') return selectEvents(params, state);
  if (atom === 'agent.confirmToolPicker') return confirmEvents(params);
  if (atom === 'agent.delete') return deleteEvents(params, state);
  throw new TypeError(`不支持的 agent tool atom：${atom}`);
}
