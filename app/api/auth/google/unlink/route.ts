import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySmhToken, signSmhToken } from "@/lib/auth/jwt";
import { getRolePoints } from "@/lib/constants/roles";
import { removeGoogleDriveTokens } from "@/lib/services/google-drive-service";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: NextRequest) {
  try {
    // 1. Xác thực danh tính người gọi API
    const smhToken = request.cookies.get("smh_token")?.value;
    if (!smhToken) {
      return NextResponse.json(
        { error: "Phiên làm việc hết hạn hoặc chưa đăng nhập" },
        { status: 401 }
      );
    }

    const verified = await verifySmhToken(smhToken);
    if (!verified.valid || !verified.payload) {
      return NextResponse.json(
        { error: "Token định danh không hợp lệ hoặc đã hết hạn" },
        { status: 401 }
      );
    }

    const callerId = verified.payload.userId;
    const callerRole = verified.payload.role;
    const callerPoints = getRolePoints(callerRole);

    let body: any = {};
    try {
      body = await request.json();
    } catch (_) {}

    const targetUserId = (body.target_user_id || "").trim() || callerId;
    const isSelf = targetUserId === callerId;

    // 2. Nếu thao tác trên tài khoản khác: Kiểm tra phân cấp quyền hạn (Role Hierarchy Scope)
    if (!isSelf) {
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from("users")
        .select("id, full_name, lms_code, roles(name)")
        .eq("id", targetUserId)
        .maybeSingle();

      if (targetUserError || !targetUser) {
        return NextResponse.json(
          { error: "Không tìm thấy tài khoản người dùng đích" },
          { status: 404 }
        );
      }

      const roleObj = Array.isArray(targetUser.roles)
        ? targetUser.roles[0]
        : targetUser.roles;
      const targetRoleName = (roleObj as any)?.name || "Teacher Part-time";
      const targetPoints = getRolePoints(targetRoleName);

      // Cấp trên chỉ được hủy liên kết của cấp dưới (targetPoints > callerPoints)
      if (targetPoints <= callerPoints) {
        return NextResponse.json(
          { error: "Bạn không có quyền hủy liên kết của tài khoản có cấp bậc bằng hoặc cao hơn mình" },
          { status: 403 }
        );
      }
    }

    // 3. Thực hiện hủy liên kết: Xóa email trong DB Supabase & Xóa token lưu trữ
    const { error: updateDbError } = await supabaseAdmin
      .from("users")
      .update({
        email: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateDbError) {
      console.error("Lỗi xóa email trong Supabase:", updateDbError);
      return NextResponse.json(
        { error: "Không thể cập nhật cơ sở dữ liệu Supabase" },
        { status: 500 }
      );
    }

    // Xóa file token lưu trữ
    removeGoogleDriveTokens(targetUserId);

    const response = NextResponse.json({
      success: true,
      message: isSelf
        ? "Đã hủy liên kết Google Drive thành công."
        : "Đã hủy liên kết Google của tài khoản thành công.",
    });

    // 4. Nếu là tự hủy liên kết của chính mình: Cập nhật lại cookie JWT không còn email
    if (isSelf) {
      const { token: newSmhToken, maxAgeSeconds } = await signSmhToken(
        {
          userId: verified.payload.userId,
          lmsCode: verified.payload.lmsCode,
          name: verified.payload.name,
          role: verified.payload.role,
          status: verified.payload.status,
          email: "",
        },
        30
      );

      response.cookies.set("smh_token", newSmhToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: maxAgeSeconds,
        sameSite: "lax",
        path: "/",
      });

      response.cookies.set("user_email", "", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        sameSite: "lax",
        path: "/",
      });
    }

    return response;
  } catch (err: any) {
    console.error("Lỗi khi hủy liên kết Google:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}
