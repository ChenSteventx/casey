// lib/doctor.mjs —— casey doctor 跨平台就绪自检【纯函数层】（casey-doctor，GRILL D7）。
// 零 fs / 零 spawn / 零 os / 零 process.*——判断逻辑与探真环境彻底分离，全靠采集壳注入的 env。
// 每检查项一个纯函数：吃已解析的探针布尔/平台/端口结果 → 出 { id, status, detail, hint }；
// status ∈ { ok, warn, fail, route-human }。runDoctor(env) 聚合逐项 + 按 D3 算 exitCode。
// 金牌构造假 env 就能逐项翻红绿、验退出码、验 OS 分支文案——完全不碰真环境（full 车道 hermetic 可验的支点）。
//
// 凭据纪律（护栏 #7）：本层只吃布尔/结构标志，绝不接收任何凭据值或真目标地址；
//   所有 detail/hint 文案一律中文/命令名，绝不含英文禁字段关键词（authorization/token/secret/... ），
//   绝不含 :// 形态目标地址（隧道只述回环端口号，回环基址非敏感——GRILL D6）。

// 就绪级（blocking，驱动退出码）：真正决定「能不能 hermetic 跑出报告」的四项。
// 建议级（advisory，warn）与 route:human 级（隧道）逐行列出带 hint，但绝不翻退出码（GRILL D3）。
const READINESS_IDS = new Set(['node', 'playwright-present', 'playwright-import', 'chromium']);

// ── semver 手写比较（无第三方 dep）───────────────────────────────
// 解析 '22.12' / 'v22.12.0' → [major, minor, patch]（缺位补 0）；非法 → null。
function parseSemver(v) {
  const m = String(v == null ? '' : v).trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
}
function cmpSemver(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
  return 0;
}

// ── 就绪级 1：node 版本 ≥ engines 要求（版本号非敏感、可回显）──────
export function checkNode({ nodeVersion, requiredRange } = {}) {
  const cur = parseSemver(nodeVersion);
  const rm = String(requiredRange == null ? '' : requiredRange).match(/(>=|>|<=|<|=)?\s*v?(\d+(?:\.\d+){0,2})/);
  const req = rm ? parseSemver(rm[2]) : null;
  const op = (rm && rm[1]) || '>=';
  let ok = false;
  if (cur && req) {
    const c = cmpSemver(cur, req);
    ok = op === '>' ? c > 0 : op === '<=' ? c <= 0 : op === '<' ? c < 0 : op === '=' ? c === 0 : c >= 0;
  }
  return ok
    ? { id: 'node', status: 'ok', detail: `node ${nodeVersion}（要求 ${requiredRange}）`, hint: '' }
    : { id: 'node', status: 'fail', detail: `node ${nodeVersion} 不满足要求 ${requiredRange}`, hint: `升级 node 到 ${requiredRange}（engines.node 单源，非写死字面量）` };
}

// ── 就绪级 2：@playwright/test 已装（文件在位）─────────────────────
export function checkPlaywrightPresent({ present } = {}) {
  return present
    ? { id: 'playwright-present', status: 'ok', detail: '@playwright/test 已装（node_modules 在位）', hint: '' }
    : { id: 'playwright-present', status: 'fail', detail: '@playwright/test 未装', hint: '跑 npm install 装依赖' };
}

// ── 就绪级 3：@playwright/test 可 import（装了不等于能加载）──────────
export function checkPlaywrightImportable({ importable } = {}) {
  return importable
    ? { id: 'playwright-import', status: 'ok', detail: '@playwright/test 可加载', hint: '' }
    : { id: 'playwright-import', status: 'fail', detail: '@playwright/test 装了但加载失败（版本错位/装坏）', hint: '删 node_modules 后跑 npm install 重装依赖' };
}

// ── 就绪级 4：chromium 浏览器在位（回放/编译执行段硬依赖）───────────
export function checkChromium({ execResolved, execExists } = {}) {
  if (!execResolved) {
    return { id: 'chromium', status: 'fail', detail: 'chromium 路径未解析（@playwright/test 未加载）', hint: '先修 @playwright/test 加载，再跑 npx playwright install chromium' };
  }
  return execExists
    ? { id: 'chromium', status: 'ok', detail: 'chromium 浏览器在位', hint: '' }
    : { id: 'chromium', status: 'fail', detail: 'chromium 浏览器二进制不在位', hint: '跑 npx playwright install chromium' };
}

