# flow-bridge — 沉淀（相1 LLM flow 草拟桥，full）

## 做成了什么

补上 compile「LLM 一次编译」链条唯一没落地的机制口：规范 TestCase（嵌套 steps）+ CLI 外 LLM mapping →
compile 吃的 flow。`lib/flow-bridge.mjs`（buildFlow + validateBridge 三闸）+ `bin/flow-bridge.mjs`（薄 CLI）+
`bin/casey.mjs` 接线 + `lib/compile-atoms.mjs` 加法导出编译允许集。`casey flow-bridge` 可用。

三闸：投影忠实（每 TestCase intent 被覆盖、无凭空 intentId、intentId 唯一）+ 编译知识允许集（atom 可编译，
补 compile-gate 放行册内无编译知识原子的缝——真缝 `nav.workflowManagement`）+ 复用 compile-gate.validateDraft。

## 异构评审（codex，三轮 R3 PASS）

R1 五 → R2 三 → R3 PASS。

## 教训

1. **「桥」这类翻译层要三向对齐，别只对上游**：flow 桥既要忠实投影 TestCase（不漏译不凭空），又要产出
   compile 真能吃且真能执行的 flow。compile-gate.validateDraft 只查「结构/前缀/状态机」、**不查原子有没有
   编译知识**（那只在 --execute 时 compileAtomStep throw）——桥必须补这道「允许集闸」，把「过闸却执行时炸」
   前置拦住。识别下游各层各查什么、缝在哪，比堆闸更重要。
2. **单一事实源要真单一**：codex 连揪两轮——手写 Set 与 if 分派链双源（R1）、Object 分派表原型链键绕过（R2）。
   收敛答案 = 分派表 `Object.create(null)` 建、`Object.hasOwn` own-key 判定、允许集谓词直查私有表（不依赖可变
   导出）。「派生」而非「并列」，且防原型链/可变性污染。
3. **fail-closed 的退出码要是契约码，不能是未捕获异常**：`mapping:[null]` 让 buildFlow 抛 TypeError → exit 1
   而非契约 exit 65。坏输入必须在进入构造前被结构闸挡下、走契约码。
4. **凭据门要前置到「任何回显/副作用之前」**：validateDraft 的破坏性实体名错误会回显原始值——若参数含凭据、
   又先触发该错误，敏感值就进 stderr 了。cred-gate 扫输入原文要早于校验回显、也早于 mkdir。
5. **route:human 跳过通道不能是静默排除**：`s.route==='human'` 免覆盖必须带 reason 留痕、返回 skipped、
   CLI 明示、且不得又被 mapping 覆盖（矛盾）。「绝不静默丢」要在机制上兑现，不只在文档里写。

## 残余（挂账）

- `registry.atoms[m.atom]` / compile-gate `validateStructural` 的 `atomDefs[step.atom]` 是原型链读取：原型链
  键 atom 会被误描述为「在册无编译知识」，但仍 fail-closed 拒、无绕过无执行（codex R3 认可非阻断）；真修需动
  冻结的 compile-gate（出本契约范围）。
- 真机编译真实用例（route:human，ADR-0003）：桥纯 hermetic 建成；端到端「文本用例→spec」仍需一次真机 compile
  bring-up（LLM 编译期真机跑一遍产 events/observed 地面真值）+ 补缺失原子飞轮。人不在场只挂账。
