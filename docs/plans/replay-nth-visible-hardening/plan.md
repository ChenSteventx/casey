# replay-nth-visible-hardening 计划（light）

`selectNodeDropdown` 同域三修：非法 `nth` 硬阻断 fail-closed（不静默降级 index 0）、触发器域锁 `.hr-select`
补 `:visible`、`fake-sut` `ambiguous` 场景注释 `fallback_first` → `ambiguous` 订正。决策全录 `proposed/GRILL.md`。

## 改动面

- `lib/replay-actions.mjs` `doSelectNodeDropdown`：`nth` 在场但非「非负整数」→ `action_failed` 硬阻断（不点、不降级 0）；
  触发器域锁 `.hr-drawer__content-wrapper .hr-select` → `.hr-drawer__content-wrapper .hr-select:visible`。
- `lib/compile-atoms.mjs` `compileWorkflowSelectNodeDropdown`：`nth` 非法 → blocker exit 65 零 events；触发器域锁同补 `:visible`。
- `tests/fixtures/fake-sut/server.mjs`：加 `ddhidden` 场景（抽屉隐藏 `.hr-select` 触发器占位 + 真可见触发器）；
  订正 `ambiguous` 场景注释 `resolution=fallback_first` → `resolution=ambiguous`。
- `tests/_golden/replay-nth-visible-hardening.golden.mjs`：新红金牌（下列验收）。
- `loop/prd-replay-nth-visible-hardening.json`：冻新金牌；`loop/prd-p5-replay.json`：重签 `server.mjs` checksum。

## 验收点

- C1 fix#1 replay 非法 `nth`（`happy` + `nth=-1` + `option`）：`resolution==='action_failed'`、
  触发器值不变（未点 index 0）、`verdict` 非 `PASS`。红先行：修前静默取 0 真选中回 `unique`（假绿）。
- C2 fix#1 compile 非法 `nth`（`happy` + flow `nth:-1` execute）：exit 65、`blockers` 点名非法 `nth`、零 `events.json`。
  红先行：修前 coerce 0 产 events exit 0。
- C3 fix#2 replay 隐藏触发器（`ddhidden` + `nth=0`）：`resolution==='unique'`、`identityReadback.ok===true`、
  `verdict==='PASS'`（只命中可见触发器）。红先行：修前域锁未限可见误命中隐藏触发器落 `action_failed`。
- C4 fix#3 注释订正锁（`ambiguous` 场景回放）：`resolution==='ambiguous'`（钉订正后注释所述行为）。
- C5 回归零行为差：`p5-replay` + 全 fake-sut 消费金牌（`wf-select-node-dropdown`/`wf-add-node`/`wf-open-node`/
  `wf-connect-nodes`/`wf-open-smoke`/`flow-bridge`/`p3-compile`/`e2e-chain`）+ `selftest --tier1` 全 exit 0；
  重签后 `p5-replay` checksum 复绿。

## 红先行证据（实现前）

新金牌跑于 lib 未修 + `ddhidden` 夹具已在：C1（得 `unique` 应 `action_failed`）、C2（得 exit 0 应 65）、
C3（得 `action_failed` 应 `unique`）三败；C4 绿。修 lib 后四绿。
