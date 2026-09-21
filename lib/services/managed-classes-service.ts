import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { LmsClassItem } from "@/lib/services/lms-service";
import {
  ManagedClass,
  ManagedClassSlot,
  ClassDiffItem,
  formatVnDate,
  formatVnTime,
  formatVnDateTime,
  normalizeDeadlineFormat,
  calculateDefaultDeadlines,
  calculateRegularSessions,
  calculateSessionStatus,
  parseSessionDeadlineTimes,
} from "@/lib/types/managed-class";

export type { ManagedClass, ManagedClassSlot, ClassDiffItem };
export {
  formatVnDate,
  formatVnTime,
  formatVnDateTime,
  normalizeDeadlineFormat,
  calculateDefaultDeadlines,
  calculateRegularSessions,
  calculateSessionStatus,
  parseSessionDeadlineTimes,
};


const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "managed_classes_store.json");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cache in-memory
let memoryStore: Record<string, ManagedClass> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2000;

function readLocalFile(): Record<string, ManagedClass> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.warn("Lỗi đọc file managed_classes_store.json:", err);
  }
  return {};
}

function writeLocalFile(data: Record<string, ManagedClass>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Lỗi ghi file managed_classes_store.json:", err);
  }
}

import { deleteStudentsOfClass } from "./managed-students-service";

const MANAGED_CLASSES_FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000002";
const MANAGED_CLASSES_FALLBACK_LMS_CODE = "__managed_classes__";

/**
 * Đọc danh sách lớp quản lý từ Supabase
 * Ưu tiên 1: Bảng `managed_classes` trực tiếp trên Supabase
 * Ưu tiên 2: Bảng `system_settings` (key = 'managed_classes')
 * Ưu tiên 3: Bản ghi fallback bảng `users`
 * Ưu tiên 4: File local `data/managed_classes_store.json`
 */
export async function getAllManagedClassesMap(): Promise<Record<string, ManagedClass>> {
  const now = Date.now();
  if (memoryStore && now - lastFetchTime < CACHE_TTL_MS) {
    return memoryStore;
  }

  // 1. Thử đọc trực tiếp từ bảng managed_classes trên Supabase
  try {
    const { data: rows, error } = await supabase
      .from("managed_classes")
      .select("*");

    if (!error && Array.isArray(rows)) {
      const map: Record<string, ManagedClass> = {};
      rows.forEach((r: any) => {
        map[r.id] = {
          id: r.id,
          name: r.name,
          status: r.status,
          courseName: r.course_name,
          centreId: r.centre_id,
          centreName: r.centre_name,
          teacherName: r.teacher_name,
          teacherCodes: r.teacher_codes || [],
          classTime: r.class_time,
          startDate: r.start_date,
          endDate: r.end_date,
          numberOfSessions: r.number_of_sessions,
          completedSessions: r.completed_sessions,
          progressPercent: r.progress_percent,
          checkpoint1Session: r.checkpoint1_session,
          checkpoint1Date: r.checkpoint1_date,
          checkpoint2Session: r.checkpoint2_session,
          checkpoint2Date: r.checkpoint2_date,
          finalProjectSession: r.final_project_session,
          finalProjectDate: r.final_project_date,
          slots: r.slots || [],
          regularSessions:
            r.regular_sessions ||
            calculateRegularSessions(
              r.number_of_sessions || (r.slots?.length || 14),
              r.checkpoint1_session,
              r.checkpoint2_session,
              r.final_project_session
            ),
          addedAt: r.added_at,
          addedBy: r.added_by,
        };
      });
      memoryStore = map;
      lastFetchTime = now;
      writeLocalFile(map);
      return map;
    }
  } catch (err) {
    // Bảng managed_classes chưa tạo
  }

  // 2. Thử lấy từ Supabase system_settings
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "managed_classes")
      .maybeSingle();

    if (!error && data && data.value && typeof data.value === "object") {
      memoryStore = data.value as Record<string, ManagedClass>;
      lastFetchTime = now;
      writeLocalFile(memoryStore);
      return memoryStore;
    }
  } catch (err) {
    // Supabase query error
  }

  // 3. Fallback sang file local
  const localData = readLocalFile();
  memoryStore = localData;
  lastFetchTime = now;
  return localData;
}

