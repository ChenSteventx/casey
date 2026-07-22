// agent-id-readback poison spy 解析钩子（spy-loader.mjs 注册；差分棘轮金牌消费）。
// 只观察不干预：任何指向身份模块的真实解析都追加落盘，解析结果原样放行。
import { appendFileSync } from 'node:fs';

export async function resolve(specifier, context, next) {
  const resolved = await next(specifier, context);
  const url = resolved && resolved.url ? resolved.url : '';
  if (process.env.AGENT_ID_SPY_OUT && /agent-identity-(observation|gate)\.mjs$/.test(url)) {
    appendFileSync(process.env.AGENT_ID_SPY_OUT, url + '\n');
  }
  return resolved;
}
