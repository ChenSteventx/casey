#!/usr/bin/env node
// 报告交付管线：回放录像 webm → 手机邮箱客户端可播的 MP4（H.264 + faststart，B.5 交付要求）。
// 原始录像是取证源，只读不动；ffmpeg 从 --ffmpeg / FFMPEG_PATH / PATH 依序解析（仓内不带二进制）。
// 用法: node scripts/video-to-mp4.mjs <in.webm> <out.mp4> [--ffmpeg <ffmpeg路径>]
import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const ffIdx = argv.indexOf('--ffmpeg');
const ffmpegPath = ffIdx >= 0 ? argv.splice(ffIdx, 2)[1] : (process.env.FFMPEG_PATH || 'ffmpeg');
const [inWebm, outMp4] = argv;
if (!inWebm || !outMp4) {
  console.error('用法: node scripts/video-to-mp4.mjs <in.webm> <out.mp4> [--ffmpeg <路径>]');
  process.exit(64);
}
const src = resolve(inWebm);
if (!existsSync(src)) { console.error(`video-to-mp4: 输入不存在 ${src}`); process.exit(66); }

// H.264 要求偶数分辨率；faststart 把 moov 前移供流式播放；无音轨时 -c:a 被忽略无副作用。
const r = spawnSync(ffmpegPath, [
  '-y', '-i', src,
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-movflags', '+faststart',
  resolve(outMp4),
], { stdio: ['ignore', 'ignore', 'pipe'] });
if (r.status !== 0) {
  console.error(`video-to-mp4: ffmpeg 失败 exit=${r.status}`);
  console.error(String(r.stderr || '').split('\n').slice(-6).join('\n'));
  process.exit(1);
}
const size = statSync(resolve(outMp4)).size;
if (size < 4096) { console.error(`video-to-mp4: 产物过小（${size}B），判失败`); process.exit(1); }
console.log(`video-to-mp4: ok ${outMp4}（${Math.round(size / 1024)}KB）`);
