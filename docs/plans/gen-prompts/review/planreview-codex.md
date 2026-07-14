# gen-prompts plan 阶段异构设计评审（codex）

## 评审元信息

- 契约：`gen-prompts`（lane `full`），评审对象 = `plan.md` + `proposed/GRILL.md`（实现前，尚未落地任何 `lib/promptset-authoring.mjs`/两新 bin/金牌）。
- 评审者：`gpt-5.6-sol`（codex-cli 0.144.1），`reasoning effort=max`，`sandbox=read-only`，`approval=never`，工作目录 `/mnt/d/ctx/heren/casey-gen-prompts`。
- 家族：codex（评审家族 ≠ 实现家族 Claude，符合护栏「异构评审」铁律）。
- 评审料：`docs/plans/gen-prompts/review/planreview-material.md`（plan 全文 + GRILL 全文 + 「已定勿改」方向声明 + 评审指令，见护栏 #9 只喂 spec + 门禁证据、不喂凭据、不喂无关代码）；沙箱只读，评审期对本工作树零写入（评审后 `git status --short` 复核确认工作树未变）。
- 用量：`tokens used 254,917`。
- 结论：**需修改，暂不应进入 Build**（4 HIGH / 5 MED / 3 LOW；另有三项已核对为 PASS，含 checksum 重签清单核对正确、无漏签）。

---

## 评审原文（verbatim，未改一字）

结论：**需修改，暂不应进入 Build**。共发现 **4 HIGH / 5 MED / 3 LOW**。其中 checksum 重签清单核对正确，没有漏签第四份 PRD。

## HIGH

1. **D2 / D3：合成种子模板会被自己的凭据门永久拦截。**

   D2 要求模板明确写出 `token`、`password`、`secret` 等英文例子；D3 又要求模板全文通过输出侧 `credentialGate`。[D2 原文](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:31)、[D3 原文](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:34)。现有门把这些词全部列为禁词并做不分位置的子串扫描，[cred-gate](/mnt/d/ctx/heren/casey-gen-prompts/lib/cred-gate.mjs:8)。

   我用合成文本实测，当前门返回 `ok:false`。因此：

   - 按 D2 原样实现，seed happy path 永远 exit 1；
   - 为了能运行而删掉英文例子，又违反 D2，而 S2 的弱语义断言仍可能放绿。

   应把模板改成纯中文说明，例如"访问令牌、口令、密钥等概念只用中文表达，不使用对应英文敏感字段名"，并让 S2 同时断言模板满足内容契约且 `credentialGate(template).ok===true`。

2. **D1 / D6 / C1：`promptset-freeze` 门面分发缺失时整套金牌仍可假绿。**

   F 组红锚明确落在新 bin 缺席，[F1](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:49)；C1 只验证 `casey promptset-seed` 经门面透传，没有验证 freeze，[C1](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:55)。

   可构造以下假绿实现：

   - 两个 bin 都实现；
   - help 列出两命令；
   - `bin/casey.mjs` 只接 seed，漏接 freeze；
   - `CLI_MCP_EXCLUDED` 却加入两者。

   现有 A4 只遍历实际出现的 switch case，多余的 EXCLUDED 成员不会报错，[A4](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/cli-mcp-face.golden.mjs:107)。最终所有直跑 bin 的测试均绿，但文档入口 `casey promptset-freeze` 不可用。

   C1 必须同时验证两命令经门面执行，至少覆盖 freeze 缺参真用法 64，最好再经门面跑一次 happy `--dry-run`；同时加 `CLI_MCP_EXCLUDED ⊆ 实际 CLI 命令集` 反向断言。

3. **D3 / D4 / S3：凭据和内网地址仍有可达输出旁路。**

   两条独立反例：

   - freeze 只有合并后的输出侧门，[流程](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:22)，没有规定在 `JSON.parse` 和形状报错前扫描候选原文。当前 Node 的 `JSON.parse("password=hunter2")` 错误会把整段脏文本带进 `e.message`；F3/F4 只断言目标文件不变，不断言 stderr/stdout 不含原值。
   - `credentialGate` 不是地址门，只查禁词及本机凭据文件中已知字面量，[实现](/mnt/d/ctx/heren/casey-gen-prompts/lib/cred-gate.mjs:43)。我用合成的 `http://192.168.1.7/internal` 实测得到 `ok:true`。因此 embedded 可以把未登记在 `site.json` 的内网地址复制进 seed；S3 的 `http://10.` 静态锚也漏掉 HTTPS、172.16/12、192.168/16、IPv6 和内部域名，[S3](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:47)。

   两个 CLI 都应在解析前以固定标签扫描原始输入，报错只出类别码/数组下标；另需独立的地址泄漏闸，明确覆盖私网、内部域名和编码形态。金牌要在 malformed JSON、未知字段、`--dry-run`、embedded 等路径放合成哨兵并断言所有输出无原值、无路径。

