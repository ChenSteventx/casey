# zero-shot-page-execution-research — learn

1. Casey 不是缺一个更长的 prompt，而是缺「观察压缩 → grounding → 动作准入 → progress proof」
   这层可审计运行时。
2. `events.json` 已允许 atom 缺省，因此陌生页首次成功轨迹可以先降成通用 events；
   closed atom registry 不必、也不应承担 open-web 首次发现。
3. zero-shot 的正确产物不是 PASS，而是 candidate trace。只有签后 replay 的确定性事实能进 verdict。
4. WALT 的能力/工具学习思想有用，但 UI 测试不能为了成功率绕过 UI 调 API；工具只作计划抽象或
   后继原子，最终动作仍覆盖被测界面。
5. 页面元素唯一不等于业务实体唯一。affordance grounding 和 entity identity 必须两门分开，
   后者继续要求 `kind + name + code + platformId + scope`。
6. 第一个实现包应只闭合一个陌生页面单步，不把真实模型、长程规划、mutation、原子晋升一起做。
7. 衡量 Casey zero-shot 的首要指标应是「可签 candidate 产出率 + 签后 replay 稳定率」，
   而非模型自报 task success。
8. 用户真实主场景是 AI 中台连续改版，必须把 warm replay survival 与关闭 page memory 后的
   cold zero-shot compile 分开；医生站适合 web 同通道留出，Hi 小助若为 CEF 应诚实后置。
9. 完整工序要在探索前加入 grill、冻结 effect/identity/expected、业务前置条件 setup flow 和
   known-atom dominance；不能默认观察页面后立刻调用 LLM。
10. 「不确定交给 LLM」仍过宽。grounding 可交 typed proposal，身份、用户意图、已提交 effect、
    主观/专业断言应路由人。
11. `TestCase.expected/globalAssertions` 当前没有直接进入 draft，是确定性断言优先的真实接缝；
    最小实现应复用现有 assertion draft/sign/frozen，不另造断言格式。
12. 现有 `flow-bridge/compile-gate` 已有投影忠实、可编译 atom、requires/provides 和实体角色门；
    M0 应在其前新增 intent plan，而不是复制第二套状态机或身份内核。
13. 示教 capture 不能直通 replay。当前生产 `record` 又尚未生成正式 intake 所需的身份旁车、包 manifest
    与 driver receipt，因此第一版要用显式 development-only raw reproduction + atom roundtrip 跑通，
    并把正式 signed intake 双回放留给后继。
14. 「人工录制成功」至少要在 fresh browser 中复现全部动作；这种技术复现仍不是 PASS。正式机器结论
    继续要求 candidate 经签署后进入 replay/verdict。
15. source 与 distilled 两次回放必须有独立 artifact role、run namespace、测试数据/reset 和身份锁 hash；
    等价比较 intent、identity、effect、terminal predicates 与 cleanup，而不是 event 数或最终截图。
16. container-only/iframe 唯一性目前无法无损进入现役 events schema；`finish` 是控制消息，
    `scroll/goBack` 也不能在未扩 IR 前宣称可 canonicalize。