/**
 * Lưu toàn bộ danh sách lớp vào Supabase (managed_classes + system_settings + users fallback) & file local
 */
export async function saveAllManagedClassesMap(
  data: Record<string, ManagedClass>,
  updatedBy: string = "system"
): Promise<boolean> {
  memoryStore = data;
  lastFetchTime = Date.now();
  writeLocalFile(data);

  let savedToSupabase = false;

  // 1. Lưu trực tiếp vào bảng managed_classes nếu bảng tồn tại
  try {
    const records = Object.values(data).map((c) => {
      const regSessions =
        c.regularSessions ||
        calculateRegularSessions(
          c.numberOfSessions || (c.slots?.length || 14),
          c.checkpoint1Session,
          c.checkpoint2Session,
          c.finalProjectSession
        );
      c.regularSessions = regSessions;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        course_name: c.courseName || null,
        centre_id: c.centreId,
        centre_name: c.centreName,
        teacher_name: c.teacherName || null,
        teacher_codes: c.teacherCodes || [],
        class_time: c.classTime || null,
        start_date: c.startDate || null,
        end_date: c.endDate || null,
        number_of_sessions: c.numberOfSessions || 0,
        completed_sessions: c.completedSessions || 0,
        progress_percent: c.progressPercent || 0,
        checkpoint1_session: c.checkpoint1Session || null,
        checkpoint1_date: c.checkpoint1Date || null,
        checkpoint2_session: c.checkpoint2Session || null,
        checkpoint2_date: c.checkpoint2Date || null,
        final_project_session: c.finalProjectSession || null,
        final_project_date: c.finalProjectDate || null,
        slots: c.slots || [],
        regular_sessions: regSessions,
        added_at: c.addedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        added_by: c.addedBy || updatedBy,
      };
    });

    if (records.length > 0) {
      const { error: upsertErr } = await supabase
        .from("managed_classes")
        .upsert(records, { onConflict: "id" });

      // Nếu cột regular_sessions chưa được migrate trên Supabase DB, fallback bỏ cột đó để không crash
      if (upsertErr && String(upsertErr.message || "").includes("regular_sessions")) {
        const sanitizedRecords = records.map(({ regular_sessions, ...rest }) => rest);
        await supabase.from("managed_classes").upsert(sanitizedRecords, { onConflict: "id" });
      }
    }
  } catch (err) {}

  // 2. Lưu đồng thời vào bảng system_settings nếu tồn tại
  try {
    await supabase
      .from("system_settings")
      .upsert(
        {
          key: "managed_classes",
          value: data,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        },
        { onConflict: "key" }
      );
  } catch (err) {
    // system_settings not available
  }

  return savedToSupabase;
}


/**
 * Lấy danh sách các lớp học đang được quản lý (lọc theo cơ sở nếu có)
 */
export async function getManagedClasses(targetCentreIds?: string[]): Promise<ManagedClass[]> {
  const map = await getAllManagedClassesMap();
  const list = Object.values(map);

  if (!targetCentreIds || targetCentreIds.length === 0) {
    return list;
  }

  const centreSet = new Set(targetCentreIds);
  return list.filter((item) => centreSet.has(item.centreId));
}

/**
 * Thêm một lớp học vào danh sách quản lý
 */
export async function addManagedClass(
  classData: ManagedClass,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  const map = await getAllManagedClassesMap();
  if (map[classData.id]) {
    return { success: false, message: "Lớp học này đã tồn tại trong danh sách quản lý." };
  }

  classData.addedBy = userId;
  classData.addedAt = new Date().toISOString();
  classData.updatedAt = new Date().toISOString();

  map[classData.id] = classData;
  await saveAllManagedClassesMap(map, userId);

  return { success: true };
}

/**
 * Cập nhật thông tin / hạn nộp bài của lớp học đang quản lý
 */