4. **D9：任意输出路径可覆盖铁不变量保护文件。**

   D9 允许任意 `--out` / `--promptset` 路径，[D9](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:53)，但设计没有后缀、规范路径、保护目录、符号链接或 anti-clobber 检查。内容凭据门不检查目的路径。

   例如 clean seed 可被写到 `bin/verdict.mjs`、`lib/sign-gate.mjs` 或 `.auth/credentials.json`；这直接破坏"字节不动 / 不碰凭据文件"铁不变量。

   建议保留自由布局，但至少：

   - seed 强制 `.md`，freeze 强制 `.json`；
   - canonicalize 后拒绝 `.auth/`、`site.json`、`bin/`、`lib/`、`loop/`、`tests/_golden/`、`prompts/_lib/`；
   - seed 默认拒绝覆盖已有文件；
   - 测试保护文件前后 sha256 不变，并覆盖符号链接别名。

## MED

1. **D4 / F2 / F3：把所有已有 id 都当幂等重试，会静默丢掉不同内容的新候选。**

   当前决策是"已有 id 一律跳过"，[D4](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:36)。但已有 `{id:p1,text:A}` 与候选 `{id:p1,text:B}` 不是幂等重试，而是冲突；现在会 0 新增、exit 0，缺失测试向量却被当成功。

   还存在验证顺序假绿：若先判已有 id 再校验，空 text、未知键、自带 source、批内重复都可借已有 id 被跳过。

   应先完整校验整个候选批，再分类：

   - 规范化后与已有 `source:'llm'` 条目完全等价：幂等跳过；
   - 同 id 不同内容或不同 provenance：整批冲突拒绝；
   - 任意非法项无论 id 是否已有：整批拒绝。

   补四个交叉用例：精确重跑、同 id 不同 text、非法已有 id、两条都撞已有 id 的批内重复；0 新增路径仍须执行 self-check 和凭据门。

2. **D4 / F4：当前金牌不能证明原子写，且"已有条目字节原样"与对象级 API 不相容。**

   F4 仅检查 happy 后没有 `.tmp`，[F4](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:52)。直接 `writeFileSync(target)` 的非原子实现也能通过。没有测试写 tmp 失败、rename 失败、目标原字节保留和失败后 tmp 清理。

   另外 `freezeMergePromptset({existing,candidates})` 只接对象，[API 设计](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:20)；JSON parse/stringify 后不可能保留已有条目的原始空白和字节布局。应二选一：

   - 把契约改为"已有条目值深等、不覆盖；0 新增时整个文件字节不变"；或
   - 若真要求原始字节保留，API 必须接原始文本并使用安全的增量写法。

   原子写最好抽成可注入故障的 helper，金牌模拟 write/rename 失败；`--dry-run` 应断言完整文件系统零差量，而不只是目标文件不存在。

3. **D7 / S4：现有纯度守卫是有限 denylist，不能证明零 LLM/零网络。**

   守卫只禁少量包，[denylist](/mnt/d/ctx/heren/casey-gen-prompts/bin/verdict-purity-guard.mjs:16)，其余 bare package 默认允许，[允许分支](/mnt/d/ctx/heren/casey-gen-prompts/bin/verdict-purity-guard.mjs:103)。实测 `@google/generative-ai` 不会被判禁，而 `openai` 会；因此换一个未登记 SDK 即可让 S4 假绿。

   对这两个小 CLI 应改用闭包 allowlist：只允许明确的 Node 内置模块和仓内相对模块，任何第三方 bare import 默认拒绝；另扫模型凭据 env/旗标字样。至少增加两个非 OpenAI 客户端的反向金丝雀。

4. **D7 / N1：import 闭包不等于运行路径，也没有钉"字节不动"。**

   N1 只检查 import 闭包，[N1](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:54)。但 `bin/promptset.mjs` 本来就通过 `child_process` 启动其他 bin，[现有入口](/mnt/d/ctx/heren/casey-gen-prompts/bin/promptset.mjs:13)；若它新增 `spawn` authoring bin，import 闭包仍不含 authoring，N1 会绿。

   同时，全仓 `testChecksums` 反向索引没有任何 PRD 直接冻结 `bin/verdict.mjs` 或 `lib/sign-gate.mjs`；selftest/闭包测试只能守行为和纯度，不能兑现"字节不动"。

   新金牌应：

   - 冻结 `bin/verdict.mjs`、`lib/sign-gate.mjs` 及明确"不碰"文件的基线 sha256；
   - 除 import 边外，扫描 `spawn`/脚本路径引用，确保 replay/verdict/promptset 运行图不指向两新 bin；
   - N1 反向扰动同时覆盖 import 和 spawn 两种边。

