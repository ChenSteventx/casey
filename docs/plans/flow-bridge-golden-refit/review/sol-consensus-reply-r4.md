1. **mutant：已消解。** v4 已补齐冻结文件投影、SHA 一致性、同树 baseline GREEN→mutant RED、主树前后 SHA 不变及临时树清理，证伪链闭合。[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:22)

2. **B1：已消解。** 正控成功后的 ledger 被明确设为基线；无 loader 验字节 SHA/行数零变化，有 loader 验恰增一条 accepted 且 generation 递增，不再要求“零台账”。[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:36)

3. **B3：未完全消解，仍阻断。** 主体条款已正确规定 PRD 保持裸 `node <金牌>`，loader 仅用于 bootstrap 启动 worker。[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:48)  
   但后文仍写“`+B3 acceptance 命令变更`”，与前述规定直接冲突。[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:64) 应删除该括注，明确 B3 只新增 worker/support checksum，acceptance 字符串不变。

4. **worker/support checksum 与人签：已消解。** 五入口金牌、worker、support、三个 support 消费 PRD、六个既有 checksum owner及旧无签名 receipt 负例均已闭合枚举。[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:75)

**总判：BLOCKED，暂不可进 accept。** 仅剩 B3 第 64 行的残留冲突；删改该处后，四项即可全部消解。本轮未发现其余新引入阻断，且未运行 golden、fixture、gate 或 SUT。