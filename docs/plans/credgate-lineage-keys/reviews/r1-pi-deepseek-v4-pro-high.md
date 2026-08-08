All verifications complete. Here is my final review:

---

# 评审报告 · credgate-lineage-keys

基线：`1a601fa` · 评审对象：`d27af96`（HEAD）

---

## 白名单合规

改动 7 文件，全数在列：

| 文件 | 状态 |
|------|------|
| `lib/cred-gate.mjs` | 白名单 ✓ |
| `tests/_golden/credgate-lineage-keys.zero-sut.golden.mjs` | 白名单 ✓ |
| `loop/prd-credgate-lineage-keys.json` | 白名单 ✓ |
| `docs/plans/credgate-lineage-keys/**`（4 文件） | 白名单 ✓ |

---

## 风险逐一判定

### R1 走私面 —— **无发现**

核了以下场景，全部安全：

- **JSON 转义/Unicode 转义**：`"\u0062atchToken"` 不会匹配中和正则是字面量 `batchToken`——不中和，原键 `atchToken`（含 `token` 子串）仍被关键词扫描拦。✓
- **嵌套引号**：值形状 `[A-Za-z0-9_-]` 不含引号与反斜杠——JSON 转义值 `\"` `\\` `\n` 均不匹配形状，不中和、原键照拦。✓
- **重复键**：第一键合形 → 中和；第二键形状不符 → 不中和、原键照拦（`token` 命中）。两键皆合形 → 皆中和，值在扫描副本中仍全额受关键词扫描。✓
- **键名大小写变体**：`BatchToken` ≠ `batchToken`（正则对大小写敏感）→ 不中和、原键照拦。✓
- **非 JSON 裸文本**：`"batchToken": "secretValue"` 在 prose 中仍匹配中和正则可以中和，但值受关键词扫描（此处 `secretValue` 含 `secret`→ 拦）。✓
- **豁免键值含关键词**：`"batchToken": "authorization"` / `"secret123"` / `"x-api-key"`——值在扫描副本中完整在场，关键词扫描全拦（实测逐一证实）。✓
- **值含 `bearer `**：含空格，不匹形状 `[A-Za-z0-9_-]` → 不中和、原键 `token` 命中。✓

**结论**：走私面零发现。两层防御（关键词扫扫描副本 + 字面量扫原文）无短路路径。

### R2 中性标记拼接 —— **无发现**

`<nc-lineage-key>` 逐字符核：

- `token` → 不命中（`<nc-lineage-key>` 不含连续 `t` `o` `k` `e` `n`）
- `bearer ` / `secret` / `password` / `authorization` / `cookie` / `apikey` / `x-api-key` / `set-cookie` / `credential` → 全部不命中
- 相邻 JSON 字符 `"` `:` `\n` ` ` 与标记首尾各字符拼接，不构成任何禁字段关键词

**结论**：零发现。

### R3 正则鲁棒性 —— **无发现**

- 模式 `"${key}"(\s*:\s*)(null|"[A-Za-z0-9][A-Za-z0-9_-]{0,63}")` 无嵌套量词、线性结构——无 ReDoS 面
- `\s` 含换行——跨行键值对正确匹配；G1 与 G6 实测证实
- 全局 `g` 标志：10k 次命中实测 ok:true（全中和，无遗漏）
- 值形状定长上限 63 字符——无回溯风险
- 闭集中两键按序迭代（`batchToken` 先、`uniqueNameToken` 后），正则各自独立——无键间干扰

**结论**：零发现。

### R4 既有语义零回归 —— **无发现**

实证复跑，全部绿色：

```
credgate-lineage-keys:      6/6 ✓
p7-credgate-coverage:      通过 ✓
seams-freeze:              12/12 ✓
seams-freeze-v2:           13/13 ✓
replay-identity-channel-kind: 通过 ✓
delete-spec-magnifier:     6/6 ✓
term-lint --registry:      通过 ✓
selftest --tier1:          GREEN ✓
```

改动仅对 `credentialGate` 关键词分支的一行（`String(text).toLowerCase()` → `neutralizeDomainLineageKeys(String(text)).toLowerCase()`）——其余所有门语义（字面量分支扫原文、first-hit 顺序、大小写无关、hit 措辞）完全不动。

### R5 消费面差异 —— **无发现**

- `bin/compile.mjs`：零引用 `batchToken` / `uniqueNameToken`
- `bin/report.mjs`：零引用
- `bin/replay.mjs` → `artifact-finalizer.mjs`：唯一受影响调用，仅修复假阳性
- `replay-axes.mjs:131`（`cleanup: cleanupEvidence` 展开）：`cleanupEvidence` 中的 `batchToken` / `uniqueNameToken` 是唯一产出这两个键的路径，正是本次修复目标

**结论**：消费面差异精确限于「合形世系键值对不再误伤」——与 plan §2 一致。

### R6 G5 假绿面 —— **无发现**

G5 测试在本环境无凭据文件（受禁区约束不核 `.auth/`），实测跑通而非跳过：

```
ok   G5 敏感字面量作世系值仍被字面量分支拦（扫原文）
```

跳过分支（真凭据在场时）明确输出「真凭据文件在场，G5 合成注入跳过——p7 先例同款，明记不装绿」并 `return`——不递增 `passed`。即便跳过也不构成假绿。p7-credgate-coverage 同款模式久经验证。

---

## 取证摘要

| 维度 | 命令 | 结果 |
|------|------|------|
| 六钉金牌 | `node tests/_golden/credgate-lineage-keys.zero-sut.golden.mjs` | exit 0, 6/6 ✓ |
| p7 冻结金牌 | `node tests/_golden/p7-credgate-coverage.golden.mjs` | 通过 ✓ |
| seams-freeze ×2 | `node tests/_golden/seams-freeze*.golden.mjs` | 全过 ✓ |
| 上游两契约 | `node tests/_golden/replay-identity-channel-kind.zero-sut.golden.mjs` `delete-spec-magnifier.zero-sut.golden.mjs` | 全过 ✓ |
| 统一语言 | `node loop-kit/bin/term-lint.mjs --registry` | 0 提示 ✓ |
| 自检 | `node bin/casey.mjs selftest --tier1` | GREEN ✓ |

---

## VERDICT: APPROVE

零 Critical / High / Medium 发现。R1–R6 全部证伪，六钉金牌全绿，邻接七命令零回归，改动面严限白名单。
