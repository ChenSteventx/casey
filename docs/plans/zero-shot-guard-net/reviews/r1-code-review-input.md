# 代码评审：guard-net 契约实现（三提交）

你是独立评审者。前提审（你上一轮，PLAN_CHANGES_REQUIRED→三条已采纳）已核过设计；本轮只审**实现忠实度与新攻击面**。对着不可变快照，自己跑命令取证，判绿只信退出码。

## 仓库与快照

- 工作树（只读勿改）：`/mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate-zero-shot-guard-net`
- 基线：`e6e7ea1`；被审：`83a8c98`（范围 1）→ `d1f83a2`（范围 2）→ `24e0508`（范围 3+冻结）
- 差异：`git diff e6e7ea1..24e0508`；规格：`docs/plans/zero-shot-guard-net/{GRILL,plan}.md`、`loop/prd-zero-shot-guard-net.json`

## 必跑

```
cd /mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate-zero-shot-guard-net
node tests/_golden/zero-shot-unsupported-scope-fanout.zero-sut.golden.mjs   # 期望 12/12 exit 0
node tests/_golden/adaptive-module-boundaries.static.golden.mjs
node tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs
node tests/_golden/zero-shot-action-progress.zero-sut.golden.mjs
node tests/_golden/zero-shot-authority-runner.zero-sut.golden.mjs
node tests/_golden/page-observer-main-frame.zero-sut.golden.mjs
node loop-kit/bin/term-lint.mjs --registry
```

## 重点风险（逐条给结论，反例可复现或明确写无发现+怎么验的）

1. **自动发现的逃逸面**：`discoverZeroShotCore` 的匹配规则有没有绕过路径——非 `.mjs` 扩展名的可执行物、子目录（有没有「无子目录」断言且真的红）、大小写/符号链接花样？在 /tmp 副本自己造。
2. **并集严格度是否被收松**（前提审 H1 的实现落点）：`anyUnsupportedScope` 对未知键记录 `{probeScope:true}`、非空数组 `['x']`、畸形形状的行为是否与改前三处现役实现的并集逐一相符？元钉 N11 是否真的直接测 raw 语义（不经 normalize 链）？
3. **d3 反转的完备性**：`pureFiles = 发现集 − S2_EXECUTION_FACING` 后，执行面白名单七项是否与改前逐字一致？新纯模块 `unsupported-scopes.mjs` 是否真的零 import 且被四张网覆盖？
4. **夹具透传回归**：`copyUnsupported` 改通用透传 + 删 `DEFAULT_UNSUPPORTED`（执行者报的偏差 3）在全部现役用法下是否行为等价？找出任何一枚金牌对三键缺省形状有隐性依赖的反例。
5. **checksum amendment 完整性**：`prd-zero-shot-observe-admit-step.json` 的 R12 amendment——两件新旧 checksum 与实物 sha256 逐一相符？边界金牌重写有没有任何断言弱化（对照 e6e7ea1 版逐 d1-d5 比较判定逻辑）？
6. **CONTEXT.md 词条**：`:97` 整行与前提审核过的提案文案逐字一致？四列制完好、term-lint 过？
7. **元钉抗变异**：挑你认为最可疑的 2 条钉自己变异验证（改实现、跑、还原）。
8. **提交卫生**：三提交边界是否干净（范围 1 提交不引用范围 2 的新模块——执行者自称已核，复核它）；有没有计划外文件混入。

## 输出

只报 Critical/High/Medium；每条给 文件:行号 + 反例/命令 + 建议。验过无问题的重点写「无发现+怎么验的」。不改任何文件；变异在 /tmp 副本。结尾一行 `VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。
