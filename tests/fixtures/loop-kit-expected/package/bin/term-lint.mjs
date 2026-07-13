#!/usr/bin/env node
// term-lint —— 统一语言（Ubiquitous Language）白名单检查器。机制依据：ADR-0004。
// 数据源：仓库根 CONTEXT.md 的四列制术语表（术语/中文译名/白话解释/弃用别名）。
//
// 检查项：
//   ERROR  deny    弃用别名出现在任何文本（黑名单；含 `term-lint:allow` 的行豁免）
//   ERROR  unreg   加粗的英文术语（≤3 词）未登记（白名单）
//   ERROR  registry 术语表行缺白话解释 / 英文术语缺中文译名（完整性）
//   WARN   cjk     加粗的中文短词未登记（已声明的残余泄漏面，仅提示不阻塞）
//
// 用法：
//   node term-lint.mjs --file a.md b.json     检查文件
//   node term-lint.mjs --stdin                检查标准输入的文本
//   node term-lint.mjs --registry             仅做术语表完整性检查
// 退出码：0 通过（可有 WARN）；1 有 ERROR。

import { readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRoot } from '../lib/root.mjs';

const ROOT = resolveRoot();
const CONTEXT_PATH = join(ROOT, 'CONTEXT.md');
const PRAGMA = 'term-lint:allow';

// 常见强调用语，不是术语，不必登记（仅用于压制 CJK WARN 误报）
const CJK_STOPLIST = new Set([
  '必须', '不可以', '可以', '禁止', '注意', '重要', '推荐', '不变', '不要',
  '永远', '所有', '一次', '只读', '冻结', '红', '绿', '是', '否', '强制',
]);

