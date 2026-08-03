# learn — entity-lock-resign-revocation

本契约把既存实体锁的换签从一句拒绝文案补成显式、可审计、可恢复的生产路径。范围保持在 publication foundation：旧锁原始字节按完整 sha256 归档，撤销 journal 追加闭合记录，新锁与 PRD 经现役事务以 PRD-last 顺序发布；不改 schema、receipt、replay admission、裁判或 destructive continuity。

## 沉淀

1. **换签授权必须同时绑定意图和旧 authority。** 独立 `--resign-entity-locks` 与既有 `--resign` 必须同时出现；更关键的是，旧 PRD 登记的 checksum 必须与旧锁物理字节精确一致。仅凭“文件存在”或 caller 自报 old hash 都不足以授权替换。
2. **恢复逻辑也必须走同一验证边界。** publication journal 只能提供已承诺的路径和摘要，不能成为跳过规范验证的捷径。恢复从 byte-preserving 的旧 journal 前缀和已验证旧 hash 重建计划，再要求完整目标文本相等。
3. **追加型证据要同时防 fork 与 duplicate generation。** 同一 old hash 指向不同 successor 是 fork；即使 successor 相同，再出现一次也会制造代际歧义。因此两者都 fail-closed，且由 hardening golden 直接冻结。
4. **content-addressed 不等于可覆盖。** 完整 hash 文件名避免截断碰撞，但既存同名文件仍须逐字节相同；同名异内容必须在 PRD 改变前 exit 65。
5. **模式矩阵应成为一个纯层事实。** 双旗标、bundle 是否完整、目标是否存在、是否处于 journal recovery 的组合集中到一个模块，避免 CLI 编排分支逐渐形成互相矛盾的隐式状态机。
6. **共享 recovery primitive 要保持领域无知。** bounded scan、no-follow read、journal-bound uniqueness 属于通用发布恢复；实体锁的规范校验、revocation 语义和 archive 命名仍由实体领域模块拥有。

## 评审闭环

Grok 4.5 R1 给出六项 `REVIEW_CHANGES_REQUIRED`，实现全部修复并增加独立 hardening golden；R2 直接读取完整仓库后明确返回 `REVIEW_APPROVE`。其后的 Codex final audit 又抓到“旧 expected 缺失时把 entity archive 误认成 expected archive”的真实恢复洞；新增独立红先行金牌复现 exit 65 后修复，Codex 复核 `APPROVE`，Grok R3 再次明确返回 `REVIEW_APPROVE`。原卷与处置见 `reviews/`，审计账见 `loop/audit.jsonl`。

R3 后仍有非阻塞跟进：expected archive recovery 的 journal 顺序约定、entity-lock recovery 不覆盖早期 journal-only 候选、纯层 `mode` 尚未供编排消费、CLI 没有逐字段枚举全部 metadata mutation，以及 slot classifier 未另设纯单元矩阵（真实 CLI 金牌已覆盖本次洞）。这些不改变本契约 frozen path 的 correctness，后续扩展 recovery 或 mutation matrix 时应先补对应验收。

## 未完成的人工作业与边界

- 三条现有 destructive 用例的真实实体锁换签及 Steven 人签仍为 `route:human / PENDING_STEVEN`；机器没有代签，也没有修改现有 case 冻结件。
- Windows reparse point、掉电持久性、跨目录 rename 行为留给安装包真机验收。
- destructive continuity v3 与逐删除步目标连续性仍是独立后继契约，本契约未提前实现。
- 本契约全程只跑本地 zero-SUT 验收，没有启动浏览器、server、隧道或真实 SUT，也没有读取凭据。
