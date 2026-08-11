<!-- 来源说明：正文自 grok 新会话转录 chat_history.jsonl 的含总判 assistant 消息逐字提取。
     R1 会话输入部件楔死后按配方杀会话重起，delta 在新会话完成（简报在盘上自足）。 -->

# Delta 复审：`f995539` → `003989c`

**范围**：`git diff f995539 003989c`（谓词收紧 + Rf 九检 + Rd 调用点/双引号钉；pi Medium 记档）  
**还原纪律**：突变均 `cp` 备份 + `sha256sum -c`，未用 `git checkout`。

**绿基线（独立）**

| 命令 | 退出码 |
|---|---|
| `node tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs` | **0**，34/34 |
| `node tests/_golden/delete-spec-magnifier.zero-sut.golden.mjs` | **0**，6/6 |
| `node tests/_golden/wf-delete-search-filter.zero-sut.golden.mjs` | **0**，16/16 |
| `node tests/_golden/workflow-delete-spec-preflight.static.golden.mjs` | **0** |
| `node ../loop-kit/bin/gate.mjs --prd loop/prd-replay-magnifier-dispatch.json` | **0** GREEN 1/1 |

还原后 sha：`workflow-delete-spec` `2e86b060…`、`replay-actions` `9624b238…`、金牌 `ed6a9a5d…` 与 `003989c` 一致。

**Critical / High / Medium：无。**

---

## 1. Rf 是否真钉住偏点面？有无第四种次级定位字段？

**是，钉住了；无第四种可偏点字段。**

**突变（摘三字段守卫）**  
去掉  
`&& ev.semantic == null && ev.role == null && ev.fieldLabel == null` 后：

- 独立探针（`getByLabel` count=1）：`fieldLabel:'搜索'` → `isMagnifierSearchClick=true`，`resolution=unique`，`clicks=['label:搜索']`（**偏点复现**）
- 金牌：**exit 1，9 红**（Rf 三形状 × 分发/零点击/前置闸）
- 还原：`sha256sum -c` OK

**`semanticLocator` 全部分支**（`lib/replay-actions.mjs:28-35`）：

1. `semantic.kind==='role' && role`
2. `semantic.kind==='label' && name`
3. `semantic.kind==='text' && name`
4. `ev.role && ev.accessibleName`
5. `ev.fieldLabel`

凡能返回非 null locator 的路径，都依赖 `semantic` / `role` / `fieldLabel` 至少一者非 null。收紧后三者皆须 `== null`，上述五支全封。

**非偏点残留（不构成第四字段）**：

| 形状 | 谓词 | 原因 |
|---|---|---|
| 仅 `accessibleName` | true | locator 要 `role∧accessibleName`，单独无效 → 仍走 `fallbackCss` |
| 仅 `placeholder` | true | 不在 `semanticLocator` 分支 |

结论：可偏点次级定位面已收完；无遗漏第四字段。

---

## 2. 收紧有没有误伤？

**未误伤。**

**三例六真件**（只读自 `~/casey-review-20260810/casey/cases/`，本浅克隆无 cases）：

| 用例 | stepId | keys |
|---|---|---|
| catalog | atstep_13, atstep_17 | 仅 `stepId/intentId/atom/action/fallbackCss` |
| publish | atstep_15, atstep_19 | 同上 |
| history | atstep_16, atstep_20 | 同上 |

六件：`value/text/semantic/role/fieldLabel` 全 null，纯 `fallbackCss`。

**M1**（`delete-spec-magnifier`）：`atstep_13/17` 仅 `{fallbackCss:MAG}` → 收紧后仍 ok（金牌 exit 0）。

**冻结金牌**：`delete-spec-magnifier` exit 0；`wf-delete-search-filter` exit 0。  
编译发射（`compile-atoms-workflow-crud.mjs:319/:402`）亦为纯 `fallbackCss`。

---

## 3. Rd 加固后，R1 两条绕法是否都已逮住？新绕法？

