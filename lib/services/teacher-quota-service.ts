import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "teacher_quotas_store.json");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TeacherQuotaConfig {
  maxQuotaMb: number; // Mức trần tối đa do Admin cấp (mặc định 100 MB)
  defaultStudentQuotaMb: number; // Mức mặc định giáo viên cấp cho học viên (mặc định 50 MB, <= maxQuotaMb)
  updatedAt?: string;
  updatedBy?: string;
}

let quotaCache: Record<string, TeacherQuotaConfig> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2000;

function readLocalFile(): Record<string, TeacherQuotaConfig> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.warn("Lỗi đọc file teacher_quotas_store.json:", err);
  }
  return {};
}

function writeLocalFile(data: Record<string, TeacherQuotaConfig>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Lỗi ghi file teacher_quotas_store.json:", err);
  }
}

/**
 * Đọc toàn bộ danh sách cấu hình định mức của giáo viên
 */
export async function getAllTeacherQuotas(forceRefresh = false): Promise<Record<string, TeacherQuotaConfig>> {
  const now = Date.now();
  if (!forceRefresh && quotaCache && now - lastFetchTime < CACHE_TTL_MS) {
    return quotaCache;
  }

  // 1. Đọc từ bảng system_settings
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "teacher_quotas")
      .maybeSingle();

    if (!error && data && data.value && typeof data.value === "object" && Object.keys(data.value).length > 0) {
      quotaCache = data.value as Record<string, TeacherQuotaConfig>;
      lastFetchTime = now;
      writeLocalFile(quotaCache);
      return quotaCache;
    }
  } catch (err) {
    // Không có system_settings
  }

  // 2. Fallback file local
  const localData = readLocalFile();
  quotaCache = localData;
  lastFetchTime = now;
  return localData;
}

/**
 * Lưu toàn bộ cấu hình định mức vào Supabase và file local
 */
export async function saveAllTeacherQuotas(
  data: Record<string, TeacherQuotaConfig>,
  updatedBy = "system"
): Promise<boolean> {
  quotaCache = data;
  lastFetchTime = Date.now();
  writeLocalFile(data);

  let success = false;

  // 1. Lưu trực tiếp vào bảng system_settings trên Supabase
  try {
    const { error } = await supabase.from("system_settings").upsert(
      {
        key: "teacher_quotas",
        value: data,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "key" }
    );
    if (!error) {
      success = true;
    } else {
      console.error("Lỗi lưu teacher_quotas vào Supabase system_settings:", error);
    }
  } catch (err) {
    console.warn("Lỗi lưu teacher_quotas vào system_settings:", err);
  }

  // 2. Đồng bộ thêm trực tiếp vào bảng users nếu cột đã được tạo trong Supabase
  try {
    for (const [teacherKey, cfg] of Object.entries(data)) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherKey);
      const updatePayload = {
        max_submission_quota_mb: cfg.maxQuotaMb,
        default_student_quota_mb: cfg.defaultStudentQuotaMb,
      };
      if (isUuid) {
        await supabase.from("users").update(updatePayload).eq("id", teacherKey);
      } else {
        await supabase.from("users").update(updatePayload).eq("lms_code", teacherKey);
      }
    }
  } catch (_) {}

  return success;
}

/**
 * Lấy cấu hình định mức của một giáo viên (bằng userId hoặc lmsCode)
 * Mặc định: maxQuotaMb = 100, defaultStudentQuotaMb = 50
 */
export async function getTeacherQuota(teacherKey: string): Promise<TeacherQuotaConfig> {
  if (!teacherKey) {
    return { maxQuotaMb: 100, defaultStudentQuotaMb: 50 };
  }
  const all = await getAllTeacherQuotas(true);
  let cfg = all[teacherKey];

  // Nếu chưa tìm thấy bằng key trực tiếp, thử đối chiếu qua bảng users trên Supabase
  if (!cfg) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherKey);
      let query = supabase
        .from("users")
        .select("id, lms_code, max_submission_quota_mb, default_student_quota_mb");

      const { data: u } = isUuid
        ? await query.eq("id", teacherKey).maybeSingle()
        : await query.eq("lms_code", teacherKey).maybeSingle();

      if (u) {
        cfg = all[u.id] || all[u.lms_code];
        if (!cfg && (u.max_submission_quota_mb || u.default_student_quota_mb)) {
          cfg = {
            maxQuotaMb: u.max_submission_quota_mb || 100,
            defaultStudentQuotaMb: u.default_student_quota_mb || 50,
          };
        }
      }
    } catch (_) {}
  }

  return {
    maxQuotaMb: cfg?.maxQuotaMb ?? 100,
    defaultStudentQuotaMb: cfg?.defaultStudentQuotaMb ?? 50,
    updatedAt: cfg?.updatedAt,
    updatedBy: cfg?.updatedBy,
  };
}

/**
 * Cập nhật mức trần tối đa cho giáo viên (CHỈ ADMIN ĐƯỢC PHÉP THỰC HIỆN)
 */
export async function updateTeacherMaxQuota(
  teacherKey: string,
  maxQuotaMb: number,
  adminId = "admin"
): Promise<TeacherQuotaConfig> {
  const all = await getAllTeacherQuotas(true);
  const current = all[teacherKey] || { maxQuotaMb: 100, defaultStudentQuotaMb: 50 };

  const validMax = Math.max(10, Math.min(maxQuotaMb, 500)); // Hạn mức hợp lệ 10MB - 500MB
  const validDefault = Math.min(current.defaultStudentQuotaMb, validMax);

  const updated: TeacherQuotaConfig = {
    maxQuotaMb: validMax,
    defaultStudentQuotaMb: validDefault,
    updatedAt: new Date().toISOString(),
    updatedBy: adminId,
  };

  all[teacherKey] = updated;
  await saveAllTeacherQuotas(all, adminId);
  return updated;
}

/**
 * Cập nhật mức định mức mặc định cho học viên (Giáo viên Part-time tự chỉnh trong giới hạn maxQuotaMb)
 */
export async function updateTeacherDefaultStudentQuota(
  teacherKey: string,
  defaultQuotaMb: number,
  teacherId = "teacher"
): Promise<{ success: boolean; config: TeacherQuotaConfig; message?: string }> {
  const all = await getAllTeacherQuotas(true);
  const current = all[teacherKey] || { maxQuotaMb: 100, defaultStudentQuotaMb: 50 };

  if (defaultQuotaMb > current.maxQuotaMb) {
    return {
      success: false,
      config: current,
      message: `Định mức cài đặt (${defaultQuotaMb} MB) vượt quá mức trần tối đa do Admin cho phép (${current.maxQuotaMb} MB).`,
    };
  }

  const validDefault = Math.max(5, defaultQuotaMb);
  const updated: TeacherQuotaConfig = {
    ...current,
    defaultStudentQuotaMb: validDefault,
    updatedAt: new Date().toISOString(),
    updatedBy: teacherId,
  };

  all[teacherKey] = updated;
  await saveAllTeacherQuotas(all, teacherId);
  return { success: true, config: updated };
}
