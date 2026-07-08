# record-capture — plan（full）

示教兜底第一契约：新增 `casey record`，把人工操作采成安全录制包。决策见 `docs/plans/record-capture/proposed/GRILL.md`。

## 1. 术语登记

- `CONTEXT.md` 登记「示教」与「示教录制包」：录制物是蒸馏语料，不是签署物，不直通回放。

## 2. 纯函数层

- 新增 `lib/record-capture.mjs`：
  - `sanitizeRecordEvent`：事件只保留允许字段，URL 投影为 pathname + search，剥 host。
  - `buildTeachInCapture`：装配 `{schemaVersion, artifactKind, caseId, createdAt, startPath, source, events}`。
  - `captureOutputPath`：固定输出到 `<outDir>/<caseId>/record-capture/teach-in-capture.json`。
  - 输出前调用 `credentialGate`；命中则拒写。

## 3. CLI 层

- 新增 `bin/record.mjs`：
  - 用法：`node bin/casey.mjs record <caseId> --sut <baseUrl> --out-dir <dir> (--login-bootstrap|--no-login) [--from-events <file>] [--headless] [--max-ms <ms>]`。
  - 缺 caseId / sut / out-dir 或缺登录策略 exit 64。
  - `--from-events`：读取已有原始事件，装配安全包后落盘，供命令化验收与应急。
  - 无 `--from-events`：启动 Playwright，注入最小监听脚本，人工操作后关闭浏览器或到 `--max-ms` 收口；真机人工录制列 route:human。

## 4. casey 门面

- `bin/casey.mjs` 新增 `record` 分发与 help 行。
- 本契约不接 MCP / skill；那属于后续易用性契约，需同时补三条真实可跑用例。

## 5. 验收

- `node tests/_golden/record-capture.golden.mjs`
  - C1 help 暴露 `casey record`，用法错 exit 64。
  - C2 `--from-events` 对干净原始事件产安全包；包内 `signed:false`、`replayReady:false`、`distillRequired:true`；全文不含 `://`；输出路径固定。
  - C3 脏事件含凭据关键词时拒写，不能留下半包。
  - C4 包不含可被误当正式回放输入的 `events.json` / `expected.frozen.json` / prd 写入。
- `node bin/casey.mjs selftest --tier1` 无回归。

## 6. route:human

- 真机人工录制一次：先拉反向隧道，确认 `.auth/credentials.json` 已是唯一许用账户；用 `--login-bootstrap` 登录后人工录制，检查包内无凭据值、无真实目标地址、无签署假象。
