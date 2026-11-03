// RIVALS 멀티플레이 서버 (HTTP 정적 파일 + WebSocket 릴레이)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "public", "index.html");
const MAX_PLAYERS = 32;
const TICK_MS = 50; // 초당 20회 상태 전송

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  if (url === "/" || url === "/index.html") {
    fs.readFile(INDEX, (err, buf) => {
      if (err) { res.writeHead(500); return res.end("index.html not found"); }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(buf);
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });
const clients = new Map(); // id -> { ws, presence, alive, evCount }
let nextId = 1;
let dirty = false;

const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
function cleanPresence(p) {
  if (!p || typeof p !== "object") return {};
  const o = {};
  if (p.n !== undefined) o.n = String(p.n).slice(0, 12);
  if (p.c !== undefined) o.c = /^#[0-9a-fA-F]{6}$/.test(p.c) ? p.c : "#ff8a3d";
  if (p.m !== undefined) o.m = p.m === "pvp" ? "pvp" : "pve";
  if (p.x !== undefined) {
    o.x = num(p.x, -200, 200); o.y = num(p.y, -50, 100); o.z = num(p.z, -200, 200);
    o.yw = num(p.yw, -100, 100);
    o.hp = num(p.hp, 0, 100);
    o.cr = num(p.cr, 0, 5);
    o.k = Math.floor(num(p.k, 0, 99999)); o.d = Math.floor(num(p.d, 0, 99999));
  }
  return o;
}

wss.on("connection", (ws) => {
  if (clients.size >= MAX_PLAYERS) { ws.close(1013, "full"); return; }
  const id = "p" + nextId++;
  const c = { ws, presence: {}, alive: true, evCount: 0 };
  clients.set(id, c);
  ws.send(JSON.stringify({ t: "hello", id }));
  dirty = true;

  ws.on("pong", () => { c.alive = true; });
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.t === "p") {
      c.presence = cleanPresence(m.p);
      dirty = true;
    } else if (m.t === "e") {
      if (++c.evCount > 60) return; // 초당 60개 제한
      if (m.n !== "hit" && m.n !== "kill" && m.n !== "ut") return;
      const d = m.d && typeof m.d === "object" ? m.d : {};
      if (m.n === "ut") {
        // 궁극기: 나를 제외한 모두에게 전달 (같은 모드 필터는 클라이언트가 처리)
        const data = { t: d.t, x: num(d.x, -200, 200), y: num(d.y, -50, 100), z: num(d.z, -200, 200), m: d.m === "pvp" ? "pvp" : "pve" };
        if (typeof data.t !== "number" && typeof data.t !== "string") return;
        const msg = JSON.stringify({ t: "e", n: "ut", d: data, from: id });
        for (const [cid, oc] of clients) if (cid !== id && oc.ws.readyState === 1) oc.ws.send(msg);
        return;
      }
      const target = m.n === "hit" ? d.to : d.k;
      const t = clients.get(target);
      if (!t || t.ws.readyState !== 1) return;
      let data;
      if (m.n === "hit") {
        data = { to: target, d: num(d.d, 0, 100) };
        if (d.fx === "dot" || d.fx === "stun") data.fx = d.fx;
      } else data = { k: target };
      t.ws.send(JSON.stringify({ t: "e", n: m.n, d: data, from: id }));
    }
  });
  ws.on("close", () => { clients.delete(id); dirty = true; });
  ws.on("error", () => {});
});

// 상태 브로드캐스트
setInterval(() => {
  for (const c of clients.values()) c.evCount = 0;
  if (!dirty) return;
  dirty = false;
  const peers = {};
  for (const [id, c] of clients) peers[id] = c.presence;
  const msg = JSON.stringify({ t: "s", peers });
  for (const c of clients.values()) if (c.ws.readyState === 1) c.ws.send(msg);
}, TICK_MS);

// 끊어진 연결 정리 + Render 프록시 유휴 연결 유지
setInterval(() => {
  for (const [id, c] of clients) {
    if (!c.alive) { c.ws.terminate(); clients.delete(id); dirty = true; continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 25000);

server.listen(PORT, "0.0.0.0", () => console.log("RIVALS server on :" + PORT));
