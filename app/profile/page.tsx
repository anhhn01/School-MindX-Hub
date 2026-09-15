"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Flame,
  UserPlus,
  Save,
  Lock,
  Mail,
  Calendar,
  Sparkles,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Link2Off,
} from "lucide-react";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { ConfirmModal } from "@/components/common/ConfirmModal";

interface UserProfileData {
  id: string;
  full_name: string;
  email: string;
  lms_code: string;
  is_firebase: boolean;
  account_source: string;
  can_edit_name?: boolean;
  can_edit_password?: boolean;
  name_message?: string;
  role: string;
  status: string;
  token_expiry_days?: number;
  created_at: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.USER.API_PROFILE);
      const data = await res.json();
      if (res.ok && data.user) {
        setProfile(data.user);
        setFullName(data.user.full_name || "");
      } else {
        setFeedback({ type: "error", message: data.error || "Không thể tải hồ sơ cá nhân" });
      }
    } catch (_) {
      setFeedback({ type: "error", message: "Lỗi kết nối khi lấy thông tin hồ sơ" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const payload: Record<string, any> = {};

    // 1. Ràng buộc họ tên nếu được phép sửa
    if (profile?.can_edit_name) {
      const cleanName = fullName.trim();
      if (!cleanName || cleanName.length < 2) {
        setFeedback({ type: "error", message: "Họ và tên bắt buộc và phải có ít nhất 2 ký tự." });
        return;
      }
      if (cleanName.length > 70) {
        setFeedback({ type: "error", message: "Họ và tên không được vượt quá 70 ký tự." });
        return;
      }
      payload.full_name = cleanName;
    }

    // 2. Ràng buộc mật khẩu: Kiểm tra độ dài và xác nhận
    if (password && password.length > 0) {
      if (profile?.is_firebase) {
        setFeedback({ type: "error", message: "Tài khoản LMS không được phép thay đổi mật khẩu tại đây." });
        return;
      }
      if (password.length < 6) {
        setFeedback({ type: "error", message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
        return;
      }
      if (password.length > 50) {
        setFeedback({ type: "error", message: "Mật khẩu mới không được vượt quá 50 ký tự." });
        return;
      }
      if (password !== confirmPassword) {
        setFeedback({ type: "error", message: "Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại." });
        return;
      }
      payload.password = password;
    }

    if (Object.keys(payload).length === 0) {
      setFeedback({ type: "error", message: "Không có thông tin nào được thay đổi hoặc thông tin đang được khóa cố định." });
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch(API_ROUTES.USER.API_PROFILE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Đã cập nhật thông tin cá nhân thành công!",
        });
        setPassword("");
        setConfirmPassword("");
        fetchProfile();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("smh:profile_updated"));
        }
      } else {
        setFeedback({ type: "error", message: data.error || "Không thể cập nhật hồ sơ" });
      }
    } catch (_) {
      setFeedback({ type: "error", message: "Lỗi kết nối máy chủ khi lưu hồ sơ" });
    } finally {
      setSaveLoading(false);
    }
  };

  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  const executeUnlinkGoogle = async () => {
    setShowUnlinkModal(false);
    setSaveLoading(true);
    try {
      const res = await fetch("/api/auth/google/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể hủy liên kết Google");
      setFeedback({ type: "success", message: data.message || "Đã hủy liên kết Google Drive thành công." });
      await fetchProfile();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSaveLoading(false);
    }
  };

  const getRoleBadgeStyle = (roleName: string) => {
    const lower = roleName.toLowerCase();
    if (lower.includes("admin")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
    if (lower.includes("full-time") || lower.includes("fulltime")) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
    }
    return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30";
  };

  return (
    <AppLayout
      pageTitle="Hồ Sơ Cá Nhân"
      breadcrumbs={[
        { label: "Hệ thống", href: "/" },
        { label: "Hồ sơ cá nhân" },
      ]}
    >
      <div className="space-y-6">
        {/* Unified Page Header Bar */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate uppercase">
                Hồ Sơ Cá Nhân
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý thông tin định danh và bảo mật tài khoản
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchProfile}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-500" : ""}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 animate-fade-in ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Đang tải thông tin hồ sơ...
          </div>
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: THẺ ĐỊNH DANH (IDENTITY CARD) */}
            <div className="lg:col-span-1 space-y-6">
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 shadow-xl relative overflow-hidden">
                {/* Decorative background ambient */}
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-col items-center text-center relative z-10">
                  {/* Large Avatar */}
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-rose-600 via-rose-500 to-red-600 text-white font-extrabold text-3xl flex items-center justify-center shadow-xl shadow-rose-600/30 ring-4 ring-rose-500/20 mb-4">
                    {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {profile.full_name || "Chưa cập nhật tên"}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Mã LMS: <span className="font-bold text-rose-500">{profile.lms_code || "—"}</span>
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-xl border ${getRoleBadgeStyle(
                        profile.role
                      )}`}
                    >
                      {profile.role}
                    </span>
                    <span className="px-3 py-1 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {profile.status}
                    </span>
                  </div>
                </div>

                {/* Identity Details List */}
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> Email
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-medium line-clamp-1">
                        {profile.email || "—"}
                      </span>
                      {profile.email && (
                        <button
                          type="button"
                          onClick={() => setShowUnlinkModal(true)}
                          disabled={saveLoading}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 transition-colors disabled:opacity-40 cursor-pointer"
                          title="Hủy liên kết tài khoản Google Drive"
                        >
                          <Link2Off className="w-3 h-3" />
                          <span>Hủy</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-500" /> Nguồn tài khoản
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      {profile.is_firebase ? (
                        <>
                          <Flame className="w-3.5 h-3.5 text-purple-500" />
                          <span>Tài khoản LMS</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Do website tạo</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" /> Ngày tạo
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString("vi-VN")
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: FORM CHỈNH SỬA THÔNG TIN */}
            <div className="lg:col-span-2">
              <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 shadow-xl">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Cập Nhật Thông Tin Cá Nhân
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chỉnh sửa thông tin hiển thị và mật khẩu đăng nhập của bạn
                    </p>
                  </div>
                  <Sparkles className="w-5 h-5 text-rose-500" />
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5" autoComplete="off">
                  {/* Dummy inputs for browser autofill suppression */}
                  <input type="text" name="fake_u" style={{ display: "none" }} tabIndex={-1} autoComplete="username" />
                  <input type="password" name="fake_p" style={{ display: "none" }} tabIndex={-1} autoComplete="current-password" />

                  {/* Họ và tên */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>Họ và tên *</span>
                        {!profile.can_edit_name ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20 whitespace-nowrap">
                            (Cố định từ LMS)
                          </span>
                        ) : profile.is_firebase ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 whitespace-nowrap">
                            (Chưa có họ tên trên LMS - Được phép sửa)
                          </span>
                        ) : null}
                      </span>
                      {profile.can_edit_name && (
                        <span
                          className={`text-[10px] ${
                            fullName.length > 70 ? "text-rose-500 font-bold" : "text-slate-400"
                          }`}
                        >
                          {fullName.length}/70 ký tự
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required={profile.can_edit_name}
                      minLength={2}
                      maxLength={70}
                      disabled={!profile.can_edit_name}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ và tên..."
                      className={`w-full px-4 py-2.5 rounded-2xl border text-sm outline-none transition-all ${
                        !profile.can_edit_name
                          ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 text-slate-500 cursor-not-allowed select-none"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                      }`}
                    />
                    {profile.name_message && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{profile.name_message}</span>
                      </p>
                    )}
                  </div>

                  {/* Readonly info grid: Email & LMS Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                        <span>Mã LMS</span>
                        <span className="text-[10px] text-slate-400 font-normal">(Cố định)</span>
                      </label>
                      <input
                        type="text"
                        disabled
                        value={profile.lms_code || ""}
                        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 text-slate-500 text-sm cursor-not-allowed font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                        <span>Email</span>
                        <div className="flex items-center gap-2">
                          {profile.email ? (
                            <button
                              type="button"
                              onClick={() => setShowUnlinkModal(true)}
                              disabled={saveLoading}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:underline cursor-pointer disabled:opacity-50"
                              title="Hủy liên kết tài khoản Google Drive"
                            >
                              <Link2Off className="w-3 h-3" />
                              <span>Hủy liên kết</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-normal">(Chưa liên kết)</span>
                          )}
                        </div>
                      </label>
                      <input
                        type="email"
                        disabled
                        value={profile.email || ""}
                        placeholder="Chưa có email liên kết"
                        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 text-slate-500 text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Phần Đổi Mật Khẩu */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-rose-500" />
                      <span>Đổi Mật Khẩu</span>
                      {profile.is_firebase && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20 whitespace-nowrap">
                          (Khóa - Chỉ dành cho tài khoản website cấp)
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                      {profile.is_firebase
                        ? "Mật khẩu chỉ được thay đổi khi tài khoản do website cấp. Tài khoản LMS được xác thực trực tiếp qua hệ thống LMS MindX."
                        : "Để trống nếu bạn không có nhu cầu thay đổi mật khẩu hiện tại (Ràng buộc: 6 - 50 ký tự)."}
                    </p>

                    {!profile.is_firebase ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Mật khẩu mới
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                placeholder="Tối thiểu 6 ký tự..."
                                maxLength={50}
                                className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Xác nhận mật khẩu mới
                            </label>
                            <input
                              type={showPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              autoComplete="new-password"
                              placeholder="Nhập lại mật khẩu mới..."
                              maxLength={50}
                              className={`w-full px-4 py-2.5 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 transition-all ${
                                confirmPassword && password !== confirmPassword
                                  ? "border-rose-500 focus:ring-rose-500"
                                  : confirmPassword && password === confirmPassword
                                  ? "border-emerald-500 focus:ring-emerald-500"
                                  : "border-slate-200 dark:border-slate-800 focus:ring-rose-500"
                              }`}
                            />
                          </div>
                        </div>

                        {/* Password strength and match hints */}
                        {password.length > 0 && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Độ mạnh mật khẩu:</span>
                              <span
                                className={`font-bold ${
                                  password.length < 6
                                    ? "text-rose-500"
                                    : password.length < 10
                                    ? "text-amber-500"
                                    : "text-emerald-500"
                                }`}
                              >
                                {password.length < 6
                                  ? "Yếu (ít hơn 6 ký tự)"
                                  : password.length < 10
                                  ? "Trung bình"
                                  : "Mạnh"}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  password.length < 6
                                    ? "w-1/4 bg-rose-500"
                                    : password.length < 10
                                    ? "w-2/3 bg-amber-500"
                                    : "w-full bg-emerald-500"
                                }`}
                              />
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                              <p className="text-rose-500 text-[11px] font-medium pt-1">
                                ⚠ Mật khẩu xác nhận chưa trùng khớp.
                              </p>
                            )}
                            {confirmPassword && password === confirmPassword && (
                              <p className="text-emerald-500 text-[11px] font-medium pt-1">
                                ✓ Mật khẩu xác nhận trùng khớp hoàn toàn.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>Mật khẩu chỉ được thay đổi khi là tài khoản do website cấp.</span>
                      </div>
                    )}
                  </div>

                  {/* Nút Submit */}
                  <div className="pt-4 flex justify-end">
                    {!profile.can_edit_name && !profile.can_edit_password ? (
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Thông tin cá nhân được bảo lưu cố định từ LMS</span>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={saveLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saveLoading ? "Đang lưu thay đổi..." : "Lưu Thông Tin"}</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        <ConfirmModal
          isOpen={showUnlinkModal}
          onClose={() => setShowUnlinkModal(false)}
          onConfirm={executeUnlinkGoogle}
          title="Hủy liên kết tài khoản Google"
          message="Bạn có chắc chắn muốn hủy liên kết tài khoản Google không? Bạn sẽ cần phải liên kết lại Google Drive vào lần đăng nhập tiếp theo."
          type="warning"
          confirmText="Hủy liên kết"
          cancelText="Giữ lại"
          isLoading={saveLoading}
        />
      </div>
    </AppLayout>
  );
}
