"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  BookOpen,
  Users,
  ClipboardCheck,
  Activity,
  Sparkles,
  RefreshCw,
  CalendarCheck,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";

interface ParttimeStats {
  total_classes: number;
  total_students: number;
  total_submissions: number;
  total_visits: number;
}

export default function TeacherPartTimeDashboardPage() {
  const [stats, setStats] = useState<ParttimeStats>({
    total_classes: 4,
    total_students: 68,
    total_submissions: 152,
    total_visits: 222,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_ROUTES.DASHBOARD_STATS)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setStats({
            total_classes: data.stats.total_classes_parttime || 4,
            total_students: data.stats.total_students_parttime || 68,
            total_submissions: data.stats.total_submissions_parttime || 152,
            total_visits: data.stats.account_visits || data.stats.total_visits_parttime || 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout
      pageTitle="Bảng Điều Khiển Giáo Viên Thỉnh Giảng"
      breadcrumbs={[
        { label: "Giảng dạy", href: "/teacher-parttime/dashboard" },
        { label: "Dashboard Part-time" },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 rounded-3xl p-6 sm:p-10 text-white shadow-2xl shadow-rose-600/20">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-3 border border-white/20 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Giáo Viên Thỉnh Giảng (Part-time)</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-2 break-words">
              Không Gian Quản Lý Lớp Học & Bài Nộp
            </h2>
            <p className="text-rose-100 text-xs sm:text-sm leading-relaxed">
              Theo dõi toàn diện các lớp học, học viên phụ trách, bài tập nộp và tra cứu lịch trải nghiệm hỗ trợ công tác giảng dạy MindX.
            </p>
          </div>
        </div>

        {/* 4 STATS CARDS THEO YÊU CẦU */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {/* 1. Tổng số lớp học */}
          <div className="bg-white dark:bg-[#0B0F17] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4 hover:border-rose-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Tổng Số Lớp Học
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-500 mt-1" />
                ) : (
                  `${stats.total_classes} lớp`
                )}
              </h3>
            </div>
          </div>

          {/* 2. Tổng số học viên */}
          <div className="bg-white dark:bg-[#0B0F17] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4 hover:border-purple-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Tổng Số Học Viên
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-500 mt-1" />
                ) : (
                  `${stats.total_students} học viên`
                )}
              </h3>
            </div>
          </div>

          {/* 3. Tổng số bài nộp */}
          <div className="bg-white dark:bg-[#0B0F17] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4 hover:border-blue-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Tổng Số Bài Nộp
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-500 mt-1" />
                ) : (
                  `${stats.total_submissions} bài nộp`
                )}
              </h3>
            </div>
          </div>

          {/* 4. Tổng lượt truy cập */}
          <div className="bg-white dark:bg-[#0B0F17] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4 hover:border-teal-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="p-3.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Lượt Truy Cập Tài Khoản
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-500 mt-1" />
                ) : (
                  `${stats.total_visits.toLocaleString()} lượt`
                )}
              </h3>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <Link
            href={API_ROUTES.TEACHER_PARTTIME.TRIAL_SCHEDULES_SCREEN}
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
                  Kiểm tra ca trải nghiệm tại các cơ sở phụ trách
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
          </Link>

          <Link
            href={API_ROUTES.TEACHER_PARTTIME.USER_CENTRES_SCREEN}
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
                  Xem danh sách 4 cơ sở được phân công
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
