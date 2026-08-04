# R4 终审报告：wf-delete-card-layout（7b9e40a）

评审纪律遵守：零仓库改动（git status 仅未跟踪 node_modules 软链）、变异全部在 /tmp 副本、只信退出码、零 SUT/浏览器/网络面。完整通读 plan.md / GRILL.md / PRD / 全量 `lib/workflow-delete-domain.mjs` / 金牌 25 钉 / 红证 / R2·R3 评审输入 / shape-probe 证据。

## 审点 1：pi R3 Medium（重渲染换节点洗绿）是否干净闭合 —— 是

**反例变体全覆盖**（对 `visibleDeleteMenuResidual` + `settle` 逐路径推演 + 实跑）：
- **同拍换节点**：Escape 后 `authorizedMenuDomains` 验原句柄缺席，紧接着 `visibleDeleteMenuResidual` 扫「可见、菜单域形状、含可见精确『删除』项」残留，重渲染同形菜单命中 → `failed`（R24 实跑绿）。
- **多菜单残留**：判据对 `menuDomains` 返回的**每个**域逐个 `evaluate`，任一命中即 `failed`，无「只查第一个」缝。
- **读取抛错**：`menuDomains` 抛错 → settle 外层 catch → `failed`；单域 `evaluate` 抛错 → 函数抛 → 同 catch → `failed`。证不出一律 failed，无吞错路径。

**真只读**：`menuDomains`→`outermostOnly`→`uniquePhysical`→残差 evaluate 全链只读（`getComputedStyle`/`getBoundingClientRect`/`querySelectorAll`/`textContent`/`isConnected`），**零 `setAttribute`/`removeAttribute`/`clearPin`/键盘/悬停/点击**；不 export、不给残留菜单打 pin。**无越权收拾缝**：settle 唯一的交互动作是恰一次 Escape，只按所有权内 `sameNode` 过滤自身菜单句柄，任何代码路径都不触碰非所有权菜单（R25 断言的 `preexistingPopup.isConnected` 实跑保持 true）。

## 审点 2：新钉钉力 —— 双向实证成立

- **/tmp 突变**：删掉 `settle` 内残差判据调用（退回只验原句柄缺席）→ **恰 R24/R25 双红、23/25、exit 1**，输出逐字符匹配红证；还原后 sha256 `474b33af…` **逐字节全同**，复跑 25/25 exit 0。
- **红证真实性**：另用 `git show ced9fcf:lib/workflow-delete-domain.mjs`（0 处 `visibleDeleteMenuResidual`）对当前金牌字节实跑 → 同款 23/25、R24/R25 恰红、`EXIT=1`，红证内容非编造。
- **夹具忠实度**：R24 的 `__onKey` 建模 pi R3 反例的**同拍**形状（Escape 拍内 detach 旧节点 + 重建同形四项菜单，新物理节点）——正是反例的断言域；R25 建模「SUT 只关自己的菜单、合法保留基线旧菜单」形状。两钉断言无迎合：期望值由判据语义导出（证不出闭合必须 failed），负控断言（恰一次 Escape、预存菜单原样、零请求）与实现路径逐条对得上。

## 审点 3：全量计划审 —— 自洽，与既有裁定无冲突

§3.2b 的 `'closed'` 定义（原句柄缺席 **且** 无可见删除项菜单残留）与实现逐字一致；`'failed'` 四条件（按键抛错/重扫异常/菜单仍在/残差命中）一致；「未取得所有权、成功路径不出现该字段」一致。边界代价（基线旧菜单保守 `failed`）诚实申报并由 R25 钉住。`menuCleanup` 不参与 resolution：实现以 `{ ...result, menuCleanup }` 仅加法字段；下游白名单实证——`compile-atoms-run.mjs:155-158` 只取 `resolution`/`candidateCount`/`identityReadback`，`replay/history.mjs:32` 只由 `resolution` 派生 `locatorResolution`，冻结 `run-history.schema.json` 无泄漏路径。

## 审点 4：全量实现审（含此前各轮抽查复核）—— 全部成立

- **接管点仅 none**：`lib/workflow-delete-domain.mjs:723` 逐字 `result.resolution === 'none' ?` 接管，unique/ambiguous/action_failed 全短路（R17/R18 钉）。
- **三道锁**：更多入口在卡片域内 pin+`rootStillLocked`×2+`actionStillLocked`（R4）；`waitForCausalMenu` 复用冻结 `classifyCausalDialog` + `sameNodeStrict` 物理身份，基线快照先于点击（R20）；菜单浮出后 `rescanStillUnique` 第三道锁（R19）。
- **因果菜单授权**：与确认弹层同一纯函数同一物理比较；无所有权时零 Escape 零 `menuCleanup`（R20/R22/R21 全绿）。
- **审计环不悬停不开菜单**：`inspectWorkflowDeleteTarget` 走 `mode:'more-presence'` 存在性计数，R10 实跑断言 0 悬停 0 点击。
- **确认环零改动**：全特性 diff（408883f..HEAD）无一行触碰 `inspectWorkflowDeleteConfirm`/`performWorkflowDeleteConfirm`/`['确定','确认']`。
- **pinExactAction 菜单档默认关**：`mode='text'` 默认，既有三调用点不传，仅卡片路径菜单取项传 `'menu'`（R5/R8 双向钉死）。
- **R16 投影棘轮**：独立 grep 复核 lib/bin 除所有者外零引用 `directDeleteButtons`/`menuDeleteEntries`。
- **C3**：零顶层 import；R1–R25 全路径推演无新洞；残差快照的 TOCTOU（检查后 SUT 再渲染）与菜单域形状限定均属既有契约边界内，方向一律 fail-closed，不成新 finding。

## 审点 5：账本 —— 逐项核对通过

- **testChecksums 五件**：实算 sha256 全部匹配 PRD（golden `a95a4b25…`、GRILL `7ee848b4…`、plan `24ea59fc…`、red `003e6001…`、red-r4 `43adbbc9…`）。
- **amendment #8**：commit 恰触声明的 3 件 + 实现 + PRD 本身；golden hunk 零删除纯加 37 行；plan.md 仅 2 处删除行均为被加严重写行的旧版本文本（§3.2b 定义、A15 行），无实质删减；断言零弱化零删除。
- **红证**：头 sha256 与当前金牌实算一致；输出与对 ced9fcf 实跑逐字符相符。

## 审点 6：回归（只信退出码）

`wf-delete-card-layout` 25/25 exit 0；`workflow-delete-causal-binding`、`checksum-drift-closure`、`p0-p2-report-delete`、`workflow-delete-spec-preflight`、`regress-agent-tool-actions`、`units/p3-compile-unit`、`agent-delete-zero-window`、`hermetic-golden-sut-census`、`hermetic-golden-prd-reverse-closure` 全 exit 0；`term-lint --registry`、`node --check`、`git diff --check` 全过。三枚历史基线红（p3-compile / real-run-trust / hermetic-golden-isolation-pending）未跑、不由本契约改写，符合纪律。

**Findings 清单**：无 Critical / High / Medium / Low。R2 的 shape-probe 缺席 Medium 已在 ced9fcf 补齐（证据文件存在且与实采事实一致）；pi R3 唯一 Medium 由 r4 干净闭合。

PLAN_VERDICT: APPROVE
IMPLEMENTATION_VERDICT: APPROVE
