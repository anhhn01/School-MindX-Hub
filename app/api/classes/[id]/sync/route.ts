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
    const allStudentsMap = await getAllManagedStudentsMap();
    let currentStudentCount = 0;
    Object.values(allStudentsMap).forEach((st) => {
      if (st.classId === id && (st.status || "ACTIVE") === "ACTIVE") {
        currentStudentCount++;
      }
    });

    const comparison = compareClassWithLms(currentClass, freshLms, currentStudentCount);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body empty
    }

    // 3. Nếu người dùng xác nhận cập nhật
    if (body.confirm === true) {
      const selectedKeys = Array.isArray(body.selectedKeys) ? new Set(body.selectedKeys) : null;
      const shouldUpdate = (field: string) => !selectedKeys || selectedKeys.has(field);

      let slots = currentClass.slots;
      // Chỉ tính lại slots nếu có thay đổi số buổi hoặc ngày học
      if (shouldUpdate("numberOfSessions") || shouldUpdate("startDate") || shouldUpdate("endDate")) {
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

      const updatedClass: ManagedClass = {
        ...currentClass,
        status: shouldUpdate("status") ? freshLms.status : currentClass.status,
        teacherName: shouldUpdate("teacherName") ? (freshLms.teacherName || currentClass.teacherName) : currentClass.teacherName,
        teacherCodes: shouldUpdate("teacherName") ? (freshLms.teacherCodes || currentClass.teacherCodes) : currentClass.teacherCodes,
        classTime: shouldUpdate("classTime") ? (freshLms.classTime || currentClass.classTime) : currentClass.classTime,
        startDate: shouldUpdate("startDate") ? (freshLms.startDate || currentClass.startDate) : currentClass.startDate,
        endDate: shouldUpdate("endDate") ? (freshLms.endDate || currentClass.endDate) : currentClass.endDate,
        numberOfSessions: shouldUpdate("numberOfSessions") ? freshLms.numberOfSessions : currentClass.numberOfSessions,
        completedSessions: shouldUpdate("numberOfSessions") || shouldUpdate("progressPercent") ? (freshLms.completedSessions ?? currentClass.completedSessions) : currentClass.completedSessions,
        progressPercent: shouldUpdate("numberOfSessions") || shouldUpdate("progressPercent") ? (freshLms.progressPercent ?? currentClass.progressPercent) : currentClass.progressPercent,
        checkpoint1Session: shouldUpdate("numberOfSessions") ? (freshLms.courseProcess?.checkpoint1Session || currentClass.checkpoint1Session) : currentClass.checkpoint1Session,
        checkpoint1Date: shouldUpdate("startDate") || shouldUpdate("endDate") ? (freshLms.courseProcess?.checkpoint1Date || currentClass.checkpoint1Date) : currentClass.checkpoint1Date,
        checkpoint2Session: shouldUpdate("numberOfSessions") ? (freshLms.courseProcess?.checkpoint2Session || currentClass.checkpoint2Session) : currentClass.checkpoint2Session,
        checkpoint2Date: shouldUpdate("startDate") || shouldUpdate("endDate") ? (freshLms.courseProcess?.checkpoint2Date || currentClass.checkpoint2Date) : currentClass.checkpoint2Date,
        finalProjectSession: shouldUpdate("numberOfSessions") ? (freshLms.courseProcess?.finalProjectSession || currentClass.finalProjectSession) : currentClass.finalProjectSession,
        finalProjectDate: shouldUpdate("startDate") || shouldUpdate("endDate") ? (freshLms.courseProcess?.finalProjectDate || currentClass.finalProjectDate) : currentClass.finalProjectDate,
        slots,
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

      const count = selectedKeys ? selectedKeys.size : comparison.diffs.length;
      return NextResponse.json({
        success: true,
        message: `Đã đồng bộ ${count} mục được chọn từ LMS thành công`,
        updatedCount: count,
        hasChanges: false,
        updatedClass,
      });
    }

    // 4. Nếu chưa xác nhận, trả về diff để Client hiển thị bảng Side-by-Side
    return NextResponse.json({
      success: true,
      hasChanges: comparison.hasChanges,
      diffs: comparison.diffs,
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
