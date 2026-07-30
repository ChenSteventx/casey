# WSL 环境两问诊断：中文输入与标题栏中文乱码

日期：2026-07-29　范围：本机 WSL2 环境（Ubuntu 22.04.3，WSLg 1.0.73.2）
本轮只做只读探测，**未安装任何软件包、未改任何配置文件、未动仓库文件**。

---

## 一、结论速览

| 问题 | 结论 | 可落地性 |
| --- | --- | --- |
| `sudo` 是否免密 | 否，`sudo -n true` 回 `sudo: a password is required` | 所有需要 root 的动作一律留跑单 |
| 标题栏中文乱码吃哪层字体 | **两层都不吃**。窗口标题栏由 Windows 侧远程桌面客户端绘制，Linux 侧装字体不解决 | 此层无干净口，见第三节 |
| Chromium 页面内中文 | **已经正常**，用户目录已有 CJK 字体并被 fontconfig 选中，实测无豆腐块 | 无需动作 |
| 中文输入法能否走原生 Wayland | **不能**。合成器拒绝外部进程绑定输入法接口，实测报 `permission to bind input_method denied` | 此路已堵死 |
| 中文输入法能否走 Xwayland（X11） | **能，但需 root 装包**，180 个包 / 172 MB 下载 / 约 703 MB 占用 | 完整跑单见第五节 |

一句话：字体那条不用管（页面内已好，标题栏管不了）；输入法只有 X11 一条路，且必须 Steven 亲自跑 `sudo`。

---

## 二、已做动作与探针证据

全部是只读探测。证据逐条可复现。

### 2.1 权限

```
$ sudo -n true
sudo: a password is required        # 退出码 1
```

免密不成立，因此本报告不执行任何安装，第五节全部写成跑单。

### 2.2 字体现状（用户发行版层）

```
$ fc-list :charset=4e2d family
Noto Sans CJK SC

$ fc-match -s :lang=zh-cn | head -1
NotoSansCJKsc-Regular.otf: "Noto Sans CJK SC" "Regular"

$ ls ~/.local/share/fonts
NotoSansCJKsc-Regular.otf     # 16.4 MB，2026-07-02 放入
```

系统字体目录 `/usr/share/fonts` 只有 dejavu 与 ubuntu 两族，无 CJK；
但用户目录那枚 Noto Sans CJK SC 已进 fontconfig 缓存，且是全机唯一含汉字字形的字体。

### 2.3 Chromium 渲染实证（端到端，非纯配置推断）

用仓库里 `node_modules/playwright-core` 1.60.0 驱动 `~/.cache/ms-playwright/chromium-1223`
的真二进制，无头渲染五行中文后截图并肉眼核对：

- `sans-serif`、`serif`、`monospace` 三个通用族全部落到 Noto Sans CJK SC，汉字字形完整；
- 显式指定 `Noto Sans CJK SC` 正常；
- 无豆腐块、无问号、无缺字。

结论：**浏览器内容面与浏览器自绘界面（标签页标题）走的都是这条 fontconfig 通路，已经没问题。**

### 2.4 WSLg 运行形态（决定标题栏归谁画）

从 `/mnt/wslg/weston.log` 开头取证：

```
Command line: /usr/bin/weston --backend=rdp-backend.so --modules=wslgd-notify.so \
              --xwayland --socket=wayland-0 --shell=rdprail-shell.so ...
RDP backend: use_rdpapplist = 1
RDP backend: enable_distro_name_title = 1
RDP backend: enable_copy_warning_title = 1
RDPRAIL-shell: distro name:Ubuntu (len:6)
```

`rdprail-shell` 是远程应用集成模式（把每个 Linux 窗口当成一个独立的 Windows 窗口投出去）。
这种模式下合成器不画窗口装饰，只把**标题字符串**通过远程桌面协议的窗口指令发给 Windows，
由 Windows 侧客户端用 Windows 自己的字体画标题栏 —— `enable_distro_name_title`
（在标题后缀上发行版名）正是在合成器里做字符串拼接、然后交给 Windows 渲染的证据。

另外确认：从用户发行版看到的 `/mnt/wslg/distro` 就是**用户发行版自己的根**，不是系统发行版：

```
$ stat -c '%d:%i' /usr/share/fonts/truetype /mnt/wslg/distro/usr/share/fonts/truetype
2096:14172
2096:14172        # 同一个 inode
```

所以系统发行版（Azure Linux 3.0）的文件系统在这里根本看不见，更谈不上往里放字体。

