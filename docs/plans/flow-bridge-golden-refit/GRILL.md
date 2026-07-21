# GRILL — flow-bridge-golden-refit（内核收紧未复跑六条陈旧绿统一处置）

> 车道 full（碰冻结金牌字节，ADR-0004 面）。来源：2026-07-20 全仓陈旧绿普查（确定性退出码实跑 141 条、15 条真陈旧绿）+ 15 条逐条根因诊断。本契约处置其中〖内核收紧未复跑〗六条（护栏 #19 补课）；〖教义已取代〗七条、casey-demo、detector 传递 spawn 洞另裁另契约。
>
> 分工（Steven 2026-07-20 定）：plan 由 fable 主笔，定稿后与 codex gpt-5.6-sol @ max 共识循环到一致再进 accept；实现评审走 codex sol high 或 grok。

## 背景事实（诊断已核，file:line 见诊断档）

2026-07-17/18 信任根收紧三波未复跑受影响冻结金牌：

- `dfee72c`（07-17）：实体绑定内核接进桥闸——mutation 原子从「不要求 entityBindings」收紧为「必须恰带 subject 角色显式绑定」（`lib/flow-bridge.mjs:132` + `lib/entity-semantic-lock-preflight.mjs:454/:45/:419`）。打红 `flow-bridge.golden.mjs` 五条 happy（07-07 冻的 mock 夹具无该字段）与 `ingest.golden.mjs` C3。牵连 12 条 prd story 陈旧绿（flow-bridge 是 14 个 prd 的涟漪锁）。
- `05573d1`（07-18）：intake 加「示教三件套」预检（`bin/intake.mjs:61-72`，缺 identity-observations.json 即 exit 65）。打红 `cli-mcp-face.golden.mjs` A6 与 `record-distill.golden.mjs` 真接缝。此债当时已在 `prd-cli-authority-wiring-fill.json:21` 挂账「留后续契约」——本契约即那个后续契约。
- `edea1f9`（07-17）：capture 路径 canonical 校验收紧到与固定 cases 根全等（`lib/teachin-observation-authority-root.mjs:162-170`）。打红 `teachin-observation-authority-root.zero-sut.golden.mjs`。
- CONTEXT.md 术语表 07-17 给「原子候选」登记了一条弃用旧称，term-lint 运行时现读词表 → 06-29 冻的 `docs/plans/bootstrap/plan.md:85`（仍用旧称）被追溯判红（`prd-p2-intent-compile` s3 的 acceptance）。

## 决策树

### D1 — 修复方向 [Steven 2026-07-21 裁 = 修夹具侧]

裁决：**修夹具侧，生产零改**。诊断判生产侧设计意图正确——`lib/flow-bridge.mjs:130-131` 注释明写「桥只验证 CLI 外 LLM 的显式候选，不代猜角色/编号、不代签」，收紧本意就是拒。金牌 MAPPING 补显式 entityBindings（mutation 恰一 subject），同时**新增反向断言锁死「mutation 缺绑定必拒」**——把这次收紧真冻进金牌防再漂。金牌字节变 → ADR-0004 人签 + 重签归属 prd checksum。否决项：生产侧开迁移窗口（放宽 `preflight.mjs:454`）= 动信任根内核语义且与设计意图相左。

### D2 — scope [Steven 2026-07-21 裁 = 三家族全扫]

裁决：**内核收紧未复跑六条全处置**：① dfee72c 桥闸家族（flow-bridge + ingest 夹具补绑定 + 反向锁）；② 05573d1/edea1f9 intake-固定根家族（cli-mcp-face A6 按 05573d1 自身先例退役 happy 改负向断言；record-distill 与 authority-root 走固定根+租约先例修夹具）；③ 术语追溯（bootstrap/plan.md 弃用别名改正名「原子候选」）。同根因同修法一次清，不拆多契约多轮人签。

### D3 — 复 gate 范围 [Steven 2026-07-21 裁 = 全量复 gate、接受诚实红]

裁决：**全部引用 prd 全量复 gate**：能绿的绿回来，连带未修债的 story 由 gate 权威翻诚实红——先翻红记账再修，账面不再骗人。先例：`prd-handover-pack` s2 已照此办（a5b59dd）。checksum 重签范围：`prd-flow-bridge`、`prd-integrate-regress-agent-tool-slice`（flow-bridge 金牌双归属）、`prd-ingest`、`prd-mcp-parity`、`prd-record-distill`、`prd-teachin-observation-authority-root`。

## 待 plan 定形（取料中）

- entityBindings 精确形状与逐夹具修改位（桥闸 schema 取料）；
- record-distill / authority-root 的固定根+租约端到端可行性（若有上游硬依赖走不通，回报 Steven 改判该条为隔离或另立）；
- A6 负向断言的覆盖交接明细（happy 覆盖是否已由 observation-cli-authority-wiring 承接）；
- env-coupled 那条超时（active-suite-contract-v2 的 30s→180s 单行）是否搭车本契约——提请 sol max 共识时一并判。
