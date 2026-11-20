-- =============================================================
-- 追加⑤：クラフトブック（ステッカーで作るおもいでページ）と、地名（市区町村）での検索
-- SQL Editor に貼り付けて Run（何度実行しても大丈夫です）
-- =============================================================

-- 投稿：市区町村
alter table public.posts add column if not exists city text check (city is null or char_length(city) <= 20);
create index if not exists posts_city_idx on public.posts (city);

-- クラフトブックのページ（イベントの参加メンバーだけが見られる）
create table if not exists public.craft_pages (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}',
  thumb_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists craft_pages_post_idx on public.craft_pages (post_id);
create index if not exists craft_pages_author_idx on public.craft_pages (author_id);
alter table public.craft_pages enable row level security;

drop policy if exists "craft: read members" on public.craft_pages;
create policy "craft: read members" on public.craft_pages for select to authenticated using (is_chat_member(post_id));
drop policy if exists "craft: insert own" on public.craft_pages;
create policy "craft: insert own" on public.craft_pages for insert to authenticated
  with check (author_id = auth.uid() and is_chat_member(post_id));
drop policy if exists "craft: update own" on public.craft_pages;
create policy "craft: update own" on public.craft_pages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and is_chat_member(post_id));
drop policy if exists "craft: delete own" on public.craft_pages;
create policy "craft: delete own" on public.craft_pages for delete to authenticated using (author_id = auth.uid());

-- ステッカーとページの画像は、これまでのイベント写真と同じ非公開の保存場所（event-photos）に入ります。
-- 参加メンバーだけが読み書きできる設定は、追加①で作成済みです。
