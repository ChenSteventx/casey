# plan —— replay-magnifier-dispatch

缝与裁定见 `GRILL.md`。本文件只写落地形状。

## 一、改动面（两个文件，均在 lib）

### A. `lib/workflow-delete-spec.mjs` —— 谓词收单点

新增导出 `isMagnifierSearchClick(ev)`，判据逐字取自现有白名单支（`validateWorkflowDeleteBindings`
内联的那三条）：事件属 `workflow.deleteByName` 域的 click ∧ 文案 null（semantic.name 与 text
均无）∧ value 缺（非字符串或全空白）∧ `fallbackCss === '.hr-input__suffix .search-icon'` 逐字。
`validateWorkflowDeleteBindings` 的白名单支改为调用它——**判定字面只在一处活着**。

### B. `lib/replay-actions.mjs` —— 分发层接通

`performActionOnPage` 的 deleteByName-click 分支入口先判 `isMagnifierSearchClick(ev)`：
命中即**不进破坏性三 click 的绑定义务**，落到函数末尾的通用路径
（`resolveCandidate` → `gateAndAct`，既有 `formalActionGate` 锁定门）。

执行语义零特殊化（GRILL D3）：resolve 非 unique 照返；元素唯一但点不动照落
`action_failed`——绝不为放大镜造宽容。它在真机上该红还红，只是不再「没点就判败」。

## 二、不动什么（与 GRILL 非目标同）

- 编译模板两处发射（`compile-atoms-workflow-crud.mjs:319/:402`）与 nav 模板一处
  （`compile-atoms-workflow-nav.mjs:107`）一个字节不动——S1 冻结金牌钉着发射面。
- 前置闸判据字面不动（金牌 `delete-spec-magnifier` 钉着），只换内部实现为共享谓词。
- `intent-action-fold.mjs` 折叠语义不动。
- 三例 `cases/` 全部件（events / expected / entity-locks / authority）零字节不动——
  这正是本修法优于「模板重表达」的地方：零重编译零重签。

## 三、验收（红先行，accept 阶段冻结）

新开金牌 `tests/_golden/replay-magnifier-dispatch.zero-sut.golden.mjs`（直驱真实
`dispatchReplayAction` + mock 页）：

| # | 情景 | 修前 | 修后 |
|---|---|---|---|
| Ra | 放大镜形状事件、mock 页 icon 唯一 | **红**（`action_failed` 拒点） | `unique` + acted |
| Rb1 | css 对但携 value | 拒（不入白名单支） | 拒（同前，零放松） |
| Rb2 | css 对但携文案「删除」 | 走删除触发支（要 value）→ 拒 | 同前 |
| Rc | 非放大镜 css 且缺 value 的 deleteByName click | 拒点 | 拒点（既有 fail-safe 零放松） |
| Rd | 结构钉：css 字面在 `workflow-delete-spec.mjs` 恰一处、`replay-actions.mjs` 零出现 | **红**（谓词尚未收单点前分发层若写字面即红；修前 replay-actions 零出现但也无执行，Ra 才是主红） | 绿 |
| Re | 前置闸回归：`validateWorkflowDeleteBindings` 对白名单/矛盾/三 click 的既有判定逐字不变 | 绿 | 绿（换内部实现不换行为） |

突变闭环（还原用 scratchpad 备份 + sha256 核对，绝不 `git checkout`）：
1. 摘分发层的谓词调用（回拒点）→ Ra 红；
2. 谓词判据反转 → Ra/Rb 双红；
3. 分发层不 import 而内联字面 → Rd 红。

## 四、护栏 #19 回归面

受影响金牌选集规则沿用上契约（文件名含 `replay|delete` ∪ 引用删除域，筛 zero-sut 与 static），
外加本契约新金牌与 `delete-spec-magnifier`、`wf-delete-search-filter` 两份关联冻结金牌。
跑批同抓 stderr 分流 `INVALID_IO`（掉盘假红教训，learn 已档）。

## 五、合并后的真机验证（不在本契约内，另走票据）

铸新批级回放票据（三例绑定、Steven 人签）→ 逐例重跑。预期：清理意图八事件全 ok →
折叠 `unique` → 裁定 PASS 7/7（history 口径）/ 4/4（catalog 口径）。若放大镜在真机仍点不动
（如新的时序缝），那是**真红**，照 fail-safe 出 `NEEDS_HUMAN` 再诊——本契约只还它被执行的资格，
不担保它必成。
