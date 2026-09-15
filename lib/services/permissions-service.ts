import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Default Fallback Roles Permissions
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  Admin: {
    system_management: true,
    user_management: true,
    screen_permission_management: true,
    user_centre_management: true,
    class_management: true,
    student_management: true,
    data_inspection: true,
    trial_schedules: true,
  },
  "Teacher Full-time": {
    system_management: true,
    user_management: true,
    screen_permission_management: true,
    user_centre_management: true,
    class_management: true,
    student_management: true,
    data_inspection: true,
    trial_schedules: true,
  },
  "Teacher Part-time": {
    system_management: false,
    user_management: false,
    screen_permission_management: false,
    user_centre_management: false,
    class_management: false,
    student_management: false,
    data_inspection: true,
    trial_schedules: true,
  },
};

const DATA_DIR = path.join(process.cwd(), "data");
const PERMISSIONS_FILE = path.join(DATA_DIR, "screen_permissions_store.json");
const PERMISSIONS_FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000003";
const PERMISSIONS_FALLBACK_LMS_CODE = "__screen_permissions__";

// In-memory cache với TTL 3 giây
let cachedPermissions: Record<string, Record<string, boolean>> = { ...DEFAULT_ROLE_PERMISSIONS };
let lastCacheTime = 0;
const CACHE_TTL_MS = 3000;

function readLocalFile(): Record<string, Record<string, boolean>> | null {
  try {
    if (fs.existsSync(PERMISSIONS_FILE)) {
      const content = fs.readFileSync(PERMISSIONS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (_) {}
  return null;
}

function writeLocalFile(perms: Record<string, Record<string, boolean>>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2), "utf-8");
  } catch (_) {}
}

/**
 * Lấy toàn bộ phân quyền màn hình từ Supabase Database (hoặc Cache / File local bền vững)
 */
