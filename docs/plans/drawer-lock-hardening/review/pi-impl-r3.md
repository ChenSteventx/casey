# pi 实现评审 r3 —— drawer-lock-hardening（异构冗余第二路，r2 findings 加固复核，实现方=Claude，评审方=DeepSeek）

- 评审者：deepseek-v4-pro @ thinking high（pi，`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro`，指令内联 + 评审料以 @file 附带）
- 评审料/指令：与 codex 路同料同指令（`material-impl-r3.md` + `instr-impl-r3.txt` 同文指令，护栏 #9）
- 家族：DeepSeek ≠ Claude（crossFamily 成立；r1 已做模型验真三连，本轮沿用同调用式）
- 运行：2026-07-14，exit 0
- 驱动员：Claude（只备料/跑 CLI/归档，不代评审下判断）

## 总裁决

PASS（0 HIGH / 0 MED / 0 LOW；判 r2 HIGH 与 MED 均可信闭合、加固面未见新引入缺陷；另记一条非缺陷注意点：pin 属性 root 选择器在全页唯一前提下无歧义、但绕过物理句柄直接用 root 做敏感操作会有风险——现行代码无此路径）

## 评审输出全文（逐字归档；本轮 pi 输出直接为正式报告段、无 r2 的伪工具调用噪声，原始件 `pi-impl-r3-raw.txt`）

# 异构冗余实现评审 r3 —— drawer-lock-hardening

**评审对象**：r2 findings 加固（commit `1f29740`，diff 已由驱动员逐字节核对）  
**评审原则**：跨 LLM 家族独立审查，只审 (a) r2 每条 finding 的真闭合，(b) 加固本身是否引入新缺陷。  
**基线**：r2 findings 原文（codex 1 HIGH / 1 MED）与本 diff 全量。

---

## 一、r2 HIGH：pin 可复制 → 假绿

### finding 原貌（逐字）

> pin 可复制，HIGH#1 的错抽屉假绿仍未闭合。证据：
> - `verifyPinnedNodeDrawer` 只确认"标题域内唯一节点带有 pin"，不确认"全页只有该节点带 pin"
> - `root` 是全页属性选择器 `.hr-drawer__content-wrapper[data-casey-domain-pin=...]`，口径比标题域宽
> - 编译门同样问题
> - 可复现路径：MutationObserver 复制 pin 到冒牌，旧实现 pin 属性定根的 fields/triggers Locator 会命中冒牌 → 落笔 + 回读 unique = 假绿

### 加固全量（对照 diff 逐条核）

| 加固项 | 代码位置 | 核验结论 |
|---|---|---|
| 绑定时保留物理句柄 `rootHandle` | `pinNodeDrawer` 新增 `rootHandle` 字段，`return { ..., rootHandle }` | ✅ 双门同刻（`compile-atoms.mjs` / `replay-actions.mjs`） |
| 重判改为物理同一 + pin 全页唯一 | `verifyPinnedNodeDrawer` 签名为 `(page, label, pin, rootHandle)`，内部 `sameDomNode` 验证域内唯一者与被钉句柄物理同一，`page.locator(`[${ATTR}="${pin}"]`).count()` 要求恰为 1 | ✅ 任一失败 → `action_failed` |
| pinclone 握手夹具 | `server.mjs` 新增 `MutationObserver` 监听 `data-casey-domain-pin`，真抽屉被钉后同步复制到冒牌，**零时序依赖** | ✅ |
| G15a/b 伪证断言 | G15a 回放断言 resolution 为 `action_failed`、宽域候选恰 1 项空值；G15b 编译断言 blocker exit 65 + 零 events + notes 无"已填入" | ✅ 红先行在 r1 修复版上 2/2 败 |

**残缝检查（逐窗逐路径）**：

1. **pin 在钉后、重判前被复制**（pinclone 场景）：
   - `pinNodeDrawer` → `verifyPinnedNodeDrawer` 检查 `pinCount !== 1` → `status='action_failed'` → 全路径返回，拒绝绑定。✅
2. **pin 被复制后又从原始节点移除**（始终唯一但物理节点不对）：
   - `verifyPinnedNodeDrawer` 内 `sameDomNode(page, h, rootHandle)` 失败 → `action_failed`。✅
3. **全页唯一且物理同一，但后续 root 选择器仍按 pin 属性定位会否绕过物理闸**：
   - 所有后续敏感操作（`elementHandle`、`fill`、`click`、`inputValue`/`innerText` 回读）均走物理句柄（`actedFieldHandle`/`actedTrigHandle`/`actedOptHandle`），**不重新解析 Locator**。✅
4. **ddispatch 形态的真抽屉无字段**（pinclone 同 ddempty）：
   - 此时 `fcount=0` 走缺席分支，但 `pinNodeDrawer` 的重判已在更早阶段（pin 全页唯一检查）拦截。不会走到字段定位。✅

**裁定：此 finding 可信闭合。**

