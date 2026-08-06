#!/usr/bin/env node
// login-nav-budget：loginBootstrap 首跳导航预算必须容纳现役登录页 load 尾巴。
// 根因：默认 timeoutMs=15000，登录页经隧道 load 实测 13.8-14.9s 骑线必抖（2026-08-06 晨 4 跑 3 败）。
// 修法：默认提 30000——天花板语义，快路径零行为差。零 SUT、零网络、零浏览器；
// goto 替身按 Playwright 超时语义忠实复现（min(载入时长, 预算) 时刻 resolve/reject），不倒裁。

const TAG = 'login-nav-budget';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.message || error}`);
    console.error(`RED  ${TAG}: ${name}: ${error?.message || error}`);
  }
}

const { loginBootstrap } = await import('../../lib/login-bootstrap.mjs');

// 路径不含 pathMarker('/login')：走「登录表单不在场即已登录态」判据支（3s 表单窗），凭据永不被触碰。
const START_URL = 'https://sut.invalid/heren/aimanagement/home';

// 塑形替身页：goto 忠实复现 Playwright 超时语义——载入需 navDelayMs；预算 >= navDelayMs 时在
// navDelayMs 时刻 resolve，否则在预算时刻 reject（TimeoutError 同款行为）。导航成功后 url() 返回
// 目标地址（origin 连续性核过）；页面无登录表单（一切定位零命中）→ 走「已登录态」判据路径，
// 凭据永不被触碰。
function makeSlowNavPage(navDelayMs) {
  const zero = () => ({
    count: async () => 0,
    first: () => zero(),
    waitFor: async () => { throw new Error('no form on page'); },
    fill: async () => { throw new Error('no form on page'); },
    click: async () => { throw new Error('no form on page'); },
  });
  let currentUrl = 'about:blank';
  return {
    goto: (url, opts = {}) => new Promise((resolveNav, rejectNav) => {
      const budget = typeof opts.timeout === 'number' ? opts.timeout : 30000;
      if (budget >= navDelayMs) {
        setTimeout(() => { currentUrl = url; resolveNav(null); }, navDelayMs);
      } else {
        setTimeout(() => rejectNav(new Error(`Timeout ${budget}ms exceeded`)), budget);
      }
    }),
    url: () => currentUrl,
    getByRole: () => zero(),
    getByText: () => zero(),
    getByLabel: () => zero(),
    locator: () => zero(),
    waitForLoadState: async () => {},
    close: async () => {},
    isClosed: () => false,
  };
}

const DUMMY = { site: undefined, creds: { user: 'dummy-user', pass: 'dummy-pass' }, startUrl: START_URL };

await check('S1 慢载行为钉：20s 载入的登录页须导航成功并判已登录态（旧 15s 默认必败）', async () => {
  const page = makeSlowNavPage(20000);
  const t0 = Date.now();
  const outcome = await loginBootstrap(page, { ...DUMMY });
  const elapsed = Date.now() - t0;
  assert(outcome && outcome.loggedIn === true && outcome.viaForm === false,
    `20s 慢载页在新预算下须登录判据成立（loggedIn:true, viaForm:false）：${JSON.stringify({ loggedIn: outcome?.loggedIn, viaForm: outcome?.viaForm, reason: outcome?.reason })}`);
  assert(elapsed >= 20000 && elapsed < 28000,
    `完成时刻应在载入时刻附近（约 20s+表单窗 3s，非预算满 30s）：${elapsed}ms`);
});

await check('S2 天花板零行为差钉：瞬时载入路径须 <3s 完成（预算是上限不是等待）', async () => {
  const page = makeSlowNavPage(0);
  const t0 = Date.now();
  const outcome = await loginBootstrap(page, { ...DUMMY });
  const elapsed = Date.now() - t0;
  assert(outcome && outcome.loggedIn === true, `瞬时载入须登录判据成立：${JSON.stringify(outcome)}`);
  assert(elapsed < 3000 + 3000, `快路径不得被预算拖慢（<6s，含 3s 表单出现窗）：${elapsed}ms`);
});

await check('S3 结构钉：loginBootstrap 默认 timeoutMs 为 30000', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/login-bootstrap.mjs', import.meta.url), 'utf8');
  const fnStart = src.indexOf('export async function loginBootstrap');
  assert(fnStart >= 0, '未找到 loginBootstrap');
  const head = src.slice(fnStart, fnStart + 400);
  assert(/timeoutMs\s*=\s*30000\s*,/.test(head), `默认 timeoutMs 须为 30000：${(head.match(/timeoutMs\s*=\s*\d+/) || ['未匹配'])[0]}`);
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
