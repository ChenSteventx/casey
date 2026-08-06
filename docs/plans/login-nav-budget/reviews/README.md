# 评审收据 · login-nav-budget

## R1（聚焦代码审，双路，全仓暴露）

| 项 | 值 |
|---|---|
| 被审快照 | `2e3534b`（不可变） |
| 基线 | dev `158829d` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high，tmux 真 TTY、`--cwd` 真工作树（只读 + /tmp 变异复现），产物 `r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-flash` high，同树只读 + /tmp 变异，产物 `r1-pi-deepseek-v4-flash-high.md` |
| 结论 | **双双 `IMPLEMENTATION_VERDICT: APPROVE`；grok 零 C/H/M，pi 一条非阻断 Medium（挂账见下）** |

## 过程如实入档

grok 思考块中途草拟过一版 `CHANGES_REQUIRED`（表单路径多步超时级联随默认翻倍、
病理下可越 120s 看门狗），随后自证：级联结构旧有、非本清单目标路径，plan 非目标已
声明「表单路径随默认同宽、不单列」——终局零 C/H/M。pi 对同一面向下钻并保留为正式
Medium（更锐：三段被吞等待 `:143-145` 属**成功路径稳定等待**、复合挂死最坏 ~240s，
compile/replay 看门狗 `process.exit(1)` 在 loginBootstrap 中途触发时不落
compile-report.json、绕过失败密封承诺），并明确「多重病态叠加、概率低、方向 fail-closed，
推荐加固而非阻断」。两段全部入档，不挑读。

## 双方独立复现的关键证据（并集）

- 天花板语义：`timeoutMs` 全部消费点（首跳 goto、表单 waitFor、fill×2、click、
  detached/hidden、loadState）逐点核实均为 Playwright 上限选项、非 sleep；
  3s 表单窗硬编码未动；全仓生产调用方零覆盖确认。
- 判别力：15 < 20 < 30 区间实证（绿 20.05s 落 [20,28) 窗、红 15s 整拒
  `NAVIGATION_FAILED` 与真机同 reason 码）；替身 goto 忠实传递 timeout。
- 替身不倒裁：路径避开 pathMarker 走「表单不在场即已登录态」判据支合法；哑元凭据
  结构性不可消费（误入表单支只会红不会假绿）。
- 红证 /tmp 复现逐串同款；PRD 三条 sha256 双方自算全符；邻接与内核自检全绿。

## 开口项（如实挂账）

1. **pi Medium（加固候选，另立小契约）**：`login-bootstrap.mjs:143-145` 三段被吞等待
   从导航预算解耦（各设固定上限，或给 compile/replay 登录阶段独立预算）——消除复合
   挂死下顶穿看门狗、绕过失败密封的理论面。先由 B4 真机重跑记录实际耗时再定优先级。
2. 文面 Low：plan 行号 `:83`→现 `:85`；S2 文案「<3s」断言实为 `<6s`——不挡合入，
   随下次触碰该件时顺手校。
