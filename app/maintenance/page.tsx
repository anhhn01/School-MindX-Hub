"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SMHLogo } from "@/components/brand/SMHLogo";
import { Wrench, ShieldAlert, Clock, RefreshCw, LogIn, ArrowRight } from "lucide-react";

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState<{
    isEnabled: boolean;
    expectedEndTime: string | null;
    reason?: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/maintenance");
      if (res.ok) {
        const json = await res.json();
        setMaintenance(json.data);
      }
    } catch (err) {
      console.error("Lỗi kiểm tra bảo trì:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Tự động cập nhật mỗi 30s
    return () => clearInterval(interval);
  }, []);

  // Tính đếm ngược
  useEffect(() => {
    if (!maintenance?.expectedEndTime) return;

    const calculateTime = () => {
      const target = new Date(maintenance.expectedEndTime!).getTime();
      const diff = target - Date.now();

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isOverdue: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isOverdue: false });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [maintenance?.expectedEndTime]);

  // Format giờ dự kiến kết thúc
  const formattedEndTime = maintenance?.expectedEndTime
    ? new Date(maintenance.expectedEndTime).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 border-b border-white/5 relative z-10">
        <SMHLogo size="md" href="/maintenance" />
        <div className="flex items-center gap-2">
          {maintenance?.isEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Đang Bảo Trì
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Hoạt Động Bình Thường
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-2xl my-auto py-10 flex flex-col items-center text-center relative z-10">
        {/* Animated Icon badge */}
        <div className="relative mb-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-transparent border border-rose-500/30 flex items-center justify-center shadow-2xl shadow-rose-950/40">
            <Wrench className="w-12 h-12 sm:w-14 sm:h-14 text-rose-500 animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-[#0F172A] border border-amber-500/40 rounded-xl shadow-lg">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
          HỆ THỐNG ĐANG BẢO TRÌ
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg mb-8">
          {maintenance?.reason ||
            "School MindX Hub (SMH) đang được tối ưu hóa và nâng cấp định kỳ nhằm mang đến trải nghiệm tốt nhất cho Thầy/Cô."}
        </p>

        {/* Status Finished Notice */}
        {maintenance && !maintenance.isEnabled && (
          <div className="w-full p-4 mb-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2">
            <span>🎉 Quá trình bảo trì đã kết thúc! Bạn có thể quay lại trang chủ hoặc đăng nhập bình thường.</span>
          </div>
        )}

        {/* Countdown Box */}
        {maintenance?.isEnabled && (
          <div className="w-full bg-[#0F1420]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-8 shadow-xl">
            <div className="flex items-center justify-center gap-2 text-rose-400 text-xs sm:text-sm font-bold uppercase tracking-wider mb-4">
              <Clock className="w-4 h-4" />
              {timeLeft.isOverdue
                ? "Giai đoạn bảo trì sắp hoàn tất, vui lòng chờ trong giây lát..."
                : "Thời gian dự kiến hoàn tất"}
            </div>

            {!timeLeft.isOverdue && (
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-4">
                <div className="bg-[#182032] border border-white/5 rounded-xl py-3 px-2">
                  <span className="text-2xl sm:text-4xl font-black text-white font-mono">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <p className="text-[11px] uppercase font-bold text-slate-400 mt-1">Giờ</p>
                </div>
                <div className="bg-[#182032] border border-white/5 rounded-xl py-3 px-2">
                  <span className="text-2xl sm:text-4xl font-black text-rose-400 font-mono">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <p className="text-[11px] uppercase font-bold text-slate-400 mt-1">Phút</p>
                </div>
                <div className="bg-[#182032] border border-white/5 rounded-xl py-3 px-2">
                  <span className="text-2xl sm:text-4xl font-black text-amber-400 font-mono">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                  <p className="text-[11px] uppercase font-bold text-slate-400 mt-1">Giây</p>
                </div>
              </div>
            )}

            {formattedEndTime && (
              <p className="text-xs text-slate-400">
                Dự kiến mở lại lúc:{" "}
                <span className="font-semibold text-slate-200">{formattedEndTime}</span>
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <button
            onClick={fetchStatus}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Kiểm tra trạng thái
          </button>

          {maintenance && !maintenance.isEnabled ? (
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
            >
              Vào Trang Chủ
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>
          ) : (
            <Link
              href="/login?admin=1"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all hover:scale-[1.02]"
            >
              <LogIn className="w-4 h-4" />
              Quản trị viên đăng nhập
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>
          )}
        </div>
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-5xl py-4 border-t border-white/5 text-center text-xs text-slate-500 relative z-10">
        School MindX Hub (SMH) • Hotline hỗ trợ kỹ thuật MindX LMS
      </footer>
    </div>
  );
}
