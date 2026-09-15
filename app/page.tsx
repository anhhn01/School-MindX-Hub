import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";
import PublicHeader from "@/components/layout/PublicHeader";
import SystemFooter from "@/components/layout/SystemFooter";
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

  // Determine dashboard link according to role
  let dashboardHref: string = API_ROUTES.ADMIN.DASHBOARD;
  if (userRole.toLowerCase().includes("full-time")) {
    dashboardHref = "/teacher-fulltime/dashboard";
  } else if (userRole.toLowerCase().includes("part-time")) {
    dashboardHref = "/teacher-parttime/dashboard";
  }

  // 1. Khi đã đăng nhập: Kế thừa AppLayout thống nhất toàn hệ thống với sidebar thu gọn và user profile dropdown
  if (isAuthenticated) {
    return (
      <AppLayout
        pageTitle="Trang Chủ"
        breadcrumbs={[{ label: "Trang chủ" }]}
      >
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center relative z-10 my-auto">
          <div className="max-w-4xl w-full mx-auto space-y-6 flex flex-col items-center">
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
              Nền tảng cổng thông tin nội bộ dành cho Giảng viên và Quản trị viên MindX. Tối ưu hóa điều phối lịch trải nghiệm, phân quyền màn hình động và quản lý tài khoản linh hoạt.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
              <Link
                href={dashboardHref}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Mở Bảng Điều Khiển Của Bạn</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // 2. Khi chưa đăng nhập (Khách): Hiển thị trang công khai đồng bộ Header/Footer căn lề chuẩn mực
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* TOP HEADER - ĐỒNG BỘ MỌI GIAO DIỆN */}
      <PublicHeader
        rightElement={
          <Link
            href="/login"
            className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold rounded-2xl text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-600/30 hover:scale-105 transition-all whitespace-nowrap cursor-pointer"
          >
            Đăng Nhập
          </Link>
        }
      />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16 text-center relative z-10 my-auto">
        <div className="max-w-4xl w-full mx-auto space-y-6 flex flex-col items-center">
          <div className="inline-flex items-center justify-center mb-1">
            <SMHLogo size="xl" showText={false} />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold tracking-wider uppercase shadow-sm whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Hệ Thống Đào Tạo & Quản Trị Trực Tuyến</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Student MindX Hub
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Nền tảng cổng thông tin nội bộ dành cho Giảng viên và Quản trị viên MindX. Tối ưu hóa điều phối lịch trải nghiệm, phân quyền màn hình động và quản lý tài khoản linh hoạt.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap cursor-pointer"
            >
              <span>Đăng Nhập Ngay</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
          </div>
        </div>
      </main>

      {/* FOOTER - ĐỒNG BỘ MỌI GIAO DIỆN */}
      <SystemFooter />
    </div>
  );
}