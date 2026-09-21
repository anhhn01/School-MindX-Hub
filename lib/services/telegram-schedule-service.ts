import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchOfficeHours, OfficeHourItem } from "@/lib/services/lms-service";
import { addSystemNotification } from "@/lib/services/notification-service";

export interface TelegramReminderConfig {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  sendTime: string; // HH:mm (giờ Việt Nam, ví dụ "08:00")
  daysOfWeek: number[]; // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
  dayOfMonth: number; // 1 đến 31
  targetDateOffset: "TODAY" | "TOMORROW";
  centreFilter: "ALL" | string[];
  lastSentAt?: string;
}

const DEFAULT_CONFIG: TelegramReminderConfig = {
  enabled: false,
  frequency: "DAILY",
  sendTime: "08:00",
  daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  dayOfMonth: 1,
  targetDateOffset: "TODAY",
  centreFilter: "ALL",
};

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "trial_schedule_telegram_settings.json");

let memoryConfig: TelegramReminderConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10000;

function readLocalConfig(): TelegramReminderConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn("Lỗi đọc file trial_schedule_telegram_settings.json:", err);
  }
  return DEFAULT_CONFIG;
}

function writeLocalConfig(cfg: TelegramReminderConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (err) {
    console.warn("Lỗi ghi file trial_schedule_telegram_settings.json:", err);
  }
}

/**
 * Lấy cấu hình hẹn giờ gửi Telegram
 */
export async function getTelegramReminderConfig(forceRefresh = false): Promise<TelegramReminderConfig> {
  const now = Date.now();
  if (!forceRefresh && memoryConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return memoryConfig;
  }

  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "trial_schedule_telegram_settings")
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const merged = { ...DEFAULT_CONFIG, ...parsed };
      memoryConfig = merged;
      lastFetchTime = now;
      writeLocalConfig(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Lỗi đọc Telegram config từ Supabase:", err);
  }

  const local = readLocalConfig();
  memoryConfig = local;
  lastFetchTime = now;
  return local;
}

/**
 * Lưu cấu hình hẹn giờ gửi Telegram
 */