5. **D1 / D2：`--n 1..50` 与"三类全覆盖"互相矛盾，且 freeze 无法核验 N。**

   D1 允许 `n=1`，[D1](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:25)；D2 要求 normal/boundary/security 三类全覆盖，[D2](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:29)。`n<3` 时要求不可满足。即使 n=6，freeze 也不接 seed 或期望条数，LLM 交 2 条仍会被接受。

   Build 前需明确：

   - 若 N 和三类覆盖是硬契约：最小 n 改为 3，并把 expected count/三类覆盖带进 freeze 校验；
   - 若只是建议：保留 1..50，但模板改为"n≥3 时覆盖三类"，并明确 freeze 不保证条数。

## LOW

1. **D2 / S1：embedded 的行尾与"4000 字符"边界未定义。**

   原样嵌入 Windows CRLF 文件会违反"输出零 `0x0d`"；JS `slice(0,4000)` 按 UTF-16 code unit 截断，可能切断非 BMP 字符。建议先规范化 CRLF/CR 为 LF，再按 Unicode code point 截断并显式加"已截断"标记。S1/S2 增加 CRLF、emoji 边界，以及凭据位于第 4000 字符之后的用例。[S1/S2](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:45)

2. **D5：只改 `SOURCES` 一行会留下两处公开口径漂移。**

   当前模块头仍写"`user|builtin`、本轮不做 LLM 合成"，[注释](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset.mjs:4)；未知 source 报错仍写"只能 user 或 builtin"，[错误信息](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset.mjs:39)。plan 却声明只改枚举一行，[D5 落点](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/plan.md:23)。

   应允许同步改这两处，错误允许值从 `SOURCES` 派生，并让 P1 断言错误信息包含 `llm` 且仍拒 `robot`。

3. **D8：没有循环定义，但两个词的粒度仍含糊。**

   "被测参数候选"定义成整个数组，但 plan 又说"候选 3 条"，单条/批次混用；"幂等冻结"则容易与现有"冻结断言契约 + 人签 + checksum"混淆。[D8](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/proposed/GRILL.md:49)

   建议明确：

   - 被测参数候选 = 单条 `{id,text,...}`；
   - 候选文件/候选批 = JSON 数组；
   - 幂等冻结明确注明"非冻结断言契约、无人签、整体仍可追加，只保证已有 id 不覆盖"。

## 已核对为 PASS 的部分

- **checksum 重签清单 PASS。** 实际反向索引结果确为：

  - `regress-promptset.golden.mjs` → 仅 `prd-regress-promptset`；
  - `cli-mcp-face.golden.mjs` → `prd-cli-mcp-face` + `prd-mcp-parity`；
  - 其余 `touchesFiles` 当前均不在任何 `testChecksums` 中；
  - `distribution.golden.mjs` 未改且 A8 只锚 `mcp-config`，无需重签。

- **id/保留前缀锚点本身 PASS。** 当前 `^[a-z0-9_]+$`、随发库强制 `bnd_`/`sec_` 和最终 `mergeCases` 全局碰撞闸能覆盖预定命名空间，[现有实现](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset.mjs:15)。

- **没有发现设计上把 LLM 直接引入裁判的路径。** 候选 `expect` 只能进入现成强制 `soft:true` 通道，[buildSoftExpect](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset.mjs:122)，scope A 已有失败软期望仍 `PASS` 的真 verdict 金牌，[既有金牌](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/regress-promptset.golden.mjs:157)。风险集中在上述 D7 证明强度不足，而不是数据模型本身把 LLM 变成裁判。

本次为只读设计评审，未改工作树。

---

## 驱动员核验附注（非评审内容，Claude 驱动侧记录）

以上四条 HIGH 均已用真实文件独立复核，非评审者臆造：

- HIGH#1：`lib/cred-gate.mjs` 的 `FORBIDDEN_KEYWORDS` 确含 `password`/`secret`/`token`，且 `credentialGate` 对全文做不分位置子串扫描——D2 若照原样写英文示例词进模板会自锁，成立。
- HIGH#2：`tests/_golden/cli-mcp-face.golden.mjs` 的 A4 断言逻辑只遍历 `bin/casey.mjs` 实际存在的 switch case 集合，`CLI_MCP_EXCLUDED` 多出的成员不参与比对——「EXCLUDED 加了但门面没接」确实不会被 A4 抓到，成立。
- HIGH#4：`bin/promptset.mjs` 头部确实 `import { spawnSync } from 'node:child_process'` 且通过 spawn 编排其余 bin——「运行图不等于 import 闭包」的顾虑有真实先例支撑，成立。

工作树复核：评审全程 `sandbox=read-only`，`git status --short` 确认评审前后仅 `?? node_modules`（软链依赖，非评审产物），无任何文件被改写。
