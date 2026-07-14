#!/usr/bin/env node
// WSL 侧 stdio 补给条（开发环境工具，非产品链路）：由 Windows 侧 win-stdio-agent.mjs 经 wsl.exe 互操作
// 管道拉起。职责单一：连本机回环补给口 127.0.0.1:15520（wsl-reverse-listen.mjs），把 stdin↔socket 双向
// 直通。字节流原样透传（二进制安全）、零解析、零凭据接触。隧道网络路径（wslrelay/NAT/防火墙）全不经过——
// 2026-07-14 wslrelay 回环转发复发半死、Hyper-V NAT 入站规则不适用（NATInboundRuleNotApplicable）后的兜底通道。
import net from 'node:net';

const sock = net.connect(15520, '127.0.0.1');
const die = () => process.exit(0);
sock.on('error', die);
sock.on('close', die);
process.stdin.on('error', die);
process.stdout.on('error', die);
process.stdin.on('end', () => sock.end());
sock.on('connect', () => {
  process.stdin.pipe(sock);
  sock.pipe(process.stdout);
});
