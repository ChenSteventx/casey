# teachin-replayability-closure 评审综合报告（交 Steven）

日期：2026-07-28。契约 4/6（review/learn 待）。真机推迟（环境升级中）。未提交。

## 一、评审轮全景

| 轮 | 评审方 | 对象 | 终判 |
|---|---|---|---|
| R1 主审 | grok-4.5 | Claude 流水线实现层（30 金牌首绿态） | CHANGES_REQUIRED（C×2 H×3 M×5） |
| R1 参考 | pi.dev deepseek-v4-pro | 同上 | CHANGES_REQUIRED（C×2 H×3 M×5，与 grok 五处重合） |
| 修复轮 | Claude（opus 流水线） | 13 条合并清单 | 全部落地，31 金牌绿 |
| R2 复审 | grok-4.5 | 修复 hunks | APPROVE（13/13 FIXED，3 条不阻断残差） |
| codex 层 | codex gpt-5.6-sol（实现者） | 在 Claude 层之上叠录制生命周期/同次 capture 身份链/teachin-plan 等 + 静态收口 | 自报全绿（我方已独立复核为真） |
| 本轮 | Claude 四路（异构评 codex 层） | 七核对点 | 须修后过（C×0 H×0 M×6 L×5） |

## 二、独立复核底数（只信退出码）

33/33 teachin 金牌、cli-mcp-face 12/12、regress-wf-node-script 10/10、tier1 全绿、
全仓 143 PRD / 732 条冻结账零漂移、diff 检查过、账本 R1–R9 连续。

## 三、codex 层评审七核对点结论

1. 同次 capture 身份链贯穿 admission/events/pair/三 namespace：PASS（12/12 探针；旧双录流程实证必拒；hash 门零放宽）
2. legacy plan 只作模板：PASS（旧 events 路径零读取实证——指向不存在文件照常装配）
3. 录制归属交接与清理恰关一次：PASS（逐退出路径枚举；关闭靠事件/对象状态守门非计数）
4. signed expected/obligations 一致：PASS（单一 bytes 事实源，义务按 intentId#predicateSha256 锚逐条对齐）
5. 动态活动页 + 共享取证态真接生产：PASS（Proxy 实时解析、单实例引用链、按步归因保持）
6. 实体未授权全链 fail-closed：PASS（发布根空表→授权四条同真→pair 私铸 handle 三层独立；生产装配无注入面）
7. CLEAN/REPRODUCED/EQUIVALENT 恒 developmentOnly：PASS（全出口盖章；正式通道零渗透）

R9「同次 capture 身份链修复」的金牌重写经弱化比对判定为净收紧（唯一移除的断言钉的恰是缺陷行为本身，替换为双向更强断言）。

## 四、须闭合的 6 条 Medium（建议全修，均产码侧）

| # | 发现 | 修法 |
|---|---|---|
| M1 | legacy 模板内嵌对象（authoredTestCase/mapping/obligations）与盘上字节无一致性校验，receipt 摘要可能指向未被使用的字节 | loader 改为从盘上字节重新 parse/重投影（与 same-capture 同路径），或加摘要相等校验 |
| M2 | legacy 路径跳过生成期具名前置门（pending/popup/mutation/非空 entity lock），拒绝时点后移到深处 | buildLegacyCycleInput 补 entityLockBytes 恰等空数组字节 + mapping 复跑 mutation 检查 |
| M3 | cycle-entry 五个前置校验早退发生在 try/finally 之前，而 record 已置交权标志——两侧都不关（当前 canonical 不可达，属漂移陷阱） | 前置校验挪进 try 内让 finally 覆盖 |
| M4 | 完成录制语义只绑初始页：popup 交接后初始页正常关闭会提前收口；用户关 active popup 则不收口 | done 订阅到 bridge 观察过的每个 page 的 close，结合 active 判定 |
| M5 | global 断言双重投影（claim 期一遍 + preflight 再 push 一遍，共享引用）——裁判 axes 文档偏离已签断言全集 | claim 期建空集，投影只留 preflight（或整体替换非 push） |
| M6 | raw-axes 非消费预检仍窄于绑定核（缺 caseId/expectedSha256）——错绑照烧两枚一次性 authority（grok R2 残差未对齐） | inspector 补暴露两项，预检补两条比对 |

## 五、5 条 Low（建议顺手修 3、挂账 2）

顺手修：comparator 悬空 promotionEligible:true（删或恒 false）；完成控件激活前可用（激活门）；装配死参数清理。
挂账：plan/CLEAN stdout 自述标记（下轮）；签名门前白烧 fresh（fail-closed 无洞，记录取舍）。

## 六、跨轮遗留与定性

- grok R2 三残差：preflight reason 折钝（仍在，不阻断）；raw-axes 预检窄（=M6，本轮修）；baseline 台账卫生（挂账）。
- TOCTOU 受限缓解与见证单铸设计裁决：grok R2 已按「技术探索」校准接受。
- 真机义务不变：全部 route:human 维度等环境稳定后按真机首跑计划执行。

## 七、建议的收口序

1. Claude 修复轮闭合 M1–M6 + 三条顺手 Low → 全套重验（33 金牌+跨契约+ratchet+tier1）
2. codex gpt-5.6-sol（max）复审修复 hunks——此时 Claude 是实现者、codex 是评审者，家族正交成立（带「技术探索非银行级」校准前言）
3. 干净后 review 阶段记账推进 → learn → 交接文档终稿
4. 提交与发布按交接 C 项等真机验收（sut-503 收口件是否例外提交，请 Steven 单独裁决）
