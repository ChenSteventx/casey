// Purely static SUT-startup closure scanner used by the hermetic lifecycle gates.
//
// Deliberately no parser/import of a scanned entry: the input may contain an
// import-time sentinel, and executing a golden would violate the zero-SUT gate.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const FIXTURE_PATH_RE = /(?:^|\/)fixtures\/(fake-sut|login-sut|chat-sut|publish-sut)\/server\.mjs$/;
const START_EXPORT_RE = /^start(?:Fake|Login|Chat|Publish)Sut$/;

function posix(path) {
  return path.split(sep).join('/');
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function spanAt(source, offset) {
  const line = lineAt(source, offset);
  return { startLine: line, endLine: line };
}

// Preserve identifiers and line positions while blanking comments and quoted
// material. Import declarations are parsed from the original source separately.
function executableText(source) {
  let out = '';
  let mode = 'code';
  let quote = '';
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (mode === 'line-comment') {
      if (c === '\n') { mode = 'code'; out += '\n'; } else out += ' ';
      continue;
    }
    if (mode === 'block-comment') {
      if (c === '*' && n === '/') { out += '  '; i += 1; mode = 'code'; }
      else out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (mode === 'string') {
      if (c === '\\') {
        out += ' ';
        if (i + 1 < source.length) { i += 1; out += source[i] === '\n' ? '\n' : ' '; }
      } else if (c === quote) { out += ' '; mode = 'code'; }
      else out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (mode === 'template') {
      // Template expressions are not needed by the detector. Blanking the whole
      // template keeps documentation-like payloads from becoming effects.
      if (c === '\\') {
        out += ' ';
        if (i + 1 < source.length) { i += 1; out += source[i] === '\n' ? '\n' : ' '; }
      } else if (c === '`') { out += ' '; mode = 'code'; }
      else out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (c === '/' && n === '/') { out += '  '; i += 1; mode = 'line-comment'; continue; }
    if (c === '/' && n === '*') { out += '  '; i += 1; mode = 'block-comment'; continue; }
    if (c === '"' || c === "'") { out += ' '; quote = c; mode = 'string'; continue; }
    if (c === '`') { out += ' '; mode = 'template'; continue; }
    out += c;
  }
  return out;
}

function namedBindings(clause) {
  const open = clause.indexOf('{');
  const close = clause.lastIndexOf('}');
  if (open < 0 || close < open) return [];
  return clause.slice(open + 1, close).split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [imported, local = imported] = part.split(/\s+as\s+/);
    return { imported: imported.trim(), local: local.trim() };
  }).filter(({ imported, local }) => /^[A-Za-z_$][\w$]*$/.test(imported) && /^[A-Za-z_$][\w$]*$/.test(local));
}

function staticImports(source) {
  const imports = [];
  const re = /\bimport\s+([\s\S]*?)\s+from\s+(['"])([^'"\n]+)\2\s*;?/g;
  for (const match of source.matchAll(re)) {
    imports.push({ clause: match[1], specifier: match[3], offset: match.index });
  }
  return imports;
}

function localModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const candidate = resolve(dirname(fromFile), specifier);
  return existsSync(candidate) ? candidate : null;
}

function fixtureName(specifier) {
  return posix(specifier).match(FIXTURE_PATH_RE)?.[1] || null;
}

function resolvesToFixtureExport(file, exportedName, seen = new Set()) {
  const key = `${file}\0${exportedName}`;
  if (seen.has(key) || !existsSync(file)) return null;
  seen.add(key);
  const source = readFileSync(file, 'utf8');

  const re = /\bexport\s*\{([^}]+)\}\s*from\s*(['"])([^'"\n]+)\2\s*;?/g;
  for (const match of source.matchAll(re)) {
    for (const binding of namedBindings(`{${match[1]}}`)) {
      if (binding.local !== exportedName) continue;
      const fixture = fixtureName(match[3]);
      if (fixture && START_EXPORT_RE.test(binding.imported)) return fixture;
      const next = localModule(file, match[3]);
      if (next) {
        const resolved = resolvesToFixtureExport(next, binding.imported, seen);
        if (resolved) return resolved;
      }
    }
  }
  return null;
}

function calledAt(code, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\s*\\(`, 'g');
  const match = re.exec(code);
  return match ? match.index : -1;
}

function fixtureReasons(file, source, code) {
  const found = new Map();
  for (const declaration of staticImports(source)) {
    for (const binding of namedBindings(declaration.clause)) {
      const callOffset = calledAt(code, binding.local);
      if (callOffset < 0) continue;
      let fixture = fixtureName(declaration.specifier);
      if (fixture && !START_EXPORT_RE.test(binding.imported)) fixture = null;
      if (!fixture) {
        const target = localModule(file, declaration.specifier);
        if (target) fixture = resolvesToFixtureExport(target, binding.imported);
      }
      if (fixture && !found.has(fixture)) {
        found.set(fixture, {
          kind: 'fixture-start', fixture,
          sourceSpan: spanAt(source, callOffset),
        });
      }
    }
  }

  // Dynamic fixture import: require both a start* property extraction and a
  // subsequent call of the extracted local binding.
  const dynamic = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+import\s*\(\s*(['"])([^'"\n]+)\2\s*\)/g;
  for (const match of source.matchAll(dynamic)) {
    const fixture = fixtureName(match[3]);
    if (!fixture || found.has(fixture)) continue;
    const moduleName = match[1];
    const after = code.slice(match.index + match[0].length);
    const extraction = new RegExp(`\\b(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${moduleName}\\.(start(?:Fake|Login|Chat|Publish)Sut)\\b`).exec(after);
    if (!extraction || calledAt(after.slice(extraction.index + extraction[0].length), extraction[1]) < 0) continue;
    found.set(fixture, {
      kind: 'fixture-start', fixture,
      sourceSpan: spanAt(source, match.index),
    });
  }
  return [...found.values()];
}

function directListenerReason(source, code) {
  let createAlias = null;
  for (const declaration of staticImports(source)) {
    if (declaration.specifier !== 'node:http' && declaration.specifier !== 'http') continue;
    const binding = namedBindings(declaration.clause).find((item) => item.imported === 'createServer');
    if (binding) { createAlias = binding.local; break; }
  }
  if (!createAlias) return null;
  const create = new RegExp(`\\b(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${createAlias}\\s*\\(`).exec(code);
  if (!create) return null;
  const server = create[1];
  const tailOffset = create.index + create[0].length;
  const listen = new RegExp(`\\b${server}\\s*\\.\\s*listen\\s*\\(`).exec(code.slice(tailOffset));
  if (!listen) return null;
  const offset = tailOffset + listen.index;
  return { kind: 'direct-listener', sourceSpan: spanAt(source, offset) };
}

function sutCliReason(source, code) {
  const childAliases = new Set();
  for (const declaration of staticImports(source)) {
    if (declaration.specifier !== 'node:child_process' && declaration.specifier !== 'child_process') continue;
    for (const binding of namedBindings(declaration.clause)) {
      if (binding.imported === 'spawn' || binding.imported === 'spawnSync' || binding.imported === 'execFile' || binding.imported === 'execFileSync') {
        childAliases.add(binding.local);
      }
    }
  }
  for (const invoker of childAliases) {
    const callRe = new RegExp(`\\b${invoker}\\s*\\(\\s*process\\.execPath\\s*,\\s*([A-Za-z_$][\\w$]*)\\b`, 'g');
    for (const call of code.matchAll(callRe)) {
      const argv = call[1];
      // Read the original source for the literal flag, but require the same argv
      // identifier on the effect path to the child-process call.
      const pushRe = new RegExp(`\\b${argv}\\s*\\.\\s*push\\s*\\(\\s*(['"])--sut\\1\\s*,\\s*([A-Za-z_$][\\w$]*)`);
      const push = pushRe.exec(source.slice(0, call.index));
      if (!push) continue;
      const offset = source.slice(0, call.index).lastIndexOf(push[0]);
      return { kind: 'sut-cli-connect', sourceSpan: spanAt(source, offset) };
    }
  }
  return null;
}

/**
 * Return the exact subset of entry files that statically reach a fixture
 * launcher, a local HTTP listener, or a child-process --sut connection path.
 */
export async function scanSutStartupClosure({ root, entries }) {
  if (typeof root !== 'string' || !Array.isArray(entries)) throw new TypeError('root(string) 与 entries(array) 必填');
  const absoluteRoot = resolve(root);
  const results = [];
  for (const entry of entries) {
    const file = isAbsolute(entry) ? entry : resolve(absoluteRoot, entry);
    const source = readFileSync(file, 'utf8');
    const code = executableText(source);
    const reasons = fixtureReasons(file, source, code);
    const listener = directListenerReason(source, code);
    if (listener) reasons.push(listener);
    const cli = sutCliReason(source, code);
    if (cli) reasons.push(cli);
    if (reasons.length) {
      results.push({ goldenPath: posix(relative(absoluteRoot, file)), reasons });
    }
  }
  return results.sort((a, b) => a.goldenPath.localeCompare(b.goldenPath));
}
