#!/usr/bin/env node
/**
 * check-wallclock-usage —— gameplay 目录墙钟/裸定时器守门(确定性九类审计的编写时防线)。
 *
 * 背景:performance.now / Date.now / setTimeout / setInterval 是 Mode A 非确定源
 * 最大惯犯族(sword 5 处、qy 3+1 处根因全在此族)。本检查把「逐类事后审计」
 * 降级为「新增即红」:现存命中记入台账(scripts/wallclock-ledger.json),
 * 新增命中未入账则失败 —— 收编它(determinism.deriveRandom / sim 时钟 /
 * deferredTimers / 引擎钉帧 dt),或有意豁免时 `--update-ledger` 入账并在
 * design doc §3.1 登记归类(喂不喂 hash / 为什么不需要收编)。
 *
 * 台账键 = 相对路径 + token + 规整后行内容(行号无关,挪代码不误报)。
 * 用法:node scripts/check-wallclock-usage.mjs [--update-ledger]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER_PATH = join(ROOT, 'scripts', 'wallclock-ledger.json');
const SCAN_DIRS = ['src/systems', 'src/managers', 'src/entities', 'src/gameplay', 'src/services'];
const TOKEN = /\b(performance\.now|Date\.now|setTimeout|setInterval)\s*\(/g;
const INLINE_OK = 'rr-wallclock-ledgered:';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(ts|js|mjs)$/.test(name) && !name.endsWith('.d.ts')) yield full;
  }
}

function scan() {
  const hits = [];
  for (const rel of SCAN_DIRS) {
    const dir = join(ROOT, rel);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (line.includes(INLINE_OK) || (i > 0 && lines[i - 1].includes(INLINE_OK))) return;
        for (const m of line.matchAll(TOKEN)) {
          hits.push({
            key: `${relative(ROOT, file)}::${m[1]}::${trimmed.replace(/\s+/g, ' ').slice(0, 120)}`,
            file: relative(ROOT, file),
            line: i + 1,
            token: m[1],
          });
        }
      });
    }
  }
  return hits;
}

const hits = scan();
const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { schemaVersion: 1, note: '现存墙钟命中台账;新增命中必须收编或显式入账(见文件头注释)', entries: {} };

if (process.argv.includes('--update-ledger')) {
  const entries = {};
  for (const h of hits) entries[h.key] = ledger.entries[h.key] ?? 'TODO: 在 design doc §3.1 归类(喂不喂 hash/处置)';
  writeFileSync(LEDGER_PATH, JSON.stringify({ ...ledger, entries }, null, 2) + '\n');
  console.log(`[check-wallclock] 台账已更新:${hits.length} 条(新入账的条目请补理由并在 design doc §3.1 登记)`);
  process.exit(0);
}

const fresh = hits.filter((h) => !(h.key in ledger.entries));
const stale = Object.keys(ledger.entries).filter((k) => !hits.some((h) => h.key === k));
if (stale.length) console.log(`[check-wallclock] 提示:${stale.length} 条台账已无对应代码(可 --update-ledger 清理)`);
if (fresh.length) {
  console.error(`[check-wallclock] FAIL:发现 ${fresh.length} 处未入账的墙钟/裸定时器 —— 这是 Mode A 非确定源最大惯犯族:`);
  for (const h of fresh) console.error(`  ${h.file}:${h.line}  ${h.token}`);
  console.error('收编它(deriveRandom / sim 时钟 / deferredTimers / 引擎钉帧 dt;修法见 harness docs/06 §3),');
  console.error('或确属豁免:--update-ledger 入账 + design doc §3.1 登记归类。');
  process.exit(1);
}
console.log(`[check-wallclock] OK:${hits.length} 处命中全部在台账内(台账 ${Object.keys(ledger.entries).length} 条)`);
