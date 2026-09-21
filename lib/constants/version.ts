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
  version: "v2.3",
  releaseDate: "21/09/2026",
  title:
    "Thống Kê Lượt Truy Cập Tài Khoản & Toàn Trang Lưu Supabase, Nhắc Lịch Trải Nghiệm Telegram & Hoàn Thiện Vận Hành",
  summary:
    "Nâng cấp thống kê lượt truy cập cá nhân trên từng Dashboard và tổng lượt truy cập toàn trang (thành viên + khách) lưu trữ bền vững trên Supabase Database. Tích hợp hẹn giờ thông báo lịch trải nghiệm qua Telegram Bot, quản lý học sinh và tối ưu vận hành toàn diện.",
  features: [
    {
      title: "Thống Kê Lượt Truy Cập Tài Khoản & Toàn Trang Lưu Supabase",
      description:
        "Dashboard của từng tài khoản hiển thị chính xác số lượt truy cập của tài khoản đó. Phù hiệu nổi và tổng quan toàn trang tính toán chính xác tổng lượt truy cập của toàn bộ tài khoản cộng với khách vãng lai, lưu trữ bền vững trên Supabase.",
      category: "Tính Năng Mới",
    },
    {
      title: "Hẹn Giờ Nhắc Lịch Trải Nghiệm Qua Telegram Bot",
      description:
        "Cấu hình chu kỳ nhắc lịch trải nghiệm linh hoạt (hàng ngày, hàng tuần, hàng tháng) gửi thông báo trực tiếp qua Telegram Bot kèm định dạng HTML trực quan và tự động ghi nhật ký thông báo hệ thống.",
      category: "Tính Năng Mới",
    },
    {
      title: "Quản Lý Chỉ Tiêu & Khối Lượng Giảng Dạy Giáo Viên",
      description:
        "Tích hợp theo dõi chỉ tiêu buổi dạy, số ca phụ trách và phân bổ học sinh theo từng giáo viên trực thuộc.",
      category: "Cải Tiến",
    },
    {
      title: "Tối Ưu Hóa Hiệu Năng & Đồng Bộ LMS Thời Gian Thực",
      description:
        "Tự động tính toán tiến độ hoàn thành buổi học thực tế từ LMS, chống trùng lặp dữ liệu và bảo đảm ổn định tối đa trên môi trường Production.",
      category: "Bảo Mật & Ổn Định",
    },
  ],
};
