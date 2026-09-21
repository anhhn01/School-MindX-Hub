-- Migration 00013: Add regular_sessions column to managed_classes table
-- Lưu trữ danh sách số thứ tự các buổi học thường (không thuộc CP1, CP2 hoặc SPCK)

ALTER TABLE managed_classes
ADD COLUMN IF NOT EXISTS regular_sessions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN managed_classes.regular_sessions IS 'Danh sách các buổi học thường (không thuộc các mốc Checkpoint 1, Checkpoint 2 hay Sản phẩm cuối khóa)';
