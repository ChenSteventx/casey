# run-convention learn

时间：2026-07-09

## 做了什么

- `casey run <caseId> --sut <本地基址>` 现在会在缺文件旗标时按 `cases/<caseId>/` 约定解析：
  - `events.json`
  - `expected.frozen.json`
  - `profile.json`
  - `observed-<caseId>.json`
  - `testcase.json`
- 显式旗标恒赢；全显式调用保持兼容。
- 必填件缺失或 `--sut` 缺失仍 `exit 64`，并点名缺件；可选 `observed`/`case-meta` 缺失不拦，但 stderr 明示报告降级。
- `lib/paths.mjs` 的 `casePaths` 字段对齐真实布局，移除误述的 `spec`/`report`/`verdict`，新增 `expected`/`profile`/`caseMeta`。
- `AT_CASES_DIR` 作为 hermetic 测试接缝：绝对值保持绝对路径；相对值固定按 `PROJECT_ROOT` 解析，避免调用者 cwd 漂移。

## review 后补修

- DeepSeek R1 找到真 HIGH：`caseId` 可经 `../` 或路径分隔符穿越 `casePaths(caseId)`。
  - 新增 `isSafeCaseId` / `assertSafeCaseId`。
  - `caseDir` / `casePaths` 自身防御。
  - `runPipeline` 在约定探测前把不安全 `caseId` 转成 `exit 64`，不再输出 `cases/../...`。
  - 金牌 A8 先红后绿。
- DeepSeek R2 找到 MED：相对 `AT_CASES_DIR` 基于 cwd 解析会让测试接缝漂移。
  - 改为 `path.resolve(PROJECT_ROOT, process.env.AT_CASES_DIR)`。
  - 金牌 A7 加 `chdir(tmp)` + 相对 env 断言，先红后绿。
- DeepSeek R3 最终 PASS；剩余均为 LOW/挂账：
  - 显式 `--events`/`--expected` 等任意路径读取属于既有 CLI 权限模型，非本契约目标。
  - `caseId` 禁 `..` 子串偏严格，但符合单段目录名安全边界。

## 验证

- `node tests/_golden/run-convention.golden.mjs` -> `9 过 / 0 败`
- `node loop-kit/bin/gate.mjs --prd loop/prd-run-convention.json` -> GREEN, story `1/1`
- `node tests/_golden/e2e-chain.golden.mjs` -> `8 过 / 0 败`
- `timeout 180s node tests/_golden/cli-mcp-face.golden.mjs` -> `7 过 / 0 败`

## 给 cc 的说明

本轮落的是 `run-convention` light 契约：把 `casey run` 从一长串文件旗标缩成 `caseId + --sut`，文件输入走 `cases/<caseId>/` 约定布局。过程中按 contract 走了 grill/plan/accept/loop/review/learn；DeepSeek review 抓出并修掉了 `caseId` 路径穿越和相对 `AT_CASES_DIR` cwd 漂移两个问题。最终 gate、run-convention 金牌、`e2e-chain`、`cli-mcp-face` 都绿。`deepseek-v4-pro` 在 WSL pi 里当前最小 prompt 也超时，所以 review 实际用的是 `deepseek-v4-flash`，这点已写进 audit。

## 挂账

- 真机侧用约定布局跑通仍是 route:human，需要隧道、凭据和 Steven 在场。
- `--sut` 从 `site.json`/`devProxyUrl` 自动反解被本契约明确 waived；若要做，另起凭据边界契约。
- `deepseek-v4-pro` 当前请求超时；后续服务恢复后可补一轮 pro 复审，但本轮已有 DeepSeek flash 三轮评审和本地门禁证据。
