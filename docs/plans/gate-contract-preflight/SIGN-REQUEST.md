# 请签包：质量门禁可执行契约前置闸 + contractKind 分流（kernel 车道）

状态：`PENDING_STEVEN`。**未人签，绝不代签。** `signedBy` 一栏留空，由编排方统一落。

## provenance（这份请签包是怎么来的）

- 凭据：Steven 本轮两次裁定——①「清残留 + 加前置闸」；②「登记账去向取**加显式类型字段**」
  「两份金牌互斥由**反例金牌让路**」「环境差异回写**本轮不修、如实挂账**」。经编排方转达。
- 签的范围：只签下面「落地范围」；不含任何真机人签契约的重签，不含 `passes` 改写。
- 字段由来：本文件全部字段由 Claude（Opus 5）**代填，非 Steven 本人书写**。
- 实现方 Claude 家族；评审方 `grok-4.5`（异构成立）。`codex`/`gpt-5.6-sol` 本轮三次调用全败
  （一次 10 分钟超时、两次 `HTTP 403 missing csrf token`），已如实挂账、未反复探测。

## 一、`contractKind` 语义（按裁定写死）

| kind | 门禁行为 |
|---|---|
| `executable` | 进质量门禁，照常 exit 0（全绿）/ 1（有红）|
| `registry` | **硬拒 exit 64，永不 0**；不跑命令、不回写 `passes`/`evidence`、不打印 `GREEN` |

红线已在代码与金牌两处钉死：`registry` 分支是立即 `exit 64`，**没有任何走到主循环的路径**；
金牌 `K1` 专钉这条——`registry` 即便带一整套完全合法、真能跑绿的 story，也必须 64。
未打闸的包上 `K1` 实测拿到 `exit 0 + GREEN + 回写 + 命令真跑`，四项全中，证明这条红线不是空谈。

### 与裁定的一处偏差（须你确认）

裁定原话是「缺 kind 的件 → 64，不默认成 executable 也不默认成 registry」。**我没有照此实现**，
理由是它与一枚**已冻结的非回归钉**直接冲突：

`tests/_golden/loop-kit-extract.golden.mjs:928-930` 把三份 prd 的 git blob SHA 写死做「零字节
改动」证明（`prd-worktree-baton` / `prd-term-guard` / `prd-ratchet-reverse-index`）。要让缺字段
一律 64，就得给全部 142 份存量补字段，**补到这三份上会当场打破那枚钉**。

实际实现：缺字段的件走**最严的一路**——不豁免任何检查，必须自证通过可执行契约前置闸才进主循环。
它**一分绿也拿不到**，只是没拿到 `registry` 的免检；这不是「默认成 executable 授予绿」。
另加一条正向 fail-closed：**缺字段但带 `expectedFrozenPath`**（`bin/sign.mjs` 的产物形状）
**直接归 64**，堵死「`sign` 持续造出无类别新件」这个口（金牌 `K5`/`K6`）。

若你坚持无差别 64，须先裁那枚零字节钉怎么处置（重签 `prd-loop-kit-extract`）。

## 二、9 份的逐个判定（未整体刷）

| 契约 | 判定 | 依据 |
|---|---|---|
| `prd-tc_agent_id_readback_real_uat_v1` 等 5 份 sv2 | `registry` | 带 `caseId` + `expectedFrozenPath`，`sign` 的产物形状 |
| `prd-tc_audience_wiring`、`prd-tc_compile_audience` | `registry` | sv1，冻的是接线夹具，登记面真实可查 |
| `prd-cli-mcp-face` | `executable`（**不是登记账**）| 有两条带 `desc` 的真 story，只是 `acceptance` 于 2026-07-15 被 real-SUT-only 禁令撤空（`evidence` 写着 `REVOKED`）。标 `registry` 就是拿字段给残缺的可执行契约免检——正是你点名的后门。标 `executable` 后它照样 64（空 `acceptance`），红得其所 |
| `prd-replay-admission-hermetic-migration` | **不标，单独挂出** | 见下 |

### 你点名要看的那一份

`prd-replay-admission-hermetic-migration`：sv1、0 story、**0 `testChecksums`**、无 `caseId`、
无 `expectedFrozenPath`——登记面全空，正如你说的「连完整性都无可查」。它的 `task` 自述已
「转调查/决策契约」，两条 `observability` 全 `route: human`。

