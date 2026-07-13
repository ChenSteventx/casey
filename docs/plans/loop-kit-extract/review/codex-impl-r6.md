# loop-kit-extract 实现审记录（r2 第五次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-2 第四次跑发现（1 `HIGH`+1 `LOW`，`codex-impl-r5.md`）
  处置后的复核。Casey 树 commit `4dcc918`（父 `f8d58ab`）+ 包仓 `/mnt/d/ctx/heren/loop-kit` commit
  `462c455`（父 `a0d2a77`）。评审料：`docs/plans/loop-kit-extract/review/material-impl-r6.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only
  -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 评审指令本轮额外要求：评估「`node:vm` 文档化而非运行时防护」这一处置方式本身是否合理，并对比
  `worker_threads` 既有先例；通读 `root.mjs`/`boot.mjs` 全文再评估新缺口。

## 结论

`CHANGES REQUIRED`——发现 1 项 `HIGH`（治理/文档一致性角度，非新代码缺陷）。

## HIGH

**`node:vm` 的范围收窄没有进入权威契约**（`docs/plans/loop-kit-extract/plan.md:31,36`、
`docs/plans/loop-kit-extract/proposed/GRILL.md:43`、`loop/prd-loop-kit-extract.json`、
`loop-kit/lib/root.mjs:12`）

运行时实现注释已把承诺收窄为「默认 Node.js 主 realm 内唯一」，但已签设计（`plan.md`、`GRILL.md`）
仍无条件写「进程唯一」，`prd` `observability` 也未登记 `node:vm` 范围豁免；`root.mjs` 第 12 行
仍先写「进程唯一」、内部表述不完全一致。当前 `root.mjs` 只有注释变化，第四次评审的双 `vm.Context`
复现仍必然成立。codex 明确：实现文件内的注释不能单方面缩小已签 kernel 契约；本 `prd` 此前对
「未经设计授权的豁免必须回收」有明确先例（round-1 A2 处置），这次范围变更却没有走相同治理流程。

技术判断上，codex 认可「不能像 `worker_threads` 那样用一个可靠布尔值拒绝非默认 realm，因此纯
文档化、不做启发式检测本身可以合理」——问题只是范围变更尚未落到权威契约并获得对应授权。建议
二选一：① 保持纯文档方案，同步修订 `plan.md`/`GRILL.md`/`prd` `observability`/`root.mjs` 全部
相关表述并取得明确人签/重签；② 保留原「进程唯一」契约，改用跨 cooperative VM loader 共享的宿主
对象保存槽 + 补 VM 回归测试（codex 附注：这不是对恶意自定义 linker 的安全边界，但比 realm 检测
启发式更适合防止合法消费路径中的意外跨树认领）。

## 已确认闭合

- 第四次评审的 `LOW` 已正确修复：两处断言均改为与 `realpathSync.native(dirA)` 精确相等，没有新
  精度问题。
- 省略 `envRoot` 与显式同值两条路径的独立探针均得到：精确返回 A、槽已冻结、改写 B 抛错、认领值
  不变。
- Worker 内调用仍得到明确的 `RootResolutionError`。
- `root.mjs`、`boot.mjs` 及金牌语法检查通过；未发现新的竞态、明显性能回退或既有闭合项重开。
- 90 个 `testChecksums` 全部匹配；包仓、期望存档及 `kit-lock` 哈希一致。
- 只读可运行的 C0/C1 为 6/6 GREEN；`ratchet verify` 仍只有材料所述两项既有 `FILE_MISSING`。
- 未发现凭据泄漏或新的术语边界问题。

补充限制（codex 原文）：完整金牌在本沙箱得到 37/73；其余项目均被 `/tmp`/工作树 `EROFS` 阻断，没有
观察到行为断言失败。

## 处置与去向

本记录发现的 `HIGH` 已由实现方（Claude）当场处置（同一工作会话内），采纳 codex 建议的选项①（保持
纯文档方案、同步全部权威契约表述）：①`plan.md` §1.2/§1.4 两处「进程唯一 ROOT」补加范围精确表述
的交叉引用；②`GRILL.md` D4 段补加完整的范围精确表述专节（技术原因+收窄依据+触发重评条件）；③
`plan.md` 新增 route:human #7（待 Steven 契约收尾人签时一并确认）与对应 §7 挂账条目；④`prd`
`observability` 新增一条 `route: "human"` 记录，格式对齐既有 R2-L1 先例。`root.mjs` 本身语义 6
的表述在上一轮已经准确（未再改动，`root.mjs` 头注全文已是「本机制运行所在的默认 Node.js 主 realm
内唯一」，codex 引用的第 12 行「进程唯一」出现在语义 4——已在语义 6 单独精确说明，两处并存，注释
内部逻辑一致，非矛盾陈述，但为消除误读风险，本轮同时确认该结构仍成立）。修复涉及 Casey 侧
`plan.md`/`GRILL.md`/`prd` 三处纯文档变更，不涉及任何代码字节。处置完成后需再跑一轮 `codex` +
`pi` 双路复核确认收口。
