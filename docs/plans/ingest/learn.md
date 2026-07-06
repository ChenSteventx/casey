# ingest — learn（相0 归一，full，codex 七轮 R7 PASS）

六阶段全走完后的教训沉淀。上下文：GRILL D1–D7 已签、金牌 C1–C22（16 起、评审期 +6）、
codex 七轮 12 发现（10 采信 + 2 修正采纳）收敛至零。

## 1. 输出通道也是泄漏面——凭据门只护落盘内容，回显面要逐点自查

R1-F2 / R2-F2 / R2-F3 三连同族：成功日志回显 outFile 全路径、非法 caseId 报错回显原值、
落盘异常未捕获把 out-dir 路径打进 stderr。共因：凭据门扫的是「将写的文本」，CLI 参数与路径
是用户可控却在扫描面外的文本。承 replay-login-bootstrap「报错通道也是泄漏面」教训并系统化：
新 CLI 每个 stdout/stderr 组装点都要问「这段文本里有没有未过门的用户可控片段」——
定名产物文件（已过形状闸的 caseId）可回显，路径/原值/异常消息一律不可。

## 2. 校验↔落盘同一性是一族缝不是一颗缝——见第二个同族发现就找族解

R3-F3 原型链 → R4 稀疏洞·非枚举 → R5 toJSON 合成 → R6 `__proto__` setter，四轮同族逐型打洞。
正解不是 descriptor 逐型拒（永远有下一型），是按构造让「校验的对象 = 落盘的对象」：
手写 JSON 数据投影器（不调钩子、own enumerable data、数组稠密 own、`Object.create(null)` 建），
只校验投影、只返回投影、只落盘投影。教训：第二个同族发现出现时就该停手找不变量级的族解，
本契约多挨了两轮才收敛。

## 3. 修复代码与缺陷代码同权——修复也要过红金牌

R3-F1 第一版修复用 `Date.parse` 兜语义，金牌当场抓假：V8 对 `2026-02-30` 翻卷不判非法。
「看起来对」的修复在钉红检查面前现形，遂改历法组件自算。红先行不只服务首次实现，
每一轮评审修复同样要「钉红 → 修 → 绿」三拍走全，跳拍就是给假修复开门。

## 4. 「来自 JSON.parse 所以干净」的直觉不成立

两个冷门事实进了真缝：`JSON.parse` 会把 `"__proto__"` 建成 own 键（R6，经候选文件 CLI 端到端
可达、红跑 exit 0 实锤的 High）；JSON 文本 `1e999` 解析成 `Infinity` 过 `typeof` 闸、再落盘
stringify 变 `null` 自违 schema（R3）。解析器的输出仍能携带绕过 naive 校验的形态，
L0 校验器要按敌意输入设防，不按「合法 JSON 心智模型」设防。

## 5. schema 双源同刻的锁在 accept 期一次付清

项目无 ajv、运行期零 schema 加载，手写闸与 schema 文件天然双源。金牌 C4 从 schema 文件逐条读
必填集/enum 现场构造坏输入打手写闸（真值源姿势、不抄副本），七轮评审零漂移发现——
锁双源的成本在 accept 期写一个检查就付清，比评审期逐字段对账便宜一个量级。

## 6. 修正采纳的声称本身要被下一轮复审打

R4 两发现修正采纳为 round-trip 投影，R5 被打穿（`JSON.stringify` 调 `toJSON`，与包里声称的
「own enumerable data 投影」不符）。修正采纳不是终点：换方案时对方案语义的每句声称都是
新的可证伪断言，要在下一轮评审包里如实呈现并接受专打。R5 包认领声称错误后按评审员方案重修，
R6 又在该方案的实现细节（`__proto__` setter）上挖出 High——方案对了实现仍可错，逐轮收敛是常态。

## 挂账（不静默丢）

- 姊妹 CLI 同族缝：`bin/flow-bridge.mjs:31` 与 `bin/draft.mjs:40` 的非法 caseId 回显原值
  （R2-F2 同族）；属已收口契约冻结面，另立 direct 小契约同修。
- caseId 形态接缝张力：testcase schema `^[A-Za-z0-9_-]+$` 宽于 events schema `^tc_[a-z0-9_]+$`，
  已记 `prd-ingest` observability（route:human）。
- `casey run` 编排器仍起于相3；相0→相2 前段接线（ingest→flow-bridge→compile→draft→sign 串进 run）
  属后续契约（真机 compile bring-up 后才有意义）。
