# handoff-profile —— session-handoff 取料配置（Casey）

> 供 `/session-handoff` skill 读取的项目专属配置。项目出新决策/新坑时更新本文件
> 对应节，不改 skill 本身。各节标题名照 skill 约定，勿改名。

## 一句话定位

Casey（测易）——LLM 驱动「文本用例→测试报告」确定性可回放测试系统；autotester
（人录·机回放·零 LLM）的「翻面」：输入端改 LLM，但「确定性是默认、LLM 是手术刀、
完成是退出码、裁判零 LLM」的内核一字不让。交接动作边界：只写 `docs/NEXT-SESSION.md`
与 `docs/HANDOFF.md` 两个 md + 落库，不碰实现代码、不碰用户未提交资产。

## 必读顺序

1. `CLAUDE.md` + `CONTEXT.md`（统一语言注册表，命名以它为准；弃用别名列是黑名单）
2. `docs/HANDOFF.md`（覆盖层倒序堆叠：最新覆盖层=权威现状，历史层仅溯源）
3. `loop/GUARDRAILS.md`（19 条逐条有效）
4. `.claude/skills/casey/SKILL.md`、`README.md`
5. `docs/adr/`（0001–0010）、`docs/design/txt2testreport-design.md`

冲突时：实际 `git` 与 `loop/active-contract.json` > HANDOFF 顶层 > NEXT-SESSION >
其余文档。另注意：`docs/codex/` 下有一套 codex 专用交接（属 lcodex session，主文档
`docs/codex/HANDOFF.md`），刷新根部交接时应一并核查它是否滞后并同车刷新。

## 取料指引

- 项目史/现状+未提交现场：`docs/HANDOFF.md` 只读顶部两个覆盖层（全文 2000+ 行勿
  通读）；`git log --oneline -25`；`git status --short` + 逐文件 diff 定性——gate
  回写的 `evidence` 时间戳刷新是噪音，主树未提交多为登记过的用户资产，须逐项与
  HANDOFF 登记行比对而不是当成忘提交。
- 排期/里程碑/下一步：`docs/plans/bootstrap/plan.md`（P0–P10 定义）+
  `docs/REQUIREMENTS-STATUS.md`（看清快照日期，常滞后于 HANDOFF 两周以上）+
  HANDOFF 顶层「下一步」+ `ls -lt docs/plans/` 最近活跃目录 +
  `loop/active-contract.json`（活契约槽）。
- 领域知识/统一语言：`CONTEXT.md`（双限界上下文，四列表）。
- 约束/兜底：`loop/GUARDRAILS.md` + `CLAUDE.md` 硬规则节 +
  `docs/runbooks/review-model-budget.md`。

## 领域词汇

不重复 `CONTEXT.md`，只列开场词必带骨架；详表与弃用别名黑名单一律查注册表，
开场词里不抄黑名单词条（写出来会触 term-lint 拦截）。

- 七相：归一→编译→冻结人签→回放→裁定→自愈→报告（LLM 只在相 0/1/2/5）。
- `TestCase` 聚合根；`intentId` 语义步 / `stepId` 回放事件位置；三轴 = 动作 +
  typed 断言 + 取证；四态 = `PASS` / `SUT_DEFECT` / `HARNESS_ERROR` / `NEEDS_HUMAN`。
- 同名异义高发（接手首日最易误解）：「冻结」两义（断言契约冻结=人签+checksum ≠
  promptset 幂等冻结）；verdict 出四态 ≠ gate 写二值 `passes`；「剖面」两义
  （loop-kit 执行剖面 ≠ 通道剖面）。

## 开发准则

- 阶段互锁：动手前 `contract init` 声明入口分流；`passes` 只由 `gate.mjs` 写；
  冻结件改动走 checksumAmendment + 人签。
- 突变闭环是钉力判据；全仓金牌单侧串行扫；判绿只信退出码（124 是超时须单跑复核）。
- 评审对不可变快照（先 commit 再派审）；异构评审家族≠实现家族；额度纪律见
  `docs/runbooks/review-model-budget.md`。
- 护栏 #17（裁判对断言种类不可知）与 #19（强制层改动必复跑受影响 browser-replay
  金牌、tier1 绿不含回放层）在 CLAUDE.md 未列，交接开场词必须单独点名。

## 硬约束

开场词必须原样带上，不许漏、不许软化：

裁判零 LLM；fail-safe 不 fail-open；冻结测试只读；凭据与真实目标地址不外泄
（`.auth/`、`site.json` 不读不显）；中文标准简体；新概念先查 `CONTEXT.md`；完成
只认真实退出码、真机证据与 Steven 人签；不把桩、文件存在、静态绿或模型印象冒充
完成；不 push、不 merge 未经授权；主树用户未提交资产勿动、勿 `git add -A`。

## 环境坑

滚动详单以 `docs/NEXT-SESSION.md` 开场词【环境坑】节为准（随事件更新），此处只列
恒定骨架：

- WSL 会整机挂死、D 盘（drvfs）会静默停摆：判死活先 `uptime` 看实例新旧；commit
  早提勤提；评审走 ext4 克隆；重要产物落 `~/casey-recovery-20260807/`。
- `/mnt/d` git 慢给足 300 秒；短超时空输出别误判成干净工作树。
- 真机前重启隧道两端；杀隧道按 pid 档案纯数字 kill，绝不模式杀（同名脚本共存）。
- 禁止启动 fake-SUT；金牌只跑 zero-SUT / static / 纯内存。
- grok 评审 tmux 伪终端多轮（第二条长中文消息会楔死输入部件，简报写文件 + 纯
  ASCII 短令）；pi 用默认配置入口。
