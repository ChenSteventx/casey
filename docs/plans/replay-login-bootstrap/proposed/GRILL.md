# GRILL — replay-login-bootstrap（light，单分岔）

## G1 登录墙方案（人签）

- 分岔：`compile --verify` 与相 3 真机回放撞登录墙，两案——A `bin/replay.mjs` 加 opt-in 登录预备动作（复用 `lib/login-bootstrap.mjs`，不产 event、不进 axes、凭据只进内存）；B storageState 移交（compile 期存登录态、replay 加载，回放省 1.7s 但登录态落盘多一份凭据形态文件、会话过期需重采）。
- 人签：**取 A**（Steven，2026-07-02，AskUserQuestion 可点选项）。理由：CONTEXT.md 已登记「登录预备动作：回放/编译开始前」——领域语言本就预留回放侧；护栏 #7 凭据不落盘更干净；跨时重跑不怕会话过期。
- 附带机械决策（随 A 走，不另开分岔）：
  - 旗标名 `--login-bootstrap`，纯 opt-in，缺省行为零差（p5 冻结 golden 即证）；
  - 凭据前置加载失败 exit 65（与坏输入同码，fail-closed）；
  - 登录入口 = `--sut` + site.json `target.startUrl` 路径段（真机五雷之一的既有教训，同 compile 执行段）；
  - `loadCreds` 加 `AT_CREDS_FILE` env 覆盖（与 `AT_SITE_JSON` 同范式）——hermetic 测试凭据源隔离所需（否则测试会读真 `.auth/` 填进假 SUT，红线）。
