// agent-id-readback poison spy 装载器（差分棘轮金牌 R9-R12 消费）：经 node --import 注入，
// 注册模块解析钩子，把身份模块（agent-identity-observation/gate）的每次真实解析落到
// AGENT_ID_SPY_OUT 指定文件——「未声明身份通道路径零加载」由此从源码 grep 升级为真实加载证据。
import { register } from 'node:module';

register(new URL('./spy-hooks.mjs', import.meta.url));
