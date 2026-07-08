# report-video-block — learn（P7 报告第二增量）

## 教训

1. **同一护身符复用到第二增量**：缺字段零行为差（`'replayVideo' in model` 区分旧模型）让本增量同样免动共享 `report-model.fixture.json`——既有 report 涟漪金牌（定向断言）自动免疫，涟漪仍只有一处 `report-model.schema.json` checksum（碰本契约 + seams-freeze 双 prd 重签）。加法碰冻结渲染核的稳定套路。

2. **自包含 vs 主页轻量的张力解法**：录像块用相对 `src` 的 `<video src="file" controls>`（非 base64 内联、非 http 外链）——既过 p7-report 的「无 http 外链 / 无 script[src] / 无 link[href]」自包含闸，又不违 report-spec §1「主页轻量、录屏 base64 内联在子页」。录像文件与报告同 run 目录（拆分式产物）。

3. **金牌要按 spec 精确形态断言、别只查含子串**：codex 揪出 MD 录像块只输出裸文件名、未按 GRILL D4「可点链接」产 `[file](file)`，而金牌只查 `includes(文件名)` → 假信心。改金牌为查精确链接形。延续 report-nl-atomic F5 元教训——**声明/含子串 ≠ 形态正确**。

4. **无录像不静默、与缺键零行为差两分**（report-spec #10）：`replayVideo` 键在且为 null → 产块并明示「无录像」；键不在（旧模型）→ 不产块。null 与「缺键」语义不同，渲染判据用 `'field' in model` 而非真值判定。
