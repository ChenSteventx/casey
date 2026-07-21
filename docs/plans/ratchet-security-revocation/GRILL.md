# ratchet-security-revocation：设计决策记录

> 状态：kernel 级 `full` 契约，设计审前草案。D1/D3 继承 Steven 在
> `checksum-drift-closure` 的签认；D4 是考古后暴露的语义澄清，须经双设计审与 Steven 再签才可进入 plan。

## 0. 已验证事实

- 全仓 ratchet 当前只剩两条 `CHECKSUM_MISMATCH`：
  `teachin-observation-transaction-root` 与 `teachin-observation-driver-canonical-root`。
- 两个 owner PRD 都保留原 checksum，且 story 均为 `passes:false`；当前 executable 是相同的五行
  `SECURITY_REVOKED_GOLDEN_TOMBSTONE`、退出 78 的墓碑。
- 两份 gzip 归档解压后的 sha256 分别精确等于两个 owner PRD 的原 checksum。
- `tests/_golden/fixtures/observation-runtime-trust-root/security-revocation.json` 已由
  `prd-observation-runtime-trust-root` 冻结；其撤销 story 刚实跑为 GREEN 4/4。
- 原 successor `teachin-observation-safe-case-lease-v2` 的历史 gate 是 17/17 GREEN；安全撤销与 production
  registry 收严后，当前按设计变为 11/17。`observation-runtime-trust-root/plan.md` 明文规定：旧 PRD 的
  历史 `passes:true` 不改，当前覆盖由 active-suite 与撤销 story 接管。直接复跑旧 successor 并要求 17/17
  会把安全墓碑本身判成回归。
- 独立包 `/mnt/d/ctx/heren/loop-kit` 当前干净，`master@ea5ed85`；Casey 是已迁消费者，经期望存档与
  `kit-lock` 三方锁定。autotester 尚未按 ADR-0008 迁移，仍用自己的孵化副本且工作树有既有脏数据；本契约
  不写 autotester。

## 1. 不变量

1. `SECURITY_REVOKED` 是具名安全撤销状态，不是 `PASS`，不得把 owner story 改绿或把 owner checksum
   重签到墓碑字节。
2. 只有完整、单义、内容寻址且当前仍被冻结的安全撤销回执才能把对应的普通 checksum mismatch 转为
   `SECURITY_REVOKED`；任一条件缺失都保持 RED。
3. ratchet 全程只读，不执行墓碑、归档、successor golden 或任意 acceptance 命令。
4. 普通冻结文件、普通 mismatch、反向索引与 `affected` 行为保持兼容；不能让安全例外成为通用豁免口。
5. 改独立包必须同步 Casey 期望存档、`kit-lock` 与 `prd-loop-kit-extract` 的精确 checksum，并经人签。

## 2. 决策

### D1：闭合安全撤销变为独立状态（已签，甲）

通过全部校验的目标 mismatch 从 `issues[]` 移出，进入只读结果的 `revocations[]`：

```json
{
  "code": "SECURITY_REVOKED",
  "file": "tests/_golden/…",
  "prd": "loop/prd-….json",
  "expected": "原 frozen sha256",
  "actual": "当前墓碑 sha256",
  "receipt": "被冻结的回执路径"
}
```

`ok` 仍只由 `issues.length === 0` 决定；只有闭合撤销、没有其他问题时 verify exit 0。人类输出先打印
`SECURITY_REVOKED <file>`，再打印 RED。此状态只说明旧可执行门禁已安全退出活跃套件，不宣称旧 story PASS。

迁移闭集写死为：只能迁移 `code === CHECKSUM_MISMATCH` 且
`(file, prd, expected, actual)` 四维分别精确等于
`(entry.executablePath, entry.ownerPrd, entry.originalSha256, entry.tombstoneSha256)` 的单条 issue。
`CONFLICTING_EXPECTATIONS`、`FILE_MISSING`、`FILE_OUTSIDE_ROOT`、`FILE_UNREADABLE`、`UNSAFE_PATH`、
`SECURITY_REVOCATION_INVALID` 与任何其它 issue 永不因撤销而删除。同文件存在其它 issue 时仍 RED；无效回执
只追加具名 invalid issue，并保留原 mismatch。

### D2：回执升级为严格 schemaVersion 2

发现算法固定为：

1. 只枚举反向索引中 `consistent === true`、当前 regular file sha256 等于唯一 expected 的 `.json` 路径；
   路径必须在 root 内且不是 symlink。
2. UTF-8/JSON parse 失败或无 exact
   `artifactKind: acceptance-gate-security-revocation-receipt` 时视为普通非候选，不污染无撤销仓。
