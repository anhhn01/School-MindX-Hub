"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Pencil,
  Eye,
  Lock,
  X,
  AlertTriangle,
  Flame,
  UserPlus,
  Search,
  CheckCircle2,
  Trash2,
  EyeOff,
  KeyRound,
  Users,
  Link2Off,
} from "lucide-react";
import { API_ROUTES, getRoleSlug } from "@/lib/constants/api-routes";
import { getRolePoints } from "@/lib/constants/roles";
import { Toast, ToastData } from "@/components/common/Toast";
import { ConfirmModal } from "@/components/common/ConfirmModal";

interface User {
  id: string;
  lms_code: string | null;
  full_name: string | null;
  email?: string | null;
  created_at: string;
  is_firebase: boolean;
  status: string; // Joined text string ("approved", "pending", "rejected")
  status_display_name?: string;
  role: string; // Joined text string ("Admin", "Teacher Full-time", "Teacher Part-time")
  role_points?: number; // 1: Admin (cao nhất), 2: Teacher Full-time, 3: Teacher Part-time (thấp nhất)
}

export default function UserManagementScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string>("Admin");
  const [currentUserRole, setCurrentUserRole] = useState<string>("Admin");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRolePoints, setCurrentUserRolePoints] = useState<number>(1);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pendingAdminTarget, setPendingAdminTarget] = useState<{
    type: "create" | "update";
    userId?: string;
    newRoleName?: string;
  } | null>(null);

  // Toast & Custom Confirm Modal
  const [toastMessage, setToastMessage] = useState<ToastData | null>(null);
  const showToast = (text: string, type: ToastData["type"] = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void | Promise<void>;
    type?: "danger" | "warning" | "info";
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Form State for Add User Modal
  const [addForm, setAddForm] = useState({
    lms_code: "",
    password: "",
    full_name: "",
    is_firebase: false,
    role: "Teacher Part-time",
  });
  const [addChecking, setAddChecking] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
    hasLmsFullname?: boolean;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // State cho bộ lọc và tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Load danh sách người dùng từ API
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.ADMIN.USERS, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách tài khoản");
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Lấy thông tin user hiện tại
  useEffect(() => {
    fetch(API_ROUTES.AUTH.ME, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentAdminName(data.user.name || "Người dùng");
          setCurrentUserId(data.user.id || null);
          const rName = data.user.role || "Admin";
          setCurrentUserRole(rName);
          setCurrentUserRolePoints(getRolePoints(rName));
        }
      })
      .catch(() => {});
    fetchUsers();
  }, []);

  // Xử lý kiểm tra tài khoản LMS khi bấm nút "Kiểm tra"
  const handleCheckLms = async () => {
    const code = addForm.lms_code.trim();
    if (!code) {
      setAddFeedback({ type: "error", text: "Vui lòng nhập Mã LMS để kiểm tra!" });
      return;
    }

    setAddChecking(true);
    setAddFeedback(null);

    try {
      const res = await fetch(API_ROUTES.ADMIN.CHECK_LMS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lms_code: code }),
      });

      const data = await res.json();

      if (data.exists) {
        if (data.has_full_name && data.full_name) {
          setAddForm((prev) => ({
            ...prev,
            is_firebase: true,
            full_name: data.full_name,
          }));
          setAddFeedback({
            type: "success",
            text: `Đã tìm thấy tài khoản trên LMS! Họ tên: "${data.full_name}". Mật khẩu sẽ dùng trực tiếp từ tài khoản LMS.`,
            hasLmsFullname: true,
          });
        } else {
          setAddForm((prev) => ({
            ...prev,
            is_firebase: true,
            full_name: "",
          }));
          setAddFeedback({
            type: "info",
            text: `Tài khoản tồn tại trên LMS nhưng chưa có họ tên. Vui lòng tự nhập họ tên để lưu trữ vào hệ thống.`,
            hasLmsFullname: false,
          });
        }
      } else {
        setAddForm((prev) => ({
          ...prev,
          is_firebase: false,
          full_name: "",
        }));
        setAddFeedback({
          type: "info",
          text: `Mã "${code}" chưa có trên LMS. Đây sẽ là tài khoản cục bộ do website tạo, vui lòng nhập Mật khẩu và Họ tên.`,
          hasLmsFullname: false,
        });
      }
    } catch (err) {
      setAddFeedback({
        type: "error",
        text: "Không thể kết nối đến máy chủ kiểm tra LMS. Vui lòng thử lại!",
      });
    } finally {
      setAddChecking(false);
    }
  };

  // Submit tạo tài khoản
  const handleSubmitCreateUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addForm.lms_code.trim()) {
      showToast("Vui lòng nhập Mã LMS / Tên đăng nhập!", "error");
      return;
    }
    if (!addForm.is_firebase && !addForm.password.trim()) {
      showToast("Vui lòng nhập mật khẩu cho tài khoản do website tạo!", "error");
      return;
    }

    // Role point constraint check: Không được tạo role cao hơn hoặc bằng mình
    const targetPoints = getRolePoints(addForm.role);
    if (targetPoints <= currentUserRolePoints && currentUserRolePoints > 1) {
      showToast("Bạn không có thẩm quyền tạo tài khoản với vai trò này!", "error");
      return;
    }

    if (addForm.role === "Admin" && !pendingAdminTarget) {
      setPendingAdminTarget({ type: "create" });
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch(API_ROUTES.ADMIN.USERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tạo tài khoản");

      showToast(`Đã tạo thành công tài khoản "${addForm.full_name || addForm.lms_code}"!`);
      setShowAddModal(false);
      setPendingAdminTarget(null);
      setAddForm({
        lms_code: "",
        password: "",
        full_name: "",
        is_firebase: false,
        role: "Teacher Part-time",
      });
      setAddFeedback(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Không thể tạo tài khoản", "error");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Xóa tài khoản
  const handleDeleteUser = (user: User) => {
    const targetPoints = getRolePoints(user.role);
    if (targetPoints <= currentUserRolePoints) {
      showToast("Bạn không thể xóa tài khoản của chính mình hoặc vai trò cao hơn/bằng mình!", "error");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Xác nhận xóa tài khoản",
      message: (
        <span>
          Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản{" "}
          <strong className="text-slate-900 dark:text-white">
            "{user.full_name || user.lms_code}"
          </strong>{" "}
          không? Hành động này không thể hoàn tác.
        </span>
      ),
      type: "danger",
      confirmText: "Xóa vĩnh viễn",
      cancelText: "Hủy bỏ",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setUpdatingId(user.id);
        try {
          const res = await fetch(API_ROUTES.ADMIN.USER_DETAIL(user.id), {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Không thể xóa tài khoản");
          showToast(`Đã xóa vĩnh viễn tài khoản "${user.full_name || user.lms_code}" thành công!`);
          fetchUsers();
        } catch (err: any) {
          showToast(err.message || "Không thể xóa tài khoản", "error");
        } finally {
          setUpdatingId(null);
        }
      },
    });
  };

  // Đổi trạng thái tài khoản
  const handleUpdateStatus = async (user: User, newStatus: string) => {
    const targetPoints = getRolePoints(user.role);
    if (targetPoints <= currentUserRolePoints && user.id === currentUserId) {
      showToast("Bạn không thể tự thay đổi trạng thái của chính mình!", "error");
      return;
    }
    if (targetPoints <= currentUserRolePoints && currentUserRolePoints > 1) {
      showToast("Bạn không có quyền đổi trạng thái của vai trò bằng hoặc cao hơn!", "error");
      return;
    }

    setUpdatingId(user.id);
    try {
      const res = await fetch(API_ROUTES.ADMIN.USER_STATUS(user.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể đổi trạng thái");
      showToast(`Đã cập nhật trạng thái của "${user.full_name || user.lms_code}" thành "${newStatus}"!`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Không thể đổi trạng thái", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Đổi vai trò
  const handleUpdateRole = async (user: User, newRole: string) => {
    const targetPoints = getRolePoints(user.role);
    const newRolePoints = getRolePoints(newRole);

    if (targetPoints <= currentUserRolePoints && currentUserRolePoints > 1) {
      showToast("Bạn không thể đổi vai trò của người có cấp bậc bằng hoặc cao hơn!", "error");
      return;
    }
    if (newRolePoints <= currentUserRolePoints && currentUserRolePoints > 1) {
      showToast("Bạn không thể gán vai trò bằng hoặc cao hơn vai trò của bạn!", "error");
      return;
    }

    if (newRole === "Admin") {
      setPendingAdminTarget({
        type: "update",
        userId: user.id,
        newRoleName: newRole,
      });
      return;
    }

    setUpdatingId(user.id);
    try {
      const res = await fetch(API_ROUTES.ADMIN.USER_ROLE(user.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể đổi vai trò");
      showToast(`Đã chuyển vai trò của "${user.full_name || user.lms_code}" thành "${newRole}"!`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Không thể đổi vai trò", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Hủy liên kết Google Drive cho tài khoản cấp dưới
  const handleUnlinkGoogle = (user: User) => {
    const targetPoints = user.role_points || getRolePoints(user.role);
    if (user.id === currentUserId) {
      showToast("Để hủy liên kết Google Drive của chính mình, vui lòng vào trang Hồ sơ cá nhân!", "warning");
      return;
    }
    if (targetPoints <= currentUserRolePoints && currentUserRolePoints > 1) {
      showToast("Bạn không thể hủy liên kết của người có cấp bậc bằng hoặc cao hơn!", "error");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Hủy liên kết Google Drive",
      message: (
        <span>
          Bạn có chắc chắn muốn hủy liên kết Google Drive cho tài khoản{" "}
          <strong className="text-slate-900 dark:text-white">
            "{user.full_name || user.lms_code}"
          </strong>{" "}
          không? Giảng viên này sẽ phải liên kết lại tài khoản Google khi đăng nhập tiếp theo.
        </span>
      ),
      type: "warning",
      confirmText: "Hủy liên kết",
      cancelText: "Giữ lại",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setUpdatingId(user.id);
        try {
          const res = await fetch("/api/auth/google/unlink", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_user_id: user.id }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Không thể hủy liên kết Google Drive");

          showToast(`Đã hủy liên kết Google Drive cho "${user.full_name || user.lms_code}" thành công!`);
          fetchUsers();
          if (viewingUser?.id === user.id) {
            setViewingUser((prev) => (prev ? { ...prev, email: null } : null));
          }
        } catch (err: any) {
          showToast(err.message || "Không thể hủy liên kết Google Drive", "error");
        } finally {
          setUpdatingId(null);
        }
      },
    });
  };

  // Lọc dữ liệu hiển thị
  const filteredUsers = users.filter((u) => {
    const matchQuery =
      (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (u.lms_code?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

    const matchRole =
      filterRole === "all" ||
      u.role.toLowerCase() === filterRole.toLowerCase() ||
      (filterRole === "admin" && u.role.toLowerCase().includes("admin")) ||
      (filterRole === "fulltime" && u.role.toLowerCase().includes("full-time")) ||
      (filterRole === "parttime" && u.role.toLowerCase().includes("part-time"));

    const matchStatus =
      filterStatus === "all" || u.status.toLowerCase() === filterStatus.toLowerCase();

    const matchType =
      filterType === "all" ||
      (filterType === "lms" && u.is_firebase) ||
      (filterType === "local" && !u.is_firebase);

    return matchQuery && matchRole && matchStatus && matchType;
  });

  const getRoleBadgeStyle = (roleName: string) => {
    const roleLower = (roleName || "").toLowerCase();
    if (roleLower.includes("admin")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
    if (roleLower.includes("full-time") || roleLower.includes("fulltime")) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
    }
    return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30";
  };

  const getStatusBadgeStyle = (statusCode: string) => {
    const s = (statusCode || "").toLowerCase();
    if (s === "approved") {
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    }
    if (s === "pending") {
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    }
    return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800";
  };

  const roleSlug = getRoleSlug(currentUserRole);

  return (
    <AppLayout
      pageTitle="Quản Lý Tài Khoản"
      breadcrumbs={[
        { label: "Quản lý hệ thống", href: `/${roleSlug}/system-management/users` },
        { label: "Quản lý tài khoản" },
      ]}
    >
      <div className="space-y-6">
        {/* Action Bar */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate uppercase">
                Quản Lý Tài Khoản
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Danh sách và phân quyền tài khoản người dùng trong hệ thống
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-500" : ""}`} />
              <span>Làm mới</span>
            </button>

            <button
              onClick={() => {
                setShowAddModal(true);
                setAddFeedback(null);
                setAddForm({
                  lms_code: "",
                  password: "",
                  full_name: "",
                  is_firebase: false,
                  role: currentUserRolePoints === 1 ? "Teacher Full-time" : "Teacher Part-time",
                });
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 hover:from-rose-500 hover:to-red-500 transition-all whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm tài khoản</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo họ tên hoặc mã LMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30 whitespace-nowrap"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Admin</option>
              <option value="fulltime">Teacher Full-time</option>
              <option value="parttime">Teacher Part-time</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30 whitespace-nowrap"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="approved">Đã duyệt (Approved)</option>
              <option value="pending">Chờ duyệt (Pending)</option>
              <option value="rejected">Từ chối (Rejected)</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30 whitespace-nowrap"
            >
              <option value="all">Tất cả nguồn</option>
              <option value="lms">LMS MindX</option>
              <option value="local">Tạo cục bộ</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden w-full max-w-full min-w-0">
          {/* Mobile Swipe Notice */}
          <div className="md:hidden px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>👉 Vuốt ngang bảng để xem đầy đủ thông tin</span>
            <span className="text-[10px] font-mono font-semibold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
              {filteredUsers.length} tài khoản
            </span>
          </div>

          <div className="overflow-x-auto w-full max-w-full no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[660px] lg:min-w-0">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50">
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                    STT
                  </th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    Họ Và Tên
                  </th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                    Mã LMS
                  </th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                    Loại Tài Khoản
                  </th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                    Vai Trò
                  </th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                    Trạng Thái
                  </th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
                      <span className="text-xs">Đang tải danh sách tài khoản...</span>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <span className="text-xs">Không tìm thấy tài khoản nào phù hợp</span>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => {
                    const isSelf = user.id === currentUserId;
                    const isHigherOrEqualRole = (user.role_points || getRolePoints(user.role)) <= currentUserRolePoints;
                    const cannotModify = isSelf || (currentUserRolePoints > 1 && isHigherOrEqualRole);

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-xs text-slate-500 dark:text-slate-400 text-center whitespace-nowrap font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                          <div className="font-bold text-xs text-slate-900 dark:text-white whitespace-nowrap">
                            {user.full_name || "Chưa đặt họ tên"}
                          </div>
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono whitespace-nowrap">
                            {user.lms_code || "N/A"}
                          </span>
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                          {user.is_firebase ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 whitespace-nowrap">
                              <Flame className="w-3 h-3" />
                              <span>LMS MindX</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Cục bộ</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                          {cannotModify ? (
                            <div className="flex items-center justify-center">
                              <span
                                title="Khóa phân quyền cấp bậc"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ${getRoleBadgeStyle(
                                  user.role
                                )}`}
                              >
                                <span>{user.role}</span>
                                <Lock className="w-3 h-3 opacity-60 shrink-0" />
                              </span>
                            </div>
                          ) : (
                            <select
                              value={user.role}
                              disabled={updatingId === user.id}
                              onChange={(e) => handleUpdateRole(user, e.target.value)}
                              className="text-xs px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none whitespace-nowrap cursor-pointer"
                            >
                              {user.role === "Admin" && <option value="Admin">Admin</option>}
                              {user.role === "Teacher Full-time" && (
                                <option value="Teacher Full-time">Teacher Full-time</option>
                              )}
                              {currentUserRolePoints === 1 && user.role !== "Admin" && (
                                <option value="Admin">Admin</option>
                              )}
                              {currentUserRolePoints <= 2 && user.role !== "Teacher Full-time" && (
                                <option value="Teacher Full-time">Teacher Full-time</option>
                              )}
                              <option value="Teacher Part-time">Teacher Part-time</option>
                            </select>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                          {cannotModify ? (
                            <div className="flex items-center justify-center">
                              <span
                                title="Khóa quyền thay đổi trạng thái"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border capitalize ${getStatusBadgeStyle(
                                  user.status
                                )}`}
                              >
                                <span>{user.status}</span>
                                <Lock className="w-3 h-3 opacity-60 shrink-0" />
                              </span>
                            </div>
                          ) : (
                            <select
                              value={user.status.toLowerCase()}
                              disabled={updatingId === user.id}
                              onChange={(e) => handleUpdateStatus(user, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-lg border font-semibold whitespace-nowrap focus:outline-none cursor-pointer ${getStatusBadgeStyle(
                                user.status
                              )}`}
                            >
                              <option value="approved">Approved</option>
                              <option value="pending">Pending</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewingUser(user)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {user.email && (
                              <button
                                onClick={() => handleUnlinkGoogle(user)}
                                disabled={cannotModify || updatingId === user.id}
                                className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={cannotModify ? "Khóa quyền hủy liên kết" : "Hủy liên kết Google Drive"}
                              >
                                <Link2Off className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={cannotModify || updatingId === user.id}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Thêm tài khoản */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-rose-500" />
                  <span>Thêm Tài Khoản Mới</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dummy hidden inputs chống autofill */}
              <input type="text" name="fake_user" style={{ display: "none" }} />
              <input type="password" name="fake_pass" style={{ display: "none" }} />

              <form onSubmit={handleSubmitCreateUser} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mã LMS / Tên Đăng Nhập <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="Nhập thông tin mã LMS"
                      value={addForm.lms_code}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, lms_code: e.target.value }))}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                    <button
                      type="button"
                      onClick={handleCheckLms}
                      disabled={addChecking || !addForm.lms_code.trim()}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                    >
                      {addChecking ? "Đang ktra..." : "Kiểm tra LMS"}
                    </button>
                  </div>
                </div>

                {addFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed ${
                      addFeedback.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                        : addFeedback.type === "info"
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60"
                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
                    }`}
                  >
                    {addFeedback.text}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Họ Và Tên
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Họ và tên người dùng"
                    value={addForm.full_name}
                    readOnly={addForm.is_firebase && addFeedback?.hasLmsFullname === true}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
                      addForm.is_firebase && addFeedback?.hasLmsFullname === true ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  />
                </div>

                {!addForm.is_firebase && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Mật Khẩu <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Mật khẩu tài khoản cục bộ"
                        value={addForm.password}
                        onChange={(e) => setAddForm((prev) => ({ ...prev, password: e.target.value }))}
                        className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Vai Trò Cấp Quyền
                  </label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  >
                    {currentUserRolePoints === 1 && <option value="Admin">Admin</option>}
                    {currentUserRolePoints <= 2 && (
                      <option value="Teacher Full-time">Teacher Full-time</option>
                    )}
                    <option value="Teacher Part-time">Teacher Part-time</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdd}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submittingAdd ? "Đang tạo..." : "Xác nhận tạo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Xem chi tiết tài khoản */}
        {viewingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-rose-500" />
                  <span>Chi Tiết Tài Khoản</span>
                </h3>
                <button
                  onClick={() => setViewingUser(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">ID Người Dùng:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{viewingUser.id}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Họ Và Tên:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{viewingUser.full_name || "Chưa đặt"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Mã LMS:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{viewingUser.lms_code || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Nguồn Tài Khoản:</span>
                  <span className="text-slate-900 dark:text-white font-medium">{viewingUser.is_firebase ? "LMS MindX Firebase" : "Tạo cục bộ trên Web"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Vai Trò:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{viewingUser.role}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Trạng Thái:</span>
                  <span className="capitalize font-semibold text-slate-900 dark:text-white">{viewingUser.status}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 items-center">
                  <span className="text-slate-500 dark:text-slate-400">Email Google Drive:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 dark:text-white">
                      {viewingUser.email || "Chưa liên kết"}
                    </span>
                    {viewingUser.email && (
                      <button
                        onClick={() => handleUnlinkGoogle(viewingUser)}
                        disabled={
                          viewingUser.id === currentUserId ||
                          ((viewingUser.role_points || getRolePoints(viewingUser.role)) <= currentUserRolePoints && currentUserRolePoints > 1) ||
                          updatingId === viewingUser.id
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Hủy liên kết tài khoản Google Drive này"
                      >
                        <Link2Off className="w-3 h-3" />
                        <span>Hủy liên kết</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Ngày Tạo:</span>
                  <span className="text-slate-900 dark:text-white font-mono">{new Date(viewingUser.created_at).toLocaleString("vi-VN")}</span>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setViewingUser(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hệ Thống Thông Báo Toast */}
        <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />

        {/* Modal Xác Nhận Hành Động Thay Thế Native Confirm */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          isLoading={confirmModal.isLoading}
        />
      </div>
    </AppLayout>
  );
}
