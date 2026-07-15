# ADR-0006：Casey = autotester 与 regress 的分层融合；骑原子需先重写三轴，非白嫖

- 状态：方向已接受；增量已据对抗评审修正；实施待 P2 重定义
- 日期：2026-06-26
- 相关：ADR-0001（loop-kit 孵化与提取）、ADR-0002（Reserved Prefix）、设计 §4（多态裁定）、§9（关键新建件）

## 背景

Casey 复用 autotester 的 loop-kit（ADR-0001）。本次查明姊妹项目 `regress_autotest` 已建成一套原子流系统：60 个硬化、自带后置断言的平台原子（`atoms.registry.json`）+ 状态机（requires / provides / 互斥组）+ NL 编译（`compile.mjs`：中文用例到原子序列）+ 双闸校验 + confirm 人签门 + ctxtest_ 前缀硬闸 + 零 LLM 回放。它本质上是 Casey「编译再回放、裁判零 LLM」模型的一个能跑的原型，并把驱动 Heren 中台的真机知识硬化在原子里。

自然的想法：Casey 骑这套原子库，补上它没有的归一 + 多态裁定 + 报告。此想法经五路异构冗余对抗评审，端态成立、但增量被挑崩（一路 broken，四路 holds-with-changes）。

## 决策

1. Casey 是 autotester 与 regress 的分层融合，不是第三个项目，也不是大爆炸合并，是分层 + 增量去重。端态分层（评审确认方向正确）：
   - L0 纪律：loop-kit（来自 autotester）。
   - L1 零 LLM、平台无关原语：唯一一套 动作 / 断言 / 取证 / 录制 / 报告，以 autotester 的 lib 为底；新增 watchNetworkForensics。
   - L2 平台硬化原子包 + 状态机：来自 regress，每原子重写成架在 L1 上。
   - L3 authoring 两条路：录制到生成（孵化原子、对付陌生站点）；NL 到原子编译（平台有原子时）；Casey 前置一段归一（杂乱文本到意图步）。
   - L4 冻结 + 人签：regress 双闸 + confirm 与 loop-kit 的 gate/checksum、人签门 并成一套。
   - L5 零 LLM 回放 + 多态裁定（Casey 独有，两边都没有）。
   - L6 自包含报告 + 多态徽章 / 缺陷单。
   - L7 自愈：只对确证工装漂移、原子层重锚（受爆炸半径约束，见 R7 / R9）。

2. 否决「MVP 直接骑原子库、消费 atom post 即得多态裁定、先不动其内部」。四条结构性理由：原子 post 是 throw-or-pass 单 bit，拆不出裁判要的三轴（动作对不对 / 逐条断言 / 取证）；原子库零网络取证、零身份令牌，被测缺陷与「动作确证对」两条分支不可达；两套不兼容回放底座（events/spec 对 flow.json）不能并养；让裁判吃 LLM 编译期选的、未冻结的 atom post，等于护栏 #15 的洗白。

3. 修正的增量顺序：要拿到真四态裁定，必须先 扩断言词表（补 textHidden / 按钮态 / 开关态 / chip 缺席 等 kind 并登记 CONTEXT.md）+ 建 watchNetworkForensics + 把少量原子改成显式吐三轴和身份令牌，然后才谈价值验证。原先想推迟的那一刀，恰是必须先做的那一刀。

4. 第一刀 = 一条贯通 spike（单 flow，如 `catalog_wf_crud`）：只为它 补所需断言 kind + 建 watchNetworkForensics + 改它三五个原子吐三轴 + 跑通 回放到多态裁定到报告，产出一份真四态裁定档 + 报告；同时把双运行时、浏览器 context 归属、MVP 只能绑 Heren 三个集成雷在最小面上前置暴露。

## 被否的备选

「骑 60 原子白嫖多态裁定、不动其内部」——见决策 2 的四条理由；它验到的只会是退化的二值裁判，不是 Casey 的多态内核。

## 对抗评审确认的 14 风险（五路：1 broken + 4 holds-with-changes）

