@echo off
rem 开机重拉 Windows 侧反向隧道代理（WSL 访问内网站点用）。目标地址从 site.json 读、不显示。
rem 前置：WSL 侧先跑 node scripts/wsl-reverse-listen.mjs（casey run/P3 编译前由会话拉起）。
start "casey-win-reverse-agent" /min node "%~dp0win-reverse-agent.mjs"
