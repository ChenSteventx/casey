# `teachin-semantic-lock-admission-authority` — plan（superseding）

本计划追加并取代 `teachin-semantic-lock-wiring-gaps` 中“文件自带签名即可成为准入授权”的子决定；旧 `plan`、旧 `PRD` 和已有冻结测试保持原字节不变。

目标：消除业务对象语义锁准入的两个假授权面。`calculateIdentityAdmissionSignature` 只可计算内容摘要，调用者即使自行填写 `signed:true`、`signerId`、`signedAt` 并重算摘要，也不能铸造浏览器启动、`compile --execute`、`compile --verify` 或 `replay` 权限。最终锁覆盖必须绑定完整对象身份，不能只凭角色命中。

## 1. 权限来源与分域

- 普通对象、普通 JSON 文件、调用者给出的摘要或复制对象都不是 authority（授权能力），不得让 `allowBrowserLaunch` 变为 `true`。
- 机器可验的正向路径只接受规范 `loop/prd-<prdId>.json` 中 `testChecksums[artifactKey]` 冻结的精确 artifact。读取 API 只接安全 `prdId`、已发布 `artifactKey` 与固定 `domain`，不得接调用者提供的 `prdPath`、artifact 原始字节、预期摘要或文件读取器。
- 读取成功后只返回无可枚举权限数据、不可复制伪造的 opaque handle（不透明句柄）。句柄由模块私有状态绑定 artifact 内容、来源 checksum 和 `execute`/`verify` 域；展开、序列化或手造的对象均失权。
- `executeAuthority` 只授权 `compile --execute`；`frozenLockAuthority` 只授权 `compile --verify`/`replay`。两域句柄互换必须拒绝。
- 另一条合法来源只能是真实人签交易铸造并可验证的 receipt（收据），其签发者身份、撤销、跨进程传递和真实操作证据本轮申报 `route:human`；不得用公开自哈希函数模拟。

## 2. 完整 binding 覆盖

- frozen binding 的规范身份为 `{stepId,intentId,atom,role,candidateId,lockId,receiptHash}`。若上游仍使用 `candidate`，必须在冻结前一次性规范成 `candidateId`；不得在准入比较时丢弃候选身份。
- artifact bindings 与当前 events 所需 bindings 必须集合严格相等。字段缺失、多余 binding、重复 binding、角色错误，或任一 `candidateId`、`lockId`、`receiptHash` 改变都拒绝。
- `requiredEventEntityBindings` 必须保留上述七个字段，不能继续只投影 `stepId/intentId/atom/role`。
- execute binding 仍精确绑定 `{sourceIntentId,candidateId,role}`；其 authority 与 flow、`TestCase` 原始字节 hash 同时一致才可授权。

## 3. 闭合输入与反射硬化

- authority envelope、每个 binding 及读取 options 均为闭合 schema：未知键、缺键、错误类型、未知域和重复 binding 一律 fail-closed。
- 公共入口在任何属性读取、参数解构或 canonical 化前先拒绝 `Proxy`；普通对象含 getter/setter 等 accessor 也在 getter 执行前拒绝。拒绝结果为结构化 `reason + nextAction`，不抛出调用者对象携带的异常。
- artifact checksum 验证使用文件原始字节；schema、签名/receipt 和 binding 验证发生在 checksum 命中之后，但 checksum 命中本身不豁免闭合 schema。

## 4. CLI 接线

- `bin/compile.mjs` 和 `bin/replay.mjs` 不得把 `readJson`/`readJsonSafe` 读出的普通对象直接作为身份 authority。
- 两者须在 `chromium.launch`、登录、临时文件、子进程和任何业务动作之前，经固定 `PRD`/checksum 读取器取得正确域的 opaque handle，再调用准入门。
- `compile --execute` 使用 `executeAuthority`；`compile --verify` 与 `replay` 使用 `frozenLockAuthority`。静态源码不得保留 `signedAuthority`/`frozenLocks` 普通对象准入接线。

## 5. 验收点

### 可命令化

`tests/_golden/teachin-semantic-lock-admission-authority.zero-sut.golden.mjs` 只调用纯函数与静态读取源码，覆盖：

1. execute/frozen artifact 被调用者公开自哈希后仍不能授权，普通 JSON 与 opaque handle 的复制品不能授权；固定 `PRD`/checksum 正向可授权且两域不可互换。
2. frozen binding 精确覆盖七字段；改 `candidateId`、`lockId`、`receiptHash`，缺失、多余或重复 binding 均拒绝。
3. 已登记 checksum 的未知顶层键、未知 binding 键和重复 binding artifact 仍拒绝。
4. 顶层与嵌套 `Proxy`、getter/setter 在任何 trap/getter 执行前拒绝。
5. `compile`/`replay` 静态接线只消费正确域 opaque handle，且门早于浏览器/子进程，不再授权普通文件对象。

测试及 fixture 不启动进程、浏览器、网络、fake SUT 或真实 SUT。

### 可观察性申报

- 真实人签交易是否由真实操作者铸造、receipt 是否可撤销且跨进程可验证：`route:human`，须审计日志与人签证据。
- 规范 `PRD` 与 artifact 在安装包、Win、macOS、WSL 的只读发布边界和文件替换时序：`route:human`，须跨平台实跑。
- `compile --execute`、`compile --verify`、`replay` 在真实 AI 中台确实于任何浏览器和业务动作前拒绝坏 authority：`route:human`，须联网真机、录屏与视觉复核。

## 6. 停止条件

本 `acceptance-gate` 工序只在新增 zero-SUT golden 确认真实红、全部新增 golden/fixture 已登记 SHA-256、独立 `PRD` 的 `passes:false` 且能被 `gate --dry` 消费后结束。不得修改生产实现，不得修改任何既有冻结文件，不得启动或连接 SUT。
