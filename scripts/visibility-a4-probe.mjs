// assert-visibility-semantics · A4 辅助探针（GRILL A4 硬要求，不是可选项）
//
// 证什么：真机上按 Esc 之后，「创建时间」是【留在 DOM 里但不可见】，而不是【被卸载】
// 或【动作根本没发生】。这是唯一能把「口径修对了」与「把动作失败洗绿」区分开的证据。
//
// 怎么证：独立浏览器会话，走真登录预备动作 → 列表页按名搜到本轮真机跑留下的已发布
// 工作流 → 打开 → 点「历史版本」→ 读【DOM 命中】与【可见命中】两个数 → 按 Esc →
// 再读两个数。期望 1/1 → 1/0。
//
// 纪律：只读探针，不新建、不改、不删任何被测对象（消费的是真机复跑已经留下的残留）；
// 不落任何凭据、不打印站点地址；产出只有四个整数与判定串。
//
// 现状（2026-07-31 凌晨）：**已跑通**。首末轮各一次，均得 Esc 前 DOM 1 / 可见 1、
// Esc 后 DOM 1 / 可见 0，判定 HIDDEN_NOT_UNMOUNTED。踩过并已解决的四个坑，留给后来者：
//   ① 执行目标必须先铸权、再据它启动浏览器。本机隧道是保真代理形态：浏览器指向逻辑源、
//      流量走 runtime.proxyServer。跳过这步按 direct 猜，导航期就被同源连续性判据拒掉
//      （实测 NAVIGATION_FAILED）。
//   ② 调登录预备动作之前要先预热页面。它在单页应用窗口里只给登录表单 3 秒出现机会
//      （lib/login-bootstrap.mjs 的 waitFor timeout: 3000），超时即判「表单不在场=已是登录态」
//      直接返回 {loggedIn:true, viaForm:false}——壳渲染慢时会走这条路，于是根本没登录：
//      页面壳在、列表数据空、再显式导航被踢回登录页。预热后返回 viaForm:true 才是真登进去了。
//   ③ 要等剖面登记的路由加载遮罩退场，否则数到的卡片恒为 0。
//   ④ 列表卡片的真类名是 .agent-card，不是剖面 countSelector 里那个
//      .hr-card.hr-card--bordered（该选择器与真机列表页 DOM 不符，另行挂账，本探针不改剖面）。
//
// 用法：node scripts/visibility-a4-probe.mjs --sut <回环基址> --name <本轮 uniqueName>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { resolveCliExecutionTarget, playwrightLaunchOptions } from '../lib/execution-target/wiring.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const sut = arg('--sut');
const uniqueName = arg('--name');
if (!sut || !uniqueName) {
  console.error('用法：--sut <回环基址> --name <本轮 uniqueName>');
  process.exit(64);
}
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(sut)) {
  console.error('--sut 只接受回环基址（护栏 #7：真实目标地址不进命令行与日志）');
  process.exit(64);
}

const TARGET_TEXT = '创建时间';
const WF_NAME = `atl_${uniqueName}`;

// 可见谓词逐字复刻 lib/replay/intent-observation.mjs 的 visibleCount，
// 保证探针与生产采集用同一把尺（谓词漂了，探针就不再是这条链的证据）。
const VISIBLE_PREDICATE = (elements) => elements.filter((element) => element.getClientRects().length > 0
  && getComputedStyle(element).visibility !== 'hidden').length;

async function readBoth(page) {
  const locator = page.getByText(TARGET_TEXT);
  const dom = await locator.count();
  const visible = dom === 0 ? 0 : await locator.evaluateAll(VISIBLE_PREDICATE);
  return { dom, visible };
}

// 执行目标先铸权、再按它启动浏览器（bin/replay.mjs:240/372 同款顺序）。本机隧道是保真代理形态：
// 浏览器看到的是逻辑源、流量由 runtime.proxyServer 走回环隧道。若跳过这步自己按 direct 猜，
// 导航期就会被同源连续性判据拒掉（实测 NAVIGATION_FAILED）。
const site = loadSiteConfig();
const creds = loadCreds();
const routes = JSON.parse(readFileSync('cases/tc_wf_publish_states/profile.json', 'utf8')).routes;
const execution = resolveCliExecutionTarget({ site, cliSut: sut, requiresOriginContinuity: true });
if (!execution.ok) {
  console.error(`执行目标铸权未过：${execution.reason || '未知'}`);
  process.exit(65);
}

