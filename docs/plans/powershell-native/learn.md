# PowerShell 原生支持复盘

## 得到的机制

- 进程状态不能只分“有 / 无”；必须区分 `missing / invalid / valid`，进程所有权必须区分 `absent / mismatch / invalid / owned`，否则损坏状态会被当成陈旧状态而丢失恢复线索。
- “绝对路径调用系统工具”仍不够；还要约束系统根的 canonical 形状、一致性、containment 和重解析点。凭据 ACL 也必须验证闭合 Allow 白名单，而不是只删几个常见宽泛组。
- HTTP chunked 不能靠终止字节哨兵切包。代理必须按 chunk size、extension、data CRLF 和 trailer 建状态机，并在任何歧义处断连。
- 审查发现必须先变成能在旧实现上复现红的零 SUT 金牌，再改实现；本轮由此固定了 partial-death、state safety、framing、helper trust 和 ACL allowlist 五类回归。
- PowerShell 生命周期用固定端口，多个完整套件并发会互相干扰；功能开发可并行，最终门禁应串行执行并核对残留进程与端口。

## 仍未完成的边界

本轮证明了 Windows PowerShell 5.1 / PowerShell 7 的安装、配置、MCP、诊断和安全回环代理操作面；没有证明真实在线 SUT 的登录、HTTP、回放、裁定、录屏、视觉复核或单用例 HTML。因此 Windows 原生真实 SUT UAT 继续保持 `route:human`，不得用安装绿、端口绿或零 SUT gate 替代。

## 后续

发布后在真实目标、专用账户和联网前置齐备时，选择一条只读或有可靠清理保证的 AI 中台签署用例，按同一 run 收集确定性裁定、录屏、视觉复核、附件与独立 HTML；医生站 / Hi 小助继续保持自动登录未验证和 CEF 机械回放不具正式裁定资格的边界。
