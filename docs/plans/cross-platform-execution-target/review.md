# cross-platform-execution-target 收口评审

评审日期：2026-07-27
契约结论：`PASS`
发布结论：仍未就绪；`page-topology-auth-continuity` 尚须正式写账，真实环境验收与示教双回放仍未完成。

## 1. 评审范围

本轮覆盖逻辑目标地址与传输方式分离、共享来源准入、导航后来源核对、登录预备动作、编译与回放动作边界、命令行脱敏输出，以及相邻的多页接管接缝。评审只运行零浏览器、零被测系统、零网络的确定性检查；没有读取真实配置、凭据或目标值。

独立评审记录：

- `review-independent.md`：首轮发现五处阻塞问题；
- `review-independent-round2.md`：五处问题与两个旁路已闭合，但 `agent-id` 的 R20/R21 因 pageerror 脱敏字节变化而真实变红；
- `review-independent-round3.md`：受控更新后复核当前字节与相邻门，区分本契约通过和发布仍未就绪。

## 2. 已闭合问题

1. 回放与编译在动作前、异步准备后、物理副作用前和采证前重复核对来源；来源漂移后不继续动作或产成功收据。
2. 登录首跳与表单等待后均核对来源；漂移时凭据填写和提交次数为零。
3. WSL 未显式配置传输方式时不再隐式选择回环；原生 Windows、Linux、macOS 均保持规范目标地址。
4. `selectOption` 的触发器与选项两次物理点击各自经过来源准入，关闭复合动作中的检查与使用时差。
5. pageerror 只保留错误类、数量与归因，自由文本统一脱敏；无协议 host、端口、路径、query 和 fragment 不再穿透。
6. 普通编译异常与 execution-target 异常分流：普通异常固定脱敏文案与 exit 1，已知目标/导航原因继续走共享稳定原因边界。
7. 多页录制的 binding-arrival 竞态使用一次性 opaque generation authority 固定动作边界；同调用栈出现的 popup 不再静默漏记。

## 3. 可执行证据

- `cross-platform-execution-target`：37/37；
- `output-seal-b5-prelaunch`：1/1；
- `agent-id-regression-diff`：21/21；
- `output-seal`：27/27；
- 跨平台 PRD Test Ratchet：12/12 checksum 匹配；
- 相邻 page-topology PRD Test Ratchet：13/13 checksum 匹配；
- 最新正式跨平台 `gate`：7/7；
- `git diff --check`：通过；
- 本范围生产文件与新增 golden 均不超过 600 行，`bin/compile.mjs` 为 598 行。

R20/R21 的受控 rebaseline 只更新 axes、verdict-report 与 manifest 三个冻结件。唯一语义变化是：

```text
TypeError: 演示页错误
→ TypeError: <redacted:pageerror>
```

四态裁定与报告结论未改变。

## 4. 人工路由

本结论不证明下列真实环境事实：

- Windows、Linux、macOS、WSL 的真实 browser-visible origin；
- AI 中台当前版本和后续版本的 query/hash、登录连续性与 popup/new tab 行为；
- 医生站与 Hi 小助 CEF 的容器和认证差异；
- 人工示教 source replay、atom distilled replay 与三份正式报告。

以上继续按 PRD `observability` 路由人，并以同次真实回放、确定性 `verdict.json`、录屏、报告和用户验收核销。