export async function getAllPermissionsMap(): Promise<Record<string, Record<string, boolean>>> {
  const now = Date.now();
  if (now - lastCacheTime < CACHE_TTL_MS && Object.keys(cachedPermissions).length > 0) {
    return cachedPermissions;
  }

  let loadedPerms: Record<string, Record<string, boolean>> | null = null;

  // 1. Thử lấy từ bảng role_menu_permissions & menus trên Supabase
  try {
    const { data: dbPerms, error: permError } = await supabase
      .from("role_menu_permissions")
      .select("is_enabled, roles ( name ), menus ( code )");

    if (!permError && dbPerms && dbPerms.length > 0) {
      const result: Record<string, Record<string, boolean>> = {};
      for (const row of dbPerms as any[]) {
        const roleName = row.roles?.name;
        const menuCode = row.menus?.code;
        if (roleName && menuCode) {
          if (!result[roleName]) result[roleName] = {};
          result[roleName][menuCode] = row.is_enabled;
        }
      }
      if (Object.keys(result).length > 0) {
        loadedPerms = result;
      }
    }
  } catch (_) {}

  // 2. Thử lấy từ bảng system_settings trên Supabase (key: screen_permissions)
  if (!loadedPerms) {
    try {
      const { data: settingRow, error: settingError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "screen_permissions")
        .maybeSingle();

      if (!settingError && settingRow && settingRow.value) {
        loadedPerms = settingRow.value;
      }
    } catch (_) {}
  }

  // 3. Thử đọc từ file local
  if (!loadedPerms) {
    loadedPerms = readLocalFile();
  }

  // 5. Fallback về cấu hình mặc định (Deep merge từng vai trò và từng menu để không bị mất key)
  const finalResult: Record<string, Record<string, boolean>> = {};
  for (const [role, defaultPerms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    finalResult[role] = { ...defaultPerms };
  }
  if (loadedPerms) {
    for (const [role, rolePerms] of Object.entries(loadedPerms)) {
      if (!finalResult[role]) {
        finalResult[role] = {};
      }
      if (typeof rolePerms === "object" && rolePerms !== null) {
        for (const [menuCode, isEnabled] of Object.entries(rolePerms)) {
          finalResult[role][menuCode] = Boolean(isEnabled);
        }
      }
    }
  }

  // Đảm bảo vai trò Admin luôn có đầy đủ 100% quyền
  finalResult.Admin = {
    system_management: true,
    user_management: true,
    screen_permission_management: true,
    user_centre_management: true,
    class_management: true,
    student_management: true,
    data_inspection: true,
    trial_schedules: true,
  };

  cachedPermissions = finalResult;
  lastCacheTime = now;
  writeLocalFile(finalResult);

  return finalResult;
}

/**
 * Lưu toàn bộ phân quyền màn hình vào Supabase Database (bảng users fallback + system_settings + file local)
 */
export async function saveAllPermissionsMap(
  perms: Record<string, Record<string, boolean>>
): Promise<boolean> {
  // Deep copy và đảm bảo mỗi vai trò có đầy đủ key của các menu hệ thống
  const completePerms: Record<string, Record<string, boolean>> = {};
  for (const [role, defaultPerms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    completePerms[role] = { ...defaultPerms, ...(perms[role] || {}) };
  }
  for (const [role, rolePerms] of Object.entries(perms)) {
    if (!completePerms[role]) {
      completePerms[role] = { ...rolePerms };
    }
  }

  // Đảm bảo vai trò Admin luôn có đầy đủ 100% quyền
  completePerms.Admin = {
    system_management: true,
    user_management: true,
    screen_permission_management: true,
    user_centre_management: true,
    class_management: true,
    student_management: true,
    data_inspection: true,
    trial_schedules: true,
  };

  cachedPermissions = { ...completePerms };
  lastCacheTime = Date.now();
  writeLocalFile(completePerms);

  let savedToSupabase = false;

  // 1. Lưu trực tiếp vào bảng role_menu_permissions & menus trên Supabase
  try {
    const { data: rolesData } = await supabase.from("roles").select("id, name");
    const { data: menusData } = await supabase.from("menus").select("id, code");

    if (rolesData && menusData && rolesData.length > 0 && menusData.length > 0) {
      const updates: { role_id: string; menu_id: string; is_enabled: boolean }[] = [];
      for (const [roleName, rolePerms] of Object.entries(completePerms)) {
        const roleObj = rolesData.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
        if (!roleObj) continue;
        for (const [menuCode, isEnabled] of Object.entries(rolePerms)) {
          const menuObj = menusData.find((m) => m.code === menuCode);
          if (!menuObj) continue;
          updates.push({
            role_id: roleObj.id,
            menu_id: menuObj.id,
            is_enabled: isEnabled,
          });
        }
      }
      if (updates.length > 0) {
        const { error: permErr } = await (supabase.from("role_menu_permissions") as any).upsert(updates, {
          onConflict: "role_id,menu_id",
        });
        if (!permErr) savedToSupabase = true;
      }
    }
  } catch (err) {
    console.warn("Lỗi lưu role_menu_permissions:", err);
  }

  // 2. Lưu đồng thời vào bảng system_settings trên Supabase (key: screen_permissions)
  try {
    const { error: ssError } = await supabase.from("system_settings").upsert(
      {
        key: "screen_permissions",
        value: completePerms,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (!ssError) savedToSupabase = true;
  } catch (_) {}

  return savedToSupabase;
}

export function getMemoryPermissions(): Record<string, Record<string, boolean>> {
  return cachedPermissions;
}

export function updateMemoryPermissions(perms: Record<string, Record<string, boolean>>): void {
  cachedPermissions = { ...perms };
  lastCacheTime = Date.now();
  saveAllPermissionsMap(perms);
}

export async function getRoleMenuPermissions(roleName: string): Promise<Record<string, boolean>> {
  if (!roleName) return {};

  const isRoleAdmin = roleName.toLowerCase().includes("admin");
  if (isRoleAdmin) {
    return {
      system_management: true,
      user_management: true,
      screen_permission_management: true,
      user_centre_management: true,
      class_management: true,
      data_inspection: true,
      trial_schedules: true,
    };
  }

  const allPerms = await getAllPermissionsMap();

  for (const [key, value] of Object.entries(allPerms)) {
    if (
      key.toLowerCase() === roleName.toLowerCase() ||
      key.toLowerCase().includes(roleName.toLowerCase()) ||
      roleName.toLowerCase().includes(key.toLowerCase())
    ) {
      return value;
    }
  }

  return {
    system_management: false,
    user_management: false,
    screen_permission_management: false,
    user_centre_management: false,
    class_management: false,
    data_inspection: true,
    trial_schedules: true,
  };
}
