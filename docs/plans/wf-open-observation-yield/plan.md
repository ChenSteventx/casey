# plan · wf-open-observation-yield（light）

## 背景与根因（B4 十二跑诊断实证）

十二跑删除搜索修达阵后，链路停在 C3 破坏性目标连续性守卫：「同名观察多条
（`atl_b4r120807j`）→ 不取 first、不武装 ref」。根因是读回门契约引入的 open source
观察与 create subject 观察在重表达后的单流（create→open→delete）里并存——C3 守卫
（同名多条拒绝二选一）与 wiring 金牌 H1i（多身份原子同流 issuer fail-closed）双面
钉死该形态，结构性 fail-closed。守卫与 H1i 均无缺陷，不动。

岔口 Steven 2026-08-07 裁甲案：open 观察让位。

## 修法（open 归档让位；双证照跑；冻结面零接触）

只动 `compileWorkflowOpen` 声明身份通道分支的观察归档一处
（`lib/compile-atoms-workflow-nav.mjs`，读回门契约新代码）：

1. 点击前双证（扫描 + 物理双锚 + `resolveDualIdentity` + 过门才点 + TOCTOU 句柄内
   点击）**原样保留**——验证价值一分不少；
2. 归档判据：click 成功后，若 `run.identityObservations` 已含**同 platformId** 行
   （create 侧 created-in-run subject 观察），则**跳过**设置
   `run.pendingIdentityObservation`，改记 notes
   「workflow.open 观察让位：同 flow 已有同 platformId 身份观察，source 行不再归档」；
3. 无同 platformId 行（open 独跑/打开既有工作流）→ 照旧归档 source 观察，零回归。

下游收益（十三跑预期）：连续性 ref 由 create 观察唯一铸造；issuer 单原子（create）
走 wiring H1b/H1h 已钉通道；成品段不再落 H1i 面。

## 验收（金牌红先行）

新金牌 `wf-open-observation-yield.zero-sut.golden.mjs`（mock 页驱真实 `compileFlow`，
零 SUT；`run.identityObservations` 预置行模拟「create 已归档」的流中态）：

- S1 让位钉：预置同 platformId subject 观察 + open 流 → 归档面**仍恰一行**（create 的），
  open 不新增行、pending 清空、让位 notes 在场；click 照发（双证照跑：journal 扫描先于
  卡内点击）；
- S2 独跑零回归钉：零预置 + open 流 → open 的 source 观察照旧归档全档
  （matched 三元组 + evidenceStepId=click 步 + provenance join + sourcePath）；
- S3 不同 platformId 不让位钉：预置**异** platformId 行 + open 流 → open 观察照常归档
  （共两行）——让位判据是同 platformId，不是「有任何观察就让」；
- S4 双证不缩水钉：让位场景下扫描/卡锚/判定表照跑（journal 序 + identityGateOutcome
  unique），双证拒路径（平台零行）仍 fail-closed 不点。

红基线实抓（现实现 S1 必红——open 无条件归档致两行；S2/S4 绿、S3 绿）；突变闭环
`git show` 姿势；全仓金牌双态扫描（基线 `b6880e3`）——既存红须基线同码；readback
契约金牌（open 独跑场景）保持 20/20。

真机兑现（完成闸，ADR-0009）：合入 dev 后 B4 十三跑（新 `atl_` 长名令牌）——预期
create→open→详情断言→删除→删后归零**全链首过**；跑完记全链路总耗时。

## 非目标

- 不动 C3 守卫 `armDestructiveTargetContinuity`（同名多条拒绝语义是其正确性）；
- 不动 `deriveObservationIssuerAtom`/H1i 纯函数与 wiring 金牌；
- 不动 create 侧 `readCreatedWorkflowIdentity`；
- 不动点击前双证任何一环；
- 不动任何冻结件（零 checksumAmendment、零人签回签）。