// ── 建议级 5：中文字体（按 OS 分支给探法与建议；GRILL D4）──────────
// 字体缺只令截图/录屏中文空白，DOM/定位/断言不受影响（HANDOFF 实锤）——warn 不 fail。
function fontHint(platform, isWSL) {
  if (platform === 'darwin') return '装/启用 PingFang SC（苹方）；查 /System/Library/Fonts 系统字体册';
  if (platform === 'win32') return '装微软雅黑/宋体；查 %WINDIR%\\Fonts 字体设置（路径用 \\ 分隔）';
  // linux 原生 + WSL：playwright 跑在 Linux 侧，查的是 Linux 侧字体库（非 Windows 字体）。
  const wslNote = isWSL ? '（WSL 须装 Linux 侧字体，非 Windows 字体）' : '';
  return `装用户级 Noto Sans CJK 后 fc-list :lang=zh 核实${wslNote}`;
}
export function checkFonts({ platform, isWSL, cjkProbeNonEmpty } = {}) {
  return cjkProbeNonEmpty
    ? { id: 'fonts', status: 'ok', detail: '中文字体在位（CJK 探针非空）', hint: '' }
    : { id: 'fonts', status: 'warn', detail: '未探到中文字体（截图/录屏中文将空白，DOM/定位/断言不受影响）', hint: fontHint(platform, isWSL) };
}

// ── 建议级 6：site.json 在位 + 浅形态（只查存在性/顶层键名，绝不读值）──
export function checkSiteJson({ present, shapeOk } = {}) {
  if (!present) {
    return { id: 'site-json', status: 'warn', detail: 'site.json 未配置（hermetic 用户可无；真机 tier-2 才需）', hint: '如需真机回放，按 README.md 凭据节配置 site.json' };
  }
  return shapeOk
    ? { id: 'site-json', status: 'ok', detail: 'site.json 在位且顶层键完整', hint: '' }
    : { id: 'site-json', status: 'warn', detail: 'site.json 在位但顶层缺 target 键（结构不符）', hint: '按 README.md 凭据节补全 target 顶层键' };
}

// ── 建议级 7：凭据在位 + 浅形态（同 D5；只查键名在不在，绝不读值）─────
export function checkCreds({ present, shapeOk } = {}) {
  if (!present) {
    return { id: 'creds', status: 'warn', detail: '凭据未配置（hermetic 用户可无；真机才需）', hint: '如需真机回放，按 README.md 凭据节备好 .auth 凭据文件（或经环境变量传入）' };
  }
  return shapeOk
    ? { id: 'creds', status: 'ok', detail: '凭据在位且顶层键完整', hint: '' }
    : { id: 'creds', status: 'warn', detail: '凭据在位但顶层键不完整（结构不符）', hint: '按 README.md 凭据节补全顶层键' };
}

// ── route:human 级 8：隧道回环端口（在听只证本地监听器起了；端到端 route:human）──
// 只述「端口在听/不在听 + 耗时」，绝不含 target 地址、绝不含 :// 形态（GRILL D6）。
export function checkTunnel({ proxyPort, portListening, probeMs } = {}) {
  const detail = proxyPort == null
    ? '无回环端口可探（site.json 未配置 devProxyUrl 或非回环）'
    : `回环端口 ${proxyPort} ${portListening ? '在听' : '不在听'}（${probeMs}ms）`;
  return { id: 'tunnel', status: 'route-human', detail, hint: '端口在听只证本地隧道监听器起了；端到端经隧道到真站通须真反向隧道 + 人在场（route:human 尾巴）' };
}

// ── 聚合 + 退出码（GRILL D3：就绪级任一 fail → 1；warn/route-human 不翻）──
export function runDoctor(env = {}) {
  const items = [
    checkNode(env.node),
    checkPlaywrightPresent(env.playwright),
    checkPlaywrightImportable(env.playwright),
    checkChromium(env.chromium),
    checkFonts(env.fonts),
    checkSiteJson(env.siteJson),
    checkCreds(env.creds),
    checkTunnel(env.tunnel),
  ];
  const exitCode = items.some((i) => READINESS_IDS.has(i.id) && i.status === 'fail') ? 1 : 0;
  return { items, exitCode };
}
