// lib/login-bootstrap.mjs —— 登录预备动作（Login Bootstrap，CONTEXT.md 已登记；G2 取 A 人签 2026-07-02）。
// 按 ADR-0001 拷快照范式取自 autotester lib/paths.mjs（DEFAULT_SITE 登录/下拉段 + loadSiteConfig + loadCreds），
// 自有、独立演进；snapshotOf: autotester lib/paths.mjs（2026-07-02）。
// 红线（护栏 #7）：凭据只经 .auth/ 与 env 进内存，绝不产 event、绝不进 spec/observed/日志/编译报告。
import fs from 'node:fs';
import path from 'node:path';
import { CREDS_FILE, PROJECT_ROOT } from './paths.mjs';

// 站点专有选择器，默认 = Heren 中台，可被项目根 site.json 覆盖。
// 注意「登 录」按钮可访问名中间带空格——真机已趟坑，绝不"修正"。
export const DEFAULT_SITE = {
  login: {
    pathMarker: '/login',
    user: { role: 'textbox', name: '请输入账号' },
    pass: { role: 'textbox', name: '请输入登录密码' },
    submit: { role: 'button', name: '登 录' },
  },
  // 自绘下拉的壳/浮层选择器（编译期 selectOption 的 dropdownUnit 实采候选，来源同 autotester select 段）。
  select: {
    shellRole: 'textbox',
    shellName: '请选择',
    fieldItem: '.hr-form__item',
    optionList: '.hr-select__list',
    shellSelector: 'input[placeholder="请选择"],.hr-select__wrap,.hr-select-input',
    scopes: ['.hr-drawer__content-wrapper', '.hr-dialog', 'form'],
  },
};

// sitePath 默认项目根 site.json，可经参数或 AT_SITE_JSON env 覆盖。已知段深合并保住默认子键，其余顶层键透传。
export function loadSiteConfig(sitePath = process.env.AT_SITE_JSON || path.join(PROJECT_ROOT, 'site.json')) {
  try {
    if (fs.existsSync(sitePath)) {
      const ov = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
      return {
        ...ov,
        login: { ...DEFAULT_SITE.login, ...(ov.login ?? {}) },
        select: { ...DEFAULT_SITE.select, ...(ov.select ?? {}) },
      };
    }
  } catch { /* 坏 JSON：退回默认 */ }
  return DEFAULT_SITE;
}

// 凭据读取：env 覆盖优先（AT_CREDS_USER/AT_CREDS_PASS，只进内存不落盘）；否则读 credsFile（默认 .auth/credentials.json）。
// 缺文件/缺字段一律抛错 fail-closed——绝不静默无凭据继续。
export function loadCreds({ credsFile = CREDS_FILE } = {}) {
  const eu = process.env.AT_CREDS_USER, ep = process.env.AT_CREDS_PASS;
  if (eu && ep) return { user: eu, pass: ep };
  if (!fs.existsSync(credsFile)) {
    throw new Error(`登录凭据缺失：请创建 ${credsFile}（内容 {"user":"...","pass":"..."}）或经 AT_CREDS_USER/AT_CREDS_PASS env 传入`);
  }
  const c = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
  if (!c?.user || !c?.pass) throw new Error(`${credsFile} 缺少非空 user / pass 字段`);
  return c;
}

// 执行登录预备动作：把浏览器带到已登录态。不产 event（调用方不得记录本函数期间的动作为 events）。
// 判据（tier-2 真机实采修正，2026-07-02 spike）：SPA 登录页可不改 pathname（真机实测 pathname='/'）——
// 「在登录页」= pathname 含 pathMarker 或 登录表单在场（账号框可寻）；完成 = 登录表单消失 + load。
export async function loginBootstrap(page, { site, creds, startUrl, timeoutMs = 15000 }) {
  const login = (site && site.login) || DEFAULT_SITE.login;
  await page.goto(startUrl, { waitUntil: 'load', timeout: timeoutMs });
  const onLoginPath = () => { try { return new URL(page.url()).pathname.includes(login.pathMarker); } catch { return false; } };
  const userBox = page.getByRole(login.user.role, { name: login.user.name });
  let formVisible = false;
  if (!onLoginPath()) {
    // SPA 客户端渲染窗：给登录表单一个出现机会再判（不在场即视为已登录态）。
    try { await userBox.first().waitFor({ state: 'visible', timeout: 3000 }); formVisible = true; } catch { formVisible = false; }
  } else {
    formVisible = true;
    await userBox.first().waitFor({ state: 'visible', timeout: timeoutMs });
  }
  if (!formVisible) return { loggedIn: true, viaForm: false };
  await userBox.fill(creds.user, { timeout: timeoutMs });
  await page.getByRole(login.pass.role, { name: login.pass.name }).fill(creds.pass, { timeout: timeoutMs });
  await page.getByRole(login.submit.role, { name: login.submit.name }).click({ timeout: timeoutMs });
  // 完成判据：登录表单消失（pathMarker 可能永不出现/离开）；随后等 load 稳定。
  await userBox.first().waitFor({ state: 'detached', timeout: timeoutMs })
    .catch(async () => { await userBox.first().waitFor({ state: 'hidden', timeout: timeoutMs }); });
  await page.waitForLoadState('load', { timeout: timeoutMs }).catch(() => {});
  return { loggedIn: true, viaForm: true };
}
