"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  ShieldCheck,
  Settings,
  Users,
  KeyRound,
  Building2,
  GraduationCap,
  CalendarDays,
  UserCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
} from "lucide-react";
import { API_ROUTES, getRoleSlug } from "@/lib/constants/api-routes";
import { getRolePoints } from "@/lib/constants/roles";

interface RoleItem {
  id: string;
  name: string;
  points: number;
}

interface MenuItem {
  id: string;
  code: string;
  name: string;
  path?: string;
  is_parent: boolean;
  parent_code?: string;
  children?: MenuItem[];
}

export default function ScreenPermissionScreen() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("Admin");
  const [currentUserRolePoints, setCurrentUserRolePoints] = useState<number>(1);

  // Fetch Permissions data
  const fetchPermissionsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.ADMIN.PERMISSIONS);
      const data = await res.json();
      if (res.ok) {
        setRoles(data.roles || []);
        setMenus(data.menus || []);
        setPermissions(data.permissions || {});
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Không thể tải danh sách phân quyền" });
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Lỗi kết nối máy chủ" });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Current User
  useEffect(() => {
    fetch(API_ROUTES.AUTH.ME)
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          const roleName = data.user.role || "Admin";
          setCurrentUserRole(roleName);
          setCurrentUserRolePoints(getRolePoints(roleName));
        }
      })
      .catch(() => {});

    fetchPermissionsData();
  }, []);

  // Handle Toggle Permission Switch
  const handleToggle = async (roleName: string, rolePoints: number, menuCode: string, isParent: boolean) => {
    // Role Hierarchy Constraint: Điểm càng nhỏ quyền càng cao.
    if (rolePoints <= currentUserRolePoints) {
      setFeedbackMsg({
        type: "error",
        text: `Bạn không thể tự chỉnh sửa phân quyền cho vai trò "${roleName}" (Cấp bậc bằng hoặc cao hơn bạn)!`,
      });
      return;
    }

    const currentVal = permissions[roleName]?.[menuCode] ?? false;
    const newValue = !currentVal;
    const key = `${roleName}_${menuCode}`;
    setUpdatingKey(key);

    // Optimistic UI Update
    setPermissions((prev) => {
      const rolePerms = { ...(prev[roleName] || {}) };
      if (isParent) {
        rolePerms[menuCode] = newValue;
        // Bật / Tắt TOÀN BỘ các menu con của menu chính này
        const parentMenu = menus.find((m) => m.code === menuCode);
        if (parentMenu && parentMenu.children) {
          for (const child of parentMenu.children) {
            rolePerms[child.code] = newValue;
          }
        }
      } else {
        rolePerms[menuCode] = newValue;
        if (newValue) {
          // Bật menu con -> tự động bật menu chính tương ứng
          const parentMenu = menus.find((m) =>
            m.children?.some((c) => c.code === menuCode)
          );
          if (parentMenu) {
            rolePerms[parentMenu.code] = true;
          }
        }
      }

      return {
        ...prev,
        [roleName]: rolePerms,
      };
    });

    try {
      const res = await fetch(API_ROUTES.ADMIN.PERMISSIONS, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_name: roleName,
          menu_code: menuCode,
          is_enabled: newValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedbackMsg({ type: "error", text: data.error || "Không thể cập nhật phân quyền" });
        await fetchPermissionsData();
      } else {
        setFeedbackMsg({
          type: "success",
          text: `Đã cập nhật phân quyền cho vai trò "${roleName}"`,
        });
        window.dispatchEvent(new Event("smh:permissions_updated"));
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Lỗi kết nối máy chủ" });
      await fetchPermissionsData();
    } finally {
      setUpdatingKey(null);
    }
  };

  const roleSlug = getRoleSlug(currentUserRole);

  return (
    <AppLayout
      pageTitle="Phân Quyền Màn Hình"
      breadcrumbs={[
        { label: "Quản lý hệ thống", href: `/${roleSlug}/system-management/screen_permission` },
        { label: "Phân quyền màn hình" },
      ]}
    >
      <div className="space-y-6">
        {/* Action / Page Header Bar */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate uppercase">
                Phân Quyền Màn Hình
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ma trận phân quyền hiển thị menu và tính năng theo từng vai trò
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={fetchPermissionsData}
              disabled={loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-500" : ""}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Feedback Message Banner */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-fade-in ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-medium">{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs opacity-60 hover:opacity-100 px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Permissions Matrix Table */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden w-full max-w-full min-w-0">

          <div className="overflow-x-auto w-full max-w-full no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[660px] lg:min-w-0">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50">
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider min-w-[190px] whitespace-nowrap sticky left-0 z-20 bg-slate-50 dark:bg-[#0B0F17] shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                    Cấu Trúc Menu Hệ Thống
                  </th>
                  <th className="py-2.5 sm:py-3 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center min-w-[150px] whitespace-nowrap">
                    Đường Dẫn Route Mẫu
                  </th>
                  {roles.map((role) => {
                    const isSelfOrHigher = role.points <= currentUserRolePoints;
                    return (
                      <th
                        key={role.id}
                        className="py-2.5 sm:py-3 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center min-w-[110px] whitespace-nowrap"
                      >
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className="whitespace-nowrap">{role.name}</span>
                            {isSelfOrHigher && (
                              <span title="Khóa phân quyền cấp bậc">
                                <Lock className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                              role.points === 1
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : role.points === 2
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            Cấp {role.points} {isSelfOrHigher ? "(Khóa)" : "(Được phân quyền)"}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={2 + roles.length} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
                      <span className="text-xs">Đang tải ma trận phân quyền...</span>
                    </td>
                  </tr>
                ) : (
                  menus.map((parentMenu) => (
                    <React.Fragment key={parentMenu.id}>
                      {/* PARENT MENU ROW */}
                      <tr className="bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-colors">
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 sticky left-0 z-10 bg-slate-50 dark:bg-[#111827] shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                          <div className="flex items-center gap-2 whitespace-nowrap font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            <Settings className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>{parentMenu.name}</span>
                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              Menu Chính
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 text-xs font-mono text-slate-400 dark:text-slate-500 text-center whitespace-nowrap">
                          {parentMenu.code === "data_inspection"
                            ? "/[role]/data-inspection"
                            : "/[role]/system-management"}
                        </td>
                        {roles.map((role) => {
                          const isEnabled = permissions[role.name]?.[parentMenu.code] ?? false;
                          const isUpdating = updatingKey === `${role.name}_${parentMenu.code}`;
                          const isLocked = role.points <= currentUserRolePoints;

                          return (
                            <td key={role.id} className="py-2.5 sm:py-3 px-3 text-center">
                              <div className="flex justify-center items-center">
                                <button
                                  type="button"
                                  disabled={isLocked || isUpdating}
                                  onClick={() => handleToggle(role.name, role.points, parentMenu.code, true)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isEnabled ? "bg-rose-600" : "bg-slate-200 dark:bg-slate-800"
                                  } ${isLocked ? "opacity-40 cursor-not-allowed grayscale" : ""}`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      isEnabled ? "translate-x-5" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* CHILD MENUS ROWS */}
                      {parentMenu.children?.map((child) => (
                        <tr
                          key={child.id}
                          className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors"
                        >
                          <td className="py-2 px-3 sm:px-4 sm:pl-10 sticky left-0 z-10 bg-white dark:bg-[#0B0F17] shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300 pl-3 sm:pl-5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                              {child.code === "user_management" ? (
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : child.code === "screen_permission_management" ? (
                                <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : child.code === "user_centre_management" ? (
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : child.code === "class_management" ? (
                                <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : child.code === "student_management" ? (
                                <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : child.code === "trial_schedules" ? (
                                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span>{child.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-xs font-mono text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 text-[11px]">
                              {child.path || `/[role]/.../${child.code}`}
                            </span>
                          </td>
                          {roles.map((role) => {
                            const isParentEnabled = permissions[role.name]?.[parentMenu.code] ?? false;
                            const isChildEnabled = permissions[role.name]?.[child.code] ?? false;
                            const isEnabled = isParentEnabled && isChildEnabled;
                            const isUpdating = updatingKey === `${role.name}_${child.code}`;
                            const isLocked = role.points <= currentUserRolePoints;

                            return (
                              <td key={role.id} className="py-2 px-3 text-center">
                                <div className="flex justify-center items-center">
                                  <button
                                    type="button"
                                    disabled={isLocked || isUpdating}
                                    onClick={() => handleToggle(role.name, role.points, child.code, false)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      isEnabled ? "bg-rose-600" : "bg-slate-200 dark:bg-slate-800"
                                    } ${isLocked ? "opacity-40 cursor-not-allowed grayscale" : ""}`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isEnabled ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

