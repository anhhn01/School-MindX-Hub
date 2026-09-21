"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck,
  Settings,
  Users,
  KeyRound,
  Sun,
  Moon,
  ChevronDown,
  UserCheck,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Activity,
  HeartHandshake,
  Building2,
  Database,
  CalendarCheck,
  Wrench,
  GraduationCap,
  Home as HomeIcon,
  ArrowRight,
  UploadCloud,
  LogIn,
  Bell,
  CheckCheck,
  Trash2,
  Send,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { API_ROUTES, getRoleSlug } from "@/lib/constants/api-routes";
import SystemFooter from "@/components/layout/SystemFooter";
import { SMHLogo } from "@/components/brand/SMHLogo";

interface UserProfile {
  id?: string;
  name: string;
  role: string;
  role_points?: number;
  lms_code?: string;
  permissions?: Record<string, boolean>;
}

export default function AppLayout({
  children,
  pageTitle,
  breadcrumbs,
}: {
  children: React.ReactNode;
  pageTitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState<UserProfile>({
    name: "Quản trị viên",
    role: "Admin",
    role_points: 1,
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quản lý thông báo hệ thống (chuông & menu)
  interface SystemNotificationItem {
    id: string;
    title: string;
    message: string;
    details?: string[];
    type: "LMS_SYNC" | "TELEGRAM_REMINDER" | "SYSTEM";
    timestamp: string;
    isRead: boolean;
    classId?: string;
    link?: string;
  }
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Khởi tạo trạng thái thu gọn Sidebar từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smh_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch (_) {}
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const nextVal = !prev;
      try {
        localStorage.setItem("smh_sidebar_collapsed", String(nextVal));
      } catch (_) {}
      return nextVal;
    });
  };

  // Fetch current user from API with real-time polling & window focus
  const fetchUser = () => {
    fetch(API_ROUTES.AUTH.ME, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setIsAuthenticated(true);
          setUser({
            id: data.user.id,
            name: data.user.name || "Người dùng",
            role: data.user.role || "Admin",
            role_points: data.user.role_points || 1,
            lms_code: data.user.lms_code,
            permissions: data.user.permissions || {},
          });
        } else {
          setIsAuthenticated(false);
          setUser({
            name: "Khách",
            role: "Học viên",
            role_points: 99,
          });
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  };

  useEffect(() => {
    fetchUser();
    // Lắng nghe sự kiện cập nhật hồ sơ & phân quyền để đồng bộ menu mới
    const handleProfileUpdate = () => fetchUser();
    window.addEventListener("smh:profile_updated", handleProfileUpdate);
    window.addEventListener("smh:permissions_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("smh:profile_updated", handleProfileUpdate);
      window.removeEventListener("smh:permissions_updated", handleProfileUpdate);
    };
  }, []);

  // Close dropdown & notification popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tải thông báo hệ thống khi đã đăng nhập
  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Lỗi tải thông báo:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated === true) {
      fetchNotifications();
    }
    const handleNotifUpdate = () => {
      if (isAuthenticated === true) fetchNotifications();
    };
    window.addEventListener("smh:notifications_updated", handleNotifUpdate);
    return () => {
      window.removeEventListener("smh:notifications_updated", handleNotifUpdate);
    };
  }, [isAuthenticated]);

  const handleMarkAsRead = async (id: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
    } catch (err) {
      console.warn("Lỗi mark_read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch (err) {
      console.warn("Lỗi mark_all_read:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
    } catch (err) {
      console.warn("Lỗi delete notification:", err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
    } catch (err) {
      console.warn("Lỗi clear_all:", err);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch(API_ROUTES.AUTH.LOGOUT, { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    }

    // Xóa toàn bộ cookie phía Client (những cookie non-HttpOnly)
    const clientCookies = [
      "user_id",
      "user_name",
      "user_role",
      "user_permissions",
      "id_token",
      "refresh_token",
      "smh_token",
    ];
    clientCookies.forEach((c) => {
      document.cookie = `${c}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });

    // Chuyển hướng cứng để xóa sạch mọi cache bộ nhớ và React state
    window.location.href = "/login";
  };

  // Badge màu theo Role
  const getRoleBadgeStyle = (roleName: string) => {
    const roleLower = roleName.toLowerCase();
    if (roleLower.includes("admin")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
    if (roleLower.includes("full-time") || roleLower.includes("fulltime")) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
    }
    return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30";
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "TỔNG QUAN": true,
    "QUẢN LÝ HỆ THỐNG": true,
    "KIỂM TRA DỮ LIỆU": true,
    "HỌC VIÊN": true,
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: prev[groupName] === false ? true : false,
    }));
  };

  // Lấy danh sách quyền từ user.permissions hoặc cookie
  const getEffectivePermissions = (): Record<string, boolean> => {
    if (user.permissions && Object.keys(user.permissions).length > 0) {
      return user.permissions;
    }
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|; )user_permissions=([^;]*)/);
      if (match && match[1]) {
        try {
          return JSON.parse(decodeURIComponent(match[1]));
        } catch (_) {}
      }
    }
    return {
      system_management: true,
      user_management: true,
      screen_permission_management: true,
      user_centre_management: true,
      class_management: true,
      student_management: true,
      data_inspection: true,
      trial_schedules: true,
    };
  };

  const userPerms = getEffectivePermissions();
  const isAdmin = user.role.toLowerCase().includes("admin");
  const roleSlug = getRoleSlug(user.role);

  const canSeeSystemManagement = isAdmin || userPerms["system_management"] === true;
  const canSeeUserManagement = isAdmin || userPerms["user_management"] === true;
  const canSeeScreenPermissions = isAdmin || userPerms["screen_permission_management"] === true;
  const canSeeUserCentres = isAdmin || userPerms["user_centre_management"] === true;
  const canSeeClasses = isAdmin || userPerms["class_management"] === true;
  const canSeeStudents = isAdmin || userPerms["student_management"] === true;

  const canSeeDataInspection = isAdmin || userPerms["data_inspection"] === true;
  const canSeeTrialSchedules = isAdmin || userPerms["trial_schedules"] === true;

  // Xây dựng các route động theo vai trò hiện tại: /[role]/[main_menu]/[menu]
  const systemSubItems = [];
  if (canSeeUserManagement) {
    systemSubItems.push({
      name: "Quản lý tài khoản",
      href: API_ROUTES.ROLE_ROUTES.USERS(user.role),
      icon: Users,
    });
  }
  if (canSeeScreenPermissions) {
    systemSubItems.push({
      name: "Phân quyền màn hình",
      href: API_ROUTES.ROLE_ROUTES.SCREEN_PERMISSION(user.role),
      icon: KeyRound,
    });
  }
  if (canSeeUserCentres) {
    systemSubItems.push({
      name: "Quản lý cơ sở trực thuộc",
      href: API_ROUTES.ROLE_ROUTES.USER_CENTRES(user.role),
      icon: Building2,
    });
  }
  if (canSeeClasses) {
    systemSubItems.push({
      name: "Quản lý lớp học",
      href: API_ROUTES.ROLE_ROUTES.CLASSES(user.role),
      icon: GraduationCap,
    });
  }
  if (canSeeStudents) {
    systemSubItems.push({
      name: "Quản lý học viên",
      href: API_ROUTES.ROLE_ROUTES.STUDENTS(user.role),
      icon: UserCheck,
    });
  }
  if (isAdmin) {
    systemSubItems.push({
      name: "Bảo trì hệ thống",
      href: API_ROUTES.ADMIN.MAINTENANCE_SCREEN,
      icon: Wrench,
    });
  }

  const dataInspectionSubItems = [];
  if (canSeeTrialSchedules) {
    dataInspectionSubItems.push({
      name: "Lịch trải nghiệm",
      href: API_ROUTES.ROLE_ROUTES.TRIAL_SCHEDULES(user.role),
      icon: CalendarCheck,
    });
  }

  const isPublicPage = pathname === "/" || pathname === "/submit";

  // Menu dành riêng cho Khách / Trang công khai: Chỉ gồm các liên kết trực tiếp, không nhóm
  const guestNavItems = [
    {
      name: "Trang chủ",
      href: "/",
      icon: HomeIcon,
    },
    {
      name: "Cổng nộp bài",
      href: "/submit",
      icon: UploadCloud,
    },
  ];

  // Nav menu items (các nhóm chức năng nghiệp vụ sau khi đăng nhập):
  // - Khi ở Trang công khai (/ hoặc /submit): Ẩn toàn bộ menu nghiệp vụ riêng tư của Dashboard
  // - Khi ở Dashboard / Màn hình quản lý: Hiển thị đầy đủ menu nghiệp vụ theo phân quyền RBAC
  const menuItems = [
    ...(canSeeSystemManagement && systemSubItems.length > 0 && !isPublicPage
      ? [
          {
            group: "QUẢN LÝ HỆ THỐNG",
            icon: Settings,
            items: systemSubItems,
          },
        ]
      : []),
    ...(canSeeDataInspection && dataInspectionSubItems.length > 0 && !isPublicPage
      ? [
          {
            group: "KIỂM TRA DỮ LIỆU",
            icon: Database,
            items: dataInspectionSubItems,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR (Hỗ trợ Collapse linh hoạt) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white dark:bg-[#0B0F17] border-r border-slate-200 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out shadow-xl lg:shadow-none shrink-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "w-20" : "w-72"}`}
      >
        {/* Brand Header & Collapse Toggle */}
        <div className="h-20 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <Link
            href={isAuthenticated ? API_ROUTES.ROLE_ROUTES.DASHBOARD(user.role) : "/"}
            className={`flex items-center gap-3 group overflow-hidden ${
              sidebarCollapsed ? "justify-center w-full" : ""
            }`}
            title="School MindX Hub (SMH)"
          >
            <SMHLogo size="md" collapsed={sidebarCollapsed} />
          </Link>

          {/* Desktop Sidebar Collapse Toggle Button */}
          {!sidebarCollapsed ? (
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Thu gọn Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : null}

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Đóng điều hướng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expand Toggle Button when collapsed on desktop */}
        {sidebarCollapsed && (
          <div className="hidden lg:flex justify-center py-2 border-b border-slate-100 dark:border-slate-800/80">
            <button
              onClick={toggleSidebarCollapse}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Mở rộng Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Menus List */}
        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {isPublicPage || isAuthenticated === false ? (
            /* Khi ở trang công khai (/ hoặc /submit) hoặc chưa đăng nhập: Hiển thị trực tiếp các liên kết công khai */
            <div className="space-y-1.5">
              {guestNavItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center rounded-2xl text-xs font-semibold transition-all group ${
                      sidebarCollapsed
                        ? "justify-center p-3"
                        : "justify-between px-3.5 py-2.5"
                    } ${
                      isActive
                        ? "bg-gradient-to-r from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/60"
                    }`}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <div
                      className={`flex items-center ${
                        sidebarCollapsed ? "justify-center" : "gap-3"
                      }`}
                    >
                      <item.icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="whitespace-nowrap">{item.name}</span>
                      )}
                    </div>
                    {!sidebarCollapsed && isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Sau khi đăng nhập và ở các màn hình riêng tư: Hiển thị các nhóm chức năng theo phân quyền màn hình RBAC */
            <div className="space-y-6">
              {menuItems.map((group, groupIdx) => {
                const isExpanded = expandedGroups[group.group] !== false;

                return (
                  <div key={groupIdx} className="space-y-1.5">
                    {/* Group Title Header */}
                    {!sidebarCollapsed ? (
                      <button
                        onClick={() => toggleGroup(group.group)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase hover:text-slate-700 dark:hover:text-slate-300 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <group.icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
                          <span>{group.group}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
                            isExpanded ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                      </button>
                    ) : (
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-1" />
                    )}

                    {/* Sub Menu Items */}
                    {(isExpanded || sidebarCollapsed) && (
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const isActive =
                            pathname === item.href ||
                            (item.href !== "/" && pathname.startsWith(item.href));

                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center rounded-2xl text-xs font-semibold transition-all group ${
                                sidebarCollapsed
                                  ? "justify-center p-3"
                                  : "justify-between px-3.5 py-2.5"
                              } ${
                                isActive
                                  ? "bg-gradient-to-r from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 shadow-sm"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/60"
                              }`}
                              title={sidebarCollapsed ? item.name : undefined}
                            >
                              <div
                                className={`flex items-center ${
                                  sidebarCollapsed ? "justify-center" : "gap-3"
                                }`}
                              >
                                <item.icon
                                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                                    isActive
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-slate-400 dark:text-slate-500"
                                  }`}
                                />
                                {!sidebarCollapsed && (
                                  <span className="whitespace-nowrap">{item.name}</span>
                                )}
                              </div>
                              {!sidebarCollapsed && isActive && (
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SIDEBAR BOTTOM ACTION: Nút Chuyển Đổi Trang Chủ / Bảng Điều Khiển Nổi Bật */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80">
          {isPublicPage ? (
            isAuthenticated === false ? (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 hover:scale-[1.02] active:scale-95 transition-all group cursor-pointer ${
                  sidebarCollapsed ? "p-3 justify-center" : "px-3.5 py-3 justify-between"
                }`}
                title="Đăng nhập hệ thống"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LogIn className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!sidebarCollapsed && (
                    <span className="text-xs tracking-tight whitespace-nowrap">
                      Đăng Nhập
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <ArrowRight className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                )}
              </Link>
            ) : (
              <Link
                href={API_ROUTES.ROLE_ROUTES.DASHBOARD(user.role)}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 hover:scale-[1.02] active:scale-95 transition-all group cursor-pointer ${
                  sidebarCollapsed ? "p-3 justify-center" : "px-3.5 py-3 justify-between"
                }`}
                title="Về Bảng điều khiển"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LayoutDashboard className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!sidebarCollapsed && (
                    <span className="text-xs tracking-tight whitespace-nowrap">
                      Về Bảng Điều Khiển
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <ArrowRight className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                )}
              </Link>
            )
          ) : (
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`w-full flex items-center rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 hover:border-rose-300 dark:hover:border-rose-900/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-slate-800 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 font-bold shadow-sm hover:shadow transition-all group cursor-pointer ${
                sidebarCollapsed ? "p-3 justify-center" : "px-3.5 py-3 justify-between"
              }`}
              title="Xem Trang chủ"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <HomeIcon className="w-4 h-4 text-rose-500 shrink-0 transition-transform group-hover:scale-110" />
                {!sidebarCollapsed && (
                  <span className="text-xs tracking-tight whitespace-nowrap">
                    Xem Trang Chủ
                  </span>
                )}
              </div>
              {!sidebarCollapsed && (
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
              )}
            </Link>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        {/* TOP HEADER - ĐỒNG BỘ MỌI GIAO DIỆN */}
        <header className="sticky top-0 z-30 h-20 bg-white/80 dark:bg-[#0B0F17]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
          <div className="max-w-7xl w-full mx-auto h-full flex items-center justify-between">
            {/* Left: Mobile Menu Toggle & Breadcrumbs */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 mr-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2.5 min-w-[42px] min-h-[42px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
              title="Mở thanh điều hướng"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1">
              {breadcrumbs && breadcrumbs.length > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                  {breadcrumbs.map((bc, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      {bc.href ? (
                        <Link
                          href={bc.href}
                          className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors whitespace-nowrap"
                        >
                          {bc.label}
                        </Link>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                          {bc.label}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500">Hệ Thống SMH</div>
              )}
              {pageTitle && (
                <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {pageTitle}
                </h1>
              )}
            </div>
          </div>

          {/* Right: Theme Toggle & User Profile Dropdown */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-900/50 transition-all shadow-sm group cursor-pointer"
              title={`Bấm để chuyển sang giao diện ${theme === "dark" ? "Sáng" : "Tối"}`}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
                  <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">Giao diện Tối</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700 group-hover:-rotate-12 transition-transform" />
                  <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">Giao diện Sáng</span>
                </>
              )}
            </button>

            {/* CÁCH 1: CHUÔNG THÔNG BÁO HỆ THỐNG TRÊN HEADER (CHỈ KHI CÓ PHIÊN ĐĂNG NHẬP) */}
            {isAuthenticated === true && (
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative flex items-center justify-center p-2 sm:px-2.5 sm:py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-900/50 transition-all shadow-sm group cursor-pointer"
                  title="Thông báo hệ thống"
                  aria-label="Thông báo hệ thống"
                >
                  <Bell className="w-4 h-4 transition-transform group-hover:rotate-12" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-600 rounded-full ring-2 ring-white dark:ring-[#0B0F17] animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* POPOVER DANH SÁCH THÔNG BÁO */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-fade-in overflow-hidden flex flex-col max-h-[520px]">
                    {/* Header thông báo */}
                    <div className="px-4.5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Thông Báo Hệ Thống
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-rose-500 text-white">
                            {unreadCount} mới
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            title="Đánh dấu tất cả đã đọc"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Đã đọc hết</span>
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllNotifications}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Xóa tất cả thông báo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Danh sách thông báo */}
                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center px-4">
                          <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-60" />
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Không có thông báo nào
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Hệ thống sẽ gửi thông báo tại đây khi có thay đổi dữ liệu từ LMS hoặc hẹn giờ Telegram
                          </p>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const isLms = notif.type === "LMS_SYNC";
                          const isTelegram = notif.type === "TELEGRAM_REMINDER";

                          return (
                            <div
                              key={notif.id}
                              className={`p-3 rounded-2xl transition-colors relative group ${
                                notif.isRead
                                  ? "bg-transparent opacity-85 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                  : "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/60 dark:hover:bg-rose-950/30"
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Type Icon */}
                                <div
                                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white mt-0.5 shadow-sm ${
                                    isLms
                                      ? "bg-gradient-to-tr from-amber-500 to-rose-500 shadow-amber-500/20"
                                      : isTelegram
                                      ? "bg-gradient-to-tr from-sky-500 to-blue-600 shadow-sky-500/20"
                                      : "bg-gradient-to-tr from-rose-600 to-red-600 shadow-rose-600/20"
                                  }`}
                                >
                                  {isLms ? (
                                    <Database className="w-3.5 h-3.5" />
                                  ) : isTelegram ? (
                                    <Send className="w-3.5 h-3.5" />
                                  ) : (
                                    <Bell className="w-3.5 h-3.5" />
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <h4
                                      className={`text-xs font-bold truncate ${
                                        notif.isRead
                                          ? "text-slate-700 dark:text-slate-300"
                                          : "text-slate-900 dark:text-white"
                                      }`}
                                    >
                                      {notif.title}
                                    </h4>
                                    {!notif.isRead && (
                                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                    )}
                                  </div>

                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                                    {notif.message}
                                  </p>

                                  {/* Chi tiết thay đổi nếu có */}
                                  {notif.details && notif.details.length > 0 && (
                                    <div className="mt-1.5 p-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 space-y-1">
                                      {notif.details.map((dt, idx) => (
                                        <div
                                          key={idx}
                                          className="text-[10px] text-slate-600 dark:text-slate-400 flex items-start gap-1"
                                        >
                                          <span className="text-rose-500 font-bold">•</span>
                                          <span className="leading-tight">{dt}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Link & thời gian & thao tác */}
                                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-400">
                                    <span>
                                      {new Date(notif.timestamp).toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}{" "}
                                      •{" "}
                                      {new Date(notif.timestamp).toLocaleDateString("vi-VN", {
                                        day: "2-digit",
                                        month: "2-digit",
                                      })}
                                    </span>

                                    <div className="flex items-center gap-2">
                                      {notif.link && (
                                        <Link
                                          href={notif.link}
                                          onClick={() => {
                                            handleMarkAsRead(notif.id);
                                            setNotificationsOpen(false);
                                          }}
                                          className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
                                        >
                                          Xem
                                        </Link>
                                      )}
                                      {!notif.isRead && (
                                        <button
                                          type="button"
                                          onClick={() => handleMarkAsRead(notif.id)}
                                          className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                          title="Đánh dấu đã đọc"
                                        >
                                          Đã đọc
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteNotification(notif.id)}
                                        className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                        title="Xóa thông báo này"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Profile Dropdown or Login Button for unauthenticated visitors */}
            {isAuthenticated === false ? (
              pathname === "/login" ? null : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Đăng nhập</span>
                </Link>
              )
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-1.5 sm:px-3 sm:py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-rose-300 dark:hover:border-rose-900/50 transition-all shadow-sm group"
                >
                  {/* Avatar Icon */}
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>

                  {/* Name & Role Badge */}
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 whitespace-nowrap">
                      {user.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-semibold rounded-md border whitespace-nowrap ${getRoleBadgeStyle(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* DROPDOWN MENU */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 sm:w-64 max-w-[calc(100vw-32px)] rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800/80">
                    {/* User Meta */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        Tài khoản đang đăng nhập
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {user.name}
                      </p>
                      <span
                        className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-md border whitespace-nowrap ${getRoleBadgeStyle(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </div>

                    {/* Links */}
                    <div className="py-1.5 px-1.5 space-y-0.5">
                      <Link
                        href={API_ROUTES.USER.PROFILE}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      >
                        <UserCheck className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="whitespace-nowrap">Chỉnh sửa thông tin cá nhân</span>
                      </Link>

                      {/* CÁCH 2: MỤC THÔNG BÁO HỆ THỐNG TRONG MENU NGƯỜI DÙNG */}
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          setNotificationsOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="whitespace-nowrap">Thông báo hệ thống</span>
                        </div>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-rose-500 text-white shadow-xs">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Logout Button */}
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span className="whitespace-nowrap">Đăng xuất khỏi hệ thống</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">{children}</main>

        {/* SYSTEM FOOTER - ĐỒNG BỘ MỌI GIAO DIỆN */}
        <SystemFooter />
      </div>
    </div>
  );
}
