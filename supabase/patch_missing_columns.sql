-- ============================================================
-- SQL CẬP NHẬT CÁC CỘT CÒN THIẾU CHO SUPABASE (LỚP TOÁN THẦY VIỆT)
-- Vào: Supabase Dashboard → SQL Editor → New Query → Dán vào và bấm RUN
-- ============================================================

-- 1. Bổ sung các cột cho bảng students (học sinh)
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS qr_token text;

-- 2. Bổ sung các cột cho bảng classes (lớp học)
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color text DEFAULT 'teal';

-- 3. Tạo bucket lưu ảnh đại diện học sinh và file PDF (nếu chưa có)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exams', 'exams', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Bật quyền cho Storage bucket
CREATE POLICY IF NOT EXISTS "Public Access Avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY IF NOT EXISTS "Upload Access Avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY IF NOT EXISTS "Update Access Avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');
