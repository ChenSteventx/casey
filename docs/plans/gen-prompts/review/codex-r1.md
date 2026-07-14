# gen-prompts 代码层评审（r1）——codex

调用式：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-gen-prompts -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium <指令> < docs/plans/gen-prompts/review/material-r1.md`（codex-cli 0.144.1，sandbox=read-only，reasoning effort=medium，用量 220,341 tokens）。评审对象：契约 `gen-prompts`（lane full）实现，commit `7cabd8f`。实现方 Claude，评审方 codex（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

结论：**NEEDS CHANGES，非 PASS**。共发现 **4 HIGH / 4 MED / 1 LOW**。其中 checksum 重签、裁判字节锚和当前 import 闭包本身核对为 PASS。

## HIGH

1. **0 新增路径提前成功，绕过 green-by-construction 自检**

   - 文件：[bin/promptset-freeze.mjs](/mnt/d/ctx/heren/casey-gen-prompts/bin/promptset-freeze.mjs:106)、[gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:373)
   - 问题：`fresh.length === 0` 在 `parsePromptset + mergeCases` 自检之前直接 exit 0。只要候选与某个已有 `llm` 条目幂等，存量中其他非法条目、重复 id 或与内置库碰撞均不会被检查。
   - 实测：直接调用 `freezeMergePromptset`，存量含一条合法幂等项和一条 `source:'robot'` 非法项，返回 `fresh:0` 且非法项仍在 `merged`。CLI 随即会走 106–109 行成功分支。
   - 金牌缺口：F2a 只用完整合法的 `FROZEN_AFTER_F1`，测不出坏存量绕过。
   - 建议：无论 `fresh` 是否为 0，都先运行整份 `parsePromptset + mergeCases`；通过后才允许「零写盘、字节不变」成功。增加「0 新增 + 另一条非法存量」「0 新增 + 存量重复 id」「0 新增 + 内置库碰撞」三项金牌。

2. **候选/存量校验错误会回显原始字段和值，违反 D3 output-seal**

   - 文件：[bin/promptset-freeze.mjs](/mnt/d/ctx/heren/casey-gen-prompts/bin/promptset-freeze.mjs:93)、[lib/promptset-authoring.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:121)、[lib/promptset.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset.mjs:38)
   - 问题：CLI 直接 `die(65, e.message)`。异常文本会插入未知键、重复 id、冲突 id；green-by-construction 错误也会透传存量的非法 `source` 原值。解析前凭据门只能拦已登记凭据和关键词，不能满足「所有错误只出类别码与位置、不出原值」。
   - 实测：未知键哨兵 `x_meta_qqzz_nonsecret` 完整出现在 `CandidateValidationError.message`；存量 `source:'qqzz_source_value'` 完整出现在 `parsePromptset` 错误中。
   - 金牌缺口：F4b 只钉 malformed JSON；F3 各形状错误只断言退出码和文件不变，不检查 stdout/stderr。
   - 建议：CLI 按结构化 `code/index` 映射固定文案，禁止传递底层 `e.message`；自检错误也只输出固定类别。给所有 F3 分支、冲突分支及自检分支加入合成哨兵不回显断言。

3. **所谓私网「哨兵」实际复制了姊妹项目的真实内网 API 端点**

   - 文件：[gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:212)、姊妹项目 [gen-prompts.mjs](/mnt/d/ctx/heren/regress_autotest/scripts/gen-prompts.mjs:27)
   - 问题：S3f 第一条夹具与作废旧实现的默认 API 基址完全一致，连端口和路径也相同，不是合成占位符。这直接违反「任何内网/真目标地址不进代码与文档」。S3h 甚至把该地址列为禁值，却只扫描两个新 bin，不扫描金牌自身，因此假绿。
   - 建议：立即从提交历史待合并面移除该端点。测试中运行时拼装明确标记的合成私网地址，避免形成完整地址字面量；将泄漏扫描扩展到本契约全部新增/修改文件，而非仅两个 bin。

4. **固定 `.tmp` 名允许符号链接绕过保护路径并覆写裁判文件**

   - 文件：[lib/promptset-authoring.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:243)、[gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:559)
   - 问题：临时路径固定为 `${path}.tmp`，`writeFileSync` 会跟随预先存在的符号链接。攻击场景：合法输出 `x.json` 通过路径闸，但预置 `x.json.tmp → bin/verdict.mjs`；写临时文件时会先截断裁判文件。当前 D9 只 canonicalize 最终目标，防不住该旁路。
   - 现有 F4e/F4f 仅注入函数抛错；F5 只测试最终目标/祖先符号链接，均测不到 sidecar symlink。
   - 建议：同目录生成不可预测临时名，以 `O_CREAT|O_EXCL|O_NOFOLLOW` 创建；只清理由本次调用创建的临时 inode。补预置 `.tmp` 普通文件、符号链接指向 `verdict.mjs`、两个并发写者的反例测试，并核保护文件 sha256 不变。

## MED

1. **私网扫描漏掉能被标准 URL 解析器归一为回环地址的等价文本**

   - 文件：[lib/promptset-authoring.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:268)
   - 问题：正则只识别常见点分十进制和压缩 IPv6。裸主机形式可绕过，例如展开的 IPv6 回环、八进制 IPv4、整数 IPv4、十六进制 IPv4 及百分号编码点号。
   - 实测：上述五种输入 `scanPrivateAddress(...).hit` 均为 false；Node `URL` 将它们分别归一为 `::1` 或 `127.0.0.1`。其中裸主机不含 `://`，可通过 freeze 并落盘。
   - 建议：抽取候选 host 后用标准 URL/IP 解析和数值网段判断；至少覆盖 IPv6 完整/压缩表示以及 WHATWG URL 接受的 IPv4 替代表示。金牌应断言「扫描结果」与规范化后的地址分类一致。

