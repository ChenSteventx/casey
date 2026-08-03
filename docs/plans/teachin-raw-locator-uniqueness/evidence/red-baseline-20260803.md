# Wave 2 红基线（2026-08-03）

- 环境：Windows PowerShell，Windows Node.js，Windows 原生 Playwright Chromium。
- 装具：hermetic route；每案 fresh BrowserContext；无生产 SUT、凭据、外网或 mutation。
- 命令：`node tests/_golden/teachin-raw-locator-uniqueness.browser.golden.mjs`
- 退出码：1。
- 结果：5 过 / 3 败。
- 精确红项：初始双候选被误判 unique；resolve 1 个后 revalidate 2 个仍执行动作；
  canonical raw 驱动仍存在 locator 收窄。
- 已绿负控：节点替换、disabled、遮挡、可见但不可操作均零点击；单一可操作
  元素真实点击恰一次。
