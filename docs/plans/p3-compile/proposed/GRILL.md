# P3 编译（p3-compile）—— 合并 grill 收口记录

> 状态：grill 收口（G1–G7 全数人签 + 机械决策记录 + `route:human` 挂账）。本文件是 `p3-compile`（full lane）grill 阶段交付物，`contract advance grill` 指向它。
>
> 输入：三份备料草稿——`reexpress-catalog-wf-crud.md`（重表达清单，7 步 → 4 intent / 15 event）+ `observed-reality-plan.md`（观测现状采集计划）+ `grill-draft.md`（决策草稿 G1–G7）。
>
> 范围：P3 = 相1 编译（LLM 读文本用例 → 真机跑 → `events.json` + `observed-<caseId>.json`）。路线已锁 ADR-0006：骑 regress `catalog_wf_crud` 重表达，不从零编译。契约 review 阶段按纪律走 codex 异构评审（护栏 #9，绝不同族自评）。

## 一、承重决策（人签，2026-07-02）

| # | 决策 | 拍板 |
|---|---|---|
| G1 | 编译期「唯一一次真机跑」边界 | 取 B：采集跑落 `events` + `observed` 后，同 session 立即用 `bin/replay.mjs` 回放核验一遍——验 events 可加载、可回放、点击身份门全 unique（ambiguous 雷点只有回放才暴露）。两次真机跑同属编译期一次性成本，日常回归仍零 LLM（ADR-0003 内核不破）；真机建/删两轮实体由保留前缀 + 收尾清理消化。 |
| G1 附属 | `CASE_DEFECT` 候选产出形态 | 入口可证缺席（目标 role/text 全 DOM count===0）时：events 不落该步 + 编译报告记候选与证据（count===0 实测），编译继续其余步；候选仅编译期/人签前有效（design §4.3）。 |
| G2 | 登录预备动作复用件 | 取 A：按 ADR-0001 拷快照范式引入 autotester `lib/paths.mjs` 登录选择器 + `loadCreds`（`.auth/credentials.json`，env 可覆盖）+ `loadSiteConfig`（site.json 深合并）；B 的 token 注入留作后补加速层。红线不变量：凭据只经 `.auth/` 与 env 进内存，绝不进 events/observed/日志/编译报告；site.json 引用一律写「site.json 的 `target.startUrl`」。术语已登记 CONTEXT.md。 |
| G3 分岔一 | flow 草稿中间产物 | 取 A：`flow-<caseId>.json` 落盘为正式中间产物，过 `compile-gate` 双闸 + 人 confirm 后才准真机跑——破坏性原子上真机前有人眼一道，也是 flow→events→verdict 对账追溯的锚。 |
| G3 分岔二 | 注册表快照范围 | 整表 60 原子快照（后续飞轮条目直接吃），带 `snapshotOf` 溯源字段。 |
| G4 | `expected[]` 预草 | 取 A 不预草：相位边界清晰、LLM 准入面最小；「语境最全」的价值由交接面第 3 件（TestCase 意图留痕）承接——`assert.onPage`/`assert.noErrorToast` 不产 event，其意图必须在对应 intent 的语义/expected 提示里留痕。 |
| G5 | 凭据扫描执行位（护栏 #7） | 取 B：把 `lib/report.mjs` 凭据兜底门抽成共享 helper，编译器所有落盘口统一过门；加固——observed `requestLog[].url` 落盘前剥 query 或对 query 值脱敏、`successField` 复用 `lib/forensics.mjs` 的 A1 凭据字段名 denylist。 |
| G6 分岔一 | 编译器运行侧 | 取 B：WSL 侧跑 + 反向隧道（隧道已落地、登录页亲验 HTTP 200）；loop 内先一次 spike 验隧道下 CDP `initiator` 归因与录屏不失真，不稳则退 Windows 侧（升级走 `route:human`）。 |
| G6 分岔三 | events url 落盘形态 | 取 C（人签改选，偏离草稿倾向 B）：基址占位符 `{{baseUrl}}` + `lib/instantiate.mjs` 回填，与 `{{uniqueName}}` 同机制——跨源 nav 可表达、凭据红线同样保住、fixture 形状不冲突。 |
| G7-1 | 前置清理步 | 取 A 砍除：条件删除不可确定性回放；残留靠保留前缀清扫纯脚本 + `uniqueGuard` 建名查重兜底。 |
| G7-2 | 抽屉遮罩 Esc 缺口 | 取 A 记录为已知限制：遇遮罩 → 该步失败 → fail-safe 落 `NEEDS_HUMAN`，回放不猜；不恒发 Esc（改变无遮罩路径行为）。 |
| G7-3 | 断言原子 intent 粒度 | 取 A：断言原子折进所在 intent 的 `expected[]` 作 P4 输入；不设零 event 独立 intent（无 axes 则裁定无据）。 |

