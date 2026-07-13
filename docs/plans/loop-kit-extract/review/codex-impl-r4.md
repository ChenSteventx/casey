# loop-kit-extract 实现审记录（r2 第三次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-2 第二次跑发现（1 `HIGH`，`codex-impl-r3.md`）处置后的
  复核。Casey 树 commit `74c05b3`（父 `b729f10`）+ 包仓 `/mnt/d/ctx/heren/loop-kit` commit `8da967f`
  （父 `dd5cd1f`）。评审料：`docs/plans/loop-kit-extract/review/material-impl-r4.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only
  -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec（历史发现摘要+本轮处置说明+累积 diff+门禁证据），不含凭据、不含实现者
  内心推理。
- 运行备注：`read-only` 沙箱下实际执行了独立探针（构造属性描述符 mutation 验证 `isFrozenBySelf()`
  的边界情形）与源码级 mutation（删除 `claimAtomic()` 的补冻结调用验证测试覆盖缺口）。进程正常
  产出完整终判并退出（tokens used 109,983）。

## 结论

`CHANGES REQUIRED`——发现 1 项 `MED`、1 项 `LOW`。codex 原文：「round-2 第二次跑的 `HIGH` 在当前
实现中已真实闭合；但发现 1 项 `MED` 测试缺口和 1 项 `LOW` 表述不准确」。

## MED

**显式 `envRoot` 同值分支没有永久回归测试**（`loop-kit/lib/root.mjs:164`、
`tests/_golden/loop-kit-extract.golden.mjs:1181`）

当前代码正确：`claimAtomic()` 的 `current === candidate` 分支会在返回前调用
`adoptAndFreezeIfNeeded(current)`；独立探针确认外部预置合法 ROOT A → 显式 `envRoot:A` 调用 →
返回前已冻结 → 改写为 B 抛错。但新增的 C7 用例只覆盖省略 `envRoot`（`revalidateClaimed()`）路径，
没有覆盖「外部预置 A 后调用显式 `envRoot:A`」的 `claimAtomic()` 同值路径。codex 做了只读内存
mutation：仅删除 `claimAtomic()` 第 164 行补冻结调用，显式路径的换根漏洞重新出现
（`{"swapped":true,"claimed":".../casey","writable":true,"configurable":true}`），而现有测试测
不出这个回退。

## LOW

**`isFrozenBySelf()` 不能证明冻结来自本模块**（`loop-kit/lib/root.mjs:94`）

判据 `desc.writable === false && desc.configurable === false` 只能证明属性已经不可改，不能证明是
本模块自己的 `writeClaimed()` 产生——外部代码可以构造完全相同的描述符（codex 用 `enumerable:true`
构造外部冻结验证，`isFrozenBySelf()` 仍返回真）。codex 明确指出这不形成换根漏洞（该外部描述符本身
已不可写不可配置，后续改写仍会失败），但建议改名为 `isClaimSlotFrozen()` 并删掉「本模块自身产生」
的来源性声明。

## 其余复核结果（codex 原文）

- 两条真实路径均确认在返回调用方之前完成冻结，没有异步或时序窗口。
- 外部只设 `writable:false/configurable:true` 时会正确补冻结。
- 90 个 `testChecksums` 全部匹配；包仓与期望存档 `root.mjs` 字节一致（sha256 均为
  `ae3bab...b48557`）；`kit-lock` 13 个包文件全部匹配。
- round-1 七条及 round-2 第一次跑四条未发现重新打开。
- 未发现新增性能问题、凭据泄漏或术语边界问题。

补充限制（codex 原文）：受只读沙箱限制，完整金牌在本次沙箱中只能跑到 `37/72`（`/tmp` 为 `EROFS`
无法创建部分测试夹具），并非行为断言失败；语法检查、冻结哈希、跨仓一致性及无写入探针均已实际执行。

## 处置与去向

本记录发现的 `MED`+`LOW` 已由实现方（Claude）当场处置（同一工作会话内）：①新增独立 C7 用例，
专门覆盖「外部预置合法 ROOT 后，显式 `envRoot` 恰好等于该值」这条 `claimAtomic()` 同值路径，已用
codex 描述的相同 mutation 验证新测试确实会转红；②`isFrozenBySelf()` 改名为 `isClaimSlotFrozen()`，
注释删除「本模块自身产生」的来源性声明，改为如实描述「当前是否已冻结」。修复涉及包仓 `root.mjs`
（commit `a0d2a77`）+ Casey 侧期望存档/`kit-lock`/金牌/prd 重签整链。处置完成后需再跑一轮 `codex`
+ `pi` 双路复核确认收口。
