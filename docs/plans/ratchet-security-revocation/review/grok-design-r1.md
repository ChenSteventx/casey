# Grok 设计审 round 1

- 评审器：Grok 4.5，只读直开 Casey 与兄弟 `loop-kit`。
- 结论：FAIL（1 HIGH / 6 MED / 3 LOW）。
- pi.dev 同轮误走了裸 WSL CLI，并据 `--list-models` / `No API key` 误判调用入口；Steven 已纠正：pi.dev
  可用且认证由既定调用链内联，禁止再到公开位置找认证信息。该次输出不构成 pi.dev 可用性证据。未调用 CC。

## 发现与处置

| ID | 等级 | 发现 | 处置 |
|---|---|---|---|
| H1 | HIGH | 未写死只能迁移四维精确命中的 `CHECKSUM_MISMATCH`，可能吞 conflict/missing/outside-root | 采信；D1 固定 issue code 与 `(file,prd,expected,actual)`，其它 issue 永不删除，D7 加组合红例 |
| M1 | MED | gzip 上限没有常量与计量面 | 采信；压缩 256 KiB、流式解压输出 1 MiB，越限 invalid、不落盘 |
| M2 | MED | “当前安全有效性”大于 closure meta 实际证明面，active-suite 未入链 | 采信推荐甲；降为“当前撤销治理有效性”，active-suite 仍由 s4 承担、只复跑不作豁免 |
| M3 | MED | closure PRD 现状未冻结 successor golden | 采信；标为强制 delta，加入 closure PRD 后精确人签 |
| M4 | MED | D6 漏 C2 baseline 与旧反向索引金牌涟漪 | 采信；加入 raw/normalized、C2/C6、ratchet golden/PRD 与并集求影响面 |
| M5 | MED | discovery 未分普通非候选与 exact kind 的无效候选 | 采信；写成六步算法，exact kind 后任何 schema 错必 invalid |
| M6 | MED | successor story/evidence/acceptance 绑定偏弱 | 采信；story 唯一、acceptance 全字匹配、evidence 固定 gate 形状 |
| L1 | LOW | owner PRD 指代混淆 | 采信；区分 `revokedOwnerPrd` 与 `receiptFreezingPrd` |
| L2 | LOW | 未限定 discovery 只在 verify | 采信；D5 明确 index/affected 不变 |
| L3 | LOW | 新五行校验严于旧 meta-golden | 采信说明；ratchet 是加严超集，不扩大旧 s3 golden 实现范围 |

## round 2 入口

上述 10 项已全部写入 GRILL。round 2 必须重新核对是否仍有普通 mismatch 洗绿口、冻结闭环自引用、C6
锚迁移策略与 D4 责任边界；不得只看本处置表判 PASS。
