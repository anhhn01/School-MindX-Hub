"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  GraduationCap,
  RefreshCw,
  Search,
  Eye,
  X,
  Calendar,
  Building2,
  BookOpen,
  CheckCircle2,
  Clock,
  Flag,
  Award,
  AlertCircle,
  PlusCircle,
  Trash2,
  Save,
  UserCheck,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  Users,
  AlertTriangle,
  Plus,
  UserPlus,
} from "lucide-react";
import {
  ManagedClass,
  ManagedClassSlot,
  ClassDiffItem,
  calculateDefaultDeadlines,
  formatVnDate,
  formatVnTime,
} from "@/lib/types/managed-class";
import { StudentReviewItem } from "@/lib/types/managed-student";
import { CentreItem } from "@/lib/constants/centres";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { SearchableDropdown } from "@/components/common/SearchableDropdown";

export default function ClassManagementScreen() {
  // State danh sách lớp học quản lý (lưu trên Supabase)
  const [managedClasses, setManagedClasses] = useState<ManagedClass[]>([]);
  const [userCentres, setUserCentres] = useState<CentreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State tìm kiếm mã lớp & Dropdown Real-time từ LMS
  const [searchCodeInput, setSearchCodeInput] = useState("");
  const [searchingCode, setSearchingCode] = useState(false);
  const [dropdownClasses, setDropdownClasses] = useState<any[]>([]);
  const [searchingDropdown, setSearchingDropdown] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Bộ lọc cho danh sách quản lý
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCentre, setSelectedCentre] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [classSortBy, setClassSortBy] = useState("name_asc");

  // Phân trang 20 lớp / trang
  const [classCurrentPage, setClassCurrentPage] = useState(1);
  const [classPageInput, setClassPageInput] = useState("1");
  const CLASSES_PER_PAGE = 20;

  // Modal Chi Tiết Lớp Học (Hỗ trợ mode: "add" khi thêm mới, hoặc "view" khi xem/sửa)
  const [modalMode, setModalMode] = useState<"add" | "view">("view");
  const [modalActiveTab, setModalActiveTab] = useState<"schedule" | "students">("schedule");
  const [activeClass, setActiveClass] = useState<ManagedClass | null>(null);
  const [editedSlots, setEditedSlots] = useState<ManagedClassSlot[]>([]);
  const [savingClass, setSavingClass] = useState(false);

  // Bản đồ cảnh báo thay đổi dữ liệu từ LMS cho các lớp đã thêm
  const [lmsChangesMap, setLmsChangesMap] = useState<Record<string, { hasChanges: boolean; diffCount: number; diffs: ClassDiffItem[] }>>({});
  const [checkingLmsChanges, setCheckingLmsChanges] = useState(false);

  // Modal Đối Chiếu Thay Đổi LMS (Side-by-Side Diff Modal)
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [syncingClassId, setSyncingClassId] = useState<string | null>(null);
  const [currentDiffs, setCurrentDiffs] = useState<ClassDiffItem[]>([]);
  const [selectedDiffFields, setSelectedDiffFields] = useState<Record<string, boolean>>({});
  const [syncingTargetClass, setSyncingTargetClass] = useState<ManagedClass | null>(null);
  const [confirmingSync, setConfirmingSync] = useState(false);

  // Modal Đối Chiếu & Thêm Học Viên Lớp Học (Student Review & Sync Modal)
  const [studentReviewModalClass, setStudentReviewModalClass] = useState<ManagedClass | null>(null);
  const [studentReviews, setStudentReviews] = useState<StudentReviewItem[]>([]);
  const [studentReviewStats, setStudentReviewStats] = useState<{
    totalLms: number;
    notInSupabase: number;
    hasChanges: number;
    upToDate: number;
  }>({ totalLms: 0, notInSupabase: 0, hasChanges: 0, upToDate: 0 });
  const [loadingStudentReviews, setLoadingStudentReviews] = useState(false);
  const [operatingStudentId, setOperatingStudentId] = useState<string | null>(null);
  const [operatingAllStudents, setOperatingAllStudents] = useState(false);
  const [studentReviewFilter, setStudentReviewFilter] = useState<"ALL" | "NOT_IN_SUPABASE" | "HAS_CHANGES" | "UP_TO_DATE">("ALL");
  const [viewModalStudentDiffMap, setViewModalStudentDiffMap] = useState<Record<string, StudentReviewItem>>({});

  // Thông báo / Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [deleteConfirmClass, setDeleteConfirmClass] = useState<ManagedClass | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Tải danh sách lớp đang quản lý từ Supabase
  const fetchManagedClasses = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("type", "managed");
      if (selectedCentre !== "all") params.set("centreId", selectedCentre);
      if (selectedStatus !== "all") params.set("status", selectedStatus);

      const res = await fetch(`/api/classes?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const classes = data.classes || [];
        setManagedClasses(classes);
        if (data.userCentres) setUserCentres(data.userCentres);
        // Đồng thời kiểm tra đối chiếu dữ liệu LMS ngầm cho các lớp đã thêm
        if (classes.length > 0) {
          checkLmsChanges(classes);
        }
      } else {
        console.error("Lỗi tải lớp quản lý:", data.error);
      }
    } catch (err) {
      console.error("Lỗi gọi API managed classes:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Kiểm tra đối chiếu thay đổi dữ liệu từ LMS ngầm
  const checkLmsChanges = async (classesToCheck: ManagedClass[]) => {
    if (!classesToCheck || classesToCheck.length === 0) return;
    const ids = classesToCheck.map((c) => c.id).join(",");
    setCheckingLmsChanges(true);
    try {
      const res = await fetch(`/api/classes?type=check_lms_changes&ids=${encodeURIComponent(ids)}`);
      const data = await res.json();
      if (data.success && data.changesMap) {
        setLmsChangesMap((prev) => ({ ...prev, ...data.changesMap }));
      }
    } catch (err) {
      console.error("Lỗi kiểm tra đối chiếu LMS ngầm:", err);
    } finally {
      setCheckingLmsChanges(false);
    }
  };

  useEffect(() => {
    fetchManagedClasses();
  }, [selectedCentre, selectedStatus]);

  // Lọc và sắp xếp danh sách quản lý
  const sortedAndFilteredClasses = useMemo(() => {
    return managedClasses
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = c.name?.toLowerCase().includes(q);
        const centreMatch = c.centreName?.toLowerCase().includes(q);
        const courseMatch = c.courseName?.toLowerCase().includes(q);
        const teacherMatch = c.teacherName?.toLowerCase().includes(q);
        return nameMatch || centreMatch || courseMatch || teacherMatch;
      })
      .sort((a, b) => {
        if (classSortBy === "name_asc") return a.name.localeCompare(b.name, "vi");
        if (classSortBy === "name_desc") return b.name.localeCompare(a.name, "vi");
        if (classSortBy === "status") return (a.status || "").localeCompare(b.status || "");
        if (classSortBy === "progress_desc") return (b.progressPercent || 0) - (a.progressPercent || 0);
        return 0;
      });
  }, [managedClasses, searchQuery, classSortBy]);

  const classTotalPages = Math.ceil(sortedAndFilteredClasses.length / CLASSES_PER_PAGE) || 1;

  const paginatedClasses = useMemo(() => {
    const start = (classCurrentPage - 1) * CLASSES_PER_PAGE;
    return sortedAndFilteredClasses.slice(start, start + CLASSES_PER_PAGE);
  }, [sortedAndFilteredClasses, classCurrentPage]);

  // Options cho bộ lọc cơ sở
  const centreOptions = useMemo(() => {
    return [
      { value: "all", label: `Tất cả cơ sở trực thuộc (${userCentres.length})` },
      ...userCentres.map((c) => ({
        value: c.id,
        label: c.name,
        subLabel: c.shortName || c.code || undefined,
      })),
    ];
  }, [userCentres]);

  // Options cho bộ lọc trạng thái
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Tất cả trạng thái" },
      { value: "RUNNING", label: "Đang học (Running)" },
      { value: "OPEN", label: "Sắp mở (Open)" },
      { value: "FINISHED", label: "Đã kết thúc (Finished)" },
    ],
    []
  );

  // Options cho bộ lọc sắp xếp
  const sortOptions = useMemo(
    () => [
      { value: "name_asc", label: "Tên lớp: A - Z" },
      { value: "name_desc", label: "Tên lớp: Z - A" },
      { value: "status", label: "Theo trạng thái" },
      { value: "progress_desc", label: "Tiến độ cao nhất" },
    ],
    []
  );

  const handleJumpToClassPage = (page: number) => {
    const p = Math.max(1, Math.min(page, classTotalPages));
    setClassCurrentPage(p);
    setClassPageInput(String(p));
  };

  // Real-time tra cứu lớp từ LMS khi người dùng nhập tên/mã lớp (Debounce đúng 1s sau lần nhập cuối cùng)
  useEffect(() => {
    const trimmed = searchCodeInput.trim();
    if (trimmed.length < 2) {
      setDropdownClasses([]);
      setShowDropdown(false);
      setSearchingDropdown(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingDropdown(true);
      try {
        const res = await fetch(`/api/classes?type=search&q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.success) {
          setDropdownClasses(data.classes || []);
          setShowDropdown(true);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Lỗi tìm kiếm real-time lớp LMS:", err);
        }
      } finally {
        setSearchingDropdown(false);
      }
    }, 1000); // Đợi đúng 1 giây (1000ms) sau lần nhập cuối cùng

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchCodeInput]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Chọn lớp từ Dropdown gợi ý real-time
  const handleSelectClassFromDropdown = (item: any) => {
    setShowDropdown(false);
    setSearchCodeInput(item.name);
    setModalActiveTab("schedule");

    if (item.alreadyManaged) {
      showToast(`Lớp ${item.name} đã tồn tại trong danh sách quản lý`, "info");
      const existing = managedClasses.find((m) => m.id === item.id);
      if (existing) {
        setActiveClass(existing);
        setEditedSlots(existing.slots || []);
        setModalMode("view");
      }
      return;
    }

    // Tính toán hạn nộp bài mặc định
    const defaultSlots = calculateDefaultDeadlines(item);

    const newManagedClass: ManagedClass = {
      id: item.id,
      name: item.name,
      status: item.status,
      courseName: item.course?.name || "Khóa học MindX",
      centreId: item.centre?.id || "",
      centreName: item.centre?.name || "Cơ sở MindX",
      teacherName: item.teacherName || "Chưa phân công",
      teacherCodes: item.teacherCodes || [],
      classTime: item.classTime || "Chưa có khung giờ",
      startDate: item.startDate,
      endDate: item.endDate,
      numberOfSessions: item.numberOfSessions,
      completedSessions: item.completedSessions,
      progressPercent: item.progressPercent,
      checkpoint1Session: item.checkpoint1Session || item.courseProcess?.checkpoint1Session || null,
      checkpoint1Date: item.checkpoint1Date || item.courseProcess?.checkpoint1Date || null,
      checkpoint2Session: item.checkpoint2Session || item.courseProcess?.checkpoint2Session || null,
      checkpoint2Date: item.checkpoint2Date || item.courseProcess?.checkpoint2Date || null,
      finalProjectSession: item.finalProjectSession || item.courseProcess?.finalProjectSession || null,
      finalProjectDate: item.finalProjectDate || item.courseProcess?.finalProjectDate || null,
      slots: defaultSlots,
      students: item.students || [],
    };

    setActiveClass(newManagedClass);
    setEditedSlots(defaultSlots);
    setModalMode("add");
  };

  // 3. Xử lý tìm kiếm mã lớp từ LMS và mở modal thêm vào Supabase
  const handleSearchAndAdd = async () => {
    setShowDropdown(false);
    const trimmedCode = searchCodeInput.trim();
    if (!trimmedCode) {
      showToast("Vui lòng nhập mã lớp học cần tìm", "error");
      return;
    }

    setSearchingCode(true);
    try {
      const res = await fetch(`/api/classes?type=find&code=${encodeURIComponent(trimmedCode)}`);
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || "Không tìm thấy lớp học phù hợp", "error");
        return;
      }

      if (data.alreadyManaged) {
        showToast(`Lớp ${data.class.name} đã có trong danh sách quản lý`, "info");
        setActiveClass(data.class);
        setEditedSlots(data.class.slots || []);
        setModalMode("view");
        return;
      }

      // Tìm thấy lớp từ LMS -> Mở modal xem trước để xác nhận thêm vào Supabase
      const raw = data.class;
      const defaultSlots = data.defaultSlots || raw.slots || [];
      const normalizedClass: ManagedClass = {
        id: raw.id,
        name: raw.name,
        status: raw.status,
        courseName: raw.courseName || raw.course?.name || "Khóa học MindX",
        centreId: raw.centreId || raw.centre?.id || "",
        centreName: raw.centreName || raw.centre?.name || "Cơ sở MindX",
        teacherName: raw.teacherName || "Chưa phân công",
        teacherCodes: raw.teacherCodes || [],
        classTime: raw.classTime || "Chưa có khung giờ",
        startDate: raw.startDate,
        endDate: raw.endDate,
        numberOfSessions: raw.numberOfSessions || defaultSlots.length,
        completedSessions: raw.completedSessions || 0,
        progressPercent: raw.progressPercent || 0,
        checkpoint1Session: raw.checkpoint1Session || raw.courseProcess?.checkpoint1Session || null,
        checkpoint1Date: raw.checkpoint1Date || raw.courseProcess?.checkpoint1Date || null,
        checkpoint2Session: raw.checkpoint2Session || raw.courseProcess?.checkpoint2Session || null,
        checkpoint2Date: raw.checkpoint2Date || raw.courseProcess?.checkpoint2Date || null,
        finalProjectSession: raw.finalProjectSession || raw.courseProcess?.finalProjectSession || null,
        finalProjectDate: raw.finalProjectDate || raw.courseProcess?.finalProjectDate || null,
        slots: defaultSlots,
        students: raw.students || [],
      };

      setActiveClass(normalizedClass);
      setEditedSlots(defaultSlots);
      setModalMode("add");
      setModalActiveTab("schedule");
    } catch (err) {
      console.error("Lỗi tìm kiếm lớp học:", err);
      showToast("Lỗi kết nối khi tìm kiếm lớp học từ LMS", "error");
    } finally {
      setSearchingCode(false);
    }
  };

  // 4. Xử lý xác nhận Thêm lớp học (Lưu Supabase)
  const handleConfirmAdd = async () => {
    if (!activeClass) return;
    setSavingClass(true);

    try {
      const payload: ManagedClass = {
        ...activeClass,
        slots: editedSlots,
        students: activeClass.students || [],
      };

      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classData: payload }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã thêm lớp ${activeClass.name} vào danh sách quản lý`);
        const savedClass = data.class || activeClass;
        setActiveClass(null);
        setSearchCodeInput("");
        fetchManagedClasses();
        // Sau khi thêm lớp, tự động mở modal danh sách học viên để đối chiếu và thêm vào Supabase
        openStudentReviewModal(savedClass);
      } else {
        showToast(data.error || "Không thể thêm lớp học", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi thêm lớp học", "error");
    } finally {
      setSavingClass(false);
    }
  };

  // Mở modal đối chiếu & quản lý học viên lớp học
  const openStudentReviewModal = async (cls: ManagedClass) => {
    setStudentReviewModalClass(cls);
    setLoadingStudentReviews(true);
    setStudentReviewFilter("ALL");
    try {
      const res = await fetch(`/api/students?type=review&classId=${encodeURIComponent(cls.id)}`);
      const data = await res.json();
      if (data.success) {
        setStudentReviews(data.reviews || []);
        setStudentReviewStats(data.stats || { totalLms: 0, notInSupabase: 0, hasChanges: 0, upToDate: 0 });
      } else {
        showToast(data.error || "Không thể tải danh sách học viên từ LMS", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi tải danh sách học viên", "error");
    } finally {
      setLoadingStudentReviews(false);
    }
  };

  // Thêm 1 học viên duy nhất vào Supabase
  const handleAddSingleStudent = async (reviewItem: StudentReviewItem) => {
    if (!studentReviewModalClass) return;
    setOperatingStudentId(reviewItem.id);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_single",
          classInfo: {
            id: studentReviewModalClass.id,
            name: studentReviewModalClass.name,
            courseName: studentReviewModalClass.courseName,
            centreId: studentReviewModalClass.centreId,
            centreName: studentReviewModalClass.centreName,
          },
          student: {
            id: reviewItem.id,
            studentCode: reviewItem.studentCode,
            fullName: reviewItem.fullName,
            status: reviewItem.status,
            email: reviewItem.lmsStudent.email,
            phoneNumber: reviewItem.lmsStudent.phoneNumber,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã thêm học viên ${reviewItem.fullName}`);
        await openStudentReviewModal(studentReviewModalClass);
        fetchManagedClasses();
      } else {
        showToast(data.error || "Không thể thêm học viên", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi thêm học viên", "error");
    } finally {
      setOperatingStudentId(null);
    }
  };

  // Cập nhật 1 học viên có thay đổi từ LMS vào Supabase
  const handleSyncSingleStudent = async (reviewItem: StudentReviewItem) => {
    if (!studentReviewModalClass) return;
    setOperatingStudentId(reviewItem.id);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_single",
          studentId: reviewItem.id,
          lmsData: {
            fullName: reviewItem.lmsStudent.fullName,
            status: reviewItem.lmsStudent.status,
            email: reviewItem.lmsStudent.email,
            phoneNumber: reviewItem.lmsStudent.phoneNumber,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã cập nhật học viên ${reviewItem.fullName}`);
        await openStudentReviewModal(studentReviewModalClass);
        fetchManagedClasses();
      } else {
        showToast(data.error || "Không thể cập nhật học viên", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi cập nhật học viên", "error");
    } finally {
      setOperatingStudentId(null);
    }
  };

  // Thêm tất cả học viên mới vào Supabase
  const handleAddAllNewStudents = async () => {
    if (!studentReviewModalClass) return;
    const newStudents = studentReviews
      .filter((r) => r.reviewStatus === "NOT_IN_SUPABASE")
      .map((r) => ({
        id: r.id,
        fullName: r.fullName,
        status: r.status,
        email: r.lmsStudent.email,
        phoneNumber: r.lmsStudent.phoneNumber,
      }));
    if (newStudents.length === 0) return;

    setOperatingAllStudents(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_all",
          classInfo: {
            id: studentReviewModalClass.id,
            name: studentReviewModalClass.name,
            courseName: studentReviewModalClass.courseName,
            centreId: studentReviewModalClass.centreId,
            centreName: studentReviewModalClass.centreName,
          },
          students: newStudents,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã thêm ${newStudents.length} học viên mới`);
        await openStudentReviewModal(studentReviewModalClass);
        fetchManagedClasses();
      } else {
        showToast(data.error || "Lỗi khi thêm học viên", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi thêm học viên", "error");
    } finally {
      setOperatingAllStudents(false);
    }
  };

  // Cập nhật tất cả học viên có thay đổi từ LMS
  const handleSyncAllChangedStudents = async () => {
    if (!studentReviewModalClass) return;
    const changedStudents = studentReviews
      .filter((r) => r.reviewStatus === "HAS_CHANGES")
      .map((r) => ({
        id: r.id,
        fullName: r.lmsStudent.fullName,
        status: r.lmsStudent.status,
        email: r.lmsStudent.email,
        phoneNumber: r.lmsStudent.phoneNumber,
      }));
    if (changedStudents.length === 0) return;

    setOperatingAllStudents(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_all_changed",
          classInfo: {
            id: studentReviewModalClass.id,
            name: studentReviewModalClass.name,
            courseName: studentReviewModalClass.courseName,
            centreId: studentReviewModalClass.centreId,
            centreName: studentReviewModalClass.centreName,
          },
          students: changedStudents,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã cập nhật ${changedStudents.length} học viên thay đổi`);
        await openStudentReviewModal(studentReviewModalClass);
        fetchManagedClasses();
      } else {
        showToast(data.error || "Lỗi khi cập nhật học viên", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi cập nhật học viên", "error");
    } finally {
      setOperatingAllStudents(false);
    }
  };

  // Danh sách học viên review đã qua bộ lọc
  const filteredStudentReviews = useMemo(() => {
    if (studentReviewFilter === "ALL") return studentReviews;
    return studentReviews.filter((r) => r.reviewStatus === studentReviewFilter);
  }, [studentReviews, studentReviewFilter]);

  // 5. Xem chi tiết lớp học đã quản lý
  const handleOpenViewModal = async (cls: ManagedClass) => {
    setActiveClass(cls);
    setEditedSlots(cls.slots || []);
    setModalMode("view");
    setModalActiveTab("schedule");

    // Lấy danh sách học viên của lớp từ Supabase để hiển thị
    setViewModalStudentDiffMap({});
    try {
      const res = await fetch(`/api/students?classId=${encodeURIComponent(cls.id)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.students)) {
        setActiveClass((prev) => (prev && prev.id === cls.id ? { ...prev, students: data.students } : prev));
      }
    } catch (e) {
      // Ignored
    }

    // Tải đối chiếu học viên với LMS để phát hiện thay đổi chi tiết tại từng học viên
    try {
      const reviewRes = await fetch(`/api/students?type=review&classId=${encodeURIComponent(cls.id)}`);
      const reviewData = await reviewRes.json();
      if (reviewData.success && Array.isArray(reviewData.reviews)) {
        const diffMap: Record<string, StudentReviewItem> = {};
        for (const r of reviewData.reviews) {
          diffMap[r.id] = r;
        }
        setViewModalStudentDiffMap(diffMap);
      }
    } catch (e) {
      // Ignored
    }

    // Luôn kiểm tra đối chiếu LMS ngay lập tức cho lớp này nếu chưa có diffs trong lmsChangesMap
    if (!lmsChangesMap[cls.id]?.diffs || lmsChangesMap[cls.id].diffs.length === 0) {
      try {
        const syncRes = await fetch(`/api/classes/${cls.id}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: false }),
        });
        const syncData = await syncRes.json();
        if (syncData.success && syncData.hasChanges && Array.isArray(syncData.diffs) && syncData.diffs.length > 0) {
          setLmsChangesMap((prev) => ({
            ...prev,
            [cls.id]: {
              hasChanges: true,
              diffCount: syncData.diffs.length,
              diffs: syncData.diffs,
            },
          }));
        }
      } catch (e) {
        // Ignored
      }
    }
  };

  // 6. Lưu thay đổi hạn nộp bài (mode: "view")
  const handleSaveDeadlineChanges = async () => {
    if (!activeClass) return;
    setSavingClass(true);

    try {
      const res = await fetch(`/api/classes/${activeClass.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: editedSlots }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Đã lưu các thay đổi hạn nộp bài thành công");
        setActiveClass((prev) => (prev ? { ...prev, slots: editedSlots } : null));
        fetchManagedClasses();
      } else {
        showToast(data.error || "Không thể lưu thay đổi", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi lưu hạn nộp bài", "error");
    } finally {
      setSavingClass(false);
    }
  };

  // 7. Gỡ bỏ lớp học khỏi danh sách quản lý
  const handleDeleteManagedClass = (cls: ManagedClass) => {
    setDeleteConfirmClass(cls);
  };

  const confirmDeleteManagedClass = async () => {
    if (!deleteConfirmClass) return;
    setIsDeletingClass(true);

    try {
      const res = await fetch(`/api/classes/${deleteConfirmClass.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã gỡ lớp ${deleteConfirmClass.name} khỏi danh sách quản lý`);
        if (activeClass?.id === deleteConfirmClass.id) setActiveClass(null);
        setDeleteConfirmClass(null);
        fetchManagedClasses();
      } else {
        showToast(data.error || "Không thể xóa lớp học", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi xóa lớp", "error");
    } finally {
      setIsDeletingClass(false);
    }
  };

  // 8. Tải dữ liệu từ LMS & Kiểm tra thay đổi Side-by-Side
  const handleCheckSyncLms = async (targetClass: ManagedClass) => {
    setSyncingClassId(targetClass.id);
    setSyncingTargetClass(targetClass);

    // Nếu đã có sẵn diffs từ kiểm tra ngầm, mở modal ngay tức thì (0ms delay)
    if (lmsChangesMap[targetClass.id]?.hasChanges && lmsChangesMap[targetClass.id]?.diffs?.length > 0) {
      const cachedDiffs = lmsChangesMap[targetClass.id].diffs;
      setCurrentDiffs(cachedDiffs);
      const initialSelected: Record<string, boolean> = {};
      cachedDiffs.forEach((d: ClassDiffItem) => {
        initialSelected[d.field] = true;
      });
      setSelectedDiffFields(initialSelected);
      setDiffModalOpen(true);
      setSyncingClassId(null);
      return;
    }

    try {
      const res = await fetch(`/api/classes/${targetClass.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: false }),
      });

      const data = await res.json();
      if (!data.success) {
        showToast(data.error || "Không thể kiểm tra dữ liệu LMS", "error");
        return;
      }

      if (data.hasChanges && Array.isArray(data.diffs) && data.diffs.length > 0) {
        setCurrentDiffs(data.diffs);
        setLmsChangesMap((prev) => ({
          ...prev,
          [targetClass.id]: {
            hasChanges: true,
            diffCount: data.diffs.length,
            diffs: data.diffs,
          },
        }));
        // Tự động tích chọn tất cả các trường thay đổi ban đầu
        const initialSelected: Record<string, boolean> = {};
        data.diffs.forEach((d: ClassDiffItem) => {
          initialSelected[d.field] = true;
        });
        setSelectedDiffFields(initialSelected);
        setDiffModalOpen(true);
      } else {
        showToast(`Dữ liệu lớp ${targetClass.name} đã hoàn toàn đồng bộ với LMS`, "info");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi kiểm tra LMS", "error");
    } finally {
      setSyncingClassId(null);
    }
  };

  // 9. Xác nhận đồng bộ dữ liệu thay đổi từ LMS vào Supabase (hỗ trợ đồng bộ mục chọn hoặc tất cả)
  const handleConfirmSyncLms = async (overrideSelectedKeys?: string[]) => {
    if (!syncingTargetClass) return;
    setConfirmingSync(true);

    let keysToSend: string[] | null = null;
    if (overrideSelectedKeys && overrideSelectedKeys.length > 0) {
      keysToSend = overrideSelectedKeys;
    } else {
      const selected = Object.keys(selectedDiffFields).filter((k) => selectedDiffFields[k]);
      if (selected.length === 0) {
        showToast("Vui lòng chọn ít nhất 1 mục để đồng bộ", "error");
        setConfirmingSync(false);
        return;
      }
      keysToSend = selected;
    }

    try {
      const res = await fetch(`/api/classes/${syncingTargetClass.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, selectedKeys: keysToSend }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã đồng bộ dữ liệu lớp ${syncingTargetClass.name} từ LMS thành công`);
        setDiffModalOpen(false);
        // Xóa cờ cảnh báo của lớp này sau khi đã cập nhật xong
        setLmsChangesMap((prev) => {
          const next = { ...prev };
          delete next[syncingTargetClass.id];
          return next;
        });
        const syncedId = syncingTargetClass.id;
        setSyncingTargetClass(null);
        if (activeClass?.id === syncedId) {
          if (data.updatedClass) {
            setActiveClass(data.updatedClass);
            setEditedSlots(data.updatedClass.slots || []);
          }
          // Tải lại danh sách học viên mới nhất từ Supabase vào modal
          try {
            const stRes = await fetch(`/api/students?classId=${encodeURIComponent(syncedId)}`);
            const stData = await stRes.json();
            if (stData.success && Array.isArray(stData.students)) {
              setActiveClass((prev) => (prev && prev.id === syncedId ? { ...prev, students: stData.students } : prev));
            }
          } catch (e) {
            // Ignored
          }
        }
        fetchManagedClasses();
      } else {
        showToast(data.error || "Lỗi khi cập nhật từ LMS", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối khi xác nhận cập nhật LMS", "error");
    } finally {
      setConfirmingSync(false);
    }
  };

  // Cập nhật hạn nộp bài của một slot trong modal
  const handleSlotDeadlineChange = (index: number, newDeadline: string) => {
    setEditedSlots((prev) =>
      prev.map((s) => (s.index === index ? { ...s, submissionDeadline: newDeadline } : s))
    );
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "RUNNING") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Đang học
        </span>
      );
    }
    if (s === "OPEN") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
          <Clock className="w-3 h-3" />
          Sắp mở
        </span>
      );
    }
    if (s === "FINISHED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" />
          Đã kết thúc
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
        {status}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-6">
        {/* Toast Feedback - Luôn hiển thị trên cùng (z-[99999]) để không bị modal che khuất */}
        {toastMessage && (
          <div
            className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
              toastMessage.type === "success"
                ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/25"
                : toastMessage.type === "error"
                ? "bg-rose-500 text-white border-rose-600 shadow-rose-500/25"
                : "bg-slate-900 text-white border-slate-700 shadow-black/30"
            }`}
          >
            {toastMessage.type === "success" && <Check className="w-4 h-4 shrink-0" />}
            {toastMessage.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
            {toastMessage.type === "info" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span className="leading-snug">{toastMessage.text}</span>
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
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate uppercase">
                Quản Lý Lớp Học
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Theo dõi tiến độ, lịch học, giờ học, giáo viên phụ trách và cấu hình hạn nộp bài
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => {
                fetchManagedClasses(true);
              }}
              disabled={refreshing || loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-rose-500" : ""}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Section Tìm Kiếm & Thêm Lớp Học Vào Quản Lý */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-rose-500" />
              Tìm Kiếm & Thêm Lớp Học Vào Quản Lý
            </label>
            <span className="text-[11px] font-medium text-slate-400">
              Tra cứu trực tiếp từ LMS & Lưu vào Supabase DB
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full" ref={dropdownRef}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchCodeInput}
                onChange={(e) => setSearchCodeInput(e.target.value)}
                onFocus={() => {
                  if (dropdownClasses.length > 0) setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchAndAdd();
                  }
                  if (e.key === "Escape") {
                    setShowDropdown(false);
                  }
                }}
                placeholder="Nhập mã lớp học (Ví dụ: LBB-ROB-ARMA12)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />

              {/* Dropdown Gợi Ý Real-time Từ LMS (Tuân thủ phân quyền vai trò) */}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1">
                  <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800/60 uppercase tracking-wider">
                    <span>Gợi ý lớp học ({dropdownClasses.length})</span>
                    {searchingDropdown && (
                      <span className="flex items-center gap-1.5 text-rose-500 font-semibold normal-case">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Đang tra cứu LMS...
                      </span>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
                    {searchingDropdown && dropdownClasses.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                        Đang tìm kiếm lớp học từ LMS...
                      </div>
                    ) : dropdownClasses.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Không tìm thấy lớp học nào khớp với từ khóa (theo quyền hạn cơ sở & vai trò của bạn)
                      </div>
                    ) : (
                      dropdownClasses.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectClassFromDropdown(item)}
                          className="p-3 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/80 transition-colors flex items-center justify-between gap-3 text-left group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-500 transition-colors">
                                {item.name}
                              </span>
                              {item.course?.name && (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                  {item.course.name}
                                </span>
                              )}
                              {item.alreadyManaged && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold whitespace-nowrap">
                                  Đã trong quản lý
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                {item.centre?.name || "N/A"}
                              </span>
                              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                                <UserCheck className="w-3 h-3 text-rose-500 shrink-0" />
                                {item.teacherName || "Chưa phân công"}
                              </span>
                              {item.classTime && (
                                <span className="flex items-center gap-1 text-slate-500">
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  {item.classTime}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {getStatusBadge(item.status)}
                            <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSearchAndAdd}
              disabled={searchingCode || !searchCodeInput.trim()}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-sm ${
                searchCodeInput.trim() && !searchingCode
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 active:scale-95"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
              }`}
            >
              {searchingCode ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <span>{searchingCode ? "Đang tìm..." : "Tìm & Thêm"}</span>
            </button>
          </div>
        </div>

        {/* Toolbar Lọc & Tìm Kiếm Danh Sách Quản Lý (Responsive Grid & Alignment) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="relative w-full xl:w-80 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã lớp, giáo viên, cơ sở..."
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full xl:w-auto">
            {/* Lọc theo cơ sở trực thuộc (có ô tìm kiếm) */}
            <SearchableDropdown
              value={selectedCentre}
              onChange={(val) => {
                setSelectedCentre(val);
                setClassCurrentPage(1);
                setClassPageInput("1");
              }}
              options={centreOptions}
              placeholder="Chọn cơ sở..."
              searchPlaceholder="Tìm kiếm cơ sở..."
              icon={<Building2 className="w-3.5 h-3.5" />}
              className="w-full"
              align="left"
            />

            {/* Lọc theo trạng thái (có ô tìm kiếm) */}
            <SearchableDropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setClassCurrentPage(1);
                setClassPageInput("1");
              }}
              options={statusOptions}
              placeholder="Chọn trạng thái..."
              searchPlaceholder="Tìm trạng thái..."
              icon={<Filter className="w-3.5 h-3.5" />}
              className="w-full"
              align="left"
            />

            {/* Sắp xếp (có ô tìm kiếm, align="right" chống tràn mép phải màn hình) */}
            <SearchableDropdown
              value={classSortBy}
              onChange={(val) => {
                setClassSortBy(val);
                setClassCurrentPage(1);
                setClassPageInput("1");
              }}
              options={sortOptions}
              placeholder="Sắp xếp theo..."
              searchPlaceholder="Tìm kiểu sắp xếp..."
              icon={<ArrowUpDown className="w-3.5 h-3.5" />}
              className="w-full"
              align="right"
            />
          </div>
        </div>

        {/* Bảng Danh Sách Lớp Đang Quản Lý (Chuẩn Responsive Toàn Diện) */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
          {/* Thanh chỉ dẫn cuộn ngang trên thiết bị màn hình nhỏ / trung bình */}
          {sortedAndFilteredClasses.length > 0 && (
            <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between xl:hidden">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Kéo / vuốt sang phải để xem đầy đủ cột Tiến độ, Trạng thái & Thao tác</span>
              </span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">10 cột dữ liệu</span>
            </div>
          )}

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1140px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2 text-center whitespace-nowrap w-12">STT</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[190px]">Mã Lớp & Khóa Học</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[150px]">Cơ Sở</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap min-w-[140px]">Giáo Viên Phụ Trách</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap min-w-[110px]">Giờ Học</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap min-w-[95px]">Ngày Bắt Đầu</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap min-w-[95px]">Ngày Kết Thúc</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap min-w-[130px]">Tiến Độ</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap min-w-[105px]">Trạng Thái</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap min-w-[100px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
                      <span className="text-xs">Đang tải danh sách lớp học quản lý...</span>
                    </td>
                  </tr>
                ) : sortedAndFilteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <GraduationCap className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                      <span className="text-xs">Chưa có lớp học nào trong danh sách quản lý</span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Nhập mã lớp học ở ô tìm kiếm phía trên và bấm "Tìm & Thêm" để đưa lớp vào quản lý
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedClasses.map((cls, idx) => (
                    <tr
                      key={cls.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 text-center whitespace-nowrap font-mono">
                        {(classCurrentPage - 1) * CLASSES_PER_PAGE + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white whitespace-nowrap">
                            {cls.name}
                          </span>
                          {/* Huy hiệu cảnh báo LMS có thay đổi dữ liệu */}
                          {lmsChangesMap[cls.id]?.hasChanges && (
                            <button
                              type="button"
                              onClick={() => handleCheckSyncLms(cls)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer animate-pulse whitespace-nowrap"
                              title={`Dữ liệu trên LMS đã có ${lmsChangesMap[cls.id].diffCount} thay đổi so với Supabase. Nhấp để xem đối chiếu & cập nhật.`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>LMS Đã Đổi ({lmsChangesMap[cls.id].diffCount})</span>
                            </button>
                          )}
                        </div>
                        {cls.courseName && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {cls.courseName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                          {cls.centreName || "N/A"}
                        </span>
                      </td>
                      {/* Giáo viên phụ trách */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <UserCheck className="w-3 h-3 text-rose-500" />
                          {cls.teacherName || "Chưa phân công"}
                        </span>
                      </td>
                      {/* Giờ học */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {cls.classTime || "N/A"}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-400">
                        {formatVnDate(cls.startDate)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-400">
                        {formatVnDate(cls.endDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center min-w-[120px]">
                          <div className="flex items-center justify-between w-full text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                            <span>
                              {cls.completedSessions}/{cls.numberOfSessions} buổi
                            </span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              {cls.progressPercent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 to-red-500 rounded-full transition-all duration-300"
                              style={{ width: `${cls.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(cls.status)}
                      </td>
                      {/* Thao tác */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenViewModal(cls)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Xem chi tiết & Hạn nộp bài"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCheckSyncLms(cls)}
                            disabled={syncingClassId === cls.id}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
                              lmsChangesMap[cls.id]?.hasChanges
                                ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                                : "text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            }`}
                            title={
                              lmsChangesMap[cls.id]?.hasChanges
                                ? `LMS có ${lmsChangesMap[cls.id].diffCount} thay đổi. Bấm để đối chiếu & cập nhật!`
                                : "Tải dữ liệu từ LMS"
                            }
                          >
                            <RefreshCw className={`w-4 h-4 ${syncingClassId === cls.id ? "animate-spin text-rose-500" : ""}`} />
                            {lmsChangesMap[cls.id]?.hasChanges && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            )}
                          </button>
                          <button
                            onClick={() => openStudentReviewModal(cls)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Quản lý & đối chiếu học viên với LMS"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteManagedClass(cls)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Gỡ khỏi danh sách quản lý"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân Trang Lớp Học */}
          {sortedAndFilteredClasses.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="whitespace-nowrap font-medium">
                Hiển thị{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {(classCurrentPage - 1) * CLASSES_PER_PAGE + 1}
                </span>{" "}
                -{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {Math.min(classCurrentPage * CLASSES_PER_PAGE, sortedAndFilteredClasses.length)}
                </span>{" "}
                trên tổng số{" "}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {sortedAndFilteredClasses.length}
                </span>{" "}
                lớp học
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleJumpToClassPage(1)}
                  disabled={classCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang đầu tiên"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpToClassPage(classCurrentPage - 1)}
                  disabled={classCurrentPage <= 1}
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
                    max={classTotalPages}
                    value={classPageInput}
                    onChange={(e) => setClassPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleJumpToClassPage(Number(classPageInput));
                      }
                    }}
                    onBlur={() => handleJumpToClassPage(Number(classPageInput))}
                    className="w-14 text-center py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                  <span>/ {classTotalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleJumpToClassPage(classCurrentPage + 1)}
                  disabled={classCurrentPage >= classTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpToClassPage(classTotalPages)}
                  disabled={classCurrentPage >= classTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                  title="Trang cuối cùng"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Chi Tiết Lớp Học (Thêm Mới hoặc Xem/Sửa) */}
        {activeClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{activeClass.name}</span>
                      {modalMode === "add" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500 text-white">
                          Xác nhận thêm
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Đang quản lý
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeClass.courseName || "Khóa học MindX"} • {activeClass.centreName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveClass(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thông Tin Tổng Quan (Hàng ngang tinh gọn) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Trạng thái</div>
                  <div className="mt-1 flex justify-center">{getStatusBadge(activeClass.status)}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Giáo viên phụ trách</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {activeClass.teacherName || "Chưa phân công"}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Giờ học</div>
                  <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {activeClass.classTime || "N/A"}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Tổng số buổi</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {activeClass.numberOfSessions} buổi
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-center col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-400 font-medium">Thời gian học</div>
                  <div className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    {formatVnDate(activeClass.startDate)} - {formatVnDate(activeClass.endDate)}
                  </div>
                </div>
              </div>

              {/* CẢNH BÁO & ĐỐI CHIẾU THAY ĐỔI DỮ LIỆU TỪ LMS (Hiển thị ngay trong Modal Chi Tiết Lớp Học) */}
              {(() => {
                const classChanges = lmsChangesMap[activeClass.id];
                if (!classChanges?.hasChanges || !classChanges.diffs?.length) return null;

                return (
                  <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          Phát hiện {classChanges.diffCount} dữ liệu trên LMS đã thay đổi so với hệ thống
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setSyncingTargetClass(activeClass);
                            await handleConfirmSyncLms(classChanges.diffs.map((d) => d.field));
                          }}
                          disabled={confirmingSync}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${confirmingSync ? "animate-spin" : ""}`} />
                          <span>Đồng bộ tất cả dữ liệu LMS</span>
                        </button>
                      </div>
                    </div>

                    {/* Bảng so sánh 4 cột: Đang thay đổi gì | Dữ liệu cũ đang sai | Dữ liệu mới bên LMS | Thao tác */}
                    <div className="rounded-xl border border-amber-500/20 bg-white dark:bg-[#0B0F17] overflow-x-auto scrollbar-thin">
                      <table className="w-full min-w-[560px] text-left border-collapse text-xs">
                        <thead className="bg-amber-500/10 text-[10px] uppercase font-bold text-amber-800 dark:text-amber-200 border-b border-amber-500/20">
                          <tr>
                            <th className="py-2.5 px-3 w-1/4">Đang thay đổi gì</th>
                            <th className="py-2.5 px-3 w-1/3 text-rose-600 dark:text-rose-400">Dữ liệu cũ đang sai (Supabase)</th>
                            <th className="py-2.5 px-3 w-1/3 text-emerald-600 dark:text-emerald-400">Dữ liệu mới bên LMS</th>
                            <th className="py-2.5 px-3 w-24 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-500/10 font-medium">
                          {classChanges.diffs.map((diff, i) => (
                            <tr key={i} className="hover:bg-amber-500/5 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                                {diff.label}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-xs border border-rose-500/20">
                                  {diff.oldValue || "—"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                                  {diff.newValue || "—"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setSyncingTargetClass(activeClass);
                                    await handleConfirmSyncLms([diff.field]);
                                  }}
                                  disabled={confirmingSync}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
                                  title={`Chỉ đồng bộ riêng mục "${diff.label}"`}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Cập nhật</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Tab Chuyển Đổi Giữa Lịch Trình Buổi Học và Danh Sách Học Viên */}
              {(() => {
                const activeStudents = (activeClass.students || []).filter(
                  (s: any) => s.activeInClass !== false
                );

                return (
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setModalActiveTab("schedule")}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        modalActiveTab === "schedule"
                          ? "bg-rose-500 text-white shadow-sm shadow-rose-500/20"
                          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Lịch trình & Hạn nộp bài ({editedSlots.length} buổi)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalActiveTab("students")}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        modalActiveTab === "students"
                          ? "bg-rose-500 text-white shadow-sm shadow-rose-500/20"
                          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Danh sách học viên ({activeStudents.length} học viên)</span>
                    </button>
                  </div>
                );
              })()}

              {/* TAB 1: Bảng Lịch Trình Chi Tiết Các Buổi Học & Hạn Nộp Bài */}
              {modalActiveTab === "schedule" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-rose-500" />
                      Lịch Trình Chi Tiết & Hạn Nộp Bài ({editedSlots.length} buổi)
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      * Bạn có thể chỉnh sửa trực tiếp ô "Hạn nộp bài" cho từng buổi
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin">
                    <table className="w-full min-w-[580px] text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-14">Buổi</th>
                          <th className="py-2.5 px-3 text-center w-28">Ngày học</th>
                          <th className="py-2.5 px-3 text-center w-28">Giờ học</th>
                          <th className="py-2.5 px-3 text-center w-32">Ghi chú mốc</th>
                          <th className="py-2.5 px-4 min-w-[200px]">Hạn nộp bài (Có thể chỉnh sửa)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {(() => {
                          const cp1Session =
                            activeClass.checkpoint1Session ||
                            (activeClass as any).courseProcess?.checkpoint1Session ||
                            null;
                          const cp2Session =
                            activeClass.checkpoint2Session ||
                            (activeClass as any).courseProcess?.checkpoint2Session ||
                            null;
                          const totalSessions =
                            activeClass.numberOfSessions ||
                            editedSlots.length ||
                            0;
                          const finalSession =
                            activeClass.finalProjectSession ||
                            (activeClass as any).courseProcess?.finalProjectSession ||
                            totalSessions;

                          // Giai đoạn SP Cuối Khóa bắt buộc hiển thị liên tục từ sau Checkpoint 2 đến buổi cuối cùng
                          const spckStartSession = cp2Session
                            ? cp2Session + 1
                            : cp1Session
                            ? cp1Session + 1
                            : finalSession;

                          return editedSlots.map((slot, idx) => {
                            const sessionNum = slot.index !== undefined ? slot.index + 1 : idx + 1;
                            const isCp1 = cp1Session !== null && sessionNum === cp1Session;
                            const isCp2 = cp2Session !== null && sessionNum === cp2Session;
                            const isFinal =
                              spckStartSession !== null &&
                              sessionNum >= spckStartSession &&
                              sessionNum <= totalSessions;

                            const slotTime =
                              slot.startTime && slot.endTime
                                ? `${formatVnTime(slot.startTime)} - ${formatVnTime(slot.endTime)}`
                                : activeClass.classTime || "N/A";

                            return (
                              <tr
                                key={slot.index}
                                className={`transition-colors ${
                                  isCp1
                                    ? "bg-amber-500/5 dark:bg-amber-500/10"
                                    : isCp2
                                    ? "bg-indigo-500/5 dark:bg-indigo-500/10"
                                    : isFinal
                                    ? "bg-rose-500/5 dark:bg-rose-500/10"
                                    : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                                }`}
                              >
                                <td className="py-2 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                  {sessionNum}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {formatVnDate(slot.date)}
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {slotTime}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isCp1 && (
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                      Checkpoint 1
                                    </span>
                                  )}
                                  {isCp2 && (
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 whitespace-nowrap">
                                      Checkpoint 2
                                    </span>
                                  )}
                                  {isFinal && (
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                      SP Cuối Khóa
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3">
                                  <input
                                    type="text"
                                    value={slot.submissionDeadline || ""}
                                    onChange={(e) => handleSlotDeadlineChange(slot.index, e.target.value)}
                                    placeholder="Nhập hạn nộp bài..."
                                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                  />
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Bảng Danh Sách Học Viên Active (Theo yêu cầu: STT, Mã Học Viên, Họ Và Tên, Trạng Thái) */}
              {modalActiveTab === "students" && (
                <div className="space-y-3">
                  {(() => {
                    const activeStudents = (activeClass.students || []).filter(
                      (s: any) => s.activeInClass !== false
                    );

                    return (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Users className="w-4 h-4 text-rose-500" />
                              Danh Sách Học Viên Active ({activeStudents.length} học viên)
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              * Mã học viên được tự động sinh theo quy chuẩn: Tên + Chữ cái đầu Họ đệm
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openStudentReviewModal(activeClass)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-500/20 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto active:scale-95"
                            title="Kiểm tra đối chiếu học viên giữa LMS và Supabase"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Đối chiếu học viên với LMS</span>
                          </button>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin">
                          {activeStudents.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                              Lớp học này hiện chưa có học viên nào trong hệ thống.
                              {lmsChangesMap[activeClass.id]?.diffs?.some((d) => d.field === "students") && (
                                <div className="mt-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                  LMS đang có {lmsChangesMap[activeClass.id]?.diffs?.find((d) => d.field === "students")?.newValue}. Hãy nhấp &ldquo;Đồng bộ tất cả dữ liệu LMS&rdquo; bên dưới để nạp vào hệ thống.
                                </div>
                              )}
                            </div>
                          ) : (
                            <table className="w-full min-w-[460px] text-left border-collapse text-xs">
                              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-bold uppercase">
                                <tr>
                                  <th className="py-2.5 px-3 text-center w-14">STT</th>
                                  <th className="py-2.5 px-4 text-center w-40">Mã học viên</th>
                                  <th className="py-2.5 px-4">Họ và tên</th>
                                  <th className="py-2.5 px-4 text-center w-36">Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {activeStudents.map((st: any, idx: number) => {
                                  const stReview = viewModalStudentDiffMap[st.id];
                                  const hasDiffs = stReview && stReview.reviewStatus === "HAS_CHANGES" && stReview.diffs?.length > 0;

                                  return (
                                    <tr
                                      key={st.id || idx}
                                      className={`transition-colors ${
                                        hasDiffs
                                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                                          : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                                      }`}
                                    >
                                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                        {idx + 1}
                                      </td>
                                      <td className="py-2.5 px-4 text-center">
                                        <span className="inline-block px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                          {st.studentCode || `HV${String(idx + 1).padStart(2, "0")}`}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4">
                                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                                          {st.fullName || "Chưa có tên"}
                                        </div>
                                        {hasDiffs && (
                                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                              Có sự thay đổi về {stReview.diffs.map((d) => d.label).join(", ")}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                await handleSyncSingleStudent(stReview);
                                                try {
                                                  const res = await fetch(`/api/students?classId=${encodeURIComponent(activeClass.id)}`);
                                                  const data = await res.json();
                                                  if (data.success && Array.isArray(data.students)) {
                                                    setActiveClass((prev) => (prev && prev.id === activeClass.id ? { ...prev, students: data.students } : prev));
                                                  }
                                                  const reviewRes = await fetch(`/api/students?type=review&classId=${encodeURIComponent(activeClass.id)}`);
                                                  const reviewData = await reviewRes.json();
                                                  if (reviewData.success && Array.isArray(reviewData.reviews)) {
                                                    const m: Record<string, StudentReviewItem> = {};
                                                    for (const r of reviewData.reviews) m[r.id] = r;
                                                    setViewModalStudentDiffMap(m);
                                                  }
                                                } catch {}
                                              }}
                                              disabled={operatingStudentId === st.id}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                                              title="Cập nhật thông tin mới nhất từ LMS vào Supabase"
                                            >
                                              <RefreshCw className={`w-2.5 h-2.5 ${operatingStudentId === st.id ? "animate-spin text-emerald-600" : ""}`} />
                                              <span>Cập nhật</span>
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-4 text-center">
                                        {st.status === "COMPLETED" ? (
                                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                                            Hoàn thành
                                          </span>
                                        ) : st.status === "DROPPED" ? (
                                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                                            Đã rút lớp
                                          </span>
                                        ) : (
                                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                            Đang học
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {modalMode === "add" ? (
                  <>
                    <span className="text-xs text-slate-500">
                      * Dữ liệu chỉ lưu trên hệ thống SMH (Supabase), không ghi ngược lên LMS
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveClass(null)}
                        disabled={savingClass}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleConfirmAdd}
                        disabled={savingClass}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 cursor-pointer active:scale-95"
                      >
                        {savingClass ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>Thêm</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {lmsChangesMap[activeClass.id]?.hasChanges ? (
                        <button
                          type="button"
                          onClick={() => handleCheckSyncLms(activeClass)}
                          disabled={syncingClassId === activeClass.id}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                          title="Xem chi tiết từng mục thay đổi và chọn đồng bộ"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Chi tiết đổi ({lmsChangesMap[activeClass.id]?.diffCount})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCheckSyncLms(activeClass)}
                          disabled={syncingClassId === activeClass.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingClassId === activeClass.id ? "animate-spin text-rose-500" : ""}`} />
                          <span>Kiểm tra dữ liệu LMS</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteManagedClass(activeClass)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Gỡ lớp</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {/* NÚT ĐỒNG BỘ TẤT CẢ DỮ LIỆU LMS ĐẶT TẠI KHÚC CUỐI MODAL */}
                      {lmsChangesMap[activeClass.id]?.hasChanges && (
                        <button
                          type="button"
                          onClick={async () => {
                            const diffs = lmsChangesMap[activeClass.id]?.diffs || [];
                            setSyncingTargetClass(activeClass);
                            await handleConfirmSyncLms(diffs.map((d) => d.field));
                          }}
                          disabled={confirmingSync}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-md shadow-emerald-600/25 cursor-pointer active:scale-95 whitespace-nowrap animate-pulse"
                          title="Đồng bộ 100% toàn bộ thông tin thay đổi từ LMS vào hệ thống"
                        >
                          {confirmingSync ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span>Đồng bộ tất cả dữ liệu LMS</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveClass(null)}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDeadlineChanges}
                        disabled={savingClass}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 cursor-pointer active:scale-95 whitespace-nowrap"
                      >
                        {savingClass ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>Lưu thay đổi</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal So Sánh Thay Đổi LMS Side-by-Side (Cần xác nhận từ người dùng) */}
        {diffModalOpen && syncingTargetClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Phát Hiện Dữ Liệu LMS Đã Thay Đổi</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {currentDiffs.length} thay đổi
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Lớp: <span className="font-bold text-slate-800 dark:text-slate-200">{syncingTargetClass.name}</span> • {syncingTargetClass.centreName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDiffModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lời giải thích rõ ràng & Thanh chọn nhanh */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  Dưới đây là các thông tin đang có sự khác biệt giữa hệ thống SMH (dữ liệu cũ) và dữ liệu mới nhất từ LMS MindX:
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      currentDiffs.forEach((d) => (all[d.field] = true));
                      setSelectedDiffFields(all);
                    }}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDiffFields({})}
                    className="text-[11px] font-medium text-slate-500 hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Bảng So Sánh Kế Bên (Side-by-Side Table Chuẩn Responsive) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-84 overflow-y-auto scrollbar-thin">
                <table className="w-full min-w-[620px] text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            currentDiffs.length > 0 &&
                            currentDiffs.every((d) => selectedDiffFields[d.field])
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const next: Record<string, boolean> = {};
                            currentDiffs.forEach((d) => (next[d.field] = checked));
                            setSelectedDiffFields(next);
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          title="Chọn / Bỏ chọn tất cả"
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[150px]">Đang thay đổi gì</th>
                      <th className="py-2.5 px-3 min-w-[180px] text-rose-600 dark:text-rose-400">Dữ liệu cũ (Supabase)</th>
                      <th className="py-2.5 px-3 min-w-[180px] text-emerald-600 dark:text-emerald-400">Dữ liệu mới (LMS)</th>
                      <th className="py-2.5 px-3 min-w-[90px] text-center">Đồng bộ riêng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {currentDiffs.map((diff, i) => {
                      const isChecked = !!selectedDiffFields[diff.field];
                      return (
                        <tr
                          key={i}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors ${
                            isChecked ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedDiffFields((prev) => ({
                                  ...prev,
                                  [diff.field]: e.target.checked,
                                }));
                              }}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                            <div>{diff.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-normal">
                              ({diff.field})
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 font-mono text-xs">
                              <div className="text-[10px] uppercase font-bold text-rose-500/70 mb-0.5">Dữ liệu cũ</div>
                              <div>{diff.oldValue || "—"}</div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold">
                              <div className="text-[10px] uppercase font-bold text-emerald-500/70 mb-0.5">Mới từ LMS</div>
                              <div>{diff.newValue || "—"}</div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleConfirmSyncLms([diff.field])}
                              disabled={confirmingSync}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
                              title={`Chỉ đồng bộ riêng mục "${diff.label}"`}
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Cập nhật</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                * Việc đồng bộ dữ liệu từ LMS sẽ tự động bảo lưu toàn bộ các mốc hạn nộp bài mà bạn đã cấu hình trước đó.
              </div>

              {/* KHÚC CUỐI (Modal Footer): Đầy đủ các nút thao tác & Nút đồng bộ tất cả thuận tiện */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDiffModalOpen(false)}
                  disabled={confirmingSync}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Bỏ qua
                </button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Nút đồng bộ các mục đã chọn */}
                  {(() => {
                    const selectedCount = Object.keys(selectedDiffFields).filter(
                      (k) => selectedDiffFields[k]
                    ).length;

                    return (
                      <button
                        type="button"
                        onClick={() => handleConfirmSyncLms()}
                        disabled={confirmingSync || selectedCount === 0}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
                        title="Chỉ cập nhật các mục bạn đã tích chọn"
                      >
                        <Check className="w-4 h-4" />
                        <span>Đồng bộ mục đã chọn ({selectedCount})</span>
                      </button>
                    );
                  })()}

                  {/* Nút ĐỒNG BỘ TẤT CẢ DỮ LIỆU LMS (Thuận tiện đặt ở khúc cuối) */}
                  <button
                    type="button"
                    onClick={() => handleConfirmSyncLms(currentDiffs.map((d) => d.field))}
                    disabled={confirmingSync}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-md shadow-emerald-600/25 cursor-pointer active:scale-95 whitespace-nowrap"
                    title="Đồng bộ 100% toàn bộ thông tin thay đổi từ LMS vào hệ thống"
                  >
                    {confirmingSync ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>Đồng bộ tất cả dữ liệu LMS</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Danh Sách & Đối Chiếu Học Viên Lớp Học */}
        {studentReviewModalClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Danh Sách Học Viên Lớp Học</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        {studentReviews.length} học viên LMS
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Lớp: <span className="font-bold text-slate-800 dark:text-slate-200">{studentReviewModalClass.name}</span> • {studentReviewModalClass.courseName || "MindX"} • {studentReviewModalClass.centreName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openStudentReviewModal(studentReviewModalClass)}
                    disabled={loadingStudentReviews}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Tải lại đối chiếu từ LMS"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingStudentReviews ? "animate-spin text-rose-500" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentReviewModalClass(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Bộ lọc nhanh (Quick Filter Pills) */}
              <div className="flex items-center gap-2 flex-wrap text-xs shrink-0">
                <span className="text-slate-400 font-medium text-[11px]">Lọc theo tình trạng:</span>
                <button
                  type="button"
                  onClick={() => setStudentReviewFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    studentReviewFilter === "ALL"
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  Tất cả ({studentReviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentReviewFilter("NOT_IN_SUPABASE")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    studentReviewFilter === "NOT_IN_SUPABASE"
                      ? "bg-rose-600 text-white shadow-sm shadow-rose-600/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Chưa lưu trong Supabase ({studentReviewStats.notInSupabase})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudentReviewFilter("HAS_CHANGES")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    studentReviewFilter === "HAS_CHANGES"
                      ? "bg-amber-600 text-white shadow-sm shadow-amber-600/20"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Có thay đổi từ LMS ({studentReviewStats.hasChanges})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudentReviewFilter("UP_TO_DATE")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    studentReviewFilter === "UP_TO_DATE"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã đồng bộ ({studentReviewStats.upToDate})</span>
                </button>
              </div>

              {/* Bảng Danh Sách & Đối Chiếu Học Viên */}
              <div className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto overflow-y-auto scrollbar-thin min-h-[260px] max-h-[50vh]">
                {loadingStudentReviews ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                    <span className="text-xs font-medium">Đang tải danh sách học viên và đối chiếu với LMS...</span>
                  </div>
                ) : filteredStudentReviews.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    {studentReviews.length === 0
                      ? "Lớp học này hiện không có học viên active nào trên LMS."
                      : "Không có học viên nào khớp với bộ lọc đã chọn."}
                  </div>
                ) : (
                  <table className="w-full min-w-[680px] text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-bold uppercase">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12 whitespace-nowrap">STT</th>
                        <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">Mã học viên</th>
                        <th className="py-2.5 px-4 min-w-[160px]">Họ và tên (LMS)</th>
                        <th className="py-2.5 px-4 min-w-[220px]">Tình trạng trong Supabase</th>
                        <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredStudentReviews.map((item, idx) => {
                        const isOperating = operatingStudentId === item.id;
                        return (
                          <tr
                            key={item.id || idx}
                            className={`transition-colors ${
                              item.reviewStatus === "NOT_IN_SUPABASE"
                                ? "bg-rose-500/5 hover:bg-rose-500/10"
                                : item.reviewStatus === "HAS_CHANGES"
                                ? "bg-amber-500/5 hover:bg-amber-500/10"
                                : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs border ${
                                  item.supabaseStudent
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                }`}
                                title={item.supabaseStudent ? "Mã học viên trong Supabase" : "Mã dự kiến lưu"}
                              >
                                {item.studentCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {item.fullName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {item.lmsStudent.email || item.lmsStudent.phoneNumber || "LMS ID: " + item.id.slice(0, 8)}
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              {item.reviewStatus === "NOT_IN_SUPABASE" && (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                                    <AlertCircle className="w-3 h-3" />
                                    Chưa lưu trong Supabase
                                  </span>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Dữ liệu học viên mới từ LMS, chưa có trong hệ thống SMH.
                                  </p>
                                </div>
                              )}

                              {item.reviewStatus === "HAS_CHANGES" && (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                    <AlertTriangle className="w-3 h-3" />
                                    Có thay đổi từ LMS ({item.diffs.length})
                                  </span>
                                  <div className="space-y-0.5 text-[11px]">
                                    {item.diffs.map((d, dIdx) => (
                                      <div key={dIdx} className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-slate-600 dark:text-slate-300">{d.label}:</span>
                                        <span className="line-through text-rose-500 font-mono bg-rose-500/10 px-1 rounded">
                                          {d.oldValue || "—"}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-1 rounded">
                                          {d.newValue || "—"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {item.reviewStatus === "UP_TO_DATE" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Đã có trong hệ thống (Khớp LMS)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {item.reviewStatus === "NOT_IN_SUPABASE" && (
                                <button
                                  type="button"
                                  onClick={() => handleAddSingleStudent(item)}
                                  disabled={isOperating || operatingAllStudents}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-40 whitespace-nowrap"
                                  title="Lưu học viên này vào Supabase"
                                >
                                  {isOperating ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                  <span>Thêm</span>
                                </button>
                              )}

                              {item.reviewStatus === "HAS_CHANGES" && (
                                <button
                                  type="button"
                                  onClick={() => handleSyncSingleStudent(item)}
                                  disabled={isOperating || operatingAllStudents}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-40 whitespace-nowrap"
                                  title="Cập nhật thông tin mới từ LMS vào Supabase"
                                >
                                  {isOperating ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  )}
                                  <span>Cập nhật</span>
                                </button>
                              )}

                              {item.reviewStatus === "UP_TO_DATE" && (
                                <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Đã lưu</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer Thao Tác Toàn Bộ */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <span className="text-[11px] text-slate-500">
                  * Dữ liệu học viên lưu trữ độc lập trên Supabase SMH, không ghi ngược lên LMS
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  {/* Nút thêm tất cả học viên mới nếu có */}
                  {studentReviewStats.notInSupabase > 0 && (
                    <button
                      type="button"
                      onClick={handleAddAllNewStudents}
                      disabled={operatingAllStudents || loadingStudentReviews}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-40"
                      title="Lưu toàn bộ học viên chưa có vào Supabase"
                    >
                      {operatingAllStudents ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>Thêm tất cả học viên mới ({studentReviewStats.notInSupabase})</span>
                    </button>
                  )}

                  {/* Nút cập nhật tất cả học viên thay đổi nếu có */}
                  {studentReviewStats.hasChanges > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncAllChangedStudents}
                      disabled={operatingAllStudents || loadingStudentReviews}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-40"
                      title="Cập nhật toàn bộ học viên có thay đổi từ LMS"
                    >
                      {operatingAllStudents ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Cập nhật tất cả học viên thay đổi ({studentReviewStats.hasChanges})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setStudentReviewModalClass(null)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    Đóng / Hoàn tất
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Xác nhận Gỡ Lớp Học */}
        <ConfirmModal
          isOpen={!!deleteConfirmClass}
          onClose={() => setDeleteConfirmClass(null)}
          onConfirm={confirmDeleteManagedClass}
          title="Gỡ lớp khỏi danh sách quản lý"
          message={
            deleteConfirmClass ? (
              <span>
                Bạn có chắc chắn muốn gỡ lớp{" "}
                <strong className="text-slate-900 dark:text-white">
                  {deleteConfirmClass.name}
                </strong>{" "}
                khỏi danh sách quản lý không? Toàn bộ học viên thuộc lớp này cũng sẽ được tự động dọn dẹp khỏi danh sách quản lý học viên.
              </span>
            ) : ""
          }
          type="danger"
          confirmText="Gỡ lớp học"
          cancelText="Hủy bỏ"
          isLoading={isDeletingClass}
        />
      </div>
    </AppLayout>
  );
}
