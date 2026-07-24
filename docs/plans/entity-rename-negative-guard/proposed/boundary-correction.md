# C4 保真收口候选 · 生产边界订正与人签清单

> 状态：**候选态，待人签**。本文与同目录两枚候选验证均未进入
> `tests/_golden`，未写 `loop/prd-entity-rename-negative-guard.json`，
> 未改 `testChecksums` 或 `passes`，不得据此把 C4 的 review/learn 标成完成。

## 准确生产边界

### 非字符串 `atom`

缺失、数字、数组或对象形态的 `atom` 不归
`dispatchReplayAction` 的 `UNKNOWN_ATOM` 判据负责；该分发接缝单独调用时仍会放行这些形态。
生产安全归属在更上游的生产 `replay` 前置检查：
`bin/replay.mjs` 把原始 `events` 字节和解析文档送入
`checkReplayEntityAdmission`，得到 `REPLAY_EVENT_SHAPE_INVALID` 后以 exit 65
结束，静态顺序早于 `chromium.launch`。因此准确声明是“生产入口浏览器启动前拒绝”，
不能把这项保证归功于孤立的动作分发接缝。

候选验证：
`non-string-preflight.candidate.zero-sut.golden.mjs` 动态覆盖四种坏形态，
并钉生产入口的原始字节/文档双输入、exit 65 与浏览器启动前顺序。

### 未知字符串 `atom`

对原 C4 手造形态 `workflow.rename + action:'click'` 这类合法字符串但无编译知识的业务动作事件，
生产事件环的实际顺序是：

`恢复导航 → 只读采样 → 响应监听 → UNKNOWN_ATOM 守卫 → 业务动作委派`

其中关键前缀可简写为：恢复导航 → 只读采样 → 响应监听 → `UNKNOWN_ATOM` 守卫。
其中恢复导航包含按需读取当前路径与 `pre.path` 的 `page.goto`；只读采样至少包含
行计数，并可能包含对话基线；点击类事件还会先安装响应监听器。故准确保证
不是“页面零触碰”，也不是“进入事件环后第一次浏览器副作用前拒绝”。

准确保证是：到达 `dispatchReplayAction` 后，未知字符串原子具名返回
`action_failed/UNKNOWN_ATOM`，不委派 `performAction`，因此不执行该事件描述的业务动作或
破坏性操作，也不产生 `unique` 动作轴。事件环此前允许的只限恢复导航、只读采样与监听器安装。

本候选不把这项保证外推到任意 `action`。生产事件环的 `action==='nav'` 分支不经过
`dispatchReplayAction`；同时当前前置检查对未知字符串原子使用默认 mutation policy，而不是
编译知识白名单。因此“所有未知字符串原子无条件不产 PASS”仍缺 `unknown + nav` 组合的独立证明。
正式人签时必须二选一：把 C4 声明明确限于业务动作分发路径，或另立强制面修单把未知原子检查提前到
`nav` 分叉之前并补红先行；本候选不擅自改生产强制面。

候选验证：
`event-loop-boundary.candidate.zero-sut.golden.mjs` 直接读取真实
`bin/replay.mjs` 生产事件环锁定上述顺序，并动态证明从分发接缝起未知字符串原子不触碰
`page`、不委派业务动作。

## 冻结面待订正清单

以下旧字节保持原样，须由人签后一次性修单，不允许实现者直接改：

| 冻结项 | 当前 SHA-256 | 待订正语义 |
|---|---|---|
| `tests/_golden/entity-rename-negative-guard.zero-sut.golden.mjs` | `1db7b98000ea5a40bd75a481bf6ac53fe32b1cef0b00bae3f58ffe1c2ebe5c70` | 把生产层“任何 page 触碰前”改成“分发接缝起零 page 触碰；生产环在业务动作/破坏性操作前拒绝”，并指向两枚新金牌 |
| `docs/plans/entity-rename-negative-guard/plan.md` | `79599bf7afdb04ee241a06874fb1bf21336618c096dc409f26ad40afd9309f43` | 验收点拆成“非字符串入口前检”和“未知字符串事件环边界”，撤回笼统的第一次浏览器副作用口径 |
| `docs/plans/entity-rename-negative-guard/GRILL.md` | `071ebc8ed4af0294bef7917e23996490ae5b31245f422ca8b97a7f637da60d4f` | D3 同步准确边界 |

两枚候选验证当前 SHA-256：

- `non-string-preflight.candidate.zero-sut.golden.mjs`：
  `4f9eb1fb8fc24991e47070152565e6764720b936028f62a3c84c15dd291fc494`
- `event-loop-boundary.candidate.zero-sut.golden.mjs`：
  `f84710d7011f97a3333857776a0d88d29a6b65c54f3c19f2cc122bf3d1597599`

## ADR-0004 人签后机械动作

1. 人确认上述准确边界与两枚候选验证的断言强度。
2. 将两枚候选复制为正式 `tests/_golden` 文件；只改路径相关导入，不弱化断言。
3. 按上表订正三份既有冻结文件，逐项计算新 SHA-256。
4. 在 `loop/prd-entity-rename-negative-guard.json` 追加
   `checksumAmendments`：逐项记录旧 SHA、新 SHA、原因为“自证范围订正，核心
   `UNKNOWN_ATOM` fail-closed 不弱化”；再把两枚新金牌加入 `testChecksums` 与 acceptance。
5. 人裁 `unknown + nav`：若声明收窄，所有冻结文案必须同步写明“业务动作分发路径”；若选择
   强制面前移，须新红测试、复跑全部受影响回放金牌，并与 C3 集成树调和后再签。
6. `passes` 仍只允许 `gate.mjs` 写；先跑修后金牌、0/26 诚实红基线与受影响闭包，
   再跑该 PRD 的质量门禁。
7. 取得干净异构冗余复审后，才允许推进 review；learn 仍在 review 之后。

## 不变量

- 不新增 rename 编译器，不唤醒形式收据链子系统 A。
- `lib/entity-semantic-lock-v2.mjs` 保持
  `b7b5a47e1830084ad2715c56a384b55a6b473bc5a5f735eeedb6006df2a3b6f0`。
- 0/26 前瞻基线继续以 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED` /
  `ENTITY_RUNTIME_ADAPTER_INVALID` 一族拒绝，不能因 C4 转绿。
- 两枚候选只补证据与准确措辞，不改变生产行为。
