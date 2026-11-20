// DoMate クラフトブック（ステッカーで作るおもいでページ）とステッカー作成
// app.js から DomateCraft(ctx) で読み込まれます。
window.DomateCraft = function (ctx) {
  const { S, esc, icon, toast, sheet, guard, setView, layout, back, setPendingImage } = ctx;

  const PAGE_W = 1000, PAGE_H = 1333;
  const PAPERS = [
    { id: "grid", name: "方眼" }, { id: "dot", name: "ドット" }, { id: "line", name: "罫線" },
    { id: "plain", name: "無地" }, { id: "kraft", name: "クラフト紙" }, { id: "night", name: "夜空" },
  ];
  const INKS = ["#000000", "#ff3b1f", "#3a55c8", "#00a35c", "#ff9f0a", "#ff4fa0", "#7a3cff", "#ffffff"];
  const TAPES = ["#ffd84d", "#ff9fb3", "#9fd3ff", "#b6e3a8", "#c9b3ff", "#ff3b1f", "#3a55c8", "#f2f2f2"];
  const DECO_PATHS = {
    tomato: '<circle cx="50" cy="56" r="36"/><path d="M50 22 L38 10 L46 22 L32 18 L44 27 L50 30 L56 27 L68 18 L54 22 L62 10 Z" fill="#00a35c"/>',
    star: '<path d="M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z"/>',
    heart: '<path d="M50 88 C20 66 6 48 6 30 C6 16 17 6 30 6 C39 6 46 11 50 18 C54 11 61 6 70 6 C83 6 94 16 94 30 C94 48 80 66 50 88 Z"/>',
    sparkle: '<path d="M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4 Z"/>',
    flower: '<g><circle cx="50" cy="24" r="18"/><circle cx="76" cy="44" r="18"/><circle cx="66" cy="74" r="18"/><circle cx="34" cy="74" r="18"/><circle cx="24" cy="44" r="18"/></g><circle cx="50" cy="52" r="13" fill="#ffd84d"/>',
    cloud: '<path d="M26 78 C12 78 4 68 4 58 C4 46 14 38 26 40 C28 24 40 14 54 14 C70 14 82 26 82 42 C92 44 96 52 96 60 C96 70 88 78 78 78 Z"/>',
    bubble: '<path d="M14 10 H86 Q96 10 96 20 V62 Q96 72 86 72 H44 L24 92 L28 72 H14 Q4 72 4 62 V20 Q4 10 14 10 Z"/>',
    arrow: '<path d="M6 40 H62 V18 L96 50 L62 82 V60 H6 Z"/>',
    check: '<path d="M8 52 L22 38 L40 56 L78 14 L92 28 L40 86 Z"/>',
    sun: '<circle cx="50" cy="50" r="22"/><g stroke-width="7" stroke-linecap="round"><path d="M50 4 V16 M50 84 V96 M4 50 H16 M84 50 H96 M17 17 L26 26 M74 74 L83 83 M83 17 L74 26 M26 74 L17 83"/></g>',
  };
  const decoSvg = (name, color) => {
    const fill = name === "sun" ? `fill="${color}" stroke="${color}"` : `fill="${color}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g ${fill}>${DECO_PATHS[name] || DECO_PATHS.star}</g></svg>`;
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------------- 画像の小道具 ---------------- */
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("画像を読み込めませんでした")); i.src = src; });
  const canvasBlob = (c, type = "image/png", q) => new Promise((res) => c.toBlob(res, type, q));
  function fitCanvas(img, max) {
    const s = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const c = document.createElement("canvas");
    c.width = Math.round((img.naturalWidth || img.width) * s); c.height = Math.round((img.naturalHeight || img.height) * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function hasTransparency(c) {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] < 250) clear++;
    return clear > (d.length / 16) * 0.02;
  }
  function trimCanvas(c, pad = 6) {
    const g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }
  function applyMask(src, alpha) {
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const g = c.getContext("2d"); g.drawImage(src, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < alpha.length; i++) im.data[i * 4 + 3] = Math.round(im.data[i * 4 + 3] * alpha[i]);
    g.putImageData(im, 0, 0);
    return c;
  }

  /* ---------------- AIで切り抜き（MediaPipe Interactive Segmenter） ---------------- */
  const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";
  const MODEL = "https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/latest/interactive_segmentation.task";
  const MODEL_LEGACY = "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/latest/magic_touch.tflite";
  let segPromise = null;
  function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }
  function getSegmenter() {
    if (!segPromise) {
      segPromise = (async () => {
        const v = await import(`${MP}/vision_bundle.mjs`);
        const fs = await v.FilesetResolver.forVisionTasks(`${MP}/wasm`);
        const tries = [
          { baseOptions: { modelAssetPath: MODEL, delegate: "GPU" }, outputCategoryMask: false, outputConfidenceMasks: true },
          { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, outputCategoryMask: false, outputConfidenceMasks: true },
          { baseOptions: { modelAssetPath: MODEL_LEGACY, delegate: "CPU" }, outputCategoryMask: false, outputConfidenceMasks: true },
        ];
        let last;
        for (const opt of tries) { try { return await v.InteractiveSegmenter.createFromOptions(fs, opt); } catch (e) { last = e; } }
        throw last;
      })();
      segPromise.catch(() => { segPromise = null; });
    }
    return segPromise;
  }
  function readMask(m) {
    if (!m) return null;
    const w = m.width, h = m.height;
    let data;
    if (m.getAsFloat32Array) data = Float32Array.from(m.getAsFloat32Array());
    else if (m.getAsUint8Array) { const u = m.getAsUint8Array(); const mx = Math.max(1, ...u.slice(0, 5000)); data = Float32Array.from(u, (v) => v / (mx > 1 ? 255 : 1)); }
    if (m.close) try { m.close(); } catch (e) {}
    return data ? { w, h, data } : null;
  }
  const pickMask = (r) => (!r ? null : r.getAsFloat32Array || r.getAsUint8Array ? r : (r.confidenceMasks && r.confidenceMasks[0]) || r.categoryMask || null);
  async function aiAlpha(imgEl, nx, ny, W, H) {
    const seg = await withTimeout(getSegmenter(), 45000);
    let mask;
    if (typeof seg.setImage === "function") {
      seg.setImage(imgEl);
      const r = await seg.segment([{ brushMode: 1, point: [{ x: nx, y: ny }], isCompleted: true }]);
      mask = readMask(pickMask(r));
    } else {
      mask = await new Promise((res) => seg.segment(imgEl, { keypoint: { x: nx, y: ny } }, (r) => res(readMask(pickMask(r)))));
    }
    if (!mask) throw new Error("切り抜けませんでした");
    // タップした場所が「対象」側になるように向きをそろえ、表示サイズに合わせる
    const at = mask.data[Math.min(mask.h - 1, Math.floor(ny * mask.h)) * mask.w + Math.min(mask.w - 1, Math.floor(nx * mask.w))];
    const inv = at < 0.5;
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = mask.data[Math.floor((y / H) * mask.h) * mask.w + Math.floor((x / W) * mask.w)];
      if (inv) v = 1 - v;
      out[y * W + x] = Math.max(0, Math.min(1, (v - 0.35) / 0.3));
    }
    return out;
  }

  /* ---------------- ステッカーを作る画面 ---------------- */
  // 完成したら onDone(blob, kind) を呼ぶ。kind は "sticker"（切り抜き）または "photo"（四角のまま）
  function openStickerMaker(albumPhotos, onDone) {
    const ov = document.createElement("div"); ov.className = "maker";
    document.body.appendChild(ov);
    const close = () => ov.remove();
    let work = null, imgEl = null, alpha = null, mode = "ai", lasso = [];

    function stepSource() {
      ov.innerHTML = `<div class="mk-head"><button class="icon-btn" data-k="x" aria-label="閉じる">${icon("back")}</button><b>ステッカーをつくる</b><span></span></div>
        <div class="mk-body">
          <p class="meta" style="margin-bottom:12px">写真を選んで、切り抜きたいものをタップしよう</p>
          ${albumPhotos.length ? `<div class="pick-group" style="margin-top:0">アルバムから</div><div class="album">${albumPhotos.map((p, i) => `<button class="ph" data-k="al" data-i="${i}"><img src="${esc(p.url)}" alt=""></button>`).join("")}</div>` : ""}
          <div class="pick-group">ほかの写真</div>
          <div class="mk-src">
            <label class="btn sub">${icon("camera")}スマホの写真から<input type="file" accept="image/*" hidden data-k="file"></label>
            <button class="btn sub" data-k="paste">${icon("note")}コピーした画像を貼る</button>
          </div>
          <div class="tipbox"><b>iPhoneの切り抜きも使えます</b><br>写真アプリで被写体を長押し →「コピー」→ ここで「コピーした画像を貼る」。背景が消えたまま、すぐステッカーになります。</div>
        </div>`;
      ov.querySelector("[data-k=x]").onclick = close;
      ov.querySelectorAll("[data-k=al]").forEach((b) => (b.onclick = () => guard(async () => start(await loadImg(albumPhotos[Number(b.dataset.i)].url)))));
      ov.querySelector("[data-k=file]").onchange = (e) => guard(async () => { const f = e.target.files[0]; if (f) start(await loadImg(URL.createObjectURL(f))); });
      ov.querySelector("[data-k=paste]").onclick = () => guard(async () => {
        if (!navigator.clipboard || !navigator.clipboard.read) throw new Error("このブラウザでは貼り付けができません。写真を保存してから「スマホの写真から」を使ってください");
        const items = await navigator.clipboard.read();
        for (const it of items) { const t = it.types.find((x) => x.startsWith("image/")); if (t) { start(await loadImg(URL.createObjectURL(await it.getType(t)))); return; } }
        throw new Error("コピーされた画像が見つかりませんでした");
      });
    }

    function start(img) {
      work = fitCanvas(img, 1024);
      if (hasTransparency(work)) { finish(work, "sticker"); return; }
      alpha = null; lasso = []; mode = "ai";
      stepCut();
    }

    function stepCut() {
      ov.innerHTML = `<div class="mk-head"><button class="icon-btn" data-k="b" aria-label="戻る">${icon("back")}</button><b>切り抜く</b><button class="btn sm accent" data-k="ok" ${alpha || mode === "rect" ? "" : "disabled"}>これにする</button></div>
        <div class="mk-tabs" role="tablist">
          <button class="${mode === "ai" ? "on" : ""}" data-m="ai">タップで切り抜く</button>
          <button class="${mode === "lasso" ? "on" : ""}" data-m="lasso">指でなぞる</button>
          <button class="${mode === "rect" ? "on" : ""}" data-m="rect">四角のまま</button>
        </div>
        <div class="mk-stage"><canvas id="mkc"></canvas></div>
        <p class="mk-hint" id="mkh">${mode === "ai" ? "切り抜きたいものをタップしてください（初回は準備に少し時間がかかります）" : mode === "lasso" ? "切り抜きたいものを、指で囲むようになぞってください" : "写真をそのまま、白いふちのステッカーにします"}</p>
        ${alpha ? '<div class="mk-foot"><button class="btn sm ghost" data-k="redo">やり直す</button></div>' : ""}`;
      const c = ov.querySelector("#mkc"), g = c.getContext("2d");
      c.width = work.width; c.height = work.height;
      const draw = () => {
        g.clearRect(0, 0, c.width, c.height);
        if (alpha && mode !== "rect") {
          g.globalAlpha = 0.25; g.drawImage(work, 0, 0); g.globalAlpha = 1;
          g.drawImage(applyMask(work, alpha), 0, 0);
        } else g.drawImage(work, 0, 0);
        if (mode === "lasso" && lasso.length > 1) {
          g.strokeStyle = "#ff3b1f"; g.lineWidth = Math.max(3, c.width / 200); g.setLineDash([12, 8]);
          g.beginPath(); lasso.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]);
        }
      };
      draw();
      const toImg = (e) => { const r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }; };
      ov.querySelector("[data-k=b]").onclick = () => (alpha ? ((alpha = null), (lasso = []), stepCut()) : stepSource());
      ov.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { mode = b.dataset.m; alpha = null; lasso = []; stepCut(); }));
      const redo = ov.querySelector("[data-k=redo]"); if (redo) redo.onclick = () => { alpha = null; lasso = []; stepCut(); };
      ov.querySelector("[data-k=ok]").onclick = () => guard(async () => {
        if (mode === "rect") return finish(work, "photo");
        const cut = trimCanvas(applyMask(work, alpha));
        if (!cut) throw new Error("切り抜く範囲が見つかりませんでした。もう一度試してください");
        finish(cut, "sticker");
      });
      if (mode === "ai") {
        c.onclick = (e) => guard(async () => {
          const p = toImg(e), hint = ov.querySelector("#mkh");
          hint.textContent = "切り抜いています…";
          try {
            if (!imgEl) imgEl = await loadImg(work.toDataURL("image/jpeg", 0.92));
            alpha = await aiAlpha(imgEl, p.x / c.width, p.y / c.height, c.width, c.height);
            stepCut();
          } catch (err) {
            console.warn(err);
            mode = "lasso"; alpha = null; stepCut();
            toast("この端末ではAIの切り抜きが使えませんでした。指でなぞって切り抜いてください");
          }
        });
      } else if (mode === "lasso") {
        let drawing = false;
        c.style.touchAction = "none";
        c.onpointerdown = (e) => { drawing = true; lasso = [toImg(e)]; alpha = null; c.setPointerCapture(e.pointerId); draw(); };
        c.onpointermove = (e) => { if (!drawing) return; lasso.push(toImg(e)); draw(); };
        c.onpointerup = () => {
          drawing = false;
          if (lasso.length < 8) { lasso = []; draw(); return; }
          const m = document.createElement("canvas"); m.width = c.width; m.height = c.height;
          const mg = m.getContext("2d"); mg.fillStyle = "#000"; mg.beginPath(); lasso.forEach((p, i) => (i ? mg.lineTo(p.x, p.y) : mg.moveTo(p.x, p.y))); mg.closePath(); mg.fill();
          const d = mg.getImageData(0, 0, m.width, m.height).data; alpha = new Float32Array(m.width * m.height);
          for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3] / 255;
          stepCut();
        };
      }
    }

    async function finish(canvas, kind) {
      const out = fitCanvas(canvas, 720);
      const blob = await canvasBlob(out, kind === "sticker" ? "image/png" : "image/jpeg", 0.88);
      close(); onDone(blob, kind, out.height / out.width);
    }
    stepSource();
  }

  /* ---------------- ページの描画（画面） ---------------- */
  function itemInner(it, url) {
    if (it.kind === "sticker") return `<img class="c-stk" src="${esc(url || "")}" alt="" draggable="false">`;
    if (it.kind === "photo") return `<div class="c-pho"><img src="${esc(url || "")}" alt="" draggable="false"></div>`;
    if (it.kind === "deco") return `<div class="c-deco">${decoSvg(it.deco, it.color)}</div>`;
    if (it.kind === "tape") return `<div class="c-tape" style="background:${it.color}"></div>`;
    if (it.kind === "text") return `<div class="c-text" style="color:${it.color};font-size:calc(var(--u) * ${it.size || 60})">${esc(it.text).replace(/\n/g, "<br>")}</div>`;
    return "";
  }
  function itemStyle(it) {
    return `left:${it.x / 10}%;top:${(it.y / PAGE_H) * 100}%;width:${it.w / 10}%;transform:translate(-50%,-50%) rotate(${it.rot || 0}deg);z-index:${it.z || 1}`;
  }

  /* ---------------- ページの書き出し（画像） ---------------- */
  function paperDraw(g, paper, W, H) {
    const k = W / PAGE_W;
    const bg = { kraft: "#d7b98e", night: "#1b2340" }[paper] || "#fffdf8";
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = paper === "night" ? "rgba(255,255,255,.08)" : paper === "kraft" ? "rgba(90,60,20,.12)" : "rgba(58,85,200,.13)"; g.lineWidth = Math.max(1, 1.6 * k);
    if (paper === "grid") { for (let x = 0; x <= W; x += 40 * k) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += 40 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (paper === "line") { for (let y = 80 * k; y <= H; y += 56 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (paper === "dot") { g.fillStyle = "rgba(58,85,200,.25)"; for (let x = 20 * k; x < W; x += 40 * k) for (let y = 20 * k; y < H; y += 40 * k) { g.beginPath(); g.arc(x, y, 2.4 * k, 0, Math.PI * 2); g.fill(); } }
    if (paper === "night") { g.fillStyle = "rgba(255,255,255,.7)"; for (let i = 0; i < 70; i++) { const x = ((i * 137) % 1000) * k, y = ((i * 251) % 1333) * k; g.beginPath(); g.arc(x, y, ((i % 3) + 1) * 1.2 * k, 0, Math.PI * 2); g.fill(); } }
  }
  function silhouette(img, w, h, color) {
    const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, w, h);
    return c;
  }
  async function exportPage(page, urls, W) {
    const H = Math.round((W * PAGE_H) / PAGE_W), k = W / PAGE_W;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    paperDraw(g, page.paper, W, H);
    try { await document.fonts.load(`40px "Yomogi"`); } catch (e) {}
    const items = [...page.items].sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const it of items) {
      const w = it.w * k;
      g.save(); g.translate(it.x * k, it.y * k); g.rotate(((it.rot || 0) * Math.PI) / 180);
      try {
        if (it.kind === "sticker" || it.kind === "photo") {
          const img = await loadImg(urls[it.id]);
          const h = w * (it.ratio || img.height / img.width);
          if (it.kind === "sticker") {
            const t = Math.max(3, w * 0.025), sw = silhouette(img, w, h, "#ffffff"), sd = silhouette(img, w, h, "rgba(0,0,0,.18)");
            g.drawImage(sd, -w / 2 + t * 0.6, -h / 2 + t * 1.4);
            for (let a = 0; a < 16; a++) g.drawImage(sw, -w / 2 + Math.cos((a / 16) * Math.PI * 2) * t, -h / 2 + Math.sin((a / 16) * Math.PI * 2) * t);
            g.drawImage(img, -w / 2, -h / 2, w, h);
          } else {
            const pad = w * 0.05, ph = h, bw = w + pad * 2, bh = ph + pad * 2 + w * 0.12;
            g.shadowColor = "rgba(0,0,0,.18)"; g.shadowBlur = 12 * k; g.shadowOffsetY = 4 * k;
            g.fillStyle = "#fff"; g.fillRect(-bw / 2, -bh / 2, bw, bh); g.shadowColor = "transparent";
            g.drawImage(img, -w / 2, -bh / 2 + pad, w, ph);
          }
        } else if (it.kind === "deco") {
          const img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(decoSvg(it.deco, it.color)));
          g.drawImage(img, -w / 2, -w / 2, w, w);
        } else if (it.kind === "tape") {
          const h = w * 0.26; g.globalAlpha = 0.82; g.fillStyle = it.color;
          g.beginPath(); const n = 6; g.moveTo(-w / 2, -h / 2);
          g.lineTo(w / 2, -h / 2); for (let i = 1; i <= n; i++) g.lineTo(w / 2 - (i % 2 ? h * 0.08 : 0), -h / 2 + (h * i) / n);
          g.lineTo(-w / 2, h / 2); for (let i = 1; i <= n; i++) g.lineTo(-w / 2 + (i % 2 ? h * 0.08 : 0), h / 2 - (h * i) / n);
          g.closePath(); g.fill(); g.globalAlpha = 1;
        } else if (it.kind === "text") {
          const fs = (it.size || 60) * k; g.font = `${fs}px "Yomogi", "Hiragino Maru Gothic ProN", sans-serif`; g.fillStyle = it.color; g.textAlign = "center"; g.textBaseline = "middle";
          const lines = String(it.text).split("\n"); lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * fs * 1.3, w));
        }
      } catch (e) { console.warn(e); }
      g.restore();
    }
    return c;
  }

  /* ---------------- 編集画面 ---------------- */
  async function renderEditor(postId, pageId) {
    const post = await S.getPost(postId);
    if (!post) { toast("募集が見つかりません"); location.hash = "#/"; return; }
    const [photos, members, consents] = await Promise.all([S.listEventPhotos(postId), S.listChatMembers(postId), S.listShareConsents(postId)]).catch((e) => { toast("参加メンバーだけが使えます"); location.hash = "#/post/" + postId; throw e; });
    let rec = pageId && pageId !== "new" ? await S.getCraftPage(pageId) : null;
    const mine = !rec || rec.author_id === S.userId();
    let page = rec ? JSON.parse(JSON.stringify(rec.data || {})) : { paper: "grid", items: [] };
    page.paper = page.paper || "grid"; page.items = page.items || [];
    if (!rec && !page.items.length) {
      const t = post.title.replace(/[！!？?。]+$/, "");
      let cut = -1;
      for (let i = Math.min(12, t.length - 2); i >= 4; i--) if ("でのをにとへがは、".includes(t[i - 1])) { cut = i; break; }
      if (cut < 0) cut = Math.min(11, t.length);
      const rest = t.slice(cut);
      const wrapped = t.length > 11 ? t.slice(0, cut) + "\n" + (rest.length > 12 ? rest.slice(0, 11) + "…" : rest) : t;
      const d = post.activity_date ? new Date(post.activity_date) : null;
      if (d) page.items.push({ id: uid(), kind: "text", text: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, color: "#3a55c8", size: 40, x: 500, y: 90, w: 500, rot: 0, z: 1 });
      page.items.push({ id: uid(), kind: "text", text: wrapped, color: "#000000", size: 66, x: 500, y: 200, w: 900, rot: -2, z: 2 });
    }
    let id = rec ? rec.id : null;
    const urls = {};
    await Promise.all(page.items.filter((it) => it.ref).map(async (it) => { urls[it.id] = await S.stickerUrl(it.ref); }));
    let sel = null, dirty = false;

    const title = mine ? "クラフトブック" : `${(rec.author && rec.author.display_name) || ""}さんのページ`;
    const body = `<div class="craft-wrap">
        <div class="craft-page paper-${page.paper}" id="cp"></div>
        ${mine ? `<div class="sel-bar" id="selbar" hidden></div>` : ""}
      </div>
      ${mine ? `<div class="craft-tools">
        <button data-act="addSticker">${icon("camera")}<span>ステッカー</span></button>
        <button data-act="addPhoto">${icon("save")}<span>写真</span></button>
        <button data-act="addDeco">${icon("heart")}<span>シール</span></button>
        <button data-act="addTape">${icon("note")}<span>テープ</span></button>
        <button data-act="addText">${icon("pen")}<span>文字</span></button>
        <button data-act="paper">${icon("door")}<span>紙</span></button>
      </div>` : ""}`;
    const right = `<button class="btn sm sub" data-act="share">${icon("share")}書き出す</button>${mine ? '<button class="btn sm accent" data-act="save" style="margin-left:6px">保存</button>' : ""}`;
    setView(layout({ title, back: true, body, active: "activity", right }), {
      back: () => { if (dirty && !confirm("保存していない変更があります。戻りますか？")) return; back(); },
      save: () => save(true),
      share: () => share(),
      addSticker: () => openStickerMaker(photos, async (blob, kind, ratio) => {
        const ref = await S.uploadSticker(postId, blob);
        const it = { id: uid(), kind, ref, ratio, ...spot(), w: kind === "sticker" ? 460 : 520, rot: (Math.random() * 10 - 5) | 0, z: nextZ() };
        urls[it.id] = await S.stickerUrl(ref); page.items.push(it); select(it.id); changed();
      }),
      addPhoto: () => {
        if (!photos.length) { toast("先にアルバムに写真を追加してください"); return; }
        sheet(`<h2>写真を貼る</h2><p class="meta">ポラロイド風に白いふちがつきます</p><div class="album">${photos.map((p, i) => `<button class="ph" data-act="pick" data-i="${i}"><img src="${esc(p.url)}" alt=""></button>`).join("")}</div>`, {
          pick: async (el, close) => {
            const ph = photos[Number(el.dataset.i)], img = await loadImg(ph.url);
            const ref = ph.path ? { path: ph.path } : { src: ph.url };
            const it = { id: uid(), kind: "photo", ref, ratio: img.height / img.width, ...spot(), w: 520, rot: (Math.random() * 12 - 6) | 0, z: nextZ() };
            urls[it.id] = ph.url; page.items.push(it); close(); select(it.id); changed();
          },
        });
      },
      addDeco: () => {
        let color = "#ff3b1f";
        const grid = () => (window.DOMATE_DECOS || Object.keys(DECO_PATHS)).map((d) => `<button class="deco-btn" data-act="d" data-v="${d}" aria-label="${d}">${decoSvg(d, color)}</button>`).join("");
        const sh = sheet(`<h2>シールを貼る</h2><div class="inks" id="ik">${INKS.map((c) => `<button class="ink${c === color ? " on" : ""}" style="background:${c}" data-act="c" data-v="${c}" aria-label="色 ${c}"></button>`).join("")}</div><div class="deco-grid" id="dg">${grid()}</div>`, {
          c: (el) => { color = el.dataset.v; sh.el.querySelector("#dg").innerHTML = grid(); sh.el.querySelectorAll(".ink").forEach((b) => b.classList.toggle("on", b.dataset.v === color)); },
          d: (el, close) => { const it = { id: uid(), kind: "deco", deco: el.dataset.v, color, ...spot(), w: 200, rot: (Math.random() * 20 - 10) | 0, z: nextZ() }; page.items.push(it); close(); select(it.id); changed(); },
        });
      },
      addTape: () => sheet(`<h2>マスキングテープ</h2><div class="tapes">${TAPES.map((c) => `<button class="tape-btn" style="background:${c}" data-act="t" data-v="${c}" aria-label="テープ ${c}"></button>`).join("")}</div>`, {
        t: (el, close) => { const it = { id: uid(), kind: "tape", color: el.dataset.v, x: 500, y: 500, w: 360, rot: (Math.random() * 30 - 15) | 0, z: nextZ() }; page.items.push(it); close(); select(it.id); changed(); },
      }),
      addText: () => editText(null),
      paper: () => sheet(`<h2>紙をえらぶ</h2><div class="papers">${PAPERS.map((p) => `<button class="paper-btn paper-${p.id}${page.paper === p.id ? " on" : ""}" data-act="p" data-v="${p.id}"><span>${p.name}</span></button>`).join("")}</div>`, {
        p: (el, close) => { page.paper = el.dataset.v; document.getElementById("cp").className = `craft-page paper-${page.paper}`; close(); changed(); },
      }),
    });

    const cp = document.getElementById("cp"), selbar = document.getElementById("selbar");
    const spot = () => ({ x: Math.round(330 + Math.random() * 340), y: Math.round(480 + Math.random() * 520) });
    const nextZ = () => Math.max(0, ...page.items.map((i) => i.z || 0)) + 1;
    const changed = () => { dirty = true; draw(); };
    function draw() {
      cp.style.setProperty("--u", cp.clientWidth / PAGE_W + "px");
      cp.innerHTML = page.items.map((it) => `<div class="c-item k-${it.kind}${sel === it.id ? " sel" : ""}" data-id="${it.id}" style="${itemStyle(it)}">${itemInner(it, urls[it.id])}
        ${mine && sel === it.id ? `<button class="h-del" data-h="del" aria-label="削除">×</button><span class="h-rot" data-h="rot" aria-label="大きさと向き"></span>` : ""}</div>`).join("");
      if (selbar) {
        const it = page.items.find((i) => i.id === sel);
        selbar.hidden = !it;
        if (it) selbar.innerHTML = `<button data-s="front">前へ</button><button data-s="back">後ろへ</button><button data-s="dup">複製</button>${it.kind === "text" ? '<button data-s="edit">文字を編集</button>' : ""}${["text", "deco"].includes(it.kind) ? INKS.slice(0, 6).map((c) => `<button class="ink sm${it.color === c ? " on" : ""}" style="background:${c}" data-s="color" data-v="${c}" aria-label="色"></button>`).join("") : ""}<button data-s="del" class="danger">削除</button>`;
      }
    }
    function select(i) { sel = i; draw(); }
    function editText(it) {
      sheet(`<h2>${it ? "文字を編集" : "文字を書く"}</h2><form data-form="t"><textarea class="input" name="t" maxlength="80" style="min-height:90px" placeholder="例：最高の1日！">${it ? esc(it.text) : ""}</textarea>
        <div class="inks" style="margin-top:12px">${INKS.map((c, n) => `<label class="ink" style="background:${c}"><input type="radio" name="c" value="${c}" ${(it ? it.color === c : n === 0) ? "checked" : ""} aria-label="色"></label>`).join("")}</div>
        <button class="btn block" type="submit" style="margin-top:16px">${it ? "変更する" : "貼る"}</button></form>`, {
        t: (f, close) => {
          const text = f.t.value.trim(); if (!text) return;
          if (it) Object.assign(it, { text, color: f.c.value });
          else { const n = { id: uid(), kind: "text", text, color: f.c.value, size: 60, x: 500, y: 640, w: 700, rot: 0, z: nextZ() }; page.items.push(n); sel = n.id; }
          close(); changed();
        },
      });
    }
    if (selbar) selbar.onclick = (e) => {
      const b = e.target.closest("[data-s]"); if (!b) return;
      const it = page.items.find((i) => i.id === sel); if (!it) return;
      const a = b.dataset.s;
      if (a === "front") it.z = nextZ();
      if (a === "back") { page.items.forEach((i) => (i.z = (i.z || 0) + 1)); it.z = 0; }
      if (a === "dup") { const n = { ...JSON.parse(JSON.stringify(it)), id: uid(), x: it.x + 40, y: it.y + 40, z: nextZ() }; urls[n.id] = urls[it.id]; page.items.push(n); sel = n.id; }
      if (a === "edit") return editText(it);
      if (a === "color") it.color = b.dataset.v;
      if (a === "del") { page.items = page.items.filter((i) => i !== it); sel = null; }
      changed();
    };

    // ドラッグ・拡大縮小・回転（指2本のピンチにも対応）
    if (mine) {
      cp.style.touchAction = "none";
      const pts = new Map(); let g0 = null;
      const unit = () => cp.getBoundingClientRect().width / PAGE_W;
      const toPage = (e) => { const r = cp.getBoundingClientRect(); return { x: (e.clientX - r.left) / unit(), y: (e.clientY - r.top) / unit() }; };
      cp.addEventListener("pointerdown", (e) => {
        const h = e.target.closest("[data-h]"), el = e.target.closest(".c-item");
        if (h && h.dataset.h === "del") { page.items = page.items.filter((i) => i.id !== sel); sel = null; changed(); return; }
        if (!el && pts.size === 1 && g0 && g0.it) {
          cp.setPointerCapture(e.pointerId); pts.set(e.pointerId, toPage(e));
          const [a, b] = [...pts.values()], it = g0.it;
          g0 = { mode: "pinch", it, w: it.w, rot: it.rot || 0, a: Math.atan2(b.y - a.y, b.x - a.x), d: Math.hypot(b.x - a.x, b.y - a.y) };
          e.preventDefault(); return;
        }
        if (!el) { if (!pts.size) select(null); return; }
        if (el.dataset.id !== sel) select(el.dataset.id);
        const it = page.items.find((i) => i.id === sel);
        cp.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, toPage(e));
        const p = toPage(e);
        if (h && h.dataset.h === "rot") g0 = { mode: "rot", it, w: it.w, rot: it.rot || 0, a: Math.atan2(p.y - it.y, p.x - it.x), d: Math.hypot(p.x - it.x, p.y - it.y) };
        else if (pts.size === 2) { const [a, b] = [...pts.values()]; g0 = { mode: "pinch", it, w: it.w, rot: it.rot || 0, a: Math.atan2(b.y - a.y, b.x - a.x), d: Math.hypot(b.x - a.x, b.y - a.y) }; }
        else g0 = { mode: "move", it, x: it.x, y: it.y, px: p.x, py: p.y };
        e.preventDefault();
      });
      cp.addEventListener("pointermove", (e) => {
        if (!g0 || !pts.has(e.pointerId)) return;
        pts.set(e.pointerId, toPage(e));
        const it = g0.it, p = toPage(e);
        if (g0.mode === "move") { it.x = Math.max(0, Math.min(PAGE_W, g0.x + p.x - g0.px)); it.y = Math.max(0, Math.min(PAGE_H, g0.y + p.y - g0.py)); }
        else if (g0.mode === "rot") { const d = Math.hypot(p.x - it.x, p.y - it.y), a = Math.atan2(p.y - it.y, p.x - it.x); it.w = Math.max(60, Math.min(1600, g0.w * (d / g0.d))); it.rot = Math.round(g0.rot + ((a - g0.a) * 180) / Math.PI); }
        else if (g0.mode === "pinch" && pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(b.x - a.x, b.y - a.y), an = Math.atan2(b.y - a.y, b.x - a.x); it.w = Math.max(60, Math.min(1600, g0.w * (d / g0.d))); it.rot = Math.round(g0.rot + ((an - g0.a) * 180) / Math.PI); }
        const el = cp.querySelector(`[data-id="${it.id}"]`); if (el) el.style.cssText = itemStyle(it);
        dirty = true;
      });
      const end = (e) => { pts.delete(e.pointerId); if (!pts.size) g0 = null; else if (g0 && g0.mode === "pinch") { const [p] = [...pts.values()]; g0 = { mode: "move", it: g0.it, x: g0.it.x, y: g0.it.y, px: p.x, py: p.y }; } };
      cp.addEventListener("pointerup", end); cp.addEventListener("pointercancel", end);
    }
    draw();

    async function save(showToast) {
      const prevSel = sel; sel = null; draw();
      const thumb = await canvasBlob(await exportPage(page, urls, 420), "image/jpeg", 0.8);
      const data = { paper: page.paper, items: page.items.map((it) => ({ ...it })) };
      const r = await S.saveCraftPage({ id, post_id: postId, data, thumbBlob: thumb });
      if (!id) { id = r.id; history.replaceState(null, "", `#/craft/${postId}/${id}`); }
      dirty = false; sel = prevSel; draw();
      if (showToast) toast("ページを保存しました");
    }
    async function share() {
      if (mine && dirty) await save(false);
      const canvas = await exportPage(page, urls, 1080);
      const blob = await canvasBlob(canvas, "image/jpeg", 0.92), url = URL.createObjectURL(blob);
      const cons = await S.listShareConsents(postId);
      const allOk = members.every((m) => cons.includes(m.id)), iOk = cons.includes(S.userId());
      const file = new File([blob], "domate-craft.jpg", { type: "image/jpeg" });
      sheet(`<h2>ページを書き出す</h2>
        <img src="${url}" alt="クラフトブックのページ" style="border-radius:12px;margin:10px 0;border:1px solid var(--line)">
        <div class="consent"><span class="meta">外部へのシェアOK：</span>${members.map((m) => `<span class="${cons.includes(m.id) ? "ok" : "ng"}">${cons.includes(m.id) ? "✓" : "・"} ${esc(m.display_name)}</span>`).join("")}</div>
        <button class="btn ${iOk ? "ghost" : "green"} block" data-act="consent" style="margin-top:10px">${iOk ? "シェアOKを取り消す" : "私はシェアOK！"}</button>
        ${allOk ? `<div class="row" style="margin-top:10px"><button class="btn" style="flex:1" data-act="sh">${icon("share")}シェア</button><button class="btn sub" style="flex:1" data-act="dl">${icon("save")}保存</button></div>
          <button class="btn sub block" style="margin-top:10px" data-act="post">domateに体験シェアとして投稿</button>`
        : '<p class="hint" style="text-align:center;margin-top:10px">写っている全員がOKすると、保存・シェア・投稿ができます</p>'}`, {
        consent: async (_a, close) => { await S.setShareConsent(postId, !iOk); close(); toast(iOk ? "取り消しました" : "シェアOKにしました"); share(); },
        dl: () => { const a = document.createElement("a"); a.href = url; a.download = "domate-craft.jpg"; document.body.appendChild(a); a.click(); a.remove(); },
        sh: async () => { if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: post.title, text: `${post.title} #domate` }); } catch (e) {} } else toast("この端末ではシェアできないので、保存してから投稿してください"); },
        post: (_a, close) => { setPendingImage(blob, post); close(); location.hash = `#/new?kind=experience&from=${post.id}&collage=1`; },
      });
    }
  }

  /* ---------------- マイブック ---------------- */
  async function renderBook() {
    const pages = await S.listMyCraftPages();
    const body = `<p class="meta" style="margin:4px 4px 14px">参加したイベントで作ったページが、1冊のノートにまとまります。</p>
      ${pages.length ? `<div class="book">${pages.map((p) => `<a class="book-page" href="#/craft/${p.post_id}/${p.id}">
          ${p.thumb_url ? `<img src="${esc(p.thumb_url)}" alt="">` : '<div class="blank"></div>'}
          <span class="cap">${esc((p.post && p.post.title) || "")}</span></a>`).join("")}</div>`
      : `<div class="empty"><div class="big"></div><p>まだページがありません。<br>参加したイベントが終わったら、「おもいで」からページを作れます</p><a class="btn" style="margin-top:14px" href="#/activity">参加したイベントを見る</a></div>`}`;
    setView(layout({ title: "マイブック", back: true, body, active: "me" }), { back });
  }

  return { renderEditor, renderBook, openStickerMaker, exportPage };
};
