# record-capture — learn（2026-07-08，full）

示教兜底第一步已落：`casey record` 能把人工操作或原始事件文件收成 `teach-in-capture.json`。该包只是蒸馏语料，不是签署物，也不是正式回放输入。

## 留存学习

1. 兜底入口必须显式降权。包内同时写死 `signed:false`、`replayReady:false`、`distillRequired:true`，CLI 文案也只说“蒸馏语料”，避免后续把录制物当成可执行契约。
2. `--from-events` 是验收和应急入口，不应静态依赖 Playwright。Playwright 只在真实浏览器录制路径动态加载，这样离线验收仍可跑。
3. 输出通道继续沿用 output-seal 纪律：成功日志不回显用户传入的 `--out-dir` 绝对路径，写包前先过 `credentialGate`，命中凭据关键词则拒写且不留半包。
4. URL 一律投影为 pathname + search。包正文和黄金测试都钉住不含 `://`，真目标地址不能进入可提交产物。

## 交到下一阶段的账

- 还需要正式异构评审。本轮 `loop/audit.jsonl` 是主代理静态审查记录，只为推进本地 full 契约，不替代外部审查。
- 还需要真机人工录制一次 route:human：确认反向隧道、唯一许用账户和登录 bootstrap 后，检查包内无凭据值、无真实目标地址、无签署假象。
- 下一契约应做 `record-intake` / `record-distill`：把示教录制包转成正式候选流程，但必须重新走 ingest/compile/draft/sign/run，不允许直通回放。
