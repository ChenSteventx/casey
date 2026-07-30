#!/usr/bin/env node
// 报告交付管线：HTML 正式报告 → 手机可读 PDF（B.5 交付要求）。
// 用仓内 playwright chromium 打印，不联网、不触任何 SUT；原 HTML 与录像等取证源一律不动。
// 用法: node scripts/report-to-pdf.mjs <report.html> <out.pdf>
import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [inHtml, outPdf] = process.argv.slice(2);
if (!inHtml || !outPdf) {
  console.error('用法: node scripts/report-to-pdf.mjs <report.html> <out.pdf>');
  process.exit(64);
}
const src = resolve(inHtml);
if (!existsSync(src)) { console.error(`report-to-pdf: 输入不存在 ${src}`); process.exit(66); }

const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  // 报告是自包含本地文件；录像元素可能加载不完，不用 networkidle，domcontentloaded + 短沉降即可。
  await page.goto(pathToFileURL(src).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: resolve(outPdf),
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
  });
} finally {
  await browser.close();
}
const size = statSync(resolve(outPdf)).size;
if (size < 1024) { console.error(`report-to-pdf: 产物过小（${size}B），判失败`); process.exit(1); }
console.log(`report-to-pdf: ok ${outPdf}（${Math.round(size / 1024)}KB）`);
