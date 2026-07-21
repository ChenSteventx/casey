# entity-ui-wiring 异构评审 R3（终审：只看 R2 两条 STILL_OPEN 的修复）

- H2（编译侧域锁不完整→R2 判 STILL_OPEN）：编译门重写为 selectNodeDropdown 同款协议——pinNodeDrawer 后触发器物理句柄绑定，落笔前/落笔时（emit 动作回调内）/选项落笔前/点击后/回读前五个时点 verifyPinnedNodeDrawer + locatorStillBound + handleInsideRoot 重判，任一失败硬阻断；回放门 doBindAgent 同刻实现同一协议（触发器/选项物理句柄 + 四时点重判）。见 r3-fix.diff。
- M3（清理边界→R2 判 STILL_OPEN）：两金牌改「临时 prd wx 先行独占创建（同名抛错时零散置残留）→ 散置目录/authority 随后（失败即回滚 prd 再抛）→ finally 全清」；s1 的 SUT 启动移入受控区（authority 变量置 null、finally 条件清理）。金牌实测零残留（loop/ 无 tc_eui/tc_bindagent 临时 prd、无 .golden-scratch-*）。
现成证据：四金牌 s1 11/11、s2 8/8、s3 7/7、s4 3/3 全绿；gate 4/4 GREEN；tier1 GREEN。
要求：两条逐一 CONFIRMED_FIXED / STILL_OPEN（file:line 理由）；新缝报 High/Medium；总判 PASS/FAIL。只读、结论输出 stdout。
