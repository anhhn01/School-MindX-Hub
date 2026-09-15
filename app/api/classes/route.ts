import { NextRequest, NextResponse } from "next/server";
import { getUserCentres } from "@/lib/services/user-centres-service";
import { fetchClassesFromLms, searchClassByCodeFromLms } from "@/lib/services/lms-service";
import {
  getManagedClasses,
  addManagedClass,
  updateManagedClass,
  getAllManagedClassesMap,
  calculateDefaultDeadlines,
  compareClassWithLms,
  ManagedClass,
} from "@/lib/services/managed-classes-service";
import {
  syncStudentsForClass,
  getAllExistingStudentCodes,
  getStudentsByClassId,
  getAllManagedStudentsMap,
} from "@/lib/services/managed-students-service";
import { generateStudentCode } from "@/lib/types/managed-student";
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
    } catch (e) {
      // Token invalid
    }
  }

  if (!currentUserId) return null;

  // Lấy chi tiết thông tin họ tên, mã LMS và vai trò từ Supabase
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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "managed"; // "managed" | "find" | "search"
    const classCode = searchParams.get("code")?.trim();
    const centreFilter = searchParams.get("centreId");
    const statusFilter = searchParams.get("status"); // "ALL", "OPEN", "RUNNING", "FINISHED"
    const search = searchParams.get("search")?.trim().toLowerCase();

    // 1. Xác định User ID, Role & Cookie Token
    const authUser = await getAuthenticatedUser(request);
    const cookieToken = request.cookies.get("id_token")?.value;

    if (!authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id: currentUserId, role: currentUserRole } = authUser;

    // 2. Lấy danh sách cơ sở trực thuộc của tài khoản
    const userCentres = await getUserCentres(currentUserId);
    if (userCentres.length === 0) {
      return NextResponse.json({
        success: true,
        userCentres: [],
        totalCount: 0,
        classes: [],
        message: "Tài khoản của bạn chưa được phân bổ cơ sở trực thuộc trong hệ thống.",
      });
    }

    const userCentreIds = new Set(userCentres.map((c) => c.id));
    let targetCentreIds: string[] = [];

    if (centreFilter && centreFilter !== "ALL" && centreFilter !== "all") {
      if (userCentreIds.has(centreFilter)) {
        targetCentreIds = [centreFilter];
      } else {
        return NextResponse.json({
          success: true,
          userCentres,
          totalCount: 0,
          classes: [],
        });
      }
    } else {
      targetCentreIds = userCentres.map((c) => c.id);
    }

    // 3. Phân quyền vai trò:
    // - Admin & Teacher Full-time: xem được TẤT CẢ các lớp (OPEN, RUNNING, FINISHED) tại các cơ sở được phân công.
    // - Teacher Part-time: CHỈ xem được các lớp do CHÍNH GIÁO VIÊN ĐÓ phụ trách.
    const isAdmin = currentUserRole === "Admin" || currentUserRole === "Super Admin";
    const isTeacherFullTime = currentUserRole === "Teacher Full-time";
    const isTeacherPartTime = currentUserRole === "Teacher Part-time";

    const isClassTaughtByCurrentUser = (cls: { teacherName?: string | null; teacherCodes?: string[] }): boolean => {
      // Admin và Teacher Full-time xem toàn bộ lớp trong cơ sở trực thuộc
      if (isAdmin || isTeacherFullTime) return true;

      // Teacher Part-time: chỉ xem lớp do mình giảng dạy
      if (isTeacherPartTime) {
        const userLmsCode = (authUser.lmsCode || "").trim().toLowerCase();
        const userFullName = (authUser.fullName || "").trim().toLowerCase();

        if (Array.isArray(cls.teacherCodes) && cls.teacherCodes.length > 0) {
          for (const code of cls.teacherCodes) {
            if (userLmsCode && code.trim().toLowerCase() === userLmsCode) return true;
          }
        }

        if (cls.teacherName) {
          const names = cls.teacherName.split(",").map((n) => {
            return n.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
          });
          for (const n of names) {
            if (userFullName && n === userFullName) return true;
            if (userLmsCode && n === userLmsCode) return true;
          }
        }

        return false;
      }

      return true;
    };

    // A0. Chức năng REAL-TIME SEARCH DROPDOWN theo tên/mã lớp từ LMS (Có phân quyền vai trò)
    if (type === "search") {
      const q = (searchParams.get("q") || searchParams.get("code") || "").trim();
      if (!q || q.length < 2) {
        return NextResponse.json({ success: true, classes: [] });
      }

      // Tra cứu từ LMS với filter_textSearch theo cơ sở trực thuộc của tài khoản (Cho phép OPEN, RUNNING, FINISHED)
      const lmsList = await fetchClassesFromLms({
        centreIds: targetCentreIds.length > 0 ? targetCentreIds : undefined,
        searchQuery: q,
        statuses: ["OPEN", "RUNNING", "FINISHED"],
        token: cookieToken,
      });

      // Lọc theo phân quyền vai trò
      const roleFilteredList = lmsList.filter(isClassTaughtByCurrentUser);

      // Lọc chính xác theo từ khóa người dùng nhập (tránh LMS fuzzy search trả về các lớp không khớp mã/tên)
      const cleanQ = q.toLowerCase().replace(/[\s\-_]/g, "");
      const lowerQ = q.toLowerCase();
      const filteredLmsList = roleFilteredList.filter((c) => {
        const cleanName = (c.name || "").toLowerCase().replace(/[\s\-_]/g, "");
        const courseName = (c.course?.name || "").toLowerCase();
        const teacherName = (c.teacherName || "").toLowerCase();
        return cleanName.includes(cleanQ) || courseName.includes(lowerQ) || teacherName.includes(lowerQ);
      });

      // Đánh dấu lớp nào đã được lưu vào Supabase managed_classes
      const managedMap = await getAllManagedClassesMap();
      const results = filteredLmsList.slice(0, 25).map((c) => ({
        ...c,
        alreadyManaged: !!managedMap[c.id],
      }));

      return NextResponse.json({
        success: true,
        classes: results,
      });
    }

    // A1. Chức năng KIỂM TRA ĐỐI CHIẾU THAY ĐỔI TỪ LMS CHO CÁC LỚP ĐÃ QUẢN LÝ
    if (type === "check_lms_changes") {
      const classIdsParam = searchParams.get("ids");
      const managedMap = await getAllManagedClassesMap();
      let targetClasses = Object.values(managedMap);

      if (classIdsParam) {
        const idSet = new Set(classIdsParam.split(",").map((s) => s.trim()).filter(Boolean));
        targetClasses = targetClasses.filter((c) => idSet.has(c.id));
      }

      // Lọc theo cơ sở trực thuộc của user
      if (targetCentreIds.length > 0) {
        const centreSet = new Set(targetCentreIds);
        targetClasses = targetClasses.filter((c) => centreSet.has(c.centreId));
      }

      // Lọc theo phân quyền vai trò (Teacher Part-time)
      targetClasses = targetClasses.filter(isClassTaughtByCurrentUser);

      if (targetClasses.length === 0) {
        return NextResponse.json({ success: true, changesMap: {} });
      }

      const targetClassIds = targetClasses.map((c) => c.id);

      // 1. Query GraphQL LMS một lần cho toàn bộ các lớp cần kiểm tra
      const freshLmsList = await fetchClassesFromLms({
        classIds: targetClassIds,
        statuses: ["OPEN", "RUNNING", "FINISHED"],
        token: cookieToken,
      });
      const freshLmsMap = new Map(freshLmsList.map((c) => [c.id, c]));

      // 2. Lấy số lượng học viên active hiện có trong Supabase của các lớp này
      const allStudentsMap = await getAllManagedStudentsMap();
      const supabaseClassStudentCount: Record<string, number> = {};
      Object.values(allStudentsMap).forEach((st) => {
        if (st.classId && (st.status || "ACTIVE") === "ACTIVE") {
          supabaseClassStudentCount[st.classId] = (supabaseClassStudentCount[st.classId] || 0) + 1;
        }
      });

      // 3. Đối chiếu so sánh từng lớp
      const changesMap: Record<string, { hasChanges: boolean; diffCount: number; diffs: any[] }> = {};

      for (const curClass of targetClasses) {
        const freshLms = freshLmsMap.get(curClass.id);
        if (!freshLms) continue;

        const currentStudentCount = supabaseClassStudentCount[curClass.id] || 0;
        const diffResult = compareClassWithLms(curClass, freshLms, currentStudentCount);

        if (diffResult.hasChanges) {
          changesMap[curClass.id] = {
            hasChanges: true,
            diffCount: diffResult.diffs.length,
            diffs: diffResult.diffs,
          };
        }
      }

      return NextResponse.json({
        success: true,
        changesMap,
      });
    }

    // A. Chức năng TÌM KIẾM THEO MÃ LỚP để thêm mới
    if (type === "find") {
      if (!classCode) {
        return NextResponse.json({ error: "Vui lòng nhập mã lớp cần tìm" }, { status: 400 });
      }

      // Tìm lớp từ LMS GraphQL
      const foundClass = await searchClassByCodeFromLms({
        classCode,
        centreIds: targetCentreIds.length > 0 ? targetCentreIds : undefined,
        token: cookieToken,
      });

      if (!foundClass) {
        return NextResponse.json(
          { error: `Không tìm thấy lớp "${classCode}" (hoặc lớp không thuộc các cơ sở trực thuộc của bạn).` },
          { status: 404 }
        );
      }

      // Ràng buộc trạng thái: Chỉ cho phép OPEN, RUNNING, FINISHED
      const classStatusUpper = (foundClass.status || "").toUpperCase();
      const allowedStatuses = ["OPEN", "RUNNING", "FINISHED"];
      if (!allowedStatuses.includes(classStatusUpper)) {
        return NextResponse.json(
          {
            error: `Lớp "${foundClass.name}" đang ở trạng thái "${foundClass.status}". Hệ thống chỉ hỗ trợ các lớp ở trạng thái Sắp mở (OPEN), Đang học (RUNNING) hoặc Đã kết thúc (FINISHED).`,
          },
          { status: 400 }
        );
      }

      // Ràng buộc Teacher Part-time: Nếu search ra lớp người khác dạy thì thông báo không tìm thấy
      if (isTeacherPartTime && !isClassTaughtByCurrentUser(foundClass)) {
        return NextResponse.json(
          { error: `Không tìm thấy lớp "${classCode}" (hoặc lớp không thuộc danh sách lớp bạn phụ trách).` },
          { status: 404 }
        );
      }

      // Kiểm tra lớp đã có trong danh sách quản lý Supabase chưa
      const managedMap = await getAllManagedClassesMap();
      const alreadyManaged = !!managedMap[foundClass.id];

      // Chuẩn hóa các mốc checkpoint và dự án cuối khóa
      const cp1 = foundClass.checkpoint1Session || foundClass.courseProcess?.checkpoint1Session || null;
      const cp2 = foundClass.checkpoint2Session || foundClass.courseProcess?.checkpoint2Session || null;
      const finalSess = foundClass.finalProjectSession || foundClass.courseProcess?.finalProjectSession || foundClass.numberOfSessions || null;

      // Xử lý danh sách học viên active kèm Mã Học Viên quy định chuẩn
      let preparedStudents: any[] = [];
      if (alreadyManaged) {
        // Lớp đã lưu trong Supabase -> Lấy danh sách học viên từ managed_students
        preparedStudents = await getStudentsByClassId(foundClass.id);
      } else {
        // Lớp mới từ LMS -> Lấy học viên active và sinh mã học viên chuẩn
        const existingCodes = await getAllExistingStudentCodes();
        const rawStudents = foundClass.students || [];
        preparedStudents = rawStudents
          .filter((s) => s.activeInClass !== false)
          .map((s) => {
            const studentCode = generateStudentCode(s.fullName, existingCodes);
            existingCodes.push(studentCode);
            return {
              id: s.id,
              studentCode,
              fullName: s.fullName,
              status: s.status || "ACTIVE",
              activeInClass: true,
              email: s.email || null,
              phoneNumber: s.phoneNumber || null,
            };
          });
      }

      const normalizedFoundClass = {
        ...foundClass,
        checkpoint1Session: cp1,
        checkpoint2Session: cp2,
        finalProjectSession: finalSess,
        students: preparedStudents,
      };

      // Tính toán hạn nộp bài mặc định
      const defaultSlots = calculateDefaultDeadlines(normalizedFoundClass);

      const targetClass = alreadyManaged
        ? {
            ...managedMap[foundClass.id],
            students: preparedStudents,
          }
        : normalizedFoundClass;

      return NextResponse.json({
        success: true,
        alreadyManaged,
        class: targetClass,
        defaultSlots,
      });
    }

    // B. Mặc định: Trả về danh sách lớp ĐANG ĐƯỢC QUẢN LÝ (Lưu trong Supabase)
    const managedList = await getManagedClasses(targetCentreIds);

    // Lọc theo phân quyền vai trò (Teacher Part-time chỉ thấy lớp do mình dạy)
    let filtered = managedList.filter(isClassTaughtByCurrentUser);

    if (statusFilter && statusFilter !== "ALL" && statusFilter !== "all") {
      filtered = filtered.filter(
        (c) => (c.status || "").toUpperCase() === statusFilter.toUpperCase()
      );
    }

    if (search) {
      filtered = filtered.filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(search);
        const centreMatch = c.centreName?.toLowerCase().includes(search);
        const courseMatch = c.courseName?.toLowerCase().includes(search);
        const teacherMatch = c.teacherName?.toLowerCase().includes(search);
        return nameMatch || centreMatch || courseMatch || teacherMatch;
      });
    }

    return NextResponse.json({
      success: true,
      userCentres,
      userRole: currentUserRole,
      totalCount: filtered.length,
      classes: filtered,
    });
  } catch (err: any) {
    console.error("Lỗi khi xử lý API classes:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy danh sách lớp học" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id: currentUserId, role: currentUserRole } = authUser;

    const body = await request.json();
    const classData = body.classData as ManagedClass;

    if (!classData || !classData.id || !classData.name) {
      return NextResponse.json({ error: "Thông tin lớp học không hợp lệ" }, { status: 400 });
    }

    // 1. Kiểm tra xem trong các giáo viên phụ trách (LEC/TA), có ít nhất 1 giáo viên đã có tài khoản trong Supabase và đã được phê duyệt (approved) chưa
    const { data: allUsers, error: usersErr } = await supabase
      .from("users")
      .select("id, full_name, lms_code, user_statuses(name)");

    if (usersErr) {
      console.error("Lỗi khi tra cứu danh sách người dùng Supabase:", usersErr);
    }

    const approvedTeacherCodes = new Set<string>();
    const approvedTeacherNames = new Set<string>();

    (allUsers || []).forEach((u: any) => {
      const statusRelation = u.user_statuses;
      const statusObj = Array.isArray(statusRelation) ? statusRelation[0] : statusRelation;
      const statusName = String(statusObj?.name || "").toLowerCase().trim();

      const isApproved =
        statusName === "approved" ||
        statusName === "đã phê duyệt" ||
        statusName.includes("phê duyệt") ||
        statusName === "active";

      if (isApproved) {
        if (u.lms_code) approvedTeacherCodes.add(u.lms_code.trim().toLowerCase());
        if (u.full_name) approvedTeacherNames.add(u.full_name.trim().toLowerCase());
      }
    });

    let hasAtLeastOneApprovedTeacher = false;

    if (Array.isArray(classData.teacherCodes) && classData.teacherCodes.length > 0) {
      for (const code of classData.teacherCodes) {
        if (code && approvedTeacherCodes.has(code.trim().toLowerCase())) {
          hasAtLeastOneApprovedTeacher = true;
          break;
        }
      }
    }

    if (!hasAtLeastOneApprovedTeacher && classData.teacherName) {
      const names = classData.teacherName.split(",").map((n) => {
        return n.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
      });
      for (const n of names) {
        if (!n) continue;
        if (approvedTeacherNames.has(n) || approvedTeacherCodes.has(n)) {
          hasAtLeastOneApprovedTeacher = true;
          break;
        }
        for (const approvedName of approvedTeacherNames) {
          if (approvedName.includes(n) || n.includes(approvedName)) {
            hasAtLeastOneApprovedTeacher = true;
            break;
          }
        }
        if (hasAtLeastOneApprovedTeacher) break;
      }
    }

    if (!hasAtLeastOneApprovedTeacher) {
      return NextResponse.json(
        {
          error: "Tài khoản này chưa được cấp quyền truy cập vào website này",
          message: "Lớp học này không có giáo viên phụ trách nào (LEC hoặc TA) có tài khoản đã được phê duyệt trên hệ thống.",
        },
        { status: 400 }
      );
    }

    // 2. Phân quyền vai trò:
    // - Admin & Teacher Full-time: được thêm các lớp thuộc cơ sở trực thuộc
    // - Teacher Part-time: được thêm các lớp do chính mình phụ trách giảng dạy
    const isAdmin = currentUserRole === "Admin" || currentUserRole === "Super Admin";
    const isTeacherFullTime = currentUserRole === "Teacher Full-time";
    const isTeacherPartTime = currentUserRole === "Teacher Part-time";

    if (isTeacherPartTime) {
      const userLmsCode = (authUser.lmsCode || "").trim().toLowerCase();
      const userFullName = (authUser.fullName || "").trim().toLowerCase();
      let teachesThisClass = false;

      if (Array.isArray(classData.teacherCodes) && classData.teacherCodes.length > 0) {
        for (const code of classData.teacherCodes) {
          if (userLmsCode && code.trim().toLowerCase() === userLmsCode) {
            teachesThisClass = true;
            break;
          }
        }
      }

      if (!teachesThisClass && classData.teacherName) {
        const names = classData.teacherName.split(",").map((n) => {
          return n.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
        });
        for (const n of names) {
          if ((userFullName && n === userFullName) || (userLmsCode && n === userLmsCode)) {
            teachesThisClass = true;
            break;
          }
        }
      }

      if (!teachesThisClass) {
        return NextResponse.json(
          { error: "Bạn chỉ có quyền thêm các lớp học do chính mình phụ trách giảng dạy." },
          { status: 403 }
        );
      }
    }

    // 2.1 Ràng buộc trạng thái: Chỉ cho phép OPEN, RUNNING, FINISHED
    const classStatusUpper = (classData.status || "").toUpperCase();
    const allowedStatuses = ["OPEN", "RUNNING", "FINISHED"];
    if (!allowedStatuses.includes(classStatusUpper)) {
      return NextResponse.json(
        { error: "Không thể thêm lớp học. Hệ thống chỉ hỗ trợ các lớp ở trạng thái Sắp mở (OPEN), Đang học (RUNNING) hoặc Đã kết thúc (FINISHED)." },
        { status: 400 }
      );
    }

    const { force } = body;
    const managedMap = await getAllManagedClassesMap();
    const existingClass = managedMap[classData.id];

    // Nếu lớp đã tồn tại trong Supabase và người dùng chưa chủ động xác nhận cập nhật đè (force !== true)
    if (existingClass && !force) {
      const diffResult = compareClassWithLms(existingClass, classData);
      return NextResponse.json({
        success: false,
        alreadyExists: true,
        hasChanges: diffResult.hasChanges,
        diffs: diffResult.diffs,
        existingClass,
        message: "Lớp học này đã tồn tại trong danh sách quản lý.",
      });
    }

    let result;
    if (existingClass && force) {
      result = await updateManagedClass(classData.id, classData, currentUserId);
    } else {
      result = await addManagedClass(classData, currentUserId);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.message || "Không thể lưu lớp học" }, { status: 400 });
    }

    // Chỉ tự động thêm hoặc cập nhật học viên nếu yêu cầu có cờ autoSyncStudents = true
    if (body.autoSyncStudents && Array.isArray(classData.students) && classData.students.length > 0) {
      try {
        await syncStudentsForClass(
          {
            id: classData.id,
            name: classData.name,
            courseName: classData.courseName,
            centreId: classData.centreId,
            centreName: classData.centreName,
          },
          classData.students,
          currentUserId
        );
      } catch (sErr) {
        console.error("Lỗi khi lưu danh sách học viên active:", sErr);
      }
    }

    return NextResponse.json({
      success: true,
      class: classData,
      message: existingClass ? "Đã cập nhật lớp học thành công" : "Thêm lớp học vào danh sách quản lý thành công",
    });
  } catch (err: any) {
    console.error("Lỗi khi thêm lớp học quản lý:", err);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi thêm lớp học" },
      { status: 500 }
    );
  }
}
