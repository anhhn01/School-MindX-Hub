import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { ManagedStudent, StudentReviewItem, generateStudentCode } from "@/lib/types/managed-student";

export type { ManagedStudent, StudentReviewItem };
export { generateStudentCode };

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "managed_students_store.json");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cache in-memory
let memoryStore: Record<string, ManagedStudent> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2000;

function readLocalFile(): Record<string, ManagedStudent> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.warn("Lỗi đọc file managed_students_store.json:", err);
  }
  return {};
}

function writeLocalFile(data: Record<string, ManagedStudent>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Lỗi ghi file managed_students_store.json:", err);
  }
}

const MANAGED_STUDENTS_FALLBACK_LMS_CODE = "__managed_students__";

/**
 * Đọc toàn bộ danh sách học viên quản lý từ Supabase
 * Ưu tiên:
 * 1. Bảng `managed_students` thực trên Supabase
 * 2. Bảng `system_settings` (key = 'managed_students')
 * 3. Bản ghi fallback trong bảng `users`
 * 4. File local `data/managed_students_store.json`
 */
export async function getAllManagedStudentsMap(): Promise<Record<string, ManagedStudent>> {
  const now = Date.now();
  if (memoryStore && now - lastFetchTime < CACHE_TTL_MS) {
    return memoryStore;
  }

  // 1. Thử đọc trực tiếp từ bảng managed_students trong Supabase
  try {
    const { data: rows, error } = await supabase
      .from("managed_students")
      .select("*");

    if (!error && Array.isArray(rows)) {
      const map: Record<string, ManagedStudent> = {};
      rows.forEach((r: any) => {
        map[r.id] = {
          id: r.id,
          studentCode: r.student_code,
          fullName: r.full_name,
          status: r.status,
          classId: r.class_id,
          className: r.class_name,
          courseName: r.course_name,
          centreId: r.centre_id,
          centreName: r.centre_name,
          email: r.email,
          phoneNumber: r.phone_number,
          addedAt: r.added_at,
          updatedAt: r.updated_at,
          addedBy: r.added_by,
        };
      });
      memoryStore = map;
      lastFetchTime = now;
      writeLocalFile(map);
      return map;
    }
  } catch (err) {
    // Bảng chưa tạo
  }

  // 2. Thử đọc từ bảng system_settings
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "managed_students")
      .maybeSingle();

    if (!error && data && data.value && typeof data.value === "object") {
      memoryStore = data.value as Record<string, ManagedStudent>;
      lastFetchTime = now;
      writeLocalFile(memoryStore);
      return memoryStore;
    }
  } catch (err) {
    // Không có system_settings
  }

  // 3. Fallback file local
  const localData = readLocalFile();
  memoryStore = localData;
  lastFetchTime = now;
  return localData;
}

/**
 * Lưu danh sách học viên vào Supabase
 */
export async function saveAllManagedStudentsMap(
  data: Record<string, ManagedStudent>,
  updatedBy: string = "system"
): Promise<boolean> {
  memoryStore = data;
  lastFetchTime = Date.now();
  writeLocalFile(data);

  let savedDirectly = false;

  // 1. Thử lưu vào bảng `managed_students` thực trên Supabase
  try {
    const records = Object.values(data).map((s) => ({
      id: s.id,
      student_code: s.studentCode,
      full_name: s.fullName,
      status: s.status || "ACTIVE",
      class_id: s.classId,
      class_name: s.className,
      course_name: s.courseName || null,
      centre_id: s.centreId,
      centre_name: s.centreName,
      email: s.email || null,
      phone_number: s.phoneNumber || null,
      added_at: s.addedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      added_by: s.addedBy || updatedBy,
    }));

    if (records.length > 0) {
      const { error } = await supabase
        .from("managed_students")
        .upsert(records, { onConflict: "id" });

      if (!error) {
        savedDirectly = true;
      }
    }
  } catch (err) {
    // Bảng chưa tạo
  }

  // 2. Lưu đồng thời vào system_settings (key = 'managed_students')
  try {
    await supabase.from("system_settings").upsert(
      {
        key: "managed_students",
        value: data,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "key" }
    );
  } catch (err) {}

  return true;
}