- CRITICAL R1 atom post 单 bit 拆不出三轴，原子一抛异常判定树根本不跑。
- CRITICAL R2 两套不兼容可回放底座并养（events/spec 对 flow.json）。
- HIGH R3 原子库零网络取证零身份令牌，被测缺陷与 actionPerformed 确证为真两条分支不可达，骑原子只吐 过 / 路由人。
- HIGH R4 断言词表（设计 §2.1）缺 textHidden / 按钮态 / 开关态 / chip 缺席 等 kind，连演示 flow 的 noErrorToast 都无处安放。
- HIGH R5 flow.json 到 verdict.json 无桥接产物，增量顺序反了（必须先重写原子三轴再谈骑）。
- HIGH R6 「不动内部」不可行：Heren 硬编码 + 运行时不匹配（regress 是 @playwright/test 的 TS，Casey 纯 mjs），MVP 绑死 Heren 且并骑双运行时。
- HIGH R7 原子层自愈爆炸半径无界：openNode 被约 11 原子共用，凭一条证据重锚会静默回归其余。
- HIGH R8 裁判吃 LLM 选的未冻 atom post 等于护栏 #15 洗白；选错原子（新增编成保存）会自过、报 过。
- HIGH R9 「一处修、处处好」对画布域被 regress 自己文档证伪（纯坐标、无共享稳定锚）。
- HIGH R10 「硬化成新原子」本质人工写代码 + 有头真机演示，飞轮叙事夸大（LLM 约做五分之一）。
- MEDIUM R11 弱 / 不透明原子后置，使下游裁定与自愈双双失真。
- MEDIUM R12 保留前缀冲突：Casey atl_ 对 regress ctxtest_，须对齐到单一前缀且机制强制。
- MEDIUM R13 loop-kit「抽成独立件」实为字节复制、非真提取，会静默漂移；ADR-0001 的独立仓 + 路径依赖未执行。
- MEDIUM R14 60 原子重写成本被低估；P2 须重定义（现设计对着 recorder 路、与「意图到 atomId」编译目标对不上）；plan 把最贵的 P3 recorder 放在 MVP 关键路径，与本决策冲突，plan 与 design 须对账。

## 后果

- 收益：复用 regress 已趟平的平台知识，大幅降 P3 找入口风险；复用 loop-kit 纪律；Casey 专注它独有的归一 + 多态裁定 + 取证。
- 代价：MVP 为 Heren-only（孵化期临时桩）；原子三轴重写是真功夫；双运行时集成风险；P2 须重定义；loop-kit 真提取待办；前缀须对齐。

## 深读核验后的风险修正（2026-06-26）

6 路并行深读 `regress_autotest` 把上列风险落到代码层核验，几条原表述需修正（决策树与冻结接口全文见 `docs/plans/p2-intent-compile/grill.md`）：

- R3 修正：不是「零身份令牌」——`user-token`（JWT）实测在每个 `/ai-manager/*` 请求头里，只是原子没把它捕获给裁判；网络捕获底座 `waitForReplyByStream` 已存在（能拿 status/body），只是仅 chat 用、丢了 status/body、谓词写死 200。故 `watchNetworkForensics` 是「接回 + 不丢弃 + 按发起方归因」，非从零造，成本下调。
- R4 修正：`textHidden` / 按钮态 / 开关态 在 regress 原子层已实现（别的 flow 用、未抽成 typed kind）；`catalog_wf_crud` 真正缺的只有 `noErrorToast`（DOM 错误弹窗缺席），外加 `countChange` 支持绝对归 0。chip 是真缺口但属别的 flow。原文「连 noErrorToast 都无处安放」前半对（Casey 词表确实没有）、后半「这些 kind 缺席」不准。
- R6 修正：Heren 错误信封实测是 `{status:200,msg,data}`，成功判据 `body.status===200`，不是 design §2.1 假设的 `{code:!=0}`；`noErrorEnvelope` 的成功字段名/值必须按 channel 参数化（落 `site.json`）。
- R14 证实：`catalog_wf_crud` 全程用 proven 原子 + 冻结 flow.json + validateFlow，零 recorder 跑通——recorder-as-library 在「平台有原子」的 MVP 路上不在关键路径，降为「陌生站点孵化新原子」支线；plan 须把 P3 移出 MVP 关键路径。
- 新约束（原文未写）：原子 fail-fast（`expect` 抛错、`runFlowCase` 无 try/catch）与「逐条断言都出结论」正面冲突；裁判侧须走 continue-on-failure（断言续跑）执行模型。
- 增量锁定：三轴改造走「锐化版路二」——不改 regress 共享原子，把 5 个原子行为在 autotester L1 原语上重表达成纯 mjs、吐 `三轴`（`StepAxes`）的函数；前缀参数化；含合成故障打通 SUT_DEFECT。最大可复用资产 = `_flow-authoring.mjs`（纯 mjs、零 playwright 依赖）即「意图到 atomId」编译门现成实现。

## 推翻条件

若贯通 spike 证明 原子改成吐三轴 的成本不可接受、或双运行时集成不可行，则退回「Casey 自建 recorder 裸驱动」路（原 P3 设计），放弃骑原子。
