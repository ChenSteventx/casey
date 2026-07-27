# Grok 独立研究/红队结论

- 评审入口：项目既定 Grok TUI；
- session：`019fa14e-2bc8-7273-a728-633eb64e0cc2`；
- 模式：只读仓库、联网查原始论文/官方项目；未读、未搜、未回显凭据；未改仓库；
- 范围：陌生页面 zero-shot 探索、observation/action schema、逐步 postcondition、轨迹蒸馏、
  unseen-site 验收、MVP 分期，以及与 Casey 实体身份/零 LLM 裁判的兼容性。

## 终局

**有条件 ACCEPT**：

- ACCEPT「探索编译 + 确定性蒸馏/晋升 + 复用现有裁判」总架构；
- ACCEPT 规划与 grounding 分层、候选剪枝、一次一动作、每步 progress proof；
- ACCEPT 首次探索默认产 generic candidate events，重复稳定片段再晋升 atom；
- ACCEPT `kind + name + code + platformId + scope` 多锚继续作为 mutation/关系/破坏动作硬边界；
- ACCEPT 以「可签测试资产产出率」而非一次 agent 自报成功率作为 Casey 的核心产品指标。

必须 REVISE：

- 任何把 zero-shot agent 留在日常回归热路径的方案；
- 任何把 LLM 的 completion/自评接入 `verdict.mjs` 的方案；
- 任何把 closed domain atom registry 直接当作 open-web 首次探索动作空间的方案；
- 任何缺 platformId 后退为名字唯一授权 mutation 的方案；
- 任何用隐藏 API 替代 UI 操作、从而绕过被测页面的方案。

## 对本计划的影响

本计划据此明确：

1. 新增的是相1b，不改相3/4/6；
2. `ExplorationTrace` 降权、不可 replay-ready；
3. generic events 首次不伪造 atom；
4. admission 与 progress verifier 全部零 LLM；
5. WALT 式能力学习只走后继 atom promotion；
6. GTTA 式 reconnaissance 只做有界、优先只读的环境笔记，不在 MVP 做参数适应；
7. 功能正确性继续由现有确定性 axes/verdict 和人签边界负责。
