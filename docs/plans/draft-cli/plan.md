# draft-cli — 相2 草拟命令化（light）

## 背景

相2 首航（2026-07-02）用 scratchpad 脚本人工串了「骨架 → LLM 补缝 → 闸」，函数层 `lib/assertion-draft.mjs` 已经 `p4-drafter` 契约收口（golden 20 检查 + codex 四轮 PASS）。本轮把该流程收进 `casey draft` 薄 CLI（`bin/casey.mjs` 现为 `notImplemented` 桩），零新领域逻辑。决策 `proposed/GRILL.md` G1–G4。

## 改动（两处）

1. `bin/draft.mjs`（新，薄 CLI 零 LLM）：读 observed + compile-report（`handoff.assertionAtoms` 唯一源）→ `synthesizeSkeleton` → 可选 `--patch` 合并（LLM 补缝 CLI 外产出）→ 整份 `validateDraft` 闸（违规 65 不落草稿）→ `expected.draft-<caseId>.json` 经凭据门落盘（草稿含 `pending` 留痕）；caseId 三方一致闸；stdout 打印断言清单 + soft/pending 计数供人复核。
2. `bin/casey.mjs`：`draft` 分支从 `notImplemented` 改派发 `bin/draft.mjs`（同 `compile` 先例）；帮助文案同步。

## 非目标

人签 UX（`casey sign`，design §11 项 1，route:human 既定）；LLM 补缝内容生成（CLI 外，prompt 用既定件）；`intentTextByIntent` 意图留痕入草稿（TestCase 源，另议）。

## 验收（红先行，新 golden `tests/_golden/draft-cli.golden.mjs`）

- D1 纯骨架：observed fixture + 合成 compile-report → 草稿落盘、caseId 卷回、全局取证在场、exit 0（现红：dispatch 是桩 exit 3）。
- D2 补缝合并：`--patch` 合法两条 → 草稿含之、soft 语义正确。
- D3 违规补缝 fail-closed：`--patch` 带 `atl_` 裸字面量 → exit 65、**不落草稿**、stderr 有 problems 落点。
- D4 caseId 不一致 → exit 65。
- D5 缺参 → exit 64。
- 回归锁：`p4-drafter.golden`（函数层不动）+ `selftest --tier1`。
