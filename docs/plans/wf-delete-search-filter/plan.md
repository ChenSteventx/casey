# plan · wf-delete-search-filter（light）

## 背景与根因（B4 十一跑诊断实证）

十一跑（`b4r110806i`，1m6s）`workflow.open` 首次真机走通（读回门 unique），链路推进到
`workflow.deleteByName`，停在计数对账门「布局=unknown、记录容器=null、删除目标=null」。

侦察修正了最初「缺回列表导航」假设：

1. 导航不缺——删除原子开头就 nav 回 `listRoute` 且带 15s 搜索框就绪锚
   （`compile-atoms-workflow-crud.mjs:290-298`，post-nav-anchor-wait 先例已应用）；
   十一跑中搜索框真找到、fill/press 均 acted。
2. 真根因是搜索隔离姿势：`:311-312` 走 fill+`Enter`，而 seam-1 真机已证当前被测方
   `Enter` **不过滤、放大镜才过滤**（wf-open-search-first 七跑实证、清偿工具实战、读回门
   契约三处同源）。Enter 是旧版被测方时代的知识残留。
3. 计数门语义坐实其正确性：`auditDeleteCount` 布局判定基于**含目标名**的行/卡计数
   （`compile-atoms-support.mjs:289-295`）——未过滤列表首屏不含目标卡（open 往返详情页
   后的列表态），门如实 `unknown` 截断。门无缺陷，不动门。
4. 同 seam 第二处：删后重搜 `:382-383` 同为 fill+Enter——不触发重查会让下游「删后归零」
   断言读陈旧列表。
5. 删除链此前从未在「open 真通后」的列表态执行过——「从未走通过」家族第四例。

岔口裁定：Steven 2026-08-06 定 atom 级（契约+双审、不动已签件）；2026-08-07 grill 确认
修正后根因与本修法（仍在 atom 级封套内、爆炸半径更小）。

## 修法（两处 Enter→放大镜 + 过滤后有界就绪锚；frozen 面零接触）

只动 `compileWorkflowDelete`（`lib/compile-atoms-workflow-crud.mjs`）：

1. `:312` press Enter → 放大镜 click emit（纯 fallbackCss `.hr-input__suffix .search-icon`，
   照 chat.sendAndWait 送出图标先例 + `wf-open-search-first:106` 同款形状）；
2. 过滤后就绪锚（post-nav-anchor-wait 家族第四处）：仅当放大镜 click `unique && acted`
   才授 15s 预算，对「目标文本落在记录容器内」（`.hr-table-row, .hr-card.hr-card--bordered,
   .agent-card` 容器语义同 open 前奏）有界轮询；预算耗尽**不改判**——审计照跑、
   既有 fail-closed 路径零行为差；
3. `:383` 删后重搜的 press Enter → 同款放大镜 click（重查触发才能让「删后归零」断言
   读到新列表；不加锚——下游断言自有采样预算）。

事件面：删除链 events 每次编译重产、不在任何 `testChecksums` 冻结面；放大镜 fallbackCss
click 事件形状在流中已有先例（open 搜索分支、chat.sendAndWait）。CASE_DEFECT 候选分支、
计数门、连续性 ref、出站守卫、确认域锁全部不动。

## 验收（金牌红先行）

新金牌 `wf-delete-search-filter.zero-sut.golden.mjs`（mock 页驱真实 `compileFlow`，零 SUT）：

- S1 姿势钉：删除链搜索隔离 emits = fill + 放大镜 click（`.hr-input__suffix .search-icon`）
  ——非 `Enter`；删后重搜同款（两处各钉）；
- S2 就绪锚钉：放大镜真 acted 才授预算、目标入容器即提前放行（mock 延迟出卡场景）；
  未 acted（图标缺席）不授预算、审计照跑 fail-closed（零行为差面）；
- S3 fail-closed 保持钉：过滤后目标仍缺席 → 计数门 `unknown` 截断、零破坏 click、
  compileFlow 中止（既有语义逐字保持）；
- S4 正控钉：过滤命中恰 1 且计数恒等 → 链路继续到触发/确认（emit 序全档）。

红基线实抓（现实现 S1/S2 必红、S3/S4 视断言面）；突变闭环 `git show` 姿势；全仓金牌
双态扫描（基线 `ef81f78`）——两个门面拆分族既存红须基线同码。

真机兑现（完成闸，ADR-0009）：合入 dev 后 B4 十二跑（新 `atl_` 长名令牌）——预期
create→open→详情断言→删除→删后归零全链首过；跑完记全链路总耗时。

## 非目标

- 不动 `auditDeleteCount` 与 `summarizeDeleteCountAudit`（门无缺陷）；
- 不动 CASE_DEFECT 候选分支、连续性 ref、出站精确 ID 守卫、确认域锁；
- 不动 open 侧与 agent 侧搜索（agent 列表 Enter 有效是另一 UI 的已证事实，`:44-45` 留原样）；
- 不动 `profile.json` 与任何冻结件（零 checksumAmendment、零人签回签）。
