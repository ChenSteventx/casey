# Delta 复审简报（R2）——只审修复 hunks

被审范围：`684be1d` → `a75f219` 的 diff，已导出到 `../DELTA-684be1d-to-a75f219.diff`（74 行）。
仓内三个受影响文件已同步为修复后版本：`loop/prd-tc_catalog_wf_crud.json`、
`loop/prd-p9-tier2-live-smoke.json`、`docs/plans/p9-created-workflow-cleanup-continuity-v3/learn.md`，
以及 `cases/tier2-suite.manifest.json`。

**只核这三条修复是否闭合了你 R1 提的 finding，不要重新展开全量评审。**

## 修复一：提交自洽（对应你 R1 关于 catalog PRD 漂移 / ratchet 非绿的 finding）

R1 你在克隆树里跑出 `loop/prd-tc_catalog_wf_crud.json` 的 `expected.frozen.json` 与
`entity-locks.frozen.json` 双漂移。查明真因：那两个冻结值的更新是 2026-08-08 签署时写的、
一直未提交的工作树改动，而上一笔提交把带 catalog 新哈希的 tier2 清单提交了，于是 git 历史里
「清单说新值、PRD 说旧值」不自洽——克隆树只看得到已提交部分，所以必然报漂移。

处置：经决策人 2026-08-10 授权，把该 PRD 一并提交（diff 仅三行：两个冻结值 + 一条预执行
权威件登记，全是 08-08 签署与铸权产物，无其他内容）。

请核：① 补提后 git 历史是否自洽；② 该 diff 是否确实只含上述三行、没有夹带；
③ 在本树重跑 `node tests/_golden/support/prd-drift-scan.mjs` 与 `ratchet verify`，
报真实退出码。注意 `runs/` 与 `cases/` 属 gitignore，本克隆树的 `runs/` 仍缺件，
`runs/...execute-authority.json` 一类登记项在本树必然报 FILE_MISSING——那是评审环境不全，
不是仓库缺陷；请把这类与 CHECKSUM_MISMATCH 类分开计数。

主树侧实测供你对照（你可以不信，自己在本树能验的部分自己验）：
`gate --prd loop/prd-p9-created-workflow-cleanup-continuity-v3.json` → `GREEN 5/5`、exit 0；
`ratchet verify` → `GREEN -- 184 PRD / 786 冻结文件 / 0 问题`、exit 0。

## 修复二：amendment 分项计数订正（对应你 R1 第 4 题「history 三件」那条）

你逮出分项加总 16 与声称的 18 不符。已按新旧清单逐成员实测订正为
agent_id_readback 0 / chiefcomplaint 3 / catalog 5 / publish_states 5 / history_version 5
= 刷新 18、另新增 9。订正文字与逐成员计数分别写进 `loop/prd-p9-tier2-live-smoke.json`
末条 amendment 的 `reason` 与 `verification`，并标注了是评审逮出后订正。

请核：数字现在对不对得上；订正措辞有没有把「被逮出」写成主动发现之类的美化。

## 修复三：learn.md 两处表述订正

- 原写「`assert.textHidden` 属 mutation 效应」。订正为：它不在 `ATOM_ADMISSION_FACETS`
  注册表里，落到 `UNREGISTERED_ATOM_FACETS` 的保守默认才是真因；`assert.buttonState` 与
  `workflow.closeDrawer` 同样未登记。并据此新增第三笔欠账（assert 类原子准入三面登记不全，
  补登记须与清理本轮所加绑定同车做）。
- 原写「正向覆盖改由 history 承担」。订正为：两例不同用例不同 flow，history 的覆盖是套件层的、
  不能替 publish 站岗；publish 的正向覆盖确实丢失，靠 pending 留痕与重表达欠账兜着。

请核：这两处订正是否准确、是否还残留过头表述。

## 输出要求

只报「R1 finding 是否闭合」与「修复本身有无引入新问题」。不新开全量评审面。
末行给一行：`DELTA-DONE` 后跟 `APPROVE` 或 `CHANGES_REQUIRED`。
