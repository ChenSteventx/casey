# p3-compile — plan（相1 编译：真机产 events + 观测现状）

## 背景与边界

P3 = 相1 编译：把文本用例翻成确定性可回放 spec（`events.json`）+ 落观测现状（`observed-<caseId>.json`），此后日常回放零 LLM（ADR-0003）。第一条骑 regress `catalog_wf_crud` 重表达（ADR-0006），caseId `tc_catalog_wf_crud`。决策全依 grill 收口记录（`proposed/GRILL.md`，G1–G7 人签 2026-07-02）；重表达明细依 `proposed/reexpress-catalog-wf-crud.md`（4 intent / 15 event）；观测采集依 `proposed/observed-reality-plan.md`。

边界内：原子注册表快照、登录预备动作件、凭据门共享化、编译执行引擎（hermetic 可测）、`{{baseUrl}}` 回填接线、回放核验器、tier-2 真机 bring-up。
边界外：相0 归一 parser 完整实现（P2 尾）、相2 断言草拟与人签（P4 已建，本契约只保证交接面）、自愈（P6）。

## 组件（按 grill 决策）

1. `lib/atoms-registry.snapshot.json` —— regress 注册表整表 60 原子快照（G3 分岔二），顶层加 `snapshotOf`（来源仓/version/拷贝日期）；atomId 钉 registry 原名（`workflow.create` 系）。
2. `lib/login-bootstrap.mjs` —— 登录预备动作件（G2 取 A）：按 ADR-0001 拷快照引入 autotester `DEFAULT_SITE.login` 选择器 + `loadSiteConfig`（site.json 深合并）+ `loadCreds`（`.auth/` + env 覆盖），复用 Casey 现有 `lib/paths.mjs` 常量；执行「goto → 判 `pathMarker` → 填账号密码 → 点登录 → 静默点」，不产 event、凭据只进内存（护栏 #7）。
3. `lib/cred-gate.mjs` —— 凭据兜底门共享化（G5 取 B）：从 `bin/report.mjs` 抽 `credentialGate` + `collectSecretLiterals` + `FORBIDDEN_KEYWORDS`，`bin/report.mjs` 改 import 行为不变；新增 `stripUrlQuery`（observed `requestLog[].url` 落盘前剥 query）；编译器所有落盘口统一过门。
4. `bin/compile.mjs` + `casey compile` 接线 —— 编译执行引擎，两段式（G3 分岔一取 A）：
   - 草拟段 `casey compile <caseId> --testcase <f> --draft`：读规范 TestCase（本契约手写最小规范形态，相0 完整归一不在界内）→ 产 flow 草稿 → `validateDraft`（compile-gate 双闸，前缀自 `TestCase.uniquePrefix`）→ 落 `cases/<caseId>/flow-<caseId>.json`，等人 confirm。
   - 执行段 `casey compile <caseId> --execute --sut <baseUrl>`：登录预备动作 → 按重表达清单逐 event 真机执行（骑 atom 知识、语义定位器、每步静默点）→ 逐步观测采集（复用 `lib/replay-forensics.mjs` 的 `watchNetworkForensics`：CDP 真发起方归因 + 通道剖面 denylist + 信封检查，消费端换 observed）→ 落 `cases/<caseId>/events.json`（url 用 `{{baseUrl}}` 占位符，G6 分岔三取 C）+ `observed-<caseId>.json` + 编译期核验记录 `compile-report.json`（点击身份门唯一性证据、计数口径对账、`CASE_DEFECT` 候选——events 不落该步 + 记候选与 count===0 证据，编译继续）。
   - 所有落盘口过 `cred-gate`，命中拒写非零退出；入口可证缺席不 fail 全盘（G1 附属）；入参缺失 exit 64、坏数据 fail-closed。
5. `{{baseUrl}}` 接线 —— `bin/replay.mjs` 的 URL 通道（顶层 url + nav/newpage `ev.url`）先过 `instantiate`（ctx 注入 `baseUrl` = `--sut` 值）再 `pathOf`；对已冻 fixture 的完整假 host URL 是 no-op，p5 golden 不受扰。
6. 回放核验器（G1 取 B）—— `casey compile <caseId> --verify`：编译产物落盘后调 `bin/replay.mjs`（喂 events + 空 expected + profile + `--sut`）产 axes，扫动作轴断言「全步 `actionPerformed===true` 且 `resolution==='unique'`」；任一 ambiguous/failed → 列雷点清单、非零退出。核验判据是动作轴，不以 verdict 终判为准（无冻结断言，裁定必落 `NEEDS_HUMAN` 属正常）。

