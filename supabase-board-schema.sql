-- 掲示板用テーブル（Firebase Firestore からの移行先）
-- Supabase SQL エディタで実行してください。認証プロバイダで Google を有効化済みであること。

-- 投稿
create table if not exists public.board_posts (
    id uuid primary key default gen_random_uuid(),
    url text not null,
    title text,
    personal_best text default '' not null,
    question text default '' not null,
    user_id uuid not null references auth.users (id) on delete cascade,
    user_name text,
    created_at timestamptz not null default now(),
    thumbnail_url text
);

-- コメント（旧 posts/{id}/comments サブコレクション）
create table if not exists public.board_comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.board_posts (id) on delete cascade,
    text text not null,
    user_id uuid not null references auth.users (id) on delete cascade,
    user_name text,
    created_at timestamptz not null default now(),
    reply_to jsonb,
    edited_at timestamptz,
    updated_at timestamptz
);

-- 動画通報
create table if not exists public.board_video_reports (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.board_posts (id) on delete cascade,
    reporter_id uuid not null references auth.users (id) on delete cascade,
    reason text not null,
    created_at timestamptz not null default now(),
    status text not null default 'pending'
);

-- コメント通報
create table if not exists public.board_comment_reports (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null,
    comment_id uuid not null,
    comment_text text,
    reason text not null,
    reporter_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    status text not null default 'pending'
);

-- 問い合わせ
create table if not exists public.board_inquiries (
    id uuid primary key default gen_random_uuid(),
    text text not null,
    user_id uuid references auth.users (id) on delete set null,
    user_name text,
    created_at timestamptz not null default now(),
    status text not null default 'pending'
);

alter table public.board_posts enable row level security;
alter table public.board_comments enable row level security;
alter table public.board_video_reports enable row level security;
alter table public.board_comment_reports enable row level security;
alter table public.board_inquiries enable row level security;

-- board_posts
create policy "board_posts_select_all" on public.board_posts for select using (true);
create policy "board_posts_insert_own" on public.board_posts for insert to authenticated
    with check (auth.uid() = user_id);
create policy "board_posts_delete_own" on public.board_posts for delete to authenticated
    using (auth.uid() = user_id);

-- board_comments
create policy "board_comments_select_all" on public.board_comments for select using (true);
create policy "board_comments_insert_own" on public.board_comments for insert to authenticated
    with check (auth.uid() = user_id);
create policy "board_comments_update_own" on public.board_comments for update to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "board_comments_delete_own" on public.board_comments for delete to authenticated
    using (auth.uid() = user_id);

-- 通報・問い合わせ（本人のみ挿入）
create policy "board_video_reports_insert" on public.board_video_reports for insert to authenticated
    with check (auth.uid() = reporter_id);
create policy "board_video_reports_select_own" on public.board_video_reports for select to authenticated
    using (auth.uid() = reporter_id);

create policy "board_comment_reports_insert" on public.board_comment_reports for insert to authenticated
    with check (auth.uid() = reporter_id);
create policy "board_comment_reports_select_own" on public.board_comment_reports for select to authenticated
    using (auth.uid() = reporter_id);

create policy "board_inquiries_insert" on public.board_inquiries for insert to authenticated
    with check (auth.uid() = user_id);
create policy "board_inquiries_select_own" on public.board_inquiries for select to authenticated
    using (auth.uid() = user_id);

create index if not exists idx_board_posts_created_at on public.board_posts (created_at desc);
create index if not exists idx_board_comments_post_id on public.board_comments (post_id, created_at desc);
