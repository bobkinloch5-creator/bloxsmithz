insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-videos',
  'generated-videos',
  true,
  104857600,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-audio',
  'generated-audio',
  true,
  52428800,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/ogg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "generated-videos public read" on storage.objects;
create policy "generated-videos public read"
  on storage.objects for select
  using (bucket_id = 'generated-videos');

drop policy if exists "generated-audio public read" on storage.objects;
create policy "generated-audio public read"
  on storage.objects for select
  using (bucket_id = 'generated-audio');

create table if not exists public.video_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  model text not null default 'doubao-seedance-2-0',
  duration_seconds integer not null default 15,
  aspect_ratio text not null default '9:16',
  preset text not null default 'ad-promo',
  status text not null default 'queued',
  task_ids text[] not null default '{}',
  video_urls text[] not null default '{}',
  credits_used integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  cooldown_unlock_at timestamptz
);

create index if not exists idx_video_generations_user_cooldown
  on public.video_generations (user_id, cooldown_unlock_at desc, created_at desc);

alter table public.video_generations enable row level security;

drop policy if exists "own video generations - select" on public.video_generations;
create policy "own video generations - select"
  on public.video_generations for select
  using (auth.uid() = user_id);
