"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ShieldAlert, Info } from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";
import AppLayout from "@/components/layout/AppLayout";
import { SMHLogo } from "@/components/brand/SMHLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminLogin = searchParams.get("admin") === "1";

  const [lmsCode, setLmsCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isReadyForAutofill, setIsReadyForAutofill] = useState(false);

  const enableAutofill = () => {
    if (!isReadyForAutofill) {
      setIsReadyForAutofill(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsAccessDenied(false);
    setLoading(true);

    try {
      const res = await fetch(API_ROUTES.AUTH.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lms_code: lmsCode.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 503) {
          // Khi bảo trì đang bật và tài khoản không phải admin -> chuyển hướng ngay về trang bảo trì
          router.push("/maintenance");
          return;
        }
        if (res.status === 403 || data.error?.includes("quyền truy cập")) {
          setIsAccessDenied(true);
        }
        setError(data.error || "Xin lỗi thông tin đăng nhập chưa chính xác");
        return;
      }

      // Redirect to specific role dashboard route
      router.push(data.redirect_url || "/");
      router.refresh();
    } catch (err) {
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
    setIsAccessDenied(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8 my-auto relative z-10 font-sans">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-rose-600/10 dark:bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-96 h-96 bg-red-800/5 dark:bg-red-800/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Box */}
      <div className="w-full max-w-md bg-white/95 dark:bg-[#0B0F17]/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl relative my-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <SMHLogo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Đăng Nhập SMH
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Hệ thống cổng thông tin đào tạo & quản trị MindX
          </p>
        </div>

        {/* Admin Maintenance Banner */}
        {isAdminLogin && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
            <Info className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-bold">Kênh Đăng Nhập Dành Riêng Cho Quản Trị Viên</p>
              <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90 mt-0.5">
                Hệ thống đang trong chế độ bảo trì. Chỉ tài khoản Quản trị viên mới được cấp quyền truy cập.
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-600 dark:text-rose-400 animate-shake">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
              {isAccessDenied && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Vui lòng liên hệ Quản trị viên để xét duyệt tài khoản vào hệ thống.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div>
            <label htmlFor="username" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Mã LMS / Tên Đăng Nhập
            </label>
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              readOnly={!isReadyForAutofill}
              onFocus={enableAutofill}
              onMouseDown={enableAutofill}
              onTouchStart={enableAutofill}
              value={lmsCode}
              onChange={(e) => {
                setLmsCode(e.target.value);
                clearError();
              }}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white text-sm"
              placeholder="Nhập mã LMS"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Mật Khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                autoComplete="current-password"
                readOnly={!isReadyForAutofill}
                onFocus={enableAutofill}
                onMouseDown={enableAutofill}
                onTouchStart={enableAutofill}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white text-sm pr-12"
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-3 whitespace-nowrap cursor-pointer"
          >
            {loading ? "Đang xác thực bảo mật..." : "Đăng Nhập Vào Hệ Thống"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppLayout
      pageTitle="Đăng Nhập"
      breadcrumbs={[
        { label: "Trang chủ", href: "/" },
        { label: "Đăng nhập" },
      ]}
    >
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AppLayout>
  );
}
