# replay-nth-visible-hardening GRILL（收尾三修：非法 nth 硬阻断 + 域锁限可见 + 注释失准）

lane=light（`selectNodeDropdown` 同域的定点加固，纯加严 fail-closed + 一处注释订正，零冻结 schema 改动）。
决策源：`docs/NEXT-SESSION.md` 两 med backlog + 一条注释失准；接缝在 `lib/replay-actions.mjs`
的 `doSelectNodeDropdown`、`lib/compile-atoms.mjs` 的 `compileWorkflowSelectNodeDropdown`、
`tests/fixtures/fake-sut/server.mjs` 的 `ambiguous` 场景注释。

## D1 非法 `nth` 静默降级为 0 → 改硬阻断 fail-closed（route:human）

现状：两门都写 `Number.isInteger(x) && x >= 0 ? x : 0`——`nth` 越界另有专门 blocker/`none` 落轴，
但**非法**（负数、非整数、非数字）当前静默取 index 0 点击。这是替用户猜首项，违铁律「fail-safe 不
fail-open」+ 点击身份门（ADR-0007）：没给合法位置却擅自点第一格，可能默默改错 SUT 还回 `unique` 假绿。

判据（三态口径对齐）：
- `nth` 缺省（`undefined`）→ 合法默认 0（registry 明载「缺省 0」，C2 金牌钉 `sel.nth === 0`，不动）；
- `nth` 越界（`>= tcount`）→ 既有 blocker（compile）/ `none`（replay），不动；
- `nth` **在场但非「非负整数」**（负/小数/非数字）→ **新增硬阻断**：compile 落 blocker exit 65 零 events；
  replay 落 `action_failed`（裁判 `ap=false` → `NEEDS_HUMAN/INDETERMINATE`，fail-safe）。**绝不降级 index 0、绝不点**。

为何 replay 落 `action_failed` 而非 `none`：`none` 会喂只读漂移探针（自愈门候选，护栏 #13），而非法 `nth`
是用例/spec 缺陷不是 SUT 漂移，`action_failed` 才是「证不出、非做成」的诚实落轴（护栏 #14）。

## D2 域锁 `.hr-select` 未限可见 → 补 `:visible`

现状：选项作用域已限可见浮层 `.hr-select-option:visible`（防 teleport 到 body 的孪生/stale 浮层误命中），
但**触发器**域锁 `.hr-drawer__content-wrapper .hr-select` 未带 `:visible`。隐藏/未清理的 `.hr-select`
触发器会进入计数与 `nth` 定位，令 `nth` 误命中隐藏触发器（点不动或错位）。把选项侧已有纪律补到触发器侧：
`.hr-drawer__content-wrapper .hr-select:visible`，两门同刻。对既有场景（触发器皆可见）是恒等无行为差。

## D3 `server.mjs` `ambiguous` 场景注释失准 → 订正 `fallback_first` → `ambiguous`

注释写「语义定位器多匹配 → `resolution=fallback_first`」。实际：通用门 `gateAndAct` 对 `count>1` 吐
`resolution: 'ambiguous'`（`p3-compile` 金牌钉、CONTEXT.md 第 79 行定：多匹配唯一合法字面量 = `ambiguous`，
`fallback_first` 是收敛前旧写法、在动作轴/裁定链语境已弃用）。纯注释订正，无冻结断言涉及。

## 红先行取材（新金牌 `tests/_golden/replay-nth-visible-hardening.golden.mjs`）

- fix#1 replay：`happy` + 事件 `nth=-1` + 载 `option`——修前静默取 0 真选中回 `unique`（假绿），修后 `action_failed` 不点；
- fix#1 compile：`happy` + flow `nth:-1` execute——修前 coerce 0 产 events exit 0，修后 blocker exit 65 零 events；
- fix#2 replay：新增夹具场景 `ddhidden`（抽屉先挂一枚 `display:none` 的隐藏 `.hr-select` 触发器占 DOM 序 0、
  再挂真·可见触发器）+ 事件 `nth=0`——修前域锁未限可见误命中隐藏触发器落 `action_failed`，修后 `:visible` 只命中可见触发器 `unique`；
- fix#3 lock：`ambiguous` 场景回放确认 `resolution==='ambiguous'`（钉订正后注释所述行为，修前后皆绿的回归锁）。

夹具 `server.mjs` 改动（加 `ddhidden` 场景 + 订正注释）破 `prd-p5-replay` 的 `server.mjs` checksum → 重签 +
复跑 `p5-replay` 与全 fake-sut 消费金牌证零行为差。新金牌自己冻进 `prd-replay-nth-visible-hardening`。

## 隔离

本契约与 B 契约都碰 `lib/replay-actions.mjs` 与 `lib/compile-atoms.mjs`，各自 worktree 隔离、主环 3-way 合并；
本树只管自绿。`tests/fixtures/fake-sut/server.mjs`、新金牌、新 prd 为本契约独占。
