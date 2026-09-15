import { NextRequest, NextResponse } from "next/server";
import { verifySmhToken } from "@/lib/auth/jwt";

// In-memory cache kiểm tra trạng thái bảo trì trong Middleware với TTL 3 giây
let middlewareMaintenanceCache: { isEnabled: boolean; expiresAt: number } | null = null;

async function checkMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (middlewareMaintenanceCache && now < middlewareMaintenanceCache.expiresAt) {
    return middlewareMaintenanceCache.isEnabled;
  }

  const supabaseUrl = process.env.SUPABASE_URL || "https://ntwxyemjtjosfzmribok.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_H4h3U8_R3OwV_FbrPKT_RA_XtTpQ2VY";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    // 1. Thử lấy từ bảng system_settings
    const res = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?key=eq.maintenance_status&select=value`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]?.value) {
        const val = data[0].value;
        // Kiểm tra hết hạn tự động
        if (val.isEnabled && val.expectedEndTime) {
          const endTs = new Date(val.expectedEndTime).getTime();
          if (!isNaN(endTs) && Date.now() >= endTs) {
            middlewareMaintenanceCache = { isEnabled: false, expiresAt: now + 3000 };
            return false;
          }
        }
        const isEnabled = Boolean(val.isEnabled);
        middlewareMaintenanceCache = { isEnabled, expiresAt: now + 3000 };
        return isEnabled;
      }
    }
  } catch (_) {}

  return false;
}

export async function middleware(request: NextRequest) {
  const smhToken = request.cookies.get("smh_token")?.value;
  const idToken = request.cookies.get("id_token")?.value;
  const rawRole = request.cookies.get("user_role")?.value;
  const userRole = rawRole ? decodeURIComponent(rawRole).trim().toLowerCase() : "";
  const { pathname } = request.nextUrl;

  // Xác thực qua SMH JWT Token (hoặc id_token dự phòng)
  let isAuthenticated = false;
  let isTokenExpired = false;
  let userEmail = "";

  if (smhToken) {
    const result = await verifySmhToken(smhToken);
    if (result.valid) {
      isAuthenticated = true;
      if (result.payload?.email) {
        userEmail = result.payload.email.trim();
      }
    } else if (result.expired) {
      isTokenExpired = true;
    }
  } else if (idToken) {
    isAuthenticated = true;
  }

  // Tra cứu email dự phòng từ cookie nếu trong token chưa có
  if (!userEmail) {
    const rawEmail = request.cookies.get("user_email")?.value;
    if (rawEmail) userEmail = decodeURIComponent(rawEmail).trim();
  }

  const isTeacherPartTime = userRole.includes("part-time") || userRole.includes("parttime");
  const isTeacherFullTime = userRole.includes("full-time") || userRole.includes("fulltime");
  // Bắt buộc liên kết Google Drive CHỈ áp dụng riêng cho Teacher Part-time khi email đang trống
  const isTeacherMissingEmail = isTeacherPartTime && (!userEmail || userEmail === "");

  // Xác định dashboard chuẩn dựa theo vai trò của người dùng
  const getRoleDashboard = (role: string) => {
    if (role.includes("admin")) return "/admin/dashboard";
    if (role.includes("full-time") || role.includes("fulltime")) return "/teacher-fulltime/dashboard";
    if (role.includes("part-time") || role.includes("parttime")) return "/teacher-parttime/dashboard";
    return "/dashboard";
  };

  // 0. Kiểm tra chế độ bảo trì hệ thống (Chỉ Admin mới có quyền truy cập khi đang bảo trì)
  if (
    !pathname.startsWith("/maintenance") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    pathname !== "/favicon.ico"
  ) {
    const isAdmin = userRole.includes("admin");
    if (!isAdmin) {
      const isMaintenanceActive = await checkMaintenanceMode();
      if (isMaintenanceActive) {
        // Khi bảo trì bật: Toàn bộ người dùng (kể cả vào /login thường) đều chuyển thẳng sang /maintenance.
        // Chỉ ngoại lệ duy nhất khi Admin nhấp 'Quản trị viên đăng nhập' (/login?admin=1)
        const isAdminLogin = pathname.startsWith("/login") && request.nextUrl.searchParams.get("admin") === "1";
        if (!isAdminLogin) {
          return NextResponse.redirect(new URL("/maintenance", request.url));
        }
      }
    }
  }

  // 1. Đã đăng nhập nhưng lại truy cập trang /login -> tự điều hướng về dashboard (hoặc connect-google-drive nếu thiếu email)
  if (isAuthenticated && pathname.startsWith("/login")) {
    if (isTeacherMissingEmail) {
      return NextResponse.redirect(new URL("/connect-google-drive", request.url));
    }
    return NextResponse.redirect(new URL(getRoleDashboard(userRole), request.url));
  }

  // 1.5 BẮT BUỘC OAUTH GOOGLE DRIVE: Chỉ áp dụng cho Teacher Part-time mà email đang trống
  if (isAuthenticated && isTeacherMissingEmail) {
    const isAllowedOAuthPath =
      pathname.startsWith("/connect-google-drive") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/api/auth/google") ||
      pathname.startsWith("/api/auth/logout") ||
      pathname.startsWith("/api/auth/me") ||
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico";

    if (!isAllowedOAuthPath) {
      return NextResponse.redirect(new URL("/connect-google-drive", request.url));
    }
  }

  // Nếu tài khoản đã có email hợp lệ mà vẫn vào /connect-google-drive -> Điều hướng về dashboard
  if (isAuthenticated && !isTeacherMissingEmail && pathname.startsWith("/connect-google-drive")) {
    return NextResponse.redirect(new URL(getRoleDashboard(userRole), request.url));
  }

  // Chưa đăng nhập nhưng cố truy cập /connect-google-drive -> Về /login
  if (!isAuthenticated && pathname.startsWith("/connect-google-drive")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Danh sách các route cần xác thực đăng nhập
  const isProtectedPath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher-fulltime") ||
    pathname.startsWith("/teacher-parttime") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/dashboard");

  // 2. Token hết hạn hoặc chưa đăng nhập nhưng cố truy cập route được bảo vệ -> Chuyển hướng về /login
  if (!isAuthenticated && isProtectedPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    if (isTokenExpired) {
      loginUrl.searchParams.set("reason", "expired");
    }
    const response = NextResponse.redirect(loginUrl);
    // Xóa sạch cookie phiên làm việc đã hết hạn
    response.cookies.delete("smh_token");
    response.cookies.delete("id_token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("user_id");
    response.cookies.delete("user_name");
    response.cookies.delete("user_role");
    response.cookies.delete("user_email");
    response.cookies.delete("user_permissions");
    return response;
  }

  // 3. Chặn route và phân quyền theo vai trò (Strict Role & Permissions Guarding)
  if (isAuthenticated) {
    const isAdmin = userRole.includes("admin");

    // Đọc phân quyền màn hình từ cookie user_permissions
    const rawPerms = request.cookies.get("user_permissions")?.value;
    let userPerms: Record<string, boolean> = {};
    if (rawPerms) {
      try {
        userPerms = JSON.parse(decodeURIComponent(rawPerms));
      } catch (_) {}
    }

    // --- QUY TẮC 1: CHẶN TRUY CẬP CHÉO VAI TRÒ -> TRẢ VỀ NOT-FOUND (404) ---
    // Role nào chỉ được phép đi vào route mang tiền tố của chính role đó!
    if (pathname.startsWith("/admin")) {
      if (!isAdmin) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    } else if (pathname.startsWith("/teacher-fulltime")) {
      if (!isTeacherFullTime) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    } else if (pathname.startsWith("/teacher-parttime")) {
      if (!isTeacherPartTime) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }

    // --- QUY TẮC 2: CHẶN THEO PHÂN QUYỀN MÀN HÌNH -> TRẢ VỀ NOT-FOUND (404) ---
    // 2.1 Màn hình Quản lý tài khoản: /[role]/system-management/users hoặc /admin/users
    if (pathname.includes("/system-management/users") || pathname === "/admin/users") {
      const canAccessUsers = isAdmin || userPerms["user_management"] === true;
      if (!canAccessUsers) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }

    // 2.2 Màn hình Phân quyền màn hình: /[role]/system-management/screen_permission hoặc /admin/permissions
    if (
      pathname.includes("/system-management/screen_permission") ||
      pathname === "/admin/permissions"
    ) {
      const canAccessPerms = isAdmin || userPerms["screen_permission_management"] === true;
      if (!canAccessPerms) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }

    // 2.3 Màn hình Quản lý cơ sở trực thuộc: /[role]/system-management/user_centres
    if (pathname.includes("/system-management/user_centres")) {
      const canAccessCentres = isAdmin || userPerms["user_centre_management"] === true;
      if (!canAccessCentres) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }

    // 2.4 Màn hình Lịch trải nghiệm: /[role]/data-inspection/trial_schedules
    if (pathname.includes("/data-inspection/trial_schedules")) {
      const canAccessTrial = isAdmin || userPerms["trial_schedules"] === true;
      if (!canAccessTrial) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }

    // 2.5 Màn hình Quản lý lớp học: /[role]/system-management/classes
    if (pathname.includes("/system-management/classes")) {
      const canAccessClasses =
        isAdmin ||
        userPerms["class_management"] === true ||
        (userPerms["class_management"] === undefined && userPerms["system_management"] === true);
      if (!canAccessClasses) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }

    // 2.6 Màn hình Quản lý học viên: /[role]/system-management/students
    if (pathname.includes("/system-management/students")) {
      const canAccessStudents =
        isAdmin ||
        userPerms["student_management"] === true;
      if (!canAccessStudents) {
        return NextResponse.rewrite(new URL("/not-found", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};