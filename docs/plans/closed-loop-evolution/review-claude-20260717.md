# 语义锁线 Claude 侧异构评审记录（2026-07-17）

> 评审家族铁律：codex 实现 → Claude 评。本档是该线首份落盘的异构评审结论（此前 pi 两次超时无结论，核心红队 review 只在会话内、未落盘）。
> 评审基线：分支 `observation-contract-closure` tip `e0ffe16`（2026-07-17 15:22，全线最新合流点，未并入 dev）。
> 方法：三路只读子代理——① worktree 现场与金牌实证复跑；② 5 个 P0 逐条取证（修复提交、回归测试、gate 复核）；③ 攻击式代码评审（构造反例逐条打）。

## 一、核对结论：codex 自报与实账吻合

- 自报五提交（`cb9fe9f` / `8f0fbbc` / `965a0e7` / `d63581d` / `35fbd4a`）全部存在，内容相符；自报截止 2026-07-16 17:03。
- 自报数字全部复跑属实：语义锁金牌 7/7、观察旁车金牌 8/8、旁车 gate 1/1；纯 node，零浏览器、零 fake-sut、零 fixture。
- 自报之后（2026-07-17 09:13–15:22）同线又推进约 60 提交：语义锁 v2 信任边界、运行时能力封口、旁车权威根与司机收据签名、wiring 准入门，合流至 `core-trust-integration`（`1fd5aa2`）与 `observation-contract-closure`（`e0ffe16`）。v2 与 wiring 分支已确认并入该 tip。
- 诚实姿态良好：pi 超时如实记录（`pi-attempt.md`）、未接线引擎全局 fail-closed、无一处把桩当完成。

## 二、评审结论：已接线信任路径 PASS（无 Critical/High/Medium）

对 `e0ffe16` 逐条构造攻击（假 SAME、收据篡改、后继伪造、MISSING 洗白、原型链与 `Proxy` 注入、fail-open catch、资源耗尽），在实际接线的信任路径上未找到可达缺陷：

- 观察旁车收据链：固定注册表 `Ed25519` 验签 + capture/observation/manifest 三重哈希逐字节绑定 + 每事务不可复制令牌（`Object.create(null)` 身份比对）+ 提交前 `O_NOFOLLOW` 与 `dev:ino` 重读；跨对象移植、重放旧收据、自签均拒。
- wiring 准入：授权根一律回到 `loop/prd-<case>.json` 的 `testChecksums` 字节校验；mutation 由已过闸 flow + 注册表机械判定（未知 atom 默认按 mutation），不接受调用者自称只读；缺授权 exit 65。
- 核心公开函数所有 catch 收敛到拒绝，无一落到放行；解析层有深度/条目/字节预算，显式栈非递归遍历，无灾难回溯正则。

关键架构事实（同时解释「安全」与「只算 35%」）：v2 运行时比对引擎（`lib/entity-semantic-lock-v2.mjs`，约 1545 行）在 `e0ffe16` 上零生产 import，权威根被硬编码拒绝（`runtimeBundleVerified=false`、publications 表故意清空），一切裁决恒 deny——攻击不可达是因为引擎处于 staged 状态、诚实 fail-closed。回放时「仍是同一对象」的运行时比对尚未接线，这是能力缺口而非缺陷（方向是多拒不是误放）。

## 三、5 个 P0 逐条处置（代码均闭合；测试背书是红账）

| P0 | 代码处置（均在 `9037899` 起的 v2 线） | 回归测试背书 |
|---|---|---|
| 缺 `platformId` 判 SAME | `platformId`/`revisionId` 恒为必比项，缺任一解析即拒 | 专用金牌红（够不到断言），无绿背书 |
| 收据篡改后重算 hash | 收据字节被锁集外部冻结 digest 锚住，自证 hash 仅二级 | 邻接绿（admission 层自哈希不铸权威）；v2 层篡改用例红 |
| successor 绕签署迁移 | 迁移须已签 + 链头一致 + 平台不换代 + 版本前进，成功即失效旧链头 | 入口旁路绿（presign/public bypass）；核心逻辑用例红 |
| 重复候选被 `physicalId` 去重吞掉 | 判 AMBIGUOUS 用原始候选计数，绝不折叠；同 id 异身份判冲突 | 专用金牌红，无绿背书 |
| 畸形候选洗成 MISSING | MISSING 仅当零候选且扫描完整；畸形或不完整一律 UNVERIFIED | 专用金牌红，无绿背书 |

## 四、合并前必须收口的红账（阻塞项）

1. `passes` 与实跑不符两处：`loop/prd-teachin-semantic-lock-v2.json` 与 `loop/prd-teachin-semantic-lock-capability-hardening.json` 提交态 story `passes:true`，但在 `e0ffe16` 实跑 gate 为 RED——正是给 5 个 P0 修复作证的两个契约。成因是后续硬化改了模块签名（`verifyEntityLockSet` 入参 `{lockSetBytes,...}` → `{authority}`）并清空 publications 表后未重跑 gate，属漂移性失实而非伪造，但按护栏必须重证或翻红后才能合并。
2. 编码 5 个 P0 攻击的金牌全线红：v2 金牌 0/4（签名漂移）、capability-hardening 0/4 与 runtime-authority 3/9（publications 清空后合法夹具也被拒，测试需按新权威面重写）。
3. 孤儿测试四件（合并遗留）：`teachin-semantic-lock-artifacts`/`-runtime` import 不存在的 lib 模块；`-cli-wiring`（`record.mjs` 未接 `createIdentityObservationSidecar`）；`-intake-joint`（import 错）。
4. 另有一批故意冻结的红基线（successor/hardening 系列）属 ATDD 先冻后填的下一波，非回归，与上述红账要区分对待。

## 五、低于 Medium 的硬化备选（挂账不阻塞）

- `loop/prd-<case>.json` 自身读取未走 `O_NOFOLLOW`（artifact 字节有，PRD 本体无），与既有「loop PRD 即受信根」威胁模型一致，可作硬化项。
- intake/distill 读 capture/sidecar/manifest 无字节上限（仅 ledger 有），超大文件先于快照门被全量解析；本地 CLI 面，非远程。
- 运行时对象身份比对接线后，本档「已接线路径 PASS」需对新增接线面重评。

## 六、欠账与现场记录

- pi 异构线仍欠：两次服务窗口超时无结论（`docs/plans/teachin-observation-sidecar/review/pi-attempt.md`），按纪律挂账、不冒充通过。
- `loop/audit.jsonl` 无语义锁线任何评审入账；本档为首份落盘记录。
- 契约台账滞后：teachin 各树 baton 多为六阶段全 false 或缺失，实现跑在契约推进之前。
- 现场卫生：本次评审的 gate 复跑曾在 closure 活树写入 10 个 prd 的 `passes`/evidence（gate 是唯一合法写者，属只读核账的副作用），已全部 `git checkout` 还原到提交态，真实结果以本档为准。`cross-os-onboarding` 与 `secure-config-powershell` 两个 `/tmp` worktree 各有一整块特性未提交（跨平台安装、账户配置），`/tmp` 重启即清，属最高优先抢救项。
