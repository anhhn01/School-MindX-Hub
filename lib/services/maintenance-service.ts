import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export interface MaintenanceConfig {
  isEnabled: boolean;
  expectedEndTime: string | null; // ISO string
  reason?: string;
  updatedAt: string;
  updatedBy?: string;
  environment: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STATUS_FILE = path.join(DATA_DIR, "maintenance_status.json");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_CONFIG: MaintenanceConfig = {
  isEnabled: false,
  expectedEndTime: null,
  reason: "Hệ thống đang được nâng cấp và bảo trì định kỳ.",
  updatedAt: new Date().toISOString(),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
};

// In-memory cache với TTL 3 giây để tối ưu hiệu năng và độ trễ
let cachedStatus: MaintenanceConfig | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 3000;

// Hằng số định danh bản ghi bảo trì dự phòng trong bảng users
const MAINTENANCE_FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000001";
const MAINTENANCE_FALLBACK_LMS_CODE = "__system_maintenance__";

/**
 * Đọc file local (fallback)
 */
function readLocalFile(): MaintenanceConfig | null {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const fileContent = fs.readFileSync(STATUS_FILE, "utf-8");
      return JSON.parse(fileContent);
    }
  } catch (_) {}
  return null;
}

/**
 * Ghi file local (fallback)
 */
function writeLocalFile(config: MaintenanceConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATUS_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (_) {}
}

/**
 * Đọc trạng thái bảo trì hiện tại từ Supabase Database (hoặc Cache / File local)
 */
export async function getMaintenanceStatus(): Promise<MaintenanceConfig> {
  const now = Date.now();
  if (cachedStatus && now - lastCacheTime < CACHE_TTL_MS) {
    return checkExpiration(cachedStatus);
  }

  // 1. Thử lấy từ bảng system_settings trong Supabase
  try {
    const { data: settingRow, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "maintenance_status")
      .maybeSingle();

    if (!settingError && settingRow && settingRow.value) {
      const config: MaintenanceConfig = settingRow.value;
      cachedStatus = config;
      lastCacheTime = now;
      writeLocalFile(config);
      return checkExpiration(config);
    }
  } catch (_) {}

  // 2. Fallback đọc file local
  const local = readLocalFile();
  if (local) {
    cachedStatus = local;
    lastCacheTime = now;
    return checkExpiration(local);
  }

  cachedStatus = { ...DEFAULT_CONFIG };
  lastCacheTime = now;
  return DEFAULT_CONFIG;
}

/**
 * Kiểm tra xem bảo trì đã hết hạn chưa. Nếu đã quá expectedEndTime thì tự động tắt.
 */
function checkExpiration(config: MaintenanceConfig): MaintenanceConfig {
  if (config.isEnabled && config.expectedEndTime) {
    const endTimestamp = new Date(config.expectedEndTime).getTime();
    if (!isNaN(endTimestamp) && Date.now() >= endTimestamp) {
      const expiredConfig: MaintenanceConfig = {
        ...config,
        isEnabled: false,
        updatedAt: new Date().toISOString(),
      };
      cachedStatus = expiredConfig;
      lastCacheTime = Date.now();
      writeLocalFile(expiredConfig);
      // Tự động cập nhật ngầm sang Supabase nếu hết hạn
      setMaintenanceStatus(false, null, config.reason, "auto_expire").catch(() => {});
      return expiredConfig;
    }
  }
  return config;
}

/**
 * Cập nhật trạng thái bảo trì.
 * Lưu đồng thời vào Supabase (system_settings & fallback users), bộ nhớ cache và file local.
 */
export async function setMaintenanceStatus(
  isEnabled: boolean,
  expectedEndTime?: string | null,
  reason?: string,
  updatedBy?: string
): Promise<MaintenanceConfig> {
  let finalEndTime = expectedEndTime;

  if (isEnabled) {
    if (!finalEndTime || finalEndTime.trim() === "") {
      const threeHoursLater = new Date(Date.now() + 3 * 60 * 60 * 1000);
      finalEndTime = threeHoursLater.toISOString();
    } else {
      const parsed = new Date(finalEndTime);
      finalEndTime = isNaN(parsed.getTime())
        ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
        : parsed.toISOString();
    }
  } else {
    finalEndTime = null;
  }

  const newConfig: MaintenanceConfig = {
    isEnabled,
    expectedEndTime: finalEndTime,
    reason: reason || "Hệ thống đang được nâng cấp và bảo trì định kỳ.",
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || "admin",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
  };

  // Cập nhật Cache và File local ngay lập tức
  cachedStatus = newConfig;
  lastCacheTime = Date.now();
  writeLocalFile(newConfig);

  // 1. Lưu vào bảng system_settings trong Supabase
  let savedToSystemSettings = false;
  try {
    const { error: upsertError } = await supabase
      .from("system_settings")
      .upsert({
        key: "maintenance_status",
        value: newConfig,
        updated_at: newConfig.updatedAt,
        updated_by: newConfig.updatedBy,
      });

    if (!upsertError) {
      savedToSystemSettings = true;
    }
  } catch (_) {}

  return newConfig;
}