3. 一旦 artifactKind exact 命中，就必须通过下述 schemaVersion 2 exact-key 校验；schema 版本、字段或内容
   任一错误都产生 `SECURITY_REVOCATION_INVALID`，不能静默退回非候选。

因此不扫描未冻结文件，不接受带外豁免。现有 schemaVersion 1 回执在落地前必须升级；若包实现先到而回执
尚未升级，全仓保持两条 mismatch RED，属于安全的迁移中间态。

回执升级为 exact-key schemaVersion 2。顶层沿用现有 reason/status/successor 字段，并新增：

- `closurePrd`、`closureStoryId`、`closureGolden`：当前撤销治理的权威绿链；
- `successorStoryId`：历史 successor 的精确 story；
- 每个 revoked entry 新增 `ownerPrd`、`ownerStoryId`、`tombstoneSha256`。

未知键、缺键、重复路径、非规范仓内相对路径、非 64 位小写 sha256、同一 executable 被多回执认领，均视为
无效。无效候选产生 `SECURITY_REVOCATION_INVALID`，目标 mismatch 仍保留，绝不降级成告警。

### D3：组合校验闭集（已签，甲；本节把条件机械化）

对每个 revoked entry 必须同时满足：

1. owner PRD 存在且正是该 executable 的反向索引引用者；owner story id 唯一存在、`passes:false`，owner
   `testChecksums[executable] === originalSha256`。
2. 当前 executable 为 root 内 regular file、非 symlink；sha256 等于 `tombstoneSha256`，且 UTF-8 字节严格
   匹配五行 fail-fast 语法：shebang、唯一 marker、单行 reason 注释、唯一 `console.error` 安全撤销消息、
   `process.exit(78)`。不允许 import、额外语句、转义续行或尾随内容。
3. archive 为 root 内 regular file、非 symlink；gzip 必须完整解压，解压字节 sha256 精确等于
   `originalSha256`。压缩文件 `stat.size` 上限固定为
   `MAX_SECURITY_REVOCATION_ARCHIVE_COMPRESSED_BYTES = 262144`，流式 gunzip 的累计输出上限固定为
   `MAX_SECURITY_REVOCATION_ARCHIVE_INFLATED_BYTES = 1048576`；先检查压缩大小，解压每个 chunk 前检查累计
   输出，任一越限均为 `SECURITY_REVOCATION_INVALID`。不使用一次性无界 `gunzipSync`，不把归档写回磁盘。
4. successor PRD/golden/support 均为 root 内 regular file；successor PRD 的指定 story 有历史
   `passes:true`，evidence 必须是匹配 `^gate@[^ ]+ 全部 acceptance exit 0$` 的字符串；
   `successorStoryId` 在 stories 中唯一，acceptance 为字符串数组且有一个元素全字等于
   `node <successorGolden>`（非 substring），并以当前 checksum 冻结 successor golden 与 safe-lease support。
5. closure PRD 的指定 story 当前为 `passes:true` 与非空 gate evidence，其 acceptance 精确包含
   `node <closureGolden>`；closure PRD 以当前 checksum 冻结回执、closure golden、successor golden 与
   safe-lease support。现网 closure PRD 尚未冻结 successor golden；将它加入
   `prd-observation-runtime-trust-root.testChecksums` 并精确人签是本契约的强制 delta，不得把现状误判为已满足。
   closure story 的唯一性、evidence 形状与 acceptance 全字匹配规则同第 4 条。这样回执不能自称闭合，必须
   被已签的外部 PRD 反向钉住。
6. receipt 自身在反向索引中 expectation 一致且当前 checksum 匹配。所有路径集合一一对应，无孤儿 entry。

### D4：successor 的“绿”采用历史签署 + 当前撤销治理双层链（待再签）

不直接执行已按设计被安全事件改成 11/17 的旧 successor golden，也不把旧 PRD 改成 false。这里的“绿”定义为：

- 历史替代能力：successor story 保留原 gate `passes:true`、evidence、golden/support 当前 checksum 冻结；
- 当前撤销治理有效性：closure story `passes:true`、evidence、回执与 meta-golden 当前 checksum 冻结，并由
  本契约实施前实跑该 closure story GREEN；这里只证明 tombstone/archive/receipt/closure meta 闭合；
- ratchet 本身静态复验两层内容关系，不在 verify 内执行任意测试。

