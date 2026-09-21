import { LmsClassItem } from "@/lib/services/lms-service";

export interface LateSubmissionConfig {
  enabled: boolean;
  type: "specific_datetime" | "duration";
  specificDateTime?: string | null; // Định dạng YYYY-MM-DDTHH:mm, bắt buộc <= endDate của lớp học
  duration?: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
}

export interface ManagedClassSlot {
  index: number;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  submissionDeadline?: string | null;
  deadlineDate?: string | null; // YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm cho Date Picker
  lateSubmission?: LateSubmissionConfig;
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
  regularSessions?: number[];
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
    if (typeof dateStr === "string") {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
      }
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        return dateStr.slice(0, 10);
      }
    }
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
 * Định dạng chuẩn Ngày Tháng Năm Giờ Phút (DD/MM/YYYY HH:mm)
 */
export function formatVnDateTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const time = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    });
    return `${date} ${time}`;
  } catch {
    return dateStr || "";
  }
}

/**
 * Chuẩn hóa toàn bộ chuỗi hạn nộp về đúng định dạng chuẩn: Ngày Tháng Năm Giờ Phút
 * Ví dụ:
 * - "18:30 - 20:30, 22/07/2026" -> "22/07/2026 18:30 - 20:30"
 * - "20:30, 22/07/2026" -> "22/07/2026 20:30"
 * - "18:30, 16/09/2026 - 20:30, 28/10/2026" -> "16/09/2026 18:30 - 28/10/2026 20:30"
 */
export function normalizeDeadlineFormat(deadline?: string | null): string {
  if (!deadline) return "";
  const str = deadline.trim();

  // Pattern 1: HH:mm - HH:mm, DD/MM/YYYY
  const rangePattern = /^(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})$/;
  const matchRange = str.match(rangePattern);
  if (matchRange) {
    return `${matchRange[2]} ${matchRange[1]}`;
  }

  // Pattern 2: HH:mm, DD/MM/YYYY
  const singlePattern = /^(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})$/;
  const matchSingle = str.match(singlePattern);
  if (matchSingle) {
    return `${matchSingle[2]} ${matchSingle[1]}`;
  }

  // Pattern 3: HH:mm, DD/MM/YYYY - HH:mm, DD/MM/YYYY (SPCK)
  const spckPattern = /^(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})$/;
  const matchSpck = str.match(spckPattern);
  if (matchSpck) {
    return `${matchSpck[2]} ${matchSpck[1]} - ${matchSpck[4]} ${matchSpck[3]}`;
  }

  return str;
}

/**
 * Tự động tính toán hạn nộp bài mặc định:
 * - Buổi 1 -> Checkpoint 2: [Ngày học] [Giờ bắt đầu - Giờ kết thúc] của từng buổi (Chuẩn Ngày Tháng Năm Giờ Phút)
 * - Giai đoạn Sản phẩm cuối khóa (từ buổi ngay sau Checkpoint 2 đến buổi cuối):
 *   Toàn bộ các buổi trong giai đoạn này đều có chung hạn nộp:
 *   [Ngày học Giờ bắt đầu buổi sau CP2] - [Ngày học Giờ kết thúc buổi cuối]
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
      ? `${formatVnDate(postCpSlot.date)} ${formatVnTime(postCpSlot.startTime)}`
      : "";
    const endStr = finalSlot
      ? `${formatVnDate(finalSlot.date)} ${formatVnTime(finalSlot.endTime)}`
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
      // Các buổi từ buổi 1 đến Checkpoint 2: Hạn nộp chuẩn Ngày Tháng Năm Giờ Phút
      if (tStart && tEnd) {
        defaultDeadline = `${dateStr} ${tStart} - ${tEnd}`;
      } else if (dateStr) {
        defaultDeadline = `Ngày ${dateStr}`;
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

/**
 * Tính danh sách các buổi học thường (các buổi không thuộc CP1, CP2 và SPCK)
 */
export function calculateRegularSessions(
  slotsCount: number,
  cp1?: number | null,
  cp2?: number | null,
  finalProjectSession?: number | null
): number[] {
  const specialSessions = new Set<number>();
  if (cp1) specialSessions.add(cp1);
  if (cp2) specialSessions.add(cp2);

  // SPCK bắt đầu từ buổi ngay sau CP2 (hoặc tại finalProjectSession)
  const spckStart = cp2 ? cp2 + 1 : (finalProjectSession || null);

  const regular: number[] = [];
  for (let i = 1; i <= slotsCount; i++) {
    if (specialSessions.has(i)) continue;
    if (spckStart && i >= spckStart) continue;
    regular.push(i);
  }
  return regular;
}

/**
 * Trích xuất thời điểm bắt đầu và kết thúc của hạn nộp bài
 */
