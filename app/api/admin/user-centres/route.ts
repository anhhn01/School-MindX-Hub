import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRolePoints } from "@/lib/constants/roles";
import { getUserCentres } from "@/lib/services/user-centres-service";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
  try {
    // 1. Lấy vai trò của người dùng hiện tại từ cookie
    const currentRoleRaw = request.cookies.get("user_role")?.value;
    const cookieToken = request.cookies.get("id_token")?.value;
    const currentRoleName = currentRoleRaw ? decodeURIComponent(currentRoleRaw).trim() : "Admin";
    const currentRolePoints = getRolePoints(currentRoleName);

    // 2. Query danh sách users từ Supabase
    let users: any[] | null = null;
    let error: any = null;

    const mainQuery = await supabase
      .from("users")
      .select("id, lms_code, full_name, created_at, password_hash, is_firebase, user_statuses(name), roles(name)")
      .order("created_at", { ascending: false });

    users = mainQuery.data;
    error = mainQuery.error;

    if (error && error.message?.includes("is_firebase")) {
      const fallbackQuery = await supabase
        .from("users")
        .select("id, lms_code, full_name, created_at, password_hash, user_statuses(name), roles(name)")
        .order("created_at", { ascending: false });
      users = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    if (error) {
      console.error("Lỗi lấy danh sách tài khoản:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Format dữ liệu và gắn danh sách cơ sở trực thuộc
    const formattedList = await Promise.all(
      (users || [])
        .filter((u: any) => !u.lms_code?.startsWith("__"))
        .map(async (u: any) => {
        const statusObj = Array.isArray(u.user_statuses) ? u.user_statuses[0] : u.user_statuses;
        const roleObj = Array.isArray(u.roles) ? u.roles[0] : u.roles;

        const statusCode = statusObj?.name || statusObj?.code || "pending";
        const roleName = roleObj?.name || "Teacher Part-time";
        const targetRolePoints = getRolePoints(roleName);

        const isLmsAccount =
          u.is_firebase === true ||
          u.password_hash === "LMS_EXTERNAL_ACCOUNT" ||
          !u.password_hash ||
          String(u.password_hash).startsWith("LMS_");

        let centres = await getUserCentres(u.id);

        // Nếu là tài khoản LMS và chưa có cơ sở trong Supabase -> Tự động đồng bộ ngay từ LMS
        if (isLmsAccount && centres.length === 0) {
          const { syncLmsCentresForUser } = await import("@/lib/services/user-centres-service");
          const synced = await syncLmsCentresForUser(u.id, u.lms_code, u.full_name, cookieToken);
          if (synced && synced.length > 0) {
            centres = synced;
          }
        }

        return {
          id: u.id,
          lms_code: u.lms_code,
          full_name: u.full_name,
          created_at: u.created_at,
          is_firebase: isLmsAccount,
          status: statusCode,
          status_display_name:
            statusCode === "approved"
              ? "Đã phê duyệt"
              : statusCode === "rejected"
              ? "Từ chối"
              : "Chờ phê duyệt",
          role: roleName,
          role_points: targetRolePoints,
          // Kiểm tra quyền chỉnh sửa theo phân cấp vai trò:
          // Chỉ được chỉnh sửa nếu vai trò người thao tác cao hơn (role_points thấp hơn)
          can_edit: currentRolePoints < targetRolePoints,
          centres: centres || [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      current_user_role: currentRoleName,
      current_user_role_points: currentRolePoints,
      users: formattedList,
    });
  } catch (err: any) {
    console.error("Server error in user-centres API:", err);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
