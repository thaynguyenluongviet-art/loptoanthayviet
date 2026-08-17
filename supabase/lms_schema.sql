-- ============================================================
-- EduCenter – LMS Schema Additions (Exams & Courses)
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Table: courses
create table if not exists public.courses (
  id           uuid default uuid_generate_v4() primary key,
  title        text not null,
  description  text,
  teacher_id   uuid references public.profiles(id) on delete set null,
  is_published boolean default false,
  created_at   timestamptz default now()
);

-- 2. Table: chapters
create table if not exists public.chapters (
  id          uuid default uuid_generate_v4() primary key,
  course_id   uuid references public.courses(id) on delete cascade,
  title       text not null,
  order_index integer default 1,
  created_at  timestamptz default now()
);

-- 3. Table: exams
create table if not exists public.exams (
  id         uuid default uuid_generate_v4() primary key,
  title      text not null,
  data       jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 4. Table: lessons
create table if not exists public.lessons (
  id                    uuid default uuid_generate_v4() primary key,
  chapter_id            uuid references public.chapters(id) on delete cascade,
  title                 text not null,
  order_index           integer default 1,
  pdf_list              jsonb default '[]'::jsonb,
  pdf_url               text,
  exam_ids              jsonb default '[]'::jsonb,
  exam_id               uuid references public.exams(id) on delete set null,
  video_url             text,
  interactive_questions jsonb default '[]'::jsonb,
  created_at            timestamptz default now()
);

-- 5. Table: exam_images
create table if not exists public.exam_images (
  id              uuid default uuid_generate_v4() primary key,
  exam_id         uuid references public.exams(id) on delete cascade,
  question_number text not null,
  image_index     integer not null,
  image_id        text not null,
  filename        text,
  content_type    text,
  base64          text not null,
  created_at      timestamptz default now()
);

-- 6. Table: exam_rooms
create table if not exists public.exam_rooms (
  id          uuid default uuid_generate_v4() primary key,
  code        text unique not null,
  exam_id     uuid references public.exams(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete set null,
  teacher_id  uuid references public.profiles(id) on delete set null,
  status      text check (status in ('waiting', 'active', 'closed')) default 'waiting',
  time_limit  integer not null,
  settings    jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);

-- 7. Table: exam_sessions
create table if not exists public.exam_sessions (
  id              text primary key, -- Formatted as roomId_studentId
  room_id         uuid references public.exam_rooms(id) on delete cascade,
  student_id      uuid references public.students(id) on delete cascade,
  session_id      text not null,
  student_name    text not null,
  class_name      text,
  device_info     text,
  total_questions integer not null,
  time_remaining  integer not null,
  last_heartbeat  timestamptz default now(),
  status          text check (status in ('active', 'submitted')) default 'active',
  tab_switches    integer default 0,
  violations      jsonb default '[]'::jsonb,
  answered_count  integer default 0,
  created_at      timestamptz default now()
);

-- 8. Table: exam_submissions
create table if not exists public.exam_submissions (
  id                  uuid default uuid_generate_v4() primary key,
  room_id             uuid references public.exam_rooms(id) on delete cascade,
  student_id          uuid references public.students(id) on delete cascade,
  status              text check (status in ('in_progress', 'submitted')) default 'in_progress',
  answers             jsonb default '{}'::jsonb,
  score               numeric,
  score_breakdown     jsonb default '{}'::jsonb,
  submitted_at        timestamptz,
  tab_switches        integer default 0,
  tab_switch_warnings jsonb default '[]'::jsonb,
  duration            integer default 0,
  created_at          timestamptz default now(),
  unique(room_id, student_id)
);

-- RLS (Row Level Security) Activation
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.exams enable row level security;
alter table public.lessons enable row level security;
alter table public.exam_images enable row level security;
alter table public.exam_rooms enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_submissions enable row level security;

-- Policies for Authenticated Users (Teachers, Admins, Anonymous Students)
-- Read permissions
create policy "auth read courses" on public.courses for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read chapters" on public.chapters for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read exams" on public.exams for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read lessons" on public.lessons for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read exam_images" on public.exam_images for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read exam_rooms" on public.exam_rooms for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read exam_sessions" on public.exam_sessions for select using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth read exam_submissions" on public.exam_submissions for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Write permissions
create policy "auth write courses" on public.courses for all using (auth.role() = 'authenticated');
create policy "auth write chapters" on public.chapters for all using (auth.role() = 'authenticated');
create policy "auth write exams" on public.exams for all using (auth.role() = 'authenticated');
create policy "auth write lessons" on public.lessons for all using (auth.role() = 'authenticated');
create policy "auth write exam_images" on public.exam_images for all using (auth.role() = 'authenticated');
create policy "auth write exam_rooms" on public.exam_rooms for all using (auth.role() = 'authenticated');
create policy "auth write exam_sessions" on public.exam_sessions for all using (auth.role() = 'authenticated' or auth.role() = 'anon');
create policy "auth write exam_submissions" on public.exam_submissions for all using (auth.role() = 'authenticated' or auth.role() = 'anon');
