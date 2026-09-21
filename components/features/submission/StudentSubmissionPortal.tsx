"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileUp,
  Link2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  User,
  GraduationCap,
  Sparkles,
  KeyRound,
  FileText,
  Trash2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Info,
  Layers,
  Send,
  Lock,
} from "lucide-react";
import { formatVnDateTime, normalizeDeadlineFormat } from "@/lib/types/managed-class";

interface Teacher {
  id: string;
  fullName: string;
  lmsCode: string;
  email: string;
}

interface ClassItem {
  id: string;
  name: string;
  courseName: string;
  centreName: string;
  numberOfSessions: number;
}

interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  submissionQuotaMb: number;
}

interface Phase {
  id: string;
  label: string;
  targetSession: number;
  sessionNumbers?: number[];
}

interface SessionSlot {
  sessionNumber: number;
  date: string;
  deadline: string | null;
  lateDeadline: string | null;
  canSubmit: boolean;
  isLate: boolean;
  isExpired: boolean;
  statusMessage: string;
  badgeColor?: "green" | "yellow" | "red" | "blue";
  badgeText?: string;
  deadlineTimes?: {
    deadlineDate: string | null;
    lateDeadlineDate: string | null;
    slotStartTime: string | null;
    slotEndTime: string | null;
  };
}

