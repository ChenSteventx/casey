# 真实 0 error 用例现状

本页不作为普通用户操作面。普通用户只说自然语言，例如：“帮我跑历史版本用例，出测试报告。”

0 error 定义：`verdictSummary.SUT_DEFECT === 0`、`HARNESS_ERROR === 0`、`NEEDS_HUMAN === 0`，并且报告内每个步骤 `verdict` 都是 `PASS`。

2026-07-08 现场复跑结论：

- `tc_wf_history_version`：当前真实环境复跑 0 error，报告在 `runs/tc_wf_history_version/run_live_20260708_0812_history/`。
- `tc_catalog_wf_crud`：历史报告曾 0 error，但 2026-07-08 现场复跑为 `PASS=2 / NEEDS_HUMAN=2`，不能作为当前 0 error 示例。
- `tc_wf_publish_states`：历史报告曾 0 error，但 2026-07-08 现场复跑为 `PASS=2 / SUT_DEFECT=1 / NEEDS_HUMAN=1`，不能作为当前 0 error 示例。

## 前置条件

1. 在 WSL 仓根执行命令。
2. 反向隧道已通：WSL 侧 `127.0.0.1:15519` 可返回 HTTP 状态。
3. `.auth/credentials.json` 已由维护者带外确认是唯一许用账号；不要在命令行、日志或文档里回显凭据。
4. `--sut` 只使用本地基址 `http://127.0.0.1:15519`，不要把真实目标地址写进命令行。

## 当前可用：`tc_wf_history_version`

自然语言入口：

> 帮我跑历史版本用例，出测试报告。

代理内部执行回放、裁定、报告生成和 0 error 校验，只把报告链接和四态摘要返回给用户。

已有现场证据：`runs/tc_wf_history_version/run_live_20260708_0812_history/tc_wf_history_version.report.json`，`PASS=8 / SUT_DEFECT=0 / HARNESS_ERROR=0 / NEEDS_HUMAN=0`。

## 历史绿但当前不可承诺 0 error：`tc_catalog_wf_crud`

覆盖：工作流列表进入、创建、保存/详情、删除清理。

```bash
RUN_ID=run_manual_catalog_$(date +%Y%m%d_%H%M%S)
node bin/casey.mjs run tc_catalog_wf_crud \
  --sut http://127.0.0.1:15519 \
  --events cases/tc_catalog_wf_crud/events.json \
  --expected cases/tc_catalog_wf_crud/expected.frozen.json \
  --profile cases/tc_catalog_wf_crud/profile.json \
  --observed cases/tc_catalog_wf_crud/observed-tc_catalog_wf_crud.json \
  --case-meta cases/tc_catalog_wf_crud/testcase.json \
  --run-dir runs/tc_catalog_wf_crud/$RUN_ID \
  --login-bootstrap
node scripts/verify-zero-error-report.mjs runs/tc_catalog_wf_crud/$RUN_ID/tc_catalog_wf_crud.report.json
```

历史证据：`runs/tc_catalog_wf_crud/run_1783008079114/tc_catalog_wf_crud.report.json`，`PASS=4 / SUT_DEFECT=0 / HARNESS_ERROR=0 / NEEDS_HUMAN=0`。

当前状态：2026-07-08 现场复跑 `runs/tc_catalog_wf_crud/run_live_20260708_0809_catalog/tc_catalog_wf_crud.report.json` 为 `PASS=2 / NEEDS_HUMAN=2`。

## 历史绿但当前不可承诺 0 error：`tc_wf_publish_states`

覆盖：工作流创建后未发布/已发布按钮态、发布动作、删除清理。

```bash
RUN_ID=run_manual_publish_$(date +%Y%m%d_%H%M%S)
node bin/casey.mjs run tc_wf_publish_states \
  --sut http://127.0.0.1:15519 \
  --events cases/tc_wf_publish_states/events.json \
  --expected cases/tc_wf_publish_states/expected.frozen.json \
  --profile cases/tc_wf_publish_states/profile.json \
  --observed cases/tc_wf_publish_states/observed-tc_wf_publish_states.json \
  --case-meta cases/tc_wf_publish_states/testcase.json \
  --run-dir runs/tc_wf_publish_states/$RUN_ID \
  --login-bootstrap
node scripts/verify-zero-error-report.mjs runs/tc_wf_publish_states/$RUN_ID/tc_wf_publish_states.report.json
```

历史证据：`runs/tc_wf_publish_states/run_1783383813396/tc_wf_publish_states.report.json`，`PASS=4 / SUT_DEFECT=0 / HARNESS_ERROR=0 / NEEDS_HUMAN=0`。

当前状态：2026-07-08 现场复跑 `runs/tc_wf_publish_states/run_live_20260708_0811_publish/tc_wf_publish_states.report.json` 为 `PASS=2 / SUT_DEFECT=1 / NEEDS_HUMAN=1`。
