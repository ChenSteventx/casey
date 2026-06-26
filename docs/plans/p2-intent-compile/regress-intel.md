# 深读情报图：regress + autotester（loop 实现参考）

> 6 路并行精读 `regress_autotest` 与 `autotester` 的浓缩结果，带文件:行引用，供 loop 实现 S1/S2 时直接查。
> 原始 6 路全文在会话工作流产物（临时），本文是落档的可用子集。路径以各自仓库根为准。

## 运行时 / 底座（R2/R6 事实）

- regress 回放底座 = `@playwright/test`（TS）：`_fixtures.ts:1` import 自 `@playwright/test`；`_flow-runner.ts:176-195` `runFlowCase` 裸 await、无 try/catch、fail-fast；每原子 `await test.step(原子名)` 包裹。
- autotester L1 lib = 纯 `.mjs`、零 `@playwright/test` 值依赖、只吃 `page`、throw 原生 `Error`、可被 node 直接 import 跑 golden（`robust-actions.mjs` / `replay-guards.mjs` 头注）。这是 Casey 三轴重表达的底座。
- 登录态：`_fixtures.ts:191-214` context fixture 把 `.auth/session.json` 的 `USER_TOKEN`/`API_KEY` 注入 sessionStorage（受 `APP_ORIGIN` 白名单门控）；`login()` `_fixtures.ts:238-255` 真机 UI 登录。spike 薄壳复用它。

## 注册表 + 状态机（S2 编译门用）

- `tests/_atoms/atoms.registry.json`（version=2，60 原子）。原子字段：`desc` / `params{name:{type,required,desc,runtimeInput?}}` / `requires` / `provides` / `removes`（缺省 []）/ `destructive`（缺省 false）/ `entityNameParam` / `post`（散文，仅确认门回显、非机器校验）。
- `params.type` 仅 `string`/`string[]`/`number`/`boolean`。`states` 顶层封闭词表（11 个）；`exclusiveGroups` 一组 5 元素页面位置互斥。
- `entityNameParam` 前缀硬闸只 4 原子带：`workflow.create`(:154)/`workflow.deleteByName`(:518)/`agent.create`(:599)/`agent.delete`(:876)。
- 双闸单一源 `scripts/_flow-authoring.mjs`（纯 mjs、零 playwright）导出 `validateFlowStructural`（闸一）、`checkFlowV2`（闸二状态机+前缀，前缀写死在 `:133` 字面量 `ctxtest_`）、`validateDraft`、`checkRegistryV2`、`providersOf`。镜像在 `_flow-runner.ts:82-147 validateFlow`（前缀 `:139`）。**前缀参数化要改这两处。**

## catalog_wf_crud 的 5 原子（+1）实现（S1 三轴重表达用）

flow.json 7 步：login → deleteByName(前置清理) → create → assert.onPage → save → assert.noErrorToast → deleteByName(收尾)。用到 6 个原子：

- `login` `_atoms.ts:280-287`：后置仅 `toHaveURL(!/login)`。映射 Casey `urlPathname op=matches` 负向。
- `workflow.deleteByName` `_atoms.ts:820-855`：内嵌点击身份门（搜索隔离后删除按钮 `count===1` 才动手，`:839`）+ teardown（删后重搜 `expect.poll` 计数归 0，`:849-854`）。对齐 Casey `countChange` 绝对归 0。
- `workflow.create` `_atoms.ts:337-371`：确认按钮 `getByRole('button',{name:'确认'}).last()`（`:362`）多匹配兜底→点击身份门会判 ambiguous，**须先收紧 locator 才能 PASS**；后置 `waitForURL(/process/detail)`（`:369`）。
- `assert.onPage` `_atoms.ts:858-864`：`expect(page.url()).toContain(inc)`，子串→映射 Casey `urlPathname matches/startsWith`（不能直搬 contains）。
- `workflow.save` `_atoms.ts:323-327`：纯 `click('保存')` 零后置（R1 教科书；SUT_DEFECT 分支因此不可达，三轴改造命脉）。
- `assert.noErrorToast` `_atoms.ts:1407-1426`：扫 `.hr-message`/`.hr-notification`/`[role=alert]` 找「操作失败/系统异常/网络错误/请求失败」，ABSENCE 断言；`:1411` 自承选择器待真机确认（R11，易假阴）。

## 真机网络面（trace 实测，watchNetworkForensics 用）

- 建：`POST /ai-manager/process/saveOrModifyProcess`，body `{status:200,msg:"操作成功",data:<id>}`；辅 `GET process/getCode`、`getProcessInfoById`。
- 存：`POST /ai-manager/process/saveOrModifyProcessData`，body 同信封（save 步唯一权威成功信号）。
- 删：`POST /ai-manager/process/delete`；列表搜 `GET process/queryProcess`。
- 信封成功判据 = `body.status===200`（非 `code!=0`）。身份令牌 `user-token`（JWT）在每个 `/ai-manager/*` 请求头（凭据红线：forensics 只记 status、不记 token 值）。

## autotester L1 原语（三轴重表达接口，纯 mjs）

- `lib/robust-actions.mjs`：`resolveTarget`（多匹配按文本挑唯一可见、`attached=false` 信号——点击身份门「解析唯一」信号源）、`robustClick`（语义/CSS/坐标三级 + 派发兜底）、`robustFill`（填后回读不一致即抛——动作回读）、`clickOptionByText`、`ensureUniqueName`（Uniqueness Guard）。
- `lib/replay-guards.mjs`：`assertCoordHittable`（坐标点空抛「需 regen」绝不静默假绿）、`coordClick`、`expectRequiredFilled`、`expectDropdownValue`。零 `@playwright/test`、throw 原生 Error、golden 契约 `tests/_golden/l2_guards.test.mjs`。
- `lib/describe-action.mjs`：codegen 行→中文操作说明（动作轴 `describe` 来源）。
- 待建：`watchNetworkForensics`（取证轴，本仓 P5/§9.1）。
