# 评审收据 · wf-create-entry-anchor-wait

## R1（聚焦代码审，双路，全仓暴露）

| 项 | 值 |
|---|---|
| 被审快照 | `f50c6ed`（不可变） |
| 基线 | dev `c977fde` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high，tmux 真 TTY、`--cwd` 真工作树（只读 + /tmp 变异复现），产物 `r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-flash` high，同树只读 + /tmp 变异，产物 `r1-pi-deepseek-v4-flash-high.md` |
| 结论 | **双双 `IMPLEMENTATION_VERDICT: APPROVE`，零 Critical/High** |

## 过程如实入档

grok 思考块中途曾起草三条疑虑（count 与 visible 语义、15s 预算对看门狗、S2 notes
覆盖）并写过一版 `CHANGES_REQUIRED` 草稿，随后在正文里逐条实测自证否掉：等待循环
实测 ~15.02s/60 采样有界；`catch(()=>0)` 与同函数 menuitem/desc 探针同构；耗尽路径与
/tmp 回退对照 actions/notes/blockers 逐位不变；S2 全套 ~17.4s 不误红；回放侧零影响
（emit 字节形状不变、无 adapter/断言/冻结档 diff）。终局零 C/H/M。

## 双方独立复现的关键证据（并集）

- 锚同一性：`locatorFor` 对 role 语义的映射与就绪锚 `getByRole` 逐字段全等（pi 实读核）。
- 红证：双方各自 /tmp 复现逐字节一致（S1 红/S2 绿/S3 红、exit 1）；突变闭环
  还原红/复原 sha256 同/绿；PRD 三条 sha256 双方自算全符。
- 判别力矩阵（grok）：不等待直接点 / 固定 sleep 不轮询 / 结构被删 / 耗尽改判 四类回退
  分别被 S1 双探针、S3、S2 拦截；pi 补充「连续两次立即 count + 固定 sleep」理论作弊窗
  由 S3 + 计数键绑同语义锚联合封堵。
- 邻接四项独立复跑全绿。

## 开口项（如实挂账）

1. **pi 唯一 Medium**：失败路径（按钮永不挂载）全链路最坏 ~95s、120s 看门狗余量收窄至
   ~25s，hermetic 证不出——核验点路由至 B4 真机重跑：**首例记录总耗时**，若余量吃紧
   把锚预算降 10s（另立小修）。
2. 加严候选（双方 Low/残余）：S2 可补 notes/blockers 快照钉；S2 上界可提 22s 加余量；
   `Date.now()` 非单调属全库 idiom 不动；锚期请求归因位移（`background`）零正确性影响
   知悉即可；邻接金牌运行时 +15s 通胀可接受。