产物区约定：`cases/<caseId>/`（编译产物区，与 `runs/` 回放区分开）；events 用占位符不携站点字面量、observed 过凭据门后可提交，拿不准 route:human。

## 验收点（命令化 hermetic）

hermetic 全部对假 SUT / 合成 fixture，零真机零 LLM 零凭据：

- A1 快照完整性：快照存在、`snapshotOf` 溯源齐、60 原子、`catalog_wf_crud` 所用 6 原子 id 在册且形状（`entityNameParam`/`destructive`/`requires`）与 compile-gate 消费契约吻合。
- A2 登录件 hermetic：合成 site.json 深合并覆盖生效、env 覆盖优先、缺凭据抛错 fail-closed（不碰真 `.auth/`）；选择器形状含「登 录」空格坑。
- A3 凭据门共享化等价：`bin/report.mjs` 过门行为不变（p7 credentialGate coverage golden 仍绿）；编译落盘口命中敏感词/site.json 字面量拒写；`stripUrlQuery` 剥 query 生效（含 percent-encoded）。
- A4 编译执行引擎：合成 flow + 假 SUT → 产 events/observed/compile-report 三件，events 过已冻 `events.schema`（`authored:false`、禁纯坐标步 anyOf、action ⊆ 7 枚举）、observed 过已冻 `observed-reality.schema`（步数=events 步数、`quietPointReached` 照实）；`validateDraft` 拒坏 flow（缺前缀/坏原子/缺必填参）fail-closed。
- A5 `CASE_DEFECT` 候选：合成「入口缺席」假 SUT 场景 → events 不落该步、compile-report 记候选与 count===0 证据、其余步照编译。
- A6 `{{baseUrl}}` 接线：占位符 events 对假 SUT 回放绿；p5-replay golden 10/10 + coverage 13 检查回归锁全绿。
- A7 回放核验器：合成 unique 场景通过；合成多匹配场景 → 非零退出 + 雷点清单点名 ambiguous 步。

以上入 `tests/_golden/p3-compile.golden.mjs`（+ 合成 fixture），冻入 `loop/prd-p3-compile.json` 的 `testChecksums`；acceptance 由 gate 跑、`passes` 只 gate 写。

## route:human（tier-2，gate 绿 ≠ 完成，护栏 #16）

1. spike：反向隧道下 CDP `initiator` 归因与录屏不失真（G6 分岔一附带条件；失真则编译器运行侧退 Windows）。
2. 真机编译 `tc_catalog_wf_crud`：WSL 经 `site.json` 的 `target.devProxyUrl`，flow 草稿人 confirm 后执行，产真 events + observed + 核验记录。
3. 编译期核验清单落地：⑤ 抽屉确认按钮文本与唯一性（第一雷）、⑦ 删除确认按钮文本与唯一性、④ 描述 textarea 标签锚定、③ 菜单唯一性（仅 nav 直达不可用时）、计数口径三方对账。
4. 回放核验跑（真机第二轮）：全步 unique、无 ambiguous；收尾清理删除净场。
5. P4 交接面四件套齐：events / observed / TestCase 意图留痕（`assert.onPage`/`assert.noErrorToast` 落对应 intent）/ 编译期核验记录。
6. `capturedAgainstBuild` 来源确认（取不到落 `null`）。

## 红基线

accept 前冻 `tests/_golden/p3-compile.golden.mjs` + 合成 fixture：对当前桩实现跑必红（`casey compile` 现 exit 3、`lib/cred-gate.mjs`/`lib/login-bootstrap.mjs`/快照均缺席），红方向亲验后 `advance accept --red-verified`。

## 完成判据

gate GREEN（A1–A7 全绿 + term-lint + ratchet）+ tier-2 route:human 清单人签核销 + P4 交接面四件套在 `cases/tc_catalog_wf_crud/` 就位。review 阶段按纪律走 codex 异构评审（护栏 #9）。
