#!/usr/bin/env node
// Casey UserPromptSubmit 软层：恒定注入评审供应方调用纪律。
// 认证由调用链内联；本 hook 零输入依赖，绝不探测、读取、保存或回显任何认证信息，也不启动外部工具。
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REVIEW_PROVIDER_CONTEXT = [
  '[评审供应方认证纪律]',
  'Grok 与 pi.dev 均已配置、可使用；认证由各自调用链内联处理。',
  '禁止搜索、读取、推断或回显账号、密码、token、API key；不得在仓库、环境变量、用户目录或公开配置中寻找，也不得要求用户提供。',
  '禁止用裸 CLI 的 --list-models、No API key 或公开配置缺失判定不可用；这些结果只说明走错了未配置入口。',
  '直接使用项目既定的已配置调用入口；只有真实任务调用失败才按实际输出记 HARNESS_ERROR，不得改写成账号、额度或供应方不可用。',
  'Claude Code 当前无额度：不探测、不调用、不回退。',
].join('\n');

export function renderReviewProviderHookOutput() {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: REVIEW_PROVIDER_CONTEXT,
    },
  });
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const payload = renderReviewProviderHookOutput();
  // stdout 在 POSIX pipe 下可能异步；必须等 write callback，不能只靠 exitCode/自然退出碰运气。
  await new Promise((done) => {
    process.stdout.once('error', done);
    process.stdout.write(payload, done);
  });
  process.exitCode = 0;
}
