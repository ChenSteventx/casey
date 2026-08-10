# 评审简报：P9 v3 三例接线链收口（commit 684be1d）

工作目录 `~/casey-review-20260810/casey`（只读评审用浅克隆，与主树同哈希）。
Casey 是「文本用例 → 测试报告」确定性可回放测试系统。你是异构评审方，请独立核验，
不要采信我的推理叙述，自己跑命令验。

## 本轮特殊性

`lib/` 与 `bin/` 一字未改。改的是用例数据件、tier2 清单、四个 `loop/prd-*.json`。
所以要评的是**判断链的正确性与诚实性**，不是代码质量。

## 背景：本轮要收的账

P9 tier-2 真机 UAT 的 B 段三例（`tc_catalog_wf_crud` / `tc_wf_publish_states` /
`tc_wf_history_version`）此前被质量门禁判「未接 created-workflow v3 动态 ID 清理生产链」，
要求三例各在 `cases/<caseId>/` 下备齐 v3 三件：`flow.confirmed.json`、
`compile-provenance.json`、`created-workflow-authority.frozen.json`。

## 我做了什么（请逐条挑战）

1. **catalog**：v3 结构授权边此前落在 `runs/b4-replay-20260808/` 下且缺 `.frozen` 后缀。
   我用原签时点 `2026-08-07T17:32:22Z` 重跑 freeze 落到 `cases/` 规范位，声称与原件逐字节相同、
   因此属「落位偏差的搬位」而非「新签署」。
2. **publish_states**：认领 2026-08-08 一批无文档记载的产物（flow confirm、预执行权威件、
   真机编译产物），搬位到 `cases/` 后走 B8 断言与实体锁 v1→v2 重签、B9 结构授权边。
3. **history_version**：拆意图重表达 + 真机重编译（第二十一跑）+ B8/B9。
4. **tier2 清单换签**：18 处漂移哈希刷新 + 9 件 v3 新登记 + 新增 `replayGrantPath`，
   走 `checksumAmendment`。

## 核心技术判断（最要紧，请重点打）

我声称发现一条此前无人识别的生产接缝：**意图号重绑会静默移动断言求值点**。

链条：
- 断言只在意图的代表步求值一次，代表步 = 意图最后一个动作步
  （`lib/heal/reverify-replay.mjs:122`、`lib/replay/event-runner.mjs:103`）；
- `textHits[value]` 是「文本 → 一个数字」平铺映射，同意图内同值被 `textVisible` 与
  `textHidden` 两向请求时取可见计数（`lib/replay/intent-observation.mjs` 的
  `groupTextRequests`，assert-visibility-semantics 契约 GRILL D4 定案）；
- `textVisible` 判 `hits > 0`、`textHidden` 判 `hits === 0`（`lib/replay-assert.mjs:107/122`）；
- 故同意图内同值两向断言必然一真一假，无解；
- `compile-intent-lineage-rebind` 契约把意图粒度由「每原子一意图」并粗成 authored 意图，
  使「点开弹窗 → 断言 → 关闭弹窗」挤在一个意图里的用例，正向断言被推到关闭之后求值、必红。

处置是非对称的：publish 把两条正向断言移入草案 `pending[]` 留痕（只签 `textHidden`，
因 `pending` 非空故 B8 带 `--force` 并产留痕旁车）；history 拆意图正确表达
（原四意图拆成七意图，且把原本无断言覆盖的两次关闭动作补成 `assert.textHidden`）。

## 请回答这几个问题

1. 上述根因判断成立吗？自己写探针验（`lib/replay-assert.mjs` 的 `evaluateAssertions` 可直接调）。
   有没有我漏掉的第三种可能——比如某条路径下两条断言其实能同时为真？
2. 非对称处置合理吗？publish 丢掉正向覆盖这件事，我在 `learn.md` 里的论证是否站得住？
   特别是：history 拆意图后拿到的正向覆盖，能否真的替 publish 站岗？（注意两例是不同用例、
   不同 flow，只是弹窗同一个。）
3. catalog 那件「逐字节重现补落 = 搬位而非新签署」的定性对吗？签名算法是否真的不绑路径？
   自己核 `lib/entity-created-workflow-continuity-v3.mjs` 的签名计算。
4. 清单换签与 `checksumAmendment`（`loop/prd-p9-tier2-live-smoke.json` 末条）是否如实？
   有无夸大、遗漏或把「代执行」写成「本人签署」的地方？
5. history 拆意图后新增的两条 `assert.textHidden` 带了 `entityBindings`，而两条
   `assert.textVisible` 没带。这个不对称是我照 publish 先例抄的，判据在
   `inspectOperationBindings`（read 效应不许带非空绑定、mutation 效应必须带）。核一下对不对，
   以及新增绑定是否会凭空增加观察义务、影响准入验证器。
6. 有没有本轮该跑而没跑的回归面？（我跑了：目标 prd 的 gate GREEN 5/5、全仓
   `ratchet verify` GREEN 184 PRD / 786 冻结件 / 0 问题。）

## 硬纪律（评审结论须遵守）

- 判绿只信退出码，别 grep 失败标记串。
- 证不出的写 `NEEDS_HUMAN`，不要给「看起来没问题」这类无证据结论。
- 凭据与真实目标地址不得进你的输出。
- 首轮只报 Critical / High / Medium，各带可复现证据（命令 + 退出码 + 文件行号）。
- 最后给一句总判：`APPROVE` 或 `CHANGES_REQUIRED`。
