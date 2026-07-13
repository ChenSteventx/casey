# loop-kit-extract 实现审记录（r2 第二次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-2 第一次跑发现（2 `HIGH`/1 `MED`/1 `LOW`，`codex-impl-r2.md`）
  处置后的复核。Casey 树 commit `b729f10`（父 `1378181`）+ 包仓 `/mnt/d/ctx/heren/loop-kit` commit
  `dd5cd1f`（父 `1d4bc66`）。评审料：`docs/plans/loop-kit-extract/review/material-impl-r3.md`（累积
  diff：从提取切换收口 `31e71de`/包仓首提交 `0f34cc0` 到本轮 HEAD）。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only
  -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec（round-1 摘要+round-2 第一次跑发现原文+处置表+mutation 验证证据+门禁
  证据）+ 累积 diff，不含凭据、不含实现者内心推理。
- 运行备注：`read-only` 沙箱下实际执行了：① 真实 `worker_threads` 探针验证 `isMainThread` 拒绝；
  ② 独立探针验证冻结/幂等复用重校验行为；③ 核对十个 shim 展开结果与 `testChecksums` 哈希一致性。
  进程正常产出完整终判并退出（tokens used 102,497）。

## 结论

`CHANGES REQUIRED`——发现 1 项 `HIGH`。codex 原文：「A2、A6、孤儿锁文件均已闭合；A1 的 Worker
边界已闭合，但槽防篡改仍存在可复现缺口」。

## HIGH

**合法预置值不会被冻结，仍可在两个有效 ROOT 间改写**（`loop-kit/lib/root.mjs`）

`writeClaimed()` 只在槽为空时冻结属性。若外部先用普通赋值预置一个合法、规范化的 ROOT：
`resolveRoot({envRoot:''})` 经 `revalidateClaimed()` 接受该值；复用路径不会调用 `writeClaimed()`；
属性仍为 `writable:true, configurable:true`；外部可改写成另一个合法 ROOT；下一次复用再次校验通过
并接受新 ROOT。独立探针实测：`{"a":".../casey-loop-kit-extract","b":".../casey","d1":{"writable":true,"configurable":true},"d2":{"writable":true,"configurable":true},"claimed":".../casey"}`——
同一主线程进程先后接受了两个不同的真实合法目录，仍违反「首次认领后不可变、进程唯一 ROOT」。
现有测试只覆盖「预置不存在的无效路径会被拒绝」与「由 `resolveRoot()` 自己首次认领后属性被冻结」，
没有覆盖「外部预置合法 ROOT 后再改写」；显式 `envRoot` 与槽值相同时 `claimAtomic()` 同样受影响。
建议：在复用或 `claimAtomic()` 接受既有槽值前检查属性描述符，只信任模块自身产生的冻结形态。

## 其余复核结果（codex 原文核实为已闭合）

- A1 Worker 边界：已闭合。真实 `worker_threads` 探针得到结构化 `RootResolutionError`；生产消费面
  未发现 Worker 用法，主线程场景未被误伤。
- A2：已闭合。三类入口实际输出能区分 `SPAWN_ERROR` 与 `NO_STATUS`；删除 `r.error` 分支会落入不
  匹配的 `NO_STATUS` 文本，新增断言会转红。
- A6：已闭合。测试真实调用 `boot.loadLib()`，同时经过特殊路径下的 `root.mjs` 和目标模块；旧字符串
  拼接对同一路径解析为错误的 `/tmp/lib/root.mjs`。
- 孤儿锁文件：已闭合。所有通用 `${dir}.lock.json` 路径均由 `rmrfWithLock()` 清理，当前 `/tmp` 未
  发现 `loop-kit-c4-*.lock.json`。
- round-1 `A2`–`A7`：未发现本轮引入的回归。
- 冻结面：90 个 `testChecksums` 全部匹配；包仓、期望存档与 `kit-lock` 的 13 文件集合及哈希三方一致。
- 新增复核调用的额外文件检查与 `realpath` 成本很小，未发现明显性能或合法重复认领副作用。
- 未发现新增凭据或术语边界问题。

补充限制（codex 原文）：只读沙箱限制未独立执行会创建临时目录的完整 golden/gate；语法检查、冻结
哈希、跨仓一致性及无写入探针均已实际执行。

## 处置与去向

本记录发现的 1 `HIGH` 已由实现方（Claude）当场处置（同一工作会话内）：`root.mjs` 新增
`isFrozenBySelf()`/`adoptAndFreezeIfNeeded()`——`revalidateClaimed()`（幂等复用）与 `claimAtomic()`
（同值复用）在接受既有槽值前，先检查属性描述符是否已是本模块产生的冻结形态，不是则当场补冻结，
把「首次被信任使用的时刻」当作认领时刻。已用独立探针复现 pre-fix 静默接受切换 / post-fix 正确拒绝，
并落成 C7 永久回归测试。修复涉及包仓 `root.mjs`（commit `8da967f`）+ Casey 侧期望存档/`kit-lock`/
金牌/prd 重签整链。处置完成后需再跑一轮 `codex` + `pi` 双路复核确认收口。
