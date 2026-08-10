# 评审收据 · p9-created-workflow-cleanup-continuity-v3

## R1 双路 + R2 delta（并集修一轮闭合）

| 项 | 值 |
|---|---|
| 被审快照 | R1=`684be1d`；并集修 `a75f219`；R2 delta 只审 `684be1d→a75f219` 的三个修复 hunks |
| 实现家族 | Claude（本轮 Opus 5 执行，设计岔口由 Fable 5 会诊） |
| 评审环境 | ext4 浅克隆 `~/casey-review-20260810/casey`（与主树同哈希；`node_modules` 与 `loop-kit` 软链；`cases/` 属 gitignore 故五成员数据件另行补拷） |
| 评审方甲 | `grok-4.5` high（tmux 伪终端多轮、自跑探针）：R1 `CHANGES_REQUIRED` → R2 `APPROVE` |
| 评审方乙 | `pi.dev` `deepseek` high（默认配置入口、`-p` 带工具、`--exclude-tools edit,write`）：R1 `CHANGES_REQUIRED` → R2 `APPROVE` |
| `codex` | 无额度，本轮未发起（不探测、不回退，如实挂账） |
| 结论 | **R1 全部 finding 闭合，双路 R2 均 APPROVE，零未决** |

## 本轮特殊性

`lib/` 与 `bin/` 一字未改。改动全在用例数据件、tier2 清单与四个 `loop/prd-*.json`，
故评审面是**判断链的正确性与诚实性**而非代码质量。评审提示词据此改写（见
`REVIEW-PROMPT.md`），六道题全部要求评审方自跑探针、不采信实现者叙述。

## R1 finding 与处置（并集）

| # | 提出方 | 等级 | finding | 处置 |
|---|---|---|---|---|
| 1 | 双方 | Critical / High | 提交不自洽：`684be1d` 提交了带 catalog 新哈希的 tier2 清单，而 catalog 自身 `loop/prd-tc_catalog_wf_crud.json` 的冻结值更新是 08-08 未提交的用户资产，git 历史里「清单说新值、PRD 说旧值」，干净克隆树据此跑出漂移红 | 经 Steven 2026-08-10 授权补提该 PRD（diff 仅三行：两个冻结值 + 一条预执行权威件登记，全属 08-08 签署与铸权产物，无夹带）。R2 复核：`CHECKSUM_MISMATCH` 归零 |
| 2 | grok | Medium | `checksumAmendment` 分项计数错：`reason` 记 `tc_wf_history_version` 三件（实为其 B8 改版重签前的中途快照数），分项加总 16 与声称的 18 不符 | 按新旧清单逐成员实测订正为 `0/3/5/5/5 = 18` 刷新、`0/0/3/3/3 = 9` 新增，逐成员计数写进 `verification`，并标注是评审逮出 |
| 3 | pi | High | `learn.md` 称 `assert.textHidden`「属 mutation 效应」不准确——它根本不在 `ATOM_ADMISSION_FACETS` 注册表（`entity-semantic-lock-preflight.mjs:79`），落到 `UNREGISTERED_ATOM_FACETS`（`:102`）的保守默认才是要求绑定的真因；`assert.buttonState` 与 `workflow.closeDrawer` 同样未登记 | `learn.md` 订正表述，并新增第三笔欠账：assert 类原子准入三面登记不全，**补登记须与清理本轮所加绑定同车做**，否则补登记会反过来拒掉这些绑定 |
| 4 | 双方 | Medium | 「正向覆盖改由 `tc_wf_history_version` 承担」说过头：两例不同用例不同 flow，套件层覆盖替不了本例 | `learn.md` 订正；R2 另指出 pending 旁车与草案仍留旧表述，已追加订正标注（保留原文不抹，只在其后声明撤回与理由） |

### 判定分歧一处（如实记录，未强行统一）

`assert.textHidden` 携带 `entityBindings` 一事：pi 判 High（语义归类错误），grok 判无问题
（按现行注册表判据是正确的）。实测两者不矛盾——**现行代码行为下绑定确实必需**（grok 对），
**而底下的注册表缺登记是真债**（pi 对）。收据按此双记，欠账已登记。

### 评审环境造成的假 finding（已澄清，不计入）

- 克隆树 `runs/` 与 `cases/` 属 gitignore，`amendment` 引用的 gzip 存档与部分成员数据件初次
  未拷入，导致 R1 一度报「存档不存在」「`readSuiteManifest` checksumOk false」——补件后
  两项均转正常（`checksumOk: true` / 5 成员）。
- R2 中克隆树 `ratchet verify` 仍 RED 8 问题，但 `CHECKSUM_MISMATCH: 0`、8 条全为
  `runs/` 下的 `FILE_MISSING`，属环境不全。主树实测 `ratchet verify GREEN -- 184 PRD /
  786 冻结文件 / 0 问题`、exit 0。
- 评审方在克隆树自跑 gate 会回写 `passes`，pi 正确识别该变更不属提交差异。

## 主树验证（实测退出码）

- `gate --prd loop/prd-p9-created-workflow-cleanup-continuity-v3.json` → `GREEN 5/5`、exit 0
  （并集修后复跑仍绿；复跑产生的 evidence 时间戳噪音已 `git checkout` 还原）。
- `ratchet verify` → `GREEN -- 184 PRD / 786 冻结文件 / 0 问题`、exit 0。
- 三例 `readCreatedWorkflowOwnershipAuthority` 五源字节自检 → 全 `ok`、audience production。

## 工艺记事

- grok 用 tmux 伪终端多轮 + 简报写文件 + 纯 ASCII 短令引用，规避长中文消息楔死输入部件的既知坑。
- 看门狗判完成的判据两次踩坑：提示词里写了 `REVIEW-DONE` / `DELTA-DONE`，守候脚本 grep 该串
  会被提示词回显触发假阳性。可用判据是「结论词连写」或「pane 无 `Responding…`/`Thinking…` 的空闲态」。