export async function updateManagedClass(
  classId: string,
  updateData: Partial<ManagedClass>,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  const map = await getAllManagedClassesMap();
  const existing = map[classId];
  if (!existing) {
    return { success: false, message: "Không tìm thấy lớp học trong danh sách quản lý." };
  }

  const updated: ManagedClass = {
    ...existing,
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  map[classId] = updated;
  await saveAllManagedClassesMap(map, userId);

  return { success: true };
}

/**
 * Gỡ bỏ một lớp học khỏi danh sách quản lý
 */
export async function deleteManagedClass(
  classId: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  const map = await getAllManagedClassesMap();
  if (!map[classId]) {
    return { success: false, message: "Lớp học không tồn tại trong danh sách quản lý." };
  }

  delete map[classId];

  // Xóa trực tiếp khỏi bảng managed_classes nếu bảng tồn tại
  try {
    await supabase.from("managed_classes").delete().eq("id", classId);
  } catch (err) {}

  // Xóa toàn bộ học viên thuộc lớp bị gỡ
  try {
    await deleteStudentsOfClass(classId);
  } catch (err) {}

  await saveAllManagedClassesMap(map, userId);

  return { success: true };
}

/**
 * So sánh đối chiếu dữ liệu lớp hiện tại với LMS thời gian thực
 */
export function compareClassWithLms(
  current: ManagedClass,
  lms: LmsClassItem | any,
  existingStudentsCount?: number
): { hasChanges: boolean; diffs: ClassDiffItem[] } {
  const diffs: ClassDiffItem[] = [];

  // 1. Giáo viên phụ trách
  const oldTeacher = current.teacherName?.trim() || "Chưa phân công";
  const newTeacher = lms.teacherName?.trim() || "Chưa phân công";
  if (oldTeacher !== newTeacher) {
    diffs.push({
      field: "teacherName",
      label: "Giáo viên phụ trách",
      oldValue: oldTeacher,
      newValue: newTeacher,
    });
  }

  // 2. Khung giờ học
  const oldTime = current.classTime?.trim() || "Chưa có khung giờ";
  const newTime = lms.classTime?.trim() || "Chưa có khung giờ";
  if (oldTime !== newTime) {
    diffs.push({
      field: "classTime",
      label: "Khung giờ học",
      oldValue: oldTime,
      newValue: newTime,
    });
  }

  // 3. Số buổi học
  if (lms.numberOfSessions && current.numberOfSessions !== lms.numberOfSessions) {
    diffs.push({
      field: "numberOfSessions",
      label: "Số buổi học",
      oldValue: `${current.numberOfSessions || 0} buổi`,
      newValue: `${lms.numberOfSessions} buổi`,
    });
  }

  // 4. Trạng thái lớp học (OPEN, RUNNING, FINISHED)
  if (
    current.status &&
    lms.status &&
    current.status.toUpperCase() !== lms.status.toUpperCase()
  ) {
    diffs.push({
      field: "status",
      label: "Trạng thái lớp học",
      oldValue: current.status,
      newValue: lms.status,
    });
  }

  // 5. Thay đổi về lịch học các buổi (startDate, endDate) - bắt buộc thông báo, không tự ý ghi đè ngầm
  const oldStart = formatVnDate(current.startDate) || "Chưa có";
  const newStart = formatVnDate(lms.startDate) || "Chưa có";
  const oldEnd = formatVnDate(current.endDate) || "Chưa có";
  const newEnd = formatVnDate(lms.endDate) || "Chưa có";
  if (
    (current.startDate && lms.startDate && oldStart !== newStart) ||
    (current.endDate && lms.endDate && oldEnd !== newEnd)
  ) {
    diffs.push({
      field: "schedule",
      label: "Lịch học (Ngày bắt đầu / kết thúc)",
      oldValue: `${oldStart} - ${oldEnd}`,
      newValue: `${newStart} - ${newEnd}`,
    });
  }

  // 6. Học viên active trong lớp
  if (existingStudentsCount !== undefined && Array.isArray(lms.students)) {
    const lmsActiveCount = lms.students.filter(
      (s: any) => s.activeInClass !== false
    ).length;
    if (existingStudentsCount !== lmsActiveCount) {
      diffs.push({
        field: "students",
        label: "Danh sách học viên",
        oldValue: `${existingStudentsCount} học viên`,
        newValue: `${lmsActiveCount} học viên active trên LMS`,
      });
    }
  }

  return {
    hasChanges: diffs.length > 0,
    diffs,
  };
}
