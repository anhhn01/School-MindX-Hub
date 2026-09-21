import { NextRequest, NextResponse } from "next/server";
import { fetchClassByIdFromLms } from "@/lib/services/lms-service";
import {
  getAllManagedClassesMap,
  saveAllManagedClassesMap,
  compareClassWithLms,
  calculateDefaultDeadlines,
  ManagedClass,
} from "@/lib/services/managed-classes-service";
import {
  getAllManagedStudentsMap,
  syncStudentsForClass,
  getStudentsByClassId,
} from "@/lib/services/managed-students-service";
import { addSystemNotification } from "@/lib/services/notification-service";
import { jwtVerify } from "jose";

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  let currentUserId = request.cookies.get("user_id")?.value;
  if (!currentUserId) {
    const smhToken = request.cookies.get("smh_token")?.value;
    if (smhToken) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "student-mindx-hub");
        const { payload } = await jwtVerify(smhToken, secret);
        currentUserId = (payload.userId || payload.sub || payload.id) as string;
      } catch (e) {
        // Token invalid
      }
    }
  }
  return currentUserId || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserId = await getAuthenticatedUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const cookieToken = request.cookies.get("id_token")?.value;

    const map = await getAllManagedClassesMap();
    const currentClass = map[id];
    if (!currentClass) {
      return NextResponse.json({ error: "Lớp học không tồn tại trong danh sách quản lý" }, { status: 404 });
    }

    // 1. Lấy dữ liệu mới nhất từ LMS (READ-ONLY)
    const freshLms = await fetchClassByIdFromLms(id, cookieToken);
    if (!freshLms) {
      return NextResponse.json(
        { error: "Không thể lấy thông tin lớp học từ LMS" },
        { status: 502 }
      );
    }

    // 2. So sánh đối chiếu dữ liệu (kèm số lượng học viên active)
    const allStudentsMap = await getAllManagedStudentsMap(true);
    let currentStudentCount = 0;
    Object.values(allStudentsMap).forEach((st) => {
      if (st.classId === id && (st.status || "ACTIVE").toUpperCase() === "ACTIVE") {
        currentStudentCount++;
      }
    });

    if (currentStudentCount === 0 && Array.isArray(currentClass.students) && currentClass.students.length > 0) {
      currentStudentCount = currentClass.students.filter(
        (s: any) => s.activeInClass !== false && (s.status || "ACTIVE").toUpperCase() === "ACTIVE"
      ).length;
    }

    const comparison = compareClassWithLms(currentClass, freshLms, currentStudentCount);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body empty
    }

    // 3. QUY TẮC: Khi có thay đổi từ LMS hoặc khi người dùng xác nhận, TỰ ĐỘNG CẬP NHẬT VÀO SUPABASE & TẠO THÔNG BÁO HỆ THỐNG
    if (comparison.hasChanges || body.confirm === true) {
      const selectedKeys = Array.isArray(body.selectedKeys) ? new Set(body.selectedKeys) : null;
      const shouldUpdate = (field: string) => !selectedKeys || selectedKeys.has(field);

      let slots = currentClass.slots;
      // Chỉ tính lại slots nếu có thay đổi số buổi hoặc ngày học
      if (
        shouldUpdate("numberOfSessions") ||
        shouldUpdate("schedule") ||
        shouldUpdate("startDate") ||
        shouldUpdate("endDate")
      ) {
        const existingDeadlines = new Map<number, string>();
        currentClass.slots?.forEach((s) => {
          if (s.submissionDeadline) {
            existingDeadlines.set(s.index, s.submissionDeadline);
          }
        });

        const defaultSlots = calculateDefaultDeadlines(freshLms);
        slots = defaultSlots.map((s) => ({
          ...s,
          submissionDeadline: existingDeadlines.get(s.index) || s.submissionDeadline,
        }));
      }

      const totalSess = shouldUpdate("numberOfSessions")
        ? freshLms.numberOfSessions
        : currentClass.numberOfSessions;
      const cp1 = shouldUpdate("numberOfSessions")
        ? (freshLms.courseProcess?.checkpoint1Session || currentClass.checkpoint1Session)
        : currentClass.checkpoint1Session;
      const cp2 = shouldUpdate("numberOfSessions")
        ? (freshLms.courseProcess?.checkpoint2Session || currentClass.checkpoint2Session)
        : currentClass.checkpoint2Session;
      const finalSess = shouldUpdate("numberOfSessions")
        ? (freshLms.courseProcess?.finalProjectSession || currentClass.finalProjectSession)
        : currentClass.finalProjectSession;

      const { calculateRegularSessions } = await import("@/lib/types/managed-class");
      const regularSessions = calculateRegularSessions(
        totalSess || (slots?.length || 14),
        cp1,
        cp2,
        finalSess
      );

      const updatedClass: ManagedClass = {
        ...currentClass,
        status: shouldUpdate("status") ? freshLms.status : currentClass.status,
        teacherName: shouldUpdate("teacherName") ? (freshLms.teacherName || currentClass.teacherName) : currentClass.teacherName,
        teacherCodes: shouldUpdate("teacherName") ? (freshLms.teacherCodes || currentClass.teacherCodes) : currentClass.teacherCodes,
        classTime: shouldUpdate("classTime") ? (freshLms.classTime || currentClass.classTime) : currentClass.classTime,
        startDate: shouldUpdate("schedule") || shouldUpdate("startDate") ? (freshLms.startDate || currentClass.startDate) : currentClass.startDate,
        endDate: shouldUpdate("schedule") || shouldUpdate("endDate") ? (freshLms.endDate || currentClass.endDate) : currentClass.endDate,
        numberOfSessions: totalSess,
        completedSessions: shouldUpdate("numberOfSessions") || shouldUpdate("progressPercent") ? (freshLms.completedSessions ?? currentClass.completedSessions) : currentClass.completedSessions,
        progressPercent: shouldUpdate("numberOfSessions") || shouldUpdate("progressPercent") ? (freshLms.progressPercent ?? currentClass.progressPercent) : currentClass.progressPercent,
        checkpoint1Session: cp1,
        checkpoint1Date: shouldUpdate("schedule") || shouldUpdate("startDate") || shouldUpdate("endDate") ? (freshLms.courseProcess?.checkpoint1Date || currentClass.checkpoint1Date) : currentClass.checkpoint1Date,
        checkpoint2Session: cp2,
        checkpoint2Date: shouldUpdate("schedule") || shouldUpdate("startDate") || shouldUpdate("endDate") ? (freshLms.courseProcess?.checkpoint2Date || currentClass.checkpoint2Date) : currentClass.checkpoint2Date,
        finalProjectSession: finalSess,
        finalProjectDate: shouldUpdate("schedule") || shouldUpdate("startDate") || shouldUpdate("endDate") ? (freshLms.courseProcess?.finalProjectDate || currentClass.finalProjectDate) : currentClass.finalProjectDate,
        slots,
        regularSessions,
        students: shouldUpdate("students") && Array.isArray(freshLms.students) ? freshLms.students : (currentClass.students || []),
        updatedAt: new Date().toISOString(),
      };

      map[id] = updatedClass;
      await saveAllManagedClassesMap(map, currentUserId);

      // Đồng bộ danh sách học viên active nếu được chọn cập nhật
      if (shouldUpdate("students") && Array.isArray(freshLms.students)) {
        try {
          await syncStudentsForClass(
            {
              id: updatedClass.id,
              name: updatedClass.name,
              courseName: updatedClass.courseName,
              centreId: updatedClass.centreId,
              centreName: updatedClass.centreName,
            },
            freshLms.students,
            currentUserId
          );
          updatedClass.students = await getStudentsByClassId(id);
        } catch (err) {
          console.error("Lỗi đồng bộ học viên khi sync lớp học:", err);
        }
      }

      // Tạo thông báo chi tiết thay đổi để người dùng theo dõi qua Chuông & Menu
      const changeDetails = comparison.diffs.map(
        (d) => `${d.label}: "${d.oldValue || "Trống"}" ➔ "${d.newValue || "Trống"}"`
      );

      await addSystemNotification({
        title: `Tự động cập nhật thay đổi LMS: Lớp ${currentClass.name}`,
        message: `Hệ thống đã tự động đồng bộ ${comparison.diffs.length} thay đổi từ MindX LMS vào cơ sở dữ liệu Supabase.`,
        details: changeDetails,
        type: "LMS_SYNC",
        classId: currentClass.id,
        link: `/admin/inspection/classes`,
      });

      return NextResponse.json({
        success: true,
        autoUpdated: true,
        message: `Hệ thống đã tự động cập nhật ${comparison.diffs.length} thay đổi từ LMS vào Supabase thành công!`,
        updatedCount: comparison.diffs.length,
        hasChanges: false,
        diffs: [],
        updatedClass,
        lmsClass: freshLms,
      });
    }

    // 4. Nếu không có thay đổi
    return NextResponse.json({
      success: true,
      hasChanges: false,
      diffs: [],
      currentClass,
      lmsClass: freshLms,
    });
  } catch (err: any) {
    console.error("Lỗi khi đồng bộ lớp học từ LMS:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi đồng bộ lớp học từ LMS" },
      { status: 500 }
    );
  }
}
