"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Activity, Award, RefreshCw, CalendarCheck, Building2, Users, ArrowUpRight } from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";

export default function TeacherFullTimeDashboardPage() {
  const [visits, setVisits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_ROUTES.DASHBOARD_STATS)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setVisits(data.stats.account_visits || data.stats.total_visits_fulltime || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout
      pageTitle="Bảng Điều Khiển Giáo Viên Cơ Hữu"
      breadcrumbs={[
        { label: "Giảng dạy", href: "/teacher-fulltime/dashboard" },
        { label: "Dashboard Full-time" },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 rounded-3xl p-6 sm:p-10 text-white shadow-2xl shadow-rose-600/20">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-3 border border-white/20 whitespace-nowrap">
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Giáo Viên Cơ Hữu (Full-time)</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-2 break-words">
              Không Gian Quản Lý Đào Tạo & Giảng Dạy
            </h2>
            <p className="text-rose-100 text-xs sm:text-sm leading-relaxed">
              Theo dõi lịch lớp, tiến độ đào tạo và kiểm tra lịch trải nghiệm học viên tại các cơ sở trực thuộc.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="bg-white dark:bg-[#0B0F17] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4 hover:border-teal-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="p-3.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Lượt Truy Cập Tài Khoản
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-teal-500 mt-1" />
                ) : (
                  `${visits.toLocaleString()} lượt`
                )}
              </h3>
            </div>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <Link
            href={API_ROUTES.TEACHER_FULLTIME.TRIAL_SCHEDULES_SCREEN}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors whitespace-nowrap">
                  Lịch trải nghiệm
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Kiểm tra ca trải nghiệm tại 4 cơ sở trực thuộc
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
          </Link>

          <Link
            href={API_ROUTES.TEACHER_FULLTIME.USER_CENTRES_SCREEN}
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
                  Xem danh sách cơ sở được phân công
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </Link>

          <Link
            href={API_ROUTES.TEACHER_FULLTIME.USERS_SCREEN}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors whitespace-nowrap">
                  Quản lý tài khoản
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Xét duyệt tài khoản theo phạm vi cấp bậc
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors shrink-0" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
