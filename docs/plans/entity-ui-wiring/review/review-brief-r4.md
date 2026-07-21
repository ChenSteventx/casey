# entity-ui-wiring 异构评审 R4（终验：只看 R3 唯一 STILL_OPEN=H2 的补齐）

R3 指出的残缝：选项落笔前/点击后/回读前缺触发器 locatorStillBound；回读走惰性 bound.root locator 可被「原触发器隐藏保连接、替身可见触发器顶上」骗过。

补齐（见 r4-fix.diff，两侧同刻）：
1. 编译门与回放门在选项落笔前、点击后、回读前三个时点全部加 `locatorStillBound(page, triggers, 0, trigHandle)`（连同既有 verifyPinnedNodeDrawer + handleInsideRoot 三闸齐）。
2. 回读弃用惰性 locator，改 `readBoundAgentSelectValue(trigHandle)`——只在已绑定触发器物理句柄内查询 `.agent-bind-select__value`，可见判据页内计算（computedStyle+非零盒，与 nodeDrawerDomain 同口径），可见恰一才返回文本，否则证不出硬阻断。两文件各持同体同名助手（同刻）。
注：你 R3 描述的替身场景下，原触发器隐藏 → 三时点 `locatorStillBound(triggers:visible, 0, trigHandle)` 因可见触发器集合不再含原句柄而失败 → 硬阻断；即便走到回读，物理句柄内查询也读不到替身。
现成证据：s1 11/11、s3 7/7、gate 4/4 GREEN、tier1 GREEN。
要求：H2 判 CONFIRMED_FIXED / STILL_OPEN（file:line 理由）；新缝报 High/Medium；总判 PASS/FAIL。只读，结论输出 stdout。