理由：当前旧 successor 的唯一 D7 红正是“原 executable 仍应等于原 checksum”，与合法墓碑化互斥；硬要求它
当前 17/17 等价于要求撤销失效。双层链保留历史事实，并以新的撤销门禁承担当前撤销治理有效性。
production 11/17 与隔离 publication 16/17 的覆盖有效性仍由已签 s4/active-suite 承担，不进 ratchet 的
安全撤销闭集；本契约复跑 s4 作受影响金牌，但不让回执靠它洗绿。

### D5：兼容输出只做加法

- `verifyRatchet()` 保留 schemaVersion 1、`ok`、`summary`、`issues`；新增 `revocations` 与
  `summary.revocationCount`。
- `issueCount` 仍只计 RED issue，不计 `SECURITY_REVOKED`。
- 回执发现与验证只发生在 `verifyRatchet()`；`buildRatchetIndex()`、`findAffectedPrds()` 的字段集、排序键、
  反查语义与 exit 不变。
- JSON 与人类输出均按稳定键排序；无回执仓库得到 `revocations:[]`，其既有 RED/GREEN 与退出码不变。

### D6：跨仓涟漪边界

实施只改：

1. 独立 `loop-kit/bin/ratchet.mjs` 与包 README；
2. Casey 的同字节期望存档副本、`loop-kit/kit-lock.json`、`prd-loop-kit-extract` 精确 checksum；
3. C2 观测基线中所有 ratchet raw/normalized 记录（包括其写集里携带的包 hash），以及因此变化的
   `tests/_golden/loop-kit-extract.golden.mjs` checksum；
4. `tests/_golden/ratchet-reverse-index.golden.mjs` 与 `prd-ratchet-reverse-index`：扩成兼容回归时必须保持其
   C6 git blob 锚约束可解释；若字节必改，则本契约显式解除该旧“零重签”锚并由新兼容金牌接管，不能静默改锚；
5. 回执 v2、冻结回执的 `receiptFreezingPrd`（即 closure PRD）对应 checksum、新增 successor golden 冻结项、
   本契约 golden/PRD/证据文档。禁止修改两个 `revokedOwnerPrd` 的 executable checksum 与 `passes:false`。

C0 三方一致、C2 完整基线、旧反向索引金牌/其后继兼容金牌必须同批复验与人签；实际受影响文件用 ratchet
`affected` + 全 baseline hash 搜索双向求并集，不能只按上述手列清单。

autotester 尚未迁移且无 ratchet，故只跑其既有确定性 kit 测试（若环境允许）作第二消费者无回归观察；不改其
脏工作树，不宣称它已消费新 ratchet。ADR-0008 的“autotester 后迁”不在本契约偷跑。

### D7：验收矩阵

新 zero-SUT golden 在临时仓构造至少以下组：

1. 完整 v2 链：两条 mismatch 均转为 `SECURITY_REVOKED`，verify GREEN/exit 0，owner 仍 false/原 checksum。
2. receipt 未冻结、receipt checksum 漂移、schema/键/路径/哈希错误、重复认领：保持 mismatch RED。
3. owner 非 false/原 hash 不等/引用不对应：RED。
4. 墓碑多一条语句、exit 非 78、marker/message 不符、symlink：RED。
5. archive 缺失、非 gzip、解压 hash 不等、超上限、symlink：RED。
6. successor/closure PRD、story、evidence、acceptance、冻结 checksum 任一不符：RED。
7. 普通匹配、普通 mismatch、冲突 expectation、missing、affected、index 均保持既有行为与稳定排序；尤其
   “合法撤销 + 同文件 conflicting expectation / missing / outside-root”必须仍 RED，非 mismatch issue 不可被吞。
8. Casey 真回执：全仓 verify 只出现两条 `SECURITY_REVOKED`、零 issue；C0 三方一致、旧 ratchet 反向索引
   金牌与 tier1 全部复验。

## 3. 人签点

- 已继承：D1=甲、D3=甲；owner checksum 与 `passes:false` 永不改。
- 待签：D4 的“历史 successor 绿 + 当前 closure 绿”双层定义。
- 实施后待精确 sha256 签认：新 golden、回执 v2、包 ratchet/README、Casey 期望副本、C2 基线、`kit-lock`，
  以及所有因冻结面更新而需重签的 `receiptFreezingPrd` / 兼容金牌 PRD 条目；不包含两份
  `revokedOwnerPrd` 的旧 executable checksum。

## 4. 非目标

- 不恢复或执行两份旧 unsafe body。
- 不修改 Casey 生产业务实现、裁判或 SUT。
- 不把 benign supersession receipt 自动纳入安全撤销；若未来需要，另立 artifactKind/schema。
- 不迁移 autotester，不清理其既有脏数据，不引入网络或第三方依赖。
