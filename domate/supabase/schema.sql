-- =============================================================
-- DoMate データベース設定
-- Supabase の管理画面 → SQL Editor に全部貼り付けて「Run」するだけでOK
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- テーブル ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ななし' check (char_length(display_name) between 1 and 20),
  bio text not null default '' check (char_length(bio) <= 160),
  age_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 200),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('experience', 'recruit')),
  title text not null check (char_length(title) between 1 and 60),
  body text not null default '' check (char_length(body) <= 2000),
  image_url text,
  visibility text not null default 'public' check (visibility in ('public', 'room')),
  room_id uuid references public.rooms(id) on delete cascade,
  activity_date timestamptz,
  area text check (area is null or char_length(area) <= 40),
  capacity int check (capacity is null or capacity between 1 and 100),
  conditions text check (conditions is null or char_length(conditions) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  constraint room_visibility check ((visibility = 'room') = (room_id is not null))
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_room_idx on public.posts (room_id);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'message')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------- 新規登録したらプロフィールを自動作成 ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, age_confirmed)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'ななし'), 20),
    coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false)
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 権限チェック用の関数 ----------

create or replace function public.is_room_member(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_members where room_id = r and user_id = auth.uid());
$$;

create or replace function public.can_see_post(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts
    where id = p
      and (visibility = 'public' or author_id = auth.uid() or (room_id is not null and is_room_member(room_id)))
  );
$$;

create or replace function public.is_post_author(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts where id = p and author_id = auth.uid());
$$;

create or replace function public.is_chat_member(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_post_author(p)
      or exists (select 1 from join_requests where post_id = p and user_id = auth.uid() and status = 'approved');
$$;

create or replace function public.can_request_join(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select can_see_post(p) and exists (
    select 1 from posts where id = p and kind = 'recruit' and status = 'open' and author_id <> auth.uid()
  );
$$;

-- ---------- 投稿一覧で使う集計（計算列） ----------

create or replace function public.like_count(public.posts)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from likes where post_id = $1.id;
$$;

create or replace function public.liked_by_me(public.posts)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from likes where post_id = $1.id and user_id = auth.uid());
$$;

create or replace function public.comment_count(public.posts)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from comments where post_id = $1.id;
$$;

create or replace function public.approved_count(public.posts)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from join_requests where post_id = $1.id and status = 'approved';
$$;

create or replace function public.my_request_status(public.posts)
returns text language sql stable security definer set search_path = public as $$
  select status from join_requests where post_id = $1.id and user_id = auth.uid();
$$;

-- ---------- ルームの作成・参加 ----------

create or replace function public.create_room(p_name text, p_description text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into rooms (name, description, owner_id)
  values (p_name, coalesce(p_description, ''), auth.uid())
  returning * into r;
  insert into room_members (room_id, user_id, role) values (r.id, auth.uid(), 'owner');
  return r;
end $$;

create or replace function public.join_room(p_code text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into r from rooms where invite_code = p_code;
  if not found then raise exception 'room not found'; end if;
  insert into room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  return r;
end $$;

-- ---------- 行レベルセキュリティ（RLS） ----------

alter table public.profiles      enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_members  enable row level security;
alter table public.posts         enable row level security;
alter table public.likes         enable row level security;
alter table public.comments      enable row level security;
alter table public.join_requests enable row level security;
alter table public.messages      enable row level security;
alter table public.reports       enable row level security;
alter table public.blocks        enable row level security;

-- profiles
drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- rooms（作成・参加は上の関数経由）
drop policy if exists "rooms: members read" on public.rooms;
create policy "rooms: members read" on public.rooms for select to authenticated using (is_room_member(id));
drop policy if exists "rooms: owner update" on public.rooms;
create policy "rooms: owner update" on public.rooms for update to authenticated using (owner_id = auth.uid());
drop policy if exists "rooms: owner delete" on public.rooms;
create policy "rooms: owner delete" on public.rooms for delete to authenticated using (owner_id = auth.uid());

-- room_members
drop policy if exists "members: read" on public.room_members;
create policy "members: read" on public.room_members for select to authenticated using (is_room_member(room_id));
drop policy if exists "members: leave" on public.room_members;
create policy "members: leave" on public.room_members for delete to authenticated using (user_id = auth.uid());

-- posts
drop policy if exists "posts: read" on public.posts;
create policy "posts: read" on public.posts for select to authenticated
  using (visibility = 'public' or author_id = auth.uid() or (room_id is not null and is_room_member(room_id)));
drop policy if exists "posts: insert" on public.posts;
create policy "posts: insert" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (visibility = 'public' or is_room_member(room_id)));
drop policy if exists "posts: update own" on public.posts;
create policy "posts: update own" on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and (visibility = 'public' or is_room_member(room_id)));
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts for delete to authenticated using (author_id = auth.uid());

-- likes
drop policy if exists "likes: read" on public.likes;
create policy "likes: read" on public.likes for select to authenticated using (can_see_post(post_id));
drop policy if exists "likes: insert" on public.likes;
create policy "likes: insert" on public.likes for insert to authenticated with check (user_id = auth.uid() and can_see_post(post_id));
drop policy if exists "likes: delete own" on public.likes;
create policy "likes: delete own" on public.likes for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists "comments: read" on public.comments;
create policy "comments: read" on public.comments for select to authenticated using (can_see_post(post_id));
drop policy if exists "comments: insert" on public.comments;
create policy "comments: insert" on public.comments for insert to authenticated with check (author_id = auth.uid() and can_see_post(post_id));
drop policy if exists "comments: delete own" on public.comments;
create policy "comments: delete own" on public.comments for delete to authenticated using (author_id = auth.uid());

-- join_requests
drop policy if exists "requests: read" on public.join_requests;
create policy "requests: read" on public.join_requests for select to authenticated
  using (user_id = auth.uid() or is_post_author(post_id));
drop policy if exists "requests: insert" on public.join_requests;
create policy "requests: insert" on public.join_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and can_request_join(post_id));
drop policy if exists "requests: author decides" on public.join_requests;
create policy "requests: author decides" on public.join_requests for update to authenticated
  using (is_post_author(post_id)) with check (is_post_author(post_id));
drop policy if exists "requests: cancel own" on public.join_requests;
create policy "requests: cancel own" on public.join_requests for delete to authenticated using (user_id = auth.uid());

-- messages（募集者と承認された参加者だけ）
drop policy if exists "messages: read" on public.messages;
create policy "messages: read" on public.messages for select to authenticated using (is_chat_member(post_id));
drop policy if exists "messages: insert" on public.messages;
create policy "messages: insert" on public.messages for insert to authenticated with check (author_id = auth.uid() and is_chat_member(post_id));

-- reports（送るだけ。中身は管理画面の Table Editor で確認）
drop policy if exists "reports: insert" on public.reports;
create policy "reports: insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- blocks
drop policy if exists "blocks: own" on public.blocks;
create policy "blocks: own" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

-- ---------- 写真の保存場所 ----------

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "post-images: upload own" on storage.objects;
create policy "post-images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post-images: delete own" on storage.objects;
create policy "post-images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and owner = auth.uid());