export function parseSessionDeadlineTimes(
  deadline?: string | null,
  slotDate?: string | null,
  slotStartTime?: string | null,
  slotEndTime?: string | null
): { startTime: Date | null; endTime: Date | null } {
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  if (slotStartTime) {
    const d = new Date(slotStartTime);
    if (!isNaN(d.getTime())) startTime = d;
  }
  if (slotEndTime) {
    const d = new Date(slotEndTime);
    if (!isNaN(d.getTime())) endTime = d;
  }

  if (!deadline) {
    return { startTime, endTime };
  }

  const str = deadline.trim();

  // Pattern 1: 'DD/MM/YYYY HH:mm - HH:mm' (e.g. '26/08/2026 18:30 - 20:30')
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (m1) {
    const [, d, m, y, sh, smin, eh, emin] = m1;
    startTime = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${sh.padStart(2, "0")}:${smin}:00+07:00`);
    endTime = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${eh.padStart(2, "0")}:${emin}:00+07:00`);
    return { startTime, endTime };
  }

  // Pattern 2: 'HH:mm - HH:mm, DD/MM/YYYY' (e.g. '18:00 - 20:00, 02/07/2026')
  const m2 = str.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const [, sh, smin, eh, emin, d, m, y] = m2;
    startTime = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${sh.padStart(2, "0")}:${smin}:00+07:00`);
    endTime = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${eh.padStart(2, "0")}:${emin}:00+07:00`);
    return { startTime, endTime };
  }

  // Pattern 3: Range across dates (e.g. '16/09/2026 18:30 - 28/10/2026 20:30')
  const m3 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m3) {
    const [, sd, sm, sy, sh, smin, ed, em, ey, eh, emin] = m3;
    startTime = new Date(`${sy}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}T${sh.padStart(2, "0")}:${smin}:00+07:00`);
    endTime = new Date(`${ey}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}T${eh.padStart(2, "0")}:${emin}:00+07:00`);
    return { startTime, endTime };
  }

  // Pattern 4: Single 'DD/MM/YYYY HH:mm'
  const m4 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m4) {
    const [, d, m, y, eh, emin] = m4;
    endTime = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${eh.padStart(2, "0")}:${emin}:00+07:00`);
    return { startTime, endTime };
  }

  // Pattern 5: Single 'HH:mm, DD/MM/YYYY'
  const m5 = str.match(/^(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m5) {
    const [, eh, emin, d, m, y] = m5;
    endTime = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${eh.padStart(2, "0")}:${emin}:00+07:00`);
    return { startTime, endTime };
  }

  // Direct Date parser
  const directDate = new Date(str);
  if (!isNaN(directDate.getTime())) {
    endTime = directDate;
  }

  return { startTime, endTime };
}

export type SessionStatusType = "upcoming" | "open" | "late_allowed" | "expired";

export interface SessionDeadlineStatus {
  status: SessionStatusType;
  isUpcoming: boolean;
  isOpen: boolean;
  isLate: boolean;
  isExpired: boolean;
  canSubmit: boolean;
  statusMessage: string;
  badgeText: string;
  badgeColor: "blue" | "green" | "yellow" | "red";
}

/**
 * Tính toán 4 trạng thái chuẩn cho một buổi học:
 * 1. Xanh dương (upcoming): Chưa mở / Sắp mở (now < startTime)
 * 2. Xanh lá (open): Đang trong hạn (now >= startTime && now <= deadline)
 * 3. Vàng (late_allowed): Hết hạn chính thức nhưng nộp muộn vẫn cho phép (now > deadline && now <= lateDeadline)
 * 4. Đỏ (expired): Hết hạn nộp bài (now > deadline)
 */
export function calculateSessionStatus(
  deadline?: string | null,
  lateDeadline?: string | null,
  slotDate?: string | null,
  slotStartTime?: string | null,
  slotEndTime?: string | null
): SessionDeadlineStatus {
  const now = Date.now();
  const { startTime, endTime } = parseSessionDeadlineTimes(deadline, slotDate, slotStartTime, slotEndTime);

  const startMs = startTime ? startTime.getTime() : null;
  const endMs = endTime ? endTime.getTime() : null;

  let lateEndMs: number | null = null;
  if (lateDeadline) {
    const parsedLate = parseSessionDeadlineTimes(lateDeadline).endTime;
    if (parsedLate && !isNaN(parsedLate.getTime())) {
      lateEndMs = parsedLate.getTime();
    }
  }

  // 1. Chưa mở (now < startMs)
  if (startMs && now < startMs) {
    return {
      status: "upcoming",
      isUpcoming: true,
      isOpen: false,
      isLate: false,
      isExpired: false,
      canSubmit: false,
      statusMessage: "Chưa mở nộp bài",
      badgeText: "Chưa mở",
      badgeColor: "blue",
    };
  }

  // 2. Không xác định được hạn chót -> Mặc định còn hạn
  if (!endMs) {
    return {
      status: "open",
      isUpcoming: false,
      isOpen: true,
      isLate: false,
      isExpired: false,
      canSubmit: true,
      statusMessage: "Đang trong thời hạn nộp",
      badgeText: "Còn hạn",
      badgeColor: "green",
    };
  }

  // 3. Đang trong hạn chính thức (now <= endMs)
  if (now <= endMs) {
    return {
      status: "open",
      isUpcoming: false,
      isOpen: true,
      isLate: false,
      isExpired: false,
      canSubmit: true,
      statusMessage: "Đang trong thời hạn nộp",
      badgeText: "Còn hạn",
      badgeColor: "green",
    };
  }

  // 4. Quá hạn chính thức: Kiểm tra nộp trễ
  if (lateEndMs && now <= lateEndMs) {
    return {
      status: "late_allowed",
      isUpcoming: false,
      isOpen: false,
      isLate: true,
      isExpired: false,
      canSubmit: true,
      statusMessage: "Hạn chính thức đã hết (Cho phép nộp muộn)",
      badgeText: "Nộp muộn",
      badgeColor: "yellow",
    };
  }

  // 5. Quá hạn hoàn toàn -> Hết hạn nộp (Đỏ, khóa luôn chỗ nộp bài)
  return {
    status: "expired",
    isUpcoming: false,
    isOpen: false,
    isLate: false,
    isExpired: true,
    canSubmit: false,
    statusMessage: "Đã hết hạn nộp bài",
    badgeText: "Hết hạn",
    badgeColor: "red",
  };
}

