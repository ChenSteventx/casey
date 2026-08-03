# learn — teachin-cycle-axes-step-set

## 沉淀

- 共享 projector 的容器协议必须在 producer 的生产接缝金牌中用 canonical
  实现穿透，不能只以注入替身验证 adapter 编排。
- 涉及网络归因的回归样本必须携带非空 `firingStepId`；空记录会绕过
  `allStepIds.has(...)`，形成结构正确但生产接缝未触达的假绿。
- 同一既有金牌只保留 owner PRD 一把 checksum 锁。后继修单冻结计划与红证，
  owner PRD 走 amendment 与人签，避免双锁漂移。
- 把真机拒付推进到更内层是诊断进展，不是完成。只有最终码同次真机回放 exit 0
  与确定性证据成立，才能核销 route:human。

## 后续

- owner amendment 等 Steven 明签。
- 合并主树并复验静态门禁后，重跑 `tc_wf_list_smoke` 两击真机 cycle。
- 若出现新的具名拒付，按该事实另起窄契约，不回改本修单语义。
