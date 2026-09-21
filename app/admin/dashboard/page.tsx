"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  Users,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  KeyRound,
  Building2,
  CalendarCheck,
} from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";

interface AdminStats {
  total_accounts: number;
  account_visits: number;
  total_visits_admin: number;
  total_visits_global: number;
  total_account_visits: number;
  guest_visits: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    total_accounts: 0,
    account_visits: 0,
    total_visits_admin: 0,
    total_visits_global: 0,
    total_account_visits: 0,
    guest_visits: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.DASHBOARD_STATS);
      const data = await res.json();
      if (res.ok && data.stats) {
        setStats({
          total_accounts: data.stats.total_accounts || 0,
          account_visits: data.stats.account_visits || data.stats.total_visits_admin || 0,
          total_visits_admin: data.stats.total_visits_admin || 0,
          total_visits_global: data.stats.total_visits_global || 0,
          total_account_visits: data.stats.total_account_visits || 0,
          guest_visits: data.stats.guest_visits || 0,
        });
      }
    } catch (err) {
      console.error("Lỗi tải stats admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <AppLayout
      pageTitle="Bảng Điều Khiển Quản Trị Viên"
      breadcrumbs={[
        { label: "Tổng quan", href: API_ROUTES.ADMIN.DASHBOARD },
        { label: "Dashboard Quản trị viên" },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* HERO BANNER RUBY-OBSIDIAN */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 text-white p-6 sm:p-10 shadow-xl shadow-rose-900/20">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-black/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold mb-4 text-white whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 text-rose-200" />
              <span>Quản Trị Viên (Admin)</span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 break-words">
              Không Gian Điều Hành & Quản Trị Hệ Thống
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-rose-100/90 leading-relaxed max-w-2xl">
              Theo dõi tổng quan tài nguyên người dùng, lưu lượng truy cập và tình trạng vận hành nền tảng SMH toàn hệ thống.
            </p>
          </div>
        </div>

        {/* 2 STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Card 1: Tổng Số Tài Khoản */}
          <div className="bg-white dark:bg-[#0B0F17] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-rose-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Tổng Số Tài Khoản
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-rose-500 mt-1" />
                ) : (
                  `${stats.total_accounts} tài khoản`
                )}
              </h3>
            </div>
          </div>

          {/* Card 2: Tổng Lượt Truy Cập Tài Khoản */}
          <div className="bg-white dark:bg-[#0B0F17] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-teal-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Lượt Truy Cập Tài Khoản
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-teal-500 mt-1" />
                ) : (
                  `${(stats.account_visits || stats.total_visits_admin).toLocaleString()} lượt`
                )}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={`Toàn trang: ${stats.total_visits_global.toLocaleString()} lượt (${stats.total_account_visits.toLocaleString()} thành viên + ${stats.guest_visits.toLocaleString()} khách)`}>
                Toàn trang: {stats.total_visits_global.toLocaleString()} lượt ({stats.guest_visits.toLocaleString()} khách)
              </p>
            </div>
          </div>
        </div>

        {/* PHÍM TẮT HÀNH ĐỘNG NHANH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <Link
            href={API_ROUTES.ADMIN.USERS_SCREEN}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors whitespace-nowrap">
                  Quản lý tài khoản
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Phê duyệt & phân quyền vai trò
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
          </Link>

          <Link
            href={API_ROUTES.ADMIN.PERMISSIONS_SCREEN}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors whitespace-nowrap">
                  Phân quyền màn hình
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Ma trận phân quyền vai trò
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors shrink-0" />
          </Link>

          <Link
            href={API_ROUTES.ADMIN.USER_CENTRES_SCREEN}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap">
                  Cơ sở trực thuộc
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Quản lý 101 cơ sở trực thuộc
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </Link>

          <Link
            href={API_ROUTES.ADMIN.TRIAL_SCHEDULES_SCREEN}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                  Lịch trải nghiệm
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Kiểm tra ca trải nghiệm ma trận
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
