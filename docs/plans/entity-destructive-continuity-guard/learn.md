# entity-destructive-continuity-guard · learn（阶段 5 沉淀）

> 状态：六阶段全 done；codex 异构评审六轮 R6 终判 PASS（review/codex-verdict.md）。最深契约。base=entity-identity-spine（C0 脊）。

## 交付结果

破坏性目标连续性守卫：删/改/加工具类原子执行前，须按 target-ID 唯一命中已铸 `identityObservationRef`、跨 kind 硬闸、缺 ref fail-closed 拒。编译期与回放期两相都设守卫（两相都真执行破坏）。

## 教训

1. **守卫要设在所有真执行破坏的相**：初版只在 replay 设守卫，但 compile 也真删——编译期 fail-open 半开（codex R3 逮）。凡是会产生破坏副作用的相都要各设一道，不能假设「上游相拦过了」。
2. **跨 kind 观测不能互铸 ref**：同名不同 kind（agent 观测 vs `workflow.deleteByName`）不能相互背书；`selectObservationForDestructiveTarget` 加 `boundKind` 硬闸，kind 不符→`OBSERVATION_SELECT_NO_MATCHING_KIND`（codex R5 逮同名跨 kind 绕过）。名字相同不代表实体相同，kind 是身份的一部分。
3. **诚实半闭口径，别 over-claim**：fail-open 半边（channel-less 破坏、跨 kind 误铸）已 fail-closed 关死（hermetic 可证）；ref 消费 / 出站 `platformId` 核验半边本质需真机 `page.route` 出站拦截→route:human。codex R5 逮出 PRD 把半闭写成全闭——结论必须对全量取证账，铸了没被消费就不能算核验闭合。
4. **codex 后台评审必带 `< /dev/null`**：codex exec 拿了位置提示词后仍读 stdin 等 EOF，后台 shell stdin 不关就干等到超时（本契约两轮各卡 20 分钟实证）。`< /dev/null` 给立即 EOF + `timeout 1200` 兜底（记忆 expose-repo-to-reviewers 已并入）。
