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
export async function getAllManagedStudentsMap(forceRefresh = false): Promise<Record<string, ManagedStudent>> {
  const now = Date.now();
  if (!forceRefresh && memoryStore && now - lastFetchTime < CACHE_TTL_MS) {
    return memoryStore;
  }

  // 0. Đọc system_settings từ Supabase để đồng bộ định mức và thông tin giáo viên phụ trách mới nhất
  let studentQuotas: Record<string, number> = {};
  let ssStudentsMap: Record<string, ManagedStudent> = {};
  try {
    const { data: ssRows } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["student_quotas", "managed_students"]);
    if (Array.isArray(ssRows)) {
      for (const row of ssRows) {
        if (row.key === "student_quotas" && row.value && typeof row.value === "object") {
          studentQuotas = row.value as Record<string, number>;
        }
        if (row.key === "managed_students" && row.value && typeof row.value === "object") {
          ssStudentsMap = row.value as Record<string, ManagedStudent>;
        }
      }
    }
  } catch (_) {}

  // 1. Thử đọc trực tiếp từ bảng managed_students trong Supabase
  try {
    const { data: rows, error } = await supabase
      .from("managed_students")
      .select("*");

    if (!error && Array.isArray(rows) && rows.length > 0) {
      const map: Record<string, ManagedStudent> = {};
      rows.forEach((r: any) => {
        const quota = r.submission_quota_mb
          ? Number(r.submission_quota_mb)
          : (studentQuotas[r.id] ?? 50);

        const ssStudent = ssStudentsMap[r.id];

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
          teacherName: r.teacher_name || ssStudent?.teacherName || null,
          teacherCodes: r.teacher_codes || ssStudent?.teacherCodes || [],
          lastTeacherName: r.last_teacher_name || ssStudent?.lastTeacherName || null,
          lastTeacherCodes: r.last_teacher_codes || ssStudent?.lastTeacherCodes || [],
          lastClassId: r.last_class_id || ssStudent?.lastClassId || null,
          lastClassName: r.last_class_name || ssStudent?.lastClassName || null,
          email: r.email,
          phoneNumber: r.phone_number,
          submissionQuotaMb: quota,
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

    if (!error && data && data.value && typeof data.value === "object" && Object.keys(data.value).length > 0) {
      const sMap = data.value as Record<string, ManagedStudent>;
      for (const [id, st] of Object.entries(sMap)) {
        if (studentQuotas[id] !== undefined) {
          st.submissionQuotaMb = studentQuotas[id];
        } else if (!st.submissionQuotaMb) {
          st.submissionQuotaMb = 50;
        }
      }
      memoryStore = sMap;
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

  // 1. Lưu bản đồ định mức student_quotas riêng biệt trực tiếp vào Supabase system_settings
  const studentQuotas: Record<string, number> = {};
  for (const [id, s] of Object.entries(data)) {
    studentQuotas[id] = s.submissionQuotaMb || 50;
  }
  try {
    await supabase.from("system_settings").upsert(
      {
        key: "student_quotas",
        value: studentQuotas,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "key" }
    );
  } catch (e) {
    console.warn("Lỗi lưu student_quotas vào Supabase:", e);
  }

  // 2. Lưu toàn bộ danh sách managed_students kèm submissionQuotaMb vào Supabase system_settings
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
  } catch (err) {
    console.warn("Lỗi lưu managed_students vào Supabase system_settings:", err);
  }

  // 3. Cập nhật bảng managed_students thực trên Supabase
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
      teacher_name: s.teacherName || null,
      teacher_codes: s.teacherCodes || [],
      last_teacher_name: s.lastTeacherName || null,
      last_teacher_codes: s.lastTeacherCodes || [],
      last_class_id: s.lastClassId || null,
      last_class_name: s.lastClassName || null,
      email: s.email || null,
      phone_number: s.phoneNumber || null,
      submission_quota_mb: s.submissionQuotaMb || 50,
      added_at: s.addedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      added_by: s.addedBy || updatedBy,
    }));

    if (records.length > 0) {
      const { error } = await supabase
        .from("managed_students")
        .upsert(records, { onConflict: "id" });

      if (error) {
        // Fallback: nếu bảng Supabase chưa chạy migration 00014, bỏ qua các cột mới
        const fallbackRecords = records.map(
          ({
            teacher_name,
            teacher_codes,
            last_teacher_name,
            last_teacher_codes,
            last_class_id,
            last_class_name,
            ...rest
          }) => rest
        );
        await supabase
          .from("managed_students")
          .upsert(fallbackRecords, { onConflict: "id" });
      }
    }
  } catch (_) {}

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

  // Lấy định mức mặc định của giáo viên phụ trách lớp này (nếu có)
  let defaultQuotaMb = 50;
  let targetTeacherName: string | null = null;
  let targetTeacherCodes: string[] = [];
  try {
    const { getAllManagedClassesMap } = await import("./managed-classes-service");
    const classMap = await getAllManagedClassesMap();
    const targetClass = classMap[classInfo.id];
    if (targetClass) {
      targetTeacherName = targetClass.teacherName || null;
      targetTeacherCodes = targetClass.teacherCodes || [];
      const teacherKey = targetClass.teacherCodes?.[0] || targetClass.teacherName || "";
      const { getTeacherQuota } = await import("./teacher-quota-service");
      const tQuota = await getTeacherQuota(teacherKey);
      defaultQuotaMb = tQuota.defaultStudentQuotaMb || 50;
    }
  } catch (_) {}

  for (const lmsStudent of activeLmsStudents) {
    const existing = map[lmsStudent.id];
    if (existing) {
      // Đã có trong danh sách -> Cập nhật thông tin lớp, trạng thái, theo dõi chuyển lớp Thầy A -> Thầy B
      const isClassChanged = existing.classId !== classInfo.id;
      const lastClassId = isClassChanged ? existing.classId : existing.lastClassId || classInfo.id;
      const lastClassName = isClassChanged ? existing.className : existing.lastClassName || classInfo.name;
      const lastTeacherName = isClassChanged ? (existing.teacherName || existing.lastTeacherName || targetTeacherName) : (existing.lastTeacherName || targetTeacherName);
      const lastTeacherCodes = isClassChanged ? (existing.teacherCodes || existing.lastTeacherCodes || targetTeacherCodes) : (existing.lastTeacherCodes || targetTeacherCodes);

      map[lmsStudent.id] = {
        ...existing,
        fullName: lmsStudent.fullName || existing.fullName,
        status: lmsStudent.status || existing.status || "ACTIVE",
        classId: classInfo.id,
        className: classInfo.name,
        courseName: classInfo.courseName || existing.courseName,
        centreId: classInfo.centreId,
        centreName: classInfo.centreName,
        teacherName: targetTeacherName || existing.teacherName,
        teacherCodes: targetTeacherCodes.length > 0 ? targetTeacherCodes : (existing.teacherCodes || []),
        lastTeacherName,
        lastTeacherCodes,
        lastClassId,
        lastClassName,
        email: lmsStudent.email !== undefined ? lmsStudent.email : existing.email,
        phoneNumber: lmsStudent.phoneNumber !== undefined ? lmsStudent.phoneNumber : existing.phoneNumber,
        submissionQuotaMb: existing.submissionQuotaMb || defaultQuotaMb,
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
        teacherName: targetTeacherName,
        teacherCodes: targetTeacherCodes,
        lastTeacherName: targetTeacherName,
        lastTeacherCodes: targetTeacherCodes,
        lastClassId: classInfo.id,
        lastClassName: classInfo.name,
        email: lmsStudent.email || null,
        phoneNumber: lmsStudent.phoneNumber || null,
        submissionQuotaMb: defaultQuotaMb,
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
  let hasAutoUpdatedStudents = false;
  const fullMap = await getAllManagedStudentsMap();

  for (const lmsSt of rawLmsStudents) {
    // Tìm trong lớp hiện tại hoặc trên toàn bộ hệ thống Supabase để phát hiện chuyển lớp
    let existing = mapByLmsId.get(lmsSt.id) || mapByName.get(lmsSt.fullName.trim().toLowerCase());
    if (!existing && fullMap[lmsSt.id]) {
      existing = fullMap[lmsSt.id];
    }
    if (!existing) {
      const matchByName = Object.values(fullMap).find(
        (s) => s.fullName && s.fullName.trim().toLowerCase() === lmsSt.fullName.trim().toLowerCase()
      );
      if (matchByName) existing = matchByName;
    }

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
      // Yêu cầu người dùng: Nếu học viên chuyển lớp giữa các Thầy Cô, tự động cập nhật lớp mới và giáo viên mới vào Supabase
      if (existing.classId !== lmsClass.id) {
        existing.lastClassId = existing.classId;
        existing.lastClassName = existing.className;
        existing.lastTeacherName = existing.teacherName || existing.lastTeacherName;
        existing.lastTeacherCodes = existing.teacherCodes || existing.lastTeacherCodes;

        existing.classId = lmsClass.id;
        existing.className = lmsClass.name;
        existing.courseName = lmsClass.course?.name || existing.courseName;
        existing.centreId = lmsClass.centre?.id || existing.centreId;
        existing.centreName = lmsClass.centre?.name || existing.centreName;
        existing.teacherName = lmsClass.teacherName;
        existing.teacherCodes = lmsClass.teacherCodes || [];
        existing.updatedAt = new Date().toISOString();
        fullMap[existing.id] = existing;
        hasAutoUpdatedStudents = true;
      }

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

  const reviewResult = {
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

  if (hasAutoUpdatedStudents) {
    await saveAllManagedStudentsMap(fullMap);
  }

  return reviewResult;
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
    submissionQuotaMb: 50,
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

/**
 * Chỉnh sửa thông tin học viên (Xem / Sửa từ giao diện)
 */
export async function updateManagedStudent(
  studentId: string,
  updateData: {
    fullName?: string;
    status?: string;
    className?: string;
    classId?: string;
    centreName?: string;
    centreId?: string;
    email?: string | null;
    phoneNumber?: string | null;
    submissionQuotaMb?: number;
  },
  userId: string = "system"
): Promise<{ success: boolean; student?: ManagedStudent; message?: string }> {
  const map = await getAllManagedStudentsMap();
  const existing = map[studentId];
  if (!existing) {
    return { success: false, message: "Không tìm thấy học viên trong hệ thống" };
  }

  const updated: ManagedStudent = {
    ...existing,
    fullName: updateData.fullName !== undefined ? updateData.fullName.trim() : existing.fullName,
    status: updateData.status !== undefined ? updateData.status.trim() : existing.status,
    className: updateData.className !== undefined ? updateData.className.trim() : existing.className,
    classId: updateData.classId !== undefined ? updateData.classId.trim() : existing.classId,
    centreName: updateData.centreName !== undefined ? updateData.centreName.trim() : existing.centreName,
    centreId: updateData.centreId !== undefined ? updateData.centreId.trim() : existing.centreId,
    email: updateData.email !== undefined ? updateData.email : existing.email,
    phoneNumber: updateData.phoneNumber !== undefined ? updateData.phoneNumber : existing.phoneNumber,
    submissionQuotaMb:
      updateData.submissionQuotaMb !== undefined
        ? Math.max(5, Math.min(Number(updateData.submissionQuotaMb), 500))
        : existing.submissionQuotaMb || 50,
    updatedAt: new Date().toISOString(),
  };

  // Nếu lớp học thay đổi, cập nhật giáo viên phụ trách mới và ghi nhận giáo viên cũ
  if (updateData.classId && updateData.classId !== existing.classId) {
    try {
      const { getAllManagedClassesMap } = await import("./managed-classes-service");
      const classMap = await getAllManagedClassesMap();
      const targetClass = classMap[updateData.classId];
      if (targetClass) {
        updated.lastClassId = existing.classId;
        updated.lastClassName = existing.className;
        updated.lastTeacherName = existing.teacherName || existing.lastTeacherName;
        updated.lastTeacherCodes = existing.teacherCodes || existing.lastTeacherCodes;

        updated.teacherName = targetClass.teacherName || null;
        updated.teacherCodes = targetClass.teacherCodes || [];
        updated.className = targetClass.name;
        updated.courseName = targetClass.courseName || updated.courseName;
        updated.centreId = targetClass.centreId || updated.centreId;
        updated.centreName = targetClass.centreName || updated.centreName;
      }
    } catch (_) {}
  }

  map[studentId] = updated;

  try {
    const tableUpdatePayload: any = {
      full_name: updated.fullName,
      status: updated.status,
      class_name: updated.className,
      class_id: updated.classId,
      centre_name: updated.centreName,
      centre_id: updated.centreId,
      teacher_name: updated.teacherName || null,
      teacher_codes: updated.teacherCodes || [],
      last_teacher_name: updated.lastTeacherName || null,
      last_teacher_codes: updated.lastTeacherCodes || [],
      last_class_id: updated.lastClassId || null,
      last_class_name: updated.lastClassName || null,
      email: updated.email,
      phone_number: updated.phoneNumber,
      updated_at: updated.updatedAt,
    };
    if (updated.submissionQuotaMb !== undefined) {
      tableUpdatePayload.submission_quota_mb = updated.submissionQuotaMb;
    }
    const { error: updateErr } = await supabase
      .from("managed_students")
      .update(tableUpdatePayload)
      .eq("id", studentId);

    if (updateErr) {
      const fallbackPayload = {
        full_name: updated.fullName,
        status: updated.status,
        class_name: updated.className,
        class_id: updated.classId,
        centre_name: updated.centreName,
        centre_id: updated.centreId,
        email: updated.email,
        phone_number: updated.phoneNumber,
        updated_at: updated.updatedAt,
        ...(updated.submissionQuotaMb !== undefined ? { submission_quota_mb: updated.submissionQuotaMb } : {}),
      };
      await supabase.from("managed_students").update(fallbackPayload).eq("id", studentId);
    }
  } catch (err) {}

  await saveAllManagedStudentsMap(map, userId);
  return { success: true, student: updated };
}

/**
 * Tự động đồng bộ giáo viên phụ trách cho toàn bộ học viên theo lớp học hiện tại:
 * - Nếu học viên đang học lớp X (Thầy A): gán teacherName = Thầy A.
 * - Nếu chuyển sang lớp Y (Thầy B): Thầy B trở thành teacherName, Thầy A lưu vào lastTeacherName.
 * - Nếu lớp học hiện tại không xác định được: giữ nguyên lastTeacherName để Thầy cuối cùng vẫn xem được.
 */
export async function reconcileStudentsWithClasses(
  studentsMap?: Record<string, ManagedStudent>
): Promise<{ updated: boolean; count: number; students: Record<string, ManagedStudent> }> {
  try {
    const { getAllManagedClassesMap } = await import("./managed-classes-service");
    const classMap = await getAllManagedClassesMap();
    const map = studentsMap || (await getAllManagedStudentsMap());
    let hasChanges = false;
    let count = 0;

    for (const [id, student] of Object.entries(map)) {
      const targetClass = student.classId ? classMap[student.classId] : null;

      if (targetClass) {
        const currentTeacherName = targetClass.teacherName || null;
        const currentTeacherCodes = targetClass.teacherCodes || [];

        const isTeacherDiff = student.teacherName !== currentTeacherName;
        const isClassDiff = student.className !== targetClass.name;

        if (isTeacherDiff || isClassDiff || !student.teacherName) {
          if (student.teacherName && student.teacherName !== currentTeacherName) {
            student.lastTeacherName = student.teacherName;
            student.lastTeacherCodes = student.teacherCodes || [];
            student.lastClassId = student.classId;
            student.lastClassName = student.className;
          } else if (!student.lastTeacherName && currentTeacherName) {
            student.lastTeacherName = currentTeacherName;
            student.lastTeacherCodes = currentTeacherCodes;
            student.lastClassId = targetClass.id;
            student.lastClassName = targetClass.name;
          }

          student.teacherName = currentTeacherName;
          student.teacherCodes = currentTeacherCodes;
          student.className = targetClass.name;
          student.courseName = targetClass.courseName || student.courseName;
          student.centreId = targetClass.centreId || student.centreId;
          student.centreName = targetClass.centreName || student.centreName;
          student.updatedAt = new Date().toISOString();
          hasChanges = true;
          count++;
        }
      } else {
        // Lớp không xác định được hoặc không còn trong danh sách quản lý:
        // Giữ nguyên giáo viên phụ trách cuối cùng (lastTeacherName)
        if (!student.teacherName && student.lastTeacherName) {
          student.teacherName = student.lastTeacherName;
          student.teacherCodes = student.lastTeacherCodes;
          hasChanges = true;
          count++;
        }
      }
    }

    if (hasChanges) {
      await saveAllManagedStudentsMap(map, "system-reconcile");
    }

    return { updated: hasChanges, count, students: map };
  } catch (err) {
    console.warn("Lỗi reconcileStudentsWithClasses:", err);
    return { updated: false, count: 0, students: studentsMap || {} };
  }
}


