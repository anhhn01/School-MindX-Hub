import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { signSmhToken } from "@/lib/auth/jwt";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get("user_id")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "Chưa xác thực người dùng" },
        { status: 401 }
      );
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select(
        "id, full_name, email, lms_code, password_hash, created_at, roles ( name ), user_statuses ( name )"
      )
      .eq("id", userId)
      .single();

    if (error || !userData) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin người dùng" },
        { status: 404 }
      );
    }

    // Phân loại tài khoản chuẩn xác: nếu password_hash là LMS_EXTERNAL_ACCOUNT -> Tài khoản LMS
    const isFirebase =
      userData.password_hash === "LMS_EXTERNAL_ACCOUNT" ||
      (userData as any).is_firebase === true;

    const roleRelation = userData.roles;
    const roleObj = Array.isArray(roleRelation) ? roleRelation[0] : roleRelation;
    const roleName = (roleObj as any)?.name || "Admin";

    const statusRelation = userData.user_statuses;
    const statusObj = Array.isArray(statusRelation) ? statusRelation[0] : statusRelation;
    const statusName = (statusObj as any)?.name || "Đã phê duyệt";

    let canEditName = true;
    let nameMessage = "";
    let effectiveFullName = (userData.full_name || "").trim();

    if (isFirebase) {
      try {
        const { checkLmsAccount } = await import("@/lib/services/lms-service");
        const lmsResult = await checkLmsAccount(userData.lms_code);
        if (lmsResult.exists && lmsResult.fullName && lmsResult.fullName.trim().length > 0) {
          canEditName = false;
          effectiveFullName = lmsResult.fullName.trim();
          nameMessage = "Họ và tên được đồng bộ cố định từ hệ thống LMS MindX.";
        } else {
          // LMS không có thông tin về họ tên -> người dùng có quyền chỉnh sửa
          canEditName = true;
          nameMessage = "Tài khoản LMS chưa có họ tên trên hệ thống LMS, bạn có quyền tự cập nhật họ và tên.";
        }
      } catch (err) {
        console.warn("Lỗi kiểm tra LMS trong GET profile:", err);
        if (effectiveFullName.length > 0 && effectiveFullName !== userData.lms_code) {
          canEditName = false;
          nameMessage = "Họ và tên được đồng bộ cố định từ hệ thống LMS MindX.";
        } else {
          canEditName = true;
          nameMessage = "Tài khoản LMS chưa có họ tên trên hệ thống LMS, bạn có quyền tự cập nhật họ và tên.";
        }
      }
    } else {
      // Do website tạo -> luôn được quyền sửa họ tên
      canEditName = true;
      nameMessage = "Tài khoản nội bộ, có thể chỉnh sửa họ và tên.";
    }

    let teacherQuotaInfo = null;
    if (roleName.toLowerCase().includes("part-time")) {
      const { getTeacherQuota } = await import("@/lib/services/teacher-quota-service");
      const q = await getTeacherQuota(userData.id);
      teacherQuotaInfo = {
        max_submission_quota_mb: q.maxQuotaMb,
        default_student_quota_mb: q.defaultStudentQuotaMb,
      };
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        full_name: effectiveFullName,
        email: userData.email || "",
        lms_code: userData.lms_code || "",
        is_firebase: isFirebase,
        account_source: isFirebase ? "Tài khoản LMS" : "Do website tạo",
        can_edit_name: canEditName,
        can_edit_password: !isFirebase,
        name_message: nameMessage,
        role: roleName,
        status: statusName,
        max_submission_quota_mb: teacherQuotaInfo?.max_submission_quota_mb,
        default_student_quota_mb: teacherQuotaInfo?.default_student_quota_mb,
        token_expiry_days: 30,
        created_at: userData.created_at,
      },
    });
  } catch (err) {
    console.error("Lỗi khi lấy thông tin cá nhân:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy thông tin cá nhân" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.cookies.get("user_id")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "Chưa xác thực người dùng" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { full_name, password, default_student_quota_mb } = body;

    // Kiểm tra thông tin tài khoản hiện tại từ Supabase
    const { data: targetUser, error: fetchErr } = await supabase
      .from("users")
      .select("id, full_name, lms_code, password_hash, roles(name), user_statuses(name)")
      .eq("id", userId)
      .single();

    if (fetchErr || !targetUser) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng" },
        { status: 404 }
      );
    }

    const isFirebase =
      targetUser.password_hash === "LMS_EXTERNAL_ACCOUNT" ||
      (targetUser as any).is_firebase === true;

    const updateData: Record<string, any> = {};

    // 1. Xử lý Họ và tên
    if (full_name !== undefined) {
      const cleanName = full_name.trim();
      if (cleanName.length < 2 || cleanName.length > 70) {
        return NextResponse.json(
          { error: "Họ và tên phải có độ dài từ 2 đến 70 ký tự." },
          { status: 400 }
        );
      }

      // Nếu là tài khoản LMS: Kiểm tra xem LMS có thông tin họ tên không
      if (isFirebase) {
        try {
          const { checkLmsAccount } = await import("@/lib/services/lms-service");
          const lmsResult = await checkLmsAccount(targetUser.lms_code);
          if (lmsResult.exists && lmsResult.fullName && lmsResult.fullName.trim().length > 0) {
            return NextResponse.json(
              {
                error:
                  "Họ và tên của tài khoản LMS được đồng bộ cố định từ LMS MindX, không thể chỉnh sửa.",
              },
              { status: 400 }
            );
          }
        } catch (lmsCheckErr) {
          console.warn("Lỗi kiểm tra quyền sửa họ tên LMS trong PATCH:", lmsCheckErr);
        }
      }

      updateData.full_name = cleanName;
    }

    // 2. Xử lý Mật khẩu: Mật khẩu chỉ được thay đổi khi nó là tài khoản website cấp
    if (password !== undefined && password.trim().length > 0) {
      if (isFirebase) {
        return NextResponse.json(
          {
            error:
              "Mật khẩu chỉ được thay đổi khi là tài khoản do website cấp. Tài khoản LMS xác thực trực tiếp qua hệ thống LMS MindX.",
          },
          { status: 400 }
        );
      }
      const cleanPass = password.trim();
      if (cleanPass.length < 6 || cleanPass.length > 50) {
        return NextResponse.json(
          { error: "Mật khẩu mới phải có độ dài từ 6 đến 50 ký tự." },
          { status: 400 }
        );
      }
      updateData.password_hash = await bcrypt.hash(cleanPass, 10);
    }

    if (Object.keys(updateData).length === 0 && default_student_quota_mb === undefined) {
      return NextResponse.json(
        { error: "Không có thông tin nào được thay đổi" },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userId);

      if (updateErr) {
        return NextResponse.json(
          { error: `Lỗi cập nhật: ${updateErr.message}` },
          { status: 500 }
        );
      }
    }

    const roleRel = targetUser.roles;
    const roleObj = Array.isArray(roleRel) ? roleRel[0] : roleRel;
    const roleName = (roleObj as any)?.name || "Admin";

    const statusRel = targetUser.user_statuses;
    const statusObj = Array.isArray(statusRel) ? statusRel[0] : statusRel;
    const statusName = (statusObj as any)?.name || "Đã phê duyệt";

    // 3. Xử lý Định mức nộp bài cho học viên (Chỉ áp dụng cho Giáo viên Part-time)
    if (default_student_quota_mb !== undefined) {
      if (roleName.toLowerCase().includes("part-time")) {
        const val = Number(default_student_quota_mb);
        if (isNaN(val) || val < 1) {
          return NextResponse.json(
            { error: "Định mức dữ liệu nộp cho học viên phải là số nguyên dương (MB)." },
            { status: 400 }
          );
        }
        const { updateTeacherDefaultStudentQuota } = await import("@/lib/services/teacher-quota-service");
        const qRes = await updateTeacherDefaultStudentQuota(targetUser.id, val, targetUser.id);
        if (!qRes.success) {
          return NextResponse.json({ error: qRes.message || "Định mức nộp không hợp lệ" }, { status: 400 });
        }
      }
    }

    // Ký lại token với thời hạn cố định 30 ngày và cập nhật cookies
    const { token: newSmhToken, maxAgeSeconds } = await signSmhToken(
      {
        userId: targetUser.id,
        lmsCode: targetUser.lms_code || "",
        name: updateData.full_name || targetUser.full_name || "",
        role: roleName,
        status: statusName,
      },
      30
    );

    const res = NextResponse.json({
      success: true,
      message: "Cập nhật thông tin cá nhân thành công",
      token_expiry_days: 30,
    });

    res.cookies.set("smh_token", newSmhToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: maxAgeSeconds,
      sameSite: "lax",
      path: "/",
    });

    res.cookies.set("user_id", targetUser.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: maxAgeSeconds,
      sameSite: "lax",
      path: "/",
    });

    // Cập nhật cookie user_name nếu đổi tên
    if (updateData.full_name) {
      res.cookies.set("user_name", encodeURIComponent(updateData.full_name), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: maxAgeSeconds,
        sameSite: "lax",
        path: "/",
      });
    }

    return res;
  } catch (err) {
    console.error("Lỗi khi cập nhật thông tin cá nhân:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi cập nhật thông tin cá nhân" },
      { status: 500 }
    );
  }
}
