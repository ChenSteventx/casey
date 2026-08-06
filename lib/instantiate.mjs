// 模板实例化（instantiate）—— 回放期把 events 里的 {{uniqueName}} 等占位符回填成本次 run 的确定性值。
// 冻结占位符、不冻一次性生成值（护栏 #6）；hermetic 用确定性令牌，真机由 compile-gate 注入带 Reserved Prefix 的实体名。
export function instantiate(value, ctx) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (m, k) => (ctx && k in ctx ? String(ctx[k]) : m));
}

// 事件语义名回填投影（semantic-name-instantiate）：events 的 semantic.name 落盘必须保留 {{uniqueName}}
// 等占位符（回放才能按各自 ctx 回填），但定位那一刻必须拿实例化名——否则以字面 {{…}} 找元素恒 0 命中
// （B4 九跑实证：workflow.open 探针命中真名、emit 找字面模板 absent）。本函数只在真含占位时返回浅拷贝
// （原 ev 与落盘字节永不被改），无占位/无 ctx/非法形状一律原样返回——既有事件零漂移。
export function instantiateEventSemantic(ev, ctx) {
  const name = ev && ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
  if (name === null || !name.includes('{{')) return ev;
  const filled = instantiate(name, ctx);
  if (filled === name) return ev;
  return { ...ev, semantic: { ...ev.semantic, name: filled } };
}
