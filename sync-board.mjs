// 把 ntfy 实时主题里的成绩合并进 board.json（永久归档）
// 由 .github/workflows/board.yml 定时执行
import fs from 'node:fs';

const TOPIC = 'cute-rush-lb-4k9x2m';
const MAX = 60;
const FILE = 'board.json';

function norm(e) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id || '').slice(0, 32);
  const s = Number(e.s);
  if (!id || !isFinite(s) || s < 0 || s > 1e8) return null;
  const a = typeof e.a === 'string' && e.a.indexOf('data:image/') === 0 ? e.a : '';
  return {
    id,
    n: String(e.n || '无名跑者').slice(0, 10),
    s: Math.round(s),
    d: Math.round(Number(e.d) || 0),
    a,
    t: Number(e.t) || 0,
  };
}

let board = { updated: 0, entries: [] };
try {
  board = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.log('board.json 读取失败，按空榜处理');
}

const map = new Map();
for (const e of board.entries || []) {
  const n = norm(e);
  if (n) map.set(n.id, n);
}
const before = map.size;

try {
  const r = await fetch(`https://ntfy.sh/${TOPIC}/json?poll=1&since=all`, {
    headers: { 'user-agent': 'cute-rush-archive' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const txt = await r.text();
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (!j || j.event !== 'message' || !j.message) continue;
      const e = norm(JSON.parse(j.message));
      if (!e) continue;
      const cur = map.get(e.id);
      if (!cur || e.s > cur.s || (e.s === cur.s && !cur.a && e.a)) map.set(e.id, e);
    } catch (err) {}
  }
} catch (e) {
  console.log('拉取实时主题失败：' + e.message);
}

const entries = [...map.values()].sort((a, b) => b.s - a.s).slice(0, MAX);
fs.writeFileSync(FILE, JSON.stringify({ updated: Date.now(), entries }));
console.log(`entries=${entries.length} (was ${before})`);