**两条都逮住。**

| 突变 | 操作 | 结果 |
|---|---|---|
| 死 import | 条件去掉 `&& !isMagnifierSearchClick(ev)`，保留 import | exit **1**，**7 红**（含「Rd 分支条件真调谓词」） |
| 双引号内联 | 条件改为 `!(ev.fallbackCss === ".hr-input__…")` | exit **1**，**12 红**（含「Rd 双引号字面…零出现」+ 调用点钉） |
| 还原 | cp + sha256 | 34/34 绿 |

**仍可能的绕法（有意规避，不值得再加固）**：

| 绕法 | Rd | 成本/兜底 |
|---|---|---|
| 字符串拼接 / 模板字面量拼 css | 可能仍绿 | 要改谓词定义；行为分叉靠 Ra/Rb/Rf |
| 本地别名 `const f=isMagnifierSearchClick; !f(ev)` | 调用点钉红 | 已覆盖意图 |
| re-export 中转改 import 路径 | import 正则红 | 已覆盖 |

功能钉（Ra/Rb/Rf）兜行为分叉。再上 AST 等价检测性价比低。**不追加 Medium。**

---

## 4. pi Medium（空串 value）记档不收紧是否成立？

**成立；与 Medium-1 的区分站得住。**

独立探针（golden 兼容 mock）：

| 形状 | pred | 闸 | resolution | clicks | semanticTouches |
|---|---|---|---|---|---|
| 纯放大镜 | true | ok | unique | `[MAG]` | [] |
| `value:''` | true | ok | unique | `[MAG]` | [] |
| `value:'   '` | true | ok | unique | `[MAG]` | [] |
| `fieldLabel:'搜索'` | false | unsupported | action_failed | [] | [] |
| `value:''`+fieldLabel | false | unsupported | action_failed | [] | [] |
| `value:''`+text「删除」 | false | missing_target_binding | action_failed | [] | [] |

**区分**：

- **空串 value**：仍无次级定位字段 → `semanticLocator` null → **同一 `fallbackCss` 放大镜本尊**；行为与规范形状全同。谓词对「value 缺」的判定与 f995539 / Steven 2026-08-08 前置闸字面一致（`typeof !== 'string' \|\| !trim()`）。收紧为 `value==null` 会让闸对空串从放行变具名拒，越出冻结语义且需换签。
- **Medium-1**：次级字段让通用门**点到别处**——修前拒点、接通后新可达偏点面，必须收。

同属「修前拒、修后可达」，但一个是**同目标真执行**，一个是**异目标偏点**。记档（learn.md 第五节）合理。

---

## 5. 换签记录与 diff 是否逐项对得上？

**对得上。**

| 叙述项 | diff 实证 |
|---|---|
| 金牌 23→34，checksum `2a81e000…`→`ed6a9a5d…` | 工作树/PRD/`git show f995539` 三方一致 |
| 谓词加 `semantic/role/fieldLabel` 缺席 | `lib/workflow-delete-spec.mjs` 唯一生产改动 |
| Rf 三形状九检 | 金牌新增 Rf 块 |
| Rd 调用点 + 双引号零出现 | 金牌 Rd 块 |
| pi 空串记档不收紧 | `learn.md` 第五节 + `fixes-r1.md` |
| `checksumAmendments.files` 仅金牌一件 | 正确（`testChecksums` 只冻验收件；prod 改动不进该表） |
| 同 commit 的 docs/reviews/evidence 更正 | 在 diff 中，不进 checksum 表，叙述未谎称「只改金牌」于 commit 层面——amendment 明确「只动…新金牌」指 **换签棘轮文件** |

`plan.md` / `GRILL.md` / `red-baseline.txt` checksum 本 delta 未变。

---

## Findings

**Critical: 0 / High: 0 / Medium: 0**

处置与证据一致：grok 两条 Medium 已用谓词+Rf、Rd 钉死；pi Medium 记档理由经路径探针成立。

DELTA-DONE APPROVE