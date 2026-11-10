-- =============================================================
-- 追加②：エリア・カテゴリ検索と、公開プロフィール／ルーム用プロフィール
-- SQL Editor に貼り付けて Run（何度実行しても大丈夫です）
-- =============================================================

-- 公開プロフィール：性別・年代
alter table public.profiles add column if not exists gender text not null default 'none';
alter table public.profiles add column if not exists age_range text;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender in ('female', 'male', 'other', 'none'));
alter table public.profiles drop constraint if exists profiles_age_range_check;
alter table public.profiles add constraint profiles_age_range_check check (age_range is null or age_range in ('18-19', '20s', '30s', '40s', '50plus'));

-- ルーム用プロフィール：ルームごとのニックネームとひとこと
alter table public.room_members add column if not exists nickname text check (nickname is null or char_length(nickname) <= 20);
alter table public.room_members add column if not exists bio text check (bio is null or char_length(bio) <= 160);
drop policy if exists "members: update own" on public.room_members;
create policy "members: update own" on public.room_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 投稿：カテゴリ・路線・駅
alter table public.posts add column if not exists category text;
alter table public.posts add column if not exists line text;
alter table public.posts add column if not exists station text;
create index if not exists posts_station_idx on public.posts (station);
create index if not exists posts_category_idx on public.posts (category);
create index if not exists posts_activity_idx on public.posts (activity_date);

-- 新規登録時に性別・年代も保存する
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare g text := coalesce(new.raw_user_meta_data ->> 'gender', 'none');
        a text := nullif(new.raw_user_meta_data ->> 'age_range', '');
begin
  if g not in ('female', 'male', 'other', 'none') then g := 'none'; end if;
  if a is not null and a not in ('18-19', '20s', '30s', '40s', '50plus') then a := null; end if;
  insert into public.profiles (id, display_name, age_confirmed, gender, age_range)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'ななし'), 20),
    coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false),
    g, a
  );
  return new;
end $$;

-- 実績（終了したイベントで、参加者が決まっていた回数）
create or replace function public.hosted_count(public.profiles)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from posts p
  where p.author_id = $1.id and p.kind = 'recruit'
    and coalesce(p.end_at, p.activity_date + interval '3 hours') < now()
    and exists (select 1 from join_requests j where j.post_id = p.id and j.status = 'approved');
$$;

create or replace function public.joined_count(public.profiles)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from join_requests j join posts p on p.id = j.post_id
  where j.user_id = $1.id and j.status = 'approved'
    and coalesce(p.end_at, p.activity_date + interval '3 hours') < now();
$$;
