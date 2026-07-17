# 续接单——semantic-lock-cert-closure（2026-07-17 因额度暂停）

暂停时点状态（全部已核实）：

- 契约 light 车道，六阶段 grill/plan/accept 已 done（工件齐全），loop 未开工；熔断器已清零。
- 工作树零代码改动：三漂移金牌与夹具仍是 `e0ffe16` 冻结字节，`loop/prd-semantic-lock-cert-closure.json` 的 testChecksums 与磁盘一致。
- 两个执行代理在勘察阶段被停，未产生任何文件修改。
- 红证已采齐：`red/` 下七件（三漂移金牌 + 四孤儿），全部 exit 1。

续接动作（原样重发即可）：

1. 派「金牌重写」代理：重写 v2 / capability-hardening / runtime-authority 三金牌，夹具按新权威面（`verifyEntityLockSet({authority})`）构造，注入手法照抄绿件 `observation-identity-contract-closure.zero-sut.golden.mjs`（隔离 loader + 测试密钥）；生产 publications 表保持空。硬规则：禁削弱攻击断言、拒绝原因码必须对应攻击本身（反空洞）、疑似实现真 bug 即停手上报、lib/bin 不碰。
2. 派「孤儿考古」代理（只读）：artifacts / runtime（import 不存在模块）、intake-joint（import 错）、cli-wiring（疑似下一波故意红）四件定性：恢复模块 / 按吊销惯例（exit 78 SECURITY_REVOKED + successor）/ 修 import / 保持红。触 lib 即上报。
3. 主会话收口：亲核 diff（禁倒着裁）→ 按纪律②原地重签本 prd 与 prd-teachin-semantic-lock-v2 / -capability-hardening / -runtime-authority 的 testChecksums → gate 重证（passes 以实跑为准）→ 全仓 ratchet → 提交 → codex exec 异构评审（Claude 实现→codex 评，只喂 spec+diff+证据）→ audit.jsonl 入账 → advance loop/review/learn。

背景档案：主树 `docs/plans/closed-loop-evolution/review-claude-20260717.md`（三路核账 + Claude 攻击式评审 PASS + 红账清单）。上游未动账：W2 v2 引擎接线（cli-wiring 红基线即其规格）、W3 合并编排回 dev、W4 mountdelay 保真契约。两笔抢救提交已落：`902216e`（cross-os-onboarding）、`02f4361`（secure-config-powershell）。
