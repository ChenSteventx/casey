# 请签包：质量门禁可执行契约前置闸（kernel 车道）

状态：`PENDING_STEVEN`。**未人签，绝不代签。**

## provenance（这份请签包是怎么来的）

- 凭据：Steven 本轮在「清残留 + 加前置闸」两项里做的裁定，经编排方转达给实现代理。
- 签的范围：只签下面「待签事项」两条；不含任何真机人签契约的重签，不含 `passes` 改写。
- 字段由来：本文件全部字段由 Claude（Opus 5）代填，**非 Steven 本人书写**。
  `signedBy` 一栏留空——只有 Steven 本人落笔才算签。
- 实现方：Claude 家族。评审方：`grok-4.5`（异构成立）。`codex`/`gpt-5.6-sol` 本轮三次调用
  全部失败（一次 10 分钟超时、两次 `HTTP 403 missing csrf token` 传输错），已如实挂账。

## 待签事项

### 一、包改动落地（受控同步窗口）

改动在独立包的隔离工作树 `/mnt/d/ctx/heren/loop-kit-gate-preflight`（分支 `gate-contract-preflight`）：

| 提交 | 内容 |
|---|---|
| `af3dc13` | `bin/gate.mjs` 加可执行契约前置闸 + 新增红先行金牌 |
| `38ee533` | 采信异构评审两条 Medium 的修复 |

**尚未同步到 `/mnt/d/ctx/heren/loop-kit`。** 按 `docs/plans/loop-kit-extract/plan.md` 第 37 行，
包的任何改动必须与**期望存档**（`tests/fixtures/loop-kit-expected/package/`）、
**身份锁**（`loop-kit/kit-lock.json`）、**`prd-loop-kit-extract` 重签**三样一起落，缺一不可；
落之前 Casey 侧所有还持旧身份锁的工作树会被 `boot.mjs` 的全文件哈希校验当场拦死
（`loop-kit/lib/boot.mjs:72-127`，引导失败归 exit 2）。故须由 Steven 挑一个没有其它代理在跑的窗口。

金牌最终落点也待定：包内 `tests/` 会进身份锁全清单（扩大爆炸半径）；按本仓惯例
（`loop-kit` 的测试一向落在 Casey 的 `tests/_golden/`）建议落 Casey 侧。

### 二、与已锁纪律的冲突（必须先裁，见下）

## 冲突：`docs/HANDOFF.md:1275` 明文认可空 `stories`

`HANDOFF.md` 2026-07-07 已锁：

> **真机人签契约走扁平每用例契约文件**（已锁）：真机人签走 `loop/prd-tc_<caseId>.json`
> （`schemaVersion 2`、`caseId` + 空 `stories`），sign 写 `expectedFrozenPath` +
> `testChecksums[expected.frozen.json]`——与金牌契约 prd（冻 golden）是两类 prd、勿混。

前置闸把空 `stories` 一律判 exit 64，与这条直接冲突。冲突不是历史包袱：

- `tests/_golden/p2-sign.golden.mjs:38` 故意用空 `stories` 造最小 prd；
- **本轮进行中的另一个契约刚新建了 `loop/prd-tc_chiefcomplaint_smoke.json`**（空 `stories`），
  其车道理由明确引 `bin/sign.mjs:214-217`「首次发布前必须为空校验和」。
  即这一形态**此刻仍在被正常生产**，不是陈年残留。

另一个契约（`hollow-acceptance-audit-and-gate-nails`）的反例金牌也把同一问题挂了待裁，
并给出**相反方向**的收口建议：

> 门禁没有任何字段可机械区分「可执行质量契约」与「登记账」，于是对二者一视同仁。
> 收口方向应是给 prd 加显式类型字段把登记账分出去，而不是给空数组判据开例外。

### 实现方建议（供 Steven 裁，不自作主张）

**建议取「显式类型字段」方案，而不是现在这版无差别 64。** 理由：

1. 无差别 64 会把一个**仍在正常使用**的人签工作流判成契约错误，代价落在真机人签面；
2. 「登记账」与「可执行质量契约」本就是两类东西，靠 `stories` 空不空来推断是启发式，
   两个契约的代理各自独立得出同一结论；
3. 显式字段（如 `contractKind: "executable" | "registry"`）让 `gate` 对登记账直接
   「不适用」退出，语义比「契约缺失」准确，且 `contract.mjs:241` 的 loop 阶段判据
   （已要求 `stories.length > 0`）可以跟着对齐，不再靠巧合一致。

**若 Steven 仍取无差别 64**，本轮实现已可用，但须同时裁定这 9 份登记账的去向
（改形态 / 加豁免字段 / 迁出 `loop/`），否则它们会长期停在 exit 64。

## 本轮实测证据

| 项 | 结果 |
|---|---|
| 红先行（未打闸包 vs 金牌） | exit 1，34 处未闭 |
| 转绿（打了闸包 vs 金牌） | exit 0 |
| 评审所报变异包 vs 修复前金牌 `af3dc13` | exit 0（假绿属实） |
| 同变异包 vs 修复后金牌 | exit 1，四钉报副作用哨兵已落盘 |
| 9 份受阻断契约 | 全部 exit 64，契约文件逐字节未变 |
| 合法契约抽样（4 份） | 全部 exit 0，零误伤 |
| `selftest --tier1` | exit 0 |
| `ratchet verify` | exit 0（151 PRD / 625 冻结件 / 0 问题）|
| round-1 评审 | 无 Critical/High，2 条 Medium，均本轮收口 |
| round-2 复审 | 两条 Medium 真闭合，无新问题 |

## 签字栏

- `signedBy`：（待 Steven 本人填写）
- `signedAt`：（待填）
- 裁定：□ 取显式类型字段方案　□ 取无差别 64 并另裁 9 份登记账去向　□ 其它
