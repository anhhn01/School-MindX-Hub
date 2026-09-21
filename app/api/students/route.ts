import { NextRequest, NextResponse } from "next/server";
import { getUserCentres } from "@/lib/services/user-centres-service";
import {
  getManagedStudents,
  deleteManagedStudent,
  syncStudentsForClass,
  getAllManagedStudentsMap,
  saveAllManagedStudentsMap,
  reviewStudentsForClass,
  addSingleStudentToManaged,
  syncSingleStudentFromLms,
  reconcileStudentsWithClasses,
} from "@/lib/services/managed-students-service";
import { normalizeTeacherName, ManagedStudent } from "@/lib/types/managed-student";
import { getAllManagedClassesMap } from "@/lib/services/managed-classes-service";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getAuthenticatedUser(
  request: NextRequest
): Promise<{ id: string; role: string; fullName: string; lmsCode: string } | null> {
  let currentUserId = request.cookies.get("user_id")?.value;
  let userRole = "";

  const smhToken = request.cookies.get("smh_token")?.value;
  if (smhToken) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "student-mindx-hub");
      const { payload } = await jwtVerify(smhToken, secret);
      if (!currentUserId) {
        currentUserId = (payload.userId || payload.sub || payload.id) as string;
      }
      userRole = (payload.role || "") as string;
    } catch (e) {}
  }

  if (!currentUserId) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("id, full_name, lms_code, roles ( name )")
    .eq("id", currentUserId)
    .maybeSingle();

  const roleName = (userRow?.roles as any)?.name || userRole || "";
  const fullName = userRow?.full_name || "";
  const lmsCode = userRow?.lms_code || "";

  return {
    id: currentUserId,
    role: roleName,
    fullName,
    lmsCode,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id: currentUserId, role: currentUserRole } = authUser;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Xử lý đối chiếu danh sách học viên của một lớp giữa LMS và Supabase
    if (type === "review") {
      const reviewClassId = searchParams.get("classId");
      if (!reviewClassId) {
        return NextResponse.json({ error: "Thiếu mã ID lớp học" }, { status: 400 });
      }
      const cookieToken = request.cookies.get("id_token")?.value;
      const reviewData = await reviewStudentsForClass(reviewClassId, cookieToken);
      return NextResponse.json(reviewData);
    }

    const centreId = searchParams.get("centreId") || "all";
    const classId = searchParams.get("classId") || "all";
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    // Lấy danh sách cơ sở trực thuộc của user
    const userCentres = await getUserCentres(currentUserId);
    if (userCentres.length === 0) {
      return NextResponse.json({
        success: true,
        students: [],
        totalCount: 0,
        userCentres: [],
      });
    }

    // Tự động đồng bộ giáo viên phụ trách và lớp học của toàn bộ học viên theo dữ liệu lớp học mới nhất
    await reconcileStudentsWithClasses();

    const userCentreIds = new Set(userCentres.map((c) => c.id));
    let students = await getManagedStudents({
      centreId: centreId !== "all" ? centreId : undefined,
      classId: classId !== "all" ? classId : undefined,
      status: status !== "all" ? status : undefined,
      search: search || undefined,
    });

    // Lọc theo cơ sở trực thuộc
    students = students.filter((s) => userCentreIds.has(s.centreId));

    // Phân quyền theo giáo viên: Admin xem toàn bộ trong cơ sở; Giáo viên chỉ xem học viên thuộc lớp mình đang phụ trách
    const isAdmin = currentUserRole === "Admin" || currentUserRole === "Super Admin";

    if (!isAdmin) {
      const classesMap = await getAllManagedClassesMap();
      const userLmsCode = (authUser.lmsCode || "").trim().toLowerCase();
      const userFullName = authUser.fullName || "";
      const userNorm = normalizeTeacherName(userFullName);
      const userId = authUser.id;

      students = students.filter((s) => {
        // A. Kiểm tra theo lớp học hiện tại trong classesMap
        const currentClass = s.classId ? classesMap[s.classId] : null;

        if (currentClass) {
          // 1. Khớp mã LMS giáo viên trong teacherCodes của lớp
          if (Array.isArray(currentClass.teacherCodes)) {
            for (const code of currentClass.teacherCodes) {
              const cNorm = code.trim().toLowerCase();
              if (userLmsCode && cNorm === userLmsCode) return true;
              if (userLmsCode && (cNorm.includes(userLmsCode) || userLmsCode.includes(cNorm))) return true;
            }
          }

          // 2. Khớp họ và tên giáo viên trong teacherName của lớp (chuẩn hóa không phân biệt LEC/TA hay tiền tố TF/GV)
          if (currentClass.teacherName) {
            const names = currentClass.teacherName.split(",").map((n) => normalizeTeacherName(n));
            for (const n of names) {
              if (userNorm && n === userNorm) return true;
            }
          }

          // 3. Khớp addedBy của lớp
          if (
            currentClass.addedBy &&
            (currentClass.addedBy === userId || currentClass.addedBy.toLowerCase() === userLmsCode)
          ) {
            return true;
          }

          // Đã xác định được lớp hiện tại nhưng Thầy Cô này KHÔNG phụ trách lớp này
          // -> Trả về false (học viên chuyển qua lớp Thầy khác thì Thầy cũ không coi được nữa)
          return false;
        }

        // B. Nếu lớp học hiện tại KHÔNG xác định được:
        // -> Giữ nguyên giáo viên phụ trách cuối cùng (lastTeacherName / lastTeacherCodes) để Thầy cuối cùng vẫn xem được
        if (Array.isArray(s.lastTeacherCodes)) {
          for (const code of s.lastTeacherCodes) {
            const cNorm = code.trim().toLowerCase();
            if (userLmsCode && cNorm === userLmsCode) return true;
            if (userLmsCode && (cNorm.includes(userLmsCode) || userLmsCode.includes(cNorm))) return true;
          }
        }
        if (s.lastTeacherName) {
          const names = s.lastTeacherName.split(",").map((n) => normalizeTeacherName(n));
          for (const n of names) {
            if (userNorm && n === userNorm) return true;
          }
        }

        // C. Fallback theo teacherName / teacherCodes đã lưu trên học viên
        if (Array.isArray(s.teacherCodes)) {
          for (const code of s.teacherCodes) {
            const cNorm = code.trim().toLowerCase();
            if (userLmsCode && cNorm === userLmsCode) return true;
            if (userLmsCode && (cNorm.includes(userLmsCode) || userLmsCode.includes(cNorm))) return true;
          }
        }
        if (s.teacherName) {
          const names = s.teacherName.split(",").map((n) => normalizeTeacherName(n));
          for (const n of names) {
            if (userNorm && n === userNorm) return true;
          }
        }

        return false;
      });
    }

    return NextResponse.json({
      success: true,
      students,
      totalCount: students.length,
      userCentres,
    });
  } catch (err: any) {
    console.error("Lỗi khi tải danh sách học viên:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy danh sách học viên" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id");
    if (!studentId) {
      return NextResponse.json({ error: "Thiếu ID học viên cần xóa" }, { status: 400 });
    }

    const success = await deleteManagedStudent(studentId);
    if (!success) {
      return NextResponse.json({ error: "Không tìm thấy học viên trong danh sách quản lý" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Đã gỡ học viên khỏi danh sách quản lý",
    });
  } catch (err: any) {
    console.error("Lỗi khi xóa học viên:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi xóa học viên" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id: currentUserId } = authUser;
    const body = await request.json();
    const { action } = body;

    // 1. Thêm 1 học viên duy nhất vào Supabase
    if (action === "add_single") {
      const { classInfo, student } = body;
      if (!classInfo?.id || !student?.id || !student?.fullName) {
        return NextResponse.json({ error: "Thông tin học viên không hợp lệ" }, { status: 400 });
      }

      const savedStudent = await addSingleStudentToManaged(classInfo, student, currentUserId);
      return NextResponse.json({
        success: true,
        message: `Đã thêm học viên ${savedStudent.fullName} (${savedStudent.studentCode}) vào hệ thống`,
        student: savedStudent,
      });
    }

    // 2. Thêm tất cả học viên mới vào Supabase
    if (action === "add_all") {
      const { classInfo, students } = body;
      if (!classInfo?.id || !Array.isArray(students) || students.length === 0) {
        return NextResponse.json({ error: "Danh sách học viên cần thêm không hợp lệ" }, { status: 400 });
      }

      const result = await syncStudentsForClass(classInfo, students, currentUserId);
      return NextResponse.json({
        success: true,
        message: `Đã thêm thành công ${result.addedCount} học viên mới vào hệ thống`,
        result,
      });
    }

    // 3. Cập nhật 1 học viên có thay đổi từ LMS
    if (action === "sync_single") {
      const { studentId, lmsData } = body;
      if (!studentId || !lmsData) {
        return NextResponse.json({ error: "Thiếu dữ liệu học viên cần cập nhật" }, { status: 400 });
      }

      const updated = await syncSingleStudentFromLms(studentId, lmsData, currentUserId);
      if (!updated) {
        return NextResponse.json({ error: "Không tìm thấy học viên để cập nhật" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật dữ liệu học viên ${updated.fullName} từ LMS thành công`,
        student: updated,
      });
    }

    // 4. Cập nhật toàn bộ các học viên có thay đổi từ LMS
    if (action === "sync_all_changed") {
      const { classInfo, students } = body;
      if (!classInfo?.id || !Array.isArray(students) || students.length === 0) {
        return NextResponse.json({ error: "Danh sách học viên cần cập nhật không hợp lệ" }, { status: 400 });
      }

      const result = await syncStudentsForClass(classInfo, students, currentUserId);
      return NextResponse.json({
        success: true,
        message: `Đã cập nhật thành công ${result.updatedCount} học viên theo dữ liệu LMS`,
        result,
      });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  } catch (err: any) {
    console.error("Lỗi khi xử lý thao tác học viên:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi thao tác dữ liệu học viên" }, { status: 500 });
  }
}