**我的判定：它既不是可执行契约，也不是登记账，不给它任何 kind。** 标 `registry` 等于把一份空壳
洗成受认可的类别——那是同一个后门换了身衣服。留其无字段，门禁按空 `stories` 判 64，**如实暴露
它未完成**。去向（补齐 / 删除 / 另立第三类）请你裁，本轮不替它选。

## 三、落地范围与窗口

| 位置 | 提交 | 状态 |
|---|---|---|
| `loop-kit-gate-preflight` 隔离工作树 | `af3dc13` `38ee533` `626f6ba` | **未同步进 `/mnt/d/ctx/heren/loop-kit`**，等你挑窗口 |
| casey `dev` | `019d24f` `c5d1e74` `1e23e2a` `b6cad48` `55902ec` | 已提交 |

包同步仍须与**期望存档** + `kit-lock.json` + `prd-loop-kit-extract` 重签一起落，落地会当场拦死
所有持旧锁的会话。金牌落点按裁定走 casey `tests/_golden/`，不进包内 `tests/`。

`loop/prd.schema.json` 被 `prd-seams-freeze` 冻结，改它是重签事件，故本轮**只出提议件**：
`docs/plans/gate-contract-preflight/proposed/prd.schema.json`（加 `contractKind` + 互斥分支；
`stories.minItems` 从基座移进分支，否则与 `registry` 的空 `stories` 直接矛盾）。
提议件已逐份自验：151 份里只有 `prd-replay-admission-hermetic-migration` 与分支不自洽——
正是上面单独挂出的那份，口径一致。

## 四、本轮实测证据

| 项 | 结果 |
|---|---|
| 前置闸金牌：未打闸包 / 打了闸包 | exit **1（54 处未闭）** / exit **0** |
| `K7`/`K8` 反向钉（`executable` 与无字段的存量合法契约）| exit 0，零误伤 |
| 9 份逐个跑终版 gate `--dry` | 全部 exit **64**，契约文件**逐字节未变** |
| `sign` 类别钉：撤字段 / 字段在场 | exit **1** / exit **0** |
| 反例金牌 vs 打了闸的包 | exit 1，**3 处**未闭（N1/N2 已闭；N3/N4 按裁定保持红）|
| 反例金牌变异自证（3 种「什么都不做直接退」假实现）| 全部仍 exit **1**，`P0` 当场倒下 |
| 两份金牌 `LOOP_KIT_PKG` 指向转发层 | 均 exit **64** fail-closed（本轮自查逮到的自伤假绿，已修）|
| `ratchet verify` | exit 0（151 PRD / 625 冻结件 / 0 问题）|
| `selftest --tier1` | exit 0 |
| 评审 round-1 / round-2 | 无 Critical/High；2 条 Medium 当轮收口；复审确认真闭合 |

## 五、挂账（本轮不修）

1. **环境差异回写**（你裁定本轮不修，同意）：工作树里 gate 因 gitignore 路径 miss 把 `passes`
   由 `true` 回写成 `false`。它与前置闸同族但不同面——前置闸只管「契约本身不可执行」，管不到
   「工装/环境不满足」。**建议方向：与前置闸共用同一条「跑不到底就不回写、归 64 不归 1」的地板。**
   要动主循环与 `report` 逻辑，超出本轮判据。
2. **N3 / N4** 两个门禁口子（全局判红仍回写有效 `true`；`evidence` 与验收内容零绑定）——保持红。
3. **`p2-sign` 金牌 C5 红**：已签契约 replay 应 exit 0，实得 65
   （`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`）。已用 `git stash` 撤掉本轮 `sign.mjs` 改动对照
   复跑，基线同为 22 过 / 1 败——**该红本刀之前既已存在**，非本刀引入，未遮未改。
4. 48 份形制不合规里，本轮只阻断 9 份；`lane` / `observability` / `desc` / `passes` / sv2 字段
   等**只记账不阻断**，完整性校验归 `ratchet verify`。清单见同目录 `prd-schema-census.json`。

## 签字栏

- `signedBy`：（留空，待编排方统一落；执行者 Claude，非 Steven 本人书写）
- `signedAt`：（待填）
