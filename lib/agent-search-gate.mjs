// lib/agent-search-gate.mjs —— agent.searchOpen 条目定位共享门（entity-ui-wiring W1）。
// 编译门=回放门同刻（openNode F2 元教训）：lib/compile-atoms.mjs 与 lib/replay-actions.mjs 都 import 本文件，
// 消费同一函数；任何一侧私改定位语义都会破坏同刻纪律（金牌 A3 以 import 结构钉死）。
//
// 语义（金牌 A1 钉死）：精确锚（exact:true，绝不子串）+ 记录容器归属闸（命中必须落在智能体条目容器内，
// 默认 '.agent-item'，profile.agents.itemContainer 可覆写、真机类名采样挂 route:human）。结构化裁定：
//   unique         恰一命中且在容器内（唯一可点）；
//   ambiguous      多命中（同名双条目等）——硬阻断，绝不 .first()/nth 猜（护栏 #14）；
//   absent         零命中（openName 只是某条目子串时 exact:true 归零——旧 exact:false 假绿病灶被杀）；
//   container-out  恰一命中但落在条目容器外（同名非条目控件碰撞）——硬阻断 fail-closed。
// 计数/归属证不出（采样异常）一律按不可点处理，绝不带疑落笔。

export async function resolveAgentSearchTarget(page, { openName, containerSelector = '.agent-item' } = {}) {
  const name = typeof openName === 'string' ? openName : '';
  if (!name.trim()) return { resolution: 'absent', candidateCount: 0 };
  const probe = page.getByText(name, { exact: true });
  const count = await probe.count().catch(() => null);
  if (count === null || count === 0) return { resolution: 'absent', candidateCount: 0 };
  if (count > 1) return { resolution: 'ambiguous', candidateCount: count };
  const inContainer = await probe
    .evaluate((el, sel) => !!el.closest(sel), containerSelector)
    .catch(() => null);
  if (inContainer !== true) return { resolution: 'container-out', candidateCount: 1 };
  return { resolution: 'unique', candidateCount: 1 };
}
