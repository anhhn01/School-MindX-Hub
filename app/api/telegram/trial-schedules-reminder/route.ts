import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramReminderConfig,
  saveTelegramReminderConfig,
  executeTrialSchedulesTelegramReminder,
  checkAndTriggerTelegramSchedule,
  TelegramReminderConfig,
} from "@/lib/services/telegram-schedule-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkCron = searchParams.get("check_cron");

    if (checkCron === "1") {
      const cronResult = await checkAndTriggerTelegramSchedule();
      return NextResponse.json({ success: true, cronResult });
    }

    const config = await getTelegramReminderConfig(true);
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    console.error("Lỗi GET Telegram reminder config:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi máy chủ khi lấy cấu hình Telegram" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "save";

    if (action === "save") {
      const newConfig: Partial<TelegramReminderConfig> = body.config || {};
      const saved = await saveTelegramReminderConfig(newConfig);
      return NextResponse.json({
        success: true,
        message: "Đã lưu cài đặt hẹn giờ Telegram thành công!",
        config: saved,
      });
    }

    if (action === "test_send" || action === "trigger_now") {
      const testMode = action === "test_send";
      const forceDate = body.targetDate; // Ví dụ: "2026-09-22"
      const result = await executeTrialSchedulesTelegramReminder({
        forceDate,
        testMode,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || result.message,
            message: result.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        totalShifts: result.totalShifts,
        date: result.date,
      });
    }

    return NextResponse.json(
      { success: false, error: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Lỗi POST Telegram reminder:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi máy chủ khi xử lý yêu cầu Telegram" },
      { status: 500 }
    );
  }
}
