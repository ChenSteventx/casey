# GRILL — draft-cli（light，机械决策）

授权：HANDOFF「直接下一步 ①」+ Steven「继续开」（2026-07-02 深夜）。函数层（`lib/assertion-draft.mjs`）已经 `p4-drafter` 六阶段收口，本轮纯命令化、零新领域逻辑。相2 首航已人工走通同流程（scratchpad 脚本），本轮把它收进产品 CLI 面。机械决策四条：

- **G1 CLI 形状**：`casey draft <caseId> --observed <f> --compile-report <f> --out-dir <d> [--patch <f>]`——`assertionAtoms` 唯一源 = `compile-report.handoff.assertionAtoms`（P4 交接面四件套的既定位）；产物 `expected.draft-<caseId>.json`（未签草稿，等 LLM 补缝复核/人签）。
- **G2 补缝通道**：`--patch` 可选 JSON 文件（`[{intentId,kind,op,value,soft?}]`），由 LLM 在 CLI 外产出（prompt/schema 用 `docs/plans/p4-drafter/proposed/llm-patch.draft.md` 既定件）——同 P3 flow 草稿范式：CLI 是 L0 复核器不产内容。合并后整份过 `validateDraft` 闸，违规 exit 65 且**不落草稿**（fail-closed，含骨架在内整份拒——半份草稿比没有更危险）。
- **G3 一致性闸**：命令行 `<caseId>` 与 observed.caseId 必须一致（同 compile 先例）；`pending[]`（映射不出的原子）与 soft 计数打印到 stdout 供人复核，且随草稿落盘留痕。
- **G4 退出码与落盘**（codex R1-F4 后修正措辞）：64 缺参 / 65 输入坏·闸拒 / **1 凭据门拦（同 `compile` 文档先例「1 运行时失败/凭据门拦」，跨 CLI 一致性优先）** / 0 成功；所有落盘过 `lib/cred-gate.mjs`（G5 先例）。人签（盖签署三字段→冻结 `expected.frozen.json`）不在本 CLI——route:human 既定（design §11 项 1），首航的 scratchpad 冻结脚本继续作过渡。
