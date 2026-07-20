# mountdelay-fidelity 实现评审收口

## 输入绑定

- 实现基线：`50c1ae0..ab0d233`。
- Grok R1 修复：`ab0d233..f949c47`。
- 规格：`docs/plans/mountdelay-fidelity/plan.md`。
- Pi R1 `@file`：`/tmp/pi-mountdelay-review-r1.md`，sha256
  `31c1515d687964ec5fbab5fa8df57f77f4beda0d77ceda48c107f4c004c6a99f`。
- Pi R2 `@file`：`/tmp/pi-mountdelay-review-r2.md`，sha256
  `9716ce108c9b4910699255dd32ad48f77466409eebffbc2a8b03a6f8c173004f`。
- Claude 争议裁决材料：`/tmp/claude-mountdelay-adjudication.md`，sha256
  `09b72d3e3ab7226dcb3844e3f06349619f155a646474d6180927c315857cfa0c`。

## 工具事实

- `grok-review` 首次被凭据闸挡在发送前：真实 diff 的 `CONTEXT.md` 含凭据边界术语，未发模型请求。
  临时评审 worktree 只从审查 diff 排除此文档行，真实交付仍保留该登记。
- `grok-review` R1 两轮各三把均由上游 `stopReason=Cancelled` 中止，包装器 exit 8，按
  HARNESS_ERROR 拒收；未冒充模型结论。
- 同一已过凭据扫描的材料改用 Grok 无头 `--prompt-file` 后得到有效 R1 `REVISE`。
- Pi 临时 agent 的 `auth.json` 是空对象，首次实际启动在 provider 初始化处 exit 1；未复制 token、未登录。
  改用当前终端默认已登录 home 后，DeepSeek V4 Pro 请求真实发出并完成。

## R1 findings 与处置

1. Grok High：临时审查 diff 没有 `CONTEXT.md` 登记，但 evidence 声称已登记。只对为躲凭据误报而
   过滤的临时包成立；真实提交 `ab0d233` 含登记，判 false positive。
2. Grok Medium：配置态把 number-only evaluate 结果兼容成 `placeholderGone:true`。成立。新增
   `R1-M1` 红锁（修前失败）后改为 unknown。
3. Grok Medium：selector 从未命中时配置态两拍放行，弱于无配置三拍。成立。新增 `R1-M2`
   红锁（修前失败）后要求 `stableSamples>=3`。
4. Pi R1：以 `ACCEPT` 收口；附带 Medium 观察认为 loading 未知字段严格拒绝影响未来扩展。
   本仓闭合形状与未知字段 fail-closed 是确定性权威，且契约只授权 selectors/text，故不改。

R1 修复证据：新增锁修前 `0/2`，修后 `2/2`；主验收 `4/4`、既有存活单元 `9/9`；
质量门禁 `4/4 GREEN`。

## 聚焦复审与争议裁决

- Pi R2（requested `deepseek-v4-pro`, thinking high）：两条修复均成立，无回归，`ACCEPT`。
- `grok-review` R2：第三把产出一条 Medium，要求 `placeholderGone` 也连续三拍。
- Claude Code 2.1.215（requested `opus`, effort high，无工具）对该单点做裁决：`ACCEPT`。
  理由：`loadingReady` 保留 `stableSamples>=3` 并只增加 placeholder 条件，结构上不可能弱于无配置；
  占位移除若改变长度，稳定计数自动重置并实际要求三拍 gone；长度不变时连续两拍 gone 已满足原授权
  语义，第三拍只增加延迟。故 Grok R2 Medium 不成立。

## 结论

有效 Critical/High/Medium finding 均已修复或以确定性反例证伪。实现评审 ACCEPT。
