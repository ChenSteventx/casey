# btn-enable-ops — grill 决策记录（full）

> 授权链：Steven 挂账明令「不许静默丢」（prd-wf-publish-states observability #2）+ 本次点单
> 「enabled/disabled 拆先行」+ D1 判据当场签核（AskUserQuestion，2026-07-07）。
> 载体 publish_blocked 整维度被 R9 坐标卡真机——op 实现按审计建议拆开 hermetic 先行，flow 归 route:human。

## D1 禁用判据（Steven 已签：标准判据 + profile 类名补判）

按钮「禁用」判定 = `disabled` 属性在场 ∨ `aria-disabled="true"` ∨（可选）命中
`profile.buttons.disabledClass` 类名。第三路是真机适配口：Heren div 假按钮若靠类名表禁用态，
真机采样后把类名填进通道剖面即可、零内核改动（镜像 `buttons.extraSelector` 先例，非凭据段）。
`disabledClass` 形状校验同 extraSelector：给了就须非空字符串，非法 fail-closed exit 65。

## D2 采集（代表步静默点，双通道同刻）

对断言涉及的按钮名，在既有 `buttonHits[name]`（命中计数）旁新增 `buttonDisabledHits[name]`
（命中且按 D1 判禁用的计数），双通道口径同 buttonHits（role 必采 + extraSelector 补采、可见性过滤同）；
任一通道采集失败 = 该名缺采集（不落 0）→ 评估证不出（镜像 buttonHits 纪律）。axes 投影加性字段，
不动既有字段（present/absent 行为字节级不变）。

## D3 评估（fail-safe 语义）

- `enabled` 判真 = `hits > 0 ∧ disabledHits === 0`（全部命中可用；混合态不判真）；
- `disabled` 判真 = `hits > 0 ∧ disabledHits === hits`（全部命中禁用）；
- 缺 `buttonDisabledHits` 采集 → 证不出 ok:false；`hits === 0` → 两 op 均不判真（按钮不在场谈不上状态）；
- `actual` 携 `hits=N,disabled=M` 复合标量（报告可核错，镜像 noErrorToast 全量证据回填先例）。
- 混合态证不出是承重语义：同名多钮状态不一时判真任何一边都是赌——fail-safe 方向（护栏 #14）。

## D4 词表 + 草拟翻转 + 冻结钉点翻转清单（红先行）

`check.mjs` `buttonState: ['present','absent','enabled','disabled']`（碰词表 = full 依据）；
schema enum **零动**（`assertionOp` 冻结时已留位 enabled/disabled，p4-drafter C0 反要求其在场）；
`assertion-draft.mjs` mapAtom：state enabled/disabled 由落 pending 翻为硬映射（IMPLEMENTED_KINDS 不变，
buttonState 本就已实现——本契约是 op 级加法）。
冻结金牌翻转（kinds-harden 生命周期翻转先例，逐条红先行 + prd 重签）：`wf-publish-states.golden.mjs`
三钉点——U2「enabled/disabled 拒」翻「过」；「遗留 op 证不出」翻语义评估；D 段「落 pending」翻硬映射。
`p2-check-vocab`/`kinds-harden`/`wf-history-version` 零动（已核无 enabled/disabled 行为钉点）。

## D5 夹具（加法场景，零动既有）

`publish-sut` 新增 scenario `disabledBtn`：编辑器页含 ① 真 `<button disabled>导出</button>`（属性路）
② `aria-disabled="true"` 钮（aria 路）③ div 假按钮带 `hr-button--disabled` 类（disabledClass 补判路，
配 profile.buttons.{extraSelector,disabledClass}）④ enabled 对照钮「保存」。既有四场景字节零动。
共享夹具纪律：checksum 冻在 prd-wf-publish-states 与 prd-wf-history-version 两家——改后两家 golden
全跑 + 双 prd 夹具 checksum 重签 + 双 gate 复验。

## D6 非目标

不建 publish_blocked flow/用例（R9 route:human）；不动 switchState 与其未实现范例地位；schema 零动；
不动 verdict/gate 冻结内核；不动 buttonHits 既有语义与 present/absent 行为（字节级回归锁）；
真机 disabled 类名采样与 profile 实填 route:human 挂账。
