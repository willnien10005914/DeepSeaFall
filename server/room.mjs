import { randomBytes, randomUUID } from "node:crypto";

export const COLORS = [
  "#b4d88e",
  "#e6a2c5",
  "#91c9ef",
  "#e3b979",
  "#b8a1e5",
  "#83d6c6",
  "#ef9c9c",
  "#d6d89b",
];
export const GODDESSES = [
  "Athena 雅典娜",
  "Artemis 阿耳忒彌斯",
  "Aphrodite 阿芙蘿黛蒂",
  "Selene 塞勒涅",
  "Amaterasu 天照",
  "Freyja 芙蕾雅",
  "Isis 伊西斯",
  "Mazu 媽祖",
  "Brigid 布里姬德",
  "Saraswati 辯才天女",
  "Hathor 哈索爾",
  "Hestia 赫斯提亞",
];
const clean = (s) =>
  Array.from(
    String(s ?? "")
      .normalize("NFKC")
      .replace(/[\p{C}<>]/gu, "")
      .trim(),
  )
    .slice(0, 24)
    .join("");
const key = (s) => s.toLocaleLowerCase();
export class DiveRoom {
  constructor({
    maxPlayers = 8,
    now = () => Date.now(),
    broadcast = () => {},
  } = {}) {
    this.maxPlayers = maxPlayers;
    this.now = now;
    this.broadcast = broadcast;
    this.players = new Map();
    this.reservations = new Map();
    this.commands = [];
    this.history = [];
    this.notices = [];
    this.serial = 0;
    this.snapshot = null;
    this.generation = randomUUID();
    this.seed = randomBytes(4).readUInt32LE();
  }
  roster() {
    return [...this.players.values()].map(({ id, name, color }) => ({
      id,
      name,
      color,
    }));
  }
  available() {
    const used = new Set(
      [...this.players.values(), ...this.reservations.values()].map((p) =>
        key(p.name),
      ),
    );
    return GODDESSES.filter((n) => !used.has(key(n)));
  }
  join(socket, { name = "", resumeToken = "" } = {}) {
    this.prune();
    if (this.players.size >= this.maxPlayers)
      throw Error("海域目前已滿，請稍後再加入。");
    let p = this.reservations.get(resumeToken);
    if (p) this.reservations.delete(resumeToken);
    else {
      name = clean(name) || this.available()[0] || `女神 ${++this.serial}`;
      if (
        [...this.players.values(), ...this.reservations.values()].some(
          (p) => key(p.name) === key(name),
        )
      )
        throw Error("這個名字正在潛水，請換一個名字。");
      const used = new Set([...this.players.values()].map((p) => p.color));
      p = {
        id: randomUUID(),
        name,
        color: COLORS.find((c) => !used.has(c)),
        token: randomBytes(24).toString("base64url"),
      };
    }
    if ([...this.players.values()].some((x) => x.color === p.color)) {
      const used = new Set([...this.players.values()].map((x) => x.color));
      p.color = COLORS.find((c) => !used.has(c));
    }
    p.socket = socket;
    p.lastSeq = -1;
    p.lastChat = 0;
    p.lastInput = 0;
    p.lastAction = 0;
    p.alive = true;
    p.joinedAt = this.now();
    this.players.set(p.id, p);
    this.notice(`${p.name} 加入了這片海。`, "join", p);
    return p;
  }
  leave(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    p.socket = null;
    if (!this.players.size) {
      // An empty sea ends the run immediately. A stale resume token must not
      // reserve a name or bring an abandoned/dead run into the next dive.
      this.reservations.clear();
      this.commands = [];
      this.history = [];
      this.notices = [];
      this.snapshot = null;
      this.generation = randomUUID();
      return;
    }
    p.expires = this.now() + 30000;
    this.reservations.set(p.token, p);
    const lines = [
      "已離線，海裡的夥伴會等妳回來。",
      "暫時游離了連線，大家先一起前進。",
      "與海域失去連線，期待再次相遇。",
    ];
    this.notice(`${p.name} ${lines[this.serial++ % lines.length]}`, "leave", p);
  }
  prune() {
    for (const [token, p] of this.reservations)
      if (p.expires <= this.now()) this.reservations.delete(token);
  }
  notice(text, event, p) {
    const item = {
      type: "notice",
      id: ++this.serial,
      event,
      text,
      playerId: p?.id,
      roster: this.roster(),
    };
    this.notices.push(item);
    if (this.notices.length > 12) this.notices.shift();
    this.broadcast(item);
  }
  receive(p, m) {
    if (!this.players.has(p.id) || !m || typeof m !== "object") return;
    const now = this.now();
    if (m.type === "input") {
      if (
        !Number.isSafeInteger(m.seq) ||
        m.seq <= p.lastSeq ||
        now - p.lastInput < 40
      )
        return;
      const x = Number(m.x),
        y = Number(m.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      p.lastSeq = m.seq;
      p.lastInput = now;
      this.commands.push({
        type: "input",
        id: p.id,
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
        aspect: Math.max(0.4, Math.min(2, Number(m.aspect) || 0.5)),
      });
    } else if (
      m.type === "action" &&
      [
        "sleep",
        "whale",
        "attack",
        "boost",
        "magic",
        "revive",
        "restart",
      ].includes(m.action)
    ) {
      if (now - p.lastAction < 220) return;
      p.lastAction = now;
      this.commands.push({
        type: "action",
        id: p.id,
        action: m.action,
        move: typeof m.move === "string" ? m.move.slice(0, 40) : "auto",
      });
    } else if (m.type === "chat") {
      if (now - p.lastChat < 800) return;
      const text = Array.from(
        String(m.text ?? "")
          .normalize("NFC")
          .replace(/[\p{C}]/gu, " ")
          .trim(),
      )
        .slice(0, 180)
        .join("");
      if (!text) return;
      p.lastChat = now;
      const item = {
        type: "chat",
        id: ++this.serial,
        playerId: p.id,
        name: p.name,
        color: p.color,
        text,
        at: now,
      };
      this.history.push(item);
      if (this.history.length > 40) this.history.shift();
      this.broadcast(item);
    }
  }
  takeCommands() {
    const commands = this.commands;
    this.commands = [];
    return commands;
  }
  authenticate(token) {
    return [...this.players.values()].find((p) => p.token === token);
  }
}
