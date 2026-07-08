# report-nl-atomic — learn（P7 报告首增量）

## 教训

1. **spec 超前于码先记账、再切增量落地**：`report-spec.md` §3 codex 加入的报告新需求本是文实不符——先进「目标态、尚未实现」对账表（errata）令文档诚实，再按增量切（本契约只落 naturalLanguage + atomicSteps）。每落一项，对账表对应条目收缩；绝不把「目标规格」当「现状」静默留在主体。

2. **加法碰冻结渲染核，靠「缺字段零行为差」护身**：新块只在 `'field' in model`（naturalLanguage）/ 非空数组（atomicSteps）时渲染。缺字段的旧模型/共享 fixture 字节不变——于是不必改共享 `report-model.fixture.json`，13 个 report 涟漪金牌（定向断言、非全量 deepEq）自动免疫，涟漪只剩 `report-model.schema.json` checksum 一处（碰双 prd：本契约 + seams-freeze，须双重签双照）。

3. **合成夹具必过装配器一致性门**：`assembleReportModel` 有 verdict⋈axes 复算一致门（护栏 #14/#15）——`axStep` 默认须带一条过断言 + `action.resolution:'unique'`，`expectedVerdict` 才复算 PASS 与 `vStep` 默认 PASS 一致，否则 INDETERMINATE 撞 PASS 抛错。镜像 `report-fidelity` 助手先例；红先行首跑就撞这门，非产品缺陷、是夹具与冻结门的对齐。

4. **codex 异构评审真揪缝（Claude 实现→codex 评）**：初判 FAIL 5 发现，4 采信 1 部分证伪——schema 漏 require `intentId`、空 `atomicSteps:[]` 渲空块、断言 describe 空输入吐 `undefined`、金牌 C-C「只查 schema 顶层声明存在、不验 item 形态=假信心」（F5 元教训：**声明存在 ≠ 形态正确**，冻结 schema 的金牌要验 required 集/type/additionalProperties/不入顶层 required）。F1「每步都要动作条」是 spec 误读（纯断言步合法不产动作条），但采纳其 D6 精神放宽守卫加占位。评审家族≠实现家族的价值再次实锤。

5. **describe 双层脱敏纪律**：atomicSteps.describe 源自已过 `projectPost` 脱敏的 postAssertions，装配时再过一层 `redactScalar`（护栏 #7 纵深）；动词/kind 缺失落「(动作)」「(断言)」安全占位，绝不吐 `undefined`、绝不吞已观测条目。
