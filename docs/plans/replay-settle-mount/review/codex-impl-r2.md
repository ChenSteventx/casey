# replay-settle-mount 实现审记录（r2，`codex`）

## 评审元数据

- 评审对象：r1 findings（1 MED `A1` + 1 LOW `A2`）修订（`HEAD`=`ae5eb55`）。评审料：`docs/plans/replay-settle-mount/review/material-impl-r2.md`（spec 铁不变量 + r1 findings + 修复 diff + 门禁证据 + 处置表；护栏 #9，不含凭据、不含实现者内心推理）。
- 评审形态：异构冗余评审——实现方 = Claude（`opus 4.8`），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-replay-settle-mount -s read-only -m gpt-5.6-sol -c model_reasoning_effort=low -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 效力值口径（如实记）：任务指令原写 `model_reasoning_effort=fast`（Steven「codex 开 fast」），实测该枚举对 `gpt-5.6-sol` 非法（`codex` API 400 `invalid_enum_value`，合法值 `none|minimal|low|medium|high|xhigh`）；驱动员就地改用 `low`（最快的合法实档，强度不减、出得快）重跑，`fast` 尝试作废、不入档。
- 运行备注：`read-only` 沙箱下 `codex` 有只读文件与命令执行权限；本轮 `codex` 自述当前只读环境金牌启动 `mkdtemp('/tmp/...')` 报 `EROFS` 故无法独立复跑金牌，但不据此否定所附门禁证据。驱动员核验：评审前后 `git status --short` 一致（仅本轮新增 review 料），worktree 无被写入痕迹；`tokens used 43,116`。

## 结论

非 PASS。发现 1 个本轮修订问题（`codex` 定级 `LOW`）。

## 原文（verbatim）

```
发现 1 个本轮修订问题，不能 PASS。

- LOW — A2 收窄后的上界仍不成立。plan.md:76 按 4.75s/intent 推出"约 25 个以内不逼近 watchdog"，但循环只在每拍开始前检查预算；最后一拍可能额外消耗 tickLen 最多 500ms，再固定 sleep 120ms（replay-settle.mjs:75）。因此单步静默点的实现上界约为 250 + 2500 + 500 + 120 + 2000 = 5.37s，尚未计入动作执行、采集等整跑开销。25 步仅按文档理想值也已达 118.75s，不能称为"不逼近"120s；按实现上界则约 22 步已达 118.14s。建议改成保守公式并明确预留整跑非静默点开销，或只陈述线性关系、不承诺安全 intent 数。

其余核查通过：
- A1 修法正确：loopStart 在 floor 后建立，条件窗独享完整 budgetMs；waitedMs 仍从 t0 记总等待。
- U2a 是强区分断言，能钉住窗口缩水；U8 能钉住小预算零轮询，两者组合有效。
- 纯观察、有界、fail-safe 及归因零动未见本轮回归。
- bin/verdict.mjs、lib/replay-assert.mjs 和 run-history schema 的目标 diff 均为空。
- 当前只读环境导致金牌启动时 mkdtemp('/tmp/...') 报 EROFS，因此无法独立复跑；不据此否定所附门禁证据。
```

## 驱动员归档附注

- `A1` 修法 `codex` 核为正确（`loopStart` 下限后另起、条件窗独享全额 `budgetMs`、`waitedMs` 仍以 `t0` 计），`U2a`/`U8` 判为强断言有效——r1 核心修订获对家复核确认。
- 唯一新 finding 落在 `A2`：r1 收窄后的走时上界式仍自相矛盾（`25 × 4.75 ≈ 118.75s` 实已逼近 120s，且 `4.75s` 漏算末拍竞速溢出与非 settle 开销）。此为文档承诺的算术不自洽，`codex` 建议「只陈述线性关系、不承诺安全 intent 数」。与同轮 `pi`（定级 `MED`、同一 `A2` 走时上界式）收敛。
- 驱动员按护栏 #9 如实记档，不代评审者下判断。
