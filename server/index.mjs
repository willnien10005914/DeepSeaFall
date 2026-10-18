import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { WebSocketServer, WebSocket } from "ws";
import { DiveRoom } from "./room.mjs";
import { Simulation } from "./simulation.mjs";
import { RenderStream, cloudSnapshot } from "./render-stream.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  PORT = Number(process.env.PORT || 8765),
  HOST = process.env.HOST || "0.0.0.0",
  GPU = process.env.GPU_URL || "http://127.0.0.1:8877";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".bin": "application/octet-stream",
  ".woff2": "font/woff2",
};
const sockets = new Set();
let ready = false,
  stopping = false,
  lastStepMs = 0,
  lastError = null,
  gpuHealth = null;
const send = (ws, data) => {
  if (ws.readyState === WebSocket.OPEN) {
    if (data.type === "snapshot" && ws.bufferedAmount > 128 * 1024) return;
    if (ws.bufferedAmount > 4 * 1024 * 1024) {
      ws.close(1013, "Connection too slow");
      return;
    }
    if (data.type === "snapshot" && ws.render === "cloud")
      data = {type:"snapshot", state:cloudSnapshot(data.state, cloud.screen)};
    ws.send(
      JSON.stringify(data, (_k, v) =>
        typeof v === "number" && !Number.isInteger(v)
          ? Math.round(v * 10000) / 10000
          : v,
      ),
    );
  }
};
const broadcast = (data) => {
  for (const ws of sockets) if (ws.player) send(ws, data);
};
const room = new DiveRoom({ broadcast });
const cloud = new RenderStream({room, url:`http://127.0.0.1:${PORT}/`, seed:room.seed});
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    const h = new URL(req.headers.origin).host;
    return h === req.headers.host || h === req.headers["x-forwarded-host"];
  } catch {
    return false;
  }
}
async function body(req, max) {
  const chunks = [];
  let size = 0;
  for await (const b of req) {
    size += b.length;
    if (size > max) throw Error("錄音太長");
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/room" && req.method === "GET")
      return json(res, 200, {
        multiplayer: true,
        protocol: 2,
        ready,
        seed: room.seed,
        generation: room.generation,
        roster: room.roster(),
        names: room.available(),
        maxPlayers: room.maxPlayers,
        shared: ["depth", "stamina", "attack", "whale"],
        gpu: gpuHealth,
        streaming: cloud.health(),
      });
    if (url.pathname === "/api/health" && req.method === "GET")
      return json(res, 200, {
        ready,
        players: room.players.size,
        depth: room.snapshot?.depth || 0,
        gpu: gpuHealth,
        streaming: cloud.health(),
        gpuBatches: sim.gpuBatches,
        lastStepMs: Math.round(lastStepMs),
        error: lastError,
      });
    if (url.pathname === "/api/transcribe" && req.method === "POST") {
      if (!sameOrigin(req))
        return json(res, 403, { error: "無法使用這個來源。" });
      const p = room.authenticate(req.headers["x-dive-session"]);
      if (!p) return json(res, 401, { error: "請先加入海域。" });
      if (Date.now() - (p.lastSpeech || 0) < 5000)
        return json(res, 429, { error: "請稍候再錄音。" });
      p.lastSpeech = Date.now();
      const audio = await body(req, 4 * 1024 * 1024);
      const r = await fetch(GPU + "/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: audio,
        signal: AbortSignal.timeout(60000),
      });
      const data = await r.json();
      return json(
        res,
        r.status,
        r.ok ? data : { error: data.detail || "語音轉錄暫時無法使用。" },
      );
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      return json(res, 405, { error: "Method not allowed" });
    const decoded = decodeURIComponent(url.pathname),
      relative = decoded === "/" ? "index.html" : decoded.slice(1);
    if (
      relative.split("/").some((p) => p.startsWith(".") || p === "..") ||
      !/^(?:index\.html|cinematic\.html|model-review\.html|2d\.html|js\/|css\/|vendor\/|assets\/)/.test(
        relative,
      )
    )
      return json(res, 404, { error: "Not found" });
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep))
      return json(res, 403, { error: "Not found" });
    const info = await stat(file);
    if (!info.isFile()) return json(res, 404, { error: "Not found" });
    const headers = {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": /\.(html|js|json|css)$/.test(file)
        ? "no-cache"
        : "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };
    let start = 0,
      end = info.size - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match) return json(res, 416, { error: "Invalid range" });
      start = match[1]
        ? Number(match[1])
        : Math.max(0, info.size - Number(match[2]));
      end = match[1] ? (match[2] ? Math.min(Number(match[2]), end) : end) : end;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
        return res.end();
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === "HEAD") res.end();
    else
      createReadStream(file, { start, end })
        .on("error", () => res.destroy())
        .pipe(res);
  } catch (e) {
    if (!res.headersSent)
      json(res, e.code === "ENOENT" ? 404 : 400, {
        error: e.code === "ENOENT" ? "Not found" : "Request failed",
      });
    else res.destroy();
  }
});
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 4096,
  perMessageDeflate: false,
});
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream" && sameOrigin(req)) {
    videoWss.handleUpgrade(req, socket, head, (ws) => videoWss.emit("connection", ws, req));
    return;
  }
  if (req.url !== "/ws" || !sameOrigin(req)) {
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});
const videoWss = new WebSocketServer({noServer:true, maxPayload:4096, perMessageDeflate:false});
videoWss.on("connection", ws => {
  if(videoWss.clients.size>16){ws.close(1013,"Too many video connections");return;}
  const timer=setTimeout(()=>{if(!cloud.viewers.has(ws))ws.close(1008,"Subscribe required");},20000);
  ws.on("message",raw=>{
    try {
      const m=JSON.parse(raw);
      if(m.type!=="subscribe" || cloud.viewers.has(ws))return;
      cloud.subscribe(ws,m);clearTimeout(timer);
    }catch{ws.close(1008,"Invalid video request");}
  });
  ws.on("close",()=>clearTimeout(timer));ws.on("error",()=>{});
});
wss.on("connection", (ws) => {
  if (sockets.size >= 24) {
    ws.close(1013, "Too many connections");
    return;
  }
  sockets.add(ws);
  ws.alive = true;
  ws.lastPong = Date.now();
  const joinTimer = setTimeout(() => {
    if (!ws.player) ws.close(1008, "Join required");
  }, 20000);
  ws.on("pong", () => {
    ws.alive = true;
    ws.lastPong = Date.now();
  });
  ws.on("message", (raw) => {
    try {
      const m = JSON.parse(raw);
      if (!ws.player) {
        if (m.type !== "join") return;
        try {
          ws.player = room.join(ws, m);
          ws.render = m.render === "cloud" ? "cloud" : "local";
          send(ws, {
            type: "welcome",
            id: ws.player.id,
            token: ws.player.token,
            generation: room.generation,
            roster: room.roster(),
            history: room.history,
            notices: room.notices,
            ready,
          });
          if (room.snapshot)
            send(ws, { type: "snapshot", state: room.snapshot });
          clearTimeout(joinTimer);
        } catch (e) {
          send(ws, { type: "error", message: e.message });
        }
        return;
      }
      if ((ws.windowAt || 0) + 1000 < Date.now()) {
        ws.windowAt = Date.now();
        ws.count = 0;
      }
      if (++ws.count > 60) {
        ws.close(1008, "Rate limit");
        return;
      }
      room.receive(ws.player, m);
    } catch {
      ws.close(1008, "Invalid message");
    }
  });
  ws.on("close", (code, reason) => {
    if (ws.player)
      console.log(
        "Player disconnected",
        ws.player.name,
        code,
        reason.toString(),
      );
    clearTimeout(joinTimer);
    sockets.delete(ws);
    if (ws.player) {cloud.remove(ws.player.id);room.leave(ws.player.id);}
  });
  ws.on("error", () => {});
});
const heartbeat = setInterval(() => {
  room.prune();
  for (const ws of sockets) {
    if (Date.now() - ws.lastPong > 45000) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 15000);
const sim = new Simulation({
  url: `http://127.0.0.1:${PORT}/`,
  seed: room.seed,
  gpuUrl: GPU,
});
async function tick() {
  if (stopping) return;
  const begin = performance.now();
  try {
    if (room.players.size) {
      const generation = room.generation;
      const state = await sim.step(
        room.roster(), room.takeCommands(), 1 / 20, generation,
      );
      // A close/join can happen while Chromium is stepping. Never publish the
      // previous run into the room after its final player has disconnected.
      if (state && room.players.size && generation === room.generation) {
        state.notices = room.notices;
        room.snapshot = state;
        if (state.tick % 2 === 0) {cloud.push(state);broadcast({ type: "snapshot", state });}
      }
      lastError = null;
    }
  } catch (e) {
    lastError = "Simulation step failed";
    console.error("Simulation step:", e.stack);
  }
  lastStepMs = performance.now() - begin;
  setTimeout(tick, Math.max(0, 50 - lastStepMs));
}
server.listen(PORT, HOST, async () => {
  console.log(`Deep Sea Fall multiplayer http://${HOST}:${PORT}`);
  try {
    for (let n = 0; n < 90; n++) {
      try {
        const r = await fetch(GPU + "/health", {
          signal: AbortSignal.timeout(1000),
        });
        if (r.ok) {
          gpuHealth = await r.json();
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!gpuHealth) throw Error("Spark GPU worker is unavailable");
    await sim.start();
    ready = true;
    console.log("Authoritative sea ready; Spark CUDA actor and ASR connected.");
    tick();
    cloud.start(sim.browser).then(()=>console.log("Spark cloud renderer ready:",cloud.renderer)).catch(e=>{
      cloud.error=e.message;console.error("Cloud rendering start:",e);
    });
  } catch (e) {
    lastError = e.message;
    console.error(e);
  }
});
async function close() {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat);
  for (const ws of sockets) ws.close(1001, "Server restarting");
  await cloud.close();
  await sim.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
