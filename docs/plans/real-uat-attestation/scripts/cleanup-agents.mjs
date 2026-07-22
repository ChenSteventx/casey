// real-uat-attestation 清理（plan §4 末）：删除两件同名测试智能体（按编码副标题逐卡定位——
// 同名双卡在场，裸「删除」点击即歧义；清理自身也守双锚纪律）。输出只含测试名/编码/计数。
import pw from '@playwright/test';
import { loadSiteConfig, loadCreds, loginBootstrap } from '/mnt/d/ctx/heren/casey/lib/login-bootstrap.mjs';

const SUT = 'http://127.0.0.1:15519';
const NAME = 'atl_同名对抗0722';
const CODES = ['atl_dup0722_b', 'atl_dup0722_a']; // run-2 对：两件均显式码
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
  const searchbox = page.getByRole('textbox', { name: '输入智能体名称或编码进行搜索' });
  const research = async () => {
    await page.goto(SUT + '/heren/aimanagement/agent/list', { waitUntil: 'load' });
    await searchbox.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);
    await searchbox.fill(NAME);
    await searchbox.press('Enter');
    await page.waitForTimeout(4000);
    return page.evaluate((n) => Array.from(document.querySelectorAll('.agent-card__title'))
      .filter((el) => ((el.getAttribute('title') || el.textContent || '').trim()) === n).length, NAME);
  };
  step = 'count-initial';
  let count = await research();
  console.log('同名卡-初始:', count);

  for (const code of CODES) {
    step = `delete-${code}`;
    const card = page.locator(`article.agent-card:has(.agent-card__subtitle:text-is(${JSON.stringify(code)}))`);
    const cardN = await card.count();
    if (cardN !== 1) { console.error(`CLEANUP-FAIL 卡[${code}] 计数=${cardN} 非恰一（fail-closed，人工核）`); process.exitCode = 1; continue; }
    // 删除入口=卡「更多」菜单（diag 实证 agent-card__more）：更多→浮层菜单「删除」。
    await card.hover();
    await page.waitForTimeout(500);
    await card.locator('.agent-card__more').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const menuTexts = await page.locator('.hr-dropdown__menu:visible, .hr-popover:visible, .hr-popup:visible').allTextContents().catch(() => []);
    console.log(`卡[${code}] 更多菜单词表:`, JSON.stringify([...new Set(menuTexts.flatMap((t) => t.split('\n')).map((t) => t.trim()).filter(Boolean))].slice(0, 8)));
    const del = page.locator('.hr-dropdown__menu:visible, .hr-popover:visible, .hr-popup:visible').getByText('删除', { exact: true });
    const delN = await del.count();
    if (delN < 1) { console.log(`卡[${code}] 更多菜单无「删除」，跳过（人工核）`); continue; }
    await del.first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const confirmBtn = page.locator('.hr-dialog:visible, .hr-popconfirm:visible, .hr-modal:visible').getByText(/^(确定|确认)$/).first();
    if (await confirmBtn.count().catch(() => 0) >= 1) await confirmBtn.click({ timeout: 5000 });
    else await page.getByRole('button', { name: /^(确定|确认)$/ }).first().click({ timeout: 5000 }).catch(() => console.log('确认弹层未见（人工核）'));
    await page.waitForTimeout(2500);
    count = await research();
    console.log(`删除[${code}]后 同名卡:`, count);
  }
  // fail-closed 归零核（codex R6）：名称归零 + 逐编码搜索归零（nameLike 名码通吃），三面全零才 OK。
  step = 'zero-verify';
  let allZero = count === 0;
  for (const code of CODES) {
    await searchbox.fill(code);
    await searchbox.press('Enter');
    await page.waitForTimeout(4000);
    const codeHits = await page.evaluate((c) => Array.from(document.querySelectorAll('.agent-card__subtitle'))
      .filter((el) => ((el.getAttribute('title') || el.textContent || '').trim()) === c).length, code);
    console.log(`归零核[编码 ${code}]:`, codeHits);
    if (codeHits !== 0) allZero = false;
  }
  console.log(allZero ? 'CLEANUP-OK（名称+逐编码三面归零）' : `CLEANUP-FAIL（未归零：名称余 ${count} 或编码残留，人工核）`);
  if (!allZero) process.exitCode = 1;
} catch (e) {
  console.error(`CLEANUP-FAIL step=${step} err=${e && e.name}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
