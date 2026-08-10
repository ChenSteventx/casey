# tc_wf_publish_states 回放清理链失败诊断（2026-08-10）

跑批：`b4replay0810`（批级票据，绑三例）。catalog 与 publish 两例已跑，history 未跑
（Steven 裁：先查删除链再跑，避免再添残留）。

## 结论摘要

- **catalog 回放清理成功、零残留**：稳定缺席 3 样本 / 3043ms，只读探针复核该名下 total=0。
- **publish 回放清理失败、真机残留 1 条**：`atl_b4replay0810-pub`（平台标识后四位 6176），
  只读探针实测命中 total=1、complete=true。删除请求**从未发出**（取证里零 `/delete` 请求）。
- 裁判判 `NEEDS_HUMAN(INDETERMINATE)`，**没有假绿**——这是 fail-safe 正确工作，不是缺陷。
- 残留处置：Steven 裁「亲自到界面删」，删后由只读探针复核归零并留证。

## 失败链（逐步实测）

两例的清理链结构**完全相同**：`nav → fill 搜索框 → press → 点放大镜 → 点删除 → 点确认 →
fill 搜索框 → 点放大镜`。定位器也相同（确认步都是 `role=button` + 可及名「确认」）。

| 步 | catalog（成功） | publish（失败） |
|---|---|---|
| 放大镜过滤 | `action_failed`、候选 **0**（找不到元素，跳过、无害） | `actionError`、`resolution: unique`（**找到了却点不动**） |
| 点「删除」 | `unique`、ok、873ms | `unique`、ok、799ms |
| 点「确认」 | `unique`、**ok、758ms** | `unique`、**actionError、1ms** |
| 删后重搜放大镜 | `action_failed`、候选 0 | `actionError` |
| 稳定缺席采样 | 3 样本 / 3043ms、ok | **0 样本 / 0ms、ok=false** |

## 最硬的一条线索：确认步耗时 1ms

`run-history` 时间戳与耗时对照：

- catalog `atstep_15`（确认）：耗时 **758ms**，成功。这 758ms 说明它在**等待对话框出现**。
- publish `atstep_17`（确认）：耗时 **1ms**，`actionError`。紧接在「删除」步结束后 1 毫秒。

两者定位器逐字相同、`locatorResolution` 都是 `unique`。所以**不是定位不到**，而是定位到了
唯一元素、点击却瞬间失败——形态像元素刚出现又脱离（detached），或定位到的根本不是本次
弹出的对话框（例如上一轮的残影、或隐藏态同名按钮）。

放大镜步的失败形态同样是「找到了但点不动」（`unique` + `actionError`），与 catalog 的
「找不到就跳过」（候选 0）是两回事。两处失败形态一致，指向同一类原因。

## 未验证的怀疑方向（下次带截图/录像复现）

**发布状态差异**：publish 这条用例建的工作流是**已发布**的（用例本身就是发布状态机），
catalog 的未发布。已发布件在列表页的操作区可能不同（导出/新建版本 vs 发布/保存），
删除交互也可能不同——例如弹的不是确认对话框，而是「已发布不可删」一类提示，
于是「确认」按钮匹配到了页面上别的同名元素、点击即失败。

**注意这只是怀疑，未证**。反证材料也在：08-08 编译期跑同一条链时 20 步全 `unique`/`acted`、
真建真删成功，那时工作流同样是已发布的。所以「已发布就删不掉」这个简单版本的解释不成立，
真实原因更可能与**回放期与编译期的时序差**有关（回放更快、少了编译期的观察停顿）。

录像已存 `runs/b4-replay-20260810/tc_wf_publish_states/video.webm`，下次可直接看这两步。

## 复现与核查工具

- 残留只读核查（零建零删零改）：
  `node scripts/residue-check-readonly.mjs cases/tc_wf_publish_states/profile.json b4replay0810-pub`
  退出码 0 未命中 / 1 命中残留 / 65 查询未成立（**未成立绝不当成「无残留」**，见脚本注释里
  记的假绿教训）。
- 真机操作前必跑账户守卫：`node scripts/assert-sut-account.mjs autotest`。

## 票据状态

`runs/_tier2/replay-grant.json`（batchId `b4replay0810`）绑三例，失效点 2026-08-10T23:59:59+08:00。
catalog 与 publish 两例已核销（台账 `runs/_tier2/replay-grant-ledger/cf857c05.../`），
history 尚未核销。过期后跑 history 须重铸票据并重新人签。
