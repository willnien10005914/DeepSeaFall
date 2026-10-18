import { SeaReplica } from "./replica.js?v=48";
export async function bootstrap() {
  if (window.__MP_SIMULATION) return null;
  try {
    const r = await fetch("/api/room", { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    const data = await r.json();
    return data.multiplayer ? data : null;
  } catch {
    return null;
  }
}
export class MultiplayerClient {
  constructor(game, info) {
    this.g = game;
    this.info = info;
    this.seq = 0;
    this.connected = false;
    this.joined = false;
    this.retry = 0;
    this.chatOpen = true;
    this.buildUI();
    this.bind();
  }
  buildUI() {
    const area = document.createElement("div");
    area.className = "mp-name-entry";
    const label = document.createElement("label");
    label.textContent = "少女名字";
    this.name = document.createElement("input");
    this.name.id = "playerName";
    this.name.maxLength = 24;
    this.name.autocomplete = "nickname";
    this.name.setAttribute("list", "goddessNames");
    this.name.value = this.info.names[0] || "Athena 雅典娜";
    const names = document.createElement("datalist");
    names.id = "goddessNames";
    for (const n of this.info.names) {
      const o = document.createElement("option");
      o.value = n;
      names.append(o);
    }
    label.append(this.name);
    this.status = document.createElement("p");
    this.status.id = "mpStatus";
    this.status.textContent = `${this.info.roster.length} 位少女在線 · 共用體力與招式`;
    area.append(label, names, this.status);
    document.querySelector("#titleScreen .title-actions").before(area);
    document.querySelector("#btnStartManual").textContent = "加入同一片海";
    document.querySelector("#btnStartAI").hidden = true;
    document.querySelector("#btnDemo").hidden = true;
    this.notice = document.createElement("div");
    this.notice.className = "mp-notice";
    this.notice.setAttribute("role", "status");
    document.querySelector("#app").append(this.notice);
    this.panel = document.createElement("section");
    this.panel.className = "mp-chat hidden";
    this.panel.setAttribute("aria-label", "海裡聊天");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mp-chat-toggle";
    toggle.textContent = "海裡聊天";
    this.online = document.createElement("span");
    toggle.append(this.online);
    this.contents = document.createElement("div");
    this.contents.className = "mp-chat-contents";
    this.messages = document.createElement("div");
    this.messages.className = "mp-messages";
    this.messages.setAttribute("role", "log");
    this.messages.setAttribute("aria-live", "polite");
    const form = document.createElement("form");
    form.className = "mp-chat-form";
    this.input = document.createElement("input");
    this.input.placeholder = "跟海裡的夥伴說話…";
    this.input.maxLength = 180;
    this.input.setAttribute("aria-label", "聊天訊息");
    this.mic = document.createElement("button");
    this.mic.type = "button";
    this.mic.className = "mp-mic";
    this.mic.textContent = "🎙";
    this.mic.setAttribute("aria-label", "點一下錄音，再點停止轉文字");
    const send = document.createElement("button");
    send.type = "submit";
    send.textContent = "送出";
    form.append(this.input, this.mic, send);
    this.speechStatus = document.createElement("p");
    this.speechStatus.className = "mp-speech-status";
    this.scores = document.createElement("details");
    this.scores.className = "mp-scoreboard";
    const heading = document.createElement("summary");
    heading.textContent = "本局尋寶排行";
    this.scoreRows = document.createElement("div");
    this.scores.append(heading, this.scoreRows);
    this.contents.append(this.scores, this.messages, form, this.speechStatus);
    this.panel.append(toggle, this.contents);
    document.querySelector("#app").append(this.panel);
    toggle.onclick = () => {
      this.chatOpen = !this.chatOpen;
      this.contents.hidden = !this.chatOpen;
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (
        this.input.value.trim() &&
        this.send({ type: "chat", text: this.input.value })
      ) {
        this.input.value = "";
      }
    };
    this.mic.onclick = () => this.record();
    document.querySelector("#btnMode").hidden = true;
  }
  bind() {
    const g = this.g;
    g._tapToSwim = (p) => this.move(p);
    g.tapSwim.retarget = (x, y) => this.move({ x, y });
    for (const [method, action] of Object.entries({
      toggleSleep: "sleep",
      summonWhale: "whale",
      attack: "attack",
      triggerBoost: "boost",
      placeMagic: "magic",
      revive: "revive",
    }))
      g[method] = () =>
        this.send({
          type: "action",
          action,
          move: document.querySelector("#attackStyle").value,
        });
    g.cycleMode = () => g.ui.toast("多人海域 · 每人操作自己的少女");
    window.addEventListener("pagehide", () => {
      this.leaving = true;
      this.ws?.close();
      this.stopRecording();
    });
  }
  move(p) {
    const now = performance.now();
    this.pendingMove = p;
    if (now - (this.lastMove || 0) < 60) {
      if (!this.moveTimer)
        this.moveTimer = setTimeout(() => {
          this.moveTimer = null;
          this.move(this.pendingMove);
        }, 65);
      return;
    }
    this.lastMove = now;
    this.send({
      type: "input",
      seq: ++this.seq,
      x: p.x,
      y: p.y,
      aspect: this.g.camera.aspect,
    });
  }
  send(m) {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.connected) return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }
  async join() {
    if (this.joined) {
      this.send({ type: "action", action: "restart" });
      return;
    }
    if (this.joining) return;
    this.joining = true;
    this.status.textContent = "正在加入共用海域…";
    try {
      await this.g.start("manual");
      this.g.running = true;
      this.g._update = () => {};
      this.connect();
    } catch (e) {
      this.status.textContent = e.message;
      this.joining = false;
    }
  }
  connect() {
    this.ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
    );
    this.ws.onopen = () =>
      this.ws.send(
        JSON.stringify({
          type: "join",
          name: this.name.value,
          resumeToken: sessionStorage.getItem("diveResumeToken") || "",
        }),
      );
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "welcome") {
        this.lastNoticeId ??= m.notices?.at(-1)?.id || 0;
        for (const n of m.notices || []) this.showNotice(n);
        this.connected = true;
        this.joined = true;
        this.joining = false;
        this.retry = 0;
        this.id = m.id;
        this.token = m.token;
        sessionStorage.setItem("diveResumeToken", m.token);
        if (!this.replica)
          this.replica = new SeaReplica(this.g, m.id, (players, scoreboard) =>
            this.updateRoster(players, scoreboard),
          );
        else {
          const old = this.replica.id;
          if (old !== m.id) {
            this.replica.latest = null;
            this.replica.eventId = null;
            this.lastState = null;
            const own = this.replica.avatars.get(old),
              label = this.replica.labels.get(old);
            if (own) {
              this.replica.avatars.delete(old);
              this.replica.avatars.set(m.id, own);
            }
            if (label) {
              this.replica.labels.delete(old);
              this.replica.labels.set(m.id, label);
            }
          }
          this.replica.id = m.id;
        }
        this.panel.classList.remove("hidden");
        this.g.ui.showGame();
        this.updateRoster(m.roster);
        for (const h of m.history) this.showChat(h);
        this.announce(
          m.ready ? "已連上同一片海。" : "Spark 正在準備海域，請稍候…",
        );
      }
      if (m.type === "snapshot") {
        for (const n of m.state.notices || []) this.showNotice(n);
        this.replica?.receive(m.state);
        this.lastState = m.state;
      }
      if (m.type === "chat") this.showChat(m);
      if (m.type === "notice") {
        this.showNotice(m);
        this.updateRoster(m.roster);
      }
      if (m.type === "error") {
        this.status.textContent = m.message;
        this.g.ui.toast(m.message);
        if (!this.joined) {
          this.joining = false;
          document.querySelector("#titleScreen").classList.remove("hidden");
          this.g.running = false;
          this.ws.close();
        }
      }
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.stopRecording();
      if (this.joined && !this.leaving) {
        this.announce("連線暫時中斷，正在回到海裡…");
        setTimeout(
          () => this.connect(),
          Math.min(8000, 750 * 2 ** this.retry++),
        );
      }
    };
    this.ws.onerror = () => {};
  }
  showNotice(m) {
    if (!this.joined || m.id <= (this.lastNoticeId || 0)) return;
    this.lastNoticeId = m.id;
    this.announce(m.text, m.event === "leave");
  }
  updateRoster(players, scoreboard) {
    if (scoreboard && this.scoreRows) {
      this.scoreRows.replaceChildren();
      for (const p of [...scoreboard].sort((a, b) => b.points - a.points)) {
        const row = document.createElement("p"),
          name = document.createElement("span"),
          score = document.createElement("strong");
        name.textContent = p.name + (p.online ? "" : " · 離線");
        name.style.color = p.color;
        score.textContent = `◆${p.treasures} · ${p.points} 分`;
        row.append(name, score);
        this.scoreRows.append(row);
      }
    }
    this.online.textContent = ` · ${players.length} 人`;
    this.status.textContent = `${players.length} 位少女在線 · 共用體力與招式`;
  }
  announce(text, priority = false) {
    this.noticeQueue ??= [];
    const showing = this.notice.classList.contains("show");
    if (
      !priority &&
      text === "已連上同一片海。" &&
      (showing || this.noticeQueue.length)
    )
      return;
    const item = { text, priority };
    if (priority) {
      if (showing && !this.noticePriority) {
        clearTimeout(this.noticeTimer);
        this.notice.classList.remove("show");
      }
      const at = this.noticeQueue.findIndex((n) => !n.priority);
      this.noticeQueue.splice(at < 0 ? this.noticeQueue.length : at, 0, item);
    } else this.noticeQueue.push(item);
    if (this.noticeQueue.length > 8) this.noticeQueue.length = 8;
    if (!this.notice.classList.contains("show")) this.nextNotice();
  }
  nextNotice() {
    const item = this.noticeQueue.shift();
    if (!item) return;
    this.noticePriority = item.priority;
    this.notice.textContent = item.text;
    this.notice.classList.add("show");
    this.noticeTimer = setTimeout(() => {
      this.notice.classList.remove("show");
      this.noticePriority = false;
      this.nextNotice();
    }, 3500);
  }

  showChat(m) {
    if (this.seen?.has(m.id)) return;
    (this.seen ??= new Set()).add(m.id);
    if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value);
    const line = document.createElement("p"),
      who = document.createElement("strong"),
      text = document.createElement("span");
    who.textContent = m.name + "：";
    who.style.color = m.color;
    text.textContent = m.text;
    line.append(who, text);
    this.messages.append(line);
    while (this.messages.children.length > 40)
      this.messages.firstChild.remove();
    this.messages.scrollTop = this.messages.scrollHeight;
    this.replica?.chat(m);
  }
  stopRecording() {
    clearTimeout(this.recordTimer);
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
  async record() {
    if (this.recorder?.state === "recording") {
      this.stopRecording();
      return;
    }
    if (!this.connected) return this.announce("請先連上海域。");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      return this.announce("此瀏覽器無法錄音，請用文字聊天。");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(
        this.stream,
        preferred ? { mimeType: preferred } : {},
      );
      const chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      this.recorder.onstop = async () => {
        this.stream.getTracks().forEach((t) => t.stop());
        this.mic.textContent = "🎙";
        this.mic.disabled = true;
        this.speechStatus.textContent = "Spark 正在轉成文字…";
        try {
          const r = await fetch("/api/transcribe", {
              method: "POST",
              headers: {
                "Content-Type": this.recorder.mimeType,
                "X-Dive-Session": this.token,
              },
              body: new Blob(chunks, { type: this.recorder.mimeType }),
              signal: AbortSignal.timeout(65000),
            }),
            data = await r.json();
          if (!r.ok) throw Error(data.error || "轉錄失敗");
          this.input.value = data.text.slice(0, 180);
          this.speechStatus.textContent = data.text
            ? "已轉成文字，確認後按送出。"
            : "沒有聽清楚，請再試一次。";
          this.input.focus();
        } catch (e) {
          this.speechStatus.textContent = e.message;
        } finally {
          this.mic.disabled = false;
        }
      };
      this.recorder.start();
      this.mic.textContent = "■";
      this.speechStatus.textContent = "錄音中 · 再點一次停止（最多 12 秒）";
      this.recordTimer = setTimeout(() => this.stopRecording(), 12000);
    } catch {
      this.speechStatus.textContent = "麥克風未開啟；可以繼續用文字聊天。";
      this.stream?.getTracks().forEach((t) => t.stop());
    }
  }
}
