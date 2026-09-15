import React from "react";
import Link from "next/link";
import { SMHLogo } from "@/components/brand/SMHLogo";
import { CURRENT_VERSION } from "@/lib/constants/version";

export default function SystemFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#0B0F17]/70 backdrop-blur-md py-4 mt-auto transition-colors duration-300">
      <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 text-xs">
        {/* Cột 1: Thông tin thương hiệu SMH & Tác giả */}
        <div className="flex items-center gap-3 text-center sm:text-left">
          <SMHLogo size="sm" showText={false} href="/" />
          <div>
            <p className="font-extrabold text-slate-900 dark:text-white tracking-tight">
              School MindX Hub (SMH)
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">
              Website nội bộ được xây dựng bởi{" "}
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                Huỳnh Nhật Anh - TF Coding HCM4
              </span>
            </p>
          </div>
        </div>

        {/* Cột 2: Bản quyền & Phiên bản mới nhất có link đến Changelog */}
        <div className="text-slate-500 dark:text-slate-400 text-center sm:text-right text-[11px] space-y-0.5">
          <p className="whitespace-nowrap flex items-center justify-center sm:justify-end gap-1.5">
            <span>© {new Date().getFullYear()} School MindX Hub.</span>
            <span>•</span>
            <Link
              href="/privacy"
              className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors hover:underline"
            >
              Chính sách quyền riêng tư
            </Link>
          </p>
          <p className="text-[11px] whitespace-nowrap">
            <Link
              href="/changelog"
              className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-500 hover:underline transition-colors"
            >
              Phiên bản {CURRENT_VERSION.version}
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20">
                Mới nhất
              </span>
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
