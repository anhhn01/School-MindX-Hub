"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  CalendarCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Filter,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Layers,
  Copy,
  Download,
  Check,
} from "lucide-react";
import * as htmlToImage from "html-to-image";
import { API_ROUTES } from "@/lib/constants/api-routes";

interface UserProfile {
  id?: string;
  name: string;
  role: string;
  role_points?: number;
  lms_code?: string;
  permissions?: Record<string, boolean>;
}

interface UserCentre {
  id: string;
  name: string;
  shortName?: string;
  code?: string;
}

interface AppointmentItem {
  id: string;
  status: string;
  note?: string;
  candidate: {
    id: string;
    fullName: string;
    phoneNumber?: string;
  } | null;
}

interface OfficeHourItem {
  id: string;
  name: string | null;
  startTime: string;
  endTime: string;
  status: string;
  type: string;
  note?: string | null;
  managerNote?: string | null;
  studentCount?: number;
  centre: {
    id: string;
    name: string;
    shortName?: string;
  } | null;
  teacher: {
    id: string;
    fullName: string;
    code?: string;
  } | null;
  courses: Array<{ id: string; name: string }>;
  courseLines: Array<{ id: string; name: string }>;
  appointments: AppointmentItem[];
}

// 1. Giữ nguyên tên cơ sở gốc từ hệ thống LMS / Supabase
export function getNormalizedCampusName(centreName: string): string {
  if (!centreName) return "Chưa xác định";
  return centreName.trim();
}

// 2. Chuẩn hóa Khối môn học theo thứ tự giao diện lúc trước: CODING -> ART -> ROBOTICS
export type DepartmentCategory = "CODING" | "ART" | "ROBOTICS";

export function classifyDepartment(
  courseLines: Array<{ id: string; name: string }>,
  courses: Array<{ id: string; name: string }> = []
): DepartmentCategory {
  const combined = [
    ...(courseLines || []).map((cl) => cl.name),
    ...(courses || []).map((c) => c.name),
  ]
    .join(" ")
    .toUpperCase();

  if (
    combined.includes("XART") ||
    combined.includes("ART") ||
    combined.includes("DRAW") ||
    combined.includes("VISUAL")
  ) {
    return "ART";
  }
  if (combined.includes("ROB") || combined.includes("ROBOT") || combined.includes("ROBOTICS")) {
    return "ROBOTICS";
  }
  return "CODING";
}

// 3. Phân loại ca: SÁNG, CHIỀU, TỐI (theo giờ Việt Nam UTC+7)
export type ShiftType = "SÁNG" | "CHIỀU" | "TỐI";

export function classifyShift(isoString: string): ShiftType {
  const d = new Date(isoString);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Giờ <= 12:00 -> SÁNG
  if (totalMinutes <= 12 * 60) return "SÁNG";
  // 12:01 <= Giờ < 17:00 -> CHIỀU
  if (totalMinutes < 17 * 60) return "CHIỀU";
  // Giờ >= 17:01 -> TỐI
  return "TỐI";
}

// Chuyển đổi ngày sang múi giờ Việt Nam YYYY-MM-DD
function toVnDateString(date: Date): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, "0");
  const d = String(vnDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Định dạng hiển thị DD/MM/YYYY
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Lấy ngày mai (mặc định)
function getTomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toVnDateString(tomorrow);
}

function getTodayDateString(): string {
  return toVnDateString(new Date());
}

function getDayAfterTomorrowDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return toVnDateString(date);
}