// 繁体字检测（中文一律简体，2026-06-24 用户要求严格兜底）：繁→简 高频映射，scanText 命中即 ERROR。
// 词元以空格分隔（每个 token = 繁+简两字，防手写错位）；只收「繁体专用、简体有别字」的字，
// 刻意排除简体也用的字（乾坤的乾、著作的著等）避免误报；可继续补。term-lint:allow 行豁免。
const TRAD2SIMP = (() => {
  const pairs = '與与 並并 個个 們们 這这 裡里 裏里 為为 麼么 麽么 節节 點点 錯错 語语 應应 關关 門门 開开 間间 閉闭 閣阁 閱阅 闊阔 闖闯 將将 後后 幹干 麵面 製制 黨党 員员 國国 圖图 團团 還还 進进 過过 運运 達达 遠远 連连 選选 適适 種种 稱称 經经 結结 給给 繼继 續续 網网 線线 細细 終终 組组 級级 約约 紅红 縣县 總总 聯联 聲声 職职 聽听 興兴 舉举 處处 號号 衛卫 裝装 複复 復复 見见 規规 視视 親亲 覺觉 觀观 計计 訂订 認认 討讨 記记 訪访 設设 許许 詞词 試试 話话 該该 說说 課课 調调 談谈 請请 論论 講讲 謝谢 證证 識识 議议 護护 讀读 變变 讓让 財财 貨货 責责 貴贵 買买 費费 資资 賣卖 質质 購购 軍军 軟软 較较 載载 輕轻 輪轮 輸输 轉转 農农 錄录 錢钱 鎖锁 鐵铁 長长 陽阳 隊队 際际 隨随 險险 隱隐 雖虽 雙双 雜杂 雞鸡 離离 難难 電电 靈灵 響响 頁页 順顺 須须 預预 領领 頭头 題题 額额 顏颜 願愿 類类 顧顾 風风 飛飞 飯饭 養养 餘余 館馆 體体 髮发 鬧闹 魚鱼 鳥鸟 麗丽 黃黄 齊齐 齒齿 龍龙 龜龟 學学 寫写 實实 寶宝 寧宁 對对 導导 尋寻 層层 屬属 歲岁 幣币 帶带 幫帮 歸归 當当 懷怀 態态 驚惊 愛爱 戰战 戶户 執执 擴扩 掃扫 擔担 擁拥 據据 損损 換换 數数 斷断 舊旧 時时 顯显 術术 機机 權权 條条 來来 極极 構构 樣样 檔档 橋桥 檢检 樓楼 標标 歡欢 歐欧 氣气 漢汉 沒没 淚泪 潔洁 測测 濟济 灣湾 濕湿 滿满 滅灭 燈灯 燒烧 熱热 營营 狀状 獨独 貓猫 環环 現现 畫画 療疗 盤盘 蓋盖 監监 鹽盐 礎础 窮穷 競竞 籌筹 簽签 籃篮 糧粮 緊紧 織织 維维 綠绿 編编 縮缩 績绩 萬万 葉叶 蘭兰 蘇苏 虛虚 蟲虫 衝冲 觸触 訊讯 車车 軌轨 辦办 鄉乡 鄭郑 釀酿 銀银 銅铜 銷销 鋒锋 鍋锅 鎮镇 鏡镜 閃闪 陸陆 陳陈 陰阴 雲云 韓韩 韻韵 項项 頑顽 頓顿 頻频 顆颗 顛颠 飄飘 飢饥 餃饺 餅饼 饅馒 饋馈 馬马 駐驻 駕驾 騎骑 騰腾 驅驱 驗验 髒脏 鬆松 鬥斗 魯鲁 鮮鲜 鳳凤 鴨鸭 鵝鹅 鶴鹤 鷹鹰 麥麦 齡龄 龐庞 臺台 臨临 膽胆 臉脸 腦脑 脈脉 肅肃 義义 習习 羅罗 罷罢 聞闻 衆众 眾众 補补 訴诉 評评 詢询 詳详 誤误 誰谁 諸诸 謀谋 謹谨 贊赞 趕赶 軀躯 輛辆 輝辉 輩辈 轎轿 轟轰 鈕钮 鉛铅 銘铭 銜衔 鋪铺 錦锦 鍛锻 鏈链 閏闰 閘闸 閥阀 隸隶 雛雏 靜静 頸颈 驕骄 鴻鸿 鵬鹏 鸚鹦 廠厂 廣广 廳厅 慮虑 憶忆 戀恋 擊击 擬拟 曠旷 棟栋 殼壳 氫氢 滬沪 潤润 獲获 礙碍 籠笼 糾纠 紐纽 紮扎 紹绍 綁绑 綜综 縫缝 繞绕 纖纤 罰罚 聰聪 腎肾 艙舱 蓮莲 藍蓝 藥药 蘆芦 襪袜 諷讽 譴谴 賠赔 賤贱 賜赐 軋轧 輟辍 轄辖 遷迁 邏逻 鄰邻 醜丑 鑽钻 颱台 餞饯 騷骚 驢驴 鬱郁 鴿鸽 鹼碱';
  const m = new Map();
  for (const tok of pairs.split(/\s+/)) if (tok.length === 2 && tok[0] !== tok[1]) m.set(tok[0], tok[1]);
  return m;
})();

