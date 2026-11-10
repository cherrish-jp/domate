// DoMate 画面と操作
(function () {
  const S = window.DomateStore;
  const app = document.getElementById("app");
  let me = null;               // 自分のプロフィール
  let blocked = new Set();     // ブロック中のユーザーID
  let pollTimer = null;        // チャットの自動更新
  const cache = new Map();     // 表示中の投稿
  const state = { feedKind: "" };

  /* ---------------- 小さな道具 ---------------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COLORS = ["#ff3b1f", "#1f3bff", "#00a35c", "#ff9f0a", "#000000", "#ff4fa0", "#7a3cff"];
  function avatar(user, sm) {
    const name = (user && user.display_name) || "?";
    let h = 0; for (const ch of (user && user.id) || name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `<div class="avatar${sm ? " sm" : ""}" style="background:${COLORS[h % COLORS.length]}">${esc([...name][0])}</div>`;
  }
  function ago(t) {
    const s = (Date.now() - new Date(t)) / 1000;
    if (s < 60) return "たった今";
    if (s < 3600) return Math.floor(s / 60) + "分前";
    if (s < 86400) return Math.floor(s / 3600) + "時間前";
    if (s < 86400 * 7) return Math.floor(s / 86400) + "日前";
    const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function fmtDate(t) {
    const d = new Date(t), p = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()}(${"日月火水木金土"[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function toast(msg) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  function sheet(html, handlers = {}) {
    const ov = document.createElement("div"); ov.className = "overlay";
    ov.innerHTML = `<div class="sheet">${html}</div>`;
    const close = () => ov.remove();
    ov.addEventListener("click", async (e) => {
      if (e.target === ov) return close();
      const a = e.target.closest("[data-act]");
      if (a && handlers[a.dataset.act]) { e.preventDefault(); await guard(() => handlers[a.dataset.act](a, close)); }
    });
    ov.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target; if (handlers[f.dataset.form]) await guard(() => handlers[f.dataset.form](f, close));
    });
    document.body.appendChild(ov); return { el: ov, close };
  }
  async function guard(fn) {
    try { return await fn(); } catch (e) { console.error(e); toast(e.message || "エラーが発生しました"); }
  }
  function setView(html, handlers = {}) {
    app.innerHTML = html;
    app.onclick = async (e) => {
      const a = e.target.closest("[data-act]");
      if (a && handlers[a.dataset.act]) { e.preventDefault(); e.stopPropagation(); await guard(() => handlers[a.dataset.act](a, e)); return; }
      const g = e.target.closest("[data-go]");
      if (g) location.hash = g.dataset.go;
    };
    app.onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, h = handlers[f.dataset.form];
      if (!h) return;
      const btn = f.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      await guard(() => h(f));
      if (btn && document.body.contains(btn)) btn.disabled = false;
    };
  }
  function resizeImage(file, max) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob((b) => (b ? res(b) : rej(new Error("画像を読み込めませんでした"))), "image/jpeg", 0.82);
      };
      img.onerror = () => rej(new Error("画像を読み込めませんでした"));
      img.src = URL.createObjectURL(file);
    });
  }
  const eventEnd = (p) => (p.end_at ? new Date(p.end_at).getTime() : p.activity_date ? new Date(p.activity_date).getTime() + 3 * 3600e3 : null);
  const isEnded = (p) => p.kind === "recruit" && eventEnd(p) !== null && Date.now() > eventEnd(p);
  let pendingCollage = null; // コラージュから体験シェアへ渡す画像

  /* ---------------- コラージュ ---------------- */
  async function loadBitmap(url) { return createImageBitmap(await (await fetch(url)).blob()); }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function wrapLines(g, text, maxW, maxLines) {
    const lines = []; let cur = "";
    for (const ch of [...text]) {
      if (g.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; if (lines.length === maxLines) break; }
      else cur += ch;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    else if (lines.length === maxLines && cur) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
    return lines;
  }
  async function makeCollage(p, photos, memberCount) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    const FONT = '"Murecho", "Hiragino Sans", sans-serif';
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
    // 見出し
    g.fillStyle = "#000000"; g.font = `800 54px ${FONT}`; g.textBaseline = "alphabetic";
    const lines = wrapLines(g, p.title, W - 140, 2);
    lines.forEach((l, i) => g.fillText(l, 70, 120 + i * 68));
    const metaY = 120 + lines.length * 68 + 4;
    g.fillStyle = "#6f6f6f"; g.font = `500 32px ${FONT}`;
    g.fillText([p.activity_date ? fmtDate(p.activity_date) : "", p.area || ""].filter(Boolean).join("　・　"), 70, metaY);
    // 写真
    const top = metaY + 40, area = { x: 60, y: top, w: W - 120, h: H - top - 150 }, gap = 16;
    const imgs = (await Promise.all(photos.slice(0, 6).map((ph) => loadBitmap(ph.url).catch(() => null)))).filter(Boolean);
    const rows = { 1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3] }[imgs.length] || [];
    const rh = (area.h - gap * (rows.length - 1)) / (rows.length || 1);
    let k = 0;
    rows.forEach((cols, ri) => {
      const cw = (area.w - gap * (cols - 1)) / cols;
      for (let ci = 0; ci < cols; ci++) {
        const img = imgs[k++], x = area.x + ci * (cw + gap), y = area.y + ri * (rh + gap);
        const s2 = Math.max(cw / img.width, rh / img.height), sw = cw / s2, sh = rh / s2;
        g.save(); rrect(g, x, y, cw, rh, 28); g.clip();
        g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, cw, rh);
        g.restore();
      }
    });
    // フッター（トマトのロゴ）
    const fy = H - 75;
    g.fillStyle = "#ff3b1f"; g.beginPath(); g.arc(98, fy, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#00a35c"; g.beginPath(); g.moveTo(98, fy - 26); g.lineTo(84, fy - 44); g.lineTo(96, fy - 32); g.lineTo(98, fy - 48); g.lineTo(102, fy - 32); g.lineTo(114, fy - 44); g.closePath(); g.fill();
    g.fillStyle = "#000000"; g.font = `900 50px "Archivo", ${FONT}`; g.textBaseline = "middle";
    g.fillText("domate", 142, fy + 2);
    g.fillStyle = "#6f6f6f"; g.font = `500 30px ${FONT}`; g.textAlign = "right";
    g.fillText(`${memberCount}人でやってきた！`, W - 70, fy + 2);
    return new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
  }

  const inviteLink = (code) => location.origin + location.pathname + "#/join/" + code;
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("コピーしました"); }
    catch (e) { toast("コピーできませんでした。長押しで選択してください"); }
  }
  async function refreshBlocks() { blocked = new Set((await S.listBlocks()).map((b) => b.blocked_id)); }
  const statusPill = (s) => ({
    pending: '<span class="status-pill st-pending">申請中</span>',
    approved: '<span class="status-pill st-approved">参加決定</span>',
    rejected: '<span class="status-pill st-rejected">見送り</span>',
  }[s] || "");

  /* ---------------- アイコン ---------------- */
  const ICONS = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
    door: "M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14.5 12.5h.01",
    users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
    user: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22a9 9 0 0 1 18 0",
    heart: "M12 20s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 5c-2.3 4.6-9.3 9-9.3 9z",
    chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
    lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
    pin: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    camera: "M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    plus: "M12 5v14M5 12h14",
    back: "M15 5l-7 7 7 7",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
    save: "M12 4v12M7 11l5 5 5-5M5 20h14",
    check: "M5 12.5l4.5 4.5L19 7.5",
    flag: "M5 21V4M5 4h11l-2 4 2 4H5",
    ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
    trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
    link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
    pen: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
    exit: "M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 16l4-4-4-4M14 12H3",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
    note: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  };
  const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${name === "more" ? ' style="stroke-width:3.2"' : ""}><path d="${ICONS[name]}"/></svg>`;

  /* ---------------- 共通レイアウト ---------------- */
  const TOMATO = `<svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="57" r="37" fill="#e2574c"/><path d="M50 24 L40 12 L46 23 L33 20 L45 27 L36 32 L50 29 L64 32 L55 27 L67 20 L54 23 L60 12 Z" fill="#5bae5b"/><circle cx="38" cy="58" r="4" fill="#3f3236"/><circle cx="62" cy="58" r="4" fill="#3f3236"/><path d="M43 68 Q50 74 57 68" stroke="#3f3236" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  function layout({ title, back, body, active, right = "" }) {
    const head = title
      ? `<header class="topbar">${back ? `<button class="icon-btn" data-act="back" aria-label="戻る">${icon("back")}</button>` : ""}<h1>${esc(title)}</h1>${right}</header>`
      : `<header class="topbar"><div class="brand"><span class="dot"></span>domate</div>${right}</header>`;
    const demo = S.mode === "demo" ? `<div class="demo-banner">デモモード：データはこのブラウザの中だけに保存されます</div>` : "";
    const nav = (href, ico, label, key) => `<a href="${href}" class="${active === key ? "on" : ""}">${icon(ico)}${label}</a>`;
    return `<div class="shell">${head}${demo}<main class="content">${body}</main></div>
      <nav class="nav"><div class="inner">
        ${nav("#/", "home", "ホーム", "home")}
        ${nav("#/rooms", "door", "ルーム", "rooms")}
        <a href="#/new" aria-label="投稿する"><span class="plus">${icon("plus")}</span></a>
        ${nav("#/activity", "users", "参加", "activity")}
        ${nav("#/me", "user", "マイページ", "me")}
      </div></nav>`;
  }
  const back = () => (history.length > 1 ? history.back() : (location.hash = "#/"));

  /* ---------------- 投稿カード ---------------- */
  function postCard(p, full) {
    cache.set(p.id, p);
    const isRec = p.kind === "recruit";
    const ended = isRec && isEnded(p), closed = isRec && p.status === "closed";
    const where = p.room ? `${icon("lock")}${esc(p.room.name)}` : `${icon("globe")}公開`;
    const mine = p.author_id === S.userId();
    const my = p.my_request_status ? statusPill(p.my_request_status) : mine && isRec ? '<span class="status-pill">あなたの募集</span>' : "";
    const head = `<div class="card-head">${avatar(p.author)}
        <div class="who"><b>${esc(p.author.display_name)}</b><span class="meta">${ago(p.created_at)}</span><span class="meta">${where}</span></div>
        ${full ? `<button class="icon-btn" data-act="menu" aria-label="メニュー">${icon("more")}</button>` : ""}
      </div>`;
    const actions = `<div class="actions">
        <button class="act${p.liked_by_me ? " liked" : ""}" data-act="like" data-id="${p.id}" aria-label="いいね">${icon("heart")}<span>${p.like_count}</span></button>
        <span class="act">${icon("chat")}${p.comment_count}</span><span class="spacer"></span>${my}
      </div>`;
    const text = `<h3>${esc(p.title)}</h3>${p.body ? `<p class="body${full ? "" : " clamp"}">${esc(p.body)}</p>` : ""}`;
    const go = full ? "" : ` tap" data-go="#/post/${p.id}`;
    if (!isRec) {
      return `<article class="post exp${full ? " full" : ""}${go}">
        ${p.image_url ? `<img class="photo-top" src="${esc(p.image_url)}" alt="" loading="lazy">` : ""}
        <div class="pad">${head}${text}${actions}</div></article>`;
    }
    const d = p.activity_date ? new Date(p.activity_date) : null;
    const pad = (n) => String(n).padStart(2, "0");
    const stub = d
      ? `<span class="mo">${d.getMonth() + 1}月</span><span class="dd">${d.getDate()}</span><span class="tm">${"日月火水木金土"[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}</span>`
      : `<span class="dd" style="font-size:1.2rem">未定</span>`;
    const state = ended ? "終了" : closed ? "締め切り" : "";
    return `<article class="post rec${ended || closed ? " done" : ""}${full ? " full" : ""}${go}">
      <div class="stub">${stub}${state ? `<span class="st">${state}</span>` : ""}</div>
      <div class="ticket">${head}${text}
        <div class="facts">
          ${p.area ? `<div>${icon("pin")}<span>${esc(p.area)}</span></div>` : ""}
          <div>${icon("users")}<span>${p.approved_count} / ${p.capacity || "-"}人 参加</span></div>
          ${p.conditions ? `<div>${icon("check")}<span>${esc(p.conditions)}</span></div>` : ""}
        </div>
        ${p.image_url ? `<img class="photo" src="${esc(p.image_url)}" alt="" loading="lazy">` : ""}
        ${actions}
      </div></article>`;
  }
  async function likeHandler(el) {
    const p = cache.get(el.dataset.id); if (!p) return;
    await S.toggleLike(p);
    p.liked_by_me = !p.liked_by_me; p.like_count += p.liked_by_me ? 1 : -1;
    el.classList.toggle("liked", p.liked_by_me);
    el.querySelector("span").textContent = p.like_count;
  }

  /* ---------------- 通報・ブロック ---------------- */
  function openReport(type, id) {
    const reasons = ["スパム・宣伝", "不快・攻撃的な内容", "危険な誘い・出会い目的", "個人情報が書かれている", "その他"];
    sheet(`<h2>通報する</h2><p class="meta">運営が内容を確認します。相手に通報したことは伝わりません。</p>
      <form data-form="report">
        <div class="vis" style="margin-top:12px">${reasons.map((r, i) => `<label><input type="radio" name="r" value="${r}" ${i === 0 ? "checked" : ""}>${r}</label>`).join("")}</div>
        <label class="f">くわしく <small>（任意）</small></label>
        <textarea class="input" name="detail" maxlength="400" style="min-height:70px"></textarea>
        <button class="btn block" type="submit" style="margin-top:14px">送信する</button>
      </form>`, {
      report: async (f, close) => {
        const reason = f.r.value + (f.detail.value.trim() ? "：" + f.detail.value.trim() : "");
        await S.report(type, id, reason); close(); toast("通報しました。ご協力ありがとうございます");
      },
    });
  }
  function openBlock(user) {
    sheet(`<h2>${esc(user.display_name)}さんをブロック</h2>
      <p class="meta" style="margin:6px 0 14px">この人の投稿やコメントが表示されなくなります。相手には通知されません。マイページからいつでも解除できます。</p>
      <div class="row"><button class="btn" data-act="ok">ブロックする</button><button class="btn ghost" data-act="cancel">やめる</button></div>`, {
      ok: async (_a, close) => { await S.block(user.id); blocked.add(user.id); close(); toast("ブロックしました"); location.hash = "#/"; },
      cancel: (_a, close) => close(),
    });
  }

  /* ---------------- ホーム（タイムライン） ---------------- */
  async function renderFeed(roomId) {
    setView(layout({ body: '<div class="loading">読み込み中…</div>', active: roomId ? "rooms" : "home" }));
    let room = null;
    if (roomId) {
      room = await S.getRoom(roomId);
      if (!room) { toast("このルームは見られません"); location.hash = "#/rooms"; return; }
    }
    const [rooms, posts] = await Promise.all([S.listMyRooms(), S.listPosts({ roomId, kind: state.feedKind || undefined })]);
    const list = posts.filter((p) => !blocked.has(p.author_id));
    const chips = `<div class="chips">
        <a class="chip${roomId ? "" : " on"}" href="#/">みんな</a>
        ${rooms.map((r) => `<a class="chip${r.id === roomId ? " on" : ""}" href="#/room/${r.id}">${esc(r.name)}</a>`).join("")}
        <a class="chip" href="#/rooms">${icon("plus")}ルーム</a>
      </div>`;
    const roomHead = room
      ? `<div class="card" style="background:var(--pink-light)">
          <div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:1.05rem">${esc(room.name)}</b>
          <button class="btn sm sub" data-act="invite">招待</button><button class="icon-btn" data-act="roommenu" aria-label="メニュー">${icon("more")}</button></div>
          ${room.description ? `<p class="meta" style="margin-top:4px">${esc(room.description)}</p>` : ""}
          <p class="meta">ここへの投稿はルームのメンバーだけが見られます</p>
        </div>` : "";
    const seg = `<div class="seg">
        <button class="${state.feedKind === "" ? "on" : ""}" data-act="kind" data-k="">すべて</button>
        <button class="${state.feedKind === "experience" ? "on" : ""}" data-act="kind" data-k="experience">体験シェア</button>
        <button class="${state.feedKind === "recruit" ? "on" : ""}" data-act="kind" data-k="recruit">仲間募集</button>
      </div>`;
    const empty = `<div class="empty"><div class="big"></div><p>まだ投稿がありません。<br>最近やったことや、やりたいことを投稿してみよう</p>
      <a class="btn" style="margin-top:14px" href="#/new${roomId ? "?room=" + roomId : ""}">投稿する</a></div>`;
    setView(layout({ body: chips + roomHead + seg + (list.length ? list.map((p) => postCard(p)).join("") : empty), active: roomId ? "rooms" : "home" }), {
      like: likeHandler,
      kind: (el) => { state.feedKind = el.dataset.k; renderFeed(roomId); },
      invite: () => openInvite(room),
      roommenu: () => openRoomMenu(room),
    });
  }

  /* ---------------- 投稿の詳細 ---------------- */
  async function renderPost(id) {
    setView(layout({ title: "投稿", back: true, body: '<div class="loading">読み込み中…</div>' }), { back });
    const p = await S.getPost(id);
    if (!p) { setView(layout({ title: "投稿", back: true, body: '<div class="empty"><div class="big"></div><p>この投稿は見つかりませんでした</p></div>' }), { back }); return; }
    const mine = p.author_id === S.userId();
    const isRec = p.kind === "recruit";
    const [comments, requests] = await Promise.all([S.listComments(id), isRec && mine ? S.listRequests(id) : Promise.resolve([])]);
    const member = isRec && (mine || p.my_request_status === "approved");
    const ended = isEnded(p);
    let members = [], photos = [], consents = [];
    if (member && ended) [members, photos, consents] = await Promise.all([S.listChatMembers(id), S.listEventPhotos(id), S.listShareConsents(id)]);
    const source = p.source_post_id ? await S.getPost(p.source_post_id).catch(() => null) : null;

    let memoryPanel = "";
    if (member && ended) {
      const okNames = members.map((m) => `<span class="${consents.includes(m.id) ? "ok" : "ng"}">${consents.includes(m.id) ? "" : "・"} ${esc(m.display_name)}</span>`).join("");
      memoryPanel = `<div class="sec-title">おもいで</div>
        <div class="card">
          <p><b>おつかれさまでした！</b></p>
          <p class="meta">当日の写真をみんなで集めて、コラージュにしよう。写真は参加メンバーだけが見られます。</p>
          <div class="album">${photos.map((ph) => `<div class="ph"><img src="${esc(ph.url)}" alt="">${ph.uploader_id === S.userId() ? `<button data-act="delPhoto" data-id="${ph.id}" aria-label="削除"></button>` : ""}</div>`).join("")}
            <label class="ph add">${icon("camera")}<span>写真を追加</span><input type="file" accept="image/*" multiple id="albumInput" hidden></label>
          </div>
          <button class="btn block" data-act="collage" style="margin-top:12px" ${photos.length ? "" : "disabled"}>コラージュをつくる</button>
          <div class="consent"><span class="meta">外部へのシェアOK：</span>${okNames}</div>
        </div>`;
    } else if (member && p.activity_date) {
      memoryPanel = `<div class="card" style="background:var(--pink-light)"><p class="meta">${fmtDate(new Date(eventEnd(p)).toISOString())} を過ぎると、みんなの写真を集めてコラージュが作れます</p></div>`;
    }
    const sourceHtml = source ? `<div class="card tap source" data-go="#/post/${source.id}"><span class="meta">↪ ${esc(source.author.display_name)}さんの投稿から生まれました</span><b>${esc(source.title)}</b></div>` : "";
    const metoo = !isRec ? `<button class="btn sub block" data-act="metoo" style="margin-bottom:14px">私もやりたい！一緒にやる人を募集する</button>` : "";

    let recPanel = "";
    if (isRec && mine) {
      const pending = requests.filter((r) => r.status === "pending");
      const others = requests.filter((r) => r.status !== "pending");
      const reqRow = (r) => `<div class="cmt">${avatar(r.user, true)}<div class="txt"><b>${esc(r.user.display_name)}</b>${statusPill(r.status)}
          ${r.message ? `<div class="body" style="font-size:.9rem">${esc(r.message)}</div>` : ""}
          ${r.status === "pending" ? `<div class="row" style="margin-top:6px"><button class="btn sm green" data-act="approve" data-id="${r.id}">参加OK</button><button class="btn sm ghost" data-act="reject" data-id="${r.id}">見送る</button></div>` : ""}
        </div></div>`;
      recPanel = `<div class="sec-title">参加申請 <span class="meta">${pending.length}件の返事待ち</span></div>
        <div class="card">${requests.length ? [...pending, ...others].map(reqRow).join("") : '<p class="meta">まだ申請はありません</p>'}
          <div class="row" style="margin-top:12px">
            <a class="btn sm" href="#/chat/${p.id}">参加者チャット</a>
            <button class="btn sm ghost" data-act="toggleClose">${p.status === "open" ? "募集を締め切る" : "募集を再開する"}</button>
          </div></div>`;
    } else if (isRec) {
      const st = p.my_request_status;
      let inner;
      if (st === "approved") inner = `<p><b>参加が決まりました</b></p><p class="meta">集合場所などはチャットで確認しましょう</p><a class="btn block" style="margin-top:10px" href="#/chat/${p.id}">チャットを開く</a>`;
      else if (st === "pending") inner = `<p><b>申請中です</b></p><p class="meta">募集した人の返事を待っています</p><button class="btn sm ghost" style="margin-top:10px" data-act="cancelJoin">申請を取り消す</button>`;
      else if (st === "rejected") inner = `<p class="meta">今回は見送りになりました。また別の募集をのぞいてみてね</p>`;
      else if (p.status === "closed") inner = `<p class="meta">この募集は締め切られました</p>`;
      else inner = `<form data-form="join"><p><b>この募集に参加したい？</b></p>
          <textarea class="input" name="message" maxlength="300" style="min-height:70px;margin-top:8px" placeholder="ひとこと（例：初めてですが参加したいです！）"></textarea>
          <button class="btn block" type="submit" style="margin-top:10px">参加を申請する</button>
          <p class="hint">申請が承認されると、参加者どうしのチャットが使えるようになります</p></form>`;
      recPanel = `<div class="card">${inner}</div>`;
    }

    const visible = comments.filter((c) => !blocked.has(c.author_id));
    const cmtHtml = visible.map((c) => `<div class="cmt">${avatar(c.author, true)}<div class="txt"><b>${esc(c.author.display_name)}</b><span class="meta">${ago(c.created_at)}</span>
        ${c.author_id === S.userId() ? `<button class="mini-link" data-act="delCmt" data-id="${c.id}">削除</button>` : `<button class="mini-link" data-act="repCmt" data-id="${c.id}">通報</button>`}
        <div class="body">${esc(c.body)}</div></div></div>`).join("");

    const body = postCard(p, true) + sourceHtml + metoo + recPanel + memoryPanel +
      `<div class="sec-title">コメント <span class="meta">${visible.length}</span></div>
       <div class="card">${cmtHtml || '<p class="meta">最初のコメントをしてみよう</p>'}
         <form data-form="comment" class="send-bar"><input class="input" name="body" maxlength="500" placeholder="コメントを書く" required><button class="btn" type="submit">送信</button></form>
       </div>`;

    setView(layout({ title: isRec ? "仲間募集" : "体験シェア", back: true, body }), {
      back, like: likeHandler,
      menu: () => {
        const items = mine
          ? `<button class="menu-item danger" data-act="del">${icon("trash")}この投稿を削除</button>`
          : `<button class="menu-item" data-act="rep">${icon("flag")}投稿を通報する</button><button class="menu-item danger" data-act="blk">${icon("ban")}${esc(p.author.display_name)}さんをブロック</button>`;
        sheet(items + `<button class="menu-item" data-act="x">閉じる</button>`, {
          x: (_a, close) => close(),
          del: async (_a, close) => { close(); sheet(`<h2>投稿を削除しますか？</h2><p class="meta" style="margin:6px 0 14px">コメントや参加申請、チャットも一緒に消えます。元に戻せません。</p><div class="row"><button class="btn" data-act="yes">削除する</button><button class="btn ghost" data-act="no">やめる</button></div>`, {
            yes: async (_b, c2) => { await S.deletePost(p.id); c2(); toast("削除しました"); location.hash = "#/"; },
            no: (_b, c2) => c2(),
          }); },
          rep: (_a, close) => { close(); openReport("post", p.id); },
          blk: (_a, close) => { close(); openBlock(p.author); },
        });
      },
      approve: async (el) => {
        if (p.capacity && p.approved_count >= p.capacity) { toast("定員に達しています。人数を増やすには投稿し直してください"); return; }
        await S.setRequestStatus(el.dataset.id, "approved"); toast("参加OKにしました"); renderPost(id);
      },
      reject: async (el) => { await S.setRequestStatus(el.dataset.id, "rejected"); toast("見送りにしました"); renderPost(id); },
      toggleClose: async () => { await S.updatePost(p.id, { status: p.status === "open" ? "closed" : "open" }); renderPost(id); },
      cancelJoin: async () => { await S.cancelJoin(p.id); toast("申請を取り消しました"); renderPost(id); },
      delCmt: async (el) => { await S.deleteComment(el.dataset.id); renderPost(id); },
      repCmt: (el) => openReport("comment", el.dataset.id),
      metoo: () => { location.hash = `#/new?kind=recruit&from=${p.id}`; },
      delPhoto: async (el) => { await S.deleteEventPhoto(photos.find((x) => x.id === el.dataset.id)); renderPost(id); },
      collage: async () => {
        const blob = await makeCollage(p, photos, members.length);
        const url = URL.createObjectURL(blob);
        const allOk = members.every((m) => consents.includes(m.id));
        const iOk = consents.includes(S.userId());
        const file = new File([blob], "domate-collage.jpg", { type: "image/jpeg" });
        sheet(`<h2>コラージュができました</h2>
          <img src="${url}" alt="コラージュ" style="border-radius:14px;margin:10px 0;box-shadow:var(--shadow)">
          <div class="consent" style="margin-bottom:10px"><span class="meta">外部へのシェアOK：</span>${members.map((m) => `<span class="${consents.includes(m.id) ? "ok" : "ng"}">${consents.includes(m.id) ? "" : "・"} ${esc(m.display_name)}</span>`).join("")}</div>
          <button class="btn ${iOk ? "ghost" : "green"} block" data-act="consent">${iOk ? "シェアOKを取り消す" : "私はシェアOK！"}</button>
          ${allOk ? `<div class="row" style="margin-top:10px">
              <button class="btn" style="flex:1" data-act="share">${icon("share")}シェア</button>
              <button class="btn sub" style="flex:1" data-act="save">${icon("save")}保存</button></div>
              <button class="btn sub block" style="margin-top:10px" data-act="post">domateに体験シェアとして投稿</button>`
            : `<p class="hint" style="text-align:center;margin-top:10px">写っている全員がOKすると、保存・シェア・投稿ができます。<br>チャットで声をかけてみよう</p>`}`, {
          consent: async (_a, close) => { await S.setShareConsent(p.id, !iOk); close(); toast(iOk ? "取り消しました" : "シェアOKにしました"); await renderPost(id); },
          save: () => { const a = document.createElement("a"); a.href = url; a.download = "domate-collage.jpg"; document.body.appendChild(a); a.click(); a.remove(); },
          share: async () => {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try { await navigator.share({ files: [file], title: p.title, text: `${p.title} #domate` }); } catch (e) {}
            } else { toast("この端末ではシェアできないので、保存してから投稿してください"); }
          },
          post: (_a, close) => { pendingCollage = { blob, from: p }; close(); location.hash = `#/new?kind=experience&from=${p.id}&collage=1`; },
        });
      },
      join: async (f) => { await S.requestJoin(p.id, f.message.value.trim()); toast("参加を申請しました"); renderPost(id); },
      comment: async (f) => { const v = f.body.value.trim(); if (!v) return; await S.addComment(p.id, v); renderPost(id); },
    });
    const albumInput = document.getElementById("albumInput");
    if (albumInput) albumInput.addEventListener("change", (e) => guard(async () => {
      const files = [...e.target.files].slice(0, 10); if (!files.length) return;
      toast(`${files.length}枚アップロード中…`);
      for (const f of files) await S.uploadEventPhoto(p.id, await resizeImage(f, S.mode === "demo" ? 640 : 1600));
      toast("写真を追加しました"); renderPost(id);
    }));
  }

  /* ---------------- チャット ---------------- */
  async function renderChat(id) {
    const p = await S.getPost(id);
    if (!p) { toast("募集が見つかりません"); location.hash = "#/activity"; return; }
    let msgs;
    try { msgs = await S.listMessages(id); }
    catch (e) { toast("このチャットは参加が決まった人だけ使えます"); location.hash = "#/post/" + id; return; }
    const bubbles = (list) => list.filter((m) => !blocked.has(m.author_id)).map((m) => {
      const mine = m.author_id === S.userId();
      return `<div class="bubble-row${mine ? " me" : ""}">${mine ? "" : avatar(m.author, true)}<div>
        ${mine ? "" : `<div class="bubble-name">${esc(m.author.display_name)}</div>`}
        <div class="bubble">${esc(m.body)}</div><div class="meta" style="text-align:${mine ? "right" : "left"};margin:2px 6px 0">${ago(m.created_at)}</div></div></div>`;
    }).join("") || '<div class="empty"><div class="big"></div><p>最初のメッセージを送ってみよう</p></div>';
    const body = `<div class="card tap" data-go="#/post/${p.id}" style="padding:12px 14px">
        <b>${esc(p.title)}</b><div class="meta">${p.activity_date ? "" + fmtDate(p.activity_date) : ""} ${p.area ? "" + esc(p.area) : ""}</div></div>
      <p class="hint" style="margin:0 4px 12px">募集した人と、参加が決まった人だけが見られるチャットです</p>
      <div class="chat" id="chat">${bubbles(msgs)}</div>
      <div class="chat-bar"><form data-form="send" class="inner"><input class="input" name="body" maxlength="1000" placeholder="メッセージ" autocomplete="off" required style="border-radius:999px"><button class="btn" type="submit">送信</button></form></div>`;
    setView(layout({ title: "参加者チャット", back: true, body, active: "activity" }), {
      back,
      send: async (f) => {
        const v = f.body.value.trim(); if (!v) return;
        await S.sendMessage(id, v); f.body.value = "";
        msgs = await S.listMessages(id); document.getElementById("chat").innerHTML = bubbles(msgs);
        window.scrollTo(0, document.body.scrollHeight); f.body.focus();
      },
    });
    window.scrollTo(0, document.body.scrollHeight);
    pollTimer = setInterval(async () => {
      try {
        const next = await S.listMessages(id);
        if (next.length !== msgs.length) {
          msgs = next; const el = document.getElementById("chat");
          if (el) { el.innerHTML = bubbles(msgs); window.scrollTo(0, document.body.scrollHeight); }
        }
      } catch (e) {}
    }, 4000);
  }

  /* ---------------- 新規投稿 ---------------- */
  async function renderNew(q) {
    const rooms = await S.listMyRooms();
    const preRoom = q.get("room");
    let kind = q.get("kind") === "recruit" ? "recruit" : "experience";
    let imageBlob = null;
    const fromId = q.get("from");
    const from = fromId ? await S.getPost(fromId) : null;
    let pre = { title: "", body: "", room: preRoom };
    if (from) {
      pre.room = from.room_id || preRoom;
      if (kind === "recruit") pre = { ...pre, title: `私も「${from.title.replace(/[「」]/g, "").replace(/のおもいで$/, "")}」やりたい！`.slice(0, 60), body: `${from.author.display_name}さんの投稿を見て、やってみたくなりました！` };
      else pre = { ...pre, title: `「${from.title}」のおもいで`.slice(0, 60) };
      if (q.get("collage") && pendingCollage && pendingCollage.from.id === from.id) imageBlob = pendingCollage.blob;
    }
    const minDate = new Date(Date.now() + 3600e3 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const body = `<form data-form="post" id="postForm">
      <div class="kind-pick">
        <button type="button" data-act="kind" data-k="experience" class="${kind === "experience" ? "on" : ""}"><b>体験シェア</b><div class="k-sub">最近やった面白いこと</div></button>
        <button type="button" data-act="kind" data-k="recruit" class="${kind === "recruit" ? "on" : ""}"><b>仲間募集</b><div class="k-sub">一緒にやる人を探す</div></button>
      </div>

      <label class="f">タイトル</label>
      <input class="input" name="title" maxlength="60" required value="${esc(pre.title)}" placeholder="${kind === "recruit" ? "例：週末にボルダリング行く人！" : "例：初めて陶芸体験してきた"}">

      <label class="f">内容 <small>（任意）</small></label>
      <textarea class="input" name="body" maxlength="2000" placeholder="どんなことをした？どうだった？">${esc(pre.body)}</textarea>

      <label class="f">写真 <small>（任意）</small></label>
      <input type="file" accept="image/*" name="photo" id="photo" class="input">
      <div id="preview">${imageBlob ? `<div class="preview"><img class="photo" src="${URL.createObjectURL(imageBlob)}" alt=""><button type="button" data-act="rmPhoto"></button></div>` : ""}</div>

      <div id="recFields" style="display:${kind === "recruit" ? "block" : "none"}">
        <label class="f">日時</label>
        <input class="input" type="datetime-local" name="date" min="${minDate}">
        <label class="f">終了予定 <small>（任意。過ぎるとみんなでコラージュが作れます）</small></label>
        <input class="input" type="datetime-local" name="end" min="${minDate}">
        <label class="f">エリア <small>（駅名や地域くらいの大まかさで）</small></label>
        <input class="input" name="area" maxlength="40" placeholder="例：渋谷、横浜駅周辺、オンライン">
        <label class="f">募集人数 <small>（あなた以外に何人？）</small></label>
        <input class="input" type="number" name="capacity" min="1" max="100" value="2">
        <label class="f">参加条件 <small>（任意）</small></label>
        <input class="input" name="conditions" maxlength="300" placeholder="例：初心者歓迎、費用は各自2,000円くらい">
        <p class="hint">細かい待ち合わせ場所や連絡先は、参加が決まってからチャットで伝えましょう</p>
      </div>

      <label class="f">公開範囲</label>
      <div class="vis">
        <label><input type="radio" name="vis" value="public" ${pre.room ? "" : "checked"}>みんなに公開</label>
        ${rooms.map((r) => `<label><input type="radio" name="vis" value="${r.id}" ${pre.room === r.id ? "checked" : ""}>${esc(r.name)} のメンバーだけ</label>`).join("")}
      </div>
      ${rooms.length ? "" : '<p class="hint">ルームを作ると、仲のいい人だけに見える投稿もできます</p>'}

      <button class="btn block" type="submit" style="margin:22px 0 10px">投稿する</button>
    </form>`;
    setView(layout({ title: "投稿する", back: true, body }), {
      back,
      kind: (el) => {
        kind = el.dataset.k;
        document.querySelectorAll(".kind-pick button").forEach((b) => b.classList.toggle("on", b.dataset.k === kind));
        document.getElementById("recFields").style.display = kind === "recruit" ? "block" : "none";
        document.querySelector("[name=title]").placeholder = kind === "recruit" ? "例：週末にボルダリング行く人！" : "例：初めて陶芸体験してきた";
      },
      rmPhoto: () => { imageBlob = null; document.getElementById("photo").value = ""; document.getElementById("preview").innerHTML = ""; },
      post: async (f) => {
        const vis = f.vis.value;
        const data = {
          kind, title: f.title.value.trim(), body: f.body.value.trim(),
          visibility: vis === "public" ? "public" : "room", room_id: vis === "public" ? null : vis,
        };
        if (from) data.source_post_id = from.id;
        if (!data.title) throw new Error("タイトルを入れてください");
        if (kind === "recruit") {
          if (!f.date.value) throw new Error("日時を入れてください");
          if (f.end.value && new Date(f.end.value) <= new Date(f.date.value)) throw new Error("終了予定は開始より後にしてください");
          const cap = parseInt(f.capacity.value, 10);
          if (!(cap >= 1 && cap <= 100)) throw new Error("募集人数は1〜100人で入れてください");
          Object.assign(data, {
            activity_date: new Date(f.date.value).toISOString(), area: f.area.value.trim() || null,
            end_at: f.end.value ? new Date(f.end.value).toISOString() : null,
            capacity: cap, conditions: f.conditions.value.trim() || null, status: "open",
          });
        }
        const r = await S.createPost(data, imageBlob);
        pendingCollage = null;
        toast("投稿しました"); location.hash = "#/post/" + r.id;
      },
    });
    document.getElementById("photo").addEventListener("change", (e) => guard(async () => {
      const file = e.target.files[0]; if (!file) return;
      imageBlob = await resizeImage(file, S.mode === "demo" ? 800 : 1280);
      document.getElementById("preview").innerHTML = `<div class="preview"><img class="photo" src="${URL.createObjectURL(imageBlob)}" alt=""><button type="button" data-act="rmPhoto"></button></div>`;
    }));
  }

  /* ---------------- ルーム ---------------- */
  function openInvite(room) {
    const link = inviteLink(room.invite_code);
    sheet(`<h2>「${esc(room.name)}」に招待</h2>
      <p class="meta" style="margin:6px 0 12px">このリンクを知っている人は誰でもルームに入れます。信頼できる人にだけ送ってください。</p>
      <input class="input" value="${esc(link)}" readonly onclick="this.select()">
      <p class="meta" style="margin-top:8px">招待コード：<b>${esc(room.invite_code)}</b></p>
      <button class="btn block" data-act="copy" style="margin-top:14px">リンクをコピー</button>`, {
      copy: () => copy(link),
    });
  }
  function openRoomMenu(room) {
    const owner = room.owner_id === S.userId();
    sheet(`<h2>${esc(room.name)}</h2>
      <button class="menu-item" data-act="inv">${icon("link")}招待リンクを見る</button>
      <button class="menu-item" data-act="new">${icon("pen")}このルームに投稿する</button>
      ${owner ? "" : '<button class="menu-item danger" data-act="leave">${icon("exit")}ルームを抜ける</button>'}
      <button class="menu-item" data-act="x">閉じる</button>`, {
      x: (_a, close) => close(),
      inv: (_a, close) => { close(); openInvite(room); },
      new: (_a, close) => { close(); location.hash = "#/new?room=" + room.id; },
      leave: async (_a, close) => { await S.leaveRoom(room.id); close(); toast("ルームを抜けました"); location.hash = "#/rooms"; },
    });
  }
  async function renderRooms() {
    const rooms = await S.listMyRooms();
    const list = rooms.map((r) => `<div class="card tap" data-go="#/room/${r.id}">
        <div style="display:flex;align-items:center;gap:8px"><b style="flex:1">${esc(r.name)}</b>${r.role === "owner" ? '<span class="badge exp">管理者</span>' : ""}</div>
        ${r.description ? `<p class="meta">${esc(r.description)}</p>` : ""}
      </div>`).join("");
    const body = `<p class="meta" style="margin:4px 4px 12px">ルームは、招待した人だけが見られる小さなコミュニティです。サークル、ゼミ、地元の友達などで使えます。</p>
      ${list || '<div class="empty" style="padding:20px"><div class="big"></div><p>まだルームに入っていません</p></div>'}
      <div class="sec-title">ルームを作る</div>
      <form class="card" data-form="create">
        <input class="input" name="name" maxlength="40" required placeholder="ルーム名（例：テニサー同期）">
        <input class="input" name="desc" maxlength="200" placeholder="ひとこと説明（任意）" style="margin-top:8px">
        <button class="btn block" type="submit" style="margin-top:12px">作成する</button>
      </form>
      <div class="sec-title">招待コードで入る</div>
      <form class="card" data-form="join">
        <input class="input" name="code" required placeholder="招待コード または 招待リンク">
        <button class="btn sub block" type="submit" style="margin-top:12px">ルームに入る</button>
      </form>`;
    setView(layout({ title: "ルーム", body, active: "rooms" }), {
      create: async (f) => {
        const r = await S.createRoom(f.name.value.trim(), f.desc.value.trim());
        toast("ルームを作りました"); location.hash = "#/room/" + r.id;
        setTimeout(() => openInvite(r), 400);
      },
      join: async (f) => {
        const raw = f.code.value.trim();
        const code = raw.includes("#/join/") ? raw.split("#/join/")[1] : raw;
        const r = await S.joinRoom(code); toast("ルームに入りました"); location.hash = "#/room/" + r.id;
      },
    });
  }
  async function doJoin(code) {
    try { const r = await S.joinRoom(code); toast(`「${r.name}」に入りました`); location.replace("#/room/" + r.id); }
    catch (e) { toast(e.message); location.replace("#/rooms"); }
  }

  /* ---------------- 参加（募集と申請の一覧） ---------------- */
  async function renderActivity() {
    const [myPosts, myReqs] = await Promise.all([S.listMyPosts(), S.listMyRequests()]);
    const myRecs = myPosts.filter((p) => p.kind === "recruit");
    const reqLists = await Promise.all(myRecs.map((p) => S.listRequests(p.id)));
    const recHtml = myRecs.map((p, i) => {
      const waiting = reqLists[i].filter((r) => r.status === "pending").length;
      return `<div class="card tap" data-go="#/post/${p.id}">
        <div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${esc(p.title)}</b>${p.status === "closed" ? '<span class="badge closed">締め切り</span>' : ""}</div>
        <div class="meta">${p.activity_date ? "" + fmtDate(p.activity_date) : ""}　${p.approved_count}/${p.capacity}人</div>
        <div class="row" style="margin-top:8px">
          ${waiting ? `<span class="status-pill st-pending">申請 ${waiting}件</span>` : ""}
          ${isEnded(p) ? `<span class="status-pill st-approved">おもいでを残そう</span>` : ""}
          <a class="btn sm sub" href="#/chat/${p.id}" data-go="#/chat/${p.id}">チャット</a>
        </div></div>`;
    }).join("");
    const reqHtml = myReqs.filter((r) => r.post).map((r) => `<div class="card tap" data-go="#/post/${r.post.id}">
        <div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${esc(r.post.title)}</b>${statusPill(r.status)}</div>
        <div class="meta">${r.post.activity_date ? "" + fmtDate(r.post.activity_date) : ""} ${r.post.area ? "" + esc(r.post.area) : ""}</div>
        ${r.status === "approved" ? `<div class="row" style="margin-top:8px"><a class="btn sm" href="#/chat/${r.post.id}" data-go="#/chat/${r.post.id}">チャットを開く</a>${r.post.activity_date && Date.now() > new Date(r.post.end_at || new Date(r.post.activity_date).getTime() + 3 * 3600e3).getTime() ? `<a class="btn sm green" href="#/post/${r.post.id}" data-go="#/post/${r.post.id}">おもいで</a>` : ""}</div>` : ""}
      </div>`).join("");
    const body = `<div class="sec-title">あなたの募集</div>
      ${recHtml || `<div class="card"><p class="meta">まだ募集していません</p><a class="btn sm" style="margin-top:10px" href="#/new?kind=recruit">仲間を募集する</a></div>`}
      <div class="sec-title">申請した募集</div>
      ${reqHtml || '<div class="card"><p class="meta">まだ申請していません。ホームの「仲間募集」からさがしてみよう</p></div>'}`;
    setView(layout({ title: "参加", body, active: "activity" }));
  }

  /* ---------------- マイページ ---------------- */
  async function renderMe() {
    me = await S.getMyProfile();
    const [blocks, myPosts] = await Promise.all([S.listBlocks(), S.listMyPosts()]);
    const demo = S.mode === "demo" ? `<div class="sec-title">デモ用の設定</div>
      <div class="card">
        <label class="f" style="margin-top:0">別のユーザーになって試す</label>
        <select class="input" id="switchUser">${S.demoUsers().map((u) => `<option value="${u.id}" ${u.id === S.userId() ? "selected" : ""}>${esc(u.display_name)}</option>`).join("")}</select>
        <p class="hint">「そうた」になって自分の募集に申請する、などの流れを確認できます</p>
        <button class="btn sm ghost" data-act="reset" style="margin-top:12px">デモのデータを最初に戻す</button>
      </div>` : "";
    const body = `<div class="card" style="text-align:center">
        <div style="display:flex;justify-content:center;margin-bottom:6px">${avatar(me)}</div>
        <b style="font-size:1.1rem">${esc(me.display_name)}</b>
        ${me.bio ? `<p class="meta">${esc(me.bio)}</p>` : ""}
      </div>
      <div class="sec-title">プロフィール</div>
      <form class="card" data-form="profile">
        <label class="f" style="margin-top:0">表示名 <small>（本名は避けるのがおすすめ）</small></label>
        <input class="input" name="name" maxlength="20" required value="${esc(me.display_name)}">
        <label class="f">ひとこと</label>
        <input class="input" name="bio" maxlength="160" value="${esc(me.bio || "")}" placeholder="好きなこと、最近ハマってること">
        <button class="btn block" type="submit" style="margin-top:14px">保存する</button>
      </form>
      <div class="sec-title">あなたの投稿 <span class="meta">${myPosts.length}</span></div>
      ${myPosts.map((p) => postCard(p)).join("") || '<div class="card"><p class="meta">まだ投稿していません</p></div>'}
      <div class="sec-title">ブロック中のユーザー</div>
      <div class="card">${blocks.map((b) => `<div class="cmt" style="align-items:center">${avatar(b.blocked, true)}<div class="txt"><b>${esc(b.blocked.display_name)}</b></div><button class="btn sm ghost" data-act="unblock" data-id="${b.blocked_id}">解除</button></div>`).join("") || '<p class="meta">いません</p>'}</div>
      <div class="sec-title">安全に使うために</div>
      <div class="card rules" style="margin-top:0"><ul>
        <li>初めて会うときは、昼間の人が多い場所にしましょう</li>
        <li>住所・電話番号・学校名などの個人情報は書かないでください</li>
        <li>お金や勧誘の話が出たら、参加をやめて通報してください</li>
        <li>嫌なことをされたら、ためらわず通報・ブロックしてください</li>
      </ul></div>
      ${demo}
      ${S.mode === "supabase" ? '<button class="btn ghost block" data-act="logout" style="margin:20px 0">ログアウト</button>' : ""}
      <p class="meta" style="text-align:center;margin:20px 0">domate by Cherrish</p>`;
    setView(layout({ title: "マイページ", body, active: "me" }), {
      like: likeHandler,
      profile: async (f) => { await S.updateProfile({ display_name: f.name.value.trim(), bio: f.bio.value.trim() }); toast("保存しました"); renderMe(); },
      unblock: async (el) => { await S.unblock(el.dataset.id); blocked.delete(el.dataset.id); toast("解除しました"); renderMe(); },
      reset: async () => { await S.resetDemo(); me = null; await refreshBlocks(); toast("デモのデータを戻しました"); location.hash = "#/"; },
      logout: async () => { await S.signOut(); me = null; location.hash = "#/"; route(); },
    });
    const sw = document.getElementById("switchUser");
    if (sw) sw.addEventListener("change", async () => { await S.switchUser(sw.value); me = null; await refreshBlocks(); toast(`「${sw.selectedOptions[0].text}」になりました`); renderMe(); });
  }

  /* ---------------- ログイン・新規登録 ---------------- */
  function renderAuth(tab = "login") {
    const signup = tab === "signup";
    const body = `<div class="auth">
      <div class="hero"><h1><span class="brand"><span class="dot" style="width:22px;height:22px;box-shadow:7px -7px 0 -5px var(--leaf)"></span>domate</span></h1><p>やりたいことを、一緒にやる仲間と。</p></div>
      <div class="seg"><button class="${signup ? "" : "on"}" data-act="tab" data-t="login">ログイン</button><button class="${signup ? "on" : ""}" data-act="tab" data-t="signup">新規登録</button></div>
      <form data-form="${signup ? "signup" : "login"}">
        ${signup ? `<label class="f">表示名 <small>（ニックネームがおすすめ）</small></label><input class="input" name="name" maxlength="20" required>` : ""}
        <label class="f">メールアドレス</label><input class="input" type="email" name="email" required autocomplete="email">
        <label class="f">パスワード ${signup ? "<small>（6文字以上）</small>" : ""}</label><input class="input" type="password" name="password" minlength="6" required autocomplete="${signup ? "new-password" : "current-password"}">
        ${signup ? `<div class="rules"><b>domate のルール</b><ul>
            <li>18歳以上の方だけが利用できます</li>
            <li>出会い目的・勧誘・営業での利用は禁止です</li>
            <li>相手が嫌がることや、危険な誘いはしないでください</li>
            <li>個人情報は投稿しないでください</li></ul></div>
          <label class="check"><input type="checkbox" name="agree" required><span>18歳以上であり、上のルールに同意します</span></label>` : ""}
        <button class="btn block" type="submit" style="margin-top:18px">${signup ? "登録する" : "ログイン"}</button>
        <div class="err" id="authErr"></div>
      </form></div>`;
    app.onclick = null;
    setView(body, {
      tab: (el) => renderAuth(el.dataset.t),
      login: async (f) => {
        try { await S.signIn({ email: f.email.value.trim(), password: f.password.value }); route(); }
        catch (e) { document.getElementById("authErr").textContent = e.message; }
      },
      signup: async (f) => {
        if (!f.agree.checked) throw new Error("ルールへの同意が必要です");
        try {
          const r = await S.signUp({ email: f.email.value.trim(), password: f.password.value, displayName: f.name.value.trim() });
          if (r.needsConfirm) {
            setView(`<div class="auth"><div class="empty"><div class="big"></div><p><b>確認メールを送りました</b><br>メールのリンクを開くと登録が完了します。<br>その後、ここからログインしてください。</p>
              <button class="btn" style="margin-top:16px" data-act="tab" data-t="login">ログイン画面へ</button></div></div>`, { tab: (el) => renderAuth(el.dataset.t) });
          } else route();
        } catch (e) { document.getElementById("authErr").textContent = e.message; }
      },
    });
  }

  /* ---------------- 画面の切り替え ---------------- */
  async function route() {
    clearInterval(pollTimer);
    document.querySelectorAll(".overlay").forEach((o) => o.remove());
    const hash = location.hash.slice(1) || "/";
    const [path, qs] = hash.split("?");
    const parts = path.split("/").filter(Boolean);
    const q = new URLSearchParams(qs || "");

    if (S.mode === "supabase" && !S.userId()) {
      if (parts[0] === "join" && parts[1]) sessionStorage.setItem("pendingJoin", parts[1]);
      return renderAuth();
    }
    if (!me) { me = await S.getMyProfile(); await refreshBlocks(); }
    const pending = sessionStorage.getItem("pendingJoin");
    if (pending) { sessionStorage.removeItem("pendingJoin"); location.hash = "#/join/" + pending; return; }
    window.scrollTo(0, 0);

    switch (parts[0]) {
      case undefined: return renderFeed();
      case "room": return renderFeed(parts[1]);
      case "post": return renderPost(parts[1]);
      case "chat": return renderChat(parts[1]);
      case "new": return renderNew(q);
      case "rooms": return renderRooms();
      case "join": return doJoin(parts[1]);
      case "activity": return renderActivity();
      case "me": return renderMe();
      default: location.hash = "#/";
    }
  }

  window.addEventListener("hashchange", () => guard(route));
  guard(async () => { await S.init(); await route(); });
})();
