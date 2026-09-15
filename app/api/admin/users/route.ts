import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { getRolePoints } from "@/lib/constants/roles";
import { checkLmsAccount } from "@/lib/services/lms-service";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET() {
  try {
    let users: any[] | null = null;
    let error: any = null;

    const mainQuery = await supabase
      .from("users")
      .select("id, lms_code, full_name, email, created_at, password_hash, is_firebase, user_statuses(name), roles(name)")
      .order("created_at", { ascending: false });

    users = mainQuery.data;
    error = mainQuery.error;

    // Fallback query if is_firebase column does not exist yet on remote schema
    if (error && error.message?.includes("is_firebase")) {
      const fallbackQuery = await supabase
        .from("users")
        .select("id, lms_code, full_name, email, created_at, password_hash, user_statuses(name), roles(name)")
        .order("created_at", { ascending: false });
      users = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    if (error) {
      console.error("Error fetching admin users:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Join & format user_statuses and roles as text strings without foreign key IDs
    const formattedUsers = (users || [])
      .filter((u: any) => !u.lms_code?.startsWith("__"))
      .map((u: any) => {
      const statusObj = Array.isArray(u.user_statuses) ? u.user_statuses[0] : u.user_statuses;
      const roleObj = Array.isArray(u.roles) ? u.roles[0] : u.roles;

      const statusCode = statusObj?.name || statusObj?.code || "pending";
      const roleName = roleObj?.name || "Teacher Part-time";

      const isLmsAccount =
        u.is_firebase === true ||
        u.password_hash === "LMS_EXTERNAL_ACCOUNT" ||
        !u.password_hash ||
        String(u.password_hash).startsWith("LMS_");

      return {
        id: u.id,
        lms_code: u.lms_code,
        full_name: u.full_name,
        email: u.email || null,
        created_at: u.created_at,
        is_firebase: isLmsAccount,
        status: statusCode, // Text representation instead of status_id
        status_display_name:
          statusCode === "approved"
            ? "Đã phê duyệt"
            : statusCode === "rejected"
            ? "Từ chối"
            : "Chờ phê duyệt",
        role: roleName, // Text representation instead of role_id
        role_points: getRolePoints(roleName), // Điểm phân cấp vai trò (điểm càng thấp, quyền càng cao)
      };
    });

    return NextResponse.json({ success: true, users: formattedUsers });
  } catch (err) {
    console.error("Server error in admin users API:", err);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lms_code, full_name, password, is_firebase, role_name, status_code } = body;
    const currentUserIdCookie = request.cookies.get("user_id")?.value;

    const isLmsType = is_firebase === true || is_firebase === "true";

    if (!lms_code || !full_name || (!isLmsType && !password)) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ các trường: Mã LMS, Họ và tên" + (!isLmsType ? ", Mật khẩu" : "") },
        { status: 400 }
      );
    }

    const cleanLmsCode = String(lms_code).trim();

    // 1. Check if user already exists in Supabase DB
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, lms_code")
      .eq("lms_code", cleanLmsCode)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "Tài khoản với Mã LMS này đã tồn tại trong hệ thống" },
        { status: 400 }
      );
    }

    // 2. Kiểm tra quy tắc tồn tại trên LMS:
    // - Tài khoản do website tạo (!isLmsType): KHÔNG được tồn tại trên LMS trước đó.
    // - Tài khoản LMS có sẵn (isLmsType): BẮT BUỘC PHẢI tồn tại trên LMS.
    const lmsAccount = await checkLmsAccount(cleanLmsCode);

    if (!isLmsType && lmsAccount.exists) {
      return NextResponse.json(
        {
          error: `Mã LMS "${cleanLmsCode}" đã tồn tại trên hệ thống LMS MindX (${lmsAccount.fullName || cleanLmsCode}). Tài khoản do website tạo không được trùng với tài khoản LMS có sẵn. Vui lòng chọn loại "Tài khoản LMS có sẵn" hoặc dùng mã khác.`,
        },
        { status: 400 }
      );
    }

    if (isLmsType && !lmsAccount.exists) {
      return NextResponse.json(
        {
          error: `Không tìm thấy tài khoản với mã "${cleanLmsCode}" trên hệ thống LMS MindX. Vui lòng kiểm tra lại mã LMS.`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve role_id dynamically from role_name
    const { data: rolesList } = await supabase.from("roles").select("id, name");
    const targetRoleName = role_name || "Teacher Part-time";
    const matchedRoleObj = rolesList?.find(
      (r) => r.name?.toLowerCase() === String(targetRoleName).toLowerCase() ||
             r.name?.toLowerCase().includes(String(targetRoleName).toLowerCase())
    );
    const finalRoleId = matchedRoleObj?.id || rolesList?.[0]?.id;

    // 3. Enforce SINGLE ADMIN policy if creator assigns Admin role to new account
    const adminRoleObj = rolesList?.find((r) => r.name?.toLowerCase().includes("admin"));
    // Vai trò thấp nhất: Teacher Part-time (điểm 3)
    const lowestRoleObj = rolesList?.find((r) =>
      r.name?.toLowerCase().includes("part-time") || r.name?.toLowerCase().includes("parttime")
    ) || rolesList?.[rolesList.length - 1];
    let forceLogout = false;

    if (adminRoleObj && finalRoleId === adminRoleObj.id && lowestRoleObj) {
      // Demote all existing admins to lowest role (Teacher Part-time)
      const { data: existingAdmins } = await supabase
        .from("users")
        .select("id")
        .eq("role_id", adminRoleObj.id);

      if (existingAdmins && existingAdmins.length > 0) {
        for (const oldAdmin of existingAdmins) {
          await supabase
            .from("users")
            .update({ role_id: lowestRoleObj.id })
            .eq("id", oldAdmin.id);

          if (currentUserIdCookie && oldAdmin.id === currentUserIdCookie) {
            forceLogout = true;
          }
        }
      }
    }

    // 4. Resolve status_id dynamically from status_code
    const { data: statusList } = await supabase.from("user_statuses").select("id, name");
    const targetStatusCode = status_code || "approved";
    const matchedStatusObj = statusList?.find(
      (s: any) => (s.name || s.code)?.toLowerCase() === String(targetStatusCode).toLowerCase()
    );
    const finalStatusId = matchedStatusObj?.id || statusList?.[0]?.id;

    // 5. Prepare password hash based on account type selection
    let passwordHash = "LMS_EXTERNAL_ACCOUNT";
    if (!isLmsType && password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const newUserPayload: Record<string, any> = {
      lms_code: cleanLmsCode,
      email: null,
      full_name: full_name.trim(),
      password_hash: passwordHash,
      role_id: finalRoleId,
      status_id: finalStatusId,
      is_firebase: isLmsType,
    };

    let { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert(newUserPayload)
      .select()
      .single();

    if (insertError && insertError.message?.includes("is_firebase")) {
      delete newUserPayload.is_firebase;
      const retryInsert = await supabase
        .from("users")
        .insert(newUserPayload)
        .select()
        .single();
      newUser = retryInsert.data;
      insertError = retryInsert.error;
    }

    if (insertError) {
      console.error("Error creating user:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 6. Đồng bộ cơ sở trực thuộc:
    // - Mặc định tài khoản loại LMS (isLmsType): tự động tra cứu cơ sở từ LMS và lưu vào Supabase
    // - Tài khoản tự tạo nội bộ (!isLmsType): ban đầu cơ sở trực thuộc trống ([])
    if (isLmsType) {
      const { syncLmsCentresForUser } = await import("@/lib/services/user-centres-service");
      syncLmsCentresForUser(newUser.id, cleanLmsCode, full_name.trim()).catch((err) => {
        console.warn("Lỗi đồng bộ cơ sở ban đầu cho tài khoản LMS:", err);
      });
    }

    // Return joined user text representations
    const returnedUser = {
      id: newUser.id,
      lms_code: newUser.lms_code,
      full_name: newUser.full_name,
      created_at: newUser.created_at,
      is_firebase: isLmsType,
      status: matchedStatusObj?.name || "approved",
      status_display_name: targetStatusCode === "approved" ? "Đã phê duyệt" : "Chờ phê duyệt",
      role: matchedRoleObj?.name || "Teacher Part-time",
    };

    const res = NextResponse.json({
      success: true,
      message: "Tạo tài khoản mới thành công",
      user: returnedUser,
      forceLogout,
    });

    if (forceLogout) {
      const authCookies = [
        "smh_token",
        "id_token",
        "refresh_token",
        "user_id",
        "user_name",
        "user_role",
        "user_permissions",
      ];
      authCookies.forEach((c) => {
        res.cookies.delete(c);
        res.cookies.set(c, "", { maxAge: 0, path: "/", expires: new Date(0) });
      });
    }

    return res;
  } catch (err) {
    console.error("Server error creating user:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi tạo tài khoản" }, { status: 500 });
  }
}
