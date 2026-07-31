# 红基线 —— 门禁空心验收反例钉

金牌：`tests/_golden/gate-hollow-acceptance-counterexamples.zero-sut.golden.mjs`
命令：`node tests/_golden/gate-hollow-acceptance-counterexamples.zero-sut.golden.mjs`
**退出码 1**，四钉六处全红。这是红先行反例，现在红是正确结果；第三步修完 `gate.mjs` 后应自然转绿。

判红只信退出码。两次连跑输出逐字节相同（只有 `gate@` 时间戳随跑变动）。

## 红签名原文（`gate@` 后的时间戳按跑次变动，此处归一为 `<TS>`）

```text
RED  gate-hollow-acceptance: N1  空 acceptance 数组时门禁应判红，实测 exit 0（schema minItems:1 声明存在=true，门禁从不校验 schema）
RED  gate-hollow-acceptance: N1  空 acceptance 数组不得让 story 翻绿，实测 passes 被写成 true，evidence="gate@<TS> 全部 acceptance exit 0"
RED  gate-hollow-acceptance: N2  stories 为空数组时门禁不得报 GREEN，实测 exit 0 且输出含 "gate: GREEN"（story 0/0 过）
RED  gate-hollow-acceptance: N3  全局判红（exit 1）时不得给 story 回写有效 true，实测 passes=true、evidence="gate@<TS> 全部 acceptance exit 0"
RED  gate-hollow-acceptance: N4a  evidence 应绑验收数组摘要（前 12 位 40224ee49466）才能在验收变更后失效，实测 evidence="gate@<TS> 全部 acceptance exit 0" 不含任何验收摘要
RED  gate-hollow-acceptance: N4b  两条验收面不同的 story，evidence 去时间戳后逐字节相同（"gate@<TS> 全部 acceptance exit 0"）——evidence 与验收内容零绑定，旧绿永不失效
RED  gate-hollow-acceptance: 6 处机制缺口未修——本金牌为红先行反例，现在红是正确结果
```

`40224ee49466` 是 `sha256(JSON.stringify(["node ok.mjs"]))` 的前 12 位，确定性常量、不随跑次变。

## 四钉与机制缺口的对应

| 钉 | 断言的应然 | 实测缺口 | 出处 |
|---|---|---|---|
| N1 | 空 `acceptance` 数组时门禁判红、不得让 story 翻绿 | `storyGreen` 从 `true` 起步，空数组真空翻绿；`prd.schema.json` 写了 `minItems: 1` 但门禁从不校验 schema | `gate.mjs:90`、`gate.mjs:108` |
| N2 | `stories` 为空数组时门禁不得报 GREEN | `total`/`green` 按 `prd.stories.length` 统计，空表判 `GREEN 0/0`、退出 0 | `gate.mjs:120-122` |
| N3 | 全局判红时不得给 story 回写有效 `true` | story 回写只看 `storyGreen`，完全不看全局 `red` | `gate.mjs:47`、`gate.mjs:108` |
| N4 | 验收变更后旧 `passes`/`evidence` 应失效 | `evidence` 只有时间戳、不绑验收命令摘要，无任何机制能发现验收变过 | `gate.mjs:109-111` |

## 一次实测逮到的假绿（记账，非事后总结）

首版工装把 `gate.mjs` 定位到**消费树内的薄转发层** `loop-kit/bin/gate.mjs`。该转发层由 `boot.mjs` 按
自身位置推出 `TREE_ROOT` 并以显式参数认领 ROOT，`LOOP_KIT_ROOT` 指不动它——合成根被无声忽略，
`gate` 转去读真仓契约、以 `exit 64` 收场。当时 N1/N2/N3 三钉的判定式都写成「实测 exit 0 才算缺口」，
于是 **三钉全部静默「通过」**，只有 N4 因为写了前提检查才把工装故障暴露出来（`实测 64 / 64`）。

修法两条，都已落进金牌：

1. 定位改打**独立包**的真实现（`LOOP_KIT_PKG` 优先，否则兄弟目录 `../loop-kit`），并主动识别、拒绝转发层；
2. 加通用前提闸 `harnessOk()`：`gate.mjs` 只有跑到底才会打印收尾摘要行 `gate: GREEN|RED —— story x/y 过`，
   缺这行一律当红报出，绝不让工装故障冒充绿。四钉逐个接上。

## 零 SUT 与不干扰性核验

- 每钉在系统临时目录造合成最小根，跑完 `rmSync` 清理；实测跑后 `/tmp/gate-hollow-nail-*` 残留 0 个。
- 不启动夹具 SUT、不启动浏览器、不读 `.auth/` 与 `site.json`、不写真仓任何文件；
  对真仓只读一次 `loop/prd.schema.json` 取 `minItems` 声明。
- 本金牌**未被挂进任何 prd 的 acceptance**，也未进任何 `testChecksums`——挂进去会让承载它的 story 立刻转红，
  那属于处置，是第二步与第三步的活。
- 落地后复跑两枚会枚举金牌目录的现役件，均仍绿且都不提及本金牌：
  `hermetic-golden-sut-census`（exit 0，闭集仍为 30）、`hermetic-golden-prd-reverse-closure`
  （exit 0，151 份 prd / 576 条验收已闭合）。
