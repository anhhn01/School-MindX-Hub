import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRoleMenuPermissions } from "@/lib/services/permissions-service";
import { verifySmhToken } from "@/lib/auth/jwt";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
  const smhToken = request.cookies.get("smh_token")?.value;
  const idToken = request.cookies.get("id_token")?.value;
  let userId = request.cookies.get("user_id")?.value || "";
  const userNameCookie = request.cookies.get("user_name")?.value;
  const userRoleCookie = request.cookies.get("user_role")?.value;

  if (!smhToken && !idToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Nếu thiếu user_id cookie, trích xuất từ smhToken
  if (!userId && smhToken) {
    const verified = await verifySmhToken(smhToken);
    if (verified.valid && verified.payload?.userId) {
      userId = verified.payload.userId;
    }
  }

  let name = userNameCookie ? decodeURIComponent(userNameCookie) : "Người dùng";
  let role = userRoleCookie ? decodeURIComponent(userRoleCookie) : "Admin";
  let email = "";
  let lmsCode = "";

  // Luôn truy vấn trực tiếp Supabase Database để lấy tên và vai trò mới nhất theo thời gian thực (Real-time)
  if (userId) {
    try {
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, full_name, lms_code, email, roles ( name )")
        .eq("id", userId)
        .single();

      if (dbUser) {
        if (dbUser.full_name && dbUser.full_name.trim().length > 0) {
          name = dbUser.full_name.trim();
        } else if (dbUser.lms_code) {
          name = dbUser.lms_code.trim();
        }

        if (dbUser.lms_code) {
          lmsCode = dbUser.lms_code.trim();
        }

        if (dbUser.email) {
          email = dbUser.email.trim();
        }

        const roleRelation = dbUser.roles;
        const roleObj = Array.isArray(roleRelation) ? roleRelation[0] : roleRelation;
        if ((roleObj as any)?.name) {
          role = (roleObj as any).name;
        }
      }
    } catch (dbErr) {
      console.warn("Lỗi truy vấn Supabase realtime trong /api/auth/me:", dbErr);
    }
  }

  const isTeacherPartTime =
    role.toLowerCase().includes("part-time") || role.toLowerCase().includes("parttime");
  const requiresGoogleDrive = isTeacherPartTime && !email;

  // Lấy phân quyền màn hình thực tế cho vai trò của người dùng
  const permissions = await getRoleMenuPermissions(role);

  const response = NextResponse.json({
    authenticated: true,
    user: {
      id: userId || null,
      lms_code: lmsCode,
      name,
      role,
      email,
      requires_google_drive: requiresGoogleDrive,
      permissions,
    },
  });

  // Đồng bộ lại cookie user_name, user_role và user_permissions
  if (name) {
    response.cookies.set("user_name", encodeURIComponent(name), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  }

  if (role) {
    response.cookies.set("user_role", encodeURIComponent(role), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  }

  response.cookies.set("user_email", encodeURIComponent(email), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  response.cookies.set("user_permissions", encodeURIComponent(JSON.stringify(permissions)), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
