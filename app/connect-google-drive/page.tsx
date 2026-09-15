"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  HardDrive,
  LogOut,
  AlertCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import { SMHLogo } from "@/components/brand/SMHLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import SystemFooter from "@/components/layout/SystemFooter";
import { API_ROUTES, getRoleSlug } from "@/lib/constants/api-routes";
import { supabase } from "@/lib/supabase/client";

function ConnectGoogleDriveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [userData, setUserData] = useState<{
    id?: string;
    name: string;
    role: string;
    lms_code?: string;
  }>({
    id: "",
    name: "Giáo viên",
    role: "Teacher Part-time",
    lms_code: "",
  });

  const errorParam = searchParams.get("error");

  // Helper hoàn tất đồng bộ email Google vào hệ thống
  const syncGoogleUser = async (
    email: string,
    provider_token?: string | null,
    provider_refresh_token?: string | null,
    targetUserId?: string
  ) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/google/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          provider_token: provider_token || undefined,
          provider_refresh_token: provider_refresh_token || undefined,
          user_id: targetUserId || userData.id,
        }),
      });
      const resData = await res.json();
      if (resData.success && resData.redirect_url) {
        window.location.href = resData.redirect_url;
        return;
      } else {
        setErrorMessage(resData.error || "Không thể hoàn tất liên kết tài khoản Google.");
      }
    } catch (err: any) {
      console.error("Lỗi đồng bộ email Supabase Google:", err);
      setErrorMessage(err?.message || "Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  // Tải thông tin người dùng và kiểm tra trạng thái cấu hình Google OAuth
  useEffect(() => {
    // 0. Bắt lỗi từ URL hash (Supabase OAuth thường trả lỗi qua hash)
    if (typeof window !== "undefined" && window.location.hash) {
      const hashStr = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hashStr);
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        setErrorMessage(decodeURIComponent(hashError));
      }
    }
    if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam));
    }

    // 1. Tải thông tin user từ /api/auth/me
    fetch(API_ROUTES.AUTH.ME, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          const roleName = data.user.role || "Teacher Part-time";
          const isPartTime =
            roleName.toLowerCase().includes("part-time") ||
            roleName.toLowerCase().includes("parttime");

          const currentUid = data.user.id || "";
          setUserData({
            id: currentUid,
            name: data.user.name || "Giáo viên",
            role: roleName,
            lms_code: data.user.lms_code || "",
          });

          // Bắt buộc OAuth CHỈ áp dụng riêng cho Teacher Part-time
          // Nếu không phải Teacher Part-time, hoặc tài khoản đã có email, tự động chuyển về đúng dashboard
          if (!isPartTime || (data.user.email && !data.user.requires_google_drive)) {
            const roleSlug = getRoleSlug(roleName);
            router.replace(`/${roleSlug}/dashboard`);
            return;
          }

          // Kiểm tra xem Supabase đã có session sẵn chưa
          supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
            if (sessionError) {
              console.error("Lỗi getSession Supabase:", sessionError);
            }
            if (session?.user?.email) {
              syncGoogleUser(
                session.user.email,
                session.provider_token,
                session.provider_refresh_token,
                currentUid
              );
            }
          });
        }
      })
      .catch(() => {});

    // 2. Lắng nghe phiên đăng nhập OAuth từ Supabase Provider (Google)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user?.email) {
        syncGoogleUser(
          session.user.email,
          session.provider_token,
          session.provider_refresh_token
        );
      }
    });

    // 3. Nếu URL có chứa code từ Supabase redirect (PKCE flow)
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setLoading(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          syncGoogleUser(
            session.user.email,
            session.provider_token,
            session.provider_refresh_token
          );
        } else {
          supabase.auth
            .exchangeCodeForSession(codeParam)
            .then(async ({ data: exchangeData, error: exchangeError }) => {
              if (!exchangeError && exchangeData?.user?.email) {
                syncGoogleUser(
                  exchangeData.user.email,
                  exchangeData.session?.provider_token,
                  exchangeData.session?.provider_refresh_token
                );
              } else if (exchangeError) {
                console.error("Lỗi exchange code Supabase:", exchangeError);
              }
            })
            .catch((e) => {
              console.error("Lỗi exchange code Supabase:", e);
            })
            .finally(() => {
              setLoading(false);
            });
        }
      });
    }

    // 4. Lấy URL OAuth trực tiếp (fallback)
    fetch("/api/auth/google/url", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setConfigured(!!data.configured);
        if (data.url) {
          setAuthUrl(data.url);
        }
      })
      .catch((err) => {
        console.error("Lỗi kiểm tra cấu hình Google OAuth:", err);
      })
      .finally(() => {
        setCheckingConfig(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams, errorParam]);

  const handleConnectClick = async () => {
    setLoading(true);
    setErrorMessage(null);

    // 1. Ưu tiên đăng nhập OAuth qua Supabase Auth (Google Provider)
    try {
      const redirectOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const { data: sbData, error: sbError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirectOrigin}/connect-google-drive`,
          scopes:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (!sbError && sbData?.url) {
        window.location.href = sbData.url;
        return;
      }
      if (sbError) {
        console.warn("Supabase signInWithOAuth error, fallback to direct:", sbError);
      }
    } catch (_) {}

    // 2. Sử dụng Google OAuth URL trực tiếp từ hệ thống (fallback)
    if (authUrl) {
      window.location.href = authUrl;
    } else {
      fetch("/api/auth/google/url")
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            window.location.href = data.url;
          } else {
            setErrorMessage(data.message || "Chưa cấu hình Google OAuth credentials.");
            setLoading(false);
          }
        })
        .catch(() => {
          setLoading(false);
          setErrorMessage("Có lỗi xảy ra khi khởi tạo kết nối Google Drive.");
        });
    }
  };

  const handleDirectConnectClick = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(API_ROUTES.AUTH.LOGOUT, { method: "POST" });
    } catch (_) {}
    window.location.href = "/login";
  };

  const isFullTime =
    userData.role.toLowerCase().includes("full-time") ||
    userData.role.toLowerCase().includes("fulltime");

  const badgeClass = isFullTime
    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
    : "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-30 h-20 bg-white/80 dark:bg-[#0B0F17]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 transition-colors duration-300">
        <div className="max-w-7xl w-full mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <SMHLogo size="md" href="/" />

          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-all text-xs font-semibold cursor-pointer shadow-sm"
            title={`Chuyển sang giao diện ${theme === "dark" ? "Sáng" : "Tối"}`}
          >
            <span>{theme === "dark" ? "🌙 Tối" : "☀️ Sáng"}</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <div className="w-full max-w-xl animate-fade-in my-auto">
          {/* Main Card */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#0E131F]/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/60 p-6 sm:p-9 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-rose-500/15 via-red-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-amber-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Icon Header */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="relative mb-4">
                {/* Outer Ring */}
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                    <svg className="w-8 h-8" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                    </svg>
                  </div>
                </div>

                {/* Badge Lock */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#0E131F]">
                  <Lock className="w-3 h-3" />
                </div>
              </div>

              {/* Title */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Yêu Cầu Bắt Buộc</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight uppercase">
                Liên Kết Google Drive
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Kích hoạt địa chỉ Email và đồng bộ tài nguyên giảng dạy
              </p>
            </div>

            {/* Error Banner (if error from OAuth) */}
            {(errorMessage || errorParam) && (
              <div className="mt-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <p className="font-bold">Liên kết chưa thành công</p>
                  <p className="mt-0.5 opacity-90">
                    {errorMessage || `Mã lỗi: ${errorParam}. Vui lòng thử lại.`}
                  </p>
                </div>
              </div>
            )}

            {/* User Details Box */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Tài khoản đang đăng nhập
              </p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20">
                    {userData.name ? userData.name.charAt(0).toUpperCase() : "T"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {userData.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Mã LMS: <span className="font-semibold text-slate-700 dark:text-slate-300">{userData.lms_code || "—"}</span>
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border whitespace-nowrap shrink-0 ${badgeClass}`}>
                  {userData.role}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleConnectClick}
                disabled={loading || (!configured && !checkingConfig)}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold text-white shadow-xl transition-all cursor-pointer ${
                  !configured && !checkingConfig
                    ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60"
                    : "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30 hover:scale-[1.02] active:scale-95"
                }`}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Đang xử lý kết nối Google...</span>
                  </span>
                ) : (
                  <>
                    <HardDrive className="w-5 h-5 shrink-0" />
                    <span>Liên Kết Với Google Drive</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>

              {authUrl && (
                <button
                  onClick={handleDirectConnectClick}
                  disabled={loading}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                >
                  <span>Hoặc liên kết trực tiếp bằng Google OAuth</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Đăng xuất khỏi tài khoản này</span>
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/privacy"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors hover:underline"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Chính sách quyền riêng tư & bảo mật Google</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <SystemFooter />
    </div>
  );
}

export default function ConnectGoogleDrivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090D16]">
          <div className="flex flex-col items-center gap-3">
            <span className="animate-spin rounded-full h-8 w-8 border-3 border-rose-600 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-500">Đang tải...</p>
          </div>
        </div>
      }
    >
      <ConnectGoogleDriveContent />
    </Suspense>
  );
}
