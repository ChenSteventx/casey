import { chromium } from 'playwright';

export function probe() {
  return typeof chromium.launch === 'function';
}
