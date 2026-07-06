# e2e-chain — grill 决策记录（light）

> 授权链：Steven「把剩下的相都跑完」+「先继续做」。相0–相6 各相均已建成收口，但从未在一条链上
> 首尾串跑（金牌 C3 只证到 compile gate 段；`scripts/sample-report.mjs` 手写 spec 从相3 起跳）。
> 本契约把七相串成一条 hermetic 链的集成金牌——全部决策为机械镜像既有先例，逐条列源。

## D1 链形（十站，全走已建 CLI 真面，零新机制）

候选文本（mock LLM 归一产物，内联夹具）→ ① `casey ingest` → testcase → ② `casey flow-bridge`
（mock mapping 内联夹具，含 assert.* 原子供相2 骨架取料）→ ③ `casey compile` gate 段 → ④ confirm 门
（手编 `confirmedBy`，镜像 p3-compile 金牌 `golden-human` 先例）→ ⑤ `casey compile --execute`
（fake-sut 夹具 + `--skip-login` + `--unique-name` 定值，镜像 p3-compile 金牌）→ events/observed/compile-report
→ ⑥ `casey draft`（`--patch` = mock LLM 补缝，含给 nav intent 补硬断言——verdict 对无硬断言步判
`NEEDS_HUMAN(INDETERMINATE)`、全 PASS 须每 intent ≥1 硬断言）→ ⑦ `casey sign`（CLI 真签面、非
`signExpected` helper——链的意义就是走生产面；最小 prd 夹具镜像 p2-sign 金牌；`--signed-at` 定值保确定性）
→ ⑧ `casey run`（--sut 指夹具、显式路径喂 events/expected/profile）→ 相3 replay → 相4 verdict → 相6 report。

## D2 夹具与确定性（全镜像先例）

- SUT：`tests/fixtures/fake-sut/server.mjs` happy 场景（fork 子进程、127.0.0.1、零凭据零登录墙）。
- profile：`{background: FAKE_SITE_DENYLIST, successField:'status', successValue:200}`（p3 金牌同款）。
- 确定性钉点：`--unique-name` 定值 / `--signed-at 2026-07-06T00:00:00.000Z` / signer `qa.hermetic` +
  build `hermetic-b0`（`_sign-helper` DEFAULTS 同款）；产物全落 mkdtemp，零仓内残留。
- `--skip-login` 路径 `loadCreds` 永不触发；`AT_SITE_JSON` 指向合成 site 文件，杜绝读仓根真 `site.json`
  （侦察风险项：executeMode 无条件 `loadSiteConfig`，缺省会读真 site.json——hermetic 链必须隔离凭据类文件）。

## D3 终态断言（链的验收语义）

- 相4 verdict：全 intent `PASS`（含 nav intent——靠 ⑥ 补丁硬断言兜住 INDETERMINATE）；
- 相6 report：`<caseId>.report.{html,md,json}` 三件在场，json 裁定概览 通过=intent 数、其余全 0；
- 链完整性：expected.frozen 三签署字段齐 + prd 夹具被 sign 回写 `expectedFrozenPath`/checksum；
  events/expected caseId 绑定一致；产物零凭据形串（哨兵扫描）。

## D4 金牌性质与红绿纪律

集成回归金牌（acceptance-gate 工序合法第二类：收编存量行为、冻结时即绿）——本契约零新实现，
金牌绿即链通。**若 bring-up 挖出任何真缝（lib/bin 缺陷），停手改走「钉红→修→绿」并按所碰面升 lane**；
纯夹具/编排调整（intentId 对位、patch 内容）属金牌 authoring 不属实现改动。

## D5 非目标

不接 `casey run` 前段（run 仍起于相3，前段接线另契约）；不碰相5 自愈（仅 HARNESS_ERROR 开闸，
happy 链不触发，维持「未吃过真场景」诚实交底）；不碰真机/tier2；不动任何冻结面与 lib/bin
（除非 D4 触发升 lane）；不烧真 LLM（归一/映射/补缝全 mock 内联，同 flow-bridge/draft 先例）。
