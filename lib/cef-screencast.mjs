// CEF screencast 录屏：消费真实 Page.screencastFrame，落逐帧附件 + 本地可播放 HTML。
// 二进制帧无法由文本凭据门检查，因此调用方必须先取得 --safe-session 人工确认（专用测试账户、无患者隐私）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { credentialGate } from './cred-gate.mjs';

const fail = (code) => new Error(code);
const safeStepId = (value) => /^atstep_[0-9]+$/.test(String(value || '')) ? String(value) : null;

function htmlFor(index) {
  const frames = JSON.stringify(index.frames.map((f) => f.file));
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>Casey CEF 录屏</title>
<style>body{margin:0;background:#111;color:#eee;font:14px sans-serif;display:grid;place-items:center;min-height:100vh}main{width:min(96vw,1280px)}img{display:block;width:100%;max-height:86vh;object-fit:contain;background:#000}p{margin:.6rem 0}</style>
<main><img id="screen" alt="CEF screencast frame"><p id="state">准备播放</p></main>
<script>const frames=${frames};let i=0;const img=document.getElementById('screen');const state=document.getElementById('state');function tick(){if(!frames.length){state.textContent='无帧';return}img.src=frames[i];state.textContent=(i+1)+' / '+frames.length;i=(i+1)%frames.length;setTimeout(tick,125)}tick();</script></html>`;
}

export class CefScreencast {
  constructor(cdp, { outDir, config }) {
    if (!cdp || typeof cdp.send !== 'function' || typeof cdp.on !== 'function') throw fail('CEF_SCREENCAST_CDP_INVALID');
    this.cdp = cdp;
    this.outDir = resolve(String(outDir));
    this.framesDir = join(this.outDir, 'frames');
    this.config = config;
    this.frames = [];
    this.steps = [];
    this.currentStepId = null;
    this.startedAt = null;
    this.endedAt = null;
    this.off = null;
    this.pending = new Set();
    this.running = false;
  }

  async start() {
    if (this.running) throw fail('CEF_SCREENCAST_ALREADY_RUNNING');
    mkdirSync(this.framesDir, { recursive: true });
    this.startedAt = new Date().toISOString();
    this.off = this.cdp.on('Page.screencastFrame', (params) => this.#accept(params));
    await this.cdp.send('Page.enable');
    await this.cdp.send('Page.startScreencast', {
      format: this.config.format,
      quality: this.config.quality,
      maxWidth: this.config.maxWidth,
      maxHeight: this.config.maxHeight,
      everyNthFrame: this.config.everyNthFrame,
    });
    this.running = true;
  }

  markStep(stepId) {
    this.currentStepId = safeStepId(stepId);
    if (this.currentStepId && !this.steps.some((s) => s.stepId === this.currentStepId)) {
      this.steps.push({ stepId: this.currentStepId, firstFrame: this.frames.length + 1 });
    }
  }

  #accept(params) {
    const task = (async () => {
      const sessionId = params && params.sessionId;
      try {
        if (!this.running || typeof params?.data !== 'string' || !Number.isInteger(sessionId)) return;
        const seq = this.frames.length + 1;
        const ext = this.config.format === 'png' ? 'png' : 'jpg';
        const file = `frames/frame-${String(seq).padStart(6, '0')}.${ext}`;
        writeFileSync(join(this.outDir, file), Buffer.from(params.data, 'base64'));
        this.frames.push({
          seq,
          file,
          timestamp: Number.isFinite(params.metadata?.timestamp) ? params.metadata.timestamp : null,
          stepId: this.currentStepId,
        });
      } finally {
        if (Number.isInteger(sessionId)) {
          try { await this.cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* stop/close may race */ }
        }
      }
    })();
    this.pending.add(task);
    task.finally(() => this.pending.delete(task));
  }

  async stop() {
    if (!this.running) return null;
    this.running = false;
    try { await this.cdp.send('Page.stopScreencast'); } catch { /* still seal captured frames */ }
    if (this.off) this.off();
    await Promise.allSettled([...this.pending]);
    this.endedAt = new Date().toISOString();
    // 没有真实帧就没有录屏证据；不得生成“可播放”空壳或让上层继续产收据。
    if (this.frames.length === 0) throw fail('CEF_SCREENCAST_EMPTY');
    const frameIndex = {
      schemaVersion: 1,
      artifactKind: 'cef-screencast-frames',
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      frameCount: this.frames.length,
      frames: this.frames,
    };
    const video = {
      schemaVersion: 1,
      artifactKind: 'cef-screencast-video',
      playable: 'recording.html',
      frameIndex: 'frames.json',
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      frameCount: this.frames.length,
      steps: this.steps,
      containsLogin: false,
    };
    const products = {
      'frames.json': JSON.stringify(frameIndex, null, 2) + '\n',
      'video.json': JSON.stringify(video, null, 2) + '\n',
      'recording.html': htmlFor(frameIndex),
    };
    const gate = credentialGate(products);
    if (!gate.ok) throw fail('CEF_SCREENCAST_METADATA_REJECTED');
    for (const [name, body] of Object.entries(products)) writeFileSync(join(this.outDir, name), body, 'utf8');
    return { frameCount: this.frames.length, video: 'video.json', playable: 'recording.html', frameIndex: 'frames.json' };
  }
}
