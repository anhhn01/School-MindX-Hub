import { NextRequest, NextResponse } from "next/server";
import {
  getAllManagedStudentsMap,
  saveAllManagedStudentsMap,
} from "@/lib/services/managed-students-service";
import { fetchClassByIdFromLms } from "@/lib/services/lms-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const body = await request.json().catch(() => ({}));
    const confirm = body.confirm === true;

    const studentsMap = await getAllManagedStudentsMap();
    const currentStudent = studentsMap[studentId];

    if (!currentStudent) {
      return NextResponse.json(
        { error: "Không tìm thấy học viên trong danh sách quản lý" },
        { status: 404 }
      );
    }

    // Lấy thông tin lớp học mới nhất từ LMS để đối chiếu học viên
    const lmsClass = await fetchClassByIdFromLms(currentStudent.classId);
    if (!lmsClass) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin lớp học trên LMS để đối chiếu" },
        { status: 404 }
      );
    }

    const lmsStudent = (lmsClass.students || []).find((s) => s.id === studentId);
    if (!lmsStudent) {
      // Học viên không còn trong danh sách active trên LMS của lớp này.
      // Kiểm tra xem học viên có chuyển sang lớp học khác trong danh sách lớp quản lý hay không
      const { getAllManagedClassesMap } = await import("@/lib/services/managed-classes-service");
      const classMap = await getAllManagedClassesMap();
      let transferredClass: any = null;

      for (const [cId, cls] of Object.entries(classMap)) {
        if (cId === currentStudent.classId) continue;
        try {
          const checkCls = await fetchClassByIdFromLms(cId);
          const found = (checkCls?.students || []).find((s) => s.id === studentId);
          if (found) {
            transferredClass = { ...cls, studentData: found };
            break;
          }
        } catch (_) {}
      }

      if (transferredClass) {
        // Phát hiện học viên đã chuyển lớp
        if (!confirm) {
          return NextResponse.json({
            success: true,
            hasChanges: true,
            diffs: [
              {
                field: "className",
                label: "Lớp học (Phát hiện chuyển lớp)",
                oldValue: `${currentStudent.className} (GV: ${currentStudent.teacherName || currentStudent.lastTeacherName || "Chưa gán"})`,
                newValue: `${transferredClass.name} (GV: ${transferredClass.teacherName || "Chưa gán"})`,
              },
              {
                field: "status",
                label: "Trạng thái",
                oldValue: currentStudent.status || "ACTIVE",
                newValue: transferredClass.studentData.status || "ACTIVE",
              },
            ],
          });
        } else {
          // Lưu vết lớp và giáo viên cũ
          currentStudent.lastClassId = currentStudent.classId;
          currentStudent.lastClassName = currentStudent.className;
          currentStudent.lastTeacherName = currentStudent.teacherName || currentStudent.lastTeacherName;
          currentStudent.lastTeacherCodes = currentStudent.teacherCodes || currentStudent.lastTeacherCodes;

          // Cập nhật lớp và giáo viên mới
          currentStudent.classId = transferredClass.id;
          currentStudent.className = transferredClass.name;
          currentStudent.teacherName = transferredClass.teacherName;
          currentStudent.teacherCodes = transferredClass.teacherCodes || [];
          currentStudent.centreId = transferredClass.centreId;
          currentStudent.centreName = transferredClass.centreName;
          currentStudent.status = transferredClass.studentData.status || "ACTIVE";
          currentStudent.updatedAt = new Date().toISOString();

          studentsMap[studentId] = currentStudent;
          await saveAllManagedStudentsMap(studentsMap);

          return NextResponse.json({
            success: true,
            message: `Đã tự động chuyển học viên sang lớp ${transferredClass.name} do ${transferredClass.teacherName} phụ trách`,
            updatedStudent: currentStudent,
          });
        }
      }

      // Học viên không còn trong lớp và chưa xác định được lớp mới -> giữ giáo viên phụ trách gần nhất
      if (!confirm) {
        return NextResponse.json({
          success: true,
          hasChanges: true,
          diffs: [
            {
              field: "status",
              label: "Trạng thái trong lớp",
              oldValue: currentStudent.status || "ACTIVE",
              newValue: "KHÔNG CÒN HOẠT ĐỘNG (LMS)",
            },
          ],
        });
      } else {
        currentStudent.lastClassId = currentStudent.classId;
        currentStudent.lastClassName = currentStudent.className;
        currentStudent.lastTeacherName = currentStudent.teacherName || currentStudent.lastTeacherName;
        currentStudent.lastTeacherCodes = currentStudent.teacherCodes || currentStudent.lastTeacherCodes;

        currentStudent.status = "INACTIVE";
        currentStudent.updatedAt = new Date().toISOString();
        studentsMap[studentId] = currentStudent;
        await saveAllManagedStudentsMap(studentsMap);
        return NextResponse.json({
          success: true,
          message: "Đã cập nhật trạng thái học viên thành không hoạt động (lưu giữ giáo viên phụ trách gần nhất)",
          updatedStudent: currentStudent,
        });
      }
    }

    // So sánh dữ liệu học viên
    const diffs: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];

    if ((currentStudent.fullName || "").trim() !== (lmsStudent.fullName || "").trim()) {
      diffs.push({
        field: "fullName",
        label: "Họ và tên",
        oldValue: currentStudent.fullName,
        newValue: lmsStudent.fullName,
      });
    }

    if ((currentStudent.status || "").toUpperCase() !== (lmsStudent.status || "").toUpperCase()) {
      diffs.push({
        field: "status",
        label: "Trạng thái",
        oldValue: currentStudent.status || "N/A",
        newValue: lmsStudent.status || "N/A",
      });
    }

    if ((currentStudent.email || "").trim() !== (lmsStudent.email || "").trim()) {
      diffs.push({
        field: "email",
        label: "Email",
        oldValue: currentStudent.email || "(Trống)",
        newValue: lmsStudent.email || "(Trống)",
      });
    }

    if ((currentStudent.phoneNumber || "").trim() !== (lmsStudent.phoneNumber || "").trim()) {
      diffs.push({
        field: "phoneNumber",
        label: "Số điện thoại",
        oldValue: currentStudent.phoneNumber || "(Trống)",
        newValue: lmsStudent.phoneNumber || "(Trống)",
      });
    }

    if (diffs.length === 0) {
      return NextResponse.json({
        success: true,
        hasChanges: false,
        message: "Không có sự thay đổi",
      });
    }

    if (!confirm) {
      return NextResponse.json({
        success: true,
        hasChanges: true,
        diffs,
      });
    }

    // Xác nhận cập nhật
    const selectedKeys: string[] = body.selectedKeys || diffs.map((d) => d.field);
    if (selectedKeys.includes("fullName") && lmsStudent.fullName) {
      currentStudent.fullName = lmsStudent.fullName;
    }
    if (selectedKeys.includes("status") && lmsStudent.status) {
      currentStudent.status = lmsStudent.status;
    }
    if (selectedKeys.includes("email")) {
      currentStudent.email = lmsStudent.email || null;
    }
    if (selectedKeys.includes("phoneNumber")) {
      currentStudent.phoneNumber = lmsStudent.phoneNumber || null;
    }

    currentStudent.updatedAt = new Date().toISOString();
    studentsMap[studentId] = currentStudent;
    await saveAllManagedStudentsMap(studentsMap);

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật thông tin học viên ${currentStudent.fullName} từ LMS`,
      updatedStudent: currentStudent,
    });
  } catch (err: any) {
    console.error("Lỗi khi đồng bộ học viên từ LMS:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi đối chiếu học viên" }, { status: 500 });
  }
}
