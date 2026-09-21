import { NextRequest, NextResponse } from "next/server";
import {
  getSystemNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteSystemNotification,
  clearAllSystemNotifications,
} from "@/lib/services/notification-service";

export async function GET(request: NextRequest) {
  try {
    const currentUserId = request.cookies.get("user_id")?.value;
    if (!currentUserId) {
      return NextResponse.json({ success: true, notifications: [], unreadCount: 0 });
    }

    const notifications = await getSystemNotifications(true);
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    console.error("Lỗi khi lấy thông báo:", err);
    return NextResponse.json(
      { error: "Không thể lấy thông báo hệ thống" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUserId = request.cookies.get("user_id")?.value;
    if (!currentUserId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { action, id } = body;

    if (action === "mark_read" && id) {
      const success = await markNotificationAsRead(id, currentUserId);
      return NextResponse.json({ success });
    }

    if (action === "mark_all_read") {
      const count = await markAllNotificationsAsRead(currentUserId);
      return NextResponse.json({ success: true, count });
    }

    if (action === "delete" && id) {
      const success = await deleteSystemNotification(id, currentUserId);
      return NextResponse.json({ success });
    }

    if (action === "clear_all") {
      const success = await clearAllSystemNotifications(currentUserId);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  } catch (err: any) {
    console.error("Lỗi xử lý thông báo:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xử lý thông báo" },
      { status: 500 }
    );
  }
}
