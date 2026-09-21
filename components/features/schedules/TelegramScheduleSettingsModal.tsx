"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Save,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  BellRing,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { TelegramReminderConfig } from "@/lib/services/telegram-schedule-service";

interface TelegramScheduleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
}

const DAYS_OF_WEEK = [
  { label: "Thứ 2", value: 1 },
  { label: "Thứ 3", value: 2 },
  { label: "Thứ 4", value: 3 },
  { label: "Thứ 5", value: 4 },
  { label: "Thứ 6", value: 5 },
  { label: "Thứ 7", value: 6 },
  { label: "Chủ nhật", value: 0 },
];

export default function TelegramScheduleSettingsModal({
  isOpen,
  onClose,
  selectedDate,
}: TelegramScheduleSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [config, setConfig] = useState<TelegramReminderConfig>({
    enabled: false,
    frequency: "DAILY",
    sendTime: "08:00",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    dayOfMonth: 1,
    targetDateOffset: "TODAY",
    centreFilter: "ALL",
  });

  // Tải cấu hình hiện tại
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setStatusMessage(null);
      fetch("/api/telegram/trial-schedules-reminder")
        .then((res) => res.json())
        .then((data) => {
          if (data.config) {
            setConfig(data.config);
          }
        })
        .catch((err) => {
          console.error("Lỗi tải cấu hình Telegram:", err);
          setStatusMessage({ type: "error", text: "Không thể tải cấu hình từ máy chủ" });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleDayOfWeek = (dayVal: number) => {
    const currentDays = config.daysOfWeek || [];
    let updated: number[];
    if (currentDays.includes(dayVal)) {
      if (currentDays.length === 1) return; // Giữ ít nhất 1 ngày
      updated = currentDays.filter((d) => d !== dayVal);
    } else {
      updated = [...currentDays, dayVal].sort((a, b) => a - b);
    }
    setConfig({ ...config, daysOfWeek: updated });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/telegram/trial-schedules-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể lưu cài đặt");
      }
      setStatusMessage({ type: "success", text: "Đã lưu cài đặt hẹn giờ Telegram thành công!" });
      setTimeout(() => {
        setStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Lỗi khi lưu cài đặt" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    setTesting(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/telegram/trial-schedules-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_send",
          targetDate: selectedDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Gửi thử nghiệm thất bại");
      }
      setStatusMessage({
        type: "success",
        text: `Gửi thử thành công! Đã chuyển ${data.totalShifts || 0} ca trải nghiệm đến Telegram.`,
      });
      // Phát event để chuông thông báo trên Header tải lại
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("smh:notifications_updated"));
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Lỗi khi gửi thử tin nhắn Telegram" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25">
              <Send className="w-5 h-5 -translate-x-0.5 translate-y-0.5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Cài Đặt Thông Báo Telegram
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Lịch Trải Nghiệm
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động gửi danh sách ca trải nghiệm đến nhóm Telegram theo lịch hẹn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
              <p className="text-sm font-medium">Đang tải cấu hình hẹn giờ...</p>
            </div>
          ) : (
            <>
              {/* Alert Feedback */}
              {statusMessage && (
                <div
                  className={`flex items-start gap-2.5 p-3.5 rounded-2xl text-xs font-medium border animate-in fade-in slide-in-from-top-2 duration-200 ${
                    statusMessage.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1 leading-relaxed">{statusMessage.text}</span>
                </div>
              )}

              {/* Card Bật / Tắt trạng thái */}
              <div
                className={`p-4.5 rounded-2xl border transition-all flex items-center justify-between ${
                  config.enabled
                    ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50"
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      config.enabled
                        ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    <BellRing className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Trạng thái tự động gửi thông báo
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {config.enabled
                        ? "Hệ thống sẽ tự động quét và gửi tin nhắn đúng khung giờ đã hẹn"
                        : "Tính năng đang tạm dừng. Sẽ không có tin nhắn tự động nào được gửi"}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* Tần suất gửi (Frequency) */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" />
                  Tần suất gửi thông báo
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: "DAILY", title: "Hàng ngày", desc: "Mỗi ngày 1 lần" },
                      { id: "WEEKLY", title: "Hàng tuần", desc: "Theo ngày cố định" },
                      { id: "MONTHLY", title: "Hàng tháng", desc: "1 ngày trong tháng" },
                    ] as const
                  ).map((f) => {
                    const isSelected = config.frequency === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setConfig({ ...config, frequency: f.id })}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300 shadow-sm"
                            : "bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="text-xs font-bold whitespace-nowrap">{f.title}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{f.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ngày trong tuần nếu là WEEKLY */}
              {config.frequency === "WEEKLY" && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Chọn các ngày trong tuần gửi thông báo:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((d) => {
                      const active = (config.daysOfWeek || []).includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => handleToggleDayOfWeek(d.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            active
                              ? "bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/20"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ngày trong tháng nếu là MONTHLY */}
              {config.frequency === "MONTHLY" && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Chọn ngày trong tháng:</span>
                    <span className="font-bold text-rose-500">Ngày {config.dayOfMonth || 1} hàng tháng</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="31"
                    value={config.dayOfMonth || 1}
                    onChange={(e) => setConfig({ ...config, dayOfMonth: Number(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Ngày 01</span>
                    <span>Ngày 15</span>
                    <span>Ngày 31</span>
                  </div>
                </div>
              )}

              {/* Khung giờ gửi & Báo ngày nào */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Giờ gửi */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    Khung giờ gửi (Giờ VN)
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={config.sendTime || "08:00"}
                      onChange={(e) => setConfig({ ...config, sendTime: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  {/* Phím chọn nhanh */}
                  <div className="flex gap-1.5 flex-wrap">
                    {["07:30", "08:00", "08:30", "19:00", "20:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setConfig({ ...config, sendTime: t })}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-colors ${
                          config.sendTime === t
                            ? "bg-rose-500 text-white border-rose-600"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Báo lịch của ngày nào */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    Nội dung lịch thông báo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, targetDateOffset: "TODAY" })}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        config.targetDateOffset === "TODAY"
                          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300 font-bold"
                          : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                      }`}
                    >
                      <div className="text-xs">Lịch Hôm Nay</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Ngày gửi tin</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, targetDateOffset: "TOMORROW" })}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        config.targetDateOffset === "TOMORROW"
                          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300 font-bold"
                          : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                      }`}
                    >
                      <div className="text-xs">Lịch Ngày Mai</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Báo trước 1 ngày</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Thông tin xác thực Telegram từ .env */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Kênh đích: Nhóm Telegram từ file <b>.env</b> (Chat ID: 6245367890)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                  Đã kết nối
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            disabled={testing || saving || loading}
            onClick={handleTestSend}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-sky-300 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            ) : (
              <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            )}
            <span>{testing ? "Đang gửi thử..." : `Gửi thử ngày ${selectedDate}`}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={saving || testing || loading}
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? "Đang lưu..." : "Lưu cài đặt"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
