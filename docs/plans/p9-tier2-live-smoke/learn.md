# learn — p9-tier2-live-smoke

> 六阶段收口沉淀。证据源：GRILL/plan（v4，五轮 codex 批 + Steven 签）、
> prd（gate GREEN 3/3、两笔换签 Steven 签）、code-codex-r1..r3 三卷、
> audit 尾笔（rounds=8, pass）。

## 一、做了什么

`casey selftest --tier2` 从桩（exit 3）落成真机冒烟自检的机器面：纯层
`lib/selftest-tier2.mjs`（零 fs/spawn/net/browser）出 readiness 判定、
run 证据逐项判定、裁判通道冒烟判定、参数解析与聚合；壳层只读人签用例集
清单（零动态发现）、变更型条目逐次授权、逐例 spawn 生产管线同链、
run receipt 六类归类、两段连通 readiness。金牌 77 钉红先行 → 111 钉全绿。

## 二、教训

1. **「机器面绿」这类自检最容易自己给自己开后门**：本轮逮到两个真假绿——
   工装红（`HARNESS_ERROR`）被当业务性非 PASS 放行、零步裁定产物冒充
   「合法非全过」。**凡聚合判定，必须逐态列举而非「非此即彼」**；凡产物
   合法性，必须有「非空 + 计数自洽 + 与相邻产物双射」三重，缺一就能被
   空壳骗过。
2. **金牌钉不住的洞要靠负控实测逼出来**：三轮里每一条 High 都是 codex 用
   合成反例真跑出来的，不是读代码读出来的。实现者「我判断它会红」不算证据，
   **实测退出码才算**——本轮全程要求每条修复配可复现的负控。
3. **配置键静默忽略是隐形杀手**：`-c model_service_tier="fast"` 表面成功、
   实为未知字段被吞（`--strict-config` 一验即现）。同类坑在剖面
   `quiet.loadingSelector` 上重演——运行时只认 `profile.loading`，旧配置
   等于死配置躺了很久。**凡「配了却没生效」的怀疑，都要有一条能证伪的探针。**
4. **人签件的形制细节会被漏**：提签时漏删 `draft` 标记，清单同时是
   `draft:true` 且 `signed:true` 而准入仍放行——修法不是补个判断，是让
   准入按「同一份已 hash 字节」解析并拒绝一切草稿态。
5. **一次性绑定改变操作节奏**：探针挑战字让每次真机跑都要重取 Windows 侧
   连通证据。这是「绑定本次尝试」的正确语义代价，但真机操作手册必须同步，
   否则现场会以为工具坏了。

## 三、挂账

- A4 真机 tier-2 实跑（route:human）；流式面空缺按设计 exit 2 如实记；
- A5 D5 三层口径修订 + UAT 签认书（route:human）；`real-uat-runbook.md`
  需补 `--challenge` 调用姿势；
- `replay-nth-visible-hardening` 系 07-17 准入门迁移遗留红，经 Steven 批准
  移出 s2 并挂账，迁移债清偿后应回归复跑；
- `runs/_tier2/judge-smoke_*` 证据目录无清理策略；
- `lib/selftest-tier2.mjs` 576 行逼近 600 上限，下次新增须拆分。
