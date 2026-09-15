import fs from "fs";
import path from "path";

export interface GoogleDriveTokens {
  userId: string;
  email: string;
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
  updated_at: string;
}

const TOKENS_FILE_PATH = path.join(process.cwd(), "data", "google_drive_tokens.json");

function readTokensStore(): Record<string, GoogleDriveTokens> {
  try {
    if (!fs.existsSync(TOKENS_FILE_PATH)) {
      return {};
    }
    const content = fs.readFileSync(TOKENS_FILE_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Lỗi đọc file google_drive_tokens.json:", error);
    return {};
  }
}

function writeTokensStore(store: Record<string, GoogleDriveTokens>): void {
  try {
    const dir = path.dirname(TOKENS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (error) {
    console.error("Lỗi ghi file google_drive_tokens.json:", error);
  }
}

/**
 * Lưu trữ token Google Drive của người dùng
 */
export function saveGoogleDriveTokens(
  userId: string,
  tokenData: Omit<GoogleDriveTokens, "userId" | "updated_at">
): GoogleDriveTokens {
  const store = readTokensStore();
  const existing = store[userId] || {};

  const record: GoogleDriveTokens = {
    ...existing,
    ...tokenData,
    userId,
    // Giữ lại refresh_token cũ nếu lần cấp mới không gửi lại
    refresh_token: tokenData.refresh_token || existing.refresh_token,
    updated_at: new Date().toISOString(),
  };

  store[userId] = record;
  writeTokensStore(store);
  return record;
}

/**
 * Lấy token Google Drive theo userId
 */
export function getGoogleDriveTokens(userId: string): GoogleDriveTokens | null {
  const store = readTokensStore();
  return store[userId] || null;
}

/**
 * Kiểm tra xem người dùng đã liên kết Google Drive chưa
 */
export function hasGoogleDriveConnected(userId: string): boolean {
  const tokens = getGoogleDriveTokens(userId);
  return !!(tokens && tokens.access_token);
}

/**
 * Xóa token Google Drive của người dùng khi hủy liên kết
 */
export function removeGoogleDriveTokens(userId: string): void {
  const store = readTokensStore();
  if (store[userId]) {
    delete store[userId];
    writeTokensStore(store);
  }
}

