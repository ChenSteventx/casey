#!/usr/bin/env node
// Verify Casey report JSON files meet the "0 error" bar.
import { readFileSync } from 'node:fs';

function usage() {
  console.error('用法: node scripts/verify-zero-error-report.mjs <report.json> [report.json ...]');
}

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

const files = process.argv.slice(2);
if (!files.length) {
  usage();
  process.exit(64);
}

let okAll = true;
for (const file of files) {
  let report;
  try {
    report = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    die('zero-error: 报告不可读或不是合法 JSON（路径不回显）', 65);
  }

  const caseId = String(report.caseId || '<unknown>');
  const s = report.verdictSummary || {};
  const counts = {
    PASS: Number(s.PASS || 0),
    SUT_DEFECT: Number(s.SUT_DEFECT || 0),
    HARNESS_ERROR: Number(s.HARNESS_ERROR || 0),
    NEEDS_HUMAN: Number(s.NEEDS_HUMAN || 0),
  };
  const nonPass = Array.isArray(report.steps) ? report.steps.filter((step) => step?.verdict !== 'PASS') : [];
  const ok = counts.PASS > 0
    && counts.SUT_DEFECT === 0
    && counts.HARNESS_ERROR === 0
    && counts.NEEDS_HUMAN === 0
    && nonPass.length === 0;
  if (!ok) okAll = false;
  const label = ok ? 'ok' : 'RED';
  console.log(`${label} ${caseId} PASS=${counts.PASS} SUT_DEFECT=${counts.SUT_DEFECT} HARNESS_ERROR=${counts.HARNESS_ERROR} NEEDS_HUMAN=${counts.NEEDS_HUMAN}`);
}

process.exit(okAll ? 0 : 1);
