# teachin-semantic-lock-wiring-gaps — GRILL

## 用户裁定

Steven 裁定采用第三份固定名 `teach-in-package.json` 断开 capture 与 sidecar 的哈希环：capture 与 `identity-observations.json` 分别按最终完整字节计算 SHA-256，二者不互含对方 hash；package manifest 绑定 `caseId`、两个固定文件名与 hash、观察数量和观察 schema 版本。`intake` 只能从 capture 的规范同级布局推导另外两个文件，不接受任意路径。

## 承接事实

- `teachin-semantic-lock-wiring` 已冻结主链契约，但未覆盖 package 无环、intake 联合入账、flow 来源保真、compile sign 前 mutation 旁路和公共入口旁路。
- 本契约只补这五个接线盲区；不修改既有冻结测试与 checksum，不写生产实现。
- 所有验收只读源码或调用纯函数；不得启动或连接 SUT、fake、fixture、浏览器或网络。

## 决策

1. 规范目录固定含 `teach-in-capture.json`、`identity-observations.json`、`teach-in-package.json`。capture 最多只提示 sidecar 固定文件名和存在性，不含 sidecar hash；sidecar 不含 capture hash。
2. package manifest 以两个文件的最终完整字节为 digest domain（摘要域）；不得 parse 后重序列化再算 hash。manifest 自身不嵌自 hash；intake 台账独立记录 manifest 原始字节 hash。
3. package manifest 是闭合 schema；文件名固定，不接受绝对路径、`..`、分隔符或调用者覆盖。`intake` 从已通过规范布局校验的 capture 路径同级推导另外两文件。
4. `intake` 必须联合验证 manifest、capture、sidecar 后才可 accepted；台账同时绑定三份原始字节 hash、观察数量与版本。`distill` 在消费前重验三份 hash，任一替换均拒绝。
5. `flow-bridge` 必须把 mapping 的 `intentId` 原样保存为 `sourceIntentId`，并原样保存 `{candidateId, role}`；不得由 compile 生成的新 intent 覆盖来源身份，也不得猜 source/target。
6. `compile --execute` 若含业务对象 mutation，浏览器启动前必须校验独立签署的 pre-execution identity authority（预执行身份授权）。最终 events 尚未产生，因此不能拿最终 `entity-locks.frozen.json` 冒充该授权。
7. `compile --verify` 与 replay 已有最终 events，必须在浏览器启动前校验绑定最终 events 的 frozen locks；缺失或不匹配零启动、零动作。
8. `promptset`、`casey run/replay` 与 MCP 的 compile/sign/replay/run 面必须显式传递相应 authority/locks；禁止 `skip`、`allow unsigned` 或静默补默认路径。

## 非目标

- 不在本契约实现 package、adapter、preflight 或 CLI 接线。
- 不运行任何真机 UAT；真实 adapter、录屏与视觉复核继续 `route:human`。
- 不改变裁判结论，不让身份锁失败变成 PASS 或 SUT_DEFECT。
