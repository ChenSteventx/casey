# review-provider-inline-auth-hook 实施计划

## 1. 目标

把 Steven 已裁定的 Grok/pi.dev 内联认证规则做成每轮自动注入的 Casey hook，并给 Codex 等不执行 Claude hook
的 agent 提供同义仓库入口规则，阻止“到公开位置找 key → 误报工具不可用”的重复故障。

## 2. 改动面

1. `bin/review-provider-context-hook.mjs`：零输入依赖，恒定输出 `UserPromptSubmit.additionalContext`；exit 0。
2. `.claude/settings.json`：在现有 `UserPromptSubmit` 下追加该 hook，不替换 loop triage。
3. `AGENTS.md`：内核纪律增加等价供应方规则，明确 Codex 不做认证探测。
4. `tests/_golden/review-provider-inline-auth-hook.zero-sut.golden.mjs`：spawn 新 hook + 静态接线/禁探测检查。
5. `loop/prd-review-provider-inline-auth-hook.json`：冻结上述测试与规则面。
6. 修正本 session 在 `ratchet-security-revocation/review/` 中产生的两处错误诊断：保留实际裸 CLI 输出，但明确
   根因是调用入口错误，不再声称 pi.dev 不可用。

## 3. 验收点

- A1：三类合法 JSON 输入均 exit 0、stdout 是唯一合法 JSON，hookEventName 精确为 `UserPromptSubmit`。
- A2：additionalContext 包含 D2 五条语义，且不含任何疑似凭据值。
- A3：空/坏 JSON 输入仍返回相同上下文并 exit 0；stderr 为空；源码不 import fs/child_process/network，
  不读 stdin/env/用户目录配置。
- A4：settings 保留原 triage 并只新增一个 provider hook；AGENTS 规则与 hook 核心句一致。
- A5：新 golden RED→GREEN、checksum freeze、gate GREEN；`node --check`、term-lint、tier1、diff-check 通过。

## 4. 红绿顺序

先写 golden 并实跑，预期因 hook 文件/接线/AGENTS 规则缺失而 RED；冻结 checksum 后才进入实现。随后只改计划
列出的三面，复跑到 GREEN。该测试 zero-SUT，不启动浏览器、服务、网络或任何评审模型。

## 5. 评审与签署

这是 hook 强制上下文改动，实施后用 Grok 或 pi.dev 的已配置入口做只读实现审；不使用 Claude Code。测试
checksum 与后续任何因修订产生的新冻结 hash 都列给 Steven 精确签认。
