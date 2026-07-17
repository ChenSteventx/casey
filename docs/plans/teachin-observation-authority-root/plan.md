# teachin-observation-authority-root — plan（full）

目标：以替代性根契约收紧身份观察的最终受信边界。`accepted authority`（已接收入账权威句柄）不能由公开纯函数根据调用方提供的 `ledgerEntries`、bytes 或 `pathFacts` 自铸；`trusted:true` 还必须同时消费平台运行时铸造的 opaque readback receipt（不透明读回收据），并与本次事件和业务对象的全部身份字段精确绑定。百分号解码和 JavaScript `Proxy`（代理对象）/accessor（访问器属性）在 package、intake、ledger、receipt 四层统一 fail-closed。

本契约 supersede（替代并继续收严）`teachin-observation-authority-hardening`。原计划、原 golden、原 PRD 与原 checksum 全部保持不变，只作为历史证据；本契约不把旧门禁的历史 `passes` 冒充当前结论。

## 1. P0：Accepted authority 的唯一铸造根

1. `verifyTeachInPackage` 可以做纯字节结构复核，但其结果不能与调用方拼出的 `ledgerEntries` 联合后从公开 API 获得 accepted authority。
2. `verifyIntakenPackage` 等公开纯函数若保留，最多返回结构复核结论；不能返回可被身份观察入口接受的不透明 accepted authority。普通对象、复制字段、伪 `WeakMap` 句柄、调用方提供的 bytes、`pathFacts` 或 accepted 行均不能越权。
3. 新的正向入口只能二选一：
   - 固定 canonical reader（规范读者）：从 `<caseId>/record-capture/` 固定定名的 capture、sidecar、manifest、append-only 台账读取；或
   - real append transaction（真实追加事务）：同一次受控事务打开并联合验证三件套、追加 accepted 行，然后直接铸造句柄。
4. 两种入口都必须绑定 `caseId`、固定文件名/同级路径、每份已打开文件的稳定 identity（身份）、三件套最终字节摘要、最新 accepted 行和观察元数据。软链、非普通文件、读前后 identity 改变、旧 accepted 行匹配但最新行不匹配均拒绝。
5. golden 的正向路径调用真实追加事务，不在测试代码里合成 accepted 行；不得因测试提供一段看似合法的台账 JSON 就授予权威。

## 2. P0：平台运行时 readback receipt

1. accepted authority 只证明录制包与入账事实，不能单独产生 `trusted:true`。缺平台运行时 readback receipt 时只能 `trusted:false`，并保持 pending/`NEEDS_HUMAN` 路由语义。
2. readback receipt 必须是模块私有品牌的不透明句柄。plain object、可见字段拷贝、package/accepted authority 或 Proxy 均不得冒充。
3. receipt 由固定 `identity-readback-receipt.json` 的 canonical reader 消费；生产实现须把它限定为平台 driver/runtime 的落盘产物。golden 使用的固定 fixture 只冻结 I/O contract（输入输出约定），不冒充真实浏览器、真实平台或文件系统 TOCTOU 已验证。
4. receipt 与 sidecar/capture 精确绑定：`caseId`、`eventSeq`、`kind`、`name`、`code`、`platformId`、`scopeFingerprint` 和 `evidenceSha256` 任一不一致均拒绝。观察 schema 加入 `evidenceSha256`，它绑定平台读回证据的规范化摘要，不允许由文本相似推断。
5. 任意 `click`/`dblclick`/`nav`，即使 event `text` 与目标同名，也不能在缺 receipt 或 receipt 指向另一对象时让 sidecar `trusted:true`。输入类动作继续不构成读回证据。

## 3. HIGH：百分号解码后的控制字符门

1. 每个可落盘 string 在原值、每轮 `%HH` 解码结果及最终不动点都扫描 C0（U+0000–U+001F）、C1（U+0080–U+009F）和 DEL（U+007F）。
2. `to%00ken`、`%0a`、`%09`、`%7f`、`%C2%80` 及其多轮编码均拒绝；控制字符不能被插入敏感关键词中绕过。
3. UTF-8 截断、overlong、非法续字节、混入非法 escape 和轮数内不收敛继续固定类别 fail-closed。普通自然语言裸 `%` 保持合法。

## 4. HIGH：package / intake / ledger / receipt 的零执行快照边界

1. 四层所有公开入口均在解构、`Object.keys`、`JSON.stringify`、spread、迭代、prototype/descriptor 反射或业务校验前拒绝顶层与任意嵌套 Proxy。
2. 自有 accessor/getter/setter、symbol、非 enumerable 数据、异常 prototype 和循环引用统一拒绝；getter/setter 执行次数必须为 0。
3. Proxy 的 `get`、`ownKeys`、`getOwnPropertyDescriptor`、`getPrototypeOf`、`has`、`getOwnPropertySymbols` 等 trap 调用次数必须为 0。不能通过捕获 trap 抛错冒充安全拒绝。
4. 失败只返回/抛固定类别码，不回显对象、路径、证据或敏感字节，也不得发生 ledger append 副作用。

## 5. 可命令化验收

- `node tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs`

新增 golden 必须在实现前真实红，并覆盖：公开 plain issuer 自铸 accepted authority、真实追加事务正向、accepted authority 单独不得 trusted、opaque readback receipt 正向与八字段逐一换绑、同名 click 不得给无关对象授权、C0/C1/DEL 与截断编码、四层顶层/嵌套 Proxy 和 accessor 零执行，以及所有被替代 frozen checksum 不变。

固定 fixture `tests/_golden/fixtures/teachin-observation-authority-root/identity-readback-receipt.json` 仅代表 canonical receipt reader 的 I/O contract；它与 golden 一起 checksum 冻结。

## 6. 可观察性申报

- 真平台 driver/runtime 是否是 `identity-readback-receipt.json` 的唯一写者、是否从同一次平台响应/DOM 读回铸造证据摘要，零 SUT golden 无法证明，`route:human`。
- canonical reader 在真实文件系统中是否对同一已打开文件完成读前/读后 identity 比较、抵御 symlink 与 TOCTOU，fixture 只能证明接口契约，`route:human`。
- workflow、agent 与其它名字+编号对象在真实 AI 中台上的 event/object/readback 一致性，须联网真机逐 case 录屏与视觉复核，`route:human`。
- 本契约禁止启动 SUT、fake、fixture server、浏览器或网络；本地临时目录 I/O 只用于真实 append transaction 的零 SUT 验收，`route:human`。

## 7. 停止条件

新 golden 取得真实红输出并存档；golden 与固定 fixture 的 sha256 写入新 PRD；`gate --dry --prd <新 PRD>`、`git diff --check` 通过。到此停止，不改生产实现、不运行 SUT/browser/network、不改任何旧 frozen 资产。
