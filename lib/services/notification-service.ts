import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  details?: string[];
  type: "LMS_SYNC" | "TELEGRAM_REMINDER" | "SYSTEM";
  timestamp: string;
  isRead: boolean;
  classId?: string;
  link?: string;
}

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DATA_DIR = path.join(process.cwd(), "data");
const NOTIFICATIONS_STORE_FILE = path.join(DATA_DIR, "system_notifications_store.json");

let memoryNotifications: SystemNotification[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000;

function readLocalFile(): SystemNotification[] {
  try {
    if (fs.existsSync(NOTIFICATIONS_STORE_FILE)) {
      const content = fs.readFileSync(NOTIFICATIONS_STORE_FILE, "utf-8");
      return JSON.parse(content) || [];
    }
  } catch (err) {
    console.warn("Lỗi đọc file system_notifications_store.json:", err);
  }
  return [];
}

function writeLocalFile(data: SystemNotification[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(NOTIFICATIONS_STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Lỗi ghi file system_notifications_store.json:", err);
  }
}

/**
 * Đọc toàn bộ danh sách thông báo từ Supabase (key = 'system_notifications')
 */
export async function getSystemNotifications(forceRefresh = false): Promise<SystemNotification[]> {
  const now = Date.now();
  if (!forceRefresh && memoryNotifications && now - lastFetchTime < CACHE_TTL_MS) {
    return memoryNotifications;
  }

  // 1. Thử lấy từ Supabase system_settings
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "system_notifications")
      .maybeSingle();

    if (!error && data && Array.isArray(data.value)) {
      memoryNotifications = data.value as SystemNotification[];
      lastFetchTime = now;
      writeLocalFile(memoryNotifications);
      return memoryNotifications;
    }
  } catch (err) {
    // Supabase query error
  }

  // 2. Fallback sang file local
  const local = readLocalFile();
  memoryNotifications = local;
  lastFetchTime = now;
  return local;
}

/**
 * Lưu danh sách thông báo vào Supabase và file local
 */
export async function saveSystemNotifications(
  notifications: SystemNotification[],
  updatedBy: string = "system"
): Promise<boolean> {
  // Giới hạn tối đa 100 thông báo gần nhất để tránh phình dữ liệu
  const trimmed = notifications
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  memoryNotifications = trimmed;
  lastFetchTime = Date.now();
  writeLocalFile(trimmed);

  try {
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        {
          key: "system_notifications",
          value: trimmed,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        },
        { onConflict: "key" }
      );
    return !error;
  } catch (err) {
    console.warn("Lỗi lưu system_notifications vào Supabase:", err);
    return false;
  }
}

/**
 * Thêm một thông báo mới vào hệ thống
 */
export async function addSystemNotification(
  notification: Omit<SystemNotification, "id" | "timestamp" | "isRead"> & {
    id?: string;
    timestamp?: string;
    isRead?: boolean;
  },
  updatedBy: string = "system"
): Promise<SystemNotification> {
  const list = await getSystemNotifications(true);
  const newNotif: SystemNotification = {
    id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notification.title,
    message: notification.message,
    details: notification.details || [],
    type: notification.type || "SYSTEM",
    timestamp: notification.timestamp || new Date().toISOString(),
    isRead: notification.isRead ?? false,
    classId: notification.classId,
    link: notification.link,
  };

  list.unshift(newNotif);
  await saveSystemNotifications(list, updatedBy);
  return newNotif;
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export async function markNotificationAsRead(id: string, updatedBy: string = "user"): Promise<boolean> {
  const list = await getSystemNotifications(true);
  let changed = false;
  const updated = list.map((n) => {
    if (n.id === id) {
      changed = true;
      return { ...n, isRead: true };
    }
    return n;
  });

  if (changed) {
    await saveSystemNotifications(updated, updatedBy);
  }
  return changed;
}

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export async function markAllNotificationsAsRead(updatedBy: string = "user"): Promise<number> {
  const list = await getSystemNotifications(true);
  let count = 0;
  const updated = list.map((n) => {
    if (!n.isRead) {
      count++;
      return { ...n, isRead: true };
    }
    return n;
  });

  if (count > 0) {
    await saveSystemNotifications(updated, updatedBy);
  }
  return count;
}

/**
 * Xóa một thông báo theo ID
 */
export async function deleteSystemNotification(id: string, updatedBy: string = "user"): Promise<boolean> {
  const list = await getSystemNotifications(true);
  const filtered = list.filter((n) => n.id !== id);
  if (filtered.length !== list.length) {
    await saveSystemNotifications(filtered, updatedBy);
    return true;
  }
  return false;
}

/**
 * Xóa toàn bộ thông báo
 */
export async function clearAllSystemNotifications(updatedBy: string = "user"): Promise<boolean> {
  await saveSystemNotifications([], updatedBy);
  return true;
}
