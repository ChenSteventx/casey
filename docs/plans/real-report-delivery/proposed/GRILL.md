# real-report-delivery GRILL

- 范围：只改报告模型、渲染与聚合目录，不改相3回放或相4裁定。
- 自然语言：`testcase.json` 的 `preconditions[]` 与 `intents[].text` 零 LLM 合成；显式 `naturalLanguage` 优先。
- 附件：单例 HTML 显示同 run 的 HTML/MD/JSON、`verdict.json`、`axes.json`、`run-history.jsonl`、`run-metrics.json`、`video.json`、`video.webm` 直接链接。
- 视觉复核：可选 `visual-review.json` 投影为 `visualReview`；状态只允许 `CONSISTENT / INCONSISTENT / INDETERMINATE`，固定 `verdictImpact: none`，不得改四态裁定。缺失时 HTML 明示待复核。
- 聚合：每行直接链接对应子目录的单例 HTML；相对路径逐段白名单，非法 fail-closed。
- 禁止：不得启动、连接或回放 fake/fixture SUT；本包只做静态、schema 与纯函数验证。
