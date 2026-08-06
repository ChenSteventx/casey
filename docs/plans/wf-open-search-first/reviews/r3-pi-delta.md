Clean experiment confirmed. All evidence gathered. Here's my delta review (r3, 单轮):

## ① 修复正确性与新缺陷面

**三候选优先级与语义 —— 正确。** 循环内判定序：容器内 → 裸文本 → 搜索框。关键正确性属性经代码核验 + /tmp 实跑双向实证：
- **容器内命中才跳搜索**：`openTargetSeen` 只由容器限定探针置位，与后续容器归属闸同一选择器口径（`.hr-table-row, .hr-card.hr-card--bordered, .agent-card`）——「已见目标」标准与归属判定同刻成立。
- **裸文本命中不跳过搜索**：循环因裸命中提前 break 无碍——搜索门在循环**之后**独立复查 `openSearch.count()`，与循环退出原因解耦。B4 时序 harness（toast 瞬态 ~800ms + 搜索框在场 + 容器零命中）实跑：**e23ebd6 → 3 事件 fill→icon click→name click、零阻断**；**25943bb → 无 fill、跳过搜索、fail-closed 收束**。修复语义成立，旧假阳复现。
- 无新回归：裸命中提前 break 的「搜索框迟到」病理场景与旧实现行为等价（旧实现同样跳过搜索），搜索框在场时严格更优；全缺席路径（15s 轮询 + 锚 0 预算）与既有 <20s 钉不破。

**预算账 —— 四路径核算成立**：容器命中→跳过搜索+锚 15s（近零开销）；裸命中→不跳搜索+锚 15s（有搜索框=真搜索 ≈t+15s；无搜索框= fail-closed ≈t+15s≤16s，仍 <20s）；真搜索→锚 15s（最坏 ~30s 支路为既有挂账，r2 已记，本 delta 未放大）；全缺席→锚 0、总额恒 ~15s 不叠加。`openLooseSeen` 授预算与 plan「裸文本命中只授后续锚定预算」逐字一致。

**fail-closed 保持**：toast 残留至锚阶段 → 容器归属闸硬阻断 route:human（harness 实证 25943bb 该路径 0 事件 + 阻断）；toast 与真卡同屏 → 锚计数>1 交身份门 ambiguous 不点，瞬态消失后收敛。无假绿面。

## ② 三金牌全绿（实跑）

| 金牌 | 结果 |
|---|---|
| `wf-open-search-first`（新） | **4/4 exit 0**（15.3s） |
| `post-nav-anchor-wait`（冻结 d96d833） | **5/5 exit 0**（33.3s）——桩 locator 恒 0 → 容器探针不命中、裸文本探针承接，行为等价、S1≥2 采样/S3<20s 不破 |
| `wf-crud-sleep-import` | **4/4 exit 0**（23.7s）——不触达 open，纯邻接 |

PRD 三条 checksum 与文件 sha256 逐字节全等（golden e640f7cf / plan 7a6e99ff / 红证 9b9d121f）。

## Finding（1 条，非阻断）

**[Medium] 金牌对本次修复零判别力（/tmp 实跑实证）**：当前金牌 4/4 在 **25943bb 与 e23ebd6 两种实现下同绿**——桩的 `getByText` 与容器 `locator().getByText` 共用同一命中谓词，不存在「裸命中+容器零命中」的 toast 场景；S3 结构钉也只查 `搜索先行/15000/count()`，不查容器探针。B4 回归（裸命中误跳搜索）可被静默回退而金牌不红。修复正确性由代码结构 + 本评审 /tmp harness 承载，而非金牌判别——与 r2 非阻断注记（"金牌桩恒 unique/acted…测试逼真度加严候选"）同类但覆盖面更核心（本 delta 的全部动机）。建议下一轮补 S5 钉：裸命中+搜索框在场 → 必发 fill；或裸命中+无搜索框 → 授锚预算且 fail-closed 封顶。

DELTA_VERDICT: APPROVE
