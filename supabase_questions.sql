-- Supabase SQL Editor で実行してください（テーブルが未作成の場合）
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tier text not null,
  format text not null,
  question_text text not null,
  coach_id text,
  amount_yen int not null,
  payment_ref text not null,
  video_filename text,
  -- プラスプラン時: Cloudinary 動画の secure_url（フロントから保存）
  video_storage_path text,
  coach_advice_text text,
  coach_advice_video_url text,
  questioner_uid text
);

alter table public.questions enable row level security;

-- 既存テーブルへカラム追加（すでにある場合はスキップ）
alter table public.questions add column if not exists coach_advice_text text;
alter table public.questions add column if not exists coach_advice_video_url text;
alter table public.questions add column if not exists questioner_uid text;
alter table public.questions add column if not exists payment_status text not null default 'pending';
alter table public.questions add column if not exists komoju_session_id text;

create index if not exists questions_payment_ref_idx on public.questions (payment_ref);

-- 動画は Cloudinary へアップロードする（フロントの CLOUD_NAME / UPLOAD_PRESET）
--
-- RLS: ブラウザの anon キーでは questions を直接触れない。
-- 読み書きは Go API（SUPABASE_SERVICE_ROLE_KEY）経由のみ。service_role は RLS をバイパスする。
drop policy if exists "questions_insert_anon" on public.questions;
drop policy if exists "questions_select_anon" on public.questions;
drop policy if exists "questions_update_anon" on public.questions;
drop policy if exists "Allow anon to insert questions" on public.questions;
drop policy if exists "Allow anon to select questions" on public.questions;
drop policy if exists "Allow anon to update questions" on public.questions;
drop policy if exists "allow_anon_insert" on public.questions;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'questions'
  loop
    execute format('drop policy if exists %I on public.questions', pol.policyname);
  end loop;
end $$;

revoke all on table public.questions from anon, authenticated;
grant all on table public.questions to service_role;
