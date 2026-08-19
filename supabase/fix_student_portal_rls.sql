-- ============================================================
-- FIX LỖI HỌC SINH ĐĂNG NHẬP / TRUY CẬP CỔNG THI (RLS POLICIES)
-- ============================================================
-- Hướng dẫn:
-- 1. Vào Supabase Dashboard -> chọn Project của bạn.
-- 2. Vào mục "SQL Editor" ở menu bên trái.
-- 3. Tạo một "New query", copy toàn bộ nội dung file này dán vào và nhấn "RUN".
-- ============================================================

-- 1. Cho phép học sinh (anon) và giáo viên (authenticated) xem danh sách học sinh để đăng nhập
DROP POLICY IF EXISTS "auth read students" ON public.students;
DROP POLICY IF EXISTS "allow select students" ON public.students;
CREATE POLICY "allow select students" ON public.students
  FOR SELECT USING (true);

-- 2. Cho phép cập nhật thông tin học sinh (đổi mật khẩu, avatar)
DROP POLICY IF EXISTS "auth write students" ON public.students;
DROP POLICY IF EXISTS "allow update students" ON public.students;
DROP POLICY IF EXISTS "allow write students" ON public.students;
CREATE POLICY "allow write students" ON public.students
  FOR ALL USING (true);

-- 3. Cho phép đọc thông tin lớp học và ghi danh (để hiển thị đề thi theo lớp)
DROP POLICY IF EXISTS "auth read classes" ON public.classes;
DROP POLICY IF EXISTS "allow select classes" ON public.classes;
CREATE POLICY "allow select classes" ON public.classes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth write classes" ON public.classes;
CREATE POLICY "auth write classes" ON public.classes
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth read enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "allow select enrollments" ON public.enrollments;
CREATE POLICY "allow select enrollments" ON public.enrollments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth write enrollments" ON public.enrollments;
CREATE POLICY "auth write enrollments" ON public.enrollments
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. Cho phép đọc thông báo học phí
DROP POLICY IF EXISTS "Allow read tuition_notifications" ON public.tuition_notifications;
CREATE POLICY "Allow read tuition_notifications" ON public.tuition_notifications
  FOR SELECT USING (true);

-- 5. Cho phép học sinh đọc và nộp bài thi
DROP POLICY IF EXISTS "auth read exams" ON public.exams;
CREATE POLICY "auth read exams" ON public.exams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth read exam_rooms" ON public.exam_rooms;
CREATE POLICY "auth read exam_rooms" ON public.exam_rooms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth read exam_submissions" ON public.exam_submissions;
CREATE POLICY "auth read exam_submissions" ON public.exam_submissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth write exam_submissions" ON public.exam_submissions;
CREATE POLICY "auth write exam_submissions" ON public.exam_submissions
  FOR ALL USING (true);

DROP POLICY IF EXISTS "auth read exam_sessions" ON public.exam_sessions;
CREATE POLICY "auth read exam_sessions" ON public.exam_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth write exam_sessions" ON public.exam_sessions;
CREATE POLICY "auth write exam_sessions" ON public.exam_sessions
  FOR ALL USING (true);

-- 6. Cho phép đọc và cập nhật tiến trình học tập (student_progress nếu có)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_progress') THEN
    ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow select student_progress" ON public.student_progress;
    CREATE POLICY "allow select student_progress" ON public.student_progress FOR SELECT USING (true);
    DROP POLICY IF EXISTS "allow write student_progress" ON public.student_progress;
    CREATE POLICY "allow write student_progress" ON public.student_progress FOR ALL USING (true);
  END IF;
END $$;
