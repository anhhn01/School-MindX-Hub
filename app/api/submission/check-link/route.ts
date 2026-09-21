import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { accessible: false, message: "Vui lòng nhập đường link bài làm của học viên." },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      let raw = url.trim();
      if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
        raw = "https://" + raw;
      }
      parsedUrl = new URL(raw);
    } catch {
      return NextResponse.json({
        accessible: false,
        message: "Đường link không đúng định dạng chuẩn URL (ví dụ: https://...).",
      });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    // 1. Kiểm tra nhanh đường link Canva
    if (hostname.includes("canva.com")) {
      // Link view công khai của Canva thường chứa /view, /watch, hoặc /design/
      try {
        const res = await fetch(parsedUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        });

        const finalUrl = res.url.toLowerCase();
        if (finalUrl.includes("/login") || finalUrl.includes("/signin") || res.status === 403 || res.status === 404) {
          return NextResponse.json({
            accessible: false,
            service: "Canva",
            message: "Link Canva đang bị khóa hoặc yêu cầu đăng nhập. Vui lòng mở quyền 'Bất kỳ ai có liên kết đều có thể xem'.",
          });
        }

        return NextResponse.json({
          accessible: true,
          service: "Canva",
          message: "Đường link Canva hợp lệ và đã mở quyền công khai!",
          verifiedUrl: parsedUrl.toString(),
        });
      } catch (err: any) {
        return NextResponse.json({
          accessible: false,
          service: "Canva",
          message: `Không thể kết nối đến máy chủ Canva (${err.message || "Lỗi mạng"}).`,
        });
      }
    }

    // 2. Kiểm tra đường link Google Drive / Docs / Sheets / Slides
    if (hostname.includes("drive.google.com") || hostname.includes("docs.google.com")) {
      try {
        const res = await fetch(parsedUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        });

        const finalUrl = res.url.toLowerCase();
        if (
          finalUrl.includes("accounts.google.com") ||
          finalUrl.includes("servicelogin") ||
          finalUrl.includes("/signin") ||
          res.status === 403 ||
          res.status === 404
        ) {
          return NextResponse.json({
            accessible: false,
            service: "Google Drive",
            message: "Tệp Google Drive đang bị khóa riêng tư. Vui lòng chọn 'Chia sẻ' -> chuyển thành 'Bất kỳ ai có đường liên kết'.",
          });
        }

        return NextResponse.json({
          accessible: true,
          service: "Google Drive",
          message: "Tệp Google Drive hợp lệ và đã mở quyền truy cập công khai!",
          verifiedUrl: parsedUrl.toString(),
        });
      } catch (err: any) {
        return NextResponse.json({
          accessible: false,
          service: "Google Drive",
          message: `Không thể kết nối đến Google Drive (${err.message || "Lỗi mạng"}).`,
        });
      }
    }

    // 3. Kiểm tra Figma
    if (hostname.includes("figma.com")) {
      try {
        const res = await fetch(parsedUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        });

        if (res.status === 403 || res.status === 404 || res.url.includes("/login")) {
          return NextResponse.json({
            accessible: false,
            service: "Figma",
            message: "File Figma đang ở chế độ riêng tư hoặc không tồn tại. Vui lòng chia sẻ chế độ 'Anyone with the link can view'.",
          });
        }

        return NextResponse.json({
          accessible: true,
          service: "Figma",
          message: "Liên kết Figma hợp lệ và đã mở quyền xem!",
          verifiedUrl: parsedUrl.toString(),
        });
      } catch (err: any) {
        return NextResponse.json({
          accessible: false,
          service: "Figma",
          message: `Lỗi kiểm tra liên kết Figma: ${err.message}`,
        });
      }
    }

    // 4. Kiểm tra Scratch (scratch.mit.edu)
    if (hostname.includes("scratch.mit.edu")) {
      try {
        const res = await fetch(parsedUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        });

        if (res.status === 404) {
          return NextResponse.json({
            accessible: false,
            service: "Scratch",
            message: "Dự án Scratch chưa được Chia sẻ (Shared) hoặc không tồn tại. Vui lòng bấm nút 'Share' màu cam trên Scratch trước khi nộp.",
          });
        }

        return NextResponse.json({
          accessible: true,
          service: "Scratch",
          message: "Dự án Scratch hợp lệ và đã được chia sẻ công khai!",
          verifiedUrl: parsedUrl.toString(),
        });
      } catch (err: any) {
        return NextResponse.json({
          accessible: false,
          service: "Scratch",
          message: `Lỗi kiểm tra liên kết Scratch: ${err.message}`,
        });
      }
    }

    // 5. Kiểm tra GitHub / GitLab
    if (hostname.includes("github.com") || hostname.includes("gitlab.com")) {
      try {
        const res = await fetch(parsedUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
        });

        if (res.status === 404) {
          return NextResponse.json({
            accessible: false,
            service: "GitHub",
            message: "Kho lưu trữ (Repository) đang ở chế độ Private hoặc không tồn tại. Vui lòng chuyển repo sang Public.",
          });
        }

        return NextResponse.json({
          accessible: true,
          service: "GitHub",
          message: "Kho lưu trữ GitHub công khai hợp lệ!",
          verifiedUrl: parsedUrl.toString(),
        });
      } catch (err: any) {
        return NextResponse.json({
          accessible: false,
          service: "GitHub",
          message: `Lỗi kết nối GitHub: ${err.message}`,
        });
      }
    }

    // 6. Kiểm tra các dịch vụ web khác nói chung
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      const finalUrl = res.url.toLowerCase();
      if (
        res.status >= 400 ||
        finalUrl.includes("/login") ||
        finalUrl.includes("/signin") ||
        finalUrl.includes("/auth")
      ) {
        return NextResponse.json({
          accessible: false,
          message: "Đường link yêu cầu tài khoản đăng nhập hoặc trả về lỗi không khả dụng (HTTP " + res.status + ").",
        });
      }

      return NextResponse.json({
        accessible: true,
        service: hostname,
        message: `Đường link hợp lệ và có thể truy cập trực tiếp (${hostname})!`,
        verifiedUrl: parsedUrl.toString(),
      });
    } catch (err: any) {
      return NextResponse.json({
        accessible: false,
        message: `Không thể kết nối đến trang web (${err.name === "AbortError" ? "Hết thời gian chờ 7s" : err.message || "Lỗi mạng"}).`,
      });
    }
  } catch (err: any) {
    console.error("Lỗi kiểm tra link bài làm:", err);
    return NextResponse.json({ accessible: false, message: "Lỗi máy chủ khi xác minh đường link" }, { status: 500 });
  }
}
