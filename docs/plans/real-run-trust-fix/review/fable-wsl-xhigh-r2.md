# WSL 原生 Claude Code Fable xhigh 复审（2026-07-16）

## 运行身份

- 入口：`/home/test/.nvm/versions/node/v24.18.0/bin/claude`
- 版本：Claude Code 2.1.211
- 宿主：WSL2 Linux x86-64
- 二进制：Linux ELF x86-64（包内文件名虽为 `claude.exe`，并非 Windows PE / WSLInterop）
- 模型：`claude-fable-5`
- effort：`xhigh`
- 网络：WSL 回环临时反向代理；无 SUT 凭据进入命令、日志或评审材料

## 首审结论

`CHANGES_REQUIRED`。首审指出 `--unique-name` 与冻结 cleanup 计数锚可能漂移，导致无关 selector 的 `0→0` 被误作删除归零；并提出 delete 弹层、预检、计数审计和报告媒体路径的 P2 边界。

实查发现问题比首审措辞更广：三份当前 profile 缺少目标化 `countSelector`，旧 UAT profile 才硬编码 `atl_r1`。因此修复没有只特判 r1/r2，而是新增通用的 cleanup 实体锚一致性闸。

## 修复后复审结论

`ACCEPT`。Fable 确认：

1. 实体锚闸位于 `chromium.launch` 前，缺 selector、陈旧/未解析 selector、删除与确认目标分裂、重复搜索目标漂移、cleanup expected 锚漂移均 exit 65 fail-closed；冻结件只派生、不改写。
2. 混合/未知布局不再用全局删除按钮凑 1:1；删除弹层宽匹配后仍由物理去重与 ambiguous fail-safe 收口。
3. 空删除目标与未知 deleteByName click 文案在接触页面前拒绝。
4. HTML/Markdown 的录像、附件、视觉证据路径均在渲染边界复验；aggregate 的路径非法与 JSON 非法诊断已分开。
5. 新增零 SUT 棘轮覆盖上述关键边界。

## 非阻塞残余风险

- 搜索重复检查目前验证同目标和次数，未把“两次搜索必须分处确认前后”编码成纯函数时序约束；目标化 after selector 仍阻止假 PASS。
- `:has-text()` 是子串语义，近似命名可能造成误 FAIL，不会造成假 PASS。
- deleteByName 收紧为三个合法 click 文案；存量 spec 需静态扫描，旧 spec 如不合约将被浏览器前拒绝并要求重编译。
- aggregate 遇非法子目录名整体 fail-closed，需在使用说明中保留该约束。

本复审不运行浏览器、fixture 或 fake-SUT；真实 SUT 复验由后续独立 UAT 记录背书。

## 真机后追加三审

真实发布链首次复验暴露二审未覆盖的过宽选择器：裸 `[class*="message-box"]` 把同一确认框的 6 个 BEM 内部节点也当成弹层，动作 fail-safe 为 `action_failed`，目标化归零证据正确报 `0→1`。实现随后收窄为“`message-box` / `popconfirm` 片段后接空格或 class 属性结束”的 token 边界；失败残留经独立 cleanup 录像清除。

同一 WSL Linux ELF、Fable xhigh 对最终两文件 diff 三审再次给出 `ACCEPT`：多 class 根节点仍覆盖，`__header/body` 子类不命中，未引入假 PASS 或错删；tab/换行分隔 class 属非阻塞极端漏检，规范 `.hr-message-box` 显式选择器已有覆盖。