## 二、机械决策（跟随已冻范式/护栏/先例即定）

| # | 决策 | 拍板 |
|---|---|---|
| G6 分岔二 | 可配置基址 | 编译器 CLI 对齐 replay 已冻形态吃 `--sut <baseUrl>`；tier-2 基址值 = site.json 的 `target.devProxyUrl`（WSL 经反向隧道），绝不写死。 |
| G3 附属 | atomId 回链命名 | 钉 registry 原名（`workflow.create` 系），不用 fixture 简写（`wf.create`）；快照文件带 `snapshotOf` 指向 regress 注册表来源版本。 |
| — | caseId | `tc_catalog_wf_crud`（满足 `^tc_[a-z0-9_]+$`）。 |
| — | P4 交接面四件套 | `events.json` / `observed-tc_catalog_wf_crud.json` / TestCase（意图留痕）/ 编译期核验记录（点击身份门唯一性证据 + 计数口径对账结论）。 |
| — | 计数口径对账法 | 编译期实采「搜索隔离后表格行 count 与删除按钮 count 恒等性」（草稿二 §3）；等价则 `.hr-table-row` 口径直接用，不等价升 `route:human`（接缝级）。 |
| — | 观测采集不扩字段 | 计数值走编译日志与 P4 交接说明，不塞 observed（`additionalProperties:false` 机制正确，照 schema 不扩字段）。 |
| — | 采集通路复用 | 编译期观测采集直接复用 `lib/replay-forensics.mjs` 取证通路（CDP 真发起方归因 + 通道剖面 denylist + 信封检查），消费端从 axes 换 observed——归因逻辑单源，顺带验一次 CDP `initiator` 真流量可靠度（ADR-0007 推翻条件，一鱼两吃；随 G1 取 B 一并生效）。 |

## 三、`route:human` 挂账（编译期核验类，验不出即升级）

1. ③ 左菜单点击全局唯一性（仅 `nav` 直达列表路由不可用时触发）。
2. ④ 描述 textarea 标签锚定可行性（非必填，无锚定可与人确认后砍除本步）。
3. ⑤ 抽屉确认按钮文本（确认/确定）与作用域内唯一性——重表达成败第一雷，不解决则 intent_1 永远 ambiguous。
4. ⑦ 删除确认按钮文本与唯一性。
5. `countChange` 计数口径若三方不等价 → 上升接缝级决策（expected 条目要不要带计数目标字段）。
6. `capturedAgainstBuild` 构建标识来源（页面 meta/接口版本号/人工填）；取不到落 `null`（schema 允许）。
7. G6 spike 失败（隧道下 CDP 取证或录屏失真）→ 编译器运行侧退 Windows。

## 四、术语登记（CONTEXT.md 已落）

- 登录预备动作（Login Bootstrap）——回放/编译开始前把浏览器带到已登录态的开场步；不产 event、不进 spec；随 G2 人签正式采用，按「拍板才登记」纪律登记（ADR-0005）。
