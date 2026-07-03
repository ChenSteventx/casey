# learn — chiefcomplaint-smoke（full，2026-07-03，hermetic 半程收口）

六阶段 hermetic 半程走完（grill 三分岔 Steven 拍板 → plan → accept 红先行 9/9 红 → loop 双 gate GREEN → codex 三轮 R3 PASS → learn）；真机四停站（confirm/execute/人签/报告过目）挂 observability route:human 待 Steven 在场。沉淀五条：

1. **「移植」的真工作量在机制缝不在原子数**：五原子编译知识本体半天速通（emit 骨架 + regress 选择器直译），真设计张力全在三条机制缝——冻结枚举表达不了逐字符敲键（keydown 垫绕开）、回放静默点没有流概念（动态探测 + 双条件归因）、reply 采集的时序与陈迹（基线对照）。飞轮后续维度估算工作量应按「撞了几条机制缝」计，不按原子数计。
2. **「按发起方归因」在等待侧同样成立且要两轮才钉紧**：流等待从「全局有流就等」收到「本步发起才等」再收到「本步发起 且 命中对话流 URL 域才等」——背景长流、他步流、本步附带的非对话流三类干扰源各需一道谓词。等待条件与取证归因是同一红线的两面：凡「等 X」必先证「X 因本步而起」。
3. **对抗性夹具场景是评审发现的放大器**：stale（陈迹）与 bgstream（两条永不结束的长流）两个「恶意」场景把三条 fail-safe 缝全部钉成可红可绿的机器事实（修前 40922ms/陈迹判真/空正则必真都有实测记录）；干净夹具只能证明 happy path。后续接线契约的 golden 预算里应默认留对抗场景位。
4. **异构评审的事实误判也有价值**：codex R2 称「nav 步会被拖 30s」不成立（等待块只在非 nav 分支），但其指向的方向（非对话长流拖步）真实存在——处置法是修正其事实、采纳其方向，并把修正记进 audit。评审发现的「载体错、方向对」是常态，逐发现三分处置（采信/证伪/修正采纳）比二分接受/拒绝保真。
5. **同型缝要当场挂账**：F1 的空正则缝在 urlPathname matches 分支同型存在（既冻行为、不在本 diff）——评审轮内当场挂账（audit + 本文），与 draft-cli 挖出 compile caseId 形状缝同一先例；下一个 direct 小契约可并 C（compile caseId 形状）一起收。

配套：`IMPLEMENTED_KINDS` 7→10（replyContains/replyMatches/textHidden）；流谓词普化（profile.chat.streamUrlPattern + legacy 兼容）；看门狗 75→120s；`chat-sut` 四场景夹具（happy/error/stale/bgstream）；kinds-harden.golden 精确计数重钉为「最新前沿 golden 持有」（本轮 chiefcomplaint golden ===10）。真机四停站与 `cases/tc_chiefcomplaint_smoke/` 真机件（TestCase/flow 草稿/profile）待 route:human。
