/**
 * 跨平台路径解析。所有脚本从这里 import，别在脚本里硬编码子路径。
 * 镜像 autotester lib/paths.mjs 的角色；Casey 用 cases/<caseId>/ 存每条用例的回放产物。
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const CASES_DIR = path.join(PROJECT_ROOT, 'cases');
export const LOOP_DIR = path.join(PROJECT_ROOT, 'loop');
export const LOOPKIT_BIN = path.join(PROJECT_ROOT, 'loop-kit', 'bin');
export const DRIFT_DIR = path.join(PROJECT_ROOT, 'drift');
export const AUTH_DIR = path.join(PROJECT_ROOT, '.auth');
export const CREDS_FILE = path.join(AUTH_DIR, 'credentials.json');

export const NODE_EXE = process.execPath;

/** loop-kit 引擎脚本的绝对路径（CLI 薄壳据此调用）。 */
export const kit = (name) => path.join(LOOPKIT_BIN, name);

/** 某条用例的目录与产物路径。 */
export function caseDir(caseId) {
  return path.join(CASES_DIR, caseId);
}
export function casePaths(caseId) {
  const dir = caseDir(caseId);
  return {
    dir,
    events: path.join(dir, 'events.json'),
    spec: path.join(dir, `${caseId}.spec.ts`),
    observed: path.join(dir, `observed-${caseId}.json`),
    verdict: path.join(dir, 'verdict.json'),
    report: path.join(dir, `${caseId}.report.html`),
    contract: path.join(LOOP_DIR, `prd-${caseId}.json`),
  };
}

/** Playwright CLI（P3 起 npm install 后存在）；当前可能缺失，调用方需自检。 */
export const PLAYWRIGHT_CLI = path.join(PROJECT_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
export function hasPlaywright() {
  return fs.existsSync(PLAYWRIGHT_CLI);
}
