import { LmsClassItem } from "@/lib/services/lms-service";

export interface ManagedClassSlot {
  index: number;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  submissionDeadline?: string | null;
}

export interface ManagedClass {
  id: string; // LMS class ID
  name: string; // Mã lớp
  status: string; // OPEN | RUNNING | FINISHED
  courseName?: string;
  centreId: string;
  centreName: string;
  teacherName?: string;
  teacherCodes?: string[];
  classTime?: string;
  startDate?: string | null;
  endDate?: string | null;
  numberOfSessions: number;
  completedSessions: number;
  progressPercent: number;
  checkpoint1Session?: number | null;
  checkpoint1Date?: string | null;
  checkpoint2Session?: number | null;
  checkpoint2Date?: string | null;
  finalProjectSession?: number | null;
  finalProjectDate?: string | null;
  slots: ManagedClassSlot[];
  students?: Array<{
    id: string;
    fullName: string;
    studentCode?: string;
    status: string;
    email?: string | null;
    phoneNumber?: string | null;
  }>;
  addedBy?: string;
  addedAt?: string;
  updatedAt?: string;
}

export interface ClassDiffItem {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

/**
 * Định dạng ngày giờ VN cho hạn nộp bài
 */
export function formatVnDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch {
    return dateStr || "";
  }
}

export function formatVnTime(timeStr?: string | null): string {
  if (!timeStr) return "";
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch {
    return timeStr || "";
  }
}

/**
 * Tự động tính toán hạn nộp bài mặc định:
 * - Buổi 1 -> Checkpoint 2: [Giờ bắt đầu] - [Giờ kết thúc, Ngày học] của từng buổi
 * - Giai đoạn Sản phẩm cuối khóa (từ buổi ngay sau Checkpoint 2 đến buổi cuối):
 *   Toàn bộ các buổi trong giai đoạn này đều có chung hạn nộp:
 *   [Giờ bắt đầu, Ngày học của buổi sau CP2] - [Giờ kết thúc, Ngày học của buổi cuối]
 */
export function calculateDefaultDeadlines(classItem: LmsClassItem): ManagedClassSlot[] {
  const slots = classItem.slots || [];
  const cp2Num = classItem.checkpoint2Session || classItem.courseProcess?.checkpoint2Session || null;
  const cp1Num = classItem.checkpoint1Session || classItem.courseProcess?.checkpoint1Session || null;
  const targetCpNum = cp2Num || cp1Num || null;

  // Tính sẵn hạn nộp thống nhất cho toàn bộ giai đoạn SPCK (sau CP2 đến buổi cuối)
  let spckSharedDeadline = "";
  if (targetCpNum && targetCpNum < slots.length) {
    const postCpSlot = slots[targetCpNum]; // Buổi ngay sau CP2 (0-indexed = targetCpNum)
    const finalSlot = slots[slots.length - 1]; // Buổi cuối

    const startStr = postCpSlot
      ? `${formatVnTime(postCpSlot.startTime)}, ${formatVnDate(postCpSlot.date)}`
      : "";
    const endStr = finalSlot
      ? `${formatVnTime(finalSlot.endTime)}, ${formatVnDate(finalSlot.date)}`
      : "";

    if (startStr && endStr) {
      spckSharedDeadline = `${startStr} - ${endStr}`;
    }
  }

  return slots.map((s, idx) => {
    const sessionNumber = s.index !== undefined ? s.index + 1 : idx + 1;
    const isSpckPhase = targetCpNum !== null && sessionNumber > targetCpNum;

    const dateStr = formatVnDate(s.date);
    const tStart = formatVnTime(s.startTime);
    const tEnd = formatVnTime(s.endTime);

    let defaultDeadline = "";

    if (isSpckPhase && spckSharedDeadline) {
      // Giai đoạn SPCK: tất cả các buổi đều có chung hạn nộp từ buổi sau CP2 đến buổi cuối
      defaultDeadline = spckSharedDeadline;
    } else {
      // Các buổi từ buổi 1 đến Checkpoint 2: Hạn nộp trong buổi học đó
      if (tStart && tEnd) {
        defaultDeadline = `${tStart} - ${tEnd}, ${dateStr}`;
      } else if (dateStr) {
        defaultDeadline = `Khung giờ học ngày ${dateStr}`;
      }
    }

    return {
      index: s.index !== undefined ? s.index : idx,
      date: s.date,
      startTime: s.startTime || null,
      endTime: s.endTime || null,
      submissionDeadline: defaultDeadline,
    };
  });
}
