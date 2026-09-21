create table if not exists public.scenarios (
  id text primary key,
  title text not null,
  difficulty text not null default 'Не указана',
  patient text not null,
  description text not null,
  diagnosis text,
  diagnosis_keywords jsonb,
  xray_image text,
  media jsonb not null default '[]'::jsonb,
  answer_rules jsonb not null default '[]'::jsonb,
  default_answer text not null default 'Я не понял вопрос.',
  created_at timestamptz not null default now()
);

alter table public.scenarios enable row level security;

create policy "public can read scenarios"
  on public.scenarios for select
  using (true);

insert into storage.buckets (id, name, public)
values ('scenario-media', 'scenario-media', true)
on conflict (id) do nothing;

create policy "public can read scenario media"
  on storage.objects for select
  using (bucket_id = 'scenario-media');

create policy "server can upload scenario media"
  on storage.objects for insert
  with check (bucket_id = 'scenario-media');
