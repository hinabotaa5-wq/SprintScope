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

-- RLS ポリシー（再実行する場合は先に DROP してから CREATE）
-- API キー／クライアントによっては anon ではなく authenticated として届くため、両方に付与
drop policy if exists "questions_insert_anon" on public.questions;
create policy "questions_insert_anon"
  on public.questions for insert
  to anon, authenticated
  with check (true);

-- 動画は Supabase ではなく Cloudinary にアップロード（QB/script.js の CLOUD_NAME / UPLOAD_PRESET）

drop policy if exists "questions_select_anon" on public.questions;
create policy "questions_select_anon"
  on public.questions for select
  to anon, authenticated
  using (true);

-- コーチ回答の更新（本番は Edge Function 等での限定更新を推奨）
drop policy if exists "questions_update_anon" on public.questions;
create policy "questions_update_anon"
  on public.questions for update
  to anon, authenticated
  using (true)
  with check (true);
