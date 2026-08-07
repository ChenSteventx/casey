# 评审收据 · wf-open-observation-yield

## R1（双路，含一次 HARNESS_ERROR 重跑）

| 项 | 值 |
|---|---|
| 被审快照 | `4d05447`（分支 `wf-open-observation-yield`，审前 `git diff HEAD` 空） |
| 基线 | dev `b6880e3` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high（tmux 真 TTY、真工作树只读），`r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（`-p` 非交互带工具、同树只读、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| 环境事故 | 首轮 pi 执行中 `/mnt/d` drvfs 整体 I/O 故障，pi 如实报 HARNESS_ERROR 零 findings（存证 `r1-pi-HARNESS_ERROR-drvfs.md`）；grok 同轮被 WSL 重启杀死无裁定。WSL 重启复原后对**同一快照**重跑双审 |
| 结论 | **双路 `APPROVE`，零 Critical/High/Medium** |

## 双方独立复现的关键证据（并集）

- 让位判据实码核证：`some((o) => o && o.platformId === gate.matched.platformId)`——精确同
  platformId、非同名、非「有观察就让」；`matched.platformId` 唯一来源=判定表 unique 行
  `row.id`（列表扫描 `nonEmpty(id)` 字符串约束 → `===` 类型同构可信）。实现不滤
  role/atom 只认 platformId，比注释所述更稳、偏 fail-closed。
- 独跑零回归：零预置走 else 原归档支字节不变；readback 契约金牌自跑 20/20（open 独跑
  S1e 归档全档未被污染）；successor amendment 的 open [source] 语义保留。
- 双证不缩水：让位点在 click 成功 + waitForURL 之后，其前所有环节字节不变；S4 让位
  场景平台零行仍硬阻断零 click。
- 下游效果实码核（非注释）：让位后仅 create 一行 → `selectObservationForDestructiveTarget`
  ok 铸 create 观察 + `deriveObservationIssuerAtom` 走 H1h 单原子通道；修前双行同名 →
  `OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME`/H1i（十二跑实证形态）；S3 异 platformId
  两行 → 同拦（预期 route:human，非本契约债，无静默放行）。
- 红证双方在基线 `git show b6880e3:` 姿势下复现 10 过 2 红；PRD 三条 sha256 自算全符；
  邻接自跑全绿；门面拆分族既存红基线同码。
- grok 思考中段曾起草 High/Medium 候选（让位判据 vs C3 同名口径差异、S3 边界），
  实码取证后终报自行否定为零 C/H/M（异 ID 同名时让位不触发、C3 照拦，fail-safe 不破）。

## 开口项（如实挂账）

1. 端到端真证=B4 十三跑（乙授权、一例一跑、新 `atl_` 长名令牌）——预期全链首过。
2. 同名异 platformId 双观察形态（S3）后续撞 H1i 属预期 route:human——若未来需要
   单流双实体表征，另立契约议。
