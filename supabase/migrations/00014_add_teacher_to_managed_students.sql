-- Migration 00014: Add teacher fields to managed_students table
-- Hỗ trợ lưu trữ giáo viên phụ trách hiện tại và giáo viên phụ trách cuối cùng
-- Đảm bảo tự động cập nhật khi học viên chuyển lớp giữa các giáo viên

ALTER TABLE managed_students
ADD COLUMN IF NOT EXISTS teacher_name TEXT,
ADD COLUMN IF NOT EXISTS teacher_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS teacher_id TEXT,
ADD COLUMN IF NOT EXISTS last_teacher_name TEXT,
ADD COLUMN IF NOT EXISTS last_teacher_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_class_id TEXT,
ADD COLUMN IF NOT EXISTS last_class_name TEXT;

-- Chỉ mục hỗ trợ tìm kiếm nhanh theo giáo viên phụ trách
CREATE INDEX IF NOT EXISTS idx_managed_students_teacher_name ON managed_students(teacher_name);
CREATE INDEX IF NOT EXISTS idx_managed_students_last_teacher_name ON managed_students(last_teacher_name);
