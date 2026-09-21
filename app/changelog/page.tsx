"use client";

import React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { CURRENT_VERSION } from "@/lib/constants/version";
import {
  Sparkles,
  Calendar,
  CheckCircle,
  Tag,
  Rocket,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function ChangelogPage() {
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Tính Năng Mới":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap">
            <Rocket className="w-3 h-3" />
            {category}
          </span>
        );
      case "Cải Tiến":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
            <Zap className="w-3 h-3" />
            {category}
          </span>
        );
      case "Bảo Mật & Ổn Định":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
            <ShieldCheck className="w-3 h-3" />
            {category}
          </span>
        );
    }
  };

  return (
    <AppLayout
      pageTitle="Nhật Ký Phiên Bản"
      breadcrumbs={[
        { label: "Trang chủ", href: "/" },
        { label: "Nhật ký phiên bản" },
      ]}
    >
      <div className="w-full max-w-4xl mx-auto py-6 relative z-10 font-sans">
        {/* Page Title */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-3 shadow-sm whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5" />
            Phiên Bản Mới Nhất
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            NHẬT KÝ PHÁT HÀNH HỆ THỐNG
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base mt-2 max-w-xl mx-auto leading-relaxed">
            Tổng hợp các tính năng nổi bật, nâng cấp trải nghiệm và cải tiến bảo mật vừa được cập nhật trên nền tảng School MindX Hub.
          </p>
        </div>

        {/* Single Latest Version Card */}
        <div className="bg-white dark:bg-gradient-to-b dark:from-[#0F1524] dark:to-[#0A0D17] border border-slate-200 dark:border-white/10 rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl dark:shadow-2xl relative overflow-hidden">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500" />

          {/* Version Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                  {CURRENT_VERSION.version}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-rose-600 text-white shadow-md shadow-rose-600/30 whitespace-nowrap">
                  Mới Nhất
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                {CURRENT_VERSION.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 self-start sm:self-auto bg-slate-50 dark:bg-white/5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/5 whitespace-nowrap">
              <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Phát hành: {CURRENT_VERSION.releaseDate}</span>
            </div>
          </div>

          {/* Version Summary */}
          <div className="my-6 p-4 sm:p-5 rounded-2xl bg-rose-500/5 border border-rose-500/15 text-slate-700 dark:text-slate-300 text-xs sm:text-sm md:text-base leading-relaxed">
            {CURRENT_VERSION.summary}
          </div>

          {/* Features List */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-rose-500" />
              Chi tiết các tính năng chính:
            </h3>

            <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
              {CURRENT_VERSION.features.map((feature, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-[#141A29]/70 border border-slate-200/80 dark:border-white/5 hover:border-rose-500/30 transition-all hover:bg-white dark:hover:bg-[#161D2E] shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                        {feature.title}
                      </h4>
                    </div>
                    <div>{getCategoryBadge(feature.category)}</div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-6 sm:pl-7">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
