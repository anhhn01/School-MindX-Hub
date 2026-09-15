"use client";

import React from "react";
import { Check, AlertCircle, CheckCircle2, AlertTriangle, X } from "lucide-react";

export interface ToastData {
  text: string;
  type: "success" | "error" | "info" | "warning";
}

interface ToastProps {
  toast: ToastData | null;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs sm:text-sm font-bold transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
        toast.type === "success"
          ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/25"
          : toast.type === "error"
          ? "bg-rose-500 text-white border-rose-600 shadow-rose-500/25"
          : toast.type === "warning"
          ? "bg-amber-500 text-white border-amber-600 shadow-amber-500/25"
          : "bg-slate-900 dark:bg-[#0B0F17] text-white border-slate-700 shadow-black/40"
      }`}
    >
      {toast.type === "success" && <Check className="w-4 h-4 shrink-0" />}
      {toast.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
      {toast.type === "warning" && <AlertTriangle className="w-4 h-4 shrink-0" />}
      {toast.type === "info" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
      <span className="leading-snug">{toast.text}</span>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="p-1 rounded-lg hover:bg-white/20 transition-colors ml-1 cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
