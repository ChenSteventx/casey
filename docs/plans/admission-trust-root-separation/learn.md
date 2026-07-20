# learn — admission-trust-root-separation（阶段一：生产/测试信任根分离）

## 成果

kernel 车道契约六阶段走完（grill/plan/accept/loop/review done，learn 本笔）。给冻结身份准入件加签名进自哈希的必填 `audience` 字段（准入受众）+ 铸权后启动浏览器前的纯函数**凭据上下文门**（严格匹配受众与凭据上下文，不符 fail-closed 不启动浏览器），机制阻断「测试锁被误指向真 SUT 授权真实改动」。设计源 ADR-0010 + GRILL.md + plan.md（五决策，Steven 2026-07-20 亲裁）。

## 落地面（dev，从 954288c grill 到 1ad5863 review-done）

- kernel `lib/entity-semantic-lock-preflight.mjs`：`FROZEN`/`EXECUTE` 闭合结构加 `audience` 必填 + `validate*Artifact` 校验 ∈{test,production} + 铸权带受众进 handle provenance + reader 成功返回外露 audience + 新导出纯函数 `checkCredentialAudienceGate`（严格匹配/闭合入参/畸形 fail-closed）+ sign 写路径 `freezeEntityBindingsDraft` 收 audience 入参并产出。
- 接线 `bin/replay.mjs`（凭据加载后、浏览器前）+ `bin/compile.mjs`（受众门移到 admission 之前、凭据探测挪到浏览器前、按实际加载派生上下文、缺凭据 exit 65）+ 浏览器启动哨兵（两文件 chromium.launch 前 env 门控写哨兵+exit66 短路）。
- CLI/MCP：`bin/sign.mjs --audience` 必填 + `lib/sign-cli-args.mjs` 白名单 + `mcp/casey-server.mjs` signEntityArgs/inputSchema + `bin/casey.mjs` help。
- 迁移（按消费路径分，非目录一刀切）：3 个 preflight 夹具（admission-authority×2+sidecar）加 audience:test 重签 + prd checksum + sidecar golden(S2/S4)与 frozen schema 夹具更新 + 3 敌意夹具加 audience 为本意缺陷被拒；v2 授权链夹具（capability/v2）不动（其 ENTITY_LOCK_SET 独立结构不认 audience）。
- 验收：`admission-audience-credential-gate.zero-sut.golden`（C1-C7+C5/C5b frozen+execute 两域必填负向+签名篡改+Proxy）+ `admission-audience-wiring.golden`（W1 replay 受众门/W2 compile 凭据前移/W3 compile 受众门 + 正控 W1b replay 哨兵/W3b compile 哨兵，全用启动哨兵机械证浏览器前拦）。

## 教训（承重，已沉淀记忆）

1. **判金牌只信退出码、别 grep 失败标记串**（[[verify-goldens-by-exit-code]]）：round-1 我用 `grep "not ok"` 判「12 golden 全绿」，但 sidecar 用 `FAIL` 标记、实为 exit 1，误报绿 + 提交假绿，codex 当场逮。批量验金牌一律 `node g.mjs; echo $?`。
2. **异构评审对强制层改动真挣钱**（`kernel` 车道，[[heterogeneous-review-on-premises-not-just-code]]、[[review-uses-codex]]）：codex 六轮逐轮逼出我 Claude 家族自审看漏的洞——① 生产门零削弱不成立(锁不绑--sut) ② SKILL.md:107 冲突 ③ sign 写路径未迁移 ④ compile 假凭据判据 ⑤ W2 没真测门 ⑥ C5b 错误原因假绿 ⑦ 无产物≠没启动 ⑧ W1b 不证 compile 哨兵。换 Claude 同族自审一个都逮不出。**弱证/假绿是本契约反复踩的坑**：断言「拒了」不等于「为对的原因拒」、断言「产物缺席」不等于「没执行到那一步」——机械证据要能被反例突变（删掉被测代码则测试必红）证伪才算数。
3. **迁移共享冻结面按消费路径分**：`audience` 是 preflight schema 字段、只加 preflight 路夹具；v2 授权链夹具误加会破其独立校验（round-1 逮）。改冻结面前先查每个夹具「消费 golden 调哪条读路」。

## 明确不覆盖（ADR-0010 划界，后续契约）

密钥签名/signerId 认证（现内容自哈希可伪造、只防误用非铁心伪造）；不可变发布 manifest 根（v2 休眠空表未接入 replay）；receipt 内容读路复验（写强读弱）；撤销/CRL；锁绑 SUT/环境 scope。本契约诚实划界为「防误用/泄漏」这一有界威胁。

## 待人签 / 真机（route:human，kernel 纪律）

- 冻结夹具/金牌改动的 ADR-0004 人签（3 preflight 夹具重签 audience:test + sidecar golden/schema + 3 敌意夹具 + 新增验收金牌与夹具）。
- compile --execute 真机 execute 授权路径端到端 UAT 抽验（audience-mismatch 分支，W3 已覆盖其 hermetic 可执行回归证据）。

## 与阶段二关系

本契约独立加固、非阶段二前置阻塞（Q1 决策）。阶段二（hermetic 金牌套件生命周期重裁）主力走 zero-SUT、不碰准入门/不需锁；仍碰准入门的真机 UAT 件现有正确信任根可用。见 `docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md`。
