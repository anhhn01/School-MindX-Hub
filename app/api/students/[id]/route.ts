import { NextRequest, NextResponse } from "next/server";
import {
  getAllManagedStudentsMap,
  updateManagedStudent,
  deleteManagedStudent,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const map = await getAllManagedStudentsMap();
    const student = map[id];

    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
    }

    return NextResponse.json({ success: true, student });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy thông tin học viên" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserId = await getAuthenticatedUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const result = await updateManagedStudent(id, body, currentUserId);
    if (!result.success) {
      return NextResponse.json({ error: result.message || "Không thể cập nhật học viên" }, { status: 400 });
    }

    return NextResponse.json({ success: true, student: result.student, message: "Cập nhật học viên thành công" });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật học viên" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserId = await getAuthenticatedUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const success = await deleteManagedStudent(id);

    if (!success) {
      return NextResponse.json({ error: "Không thể xóa học viên hoặc học viên không tồn tại" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Đã xóa học viên khỏi danh sách quản lý" });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi máy chủ khi xóa học viên" }, { status: 500 });
  }
}
