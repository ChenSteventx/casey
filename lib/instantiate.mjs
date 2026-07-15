// 模板实例化（instantiate）—— 回放期把 events 里的 {{uniqueName}} 等占位符回填成本次 run 的确定性值。
// 冻结占位符、不冻一次性生成值（护栏 #6）；hermetic 用确定性令牌，真机由 compile-gate 注入带 Reserved Prefix 的实体名。
export function instantiate(value, ctx) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (m, k) => (ctx && k in ctx ? String(ctx[k]) : m));
}
