export function getRoleSlug(roleName: string): "admin" | "teacher-fulltime" | "teacher-parttime" {
  const normalized = (roleName || "").trim().toLowerCase();
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("full-time") || normalized.includes("fulltime")) return "teacher-fulltime";
  if (normalized.includes("part-time") || normalized.includes("parttime")) return "teacher-parttime";
  return "admin";
}

export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
    GOOGLE_URL: "/api/auth/google/url",
    GOOGLE_CALLBACK: "/api/auth/google/callback",
    CONNECT_GOOGLE_DRIVE: "/connect-google-drive",
  },
  ADMIN: {
    USERS: "/api/admin/users",
    USER_DETAIL: (userId: string) => `/api/admin/users/${userId}`,
    USER_STATUS: (userId: string) => `/api/admin/users/${userId}/status`,
    USER_ROLE: (userId: string) => `/api/admin/users/${userId}/role`,
    CHECK_LMS: "/api/admin/users/check-lms",
    PERMISSIONS: "/api/admin/permissions",
    // API Quản lý cơ sở & cơ sở trực thuộc
    CENTRES: "/api/admin/centres",
    USER_CENTRES: "/api/admin/user-centres",
    USER_CENTRES_DETAIL: (userId: string) => `/api/admin/user-centres/${userId}`,
    // API Lịch trải nghiệm
    OFFICE_HOURS: "/api/office-hours",
    // API & Màn hình bảo trì hệ thống
    MAINTENANCE: "/api/admin/maintenance",
    MAINTENANCE_SCREEN: "/admin/system-management/maintenance",
    // Quy tắc mới: /[role]/[main_menu]/[menu]
    PERMISSIONS_SCREEN: "/admin/system-management/screen_permission",
    USERS_SCREEN: "/admin/system-management/users",
    USER_CENTRES_SCREEN: "/admin/system-management/user_centres",
    TRIAL_SCHEDULES_SCREEN: "/admin/data-inspection/trial_schedules",
    CLASSES_SCREEN: "/admin/system-management/classes",
    STUDENTS_SCREEN: "/admin/system-management/students",
    DASHBOARD: "/admin/dashboard",
  },
  TEACHER_FULLTIME: {
    DASHBOARD: "/teacher-fulltime/dashboard",
    USERS_SCREEN: "/teacher-fulltime/system-management/users",
    PERMISSIONS_SCREEN: "/teacher-fulltime/system-management/screen_permission",
    USER_CENTRES_SCREEN: "/teacher-fulltime/system-management/user_centres",
    TRIAL_SCHEDULES_SCREEN: "/teacher-fulltime/data-inspection/trial_schedules",
    CLASSES_SCREEN: "/teacher-fulltime/system-management/classes",
    STUDENTS_SCREEN: "/teacher-fulltime/system-management/students",
  },
  TEACHER_PARTTIME: {
    DASHBOARD: "/teacher-parttime/dashboard",
    USERS_SCREEN: "/teacher-parttime/system-management/users",
    PERMISSIONS_SCREEN: "/teacher-parttime/system-management/screen_permission",
    USER_CENTRES_SCREEN: "/teacher-parttime/system-management/user_centres",
    TRIAL_SCHEDULES_SCREEN: "/teacher-parttime/data-inspection/trial_schedules",
    CLASSES_SCREEN: "/teacher-parttime/system-management/classes",
    STUDENTS_SCREEN: "/teacher-parttime/system-management/students",
  },
  USER: {
    PROFILE: "/profile",
    API_PROFILE: "/api/profile",
  },
  DASHBOARD_STATS: "/api/dashboard/stats",
  OFFICE_HOURS: "/api/office-hours",
  CLASSES: "/api/classes",
  STUDENTS: "/api/students",

  // Helper sinh route động theo vai trò: /[role]/[main_menu]/[menu]
  ROLE_ROUTES: {
    DASHBOARD: (role: string) => `/${getRoleSlug(role)}/dashboard`,
    USERS: (role: string) => `/${getRoleSlug(role)}/system-management/users`,
    SCREEN_PERMISSION: (role: string) => `/${getRoleSlug(role)}/system-management/screen_permission`,
    USER_CENTRES: (role: string) => `/${getRoleSlug(role)}/system-management/user_centres`,
    TRIAL_SCHEDULES: (role: string) => `/${getRoleSlug(role)}/data-inspection/trial_schedules`,
    CLASSES: (role: string) => `/${getRoleSlug(role)}/system-management/classes`,
    STUDENTS: (role: string) => `/${getRoleSlug(role)}/system-management/students`,
  },
} as const;
