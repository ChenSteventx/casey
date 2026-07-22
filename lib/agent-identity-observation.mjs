// 身份观察事务账本（agent-id-readback s1）。纯逻辑、零 IO：采集器喂事件，编译/回放门消费。
// 语义权威：docs/plans/agent-id-readback/plan.md §1 + accept/interface-spec.md §1/§8。
// 核心安全属性（sol P0-1）：归属在 requestWillBeSent 时刻冻结到当时已武装未封存的事务；
// 晚到终态只写回原事务（已封存则弃入 lateDrops），绝不进新事务；consume 一次性。

const ROW_FIELD_MAX = 256;
const ROWS_MAX = 200;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '' && v.length <= ROW_FIELD_MAX;
}

// 行复验（有界投影后仍复验；整页任一坏行=整页 invalid，禁过滤后判唯一）。
// id 必须无损全数字 string——JSON number 形态一律拒（越过安全整数的 number 已失真，见 sol P1-6）。
function rowsValid(rows) {
  if (!Array.isArray(rows) || rows.length > ROWS_MAX) return false;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    if (!isNonEmptyString(row.id) || !/^[0-9]+$/.test(row.id)) return false;
    if (!isNonEmptyString(row.code) || !isNonEmptyString(row.name)) return false;
  }
  return true;
}

function canonicalRows(rows, total) {
  return JSON.stringify({ total, rows: rows.map((r) => ({ id: r.id, code: r.code, name: r.name })) });
}

