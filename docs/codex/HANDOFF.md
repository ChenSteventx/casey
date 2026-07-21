# `Codex` 交接——Casey 当前状态

> 本文件是 Casey 的 `Codex` 当前状态主文档。根部 `docs/HANDOFF.md` 与 `docs/NEXT-SESSION.md` 属于 Claude Code，只读参考；冲突时按「实际 `git` 与活契约 > 本文件 > `docs/codex/NEXT-SESSION.md` > 根部交接」处理。

最后核对：2026-07-21，工作目录 `/mnt/d/ctx/heren/casey`，分支 `dev`，本轮起点 `1207776`。

## 当前工作目标

- `checksum-drift-closure` 已完成：两处普通 checksum 漂移经零 SUT 回归、Steven 精确人签与 owner gate 收口。
- `review-provider-inline-auth-hook` 已完成：Casey hook 与 `AGENTS.md` 固定注入 Grok/pi.dev 内联认证纪律，阻止再次从公开位置寻找凭据或用裸 CLI 误判供应方不可用。
- 下一条主线是恢复 `ratchet-security-revocation` 的设计复审；它仍是设计期工作，尚未进入 plan、验收或实现。

## 已完成事项及验证证据

### checksum 漂移收口

- Steven 已签认两个完整当前 SHA256，留痕在 `docs/plans/checksum-drift-closure/HUMAN-SIGN.md`。
- 新零 SUT 验收 6/6 GREEN；现役删除静态金牌 12/12 GREEN。
- 新契约、`prd-seams-freeze`、`prd-delete-confirm-causal-binding` 三个 gate 均 GREEN 1/1。
- 全仓 ratchet 只剩两个已知安全撤销墓碑 mismatch；这是预期 RED，不冒充全绿。
- Grok 与 pi.dev 双路只读实现评审 PASS，未使用 Claude Code。

### 评审供应方上下文 hook

- `bin/review-provider-context-hook.mjs` 恒定输出 `UserPromptSubmit.additionalContext`，不读 stdin、文件、env，不触网、不起子进程。
- `.claude/settings.json` 保留原 loop triage，并追加唯一 provider hook；`AGENTS.md` 为 Codex 写入同义硬规则。
- 核心纪律：Grok/pi.dev 已配置且认证由调用链内联；禁止搜索、读取、推断或回显账号、密码、token、API key；禁止裸 CLI 预检；真实任务失败才按实际输出记 `HARNESS_ERROR`；Claude Code 当前不探测、不调用、不回退。
- Grok R1 指出 golden 未真实启动生产 CLI；修复后 R2 PASS。默认验收 6/6 GREEN，缺 hook 红控 2/6、exit 1。
- 最终 golden SHA256 已由 Steven 批准，见 `docs/plans/review-provider-inline-auth-hook/HUMAN-SIGN.md`。
- gate GREEN 1/1、`selftest --tier1` GREEN、契约 `grill/plan/accept/loop/review/learn` 全 done，`contract check` 返回 `allow:true`。

## 未完成事项

### `ratchet-security-revocation`

- `docs/plans/ratchet-security-revocation/GRILL.md` 是 kernel 级 full 契约的设计草案，目标是把严格闭合的安全撤销从普通 mismatch 提升为具名 `SECURITY_REVOKED`，不重签墓碑、不执行旧 unsafe body。
- Grok R1 已提出设计问题并已据此修订 GRILL；现有 `review/grok-design-r2-harness.md` 只记录调用入口/会话取消，不是有效 R2 裁定。
- pi.dev 之前的裸入口尝试无效，只说明走错入口；不得据此写供应方不可用。下一轮必须直接走已配置 Grok/pi.dev 调用入口完成 R2 设计复核。
- R2 通过后仍需 Steven 对 D4「历史 successor 绿 + 当前 closure 绿」双层定义明确签认，之后才可写 plan、验收测试或修改兄弟 `loop-kit`。
- 实现需要兄弟 `loop-kit` 写权限、双消费者影响面复验、异构实现审 round-2 和最终精确人签；当前均未发生。

## 已知风险与阻塞

- 活契约当前仍是已完成的 `review-provider-inline-auth-hook`；恢复 ratchet 前先核对 `loop/active-contract.json`，不要覆盖或重写现有 GRILL。
- `ratchet-security-revocation` 会触碰强制层和兄弟包，必须保持 full/kernel 纪律；未获兄弟仓写权限时只做只读设计复审。
- 全仓 ratchet 当前预期 exit 1 且恰有两个安全撤销 mismatch；不能把该预期红当普通漏签，也不能用重签墓碑洗绿。
- fake/fixture SUT 只读；本任务无需也不得启动浏览器、网络或 SUT。
- Grok/pi.dev 认证内联，不做认证探测；Claude Code 当前无额度，不调用。

## 当前 `git` 与活契约状态

- 分支：`dev`；本轮起点：`1207776`。接手时以最新 `git log -1` 为准。
- 活契约：`review-provider-inline-auth-hook`，full，六阶段全 done。
- 本轮提交范围应包含：checksum 漂移收口、provider hook、ratchet 设计草案与两轮说明、两份 `docs/codex/` 交接文档。
- 以下既有或非本轮完成态现场必须保留，不修改、覆盖、删除或提交：
  - `M .gitignore`
  - `M docs/HANDOFF.md`
  - `M docs/NEXT-SESSION.md`
  - `M loop/prd-cli-authority-wiring-fill.json`
  - `M loop/prd-observation-runtime-trust-root.json`
  - `M loop/prd-selftest.json`
  - `M loop/prd-semantic-unit-discrimination.json`
  - `?? casey-agent-loop-local-first-total.zip`
  - `?? docs/atom-readiness-assessment-20260715.md`
  - `?? docs/plans/regress-strategy/SCOPE-OPTIONS.md`
  - `?? docs/plans/usability-audit/`
  - `?? follow.mjs`

## 下一接手者必须知道的环境情况

- 环境为 WSL/DrvFs；目录操作偶发 sharing-violation，只对已确认安全目标做有界重试。
- `loop-kit` 是 Casey 的兄弟独立仓；修改它需要单独写权限并同步 Casey 期望存档、`kit-lock` 与冻结 checksum。
- Grok/pi.dev 的账号、密码、token、API key 均不得寻找、读取、推断、回显或要求用户提供；项目已配置入口自行处理认证。
- 凭据、真实目标地址、原始 shell 环境和大段 transcript 不得进入输出、日志、文档或提交。

## 明确下一步、验收条件与停止条件

1. 只读核对最新 `HEAD`、`git status --short`、`loop/active-contract.json` 和本文件。
2. 只读复核 `ratchet-security-revocation/GRILL.md` 与 `review/grok-design-r1.md`，通过已配置 Grok 或 pi.dev 入口取得有效 R2 设计结论；取消、超时或只有过程输出均记 `HARNESS_ERROR`，不算 PASS。
3. 若 R2 有 finding，先修 GRILL 并聚焦复审；若 R2 PASS，把 D4 双层定义完整交 Steven 签认。
4. 只有 R2 PASS + Steven 签 D4 后，才恢复/初始化该 slug 的 full 契约并进入 plan、acceptance-gate 与实现。

验收条件：有效异构 R2 PASS；D4 人签留痕；后续 plan 与验收对严格闭合、只读 ratchet、普通 mismatch 兼容、双消费者影响面和冻结重签链都有可执行约束。停止条件：设计评审无有效终局、D4 未签、兄弟仓权限缺失、发现需要执行 unsafe body/fake-SUT、或任何方案会重签墓碑/改 owner `passes:false`。
