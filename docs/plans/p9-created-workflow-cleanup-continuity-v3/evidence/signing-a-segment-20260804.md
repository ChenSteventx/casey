# A 段签署实录（2026-08-04）

## 链条

- A1 再授权：Steven 会话内 AskUserQuestion 亲选「授权，现在跑」（A3 第三次重编译，
  明知每跑一次多一条真实消息）。
- A2 权威件：沿用已登记件（sha256 `f093e6a6…` 与 PRD 登记一致，跑前实核）。
- A3 真机重编译：`COMPILE_EXIT=0`，10 步全落，`events.json` 找回；第 5 步首次落
  `replyStreamUrl=/ai-api/tester/agent/stream` 与 `replyText`（智能体规范化输出，与
  发送正文不同串，非回显）；`capturedAgainstBuild=1.1.2` 当日机采（observed 与身份
  观察件两处同值交叉核）。工装前置：`01e965f` 修复经双路评审合入后才跑。
- A4 备料：expected 草稿（4 intent 断言 + 2 全局，与 0703 已签集语义同集）+
  确认件（三元组与 0731 读回硬核对同值）+ `freezeEntityBindingsDraft` 预演 ok。
- B0 + A5 代签：见下方授权记录。签署 exit 0：`expected.frozen.json` 重签
  （6 条断言，signer=Steven，build=1.1.2，新 sha256 `a92dc368bc79ccb1…` 已由 sign
  写入 PRD）+ `entity-locks.frozen.json` 首签（v2，sha256 `f2b588122ba4ec8e…`）。
- A6 本记账。

## 代签授权记录（如实，绝不冒名）

Steven 2026-08-04 会话内原话：**「同意了，你帮我代签了，这是我的授权」**（针对我列明的
「chief 重签 + 实体锁首签」事项）。据此：B0 确认件由 Claude 代填
（`CONFIRMED_BY_PROXY`，provenance 含原话）；`casey sign` 命令由 Claude 代跑，
`--signer Steven` 表授权人身份、执行者为 Claude。范围比 2026-07-31 先例更宽
（彼时明确不覆盖 sign 命令本身），本次由授权人当日原话显式覆盖。如对措辞或范围
有异议以 Steven 后续更正为准。

## `--force` 披露

草稿含 1 条如实挂账 pending（`intent_3 assert.bubble` 机器映射不出，route:human；
其意图已由补缝三断言覆盖）。签署门对含 pending 草稿默认拒（不对未闭合契约背书），
按门的既定出口 `--force` 强签留痕：
`cases/tc_chiefcomplaint_smoke/expected.frozen.tc_chiefcomplaint_smoke.pending.json`。
断言集零增减零弱化，与 Steven 0703 亲签集同集。

## 签后复跑

`chiefcomplaint-v2-successor` 金牌红因由「events.json 缺席」前移为「成员清单 v3 形态
/ mutation 授权未闭」——即 A 段闭合、剩余红属 C/D 段（清单重签），符合计划推进方向。
