# 既有红金牌诊断（2026-07-28 深夜，只诊断不修复）

挂账第 6 项（review.md）记「teachin-observation 与 teachin-runtime-successor 家族 5 枚既有红
（含两枚撤销守卫按设计红），与本契约无因果」。本次逐枚复跑定位现状与归因；未动任何冻结
断言、夹具或生产代码。

## 现状（退出码为准）

- `teachin-observation` 家族 8 枚：**全绿**（authority-hardening / authority-root /
  driver-canonical-root / driver-provenance / safe-case-lease-v2 / sidecar-hardening /
  sidecar / transaction-root 均 exit 0）。
- successor 家族 8 枚：5 绿 3 红。现红三枚：
  1. `teachin-runtime-authority-bundle-successor`（exit 1）
  2. `teachin-runtime-readiness-successor`（exit 1）
  3. `teachin-semantic-lock-runtime-discrimination-successor`（exit 1）
- 评审时点计 5 红、现测 3 红：差额两枚已核死＝`teachin-observation-driver-canonical-root`
  与 `teachin-observation-transaction-root`（即「两枚撤销守卫按设计红」）。证据链：提交
  1e6c3c5（2026-07-17）把两枚改写为守卫化内容但 PRD 冻结账未随之重冻，2026-07-28 全仓漂移
  普查逮出、Steven 批准 checksumAmendment 同步（两 PRD 的 amendment reason 原文在案，
  工作树 modified 即该两笔），同步后两枚现复跑 exit 0。后继契约接手时仍以当日复跑为准。

## 三枚现红的共同签名与归因

失败全部发生在**断言目标行为之前**——夹具被更新后的准入/校验层直接拒绝：

- authority-bundle：健康路径 `available=false`，各否定分支统一落
  `RUNTIME_AUTHORITY_PROVENANCE_NOT_VERIFIED`；legacy-four-bools 落
  `RUNTIME_READINESS_INSPECTION_INVALID`——夹具构造的 bundle 不满足新的 provenance
  验证与 readiness inspection 形状。
- readiness：矩阵首组即 `RUNTIME_READINESS_INSPECTION_INVALID`，同因。
- semantic-lock-runtime-discrimination：V2-C 全分支塌缩到
  `ENTITY_LOCK_RUNTIME_UNAUTHORIZED`，铸造段先被 `ENTITY_RUNTIME_ADAPTER_INVALID`
  拦住——夹具的 runtime adapter 构件不满足新适配器契约，判别逻辑根本未被执行。

归因结论：**陈旧红**——实体/授权接缝在 2026-07-24~27 硬化后，这三枚冻结金牌的夹具未随签
更新，红因是「夹具过不了新准入门」，不证明被测判别/就绪逻辑本身有缺陷，也不能当它们仍被
覆盖的绿证据。这与护栏 #19（强制层落地复跑受影响面）与 learn.md 第 10 条「陈旧绿是结构性
风险」同源，只是方向相反（陈旧红）。

## 处置建议（留给后继契约）

1. 修复路径＝按 [dont-rig-fixtures] 纪律**正向重表达夹具**过新准入门（不许倒着放宽准入门），
   触及冻结断言走 checksumAmendment + Steven 重签；
2. 接手前先复跑定位当日现状（本页数据即时性有限）；
3. 顺带补漂移普查记录里「5 红」名单与今差额两枚的去向核对。

诊断人：Claude（fable 5），零 SUT、零真机、零改动。
