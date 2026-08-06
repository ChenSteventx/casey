# plan · wf-open-preface-notes（light）

## 背景

B4 八跑停在 `workflow.open` absent 谜面：前奏行为不可观测（compile-report 只有终局
resolution），时间账推断指向「create 后第二次整页加载偶发长时间空壳」但缺现场证据。
notes 已实证会进 exit-65 报告（八跑报告均含 notes）——诊断入 notes 即一跑取证。

## 修法（纯诊断，零行为差）

`compileWorkflowOpen` 加两条 notes（只读采样，不参与任何判定）：

- 前奏诊断：三候选结局（container/loose/branch/searched）+ 采样数 + 耗时 +
  页面态计数（正文长度/卡片数/输入框数——`evaluate` 一次，失败记「采样异常」）；
- 锚定诊断：预算授予与否 + 命中与否 + 采样数 + 耗时。

## 验收

金牌三钉：S1 搜索路径诊断钉（notes 齐全、字段如实、事件序 3 不变、零阻断）；
S2 全缺席诊断钉（如实记全缺席 + 行为零差：1 absent 点击、零 fill、<20s 封顶、零阻断）；
S3 结构钉（前奏诊断在就绪锚之前、锚定诊断在锚定段之后、两采样计数器在场）。
红基线 3/3 红实抓；突变闭环；邻接（open 搜索先行 + post-nav 冻结金牌 + term-lint + tier1）。

## 非目标

不动任何判定/预算/事件面；诊断文案避开「就绪锚/容器归属闸/搜索先行」等结构钉界标词。
