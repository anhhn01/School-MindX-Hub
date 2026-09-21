import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export interface SiteStatsRecord {
  guestVisits: number;
  accountVisits: Record<string, number>; // userId -> visit count
  roleVisits: Record<string, number>; // role -> visit count (tương thích ngược)
  totalAccountVisits: number;
  totalVisits: number; // = totalAccountVisits + guestVisits
  updatedAt: string;
}

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DATA_DIR = path.join(process.cwd(), "data");
const STATS_FILE = path.join(DATA_DIR, "site_stats.json");

// Dữ liệu ban đầu
const DEFAULT_STATS: SiteStatsRecord = {
  guestVisits: 580,
  accountVisits: {
    "69afe79e-2596-47ee-9f54-6e50d54900ef": 852, // Admin
    "22425883-2d90-4c0a-8f6c-107d337d1d0e": 280, // Teacher Full-time
    "b5edaae0-7e2a-4ad8-829c-234587d06e06": 172, // Teacher Part-time
  },
  roleVisits: {
    Admin: 1126,
    "Teacher Full-time": 428,
    "Teacher Part-time": 330,
  },
  totalAccountVisits: 1304,
  totalVisits: 1884,
  updatedAt: new Date().toISOString(),
};

let memoryStats: SiteStatsRecord | null = null;
let lastSyncToSupabaseTime = 0;
const lastVisitTimestamps = new Map<string, number>();
const DEBOUNCE_MS = 2000; // Ngăn chặn tăng 2 lần liên tiếp trong 2s từ cùng 1 user/khách

function readLocalFile(): SiteStatsRecord {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.accountVisits && typeof parsed.guestVisits === "number") {
        return {
          guestVisits: parsed.guestVisits,
          accountVisits: parsed.accountVisits || {},
          roleVisits: parsed.roleVisits || DEFAULT_STATS.roleVisits,
          totalAccountVisits: parsed.totalAccountVisits || 0,
          totalVisits: parsed.totalVisits || (parsed.totalAccountVisits || 0) + parsed.guestVisits,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
      // Định dạng cũ: globalVisits và roleVisits
      if (typeof parsed.globalVisits === "number") {
        const total = parsed.globalVisits;
        const totalAcc = 1304;
        const guest = Math.max(0, total - totalAcc);
        return {
          guestVisits: guest,
          accountVisits: DEFAULT_STATS.accountVisits,
          roleVisits: parsed.roleVisits || DEFAULT_STATS.roleVisits,
          totalAccountVisits: totalAcc,
          totalVisits: total,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Lỗi đọc file site_stats.json:", err);
  }
  return { ...DEFAULT_STATS };
}

function writeLocalFile(data: SiteStatsRecord): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      STATS_FILE,
      JSON.stringify(
        {
          globalVisits: data.totalVisits,
          guestVisits: data.guestVisits,
          accountVisits: data.accountVisits,
          roleVisits: data.roleVisits,
          totalAccountVisits: data.totalAccountVisits,
          totalVisits: data.totalVisits,
          updatedAt: data.updatedAt,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (err) {
    console.warn("Lỗi ghi file site_stats.json:", err);
  }
}

/**
 * Tải dữ liệu từ Supabase hoặc file local
 */
export async function loadSiteStats(forceRefresh = false): Promise<SiteStatsRecord> {
  if (!forceRefresh && memoryStats) {
    return memoryStats;
  }

  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "site_stats")
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (parsed && typeof parsed.guestVisits === "number") {
        const stats: SiteStatsRecord = {
          guestVisits: parsed.guestVisits,
          accountVisits: parsed.accountVisits || {},
          roleVisits: parsed.roleVisits || DEFAULT_STATS.roleVisits,
          totalAccountVisits: parsed.totalAccountVisits || 0,
          totalVisits: parsed.totalVisits || (parsed.totalAccountVisits || 0) + parsed.guestVisits,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
        memoryStats = stats;
        writeLocalFile(stats);
        return stats;
      }
    }
  } catch (err) {
    console.warn("Lỗi đọc site_stats từ Supabase:", err);
  }

  const local = readLocalFile();
  memoryStats = local;

  // Khởi tạo lưu lên Supabase nếu chưa có
  try {
    await supabase.from("system_settings").upsert(
      {
        key: "site_stats",
        value: local,
        updated_at: new Date().toISOString(),
        updated_by: "system",
      },
      { onConflict: "key" }
    );
  } catch (e) {
    // Ignored
  }

  return local;
}

/**
 * Lưu dữ liệu lên Supabase & file local
 */
export async function persistSiteStats(stats: SiteStatsRecord): Promise<void> {
  memoryStats = stats;
  writeLocalFile(stats);

  const now = Date.now();
  // Giới hạn tần suất ghi Supabase tối đa 1 lần mỗi 2 giây
  if (now - lastSyncToSupabaseTime > 2000) {
    lastSyncToSupabaseTime = now;
    try {
      await supabase.from("system_settings").upsert(
        {
          key: "site_stats",
          value: stats,
          updated_at: new Date().toISOString(),
          updated_by: "system",
        },
        { onConflict: "key" }
      );
    } catch (err) {
      console.warn("Lỗi lưu site_stats vào Supabase:", err);
    }
  }
}

/**
 * Ghi nhận lượt truy cập và trả về thống kê
 * - Nếu có userId: Tăng lượt truy cập cho tài khoản đó
 * - Nếu không có userId (khách): Tăng lượt truy cập cho khách
 * - Tổng lượt truy cập toàn trang = Tổng lượt tất cả account + Số lượt khách
 */
export async function recordVisit(
  userId?: string | null,
  role?: string | null
): Promise<{
  currentAccountVisits: number;
  guestVisits: number;
  totalAccountVisits: number;
  totalVisitsGlobal: number;
  roleVisits: Record<string, number>;
}> {
  const stats = await loadSiteStats();
  const now = Date.now();
  const key = userId || "guest";

  const lastVisit = lastVisitTimestamps.get(key) || 0;
  const isDebounced = now - lastVisit < DEBOUNCE_MS;
  lastVisitTimestamps.set(key, now);

  if (!isDebounced) {
    if (userId) {
      // Tăng lượt truy cập cho tài khoản cá nhân
      stats.accountVisits[userId] = (stats.accountVisits[userId] || 0) + 1;

      // Cập nhật roleVisits tương thích
      if (role && stats.roleVisits[role] !== undefined) {
        stats.roleVisits[role] += 1;
      } else if (role) {
        stats.roleVisits[role] = 1;
      }
    } else {
      // Khách vãng lai
      stats.guestVisits = (stats.guestVisits || 0) + 1;
    }

    // Tính toán lại tổng
    const totalAcc = Object.values(stats.accountVisits).reduce((sum, v) => sum + v, 0);
    stats.totalAccountVisits = totalAcc;
    stats.totalVisits = totalAcc + stats.guestVisits;
    stats.updatedAt = new Date().toISOString();

    // Lưu bền vững
    persistSiteStats(stats);
  }

  const userAccountVisits = userId ? stats.accountVisits[userId] || 1 : 0;

  return {
    currentAccountVisits: userAccountVisits,
    guestVisits: stats.guestVisits,
    totalAccountVisits: stats.totalAccountVisits,
    totalVisitsGlobal: stats.totalVisits,
    roleVisits: stats.roleVisits,
  };
}
