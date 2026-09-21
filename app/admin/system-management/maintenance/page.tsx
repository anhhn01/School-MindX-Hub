"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Laptop,
} from "lucide-react";
import Link from "next/link";

export default function MaintenanceManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [expectedEndTime, setExpectedEndTime] = useState<string>("");
  const [reason, setReason] = useState<string>(
    "Hệ thống đang được nâng cấp và bảo trì định kỳ."
  );
  const [environment, setEnvironment] = useState<string>("local");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [updatedBy, setUpdatedBy] = useState<string>("");

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/maintenance");
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setIsEnabled(Boolean(data.isEnabled));
        setReason(data.reason || "Hệ thống đang được nâng cấp và bảo trì định kỳ.");
        setEnvironment(data.environment || "local");
        setUpdatedAt(data.updatedAt || "");
        setUpdatedBy(data.updatedBy || "");

        if (data.expectedEndTime) {
          // Format sang YYYY-MM-DDTHH:mm cho datetime-local
          const date = new Date(data.expectedEndTime);
          const localIso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setExpectedEndTime(localIso);
        } else {
          setExpectedEndTime("");
        }
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Không thể tải cấu hình bảo trì: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSetPresetHours = (hours: number) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setExpectedEndTime(localIso);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      let finalDateIso = null;
      if (expectedEndTime) {
        finalDateIso = new Date(expectedEndTime).toISOString();
      }

      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled,
          expectedEndTime: finalDateIso,
          reason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Lỗi khi lưu trạng thái bảo trì");
      }

      setMessage({ type: "success", text: json.message });
      fetchConfig();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Lỗi cập nhật bảo trì" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      pageTitle="Quản Lý Bảo Trì"
      breadcrumbs={[
        { label: "Quản lý hệ thống", href: "/admin/system-management/maintenance" },
        { label: "Bảo trì hệ thống" },
      ]}
    >
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                  QUẢN LÝ BẢO TRÌ HỆ THỐNG
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Kiểm soát trạng thái kích hoạt bảo trì toàn hệ thống
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={fetchConfig}
              disabled={loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-500" : ""}`} />
              <span>Làm mới</span>
            </button>
            <Link
              href="/maintenance"
              target="_blank"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 transition whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Xem trang bảo trì</span>
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-3 border ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Main Settings Card */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 rounded-3xl p-5 sm:p-8 space-y-6 shadow-sm">
          {/* Toggle Switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Kích hoạt Chế độ Bảo trì (Maintenance Mode)
                </span>
                {isEnabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Đang Bật
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap">
                    Đang Tắt
                  </span>
                )}
              </div>
            </div>

            {/* Custom Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-600 shadow-inner"></div>
            </label>
          </div>

          {/* Expected End Time Input */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                Ngày giờ dự kiến kết thúc bảo trì
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                Nếu để trống: Mặc định là <strong>3 tiếng sau</strong>
              </span>
            </div>

            <div className="relative">
              <input
                type="datetime-local"
                value={expectedEndTime}
                onChange={(e) => setExpectedEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition"
              />
            </div>

            {/* Preset shortcuts */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Chọn nhanh:</span>
              <button
                type="button"
                onClick={() => handleSetPresetHours(3)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition cursor-pointer whitespace-nowrap"
              >
                Mặc định (+3 tiếng)
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetHours(1)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap"
              >
                +1 tiếng
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetHours(6)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap"
              >
                +6 tiếng
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetHours(12)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap"
              >
                +12 tiếng
              </button>
              <button
                type="button"
                onClick={() => setExpectedEndTime("")}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 transition cursor-pointer whitespace-nowrap"
              >
                Xóa ngày giờ (Dùng 3 tiếng mặc định)
              </button>
            </div>
          </div>

          {/* Reason / Notice Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
              Thông báo / Lý do bảo trì hiển thị với Thầy/Cô
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập thông điệp bảo trì"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition resize-none"
            />
          </div>

          {/* Metadata Footer */}
          {updatedAt && (
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 dark:border-slate-800">
              <span>
                Cập nhật lần cuối:{" "}
                <strong className="text-slate-800 dark:text-slate-200 font-mono">
                  {new Date(updatedAt).toLocaleString("vi-VN")}
                </strong>
              </span>
              {updatedBy && (
                <span>
                  Thực hiện bởi: <strong className="text-slate-800 dark:text-slate-200">{updatedBy}</strong>
                </span>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-600/25 transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Đang lưu cấu hình..." : "Lưu Cấu Hình Bảo Trì"}</span>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
