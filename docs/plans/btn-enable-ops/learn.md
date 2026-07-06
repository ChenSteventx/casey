# btn-enable-ops — learn（full，codex 两轮 R2 PASS）

上下文：buttonState enabled/disabled 双 op 挂账拆先行收口（词表/采集/评估/草拟四面 + 夹具场景 +
wf-publish-states 金牌三钉点生命周期翻转 + 共享夹具双 prd 重签）。

## 1. 挂账死锁要拆载体：op 实现与 flow 本体不是一体

「enabled/disabled 随 publish_blocked 带实现回归」把 op 实现绑死在被 R9 卡真机的维度上——审计
点破后拆开：op 的词表/采集/评估/草拟纯 hermetic，真机只欠一个 profile 类名值（适配口先留好）。
挂账登记时就该问「这笔账的最小可独立兑现单元是什么」，绑大载体等于给账上锁。

## 2. 判据类挂账的解法 = 缺省标准判据 + 通道剖面适配口

「真机形态未采样」不必阻塞实现：缺省走 web 标准（disabled 属性 ∨ aria-disabled）、真机特有形态
（Heren 类名）走 profile 可选口（disabledClass 镜像 extraSelector 先例）——采样后填配置零内核改动。
与 noErrorToast 词表判（G1 人签）同族：判据显式签核 + 开口显式钉死（不配类名按可用计，金牌钉）。

## 3. 边界比较的方向性是 fail-open 温床：`<=` 挡不住 NaN

`if (hits <= 0) return 不判真` 对 NaN 走不进（NaN<=0 为假）——下一行 dis===0 就 fail-open 判 enabled
真。同函数早有先例安全形态（present 用 `hits > 0` 正向判真，NaN 天然落假）。教训：fail-safe 分支
用「正向判真、其余全否」，绝不用「反向排除、剩下判真」；证据数值一律非负整数闸。

## 4. 「会抛错所以安全」要实测：contains 对坏 token 返回 false 不抛

预想 classList.contains 对含空白 token 抛错→缺采集（fail-safe）；实测返回 false 不抛→类名判据
静默失效、enabled 方向 fail-open——比评审员标的 Low 更重。钉红实测让定性升级。DOM API 的异常
行为（TokenList 系 contains 不验 token、add/remove 才验）不能凭直觉。

## 5. 生命周期翻转的红实证要逐钉点对账

冻结金牌翻转三钉点，红先行跑出 2 红——第三处（U3）因缺采集语义仍然合法通过，翻转时顺手加的
两向断言没有独立红实证，被评审员点名。对账法：加法断言的可证伪性指认到新金牌红基线的同语义
败因。更干净的做法是翻转前把每个钉点的预期红/仍绿先列成清单（kinds-harden GRILL G2 先例）。

## 挂账（不静默丢）

- 真机 disabled 类名采样 → 填 `profile.buttons.disabledClass`（route:human，随下次真机行程）；
- `aria-disabled` 大小写/空白扩判（codex R2 非阻塞）随真机采样一并定；
- publish_blocked flow 本体（真正消费 enabled/disabled 的用例）整维度 R9 route:human。
