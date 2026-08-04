# Casey `wf-delete-card-layout` R3 修后聚焦复审

只读评审，不修改、不提交、不启动任何 SUT。不要接受作者总结，直接从不可变 Git 对象和全仓调用链取证。

## 不可变对象

- 工作树：`/mnt/d/ctx/heren/casey-wf-delete-card-layout`
- 原实现候选：`0a1c2679d0b708ff275301f8c1efc529c204858b`
- R2 输入绑定：`c81215c2e503b8e14a42e793119f6871b4cd01bd`
- 修后候选：`ced9fcf3657a1593aaa2f14d41145ab6b802c21b`
- 修复差异：`git diff c81215c..ced9fcf`
- 新计划 SHA-256：`e775ee8e1649a9ee8dc0d28a8c75381477e074f4120c5abf83311939075ad989`
- 新 golden SHA-256：`861eb06fc7d7ac7d9b38826834c963984f3471fe68620b63a7f6f23d5d4ca46c`
- 新红证 SHA-256：`003e600190cf4bd67af79b9490f8b411967f3db8f376b66f917bf0425b47dd82`

## 前轮结论与本轮必须独立复核的处置

R2 pi/deepseek-v4-flash high 对 `0a1c267` 给双 APPROVE，但提出 Medium：计划引用的
`shape-probe-20260804.md` 在分支快照缺席。Sol xhigh 随后给双 CHANGES_REQUIRED，并实证：

1. PRD 写 `schemaVersion:2` 却没有 v2 必填 `caseId/expectedFrozenPath`；
2. cleanup 只凭 `beforeClick` 的 click attempt 就按 Escape，R20 会关闭预存旧菜单并虚报 `closed`；
3. Escape 未抛错后没有按同一物理菜单验缺席，sticky menu 也会虚报 `closed`。

修后候选声称：

- PRD 改为通用 `schemaVersion:1`；
- cleanup 只有在 `waitForCausalMenu` 取得唯一因果新菜单句柄后才执行；
- Escape 后用 `authorizedMenuDomains(page, menu)` 重扫同一物理菜单，仍在/异常均记 `failed`；
- R20 加严，新增 R22（click 分发前抛错）与 R23（生菜单后抛错 + sticky 负控）；
- 对旧实现真实跑得 20/23、exit 1，修后 23/23、exit 0；
- 把主仓已跟踪的同一份 shape-probe 证据补入该分支。

请独立判断以上每条是否真的闭合，特别攻击：

- click 抛错后因果等待是否可能把旧菜单/多个新菜单误认成所有权；
- `settle` 的物理缺席复验是否会被 disposed handle、隐藏态、嵌套菜单或异常洗绿；
- 无唯一菜单时是否所有路径都零 Escape、零 `menuCleanup`；
- R22/R23 是否非空钉；删除因果句柄前置或删除 Escape 后复验时是否真红；
- plan A12/A15、红证与 PRD amendment/hash 是否逐字一致；
- `schemaVersion:1` 是否符合此功能型 PRD，gate 绿是否仍有结构误报；
- shape-probe 文件是否已存在于候选、内容是否与主仓事实源一致。

## 允许命令

```text
node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs
node tests/_golden/workflow-delete-causal-binding.static.golden.mjs
node tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs
node loop-kit/bin/term-lint.mjs --registry
node --check lib/workflow-delete-domain.mjs
git diff --check c81215c..ced9fcf
```

禁止 fixture/demo/gate/follow.mjs。只报 Critical/High/Medium，每条给 file:line、最小反例、修法。
分别给：

`PLAN_VERDICT: APPROVE|CHANGES_REQUIRED`

`IMPLEMENTATION_VERDICT: APPROVE|CHANGES_REQUIRED`

最后一行：`REVIEW_DONE_SENTINEL`
