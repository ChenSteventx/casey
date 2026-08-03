# GRILL — teachin raw locator uniqueness

## 已证根因

`lib/teachin/raw-playwright-driver.mjs` 的 resolve 与 revalidate 都在
`page.locator(selector).first()` 后才调用 `count()`。`first()` 已把多候选收窄成
一个，权威门因此可能把歧义误铸为 unique，并在动作窗口继续点击首个元素。

## 本轮裁定

- 唯一性只统计原始、未收窄 locator；原始 count 恰为 1 后才取 handle。
- 动作前重新创建原始 locator 并重验 count、connected、owner、same node、active
  page authority 与 origin；任一失败均零动作。
- 权威路径禁用 `first/last/nth`、坐标、force 与 try-many。
- 只修 canonical raw action driver。历史读取与意图观测里的 `.last()` 不产生动作
  authority，不在本轮改造。

## 红先行与验收

冻结测试使用本机真实 Chromium、每案 fresh BrowserContext 和 hermetic route：

- resolve 时相同按钮在两个容器中出现两次，必须 ambiguous、无 authority、零点击；
- resolve 时一个、perform 前变成两个，必须 ACTION_FAILED、零点击；
- 原节点被 clone 替换后，旧 authority 必须失效、零点击；
- disabled、遮挡、可见但不可操作均不得产生点击；
- 单一且可操作的元素仍只能点击一次；
- 静态钉保证 canonical raw 权威路径无收窄与绕过语法。
