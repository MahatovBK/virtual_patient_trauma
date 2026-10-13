-- 1. Таблица сценариев
create table if not exists public.scenarios (
  id text primary key,
  title text not null,
  difficulty text not null default 'Не указана',
  patient text not null,
  description text not null,
  diagnosis text,
  diagnosis_keywords jsonb,
  diagnosis_terms jsonb,
  xray_image text,
  media jsonb not null default '[]'::jsonb,
  answer_rules jsonb not null default '[]'::jsonb,
  default_answer text not null default 'Я не понял вопрос.',
  created_at timestamptz not null default now()
);

alter table public.scenarios enable row level security;

drop policy if exists "public can read scenarios" on public.scenarios;
create policy "public can read scenarios" on public.scenarios for select using (true);

drop policy if exists "public can insert scenarios" on public.scenarios;
create policy "public can insert scenarios" on public.scenarios for insert with check (true);

drop policy if exists "public can update scenarios" on public.scenarios;
create policy "public can update scenarios" on public.scenarios for update using (true);

drop policy if exists "public can delete scenarios" on public.scenarios;
create policy "public can delete scenarios" on public.scenarios for delete using (true);

-- 2. Хранилище файлов (Storage)
insert into storage.buckets (id, name, public)
values ('scenario-media', 'scenario-media', true)
on conflict (id) do nothing;

drop policy if exists "public can read scenario media" on storage.objects;
create policy "public can read scenario media" on storage.objects for select using (bucket_id = 'scenario-media');

drop policy if exists "server can upload scenario media" on storage.objects;
create policy "server can upload scenario media" on storage.objects for insert with check (bucket_id = 'scenario-media');

-- 3. Таблица для хранения результатов и статистики студентов
create table if not exists public.student_sessions (
  id text primary key,
  student_name text not null, -- Фамилия, Имя
  scenario_id text not null,
  scenario_title text not null,
  questions_count integer not null default 0, -- 1. Сколько было задано вопросов
  diagnosis_stated boolean not null default false, -- 2. Был ли выставлен диагноз
  image_requested boolean not null default false, -- 3. Был ли запрошен снимок
  diagnosis_correct boolean not null default false, -- 4. Был ли диагноз выставлен правильно
  diagnosis_matches_count integer not null default 0, -- Число совпадений в терминологии
  diagnosis_total_terms integer not null default 0, -- Всего терминов в эталонном диагнозе
  matched_terms jsonb not null default '[]'::jsonb,
  missing_terms jsonb not null default '[]'::jsonb,
  user_diagnosis text,
  target_diagnosis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_sessions enable row level security;

drop policy if exists "public can read student_sessions" on public.student_sessions;
create policy "public can read student_sessions" on public.student_sessions for select using (true);

drop policy if exists "public can insert student_sessions" on public.student_sessions;
create policy "public can insert student_sessions" on public.student_sessions for insert with check (true);

drop policy if exists "public can update student_sessions" on public.student_sessions;
create policy "public can update student_sessions" on public.student_sessions for update using (true);

drop policy if exists "public can delete student_sessions" on public.student_sessions;
create policy "public can delete student_sessions" on public.student_sessions for delete using (true);

-- 4. Обновление эталонного диагноза первого сценария в базе данных
update public.scenarios
set diagnosis = 'Закрытый свежий вывих правого плеча',
    diagnosis_keywords = '["закрыт", "свеж", "вывих", "прав", "плеч"]'::jsonb,
    diagnosis_terms = '[
      {"term": "закрытый", "keywords": ["закрыт"]},
      {"term": "свежий", "keywords": ["свеж"]},
      {"term": "вывих", "keywords": ["вывих"]},
      {"term": "правого", "keywords": ["прав"]},
      {"term": "плеча", "keywords": ["плеч"]}
    ]'::jsonb
where id = 'shoulder-dislocation';
