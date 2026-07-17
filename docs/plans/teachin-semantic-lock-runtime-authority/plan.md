# teachin-semantic-lock-runtime-authority — plan（full）

> 本契约 supersede（取代）`teachin-semantic-lock-capability-hardening` 的运行期信任边界；旧 plan、golden、fixture 和 PRD 保持逐字节不变。

## 1. 目标

不透明 capability（能力句柄）只能隐藏数据，不能把调用者伪造的数据变成权威。本契约四条边界必须同时成立：

1. 运行期适配器必须来自仓内可审计 driver（驱动实现）注册表或可验证发布根；公共 API 不得接受调用者提供的 `read` 函数并为它铸造权威能力。
2. run context（本轮运行上下文）必须由可信 runner（运行编排器）铸造不透明句柄；调用者普通 `{runKey}` 不是权威，两个不同句柄即使字符串相同也不得跨 run 复用 successor（后继身份证明）。
3. 每个 atom/action（原子/动作）的必需对象角色必须来自人签冻结的动作身份 policy（策略）；关系写缺 `source` 或 `target`、mutation（变更动作）空绑定、未知角色均整份拒绝。
4. 冻结身份锁的信任根不得是调用者可同时改写的 PRD 与 lock 文件。权威必须来自可验证发布清单/公钥签名/可信父进程能力之一；仓内路径须真实路径包含、拒 symlink（符号链接），且同一文件句柄完成校验与读取。

## 2. 信任边界

### 2.1 驱动根

- 禁止“调用者传函数 → 模块包成 opaque capability（不透明能力）”。
- 合法适配器必须能回溯到固定 driver id、实现字节摘要和发布根；调用者不能覆盖 reader、模块路径或摘要。
- 真实 AI 中台读回源与 driver 注册的正向证据走 `route:human`；零 SUT 门禁只冻结伪 reader 必拒。

### 2.2 运行身份

- 不透明 run context 的权威由可信 runner 产生；`runKey` 只能作诊断标签，不能作身份。
- runtime capability 必须绑定 driver capability 和 run capability 的对象身份，不得只存字符串。
- successor 前后读回必须是同 driver capability + 同 run capability；任一不同整体零动作。

### 2.3 角色完整性

- 冻结动作身份 policy 至少声明 `{atom,action,mutation,relationWrite,roles:[{role,kind}]}`。
- 验证器以 policy 的必需角色为主集合，反查 events 和 lock set；不能只比对两边“现有数量相等”。
- relation write 必须同时锁 `source + target`；非关系 mutation 也必须有 policy 规定的主体角色。

### 2.4 发布信任根与路径

- 发布根的真值不得与 lock bytes 同时由当前调用者可写。允许的实现是受信发布清单、公钥验签或可信父进程不透明能力；普通工作树 PRD checksum 只是内容索引，不是 trust root（信任根）。
- 调用者只能选择已发布 id；不能传 PRD path、lock path、reader、bytes 或 digest。
- 最终文件和每个父路径段拒绝 symlink；realpath（真实路径）必须留在受信根内。校验与使用必须对同一已打开文件句柄完成，避免 check/use 分离。

## 3. 验收点

### 可命令化

1. `teachin-semantic-lock-runtime-authority.zero-sut.golden.mjs` 驱动根攻击：调用者传入返回完全匹配 receipt 的 `read` 函数，不得铸造可得 `SAME/allowAction` 的能力。
2. 同一 golden 运行身份攻击：普通 `{runKey}` 不得生成 runtime capability；两个不同 context 即使 `runKey` 相同也不得建 successor。
3. 同一 golden 角色策略攻击：已发布的四组负 fixture（relation source-only、relation target-only、mutation empty、unknown role）均必须在 lock-set verify 阶段拒绝。
4. 同一 golden 发布根攻击：临时仓中由同一调用者新写 PRD + lock 不得铸 authority；仓内路径经 symlink/realpath 逃出也必须拒绝。

### 可观察性申报

- `route:human`：真实 AI 中台 driver 从仓内受信注册到登录后只读扫描的调用链，需联网真机录屏、视觉复核、每用例独立 HTML 和附件。
- `route:human`：可信 runner 铸造的 run capability 与真正浏览器/session 生命周期同源，关窗、重连或跨运行后旧能力不可复用。
- `route:human`：真实 compile 产生的每个 mutation/relation event 与冻结动作身份 policy 角色完整对齐。
- `route:human`：发布清单/公钥/父进程能力在 Win PowerShell、WSL 和 macOS 的安装分发边界，以及 symlink 与文件替换的实际防护。

## 4. 停止条件

- 新 golden 的四类攻击在 `cb99ab6` 上真实为 RED，不得用“未实现正向 API”代替攻击证据。
- golden、负 fixture 与冻结动作身份 policy 全部进 `testChecksums`；任意一字节变动即 Test Ratchet（测试棘轮）红。
- 新 PRD 的 `passes` 初始为 `false`，`node loop-kit/bin/gate.mjs --dry --prd loop/prd-teachin-semantic-lock-runtime-authority.json` 可消费。
- 本工序不改 `lib/`/`bin/`，不运行 SUT、fake、fixture server、浏览器或网络。
