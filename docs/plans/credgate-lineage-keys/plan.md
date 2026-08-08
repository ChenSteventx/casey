# plan · credgate-lineage-keys

承 GRILL（Steven 裁门学形状豁免）。凭据门对域定义世系键做键感知中和，产物字节与
其余门语义零改动。

## 1. 改动面（单文件）

`lib/cred-gate.mjs`：

- 新增闭集 `NON_CREDENTIAL_JSON_KEYS = ['batchToken', 'uniqueNameToken']` 与
  值形状 `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`。
- 新纯函数 `neutralizeDomainLineageKeys(text)`：对
  `"<键>"\s*:\s*(null|"<合形值>")` 只把**键名**替换为中性标记
  `"<nc-lineage-key>"`（标记不含任何关键词），值与其余文本原样；全局多次命中皆中和。
- `credentialGate` 关键词分支改扫中和副本的小写文本；**敏感字面量分支仍扫原文**；
  返回形状、first-hit、大小写无关语义不变。

## 2. 验收金牌（红先行）：`tests/_golden/credgate-lineage-keys.zero-sut.golden.mjs`

纯函数金牌（门与投影器皆纯）+ 生产文本形状端到端（G6 用真投影器产文本推门，
非手拼字符串）；真机端到端真证=合入后铸票 e 重跑（observability route:human）。

| # | 场景 | 现行 | 改后 |
|---|------|------|------|
| G1 | 合形键值对（string 与 null 两态）注入干净产物 | 拒（token 关键词） | 放行 ok:true |
| G2 | 同键值形状不符（含空格 / 65 位 / 空串） | 拒 | 仍拒（不中和） |
| G3 | 非闭集键 `accessToken` 合形值 | 拒 | 仍拒（零豁免） |
| G4 | 五关键词大写注入（p7 同式）+ 裸 `bearer ` | 拒 | 仍拒（表本体零动） |
| G5 | 敏感字面量作世系值（合成 .auth，真凭据在场则跳过并明记） | 拒但 hit=token（键抢跑） | 仍拒且 hit=敏感字面量（字面量扫原文） |
| G6 | `projectReplayAxes` 携 cleanup 块产真形状 axes 文本推门 | 拒 | 放行 |

红基线预期：G1/G5/G6 红（G1/G6 现行拒、G5 现行拒因被 token 键抢跑）、G2-G4 绿
（防过度放松的在位钉）。

## 3. 突变闭环

- M-a 豁免键改「含 Token 即豁免」通配 → G3 红；
- M-b 去值形状校验（任意值中和）→ G2 红；
- M-c 键中和误应用到字面量分支（改扫中和副本）→ G5 红（真凭据在场跳过时以
  M-c′ 替代：从 FORBIDDEN_KEYWORDS 删 token → G3 红）。

## 4. 邻接复跑 + 冻结面实证

`p7-credgate-coverage`（预期零触碰绿——关键词回路不含 token；转红即停走人签）、
`seams-freeze` 两件、`delete-spec-magnifier`、`replay-identity-channel-kind`、
term-lint --registry、selftest --tier1；然后全仓串行扫描对基线零新增。

## 5. 非目标

承 GRILL §5。axes/取证字段名、tier2 消费链、FORBIDDEN_KEYWORDS 表、
maskCredentialRoute、compile/report 调用面一律不动。

## 6. 评审必咬点预登记

① 中和是否可被用于走私（键名标记选词、值仍全额扫两分支的论证）；② 正则对
JSON 转义/嵌套引号的鲁棒性（值形状字符集不含引号与反斜杠故无逃逸面）；
③ G5 在真凭据环境的跳过分支披露；④ p7 冻结金牌零触碰的实证记录。
