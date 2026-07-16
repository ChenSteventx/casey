# teachin-semantic-lock — GRILL

## 用户确认

Steven 已确认：手动示教结束后必须后处理出本次操作涉及的工作流、智能体等业务对象；后续回放前重新获取当前对象并比较，确认仍是同一对象才允许继续。允许并行开发。

## 决策

1. 定名“业务对象语义锁”（Business Object Semantic Lock）：锁业务身份，不锁 DOM 位置。自动化只能重找 UI 句柄，不能静默换业务对象。
2. record 阶段只产未签观察候选；distill/compile 形成真实 `stepId + intentId + atom + role` 后才生成锁草稿；锁与断言一起由用户签署，绝不让手录直通回放。
3. 业务对象身份至少包含 `kind + name + code + scopeFingerprint`；平台提供稳定 ID、父对象或版本时必须一并锁定。长数字 ID 始终保持字符串。
4. 回放前重新只读解析当前对象并确定性比较。仅 `SAME` 放行；`CHANGED/MISSING/AMBIGUOUS/UNVERIFIED` 全部零业务动作并返回结构化 `reason + nextAction`。
5. 同名、同码异名、名同码异、同双锚但平台 ID 改变（删除重建）、跨 scope、父链改变、候选 0/N、编号证不出均不属于同一对象。
6. 若用例有意改名/改码，必须在已签 flow 中声明 identity transition；动作后权威读回新身份，生成链接旧收据 hash 的 successor。无声明不得自动更新锁。
7. `revisionPolicy=exact` 时版本变化也拒绝；`any` 只表示允许同一对象内容变化，不放宽业务身份。
8. 录制观察、身份候选、冻结锁形成哈希链；不保存真实目标地址、query、header、Cookie、token、原始响应体或请求载荷。
9. LLM/视觉只可提出对象候选或解释差异，不能生成权威编号、确认同一性、修改冻结锁或参与 verdict。
10. 未经真实只读 spike 证明身份字段的对象类型保持 `UNVERIFIED`；不得以 `.first()`、`nth()`、名称单锚或猜编号兜底。

## 本契约范围

- 先落零 SUT 纯函数内核：身份收据、候选解析、同一性比较、显式 successor transition。
- 再接未签观察旁车和 record/intake/distill/replay 的结构化硬门；真实 workflow/agent adapter 只在联网真机 UAT 中验证。
- 不改 `verdict.mjs`，不把语义锁结果洗成 PASS；锁失败只阻止动作并交既有 fail-safe 裁定链。

