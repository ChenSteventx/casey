# loop-kit-extract 实现审记录（r2 第七次跑，`codex`）

## 评审元数据

- 评审对象：`loop-kit-extract` 契约 round-2 第六次跑发现（1 `MED`，审计记录准确性问题）处置后的
  复核。评审料：`docs/plans/loop-kit-extract/review/material-impl-r8.md`。本轮评审时 Casey 树相对
  commit `7349441` 的未提交改动仅限评审记录文件文本（`codex-impl-r6.md` 修订 + 新增
  `material-impl-r7.md`/`pi-impl-r7.md`/`codex-impl-r7.md`）与 `prd` `evidence` 时间戳刷新；包仓
  `/mnt/d/ctx/heren/loop-kit` HEAD 仍为 `ea5ed85`（本轮无包仓改动）。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `codex`（评审家族≠实现家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s
  read-only -m gpt-5.6-sol -c model_reasoning_effort=medium -`，评审料经 stdin 喂入，`codex-cli
  0.144.1`。
- 评审指令本轮要求：核对第六次跑 `MED`（`codex-impl-r6.md` 处置记录自述与实际改动范围不一致）是否
  已妥善处置、本轮改动是否严格限于该一份评审记录文件的文本、是否有新问题或对既往闭合项的破坏。

## 结论

`CHANGES REQUIRED`——发现 1 项 `MED`（对上一轮处置的完整性补充，非新代码缺陷）。

## MED

**处置记录仍未完整记录冻结哈希连带更新**（`docs/plans/loop-kit-extract/review/codex-impl-r6.md:61`）

`codex-impl-r6.md` 已正确补入包仓 `root.mjs` 注释修改及提交 `ea5ed85`，但「修复涉及……」一句当时
仍只列 Casey 侧 `plan.md`/`GRILL.md`/`prd` 三处纯文档变更与包仓 `root.mjs` 一行注释交叉引用，没有
记录 `codex-impl-r7.md` 已明确指出的连带变更：Casey 侧期望存档副本
`tests/fixtures/loop-kit-expected/package/lib/root.mjs`、`loop-kit/kit-lock.json`、以及 `prd` 中对应
两条 `testChecksums`。第六次跑的 `MED` 只完成了主体更正，审计范围仍不完整。

复现：

```
git show --name-status 7349441
sed -n '52,70p' docs/plans/loop-kit-extract/review/codex-impl-r6.md
```

建议在「运行时逻辑函数体零字节改动」之后补一句连带更新说明（期望存档副本 + `kit-lock.json` + 两条
`testChecksums`）与两侧提交号（包仓 `ea5ed85` / Casey 侧 `7349441`）。

## 已确认闭合

- 本轮处置 diff 本身仅修改 `codex-impl-r6.md`；`prd` 仅有已披露的 5 个 `evidence` 时间戳刷新，无
  `passes`/`testChecksums`/`observability` 实质内容变化。
- 包仓干净，HEAD 为 `ea5ed85`，无运行时代码进一步变化。
- 冻结文件实际哈希与两条 `testChecksums` 匹配。
- `selftest --tier1` GREEN；语法检查、`diff --check`、术语注册表检查通过。
- Test Ratchet 仍仅有材料所述两项既有 `FILE_MISSING`，与本契约无关。
- 完整金牌本轮沙箱因 `/tmp` `EROFS` 只跑至 37/73，其余项目均为沙箱写入受限阻断，未观察到行为断言
  失败。

## 处置与去向

本记录发现的 `MED` 已由实现方（Claude）当场处置（同一工作会话内）：在 `codex-impl-r6.md`「处置与
去向」一节「运行时逻辑函数体零字节改动」之后，补一句连带更新说明——包仓 `root.mjs` 字节变化 →
Casey 侧期望存档副本同步复制为逐字节一致 → `loop-kit/kit-lock.json`（全包清单 sha256）随之改变 →
`prd` 中对应两条 `testChecksums` 同步更新，并明确写出两侧提交号（包仓 `ea5ed85`、Casey 侧
`7349441`）。修复涉及同一份评审记录文件的进一步纯文本补充，不涉及 `plan.md`/`GRILL.md`/`prd`/任何
代码字节的改动。处置完成后需再跑一轮 `codex` + `pi` 双路复核确认收口。
