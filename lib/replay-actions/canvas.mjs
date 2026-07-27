import { findEquivalentAffordance } from '../drift-probe.mjs';

const exactTextRe = (s) => new RegExp(`^${String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

async function canvasBox(page) {
  const locs = [page.locator('.lf-canvas-overlay'), page.locator('.lf-graph')];
  for (const loc of locs) {
    if ((await loc.count().catch(() => 0)) !== 1) continue;
    const box = await loc.boundingBox().catch(() => null);
    if (box) return box;
  }
  return null;
}

async function nodeBoxByLabel(page, label) {
  const handle = page.locator('.lf-canvas-overlay').getByText(label, { exact: true }).first();
  // 缺席守卫（codex R2-F1）：waitFor 抛不得穿出——节点缺席 → 返回 null，让 doConnectNodes 的 !sBox/!eBox
  // 优雅落 none（否则 TimeoutError 穿出 performAction 崩整轮回放、废后续 intent，非单步降级）。同 nodeDragSource 守卫。
  try { await handle.waitFor({ state: 'visible', timeout: 5000 }); } catch { return null; }
  return await handle.evaluate((el) => {
    let n = el;
    while (n && !(n.classList && n.classList.contains('lf-node'))) n = n.parentElement;
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }).catch(() => null);
}

async function nodeDragSource(page, name) {
  const src = page.locator('.node-item').filter({ hasText: exactTextRe(name) });
  try { await src.first().waitFor({ state: 'visible', timeout: 5000 }); } catch { /* 计数照实 */ }
  const n = await src.count().catch(() => 0);
  if (n !== 1) return { locator: src, count: n, box: null };

  const item = src.first();
  const icon = item.locator('.node-icon, [class*="hr-icon"], svg, i').first();
  let box = null;
  if ((await icon.count().catch(() => 0)) >= 1) box = await icon.boundingBox().catch(() => null);
  if (!box) box = await item.boundingBox().catch(() => null);
  return { locator: item, count: 1, box };
}

async function doConnectNodes(page, ev) {
  const from = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
  const to = typeof ev.nodeName === 'string' && ev.nodeName ? ev.nodeName : null;
  if (!from || !to) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };

  const before = await page.locator('.lf-edge').count().catch(() => null);
  const sBox = await nodeBoxByLabel(page, from);
  const eBox = await nodeBoxByLabel(page, to);
  if (!sBox || !eBox) return { resolution: 'none', candidateCount: 0, identityReadback: { ok: false } };

  const ok = await (async () => {
    try {
      await page.mouse.move(sBox.x + sBox.w / 2, sBox.y + sBox.h / 2);
      await page.waitForTimeout(300);
      const srcAnchor = await page.evaluate(({ x, y, w, h }) => {
        const target = { x: x + w, y: y + h / 2 };
        let best = null;
        let bestD = Infinity;
        document.querySelectorAll('.lf-node-anchor-hover').forEach((c) => {
          const r = c.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const cx = r.x + r.width / 2;
          const cy = r.y + r.height / 2;
          const d = Math.hypot(cx - target.x, cy - target.y);
          if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
        });
        return best;
      }, sBox);
      if (!srcAnchor) return false;
      await page.mouse.move(srcAnchor.x, srcAnchor.y);
      await page.waitForTimeout(200);
      await page.mouse.down();
      try {
        await page.mouse.move(eBox.x + eBox.w / 2, eBox.y + eBox.h / 2, { steps: 30 });
        await page.waitForTimeout(300);
      } finally {
        await page.mouse.up();
      }
      await page.waitForTimeout(500);
      return true;
    } catch {
      return false;
    }
  })();
  if (!ok) return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
  const after = await page.locator('.lf-edge').count().catch(() => null);
  if (before != null && after != null && after > before) return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
  return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
}

// 当前节点抽屉专属锚（drawer-lock-hardening GRILL D2，评审修订同刻）：可见 .hr-drawer__content-wrapper
// 且内含【自身也可见】的精确标题文本——filter({has}) 只证「后代存在该文本」、不证该文本节点自身可见
// （wrapper 可见但标题 display:none 隐藏也会被 filter 命中，评审 F1/D2 修订：堵「wrapper 可见但标题藏在
// 隐藏节点」的假命中），故逐候选二次核验标题文本自身 :visible。openNode/selectNodeDropdown/setNodeField
// 三原子共用此域锁（编译门 lib/compile-atoms.mjs 有同算法的独立一份实现，两门同刻；既有代码
// semanticLocator/canvasBox 等同类重复的先例）。
// A1 修复（汇裁 r4）：一次性快照物理句柄（elementHandles 单次解析即锚定全体候选），再逐句柄页内核验
// 可见标题——不再经任何惰性 nth(k) Locator 重解析。扫描即锚定：快照之后任何同标题替换 → 句柄脱附 →
// 后续核验/盖章抛错落 fail-closed，构造上封死「检查过的节点 ≠ 锚定的节点」（身份连续性在扫描原点即成立，
// 堵初次域扫描后到盖章前同标题抽屉原位替换的 TOCTOU 残留）。返回物理句柄数组，调用方用完 disposeDomain
// 释放；未通过标题核验的候选当场释放不外泄。可见性判据对齐 Playwright :visible（非空盒 + visibility 未隐藏）。
export async function doDragTo(page, ev) {
  if (ev.atom === 'workflow.connectNodes') return await doConnectNodes(page, ev);
  const name = ev.semantic && ev.semantic.kind === 'text' && typeof ev.semantic.name === 'string' ? ev.semantic.name : null;
  if (!name) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } }; // 源语义证不出，不猜
  const src = await nodeDragSource(page, name);
  const n = src.count;
  if (n > 1) return { resolution: 'ambiguous', candidateCount: n };
  if (n === 0) {
    const driftProbe = await findEquivalentAffordance(page, ev.atom, ev.targetName);
    return { resolution: 'none', candidateCount: 0, driftProbe };
  }
  const ok = await (async () => {
    try {
      if (!Number.isFinite(ev.ox) || !Number.isFinite(ev.oy)) return false; // 落点证不出（R1-F1）
      const gbox = await canvasBox(page);
      const sbox = src.box;
      if (!gbox || !sbox) return false;
      await page.waitForTimeout(500);
      await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
      await page.mouse.down();
      try {
        await page.mouse.move(gbox.x + ev.ox, gbox.y + ev.oy, { steps: 20 });
        await page.waitForTimeout(300);
      } finally { await page.mouse.up(); }
      await page.waitForTimeout(500);
      return true;
    } catch { return false; }
  })();
  if (ok) return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
  return { resolution: 'action_failed', candidateCount: 1, identityReadback: { ok: false } };
}

// 解析候选：先语义定位器，语义 0 命中再 fallbackCss（次级兜底）。返回 { locator, count } 或 { count:0 }。