2. **spawn 边金牌只扫三个入口文件，传递 helper 可绕过**

   - 文件：[gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:641)
   - 问题：N1a 遍历 import 闭包，但只查闭包内文件名；N1b 的源文本扫描只读取三个入口。若入口 import 一个普通 helper，而 helper 用 `spawnSync` 启动 authoring bin，N1a/N1b 都会绿。动态拼接脚本名也能避开精确子串。
   - 建议：对 `scanClosure` 返回的全部 `visited` 文件扫描 child-process 边，并解析 spawn 目标；增加「入口→helper→spawn authoring bin」金丝雀证明检查器能红。

3. **原子写测试未覆盖固定临时名的并发/残留语义**

   - 文件：[lib/promptset-authoring.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:246)、[gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:559)
   - 问题：除 HIGH #4 外，两个进程共用同一 `.tmp`，可能由 A rename B 的内容、B 报失败；`mkdirSync` 也会在后续写失败时留下新目录。当前测试只在已存在目录中串行注入失败，证明不了这些语义。
   - 建议：采用唯一临时文件；测试并发写、缺失父目录后 write/rename 失败、进程中断后的恢复/清理策略。若只承诺「目标文件不出现半份」，应把「不留任何临时物」的不可实现 SIGKILL 口径改清楚。

4. **材料指出的 term-lint 解析缺陷成立**

   - 文件：[term-lint.mjs](/mnt/d/ctx/heren/loop-kit/bin/term-lint.mjs:56)、[CONTEXT.md](/mnt/d/ctx/heren/casey-gen-prompts/CONTEXT.md:109)
   - 问题：`line.split('|')` 不识别 Markdown 的 `\|`。`promptset` 行因此被裂成多列，`builtin...` 片段被错误登记为弃用别名，而真正的弃用别名列没有被读取。
   - 实测：`parseRegistry().deny` 返回幽灵项：`{"alias":"\`builtin\`（随 注入向量库 发）\\","canonical":"promptset"}`；同时 `term-lint --registry` 仍 exit 0，因为它只要求至少四列。
   - 影响：当前会对包含该完整片段的合法文本误报；更一般地，任何解释列含转义管道的词条都会产生幽灵黑名单，并漏掉真实别名列。
   - 建议：使用识别反斜杠转义的 Markdown 表格解析器，并要求恰好四个逻辑列；增加本行回归夹具。当前契约可先将枚举改成不含表格管道的中文列举，工具修复应在 loop-kit 单独立约。

## LOW

1. **`--dry-run` 输出整条候选，而非设计约定的摘要**

   - 文件：[bin/promptset-freeze.mjs](/mnt/d/ctx/heren/casey-gen-prompts/bin/promptset-freeze.mjs:118)、[gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:394)
   - 问题：打印 `JSON.stringify(fresh)` 会把全部 `text/expect` 写到终端；F2c 还要求输出包含 id，却没有禁止正文。与 D4「只打印摘要」不符，也扩大了未登记敏感内容的输出面。
   - 建议：只打印计数和 id 列表，并加入正文合成哨兵不出现在 stdout/stderr 的断言。

## 已核对为 PASS

- **冻结重签完整**：反向索引实测：`gen-prompts.golden.mjs` → `prd-gen-prompts`；`cli-mcp-face.golden.mjs` → `prd-cli-mcp-face` + `prd-mcp-parity`；`regress-promptset.golden.mjs` → `prd-regress-promptset`；三份实际 sha256 全部与 PRD 一致。
- **裁判与人签闸字节锚有效**：[prd-gen-prompts.json](/mnt/d/ctx/heren/casey-gen-prompts/loop/prd-gen-prompts.json:5) 中两份 hash 与实际文件一致；`git diff dev...HEAD -- bin/verdict.mjs lib/sign-gate.mjs` 为空。
- **当前实现未把 authoring import 进回放/裁定闭包**；问题在于 N1 防退化金牌的 spawn 覆盖强度不足（见 MED#2）。
- **新术语本身消歧清楚**：[CONTEXT.md](/mnt/d/ctx/heren/casey-gen-prompts/CONTEXT.md:128) 对单条/候选批及「幂等冻结≠冻结断言契约」说明明确。术语问题集中在表格解析器，而非三项定义语义。

本环境文件系统为只读，完整金牌因其创建 `/tmp` 夹具而无法复跑；以上行为实测使用纯函数、URL 规范化、sha256 和 PRD 反向索引完成，未改工作树。