### 2.5 合成器能力清单（Wayland 全局对象）

手写最小 Wayland 客户端（纯 Python，直接读 `wl_registry` 的 global 事件）拿到 21 个全局对象，
与输入法相关的三条：

```
zwp_text_input_manager_v1   v1     # 有
zwp_input_method_v1         v1     # 有
zwp_text_input_manager_v3   —      # 无
```

### 2.6 输入法插槽绑定实证（本轮最关键的一条）

同一个最小客户端尝试绑定 `zwp_input_method_v1`，合成器直接回错：

```
BIND_ERROR obj=3 code=0 msg=permission to bind input_method denied
```

这是 weston 的文本后端安全策略：**只有合成器自己拉起的那个输入法进程才准绑定这个接口**，
外部启动的 fcitx5 一律被拒。而 WSLg 既没有 `weston.ini`，
官方调试配置页也没有任何配置输入法程序路径的口子，我们改不到那一层。

配套核对（下载 deb 解包看内容，未安装）：
`fcitx5-module-wayland` 里的 `libwaylandim.so` 确实实现了 `zwp_input_method_v1` 与 `v2`，
协议版本是对得上的 —— 断点不在 fcitx5，在合成器的准入策略。

### 2.7 Playwright 用的 Chromium 二进制支持面

对 `chromium-1223/chrome-linux64/chrome` 做字符串核对：

| 能力 | 是否存在 |
| --- | --- |
| `--enable-wayland-ime` | 有 |
| `--wayland-text-input-version` | 有 |
| `--gtk-version` | 有 |
| `zwp_text_input_manager_v1` / `_v3` | 都有 |
| 运行时加载 `libgtk-3.so.0` / `libgtk-4.so.1` | 都有 |
| `gtk_im_multicontext` | 有 |

即：浏览器侧两条路（Wayland 文本输入协议、GTK 输入模块）都具备，缺的只是 Linux 侧的输入法进程。
注意 GTK 运行库当前**没装**，装 fcitx5 的 GTK 前端时会顺带补上。

### 2.8 顺手证伪的一条旧结论

交接文档写「`--ozone-platform=wayland` 起得来渲染正常、x11 截屏失败」。本轮用同一份
Playwright 与同一个浏览器，有头模式各跑一遍：

```
x11      SCREENSHOT_OK  title="主诉冒烟 tc_chiefcomplaint_smoke"
wayland  SCREENSHOT_OK  title="主诉冒烟 tc_chiefcomplaint_smoke"
两个 PNG 字节数一致（7045）
```

**在 `page.screenshot()` 这个口径下 X11 截图不失败。** 旧结论若成立，指的应是另一种截图口径
（比如 X 工具直接抓屏）。这条很关键：输入法只在 X11 通，如果 X11 截图真不行就是死结；
现在实测不是死结。请编排者确认旧结论的具体口径（列为开放问题 Q5）。

### 2.9 其它环境事实

- 语言环境只有 `C.UTF-8`，没有生成 `zh_CN.UTF-8`（生成需 root，非阻塞项）；
- systemd 用户实例在跑（`systemctl --user is-system-running` 回 `running`），用户级自启可用；
- fcitx5 带 D-Bus 激活服务 `org.fcitx.Fcitx5`，理论上首次被请求时可自动拉起；
- `~/.bashrc`、`~/.profile` 里当前没有任何输入法或字体相关设置，跑单里的写入不会撞已有配置；
- 磁盘余量 944 GB，容量不是约束。

---

## 三、问题一：标题栏中文乱码——定性修正

### 3.1 结论

交接文档记的「合成器字体栈缺 CJK」**大概率不成立**。理由：

1. 远程应用集成模式下合成器不画标题栏，只传字符串（2.4 节取证）；
2. 真正画标题栏的是 Windows 侧客户端，Windows 不缺中文字体；
3. 浏览器自绘的那部分界面（标签页标题）走用户发行版 fontconfig，已实测正常（2.3 节）。

三条合起来：**Linux 侧无论装多少字体，都不会改变标题栏的显示结果。**
若标题栏真的花了，更可能是标题字符串在「合成器 → 远程桌面协议 → Windows」这段
做编码转换时出的问题，属 WSLg 自身的实现面，用户发行版这层碰不到。

### 3.2 下次五秒判别法（零成本，建议下次录制时顺手做）

打开一个标题含中文的页面，同时看两处：

