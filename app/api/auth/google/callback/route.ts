import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveGoogleDriveTokens } from "@/lib/services/google-drive-service";
import { signSmhToken, verifySmhToken } from "@/lib/auth/jwt";
import { getRoleSlug } from "@/lib/constants/api-routes";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper hoàn tất liên kết email vào Supabase và cấp lại cookie JWT
async function completeLinking(
  userId: string,
  googleEmail: string,
  tokenData?: {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    expires_in?: number;
  }
) {
  // 1. Cập nhật email trong bảng users của Supabase
  if (userId) {
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        email: googleEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Lỗi cập nhật email Supabase:", updateError);
    }

    // 2. Lưu Google Drive tokens vào kho dữ liệu bền vững
    if (tokenData?.access_token) {
      saveGoogleDriveTokens(userId, {
        email: googleEmail,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        expiry_date: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
      });
    }
  }

  // 3. Lấy thông tin user hiện tại để ký lại JWT
  let lmsCode = "user";
  let name = "Giáo viên";
  let status = "approved";
  let role = "Teacher Part-time";

  if (userId) {
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("lms_code, full_name, user_statuses(name), roles(name)")
      .eq("id", userId)
      .maybeSingle();

    if (dbUser) {
      lmsCode = dbUser.lms_code || lmsCode;
      name = dbUser.full_name || name;
      const statusObj = Array.isArray(dbUser.user_statuses)
        ? dbUser.user_statuses[0]
        : dbUser.user_statuses;
      status = (statusObj as any)?.name || status;

      const roleObj = Array.isArray(dbUser.roles)
        ? dbUser.roles[0]
        : dbUser.roles;
      if ((roleObj as any)?.name) {
        role = (roleObj as any).name;
      }
    }
  }

  const roleSlug = getRoleSlug(role);

  const { token: newSmhToken, maxAgeSeconds } = await signSmhToken(
    {
      userId,
      lmsCode,
      name,
      role,
      status,
      email: googleEmail,
    },
    30
  );

  const targetDashboard = `/${roleSlug}/dashboard?connected=drive_success`;

  return {
    newSmhToken,
    googleEmail,
    role,
    maxAgeSeconds,
    targetDashboard,
  };
}

// POST: Nhận kết quả từ client khi đăng nhập OAuth thành công qua Supabase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const googleEmail = (body.email || "").trim();

    if (!googleEmail) {
      return NextResponse.json(
        { error: "Email Google không hợp lệ hoặc để trống" },
        { status: 400 }
      );
    }

    // Xác thực danh tính người dùng hiện tại từ cookie smh_token
    let userId = "";
    const smhTokenCookie = request.cookies.get("smh_token")?.value;
    if (smhTokenCookie) {
      const verified = await verifySmhToken(smhTokenCookie);
      if (verified.valid && verified.payload) {
        userId = verified.payload.userId;
      }
    }
    if (!userId) {
      userId = request.cookies.get("user_id")?.value || "";
    }
    if (!userId && body.user_id) {
      userId = body.user_id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Không xác định được danh tính người dùng. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }

    const linkingResult = await completeLinking(userId, googleEmail, {
      access_token: body.provider_token,
      refresh_token: body.provider_refresh_token,
      token_type: "Bearer",
    });

    const response = NextResponse.json({
      success: true,
      message: "Liên kết Google thành công",
      redirect_url: linkingResult.targetDashboard,
    });

    // Cập nhật cookies
    response.cookies.set("smh_token", linkingResult.newSmhToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: linkingResult.maxAgeSeconds,
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("user_email", encodeURIComponent(googleEmail), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: linkingResult.maxAgeSeconds,
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("user_role", encodeURIComponent(linkingResult.role), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: linkingResult.maxAgeSeconds,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Lỗi khi xử lý POST liên kết Google:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}

// GET: Xử lý chuyển hướng callback từ Google hoặc Supabase
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const origin = request.nextUrl.origin;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin}/api/auth/google/callback`;

  if (errorParam) {
    console.error("Google OAuth error from query:", errorParam);
    return NextResponse.redirect(
      new URL(`/connect-google-drive?error=${encodeURIComponent(errorParam)}`, origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/connect-google-drive?error=missing_code", origin)
    );
  }

  // Giải mã state nếu có
  let userId = "";
  if (stateRaw) {
    try {
      const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
      userId = decoded.userId || "";
    } catch (_) {}
  }

  if (!userId) {
    userId = request.cookies.get("user_id")?.value || "";
  }

  const smhTokenCookie = request.cookies.get("smh_token")?.value;
  if (!userId && smhTokenCookie) {
    const verified = await verifySmhToken(smhTokenCookie);
    if (verified.valid && verified.payload) {
      userId = verified.payload.userId;
    }
  }

  // 1. Thử trao đổi mã xác thực qua Supabase Auth
  try {
    const { data: sbData, error: sbError } = await supabaseAdmin.auth.exchangeCodeForSession(code);
    if (!sbError && sbData?.user?.email) {
      const googleEmail = sbData.user.email.trim();
      const linkingResult = await completeLinking(userId, googleEmail, {
        access_token: sbData.session?.provider_token ?? undefined,
        refresh_token: sbData.session?.provider_refresh_token ?? undefined,
        token_type: "Bearer",
      });

      const response = NextResponse.redirect(new URL(linkingResult.targetDashboard, origin));
      response.cookies.set("smh_token", linkingResult.newSmhToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: linkingResult.maxAgeSeconds,
        sameSite: "lax",
        path: "/",
      });
      response.cookies.set("user_email", encodeURIComponent(googleEmail), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: linkingResult.maxAgeSeconds,
        sameSite: "lax",
        path: "/",
      });
      response.cookies.set("user_role", encodeURIComponent(linkingResult.role), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: linkingResult.maxAgeSeconds,
        sameSite: "lax",
        path: "/",
      });
      return response;
    }
  } catch (_) {}

  // 2. Thử trao đổi trực tiếp với Google token endpoint
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (clientId && clientSecret) {
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (tokenResponse.ok && tokenData.access_token) {
        const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const googleUser = await userinfoResponse.json();
        const googleEmail = (googleUser.email || "").trim();

        if (googleEmail) {
          const linkingResult = await completeLinking(userId, googleEmail, tokenData);
          const response = NextResponse.redirect(new URL(linkingResult.targetDashboard, origin));
          response.cookies.set("smh_token", linkingResult.newSmhToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: linkingResult.maxAgeSeconds,
            sameSite: "lax",
            path: "/",
          });
          response.cookies.set("user_email", encodeURIComponent(googleEmail), {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            maxAge: linkingResult.maxAgeSeconds,
            sameSite: "lax",
            path: "/",
          });
          response.cookies.set("user_role", encodeURIComponent(linkingResult.role), {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            maxAge: linkingResult.maxAgeSeconds,
            sameSite: "lax",
            path: "/",
          });
          return response;
        }
      }
    } catch (e) {
      console.error("Lỗi Google token direct exchange:", e);
    }
  }

  // 3. Nếu cả hai cách trên chưa xong (ví dụ PKCE verifier lưu ở localStorage trình duyệt),
  // chuyển hướng về /connect-google-drive?code=... để client Supabase tự đổi mã phiên
  return NextResponse.redirect(
    new URL(`/connect-google-drive?code=${encodeURIComponent(code)}`, origin)
  );
}