export default function StudentSubmissionPortal() {
  // 1. Dữ liệu từ API
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [sessions, setSessions] = useState<SessionSlot[]>([]);

  // 2. Trạng thái tải dữ liệu
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingClassData, setLoadingClassData] = useState(false);

  // 3. Form lựa chọn theo luồng 5 bước tuần tự
  const [accessCode, setAccessCode] = useState("");
  const [accessCodeApplied, setAccessCodeApplied] = useState(false);

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedSessionNum, setSelectedSessionNum] = useState<number | "">("");

  // 4. Hình thức nộp: File hoặc Link
  const [submissionType, setSubmissionType] = useState<"files" | "link">("files");

  // State cho tệp tin (File Dropzone)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State cho đường link
  const [linkUrl, setLinkUrl] = useState("");
  const [checkingLink, setCheckingLink] = useState(false);
  const [linkVerification, setLinkVerification] = useState<{
    checked: boolean;
    accessible: boolean;
    message: string;
    service?: string;
  } | null>(null);

  // Ghi chú học viên gửi giáo viên
  const [studentNote, setStudentNote] = useState("");

  // Trạng thái nộp bài
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  // Feedback lỗi chung
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tải danh sách giáo viên Part-time đã duyệt và liên kết Drive khi khởi tạo
  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoadingTeachers(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/submission/portal-data");
      const data = await res.json();
      if (data.success && Array.isArray(data.teachers)) {
        setTeachers(data.teachers);
      } else {
        setErrorMessage(data.error || "Không thể tải danh sách giáo viên.");
      }
    } catch (err: any) {
      setErrorMessage("Lỗi kết nối khi tải danh sách giáo viên.");
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Bước 1: Khi chọn Giáo viên -> Tải danh sách lớp RUNNING của giáo viên đó
  const handleSelectTeacher = async (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    // Reset toàn bộ các bước tiếp theo để đảm bảo khóa trường
    setSelectedClassId("");
    setSelectedStudentId("");
    setSelectedPhaseId("");
    setSelectedSessionNum("");
    setClasses([]);
    setStudents([]);
    setPhases([]);
    setSessions([]);
    setSelectedFiles([]);
    setLinkUrl("");
    setLinkVerification(null);
    setSubmitResult(null);

    if (!teacherId) return;

    setLoadingClasses(true);
    try {
      const res = await fetch(`/api/submission/portal-data?teacherId=${encodeURIComponent(teacherId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.classes)) {
        setClasses(data.classes);
      } else {
        setErrorMessage(data.error || "Không thể tải danh sách lớp học.");
      }
    } catch {
      setErrorMessage("Lỗi kết nối khi tải danh sách lớp học.");
    } finally {
      setLoadingClasses(false);
    }
  };

  // Bước 2: Khi chọn Lớp học -> Tải danh sách học viên ACTIVE và các buổi học của lớp
  const handleSelectClass = async (classId: string) => {
    setSelectedClassId(classId);
    // Reset các bước sau
    setSelectedStudentId("");
    setSelectedPhaseId("");
    setSelectedSessionNum("");
    setStudents([]);
    setPhases([]);
    setSessions([]);
    setSelectedFiles([]);
    setLinkUrl("");
    setLinkVerification(null);
    setSubmitResult(null);

    if (!classId) return;

    setLoadingClassData(true);
    try {
      const res = await fetch(`/api/submission/portal-data?classId=${encodeURIComponent(classId)}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
        setPhases(data.phases || []);
        setSessions(data.sessions || []);
      } else {
        setErrorMessage(data.error || "Không thể tải thông tin chi tiết của lớp học.");
      }
    } catch {
      setErrorMessage("Lỗi kết nối khi tải thông tin lớp học.");
    } finally {
      setLoadingClassData(false);
    }
  };

  // Bước 3: Khi chọn Học viên
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSelectedFiles([]);
    setLinkVerification(null);
    setSubmitResult(null);
  };

  // Bước 4: Khi chọn Giai đoạn -> Tự động gợi ý Buổi học trong giai đoạn đó
  const handleSelectPhase = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    const targetPhase = phases.find((p) => p.id === phaseId);
    if (targetPhase && Array.isArray(targetPhase.sessionNumbers) && targetPhase.sessionNumbers.length > 0) {
      if (targetPhase.targetSession && targetPhase.sessionNumbers.includes(targetPhase.targetSession)) {
        setSelectedSessionNum(targetPhase.targetSession);
      } else {
        setSelectedSessionNum(targetPhase.sessionNumbers[0]);
      }
    } else if (targetPhase?.targetSession) {
      setSelectedSessionNum(targetPhase.targetSession);
    } else {
      setSelectedSessionNum("");
    }
  };

  // Lấy học viên đang chọn và hạn mức nộp (MB)
  const currentStudent = students.find((s) => s.id === selectedStudentId);
  const studentQuotaMb = currentStudent?.submissionQuotaMb || 50;

  // Lấy giai đoạn đang chọn và danh sách buổi học được phép chọn theo giai đoạn
  const selectedPhase = phases.find((p) => p.id === selectedPhaseId);
  const phaseSessions =
    selectedPhase && Array.isArray(selectedPhase.sessionNumbers) && selectedPhase.sessionNumbers.length > 0
      ? sessions.filter((s) => selectedPhase.sessionNumbers!.includes(s.sessionNumber))
      : [];

  // Lấy thông tin buổi học đang chọn và trạng thái hạn nộp
  const currentSessionSlot = sessions.find((s) => s.sessionNumber === selectedSessionNum);

  // Xử lý nạp File (Dropzone)
  const handleFilesChosen = (filesList: FileList | null) => {
    if (!filesList) return;
    const newFiles = Array.from(filesList);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Tính tổng dung lượng tệp tin đang chọn
  const totalFileSizeMB = selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024);
  const isFilesOverQuota = totalFileSizeMB > studentQuotaMb;

  // Xử lý Kiểm tra đường link
  const handleCheckLink = async () => {
    if (!linkUrl.trim()) return;
    setCheckingLink(true);
    setLinkVerification(null);

    try {
      const res = await fetch("/api/submission/check-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl }),
      });
      const data = await res.json();
      setLinkVerification({
        checked: true,
        accessible: data.accessible === true,
        message: data.message || (data.accessible ? "Link hợp lệ" : "Link không khả dụng"),
        service: data.service,
      });
    } catch {
      setLinkVerification({
        checked: true,
        accessible: false,
        message: "Lỗi kết nối kiểm tra đường link.",
      });
    } finally {
      setCheckingLink(false);
    }
  };

  // Ràng buộc nút "Nộp bài":
  // Phải hoàn tất chọn đủ: Giáo viên, Lớp, Học viên, Giai đoạn, Buổi học
  // Buổi học phải còn hạn nộp (canSubmit === true)
  // Nếu là file: Có ít nhất 1 file và tổng dung lượng <= định mức
  // Nếu là link: Đường link đã được kiểm tra và accessible === true
  const isSelectionComplete =
    !!selectedTeacherId &&
    !!selectedClassId &&
    !!selectedStudentId &&
    !!selectedPhaseId &&
    selectedSessionNum !== "" &&
    selectedSessionNum !== undefined;

  const isDeadlineValid = Boolean(currentSessionSlot && currentSessionSlot.canSubmit);
  const isSubmissionLocked = Boolean(currentSessionSlot && !currentSessionSlot.canSubmit);

  const isSubmissionContentValid =
    submissionType === "files"
      ? selectedFiles.length > 0 && !isFilesOverQuota
      : !!linkVerification && linkVerification.accessible === true;

  const canSubmitNow = isSelectionComplete && isDeadlineValid && isSubmissionContentValid && !isSubmitting;

  // Xử lý Nộp Bài
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitNow) return;

    setIsSubmitting(true);
    setSubmitResult(null);
    setErrorMessage(null);

    try {
      const payload = {
        teacherId: selectedTeacherId,
        classId: selectedClassId,
        studentId: selectedStudentId,
        phaseId: selectedPhaseId,
        sessionNumber: selectedSessionNum,
        accessCode: accessCode.trim() || null,
        submissionType,
        linkUrl: submissionType === "link" ? linkUrl.trim() : null,
        files:
          submissionType === "files"
            ? selectedFiles.map((f) => ({
                name: f.name,
                size: f.size,
                type: f.type,
              }))
            : [],
        note: studentNote.trim(),
      };

      const res = await fetch("/api/submission/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitResult({
          success: true,
          message: data.message || "Chúc mừng! Bạn đã nộp bài tập thành công.",
          data: data.submission,
        });
        // Reset nội dung nộp bài
        setSelectedFiles([]);
        setLinkUrl("");
        setLinkVerification(null);
        setStudentNote("");
      } else {
        setSubmitResult({
          success: false,
          message: data.error || "Không thể nộp bài, vui lòng thử lại.",
        });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: "Lỗi kết nối máy chủ khi nộp bài.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Banner Header Cổng Nộp Bài */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 text-white p-6 sm:p-8 shadow-xl shadow-rose-600/20">
        <div className="absolute top-0 right-0 -translate-y-6 translate-x-6 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cổng Nộp Bài Học Viên Chính Thức</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Nộp Bài Tập & Dự Án MindX
            </h2>
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
              Nộp sản phẩm giai đoạn và dự án cuối khóa trực tuyến.
            </p>
          </div>

          <div className="shrink-0 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-center">
            <div className="text-[11px] font-semibold text-white/80">Hạn mức tệp tin</div>
            <div className="text-xl font-black font-mono mt-0.5">
              {currentStudent ? `${studentQuotaMb} MB` : "50 - 100 MB"}
            </div>
            <div className="text-[10px] text-white/70 mt-0.5">Cấu hình theo từng học viên</div>
          </div>
        </div>
      </div>

      {/* Thông báo kết quả nộp bài thành công */}
      {submitResult && (
        <div
          className={`p-5 rounded-3xl border animate-fade-in ${
            submitResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-start gap-3">
            {submitResult.success ? (
              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="font-bold text-sm sm:text-base">
                {submitResult.success ? "Nộp bài thành công!" : "Chưa thể hoàn tất nộp bài"}
              </h4>
              <p className="text-xs leading-relaxed opacity-90">{submitResult.message}</p>
              {submitResult.data && (
                <div className="pt-2 text-[11px] font-mono opacity-80">
                  Mã bài nộp: {submitResult.data.id} • Thời gian: {formatVnDateTime(submitResult.data.submittedAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error alert chung */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Ô Nhập Mã Truy Cập (Không bắt buộc - Có nút Bấm truy cập kế bên) */}
      <div className="bg-white dark:bg-[#0B0F17] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-rose-500" />
              <span>Mã Truy Cập Nhanh (Không bắt buộc)</span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Nếu bạn được giáo viên cung cấp mã nộp bài riêng, hãy nhập vào đây và bấm Truy cập.
            </p>
          </div>

          <div className="flex items-center gap-2 max-w-sm w-full sm:w-auto">
            <input
              type="text"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setAccessCodeApplied(false);
              }}
              placeholder="Nhập mã truy cập"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="button"
              onClick={() => {
                if (accessCode.trim()) {
                  setAccessCodeApplied(true);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
            >
              Truy cập
            </button>
          </div>
        </div>

        {accessCodeApplied && (
          <div className="mt-2.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Đã ghi nhận mã truy cập "{accessCode.trim()}". Tiếp tục chọn thông tin nộp bài bên dưới.</span>
          </div>
        )}
      </div>

      {/* FORM LỰA CHỌN 5 BƯỚC TUẦN TỰ (Sequential Locked Flow) */}
      <div className="bg-white dark:bg-[#0B0F17] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800/80 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-rose-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Thông Tin Xác Nhận Nộp Bài (5 Bước Tuần Tự)
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
            Khóa tự động các bước tiếp theo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* BƯỚC 1: CHỌN GIÁO VIÊN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">1</span>
                <span>Giáo Viên *</span>
              </span>
              {selectedTeacherId && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã chọn
                </span>
              )}
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => handleSelectTeacher(e.target.value)}
              disabled={loadingTeachers}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer disabled:opacity-50 transition-all"
            >
              <option value="">-- Chọn giáo viên --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* BƯỚC 2: CHỌN LỚP HỌC (Bị khóa nếu chưa chọn Giáo viên) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center ${
                    selectedTeacherId ? "bg-rose-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  2
                </span>
                <span>Lớp Học *</span>
              </span>
              {!selectedTeacherId && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Khóa
                </span>
              )}
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleSelectClass(e.target.value)}
              disabled={!selectedTeacherId || loadingClasses}
              className={`w-full px-4 py-3 rounded-2xl border text-xs font-semibold outline-none transition-all ${
                !selectedTeacherId
                  ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 text-slate-400 cursor-not-allowed"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 cursor-pointer"
              }`}
            >
              <option value="">-- Chọn lớp học --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.courseName ? ` • ${c.courseName}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* BƯỚC 3: CHỌN HỌC VIÊN (Bị khóa nếu chưa chọn Lớp) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center ${
                    selectedClassId ? "bg-rose-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  3
                </span>
                <span>Học Viên *</span>
              </span>
              {selectedStudentId && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã chọn
                </span>
              )}
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => handleSelectStudent(e.target.value)}
              disabled={!selectedClassId || loadingClassData}
              className={`w-full px-4 py-3 rounded-2xl border text-xs font-semibold outline-none transition-all ${
                !selectedClassId
                  ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 text-slate-400 cursor-not-allowed"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 cursor-pointer"
              }`}
            >
              <option value="">-- Chọn học viên --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* BƯỚC 4: CHỌN GIAI ĐOẠN (Bị khóa nếu chưa chọn Học viên) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center ${
                    selectedStudentId ? "bg-rose-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  4
                </span>
                <span>Giai Đoạn *</span>
              </span>
              {selectedPhaseId ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã chọn
                </span>
              ) : !selectedStudentId ? (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Khóa
                </span>
              ) : null}
            </label>
            <select
              value={selectedPhaseId}
              onChange={(e) => handleSelectPhase(e.target.value)}
              disabled={!selectedStudentId}
              className={`w-full px-4 py-3 rounded-2xl border text-xs font-semibold outline-none transition-all ${
                !selectedStudentId
                  ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 text-slate-400 cursor-not-allowed"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 cursor-pointer"
              }`}
            >
              <option value="">-- Chọn giai đoạn --</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* BƯỚC 5: CHỌN BUỔI HỌC (Chỉ cho phép các buổi học thuộc giai đoạn đã chọn) */}
          <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center ${
                    selectedPhaseId ? "bg-rose-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  5
                </span>
                <span>Buổi Học (Thuộc giai đoạn đã chọn) *</span>
              </span>
              {selectedSessionNum !== "" ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Buổi {selectedSessionNum}
                </span>
              ) : !selectedPhaseId ? (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Khóa (Chọn giai đoạn trước)
                </span>
              ) : null}
            </label>

            {!selectedPhaseId ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                Vui lòng chọn Giai đoạn ở Bước 4 để hiển thị danh sách các buổi học cho phép.
              </div>
            ) : phaseSessions.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                Không có buổi học nào được cấu hình trong giai đoạn này.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 scrollbar-thin">
                {phaseSessions.map((slot) => {
                  const isSelected = selectedSessionNum === slot.sessionNumber;
                  return (
                    <button
                      type="button"
                      key={slot.sessionNumber}
                      onClick={() => setSelectedSessionNum(slot.sessionNumber)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-rose-500/10 border-rose-500 dark:border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">Buổi {slot.sessionNumber}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                            slot.badgeColor === "red"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : slot.badgeColor === "yellow"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : slot.badgeColor === "blue"
                              ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {slot.badgeText || (slot.badgeColor === "red" ? "Hết hạn" : slot.badgeColor === "yellow" ? "Nộp muộn" : slot.badgeColor === "blue" ? "Chưa mở" : "Còn hạn")}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {slot.deadline ? (
                          <span>Hạn: <strong className="text-slate-800 dark:text-slate-200 font-mono">{normalizeDeadlineFormat(slot.deadline)}</strong></span>
                        ) : (
                          <span>Chưa đặt hạn nộp</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PHẦN HẠN MỨC NỘP VÀ TRẠNG THÁI HẠN NỘP BÀI (Đặt trước phần lựa chọn hình thức nộp bài, sau phần chọn buổi học) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Hạn mức nộp bài của học viên */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Hạn Mức Nộp Bài
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="font-mono">{studentQuotaMb} MB</span>
                    {currentStudent && (
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        • {currentStudent.fullName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Huy hiệu (Badge) Trạng thái hạn nộp bài */}
              <div className="flex items-center">
                {!currentSessionSlot ? (
                  <div className="px-3.5 py-1.5 rounded-2xl bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    Chưa chọn buổi học
                  </div>
                ) : currentSessionSlot.badgeColor === "green" ? (
                  <div className="px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-xs font-bold whitespace-nowrap shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Đang Trong Hạn Nộp</span>
                  </div>
                ) : currentSessionSlot.badgeColor === "yellow" ? (
                  <div className="px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-2 text-xs font-bold whitespace-nowrap shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Hết Hạn Chính Thức - Cho Phép Nộp Muộn</span>
                  </div>
                ) : currentSessionSlot.badgeColor === "blue" ? (
                  <div className="px-4 py-2 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 flex items-center gap-2 text-xs font-bold whitespace-nowrap shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span>Chưa Mở / Sắp Mở</span>
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center gap-2 text-xs font-bold whitespace-nowrap shadow-sm">
                    <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Hết Hạn Nộp (Khóa Cổng Nộp Bài)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chi tiết hạn nộp & thông điệp */}
            {currentSessionSlot && (
              <div
                className={`p-3 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border transition-all ${
                  currentSessionSlot.badgeColor === "red"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
                    : currentSessionSlot.badgeColor === "yellow"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                    : currentSessionSlot.badgeColor === "blue"
                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Buổi {currentSessionSlot.sessionNumber}:</strong> {currentSessionSlot.statusMessage}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono font-bold">
                  {currentSessionSlot.deadline && (
                    <span>Hạn chính thức: {normalizeDeadlineFormat(currentSessionSlot.deadline)}</span>
                  )}
                  {currentSessionSlot.lateDeadline && currentSessionSlot.badgeColor === "yellow" && (
                    <span className="text-amber-700 dark:text-amber-300">
                      • Hạn nộp muộn: {normalizeDeadlineFormat(currentSessionSlot.lateDeadline)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PHƯƠNG THỨC NỘP BÀI: KÉO THẢ TỆP TIN HOẶC NHẬP LINK */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Lựa Chọn Hình Thức Nộp Bài
            </h4>
            <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSubmissionType("files")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  submissionType === "files"
                    ? "bg-white dark:bg-[#0B0F17] text-rose-600 dark:text-rose-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Kéo thả tệp tin</span>
              </button>
              <button
                type="button"
                onClick={() => setSubmissionType("link")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  submissionType === "link"
                    ? "bg-white dark:bg-[#0B0F17] text-rose-600 dark:text-rose-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Nộp bằng đường link</span>
              </button>
            </div>
          </div>

          {/* CẢNH BÁO KHÓA CỔNG NỘP BÀI NẾU HẾT HẠN HOẶC CHƯA MỞ */}
          {isSubmissionLocked && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <span>Cổng nộp bài đang bị khóa cho buổi học này</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 font-black">
                    LOCKED
                  </span>
                </h5>
                <p className="text-xs leading-relaxed text-rose-600/90 dark:text-rose-400/90">
                  {currentSessionSlot?.statusMessage || "Buổi học này đã kết thúc thời gian nộp bài hoặc chưa đến thời gian mở nộp. Toàn bộ tính năng tải lên tệp tin và gửi liên kết đều bị vô hiệu hóa."}
                </p>
              </div>
            </div>
          )}

          {/* HÌNH THỨC 1: KÉO THẢ FILE */}
          {submissionType === "files" && (
            <div className={`space-y-3 ${isSubmissionLocked ? "opacity-50 pointer-events-none" : ""}`}>
              <div
                onDragOver={(e) => !isSubmissionLocked && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!isSubmissionLocked) handleFilesChosen(e.dataTransfer.files);
                }}
                onClick={() => {
                  if (!isSubmissionLocked) fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
                  isSubmissionLocked
                    ? "border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/20 cursor-not-allowed"
                    : isFilesOverQuota
                    ? "border-rose-500/60 bg-rose-500/5 hover:bg-rose-500/10 cursor-pointer"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 hover:border-rose-400 cursor-pointer"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  disabled={isSubmissionLocked}
                  onChange={(e) => handleFilesChosen(e.target.files)}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-500/20">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Kéo thả tệp tin bài làm vào đây, hoặc <span className="text-rose-500 underline">chọn từ thiết bị</span>
                </h5>
                <p className="text-xs text-slate-400 mt-1">
                  Hỗ trợ các tệp tin bài tập, slide, mã nguồn ZIP, PDF, hình ảnh, v.v.
                </p>

                {/* Thanh theo dõi định mức dung lượng */}
                <div className="mt-4 max-w-sm mx-auto p-3 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Dung lượng đã chọn:</span>
                    <span
                      className={`font-mono font-bold ${
                        isFilesOverQuota ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {totalFileSizeMB.toFixed(2)} MB / {studentQuotaMb} MB
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isFilesOverQuota ? "bg-rose-500 w-full" : "bg-gradient-to-r from-emerald-500 to-rose-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (totalFileSizeMB / studentQuotaMb) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {isFilesOverQuota && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Tổng dung lượng ({totalFileSizeMB.toFixed(1)} MB) đã vượt quá định mức cho phép ({studentQuotaMb} MB). Vui lòng nén file hoặc gỡ bớt tệp tin.
                  </span>
                </div>
              )}

              {/* Danh sách file đã chọn */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Danh sách tệp tin ({selectedFiles.length}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HÌNH THỨC 2: NHẬP ĐƯỜNG LINK */}
          {submissionType === "link" && (
            <div className={`space-y-3 ${isSubmissionLocked ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Đường Dẫn Bài Làm (Canva, Google Drive, Figma, GitHub, Scratch, v.v.)
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={linkUrl}
                      disabled={isSubmissionLocked}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        setLinkVerification(null);
                      }}
                      placeholder="Nhập đường liên kết"
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckLink}
                    disabled={checkingLink || !linkUrl.trim() || isSubmissionLocked}
                    className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-sm shrink-0 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {checkingLink ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Kiểm tra quyền truy cập</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Hệ thống tự động kiểm tra xem link đã được mở quyền xem công khai hay chưa. Bạn phải kiểm tra thành công trước khi có thể nộp bài.
                </p>

                {/* Kết quả xác minh link */}
                {linkVerification && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                      linkVerification.accessible
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    {linkVerification.accessible ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-2">
                        <span>{linkVerification.accessible ? "Đã mở quyền công khai" : "Chưa mở quyền công khai"}</span>
                        {linkVerification.service && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-black/30 border border-current font-bold">
                            {linkVerification.service}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{linkVerification.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ô GHI CHÚ HỌC VIÊN GỬI GIÁO VIÊN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-rose-500" />
              <span>Ghi Chú Gửi Giáo Viên (Lời nhắn, lưu ý về bài nộp)</span>
            </label>
            <textarea
              rows={3}
              value={studentNote}
              disabled={isSubmissionLocked}
              onChange={(e) => setStudentNote(e.target.value)}
              placeholder="Nhập ghi chú"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* NÚT NỘP BÀI THÔNG MINH (Chỉ sáng lên khi đủ điều kiện) */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {!isSelectionComplete ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Vui lòng chọn đầy đủ 5 bước thông tin trước khi nộp bài.
                </span>
              ) : !isDeadlineValid ? (
                <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {currentSessionSlot?.badgeColor === "blue"
                    ? "Buổi học này chưa đến thời gian mở nộp bài."
                    : "Buổi học này đã quá hạn nộp bài (cổng nộp đã đóng)."}
                </span>
              ) : !isSubmissionContentValid ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  {submissionType === "files"
                    ? "Vui lòng chọn tệp tin bài làm hợp lệ (không vượt quá định mức dung lượng)."
                    : "Vui lòng nhập link và bấm kiểm tra quyền truy cập thành công."}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Tất cả thông tin đã hợp lệ. Bạn có thể nộp bài ngay!
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmitWork}
              disabled={!canSubmitNow}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-xl ${
                canSubmitNow
                  ? "bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 hover:scale-105 active:scale-95 cursor-pointer"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-none cursor-not-allowed opacity-60"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Đang tải bài nộp lên...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Nộp Bài Ngay</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
