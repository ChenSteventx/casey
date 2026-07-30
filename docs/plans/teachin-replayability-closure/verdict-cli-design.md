# Frozen verdict 子进程接缝设计

日期：2026-07-27  
状态：验收冻结候选；生产实现尚未开始

## 1. 决策

本轮不修改、也不复制 `bin/verdict.mjs`。该文件已被
`loop/prd-gen-prompts.json` 以
`ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53`
冻结；把它改成可 import 模块会破坏既有签冻字节锚，不能作为普通接线重构处理。

新增唯一 impure boundary：

```text
lib/teachin/verdict-cli-adapter.mjs
```

它以 `process.execPath` 和 `execFile` 的参数数组启动现役裁判：

```text
node <static-verdict-path> --axes <private-temp>/axes.json --out <private-temp>/verdict.json
```

固定 `shell:false`、独立临时目录、有限 `timeout/maxBuffer`。stderr、临时路径、输入内容和
子进程异常原文永不进入返回值、日志或报告。`runtime-cycle-adapter.mjs` 只能静态导入并实际
绑定本模块的 canonical adapter；其它新模块不得引用 `bin/verdict.mjs`，也不得自建
`decide/derive/adjudicate`。

## 2. API

```js
createVerdictCliAdapter({
  createWorkspace,
  writeWorkspaceFile,
  readWorkspaceFile,
  removeWorkspace,
  readJudgeBytes,
  executeJudge,
})
// -> { runFrozenVerdict({axesBytes}) }

canonicalVerdictCliAdapter.runFrozenVerdict({
  axesBytes,
})
// -> {ok:true,verdictBytes}
//  | {ok:false,reason}
```

`axesBytes` 必须是 `Buffer`，调用对象 exact-key。adapter 立即复制输入，不接受路径、
case 名、SUT、judge path、command、args、env、shell、timeout 或输出事实。工厂只供本模块
canonical 装配和 zero-SUT 故障注入；生产 orchestrator/CLI 不转导工厂，也不接收依赖注入。

## 3. 确定性处理

每次调用固定执行：

1. 新建与 case/intent/name/code 无关的随机临时目录；
2. 读取现役 judge 字节并核对上述 frozen sha256；
3. 原样写入复制后的 `axesBytes`；
4. `execFile(process.execPath, argv, {shell:false,windowsHide:true,timeout:30000,
   maxBuffer:1048576})` 恰一次；
5. 读取 `verdict.json`；
6. 解析输入与输出，只做闭合形状和 identity/顺序绑定校验；
7. 复制 canonical 输出字节；
8. 在 `finally` 递归清理本次临时目录。

输出只允许：

```js
{
  caseId,
  steps: [{
    stepId,
    intentId,
    atom,
    verdict,
    reason,
  }],
}
```

顶层/step 未知键、步数变化、乱序、`caseId/stepId/intentId/atom` 任一换绑、JSON malformed、
缺产物或非 canonical verdict/reason 基本形状均拒绝。这里不复算动作、断言或取证，不复制
裁判枚举树；只证明产物确实对应本次输入。语义义务仍由现役 judge 与后继 semantic projection
处理。

## 4. 稳定失败

```text
VERDICT_INPUT_INVALID
VERDICT_EXECUTION_FAILED
VERDICT_TEMP_CLEANUP_FAILED
```

- judge exit `65` 固定映射 `VERDICT_INPUT_INVALID`；
- judge 字节漂移、其它非零退出、throw、timeout、缺/坏/换绑产物统一
  `VERDICT_EXECUTION_FAILED`；
- 临时目录清理失败统一 `VERDICT_TEMP_CLEANUP_FAILED`，且覆盖本次潜在成功，绝不带半份
  `verdictBytes` 返回。

任何失败返回 exact `{ok:false,reason}`。不得返回 stderr、exit signal、路径、输入片段或异常
对象。成功返回 exact `{ok:true,verdictBytes}`。

## 5. 验收义务

`teachin-replayability-verdict-cli-adapter.zero-sut.golden.mjs` 必须证明：

1. canonical adapter 真调用 frozen judge，一份输入覆盖四态代表并保持 identity/顺序；
2. 并发调用使用不同 workspace，结果不串案；
3. exit `65` 与其它 exit/throw/malformed/缺产物稳定分流；
4. unknown key、case/step/intent/atom 换绑和乱序均拒；
5. stderr 即使含敏感 marker 也不出现在返回值；
6. success/failure 均清理；清理失败绝不返回成功；
7. judge 当前 sha256 与旧 PRD 冻结锚一致。

结构门另钉：

- 本模块是显式 impure boundary，不进入纯核心集合；
- 只有本模块引用 `bin/verdict.mjs` 和 `node:child_process`；
- `execFile` 使用参数数组且 `shell:false`，禁止 `exec`/shell 字符串；
- canonical runtime-cycle adapter 静态导入并实际绑定
  `canonicalVerdictCliAdapter`；
- `bin/verdict.mjs` 字节 sha256 与旧冻结锚不漂移。
