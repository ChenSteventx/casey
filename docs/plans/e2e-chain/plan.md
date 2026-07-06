# e2e-chain — hermetic 文本→报告全链贯通（light）

## 背景

七相各自建成收口，但「文本用例→测试报告」从未在一条链上首尾串跑。本契约以一枚集成金牌把
相0→1→2→3→4→6 串成 hermetic 链（fake-sut 夹具、零真机零凭据零 LLM），落锤「七相全建」。
决策见 `proposed/GRILL.md`（十站链形/夹具确定性/终态断言/红绿纪律/非目标，全镜像先例）。

## 改动

1. `tests/_golden/e2e-chain.golden.mjs`（新建，唯一交付物）：十站链 C1–C8 检查——
   C1 相0 ingest 候选→testcase exit 0；C2 相1 flow-bridge mock mapping→flow exit 0；
   C3 compile gate 段→flow-<caseId>.json（confirmedBy 空）；C4 confirm 门：未确认 `--execute` exit 66
   零 events（负闸），手编 confirmedBy 后 exit 0 落 events/observed/compile-report 三件；
   C5 相2 draft（+patch 补 nav 硬断言与 toast 断言）→ 草稿 pending 空；C6 相2 sign CLI 真签→
   expected.frozen 三签署字段齐 + prd 夹具回写 expectedFrozenPath/checksum；
   C7 相3–4–6 `casey run` --sut 夹具 → verdict 全 intent PASS + 报告三件在场 + 裁定概览计数对；
   C8 链完整性与卫生：events/expected caseId 绑定、全产物哨兵扫描零凭据形串、`AT_SITE_JSON`
   合成隔离（不读仓根真 site.json）。
2. `loop/prd-e2e-chain.json`：s1 = 链金牌 + tier1。
3. 零 lib/bin 改动（挖出真缝即停、按面升 lane 走钉红修绿）。

## 非目标

不接 run 前段编排；不碰相5/真机/冻结面；不烧真 LLM。

## 验收

- `node tests/_golden/e2e-chain.golden.mjs` exit 0（集成回归金牌，冻结时即绿——运行证据贴 prd）；
- `casey selftest --tier1` 无回归；无涟漪面（纯加法新金牌，不碰任何既有文件）。