| 现象 | 判定 |
| --- | --- |
| 标签页内标题正常，只有最外层窗口标题栏花 | 编码转换问题，在 WSLg 侧，我们管不了 |
| 标签页内标题也花 | 才是字体问题，但与 2.3 节实证矛盾，需要重新取证 |
| 显示成空心方块 | 缺字形（字体问题） |
| 显示成一串拉丁怪字符（形如 `ä¸­æ–‡`） | 编码问题 |
| 显示成一串问号 | 转码时按窄字符丢字 |

### 3.3 WSLg 侧有没有干净口

查证结果：**没有。**

- 系统发行版的文件系统在用户发行版侧不可见（2.4 节 inode 证据），且它本身是只读镜像；
- WSLg 官方的配置选项页只列了调试与显示相关的环境变量
  （`WESTON_RDP_*`、`WESTON_DEBUG_PROTOCOL`、`WSL2_WESTON_SHELL_OVERRIDE` 等），
  **没有任何字体目录挂载、fontconfig 配置或 `weston.ini` 供给的口子**；
- 因此不存在「不硬改只读系统发行版就能补字体」的干净做法。

按任务要求如实记：**此层无干净口，建议不追。** 该面纯装饰、不进取证，成本高于收益。

---

## 四、问题二：中文输入法——路径评估

### 4.1 三条路的裁定

| 路径 | 技术链 | 裁定 |
| --- | --- | --- |
| A. Xwayland（X11） | 浏览器跑 X11 → GTK 输入模块 → D-Bus → fcitx5 | **可行，推荐** |
| B. 原生 Wayland + 文本输入协议 | 浏览器 `--enable-wayland-ime` → 合成器 → fcitx5 的 Wayland 前端 | **堵死**，2.6 节实证被拒 |
| C. 原生 Wayland + GTK 输入模块 | 浏览器 `--ozone-platform=wayland --gtk-version=4` → GTK 模块 → D-Bus → fcitx5 | 理论可行，**未验证**，候选窗定位有已知毛病 |

路径 A 之所以能绕开 2.6 的封锁：fcitx5 的 GTK 输入模块（`im-fcitx5.so`）是走 D-Bus 直连
fcitx5 进程的，根本不经过合成器的输入法接口，也不经过 X 输入法协议。合成器那道准入门管不着它。

### 4.2 路径 A 的两个易踩点

**踩点一：`--no-install-recommends` 会装出一个残废的 fcitx5。**

`fcitx5-module-xorg`（提供 X11 支持）与 `fcitx5-module-wayland` 不是 `fcitx5` 的依赖，
而是 `fcitx5-modules` 的推荐包。只写 `--no-install-recommends fcitx5 ...` 会把它们漏掉，
装完 fcitx5 完全接不上显示服务。跑单里必须**显式列出这两个包**。

**踩点二：环境变量的值是 `fcitx` 不是 `fcitx5`。**

已向 fcitx5 官方文档核实：`GTK_IM_MODULE=fcitx`、`QT_IM_MODULE=fcitx`、`XMODIFIERS=@im=fcitx`。
写成 `fcitx5` 是常见错误。

### 4.3 影响面（安装前必须知道）

对 `fcitx5 fcitx5-modules fcitx5-module-xorg fcitx5-module-wayland fcitx5-chinese-addons
fcitx5-frontend-gtk3 fcitx5-frontend-gtk4` 这一组做 apt 模拟：

- 新增 **180 个包**，下载 **172 MB**，安装后占 **约 703 MB**；
- 不删除、不降级任何现有包；
- **不引入任何新的系统守护进程**（用 `--no-install-recommends` 时，
  modemmanager / wpasupplicant / network-manager / tcl 这些膨胀依赖全部不会进来；
  不加该开关的话它们会进来，多 60 余个包）；
- 包量大的主因：拼音引擎 `fcitx5-pinyin` 依赖 `libfcitx5-qt1`，从而拖进整套 Qt5
  （含 Qt WebEngine）以及 mesa、ffmpeg 系列运行库。这些都是纯运行库，不自启；
- 副作用一条要留意：装完会补上 GTK3/GTK4 运行库，Chromium 从此能成功加载 GTK，
  文件对话框与主题行为会变。对回放取证无影响，但建议装完先跑一次链路自检再录制。

想避开 Qt 的话只有换引擎（`fcitx5-rime` 那组只要 60 个包 / 17.7 MB / 零 Qt），
但换的是输入习惯，属 Steven 的个人偏好，列为开放问题 Q2。

---

## 五、遗留跑单（需 root，请 Steven 在本机终端执行）

以下每一步都需要 `sudo` 密码，本轮一步未执行。建议按顺序做，每步都有验证动作。

