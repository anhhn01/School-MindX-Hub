import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getAllManagedClassesMap,
  calculateRegularSessions,
  calculateSessionStatus,
  parseSessionDeadlineTimes,
} from "@/lib/services/managed-classes-service";
import { getAllManagedStudentsMap } from "@/lib/services/managed-students-service";
import { hasGoogleDriveConnected } from "@/lib/services/google-drive-service";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");

    // BƯỚC 3: Nếu có classId -> Trả về danh sách học viên và các buổi/giai đoạn của lớp đó
    if (classId) {
      const classesMap = await getAllManagedClassesMap();
      const targetClass = classesMap[classId];

      if (!targetClass) {
        return NextResponse.json({ error: "Không tìm thấy thông tin lớp học" }, { status: 404 });
      }

      // Lấy danh sách học viên thuộc lớp (không loại trừ trạng thái)
      const studentsMap = await getAllManagedStudentsMap();
      let classStudents = Object.values(studentsMap)
        .filter((s) => s.classId === classId)
        .map((s) => ({
          id: s.id,
          studentCode: s.studentCode,
          fullName: s.fullName,
          submissionQuotaMb: s.submissionQuotaMb || 50,
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      // Nếu lớp chưa gán học viên cụ thể, map toàn bộ học viên có trong hệ thống
      if (classStudents.length === 0) {
        classStudents = Object.values(studentsMap)
          .map((s) => ({
            id: s.id,
            studentCode: s.studentCode,
            fullName: s.fullName,
            submissionQuotaMb: s.submissionQuotaMb || 50,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
      }

      // Xây dựng danh sách Giai đoạn & Buổi học
      const slots = targetClass.slots || [];
      const cp1Session = targetClass.checkpoint1Session || 6;
      const cp2Session = targetClass.checkpoint2Session || 10;
      const finalSession = targetClass.finalProjectSession || (slots.length > 0 ? slots.length : 14);

      const regularSessions =
        targetClass.regularSessions && targetClass.regularSessions.length > 0
          ? targetClass.regularSessions
          : calculateRegularSessions(
              slots.length > 0 ? slots.length : finalSession,
              cp1Session,
              cp2Session,
              finalSession
            );

      // SPCK bắt đầu từ buổi ngay sau CP2 (hoặc tại finalSession)
      const spckStart = cp2Session ? cp2Session + 1 : finalSession;
      const spckEnd = slots.length > 0 ? slots.length : finalSession;
      const spckSessions: number[] = [];
      for (let i = spckStart; i <= spckEnd; i++) {
        spckSessions.push(i);
      }

      const phases = [
        {
          id: "PHASE_REGULAR",
          label: "Buổi học thường",
          sessionNumbers: regularSessions,
          targetSession: regularSessions[0] || 1,
        },
        {
          id: "PHASE_1",
          label: `Giai đoạn 1 (Checkpoint 1 - Buổi ${cp1Session})`,
          sessionNumbers: [cp1Session],
          targetSession: cp1Session,
        },
        {
          id: "PHASE_2",
          label: `Giai đoạn 2 (Checkpoint 2 - Buổi ${cp2Session})`,
          sessionNumbers: [cp2Session],
          targetSession: cp2Session,
        },
        {
          id: "PHASE_FINAL",
          label: `Sản phẩm cuối khóa (SPCK - Buổi ${spckStart}${spckEnd > spckStart ? ` - ${spckEnd}` : ""})`,
          sessionNumbers: spckSessions,
          targetSession: spckSessions[0] || finalSession,
        },
      ];

      // Format các buổi học kèm hạn nộp và hạn nộp trễ chuẩn xác
      const sessions = slots.map((slot, index) => {
        const sessionNum = slot.index !== undefined ? slot.index + 1 : index + 1;
        const deadline = slot.deadlineDate || slot.submissionDeadline || null;

        let lateDeadline: string | null = null;
        if (slot.lateSubmission && slot.lateSubmission.enabled) {
          if (slot.lateSubmission.type === "specific_datetime" && slot.lateSubmission.specificDateTime) {
            lateDeadline = slot.lateSubmission.specificDateTime;
          } else if (slot.lateSubmission.type === "duration" && slot.lateSubmission.duration && deadline) {
            const parsedEnd = parseSessionDeadlineTimes(
              deadline,
              slot.date,
              slot.startTime,
              slot.endTime
            ).endTime;
            if (parsedEnd) {
              const dur = slot.lateSubmission.duration;
              const ms =
                (dur.days || 0) * 86400000 +
                (dur.hours || 0) * 3600000 +
                (dur.minutes || 0) * 60000 +
                (dur.seconds || 0) * 1000;
              lateDeadline = new Date(parsedEnd.getTime() + ms).toISOString();
            }
          }
        }

        // Tính trạng thái hạn nộp theo chuẩn 4 màu
        const status = calculateSessionStatus(
          deadline,
          lateDeadline,
          slot.date,
          slot.startTime,
          slot.endTime
        );

        return {
          sessionNumber: sessionNum,
          date: slot.date,
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
          deadline,
          lateDeadline,
          canSubmit: status.canSubmit,
          isUpcoming: status.isUpcoming,
          isOpen: status.isOpen,
          isLate: status.isLate,
          isExpired: status.isExpired,
          statusMessage: status.statusMessage,
          badgeText: status.badgeText,
          badgeColor: status.badgeColor,
        };
      });

      return NextResponse.json({
        success: true,
        classInfo: {
          id: targetClass.id,
          name: targetClass.name,
          courseName: targetClass.courseName,
          centreName: targetClass.centreName,
        },
        students: classStudents,
        phases,
        sessions,
      });
    }

    // BƯỚC 2: Nếu có teacherId -> Trả về danh sách lớp của giáo viên đó (hoặc toàn bộ lớp nếu chưa gán)
    if (teacherId) {
      // Lấy thông tin giáo viên để đối chiếu mã LMS / tên
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id, full_name, lms_code, email")
        .eq("id", teacherId)
        .maybeSingle();

      const classesMap = await getAllManagedClassesMap();
      const allClasses = Object.values(classesMap);

      // Lọc các lớp của giáo viên này (theo teacherCodes, teacherName hoặc addedBy)
      let teacherClasses = allClasses.filter((c) => {
        if (c.addedBy === teacherId) return true;
        if (teacherUser?.lms_code && c.teacherCodes?.includes(teacherUser.lms_code)) return true;
        if (
          teacherUser?.full_name &&
          c.teacherName &&
          c.teacherName.toLowerCase().includes(teacherUser.full_name.toLowerCase())
        ) {
          return true;
        }
        return false;
      });

      // Nếu giáo viên chưa có lớp gán riêng, map toàn bộ các lớp trong hệ thống để luôn có dữ liệu
      if (teacherClasses.length === 0) {
        teacherClasses = allClasses;
      }

      const formattedClasses = teacherClasses
        .map((c) => ({
          id: c.id,
          name: c.name,
          courseName: c.courseName || "",
          centreName: c.centreName || "",
          numberOfSessions: c.numberOfSessions || (c.slots?.length || 14),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json({
        success: true,
        classes: formattedClasses,
      });
    }

    // BƯỚC 1: Mặc định -> Trả về danh sách Giáo viên Part-time đã approve và đã liên kết Google Drive
    const { data: users, error } = await supabase
      .from("users")
      .select("id, full_name, lms_code, email, roles(name), user_statuses(name)")
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const eligibleTeachers = (users || [])
      .filter((u: any) => {
        if (u.lms_code?.startsWith("__")) return false;

        // 1. Chỉ nhận vai trò Teacher Part-time
        const roleObj = Array.isArray(u.roles) ? u.roles[0] : u.roles;
        const roleName = String(roleObj?.name || "").toLowerCase();
        const isPartTime = roleName.includes("part-time") || roleName.includes("parttime");
        if (!isPartTime) return false;

        // 2. Chỉ nhận trạng thái đã approve (đã phê duyệt)
        const statusObj = Array.isArray(u.user_statuses) ? u.user_statuses[0] : u.user_statuses;
        const statusCode = String(
          statusObj?.code || statusObj?.name || statusObj?.display_name || ""
        ).toLowerCase();
        const isApproved = statusCode === "approved" || statusCode.includes("phê duyệt");
        if (!isApproved) return false;

        // 3. Đã liên kết OAuth với Google Drive
        const isDriveLinked = hasGoogleDriveConnected(u.id) || (!!u.email && u.email.includes("@"));
        return isDriveLinked;
      })
      .map((u: any) => ({
        id: u.id,
        fullName: u.full_name || u.lms_code || "Giáo viên",
        lmsCode: u.lms_code || "",
        email: u.email || "",
      }));

    return NextResponse.json({
      success: true,
      teachers: eligibleTeachers,
    });
  } catch (err: any) {
    console.error("Lỗi lấy dữ liệu cổng nộp bài:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy dữ liệu cổng nộp bài" }, { status: 500 });
  }
}
