"use client";

import React from "react";
import Link from "next/link";
import { SMHLogo } from "@/components/brand/SMHLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import SystemFooter from "@/components/layout/SystemFooter";
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  FileText,
  HardDrive,
  Key,
  UserCheck,
  CheckCircle2,
  Mail,
  AlertTriangle,
  Sun,
  Moon,
  ExternalLink,
} from "lucide-react";

export default function PrivacyPolicyPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden transition-colors duration-300">
      {/* Background Ambience Glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-4 border-b border-slate-200 dark:border-white/5 relative z-10">
        <SMHLogo size="md" href="/" />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-all shadow-sm cursor-pointer"
            title={`Chuyển sang giao diện ${theme === "dark" ? "Sáng" : "Tối"}`}
            aria-label="Chuyển đổi giao diện Sáng / Tối"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
            <span className="text-xs font-semibold whitespace-nowrap hidden sm:inline">
              {theme === "dark" ? "Giao diện Tối" : "Giao diện Sáng"}
            </span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors shadow-sm whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto my-8 flex-1 relative z-10">
        {/* Page Title */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-3 shadow-sm whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" />
            Bảo Mật & Riêng Tư
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Chính Sách Quyền Riêng Tư
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl mx-auto">
            Quy định về bảo mật dữ liệu, cơ chế thu thập thông tin và chính sách tuân thủ khi liên kết dịch vụ Google trên nền tảng School MindX Hub (SMH).
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
            Cập nhật lần cuối: Ngày 09 tháng 09 năm 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0E131F]/90 backdrop-blur-xl p-6 sm:p-10 shadow-xl space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {/* Section 1: Giới thiệu */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                1
              </span>
              <h2>Giới Thiệu Chung</h2>
            </div>
            <p>
              Hệ thống <strong>School MindX Hub (SMH)</strong> là nền tảng quản lý nội bộ dành riêng cho đội ngũ giảng viên, quản trị viên và nhân sự tại MindX Technology School. Chúng tôi cam kết bảo vệ tuyệt đối quyền riêng tư và thông tin cá nhân của người dùng khi sử dụng các dịch vụ của hệ thống.
            </p>
          </section>

          {/* Section 2: Dữ liệu thu thập */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                2
              </span>
              <h2>Thông Tin Thu Thập</h2>
            </div>
            <p>
              Khi người dùng thực hiện liên kết tài khoản hoặc sử dụng hệ thống, chúng tôi có thể thu thập các thông tin sau:
            </p>
            <ul className="space-y-2 pl-2">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Thông tin hồ sơ cơ bản từ Google:</strong> Địa chỉ Email, Họ và tên hiển thị, Ảnh đại diện (Avatar).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Thông tin tài khoản nội bộ:</strong> Mã giảng viên LMS MindX, vai trò hệ thống (Admin, Teacher Full-time, Teacher Part-time), danh sách cơ sở trực thuộc được phân công.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Mã thông báo xác thực (OAuth Tokens):</strong> Access Token và Refresh Token để phục vụ kết nối với Google Drive theo sự cho phép rõ ràng của người dùng.
                </span>
              </li>
            </ul>
          </section>

          {/* Section 3: Phạm vi Google Drive & Google API Limited Use */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                3
              </span>
              <h2>Quyền Hạn Google Drive & Tuân Thủ Chính Sách Google</h2>
            </div>
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                <HardDrive className="w-4 h-4 shrink-0" />
                <span>Phạm vi ủy quyền: https://www.googleapis.com/auth/drive.file</span>
              </div>
              <p className="text-xs sm:text-sm">
                Ứng dụng <strong>SMH</strong> chỉ yêu cầu phạm vi quyền hạn <code>drive.file</code>. Phạm vi này đảm bảo hệ thống <strong>chỉ có quyền tạo, đọc và quản lý các tệp hoặc thư mục do chính ứng dụng SMH tạo ra</strong> hoặc các tệp mà bạn chủ động chỉ định chia sẻ cho ứng dụng. Hệ thống <strong>tuyệt đối không thể truy cập, xem hoặc chỉnh sửa bất kỳ tệp tin riêng tư nào khác</strong> trong Google Drive của bạn.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Tuân thủ chính sách dữ liệu người dùng Google API (Limited Use)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Việc hệ thống SMH sử dụng và chuyển giao thông tin nhận được từ Google API cho bất kỳ ứng dụng nào khác sẽ luôn tuân thủ nghiêm ngặt{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                >
                  Chính sách dữ liệu người dùng dịch vụ Google API (Google API Services User Data Policy)
                  <ExternalLink className="w-3 h-3" />
                </a>
                , bao gồm các yêu cầu về <strong>Sử dụng có giới hạn (Limited Use)</strong>.
              </p>
            </div>
          </section>

          {/* Section 4: Mục đích sử dụng dữ liệu */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                4
              </span>
              <h2>Mục Đích Sử Dụng Dữ Liệu</h2>
            </div>
            <p>Thông tin của người dùng được sử dụng cho các mục đích hợp pháp sau:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80">
                <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-rose-500" />
                  Kích hoạt tài khoản
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Xác minh danh tính giảng viên và cập nhật địa chỉ email chính thức phục vụ liên lạc nội bộ.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80">
                <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                  Đồng bộ tài nguyên lớp học
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lưu trữ và đồng bộ hóa tài liệu giảng dạy, bài kiểm tra Checkpoint và sản phẩm cuối khóa (SPCK).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80">
                <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Phân quyền bảo mật RBAC
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đảm bảo mỗi giảng viên chỉ truy cập vào đúng lớp học và cơ sở trực thuộc được cấp phép.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80">
                <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Mail className="w-3.5 h-3.5 text-emerald-500" />
                  Thông báo hệ thống
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nhận thông tin quan trọng về tiến độ lớp học, cập nhật lịch trải nghiệm và lịch vận hành.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Chia sẻ dữ liệu */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                5
              </span>
              <h2>Cam Kết Không Chia Sẻ Dữ Liệu</h2>
            </div>
            <ul className="space-y-2 pl-2">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Không bán dữ liệu:</strong> Chúng tôi tuyệt đối <strong>không bán, cho thuê hoặc thương mại hóa</strong> bất kỳ dữ liệu cá nhân hay dữ liệu Google nào của người dùng.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Không dùng cho quảng cáo:</strong> Dữ liệu Google Drive và thông tin tài khoản hoàn toàn không được sử dụng để phân phát quảng cáo hay huấn luyện mô hình AI của bên thứ ba.
                </span>
              </li>
            </ul>
          </section>

          {/* Section 6: Bảo mật, Lưu trữ & Thu hồi quyền */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                6
              </span>
              <h2>Bảo Mật Dữ Liệu & Quyền Hủy Liên Kết</h2>
            </div>
            <p>
              Hệ thống áp dụng các tiêu chuẩn bảo mật hiện đại bao gồm mã hóa đường truyền HTTPS/TLS, cơ chế xác thực JWT mã hóa HS256 với HttpOnly Cookie an toàn, và phân quyền dữ liệu cấp độ hàng (Row Level Security) trên Supabase.
            </p>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <p className="font-bold text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Quyền thu hồi liên kết (Unlink Google Drive):
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Người dùng hoặc quản trị viên có thể hủy liên kết tài khoản Google Drive bất kỳ lúc nào tại màn hình Quản lý tài khoản. Khi hủy liên kết, toàn bộ mã thông báo truy cập sẽ bị xóa vĩnh viễn khỏi hệ thống. Bạn cũng có thể thu hồi quyền truy cập trực tiếp từ tài khoản Google của mình tại{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-600 dark:text-rose-400 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  Trang quản lý ứng dụng của Google
                  <ExternalLink className="w-3 h-3" />
                </a>.
              </p>
            </div>
          </section>

          {/* Section 7: Thông tin liên hệ */}
          <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                7
              </span>
              <h2>Thông Tin Liên Hệ</h2>
            </div>
            <p>
              Mọi thắc mắc, phản ánh hoặc yêu cầu liên quan đến chính sách quyền riêng tư và dữ liệu người dùng, vui lòng liên hệ:
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                Ban Quản Trị Hệ Thống School MindX Hub (SMH)
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Tổ chức: MindX Technology School
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Tác giả: Huỳnh Nhật Anh - TF Coding HCM4
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Website: <span className="font-mono text-rose-600 dark:text-rose-400">School MindX Hub</span>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <SystemFooter />
    </div>
  );
}
