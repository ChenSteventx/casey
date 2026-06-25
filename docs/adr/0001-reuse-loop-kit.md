# ADR-0001：Casey 复用 autotester 的 loop-kit，作为其第二消费者

- 状态：已接受
- 日期：2026-06-25

## 背景

autotester 的 ADR-0001 把 loop-kit（loop engineering 工具箱：契约/质量门禁/熔断器/统一语言）孵化在其仓库内，并约定**提取触发条件 = 第二消费者出现**。Casey 即第二消费者。需要决定：Casey 是把 loop-kit 独立成仓引用，还是先拷贝同仓。

## 决策

1. **先拷贝同仓，不急于独立成仓**：把 `loop-kit/bin/*`（gate / breaker / contract / term-lint / hook-*）按 autotester ADR-0001「提取只是搬目录、不是重构」原样拷入 `casey/loop-kit/`。这些脚本以自身位置相对解析 ROOT、零第三方依赖、领域无关，拷入即可用。
2. **引用/拷贝分界线照旧**：归 kit 的（引擎/schema）放 `loop-kit/`；归项目的（`CONTEXT.md`、ADR、`GUARDRAILS.md`、`prd-*.json` 实例、`config.json`）放仓库常规位置。
3. **稳定性锚定在数据契约**：`prd.json` / `config.json` / `audit.jsonl` 带 `schemaVersion`，runner 可换、格式不破坏。Casey 域的多态 `verdict` 枚举在 P4/P5 经 `schemaVersion` 2 扩展，不改 1 的形状。
4. **真正独立成仓推迟到有跨仓维护痛点时**：在此之前两仓各持一份拷贝，bug 修复手动同步；同步成本超过独立成仓成本时再提取（YAGNI）。
5. 凭据类配置（如评审兜底 key）放用户主目录 `~/.loop-kit/`，既不进 kit 也不进项目。

## 后果

- 收益：立即获得纪律机制（契约互锁/门禁/熔断/统一语言），零设计成本；与 autotester 演化解耦。
- 代价：两仓暂时各持 loop-kit 拷贝，引擎级 bug 需双向手动同步。
- 自举豁免：Casey 的 P0 引导（搬 loop-kit、起 loop/）按入口分流属 `direct`，未走完整流水线——它是流水线的地基，无法自举。自 P2 起对 `lib`/`bin` 的实现一律走完整流水线。
