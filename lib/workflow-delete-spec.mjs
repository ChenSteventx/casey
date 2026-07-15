// workflow.deleteByName 破坏性 click 的 spec 前置闸。
//
// 新编译器会把目标名模板写入删除触发与确认两个 click 的 value。旧 events 缺此绑定时，
// 若等到浏览器内执行才失败，前面的创建/发布已经发生，容易留下 atl_ 测试数据。
// 因此回放必须在启动浏览器、接触 SUT 之前拒绝这类陈旧 spec；修复方式是重编译，
// 不是从搜索框猜目标名或放宽动作域锁。
export function validateWorkflowDeleteBindings(events) {
  const problems = [];
  for (const ev of Array.isArray(events) ? events : []) {
    if (ev?.atom !== 'workflow.deleteByName' || ev?.action !== 'click') continue;
    const label = ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
    if (!['删除', '确定', '确认'].includes(label)) continue;
    if (typeof ev.value !== 'string' || !ev.value.trim()) {
      problems.push({ stepId: ev.stepId ?? null, reason: 'missing_target_binding' });
    }
  }
  return { ok: problems.length === 0, problems };
}
