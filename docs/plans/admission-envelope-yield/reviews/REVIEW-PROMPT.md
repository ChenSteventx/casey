# 评审提示词 · admission-envelope-yield

你是异构评审方，对已提交不可变快照做代码评审。只报 Critical / High / Medium；结论行
`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给文件:行号、严重级、
失败场景。

## 仓与基线

- 仓：当前工作目录即契约树克隆（可自跑命令验证）。
- 基线：dev `5cd36b4`；评审对象 = `git diff 5cd36b4..HEAD`。
- 背景（按需读）：`docs/plans/admission-envelope-yield/GRILL.md`（承 Steven 已签
  platformId 硬桥接设计的第三消费者接线，方向零新岔口）、同目录 `plan.md`。

## 改动白名单（超出即报）

1. `lib/entity-observation-registry.mjs` · `validateObservationAdmission` —— 终端投影
   携 `yieldedToPlatformId` + 4b/6 两处让位豁免（四条件：义务恰 `['source']` / 字段
   非空 / 全部已验行恰一条同 kind+subject+platformId / 该原子信封整缺）。
2. `tests/_golden/admission-envelope-yield.zero-sut.golden.mjs`、
   `loop/prd-admission-envelope-yield.json`、`docs/plans/admission-envelope-yield/**`。

## 风险清单（请优先证伪）

- R1 豁免滥用面：伪造字段（A3）、subject 义务（A4）、多条匹配（A5）、空信封畸形态
  （A6）、部分让位部分不让（4b 的 every 语义）——还有没有第五条泄漏路径；
  与同文件 compile 侧基数门豁免（terminal-coverage-yield 已收口）的判据一致性。
- R2 加法门控：无字段输入行为逐字节同码（cardinality-reverse / wiring /
  observation-yield / agent 遗留形）。
- R3 前置各闸零接触：孤儿信封、邪恶 issuer、五元关联、bindingMode/provenance、
  重复终端等具名拒面原样。
- R4 A8 真产物字节形的代表性（未登记 delete 绑定共存、多 create 绑定行）。

## 既有证据（可自行复跑）

- 验收金牌 8 钉 exit 0；红基线 6 过/2 红（`accept/red-proofs/`）；突变闭环
  （`git show` 姿势、勿 `git checkout -- `）；同文件邻接五金牌 + term-lint +
  selftest 全绿；gate GREEN 2/2。
- 拦点实证：十五跑真产物 sign 首拒 `OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION`
  （主树 `~/casey-recovery-20260807` 有 run15 产物账；本树不含真机产物）。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
