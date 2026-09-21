import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getAllManagedClassesMap } from "@/lib/services/managed-classes-service";
import { getAllManagedStudentsMap } from "@/lib/services/managed-students-service";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DATA_DIR = path.join(process.cwd(), "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "student_submissions_store.json");

function readSubmissionsStore(): any[] {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, "utf-8")) || [];
    }
  } catch (err) {
    console.warn("Lỗi đọc file student_submissions_store.json:", err);
  }
  return [];
}

function writeSubmissionsStore(data: any[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Lỗi ghi file student_submissions_store.json:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teacherId,
      classId,
      studentId,
      phaseId,
      sessionNumber,
      accessCode,
      submissionType,
      linkUrl,
      files,
      note,
    } = body;

    // 1. Kiểm tra đủ các trường lựa chọn theo thứ tự luồng
    if (!teacherId) {
      return NextResponse.json({ error: "Vui lòng chọn Giáo viên phụ trách." }, { status: 400 });
    }
    if (!classId) {
      return NextResponse.json({ error: "Vui lòng chọn Lớp học." }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ error: "Vui lòng chọn Học viên nộp bài." }, { status: 400 });
    }
    if (!phaseId) {
      return NextResponse.json({ error: "Vui lòng chọn Giai đoạn học tập." }, { status: 400 });
    }
    if (sessionNumber === undefined || sessionNumber === null) {
      return NextResponse.json({ error: "Vui lòng chọn Buổi học nộp bài." }, { status: 400 });
    }

    // 2. Kiểm tra thông tin lớp & học viên
    const classesMap = await getAllManagedClassesMap();
    const targetClass = classesMap[classId];
    if (!targetClass) {
      return NextResponse.json({ error: "Không tìm thấy thông tin lớp học trong hệ thống." }, { status: 404 });
    }

    const studentsMap = await getAllManagedStudentsMap();
    const targetStudent = studentsMap[studentId];
    if (!targetStudent || targetStudent.classId !== classId) {
      return NextResponse.json({ error: "Học viên không thuộc danh sách lớp học này." }, { status: 400 });
    }

    // 3. Kiểm tra hạn nộp bài
    const slots = targetClass.slots || [];
    const targetSlot = slots.find((s, idx) => (s.index || idx + 1) === Number(sessionNumber));
    const now = Date.now();

    if (targetSlot) {
      const deadline = targetSlot.deadlineDate || targetSlot.submissionDeadline;
      if (deadline) {
        const deadlineMs = new Date(deadline).getTime();
        if (!isNaN(deadlineMs)) {
          let lateDeadlineMs: number | null = null;
          if (targetSlot.lateSubmission?.enabled) {
            if (targetSlot.lateSubmission.type === "specific_datetime" && targetSlot.lateSubmission.specificDateTime) {
              lateDeadlineMs = new Date(targetSlot.lateSubmission.specificDateTime).getTime();
            } else if (targetSlot.lateSubmission.type === "duration" && targetSlot.lateSubmission.duration) {
              const dur = targetSlot.lateSubmission.duration;
              const ms =
                (dur.days || 0) * 86400000 +
                (dur.hours || 0) * 3600000 +
                (dur.minutes || 0) * 60000 +
                (dur.seconds || 0) * 1000;
              lateDeadlineMs = deadlineMs + ms;
            }
          }

          const effectiveCutoff = lateDeadlineMs !== null && !isNaN(lateDeadlineMs) ? lateDeadlineMs : deadlineMs;
          if (now > effectiveCutoff) {
            return NextResponse.json(
              { error: "Rất tiếc! Buổi học này đã quá hạn nộp bài (kể cả thời gian nộp trễ cho phép)." },
              { status: 400 }
            );
          }
        }
      }
    }

    // 4. Kiểm tra phương thức nộp bài
    const studentQuotaMb = targetStudent.submissionQuotaMb || 50;
    const quotaBytes = studentQuotaMb * 1024 * 1024;

    if (submissionType === "link") {
      if (!linkUrl || typeof linkUrl !== "string" || !linkUrl.trim()) {
        return NextResponse.json({ error: "Vui lòng nhập đường link bài làm của học viên." }, { status: 400 });
      }
    } else if (submissionType === "files") {
      if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: "Vui lòng kéo thả ít nhất 1 tệp tin bài làm." }, { status: 400 });
      }

      // Kiểm tra tổng dung lượng file nộp so với định mức của học viên
      const totalBytes = files.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0);
      if (totalBytes > quotaBytes) {
        return NextResponse.json(
          {
            error: `Tổng dung lượng tệp tin (${(totalBytes / (1024 * 1024)).toFixed(1)} MB) đã vượt quá định mức cho phép của bạn (${studentQuotaMb} MB).`,
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "Hình thức nộp bài không hợp lệ." }, { status: 400 });
    }

    // 5. Tạo bản ghi bài nộp
    const submissionRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      teacherId,
      classId,
      className: targetClass.name,
      courseName: targetClass.courseName,
      centreName: targetClass.centreName,
      studentId,
      studentCode: targetStudent.studentCode,
      studentName: targetStudent.fullName,
      phaseId,
      sessionNumber: Number(sessionNumber),
      accessCode: accessCode ? String(accessCode).trim() : null,
      submissionType,
      linkUrl: submissionType === "link" ? linkUrl.trim() : null,
      filesCount: submissionType === "files" ? files.length : 0,
      filesSummary:
        submissionType === "files"
          ? files.map((f: any) => ({ name: f.name, size: f.size, type: f.type }))
          : [],
      note: note ? String(note).trim() : "",
      submittedAt: new Date().toISOString(),
      isLate: targetSlot?.deadlineDate
        ? now > new Date(targetSlot.deadlineDate).getTime()
        : false,
    };

    // Lưu vào file local
    const store = readSubmissionsStore();
    store.unshift(submissionRecord);
    writeSubmissionsStore(store);

    // Lưu vào Supabase system_settings
    try {
      await supabase.from("system_settings").upsert({
        key: "student_submissions",
        value: store.slice(0, 500),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {}

    return NextResponse.json({
      success: true,
      message: "Chúc mừng! Bạn đã nộp bài tập thành công.",
      submission: submissionRecord,
    });
  } catch (err: any) {
    console.error("Lỗi xử lý nộp bài:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi xử lý nộp bài" }, { status: 500 });
  }
}
