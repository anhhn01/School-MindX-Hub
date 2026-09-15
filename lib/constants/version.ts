/**
 * Quản lý phiên bản hệ thống tập trung cho School MindX Hub (SMH)
 * BẮT BUỘC: Mỗi khi đẩy chức năng mới lên Git (theo Quy tắc 23),
 * tăng số hiệu phiên bản đúng chuẩn (vx.x) và cập nhật tóm tắt các chức năng chính tại đây.
 */

export interface VersionFeature {
  title: string;
  description: string;
  category: "Tính Năng Mới" | "Cải Tiến" | "Bảo Mật & Ổn Định";
}

export interface ReleaseVersion {
  version: string;
  releaseDate: string;
  title: string;
  summary: string;
  features: VersionFeature[];
}

// Phiên bản hiện tại mới nhất của hệ thống
export const CURRENT_VERSION: ReleaseVersion = {
  version: "v2.1",
  releaseDate: "15/09/2026",
  title:
    "Màn Hình Quản Lý Học Viên Độc Lập, Tinh Gọn 7 Cột Dữ Liệu, Hỗ Trợ Toàn Diện Giảng Viên & Trợ Giảng (LEC/TA)",
  summary:
    "Bổ sung màn hình Quản lý học viên độc lập với mã học viên tự sinh chuẩn hóa và tinh gọn bảng dữ liệu 7 cột. Hỗ trợ nhận diện toàn diện cả Giảng viên chính (LEC) và Trợ giảng (TA) từ LMS, tối ưu hóa điều kiện thêm lớp khi có ít nhất một giáo viên phụ trách đã được phê duyệt trên hệ thống.",
  features: [
    {
      title: "Màn Hình Quản Lý Học Viên Độc Lập & Bảng 7 Cột Tinh Gọn",
      description:
        "Tách biệt hoàn toàn Quản lý học viên thành màn hình độc lập có phân quyền riêng, tự động sinh mã học viên không trùng lặp, hỗ trợ đối chiếu học viên thời gian thực với LMS và tinh gọn bảng dữ liệu về 7 cột chuẩn rõ ràng.",
      category: "Tính Năng Mới",
    },
    {
      title: "Nhận Diện Toàn Diện Giảng Viên Chính (LEC) & Trợ Giảng (TA)",
      description:
        "Quét đồng thời từ 3 nguồn dữ liệu LMS (class teachers, session teachers, session attendance) để nhận diện đầy đủ cả Giảng viên và Trợ giảng, cấp quyền xem và quản lý lớp phân công cho cả hai vai trò.",
      category: "Tính Năng Mới",
    },
    {
      title: "Tối Ưu Điều Kiện Thêm Lớp Học Theo Giáo Viên Đã Phê Duyệt",
      description:
        "Cho phép thêm lớp học vào hệ thống quản lý khi có ít nhất 1 trong số các giáo viên phụ trách (LEC hoặc TA) đã có tài khoản và được phê duyệt trên Supabase Database.",
      category: "Cải Tiến",
    },
    {
      title: "Hiển Thị Thay Đổi Trực Tiếp Tại Từng Dòng Học Viên",
      description:
        "Trong tab danh sách học viên của lớp học, các biến động từ LMS (Họ tên, Trạng thái, v.v.) được hiển thị trực tiếp tại từng học viên kèm nút cập nhật riêng lẻ, loại bỏ hoàn toàn các banner ẩn/hiện gây phân mảnh.",
      category: "Cải Tiến",
    },
  ],
};