### 步骤 0（可选）补全字体

当前已够用（2.3 节实证），装它只是补上粗体、衬线族与日韩字形。

```bash
sudo apt update
sudo apt install -y fonts-noto-cjk        # 1 个包，58 MB
fc-list :charset=4e2d family | sort -u    # 验证：应多出若干 Noto CJK 族
```

### 步骤 1 安装输入法（必做）

```bash
sudo apt update
sudo apt install --no-install-recommends -y \
  fcitx5 fcitx5-modules fcitx5-module-xorg fcitx5-module-wayland \
  fcitx5-chinese-addons fcitx5-frontend-gtk3 fcitx5-frontend-gtk4
```

验证：

```bash
ls /usr/lib/x86_64-linux-gnu/fcitx5/ | grep -E 'xcb|xim|wayland'
# 期望看到 libxcb.so libxim.so libwayland.so libwaylandim.so 四个
ls /usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules/im-fcitx5.so
ls /usr/lib/x86_64-linux-gnu/gtk-4.0/4.0.0/immodules/libim-fcitx5.so
```

若要图形化配置界面，再加 `fcitx5-config-qt`（多 7 个包 / 2 MB）。

### 步骤 2 设环境变量（改哪个文件请先裁，见 Q3）

推荐写进 `~/.bashrc` 末尾（登录与非登录 shell 都吃到，Casey 的录制命令走的就是 bash）：

```bash
cat >> ~/.bashrc <<'EOF'

# --- 中文输入法（fcitx5），2026-07-29 加 ---
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx
export SDL_IM_MODULE=fcitx
EOF
```

生效：新开一个终端，或 `source ~/.bashrc`。
验证：`echo "$GTK_IM_MODULE $XMODIFIERS"` 回 `fcitx @im=fcitx`。

### 步骤 3 启动 fcitx5

先手动起一次确认能用（`--disable=wayland` 是为了避开 2.6 那道必然失败的绑定）：

```bash
fcitx5 -d --disable=wayland
sleep 2
fcitx5-remote            # 回 1 或 2 表示进程活着
```

跑诊断（这是 fcitx5 自带的自检工具，会逐项报环境是否齐）：

```bash
fcitx5-diagnose | head -120
```

重点看三行：输入法进程在跑、`GTK_IM_MODULE` 值正确、GTK 输入模块文件存在。

### 步骤 4 自启（可选，形态请先裁，见 Q4）

