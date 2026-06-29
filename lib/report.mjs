// lib/report.mjs —— P7 报告渲染器（纯函数、零 fs/网络/LLM/随机）。
//
// renderReport(model) -> { html, markdown, json }
//   model = 已冻 report-model（report-model.schema.json）：verdict.mjs 输出 ⋈ StepAxes ⋈ 观测现状 ⋈ 冻结契约，
//   由上游 casey report 一步合成。渲染器是它的【纯下游消费者】：不二次推断裁定、不再派生缺陷单
//   （直读 model.defectTicket / model.verdictSummary），不改任何冻结契约（护栏 #15）。
//
// 三形态：
//   html     —— 给人看的自包含主页（只内联 CSS、无任何外链/script/外部样式）；多态裁定徽章 + 期望对实际 + 缺陷单。
//   markdown —— 给终端/Claude Code/异构评审看的文本旁车（可 diff、当评审证据）。
//   json     —— 机读旁车（供多用例总目录聚合）；字符串形态、可 JSON.parse。
//
// 自包含 helper（escHtml/fmtMs/fmtSize/safeSlug/内联 CSS/htmlDoc 外壳）改自 autotester reporters/report.ts；
// 渲染逻辑是改造非照搬——autotester 只二值通过/失败，这里是四态多态徽章 + 缺陷单 + 期望对实际。

// 裁定四态中文态名（与 CONTEXT.md「多态裁定」一致）。
const VERDICT_ZH = { PASS: '通过', SUT_DEFECT: '被测缺陷', HARNESS_ERROR: '过程错误', NEEDS_HUMAN: '待人裁决' };
// 裁定徽章 CSS 类（颜色语义）。
const VERDICT_CLS = { PASS: 'pass', SUT_DEFECT: 'defect', HARNESS_ERROR: 'harness', NEEDS_HUMAN: 'human' };
// 人看分组顺序：该人看的（被测缺陷 / 待人裁决）顶上去，再过程错误，最后通过。
const GROUP_ORDER = ['SUT_DEFECT', 'NEEDS_HUMAN', 'HARNESS_ERROR', 'PASS'];

// ---- 自包含 helper（纯函数）----
function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtMs(ms) {
  if (ms == null) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}
function safeSlug(s) {
  return String(s ?? '').replace(/[^a-zA-Z0-9_.-]/g, '-');
}
function lit(v) {
  // 期望/实际字面量的人读形态（null 显式可见，不静默吞）。
  return v === null ? 'null' : String(v);
}