---

## 二、r2 MED：G12a/b/c 未覆盖落笔前重判 + 3000ms 窗口无确定性同步

### finding 原貌

> - `twindelay` 真抽屉无字段或触发器 → G12a/b/c 全在 `count=0` 分支，永远触不到 `preFill`/`preClick`/`preOpt`
> - 3000ms 为时基延时，无阶段握手证明"初判完成后才插入"
> - 建议：夹具采用显式阶段握手 + 增加"合法抽屉本身有可操作字段/触发器，初判后再复制、移除或迁移 pin"的金牌

### 加固处置（对照 plan.md 增补段 + diff 核验）

| MED 建议项 | 加固方案 | 核验结论 |
|---|---|---|
| 显式阶段握手 | 新增 `pinclone` 场景（`MutationObserver` 以 stamp 为相位信号），另有 `fieldmove`/`triggermove` | ✅ pinclone 已在 r3 diff 中；fieldmove/triggermove 也为握手 |
| "合法抽屉有可操作字段/触发器，初判后再迁移"的金牌 | `fieldmove`（字段 focus 时搬移同一物理 input）+ `triggermove`（触发器 click 后搬移同一物理触发器），分别对应 G16a/b、G17a/b | ✅ 这两个场景的**真抽屉都有字段/触发器**，会走完整重判路径 |
| 原 G12 的 count=0 盲区 | 未在 G12 本身上修改——合法，原真抽屉设计为无字段 `ddempty` 形态。新增 fieldmove/triggermove 覆盖互补缺口 | ✅ 解释见下 |

**设计意图校验**：原 G12 的真抽屉被设计为无字段/触发器，正是为了验证"检查后窗口前插"导致惰性 Locator 漂移。此时字段缺席，`count=0` → `none`，这是正确的 fail-closed 行为，不是缺陷。MED 建议"让真抽屉有字段/触发器"被采纳在 fieldmove/triggermove 中——两者覆盖了同一攻击面（动作窗口重判）但通过不同路径（物理控件迁移）进入。

**裁定：此 finding 可信闭合；两条覆盖路径（pinclone 握手 + fieldmove/triggermove）形成防守纵深。**

---

## 三、r3 加固面无新引入缺陷（关键路径逐窗扫描）

### 3.1 字段动作拆分（focus → 重验 → fill → 重验）

回放/编译双门新增流程：

```
focus() → afterFocus 重验（物理同一 + pin 全页唯一 + 物理包含）
  → fill() → afterFill 重验（同上）
  → 回读
```

**fieldmove 场景演习**：
1. `actedFieldHandle.focus()` → 触发 `moveFieldOnce` → 字段搬到 `action-window-fake`（无 pin 属性，不在 `root` 内）
2. `afterFocus` → `handleInsideRoot(actedFieldHandle, bound.rootHandle)` → **冒牌抽屉不在被钉句柄内 → 失败**
3. `fill` 不执行，返回 `action_failed`

> 红证：r2 版一把 `fill` 会直接写入同句柄（虽已搬移）+ 回读成立 → unique 假绿。r3 修复后正确拒绝。✅

**残缝**：`fill` 内部 Playwright 会再次 focus。此时字段已在冒牌，`fill` 对同句柄写入——但因为 `afterFocus` 已经因 `handleInsideRoot` 失败而抛错，`fill` 不会执行。✅

### 3.2 下拉拆分（点触发器 → 重验 → 绑选项 → 点选项 → 重验）

**triggermove 场景演习**：
1. `trigHandle.click()` → 原始 listener 开浮层 → `moveTriggerOnce` 搬触发器到冒牌
2. `afterTriggerClick` → `handleInsideRoot(trigHandle, bound.rootHandle)` → **不在被钉节点内 → 失败**
3. 不点选项，返回值 `action_failed`

> 红证：r2 版继续选项并从同句柄回读 → 精确回读成立 → unique 假绿。修复后正确拒绝。✅

**选项浮层 teleport 到 body 的防护**：
代码明确说明浮层无祖先物理包含可验，靠两道闸：(1) `oc === 1` 唯一性闸（浮层内恰一个目标选项）；(2) 触发器物理句柄回读兜底（值必须落在 `trigHandle` 上才算）。即使选项在 body 中，若被误点，触发器值由同句柄回读——在本场景中，`trigHandle` 已被搬到冒牌，但 `afterTriggerClick` 已将其拒绝，不进入选项步骤。✅

### 3.3 编译门 `run.emit` 返回值不再被忽略

`compileWorkflowSelectNodeDropdown` 和 `compileWorkflowSetNodeField` 新增：

```js
const emitResult = await run.emit(spec, async () => { ... });
// 后置核验中
if (emitResult.resolution !== 'unique' || ...) { ... blocker ... }
```

**预防面**：emit 内部抛错后，旧实现可能只依赖内部 throw 阻断；现在即使 emit 内部吞错返回 `action_failed`，后置核验也会拦截。这是防御纵深，未引入新缺陷。✅

