"use client";

import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Users,
  RefreshCw,
  Search,
  SearchX,
  X,
  Building2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  GraduationCap,
} from "lucide-react";
import { ManagedStudent } from "@/lib/types/managed-student";
import { CentreItem } from "@/lib/constants/centres";
import { API_ROUTES, getRoleSlug } from "@/lib/constants/api-routes";
import { SearchableDropdown } from "@/components/common/SearchableDropdown";

export default function StudentManagementScreen() {
  // State danh sách học viên quản lý (lưu trên Supabase)
  const [managedStudents, setManagedStudents] = useState<ManagedStudent[]>([]);
  const [userCentres, setUserCentres] = useState<CentreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("Admin");

  // State bộ lọc và tìm kiếm học viên
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentCentre, setSelectedStudentCentre] = useState("all");
  const [selectedStudentClass, setSelectedStudentClass] = useState("all");
  const [selectedStudentStatus, setSelectedStudentStatus] = useState("all");
  const [studentSortBy, setStudentSortBy] = useState("name_asc");

  // Phân trang 20 học viên / trang
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentPageInput, setStudentPageInput] = useState("1");
  const STUDENTS_PER_PAGE = 20;

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Modal Đối Chiếu Học Viên Với LMS
  const [studentSyncModal, setStudentSyncModal] = useState<{
    student: ManagedStudent;
    diffs: any[];
  } | null>(null);
  const [syncingStudentId, setSyncingStudentId] = useState<string | null>(null);
  const [confirmingStudentSync, setConfirmingStudentSync] = useState(false);

  // 1. Tải danh sách học viên quản lý từ Supabase DB
  const fetchManagedStudents = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (data.success && Array.isArray(data.students)) {
        setManagedStudents(data.students);
        if (isManual) {
          showToast(`Đã làm mới dữ liệu ${data.students.length} học viên từ Supabase`, "info");
        }
      } else {
        showToast(data.error || "Không thể tải danh sách học viên", "error");
      }
    } catch (err) {
      console.error("Lỗi tải học viên:", err);
      showToast("Lỗi kết nối khi tải danh sách học viên", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 2. Tải cơ sở & thông tin người dùng
  useEffect(() => {
    fetch(API_ROUTES.AUTH.ME)
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUserRole(data.user.role || "Admin");
        }
      })
      .catch(() => {});

    fetch("/api/admin/centres")
      .then((res) => res.json())
      .then((data) => {
        if (data.centres && Array.isArray(data.centres)) {
          setUserCentres(data.centres);
        }
      })
      .catch(() => {});

    fetchManagedStudents();
  }, []);

  // 3. Kiểm tra thay đổi từ LMS đối với học viên cụ thể
  const handleCheckStudentSyncLms = async (student: ManagedStudent) => {
    setSyncingStudentId(student.id);
    try {
      const res = await fetch(`/api/students/${student.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOnly: true }),
      });
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || "Không thể kiểm tra dữ liệu LMS", "error");
        return;
      }

      if (!data.hasChanges || !data.diffs || data.diffs.length === 0) {
        showToast(`Dữ liệu học viên "${student.fullName}" khớp 100% với LMS, không có sự thay đổi!`, "info");
        return;
      }

      // Có sự khác biệt -> Mở modal đối chiếu
      setStudentSyncModal({
        student,
        diffs: data.diffs,
      });
    } catch (err) {
      console.error("Lỗi đồng bộ học viên:", err);
      showToast("Lỗi kết nối khi kiểm tra dữ liệu học viên với LMS", "error");
    } finally {
      setSyncingStudentId(null);
    }
  };

  // 4. Xác nhận đồng bộ dữ liệu thay đổi từ LMS vào Supabase
  const handleConfirmStudentSync = async () => {
    if (!studentSyncModal) return;
    setConfirmingStudentSync(true);

    try {
      const res = await fetch(`/api/students/${studentSyncModal.student.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || `Đã cập nhật dữ liệu mới nhất từ LMS cho học viên "${studentSyncModal.student.fullName}"!`);
        setStudentSyncModal(null);
        fetchManagedStudents();
      } else {
        showToast(data.error || "Lỗi khi cập nhật từ LMS", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi cập nhật dữ liệu học viên", "error");
    } finally {
      setConfirmingStudentSync(false);
    }
  };

  // Danh sách các lớp duy nhất có học viên đang theo học
  const uniqueClassNames = useMemo(() => {
    const set = new Set<string>();
    managedStudents.forEach((st) => {
      if (st.className) set.add(st.className);
    });
    return Array.from(set).sort();
  }, [managedStudents]);

  // Bộ lọc và tìm kiếm danh sách học viên
  const sortedAndFilteredStudents = useMemo(() => {
    return managedStudents
      .filter((st) => {
        // Lọc theo từ khóa tìm kiếm: mã học viên, tên, email, sđt, lớp
        if (studentSearch.trim()) {
          const q = studentSearch.toLowerCase().trim();
          const matchCode = (st.studentCode || "").toLowerCase().includes(q);
          const matchName = (st.fullName || "").toLowerCase().includes(q);
          const matchEmail = (st.email || "").toLowerCase().includes(q);
          const matchPhone = (st.phoneNumber || "").toLowerCase().includes(q);
          const matchClass = (st.className || "").toLowerCase().includes(q);
          if (!matchCode && !matchName && !matchEmail && !matchPhone && !matchClass) {
            return false;
          }
        }

        // Lọc theo cơ sở
        if (selectedStudentCentre !== "all") {
          if (st.centreId !== selectedStudentCentre && st.centreName !== selectedStudentCentre) {
            return false;
          }
        }

        // Lọc theo lớp học
        if (selectedStudentClass !== "all") {
          if (st.className !== selectedStudentClass && st.classId !== selectedStudentClass) {
            return false;
          }
        }

        // Lọc theo trạng thái
        if (selectedStudentStatus !== "all") {
          const s = (st.status || "").toUpperCase();
          if (selectedStudentStatus === "ACTIVE" && s !== "ACTIVE") return false;
          if (selectedStudentStatus === "INACTIVE" && s === "ACTIVE") return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (studentSortBy === "name_asc") return a.fullName.localeCompare(b.fullName, "vi");
        if (studentSortBy === "name_desc") return b.fullName.localeCompare(a.fullName, "vi");
        if (studentSortBy === "code_asc") return a.studentCode.localeCompare(b.studentCode);
        if (studentSortBy === "code_desc") return b.studentCode.localeCompare(a.studentCode);
        if (studentSortBy === "class_asc") return (a.className || "").localeCompare(b.className || "", "vi");
        return 0;
      });
  }, [
    managedStudents,
    studentSearch,
    selectedStudentCentre,
    selectedStudentClass,
    selectedStudentStatus,
    studentSortBy,
  ]);

  // Reset trang khi lọc hoặc tìm kiếm
  useEffect(() => {
    setStudentCurrentPage(1);
    setStudentPageInput("1");
  }, [studentSearch, selectedStudentCentre, selectedStudentClass, selectedStudentStatus, studentSortBy]);

  // Phân trang học viên
  const studentTotalPages = Math.max(1, Math.ceil(sortedAndFilteredStudents.length / STUDENTS_PER_PAGE));
  const paginatedStudents = useMemo(() => {
    const start = (studentCurrentPage - 1) * STUDENTS_PER_PAGE;
    return sortedAndFilteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [sortedAndFilteredStudents, studentCurrentPage]);

  // Options cho bộ lọc cơ sở
  const centreOptions = useMemo(() => {
    return [
      { value: "all", label: `Tất cả cơ sở (${userCentres.length})` },
      ...userCentres.map((c) => ({
        value: c.id,
        label: c.name,
        subLabel: c.shortName || c.code || undefined,
      })),
    ];
  }, [userCentres]);

  // Options cho bộ lọc lớp học
  const classOptions = useMemo(() => {
    return [
      { value: "all", label: `Tất cả lớp học (${uniqueClassNames.length})` },
      ...uniqueClassNames.map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [uniqueClassNames]);

  // Options cho bộ lọc trạng thái
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Tất cả trạng thái" },
      { value: "ACTIVE", label: "Đang học (Active)" },
      { value: "INACTIVE", label: "Nghỉ / Chuyển lớp" },
    ],
    []
  );

  // Options cho sắp xếp
  const sortOptions = useMemo(
    () => [
      { value: "name_asc", label: "Tên A - Z" },
      { value: "name_desc", label: "Tên Z - A" },
      { value: "code_asc", label: "Mã HV tăng dần" },
      { value: "code_desc", label: "Mã HV giảm dần" },
      { value: "class_asc", label: "Lớp học A - Z" },
    ],
    []
  );

  const handleJumpToStudentPage = (page: number) => {
    const p = Math.max(1, Math.min(page, studentTotalPages));
    setStudentCurrentPage(p);
    setStudentPageInput(String(p));
  };

  const roleSlug = getRoleSlug(currentUserRole);

  return (
    <AppLayout
      pageTitle="Quản Lý Học Viên"
      breadcrumbs={[
        { label: "Quản lý hệ thống", href: `/${roleSlug}/system-management/students` },
        { label: "Quản lý học viên" },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-6">
        {/* Toast Feedback - Luôn hiển thị trên cùng (z-[99999]) */}
        {toastMessage && (
          <div
            className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
              toastMessage.type === "success"
                ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20"
                : toastMessage.type === "error"
                ? "bg-rose-500 text-white border-rose-600 shadow-rose-500/20"
                : "bg-slate-900 text-white border-slate-700 shadow-black/30"
            }`}
          >
            {toastMessage.type === "success" && <Check className="w-4 h-4 shrink-0" />}
            {toastMessage.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
            {toastMessage.type === "info" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors ml-1 cursor-pointer"
              title="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Unified Page Header Bar */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate uppercase">
                Quản Lý Học Viên
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Danh sách học viên theo lớp, mã học viên tự động và đối chiếu dữ liệu trực tiếp từ LMS MindX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => fetchManagedStudents(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Làm mới danh sách từ cơ sở dữ liệu Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-rose-500" : ""}`} />
              <span>{refreshing ? "Đang tải..." : "Làm mới"}</span>
            </button>
          </div>
        </div>

        {/* Toolbar Lọc, Tìm Kiếm & Sắp Xếp Danh Sách Học Viên */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Ô lọc mã học viên, tên, email, sđt, lớp */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Lọc tên, mã học viên, email, SĐT, lớp..."
              className="w-full pl-10 pr-9 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            {studentSearch && (
              <button
                type="button"
                onClick={() => setStudentSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Xóa bộ lọc tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Nhóm Bộ Lọc & Sắp Xếp (Responsive Grid 4 Cột & Align Right cho Sắp Xếp) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full xl:w-auto">
            {/* Lọc Cơ Sở */}
            <SearchableDropdown
              value={selectedStudentCentre}
              onChange={(val) => {
                setSelectedStudentCentre(val);
                setStudentCurrentPage(1);
                setStudentPageInput("1");
              }}
              options={centreOptions}
              placeholder="Chọn cơ sở..."
              searchPlaceholder="Tìm kiếm cơ sở..."
              icon={<Building2 className="w-3.5 h-3.5" />}
              className="w-full"
              align="left"
            />

            {/* Lọc Theo Lớp Đang Theo Học */}
            <SearchableDropdown
              value={selectedStudentClass}
              onChange={(val) => {
                setSelectedStudentClass(val);
                setStudentCurrentPage(1);
                setStudentPageInput("1");
              }}
              options={classOptions}
              placeholder="Chọn lớp..."
              searchPlaceholder="Tìm kiếm lớp học..."
              icon={<BookOpen className="w-3.5 h-3.5" />}
              className="w-full"
              align="left"
            />

            {/* Lọc Theo Trạng Thái */}
            <SearchableDropdown
              value={selectedStudentStatus}
              onChange={(val) => {
                setSelectedStudentStatus(val);
                setStudentCurrentPage(1);
                setStudentPageInput("1");
              }}
              options={statusOptions}
              placeholder="Chọn trạng thái..."
              searchPlaceholder="Tìm trạng thái..."
              icon={<Filter className="w-3.5 h-3.5" />}
              className="w-full"
              align="left"
            />

            {/* Sắp Xếp (align="right" chống tràn mép phải) */}
            <SearchableDropdown
              value={studentSortBy}
              onChange={(val) => {
                setStudentSortBy(val);
                setStudentCurrentPage(1);
                setStudentPageInput("1");
              }}
              options={sortOptions}
              placeholder="Sắp xếp..."
              searchPlaceholder="Tìm kiểu sắp xếp..."
              icon={<ArrowUpDown className="w-3.5 h-3.5" />}
              className="w-full"
              align="right"
            />
          </div>
        </div>

        {/* Bảng Danh Sách Học Viên (Chuẩn Responsive Toàn Diện) */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
          {/* Thanh chỉ dẫn cuộn ngang trên thiết bị màn hình nhỏ / trung bình */}
          {paginatedStudents.length > 0 && (
            <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between xl:hidden">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Kéo / vuốt sang phải để xem đầy đủ cột Trạng thái & Thao tác</span>
              </span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">7 cột dữ liệu</span>
            </div>
          )}

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[890px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2 text-center w-12 whitespace-nowrap">STT</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[130px]">Mã Học Viên</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Họ và Tên</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Lớp Đang Theo Học</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Cơ Sở Trực Thuộc</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[110px]">Trạng Thái</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[110px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
                      <span>Đang tải danh sách học viên...</span>
                    </td>
                  </tr>
                ) : paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <SearchX className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">
                        {studentSearch || selectedStudentCentre !== "all" || selectedStudentClass !== "all"
                          ? "Không tìm thấy học viên nào phù hợp với bộ lọc"
                          : "Chưa có học viên nào được quản lý trong Supabase"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Học viên sẽ được tự động đồng bộ khi bạn thêm lớp học từ màn hình Quản lý lớp học
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((st, idx) => (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400 whitespace-nowrap">
                        {(studentCurrentPage - 1) * STUDENTS_PER_PAGE + idx + 1}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-[11px] px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                          {st.studentCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {st.fullName}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <GraduationCap className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="font-semibold">{st.className}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {st.centreName}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            st.status?.toUpperCase() === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              st.status?.toUpperCase() === "ACTIVE"
                                ? "bg-emerald-500 animate-pulse"
                                : "bg-slate-400"
                            }`}
                          />
                          {st.status?.toUpperCase() === "ACTIVE" ? "Đang học" : st.status || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCheckStudentSyncLms(st)}
                          disabled={syncingStudentId === st.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-xs font-medium disabled:opacity-50"
                          title="Đối chiếu và kiểm tra thay đổi từ LMS"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingStudentId === st.id ? "animate-spin text-rose-500" : ""}`} />
                          <span>Đối chiếu LMS</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân Trang Học Viên */}
          {sortedAndFilteredStudents.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="whitespace-nowrap font-medium">
                Hiển thị{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {(studentCurrentPage - 1) * STUDENTS_PER_PAGE + 1}
                </span>{" "}
                -{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {Math.min(studentCurrentPage * STUDENTS_PER_PAGE, sortedAndFilteredStudents.length)}
                </span>{" "}
                trên tổng số{" "}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {sortedAndFilteredStudents.length}
                </span>{" "}
                học viên
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleJumpToStudentPage(1)}
                  disabled={studentCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang đầu tiên"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpToStudentPage(studentCurrentPage - 1)}
                  disabled={studentCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 font-medium px-1">
                  <span>Trang</span>
                  <input
                    type="number"
                    min={1}
                    max={studentTotalPages}
                    value={studentPageInput}
                    onChange={(e) => setStudentPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleJumpToStudentPage(Number(studentPageInput));
                      }
                    }}
                    onBlur={() => handleJumpToStudentPage(Number(studentPageInput))}
                    className="w-14 text-center py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                  <span>/ {studentTotalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleJumpToStudentPage(studentCurrentPage + 1)}
                  disabled={studentCurrentPage >= studentTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpToStudentPage(studentTotalPages)}
                  disabled={studentCurrentPage >= studentTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang cuối cùng"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Đối Chiếu Học Viên Với LMS */}
        {studentSyncModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Đối Chiếu Học Viên Với LMS</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500 text-white">
                        {studentSyncModal.student.studentCode}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Học viên: <strong className="text-slate-800 dark:text-slate-200">{studentSyncModal.student.fullName}</strong> • Lớp: {studentSyncModal.student.className}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentSyncModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Bảng so sánh */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-1/4">Thuộc tính</th>
                      <th className="py-2.5 px-3 w-1/3 text-rose-600 dark:text-rose-400">Dữ liệu hiện tại</th>
                      <th className="py-2.5 px-3 w-1/3 text-emerald-600 dark:text-emerald-400">Dữ liệu mới từ LMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {studentSyncModal.diffs.map((diff, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {diff.label}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 bg-rose-500/5">
                          {diff.oldValue}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                          {diff.newValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentSyncModal(null)}
                  disabled={confirmingStudentSync}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStudentSync}
                  disabled={confirmingStudentSync}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                >
                  {confirmingStudentSync ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{confirmingStudentSync ? "Đang đồng bộ..." : "Cập nhật từ LMS"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