/**
 * Lấy danh sách học viên theo mảng hoặc bộ lọc
 */
export async function getManagedStudents(filter?: {
  centreId?: string;
  classId?: string;
  status?: string;
  search?: string;
}): Promise<ManagedStudent[]> {
  const map = await getAllManagedStudentsMap();
  let list = Object.values(map);

  if (filter?.centreId && filter.centreId !== "all" && filter.centreId !== "ALL") {
    list = list.filter((s) => s.centreId === filter.centreId);
  }

  if (filter?.classId && filter.classId !== "all") {
    list = list.filter((s) => s.classId === filter.classId);
  }

  if (filter?.status && filter.status !== "all") {
    list = list.filter((s) => (s.status || "").toUpperCase() === filter.status?.toUpperCase());
  }

  if (filter?.search?.trim()) {
    const q = filter.search.toLowerCase();
    list = list.filter((s) => {
      return (
        s.fullName?.toLowerCase().includes(q) ||
        s.studentCode?.toLowerCase().includes(q) ||
        s.className?.toLowerCase().includes(q) ||
        s.courseName?.toLowerCase().includes(q)
      );
    });
  }

  return list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
}

/**
 * Lấy danh sách toàn bộ các mã học viên hiện có để chống trùng
 */
export async function getAllExistingStudentCodes(): Promise<string[]> {
  const map = await getAllManagedStudentsMap();
  return Object.values(map).map((s) => s.studentCode);
}

/**
 * Đồng bộ danh sách học viên cho một lớp học
 * Tự động tạo mã học viên cho học viên mới
 */
export async function syncStudentsForClass(
  classInfo: {
    id: string;
    name: string;
    courseName?: string | null;
    centreId: string;
    centreName: string;
  },
  activeLmsStudents: Array<{
    id: string;
    fullName: string;
    status?: string;
    email?: string | null;
    phoneNumber?: string | null;
  }>,
  userId: string = "system"
): Promise<{ addedCount: number; updatedCount: number }> {
  const map = await getAllManagedStudentsMap();
  const existingCodes = Object.values(map).map((s) => s.studentCode);

  let addedCount = 0;
  let updatedCount = 0;

  for (const lmsStudent of activeLmsStudents) {
    const existing = map[lmsStudent.id];
    if (existing) {
      // Đã có trong danh sách -> Cập nhật thông tin lớp, trạng thái, giữ nguyên mã học viên cũ
      map[lmsStudent.id] = {
        ...existing,
        fullName: lmsStudent.fullName || existing.fullName,
        status: lmsStudent.status || existing.status || "ACTIVE",
        classId: classInfo.id,
        className: classInfo.name,
        courseName: classInfo.courseName || existing.courseName,
        centreId: classInfo.centreId,
        centreName: classInfo.centreName,
        email: lmsStudent.email !== undefined ? lmsStudent.email : existing.email,
        phoneNumber: lmsStudent.phoneNumber !== undefined ? lmsStudent.phoneNumber : existing.phoneNumber,
        updatedAt: new Date().toISOString(),
      };
      updatedCount++;
    } else {
      // Học viên mới -> Sinh mã học viên tự động
      const studentCode = generateStudentCode(lmsStudent.fullName, existingCodes);
      existingCodes.push(studentCode);

      map[lmsStudent.id] = {
        id: lmsStudent.id,
        studentCode,
        fullName: lmsStudent.fullName,
        status: lmsStudent.status || "ACTIVE",
        classId: classInfo.id,
        className: classInfo.name,
        courseName: classInfo.courseName || null,
        centreId: classInfo.centreId,
        centreName: classInfo.centreName,
        email: lmsStudent.email || null,
        phoneNumber: lmsStudent.phoneNumber || null,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        addedBy: userId,
      };
      addedCount++;
    }
  }

  await saveAllManagedStudentsMap(map, userId);
  return { addedCount, updatedCount };
}

/**
 * Xóa một học viên khỏi hệ thống quản lý
 */
