// Type definitions and helper functions for Managed Students

export interface ManagedStudent {
  id: string; // ID học viên LMS
  studentCode: string; // Mã học viên tự sinh (ví dụ: VINHVQ, NHATNM)
  fullName: string;
  status: string; // "ACTIVE" | "ONHOLD" | "DROPOUT" | v.v.
  classId: string;
  className: string;
  courseName?: string | null;
  centreId: string;
  centreName: string;
  teacherName?: string | null; // Tên giáo viên phụ trách lớp hiện tại
  teacherCodes?: string[]; // Danh sách mã giáo viên phụ trách
  lastTeacherName?: string | null; // Giáo viên phụ trách cuối cùng (dùng khi lớp hiện tại không xác định)
  lastTeacherCodes?: string[]; // Mã giáo viên phụ trách cuối cùng
  lastClassId?: string | null; // Lớp học trước đó / cuối cùng
  lastClassName?: string | null; // Tên lớp học trước đó / cuối cùng
  email?: string | null;
  phoneNumber?: string | null;
  activeInClass?: boolean;
  submissionQuotaMb?: number; // Định mức dữ liệu nộp (MB), mặc định 50 MB, tối đa 100 MB
  addedAt?: string;
  updatedAt?: string;
  addedBy?: string;
}

/**
 * Chuẩn hóa tên giáo viên để so sánh không phân biệt tiền tố (TF, GV, TA) và hậu tố (LEC, TA)
 */
export function normalizeTeacherName(name?: string | null): string {
  if (!name) return "";
  return name
    .replace(/\s*\([^)]*\)/g, "") // Bỏ (LEC), (TA), v.v.
    .replace(/^(tf|gv|ta|thầy|cô)\s+/i, "") // Bỏ tiền tố TF, GV, TA, Thầy, Cô
    .trim()
    .toLowerCase();
}

export interface StudentDiffItem {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface StudentReviewItem {
  id: string; // LMS Student ID
  studentCode: string;
  fullName: string;
  status: string; // LMS student status
  reviewStatus: "NOT_IN_SUPABASE" | "HAS_CHANGES" | "UP_TO_DATE";
  diffs: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
  supabaseStudent?: ManagedStudent | null;
  lmsStudent: {
    id: string;
    fullName: string;
    status: string;
    email?: string | null;
    phoneNumber?: string | null;
  };
}

export interface ClassAndStudentsDiff {
  classDiffs: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
  newStudents: ManagedStudent[];
  removedStudents: ManagedStudent[];
  updatedStudents: Array<{
    student: ManagedStudent;
    diffs: StudentDiffItem[];
  }>;
}

/**
 * Loại bỏ dấu tiếng Việt để chuẩn hóa chuỗi mã
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Thuật toán sinh mã học viên chuẩn MindX Hub:
 * Quy tắc: <Tên học viên> + <Chữ cái đầu của Họ và Tên đệm còn lại> + <Số thứ tự nếu trùng mã đã có>
 * Ví dụ:
 * - "Vũ Quang Vinh" -> Tên: Vinh (VINH), Họ đệm: Vũ Quang (VQ) -> "VINHVQ"
 * - "Nguyễn Minh Nhật" -> Tên: Nhật (NHAT), Họ đệm: Nguyễn Minh (NM) -> "NHATNM"
 * - Nếu "VINHVQ" đã có trong hệ thống -> "VINHVQ1", "VINHVQ2", ...
 */
export function generateStudentCode(fullName: string, existingCodes: string[] = []): string {
  const cleanName = (fullName || "").trim().replace(/\s+/g, " ");
  if (!cleanName) return "HV";

  const parts = cleanName.split(" ");
  if (parts.length === 1) {
    const base = removeVietnameseTones(parts[0]).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return resolveCodeConflict(base || "HV", existingCodes);
  }

  // Tên là từ cuối cùng
  const firstName = parts[parts.length - 1];
  // Họ và tên đệm là các từ còn lại
  const otherParts = parts.slice(0, parts.length - 1);

  const baseName = removeVietnameseTones(firstName).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const initials = otherParts
    .map((p) => removeVietnameseTones(p[0] || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .join("");

  const baseCode = `${baseName}${initials}` || "HV";
  return resolveCodeConflict(baseCode, existingCodes);
}

function resolveCodeConflict(baseCode: string, existingCodes: string[]): string {
  const upperSet = new Set(existingCodes.map((c) => (c || "").trim().toUpperCase()));

  if (!upperSet.has(baseCode)) {
    return baseCode;
  }

  let suffix = 1;
  while (upperSet.has(`${baseCode}${suffix}`)) {
    suffix++;
  }
  return `${baseCode}${suffix}`;
}
