// workflow.deleteByName 破坏性 click 的 spec 前置闸。
//
// 新编译器会把目标名模板写入删除触发与确认两个 click 的 value。旧 events 缺此绑定时，
// 若等到浏览器内执行才失败，前面的创建/发布已经发生，容易留下 atl_ 测试数据。
// 因此回放必须在启动浏览器、接触 SUT 之前拒绝这类陈旧 spec；修复方式是重编译，
// 不是从搜索框猜目标名或放宽动作域锁。

// 放大镜精确形状白名单谓词（delete-spec-magnifier，Steven 裁 2026-08-08）：删除搜索修契约给本域
// 新增的搜索触发器 click——文案 null ∧ value 缺 ∧ fallbackCss 逐字等于编译器字面才算（非破坏、
// 无目标绑定义务）；css 对但携文案/携 value = 形状矛盾不混装。
// 单点纪律（replay-magnifier-dispatch 契约）：本谓词是该形状的唯一判定点，前置闸与回放分发层
// 都必须消费它——此前两层各写各的（前置闸放行、分发层无对应支而拒点），同一契约两层不一致，
// 三例清理意图折叠必败恒 NEEDS_HUMAN。判据字面只许活在这里。
export function isMagnifierSearchClick(ev) {
  if (!ev || ev.atom !== 'workflow.deleteByName' || ev.action !== 'click') return false;
  const label = ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
  return label == null
    && (typeof ev.value !== 'string' || !ev.value.trim())
    && ev.fallbackCss === '.hr-input__suffix .search-icon';
}

export function validateWorkflowDeleteBindings(events) {
  const problems = [];
  for (const ev of Array.isArray(events) ? events : []) {
    if (ev?.atom !== 'workflow.deleteByName' || ev?.action !== 'click') continue;
    const label = ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
    if (isMagnifierSearchClick(ev)) continue;
    // 域内只允许编译器定义的三个破坏性 click。任何未知/缺失文案必须在开浏览器前拒绝，
    // 不能掉进通用 click 分支，也不能因“不是已知标签”而跳过目标绑定检查。
    if (!['删除', '确定', '确认'].includes(label)) {
      problems.push({ stepId: ev.stepId ?? null, reason: 'unsupported_click_label' });
      continue;
    }
    if (typeof ev.value !== 'string' || !ev.value.trim()) {
      problems.push({ stepId: ev.stepId ?? null, reason: 'missing_target_binding' });
    }
  }
  return { ok: problems.length === 0, problems };
}
