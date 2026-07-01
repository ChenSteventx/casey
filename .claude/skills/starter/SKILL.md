---
name: starter
description: 新 session 启动器：一句「/starter」告诉本 session 的 Claude——只需读 docs/NEXT-SESSION.md 接着干。仅当用户明确要求接续项目开工时使用（开场说「starter」「启动」「开工」「接着干」「新 session 怎么开始」）；若用户是在评审、解释或修改本 skill 本身，不要触发接续流程。本 skill 不做实现、不做裁定，只把「读接续文档、按它的下一步动手」这一动作固定下来。
---

# starter — Casey 新 session 启动器

把「新 session 怎么开工」压成一句：读 `docs/NEXT-SESSION.md`，按它接着干。开场只需 `/starter`，无需每次重述要读哪些文件、从哪续。

## 唯一动作

1. 读 `docs/NEXT-SESSION.md`——它是给接续 Claude 的入口索引 + 开场指令，含必读顺序、当前概览、下一步选项、环境坑。
2. 按它走：先照其【先读，别现编已决的事】对齐（`CLAUDE.md` / `CONTEXT.md` / `docs/HANDOFF.md` / `loop/GUARDRAILS.md` / `docs/adr/`），再按【下一步】任选其一动手。
3. 状态事实以 `docs/HANDOFF.md`、`loop/active-contract.json`、`git status --short` 为准（`docs/NEXT-SESSION.md` 只是入口索引/开场指令，可能滞后）；进场先 `git status --short` 核未提交现场。

## 铁律

- `docs/NEXT-SESSION.md` 是入口索引、不是状态事实源：它指路，真状态看 `docs/HANDOFF.md` + 活契约槽 + `git`。别在本 skill 里现编状态、别做裁定、别把桩当完成。
- 兜底：若 `docs/NEXT-SESSION.md` 不存在、明显过期、或与 `docs/HANDOFF.md` 冲突严重，停止接续，提示用户先跑 `/session-handoff` 刷新，别硬往下干。
- `docs/NEXT-SESSION.md` 由 `/session-handoff` 维护刷新；本 skill 只读它、绝不写它。
