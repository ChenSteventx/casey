# plan · login-nav-budget（light）

## 背景与根因

入口就绪锚（`158829d`）合入后 B4 第三次尝试：`LOGIN_BOOTSTRAP_FAILED_BEFORE_FLOW`，
今晨 4 次登录 3 败 1 成。只读探针定位：`lib/login-bootstrap.mjs:83` 默认
`timeoutMs = 15000`，首跳导航（`:101` `gotoOptions: { waitUntil: 'load', timeout: timeoutMs }`）
拿 15s 超时；而登录页现役经隧道 `load` 实测 13.8–14.9s——又一处骑线竞态（与入口锚同类：
页面变重后旧预算压线，赢输随环境抖动）。全仓无任何调用方覆盖 `timeoutMs`，
compile/replay/探针全吃 15s 默认；B 段三例的 B4/B6/B8 每一步真机跑都要先过这道门。

## 修法（最小）

`lib/login-bootstrap.mjs:83` 默认 `timeoutMs = 15000` → `30000`。一行。

超时是**天花板语义**：快路径零行为差（页面几秒载完就几秒过），只有慢页面获得更多跑道；
失败路径（目标不可达）从 ~15s 后报错变 ~30s 后报错，仍远在 compile 看门狗 120s 窗内。
不动登录判据、不动凭据面、不动任何调用方签名（`timeoutMs` 覆盖口保留）。

## 验收

新金牌 `tests/_golden/login-nav-budget.zero-sut.golden.mjs` 三钉：

- S1 慢载行为钉：塑形替身页 `goto` 忠实实现 Playwright 超时语义（20s 后 load、
  预算不足则按预算时刻抛超时）：新默认下 `loginBootstrap` 于 ~20s 导航成功、
  无登录表单路径返回 `loggedIn: true, viaForm: false`；红基线（15s 默认）在 15s 抛
  超时、返回 `NAVIGATION_FAILED`。
- S2 天花板零行为差钉（回归钉，现行代码同绿）：瞬时载入替身下登录路径 <3s 完成——
  证 30s 是上限不是等待。
- S3 结构钉：默认参数为 `30000`。

替身纪律：`goto` 超时语义按 Playwright 忠实复现（在 `min(载入时长, 预算)` 时刻
resolve/reject），慢载 20s 落在旧新预算之间（15 < 20 < 30）构成判别区间；凭据用
哑元（无表单路径不触碰）。红基线对最终金牌字节实抓（S1/S3 红、S2 绿），证据
`accept/red-proofs/login-nav-budget.red.txt`；突变闭环同前例。

邻接复跑：`compile-execution-failure-seal`（login 失败密封边界消费金牌）+
`wf-create-entry-anchor-wait` + `wf-crud-sleep-import` + `term-lint --registry` +
`selftest --tier1`。

## 非目标

- 不动登录判据/表单锚/凭据面；不改任何调用方；
- 表单可见路径的各 `timeoutMs` 消费点（fill/click/detached）随默认一起变宽，
  同为天花板语义，不单列；
- 若真机后续实测登录页 load 逼近 30s，属环境恶化另议（不无限抬预算）。
