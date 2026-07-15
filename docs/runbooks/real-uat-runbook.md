# 真实环境 UAT runbook

本 runbook 只允许连接真实 SUT。仓内若存在历史 fake-SUT 或 fixture，其源码只可阅读，不得启动、连接、回放或用作通过证据。

## 1. 开始前的三道门

1. `npm run verify:install` 全部通过；它只证明本机安装，不证明真实环境可用。
2. 维护者已带外准备 `site.json` 与 `.auth/credentials.json`，并确认使用专用测试账户、无真实患者或生产敏感数据。不得回显这些文件的值。
3. 真实网络链已建立。Windows + WSL2 按“WSL 监听端先启动、Windows 网络代理后连接”的顺序启动反向隧道。

然后执行 `node bin/casey.mjs doctor`。逐项检查本机、凭据形状和回环端口；不要只看进程退出码。

## 2. 连通性必须有两段证据

- Windows 网络侧到真实目标返回成功 HTTP 状态；
- WSL 内通过 `site.json.target.devProxyUrl` 的回环地址到同一真实目标返回成功 HTTP 状态。

只有端口监听、无真实 HTTP 返回，不算连通。真目标地址只存在 `site.json` 内，不得写进命令行、日志或报告；CLI 的 `--sut` 只接收回环基址。

## 3. 正式 web 测试是二段式交付

第一段 `run` 在真实 SUT 上完成确定性回放，生成 `axes.json`、`verdict.json`、同次 `video.webm`、报告草稿和 `run-binding.json`。这一段必须以“视觉复核尚缺、正式交付未完成”收口，不能直接宣布 GREEN。

代理实际观看该 run 的录像和必要帧，写入绑定录像与裁定 SHA-256 的视觉复核。第二段 `finalize-run` 不接受 `--sut`、不重放，只校验同 run 摘要、录像完整性、裁定与视觉证据并重建报告。

只有以下条件全部满足才可称 `FORMAL_DELIVERY GREEN`：

- 每步确定性裁定均为 `PASS`；
- `SUT_DEFECT`、`HARNESS_ERROR`、`NEEDS_HUMAN` 均为 0；
- 同次录像完整；
- 视觉复核为 `CONSISTENT`；
- 清理型用例的清理后断言成立，且专用前缀残留为 0。

视觉复核固定不改变 `verdict.mjs` 的四态裁定。看不清或证据不足应写 `INDETERMINATE`，正式交付保持未完成。

## 4. 每个用例的报告要求

每个用例独立生成一个 HTML，至少包含：

1. 已签测试用例的自然语言描述；
2. 分解后的动作与断言原子；
3. 同次真实回放录屏；
4. HTML、Markdown、JSON、裁定、三轴、回放历史、运行指标和视频元数据等附件。

聚合页只能做索引，不能代替单用例报告。报告与附件不得包含真实目标 origin、凭据、Cookie 或敏感业务数据。

## 5. 失败与人工示教

- 网络、代理、登录或安全会话未就绪：停止行为测试，先修环境。
- 有取证背书的 `SUT_DEFECT`：保留缺陷，不转录制掩盖失败。
- 真实网络和安全会话就绪，但自动映射失败或已确证 `HARNESS_ERROR`：可转人工示教。
- 歧义、破坏性操作、非专用账户或敏感数据风险：停止并等待人工确认。

示教采集只是语料，不是正式 PASS。它仍须入账、蒸馏、归一、真机编译、断言草拟、人签和正式回放。学习原子还需同一次真实全 PASS、录像与 provenance 证据，并经过显式签署和显式晋升。

## 6. CEF 边界

医生站 / Hi 小助的 CEF 通道要求远程调试、回环原始 TCP 中继、唯一 page target、专用测试账户且无真实患者数据。当前公开版只承诺单 page 的示教和机械回放代码；机械收据固定 `formalVerdictEligible=false`，不等于正式测试 PASS。原生控件、跨窗口、iframe 或 CEF/原生混合流程未完成真实现场验收。
