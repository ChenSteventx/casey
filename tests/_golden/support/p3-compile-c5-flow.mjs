// workflow.deleteByName 入口缺席义务的纯数据夹具：只携删除步，不夹带 workflow.create。

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} 必须为非空字符串`);
  return value;
}

export function buildDeleteByNameOnlyFlow(options = {}) {
  const caseId = requiredText(options.caseId, 'caseId');
  return {
    id: caseId,
    name: '编译冒烟',
    category: 'normal',
    steps: [{
      atom: 'workflow.deleteByName',
      params: { name: 'atl_{{uniqueName}}' },
      sourceIntentId: 'intent_cleanup',
      entityBindings: [{ candidateId: 'candidate-wf-main', role: 'subject' }],
    }],
  };
}
