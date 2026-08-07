# 评审任务 · wf-delete-search-filter R1（异构只读评审）

你是异构评审方（实现家族=Claude，独立复核，不采信实现者结论）。本工作树只读评审：
可自由读文件、跑金牌与 git 命令取证；**不得**修改工作树文件（红证复现用
`git show <rev>:<file> > /tmp/...` 姿势，绝不写暂存区）；**不得**启动 SUT/浏览器真机流量；
**不得**读取 `.auth/`、`site.json` 或任何凭据与真实目标地址。

## 快照与基线

- 候选快照：本仓 HEAD `5d059a8`（分支 `wf-delete-search-filter`）。审前核 `git diff HEAD` 空。
- 基线：dev `ef81f78`。评审差异集 = `git diff ef81f78..5d059a8`。
- 文件白名单（差异全集）：`lib/compile-atoms-workflow-crud.mjs`（唯一实现变更，
  `compileWorkflowDelete` 内两处）、`tests/_golden/wf-delete-search-filter.zero-sut.golden.mjs`、
  `loop/prd-wf-delete-search-filter.json`、`docs/plans/wf-delete-search-filter/`。
- 背景事实源（只读参照）：`tests/_golden/post-nav-anchor-wait.zero-sut.golden.mjs`
  （三 PRD 冻结、S2 包含式钉 fill/press——本契约「实现让路」的约束方）、
  `lib/compile-atoms-workflow-nav.mjs` 的 open 前奏（seam-1 注释与放大镜先例 `:103-106`）、
  `lib/compile-atoms-support.mjs` 的 `auditDeleteCount`（计数门语义 `:285-299`）。

## 变更主旨（事实陈述）

B4 十一跑：open 首次真机走通后，删除链停在计数门「布局=unknown、容器=null」。根因：
搜索隔离走 fill+Enter，seam-1 真机已证当前被测方 Enter 不过滤、放大镜才过滤；未过滤列表
缺目标卡，门如实截断（门无缺陷）。修法（Steven 裁 atom 级封套 + grill 确认）：搜索隔离处
press Enter 惰性保留（真机 11 跑证无副作用；冻结金牌 post-nav S2 包含式要求 press 在场，
实现让路零冻结面变更）+ 放大镜 click 真过滤必在其后 + 过滤后 15s 有界就绪锚（真 acted 才
授预算、目标入容器即放行、预算耗尽不改判）；删后重搜第二处 Enter→放大镜（无冻结覆盖）。

## 风险清单（逐条给结论）

1. 冻结面合规：post-nav-anchor-wait 金牌字节零变更且在本快照下自跑绿；其余全部
   `testChecksums` 冻结件零触碰。
2. fail-closed 保持：计数门 unknown 截断/零破坏 click/compileFlow 中止语义逐字保持；
   锚预算耗尽不改判（锚只等、不判）。
3. 惰性 Enter 的风险面：press 在 click 前，若未来被测方版本 Enter 恢复过滤，双触发
   （Enter 过滤 + 放大镜再过滤同词）是否有害？（同词幂等性论证或指出反例。）
4. 锚的预算语义：仅 `unique && acted` 才授 15s；图标缺席（absent）快速通过零行为差；
   与 open 前奏/`post-nav` 家族先例的预算不叠加原则一致性。
5. 删后重搜第二处：Enter 退役是否破坏任何消费方（下游「删后归零」断言的取数、
   回放侧事件形状先例）。
6. 金牌质量与红证：S1-S4 断言强度（含 S1c 序钉、S1d 恰一处 key:Enter 结构钉）；
   红证（7 红）对最终金牌字节在原实现（`git show ef81f78:`）下可复现；PRD 三条 sha256 自算。
7. 邻接：`wf-crud-sleep-import`、`wf-open-search-first`、`wf-open-readback-requery`、
   `entity-workflow-source-readback.wiring`、`p9-created-workflow-continuity-v3.created-in-run`
   自跑核绿；两个门面拆分族既存红（`arming.static`、`searchopen`）基线同码未更红。

## 已有证据（可复核，不必采信）

- 验收金牌 16/16 绿；gate GREEN 2/2；被钉冻结金牌 post-nav 复绿；
- 全仓 296 金牌双态扫描零回归（基线 `ef81f78`；异码项均已定性为主树残件污染或
  工作树缺未跟踪产物的环境项，与本变更无关）；
- 金牌 v2→v3 修订如实记在 PRD notes（首版全退役 Enter 与冻结面冲突，实现让路）。

## 输出格式（严格遵守）

- 逐条 finding：`[Critical|High|Medium] 文件:行 —— 一句话缺陷 + 失败场景 + 证据`；首轮只报 C/H/M。
- 风险清单逐条给结论（过/不过/存疑+为什么）。
- 末行单独一行：`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。
