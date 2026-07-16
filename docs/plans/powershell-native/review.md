# PowerShell 原生支持终审

## 审查结论

- 日期：2026-07-16
- 范围：`3a29333..971b09b`
- 审查器：WSL 原生 Claude Code 2.1.211，`opus`，`high`
- 权限：只读源码与 `git diff/show/status/log`；禁止编辑、测试、启动进程和访问 SUT
- 结论：`PASS — no unresolved Critical/High/Medium findings`

## 已核问题

1. 代理任一子进程死亡、状态损坏和身份不匹配均 fail-closed；只有两个记录都能可靠停止或确认不存在时才删除状态并报告停止。
2. 进程身份核验与终止使用同一 `Process` 对象，并以启动时间和完整命令行双重约束，未发现 PID 复用误杀路径。
3. Windows 系统 helper 只收闭合白名单，要求 canonical 本地绝对系统目录、`SystemRoot` / `WINDIR` 一致、`System32` containment，拒绝重解析与逃逸。
4. 账户 ACL 重建为受保护的当前用户、SYSTEM、Administrators 三主体 FullControl 闭集；探针拒绝任何其它 Allow 主体。
5. HTTP/1.1 改写器拒绝 TE/CL 歧义、非单一 chunked、obs-fold、冲突 Content-Length 和敏感 trailer；按 chunk size / data / CRLF / trailer 精确解析并设头部、行、正文上限。
6. 五个追加金牌与 PRD 哈希逐项一致；真实 SUT 未验证标记保持诚实，不属于缺陷。

## 非阻塞 Low

- 状态文件损坏且代理仍存活时会拒绝自动恢复，需人工带外处置。这是无法证明进程所有权时不盲杀的有意 fail-closed 取舍。
- ACL 探针验证保护位、Allow 闭集和当前用户 FullControl，但未单独断言对象 owner；终审判断残余风险很低，不构成本轮阻塞项。

## 独立门禁证据

统一串行 gate 于 2026-07-16 完成：8 个冻结文件 ratchet 全匹配，S1 四条、S2 五条全部退出码 0，结果 `GREEN — story 2/2`。门禁只运行静态、纯函数、临时目录与 Windows 本机进程生命周期检查，未启动、连接或回放任何 SUT。
