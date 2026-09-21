-- Migration 00015: Add site visit stats to system_settings table
-- Lưu trữ bền vững lượt truy cập của từng tài khoản và khách vãng lai
-- Tổng số lượt truy cập = Tổng lượt tất cả tài khoản + Lượt khách

INSERT INTO system_settings (key, value, updated_by)
VALUES (
  'site_stats',
  '{
    "guestVisits": 580,
    "accountVisits": {
      "69afe79e-2596-47ee-9f54-6e50d54900ef": 852,
      "22425883-2d90-4c0a-8f6c-107d337d1d0e": 280,
      "b5edaae0-7e2a-4ad8-829c-234587d06e06": 172
    },
    "roleVisits": {
      "Admin": 1126,
      "Teacher Full-time": 428,
      "Teacher Part-time": 330
    },
    "totalAccountVisits": 1304,
    "totalVisits": 1884,
    "updatedAt": "2026-09-21T00:00:00.000Z"
  }'::jsonb,
  'system'
)
ON CONFLICT (key) DO NOTHING;
