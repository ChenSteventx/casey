# S2 异构复核：Grok TUI

- 日期：2026-07-27
- 范围：`zero-shot-observe-admit-step`
- 方式：项目既定 Grok TUI 入口，`plan` 权限模式；只读代码、计划、冻结测试与
  checksum，执行纯内存探针
- 排除：浏览器、SUT、网络、凭据、真实目标地址
- 最终裁定：`PASS`

## 已核验事实

1. `intentPlan`、step contract、observation、resolution/proposal、admission 与 receipt
   的进程内 authority 能拒绝 clone、spread、JSON 往返和跨 observation 拼接。
2. known atom dominance 同时检查 supplied plan 与默认 recipe 生成的 `defaultPlan`；
   custom recipes 不能把默认 known atom 偷退成 primitive。
3. proposal 与 admission 使用同一 read-safe 窄闭集；只有明确只读语义的
   `role:link` 可进入执行候选，未知或风险语义 fail-closed。
4. admission 与 execute 均重验 observation freshness 和物理节点；并发、过期
   observation、DOM replacement 与 page topology 变化不能铸成功 receipt。
5. public observation 对 title、pathname 与 semantic name 做敏感信息清洗，
   public JSON 不携带 driver、handle、原始 URL 或敏感哈希。
6. Playwright driver 对 role exact locator、隐藏重复计数、handle 释放与
   popup/new-page/原页关闭进行 fail-closed 处理。
7. 冻结 checksum、PRD 故事命令、红证与当前实现一致；模块尺寸和无环约束满足
   本 slug 的验收合同。

## 独立探针裁定

### 过期 observation 仍可铸 proposal

现象成立，但不是动作绕过。过期 proposal 在 admission 前返回
`STALE_OBSERVATION`；若 admission 后才产生新 observation，execute 仍返回
`STALE_OBSERVATION`。两条路径 `performed=0`，不产 action receipt。

该问题登记为产物洁净度债：未来可让 proposal builder 同时接收
`observationAuthority`，在铸造前拒绝注定不可消费的 proposal。

### 非 `resolved` resolution

`route:human`、`proposal-required` 与 `blocked` 产物均不能通过 admission，
全部 `performed=0`。现实现没有执行缺口。

防未来漂移建议：admission 显式检查 validated resolution 的
`status === "resolved"`，避免未来给非 resolved 产物增加字段时意外扩大准入。

### 非空 model proposal

无关 intent 的坏 model proposal 不阻断当前真正零 recipe 的 intent，属于逐 intent
准入语义；当前 intent 自身带 proposal、known override 或非
`MODEL_PROPOSAL_MISSING` unresolved reason 时仍会被拒绝。若改成 TestCase
全局 `modelProposalsEmpty`，会让无关坏 intent 阻断可独立探索的 intent，因此本轮
不采纳全局门。

### identity admission 可省略

S2 只允许 `click + read` 且最终动作目标必须命中 read-safe 窄闭集；普通只读页面
导航不要求实体身份，`identityAdmission.required:true` 时仍稳定返回
`ENTITY_IDENTITY_PENDING` 且零动作。未来扩展 mutation/relation/destructive
前，必须由冻结 policy 派生 identity requirement，不能依赖 caller 自觉传参。

## 非阻塞后继债

1. label/text exact revalidation 的 hidden 语义与 role 路径统一；
2. resolver 铸 resolution 时也要求 builder-issued observation，收紧中间产物洁净度；
3. 合并重复的 canonical JSON/deep-freeze helper；
4. capability sealing 稳定后再拆 admission/execution/receipt，避免提前扩大
   handle/driver 暴露面；
5. 目标级人工 confirmation authority、entity identity 自动派生和
   page-topology/auth-continuity 由后继 slug 完成；
6. 真实 SUT/UAT 不属于本次 zero-SUT 合同，不能写进本次完成声明。

## 结论

本轮未发现可越过 admission/execute 并产生动作或成功 receipt 的 Critical/High
问题。上述中间产物与结构问题均已按真实严重度登记，不把后继债冒充现役执行漏洞，
也不把 zero-SUT 结果冒充真实页面验收。