export function parseRegistry(contextPath = CONTEXT_PATH) {
  const allow = new Set();
  const deny = [];
  const registryErrors = [];
  let text;
  try {
    text = readFileSync(contextPath, 'utf8');
  } catch {
    return { allow, deny, registryErrors: [{ line: 0, msg: `读不到 ${contextPath} —— 术语表是白名单数据源，必须存在` }] };
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const [rawTerm, zh, gloss, aliases] = cells;
    if (/^[-—\s:]*$/.test(rawTerm) || rawTerm === '术语') continue; // 表头/分隔行
    const term = rawTerm.replace(/[`*]/g, '').trim();
    allow.add(term.toLowerCase());
    if (zh && zh !== '—') zh.split(/[,，/]/).forEach((z) => z.trim() && allow.add(z.trim()));
    const isLatin = /^[\x20-\xff]+$/.test(term);
    if (!gloss || gloss === '—') registryErrors.push({ line: i + 1, msg: `术语「${term}」缺白话解释（四列制强制，ADR-0004）` });
    else if (isLatin && (!zh || zh === '—')) registryErrors.push({ line: i + 1, msg: `英文术语「${term}」缺中文译名（四列制强制，ADR-0004）` });
    if (aliases && aliases !== '—') {
      aliases.split(/[,，]/).map((a) => a.trim()).filter(Boolean).forEach((a) => deny.push({ alias: a, canonical: term }));
    }
  }
  return { allow, deny, registryErrors };
}

export function scanText(text, { label = '<text>', isContextFile = false, registry } = {}) {
  const { allow, deny } = registry ?? parseRegistry();
  const errors = [];
  const warnings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(PRAGMA)) continue;
    // 繁体字（简体强制兜底）：行内任一繁体字命中即 ERROR；同字一行只报一次。
    const tradHits = new Set();
    for (const ch of line) if (TRAD2SIMP.has(ch)) tradHits.add(ch);
    for (const ch of tradHits) errors.push(`${label}:${i + 1}  繁体字「${ch}」→ 应改用简体「${TRAD2SIMP.get(ch)}」（中文一律用简体）`);
    const isTableRow = line.trimStart().startsWith('|');
    // 黑名单：弃用别名命中（CONTEXT.md 自身的表格行豁免——别名登记在那里）
    if (!(isContextFile && isTableRow)) {
      for (const { alias, canonical } of deny) {
        if (line.includes(alias)) {
          errors.push(`${label}:${i + 1}  弃用别名「${alias}」→ 应改用「${canonical}」`);
        }
      }
    }
    // 白名单：加粗标记的术语
    for (const m of line.matchAll(/\*\*([^*\n]{2,60}?)\*\*/g)) {
      const span = m[1].replace(/[`]/g, '').trim();
      // 文件名/路径不是概念术语：含路径分隔符或以扩展名结尾的跳过白名单检查
      if (span.includes('/') || span.includes('\\') || /\.\w{1,6}$/.test(span)) continue;
      if (/^[A-Za-z][A-Za-z0-9 .'\/-]{1,40}$/.test(span) && span.split(/\s+/).length <= 3) {
        if (!allow.has(span.toLowerCase())) {
          errors.push(`${label}:${i + 1}  加粗英文术语「${span}」未登记 CONTEXT.md —— 改用已登记术语，或当场四列制补登记`);
        }
      } else if (/^[一-鿿]{2,12}$/.test(span)) {
        if (!allow.has(span) && !CJK_STOPLIST.has(span)) {
          warnings.push(`${label}:${i + 1}  加粗中文词「${span}」未登记——若作为术语使用请登记；若仅是强调可忽略`);
        }
      }
    }
  }
  return { errors, warnings };
}

export function lintFiles(paths, { registry } = {}) {
  const reg = registry ?? parseRegistry();
  const errors = [...reg.registryErrors.map((e) => `CONTEXT.md:${e.line}  ${e.msg}`)];
  const warnings = [];
  for (const p of paths) {
    let content;
    try {
      content = readFileSync(p, 'utf8');
    } catch {
      continue; // 文件可能已删除——lint 基础设施永不阻塞正常工作
    }
    const r = scanText(content, { label: p, isContextFile: basename(p) === 'CONTEXT.md', registry: reg });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { errors, warnings };
}

// CLI 入口
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const registry = parseRegistry();
  let result;
  if (args[0] === '--stdin') {
    const text = readFileSync(0, 'utf8');
    result = scanText(text, { label: '<stdin>', registry });
    result.errors.unshift(...registry.registryErrors.map((e) => `CONTEXT.md:${e.line}  ${e.msg}`));
  } else if (args[0] === '--registry') {
    result = { errors: registry.registryErrors.map((e) => `CONTEXT.md:${e.line}  ${e.msg}`), warnings: [] };
  } else if (args[0] === '--file') {
    result = lintFiles(args.slice(1), { registry });
  } else {
    console.error('用法: term-lint.mjs --file <路径...> | --stdin | --registry');
    process.exit(64);
  }
  for (const w of result.warnings) console.log(`WARN  ${w}`);
  for (const e of result.errors) console.error(`ERROR ${e}`);
  if (result.errors.length) {
    console.error(`\nterm-lint: ${result.errors.length} 个错误。术语表见 CONTEXT.md，规则见 docs/adr/0004。`);
    process.exit(1);
  }
  console.log(`term-lint: 通过（${result.warnings.length} 个提示）`);
}