const CSS = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;margin:24px auto;max-width:1000px;color:#222;padding:0 16px;line-height:1.55}
  .head{border-bottom:2px solid #ccc;padding-bottom:12px;margin-bottom:18px}
  .head h1{margin:0 0 6px;font-size:23px}
  .meta{color:#666;font-size:13px}
  .meta code{background:#f0f0f0;padding:1px 6px;border-radius:3px}
  .summary{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
  .summary .cnt{padding:6px 14px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #e3e3e3}
  .cnt.pass{background:#d4edda;color:#155724}
  .cnt.defect{background:#f8d7da;color:#721c24}
  .cnt.harness{background:#e2e3ff;color:#2f2b8c}
  .cnt.human{background:#fff3cd;color:#856404}
  .banner{padding:10px 14px;border-radius:8px;margin:8px 0;font-size:14px;font-weight:600}
  .banner.defect{background:#f8d7da;color:#721c24;border-left:4px solid #dc3545}
  .banner.human{background:#fff3cd;color:#856404;border-left:4px solid #e0a800}
  .banner a{color:inherit}
  .badge{display:inline-block;padding:2px 12px;border-radius:12px;font-size:13px;font-weight:600;vertical-align:middle;margin-left:8px}
  .badge.pass{background:#d4edda;color:#155724}
  .badge.defect{background:#f8d7da;color:#721c24}
  .badge.harness{background:#e2e3ff;color:#2f2b8c}
  .badge.human{background:#fff3cd;color:#856404}
  section.step{border:1px solid #eef0f7;border-radius:8px;padding:12px 16px;margin:14px 0;background:#fafbff}
  section.step h3{font-size:16px;margin:0 0 6px}
  .reason{color:#856404;font-size:13px;margin:2px 0}
  .action{color:#555;font-size:13px;margin:4px 0}
  table.assertions{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}
  table.assertions td,table.assertions th{border:1px solid #e3e3e3;padding:5px 9px;vertical-align:top;text-align:left}
  table.assertions th{background:#f5f5f5;font-weight:600}
  tr.assert-soft{background:#fff8e1}
  tr.assert-soft .softnote{color:#856404;font-size:11px;font-weight:600}
  .ok-yes{color:#28a745;font-weight:700}
  .ok-no{color:#dc3545;font-weight:700}
  .defect-ticket{border:1px solid #f5c2c7;background:#fff5f5;border-radius:6px;padding:10px 12px;margin:8px 0}
  .defect-ticket h4{margin:0 0 6px;color:#721c24;font-size:14px}
  .defect-ticket ul{margin:4px 0;padding-left:20px}
  .attach{font-size:13px;color:#555;margin:6px 0}
  .attach code{background:#f0f0f0;padding:1px 6px;border-radius:3px}
  pre.reply{background:#f5f5f5;padding:10px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:340px;overflow:auto}
  .none{color:#999;font-size:13px}
`;

function htmlDoc(title, inner) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(title)} — Casey 测试报告</title><style>${CSS}</style></head><body>${inner}</body></html>\n`;
}

function badge(verdict) {
  return `<span class="badge ${VERDICT_CLS[verdict] || 'human'}">${escHtml(VERDICT_ZH[verdict] || verdict)}</span>`;
}

// ---- HTML：单步期望对实际表（soft 置顶、标「不进裁定树」黄标）----
function assertionRowsHtml(postAssertions) {
  const list = postAssertions || [];
  const soft = list.filter((a) => a.soft === true);
  const hard = list.filter((a) => a.soft !== true);
  const row = (a, soft) => `<tr class="${soft ? 'assert-soft' : 'assert-hard'}">`
    + `<td>${escHtml(a.kind)}${soft ? ' <span class="softnote">[soft·不进裁定树]</span>' : ''}</td>`
    + `<td>${escHtml(a.op)}</td>`
    + `<td>期望 ${escHtml(lit(a.value))}</td>`
    + `<td>实际 ${escHtml(lit(a.actual))}</td>`
    + `<td class="${a.ok ? 'ok-yes' : 'ok-no'}">${a.ok ? '✓' : '✗'}</td>`
    + `</tr>`;
  if (!list.length) return '<div class="none">（本步无期望对实际）</div>';
  // soft 置顶：黄标软断言排在硬断言之前。
  const body = [...soft.map((a) => row(a, true)), ...hard.map((a) => row(a, false))].join('');
  return `<table class="assertions"><thead><tr><th>断言种类</th><th>算子</th><th>期望</th><th>实际</th><th>满足</th></tr></thead><tbody>${body}</tbody></table>`;
}

// ---- HTML：缺陷单（仅 SUT_DEFECT 步、直读 model.defectTicket、不二次派生）----
function defectTicketHtml(stepId, dt) {
  if (!dt) return '';
  const failed = (dt.failedAssertions || [])
    .map((a) => `<li>${escHtml(a.kind)} ${escHtml(a.op)}：期望 ${escHtml(lit(a.value))} / 实际 ${escHtml(lit(a.actual))}</li>`).join('');
  const backing = (dt.backingForensics || [])
    .map((b) => `<li><code>${escHtml(b.url)}</code> · status ${escHtml(lit(b.status))} · 归因 ${escHtml(b.attributedStepId)}</li>`).join('');
  const videoAt = dt.videoAt != null ? `<div class="attach">录屏时间点：<code>${escHtml(fmtMs(dt.videoAt))}</code></div>` : '';
  const traceRef = dt.traceRef ? `<div class="attach">trace：<a href="${escHtml(dt.traceRef)}" download>${escHtml(dt.traceRef)}</a></div>` : '';
  return `<div class="defect-ticket" data-defect-ticket="${escHtml(stepId)}">`
    + `<h4>缺陷单（被测缺陷·已取证背书）</h4>`
    + `<div>失败硬断言：</div><ul>${failed || '<li class="none">（无）</li>'}</ul>`
    + `<div>取证背书：</div><ul>${backing || '<li class="none">（无）</li>'}</ul>`
    + videoAt + traceRef + `</div>`;
}

// ---- HTML：附件 + 文本输出 ----
function attachmentsHtml(step) {
  const at = step.attachments || {};
  const obs = step.observed || {};
  const parts = [];
  if (at.video) parts.push(`录屏 <code>${escHtml(at.video)}</code>`);
  if (at.screenshot) parts.push(`截图 <code>${escHtml(at.screenshot)}</code>`);
  if (at.trace) parts.push(`trace <a href="${escHtml(at.trace)}" download>${escHtml(at.trace)}</a>`);
  if (at.stepPage) parts.push(`子页 <a href="${escHtml(at.stepPage)}">${escHtml(at.stepPage)}</a>`);
  const attachLine = parts.length ? `<div class="attach">附件：${parts.join(' · ')}</div>` : '';
  const reply = obs.replyText ? `<div class="attach">LLM 回复：</div><pre class="reply">${escHtml(obs.replyText)}</pre>` : '';
  return attachLine + reply;
}

function stepHtml(step) {
  const v = step.verdict;
  const reason = (v === 'NEEDS_HUMAN' && step.reason) ? `<div class="reason">理由子类：${escHtml(step.reason)}</div>` : '';
  const action = step.action || {};
  const actionLine = `<div class="action">操作：${escHtml(action.describe || action.kind || '')}`
    + `${action.resolution ? `（定位 ${escHtml(action.resolution)}）` : ''}`
    + `${step.intentText ? ` · 意图：${escHtml(step.intentText)}` : ''}</div>`;
  return `<section class="step verdict-${escHtml(v)}" data-step-id="${escHtml(step.stepId)}" id="step-${escHtml(safeSlug(step.stepId))}">`
    + `<h3>${escHtml(step.atom || step.stepId)} ${badge(v)}</h3>`
    + reason + actionLine
    + assertionRowsHtml(step.postAssertions)
    + defectTicketHtml(step.stepId, step.defectTicket)
    + attachmentsHtml(step)
    + `</section>`;
}

// 按裁定态分组、人看的顶上去。
function groupSteps(steps) {
  const groups = [];
  for (const v of GROUP_ORDER) {
    const items = steps.filter((s) => s.verdict === v);
    if (items.length) groups.push({ verdict: v, items });
  }
  // 兜底：枚举外的态（理论不该有）按原序补到末尾。
  const seen = new Set(GROUP_ORDER);
  const rest = steps.filter((s) => !seen.has(s.verdict));
  if (rest.length) groups.push({ verdict: 'OTHER', items: rest });
  return groups;
}

function summaryHtml(vs) {
  const cell = (k) => `<div class="cnt ${VERDICT_CLS[k]}">${escHtml(VERDICT_ZH[k])} ${escHtml(lit(vs[k] ?? 0))}</div>`;
  return `<div class="summary">${['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN'].map(cell).join('')}</div>`;
}

function bannerHtml(steps) {
  const flagged = steps.filter((s) => s.verdict === 'SUT_DEFECT' || s.verdict === 'NEEDS_HUMAN');
  if (!flagged.length) return '';
  return flagged.map((s) => {
    const cls = s.verdict === 'SUT_DEFECT' ? 'defect' : 'human';
    return `<div class="banner ${cls}"><a href="#step-${escHtml(safeSlug(s.stepId))}">${escHtml(VERDICT_ZH[s.verdict])} · ${escHtml(s.atom || s.stepId)}（点此直达本步）</a></div>`;
  }).join('');
}

function renderHtml(model) {
  const steps = model.steps || [];
  const head = `<div class="head"><h1>${escHtml(model.title || model.caseId)}</h1>`
    + `<div class="meta">用例 <code>${escHtml(model.caseId)}</code>`
    + ` · 通道 <code>${escHtml(model.channel)}</code>`
    + ` · 期望版本 <code>${escHtml(model.signedAgainstBuild || '（未签）')}</code>`
    + ` · 生成于 ${escHtml(model.generatedAt)}</div></div>`;
  const summary = summaryHtml(model.verdictSummary || {});
  const banner = bannerHtml(steps);
  const groups = groupSteps(steps).map((g) =>
    `<h2>${escHtml(VERDICT_ZH[g.verdict] || g.verdict)}（${g.items.length}）</h2>${g.items.map(stepHtml).join('')}`,
  ).join('');
  return htmlDoc(model.title || model.caseId, head + summary + banner + groups);
}

// ---- Markdown 旁车 ----
function assertionLineMd(a) {
  const soft = a.soft === true ? ' `[soft·不进裁定树]`' : '';
  return `  - ${a.ok ? '✓' : '✗'} \`${a.kind}\` ${a.op}：期望 \`${lit(a.value)}\` / 实际 \`${lit(a.actual)}\`${soft}`;
}
function stepMd(step) {
  const lines = [];
  lines.push(`### ${step.atom || step.stepId} — ${VERDICT_ZH[step.verdict] || step.verdict}`);
  if (step.verdict === 'NEEDS_HUMAN' && step.reason) lines.push(`> 理由子类：${step.reason}`);
  if (step.intentText) lines.push(`- 意图：${step.intentText}`);
  const action = step.action || {};
  if (action.describe || action.kind) lines.push(`- 操作：${action.describe || action.kind}${action.resolution ? `（定位 ${action.resolution}）` : ''}`);
  const list = step.postAssertions || [];
  const soft = list.filter((a) => a.soft === true);
  const hard = list.filter((a) => a.soft !== true);
  if (list.length) {
    lines.push('- 期望对实际：');
    [...soft, ...hard].forEach((a) => lines.push(assertionLineMd(a)));
  }
  const dt = step.defectTicket;
  if (dt) {
    lines.push('- 缺陷单（被测缺陷·已取证背书）：');
    (dt.failedAssertions || []).forEach((a) => lines.push(`  - 失败硬断言 \`${a.kind}\` ${a.op}：期望 \`${lit(a.value)}\` / 实际 \`${lit(a.actual)}\``));
    (dt.backingForensics || []).forEach((b) => lines.push(`  - 取证背书 \`${b.url}\` status \`${lit(b.status)}\`（归因 ${b.attributedStepId}）`));
    if (dt.videoAt != null) lines.push(`  - 录屏时间点 \`${fmtMs(dt.videoAt)}\``);
    if (dt.traceRef) lines.push(`  - trace \`${dt.traceRef}\``);
  }
  const obs = step.observed || {};
  if (obs.replyText) lines.push(`- LLM 回复：${obs.replyText}`);
  return lines.join('\n');
}
function renderMarkdown(model) {
  const vs = model.verdictSummary || {};
  const steps = model.steps || [];
  const lines = [];
  lines.push(`# ${model.title || model.caseId} — Casey 测试报告`);
  lines.push('');
  lines.push(`- 用例：\`${model.caseId}\` · 通道：\`${model.channel}\` · 期望版本：\`${model.signedAgainstBuild || '（未签）'}\``);
  lines.push(`- 生成于：${model.generatedAt}`);
  lines.push(`- 裁定概览：通过 ${vs.PASS ?? 0} · 被测缺陷 ${vs.SUT_DEFECT ?? 0} · 过程错误 ${vs.HARNESS_ERROR ?? 0} · 待人裁决 ${vs.NEEDS_HUMAN ?? 0}`);
  const flagged = steps.filter((s) => s.verdict === 'SUT_DEFECT' || s.verdict === 'NEEDS_HUMAN');
  if (flagged.length) {
    lines.push('');
    lines.push(`> 置顶：本用例有 ${flagged.length} 步需人看（${flagged.map((s) => `${VERDICT_ZH[s.verdict]}·${s.atom || s.stepId}`).join('，')}）。`);
  }
  for (const g of groupSteps(steps)) {
    lines.push('');
    lines.push(`## ${VERDICT_ZH[g.verdict] || g.verdict}（${g.items.length}）`);
    g.items.forEach((s) => { lines.push(''); lines.push(stepMd(s)); });
  }
  lines.push('');
  return lines.join('\n');
}

// ---- json 旁车（机读聚合入口）----
function renderJson(model) {
  const projection = {
    schemaVersion: model.schemaVersion,
    caseId: model.caseId,
    title: model.title ?? null,
    channel: model.channel,
    signedAgainstBuild: model.signedAgainstBuild ?? null,
    passes: model.passes ?? null,
    generatedAt: model.generatedAt,
    verdictSummary: model.verdictSummary,
    steps: (model.steps || []).map((s) => ({
      stepId: s.stepId,
      intentId: s.intentId,
      atom: s.atom,
      verdict: s.verdict,
      reason: s.reason ?? null,
      hasDefectTicket: s.defectTicket != null,
      assertions: (s.postAssertions || []).map((a) => ({ kind: a.kind, op: a.op, value: a.value, actual: a.actual, ok: a.ok, soft: a.soft })),
    })),
  };
  return JSON.stringify(projection, null, 2) + '\n';
}

export function renderReport(model) {
  if (!model || typeof model !== 'object') throw new Error('renderReport 需 report-model 对象');
  if (!model.caseId || !Array.isArray(model.steps)) throw new Error('report-model 缺 caseId/steps');
  return {
    html: renderHtml(model),
    markdown: renderMarkdown(model),
    json: renderJson(model),
  };
}

export default renderReport;
