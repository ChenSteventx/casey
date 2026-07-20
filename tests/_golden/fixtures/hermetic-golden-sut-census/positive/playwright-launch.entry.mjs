import { chromium as browserEngine } from '@playwright/test';

export async function probe() {
  const browser = await browserEngine.launch({ headless: true });
  await browser.close();
}