用户级 systemd 单元，不碰任何系统单元：

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/fcitx5.service <<'EOF'
[Unit]
Description=Fcitx5 input method
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/fcitx5 --disable=wayland
Restart=on-failure

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now fcitx5
systemctl --user status fcitx5 --no-pager
```

更轻的替代：什么都不配，靠 D-Bus 激活（`org.fcitx.Fcitx5` 服务已注册），
第一次有程序请求输入法时自动拉起。省事但首次唤起可能有延迟。

### 步骤 5 录制时的浏览器形态

**默认就对，不要传 `--ozone-platform=wayland`。** WSLg 下 Chromium 默认走 X11，
输入法正是在这条路上通。也就是说：录制前确认 `CASEY_RECORD_BROWSER_ARGS` 没被设成 wayland。

```bash
echo "CASEY_RECORD_BROWSER_ARGS=[${CASEY_RECORD_BROWSER_ARGS:-未设}]"
unset CASEY_RECORD_BROWSER_ARGS      # 如果之前设过 wayland
```

如果因为别的原因非得用 wayland，只能试路径 C（未验证）：

```bash
export CASEY_RECORD_BROWSER_ARGS="--ozone-platform=wayland --gtk-version=4"
```

**不要**在 wayland 形态下加 `--enable-wayland-ime` —— 那条链在合成器侧断，加了只会更乱。

### 步骤 6 端到端验证

1. 起录制，在浏览器任意输入框里按 `Ctrl` + 空格；
2. 期望：屏幕上冒出 fcitx5 候选词窗口，敲拼音出中文；
3. 若切不动，按顺序查：`fcitx5-remote` 有无输出 → `fcitx5-diagnose` 报什么 →
   `Ctrl+空格` 是否被远程桌面通道吞（换 fcitx5 配置里的其它切换键试）。

### 回滚

```bash
systemctl --user disable --now fcitx5 ; rm -f ~/.config/systemd/user/fcitx5.service
# 手工删掉 ~/.bashrc 末尾那段
sudo apt purge -y 'fcitx5*' && sudo apt autoremove -y
```

---

## 六、风险清单

| 风险 | 等级 | 说明与对策 |
| --- | --- | --- |
| 180 个包进用户发行版 | 中 | 可回滚但依赖树会有残留；无新守护进程，无安全面变化 |
| Chromium 开始加载 GTK 后行为变化 | 中 | 文件对话框与主题会变；装完先跑一次链路自检再录制 |
| `Ctrl` + 空格 被远程桌面键盘通道吞 | 中 | 未验证；可在 fcitx5 里改切换键 |
| 候选词窗口在远程应用集成模式下的显示 | 中 | 未验证；候选窗是独立小窗口，理论上会作为独立 Windows 窗口投出来 |
| 远程桌面下键盘进不了窗口 | 高（既有） | **与输入法无关**，装了也不解决；仍需 Steven 人在机器前 |
| 步骤 5 与旧结论「x11 截屏失败」冲突 | 中 | 本轮实测不复现（2.8 节），但请编排者确认旧结论口径后再定 |
| 标题栏乱码 | 低 | 纯装饰、不进取证、此层无干净口，建议不追 |

---

## 七、开放问题（请编排者/Steven 裁）

- **Q1 装不装 fcitx5？** 代价 180 包 / 172 MB 下载 / 703 MB 占用、需 Steven 亲自跑 `sudo`。
  不装则中文继续靠 `clip.exe` 注入剪贴板（现状可用，只是别扭）。
- **Q2 拼音引擎选哪个？** `fcitx5-chinese-addons`（默认拼音，拖 Qt，180 包）
  还是 `fcitx5-rime`（60 包 / 17.7 MB / 零 Qt，但输入习惯不同）。属个人偏好，我不替裁。
- **Q3 环境变量写哪个文件？** `~/.bashrc`（推荐）、`~/.profile`，还是干脆不写进 dotfile、
  只在录制命令前临时导出。本轮**一个字都没改**，等裁。
- **Q4 自启用哪种形态？** 用户 systemd 单元 / 依赖 D-Bus 激活 / 只手动起。
- **Q5 旧结论「x11 截屏失败」的具体口径是什么？** 本轮用 `page.screenshot()` 实测 X11 与
  Wayland 都成功且字节一致。这条直接决定录制该用哪种形态 —— 而输入法只在 X11 通。
- **Q6 标题栏乱码还追不追？** 建议不追（无干净口、纯装饰）。若要追，第一步是按 3.2 的
  五秒判别法取证，把「缺字形」和「编码错」分开，再决定要不要给 WSLg 提缺陷。

---

## 附：本轮探针脚本位置

均在本会话临时目录（重启即清，未进仓库）：

- Wayland 全局对象清单：`scratchpad/probe/wl-globals.py`
- 输入法插槽绑定探针：`scratchpad/probe/wl-bind-im.py`
- 无头中文渲染取证：`scratchpad/probe/font-probe.mjs` → `cjk.png`
- 有头 X11/Wayland 截图对照：`scratchpad/probe/headed-probe.mjs` → `headed-x11.png` / `headed-wayland.png`
- 解包待验的 deb：`scratchpad/deb/`（只解包查看，未安装）

---

## 落地结果附记（2026-07-29 下午，Steven 在机+Claude 配置）

- Q1/Q2 已裁并落地：装默认拼音组（Steven 手动 sudo 跑 `~/fcitx5-setup.sh`，含
  `fonts-noto-cjk`）；Q3 环境变量四件套已写 `~/.profile`；Q4 自启暂用手动幂等脚本
  `~/start-ime.sh`（不建系统单元）。
- **新实证（本报告 2.6 节的直接后果）**：fcitx5 默认配置在 WSLg 下**启动即退**——
  wayland 插件绑定输入法协议被 weston 拒绝后整条 Wayland 连接被掐，触发
  「All display connections are gone」自杀；`--disable=wayland,waylandim` 后常驻稳定
  （且不依赖任何 WSLg 窗口存活，浏览器全关仍在）。三连跑对照实证。
- **端到端真机验证通过**：fcitx5 运行中起 Chromium（X11 + GTK 输入模块 + D-Bus），
  Steven 在页面输入框 Ctrl+空格 切拼音、真打出中文。注意浏览器须在 fcitx5
  **已运行**时启动（先起浏览器后起输入法那次握手失败、打字无反应）。
- 标题栏豆腐块如 3.1 节预判仍在（Windows 侧渲染），确认不追（Q6 定案）。
- Q5（旧「x11 截屏失败」口径）仍待 Steven 核。
