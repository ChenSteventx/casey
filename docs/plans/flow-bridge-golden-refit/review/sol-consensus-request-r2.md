# sol max 共识请求 R2 — flow-bridge-golden-refit plan v2

你 R1（review/sol-consensus-reply-r1.md）给 7 条阻断，Claude 已逐条并入成 v2（docs/plans/flow-bridge-golden-refit/plan.md，顶部 v2 标注 dispositions）。本轮复审：逐条核 7 条是否消解、有无新引入，总判 v2 可进 accept 还是仍有阻断。

修法要点对照：
1. A 负向分支：C4/C5/C6/C7/C15 非目标原子补合法绑定 + 精确目标拒因断言；C10 保宽口径；C8/C12-C16 零改动。
2. 反向锁：exit 65 + 精确 ENTITY_BINDING_REQUIRED_ROLES_INVALID + 零落盘；突变改内核 mutant（绕 requiredFlowEntityBindings 调用→必红→sha256 核还原），accept 阶段执行。
3. B1：双 server 成对证据（同合法包，无 loader=精确 DRIVER_NOT_PUBLISHED+零台账 / 有 loader=accepted）；降级判据=仅当两跑均拒于 DRIVER_NOT_PUBLISHED；改写 prd-mcp-parity 语义文本。
4. B2：17 check 三列账（保留/迁移/丢失）；C2d 改 authority 拒因、C2f/C2h 改精确 CRED_GATE_HIT+exit65 并另建纯函数 check 直调 distill 本地编码门保原防护红证；挂账登记精确丢失断言+接手条件+route；改写 prd 文本。
5. 租约：全部 try/finally、测试体禁 process.exit、cleanup 非 ok 即红、外扫仅第二层。
6. 复 gate：先全部定稿人签（record-distill checksum 与 authority-root 同批先行——后者读并复核前者）、静态安全闭包、按冻结执行账（22 prd × acceptance × 安全 × 预期翻转）固定顺序一次执行。
7. 超时另立 direct 已采纳（移入不在范围）。
8. B 家族共同夹具换临时 Ed25519 动态签名先例（observation-identity-contract-closure），共享冻结件默认不动不扩签；B3 承认断言语义变更 + acceptance 命令改带 loader 入人签。

同标准对抗核。可只读访问本仓（绝不运行金牌/夹具 SUT）。产出：逐条判 + file:line + 总判（可进 accept / 阻断项+修法）。
