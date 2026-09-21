import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { getRolePoints } from "@/lib/constants/roles";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { full_name, email, lms_code, password, max_submission_quota_mb } = body;

    const currentUserId = request.cookies.get("user_id")?.value;
    const currentUserRole = request.cookies.get("user_role")?.value
      ? decodeURIComponent(request.cookies.get("user_role")!.value)
      : "Admin";
    const currentRolePoints = getRolePoints(currentUserRole);

    // 1. Fetch existing user to verify LMS status and role
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("id, password_hash, email, lms_code, full_name, roles ( name )")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng" },
        { status: 404 }
      );
    }

    const isLmsAccount =
      targetUser.password_hash === "LMS_EXTERNAL_ACCOUNT" ||
      (targetUser as any).is_firebase === true;

    // 2. Block password change if isLmsAccount
    if (isLmsAccount && password && password.trim().length > 0) {
      return NextResponse.json(
        { error: "Mật khẩu chỉ được thay đổi khi là tài khoản do website cấp." },
        { status: 400 }
      );
    }

    // 3. Quyền sửa: Bản thân HOẶC các tài khoản dưới role mình (targetRolePoints > currentRolePoints)
    const isSelf = !!currentUserId && currentUserId === userId;
    const targetRoleName = (targetUser.roles as any)?.name;
    const targetRolePoints = getRolePoints(targetRoleName);
    const isUnderRole = targetRolePoints > currentRolePoints;

    if (!isSelf && !isUnderRole) {
      return NextResponse.json(
        {
          error:
            "Bạn chỉ có quyền chỉnh sửa tài khoản của bản thân hoặc các tài khoản có vai trò dưới cấp mình.",
        },
        { status: 403 }
      );
    }

    // 4. Xử lý Cập nhật Hạn mức tối đa nộp bài (Chỉ Quản trị viên Admin mới có quyền)
    if (max_submission_quota_mb !== undefined) {
      const isAdmin = currentUserRole.toLowerCase().includes("admin");
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa hạn mức nộp tối đa của giáo viên." },
          { status: 403 }
        );
      }
      const val = Number(max_submission_quota_mb);
      if (isNaN(val) || val < 1) {
        return NextResponse.json(
          { error: "Hạn mức nộp tối đa phải là số nguyên dương (MB)." },
          { status: 400 }
        );
      }
      const { updateTeacherMaxQuota } = await import("@/lib/services/teacher-quota-service");
      await updateTeacherMaxQuota(userId, val, currentUserId || "admin");
    }

    // 5. Prepare fields to update
    const updateData: Record<string, any> = {};

    if (full_name !== undefined) updateData.full_name = full_name.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (lms_code !== undefined) updateData.lms_code = lms_code.trim();

    if (password && password.trim().length > 0) {
      updateData.password_hash = await bcrypt.hash(password.trim(), 10);
    }

    if (Object.keys(updateData).length === 0 && max_submission_quota_mb === undefined) {
      return NextResponse.json(
        { error: "Không có thông tin nào để cập nhật" },
        { status: 400 }
      );
    }

    let updatedUser = targetUser;
    if (Object.keys(updateData).length > 0) {
      const { data, error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating user details:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      updatedUser = data;
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật thông tin tài khoản thành công",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Server error updating user:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật thông tin" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const currentUserId = request.cookies.get("user_id")?.value;

    if (currentUserId === userId) {
      return NextResponse.json(
        { error: "Bạn không thể tự xóa tài khoản của chính mình." },
        { status: 400 }
      );
    }

    // 1. Fetch user to check role
    const { data: targetUser, error: fetchError } = await supabase
      .from("users")
      .select("id, full_name, lms_code, roles ( name )")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng cần xóa" },
        { status: 404 }
      );
    }

    const roleName = (targetUser.roles as any)?.name;
    if (roleName?.toLowerCase() === "admin") {
      return NextResponse.json(
        {
          error:
            "Không được phép xóa tài khoản Admin duy nhất của hệ thống. Bạn chỉ có thể chuyển giao quyền Admin trước.",
        },
        { status: 400 }
      );
    }

    // 2. Delete user from Supabase DB
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản "${targetUser.full_name}" (${targetUser.lms_code}) thành công`,
      deleted_user: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        lms_code: targetUser.lms_code,
        role: roleName,
      },
    });
  } catch (err) {
    console.error("Server error deleting user:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xóa người dùng" },
      { status: 500 }
    );
  }
}

