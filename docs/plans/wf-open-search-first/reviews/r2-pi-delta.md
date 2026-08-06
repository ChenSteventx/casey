## 增量复核结论（f417c3e→25943bb）

### ① 修复是否正确采纳且无新缺陷 —— 是

**pi Medium（openSearched 无条件置位）**：
- 新代码 `openSearched = iconClick.resolution === 'unique' && iconClick.acted === true;`，与 plan.md 修订措辞「图标点击真实动作（unique 且 acted）才给新预算 15s」逐字一致。
- 生产 `emit` 契约核验（`lib/compile-atoms-run.mjs:135`）：恒返回 `{stepId, resolution, candidateCount, acted}`，非 customAct 点击路径下 `count===1`+点击成功才 `acted=true`；absent/ambiguous/action_failed 均 false——并集判定语义正确，无 undefined 访问风险（golden 双桩同构返回同形状）。
- 附带改善：图标点击失败不再授第二次 15s，`(openTargetSeen || openSearched) ? +15000 : now` 下双缺席总额恒 ~15s 封顶不叠加。

**grok Medium（fieldLabel 假锚）**：
- `fieldLabel: '搜索'` 已删除，纯 `fallbackCss: '.hr-input__suffix .search-icon'`。`locatorFor` 对无 fieldLabel 的 spec 返回 null → `resolveTarget` 落 fallbackCss（`compile-atoms-support.mjs:48` 与 `compile-atoms-run.mjs` resolveTarget 逐行核验）。
- 「照 chat.sendAndWait 先例」属实：`lib/compile-atoms-agent.mjs:289` 的送出图标即纯 fallbackCss click、无 fieldLabel。
- 全库无 `fieldLabel: '搜索'` 残留；无任何 golden 钉旧 fieldLabel。

**PRD 一致性**：plan.md sha256=e95bfc39（与 prd 新校验和一致）、金牌 ef585c05 逐字节未动（"金牌字节零变"属实）、红证 9b9d121f 未动；notes 补记 r1 并集采纳，evidence 时间戳同步更新。

### ② 金牌与冻结金牌双绿 —— 是（实跑）

- `wf-open-search-first.zero-sut.golden.mjs`：**4/4 全过**（S1/S2/S3/S4，exit 0）
- `post-nav-anchor-wait.zero-sut.golden.mjs`（冻结于 d96d833，本次未触碰）：**5/5 全过**；其桩 emit 亦返回 `{resolution, acted}`，共享 `compileWorkflowOpen` 代码路径无契约断裂。

### 非阻断观察（不构成 CHANGES_REQUIRED）
金牌桩 emit 无 customAct 时恒返 unique/acted=true，故金牌本身无法区分 r1 前后实现（仅钉「搜索先行」特征）；r1 两条 Medium 的机制由生产 emit 契约 + plan 措辞承载，红证突变闭环针对的是功能前基线。属测试逼真度注记，非缺陷。

DELTA_VERDICT: APPROVE