export async function deleteManagedStudent(studentId: string): Promise<boolean> {
  const map = await getAllManagedStudentsMap();
  if (!map[studentId]) return false;

  delete map[studentId];

  // Xóa trực tiếp khỏi bảng managed_students nếu bảng tồn tại
  try {
    await supabase.from("managed_students").delete().eq("id", studentId);
  } catch (err) {}

  await saveAllManagedStudentsMap(map);
  return true;
}

/**
 * Xóa toàn bộ học viên thuộc về một lớp bị gỡ
 */
export async function deleteStudentsOfClass(classId: string): Promise<number> {
  const map = await getAllManagedStudentsMap();
  let deletedCount = 0;

  for (const [id, student] of Object.entries(map)) {
    if (student.classId === classId) {
      delete map[id];
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    try {
      await supabase.from("managed_students").delete().eq("class_id", classId);
    } catch (err) {}

    await saveAllManagedStudentsMap(map);
  }

  return deletedCount;
}

/**
 * Lấy danh sách học viên quản lý thuộc về một lớp
 */
export async function getStudentsByClassId(classId: string): Promise<ManagedStudent[]> {
  return getManagedStudents({ classId });
}

/**
 * Đối chiếu danh sách học viên của lớp giữa LMS và Supabase
 */
export async function reviewStudentsForClass(
  classId: string,
  token?: string
): Promise<{
  success: boolean;
  classId: string;
  className: string;
  courseName: string;
  centreId: string;
  centreName: string;
  reviews: StudentReviewItem[];
  stats: {
    totalLms: number;
    notInSupabase: number;
    hasChanges: number;
    upToDate: number;
  };
}> {
  const { fetchClassByIdFromLms } = await import("@/lib/services/lms-service");
  const lmsClass = await fetchClassByIdFromLms(classId, token);
  if (!lmsClass) {
    return {
      success: false,
      classId,
      className: "",
      courseName: "",
      centreId: "",
      centreName: "",
      reviews: [],
      stats: { totalLms: 0, notInSupabase: 0, hasChanges: 0, upToDate: 0 },
    };
  }

  const rawLmsStudents = (lmsClass.students || []).filter(
    (s) => s.activeInClass !== false
  );

  const supabaseStudents = await getStudentsByClassId(classId);
  const mapByLmsId = new Map<string, ManagedStudent>();
  const mapByName = new Map<string, ManagedStudent>();

  supabaseStudents.forEach((st) => {
    mapByLmsId.set(st.id, st);
    if (st.fullName) {
      mapByName.set(st.fullName.trim().toLowerCase(), st);
    }
  });

  const existingCodes = await getAllExistingStudentCodes();
  const reviews: StudentReviewItem[] = [];

  for (const lmsSt of rawLmsStudents) {
    const existing = mapByLmsId.get(lmsSt.id) || mapByName.get(lmsSt.fullName.trim().toLowerCase());

    if (!existing) {
      const generatedCode = generateStudentCode(lmsSt.fullName, existingCodes);
      existingCodes.push(generatedCode);

      reviews.push({
        id: lmsSt.id,
        studentCode: generatedCode,
        fullName: lmsSt.fullName,
        status: lmsSt.status || "ACTIVE",
        reviewStatus: "NOT_IN_SUPABASE",
        diffs: [],
        supabaseStudent: null,
        lmsStudent: {
          id: lmsSt.id,
          fullName: lmsSt.fullName,
          status: lmsSt.status || "ACTIVE",
          email: lmsSt.email || null,
          phoneNumber: lmsSt.phoneNumber || null,
        },
      });
    } else {
      const diffs: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];

      // So sánh Họ và tên
      const oldName = (existing.fullName || "").trim();
      const newName = (lmsSt.fullName || "").trim();
      if (oldName !== newName) {
        diffs.push({
          field: "fullName",
          label: "Họ và tên",
          oldValue: oldName,
          newValue: newName,
        });
      }

      // So sánh Trạng thái
      const oldStatus = (existing.status || "ACTIVE").trim().toUpperCase();
      const newStatus = (lmsSt.status || "ACTIVE").trim().toUpperCase();
      if (oldStatus !== newStatus) {
        diffs.push({
          field: "status",
          label: "Trạng thái",
          oldValue: oldStatus === "ACTIVE" ? "Đang học" : oldStatus,
          newValue: newStatus === "ACTIVE" ? "Đang học" : newStatus,
        });
      }

      // So sánh Email nếu có
      if (lmsSt.email && existing.email && lmsSt.email.trim().toLowerCase() !== existing.email.trim().toLowerCase()) {
        diffs.push({
          field: "email",
          label: "Email",
          oldValue: existing.email,
          newValue: lmsSt.email,
        });
      }

      // So sánh Số điện thoại nếu có
      if (lmsSt.phoneNumber && existing.phoneNumber && lmsSt.phoneNumber.trim() !== existing.phoneNumber.trim()) {
        diffs.push({
          field: "phoneNumber",
          label: "Số điện thoại",
          oldValue: existing.phoneNumber,
          newValue: lmsSt.phoneNumber,
        });
      }

      reviews.push({
        id: lmsSt.id,
        studentCode: existing.studentCode,
        fullName: lmsSt.fullName,
        status: lmsSt.status || "ACTIVE",
        reviewStatus: diffs.length > 0 ? "HAS_CHANGES" : "UP_TO_DATE",
        diffs,
        supabaseStudent: existing,
        lmsStudent: {
          id: lmsSt.id,
          fullName: lmsSt.fullName,
          status: lmsSt.status || "ACTIVE",
          email: lmsSt.email || null,
          phoneNumber: lmsSt.phoneNumber || null,
        },
      });
    }
  }

  return {
    success: true,
    classId: lmsClass.id,
    className: lmsClass.name,
    courseName: lmsClass.course?.name || "",
    centreId: lmsClass.centre?.id || "",
    centreName: lmsClass.centre?.name || "",
    reviews,
    stats: {
      totalLms: reviews.length,
      notInSupabase: reviews.filter((r) => r.reviewStatus === "NOT_IN_SUPABASE").length,
      hasChanges: reviews.filter((r) => r.reviewStatus === "HAS_CHANGES").length,
      upToDate: reviews.filter((r) => r.reviewStatus === "UP_TO_DATE").length,
    },
  };
}

