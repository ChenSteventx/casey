// real-uat-attestation 预置（plan §2，Steven D1=A）：autotest 创建测试智能体。
// 用法：node runs/real-uat-attestation/create-agent.mjs <编码后缀a|b>
// 名称恒同（精确同名对语义）、编码各异。输出只含测试名/控件词表/计数；错误只报步骤+e.name。
import pw from '@playwright/test';
import { loadSiteConfig, loadCreds, loginBootstrap } from '/mnt/d/ctx/heren/casey/lib/login-bootstrap.mjs';

const SUT = 'http://127.0.0.1:15519';
const NAME = 'atl_同名对抗0722';
const suffix = process.argv[2];
if (suffix !== 'a' && suffix !== 'b') { console.error('用法：create-agent.mjs <a|b>'); process.exit(64); }
const CODE = `atl_dup0722_${suffix}`;

let step = 'config';
const browser = await pw.chromium.launch();
try {
  const site = loadSiteConfig(undefined, { strict: true });
  const creds = loadCreds();
  let entryPath = '/';
  try { entryPath = new URL(site.target.startUrl).pathname; } catch { /* 兜底 */ }
  const page = await (await browser.newContext()).newPage();
  step = 'login';
  await loginBootstrap(page, { site, creds, startUrl: SUT + entryPath });
  step = 'nav';
  await page.goto(SUT + '/heren/aimanagement/agent/list', { waitUntil: 'load' });
  const searchbox = page.getByRole('textbox', { name: '输入智能体名称或编码进行搜索' });
  await searchbox.waitFor({ state: 'visible', timeout: 30000 });

  await page.waitForTimeout(3000); // SPA 首屏渲染完再动

  step = 'count-before';
  await searchbox.fill(NAME);
  await searchbox.press('Enter');
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => document.querySelectorAll('article.agent-card').length);
  console.log(`count-before(${NAME}):`, before);

  step = 'open-drawer';
  // 真机形态（diag 实证）：新增智能体=下拉入口，按钮→菜单项两跳（agent.create 配方同款）。
  await page.getByRole('button', { name: '新增智能体', exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(800);
  let drawerOpen = await page.locator('.hr-drawer.hr-drawer--open:visible').count();
  if (drawerOpen === 0) {
    await page.locator('.hr-dropdown__menu:visible .hr-dropdown__item-text:text-is("新增智能体")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    drawerOpen = await page.locator('.hr-drawer.hr-drawer--open:visible').count();
  }
  if (drawerOpen === 0) throw Object.assign(new Error('x'), { name: 'DrawerNotOpen' });
  console.log('drawer-open: OK');

  step = 'sample-form';
  const labels = await page.evaluate(() => Array.from(
    document.querySelectorAll('.hr-drawer.hr-drawer--open .hr-form-item__label, .hr-drawer.hr-drawer--open label'),
  ).map((el) => (el.textContent || '').trim()).filter(Boolean));
  console.log('form-labels:', JSON.stringify([...new Set(labels)]));

  // 字段/下拉选择器逐字复用 agent.create 配方（lib/agent-tool-compile.mjs exactLabelField/drawerSelect/
  // visibleSelectOption——Heren 表单 label 不关联控件，getByLabel 不中）。
  const field = (label) => page.locator(`.hr-drawer.hr-drawer--open .hr-form__item:has(label:text-is(${JSON.stringify(label)})) input`).first();
  step = 'fill-name';
  await field('智能体名称').fill(NAME, { timeout: 5000 });
  step = 'fill-code';
  await field('智能体编码').fill(CODE, { timeout: 5000 });
  step = 'fill-role';
  await field('智能体角色编码').fill('atl_role0722', { timeout: 5000 }).catch(() => console.log('role-field: 缺席或非必填，跳过'));
  step = 'fill-desc';
  // 智能体描述必填（真机内联报错实证）；描述控件可能是 textarea。
  await field('智能体描述').fill('测易 UAT 同名对抗测试件（用后即删）', { timeout: 5000 }).catch(async () => {
    await page.locator('.hr-drawer.hr-drawer--open .hr-form__item:has(label:text-is("智能体描述")) textarea').first()
      .fill('测易 UAT 同名对抗测试件（用后即删）', { timeout: 5000 });
  });

  const drawer = page.locator('.hr-drawer.hr-drawer--open');
  const clickSelect = async (label) => {
    const trigger = page.locator(`.hr-drawer.hr-drawer--open .hr-form__item:has(*:text-is(${JSON.stringify(label)})) .hr-select:visible`).first();
    if (await trigger.count().catch(() => 0) === 0) { console.log(`select[${label}]: 触发器缺席，跳过`); return false; }
    await trigger.click({ timeout: 5000 });
    await page.waitForTimeout(600);
    return true;
  };
  const pickOption = async (preferred) => {
    const optSel = '.hr-select__dropdown:visible .hr-select-option, .hr-popup:visible .hr-select-option';
    const texts = await page.locator(optSel).allTextContents().catch(() => []);
    if (preferred) {
      const opt = page.locator(`.hr-select__dropdown:visible .hr-select-option:text-is(${JSON.stringify(preferred)}), .hr-popup:visible .hr-select-option:text-is(${JSON.stringify(preferred)})`);
      if (await opt.count().catch(() => 0) >= 1) { await opt.first().click({ timeout: 5000 }); return preferred; }
    }
    await page.locator(optSel).first().click({ timeout: 5000 });
    return `首项（词表：${JSON.stringify(texts.map((t) => t.trim()).filter(Boolean).slice(0, 6))}）`;
  };
  step = 'select-output';
  if (await clickSelect('输出类型')) console.log('输出类型 →', await pickOption('流式输出'));
  step = 'select-type';
  if (await clickSelect('类型')) console.log('类型 →', await pickOption(null));
  step = 'select-memory';
  if (await clickSelect('使用记忆体类型')) console.log('使用记忆体类型 →', await pickOption(null));
  step = 'select-collector';
  if (await clickSelect('回答收集器类型')) console.log('回答收集器类型 →', await pickOption(null));

  const doConfirm = async () => {
    await drawer.locator('.hr-drawer__footer').getByRole('button', { name: '确认', exact: true }).first()
      .click({ timeout: 5000 })
      .catch(async () => { await drawer.locator('.hr-drawer__footer .hr-button--theme-primary').first().click({ timeout: 5000 }); });
    await page.waitForTimeout(2500);
    return {
      drawerStill: await page.locator('.hr-drawer.hr-drawer--open:visible').count(),
      toasts: await page.evaluate(() => [...new Set(Array.from(
        document.querySelectorAll('.hr-toast,.hr-message,[role="status"],[role="alert"]'),
      ).map((el) => (el.textContent || '').trim()).filter(Boolean))]),
      errors: await page.evaluate(() => [...new Set(Array.from(
        document.querySelectorAll('.hr-drawer--open [class*="error"], .hr-drawer--open .hr-form__item [class*="tip"]'),
      ).map((el) => (el.textContent || '').trim()).filter(Boolean))]),
    };
  };
  // 平台按名称自动生成编码（b 轮「编码已存在」实证）：确认前最后覆写编码并回读校验，被覆盖则再写一次。
  step = 'force-code';
  for (let i = 0; i < 3; i++) {
    await field('智能体编码').fill(CODE, { timeout: 5000 });
    await page.waitForTimeout(800);
    const got = await field('智能体编码').inputValue({ timeout: 3000 }).catch(() => null);
    if (got === CODE) break;
    console.log(`code-readback 第${i + 1}把: 被改写为长${got ? got.length : 0}串，重写`);
  }
  const codeFinal = await field('智能体编码').inputValue({ timeout: 3000 }).catch(() => null);
  if (codeFinal !== CODE) { console.error(`CREATE-FAIL 编码回读不等（长${codeFinal ? codeFinal.length : 0}），fail-closed 不确认`); process.exitCode = 1; await browser.close(); process.exit(); }
  console.log('code-final: ok（=目标编码）');

  step = 'confirm';
  const c1 = await doConfirm();
  console.log('drawer-after-confirm:', c1.drawerStill, '| toasts:', JSON.stringify(c1.toasts), '| errors:', JSON.stringify(c1.errors));

  step = 'count-after';
  await page.goto(SUT + '/heren/aimanagement/agent/list', { waitUntil: 'load' });
  await searchbox.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(3000);
  let after = null;
  for (let i = 0; i < 3; i++) { // 搜索渲染时序 flake：搜后计数以「同名卡出现」为准、最多三采
    await searchbox.fill(NAME);
    await searchbox.press('Enter');
    await page.waitForTimeout(4000);
    after = await page.evaluate((n) => Array.from(document.querySelectorAll('.agent-card__title'))
      .filter((el) => ((el.getAttribute('title') || el.textContent || '').trim()) === n).length, NAME);
    if (after > 0) break;
  }
  // fail-closed（codex R6）：前后计数严格恰等（a: 0→1；b: 1→2），任何偏差=失败退出，绝不「≥」放行。
  const wantBefore = suffix === 'a' ? 0 : 1;
  const wantAfter = wantBefore + 1;
  console.log(`count-after(${NAME} 精确同名卡):`, after, `（严格判据 ${wantBefore}→${wantAfter}）`);
  if (before !== wantBefore || after !== wantAfter) {
    console.error(`CREATE-FAIL 计数不恰等（before=${before} 应${wantBefore}，after=${after} 应${wantAfter}）`);
    process.exitCode = 1;
  } else {
    console.log('CREATE-OK');
  }
} catch (e) {
  console.error(`CREATE-FAIL step=${step} err=${e && e.name}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
