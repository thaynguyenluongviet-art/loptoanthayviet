-- ============================================================
-- EduCenter – Supabase Schema
-- Paste vào: Supabase Dashboard → SQL Editor → Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Profiles (gắn với auth.users) ──────────────────────────
create table if not exists profiles (
  id       uuid references auth.users primary key,
  email    text unique not null,
  name     text,
  role     text check (role in ('ADMIN','TEACHER','TA')) default 'TEACHER',
  active   boolean default true,
  created_at timestamptz default now()
);

-- Tự tạo profile khi user đăng ký
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'TEACHER');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Students ────────────────────────────────────────────────
create table if not exists students (
  id           uuid default uuid_generate_v4() primary key,
  student_code text unique not null,
  full_name    text not null,
  parent_name  text,
  parent_phone text,
  zalo         text,
  email        text,
  school       text,
  grade        text,
  address      text,
  note         text,
  status       text default 'active',
  created_at   timestamptz default now()
);

-- ── Classes ─────────────────────────────────────────────────
create table if not exists classes (
  id               uuid default uuid_generate_v4() primary key,
  class_name       text not null,
  subject          text default 'Toán',
  grade            text,
  fee_per_session  numeric default 0,
  planned_sessions integer default 0,
  start_date       date,
  max_students     integer default 30,
  room             text,
  school           text,
  schedule         text,
  note             text,
  status           text default 'active',
  created_at       timestamptz default now()
);

-- ── Teacher–Class mapping ───────────────────────────────────
create table if not exists teacher_classes (
  id            uuid default uuid_generate_v4() primary key,
  teacher_id    uuid references profiles(id) on delete cascade,
  class_id      uuid references classes(id) on delete cascade,
  assigned_date date default current_date,
  status        text default 'active',
  unique(teacher_id, class_id)
);

-- ── Enrollments ─────────────────────────────────────────────
create table if not exists enrollments (
  id          uuid default uuid_generate_v4() primary key,
  student_id  uuid references students(id) on delete cascade,
  class_id    uuid references classes(id) on delete cascade,
  enroll_date date default current_date,
  status      text default 'active',
  note        text,
  unique(student_id, class_id)
);

-- ── Attendance ──────────────────────────────────────────────
create table if not exists attendance (
  id         uuid default uuid_generate_v4() primary key,
  date       date not null,
  class_id   uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  present    boolean default false,
  late       boolean default false,
  note       text,
  by_user    uuid references profiles(id),
  created_at timestamptz default now(),
  unique(date, class_id, student_id)
);

-- ── Payments ────────────────────────────────────────────────
create table if not exists payments (
  id         uuid default uuid_generate_v4() primary key,
  date       date default current_date,
  student_id uuid references students(id) on delete cascade,
  class_id   uuid references classes(id) on delete cascade,
  amount     numeric not null,
  method     text default 'cash',
  note       text,
  by_user    uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── Email Logs ──────────────────────────────────────────────
create table if not exists email_logs (
  id              uuid default uuid_generate_v4() primary key,
  type            text, -- 'tuition' | 'attendance' | 'payment_confirm'
  recipient_email text,
  student_id      uuid references students(id),
  class_id        uuid references classes(id),
  subject         text,
  status          text, -- 'sent' | 'failed'
  error_msg       text,
  by_user         uuid references profiles(id),
  created_at      timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table profiles   enable row level security;
alter table students   enable row level security;
alter table classes    enable row level security;
alter table enrollments enable row level security;
alter table attendance enable row level security;
alter table payments   enable row level security;
alter table email_logs enable row level security;
alter table teacher_classes enable row level security;

-- All authenticated users can read
create policy "auth read profiles"   on profiles   for select using (auth.role() = 'authenticated');
create policy "auth read students"   on students   for select using (auth.role() = 'authenticated');
create policy "auth read classes"    on classes    for select using (auth.role() = 'authenticated');
create policy "auth read enrollments" on enrollments for select using (auth.role() = 'authenticated');
create policy "auth read attendance" on attendance  for select using (auth.role() = 'authenticated');
create policy "auth read payments"   on payments    for select using (auth.role() = 'authenticated');
create policy "auth read email_logs" on email_logs  for select using (auth.role() = 'authenticated');
create policy "auth read tc"         on teacher_classes for select using (auth.role() = 'authenticated');

-- All authenticated users can write (role-based access enforced in app layer)
create policy "auth write students"  on students   for all using (auth.role() = 'authenticated');
create policy "auth write classes"   on classes    for all using (auth.role() = 'authenticated');
create policy "auth write enrollments" on enrollments for all using (auth.role() = 'authenticated');
create policy "auth write attendance" on attendance for all using (auth.role() = 'authenticated');
create policy "auth write payments"  on payments   for all using (auth.role() = 'authenticated');
create policy "auth write email_logs" on email_logs for all using (auth.role() = 'authenticated');
create policy "auth write tc"        on teacher_classes for all using (auth.role() = 'authenticated');
create policy "auth write profiles"  on profiles   for update using (auth.uid() = id);

-- ── Sample data ─────────────────────────────────────────────
-- Thêm admin thủ công sau khi tạo tài khoản:
-- UPDATE profiles SET role = 'ADMIN' WHERE email = 'admin@example.com';

-- ── Tuition Notifications ────────────────────────────────────────────────────
create table if not exists tuition_notifications (
  id          uuid default uuid_generate_v4() primary key,
  student_id  uuid references students(id) on delete cascade,
  class_id    uuid references classes(id) on delete cascade,
  course_name text not null,
  amount      numeric not null,
  is_paid     boolean default false,
  created_at  timestamptz default now(),
  unique(student_id, class_id, course_name)
);

alter table tuition_notifications enable row level security;

create policy "Allow read tuition_notifications" on tuition_notifications
  for select using (true);

create policy "Allow write tuition_notifications" on tuition_notifications
  for all using (auth.role() = 'authenticated');


-- ============================================================
-- EduCenter – LMS Schema Additions (Exams & Courses)
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
