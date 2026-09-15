-- Migration 00011: Create managed_classes and managed_students tables
-- Quản lý danh sách lớp học và học viên trực tiếp trên Supabase Table Editor
-- Đảm bảo phân cấp dữ liệu rõ ràng, hỗ trợ truy vấn nhanh và bảo mật RLS

-- 1. BẢNG MANAGED_CLASSES (Quản lý các lớp học đã thêm từ LMS vào hệ thống)
CREATE TABLE IF NOT EXISTS managed_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  course_name TEXT,
  centre_id TEXT,
  centre_name TEXT,
  teacher_name TEXT,
  teacher_codes JSONB DEFAULT '[]'::jsonb,
  class_time TEXT,
  start_date TEXT,
  end_date TEXT,
  number_of_sessions INT DEFAULT 0,
  completed_sessions INT DEFAULT 0,
  progress_percent INT DEFAULT 0,
  checkpoint1_session INT,
  checkpoint1_date TEXT,
  checkpoint2_session INT,
  checkpoint2_date TEXT,
  final_project_session INT,
  final_project_date TEXT,
  slots JSONB DEFAULT '[]'::jsonb,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by TEXT
);

-- Chỉ mục tối ưu tìm kiếm và lọc cho managed_classes
CREATE INDEX IF NOT EXISTS idx_managed_classes_status ON managed_classes(status);
CREATE INDEX IF NOT EXISTS idx_managed_classes_centre_id ON managed_classes(centre_id);
CREATE INDEX IF NOT EXISTS idx_managed_classes_name ON managed_classes(name);

-- Bật Row Level Security (RLS) cho managed_classes
ALTER TABLE managed_classes ENABLE ROW LEVEL SECURITY;

-- Cho phép người dùng đã xác thực hoặc công khai đọc danh sách lớp
DROP POLICY IF EXISTS "Allow read access to managed_classes" ON managed_classes;
CREATE POLICY "Allow read access to managed_classes"
ON managed_classes FOR SELECT
USING (true);

-- Cho phép service role toàn quyền thêm, sửa, xóa
DROP POLICY IF EXISTS "Allow service role full access to managed_classes" ON managed_classes;
CREATE POLICY "Allow service role full access to managed_classes"
ON managed_classes FOR ALL
USING (true)
WITH CHECK (true);


-- 2. BẢNG MANAGED_STUDENTS (Quản lý danh sách học viên active thuộc các lớp học đã thêm)
CREATE TABLE IF NOT EXISTS managed_students (
  id TEXT PRIMARY KEY,
  student_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  class_id TEXT NOT NULL REFERENCES managed_classes(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  course_name TEXT,
  centre_id TEXT,
  centre_name TEXT,
  email TEXT,
  phone_number TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by TEXT
);

-- Chỉ mục tối ưu tìm kiếm và lọc cho managed_students
CREATE INDEX IF NOT EXISTS idx_managed_students_student_code ON managed_students(student_code);
CREATE INDEX IF NOT EXISTS idx_managed_students_class_id ON managed_students(class_id);
CREATE INDEX IF NOT EXISTS idx_managed_students_centre_id ON managed_students(centre_id);
CREATE INDEX IF NOT EXISTS idx_managed_students_status ON managed_students(status);

-- Bật Row Level Security (RLS) cho managed_students
ALTER TABLE managed_students ENABLE ROW LEVEL SECURITY;

-- Cho phép người dùng đọc danh sách học viên
DROP POLICY IF EXISTS "Allow read access to managed_students" ON managed_students;
CREATE POLICY "Allow read access to managed_students"
ON managed_students FOR SELECT
USING (true);

-- Cho phép service role toàn quyền thêm, sửa, xóa học viên
DROP POLICY IF EXISTS "Allow service role full access to managed_students" ON managed_students;
CREATE POLICY "Allow service role full access to managed_students"
ON managed_students FOR ALL
USING (true)
WITH CHECK (true);
