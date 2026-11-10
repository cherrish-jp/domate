// DoMate データ層
// デモモード（ブラウザ内保存）と本番モード（Supabase）を同じ使い方で扱えるようにしています。
(function () {
  const cfg = window.DOMATE_CONFIG || {};
  const hasSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  /* =========================================================
     デモモード
     ========================================================= */
  function LocalStore() {
    const KEY = "domate-demo-v3";
    const iso = (t) => new Date(t).toISOString();
    const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const H = 3600e3, D = 24 * H;
    const at = (days, hour) => { const d = new Date(Date.now() + days * D); d.setHours(hour, 0, 0, 0); return iso(d.getTime()); };

    // デモ用の写真（その場で絵を描いて作る）
    function makePhoto(c1, c2, emoji, label) {
      try {
        const c = document.createElement("canvas"); c.width = 640; c.height = 480;
        const g = c.getContext("2d");
        const gr = g.createLinearGradient(0, 0, 640, 480); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.fillRect(0, 0, 640, 480);
        g.fillStyle = "rgba(255,255,255,.18)";
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(80 + i * 110, 90 + (i % 2) * 300, 50 + (i % 3) * 20, 0, Math.PI * 2); g.fill(); }
        g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "150px sans-serif"; g.fillText(emoji, 320, 210);
        g.fillStyle = "#fff"; g.font = "bold 40px sans-serif"; g.fillText(label, 320, 380);
        return c.toDataURL("image/jpeg", 0.75);
      } catch (e) { return null; }
    }

    function seed() {
      const now = Date.now();
      return {
        me: "u_me",
        profiles: [
          { id: "u_me", display_name: "あなた", bio: "", gender: "none", age_range: "20s", created_at: iso(now - 30 * D) },
          { id: "u_a", display_name: "はるか", bio: "週末は山とカフェ", gender: "female", age_range: "20s", created_at: iso(now - 60 * D) },
          { id: "u_b", display_name: "そうた", bio: "ボドゲと料理が好き", gender: "male", age_range: "20s", created_at: iso(now - 45 * D) },
          { id: "u_c", display_name: "みお", bio: "写真とおさんぽ", gender: "female", age_range: "30s", created_at: iso(now - 20 * D) },
        ],
        rooms: [
          { id: "r1", name: "ゼミの仲間", description: "ゼミメンバーだけの部屋", invite_code: "zemi2026", owner_id: "u_me", created_at: iso(now - 5 * D) },
        ],
        room_members: [
          { room_id: "r1", user_id: "u_me", role: "owner" },
          { room_id: "r1", user_id: "u_a", role: "member", nickname: "はるちゃん", bio: "ゼミの写真係" },
        ],
        posts: [
          { id: "p1", category: "outdoor", line: "oh", station: "伊勢原", author_id: "u_a", kind: "experience", title: "早起きして山頂で朝焼けを見た", body: "朝5時に出発して、山頂で朝焼けを見てきました。寒かったけど、空がピンクからオレンジに変わっていくのが本当にきれいで、早起きした甲斐があった…！下山後の朝ごはんも最高でした。", visibility: "public", room_id: null, created_at: iso(now - 3 * H) },
          { id: "p2", category: "game", line: "jy", station: "渋谷", author_id: "u_b", kind: "recruit", title: "今週末ボードゲームカフェ行く人！", body: "気になってたボドゲカフェに行きたいけど、一人だとハードルが高くて…。ゆるく遊べる人募集です！", visibility: "public", room_id: null, activity_date: at(3, 14), area: "渋谷", capacity: 3, conditions: "初心者歓迎・ルールは教えます", status: "open", created_at: iso(now - 6 * H) },
          { id: "p3", category: "food", line: "jc", station: "高円寺", author_id: "u_c", kind: "experience", title: "商店街の食べ歩きスタンプラリー", body: "地元の商店街でやってたスタンプラリーに参加。コロッケ、たい焼き、みたらし団子…全部制覇しました。お店の人と話せるのも楽しかった！", visibility: "public", room_id: null, created_at: iso(now - 1 * D) },
          { id: "p4", category: "sports", line: "g", station: "表参道", author_id: "u_me", kind: "recruit", title: "朝ランしてからカフェで朝ごはん", body: "週末の朝、軽く5kmくらい走ってから表参道のカフェでモーニングしたいです。一人だと起きられないので…！", visibility: "public", room_id: null, activity_date: at(5, 7), area: "表参道", capacity: 4, conditions: "ゆっくりペース・ラン初心者歓迎", status: "open", created_at: iso(now - 2 * D) },
          { id: "p5", category: "food", line: "ty", station: "日吉", author_id: "u_a", kind: "experience", title: "ゼミ後に行ったカレー屋が最高だった", body: "駅の裏のスパイスカレー屋さん、みんなで行ったら大当たりでした。次は辛さ5に挑戦したい。", visibility: "room", room_id: "r1", created_at: iso(now - 2 * H) },
          { id: "p8", category: "sports", line: "jy", station: "池袋", author_id: "u_b", kind: "recruit", title: "ボウリングで本気の3ゲーム勝負", body: "負けた人がジュースおごりで！ゆるく本気でやりましょう。", visibility: "public", room_id: null, activity_date: at(-2, 18), end_at: at(-2, 21), area: "池袋", capacity: 3, conditions: "スコア100以下でも大歓迎", status: "closed", created_at: iso(now - 6 * D) },
          { id: "p6", category: "walk", line: "jy", station: "日暮里", author_id: "u_c", kind: "recruit", title: "フィルムカメラでおさんぽしませんか", body: "古い街並みをのんびり歩きながら写真を撮りたいです。", visibility: "public", room_id: null, activity_date: at(9, 10), area: "日暮里", capacity: 2, conditions: "カメラがなくてもOK", status: "open", created_at: iso(now - 3 * D) },
        ],
        likes: [
          { post_id: "p1", user_id: "u_b" }, { post_id: "p1", user_id: "u_c" },
          { post_id: "p3", user_id: "u_a" }, { post_id: "p5", user_id: "u_me" },
        ],
        comments: [
          { id: "c1", post_id: "p1", author_id: "u_c", body: "朝焼けの山、憧れる…！次行くとき誘ってほしい！", created_at: iso(now - 2 * H) },
          { id: "c2", post_id: "p3", author_id: "u_b", body: "たい焼きのお店どこですか？", created_at: iso(now - 20 * H) },
        ],
        join_requests: [
          { id: "j1", post_id: "p4", user_id: "u_a", message: "走るの久しぶりですが参加したいです！", status: "approved", created_at: iso(now - 30 * H) },
          { id: "j3", post_id: "p8", user_id: "u_me", message: "ボウリング久しぶりです！", status: "approved", created_at: iso(now - 5 * D) },
          { id: "j4", post_id: "p8", user_id: "u_c", message: "行きたい！", status: "approved", created_at: iso(now - 5 * D) },
          { id: "j2", post_id: "p4", user_id: "u_b", message: "5kmならいけそうです！", status: "pending", created_at: iso(now - 5 * H) },
        ],
        messages: [
          { id: "m1", post_id: "p4", author_id: "u_me", body: "参加ありがとうございます！当日は駅の改札前に集合でお願いします", created_at: iso(now - 28 * H) },
          { id: "m2", post_id: "p4", author_id: "u_a", body: "了解です！楽しみにしてます〜", created_at: iso(now - 27 * H) },
        ],
        event_photos: [
          { id: "ph1", post_id: "p8", uploader_id: "u_b", data: makePhoto("#f08a5d", "#e2574c", "🎳", "STRIKE!"), created_at: iso(now - 2 * D + 2 * H) },
          { id: "ph2", post_id: "p8", uploader_id: "u_c", data: makePhoto("#6c9bd2", "#b58ad9", "🥤", "おごりジュース"), created_at: iso(now - 2 * D + 2 * H) },
          { id: "ph3", post_id: "p8", uploader_id: "u_b", data: makePhoto("#5bae5b", "#d9a441", "🏆", "優勝 そうた"), created_at: iso(now - 2 * D + 3 * H) },
          { id: "ph4", post_id: "p8", uploader_id: "u_c", data: makePhoto("#e58fb0", "#f4a7b9", "📸", "3人で記念撮影"), created_at: iso(now - 2 * D + 3 * H) },
        ],
        share_consents: [
          { post_id: "p8", user_id: "u_b" }, { post_id: "p8", user_id: "u_c" },
        ],
        reports: [],
        blocks: [],
      };
    }

    function load() {
      try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
      return seed();
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch (e) { throw new Error("ブラウザの保存容量がいっぱいです。写真付きの投稿を減らしてください。"); }
    }
    let db = load();
    const me = () => db.me;
    const endT = (p) => (p.end_at ? new Date(p.end_at).getTime() : p.activity_date ? new Date(p.activity_date).getTime() + 3 * H : Infinity);
    const hostedCount = (uid) => db.posts.filter((p) => p.author_id === uid && p.kind === "recruit" && endT(p) < Date.now() && db.join_requests.some((j) => j.post_id === p.id && j.status === "approved")).length;
    const joinedCount = (uid) => db.join_requests.filter((j) => j.user_id === uid && j.status === "approved" && (() => { const p = db.posts.find((x) => x.id === j.post_id); return p && endT(p) < Date.now(); })()).length;
    const prof = (id) => {
      const p = db.profiles.find((x) => x.id === id);
      return p ? { id: p.id, display_name: p.display_name, gender: p.gender, age_range: p.age_range, hosted_count: hostedCount(id), joined_count: joinedCount(id) } : { id, display_name: "退会したユーザー" };
    };
    const isMember = (roomId) => db.room_members.some((m) => m.room_id === roomId && m.user_id === me());
    const canSee = (p) => p && (p.visibility === "public" || p.author_id === me() || (p.room_id && isMember(p.room_id)));
    const memberIds = (p) => [p.author_id, ...db.join_requests.filter((j) => j.post_id === p.id && j.status === "approved").map((j) => j.user_id)];
    const isChatMember = (p) => p.author_id === me() || db.join_requests.some((j) => j.post_id === p.id && j.user_id === me() && j.status === "approved");
    const decorate = (p) => {
      const room = p.room_id ? db.rooms.find((r) => r.id === p.room_id) : null;
      const mine = db.join_requests.find((j) => j.post_id === p.id && j.user_id === me());
      return {
        ...p,
        author: prof(p.author_id),
        room: room ? { id: room.id, name: room.name } : null,
        like_count: db.likes.filter((l) => l.post_id === p.id).length,
        liked_by_me: db.likes.some((l) => l.post_id === p.id && l.user_id === me()),
        comment_count: db.comments.filter((c) => c.post_id === p.id).length,
        approved_count: db.join_requests.filter((j) => j.post_id === p.id && j.status === "approved").length,
        my_request_status: mine ? mine.status : null,
      };
    };
    const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : -1);
    const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    const need = (cond, msg) => { if (!cond) throw new Error(msg); };

    return {
      mode: "demo",
      async init() { return { id: me() }; },
      userId: () => me(),
      demoUsers: () => db.profiles.map((p) => ({ id: p.id, display_name: p.display_name })),
      async switchUser(id) { db.me = id; save(); },
      async resetDemo() { db = seed(); save(); },
      async signUp() {}, async signIn() {}, async signOut() {},

      async getMyProfile() { return { ...db.profiles.find((p) => p.id === me()) }; },
      async updateProfile(patch) { Object.assign(db.profiles.find((p) => p.id === me()), patch); save(); },

      async listPosts({ roomId, kind, categories, stations, from, to } = {}) {
        return db.posts
          .filter((p) => (roomId ? p.room_id === roomId : p.visibility === "public"))
          .filter((p) => !kind || p.kind === kind)
          .filter((p) => !categories || !categories.length || categories.includes(p.category))
          .filter((p) => !stations || !stations.length || stations.includes(p.station))
          .filter((p) => !from || (p.activity_date && p.activity_date >= from && p.activity_date < to))
          .filter(canSee).sort(byNewest).map(decorate);
      },
      async getPublicProfile(uid) {
        const p = db.profiles.find((x) => x.id === uid); if (!p) return null;
        return { ...prof(uid), bio: p.bio, created_at: p.created_at };
      },
      async getRoomMembers(roomId) {
        need(isMember(roomId), "このルームのメンバーではありません");
        return db.room_members.filter((m) => m.room_id === roomId).map((m) => ({ user_id: m.user_id, role: m.role, nickname: m.nickname || null, bio: m.bio || null }));
      },
      async updateRoomProfile(roomId, patch) {
        const m = db.room_members.find((x) => x.room_id === roomId && x.user_id === me()); need(m, "このルームのメンバーではありません");
        Object.assign(m, patch); save();
      },
      async listMyPosts() { return db.posts.filter((p) => p.author_id === me()).sort(byNewest).map(decorate); },
      async getPost(id) { const p = db.posts.find((x) => x.id === id); return canSee(p) ? decorate(p) : null; },
      async createPost(data, imageBlob) {
        if (data.visibility === "room") need(isMember(data.room_id), "このルームのメンバーではありません");
        const post = { ...data, id: newId(), author_id: me(), image_url: imageBlob ? await blobToDataUrl(imageBlob) : null, status: "open", created_at: iso(Date.now()) };
        db.posts.push(post); save(); return { id: post.id };
      },
      async updatePost(id, patch) { const p = db.posts.find((x) => x.id === id); need(p && p.author_id === me(), "権限がありません"); Object.assign(p, patch); save(); },
      async deletePost(id) {
        const p = db.posts.find((x) => x.id === id); need(p && p.author_id === me(), "権限がありません");
        db.posts = db.posts.filter((x) => x.id !== id);
        ["likes", "comments", "join_requests", "messages", "event_photos", "share_consents"].forEach((t) => (db[t] = db[t].filter((x) => x.post_id !== id)));
        save();
      },

      async toggleLike(post) {
        const i = db.likes.findIndex((l) => l.post_id === post.id && l.user_id === me());
        if (i >= 0) db.likes.splice(i, 1); else db.likes.push({ post_id: post.id, user_id: me() });
        save();
      },
      async listComments(postId) { return db.comments.filter((c) => c.post_id === postId).sort((a, b) => (a.created_at > b.created_at ? 1 : -1)).map((c) => ({ ...c, author: prof(c.author_id) })); },
      async addComment(postId, body) { db.comments.push({ id: newId(), post_id: postId, author_id: me(), body, created_at: iso(Date.now()) }); save(); },
      async deleteComment(id) { db.comments = db.comments.filter((c) => !(c.id === id && c.author_id === me())); save(); },

      async requestJoin(postId, message) {
        const p = db.posts.find((x) => x.id === postId);
        need(p && p.kind === "recruit" && p.status === "open" && p.author_id !== me(), "この募集には申請できません");
        need(!db.join_requests.some((j) => j.post_id === postId && j.user_id === me()), "すでに申請しています");
        db.join_requests.push({ id: newId(), post_id: postId, user_id: me(), message, status: "pending", created_at: iso(Date.now()) }); save();
      },
      async cancelJoin(postId) { db.join_requests = db.join_requests.filter((j) => !(j.post_id === postId && j.user_id === me())); save(); },
      async listRequests(postId) { return db.join_requests.filter((j) => j.post_id === postId).sort((a, b) => (a.created_at > b.created_at ? 1 : -1)).map((j) => ({ ...j, user: prof(j.user_id) })); },
      async setRequestStatus(id, status) {
        const j = db.join_requests.find((x) => x.id === id);
        const p = j && db.posts.find((x) => x.id === j.post_id);
        need(p && p.author_id === me(), "権限がありません"); j.status = status; save();
      },
      async listMyRequests() {
        return db.join_requests.filter((j) => j.user_id === me()).map((j) => {
          const p = db.posts.find((x) => x.id === j.post_id);
          return { ...j, post: p ? { id: p.id, title: p.title, activity_date: p.activity_date, end_at: p.end_at, area: p.area } : null };
        });
      },

      async listMessages(postId) {
        const p = db.posts.find((x) => x.id === postId); need(p && isChatMember(p), "チャットに参加していません");
        return db.messages.filter((m) => m.post_id === postId).sort((a, b) => (a.created_at > b.created_at ? 1 : -1)).map((m) => ({ ...m, author: prof(m.author_id) }));
      },
      async sendMessage(postId, body) {
        const p = db.posts.find((x) => x.id === postId); need(p && isChatMember(p), "チャットに参加していません");
        db.messages.push({ id: newId(), post_id: postId, author_id: me(), body, created_at: iso(Date.now()) }); save();
      },

      async listChatMembers(postId) {
        const p = db.posts.find((x) => x.id === postId); need(p && isChatMember(p), "参加者ではありません");
        return memberIds(p).map(prof);
      },
      async listEventPhotos(postId) {
        const p = db.posts.find((x) => x.id === postId); need(p && isChatMember(p), "参加者ではありません");
        return db.event_photos.filter((x) => x.post_id === postId && x.data).map((x) => ({ ...x, url: x.data, uploader: prof(x.uploader_id) }));
      },
      async uploadEventPhoto(postId, blob) {
        const p = db.posts.find((x) => x.id === postId); need(p && isChatMember(p), "参加者ではありません");
        db.event_photos.push({ id: newId(), post_id: postId, uploader_id: me(), data: await blobToDataUrl(blob), created_at: iso(Date.now()) }); save();
      },
      async deleteEventPhoto(photo) { db.event_photos = db.event_photos.filter((x) => !(x.id === photo.id && x.uploader_id === me())); save(); },
      async listShareConsents(postId) { return db.share_consents.filter((c) => c.post_id === postId).map((c) => c.user_id); },
      async setShareConsent(postId, okay) {
        db.share_consents = db.share_consents.filter((c) => !(c.post_id === postId && c.user_id === me()));
        if (okay) db.share_consents.push({ post_id: postId, user_id: me() });
        save();
      },

      async listMyRooms() {
        return db.room_members.filter((m) => m.user_id === me()).map((m) => {
          const r = db.rooms.find((x) => x.id === m.room_id);
          return { ...r, role: m.role, member_count: db.room_members.filter((x) => x.room_id === r.id).length };
        });
      },
      async getRoom(id) {
        if (!isMember(id)) return null;
        const r = db.rooms.find((x) => x.id === id);
        return r ? { ...r, member_count: db.room_members.filter((x) => x.room_id === id).length } : null;
      },
      async createRoom(name, description) {
        const r = { id: newId(), name, description, invite_code: Math.random().toString(36).slice(2, 10), owner_id: me(), created_at: iso(Date.now()) };
        db.rooms.push(r); db.room_members.push({ room_id: r.id, user_id: me(), role: "owner" }); save(); return r;
      },
      async joinRoom(code) {
        const r = db.rooms.find((x) => x.invite_code === code); need(r, "招待コードが見つかりません");
        if (!isMember(r.id)) { db.room_members.push({ room_id: r.id, user_id: me(), role: "member" }); save(); }
        return r;
      },
      async leaveRoom(id) { db.room_members = db.room_members.filter((m) => !(m.room_id === id && m.user_id === me())); save(); },

      async report(target_type, target_id, reason) { db.reports.push({ id: newId(), reporter_id: me(), target_type, target_id, reason, created_at: iso(Date.now()) }); save(); },
      async listBlocks() { return db.blocks.filter((b) => b.blocker_id === me()).map((b) => ({ blocked_id: b.blocked_id, blocked: prof(b.blocked_id) })); },
      async block(userId) { if (!db.blocks.some((b) => b.blocker_id === me() && b.blocked_id === userId)) { db.blocks.push({ blocker_id: me(), blocked_id: userId }); save(); } },
      async unblock(userId) { db.blocks = db.blocks.filter((b) => !(b.blocker_id === me() && b.blocked_id === userId)); save(); },
    };
  }

  /* =========================================================
     本番モード（Supabase）
     ========================================================= */
  function SupaStore() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    let user = null;
    const POST =
      "*, author:profiles!posts_author_id_fkey(id,display_name,gender,age_range,hosted_count,joined_count), room:rooms!posts_room_id_fkey(id,name), like_count, liked_by_me, comment_count, approved_count, my_request_status";
    const ok = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };
    function friendly(e) {
      const m = (e && e.message) || String(e);
      if (/Invalid login credentials/i.test(m)) return "メールアドレスかパスワードが違います";
      if (/Email not confirmed/i.test(m)) return "メールの確認がまだです。届いたメールのリンクを開いてください";
      if (/already registered/i.test(m)) return "このメールアドレスはすでに登録されています";
      if (/Password should be/i.test(m)) return "パスワードは6文字以上にしてください";
      if (/rate limit/i.test(m)) return "短時間に操作が集中しました。少し待ってからもう一度お試しください";
      if (/room not found/i.test(m)) return "招待コードが見つかりません";
      if (/row-level security/i.test(m)) return "この操作をする権限がありません";
      return m;
    }
    const me = () => user && user.id;

    return {
      mode: "supabase",
      async init() {
        const { data } = await sb.auth.getSession();
        user = data.session ? data.session.user : null;
        sb.auth.onAuthStateChange((_e, s) => { user = s ? s.user : null; });
        return user;
      },
      userId: me,
      async signUp({ email, password, displayName, gender, ageRange }) {
        const r = await sb.auth.signUp({
          email, password,
          options: { data: { display_name: displayName, age_confirmed: true, gender: gender || "none", age_range: ageRange || "" }, emailRedirectTo: location.origin + location.pathname },
        });
        if (r.error) throw new Error(friendly(r.error));
        user = r.data.session ? r.data.session.user : null;
        return { needsConfirm: !r.data.session };
      },
      async signIn({ email, password }) {
        const r = await sb.auth.signInWithPassword({ email, password });
        if (r.error) throw new Error(friendly(r.error));
        user = r.data.user;
      },
      async signOut() { await sb.auth.signOut(); user = null; },

      async getMyProfile() { return ok(await sb.from("profiles").select("*").eq("id", me()).single()); },
      async updateProfile(patch) { ok(await sb.from("profiles").update(patch).eq("id", me())); },

      async listPosts({ roomId, kind, categories, stations, from, to } = {}) {
        let q = sb.from("posts").select(POST).order("created_at", { ascending: false }).limit(100);
        q = roomId ? q.eq("room_id", roomId) : q.eq("visibility", "public");
        if (kind) q = q.eq("kind", kind);
        if (categories && categories.length) q = q.in("category", categories);
        if (stations && stations.length) q = q.in("station", stations);
        if (from) q = q.gte("activity_date", from).lt("activity_date", to);
        return ok(await q);
      },
      async getPublicProfile(uid) {
        return ok(await sb.from("profiles").select("id,display_name,bio,gender,age_range,created_at,hosted_count,joined_count").eq("id", uid).maybeSingle());
      },
      async getRoomMembers(roomId) { return ok(await sb.from("room_members").select("user_id,role,nickname,bio").eq("room_id", roomId)); },
      async updateRoomProfile(roomId, patch) { ok(await sb.from("room_members").update(patch).eq("room_id", roomId).eq("user_id", me())); },
      async listMyPosts() { return ok(await sb.from("posts").select(POST).eq("author_id", me()).order("created_at", { ascending: false })); },
      async getPost(id) { return ok(await sb.from("posts").select(POST).eq("id", id).maybeSingle()); },
      async createPost(data, imageBlob) {
        let image_url = null;
        if (imageBlob) {
          const path = `${me()}/${Date.now()}.jpg`;
          ok(await sb.storage.from("post-images").upload(path, imageBlob, { contentType: "image/jpeg" }));
          image_url = sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
        }
        return ok(await sb.from("posts").insert({ ...data, author_id: me(), image_url }).select("id").single());
      },
      async updatePost(id, patch) { ok(await sb.from("posts").update(patch).eq("id", id)); },
      async deletePost(id) { ok(await sb.from("posts").delete().eq("id", id)); },

      async toggleLike(post) {
        if (post.liked_by_me) ok(await sb.from("likes").delete().eq("post_id", post.id).eq("user_id", me()));
        else ok(await sb.from("likes").insert({ post_id: post.id, user_id: me() }));
      },
      async listComments(postId) { return ok(await sb.from("comments").select("*, author:profiles(id,display_name)").eq("post_id", postId).order("created_at")); },
      async addComment(postId, body) { ok(await sb.from("comments").insert({ post_id: postId, author_id: me(), body })); },
      async deleteComment(id) { ok(await sb.from("comments").delete().eq("id", id)); },

      async requestJoin(postId, message) { ok(await sb.from("join_requests").insert({ post_id: postId, user_id: me(), message })); },
      async cancelJoin(postId) { ok(await sb.from("join_requests").delete().eq("post_id", postId).eq("user_id", me())); },
      async listRequests(postId) { return ok(await sb.from("join_requests").select("*, user:profiles(id,display_name,gender,age_range,hosted_count,joined_count)").eq("post_id", postId).order("created_at")); },
      async setRequestStatus(id, status) { ok(await sb.from("join_requests").update({ status }).eq("id", id)); },
      async listMyRequests() { return ok(await sb.from("join_requests").select("*, post:posts!join_requests_post_id_fkey(id,title,activity_date,end_at,area)").eq("user_id", me()).order("created_at", { ascending: false })); },

      async listMessages(postId) { return ok(await sb.from("messages").select("*, author:profiles(id,display_name)").eq("post_id", postId).order("created_at").limit(300)); },
      async sendMessage(postId, body) { ok(await sb.from("messages").insert({ post_id: postId, author_id: me(), body })); },

      async listChatMembers(postId) { return ok(await sb.rpc("chat_members", { p: postId })); },
      async listEventPhotos(postId) {
        const rows = ok(await sb.from("event_photos").select("*, uploader:profiles(id,display_name)").eq("post_id", postId).order("created_at"));
        const withUrls = await Promise.all(rows.map(async (r) => {
          const { data, error } = await sb.storage.from("event-photos").download(r.path);
          return error ? null : { ...r, url: URL.createObjectURL(data) };
        }));
        return withUrls.filter(Boolean);
      },
      async uploadEventPhoto(postId, blob) {
        const path = `${postId}/${me()}-${Date.now()}.jpg`;
        ok(await sb.storage.from("event-photos").upload(path, blob, { contentType: "image/jpeg" }));
        ok(await sb.from("event_photos").insert({ post_id: postId, uploader_id: me(), path }));
      },
      async deleteEventPhoto(photo) {
        await sb.storage.from("event-photos").remove([photo.path]);
        ok(await sb.from("event_photos").delete().eq("id", photo.id));
      },
      async listShareConsents(postId) { return ok(await sb.from("share_consents").select("user_id").eq("post_id", postId)).map((r) => r.user_id); },
      async setShareConsent(postId, okay) {
        if (okay) ok(await sb.from("share_consents").upsert({ post_id: postId, user_id: me() }));
        else ok(await sb.from("share_consents").delete().eq("post_id", postId).eq("user_id", me()));
      },

      async listMyRooms() {
        const rows = ok(await sb.from("room_members").select("role, room:rooms(*)").eq("user_id", me()));
        return rows.filter((r) => r.room).map((r) => ({ ...r.room, role: r.role }));
      },
      async getRoom(id) { return ok(await sb.from("rooms").select("*").eq("id", id).maybeSingle()); },
      async createRoom(name, description) { return ok(await sb.rpc("create_room", { p_name: name, p_description: description })); },
      async joinRoom(code) { return ok(await sb.rpc("join_room", { p_code: code })); },
      async leaveRoom(id) { ok(await sb.from("room_members").delete().eq("room_id", id).eq("user_id", me())); },

      async report(target_type, target_id, reason) { ok(await sb.from("reports").insert({ reporter_id: me(), target_type, target_id, reason })); },
      async listBlocks() { return ok(await sb.from("blocks").select("blocked_id, blocked:profiles!blocks_blocked_id_fkey(id,display_name)").eq("blocker_id", me())); },
      async block(userId) { ok(await sb.from("blocks").upsert({ blocker_id: me(), blocked_id: userId })); },
      async unblock(userId) { ok(await sb.from("blocks").delete().eq("blocker_id", me()).eq("blocked_id", userId)); },
    };
  }

  window.DomateStore = hasSupabase ? SupaStore() : LocalStore();
})();