// Chuyển UTC ISO string thành giờ:phút Việt Nam (HH:mm)
function formatVnTime(isoString: string): string {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const h = String(vnDate.getHours()).padStart(2, "0");
  const m = String(vnDate.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Khung giờ mặc định theo ca
const DEFAULT_SHIFT_TIMES: Record<ShiftType, string> = {
  SÁNG: "09:00 - 12:00",
  CHIỀU: "14:00 - 17:00",
  TỐI: "18:00 - 21:00",
};

interface RenderRow {
  rowKey: string;
  centreId: string;
  centreName: string;
  campusName: string;
  department: DepartmentCategory;
  shift: ShiftType;
  timeRange: string;
  startTime: string;
  studentCount: number;
  note: string;
  mentorName: string;
  mentorCode?: string;
  mentorStatus: "CONFIRMED" | "WAITING" | "EMPTY";
  hasData: boolean;
  officeHourId?: string;
}

export default function TrialSchedulesScreen({ user: initialUser }: { user?: UserProfile }) {
  const [user, setUser] = useState<UserProfile>(
    initialUser || { name: "Người dùng", role: "Admin" }
  );

  useEffect(() => {
    if (!initialUser) {
      fetch(API_ROUTES.AUTH.ME)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.user) {
            setUser(data.user);
          }
        })
        .catch(() => {});
    }
  }, [initialUser]);

  // Bộ lọc
  const [selectedDate, setSelectedDate] = useState<string>(getTomorrowDateString());
  const [selectedCentre, setSelectedCentre] = useState<string>("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dữ liệu API
  const [officeHours, setOfficeHours] = useState<OfficeHourItem[]>([]);
  const [userCentres, setUserCentres] = useState<UserCentre[]>([]);

  // Ref container để chụp ảnh Ultra HD 3x
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const campusContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const exportAllRef = useRef<HTMLDivElement>(null);
  const exportCampusRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [copyingImage, setCopyingImage] = useState<boolean>(false);
  const [copyingCampusId, setCopyingCampusId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Tải dữ liệu Office Hours theo cơ sở trực thuộc của tài khoản từ Supabase
  const loadOfficeHours = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          date: selectedDate,
        });
        if (selectedCentre !== "ALL") {
          queryParams.append("centreId", selectedCentre);
        }

        const res = await fetch(`${API_ROUTES.OFFICE_HOURS}?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error("Không thể tải dữ liệu lịch trải nghiệm từ máy chủ");
        }
        const data = await res.json();
        setOfficeHours(data.officeHours || []);
        setUserCentres(data.userCentres || []);
      } catch (err: any) {
        console.error("Fetch office hours error:", err);
        setError(err.message || "Đã xảy ra lỗi khi tải lịch trải nghiệm");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate, selectedCentre]
  );

  useEffect(() => {
    loadOfficeHours();
  }, [loadOfficeHours]);

  // Điều hướng ngày
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    setSelectedDate(toVnDateString(date));
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    setSelectedDate(toVnDateString(date));
  };

  // Danh sách các cơ sở hiển thị: Chỉ hiển thị các cơ sở trực thuộc của tài khoản từ Supabase
  const activeCentres = useMemo(() => {
    if (userCentres.length > 0) {
      if (selectedCentre === "ALL") return userCentres;
      return userCentres.filter((c) => c.id === selectedCentre);
    }
    // Dự phòng khi userCentres chưa trả về kịp
    const uniqueMap = new Map<string, UserCentre>();
    officeHours.forEach((oh) => {
      if (oh.centre) {
        uniqueMap.set(oh.centre.id, {
          id: oh.centre.id,
          name: oh.centre.name,
          shortName: oh.centre.shortName,
        });
      }
    });
    const list = Array.from(uniqueMap.values());
    if (selectedCentre === "ALL") return list;
    return list.filter((c) => c.id === selectedCentre);
  }, [userCentres, officeHours, selectedCentre]);

  // Chuẩn bị cấu trúc bảng Ma trận theo đúng giao diện trước:
  // Cấp 1: Cơ sở (Cơ sở trực thuộc)
  // Cấp 2: Khối môn (Thứ tự: CODING -> ART -> ROBOTICS theo đúng ảnh mẫu)
  // Cấp 3: Ca (SÁNG, CHIỀU, TỐI)
  const structuredTable = useMemo(() => {
    const standardDepts: DepartmentCategory[] = ["CODING", "ART", "ROBOTICS"];
    const standardShifts: ShiftType[] = ["SÁNG", "CHIỀU", "TỐI"];

    const dataMap: Record<string, OfficeHourItem[]> = {};
    officeHours.forEach((oh) => {
      const cId = oh.centre?.id || "UNKNOWN";
      const dept = classifyDepartment(oh.courseLines, oh.courses);
      const shift = classifyShift(oh.startTime);
      const key = `${cId}___${dept}___${shift}`;
      if (!dataMap[key]) dataMap[key] = [];
      dataMap[key].push(oh);
    });

    // Sắp xếp tăng dần theo startTime trong từng slot
    Object.keys(dataMap).forEach((key) => {
      dataMap[key].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    const centreBlocks: Array<{
      centreId: string;
      centreName: string;
      campusName: string;
      caseCount: number;
      hasCases: boolean;
      totalRows: number;
      departments: Array<{
        department: DepartmentCategory;
        totalRows: number;
        rows: RenderRow[];
      }>;
    }> = [];

    activeCentres.forEach((centre) => {
      const campusName = getNormalizedCampusName(centre.name);
      const deptList: Array<{
        department: DepartmentCategory;
        totalRows: number;
        rows: RenderRow[];
      }> = [];

      standardDepts.forEach((dept) => {
        if (selectedDepartment !== "ALL" && selectedDepartment !== dept) {
          return;
        }

        const deptRows: RenderRow[] = [];

        standardShifts.forEach((shift) => {
          const key = `${centre.id}___${dept}___${shift}`;
          const itemsInSlot = dataMap[key] || [];

          if (itemsInSlot.length === 0) {
            // Hàng mặc định theo layout bảng
            const row: RenderRow = {
              rowKey: `${centre.id}_${dept}_${shift}_empty`,
              centreId: centre.id,
              centreName: centre.name,
              campusName,
              department: dept,
              shift,
              timeRange: DEFAULT_SHIFT_TIMES[shift],
              startTime: "",
              studentCount: 0,
              note: "",
              mentorName: "",
              mentorStatus: "EMPTY",
              hasData: false,
            };
            deptRows.push(row);
          } else {
            // Có ca học thực tế: 1 case = 1 dòng duy nhất (chỉ cần mentor nào, số lượng học viên nào)
            itemsInSlot.forEach((item, itemIdx) => {
              const timeRange = `${formatVnTime(item.startTime)} - ${formatVnTime(item.endTime)}`;
              const mentorName = item.teacher?.fullName || "";
              const mentorCode = item.teacher?.code;

              let mentorStatus: "CONFIRMED" | "WAITING" | "EMPTY" = "EMPTY";
              if (item.status === "APPROVED" || item.status === "CONFIRMED") {
                mentorStatus = "CONFIRMED";
              } else if (item.status === "WAITING" || item.status === "PENDING") {
                mentorStatus = "WAITING";
              } else if (mentorName) {
                mentorStatus = "CONFIRMED";
              }

              // Số lượng học viên của case
              const count = item.studentCount ?? (item.appointments?.length || 0);

              // Ghi chú ca học
              const appointmentNotes = (item.appointments || [])
                .map((ap) => ap.note)
                .filter(Boolean);
              const combinedNote = [item.note, item.managerNote, ...appointmentNotes]
                .filter(Boolean)
                .join(" | ");

              const row: RenderRow = {
                rowKey: `${item.id}_case_${itemIdx}`,
                centreId: centre.id,
                centreName: centre.name,
                campusName,
                department: dept,
                shift,
                timeRange,
                startTime: item.startTime,
                studentCount: count,
                note: combinedNote,
                mentorName,
                mentorCode,
                mentorStatus,
                hasData: true,
                officeHourId: item.id,
              };

              deptRows.push(row);
            });
          }
        });

        if (deptRows.length > 0) {
          deptList.push({
            department: dept,
            totalRows: deptRows.length,
            rows: deptRows,
          });
        }
      });

      const totalCentreRows = deptList.reduce((sum, d) => sum + d.totalRows, 0);
      const caseCount = deptList.reduce(
        (sum, d) => sum + d.rows.filter((r) => r.hasData).length,
        0
      );

      if (totalCentreRows > 0) {
        centreBlocks.push({
          centreId: centre.id,
          centreName: centre.name,
          campusName,
          caseCount,
          hasCases: caseCount > 0,
          totalRows: totalCentreRows,
          departments: deptList,
        });
      }
    });

    return centreBlocks;
  }, [activeCentres, officeHours, selectedDepartment]);

  // Sao chép ảnh của một cơ sở cụ thể (chỉ dành cho cơ sở có ca trải nghiệm)
  const handleCopyCampusImage = async (centreId: string, campusName: string) => {
    // Ưu tiên export template được định dạng cỡ chữ to, đậm nét chuyên biệt cho gửi Zalo
    const node = exportCampusRefs.current[centreId] || campusContainerRefs.current[centreId];
    if (!node) {
      showToast("error", `Không tìm thấy vùng dữ liệu cơ sở ${campusName} để sao chép.`);
      return;
    }

    setCopyingCampusId(centreId);
    try {
      const blob = await htmlToImage.toBlob(node, {
        pixelRatio: 2.5,
        backgroundColor: "#0B0F17",
        cacheBust: true,
        width: 1250,
        height: node.scrollHeight || node.offsetHeight,
        style: {
          width: "1250px",
          maxWidth: "none",
          position: "relative",
          left: "0px",
          top: "0px",
          margin: "0px",
          overflow: "hidden",
          scrollbarWidth: "none",
        },
      });

      if (!blob) throw new Error("Không thể kết xuất ảnh");

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        showToast(
          "success",
          `Đã sao chép ảnh lịch cơ sở ${campusName}! Mở Zalo và nhấn Ctrl + V để gửi ngay.`
        );
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Lich_${campusName}_${selectedDate}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("success", `Đã tải ảnh lịch cơ sở ${campusName} về máy.`);
      }
    } catch (err) {
      console.error("Lỗi sao chép ảnh cơ sở:", err);
      showToast("error", `Không thể sao chép ảnh cơ sở ${campusName}.`);
    } finally {
      setCopyingCampusId(null);
    }
  };

  // Sao chép toàn bộ lịch các cơ sở
  const handleCopyTableImage = async () => {
    // Ưu tiên export template chứa toàn bộ cơ sở được format to rõ chuyên dụng
    const node = exportAllRef.current || tableContainerRef.current;
    if (!node) return;
    const totalCases = structuredTable.reduce((sum, c) => sum + c.caseCount, 0);
    if (totalCases === 0) {
      showToast("error", "Không có ca trải nghiệm nào trong ngày để sao chép.");
      return;
    }

    setCopyingImage(true);
    try {
      const blob = await htmlToImage.toBlob(node, {
        pixelRatio: 2.5,
        backgroundColor: "#0B0F17",
        cacheBust: true,
        width: 1250,
        height: node.scrollHeight || node.offsetHeight,
        style: {
          width: "1250px",
          maxWidth: "none",
          position: "relative",
          left: "0px",
          top: "0px",
          margin: "0px",
          overflow: "hidden",
          scrollbarWidth: "none",
        },
      });

      if (!blob) {
        throw new Error("Không thể kết xuất ảnh");
      }

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        showToast(
          "success",
          "Đã sao chép toàn bộ lịch trải nghiệm! Hãy mở Zalo và nhấn Ctrl + V để gửi ngay."
        );
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Lich_Trai_Nghiem_${selectedDate}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("success", "Đã tải ảnh lịch trải nghiệm về máy.");
      }
    } catch (err) {
      console.error("Lỗi sao chép ảnh:", err);
      showToast("error", "Lỗi sao chép ảnh vào Clipboard.");
    } finally {
      setCopyingImage(false);
    }
  };

  return (
    <AppLayout pageTitle="Lịch Trải Nghiệm (Office Hours)">
      <div className="space-y-6 animate-fadeIn pb-16">
        {/* Toast thông báo sao chép ảnh - Luôn hiển thị trên cùng */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-[99999] animate-bounce">
            <div
              className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold ${
                toastMessage.type === "success"
                  ? "bg-slate-900 text-white border-emerald-500/50 dark:bg-emerald-950 dark:text-emerald-100"
                  : "bg-rose-900 text-white border-rose-500/50"
              }`}
            >
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        {/* Header & Thanh Điều Khiển */}
        <div className="bg-white dark:bg-[#0B0F17] p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm transition-colors">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {/* Tiêu đề */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex flex-wrap items-center gap-2 uppercase">
                    <span>Lịch Trải Nghiệm</span>
                    <span className="text-slate-400 font-normal hidden sm:inline text-sm">(Office Hours)</span>
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Danh sách ca học trải nghiệm theo cơ sở trực thuộc
                  </p>
                </div>
              </div>
            </div>

            {/* Cụm Chọn Ngày & Nút Thao Tác (Responsive) */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
              {/* Nhóm ngày: Quick pills + Date Picker */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
                {/* Quick date pills */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/80 dark:border-slate-700/60 shrink-0">
                  <button
                    onClick={() => setSelectedDate(getTodayDateString())}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      selectedDate === getTodayDateString()
                        ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Hôm nay
                  </button>
                  <button
                    onClick={() => setSelectedDate(getTomorrowDateString())}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      selectedDate === getTomorrowDateString()
                        ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Ngày mai
                  </button>
                  <button
                    onClick={() => setSelectedDate(getDayAfterTomorrowDateString())}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      selectedDate === getDayAfterTomorrowDateString()
                        ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Ngày mốt
                  </button>
                </div>

                {/* Stepper Ngày + Input Date */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 shrink-0">
                  <button
                    onClick={handlePrevDay}
                    title="Lùi 1 ngày"
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none px-1.5 py-1 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleNextDay}
                    title="Tới 1 ngày"
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Nhóm nút thao tác: Cân bằng đẹp trên mobile */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                {/* Nút Sao Chép Ảnh Toàn Bộ */}
                <button
                  onClick={handleCopyTableImage}
                  disabled={copyingImage || loading}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap min-h-[38px]"
                >
                  {copyingImage ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{copyingImage ? "Đang tạo..." : "Sao chép tất cả"}</span>
                </button>

                {/* Nút Làm Mới */}
                <button
                  onClick={() => loadOfficeHours(true)}
                  disabled={loading || refreshing}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 whitespace-nowrap min-h-[38px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? "animate-spin" : ""}`} />
                  <span>{refreshing ? "Đang tải..." : "Làm mới"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Thanh Lọc Phụ (Lọc Cơ sở & Khối môn) */}
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            {/* Lọc Cơ sở trực thuộc */}
            <div className="w-full sm:w-80 relative flex items-center">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={selectedCentre}
                onChange={(e) => setSelectedCentre(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500 transition-colors cursor-pointer appearance-none truncate"
              >
                <option value="ALL">Tất cả cơ sở trực thuộc ({userCentres.length})</option>
                {userCentres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getNormalizedCampusName(c.name)}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>

            {/* Lọc Khối */}
            <div className="w-full sm:w-64 relative flex items-center">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="ALL">Tất cả khối môn</option>
                <option value="CODING">Khối CODING</option>
                <option value="ART">Khối ART</option>
                <option value="ROBOTICS">Khối ROBOTICS</option>
              </select>
              <div className="absolute right-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>
        </div>

        {/* BẢNG LỊCH TRẢI NGHIỆM THEO CƠ SỞ CHUẨN GIAO DIỆN MẪU */}
        <div ref={tableContainerRef} className="space-y-6 sm:space-y-8">
          {loading ? (
            <div className="bg-white dark:bg-[#0E131F] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 sm:p-16 flex flex-col items-center justify-center gap-3 text-slate-400 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
              <p className="text-sm font-medium">Đang truy vấn lịch trải nghiệm từ MindX LMS...</p>
            </div>
          ) : error ? (
            <div className="bg-white dark:bg-[#0E131F] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center text-rose-500 shadow-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : structuredTable.length === 0 ? (
            <div className="bg-white dark:bg-[#0E131F] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 sm:p-16 text-center text-slate-400 shadow-sm">
              <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                Không có dữ liệu ca trải nghiệm
              </p>
              <p className="text-xs mt-1 text-slate-500">
                Không tìm thấy ca trải nghiệm nào vào ngày {formatDisplayDate(selectedDate)}
              </p>
            </div>
          ) : (
            structuredTable.map((centreBlock) => {
              const { centreId, campusName, hasCases, caseCount, departments } = centreBlock;

              return (
                <div
                  key={centreId}
                  ref={(el) => {
                    campusContainerRefs.current[centreId] = el;
                  }}
                  className="bg-white dark:bg-[#0E131F] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
                >
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[680px] lg:min-w-0">
                      {/* Header màu Đỏ Ruby chuẩn mockup - gọn gàng, vừa vặn khung hình */}
                      <thead>
                        <tr className="bg-[#8B0000] dark:bg-[#7F1D1D] text-white font-bold text-center text-xs sm:text-sm tracking-wider uppercase select-none border-b border-rose-950">
                          <th className="py-2.5 sm:py-3 px-2 sm:px-3 w-[110px] sm:w-[130px] border-r border-rose-900/60 whitespace-nowrap">
                            Cơ sở
                          </th>
                          <th className="py-2.5 sm:py-3 px-1.5 sm:px-2 w-[65px] sm:w-[75px] border-r border-rose-900/60 whitespace-nowrap">
                            Khối
                          </th>
                          <th className="py-2.5 sm:py-3 px-1.5 sm:px-2 w-[55px] sm:w-[65px] border-r border-rose-900/60 whitespace-nowrap">
                            Ca
                          </th>
                          <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 w-[100px] sm:w-[115px] border-r border-rose-900/60 whitespace-nowrap">
                            Khung giờ
                          </th>
                          <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 w-[130px] sm:w-[150px] border-r border-rose-900/60 whitespace-nowrap">
                            Mentor
                          </th>
                          <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 w-[85px] sm:w-[100px] border-r border-rose-900/60 whitespace-nowrap">
                            Số lượng
                          </th>
                          <th className="py-2.5 sm:py-3 px-3 min-w-[130px] sm:min-w-[170px] whitespace-nowrap">
                            Note
                          </th>
                        </tr>
                        {/* Banner hiển thị ngày và cơ sở */}
                        <tr className="bg-slate-950 text-white dark:bg-black font-bold text-center text-xs sm:text-sm tracking-wide border-b border-slate-700 select-none">
                          <td colSpan={7} className="py-2 sm:py-2.5 px-3 text-center">
                            <span className="uppercase tracking-wide">
                              LỊCH TRẢI NGHIỆM ({campusName}) • {formatDisplayDate(selectedDate)}
                            </span>
                          </td>
                        </tr>
                      </thead>

                      <tbody>
                        {departments.map((deptBlock, deptIdx) => {
                          let isFirstRowOfDept = true;
                          const isFirstRowOfCampus = deptIdx === 0;

                          return deptBlock.rows.map((row, rowIdx) => {
                            const renderCampusCell = isFirstRowOfCampus && rowIdx === 0;
                            const renderDeptCell = isFirstRowOfDept;
                            if (isFirstRowOfDept) isFirstRowOfDept = false;

                            // Highlight hàng theo trạng thái học sinh & mentor giống mockup
                            let rowBgClass =
                              "bg-white dark:bg-[#0E131F] hover:bg-slate-50/80 dark:hover:bg-slate-800/30";
                            if (row.mentorStatus === "CONFIRMED" && row.hasData) {
                              rowBgClass =
                                "bg-[#DCEBFC] dark:bg-sky-950/40 hover:bg-[#D0E4FA] dark:hover:bg-sky-900/50 text-slate-900 dark:text-slate-100";
                            } else if (row.mentorStatus === "WAITING" && row.hasData) {
                              rowBgClass =
                                "bg-[#FFE2E5] dark:bg-rose-950/40 hover:bg-[#FFD5D9] dark:hover:bg-rose-900/50 text-slate-900 dark:text-slate-100";
                            }

                            // Màu sắc khối theo đúng chuẩn mockup:
                            // CODING: Đỏ Ruby (#E11D48)
                            // ART: Xanh Navy (#1E3A8A)
                            // ROBOTICS: Xanh Lá (#15803D)
                            let deptBgClass = "bg-[#E11D48] text-white";
                            if (deptBlock.department === "ART") {
                              deptBgClass = "bg-[#1E3A8A] text-white";
                            } else if (deptBlock.department === "ROBOTICS") {
                              deptBgClass = "bg-[#15803D] text-white";
                            }

                            return (
                              <tr
                                key={row.rowKey}
                                className={`border-b border-slate-200 dark:border-slate-800/80 transition-colors ${rowBgClass}`}
                              >
                                {/* Cột 1: Cơ sở (Gộp dòng theo toàn bộ khối của cơ sở) */}
                                {renderCampusCell && (
                                  <td
                                    rowSpan={centreBlock.totalRows}
                                    className="py-3 px-2 sm:px-2.5 text-center align-middle border-r border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 select-none"
                                  >
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                      <span className="font-bold text-xs sm:text-sm tracking-wide text-slate-900 dark:text-white uppercase">
                                        {campusName}
                                      </span>
                                      {hasCases ? (
                                        <>
                                          <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                            {caseCount} ca trải nghiệm
                                          </span>
                                          {/* Nút sao chép ảnh cơ sở (ẩn khi xuất ảnh) */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCopyCampusImage(centreId, campusName);
                                            }}
                                            disabled={copyingCampusId === centreId}
                                            className="hide-on-export inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-[11px] sm:text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                                            title={`Sao chép ảnh lịch cơ sở ${campusName}`}
                                          >
                                            {copyingCampusId === centreId ? (
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                            <span>
                                              {copyingCampusId === centreId
                                                ? "Đang chép..."
                                                : "Sao chép ảnh"}
                                            </span>
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic whitespace-nowrap">
                                          Chưa có ca
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}

                                {/* Cột 2: Khối */}
                                {renderDeptCell && (
                                  <td
                                    rowSpan={deptBlock.totalRows}
                                    className={`py-2.5 px-1.5 text-center align-middle font-bold text-xs sm:text-sm tracking-wider border-r border-slate-300 dark:border-slate-800 uppercase select-none ${deptBgClass}`}
                                  >
                                    {deptBlock.department}
                                  </td>
                                )}

                                {/* Cột 3: Ca (SÁNG, CHIỀU, TỐI) */}
                                <td className="py-2.5 px-1.5 text-center align-middle font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                                  {row.shift}
                                </td>

                                {/* Cột 4: Khung giờ */}
                                <td className="py-2.5 px-2 text-center align-middle font-medium text-xs sm:text-sm text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                                  {row.timeRange}
                                </td>

                                {/* Cột 5: Mentor & Trạng thái */}
                                <td className="py-2.5 px-2 text-center align-middle border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                                  {row.mentorName ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                        {row.mentorName}
                                      </span>
                                      {row.mentorStatus === "CONFIRMED" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-[#DCEBFC] text-[#1E40AF] dark:bg-sky-950 dark:text-sky-300 border border-[#BFDBFE] dark:border-sky-800">
                                          Xác nhận
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-[#FFE2E5] text-[#991B1B] dark:bg-rose-950 dark:text-rose-300 border border-[#FECDD3] dark:border-rose-800">
                                          Cần xác nhận
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-5 w-20 mx-auto rounded bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60" />
                                  )}
                                </td>

                                {/* Cột 6: Số lượng */}
                                <td className="py-2.5 px-2 text-center align-middle border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                                  {row.hasData ? (
                                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60">
                                      {row.studentCount} học viên
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 select-none font-bold text-xs sm:text-sm">
                                      --
                                    </span>
                                  )}
                                </td>

                                {/* Cột 7: Note */}
                                <td className="py-2.5 px-3 align-middle text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                                  {row.note ? (
                                    <span className="whitespace-pre-line line-clamp-2">{row.note}</span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 select-none font-medium text-xs">
                                      --
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* =========================================================================
            DEDICATED OFF-SCREEN EXPORT CONTAINER (CHỮ TO, RÕ NÉT CỰC ĐẸP ĐỂ GỬI ZALO)
            Container này luôn được dựng sẵn tại tọa độ ngoài màn hình với độ rộng 1250px.
            Tất cả cỡ chữ (text-lg, text-xl, font-black) và độ tương phản cao được bảo đảm
            khi xuất ảnh qua Clipboard để gửi vào nhóm Zalo, hoàn toàn không làm ảnh hưởng
            đến độ gọn gàng và responsive của giao diện trực tiếp trên web/mobile.
            ========================================================================= */}
        {/* =========================================================================
            DEDICATED OFF-SCREEN EXPORT CONTAINER (CHỮ TO, RÕ NÉT CỰC ĐẸP ĐỂ GỬI ZALO)
            Container ngoài chịu trách nhiệm ẩn tọa độ ngoài màn hình.
            Container trong (exportAllRef) giữ tọa độ x = 0 để html-to-image chụp ảnh hoàn hảo
            không bị hiện tượng đen ảnh hay lệch viewport.
            ========================================================================= */}
        <div
          style={{
            position: "fixed",
            left: "-99999px",
            top: 0,
            pointerEvents: "none",
            zIndex: -9999,
          }}
          aria-hidden="true"
        >
          <div
            ref={exportAllRef}
            style={{ width: "1250px", position: "relative", left: 0 }}
            className="space-y-6 bg-[#0B0F17] p-6 text-white"
          >
            {/* Banner tiêu đề tổng thể nổi bật cho ảnh sao chép toàn bộ cơ sở */}
            <div className="bg-gradient-to-r from-[#7F1D1D] via-[#991B1B] to-[#7F1D1D] rounded-2xl p-5 text-center border border-rose-800/80 shadow-2xl">
              <h2 className="text-2xl font-black uppercase tracking-wider text-white">
                LỊCH TRẢI NGHIỆM TỔNG THỂ • {formatDisplayDate(selectedDate)}
              </h2>
              <p className="text-sm font-bold text-rose-200 mt-1.5">
                {structuredTable.filter((c) => c.hasCases).length} cơ sở có ca trải nghiệm • Tổng cộng {structuredTable.reduce((sum, c) => sum + c.caseCount, 0)} ca
              </p>
            </div>

            {structuredTable
              .filter((c) => c.hasCases)
              .map((centreBlock) => {
                const { centreId, campusName, caseCount, departments } = centreBlock;

                return (
                  <div
                    key={`export_${centreId}`}
                    ref={(el) => {
                      exportCampusRefs.current[centreId] = el;
                    }}
                    style={{ width: "1250px", position: "relative", left: 0 }}
                    className="bg-[#0B0F17] rounded-2xl border border-slate-800 overflow-hidden"
                  >
                  <table className="w-full text-left border-collapse" style={{ width: "1250px" }}>
                    <thead>
                      <tr className="bg-[#7F1D1D] text-white font-black text-center text-lg tracking-wider uppercase border-b border-rose-950">
                        <th className="py-4 px-3 w-[180px] border-r border-rose-900/60 whitespace-nowrap">Cơ sở</th>
                        <th className="py-4 px-2 w-[110px] border-r border-rose-900/60 whitespace-nowrap">Khối</th>
                        <th className="py-4 px-2 w-[90px] border-r border-rose-900/60 whitespace-nowrap">Ca</th>
                        <th className="py-4 px-3 w-[150px] border-r border-rose-900/60 whitespace-nowrap">Khung giờ</th>
                        <th className="py-4 px-3 w-[200px] border-r border-rose-900/60 whitespace-nowrap">Mentor</th>
                        <th className="py-4 px-3 w-[140px] border-r border-rose-900/60 whitespace-nowrap">Số lượng</th>
                        <th className="py-4 px-4 min-w-[260px] whitespace-nowrap">Note</th>
                      </tr>
                      <tr className="bg-[#020617] text-white font-black text-center text-lg tracking-wider border-b border-slate-700">
                        <td colSpan={7} className="py-4 px-4 text-center">
                          <span className="uppercase tracking-wide font-black">
                            LỊCH TRẢI NGHIỆM ({campusName}) • {formatDisplayDate(selectedDate)}
                          </span>
                        </td>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((deptBlock, deptIdx) => {
                        let isFirstRowOfDept = true;
                        const isFirstRowOfCampus = deptIdx === 0;

                        return deptBlock.rows.map((row, rowIdx) => {
                          const renderCampusCell = isFirstRowOfCampus && rowIdx === 0;
                          const renderDeptCell = isFirstRowOfDept;
                          if (isFirstRowOfDept) isFirstRowOfDept = false;

                          let rowBgClass = "bg-[#0E131F] text-slate-100";
                          if (row.mentorStatus === "CONFIRMED" && row.hasData) {
                            rowBgClass = "bg-[#162544] text-slate-100";
                          } else if (row.mentorStatus === "WAITING" && row.hasData) {
                            rowBgClass = "bg-[#3B151E] text-slate-100";
                          }

                          let deptBgClass = "bg-[#E11D48] text-white";
                          if (deptBlock.department === "ART") deptBgClass = "bg-[#1E3A8A] text-white";
                          else if (deptBlock.department === "ROBOTICS") deptBgClass = "bg-[#15803D] text-white";

                          return (
                            <tr key={`exp_row_${row.rowKey}`} className={`border-b border-slate-800 ${rowBgClass}`}>
                              {renderCampusCell && (
                                <td
                                  rowSpan={centreBlock.totalRows}
                                  className="py-5 px-3 text-center align-middle border-r border-slate-800 bg-slate-900/70"
                                >
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <span className="font-black text-xl tracking-wide text-white uppercase">
                                      {campusName}
                                    </span>
                                    <span className="text-sm font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                                      {caseCount} ca trải nghiệm
                                    </span>
                                  </div>
                                </td>
                              )}

                              {renderDeptCell && (
                                <td
                                  rowSpan={deptBlock.totalRows}
                                  className={`py-4 px-2 text-center align-middle font-black text-base tracking-wider border-r border-slate-800 uppercase ${deptBgClass}`}
                                >
                                  {deptBlock.department}
                                </td>
                              )}

                              <td className="py-4 px-3 text-center align-middle font-black text-base text-white border-r border-slate-800 whitespace-nowrap">
                                {row.shift}
                              </td>

                              <td className="py-4 px-3 text-center align-middle font-black text-base text-slate-200 border-r border-slate-800 whitespace-nowrap">
                                {row.timeRange}
                              </td>

                              <td className="py-4 px-3 text-center align-middle border-r border-slate-800 whitespace-nowrap">
                                {row.mentorName ? (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <span className="font-black text-white text-lg">
                                      {row.mentorName}
                                    </span>
                                    {row.mentorStatus === "CONFIRMED" ? (
                                      <span className="inline-flex items-center gap-1 px-3.5 py-0.5 rounded-md text-sm font-black bg-blue-950 text-sky-200 border border-sky-600 shadow-xs">
                                        Xác nhận
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-3.5 py-0.5 rounded-md text-sm font-black bg-rose-950 text-rose-200 border border-rose-600 shadow-xs">
                                        Cần xác nhận
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 font-bold text-base">--</span>
                                )}
                              </td>

                              <td className="py-4 px-4 text-center align-middle border-r border-slate-800 whitespace-nowrap">
                                {row.hasData ? (
                                  <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-base font-black bg-rose-950/80 text-rose-200 border border-rose-600/80 shadow-xs">
                                    {row.studentCount} học viên
                                  </span>
                                ) : (
                                  <span className="text-slate-600 font-bold text-base">--</span>
                                )}
                              </td>

                              <td className="py-4 px-4 align-middle text-slate-200 text-sm font-bold">
                                {row.note ? (
                                  <span className="whitespace-pre-line line-clamp-3">{row.note}</span>
                                ) : (
                                  <span className="text-slate-600 font-bold text-base">--</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
                );
              })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
