# 下个 session 接续提示词（Casey / p2-intent-compile loop）

> 用法：下次只需说「读 `docs/NEXT-SESSION.md` 接着干」。本文件是给接续 Claude 的执行指令；状态事实以 `docs/HANDOFF.md` 为准，二者冲突时信 HANDOFF。

## 第一步：先读，别跳

1. `CLAUDE.md` 必读顺序：`CONTEXT.md` → `docs/design/txt2testreport-design.md` → `docs/plans/bootstrap/plan.md` → `loop/GUARDRAILS.md`。
2. `docs/HANDOFF.md`（现状、产物、冻结接口、下一步）。
3. `docs/plans/p2-intent-compile/`：`grill.md`（锁定决策）、`plan.md`（三 story + 验收点）、`regress-intel.md`（带 file:line 的实现参考，建 impl 时直接查、别重跑深读）。
4. `docs/adr/0006-fuse-autotester-regress.md`（融合决策 + 深读核验后的风险修正）。
5. 跑 `node bin/casey.mjs selftest --tier1` 确认环境。注意：别加 `2>&1` 这类重定向——会被 loop-guard 误判成 edit-impl 拦下；要看输出直接跑即可。

## 一句话现状

P2 已重定义（slug `p2-intent-compile`，full lane），grill/plan/accept 全 done，5 个红 golden + 2 fixture sha256 冻结、prd 生成，停在 loop 前。`edit-impl` 已解锁；`active-contract.json` 应仍是 `p2-intent-compile`（先 `node loop-kit/bin/contract.mjs show` 确认）。

## 这次要干：阶段3 loop（S1 优先，一个 story 绿了再下一个）

开 loop 先 `node loop-kit/bin/breaker.mjs --reset`。按下列冻结接口实现——这些签名被 golden 钉死，改测试文件 = Test Ratchet 判红，只能改 impl 去满足测试：

- S1（裁判内核）：
  - `bin/verdict.mjs --axes <in> --out <out>`：读 `{caseId,steps:[StepAxes]}`，跑 design §4.2 判定树出 `{steps:[{stepId,intentId,atom,verdict,reason}]}`，零 LLM、断言续跑（不 fail-fast）。
  - `lib/forensics.mjs` 导出 `checkErrorEnvelope(body,{successField,successValue}) -> {field,expected,actual,ok}`。
  - `bin/check.mjs --kind --op [--value] --validate-only`：词表/op 合法 exit 0、越界 exit≠0；含新增 kind `noErrorToast`、`countChange` 绝对归 0。
  - 验：`node tests/_golden/p2-verdict.golden.mjs` / `p2-forensics.golden.mjs` / `p2-check-vocab.golden.mjs`。
- S2（编译门）：`lib/compile-gate.mjs` 导出 `validateDraft(draft,{prefix,registry}) -> {ok,problems}`：复制并参数化 regress `_flow-authoring` 的双闸（结构 + 状态机），搬 `atoms.registry` 数据，前缀从参数注入（非写死）。验：`p2-compile-gate.golden.mjs`。
- S3（对账）：改 `design §2.1`（加 `noErrorToast`、信封成功字段参数化、补登断言续跑执行模型）、`bootstrap plan`（P3 recorder 降级为陌生站点孵化支线）。验：`p2-reconcile.golden.mjs`（查标记）+ term-lint 绿。
- 每轮：`node loop-kit/bin/gate.mjs --prd loop/prd-p2-intent-compile.json`（或 `--story <id>` 单跑），到 3/3 绿。

StepAxes 三轴形态与四态判据以 `grill.md` 加 `tests/_golden/fixtures/p2/verdict-cases.json`（8 个 case）为准：动作轴吐原始信号（resolution / identityReadback / driftProbe），由 `verdict.mjs` 推 actionPerformed（解析唯一或回读成立才 true，多匹配/坐标兜底才 ambiguous）；soft 断言不进裁定树；取证按 attributedStepId 归因、非时间窗。

## 纪律硬约束（反复栽的，务必守）

- 统一语言（ADR-0005）：动任何词先查 `CONTEXT.md`，有现成用现成、造词先登记。**绝不在回合输出里发加粗英文**——连散文标题加粗拉丁字母都会被 Stop hook 当场拦；每条要发的话先过 `node loop-kit/bin/term-lint.mjs`（检的是含加粗的最终形态），code 用反引号是安全的、不会被扫。裁判义用 裁定/裁判/多态裁定，路由义用 路由人。
- 阶段互锁：`edit-impl` 已解锁（accept done）；但 `commit-impl` 需 loop done、`push` 需 review done；动 `lib`/`bin` 前确认 active-contract 还是本 slug。
- 裁判零 LLM（护栏 #15）：`verdict.mjs` 纯确定性，自愈是其下游消费者、本期不做。fail-safe 不 fail-open（#14）：机器证不出一律 `NEEDS_HUMAN`。冻结测试只读（#1）。`.auth/`、`site.json` 凭据不进任何输出/日志/报告（#7）。
- **裁判按种类不可知（岔一，2026-06-29 锁）**：`verdict.mjs` 消费已判好的 `StepAxes`，对 `postAssertions` 只把硬断言 `ok` 与上、忽略 `soft`，**绝不按种类分支**（不 switch on `kind`）；取证缺失子字段当「本步无此特征」、不报解析错；断言 `kind` 只在 `check.mjs` 枚举。这样对话/发布等新维度是纯加法、`verdict.mjs` 不动。背景与岔二/岔三倾向见 `docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。
- Bash 小坑：含 `2>&1` 或 `>` 重定向、且命令里带 `bin/` 路径，会被 loop-guard 误判 edit-impl 拦——读类命令别带重定向。
- gate 绿 ≠ 完成（#16）：真机三轴回放（`@playwright/test` 薄壳跑 Heren）与注入故障出 SUT_DEFECT 是 route:human 的 tier-2，不在 loop 绿范围；它们在 prd 的 observability 里。

## 后续方向：数据飞轮（第一条绿后）

第一条 flow 真绿后，按维度扩 flow 是 roadmap（chat → 发布 → 画布最后），骑 regress 现成语料；排期、复利项、与 ratchet 的加法式关系见 `docs/FLYWHEEL.md`。对本次 loop 的直接影响：S1 的 `verdict`/`forensics`/`StepAxes` 抽象要按「将来喂三四种 flow 形状」设计，别只对着 `catalog_wf_crud` 长——第一条绿时飞轮的轴得已经通用，第二条接上去是移植原子、不是重做内核。

## 待裁决（route:human）

端态运行时 A/B/C（采纳 @playwright/test / 解耦纯 mjs / 桥接）待 spike 证据拍板，ADR-0006 推翻条件保持开放；其余见 `loop/prd-p2-intent-compile.json` 的 observability。

## 文风

正式、规范、自然的简体中文，不用网络用语、不用英文直译腔；复杂决策先 grill、再落 `CONTEXT`/ADR。