const browser = await chromium.launch(playwrightLaunchOptions(execution.runtime, { headless: true }));
const context = await browser.newContext();
const page = await context.newPage();
let exitCode = 0;
let stage = '起手';
try {
  // browserVisibleBaseUrl 携真实逻辑源，只进内存与浏览器，绝不打印（护栏 #7）。
  const listUrl = `${execution.runtime.browserVisibleBaseUrl}${routes.workflowList}`;

  // 预热：先自己导航并把登录表单等出来，再调登录预备动作。
  // 原因（实测定位）：loginBootstrap 在单页应用窗口里只给登录表单 3 秒出现机会
  // （lib/login-bootstrap.mjs 的 waitFor timeout: 3000），超时即判「不在场=已登录态」直接返回
  // {loggedIn:true, viaForm:false}——壳渲染慢时会走这条路，于是根本没登录：页面壳在、
  // 列表数据空、显式再导航被踢回登录页。预热让表单在调用前就已就绪，避开这个窗口。
  stage = '预热登录页';
  await page.goto(listUrl, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await page.locator('.route-loading-mask').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  stage = '登录预备动作';
  const boot = await loginBootstrap(page, {
    site,
    creds,
    startUrl: listUrl,
    executionTargetAuthority: execution.authority,
  });
  console.error(`[阶段] 登录返回 loggedIn=${boot?.loggedIn} viaForm=${boot?.viaForm}`);
  if (boot && boot.ok === false) {
    console.error(`登录预备动作未过：${boot.reason || '未知'}`);
    process.exit(65);
  }
  await page.waitForLoadState('load');

  // 按名定位本轮残留的已发布工作流卡片并打开。逐阶段标记，超时时能指出卡在哪一步
  // （只报阶段名与计数，不报页面内容）。
  // 静默点：剖面登记的路由加载遮罩退场后才算列表就绪（cases/tc_wf_publish_states/profile.json
  // 的 loading.selectors）。不等它就去数卡片，数到的是 0（实测踩过）。
  stage = '等路由加载遮罩退场';
  await page.locator('.route-loading-mask').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  stage = '列表页卡片可见';
  // 诊断：只报结构计数与路径尾段，不报页面内容（护栏 #7）。
  const diag = await page.evaluate(() => ({
    path: location.pathname,
    anyCard: document.querySelectorAll('.agent-card').length,
    published: document.querySelectorAll('.is-published').length,
    rows: document.querySelectorAll('tr').length,
    buttons: document.querySelectorAll('button').length,
    mask: document.querySelectorAll('.route-loading-mask').length,
  }));
  console.error(`[诊断] ${JSON.stringify(diag)}`);
  const classCensus = await page.evaluate(() => {
    const freq = new Map();
    for (const el of document.querySelectorAll('*')) {
      for (const c of el.classList) freq.set(c, (freq.get(c) || 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  });
  console.error(`[类名普查] ${JSON.stringify(classCensus)}`);
  await page.locator('.agent-card').first()
    .waitFor({ state: 'visible', timeout: 30000 });
  const cardTotal = await page.locator('.agent-card').count();
  const cardMatch = await page.locator('.agent-card', { hasText: WF_NAME }).count();
  console.error(`[阶段] 列表卡片总数=${cardTotal} 按名命中=${cardMatch}`);
  const card = page.locator('.agent-card', { hasText: WF_NAME }).first();
  await card.waitFor({ state: 'visible', timeout: 20000 });

  stage = '打开工作流';
  await card.click();
  await page.waitForLoadState('load');

  stage = '点历史版本';
  await page.getByRole('button', { name: '历史版本' }).first().click();

  stage = '等版本表出现';
  await page.getByText(TARGET_TEXT).first().waitFor({ state: 'visible', timeout: 20000 });

  const before = await readBoth(page);
  await page.keyboard.press('Escape');
  // 关闭是渲染动作，给一个有界观察窗；不做固定延时糊判据（GRILL R1）。
  await page.waitForTimeout(1500);
  const after = await readBoth(page);

  const verdict = (before.dom >= 1 && before.visible >= 1 && after.dom >= 1 && after.visible === 0)
    ? 'HIDDEN_NOT_UNMOUNTED'
    : (after.dom === 0 && after.visible === 0 ? 'UNMOUNTED' : 'UNEXPECTED');

  console.log(JSON.stringify({
    probe: 'assert-visibility-semantics-a4',
    workflow: WF_NAME,
    beforeEsc: before,
    afterEsc: after,
    verdict,
    note: verdict === 'HIDDEN_NOT_UNMOUNTED'
      ? '按 Esc 后节点仍在 DOM 但不可见——正是本契约纠偏的真机接缝，且证明关闭动作确实发生过'
      : (verdict === 'UNMOUNTED'
        ? '按 Esc 后节点被卸载：textHidden 依然成立（注册表定义含未挂载），但本轮不构成「隐藏不卸载」的接缝证据'
        : '与预期不符：可能弹窗没关（可见命中未归零）或打开就没成功（Esc 前可见命中为 0）'),
  }, null, 2));
  if (verdict === 'UNEXPECTED') exitCode = 1;
} catch (error) {
  // 只报错误类名与短消息，绝不整段回显（可能带站点信息）。
  console.error(`探针异常：${error?.name || 'Error'}（卡在阶段：${stage}）`);
  exitCode = 2;
} finally {
  await browser.close();
}
process.exit(exitCode);
