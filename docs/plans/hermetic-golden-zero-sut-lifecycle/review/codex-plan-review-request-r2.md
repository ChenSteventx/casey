# codex 异构评审请求 R2 — hermetic-golden-zero-sut-lifecycle plan v2

你（gpt-5.6-sol high）R1 逼出 7 条阻断 findings（`review/codex-plan-review-reply.md`），Claude 已按条修 plan 成 v2（`plan.md`，顶部 v2 说明标注逐条修法）。本轮复审：**逐条核 v2 是否充分消解 R1 的 7 条，有无残留缺口或新引入的问题**。同样对抗式标准、不确定判需补证。

## 只读这些 + 核其引用

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（v2 主审）
- `review/codex-plan-review-reply.md`（你的 R1 七条，对照）
- 允许只读访问仓核验（不改文件）：`tests/_golden/**`、`loop/prd-*.json`、`bin/verdict.mjs`、`lib/entity-semantic-lock-preflight.mjs`。

## 逐条复核（R1 findings → v2 修法）

1. **F1 冗余高估（Critical）**：v2 撤 flow-bridge 作 events 基线、compile→events 全记真机 UAT-pending；引入「混合金牌」概念（kinds-harden/btn-enable-ops 前半 zero-SUT 须拆存活、非整文件墓碑）。核：混合拆分工序是否真能防删有效 zero-SUT 覆盖？还有没有别的混合金牌 v2 没点名？
2. **F2 meta-golden 未闭合（High）**：v2 加闭集数量硬断 + tombstone sha 核 + 规范模板（无 import/fs/child_process）+ accept 突变电池（删体/删marker/改exit/篡archive/加能力/删收据项+体对/收据多少一条）。核：突变电池是否覆盖你 R1 担心的「同删收据项+墓碑体」漏过？强度是否达先例 `observation-unsafe-golden-revocation.zero-sut.golden.mjs`？
3. **F3 D2 不足（High）**：v2 改机读闭集逐子测试矩阵（原check→输入→断言→successor→状态，无 successor 阻断墓碑）+ 点名扩 p2-verdict 补 `verdict.mjs:94` CASE_DEFECT 缺口分支。核：矩阵形态是否足以防静默丢覆盖？CASE_DEFECT 补法对不对？
4. **F4 output-seal（Medium）**：v2 定位真假绿在 B5 `workflow.create` 被准入 mutation 抢跑，改 `nav.workflowManagement` 只读 + 保原因断言 + 哨兵不存在。核：这个原因级修法对不对？
5. **F5 真机后继 vaporware（High）**：v2 加冻结「真机 UAT manifest」（每 case 唯一ID/源/archive sha/前置/NL步骤/预期证据/不变量/owner/passes:false），矩阵每「→真机」行指 manifest 真实 case。核：manifest 作为冻结 artifact 是否足以防永久 vaporware？
6. **F6 p5 双处置（High）**：v2 改 story 级——s1 保 false/superseded、**s2 纯覆盖保活体 true 绝不翻**、drift/vanished 案级吊销、8 存活案进 UAT manifest 新 PRD（不拿墓碑当 acceptance、不拿 p2-verdict 冒充 replay 保真）。核：这条链是否无循环无假红？「只翻墓碑 story」是否已推广到所有混合/多 story prd？
7. **F7 清点（Medium）**：v2 加静态依赖闭包扫描器（fixture import + node:http/net listener + browser launch + 子进程 + --sut 数据流，严格等于冻结闭集），订正 26→以扫描器为准。核：扫描器判据是否覆盖 `replay-video` 自建 listener 这类；是否够严。

## 产出

逐条判（已消解 / 仍残留 / 新引入问题）+ file:line。总判：**v2 是否可进 accept**，还是仍有阻断项。若仍有，按严重度列 + 具体修法。诚实划界你没核到的。
