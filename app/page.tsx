import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";
import AppLayout from "@/components/layout/AppLayout";
import { SMHLogo } from "@/components/brand/SMHLogo";

export default async function Home() {
  const cookieStore = await cookies();
  const smhToken = cookieStore.get("smh_token")?.value;
  const idToken = cookieStore.get("id_token")?.value;
  const rawUserRole = cookieStore.get("user_role")?.value;

  const token = smhToken || idToken;
  const userRole = rawUserRole ? decodeURIComponent(rawUserRole) : "Admin";
  const isAuthenticated = !!token;

  // Xác định tuyến dashboard theo vai trò
  let dashboardHref: string = API_ROUTES.ADMIN.DASHBOARD;
  if (userRole.toLowerCase().includes("full-time")) {
    dashboardHref = "/teacher-fulltime/dashboard";
  } else if (userRole.toLowerCase().includes("part-time")) {
    dashboardHref = "/teacher-parttime/dashboard";
  }

  return (
    <AppLayout
      pageTitle="Trang Chủ"
      breadcrumbs={[{ label: "Trang chủ" }]}
    >
      <div className="space-y-10 py-10 sm:py-16">
        <div className="max-w-4xl w-full mx-auto space-y-6 text-center flex flex-col items-center">
          <div className="inline-flex items-center justify-center mb-1">
            <SMHLogo size="xl" showText={false} />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold tracking-wider uppercase shadow-sm whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Hệ Thống Đào Tạo & Quản Trị Trực Tuyến</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            School MindX Hub
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Nền tảng cổng thông tin nội bộ dành cho Giảng viên và Quản trị viên MindX. Tối ưu hóa điều phối lịch trải nghiệm, phân quyền màn hình động và quản lý học viên linh hoạt.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
            {isAuthenticated ? (
              <Link
                href={dashboardHref}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Mở Bảng Điều Khiển Của Bạn</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Đăng Nhập Ngay</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}