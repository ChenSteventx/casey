# loop-kit-extract 实现审记录（r2 第四次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-2 第三次跑发现（1 `MED`+1 `LOW`，`codex-impl-r4.md`）处置
  后的复核。Casey 树 commit `f8d58ab`（父 `74c05b3`）+ 包仓 `/mnt/d/ctx/heren/loop-kit` commit
  `a0d2a77`（父 `8da967f`）。评审料：`docs/plans/loop-kit-extract/review/material-impl-r5.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only
  -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec（历史发现摘要+本轮处置说明+累积 diff+门禁证据），不含凭据、不含实现者
  内心推理。评审指令本轮额外要求「通读 `root.mjs` 全文独立评估是否还有其它缺口，不局限于历史发现」。
- 运行备注：`read-only` 沙箱下实际执行了 `node:vm`（`vm.createContext`/`vm.SourceTextModule`，加
  `--experimental-vm-modules`）构造两个独立 realm 加载真实 `root.mjs` 源码的独立复现；核对
  `testChecksums`/`kit-lock` 一致性；尝试完整 selftest（受限于 `/tmp`/`cases/_selftest` 的 `EROFS`
  未能全通过，非行为断言失败）。进程正常产出完整终判并退出。

## 结论

`CHANGES REQUIRED`——发现 1 项 `HIGH`（新角度，非历史发现列表内）、1 项 `LOW`。上一轮 `MED`+`LOW`
确认已闭合。

## HIGH（新角度）

**ROOT 认领仍不是真正的进程唯一**（`loop-kit/lib/root.mjs`）

`worker_threads` 已被拒绝，但 `node:vm` 的多个上下文也各有独立 `globalThis`，且其中
`isMainThread === true`。codex 用两个 `vm.SourceTextModule` 上下文执行当前真实 `root.mjs`，分别
认领当前树和兄弟 Casey 树：`{"a":".../casey-loop-kit-extract","b":".../casey","e1":null,"e2":null,
"isMainThread":true,"bothSucceeded":true,"different":true}`——同一进程、同一主线程内两个异根同时
认领成功，零冲突。当前两仓没有 `node:vm` 消费面（非既有路径回归），但静默违反「进程唯一 ROOT」
核心承诺，定级 `HIGH`。建议将认领槽放到跨 VM 上下文共享的宿主对象，或明确检测并拒绝非默认 realm；
同时补永久 C7 回归测试。

## LOW

**C7 的返回身份断言实际过宽**（`tests/_golden/loop-kit-extract.golden.mjs`）

`out.first.includes('a')` 用于证明返回了 `dirA`，但临时目录与 `markerRootDir` 统一使用的子目录名
`marker-root` 本身就含字母 `a`，所以即使返回 `dirB` 该断言也可能为真，没有精确钉住「返回的就是
A」。不影响补冻结 mutation 本身的有效性，但测试精度不足。

## 上轮两项处置复核（codex 原文核实为已闭合）

- `MED` 已真实闭合：新增 C7 明确传入非空 `envRoot: dirA`，必经 `resolveRoot → validate →
  claimAtomic` 同值分支；仅删除 `claimAtomic()` 的补冻结调用后，探针立即变为可写并成功切到 B。
- `LOW` 已真实闭合：包仓 `8da967f..a0d2a77` 的实现差异只有函数名、调用名及注释，判据函数体完全
  不变，属零行为改动的精度修正。

## 其余核验

- 90 个 `testChecksums` 全部匹配；包仓、期望存档与 `kit-lock` 13/13 文件集合及哈希一致。
- `ratchet verify` 仍仅材料记载的两项既有 `FILE_MISSING`。
- 未发现新增性能隐患、凭据泄漏或其它 `round-1` 闭合回退。

补充限制（codex 原文）：完整 `golden`/`selftest` 在本只读沙箱中被 `/tmp` 和 `cases/_selftest` 的
`EROFS` 阻断；`C0`/`C1` 的 6 项只读检查通过，受阻项是夹具无法创建，并非行为断言失败。

## 处置与去向

本记录发现的 `HIGH`+`LOW` 已由实现方（Claude）当场处置（同一工作会话内）：①独立复现确认 codex 的
`node:vm` 复现属实（`--experimental-vm-modules` + `vm.SourceTextModule` 构造两个独立 realm 加载
真实源码，一致复现零冲突认领）；核实该 API 默认不可用（无 `--experimental-vm-modules` 旗标时
`undefined`）、本仓与消费侧任何默认调用路径均不带此旗标、且构造该场景需攻击者已具备同进程任意代码
执行能力（此前提成立时同进程本就不是可信边界）、`grep` 核验零 `node:vm` 使用——比照 `worker_threads`
既有先例，选择精确文档化边界（不引入无法可靠实现、可被绕过而给虚假安全感的运行时启发式），改写
`root.mjs` 语义 6 并新增专节说明来源与依据；②`golden.mjs` 两处 `.includes('a')` 改精确 `realpath`
相等断言。修复涉及包仓 `root.mjs`（commit `462c455`，纯文档）+ Casey 侧金牌/`kit-lock`/期望存档/
prd 重签整链。处置完成后需再跑一轮 `codex` + `pi` 双路复核确认收口。
