-- Migration 00012: Add Quota Columns to Users and Managed Students
-- Bổ sung các cột lưu trữ hạn mức dữ liệu nộp bài trên Supabase
-- 1. max_submission_quota_mb: Mức trần tối đa do Admin cấp cho Giáo viên (mặc định 100 MB)
-- 2. default_student_quota_mb: Định mức mặc định giáo viên gán cho học viên (mặc định 50 MB)
-- 3. submission_quota_mb: Định mức nộp bài riêng của từng học viên (mặc định 50 MB)

ALTER TABLE users ADD COLUMN IF NOT EXISTS max_submission_quota_mb INT DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_student_quota_mb INT DEFAULT 50;

ALTER TABLE managed_students ADD COLUMN IF NOT EXISTS submission_quota_mb INT DEFAULT 50;

-- Cập nhật dữ liệu mặc định cho các bản ghi hiện có
UPDATE users SET max_submission_quota_mb = 100 WHERE max_submission_quota_mb IS NULL;
UPDATE users SET default_student_quota_mb = 50 WHERE default_student_quota_mb IS NULL;

UPDATE managed_students SET submission_quota_mb = 50 WHERE submission_quota_mb IS NULL;