/**
 * Thêm một học viên duy nhất vào Supabase
 */
export async function addSingleStudentToManaged(
  classInfo: {
    id: string;
    name: string;
    courseName?: string | null;
    centreId: string;
    centreName: string;
  },
  studentData: {
    id: string;
    studentCode?: string;
    fullName: string;
    status?: string;
    email?: string | null;
    phoneNumber?: string | null;
  },
  userId: string = "system"
): Promise<ManagedStudent> {
  const map = await getAllManagedStudentsMap();
  const existingCodes = Object.values(map).map((s) => s.studentCode);

  const studentCode = studentData.studentCode || generateStudentCode(studentData.fullName, existingCodes);

  const newStudent: ManagedStudent = {
    id: studentData.id,
    studentCode,
    fullName: studentData.fullName,
    status: studentData.status || "ACTIVE",
    classId: classInfo.id,
    className: classInfo.name,
    courseName: classInfo.courseName || null,
    centreId: classInfo.centreId,
    centreName: classInfo.centreName,
    email: studentData.email || null,
    phoneNumber: studentData.phoneNumber || null,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    addedBy: userId,
  };

  map[studentData.id] = newStudent;
  await saveAllManagedStudentsMap(map, userId);
  return newStudent;
}

/**
 * Cập nhật một học viên với dữ liệu mới từ LMS
 */
export async function syncSingleStudentFromLms(
  studentId: string,
  lmsData: {
    fullName?: string;
    status?: string;
    email?: string | null;
    phoneNumber?: string | null;
  },
  userId: string = "system"
): Promise<ManagedStudent | null> {
  const map = await getAllManagedStudentsMap();
  const existing = map[studentId];
  if (!existing) return null;

  const updated: ManagedStudent = {
    ...existing,
    fullName: lmsData.fullName || existing.fullName,
    status: lmsData.status || existing.status,
    email: lmsData.email !== undefined ? lmsData.email : existing.email,
    phoneNumber: lmsData.phoneNumber !== undefined ? lmsData.phoneNumber : existing.phoneNumber,
    updatedAt: new Date().toISOString(),
  };

  map[studentId] = updated;
  await saveAllManagedStudentsMap(map, userId);
  return updated;
}

