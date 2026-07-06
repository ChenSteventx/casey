# btn-enable-ops — buttonState enabled/disabled 双 op（full）

## 背景

wf-publish-states 时词表收窄、enabled/disabled 留位挂账「随 publish_blocked 带实现回归」；审计
指出死锁风险（载体整维度被 R9 卡真机）→ Steven 点单拆先行。判据已签：标准（`disabled` 属性 ∨
`aria-disabled="true"`）+ `profile.buttons.disabledClass` 可选类名补判（真机适配口）。
决策全表 `proposed/GRILL.md`（D1–D6）。

## 改动

1. `bin/check.mjs`：`buttonState` op 表 +enabled +disabled（碰词表 = full 依据；schema enum 已留位零动）。
2. `bin/replay.mjs`：代表步静默点新增 `buttonDisabledHits[name]` 采集（双通道同 buttonHits 口径，
   D1 三路判禁用；任一通道失败=缺采集）；`profile.buttons.disabledClass` 可选 + 形状校验 fail-closed；
   axes 投影加性字段。
3. `lib/replay-assert.mjs`：buttonState 评估加 enabled/disabled 分支（D3 语义：混合态/缺采集/零命中
   全证不出；actual 复合标量 `hits=N,disabled=M`）。
4. `lib/assertion-draft.mjs`：mapAtom buttonState state enabled/disabled 翻硬映射（不再落 pending）。
5. `tests/fixtures/publish-sut/server.mjs`：加法场景 `disabledBtn`（属性路/aria 路/类名路/enabled 对照）。
6. `tests/_golden/wf-publish-states.golden.mjs` 三钉点生命周期翻转（红先行）+ prd 重签；
   `tests/_golden/btn-enable-ops.golden.mjs`（新建红金牌）+ `loop/prd-btn-enable-ops.json`。

## 非目标

见 GRILL D6（不建 publish_blocked flow、不动 switchState/schema/verdict、present/absent 行为零变、
真机类名采样 route:human）。

## 验收（红金牌）

- C1 词表：enabled/disabled 过 `check --validate-only`；present/absent 照旧；未收 op 仍拒。
- C2 评估语义矩阵：enabled 判真（hits>0∧disabled=0）/ disabled 判真（hits=disabledHits>0）/
  混合态双 op 皆 false / hits=0 皆 false / 缺 disabledHits 证不出 / actual 复合标量。
- C3 mapAtom 翻转：state enabled/disabled → 硬映射非 pending；present/absent 照旧。
- C4【采集端到端】replay 打 publish-sut `disabledBtn` 场景：属性路/aria 路判禁用；类名路配
  `disabledClass` 判禁用、不配则该钮不计禁用（补判是显式开口）；enabled 对照钮 disabledHits=0；
  axes 投影带加性字段、present/absent 行为零变。
- C5 profile 形状：`disabledClass` 非法形状 exit 65 fail-closed；缺省整段合法。
- C6 涟漪翻转红先行：wf-publish-states 金牌三钉点逐条翻转后其金牌全绿 + 双 prd（publish-states /
  history-version）夹具 checksum 重签 + 双 gate 复验 GREEN；`selftest --tier1` 无回归；
  p4-drafter / kinds-harden / chiefcomplaint 金牌复跑零行为差。
