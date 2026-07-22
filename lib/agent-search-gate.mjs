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

// 物理卡片双锚门（agent-id-readback，codex R1-H1 + R2-H1 句柄连续性）：身份通道声明时的 DOM 证据
// 采集面——同一物理卡片内读标题(name)+副标题(code)，返回【钉在快照节点上的 ElementHandle】供
// 「同卡重验+同卡点击」消费（编译门=回放门同刻，本文件单一事实源）。R2-H1 修正：绝不用惰性
// Locator（nth/locator 每次消费都重新解析，重排后验的是新节点）——evaluateHandle 单次快照内圈定
// 命中卡片集合并取元素句柄，后续 evaluate/点击都作用于同一物理节点（selectNodeDropdown 同款纪律）。
// 计数在容器卡片集合上做（先圈容器再数名）；采样异常按证不出回 failed，绝不带疑放行。
export async function resolveAgentCardTarget(page, { openName, containerSelector, cardFields } = {}) {
  const name = typeof openName === 'string' ? openName : '';
  if (!name.trim() || !containerSelector || !cardFields
    || typeof cardFields.name !== 'string' || typeof cardFields.code !== 'string') {
    return { resolution: 'failed', candidateCount: 0 };
  }
  let listHandle = null;
  const disposables = [];
  try {
    // 单次 evaluateHandle 原子快照：容器集合内按 name 子选择器精确等圈命中卡片，回元素数组句柄。
    listHandle = await page.evaluateHandle(({ containerSel, nameSel, wanted }) => (
      Array.from(document.querySelectorAll(containerSel)).filter((el) => {
        const nameNode = el.querySelector(nameSel);
        return !!nameNode && nameNode.textContent === wanted;
      })
    ), { containerSel: containerSelector, nameSel: cardFields.name, wanted: name });
    const props = await listHandle.getProperties();
    const hits = [];
    for (const value of props.values()) {
      const el = value.asElement();
      if (el) { hits.push(el); disposables.push(el); } else { await value.dispose().catch(() => {}); }
    }
    if (hits.length === 0) return { resolution: 'absent', candidateCount: 0 };
    if (hits.length > 1) return { resolution: 'ambiguous', candidateCount: hits.length };
    const card = hits[0];
    // code 从同一物理句柄读出（句柄即节点，重排/替换后读的仍是原节点或如实 detached 失败）。
    const code = await card.evaluate((el, codeSel) => {
      const codeNode = el.querySelector(codeSel);
      return codeNode ? codeNode.textContent : null;
    }, cardFields.code).catch(() => null);
    disposables.splice(disposables.indexOf(card), 1); // 命中卡句柄交调用方，其余照常释放
    return {
      resolution: 'unique',
      candidateCount: 1,
      card,
      name,
      code: typeof code === 'string' ? code : null,
    };
  } catch {
    return { resolution: 'failed', candidateCount: 0 };
  } finally {
    for (const h of disposables) await h.dispose().catch(() => {});
    if (listHandle) await listHandle.dispose().catch(() => {});
  }
}

// 句柄内点击（codex R1-H1 TOCTOU 封缝 + R2-H1 物理同一）：card 是 resolveAgentCardTarget 钉下的
// ElementHandle——重验与点击都作用于同一物理节点：isConnected=false（节点被替换/摘除）如实拒点，
// 点击落在同节点内 name 子句柄（真机语义同款），绝不回退全页重定位、绝不重新解析。
export async function clickAgentCardWithin(card, { cardFields, name, code, timeoutMs = 10000 } = {}) {
  if (!card || typeof card.evaluate !== 'function' || typeof card.$ !== 'function'
    || !cardFields || typeof name !== 'string' || typeof code !== 'string') return false;
  const stillSame = await card
    .evaluate((el, { nameSel, codeSel, wantedName, wantedCode }) => {
      if (!el.isConnected) return false;
      if (!(el.getClientRects().length > 0)) return false;
      const nameNode = el.querySelector(nameSel);
      const codeNode = el.querySelector(codeSel);
      return !!nameNode && nameNode.textContent === wantedName
        && !!codeNode && codeNode.textContent === wantedCode;
    }, { nameSel: cardFields.name, codeSel: cardFields.code, wantedName: name, wantedCode: code })
    .catch(() => false);
  if (stillSame !== true) return false;
  let nameHandle = null;
  try {
    nameHandle = await card.$(cardFields.name);
    if (!nameHandle) return false;
    await nameHandle.click({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  } finally {
    if (nameHandle) await nameHandle.dispose().catch(() => {});
  }
}