export async function saveTelegramReminderConfig(
  newConfig: Partial<TelegramReminderConfig>
): Promise<TelegramReminderConfig> {
  const current = await getTelegramReminderConfig();
  const merged: TelegramReminderConfig = {
    ...current,
    ...newConfig,
  };

  memoryConfig = merged;
  lastFetchTime = Date.now();
  writeLocalConfig(merged);

  try {
    await supabase.from("system_settings").upsert(
      {
        key: "trial_schedule_telegram_settings",
        value: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("Lỗi lưu Telegram config vào Supabase:", err);
  }

  return merged;
}

/**
 * Phân loại Khối môn học
 */
function classifyDepartment(
  courseLines: Array<{ id: string; name: string }> = [],
  courses: Array<{ id: string; name: string }> = []
): "CODING" | "ART" | "ROBOTICS" {
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

/**
 * Phân loại Ca học
 */
function classifyShift(isoString: string): "SÁNG" | "CHIỀU" | "TỐI" {
  const d = new Date(isoString);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  const total = hours * 60 + minutes;

  if (total <= 12 * 60) return "SÁNG";
  if (total < 17 * 60) return "CHIỀU";
  return "TỐI";
}

function formatVnTime(isoString: string): string {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const h = String(vnDate.getHours()).padStart(2, "0");
  const m = String(vnDate.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function toVnDateString(date: Date): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, "0");
  const d = String(vnDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Gửi trực tiếp tin nhắn qua Telegram Bot API
 */
export async function sendRawTelegramMessage(textHtml: string): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      success: false,
      error: "Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong .env",
    };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: textHtml,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `HTTP ${res.status}: Không thể gửi tin nhắn Telegram`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Lỗi mạng khi kết nối Telegram Bot API",
    };
  }
}

/**
 * Định dạng nội dung lịch trải nghiệm sang HTML đẹp mắt cho Telegram
 */
export function buildTrialSchedulesTelegramHtml(
  officeHours: OfficeHourItem[],
  dateStr: string
): string[] {
  const displayDate = formatDisplayDate(dateStr);
  const nowVN = new Date(Date.now() + 7 * 3600000);
  const nowStr = `${String(nowVN.getHours()).padStart(2, "0")}:${String(nowVN.getMinutes()).padStart(2, "0")} ${String(
    nowVN.getDate()
  ).padStart(2, "0")}/${String(nowVN.getMonth() + 1).padStart(2, "0")}/${nowVN.getFullYear()}`;

  // Lọc bỏ ca dạy bù
  const validItems = officeHours.filter((oh) => {
    const t = (oh.type || "").toUpperCase();
    return !t.includes("MAKEUP") && !t.includes("MAKE_UP") && !t.includes("BÙ") && !t.includes("BU");
  });

  if (validItems.length === 0) {
    return [
      `📅 <b>LỊCH TRẢI NGHIỆM • NGÀY ${displayDate}</b>\n\n` +
        `<i>🕒 Xuất thông báo lúc: ${nowStr}</i>\n` +
        `────────────────────────\n` +
        `ℹ️ <i>Hiện tại không có ca trải nghiệm nào được lên lịch cho ngày này.</i>\n\n` +
        `✨ <i>Hệ thống quản lý School MindX Hub (SMH)</i>`,
    ];
  }

  // Nhóm theo cơ sở
  const campusGroups: Record<string, OfficeHourItem[]> = {};
  for (const item of validItems) {
    const campusName = item.centre?.name || item.centre?.shortName || "Cơ sở chưa xác định";
    if (!campusGroups[campusName]) campusGroups[campusName] = [];
    campusGroups[campusName].push(item);
  }

  const deptOrder: Record<string, number> = { CODING: 1, ART: 2, ROBOTICS: 3 };
  const shiftOrder: Record<string, number> = { SÁNG: 1, CHIỀU: 2, TỐI: 3 };

  const messages: string[] = [];
  let currentHeader =
    `📅 <b>LỊCH TRẢI NGHIỆM • NGÀY ${displayDate}</b>\n` +
    `<i>🕒 Xuất thông báo lúc: ${nowStr} • Tổng: <b>${validItems.length} ca</b></i>\n` +
    `────────────────────────\n\n`;

  let currentBody = "";

  for (const [campusName, items] of Object.entries(campusGroups)) {
    // Sắp xếp ca trong cơ sở: Khối -> Ca -> Giờ bắt đầu
    items.sort((a, b) => {
      const deptA = deptOrder[classifyDepartment(a.courseLines, a.courses)] || 99;
      const deptB = deptOrder[classifyDepartment(b.courseLines, b.courses)] || 99;
      if (deptA !== deptB) return deptA - deptB;

      const shiftA = shiftOrder[classifyShift(a.startTime)] || 99;
      const shiftB = shiftOrder[classifyShift(b.startTime)] || 99;
      if (shiftA !== shiftB) return shiftA - shiftB;

      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    let campusBlock = `🏢 <b>CƠ SỞ: ${campusName.toUpperCase()}</b> (<i>${items.length} ca</i>)\n`;

    for (const item of items) {
      const dept = classifyDepartment(item.courseLines, item.courses);
      const shift = classifyShift(item.startTime);
      const startT = formatVnTime(item.startTime);
      const endT = formatVnTime(item.endTime);
      const mentorName = item.teacher?.fullName || "Chưa có mentor";
      const studentCount =
        item.studentCount ??
        (item.appointments ? item.appointments.filter((a) => a.status === "ACTIVE" || !a.status).length : 0);
      const note = (item.note || item.managerNote || "").trim();

      const deptEmoji = dept === "CODING" ? "💻" : dept === "ART" ? "🎨" : "🤖";

      campusBlock += `• [${shift}] ${deptEmoji} <b>${dept}</b> (${startT} - ${endT})\n`;
      campusBlock += `   👤 Mentor: <b>${mentorName}</b> | 👥 <b>${studentCount}</b> học viên\n`;
      if (note) {
        campusBlock += `   📝 <i>${note}</i>\n`;
      }
    }
    campusBlock += `\n`;

    // Kiểm tra độ dài nếu vượt quá 3500 ký tự (Telegram max là 4096)
    if ((currentHeader + currentBody + campusBlock).length > 3500) {
      messages.push(currentHeader + currentBody + `────────────────────────\n✨ <i>School MindX Hub (SMH)</i>`);
      currentHeader = `📅 <b>LỊCH TRẢI NGHIỆM • ${displayDate} (Tiếp theo)</b>\n────────────────────────\n\n`;
      currentBody = campusBlock;
    } else {
      currentBody += campusBlock;
    }
  }

  if (currentBody) {
    messages.push(currentHeader + currentBody + `────────────────────────\n✨ <i>Hệ thống quản lý School MindX Hub (SMH)</i>`);
  }

  return messages;
}

/**
 * Thực hiện truy vấn và gửi lịch trải nghiệm qua Telegram
 */
export async function executeTrialSchedulesTelegramReminder(options?: {
  forceDate?: string;
  testMode?: boolean;
}): Promise<{
  success: boolean;
  date: string;
  totalShifts: number;
  message: string;
  error?: string;
}> {
  const config = await getTelegramReminderConfig();

  // Xác định ngày
  let targetDateStr = options?.forceDate;
  if (!targetDateStr) {
    const d = new Date();
    if (config.targetDateOffset === "TOMORROW") {
      d.setDate(d.getDate() + 1);
    }
    targetDateStr = toVnDateString(d);
  }

  // Tính timeFrom & timeTo múi giờ VN (00:00:00 -> 23:59:59.999)
  const [year, month, day] = targetDateStr.split("-").map(Number);
  const timeFrom = new Date(Date.UTC(year, month - 1, day, 0 - 7, 0, 0, 0)).toISOString();
  const timeTo = new Date(Date.UTC(year, month - 1, day, 23 - 7, 59, 59, 999)).toISOString();

  let targetCentres: string[] | undefined = undefined;
  if (Array.isArray(config.centreFilter) && config.centreFilter.length > 0) {
    targetCentres = config.centreFilter;
  }

  // Lấy dữ liệu Office Hours từ LMS
  const officeHours = await fetchOfficeHours({
    centreIds: targetCentres,
    timeFrom,
    timeTo,
  });

  // Tạo nội dung tin nhắn HTML
  const messageChunks = buildTrialSchedulesTelegramHtml(officeHours, targetDateStr);

  // Gửi lần lượt các chunks qua Telegram
  let sendErrors: string[] = [];
  for (const chunk of messageChunks) {
    const res = await sendRawTelegramMessage(chunk);
    if (!res.success && res.error) {
      sendErrors.push(res.error);
    }
  }

  const displayDate = formatDisplayDate(targetDateStr);
  const validShifts = officeHours.filter((oh) => {
    const t = (oh.type || "").toUpperCase();
    return !t.includes("MAKEUP") && !t.includes("MAKE_UP") && !t.includes("BÙ") && !t.includes("BU");
  });

  if (sendErrors.length > 0) {
    return {
      success: false,
      date: targetDateStr,
      totalShifts: validShifts.length,
      message: `Gửi thông báo Telegram thất bại: ${sendErrors.join("; ")}`,
      error: sendErrors.join("; "),
    };
  }

  // Cập nhật lastSentAt
  await saveTelegramReminderConfig({
    lastSentAt: new Date().toISOString(),
  });

  // Thêm thông báo hệ thống để người dùng kiểm tra qua chuông & menu
  await addSystemNotification({
    title: options?.testMode
      ? `Gửi thử thông báo Lịch trải nghiệm Telegram thành công`
      : `Đã gửi thông báo Lịch trải nghiệm qua Telegram`,
    message: `Đã gửi lịch trải nghiệm ngày ${displayDate} (${validShifts.length} ca) tới nhóm Telegram đã cấu hình.`,
    type: "TELEGRAM_REMINDER",
    details: [
      `Ngày trải nghiệm: ${displayDate}`,
      `Tổng số ca gửi: ${validShifts.length} ca`,
      `Chế độ: ${options?.testMode ? "Gửi thử nghiệm (Test mode)" : "Tự động theo lịch hẹn"}`,
    ],
    link: "/admin/inspection/trial_schedules",
  });

  return {
    success: true,
    date: targetDateStr,
    totalShifts: validShifts.length,
    message: `Đã gửi thành công lịch trải nghiệm ngày ${displayDate} (${validShifts.length} ca) qua Telegram!`,
  };
}

/**
 * Kiểm tra xem có đến giờ gửi lịch trình hẹn giờ hay không
 */
export async function checkAndTriggerTelegramSchedule(): Promise<{
  triggered: boolean;
  reason?: string;
  result?: any;
}> {
  const config = await getTelegramReminderConfig();
  if (!config.enabled) {
    return { triggered: false, reason: "Tính năng hẹn giờ gửi Telegram đang TẮT." };
  }

  // Lấy giờ hiện tại Việt Nam (UTC+7)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const vnNow = new Date(utc + 7 * 3600000);

  const currentHour = String(vnNow.getHours()).padStart(2, "0");
  const currentMinute = String(vnNow.getMinutes()).padStart(2, "0");
  const currentTime = `${currentHour}:${currentMinute}`;
  const currentDayOfWeek = vnNow.getDay(); // 0: CN, 1: T2, ..., 6: T7
  const currentDayOfMonth = vnNow.getDate();

  // Kiểm tra thời gian gửi: cho phép lệch trong vòng 10 phút
  const [targetH, targetM] = (config.sendTime || "08:00").split(":").map(Number);
  const targetTotalMinutes = targetH * 60 + targetM;
  const currentTotalMinutes = vnNow.getHours() * 60 + vnNow.getMinutes();

  const diffMinutes = currentTotalMinutes - targetTotalMinutes;
  if (diffMinutes < 0 || diffMinutes > 15) {
    return {
      triggered: false,
      reason: `Chưa đến khung giờ gửi (${config.sendTime}). Giờ hiện tại: ${currentTime}`,
    };
  }

  // Kiểm tra tần suất
  if (config.frequency === "WEEKLY") {
    if (!config.daysOfWeek.includes(currentDayOfWeek)) {
      return {
        triggered: false,
        reason: `Hôm nay (Thứ ${currentDayOfWeek === 0 ? "CN" : currentDayOfWeek + 1}) không nằm trong danh sách ngày gửi hàng tuần.`,
      };
    }
  } else if (config.frequency === "MONTHLY") {
    if (currentDayOfMonth !== config.dayOfMonth) {
      return {
        triggered: false,
        reason: `Hôm nay (Ngày ${currentDayOfMonth}) không phải ngày hẹn gửi hàng tháng (Ngày ${config.dayOfMonth}).`,
      };
    }
  }

  // Kiểm tra xem hôm nay đã gửi chưa (dựa vào lastSentAt)
  if (config.lastSentAt) {
    const lastDate = toVnDateString(new Date(config.lastSentAt));
    const todayDate = toVnDateString(now);
    if (lastDate === todayDate) {
      return {
        triggered: false,
        reason: `Đã gửi thông báo cho ngày hôm nay (${todayDate}) lúc ${config.lastSentAt}.`,
      };
    }
  }

  // Đủ điều kiện gửi
  const result = await executeTrialSchedulesTelegramReminder({ testMode: false });
  return {
    triggered: true,
    result,
  };
}
