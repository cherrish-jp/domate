-- =============================================================
-- 追加③：プロフィール編集（アイコン写真・自己紹介・趣味タグ）
-- SQL Editor に貼り付けて Run（何度実行しても大丈夫です）
-- =============================================================

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists tags text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_tags_check;
alter table public.profiles add constraint profiles_tags_check check (cardinality(tags) <= 10);
-- 自己紹介を300字まで書けるようにする
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (char_length(bio) <= 300);

-- アイコン写真の保存場所（自分のフォルダにだけ保存・削除できる）
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: upload own" on storage.objects;
create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
