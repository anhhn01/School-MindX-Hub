"use client";

import AppLayout from "@/components/layout/AppLayout";
import { BookOpen, CheckCircle2, TrendingUp, Award, Clock } from "lucide-react";

export default function DashboardPage() {
  return (
    <AppLayout
      pageTitle="Bảng Điều Khiển Tổng Quan"
      breadcrumbs={[
        { label: "Tổng quan", href: "/dashboard" },
        { label: "Dashboard" },
      ]}
    >
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 rounded-3xl p-8 sm:p-10 text-white shadow-2xl shadow-rose-600/20">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-3 border border-white/20 whitespace-nowrap">
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Cổng Thông Tin Học Thuật SMH</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 whitespace-nowrap">
              Chào Mừng Đến Với School MindX Hub
            </h2>
            <p className="text-rose-100 text-xs sm:text-sm leading-relaxed">
              Không gian quản lý tập trung tài khoản, lịch trình học tập và giám sát các chương trình đào tạo.
            </p>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-[#0B0F17] p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Tổng Số Khóa Học
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white whitespace-nowrap">
                12
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B0F17] p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Tiến Độ Đào Tạo
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white whitespace-nowrap">
                65%
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B0F17] p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block whitespace-nowrap">
                Điểm Đánh Giá Trung Bình
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white whitespace-nowrap">
                8.5 / 10
              </h3>
            </div>
          </div>
        </div>

        {/* News & Announcement List */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800/80 p-6 sm:p-8 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 whitespace-nowrap">
            Thông Báo Hệ Thống Mới Nhất
          </h3>
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 hover:border-rose-500/30 transition-colors flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">
                  Khóa học mới: Advanced Full-stack Engineering
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tài liệu giảng dạy và lộ trình học tập chuyên sâu đã được cập nhật trên cổng học thuật SMH.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 hover:border-rose-500/30 transition-colors flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">
                  Hạn hoàn tất chấm đồ án kỳ 1
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Quý Thầy/Cô vui lòng cập nhật kết quả đánh giá học viên trước hạn quy định.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}