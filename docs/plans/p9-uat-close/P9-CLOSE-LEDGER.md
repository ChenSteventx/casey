# P9 关账账本（2026-07-30 起，活文档）

> P9 完成定义（`docs/plans/bootstrap/plan.md` P9 段）：
> ① `selftest --tier1` 全链 exit 0、四态徽章全覆盖；
> ② tier-2 真机冒烟 + 真机 UAT 清单**全部人签通过**（gate 绿 ≠ 完成，ADR-0009）。
> 关账规则：清单全过**或**逐项明确 waiver；open 项保持 P9 open。

## 关账口径裁定（Steven 2026-07-30）

**不走 waiver 路线。** `tc_wf_publish_states` 必须真绿之后 P9 才关账
——即选「等 publish 全绿再关 P9」，P9 保持 open 直到该例真机全 PASS。
理由：真机 UAT 清单的意义就在于每一例都真过；提前 waiver 会让 P9 的
「需求完成」名不副实。

## 清单现状

| 项 | 状态 | 证据 / 阻塞 |
|---|---|---|
| tier-1 全链绿 + 四态徽章 | ✅ 早期建成 | tier-2 金牌 T6 横切锚点复跑绿 |
| tier-2 机器面（契约 `p9-tier2-live-smoke`） | 🔄 收口中 | 实现完、gate 曾绿；codex 联审三轮（r3 跑中）；两笔换签待 Steven 签 |
| A4 tier-2 真机实跑 | ⬜ 待办 | 需两段连通证据；流式面空缺按设计 exit 2 如实记 |
| A5 D5 三层口径修订 + 人签 | ⬜ 待办 | bootstrap plan / CONTEXT.md:156-157 / README |
| UAT 签认书（冻入 prd checksum） | ⬜ 待办 | 仿 uat-signoff 形制 |
| UAT 例 `tc_agent_id_readback_real_uat_v1` | ✅ | PASS 1 / NEEDS_HUMAN 1（身份回读已人裁） |
| UAT 例 `tc_catalog_wf_crud` | ✅ | 07-30 重签后真机全 PASS，B.5 报告齐 |
| UAT 例 `tc_wf_history_version` | ✅ | 07-30 重签后真机全 PASS，B.5 报告齐 |
| UAT 例 `tc_wf_publish_states` | ❌ **P9 关账阻塞项** | 见下 |

## publish 阻塞项详情

07-30 重表达后真机复跑判 PASS 4 / NEEDS_HUMAN 2，Steven 看录像确认两处
**根本没发生**：

1. **保存步**：`resolution: none, candidateCount: 0` —— 按钮没找到、点击从未
   发生。计划审证据：选择器与可访问名都没写错（真机示教证明它就是编辑器顶栏
   真按钮），根因是**顶栏延迟挂载**而现役定位只等 1200 毫秒、后备选择器不等待；
   同一意图稍后的按钮态采样用相同精确匹配数到「保存」计数 1，坐实「按钮后来
   出现了、点的那一刻还没到」。
2. **关闭步**：`body` + Escape 机械上「唯一」，但浮层没关。原表达假设来自
   假环境夹具（该夹具既实现关闭按钮又实现 Escape 处理），真平台不吃这套。
   真机示教从未录过版本表的关闭控件，**证据不足以冻结替代选择器**。

### 因此需要的动作（按序）

1. **Steven 带外真机侦察一次**（清单由计划审校后给出）——不侦察就只能猜
   选择器，违「不猜」纪律；
2. 后继契约（生产件级）：编译原子与回放共用的动作前有界就绪等待、登记
   关闭动作的原子候选、剖面 `loading` 形态迁移核对；
3. 用例重造件 + 重签 + 真机三轮复跑全 PASS；
4. 回填本账本，P9 方可关账。

## 2026-07-30 晚追记：闭环真因修复已在真机验证

契约 `teachin-raw-actionability-closure` 六阶段推进到 loop（gate GREEN 3/3）。
真机重录实证（`runs/teachin-uat/tc_wf_list_smoke_cycle_20260730_1930/` 边车）：

| 项 | 修前（07-30 晨） | 修后（07-30 晚） |
|---|---|---|
| seq 1 点击 | `performOk: false` | **`performOk: true`** |
| seq 2 点击 | 未执行（consumedEvents 0） | **`performOk: true`** |
| 停在哪一层 | `source-raw-execute` | `source-resolved-completion` |

即：驱动误读拓扑返回契约这一真因，在真机活体链路上确认修复。

**新阻断（下一层）**：`resolved-completion.result-shape` 拒付
`SOURCE_SEMANTIC_COMPLETION_INVALID`。该码是外层统一码，`projectAndVerify`
的六类以上内层具名拒付被吞，边车拿不到 → 真因不可判。**不猜**，起窄契约
`cycle-evidence-inner-reason` 把内层码按闭合枚举带出来，再录一次即可定位。

**环境侧同日修复**：Windows 侧反向代理进程（7 月 17 日起连跑近两周）劣化，
浏览器成批发请求时丢连接致前端 JS 代码块拿空响应、单页应用离不开登录页
（登录接口本身一直 200 成功）。Steven 授权后重启，登录探针 7 秒通过、
零失败资源。WSL 侧监听进程健康未动。

## 待决

- 后继契约与 tier-2 谁先占契约槽（tier-2 收口在即，预计先收 tier-2 再开）；
- 三轮复跑是否必须换新实例（计划建议如此，防把一次绿当时序问题消失）。