export function createIdentityObservationLedger({ channel } = {}) {
  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
    throw new TypeError('identity observation ledger 需通道配置（剖面 agents.listApi 闭合对象）');
  }
  // tokens 用 WeakSet（codex R2-M1 引用释放）：账本不强持 token——调用方释放后 GC 可回收；
  // consumed 一次性语义由 token 自身的 consumed 标记承载，不依赖账本存活集合。
  const tokens = new WeakSet();
  const byRequestSeq = new Map(); // requestSeq -> token（归属冻结；consume 时逐 seq 释放）
  let armed = null;               // 当前已武装未封存事务
  let lateDrops = 0;

  function tokenState(token) {
    if (!token || typeof token !== 'object' || !tokens.has(token)) throw new TypeError('未知身份观察事务 token');
    return token;
  }

  function isComplete(t) {
    for (const req of t.requests.values()) if (req.outcome == null) return false;
    return true;
  }

  function notifyIfComplete(t) {
    if (!isComplete(t)) return;
    for (const resolve of t.waiters.splice(0)) resolve();
  }

  return {
    arm({ intentId, generation, expectedQuery } = {}) {
      const token = {
        intentId: intentId ?? null,
        generation: generation ?? null,
        expectedQuery: expectedQuery ?? null,
        requests: new Map(), // requestSeq -> { seq, outcome|null }
        sealed: false,
        consumed: false,
        waiters: [],
      };
      tokens.add(token);
      armed = token;
      return token;
    },

    onRequestWillBeSent({ requestSeq, method, urlPathname, queryEcho } = {}) {
      // 归属此刻冻结：无武装事务/已封存/通道不匹配/查询回声不符 → 不入账（fail-safe 物理落点）。
      // queryEcho 判据（codex R1-H2）：arm 冻结的 expectedQuery 在场时，异查询请求不得进事务——
      // 同路径异关键词响应混入会把「别人的完整集合」当成本查询的完整性证据。
      if (armed == null || armed.sealed) return;
      if (channel.method != null && method !== channel.method) return;
      if (channel.pathname != null && urlPathname !== channel.pathname) return;
      if (armed.expectedQuery != null && queryEcho !== armed.expectedQuery) return;
      if (requestSeq == null || byRequestSeq.has(requestSeq)) return;
      armed.requests.set(requestSeq, { seq: requestSeq, outcome: null });
      byRequestSeq.set(requestSeq, armed);
    },

    onBodyTerminal({ requestSeq, outcome } = {}) {
      const owner = byRequestSeq.get(requestSeq);
      if (!owner) return; // 未归属请求的终态：不入任何事务
      if (owner.sealed && owner.requests.get(requestSeq)?.outcome == null) {
        // 晚到终态、事务已封存：弃入 lateDrops，绝不改写已封存集合，也绝不进新事务。
        lateDrops += 1;
        return;
      }
      const req = owner.requests.get(requestSeq);
      if (!req || req.outcome != null) return; // 重复终态：首个为准
      req.outcome = outcome && typeof outcome === 'object' ? outcome : { kind: 'invalid' };
      notifyIfComplete(owner);
    },

    settle(token, { timeoutMs = null, timer = setTimeout } = {}) {
      // 有界终态（codex R1-M1，interface-spec §1「有界，注入时钟可测」）：timeoutMs 到点时把本事务
      // 内仍未决的请求显式写 timeout 终态再放行 waiters——超时是账本内的显式终态，不是外部 race 弃等。
      // 不传 timeoutMs 维持无界等待（协议单元测试用探针语义）。
      const t = tokenState(token);
      if (isComplete(t)) return Promise.resolve();
      if (timeoutMs != null) {
        timer(() => {
          if (isComplete(t)) return;
          for (const req of t.requests.values()) {
            if (req.outcome == null) req.outcome = { kind: 'timeout' };
          }
          notifyIfComplete(t);
        }, timeoutMs);
      }
      return new Promise((resolve) => { t.waiters.push(resolve); });
    },

    seal(token) {
      const t = tokenState(token);
      t.sealed = true;
      if (armed === t) armed = null;
    },

    consume(token) {
      const t = tokenState(token);
      if (t.consumed) return { status: 'consumed' };
      t.consumed = true;
      // 引用释放（codex R2-M1）：消费即出账——requestSeq 反查表逐条删除、waiters 清空；
      // 晚到终态自此按「未归属请求」丢弃（不入任何事务、不可复活已消费集合）。
      const reqs = [...t.requests.values()].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
      for (const seq of t.requests.keys()) byRequestSeq.delete(seq);
      t.requests.clear();
      t.waiters.length = 0;
      // seal 先决（codex R1-M1）：未封存事务禁消费——否则消费后仍可有新请求归属进来，
      // 「消费时刻的完整集合」承诺失真。协议序固定 arm→settle→seal→consume。
      if (!t.sealed) return { status: 'unsealed' };
      if (reqs.some((req) => req.outcome == null)) return { status: 'unsettled' };
      if (reqs.length === 0) return { status: 'empty' };
      // 全部终态必须是 parsed；failed/timeout/invalid 任一在场=证不出（fail-safe，failed≠空数组）。
      const parsed = [];
      for (const req of reqs) {
        if (req.outcome.kind !== 'parsed') return { status: 'invalid' };
        parsed.push(req.outcome);
      }
      // 逐响应复验：行复验 + 完整性先决（total 合法且恰等行数；hasNext 语义按剖面声明分流，
      // codex R1-H3）：声明 hasNextPath 则该字段必须存在且严格 false——缺字段/undefined/null/0/true
      // 一律 invalid（声明即义务，缺席不是完整页证据）；未声明则投影不得携 hasNext，携=异常拒。
      for (const out of parsed) {
        if (!rowsValid(out.rows)) return { status: 'invalid' };
        if (!Number.isInteger(out.total) || out.total < 0 || out.total !== out.rows.length) return { status: 'invalid' };
        if (channel.hasNextPath != null) {
          if (out.hasNext !== false) return { status: 'invalid' };
        } else if ('hasNext' in out) {
          return { status: 'invalid' };
        }
      }
      // 多响应一致性：canonical 不一致 = conflict；一致取 requestSeq 序最后一个。
      const last = parsed[parsed.length - 1];
      const lastCanon = canonicalRows(last.rows, last.total);
      for (const out of parsed) {
        if (canonicalRows(out.rows, out.total) !== lastCanon) return { status: 'conflict' };
      }
      return {
        status: 'ok',
        rows: last.rows.map((r) => ({ id: r.id, code: r.code, name: r.name })),
        total: last.total,
      };
    },

    lateDropCount: () => lateDrops,
  };
}