### 3.4 ElementHandle 释放

- `disposeHandle` 封装在 `finally` 块中
- 所有临时句柄（`actedFieldHandle`、`actedTrigHandle`、`actedOptHandle`、`exactTextHandle`）+ 长生命周期句柄（`bound.rootHandle`）均在各自 finally 中释放
- 失败路径（blocker return / throw before try）中 `pinNodeDrawer` 已在非 ok 状态内部 dispose `rootHandle`

**边界检查**：
- 回放门 `doSetNodeField` / `doSelectNodeDropdown` 早期失败 return（`bound.status !== 'ok'`）位于 try 块外，但此时 `bound.rootHandle` 已被 `pinNodeDrawer` 内部 dispose → 无泄漏。✅
- 编译门所有 return（含早期 blocker）均在 try 块内，finally 统一清理。✅

### 3.5 pin 属性选择器 root 的残余风险

`root = page.locator(`.hr-drawer__content-wrapper[${ATTR}="${pin}"]`)` 仍然存在。在 pin **全页唯一** 的前提下（`verifyPinnedNodeDrawer` 已保证），root 匹配唯一节点，无歧义。但如果未来有人绕过物理句柄直接用 root 做敏感操作，会有风险——但当前代码中所有写操作和回读均走物理句柄，**不存在此路径**。属于防御设计中的注意点，非缺陷。

---

## 四、金牌覆盖矩阵（验证 r2 findings + r3 加固的伪证力）

| 场景 | 物理包含重验 | 覆盖的 r2 finding | 红证方向 |
|---|---|---|---|
| G12a/b/c（twindelay） | 无字段→count=0，不进入动作 | HIGH#1 检查后窗口（惰性漂移） | 旧实现的动态 root 漂移到冒牌 → unique 假绿 |
| G15a/b（pinclone） | pin 全页非唯一→pinNodeDrawer 直接失败 | HIGH pin 可复制（握手版） | r1 修复版填冒牌字段 unique 假绿 |
| G16a/b（fieldmove） | focus 后物理包含失败→拒填 | MED 建议：合法抽屉有字段+初判后迁移 | r2 版真填域外字段 unique 假绿 |
| G17a/b（triggermove） | click 后物理包含失败→拒选 | MED 建议：合法抽屉有触发器+初判后迁移 | r2 版真改域外触发器 unique 假绿 |

**伪证力评估**：所有六条新金牌的红证均在修复前版本上以 "unique 假绿" 或 "exit 0 产成功事件" 的形态实证旧实现漏洞，断言不可被平凡绕过。✅

---

## 五、红线与既有语义核查

- **凭据外泄**：diff 无 `.auth/`、密码、真目标地址。✅
- **术语违例**：无繁体/未注册造词。所有注释为简体中文。✅
- **`bin/verdict.mjs`**：diff 无变更。✅
- **`events.schema.json`**：无变更。✅
- **既有门禁复验**：三 gate GREEN、tier1 GREEN、33/0 金牌（驱动员在备料中独立复验）。✅

---

## 总裁决

**PASS**

r2 两条 findings 均已可信闭合：pin 可复制被物理句柄绑定 + pin 全页唯一双重检查堵死；MED 建议（确定性握手 + 可操作抽屉的动作后重判）以 pinclone/fieldmove/triggermove 三场景及对应金牌落地。

未发现新引入的 fail-open / 假绿 / 假阴，句柄生命周期无泄漏，既有语义无破坏。

## 驱动员事实核对（仅核「引用是否存在/机制是否如述」，不构成对 findings 的采信/驳回）

- 本轮 pi 引用的识别符经驱动员逐一核对均实存且机制如述：`afterFocus`/`afterFill` 重验（`lib/replay-actions.mjs:489/500`）、`moveFieldOnce`/`moveTriggerOnce`/`action-window-fake`（`tests/fixtures/fake-sut/server.mjs:417/397/327`）、`emitResult` 后置核验（`lib/compile-atoms.mjs:791/841/960/984`）、G15/G16/G17 金牌与红证方向（`tests/_golden/drawer-lock-hardening.golden.mjs`）——事实精度较 r2（曾转述不存在的函数名/行号）显著提高。
- 双路裁决相左：codex 路 NEEDS CHANGES（2 HIGH）vs pi 路 PASS。分歧点机械注记见 `codex-impl-r3.md` 事实核对末条——pi 残缝检查第 2 条与 codex HIGH#2 审的是不同 pin 搬移落点（pi：落点进标题域被 `sameDomNode` 拦；codex：落点为无标题嵌套 wrapper、标题域仍回 `rootHandle`、两闸皆过）；pi 3.5 节自记的「绕过物理句柄直接用 root 操作会有风险、现行无此路径」未覆盖「字段/触发器计数以 pin 根为域」这一路径本身。并集差集由实现侧对账，驱动员不代评审采信或驳回。
