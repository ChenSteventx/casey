# page-topology-auth-continuity 学习记录

## 1. 可复用结论

1. popup/new tab 不是普通导航。活动页必须由同一 BrowserContext 内的 page topology controller 持有，不能用 `pages().first()`、`last()` 或 URL 猜。
2. 新页归属边界必须在录制 binding 到达时同步冻结。若等异步事件真正执行时才取 generation，和点击同调用栈出现的 popup 会静默落到边界外。
3. 一次性 generation authority 只能保存在模块私有 WeakMap 中；clone、spread、序列化和重放都不应恢复能力。
4. `newpage` 是结构事件而不是新的业务 intent。它应归属产生新页的 click/dblclick，并在 source 与 distilled 投影中保留顺序和安全 path。
5. recorder 与 replay 必须共用同一 topology 状态机，但职责不同：recorder 负责同步固定动作边界，replay 负责消费已冻结的结构事件；不能在 replay 里重复打开页面。
6. popup close 回 opener 只在 opener authority 仍有效时成立。opener 不可用、多个新页或跨 origin 时必须 fail-closed。
7. 同源 session seed 只能在内存中按 authority 消费，不得落 session key/value；真实 cookie、localStorage 和 sessionStorage 连续性仍需真实环境验收。
8. 每个 page 都要独立挂取证并归因，不能继续让初始 page 成为固定唯一取证源。

## 2. 对示教双回放的约束

- raw source replay 必须消费 capture 中的 `newpage`，不能静默丢弃，也不能把它改成普通 click。
- fresh source 与 fresh distilled 两次运行都要重新建立 controller 和每页取证，不能复用第一次的 page authority。
- source/distilled 表示层 parity 继续比较结构顺序；业务等价层改按 `intentId + transition ordinal + canonical route projection` 比较，不能按 event index 强求步骤数相同。
- 录制原始事件的 `nav` 只作 path checkpoint；页面错位时拒绝，不能用导航修正后继续。
- 多 popup、跨源登录、无合法 opener、CEF 多页能力和 iframe 继续 route:human，不得由 web 同源测试外推。

## 3. 后继

1. 建 `teachin-replayability-closure` 契约；
2. 用旧 runtime 真实关闭与新 browser/context/page 对象身份铸 fresh runtime authority；
3. 完成 exact capture hash 绑定的 source raw replay proof；
4. 按 event 证据完成 resolved atom projection；
5. 在第二个 fresh runtime 回放 distilled candidate，并用确定性语义收据比较；
6. 在 AI 中台、医生站和 Hi 小助分别做真实环境验收，证据不足时保持 `NEEDS_HUMAN`。
