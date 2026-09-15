import { NextRequest, NextResponse } from "next/server";
import {
  updateManagedClass,
  deleteManagedClass,
  getAllManagedClassesMap,
} from "@/lib/services/managed-classes-service";
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
    const map = await getAllManagedClassesMap();
    const item = map[id];

    if (!item) {
      return NextResponse.json({ error: "Không tìm thấy lớp học" }, { status: 404 });
    }

    return NextResponse.json({ success: true, class: item });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
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

    const result = await updateManagedClass(id, body, currentUserId);
    if (!result.success) {
      return NextResponse.json({ error: result.message || "Không thể cập nhật" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Cập nhật thành công" });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật lớp học" }, { status: 500 });
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
    const result = await deleteManagedClass(id, currentUserId);

    if (!result.success) {
      return NextResponse.json({ error: result.message || "Không thể xóa" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Đã gỡ lớp khỏi danh sách quản lý" });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi máy chủ khi xóa lớp học" }, { status: 500 });
  }
}
