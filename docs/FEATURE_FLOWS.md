# Tài Liệu Luồng Hoạt Động Của Từng Chức Năng (Feature Flows) - Dự Án SMH

> **QUY TẮC BẮT BUỘC DÀNH CHO AGENT**: 
> Trước khi thực hiện bất kỳ công việc nào (phát triển tính năng, sửa bug, tối ưu UI/UX, thêm API, thay đổi DB), Agent **BẮT BUỘC PHẢI ĐỌC KỸ** tài liệu này để hiểu đúng nghiệp vụ và cấu trúc dữ liệu. 
> Khi có bất kỳ thay đổi nào về luồng hoặc thêm chức năng mới, **BẮT BUỘC CẬP NHẬT** tài liệu này ngay trong cùng commit/task.

---

## Mục Lục
1. [Kiến Trúc Tổng Thể & Mô Hình Dữ Liệu](#1-kiến-trúc-tổng-thể--mô-hình-dữ-liệu)
2. [Luồng Xác Thực & Đăng Nhập (Authentication Flow)](#2-luồng-xác-thực--đăng-nhập-authentication-flow)
3. [Luồng Bảo Vệ Tuyến Đường & Middleware (Route Guarding)](#3-luồng-bảo-vệ-tuyến-đường--middleware-route-guarding)
4. [Luồng Kiểm Tra Phiên & Đăng Xuất (Session & Logout Flow)](#4-luồng-kiểm-tra-phiên--đăng-xuất-session--logout-flow)
5. [Luồng Quản Trị Người Dùng (Admin User Management Flow)](#5-luồng-quản-trị-người-dùng-admin-user-management-flow)
   - [5.1 Lấy danh sách tài khoản](#51-lấy-danh-sách-tài-khoản)
   - [5.2 Tạo tài khoản mới](#52-tạo-tài-khoản-mới)
   - [5.3 Cập nhật trạng thái người dùng (Status Update)](#53-cập-nhật-trạng-thái-người-dùng-status-update)
   - [5.4 Cập nhật vai trò & Chính sách Single Admin (Role Update)](#54-cập-nhật-vai-trò--chính-sách-single-admin-role-update)
   - [5.5 Chỉnh sửa thông tin tài khoản (Edit User)](#55-chỉnh-sửa-thông-tin-tài-khoản-edit-user)
6. [Luồng Quản Lý Học Viên & Tự Động Điều Chuyển Giáo Viên Phụ Trách](#6-luồng-quản-lý-học-viên--tự-động-điều-chuyển-giáo-viên-phụ-trách-student-teacher-dynamic-scoping--transfer-flow)
7. [Quy Tắc Quản Trị Trạng Thái & Database Quan Trọng](#6-quy-tắc-quản-trị-trạng-thái--database-quan-trọng)

---

## 1. Kiến Trúc Tổng Thể & Mô Hình Dữ Liệu

Hệ thống **SMH (Student MindX Hub)** kết hợp 2 hệ sinh thái dịch vụ chính:
- **Supabase (PostgreSQL Database)**: Quản lý độc lập và toàn vẹn cơ sở dữ liệu quan hệ gồm 9 bảng chuyên biệt: người dùng (`users`), vai trò (`roles`), trạng thái xét duyệt (`user_statuses`), cơ sở trực thuộc (`user_centres`), cây danh mục màn hình (`menus`), ma trận phân quyền màn hình theo vai trò (`role_menu_permissions`), cài đặt hệ thống & bảo trì (`system_settings`), quản lý lớp học (`managed_classes`), và quản lý học viên (`managed_students`).
- **Firebase Auth & LMS MindX GraphQL**: Xác thực đăng nhập đối với tài khoản cán bộ/giáo viên đã có trên LMS MindX và cung cấp JWT Token (`id_token`) dùng cho việc tra cứu dữ liệu thời gian thực.

### Mô hình quan hệ thực thể (ERD Toàn Diện):

```mermaid
erDiagram
    ROLES ||--o{ USERS : "belongs to"
    USER_STATUSES ||--o{ USERS : "has status"
    USERS ||--o{ USER_CENTRES : "has assigned centres"
    ROLES ||--o{ ROLE_MENU_PERMISSIONS : "assigned to"
    MENUS ||--o{ ROLE_MENU_PERMISSIONS : "permits"
    MENUS ||--o{ MENUS : "has submenus"
    MANAGED_CLASSES ||--o{ MANAGED_STUDENTS : "enrolled in"

    USERS {
        uuid id PK
        string lms_code UK "Mã LMS / Tên đăng nhập"
        string full_name "Họ và tên"
        string email "Email liên hệ"
        string password_hash "Bcrypt hash mật khẩu"
        uuid role_id FK "FK -> roles.id"
        uuid status_id FK "FK -> user_statuses.id"
        timestamp created_at
        timestamp updated_at
    }

    ROLES {
        uuid id PK
        string name UK "Admin | Teacher Full-time | Teacher Part-time"
        timestamp created_at
    }

    USER_STATUSES {
        uuid id PK
        string name UK "approved | pending | rejected"
        timestamp created_at
    }

    USER_CENTRES {
        uuid id PK
        uuid user_id FK "FK -> users.id (ON DELETE CASCADE)"
        string centre_id "Mã định danh cơ sở LMS"
        string centre_name "Tên cơ sở đầy đủ"
        string centre_short_name "Tên viết tắt cơ sở"
        string centre_code "Mã code cơ sở"
        timestamp created_at
        timestamp updated_at
    }

    MENUS {
        uuid id PK
        string code UK "Mã định danh menu (vd: user_management, class_management)"
        string name "Tên hiển thị menu"
        string path "Đường dẫn route (vd: /[role]/system-management/users)"
        uuid parent_id FK "FK -> menus.id (Menu cha nếu là submenu)"
        integer order_index "Thứ tự sắp xếp hiển thị"
        string icon "Tên icon lucide-react"
        timestamp created_at
    }

    ROLE_MENU_PERMISSIONS {
        uuid id PK
        uuid role_id FK "FK -> roles.id (ON DELETE CASCADE)"
        uuid menu_id FK "FK -> menus.id (ON DELETE CASCADE)"
        boolean is_enabled "Trạng thái cấp quyền bật/tắt (true/false)"
        timestamp created_at
        timestamp updated_at
    }

    SYSTEM_SETTINGS {
        string key PK "Khóa cấu hình (vd: maintenance_status, global_config)"
        jsonb value "Dữ liệu cấu hình JSONB"
        timestamp updated_at
        string updated_by "Mã LMS / Tên người cập nhật"
    }

    MANAGED_CLASSES {
        string id PK "Mã lớp học (vd: LBB-ROB-ARMA12)"
        string name "Tên mã lớp"
        string status "OPEN | RUNNING | FINISHED"
        string course_name "Tên khóa học"
        string centre_id "ID cơ sở"
        string centre_name "Tên cơ sở"
        string teacher_name "Tên giáo viên phụ trách"
        jsonb teacher_codes "Mảng mã GV phụ trách"
        string class_time "Khung giờ học (vd: 18:00 - 20:00)"
        string start_date "Ngày bắt đầu"
        string end_date "Ngày kết thúc"
        integer number_of_sessions "Tổng số buổi"
        integer completed_sessions "Số buổi đã học"
        integer progress_percent "Tiến độ %"
        integer checkpoint1_session "Buổi Checkpoint 1"
        string checkpoint1_date "Hạn nộp Checkpoint 1"
        integer checkpoint2_session "Buổi Checkpoint 2"
        string checkpoint2_date "Hạn nộp Checkpoint 2"
        integer final_project_session "Buổi SP Cuối khóa"
        string final_project_date "Hạn nộp SP Cuối khóa"
        jsonb slots "Chi tiết từng buổi học & hạn nộp tùy chỉnh"
        timestamp added_at
        timestamp updated_at
        string added_by "Người thêm lớp"
    }

    MANAGED_STUDENTS {
        string id PK "ID học viên LMS"
        string student_code UK "Mã định danh học viên tự sinh (vd: VINHVQ)"
        string full_name "Họ và tên học viên"
        string status "Trạng thái (active/inactive)"
        string class_id FK "FK -> managed_classes.id (ON DELETE CASCADE)"
        string class_name "Tên lớp học đang theo học"
        string course_name "Khóa học"
        string centre_id "ID cơ sở"
        string centre_name "Tên cơ sở"
        string email "Email học viên / phụ huynh"
        string phone_number "Số điện thoại"
        timestamp added_at
        timestamp updated_at
        string added_by "Người thêm"
    }
```

---

## 2. Luồng Xác Thực & Đăng Nhập (Authentication Flow)

- **Entrypoint UI**: `app/login/page.tsx`
- **Backend API**: `app/api/auth/login/route.ts`
- **Tuyến đường constants**: `lib/constants/api-routes.ts`

### Các bước xử lý chi tiết:

1. **Người dùng nhập thông tin**:
   - Nhập thông tin đăng nhập (`lms_code`) và mật khẩu (`password`) trên giao diện đăng nhập.
2. **Kiểm tra sự tồn tại trong Supabase**:
   - Truy vấn bảng `users` trong Supabase theo `lms_code`.
   - **Nếu KHÔNG tìm thấy**: Phản hồi lỗi `403 Forbidden` với thông báo:  
     *"Xin lỗi bạn chưa có quyền truy cập vào trang website này. Vui lòng liên hệ admin nhé."*
3. **Kiểm tra trạng thái phê duyệt (Status check)**:
   - Nếu tìm thấy người dùng, kiểm tra `status` thông qua liên kết với bảng `user_statuses`.
   - **Nếu trạng thái CHƯA PHẢI `Approved`**: Phản hồi lỗi `403 Forbidden` với thông báo:  
     *"Xin lỗi bạn chưa có quyền truy cập vào trang website này. Vui lòng liên hệ admin nhé."*
4. **Phân loại tài khoản & Xác thực (khi đã được Approved)**:
   - **Trường hợp A - Tài khoản do LMS tạo (có sẵn)**:
     - **Nguyên tắc**: *Tài khoản do LMS tạo không cần lưu mật khẩu trong Supabase*.
     - Đẩy trực tiếp thông tin đăng nhập mà người dùng vừa nhập (`lms_code` và `password`) qua Firebase để xác thực (đẩy trực tiếp `lms_code` và mật khẩu, không cần đuôi email).
     - **Nếu Firebase xác thực thành công**: Nhận Firebase token (`id_token`, `refresh_token`), sau đó kiểm tra `role` của tài khoản này trong Supabase để chuyển hướng qua đúng Dashboard tương ứng (Admin -> `/admin/dashboard`, Teacher Full-time -> `/teacher-fulltime/dashboard`, Teacher Part-time -> `/teacher-parttime/dashboard`).
     - **Nếu Firebase trả sai**: Phản hồi lỗi `401 Unauthorized` với thông báo:  
       *"Xin lỗi thông tin đăng nhập chưa chính xác"*.
   - **Trường hợp B - Tài khoản do Website tạo**:
     - **Nguyên tắc**: *Tài khoản do Website tạo bắt buộc phải lưu mật khẩu dưới dạng hash (`password_hash`) trong Supabase*.
     - Lấy thông tin tài khoản mà người dùng đã nhập, so khớp mật khẩu người dùng nhập với `password_hash` lưu trong Supabase (sử dụng `bcrypt.compare`).
     - **Nếu mật khẩu không khớp**: Phản hồi lỗi `401 Unauthorized` với thông báo:  
       *"Xin lỗi thông tin đăng nhập chưa chính xác"*.
     - **Nếu mật khẩu khớp**: Mượn thông tin `LMS_FALLBACK` lưu trong `.env` (`LMS_FALLBACK_CODE` / `LMS_FALLBACK_PASSWORD`) để gửi yêu cầu lấy token hợp lệ từ Firebase, sau đó kiểm tra `role` của tài khoản trong Supabase và điều hướng qua đúng Dashboard tương ứng của role đó.

### Sơ đồ luồng đăng nhập chi tiết:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant UI as Login Page (Client)
    participant API as /api/auth/login
    participant DB as Supabase (PostgreSQL)
    participant FB as Firebase Identity Toolkit

    User->>UI: Nhập lms_code & password
    UI->>API: POST { lms_code, password }
    API->>DB: Query users JOIN user_statuses & roles WHERE lms_code = input
    alt Không tìm thấy User trong Supabase
        DB-->>API: null
        API-->>UI: 403 Forbidden ("Xin lỗi bạn chưa có quyền truy cập vào trang website này. Vui lòng liên hệ admin nhé.")
    else Tìm thấy User trong Supabase
        API->>API: Kiểm tra user_statuses (status)
        alt Status != 'Approved' (Chưa được duyệt)
            API-->>UI: 403 Forbidden ("Xin lỗi bạn chưa có quyền truy cập vào trang website này. Vui lòng liên hệ admin nhé.")
        else Status == 'Approved' (Đã duyệt)
            alt Loại 1: Tài khoản do LMS tạo (Không lưu mật khẩu trong Supabase)
                API->>FB: Đẩy trực tiếp lms_code & password qua Firebase xác thực
                alt Firebase xác thực thất bại
                    FB-->>API: Thất bại / Sai thông tin
                    API-->>UI: 401 Unauthorized ("Xin lỗi thông tin đăng nhập chưa chính xác")
                else Firebase xác thực thành công
                    FB-->>API: Trả về { idToken, refreshToken, expiresIn }
                    API->>API: Kiểm tra role trong Supabase -> Xác định Dashboard tương ứng
                    API->>UI: Thiết lập Cookies (id_token, refresh_token, user_role, v.v.)
                    API-->>UI: 200 OK -> Redirect đúng Dashboard theo Role
                end
            else Loại 2: Tài khoản do Website tạo (Bắt buộc lưu mật khẩu dưới dạng hash trong Supabase)
                API->>API: So khớp bcrypt.compare(password, user.password_hash)
                alt Mật khẩu không khớp
                    API-->>UI: 401 Unauthorized ("Xin lỗi thông tin đăng nhập chưa chính xác")
                else Mật khẩu khớp
                    API->>FB: Mượn LMS_FALLBACK trong .env để lấy token Firebase
                    FB-->>API: Trả về { idToken, refreshToken, expiresIn }
                    API->>API: Kiểm tra role trong Supabase -> Xác định Dashboard tương ứng
                    API->>UI: Thiết lập Cookies (id_token, refresh_token, user_role, v.v.)
                    API-->>UI: 200 OK -> Redirect đúng Dashboard theo Role
                end
            end
        end
    end
```

---

## 3. Luồng Bảo Vệ Tuyến Đường & Middleware (Route Guarding & Dynamic Permissions)

- **Vị trí file**: `middleware.ts`
- **Mục tiêu**: Kiểm tra phiên đăng nhập và phân quyền truy cập động theo vai trò và ma trận phân quyền màn hình.

### Logic xử lý của Middleware:
1. Đọc cookie `id_token`, `user_role`, và `user_permissions`.
2. Nếu người dùng **đã đăng nhập** và truy cập `/login` -> Tự động chuyển hướng về đúng Dashboard theo vai trò.
3. Nếu người dùng **chưa đăng nhập** và truy cập các tuyến đường được bảo vệ (`/admin/*`, `/teacher-fulltime/*`, `/teacher-parttime/*`, `/profile`, `/dashboard`) -> Tự động chuyển hướng về `/login?redirect=...`.
4. **Kiểm Soát Quyền Truy Cập Động Theo Quyền Thực Tế Của Role (Dynamic RBAC)**:
   - **Tuyến `/admin/dashboard`**: Dashboard chuyên biệt của Quản trị viên, chỉ tài khoản `Admin` mới được phép truy cập. Các vai trò khác bị chuyển hướng về đúng Dashboard của họ.
   - **Tuyến `/admin/users` (Quản lý tài khoản)**: Cho phép truy cập nếu là `Admin` HOẶC vai trò của người dùng được cấp quyền `user_management === true` (từ bảng phân quyền màn hình).
   - **Tuyến `/admin/permissions` (Phân quyền màn hình)**: Cho phép truy cập nếu là `Admin` HOẶC vai trò của người dùng được cấp quyền `screen_permission_management === true`.
   - **Tuyến `/teacher-fulltime/*`**: Cho phép `Admin` hoặc `Teacher Full-time`.
   - **Tuyến `/teacher-parttime/*`**: Cho phép `Admin` hoặc `Teacher Part-time`.

---

## 4. Luồng Kiểm Tra Phiên & Đăng Xuất (Session & Logout Flow)

### 4.1 Kiểm tra thông tin phiên (`/api/auth/me`):
- Kiểm tra cookie `smh_token` hoặc `id_token`. Nếu không có -> trả về `401 { authenticated: false }`.
- Nếu có token -> truy vấn thông tin người dùng từ Supabase Database theo thời gian thực (Real-time) và trả về `{ authenticated: true, user: { id, name, role, permissions } }`.

### 4.2 Đăng xuất (`/api/auth/logout`):
- Được gọi từ component Header User Profile Dropdown (`components/layout/AppLayout.tsx`) hoặc `components/LogoutButton.tsx`.
- Gửi yêu cầu `POST /api/auth/logout`.
- API thực hiện xóa bỏ sạch toàn bộ 7 cookies xác thực và phân quyền: `smh_token`, `id_token`, `refresh_token`, `user_id`, `user_name`, `user_role`, `user_permissions` (set `maxAge: 0` và `expires: Thu, 01 Jan 1970 00:00:00 UTC`).
- Client đồng thời xóa các cookie non-HttpOnly và thực hiện chuyển hướng cứng (`window.location.href = "/login"`) nhằm làm sạch toàn bộ cache bộ nhớ và React State, tránh tình trạng Middleware tự điều hướng ngược vào Dashboard do cookie cũ sót lại.

---

## 5. Luồng Quản Trị Người Dùng (Admin User Management Flow)

- **Entrypoint UI**: `app/admin/users/page.tsx` (Đường dẫn: `/admin/users`)
- **Backend API**: `app/api/admin/users/*` và `app/api/admin/users/check-lms`
- **Hằng số quản lý**: [api-routes.ts](file:///d:/Documents/Practice/Self%20Project/SMH/lib/constants/api-routes.ts) & [roles.ts](file:///d:/Documents/Practice/Self%20Project/SMH/lib/constants/roles.ts)

### 5.1 Hệ Thống Phân Cấp Điểm Vai Trò (Role Points Hierarchy)
- **Nguyên tắc cốt lõi**: **Điểm càng thấp, quyền hạn role càng cao**.
- Bảng phân cấp điểm vai trò:
  | Tên Role | Điểm (Points) | Cấp bậc | Mô tả & Ràng buộc |
  | :--- | :---: | :--- | :--- |
  | **Admin** | **1** | **Cao nhất** | Quản trị viên toàn hệ thống, **duy nhất 1 tài khoản** |
  | **Teacher Full-time** | **2** | Cấp trung | Giáo viên cơ hữu |
  | **Teacher Part-time** | **3** | **Thấp nhất** | Giáo viên bán thời gian / đối tác |

---

### 5.2 Thêm tài khoản mới (Create User Flow)
- **Các trường thông tin**:
  - `lms_code` (Mã LMS / Tên đăng nhập)
  - `password` (Mật khẩu)
  - `full_name` (Họ và tên)
  - `is_firebase` (Loại tài khoản: LMS có sẵn vs Do website tạo)
  - `status_code` (Trạng thái, **mặc định là `approved`**)
  - `role_name` (Vai trò)
- **Xử lý theo từng loại tài khoản**:
  1. **Loại tài khoản: Do LMS có sẵn (`is_firebase = true`)**:
     - Trường `mật khẩu` để ở chế độ **Read-only (Chỉ đọc)** và không lưu mật khẩu trong Supabase.
     - Có nút **"Kiểm tra LMS"** bên cạnh ô nhập `lms_code` (gọi `POST /api/admin/users/check-lms`).
     - Hệ thống kiểm tra xem tài khoản nào đang có `lms_code` này trên LMS MindX (qua GraphQL query `GetTeachers` và Firebase Auth):
       - **Nếu có và tìm thấy họ tên đầy đủ**: Tự động điền họ tên thật người dùng (ví dụ: *"Võ Minh Huân"*) vào trường `họ và tên` và giữ ở chế độ chỉ đọc.
       - **Nếu có mã trên LMS nhưng KHÔNG tìm thấy họ tên**: Hệ thống hiển thị thông báo *"Tìm thấy tài khoản LMS nhưng chưa có họ tên trên hệ thống. Admin có thể tự đặt họ tên bên dưới"* và **mở khóa ô Họ và tên để Admin tự nhập tay** và lưu họ tên này vào Supabase.
       - **Nếu không tồn tại trên LMS**: Hiển thị thông báo:  
         *"Không có tài khoản với mã lms_code này trên hệ thống LMS. Vui lòng kiểm tra lại."*
  2. **Loại tài khoản: Do Website tạo (`is_firebase = false`)**:
     - **Quy tắc bắt buộc kiểm tra LMS trước**: Tài khoản do website tạo là tài khoản **chưa từng có trong LMS trước đó**. Do đó, khi nhập mã LMS, hệ thống (cả frontend và backend) **bắt buộc kiểm tra bên LMS trước**:
       - **Nếu mã LMS ĐÃ TỒN TẠI trên hệ thống LMS**: Báo lỗi ngay lập tức:  
         *⚠️ "Mã LMS này đã tồn tại trên hệ thống LMS MindX ({fullName}). Tài khoản do website tạo không được trùng với LMS có sẵn. Vui lòng chọn loại 'Tài khoản LMS có sẵn' hoặc chọn mã khác."* và ngăn chặn không cho tạo.
       - **Nếu mã LMS CHƯA TỒN TẠI trên LMS (và chưa có trong Supabase)**: Cho phép tiếp tục tạo.
     - Bắt buộc phải nhập đầy đủ tất cả các trường: `lms_code`, `họ và tên`, `mật khẩu`.
     - Mật khẩu được băm an toàn bằng `bcrypt.hash(password, 10)` trước khi lưu vào Supabase.

---

### 5.3 Danh Sách Người Dùng & Phân Quyền Thao Tác (Xem / Sửa / Xóa)
- **Hiển thị**: Cột Vai trò hiển thị kèm Điểm Role: `Admin (Điểm: 1)`, `Teacher Full-time (Điểm: 2)`, `Teacher Part-time (Điểm: 3)`.
- **Quy tắc phân quyền thao tác**:
  - **Xem chi tiết (View)**: Cho phép xem thông tin đối với tất cả các tài khoản.
  - **Chỉnh sửa (Edit)**:
    - **Tài khoản do LMS có sẵn (`is_firebase = true`)**: **Chỉ được quyền xem**, tuyệt đối **không được phép sửa** (nút Sửa hiển thị "Khóa sửa").
    - **Tài khoản do Website tạo (`is_firebase = false`)**: Được quyền chỉnh sửa khi và chỉ khi thỏa mãn một trong hai điều kiện:
      1. **Là tài khoản của chính bản thân mình** (`user.id === currentUserId`).
      2. **Là các tài khoản dưới cấp role của mình** (`targetRolePoints > currentUserRolePoints`, tức điểm vai trò của tài khoản đó lớn hơn điểm của người đang đăng nhập - vì điểm càng thấp vai trò càng cao).
      *(Các trường hợp tài khoản của người khác có role ngang cấp hoặc cao hơn mình sẽ bị hiển thị "Khóa sửa" và backend chặn bằng mã lỗi 403 Forbidden).*
  - **Xóa tài khoản (Delete User Flow)**:
    - Bổ sung nút **"Xóa"** trong danh sách người dùng cho Admin quản trị.
    - **Ràng buộc an toàn**:
      - **Tuyệt đối không được phép xóa tài khoản Admin duy nhất** (nút Xóa bị khóa / disabled đối với Admin).
      - Không được phép tự xóa tài khoản của chính mình khi đang đăng nhập.
    - **Quy trình xóa**:
      1. Khi bấm nút "Xóa", hiển thị **Modal Xác Nhận Xóa Tài Khoản** nêu rõ tên người dùng, mã LMS, vai trò và cảnh báo hành động không thể hoàn tác.
      2. Khi Admin bấm "Xác nhận xóa": Gửi yêu cầu `DELETE /api/admin/users/[id]`.
      3. Backend xóa bản ghi khỏi bảng `users` trong Supabase DB và trả về phản hồi thành công (kèm dữ liệu chữ của vai trò).
      4. Giao diện tự động cập nhật lại danh sách người dùng.

---

### 5.4 Quy Tắc Single Admin & Chuyển Giao Quyền Quản Trị (Transfer Admin Policy)
- **Ràng buộc cốt lõi**:
  - **Hệ thống chỉ duy nhất có 1 người giữ vai trò Admin** (Điểm vai trò: 1).
  - Mọi sự thay đổi làm mất đi người có role Admin hiện tại (chuyển giao vai trò Admin cho tài khoản khác) **bắt buộc phải có người thay thế** và **phải có sự xác nhận từ Admin hiện tại** (qua Popup xác nhận chuyển giao).
- **Quy trình khi Admin hiện tại đồng ý chuyển giao quyền**:
  1. Tài khoản được chỉ định nhận quyền Admin mới sẽ được gán `role_id` của Admin.
  2. Tài khoản Admin cũ sẽ **tự động bị giáng chức thành cấp role thấp nhất là `Teacher Part-time` (Điểm vai trò: 3)**.
  3. Hệ thống xóa toàn bộ cookie phiên (`id_token`, `refresh_token`, `user_role`, v.v.) của Admin cũ (`forceLogout = true`) và **buộc đăng xuất ngay lập tức**.

---

### 5.5 Sơ đồ tuần tự: Chuyển giao quyền Admin

```mermaid
sequenceDiagram
    autonumber
    actor CurrentAdmin as Admin Hiện Tại (Điểm 1)
    participant UI as Admin Dashboard
    participant API as /api/admin/users/[id]/role
    participant DB as Supabase (roles & users)

    CurrentAdmin->>UI: Chọn thăng chức User B lên Admin
    UI->>CurrentAdmin: Hiển thị Modal Cảnh Báo: Admin cũ sẽ bị giáng xuống Teacher Part-time (Điểm 3) & Đăng xuất ngay
    CurrentAdmin->>UI: Nhấn "Xác nhận chuyển giao"
    UI->>API: PATCH /api/admin/users/{UserB_ID}/role { roleName: 'Admin' }
    API->>DB: Cập nhật role_id của User B = Admin ID
    API->>DB: Tìm Admin cũ -> Cập nhật role_id = Teacher Part-time ID (Role thấp nhất)
    API->>UI: Xóa Cookies phiên làm việc (forceLogout = true)
    API-->>UI: 200 OK { success: true, forceLogout: true }
    UI->>CurrentAdmin: Đăng xuất và chuyển hướng về /login
```

---

## 6. Luồng Phân Quyền Màn Hình Theo Vai Trò (Screen Permissions By Role Flow)

### 6.1 Cấu Trúc Menu Hệ Thống (Phân cấp Menu chính & Menu phụ)
- **Cấu trúc Menu hoàn chỉnh**:
  - **Menu chính 1: Quản lý hệ thống (`system_management`)**:
    - `Quản lý tài khoản` (`user_management`, route: `/[role]/system-management/users`)
    - `Quản lý phân quyền màn hình` (`screen_permission_management`, route: `/[role]/system-management/screen_permission`)
    - `Quản lý cơ sở trực thuộc` (`user_centre_management`, route: `/[role]/system-management/user_centres`)
    - `Quản lý lớp học` (`class_management`, route: `/[role]/system-management/classes`)
  - **Menu chính 2: Kiểm tra dữ liệu (`data_inspection`)**:
    - `Lịch trải nghiệm` (`trial_schedules`, route: `/[role]/data-inspection/trial_schedules`)

### 6.2 Cơ Chế Lưu Trữ Bền Vững Đa Tầng Trên Supabase Database (4-Layer Persistence & Deep Merge)
1. **Lưu trữ bền vững trên Supabase**:
   - **Tầng 1 (Supabase Database - Bản ghi hệ thống `users`)**: Bản ghi dự phòng chuyên biệt có `id = '00000000-0000-0000-0000-000000000003'` và `lms_code = '__screen_permissions__'` trong bảng `users` trên Supabase, lưu trữ JSON toàn bộ ma trận phân quyền trong cột `password_hash`. Đảm bảo dữ liệu phân quyền luôn bền vững 100% trên Supabase DB, không bị mất khi deploy hay khởi động lại dev server.
   - **Tầng 2 (Supabase Direct Tables)**: Tự động upsert vào bảng `system_settings` (`key = 'screen_permissions'`) và `role_menu_permissions` nếu các bảng này tồn tại trên Supabase.
   - **Tầng 3 (Local File Store)**: Đồng bộ ghi vào `data/screen_permissions_store.json`.
   - **Tầng 4 (In-Memory Fast Cache)**: Đệm bộ nhớ với TTL 3 giây (`CACHE_TTL_MS = 3000`) nhằm đảm bảo tốc độ phản hồi cao nhất cho Middleware và các chuyển trang mà không gây nghẽn truy vấn Supabase.
2. **Cơ chế Deep-Merge chống mất key**:
   - Khi đọc dữ liệu từ Supabase Database, hệ thống áp dụng thuật toán **Deep Merge** theo từng vai trò và từng menu kết hợp với `DEFAULT_ROLE_PERMISSIONS`. Nhờ vậy, ngay cả khi dữ liệu cũ trong DB chưa có các menu mới bổ sung (`user_centre_management`, `class_management`, `trial_schedules`), toàn bộ các menu vẫn được giữ nguyên đầy đủ giá trị mặc định, tuyệt đối không bị ghi đè thành `undefined` hay tự động chuyển về `false`.

### 6.3 Ma Trận Phân Quyền & Giao Diện Toggle Switch
- Bảng phân quyền hiển thị trực quan:
  - Cột 1: Danh sách Menu dạng cây phân cấp (Menu chính có nhãn nổi bật, các Menu phụ thụt lề kèm nhánh kết nối trực quan và icon Lucide đặc trưng).
  - Cột 2: Đường dẫn Route chuẩn theo vai trò (`/[role]/[main_menu]/[menu]`).
  - Các cột tiếp theo: Tương ứng với từng Vai trò (`Admin: Cấp 1`, `Teacher Full-time: Cấp 2`, `Teacher Part-time: Cấp 3`).
  - Mỗi ô giao điểm là một **Nút Toggle Switch**:
    - `BẬT (True / Màu đỏ Ruby)`: Vai trò đó được phép nhìn thấy và truy cập màn hình.
    - `TẮT (False / Màu xám)`: Vai trò đó bị ẩn và không có quyền truy cập màn hình.

### 6.4 Quy Tắc Phân Cấp Vai Trò Khi Phân Quyền (Chỉ Phân Quyền Cho Cấp Dưới)
- **Nguyên tắc cốt lõi**: **Không được tự update cho chính role hiện tại và những role cao hơn mình, chỉ được phân quyền cho các role nhỏ hơn mình**.
  - Áp dụng hệ thống Điểm Role: `Admin (Điểm: 1)` > `Teacher Full-time (Điểm: 2)` > `Teacher Part-time (Điểm: 3)`.
  - Nếu tài khoản mục tiêu có `targetRolePoints <= currentUserRolePoints` (bằng hoặc cao hơn cấp bậc người đang thao tác):
    - Trên giao diện: Tiêu đề cột hiển thị huy hiệu ổ khóa `🔒 (Khóa)`, các nút Toggle Switch bị khóa tương tác (`disabled`, `opacity-40`, `grayscale`).
    - Trên Backend (`PUT /api/admin/permissions`): Chặn bằng mã lỗi `403 Forbidden` kèm thông báo: *"Bạn không thể tự cập nhật phân quyền cho chính vai trò của mình hoặc các vai trò có cấp bậc cao hơn. Bạn chỉ được phép phân quyền cho các vai trò cấp dưới."*
  - Chỉ khi `targetRolePoints > currentUserRolePoints` (vai trò cấp dưới) thì mới được phép bật/tắt quyền.

### 6.5 Quy Tắc Logic Cascade Chi Phối (Parent - Child Toggle Logic)
1. **Khi TẮT Menu chính của một Role**:
   - Tất cả các Menu phụ trực thuộc Menu chính đó **tự động bị tắt (is_enabled = false)**.
   - Trên giao diện, toàn bộ các nút toggle của menu phụ bên dưới trong cột vai trò đó sẽ **lập tức bị làm mờ (opacity-30, grayscale)** và khóa tương tác (disabled) cho đến khi Menu chính được bật lại.
2. **Khi BẬT Menu chính của một Role**:
   - Tất cả các Menu phụ trực thuộc Menu chính đó sẽ **tự động được bật sáng lên hết (is_enabled = true)**.
   - Khi Menu chính đang BẬT: Người có quyền được **tùy ý tắt hoặc bật riêng lẻ 1 vài menu phụ** nếu muốn mà không làm ảnh hưởng đến trạng thái bật của Menu chính.
3. **Khi BẬT một Menu phụ**:
   - Nếu Menu chính của role đó đang ở trạng thái tắt, hệ thống sẽ **tự động bật Menu chính** để đảm bảo tính toàn vẹn của điều hướng.

### 6.6 Tương Tác Menu Hệ Thống (Interactive Sidebar Accordion & Dynamic Links)
- **Menu Sidebar (`AppLayout`)**: Tiêu đề Menu Chính ("QUẢN LÝ HỆ THỐNG", "KIỂM TRA DỮ LIỆU") hoạt động như một khối Accordion có thể bấm vào để đóng/mở danh sách menu con, kèm icon mũi tên chuyển hướng mượt mà. Chỉ hiển thị các menu con khi người dùng có quyền truy cập.
- **Bảng Phân Quyền**: Hiển thị chính xác các route mẫu theo chuẩn `/[role]/[main_menu]/[menu]` cho từng menu con.

### 6.7 Sơ Đồ Tuần Tự: Cập Nhật Phân Quyền Màn Hình

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản Trị Viên
    participant UI as Screen Permissions Page (/[role]/system-management/screen_permission)
    participant API as /api/admin/permissions
    participant DB as Supabase DB (users table __screen_permissions__ & direct tables)

    Admin->>UI: Toggle Menu chính hoặc Menu phụ của Role cấp dưới
    UI->>UI: Cập nhật Optimistic UI (Cascade: Tắt Menu chính -> Mờ và tắt hết Menu con; Bật Menu con -> Tự động bật Menu chính)
    UI->>API: PUT /api/admin/permissions { role_name, menu_code, is_enabled }
    API->>API: Kiểm tra RBAC (targetRolePoints > currentUserRolePoints) & Cascade Logic
    API->>DB: Upsert dữ liệu phân quyền bền vững vào Supabase (__screen_permissions__ & direct tables)
    API-->>UI: 200 OK { success: true, permissions: { ... } }
    UI->>Admin: Hiển thị thông báo cập nhật thành công (Toast / Alert)
```

---

## 7. Quy Chuẩn Giao Diện Tổng Thể & Hồ Sơ Cá Nhân (Global Layout, Theme & Profile Flow)

### 7.1 Kiến Trúc Layout Thống Nhất (`AppLayout`)
Toàn bộ hệ thống quản trị sử dụng chung component bố cục `AppLayout` với chuẩn responsive cao cấp:
1. **Sidebar Bên Trái (Cố định & Phân Cấp)**:
   - Logo thương hiệu SMH (biểu tượng khiên phát quang màu đỏ Ruby).
   - Phân nhóm menu theo cấu hình hệ thống:
     - Nhóm **QUẢN LÝ HỆ THỐNG**:
       - 👥 **Quản lý tài khoản** (`/admin/dashboard`).
       - 🛡️ **Phân quyền màn hình** (`/admin/permissions`).
   - Hiệu ứng nhận diện mục đang hoạt động (Active tab): Nền kính đỏ Ruby (`bg-rose-50 dark:bg-rose-950/40`), chữ nổi bật (`text-rose-600 dark:text-rose-400`), viền chỉ thị đỏ Ruby.
   - **Responsive**: Tự động co dãn trên Desktop và chuyển thành **Drawer trượt cảm ứng** kèm nút Hamburger (`Menu`) và nút đóng (`X`) trên màn hình Mobile/Tablet.

2. **Header Tối Giản Phía Trên**:
   - Bên trái: Nút Hamburger trên Mobile + Breadcrumbs dẫn đường (ví dụ: *Quản lý hệ thống > Quản lý tài khoản*).
   - Bên phải:
     - **Nút Chuyển Đổi Theme Sáng / Tối (☀️ / 🌙)**: Chuyển đổi mượt mà giữa Dark mode và Light mode, lưu tùy chọn vào `localStorage`.
     - **Cụm Thông Tin Người Dùng**: Avatar chữ cái đầu, Họ và tên, Badge Vai trò chuẩn màu.
     - **User Profile Dropdown**: Khi bấm vào cụm User sẽ bung Dropdown menu kính mờ với các tính năng:
       + 👤 **Chỉnh sửa thông tin cá nhân** (chuyển hướng tới `/profile`).
       + 🚪 **Đăng xuất khỏi hệ thống** (gọi API `/api/auth/logout` và chuyển hướng an toàn về `/login`).

### 7.2 Bảng Màu Chủ Đạo Đỏ - Đen - Trắng (Ruby - Obsidian - Pure White)
- **Tông Đỏ (Accent Crimson/Ruby)**: Sắc thái Ruby Velvet (`#E11D48`), Rose-Red (`#F43F5E`), Deep Wine (`#881337`), ánh sáng phát quang nhẹ (`shadow-rose-600/30`), viền bán trong suốt (`border-rose-500/20`), tuyệt đối không dùng màu đỏ cờ thô cứng (`#FF0000`).
- **Tông Đen (Dark Mode - Obsidian/Slate)**: Nền sâu Obsidian (`#090D16`), Card bề mặt kính (`#0B0F17` / `#111827`), viền mảnh thanh lịch (`border-slate-800/80`).
- **Tông Trắng (Light Mode - Crisp Snow/Slate)**: Nền tuyết thanh thoát (`#F8FAFC`), Card màu tuyết (`#FFFFFF`), đổ bóng mềm mượt (`shadow-sm border border-slate-200`).

### 7.3 Quy Chuẩn Icon Framework
- **100% sử dụng icon chính thống từ thư viện `lucide-react`** (`ShieldCheck`, `Users`, `KeyRound`, `Sun`, `Moon`, `UserCheck`, `LogOut`, v.v.).
- Tuyệt đối nghiêm cấm việc dùng icon tự chế/AI tự vẽ lung tung.

### 7.4 Trang Hồ Sơ Cá Nhân (`/profile` & API `/api/profile`)
- **Hiển thị (Identity Card)**:
  - Thẻ căn cước số thể hiện: Avatar cỡ lớn, Họ và tên, Mã LMS (cố định), Email (cố định), Nguồn tài khoản (*Tài khoản LMS* hoặc *Do website tạo*), Vai trò, Trạng thái phê duyệt, Ngày tạo tài khoản.
- **Chỉnh sửa thông tin**:
  - Cho phép sửa Họ và tên hiển thị.
  - Cho phép Đổi mật khẩu mới (chỉ áp dụng đối với tài khoản do website tạo, có kiểm tra xác nhận mật khẩu và độ dài tối thiểu 6 ký tự). Tài khoản LMS có sẵn sẽ bị khóa tính năng đổi mật khẩu tại đây.

---

## 8. Luồng Trang Not-Found (404) Tự Điều Hướng Thông Minh

### 8.1 Nguyên Tắc Hoạt Động
Khi người dùng truy cập vào bất kỳ đường dẫn nào không tồn tại hoặc không hợp lệ:
1. Hệ thống Next.js render trang lỗi chuyên biệt [app/not-found.tsx](file:///d:/Documents/Practice/Self%20Project/SMH/app/not-found.tsx).
2. Giao diện hiển thị đồ họa số `404` nổi bật theo phong cách Obsidian & Ruby Red kèm thông báo giải thích rõ ràng.
3. **Bộ đếm ngược thông minh 5 giây (Countdown Timer)**:
   - Hệ thống tự động truy vấn endpoint `/api/auth/me` để xác định trạng thái đăng nhập và vai trò của người dùng hiện tại:
     + **Nếu đã đăng nhập**: Tự động điều hướng về đúng Dashboard theo vai trò của người dùng:
       * **`Admin`**: Tự động chuyển hướng về `/admin/dashboard`.
       * **`Teacher Full-time`**: Tự động chuyển hướng về `/teacher-fulltime/dashboard`.
       * **`Teacher Part-time`**: Tự động chuyển hướng về `/teacher-parttime/dashboard`.
     + **Nếu chưa đăng nhập (Khách vãng lai)**: Tự động điều hướng về **Trang chủ (`/`)**.
   - Có thanh tiến trình (Progress Bar) co dần theo thời gian thực từ 100% về 0% trong 5 giây.
4. **Hành động tức thì**:
   - Nếu đã đăng nhập: Người dùng có thể bấm nút *"Về Dashboard ngay"* để quay lại trang làm việc mà không cần chờ hết 5 giây, hoặc bấm *"Về Trang chủ"*.
   - Nếu chưa đăng nhập: Người dùng có thể bấm *"Về Trang chủ ngay"* hoặc bấm *"Đăng nhập"*.

---

## 9. Quy Tắc Quản Trị Trạng Thái & Database Quan Trọng

1. **Không Hardcode UUID**:
   Mọi thao tác truy vấn hay cập nhật trạng thái (`status_id`) hoặc vai trò (`role_id`) đều phải truy vấn bảng danh mục tương ứng (`user_statuses`, `roles`) để lấy ID động.
2. **Quản lý Điểm Role (Role Points)**:
   Luôn tuân thủ quy tắc: **Điểm càng thấp, quyền hạn role càng cao** (`Admin: 1`, `Teacher Full-time: 2`, `Teacher Part-time: 3`).
3. **API Routes tập trung**:
   Mọi endpoint gọi fetch từ client phải sử dụng hằng số trong [api-routes.ts](file:///d:/Documents/Practice/Self%20Project/SMH/lib/constants/api-routes.ts).
4. **Tính nhất quán khi phát triển**:
   Bất kỳ ai (kể cả AI Agent) khi chỉnh sửa tính năng cũ hoặc thêm tính năng mới phải đọc lại tài liệu này và cập nhật lại sơ đồ/nội dung nếu có sự thay đổi.
5. **Tra Cứu & Sử Dụng Schema GraphQL LMS Firebase**:
   Khi lấy bất kỳ dữ liệu gì từ hệ thống LMS / Firebase, bắt buộc phải tra cứu từ tài liệu schema [docs/LMS_GRAPHQL_SCHEMA.md](file:///d:/Documents/Practice/Self%20Project/SMH/docs/LMS_GRAPHQL_SCHEMA.md) và file [docs/lms_graphql_schema.json](file:///d:/Documents/Practice/Self%20Project/SMH/docs/lms_graphql_schema.json) để tìm đúng bộ query và trường dữ liệu tương ứng.
6. **Định Dạng Dữ Liệu Trả Về Từ API (Chỉ Dạng Chữ, Không Trả Về Khóa Ngoại)**:
   Tất cả API backend xây dựng trong dự án khi trả về client bắt buộc phải trả về dữ liệu dưới dạng **CHỮ (Text / Display Name)** cho các trường tham chiếu/khóa ngoại (`role`, `status`, `centre`, `department`, `city`, v.v.), **tuyệt đối không trả về ID khóa ngoại thô**. Ngoại lệ duy nhất được phép là **ID khóa chính (Primary Key)** của chính đối tượng đó.
7. **Quy Chuẩn UI & Bảng Màu Thống Nhất**:
   Mọi màn hình phát triển mới bắt buộc kế thừa `AppLayout` (Sidebar trái + Header User Dropdown), dùng bảng màu Đỏ Ruby - Đen Obsidian - Trắng tuyết và 100% icon từ `lucide-react`.
8. **Quy Chuẩn Căn Giữa Dữ Liệu & Chống Từ Mồ Côi**:
   - Tất cả các cột mang tính định danh/trạng thái (STT, Mã LMS, Loại tài khoản, Trạng thái, Vai trò, Thao tác, Toggle switch) bắt buộc phải được căn giữa (`text-center`, `justify-center`).
   - Áp dụng `whitespace-nowrap` cho toàn bộ nhãn, huy hiệu, tiêu đề cột và nút thao tác để chống triệt để tình trạng từ mồ côi (xuống dòng chỉ 1 từ). Các thông tin cùng khối dữ liệu phải giữ trên cùng 1 hàng, kết hợp thanh cuộn ngang `overflow-x-auto` để đảm bảo hiển thị hoàn hảo trên Mobile và mọi kích cỡ màn hình.
9. **Cơ Chế Real-Time Khi Có Nút Làm Mới**:
   - Đối với bất kỳ màn hình nào đã trang bị nút "Làm mới" / "Cập nhật" (như Màn hình Quản lý tài khoản, Phân quyền màn hình): **Tuyệt đối không chạy polling tự động ngầm (`setInterval`)**, dữ liệu chỉ tải lại khi người dùng bấm nút làm mới hoặc sau khi hoàn tất hành động thêm/sửa/xóa/toggle.
   - Đối với dữ liệu định danh người dùng (Họ tên, Vai trò): Luôn truy vấn trực tiếp từ Supabase Database theo thời gian thực (Real-time).
10. **Quy Chuẩn Bảng Điều Khiển Theo Vai Trò (Role Dashboards Standard)**:
    - **Admin Dashboard (`/admin/dashboard`)**: Trang tổng quan điều hành của Quản trị viên, gồm Banner Ruby-Obsidian, Card *Tổng số tài khoản* (lấy trực tiếp từ Supabase DB) và Card *Tổng lượt truy cập*, kèm phím tắt điều hướng nhanh tới *Quản lý tài khoản* (`/admin/system-management/users`) và *Phân quyền màn hình* (`/admin/system-management/screen_permission`).
    - **Teacher Full-time Dashboard (`/teacher-fulltime/dashboard`)**: Trang tổng quan dành cho Giáo viên cơ hữu, gồm Banner đào tạo và Card *Tổng lượt truy cập*.
    - **Teacher Part-time Dashboard (`/teacher-parttime/dashboard`)**: Trang tổng quan dành cho Giáo viên thỉnh giảng, gồm Banner ca dạy và 4 Cards chỉ số (*Tổng số lớp học*, *Tổng số học viên*, *Tổng số bài nộp*, *Tổng lượt truy cập*).
11. **Quy Tắc Biến Môi Trường (Chỉ Duy Nhất 1 File `.env`)**:
    - Toàn bộ biến môi trường của dự án chỉ được lưu trữ trong **DUY NHẤT một file `.env`**.
    - Tuyệt đối cấm tạo các file biến thể khác (như `.env.example`, `.env.local`, `.env.production`, v.v.).
    - File `.env` được bảo vệ tuyệt đối trong `.gitignore` để không bao giờ bị lộ lên GitHub.
12. **Quy Chuẩn Định Tuyến Phân Quyền Theo Vai Trò (`/[role]/[main_menu]/[menu]`)**:
    - Tất cả các tuyến đường có khả năng phân quyền bắt buộc có định dạng: `/[role]/[main_menu]/[menu]`.
    - Tuyến màn hình phân quyền bắt buộc có tên chứa `screen_permission`: `/[role]/system-management/screen_permission`.
    - **Chặn Truy Cập Chéo Vai Trò & Chặn Không Có Quyền**: Nếu người dùng thuộc vai trò A cố truy cập route của vai trò B hoặc truy cập menu mà chưa được cấp quyền, Middleware sẽ chặn ngay lập tức và **trả về trực tiếp trang 404 (`not-found`)**.
13. **Quy Chuẩn Layout Toàn Diện (Header, Footer Có Trạng Thái Hệ Thống & Sidebar Thu Gọn)**:
    - Mọi giao diện (Dashboard, Quản lý, Phân quyền, Đăng nhập, 404) đều sở hữu Header và Footer thống nhất mang nhận diện thương hiệu *Student MindX Hub (SMH)*.
    - Huy hiệu "Trạng thái hệ thống hoạt động ổn định 100% • Supabase DB Connected" được đặt cố định ở Footer, loại bỏ card trùng lặp trong nội dung chính của Dashboard.
    - Sidebar hỗ trợ thu gọn (Collapse) thành dải icon 80px hoặc mở rộng 288px, ghi nhớ trạng thái qua `localStorage`.
14. **Phân Định Dữ Liệu & Thao Tác Theo Cấp Bậc Vai Trò (Role Hierarchy Scope)**:
    - Áp dụng triệt để nguyên tắc Role Points: Người dùng chỉ được xem/thao tác các tài khoản và phân quyền cho các vai trò cấp dưới mình (`targetRolePoints > currentUserRolePoints`).
    - Khóa toàn bộ các thao tác chỉnh sửa, đổi vai trò, đổi trạng thái và xóa đối với chính tài khoản của mình và các vai trò có cấp bậc bằng hoặc cao hơn mình.
15. **Quy Tắc Quản Lý Cơ Sở Trực Thuộc (Affiliated Centres Rule)**:
    - **Lưu trữ độc lập trên Supabase**: Bảng `user_centres` lưu trữ danh sách các cơ sở được gán cho từng người dùng, không can thiệp hay thay đổi dữ liệu của LMS MindX.
    - **Khởi tạo tự động theo loại tài khoản**:
      - Tài khoản loại LMS (`is_firebase = true`): Tự động truy vấn cơ sở từ LMS và đồng bộ sang Supabase khi tạo tài khoản hoặc đăng nhập.
      - Tài khoản tự tạo nội bộ (`is_firebase = false`): Ban đầu không có cơ sở trực thuộc (`[]`).
    - **Phân cấp chỉnh sửa**: Role cao hơn (`currentUserPoints < targetUserPoints`) mới được phép xem và chỉnh sửa cơ sở cho role thấp hơn. Khóa chỉnh sửa đối với chính mình và các tài khoản bằng hoặc cao hơn.
    - **Danh mục cơ sở chọn thêm**: Luôn lấy từ danh mục chính thống trên hệ thống MindX LMS.

---

## 10. Luồng Quản Lý Cơ Sở Trực Thuộc Của Các Tài Khoản (User Affiliated Centres Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Người Dùng Có Quyền (Admin / FT)
    participant UI as Giao Diện UserCentresManagementScreen
    participant API as API Server (/api/admin/user-centres)
    participant LMS as GraphQL LMS MindX
    participant SB as Supabase DB (users, user_centres)

    Note over Admin,SB: Giai đoạn 1: Khởi tạo tài khoản & Tự động đồng bộ cơ sở ban đầu
    alt Tạo tài khoản loại LMS (is_firebase = true)
        Admin->>API: POST /api/admin/users { lms_code, full_name, is_firebase: true }
        API->>SB: Tạo bản ghi user mới
        API->>LMS: Tra cứu giáo viên/cơ sở ban đầu trên LMS
        LMS-->>API: Trả về danh sách cơ sở [{ id, name, shortName }]
        API->>SB: Lưu cơ sở vào bảng user_centres
    else Tạo tài khoản tự tạo nội bộ (is_firebase = false)
        Admin->>API: POST /api/admin/users { lms_code, full_name, is_firebase: false }
        API->>SB: Tạo bản ghi user mới (danh sách cơ sở ban đầu trống [])
    end

    Note over Admin,SB: Giai đoạn 2: Xem danh sách & Quản lý cơ sở trực thuộc
    Admin->>UI: Truy cập /[role]/system-management/user_centres
    UI->>API: GET /api/admin/user-centres
    API->>SB: Lấy danh sách users & user_centres
    API-->>UI: Trả về mảng users kèm centres & can_edit (theo role points)
    UI->>Admin: Hiển thị bảng dữ liệu với badges cơ sở (hoặc "Chưa gán cơ sở")

    Note over Admin,SB: Giai đoạn 3: Chỉnh sửa / Gán thêm cơ sở cho tài khoản cấp dưới
    Admin->>UI: Bấm "Sửa cơ sở" trên tài khoản cấp dưới
    UI->>API: GET /api/admin/centres (Danh mục 20 cơ sở LMS chính thống)
    API-->>UI: Trả về danh mục cơ sở chính thống
    UI->>Admin: Mở Modal chọn cơ sở (Multi-select)
    Admin->>UI: Tích chọn thêm cơ sở -> Bấm "Lưu thay đổi"
    UI->>API: PUT /api/admin/user-centres/[id] { centres: [...] }
    API->>API: Kiểm tra role: currentRolePoints < targetRolePoints
    alt Không đủ quyền (sửa chính mình hoặc role cao hơn/bằng mình)
        API-->>UI: 403 Forbidden
        UI->>Admin: Báo lỗi không có quyền
    else Hợp lệ
        API->>SB: Lưu/Cập nhật bảng user_centres (chỉ lưu Supabase, không sửa LMS)
        API-->>UI: 200 OK Thành công
        UI->>Admin: Toast thông báo thành công & cập nhật bảng dữ liệu tức thì
    end
```

---

## 11. Luồng Quản Lý & Hiển Thị Lịch Trải Nghiệm (Trial / Office Hours Flow)

### 11.1 Nguyên Tắc Nghiệp Vụ & Quy Chuẩn Kiến Trúc
1. **Menu Chính**: `Kiểm tra dữ liệu` (`data_inspection`).
2. **Menu Phụ**: `Lịch trải nghiệm` (`trial_schedules`).
3. **Quy Chuẩn Định Tuyến**: `/[role]/data-inspection/trial_schedules`.
4. **Bắt Buộc Kế Thừa AppLayout Toàn Diện**:
   - Giao diện lịch trải nghiệm bắt buộc được bọc trong `<AppLayout pageTitle="Lịch Trải Nghiệm (Office Hours)">`.
   - Có đầy đủ Sidebar điều hướng bên trái, Header thông tin người dùng / theme toggle / dropdown hồ sơ và Footer tình trạng hệ thống ở cuối trang.
5. **Cơ Chế Lọc Theo Cơ Sở Trực Thuộc**:
   - Dữ liệu truy vấn hoàn toàn phụ thuộc vào danh sách cơ sở trực thuộc của chính tài khoản đang đăng nhập được lưu trong bảng `user_centres` (kèm cơ chế lưu trữ bền vững `data/user_centres_store.json`).
   - Hệ thống tự động trích xuất `user_id` từ session cookie, truy vấn danh sách `centre_id`, và truyền vào `centreIn` của GraphQL query LMS MindX.
   - **Tuyệt đối không có bất kỳ bộ lọc chọn tài khoản hay role nào trên giao diện**, đảm bảo tính bảo mật và đúng phạm vi phụ trách của từng người dùng.
6. **Truy Vấn GraphQL Chuẩn & Lọc Thô Triệt Để**:
   - Tên Query: `GetApprovedOfficeHours($payload: OfficeHourQuery)`.
   - Tham số: `paginationType: "OFFSET"`, `pageIndex: 0`, `itemsPerPage: 500`, `statusIn: ["APPROVED"]`, `timeFrom`, `timeTo`.
   - Lọc thô (Cleaning Rules): Tự động loại bỏ 100% các ca có trường `type` liên quan đến dạy bù: `MAKEUP`, `MAKE_UP`, `BÙ`, `BU` (loại bỏ dấu tiếng Việt, không phân biệt hoa thường).
   - Dữ liệu schema mở rộng: `courses`, `courseLines`, `studentCount`, `managerNote`, `note`, `teacher`, `centre`, `appointments`.
7. **Chuẩn Hóa Dữ Liệu 3 Cấp**:
   - **Cơ sở (Campus)**: Chuẩn hóa theo tên cơ sở trực thuộc của user:
     * `tên lửa` / `ten lua` $\rightarrow$ **`TÊN LỬA`**
     * `lũy bán bích` / `luy ban bich` $\rightarrow$ **`LŨY BÁN BÍCH`**
     * `tây thạnh` / `tay thanh` $\rightarrow$ **`TÂY THẠNH`**
     * `trường chinh` / `truong chinh` $\rightarrow$ **`TRƯỜNG CHINH`**
     * Cơ sở khác: Viết hoa theo tên cơ sở.
   - **Khối môn (Khoi)**: Dựa vào `courseLines` và `courses`:
     * Có `XART`, `ART`, `DRAW`, `VISUAL` $\rightarrow$ **`ART`** (Màu Xanh Navy `#1E3A8A`)
     * Có `ROB`, `ROBOT`, `ROBOTICS` $\rightarrow$ **`ROBOTICS`** (Màu Xanh Lá `#15803D`)
     * Còn lại $\rightarrow$ **`CODING`** (Màu Đỏ Ruby `#E11D48`)
     * **Thứ tự ưu tiên hiển thị chuẩn mockup**: `CODING` $\rightarrow$ `ART` $\rightarrow$ `ROBOTICS`.
   - **Ca học (Shift - UTC+7)**:
     * Giờ $\le$ 12:00 $\rightarrow$ **`SÁNG`** (09:00 - 12:00 hoặc thời gian thực tế).
     * 12:01 $\le$ Giờ < 17:00 $\rightarrow$ **`CHIỀU`** (14:00 - 17:00 hoặc thời gian thực tế).
     * Giờ $\ge$ 17:01 $\rightarrow$ **`TỐI`** (18:00 - 21:00 hoặc thời gian thực tế).
     * Trong mỗi ô ca: Sắp xếp tăng dần theo `startTime`.
8. **Bố Cục Bảng Ma Trận Duy Nhất (Single Matrix View)**:
   - Cấu trúc bảng ma trận gồm 7 cột chuẩn theo đúng thứ tự:
     `[Cơ sở]` (gộp dòng toàn cơ sở) | `[Khối]` (gộp dòng theo khối) | `[Ca]` | `[Khung giờ]` | `[Mentor]` (kèm nhãn Xác nhận / Cần xác nhận) | `[Số lượng]` | `[Note]`.
   - **1 case = 1 dòng duy nhất**: Chỉ hiển thị thông tin Mentor và Số lượng học viên của case đó, không tách chi tiết từng dòng ứng viên/học sinh.
   - **Tiêu đề bảng tinh gọn & Triệt tiêu thanh cuộn**: Tiêu đề bảng chỉ hiển thị `LỊCH TRẢI NGHIỆM ([Tên cơ sở]) • [Ngày]`, tuyệt đối không có chữ "LMS MindX Hub" hay "Ultra HD 3x". Toàn bộ thanh cuộn ngang/dọc được ẩn triệt để (`no-scrollbar`).
   - **Định dạng chữ to, rõ ràng và tương phản cao (High-Legibility Standard)**: Cỡ chữ trong bảng và khi kết xuất ảnh sao chép (cả 1 cơ sở và toàn bộ cơ sở) phải to, rõ nét (`text-base`, `text-lg`, `font-black`), tương phản cao để khi xem ảnh thu nhỏ trên Zalo (điện thoại/máy tính) vẫn đọc rõ thông tin không bị mờ hay nhỏ.
   - Màu sắc phân biệt trực quan:
     * Khối CODING: Đỏ Ruby (`#E11D48`).
     * Khối ART: Xanh Navy (`#1E3A8A`).
     * Khối ROBOTICS: Xanh Lá (`#15803D`).
     * Hàng có Mentor xác nhận: Nền xanh nhạt `#DCEBFC`.
     * Hàng cần xác nhận Mentor: Nền đỏ hồng nhạt `#FFE2E5`.
9. **Tính Năng Sao Chép Ảnh Lịch Theo Từng Cơ Sở & Toàn Bộ Cơ Sở Gửi Nhanh Zalo**:
   - Dưới mỗi tên cơ sở có nút **"Sao chép ảnh"** (kèm icon `Copy`).
   - **Ràng buộc quan trọng**: Chỉ hiển thị nút sao chép ảnh đối với các cơ sở có ca trải nghiệm (`hasCases === true`). Cơ sở không có ca học thì không có nút này. Nút sao chép toàn bộ cơ sở được đặt trên thanh công cụ trên cùng.
   - Kết xuất ảnh không chứa bất kỳ thanh cuộn nào.
   - Nút "Sao chép ảnh" có class `hide-on-export` nên sẽ tự động ẩn đi trong ảnh thành phẩm.
   - Ghi trực tiếp định dạng ảnh PNG vào Clipboard của hệ điều hành thông qua API `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
   - Người dùng chỉ cần mở nhóm Zalo và nhấn **Ctrl + V** để dán ảnh lịch cơ sở cực nét ngay tức thì.

```mermaid
sequenceDiagram
    autonumber
    actor User as Người Dùng (Admin / Giáo Viên)
    participant UI as Màn Hình Lịch Trải Nghiệm (TrialSchedulesScreen)
    participant API as API Server (/api/office-hours)
    participant SB as Supabase DB & Store (user_centres)
    participant LMS as MindX LMS GraphQL (GetApprovedOfficeHours)
    participant Clip as Clipboard Hệ Điều Hành

    User->>UI: Truy cập /[role]/data-inspection/trial_schedules
    Note over UI: Kế thừa AppLayout (Sidebar, Header, Footer) & Mặc định chọn ngày mai
    UI->>API: GET /api/office-hours?date=YYYY-MM-DD
    API->>SB: Lấy danh sách cơ sở trực thuộc của userId đang đăng nhập
    SB-->>API: Danh sách 4 cơ sở (TÊN LỬA, TÂY THẠNH, LŨY BÁN BÍCH, TRƯỜNG CHINH)
    API->>LMS: query GetApprovedOfficeHours { centreIn: [...ids], timeFrom, timeTo, statusIn: ["APPROVED"] }
    LMS-->>API: Trả về danh sách ca trải nghiệm thô
    API->>API: Lọc thô loại bỏ 100% ca chứa Makeup / Bù
    API-->>UI: Trả về { success: true, date, userCentres, officeHours }
    UI->>UI: Phân loại: Cơ sở -> Khối (CODING -> ART -> ROBOTICS) -> Ca (SÁNG -> CHIỀU -> TỐI)
    UI->>User: Hiển thị bảng ma trận từng cơ sở với cột "Số lượng học viên" (1 case = 1 dòng)
    
    opt Sao chép ảnh cơ sở có case gửi Zalo
        User->>UI: Bấm "Sao chép ảnh" dưới tên cơ sở có ca trải nghiệm
        UI->>Clip: Kết xuất ảnh cơ sở bằng html-to-image (pixelRatio: 2.5, ẩn nút chép) & ghi ClipboardItem
        UI->>User: Toast "Đã sao chép ảnh lịch cơ sở! Hãy mở Zalo và nhấn Ctrl+V để gửi ngay"
    end

    opt Sao chép ảnh toàn bộ cơ sở gửi Zalo
        User->>UI: Bấm "Sao chép toàn bộ cơ sở" trên thanh công cụ
        UI->>Clip: Kết xuất ảnh tổng thể từ export container riêng biệt kèm Banner tổng thể & ghi ClipboardItem
        UI->>User: Toast "Đã sao chép toàn bộ lịch trải nghiệm! Hãy mở Zalo và nhấn Ctrl+V để gửi ngay"
    end

---

## 12. Luồng Bảo Mật JWT & Tùy Chỉnh Duy Trì Phiên Đăng Nhập (JWT Security & Session Expiration Flow)

### 12.1 Quy Chuẩn Token & Biến Môi Trường
1. **Secret Key**: `JWT_SECRET=student-mindx-hub` được đặt duy nhất tại `.env`.
2. **Ký Token**: Sử dụng thư viện `jose` (chuẩn Web Crypto API, tương thích cả Edge Runtime và Node.js API), thuật toán `HS256`.
3. **Payload Token (`SmhJwtPayload`)**:
   - `userId`: UUID người dùng trong Supabase.
   - `lmsCode`: Mã định danh LMS.
   - `name`: Tên đầy đủ người dùng.
   - `role`: Tên vai trò (chữ).
   - `status`: Trạng thái người dùng (chữ).
   - `expiryDays`: Số ngày duy trì phiên đăng nhập (cố định 30 ngày).
4. **Thời Hạn Duy Trì Phiên Cố Định**:
   - **Thời gian cố định**: 30 ngày (`30d`).
   - Token định danh `smh_token` và các cookie người dùng (`user_id`, `user_name`, `user_role`) được cấp thời hạn sống `maxAge = 30 * 24 * 60 * 60 = 2,592,000` giây.

### 12.2 Cơ Chế Kiểm Tra Hết Hạn & Đẩy Về Đăng Nhập
1. **Tại Middleware (`middleware.ts`)**:
   - Middleware đọc cookie `smh_token` trên mọi request tới các tuyến đường được bảo vệ (`/admin/*`, `/teacher-fulltime/*`, `/teacher-parttime/*`, `/profile`, `/dashboard`).
   - Giải mã và kiểm tra hạn sử dụng qua `verifySmhToken`.
   - **Khi token hết hạn (`expired === true`)**:
     * Middleware xóa toàn bộ cookie xác thực (`smh_token`, `id_token`, `refresh_token`, `user_id`, `user_name`, `user_role`, `user_permissions`).
     * Tự động chuyển hướng người dùng về trang đăng nhập với thông số: `/login?redirect=[targetPath]&reason=expired`.

### 12.3 Chuẩn Gợi Ý Đăng Nhập & Chống Tự Động Điền Trên Form (`/login`)
1. **Gợi ý tài khoản đã lưu (Browser Autofill Suggestions)**:
   - Input định danh sử dụng chuẩn `name="username"`, `id="username"`, `autoComplete="username"`.
   - Input mật khẩu sử dụng chuẩn `name="password"`, `id="password"`, `autoComplete="current-password"`.
2. **Cơ chế chống tự điền ban đầu (Anti-Initial-Autofill)**:
   - Các trường nhập liệu được gắn cờ `readOnly` trong khoảnh khắc tải trang ban đầu để ngăn chặn trình duyệt tự động điền đè dữ liệu lên giao diện.
   - Khi người dùng nhấp chuột hoặc chạm vào ô nhập liệu (`onFocus`, `onMouseDown`, `onTouchStart`), thuộc tính `readOnly` tự động được gỡ bỏ, kích hoạt ngay lập tức menu gợi ý các tài khoản đã lưu trên trình duyệt để chọn đăng nhập nhanh.

### 12.4 Quy Chuẩn Quản Lý & Chỉnh Sửa Thông Tin Cá Nhân (`/profile`)
1. **Phân biệt Nguồn tài khoản chuẩn xác**:
   - Hệ thống căn cứ vào `password_hash === 'LMS_EXTERNAL_ACCOUNT'`:
     * Nếu đúng -> Xác định là **Tài khoản LMS** (`is_firebase = true`, icon ngọn lửa tím).
     * Nếu không -> Xác định là **Do website tạo** (`is_firebase = false`, icon xanh lá).
2. **Quy tắc chỉnh sửa Họ và tên (`full_name`)**:
   - **Tài khoản LMS**:
     * Nếu hệ thống LMS MindX đã có thông tin họ tên (`lmsResult.fullName` có giá trị): Khóa cố định 100% (`disabled` / read-only), không cho phép chỉnh sửa, hiển thị huy hiệu `(Cố định từ LMS)`.
     * Nếu tài khoản LMS nhưng chưa có thông tin họ tên trên LMS: Cho phép người dùng tự cập nhật họ tên vào hệ thống (ràng buộc 2 - 70 ký tự).
   - **Tài khoản do website tạo**: Luôn được quyền chỉnh sửa họ và tên tự do (ràng buộc 2 - 70 ký tự).
3. **Quy tắc Mã LMS (`lms_code`) & Email**:
   - Khóa cố định 100% (`disabled` / read-only) cho mọi tài khoản, tuyệt đối không được chỉnh sửa.
4. **Quy tắc Đổi mật khẩu**:
   - **Mật khẩu chỉ được thay đổi khi là tài khoản do website cấp** (tài khoản nội bộ, ràng buộc 6 - 50 ký tự, có đo độ mạnh trực quan và kiểm tra trùng khớp xác nhận).
### 12.5 Badge Nổi Hiển Thị Lượt Truy Cập Trang Web (`FloatingVisitBadge`)
1. **Kiến trúc & Vị trí hiển thị**:
   - Được gắn ở tầng gốc ứng dụng `app/layout.tsx` (bên trong `ThemeProvider`), tự động hiển thị nổi trên toàn bộ các trang (Trang chủ, Đăng nhập, Dashboard các vai trò, Profile, Quản lý, v.v.).
   - Vị trí nổi cố định: `fixed top-[72px] right-3 sm:top-[76px] sm:right-6 z-40`. Vị trí này hoàn toàn tách biệt ngoài thanh Header (chiều cao 64px) để không che khuất cụm nút ThemeToggle và Avatar Dropdown.
2. **Hiệu ứng trực quan**:
   - **Chấm xanh nhấp nháy (Pulsing Green Dot)**: Sử dụng kỹ thuật Tailwind `relative flex h-2 w-2` với vòng xung nhịp ngoài `animate-ping bg-emerald-400 opacity-75` và nhân trong `bg-emerald-500` tạo cảm giác hệ thống đang trực tiếp hoạt động (live).
   - **Thiết kế Glassmorphism**: Nền trắng mờ / đen mờ `bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-md`, bo tròn con nhộng (`rounded-full`), viền mờ tinh tế, đổ bóng nhẹ nhàng và phóng nhẹ khi di chuột (`hover:scale-105`).
3. **Cơ chế dữ liệu**:
   - Lấy dữ liệu lượt truy cập toàn trang (`total_visits_global`) từ API `/api/dashboard/stats`.
   - Kết hợp đọc/ghi tệp lưu trữ bền vững `data/site_stats.json` để bảo toàn số lượt truy cập qua các lần khởi động lại server.

---

## 13. Danh Mục Bộ Tài Khoản Kiểm Thử Chuẩn (Official Test Accounts)

Khi thực hiện kiểm thử tự động (Subagent, Browser tests, API tests), Agent **bắt buộc sử dụng đúng danh mục tài khoản sau, tuyệt đối không nhập linh tinh**:

| Vai trò | Tài khoản (Mã LMS) | Mật khẩu | Phạm vi cơ sở trực thuộc | Đặc điểm |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `Nh@t@nh12@8` | Toàn bộ 101 cơ sở LMS MindX | Toàn quyền quản trị, phân quyền, xem lịch tất cả cơ sở |
| **Teacher Full-time** | `anhhn01` | `Nh@t@nh12@8` | 4 cơ sở (Tên Lửa, Tây Thạnh, Lũy Bán Bích, Trường Chinh) | Quyền giảng viên full-time theo cơ sở trực thuộc |
| **Teacher Part-time** | `huynhnhatanh` | `Nh@t@nh12@8` | 4 cơ sở (Tên Lửa, Tây Thạnh, Lũy Bán Bích, Trường Chinh) | Quyền giảng viên part-time theo cơ sở trực thuộc |

---

## 14. Luồng Thông Báo Triển Khai Qua Telegram (Post-Build Telegram Notification Flow)

### 14.1 Nguyên Tắc Hoạt Động
Do gói Vercel Hobby (Free) không hỗ trợ Webhook gửi ra ngoài, hệ thống chuyển sang giải pháp thực thi kịch bản thông báo tự động ngay sau khi lệnh build thành công:
1. **Lệnh thực thi trong `package.json`**:
   `"build": "next build && node telegram-notify.js"`
2. **Kịch bản thông báo**: [telegram-notify.js](file:///d:/Documents/Practice/Self%20Project/SMH/telegram-notify.js) đặt tại thư mục gốc của dự án.
3. **Trích xuất thông tin môi trường tự động từ Vercel**:
   - `VERCEL_PROJECT_NAME`: Tên dự án Vercel.
   - `VERCEL_PROJECT_PRODUCTION_URL`: URL phiên bản Production chính thức.
   - `VERCEL_URL`: URL bản build Preview chi tiết.
   - `deployTime`: Thời gian hoàn thành theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`).
4. **Gửi tin nhắn qua Telegram Bot API**:
   - Gọi API Telegram: `https://api.telegram.org/bot${token}/sendMessage`.
   - Đọc cấu hình bảo mật `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` từ biến môi trường.
   - Định dạng tin nhắn HTML trực quan, vô hiệu hóa xem trước link (`disable_web_page_preview: true`).

---

## 15. Luồng Chế Độ Bảo Trì Hệ Thống (Maintenance Mode Flow)

### 15.1 Nguyên Tắc Vận Hành
1. **Phạm vi kiểm soát & Màn hình bảo trì xuất hiện đầu tiên**:
   - Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập màn hình cấu hình tại `/[role]/system-management/maintenance` và gọi API `POST /api/admin/maintenance`.
   - **Màn hình bảo trì xuất hiện đầu tiên và cố định liên tục**: Khi bảo trì được bật (`isEnabled = true`), toàn bộ người dùng (kể cả khách vãng lai truy cập Trang chủ `/` hay truy cập `/login` thông thường) đều bị Middleware chuyển hướng ngay lập tức về trang `/maintenance` và lưu lại ở đó liên tục cho đến khi bảo trì kết thúc. Tuyệt đối không chỉ hiển thị một thông báo rồi cho ở lại trang khác.
   - **Kênh đăng nhập đặc thù cho Quản trị viên**: Trên trang `/maintenance`, có nút "Quản trị viên đăng nhập" dẫn đến `/login?admin=1`. Chỉ đường dẫn này mới cho phép mở form đăng nhập để Admin xác thực. Nếu tài khoản không phải Admin (như Teacher) cố tình đăng nhập trong thời gian này, API `/api/auth/login` sẽ từ chối với mã lỗi 503 và giao diện tự động điều hướng người dùng quay trở lại ngay màn hình `/maintenance`.
2. **Thời gian dự kiến tự động (3 tiếng mặc định)**:
   - Form cho phép Admin chọn ngày giờ kết thúc mong muốn (`datetime-local`).
   - Nếu Admin không nhập ngày giờ hoặc để trống, hệ thống **tự động thiết lập thời gian hoàn tất là 3 tiếng kể từ thời điểm kích hoạt**.
   - Hỗ trợ các nút chọn nhanh: Mặc định (+3 tiếng), +1 tiếng, +6 tiếng, +12 tiếng.
   - Khi thời gian dự kiến trôi qua (`Date.now() >= endTimestamp`), hệ thống tự động nhận diện bảo trì đã kết thúc và mở lại quyền truy cập bình thường.
3. **Cách ly môi trường 100% (Local vs Production)**:
   - Dữ liệu trạng thái được lưu trữ cục bộ tại `data/maintenance_status.json` (được bảo vệ trong `.gitignore` không đẩy lên Git).
   - Việc kích hoạt bảo trì tại máy nội bộ (Local) hoàn toàn không làm gián đoạn hay ảnh hưởng đến máy chủ Production trên Vercel.

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Guest / Teacher)
    actor Admin as Quản Trị Viên (Admin)
    participant MW as Next.js Middleware
    participant Page as Màn Hình /maintenance
    participant Login as Màn Hình /login?admin=1
    participant AdminUI as Màn hình Bảo Trì Admin
    participant Svc as Maintenance Service
    participant JSON as data/maintenance_status.json

    Admin->>AdminUI: Bật toggle bảo trì & (tùy chọn) chọn giờ kết thúc
    AdminUI->>Svc: POST /api/admin/maintenance { isEnabled: true, expectedEndTime }
    Note over Svc: Nếu không điền giờ: Mặc định = Now + 3 giờ
    Svc->>JSON: Ghi trạng thái bảo trì & môi trường
    Svc-->>AdminUI: Phản hồi thành công

    User->>MW: Truy cập route bất kỳ (/, /login, /dashboard, /teacher-fulltime/...)
    MW->>Svc: Kiểm tra trạng thái bảo trì
    alt Người dùng đã xác thực là Admin
        MW-->>Admin: Cho phép truy cập bình thường
    else Người dùng là vai trò khác / khách
        MW-->>User: Redirect 307 về /maintenance (Hiện lên đầu tiên và lưu lại liên tục)
        User->>Page: Xem đồng hồ đếm ngược & thông điệp bảo trì
        opt Admin cần đăng nhập quản trị
            Admin->>Page: Nhấp nút "Quản trị viên đăng nhập"
            Page->>Login: Điều hướng sang /login?admin=1
            Login->>Admin: Nhập thông tin tài khoản admin và đăng nhập thành công
        end
    end
```

---

## 16. Luồng Quản Lý Phiên Bản Hệ Thống & Cập Nhật Khi Đẩy Git (Single Version Changelog & Git Push Flow)

### 16.1 Nguyên Tắc Hiển Thị Duy Nhất 1 Phiên Bản Mới Nhất
1. **Nguồn chân lý duy nhất (Single Source of Truth)**:
   - Toàn bộ thông tin phiên bản được định nghĩa tập trung tại `lib/constants/version.ts` qua hằng số `CURRENT_VERSION`.
   - Bao gồm: Số hiệu (`version`), Ngày phát hành (`releaseDate`), Tiêu đề (`title`), Tóm tắt ngắn gọn (`summary`), và danh sách các chức năng chính (`features`).
2. *### 20.2 Luồng Tìm Kiếm Real-time, Dropdown Gợi Ý & Quản Lý Lớp Bền Vững (Supabase Only)
- **Cơ chế Tìm kiếm Real-time Dropdown theo tên/mã lớp (`type=search`) & Chống Spam 429 (Debounce 1s)**:
  - Khi người dùng nhập từ 2 ký tự trở lên vào ô tìm kiếm mã lớp, hệ thống trì hoãn **1000ms (1 giây)** sau khi người dùng dừng gõ mới kích hoạt truy vấn mạng qua API `/api/classes?type=search&q=...` nhằm triệt tiêu hoàn toàn nguy cơ bị giới hạn tần suất (HTTP 429 Too Many Requests).
  - Trong lúc người dùng gõ, bộ lọc client-side lọc tức thì trên dữ liệu gợi ý đã tải giúp giao diện phản hồi mượt mà không có độ trễ.
  - Hiển thị danh sách Dropdown ngay bên dưới ô nhập với đầy đủ: Mã lớp, Tên khóa học, Cơ sở, Khung giờ học, Giáo viên phụ trách (số buổi dạy nhiều nhất), Trạng thái lớp (`Đang học`, `Sắp mở`), và huy hiệu `Đã trong quản lý` nếu lớp đã được lưu trên Supabase.
  - Khi nhấp vào một lớp trong dropdown:
    - Nếu lớp đã trong quản lý: Mở Modal ở chế độ Xem (`view mode`).
    - Nếu lớp chưa có trong quản lý: Tự động tính toán hạn nộp bài mặc định và mở **Modal Chi Tiết Lớp Học** ở chế độ Thêm mới (`add mode`).
- **Ràng buộc trạng thái lớp khi thêm (Cho phép OPEN, RUNNING và FINISHED, cấm các trạng thái khác)**:
  - Hệ thống cho phép thêm các lớp ở 3 trạng thái chuẩn: **Đang mở (`OPEN`)**, **Đang học (`RUNNING`)**, và **Đã kết thúc (`FINISHED`)** cho tất cả các vai trò (Admin, Teacher Full-time, Teacher Part-time nếu phụ trách).
  - Tuyệt đối **KHÔNG cho phép thêm các lớp ở trạng thái ngoài 3 trạng thái trên** (như `CLOSED`, `DRAFT`, `CANCELLED`, `PENDING`, v.v.). Nếu phát hiện trạng thái ngoài 3 trạng thái này, hệ thống sẽ chặn lại và báo lỗi: *"Hệ thống chỉ hỗ trợ các lớp OPEN, RUNNING hoặc FINISHED"*.
- **Cơ chế Phát hiện Lớp Đã Tồn Tại Khi Thêm & Modal Đối Chiếu (`ExistingClassDiffModal`)**:
  - Khi người dùng bấm Thêm một lớp học, nếu lớp đó đã tồn tại trong cơ sở dữ liệu Supabase, hệ thống thực hiện so sánh đối chiếu dữ liệu hiện tại với LMS.
  - Nếu có sự khác biệt dữ liệu, hệ thống tự động mở **Modal Đối Chiếu Lớp Đã Tồn Tại** hiển thị chi tiết từng trường khác biệt side-by-side và cung cấp 2 lựa chọn:
    1. *"Chấp nhận cập nhật"*: Hệ thống ghi đè dữ liệu mới nhất từ LMS và tự động đồng bộ danh sách học viên active vào cơ sở dữ liệu.
    2. *"Từ chối / Giữ nguyên"*: Hệ thống hủy thao tác và bảo lưu 100% dữ liệu lớp học hiện có trong Supabase.
- **Phân quyền thêm lớp học theo vai trò**:
  - **Admin & Teacher Full-time**: Có quyền tìm kiếm và thêm mọi lớp học thuộc các cơ sở trực thuộc được phân công.
  - **Teacher Part-time**: Khối *"Tìm kiếm & Thêm lớp học"* được hiển thị đầy đủ, cho phép tìm kiếm và thêm **các lớp do chính mình phụ trách giảng dạy** vào hệ thống quản lý.
- **Phân quyền dữ liệu & tìm kiếm theo vai trò (Role-based Scoping)**:
  - **Admin & Teacher Full-time**: Nhìn thấy và tìm kiếm được **TẤT CẢ** các lớp học ở trạng thái opening, running và finished thuộc danh sách cơ sở trực thuộc được phân công (`user_centres`).
  - **Teacher Part-time**: **CHỈ** xem và tìm kiếm được các lớp do chính giáo viên đó phụ trách (nếu tìm kiếm mã lớp người khác dạy sẽ thông báo không tìm thấy).
- **Ràng buộc thêm lớp học (Giáo viên phụ trách phải có tài khoản Supabase, đã approved và đã liên kết Google Drive OAuth)**:
  - Khi thêm lớp học, hệ thống quét danh sách tất cả giáo viên phụ trách của lớp (bao gồm Giảng viên chính LEC, Trợ giảng TA và Supply, đối chiếu qua mã LMS `teacherCodes` hoặc Họ tên `teacherName`).
  - Hệ thống kiểm tra trong bảng `users` JOIN với `user_statuses` và kiểm tra liên kết Google Drive OAuth: **Bắt buộc có ít nhất 1 giáo viên phụ trách của lớp học đó đã có tài khoản trên hệ thống, tài khoản đang ở trạng thái đã được phê duyệt (`approved`) VÀ đã hoàn tất liên kết Google Drive qua OAuth**.
  - Nếu không có giáo viên phụ trách nào thỏa mãn điều kiện trên, hệ thống chặn lại và thông báo: *"Giáo viên phụ trách chưa liên kết Google Drive hoặc chưa được phê duyệt"*.
  - Nếu người thực hiện thêm lớp là Teacher Part-time thì tài khoản đó bắt buộc phải là một trong số các giáo viên phụ trách lớp học.
- **Quy tắc suy luận và xác định vai trò Giáo viên LMS chuẩn xác (`LEC`, `TA`, `Supply`)**:
  - Giáo viên phân công của một lớp học phản ánh chính xác vai trò thực tế:
    1. Giảng viên phụ trách chính (số buổi tham gia giảng dạy nhiều nhất): Gán vai trò **`LEC`** (Lecturer).
    2. Giảng viên dạy thay thế 1-2 buổi (dạy bù/thế): Gán vai trò **`Supply`**.
    3. Trợ giảng: Gán vai trò **`TA`** (Teaching Assistant).
  - Thứ tự ưu tiên sắp xếp danh sách giáo viên phụ trách: **`LEC`** $\rightarrow$ **`TA`** $\rightarrow$ **`Supply`** (ví dụ: `Huỳnh Nhật Anh (LEC), Nguyễn Quốc Thành (Supply)`).
- **Kiến Trúc Lưu Trữ Bảng Riêng Biệt Trên Supabase (`managed_classes` & `managed_students`)**:
  - Dữ liệu lớp học và học viên được lưu trữ trong 2 bảng chuyên biệt trên Supabase: `managed_classes` và `managed_students` (có khóa ngoại `managed_students.class_id REFERENCES managed_classes(id) ON DELETE CASCADE`).
  - Toàn bộ dữ liệu lớp học và học viên hiển thị rõ ràng, chuẩn quan hệ từng dòng bản ghi độc lập với đầy đủ các cột thuộc tính trong Supabase Table Editor.
  - Bảng `users` chỉ lưu trữ tài khoản người dùng thực tế (Admin, Teacher Full-time, Teacher Part-time), hoàn toàn sạch sẽ, không còn các bản ghi dummy.
  - Hệ thống chỉ thực hiện các câu lệnh đọc dữ liệu từ LMS (Read-only GraphQL Queries), **tuyệt đối không thực hiện bất kỳ mutation hay thao tác ghi nào làm thay đổi dữ liệu trên LMS**.

### 20.3 Bảng Danh Sách Lớp Đang Quản Lý, Bộ Lọc, Sắp Xếp & Phân Trang (20 Lớp / Trang)
1. **Bộ lọc & Sắp xếp đa tiêu chí với Ô Nhập Tìm Kiếm Tích Hợp (`SearchableDropdown`)**:
   - **Lọc từ khóa**: Tìm kiếm tức thì theo mã lớp, khóa học, giáo viên phụ trách, tên cơ sở (hỗ trợ nút xóa nhanh `X`).
   - **Tất cả các bộ lọc dạng dropdown đều tích hợp Ô Nhập Tìm Kiếm bên trong (`SearchableDropdown`)**:
     * **Lọc theo cơ sở**: Dropdown cơ sở trực thuộc có ô tìm kiếm gõ lọc nhanh theo tên/mã cơ sở.
     * **Lọc theo giáo viên phụ trách**: Dropdown giáo viên phụ trách chỉ hiển thị các giáo viên đã approved và đã liên kết Google Drive OAuth thành công.
     * **Lọc theo trạng thái**: Dropdown trạng thái (`Tất cả`, `Đang học`, `Sắp mở`, `Đã kết thúc`) có ô tìm kiếm nhanh.
     * **Sắp xếp linh hoạt (`sortBy`)**: Dropdown sắp xếp có ô tìm kiếm hỗ trợ chuyển đổi tiêu chí thuận tiện.
   - **Thông Báo Hệ Thống (Toast Alert) Luôn Hiển Thị Trên Cùng (`z-[99999]`)**:
     * Hộp thoại thông báo (Toast feedback) được thiết lập `z-[99999]`, đảm bảo khi mở bất kỳ Modal nào, thông báo luôn hiển thị sắc nét ở lớp trên cùng.

2. **Quy chuẩn Phân trang (20 lớp / Trang) & Nhảy trang linh hoạt**:
   - Bảng hiển thị cố định **20 lớp trên mỗi trang** (`ITEMS_PER_PAGE = 20`).
   - Tự động đánh số thứ tự (STT) liên tục theo từng trang: `(currentPage - 1) * 20 + idx + 1`.
   - **Thanh phân trang phía dưới bảng**:
     * Thông tin tiến trình: *"Hiển thị X - Y trong tổng số Z lớp học"*.
     * Nút chuyển: Trang đầu (`|<<`), Trang trước (`<`), Trang sau (`>`), Trang cuối (`>>|`).
     * **Ô nhập số trang trực tiếp (Jump to page input)**: Cho phép người dùng gõ số trang mong muốn và nhấn Enter hoặc rời chuột (onBlur) để nhảy ngay đến trang đó.
     * Tự động đặt lại về trang 1 khi thay đổi từ khóa, cơ sở, giáo viên, trạng thái hoặc tiêu chí sắp xếp.

3. **Cấu trúc 10 cột chuẩn**:
| STT | Mã Lớp & Khóa Học | Cơ Sở | Giáo Viên Phụ Trách | Giờ Học | Ngày Bắt Đầu | Ngày Kết Thúc | Tiến Độ | Trạng Thái | Thao Tác |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `LBB-ROB-ARMA12` | HCM - 414 Lũy Bán Bích | Võ Minh Huân | `18:00 - 20:00` | 08/09/2026 | 08/12/2026 | 1/14 buổi (7%) | Đang học | Xem chi tiết, Sửa, Tải LMS, Học viên, Xóa |

### 20.4 Modal Chi Tiết Lớp Học, Cấu Hình Hạn Nộp Bài (1 Ô Duy Nhất & Nút Lịch) & Nộp Trễ (Dropdown Select)
1. **Thông tin tổng quan (Chống rớt chữ & Bố cục tinh gọn)**: Thẻ ngang gồm Trạng thái, Giáo viên phụ trách, Giờ học, Tổng số buổi, và Thời gian học áp dụng `whitespace-nowrap`.
2. **Cụm Tab Chuyển Đổi Tinh Gọn**:
   - **Tab 1: 📅 Lịch trình, Hạn nộp bài & Nộp trễ (N buổi)**: Quản lý lịch trình các buổi học, hạn nộp bài và cấu hình nộp trễ.
   - **Tab 2: 👥 Danh sách học viên (M học viên)**: Hiển thị danh sách học viên active (đang học) có trong lớp học đó, kèm theo **Mã học viên** được tự động sinh theo quy chuẩn.
3. **Bảng Lịch Trình Chi Tiết Các Buổi Học (Tab 1)**:
   - `Buổi`: Số thứ tự buổi học (1 đến N), căn giữa `whitespace-nowrap`.
   - `Ngày học`: Ngày diễn ra buổi học, định dạng chuẩn Việt Nam `DD/MM/YYYY` (xử lý chuỗi trực tiếp chống lệch múi giờ).
   - `Giờ học`: Khung giờ của buổi học đó (`18:00 - 20:00`), `whitespace-nowrap`.
   - `Ghi chú mốc`: Huy hiệu Checkpoint 1, Checkpoint 2, và **SP Cuối Khóa (hiển thị liên tục trên toàn bộ các buổi từ sau buổi Checkpoint 2 đến buổi cuối cùng)**.
   - `Hạn nộp bài chính thức (1 ô duy nhất kèm nút lịch)`: Hiển thị **1 ô duy nhất** chứa mốc thời gian chuẩn Ngày Tháng Năm Giờ Phút (`DD/MM/YYYY HH:mm`) kèm nút icon lịch `<Calendar />` để mở native picker, loại bỏ hoàn toàn hiển thị badge trùng lặp.
   - `Cho phép nộp trễ (Dropdown Select 3 tùy chọn)`: Sử dụng **1 Dropdown Select** tinh gọn thay thế hoàn toàn checkbox & radio button cũ:
     * **Tùy chọn 1 (Không cho phép - Tắt nộp trễ)**: Ẩn toàn bộ ô nhập thời gian phụ.
     * **Tùy chọn 2 (Theo ngày giờ cụ thể)**: Hiển thị ô `datetime-local` với ràng buộc kỹ thuật **không được vượt quá ngày kết thúc lớp học (`class.endDate`)**.
     * **Tùy chọn 3 (Theo khoảng thời gian)**: Hiển thị 4 ô nhập số: **Ngày, Giờ, Phút, Giây** (ví dụ: `+2 ngày 12 giờ 0 phút 0 giây`).

### 20.5 Kiểm Tra & Tự Động Đồng Bộ Ngầm Thời Gian Thực Từ LMS (Real-time LMS Auto-Sync)
- **Tự động đồng bộ ngầm các trường vận hành**:
  - Khi hệ thống kiểm tra đối chiếu LMS (`check_lms_changes`), các trường vận hành gồm: **Trạng thái lớp (`status`)**, **Số buổi học (`numberOfSessions`)**, **Số buổi hoàn thành (`completedSessions`)**, và **Tiến độ học tập (`progressPercent`)** tự động cập nhật ngầm vào Supabase DB theo thời gian thực và cập nhật state client ngay lập tức mà không làm gián đoạn người dùng.
- **Quy tắc không tự động cập nhật lịch học buổi (Bắt buộc thông báo xác nhận)**:
  - Nếu có sự thay đổi về lịch học (ngày bắt đầu, kết thúc, lịch các buổi học `slots`), hệ thống **tuyệt đối không tự động cập nhật ngầm** mà sẽ đưa vào danh sách diffs để hiển thị cảnh báo, yêu cầu người dùng chủ động kiểm tra và xác nhận cập nhật.
- **Cảnh báo thay đổi LMS tại cột Mã Lớp**:
  - Đối với các trường nội dung khác có biến động (Giáo viên, Khung giờ, Lịch học, Học viên), hệ thống hiển thị **Badge Cảnh Báo Nhấp Nháy tại cột Mã Lớp (`LMS Đã Đổi`)**.
- **Bảo toàn hạn nộp bài tùy chỉnh**: Toàn bộ hạn nộp bài và cấu hình nộp trễ của từng slot buổi học mà người dùng đã cấu hình trước đó đều được bảo toàn nguyên vẹn khi đồng bộ từ LMS.

### 20.6 Danh Mục 56 Cơ Sở MindX Chính Thống (56 Official Campuses)
- Rà soát toàn bộ danh mục cơ sở MindX qua GraphQL query LMS.
- Loại bỏ 32 cơ sở ngưng hoạt động (`isActive === false`) và 15 nhóm/hotline/phòng ban/online/đối tác mầm non.
- Chuẩn hóa danh mục đúng **56 cơ sở vật lý chính thống** trên toàn quốc trong hằng số `OFFICIAL_LMS_CENTRES` và các bộ lọc toàn hệ thống. Admin sở hữu toàn bộ 56 cơ sở này.��i dùng bấm Thêm một lớp học, nếu lớp đó đã tồn tại trong cơ sở dữ liệu Supabase, hệ thống thực hiện so sánh đối chiếu dữ liệu hiện tại với LMS.
  - Nếu có sự khác biệt dữ liệu, hệ thống tự động mở **Modal Đối Chiếu Lớp Đã Tồn Tại** hiển thị chi tiết từng trường khác biệt side-by-side và cung cấp 2 lựa chọn:
    1. *"Chấp nhận cập nhật"*: Hệ thống ghi đè dữ liệu mới nhất từ LMS và tự động đồng bộ danh sách học viên active vào cơ sở dữ liệu.
    2. *"Từ chối / Giữ nguyên"*: Hệ thống hủy thao tác và bảo lưu 100% dữ liệu lớp học hiện có trong Supabase.
- **Phân quyền thêm lớp học theo vai trò**:
  - **Admin & Teacher Full-time**: Có quyền tìm kiếm và thêm mọi lớp học thuộc các cơ sở trực thuộc được phân công.
  - **Teacher Part-time**: Khối *"Tìm kiếm & Thêm lớp học"* được hiển thị đầy đủ, cho phép tìm kiếm và thêm **các lớp do chính mình phụ trách giảng dạy** vào hệ thống quản lý.
- **Phân quyền dữ liệu & tìm kiếm theo vai trò (Role-based Scoping)**:
  - **Admin & Teacher Full-time**: Nhìn thấy và tìm kiếm được **TẤT CẢ** các lớp học ở trạng thái opening, running và finished thuộc danh sách cơ sở trực thuộc được phân công (`user_centres`).
  - **Teacher Part-time**: **CHỈ** xem và tìm kiếm được các lớp do chính giáo viên đó phụ trách (nếu tìm kiếm mã lớp người khác dạy sẽ thông báo không tìm thấy).
- **Ràng buộc thêm lớp học (Miễn ít nhất 1 giáo viên phụ trách đã có tài khoản và được duyệt trong Supabase)**:
  - Khi thêm lớp học, hệ thống quét danh sách tất cả giáo viên phụ trách của lớp (bao gồm cả Giảng viên chính LEC và Trợ giảng TA, đối chiếu qua mã LMS `teacherCodes` hoặc Họ tên `teacherName`).
  - Hệ thống kiểm tra trong bảng `users` JOIN với `user_statuses` trên Supabase: **Chỉ cần ít nhất 1 trong số các giáo viên phụ trách của lớp học đó đã có tài khoản và tài khoản đó đang ở trạng thái đã được phê duyệt (`approved`)**, thì lớp học **hoàn toàn được phép thêm vào hệ thống**.
  - Nếu tất cả các giáo viên phụ trách của lớp đều chưa có tài khoản hoặc chưa có tài khoản nào được phê duyệt trên Supabase, hệ thống từ chối thêm và trả về thông báo lỗi: *"Tài khoản này chưa được cấp quyền truy cập vào website này"*.
  - Ngoài ra, nếu người thực hiện thêm lớp là Teacher Part-time thì tài khoản đó bắt buộc phải là một trong số các giáo viên phụ trách lớp học.
- **Quy tắc xác định Giáo viên phân công của lớp học (Toàn diện Giảng viên LEC & Trợ giảng TA)**:
  - Giáo viên phân công của một lớp học bao gồm **tất cả giáo viên có mặt trong lớp học đó với danh nghĩa là Giảng viên chính (LEC) hoặc Trợ giảng (TA)**.
  - Hệ thống quét đồng thời từ 3 nguồn:
    1. Danh sách giáo viên gán trực tiếp cho lớp (`class.teachers`).
    2. Danh sách giáo viên phân bổ trong từng buổi học (`slots[].teachers`).
    3. Điểm danh thực tế của giáo viên trong từng buổi học (`slots[].teacherAttendance`) nếu lớp chưa được phân bổ trước.
  - Hiển thị rõ ràng danh nghĩa: `[Họ và tên] (LEC)` hoặc `[Họ và tên] (TA)` (ví dụ: `Tưởng Tấn Khang (LEC), Kiều Hoàng Mạnh Khang (TA)` hoặc `Huỳnh Nhật Anh (LEC)`).
  - Cả giáo viên có vai trò LEC lẫn TA đều được cấp quyền quản lý và nhìn thấy lớp học đó trong danh sách lớp phân công của mình (`teacherCodes` và `teacherName`).
- **Kiến Trúc Lưu Trữ Bảng Riêng Biệt Trên Supabase (`managed_classes` & `managed_students`)**:
  - Dữ liệu lớp học và học viên được lưu trữ trong 2 bảng chuyên biệt trên Supabase: `managed_classes` và `managed_students` (có khóa ngoại `managed_students.class_id REFERENCES managed_classes(id) ON DELETE CASCADE`).
  - Toàn bộ dữ liệu lớp học và học viên hiển thị rõ ràng, chuẩn quan hệ từng dòng bản ghi độc lập với đầy đủ các cột thuộc tính trong Supabase Table Editor.
  - Bảng `users` chỉ lưu trữ tài khoản người dùng thực tế (Admin, Teacher Full-time, Teacher Part-time), hoàn toàn sạch sẽ, không còn các bản ghi dummy.
  - Hệ thống chỉ thực hiện các câu lệnh đọc dữ liệu từ LMS (Read-only GraphQL Queries), **tuyệt đối không thực hiện bất kỳ mutation hay thao tác ghi nào làm thay đổi dữ liệu trên LMS**.

### 20.3 Bảng Danh Sách Lớp Đang Quản Lý, Bộ Lọc, Sắp Xếp & Phân Trang (20 Lớp / Trang)
1. **Bộ lọc & Sắp xếp đa tiêu chí với Ô Nhập Tìm Kiếm Tích Hợp (`SearchableDropdown`)**:
   - **Lọc từ khóa**: Tìm kiếm tức thì theo mã lớp, khóa học, giáo viên phụ trách, tên cơ sở (hỗ trợ nút xóa nhanh `X`).
   - **Tất cả các bộ lọc dạng dropdown đều tích hợp Ô Nhập Tìm Kiếm bên trong (`SearchableDropdown`)**:
     * **Lọc theo cơ sở**: Dropdown cơ sở trực thuộc có ô tìm kiếm gõ lọc nhanh theo tên/mã cơ sở, giải quyết triệt để danh sách dài của 56 cơ sở MindX.
     * **Lọc theo trạng thái**: Dropdown trạng thái (`Tất cả`, `Đang học`, `Sắp mở`, `Đã kết thúc`) có ô tìm kiếm nhanh.
     * **Sắp xếp linh hoạt (`sortBy`)**: Dropdown sắp xếp có ô tìm kiếm hỗ trợ chuyển đổi tiêu chí thuận tiện.
   - **Thông Báo Hệ Thống (Toast Alert) Luôn Hiển Thị Trên Cùng (`z-[99999]`)**:
     * Hộp thoại thông báo (Toast feedback) được thiết lập `z-[99999]`, đảm bảo khi mở bất kỳ Modal nào (Modal Chi tiết lớp học, Modal Xác nhận, Modal Đối chiếu), thông báo luôn hiển thị sắc nét ở lớp trên cùng, không bao giờ bị chìm xuống dưới backdrop hay modal.
2. **Quy chuẩn Phân trang (20 lớp / Trang) & Nhảy trang linh hoạt**:
   - Bảng hiển thị cố định **20 lớp trên mỗi trang** (`ITEMS_PER_PAGE = 20`).
   - Tự động đánh số thứ tự (STT) liên tục theo từng trang: `(currentPage - 1) * 20 + idx + 1`.
   - **Thanh phân trang phía dưới bảng**:
     * Thông tin tiến trình: *"Hiển thị X - Y trong tổng số Z lớp học"*.
     * Nút chuyển: Trang đầu (`|<<`), Trang trước (`<`), Trang sau (`>`), Trang cuối (`>>|`).
     * **Ô nhập số trang trực tiếp (Jump to page input)**: Cho phép người dùng gõ số trang mong muốn và nhấn Enter hoặc rời chuột (onBlur) để nhảy ngay đến trang đó (có giới hạn tự động từ 1 đến `totalPages`).
     * Tự động đặt lại về trang 1 khi thay đổi từ khóa, cơ sở, trạng thái hoặc tiêu chí sắp xếp.
3. **Cấu trúc 10 cột chuẩn**:
| STT | Mã Lớp & Khóa Học | Cơ Sở | Giáo Viên Phụ Trách | Giờ Học | Ngày Bắt Đầu | Ngày Kết Thúc | Tiến Độ | Trạng Thái | Thao Tác |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `LBB-ROB-ARMA12` | HCM - 414 Lũy Bán Bích | Võ Minh Huân | `18:00 - 20:00` | 08/09/2026 | 08/12/2026 | 1/14 buổi (7%) | Đang học | Xem chi tiết, Sửa, Tải LMS, Học viên, Xóa |

- **Giờ học (`classTime`)**: Trích xuất từ `scheduleSettings` hoặc slot đầu tiên, định dạng chuẩn Việt Nam UTC+7 (ví dụ: `18:00 - 20:00`).
- **Giáo viên phụ trách (`teacherName`)**: Lấy từ danh sách giáo viên có số buổi dạy nhiều nhất.
- **Thao tác nghiệp vụ đầy đủ**: Cột Thao tác cung cấp đầy đủ 5 chức năng:
  1. **Xem chi tiết (`Eye`)**: Mở modal xem thông tin lớp và hạn nộp bài (chế độ chỉ xem).
  2. **Chỉnh sửa (`Pencil`)**: Mở modal chỉnh sửa hạn nộp bài và cấu hình nộp trễ từng buổi.
  3. **Tải dữ liệu từ LMS (`RefreshCw`)**: Đối chiếu và đồng bộ dữ liệu LMS.
  4. **Quản lý học viên (`Users`)**: Mở modal đối chiếu và quản lý học viên lớp học.
  5. **Gỡ lớp (`Trash2`)**: Xóa lớp khỏi danh sách quản lý và dọn dẹp học viên liên kết.
- **Căn giữa chuẩn**: STT, Giáo viên phụ trách, Giờ học, Ngày bắt đầu, Ngày kết thúc, Tiến độ, Trạng thái, Thao tác đều được căn giữa (`text-center`) và áp dụng `whitespace-nowrap`.

### 20.4 Modal Chi Tiết Lớp Học, Cấu Hình Hạn Nộp Bài (Date Picker) & Nộp Trễ (2 Tùy Chọn)
1. **Thông tin tổng quan (Chống rớt chữ & Bố cục tinh gọn)**: Thẻ ngang gồm Trạng thái, Giáo viên phụ trách, Giờ học, Tổng số buổi, và Thời gian học. Toàn bộ tiêu đề và nội dung thẻ đều áp dụng `whitespace-nowrap`, đảm bảo chuỗi ngày tháng liền mạch không bao giờ bị rớt dòng.
2. **Cụm Tab Chuyển Đổi Tinh Gọn**:
   - **Tab 1: 📅 Lịch trình, Hạn nộp bài & Nộp trễ (N buổi)**: Quản lý lịch trình các buổi học, hạn nộp bài bằng ô chọn ngày giờ và cấu hình nộp trễ.
   - **Tab 2: 👥 Danh sách học viên (M học viên)**: Hiển thị danh sách học viên active (đang học) có trong lớp học đó, kèm theo **Mã học viên** được tự động sinh theo quy chuẩn (Tên + Chữ cái đầu Họ đệm). Bảng gồm 4 cột tinh gọn: `[STT]` | `[Mã học viên]` | `[Họ và tên]` | `[Trạng thái]` (Đang học).
3. **Bảng Lịch Trình Chi Tiết Các Buổi Học (Tab 1)**:
   - `Buổi`: Số thứ tự buổi học (1 đến N), căn giữa `whitespace-nowrap`.
   - `Ngày học`: Ngày diễn ra buổi học, định dạng chuẩn Việt Nam `whitespace-nowrap`.
   - `Giờ học`: Khung giờ của buổi học đó (`18:00 - 20:00`), `whitespace-nowrap`.
   - `Ghi chú mốc`: Huy hiệu Checkpoint 1, Checkpoint 2, và **SP Cuối Khóa (hiển thị liên tục trên toàn bộ các buổi từ sau buổi Checkpoint 2 đến buổi cuối cùng)** kèm viền và nền highlight hoa hồng nhẹ `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30`.
   - `Hạn nộp bài (Date / Datetime picker)`: Thay vì nhập chuỗi thô thủ công, hệ thống sử dụng ô chọn ngày giờ (`input type="datetime-local"`) tiện lợi, tự động đồng bộ và định dạng hiển thị chuẩn toàn hệ thống: **Ngày Tháng Năm Giờ Phút** (`DD/MM/YYYY HH:mm` hoặc `DD/MM/YYYY HH:mm - HH:mm`).
   - `Cho phép nộp trễ (Late Submission Config)`: Hỗ trợ nút bật/tắt nộp trễ cho từng buổi học với 2 tùy chọn cấu hình linh hoạt:
     * **Tùy chọn 1 (Ngày giờ cụ thể)**: Người dùng chọn trực tiếp ngày giờ hết hạn nộp trễ qua ô `datetime-local` hiển thị chuẩn Ngày Tháng Năm Giờ Phút (`DD/MM/YYYY HH:mm`), với ràng buộc kỹ thuật **không được vượt quá ngày kết thúc lớp học (`class.endDate`)**.
     * **Tùy chọn 2 (Khoảng thời gian)**: Người dùng thiết lập thời gian nộp trễ linh hoạt qua 4 ô nhập số: **Ngày, Giờ, Phút, Giây** (ví dụ: `+2 ngày 12 giờ 0 phút 0 giây`).
4. **Quy tắc hạn nộp bài mặc định tự động (Chuẩn Ngày Tháng Năm Giờ Phút)**:
   - **Từ Buổi 1 đến Checkpoint 2 (buổi 1 -> cp2)**: Hạn nộp trong buổi học đó: `[Ngày học] [Giờ bắt đầu] - [Giờ kết thúc]` (ví dụ: `08/09/2026 18:00 - 20:00`).
   - **Giai đoạn Sản phẩm cuối khóa (từ buổi ngay sau Checkpoint 2 đến buổi cuối)**: Toàn bộ các buổi trong giai đoạn này đều có **chung một hạn nộp thống nhất**: `[Ngày học Giờ bắt đầu buổi sau CP2] - [Ngày học Giờ kết thúc buổi cuối]` (ví dụ: `29/10/2026 18:00 - 08/12/2026 20:00`).

### 20.5 Kiểm Tra & Tự Động Đồng Bộ Ngầm Thời Gian Thực Từ LMS (Real-time LMS Auto-Sync)
- **Tự động đồng bộ ngầm 4 trường vận hành không bắt duyệt thủ công**:
  - Khi hệ thống kiểm tra đối chiếu LMS (`check_lms_changes`), 4 trường vận hành gồm: **Tiến độ học tập (`progressPercent`)**, **Số buổi đã hoàn thành (`completedSessions`)**, **Ngày bắt đầu / Ngày kết thúc (`startDate`, `endDate`)**, và **Trạng thái lớp (`status`)** sẽ **tự động cập nhật ngầm vào Supabase DB theo thời gian thực** mà không đưa vào danh sách diff bắt người dùng duyệt tay.
- **Cảnh báo thay đổi LMS tại cột Mã Lớp**:
  - Đối với các trường nội dung khác có biến động (Giáo viên, Khung giờ, Học viên), hệ thống hiển thị **Badge Cảnh Báo Nhấp Nháy tại cột Mã Lớp (`LMS Đã Đổi`)**, chỉ hiển thị tại đúng cột Mã Lớp theo quy chuẩn.
- **Đối chiếu học viên chính xác tuyệt đối & Xóa cờ cảnh báo tức thì**:
  - Hệ thống kiểm tra số lượng học viên active thực tế trong cơ sở dữ liệu Supabase (với cơ chế làm mới bộ nhớ cache `getAllManagedStudentsMap(true)` và fallback dữ liệu học viên). Khi số lượng học viên trong lớp đã đồng bộ khớp với LMS, cảnh báo lệch học viên lập tức biến mất.
  - Khi người dùng xác nhận cập nhật từ LMS (cả mục chọn hoặc toàn bộ) hoặc thao tác thêm/cập nhật học viên trong lớp, hệ thống lập tức xóa bỏ cờ diff khỏi `lmsChangesMap` và cập nhật state danh sách ngay tức thì (0ms trễ) mà không chờ polling.
- **Bảo toàn hạn nộp bài tùy chỉnh**: Toàn bộ hạn nộp bài và cấu hình nộp trễ của từng slot buổi học mà người dùng đã cấu hình trước đó đều được bảo toàn nguyên vẹn khi đồng bộ từ LMS.

### 20.6 Danh Mục 56 Cơ Sở MindX Chính Thống (56 Official Campuses)
- Rà soát toàn bộ danh mục cơ sở MindX qua GraphQL query LMS.
- Loại bỏ 32 cơ sở ngưng hoạt động (`isActive === false`) và 15 nhóm/hotline/phòng ban/online/đối tác mầm non.
- Chuẩn hóa danh mục đúng **56 cơ sở vật lý chính thống** trên toàn quốc trong hằng số `OFFICIAL_LMS_CENTRES` và các bộ lọc toàn hệ thống. Admin sở hữu toàn bộ 56 cơ sở này.

---

## 21. Quy Chuẩn Trang Chính Sách Quyền Riêng Tư (Privacy Policy & Google OAuth Compliance Standard)

### 21.1 Mục Đích & Tiêu Chuẩn Xác Minh Google Cloud Console (GCP)
- Trang chính sách quyền riêng tư đặt tại đường dẫn công khai: `/privacy`.
- Phục vụ việc xác minh màn hình đồng ý OAuth (OAuth consent screen verification) trên Google Cloud Platform (GCP) và cung cấp minh bạch về cơ chế thu thập, sử dụng dữ liệu người dùng.
- **Middleware Whitelist**: Tuyến `/privacy` được cấu hình mở công khai trong `middleware.ts`, cho phép tất cả người dùng (kể cả chưa đăng nhập hoặc tài khoản Teacher Part-time đang trong quá trình liên kết Google) đều có thể truy cập đọc chính sách.

### 21.2 Nội Dung Chính Chuẩn Hóa
1. **Thông tin định danh hệ thống**: Đơn vị chủ quản MindX Technology School, tác giả phát triển Huỳnh Nhật Anh (TF Coding HCM4).
2. **Thông tin thu thập**: Email, Họ tên, Ảnh đại diện từ Google; mã LMS, cơ sở trực thuộc, phân quyền vai trò nội bộ; token xác thực OAuth.
3. **Tuân thủ chính sách Google Limited Use**:
   - Khai báo rõ ràng phạm vi sử dụng `https://www.googleapis.com/auth/drive.file`.
   - Cam kết chỉ đọc và quản lý các tệp tin do chính hệ thống tạo ra hoặc người dùng chỉ định chia sẻ, tuyệt đối không truy cập các tệp tin cá nhân khác trong Google Drive.
   - Tuân thủ chính sách dữ liệu dịch vụ Google API (Google API Services User Data Policy), bao gồm các yêu cầu về Limited Use.
4. **Cam kết không thương mại hóa**: Tuyệt đối không bán, cho thuê, chia sẻ cho bên thứ ba hoặc dùng cho quảng cáo/huấn luyện AI.
5. **Quyền của người dùng & Thu hồi liên kết (Unlink)**: Cho phép người dùng hủy liên kết Google Drive trực tiếp trên website hoặc từ trang quản lý tài khoản Google.

### 21.3 Tích Hợp Liên Kết Trên Giao Diện
- **Chân trang (SystemFooter)**: Bổ sung liên kết *"Chính sách quyền riêng tư"* ngay cạnh thông tin bản quyền và phiên bản hệ thống.
- **Màn hình liên kết Google Drive (`/connect-google-drive`)**: Hiển thị liên kết dẫn trực tiếp tới `/privacy` phía dưới các nút thao tác để giảng viên xem xét trước khi cấp quyền.

---

## 22. Luồng Quản Lý Học Viên & Đồng Bộ Tự Động Từ LMS (Student Management Flow)

### 22.1 Tự Động Trích Xuất & Lưu Trữ Khi Thêm Lớp Học
- Khi người dùng thêm một lớp học vào hệ thống (hoặc khi xác nhận cập nhật đè từ LMS):
  - Hệ thống tự động truy vấn danh sách học viên từ LMS GraphQL (`Class.students { _id activeInClass completed student { id fullName status email phoneNumber } }`).
  - **Lọc học viên đang học**: Chỉ trích xuất các học viên đang có `activeInClass === true`.
  - Hệ thống lưu trữ danh sách học viên trực tiếp vào bảng `managed_students` trên Supabase Database với liên kết khóa ngoại `class_id REFERENCES managed_classes(id) ON DELETE CASCADE`. Bảng `users` hoàn toàn không bị can thiệp.

### 22.2 Thuật Toán Tự Sinh Mã Học Viên (Unique Student Code Generation)
- Mã học viên được tự động sinh theo quy tắc chuẩn:
  $$\text{Mã Học Viên} = \text{Tên (viết hoa không dấu)} + \text{Chữ cái đầu viết hoa của Họ và Tên đệm} + [\text{Số thứ tự nếu trùng}]$$
- **Ví dụ**:
  - `Vũ Quang Vinh` $\rightarrow$ Tên: `VINH`, Họ và đệm: `V` (Vũ) + `Q` (Quang) $\rightarrow$ **`VINHVQ`**.
  - `Nguyễn Minh Nhật` $\rightarrow$ Tên: `NHAT`, Họ và đệm: `N` (Nguyễn) + `M` (Minh) $\rightarrow$ **`NHATNM`**.
  - `Lê Hoàng Long` $\rightarrow$ Tên: `LONG`, Họ và đệm: `L` (Lê) + `H` (Hoàng) $\rightarrow$ **`LONGLH`**.
- **Xử lý trùng lặp**:
  - Nếu trong hệ thống đã tồn tại mã `VINHVQ`, học viên tiếp theo có cùng cấu trúc mã sẽ được gắn số thứ tự tăng dần: **`VINHVQ1`**, **`VINHVQ2`**, v.v., đảm bảo 100% không bao giờ bị xung đột mã định danh.

### 22.3 Màn Hình Quản Lý Học Viên Độc Lập (Standalone Student Management Screen)
- **Tách biệt hoàn toàn khỏi Quản lý lớp học**:
  - Không gộp chung dạng tab, mà chia thành 2 màn hình riêng biệt:
    1. **Quản lý lớp học (`/[role]/system-management/classes`)**: Chuyên biệt quản lý các lớp học, hạn nộp bài, tiến độ, đối chiếu lớp với LMS.
    2. **Quản lý học viên (`/[role]/system-management/students`)**: Màn hình độc lập riêng với URL định tuyến chuẩn `/[role]/system-management/students`.
  - **Phân quyền màn hình độc lập**: Mã quyền `student_management` được thiết lập độc lập trên cây menu của bảng phân quyền màn hình (`ScreenPermissionScreen`).
  - **Menu Sidebar chuyên biệt**: Mục "Quản lý học viên" nằm độc lập dưới khối "QUẢN LÝ HỆ THỐNG" với icon `UserCheck` từ `lucide-react`.

- **Bộ lọc & Sắp xếp học viên**:
  - **Lọc từ khóa**: Tìm kiếm theo Tên học viên, Mã học viên, Email, Số điện thoại, Tên lớp.
  - **Lọc theo Cơ sở**: Danh sách cơ sở trực thuộc của tài khoản (`userCentres`).
  - **Lọc theo Lớp học**: Danh sách các lớp học mà học viên đang theo học.
  - **Lọc theo Trạng thái**: Tất cả, Đang học (Active), Đã nghỉ / Khác.
  - **Sắp xếp**: Tên A → Z / Z → A, Mã HV A → Z / Z → A, Tên lớp A → Z.
- **Phân trang**:
  - Cố định **20 học viên / trang** (`STUDENTS_PER_PAGE = 20`), hỗ trợ ô nhập nhảy trang trực tiếp và đánh số STT liên tục `(currentPage - 1) * 20 + idx + 1`.

### 22.4 Bảng Học Viên & Thao Tác Nghiệp Vụ
- **Cấu trúc cột bảng học viên (7 cột chuẩn)**:
| STT | Mã Học Viên | Họ Và Tên | Lớp Đang Theo Học | Cơ Sở | Trạng Thái | Thao Tác |
| :---: | :---: | :--- | :--- | :--- | :---: | :---: |
| 1 | `VINHVQ` | Vũ Quang Vinh | `LBB-ROB-ARMA12` | HCM - 414 Lũy Bán Bích | Đang học | Xem, Sửa, Đối chiếu LMS, Xóa |

- **Cảnh báo thay đổi LMS tại cột Họ và Tên**:
  - Khi phát hiện thông tin học viên trên LMS có biến động (Họ tên, Trạng thái, Email, SĐT), hệ thống gắn trực tiếp **Badge Cảnh Báo `LMS Đã Đổi`** (icon `AlertCircle`) ngay cạnh Họ và Tên của học viên.
- **Tự động chuyển lớp ngầm cho học viên (Automatic Class Transfer Sync)**:
  - Nếu học viên thay đổi lớp học hiện tại từ LMS sang lớp khác, hệ thống **tự động cập nhật ngầm lớp học mới vào Supabase DB ngay lập tức** mà không bắt người dùng phải chờ duyệt thủ công.
- **Thao tác nghiệp vụ đầy đủ trên từng học viên**:
  1. **Xem chi tiết (`Eye`)**: Mở modal xem thông tin học viên, mã học viên, lớp học và thông tin liên hệ.
  2. **Chỉnh sửa (`Pencil`)**: Mở modal chỉnh sửa họ tên, trạng thái và lớp học của học viên trong Supabase DB (`PUT /api/students/[id]`).
  3. **Đối chiếu LMS (`RefreshCw`)**: So sánh thông tin học viên với LMS thời gian thực. Nếu có thay đổi, mở modal đối chiếu side-by-side để cập nhật; sau khi cập nhật thành công, xóa ngay cờ cảnh báo diff real-time.
  4. **Xóa học viên (`Trash2`)**: Mở modal xác nhận an toàn để xóa học viên khỏi danh sách quản lý (`DELETE /api/students/[id]`).
- **Tự động xóa học viên khi gỡ lớp**:
  - Khi một lớp học bị gỡ khỏi danh sách quản lý, toàn bộ học viên thuộc lớp đó sẽ tự động được dọn dẹp sạch sẽ khỏi bảng `managed_students`.

### 22.5 Luồng Đối Chiếu & Quản Lý Học Viên Ngay Sau Khi Thêm Lớp (Post-Class-Add Student Review & Sync Flow)
- **Tự động mở Modal sau khi Thêm Lớp**:
  - Khi người dùng bấm nút **"Thêm"** tại Modal Xem/Thêm Lớp Học (`handleConfirmAdd`), hệ thống chỉ lưu thông tin lớp học vào bảng `managed_classes` trên Supabase (không tự động ép nạp học viên ngầm).
  - Ngay sau khi thêm thành công, hệ thống tự động mở **Modal Danh Sách Học Viên Lớp Học & Đối Chiếu Dữ Liệu LMS** (`studentReviewModalClass`).
- **Cơ chế Đối chiếu Dữ liệu LMS & Supabase (`GET /api/students?type=review&classId=...`)**:
  - **Tiêu chuẩn học viên active trong lớp (`activeInClass !== false`)**: Trên hệ thống LMS MindX, trạng thái `student.status` (như `ACTIVE`, `IDLE`, `WAITING`, `ONHOLD`) phản ánh trạng thái học vụ/hợp đồng của học viên với trung tâm, không quyết định việc học viên có đang học lớp này hay không. Do đó, hệ thống căn cứ chuẩn xác theo cờ **`activeInClass !== false`** của từng học viên trong lớp (chỉ loại bỏ các học viên đã rút/chuyển lớp có `activeInClass === false`).
  - Hệ thống so sánh danh sách học viên active từ LMS với bảng `managed_students` trên Supabase và phân loại thành 3 nhóm rõ ràng:
    1. **Chưa lưu trong Supabase (`NOT_IN_SUPABASE`)**:
       - Hiển thị badge đỏ Ruby: `Chưa lưu trong Supabase`.
       - Đi kèm nút **"Thêm"** (icon `Plus`) để người dùng chủ động nạp từng học viên vào Supabase kèm mã định danh được sinh tự động.
       - Thanh công cụ phía dưới hiển thị nút: **"Thêm tất cả học viên mới (N)"** để thêm hàng loạt chỉ bằng 1 cú nhấp chuột.
    2. **Có thay đổi từ LMS (`HAS_CHANGES`)**:
       - Hiển thị badge hổ phách: `Có thay đổi từ LMS (N)`.
       - Liệt kê chi tiết từng trường thay đổi theo dạng: `<Tên trường>: <Dữ liệu cũ (gạch ngang, đỏ)> ➔ <Dữ liệu mới LMS (xanh lá)>`.
       - Đi kèm nút **"Cập nhật"** để đồng bộ thông tin mới nhất vào Supabase.
       - Thanh công cụ phía dưới hiển thị nút: **"Cập nhật tất cả học viên thay đổi (N)"** để đồng bộ hàng loạt các học viên có biến động.
    3. **Đã đồng bộ (`UP_TO_DATE`)**:
       - Hiển thị badge xanh lá: `Đã có trong hệ thống (Khớp LMS)`.
       - Cột thao tác hiển thị icon `Check` xanh kèm nhãn: `Đã lưu`.
- **Bộ lọc linh hoạt (Quick Filter Pills)**:
  - Cho phép người dùng chuyển đổi nhanh giữa các tab:
    - *Tất cả (N)*
    - *Chưa lưu trong Supabase (N)*
    - *Có thay đổi từ LMS (N)*
    - *Đã đồng bộ (N)*
- **Điểm truy cập kiểm tra bất kỳ lúc nào**:
  - **Từ bảng quản lý lớp học**: Cột Thao Tác bổ sung nút icon `Users` để mở bảng đối chiếu học viên bất kỳ lúc nào.
  - **Từ Modal Chi Tiết Lớp Học (Tab 2: Danh sách học viên)**:
    - **Hiển thị trực tiếp tại từng học viên (Inline Diff Standard)**: Triệt tiêu hoàn toàn khối banner ẩn/hiện gây phân mảnh giao diện. Nếu học viên có thay đổi dữ liệu từ LMS (Họ tên, Trạng thái, Email, Số điện thoại), hệ thống gắn trực tiếp nhãn cảnh báo ngay tại dòng của học viên đó: `Có sự thay đổi về [Tên trường...]` kèm nút bấm **Cập nhật** riêng cho học viên đó.
    - Thanh tiêu đề Tab 2 bổ sung nút *"Đối chiếu học viên với LMS"* để mở Modal Đối Chiếu Đầy Đủ khi cần.

---

## 23. Quy Chuẩn Triệt Tiêu Hộp Thoại & Thông Báo Mặc Định Trình Duyệt (Zero Browser Default Dialog Standard)

### 23.1 Nguyên Tắc Trải Nghiệm Người Dùng (UX Rule)
- Tuyệt đối cấm sử dụng các hàm mặc định của trình duyệt: `alert()`, `confirm()`, `prompt()`. Các hộp thoại này chặn luồng tương tác của trình duyệt, làm gãy vỡ tính thẩm mỹ và không tương thích với trải nghiệm ứng dụng hiện đại.
- Tất cả các tương tác thông báo và yêu cầu xác nhận thao tác nghiệp vụ bắt buộc phải sử dụng **Toast Notification** hoặc **Custom Modal** đồng bộ hoàn toàn với bảng màu Ruby/Crimson và chế độ Sáng / Tối của SMH.

### 23.2 Hệ Thống Toast Phản Hồi (`components/common/Toast.tsx`)
- Vị trí hiển thị: Góc trên bên phải màn hình (`fixed top-4 right-4 z-[99999]`), hiệu ứng hoạt họa trượt vào mượt mà (`animate-in fade-in slide-in-from-top-3`).
- Phân loại trực quan & Icon từ `lucide-react`:
  - **Thành công (`success`)**: Nền xanh lá `bg-emerald-500 text-white`, icon `Check`.
  - **Lỗi / Cảnh báo thất bại (`error`)**: Nền đỏ Ruby `bg-rose-500 text-white`, icon `AlertCircle`.
  - **Thông tin (`info`)**: Nền than chì `bg-slate-900 dark:bg-[#0B0F17] text-white`, icon `CheckCircle2`.
- Thời gian hiển thị: Tự động biến mất sau **3.5 - 4.5 giây**, kèm nút bấm đóng tức thì (`X`).

### 23.3 Hộp Thoại Xác Nhận Hành Động Tùy Biến (`components/common/ConfirmModal.tsx`)
- Áp dụng cho mọi thao tác quan trọng hoặc có tính chất xóa / thay đổi liên kết:
  - **Xóa tài khoản người dùng**: Loại `danger` (Đỏ Ruby), nêu rõ họ tên và mã LMS của tài khoản bị xóa, cảnh báo hành động không thể hoàn tác.
  - **Gỡ lớp học khỏi danh sách quản lý**: Loại `danger`, cảnh báo tự động dọn dẹp toàn bộ học viên thuộc lớp khỏi bảng `managed_students`.
  - **Hủy liên kết tài khoản Google Drive**: Loại `warning` (Hổ phách `amber`), thông báo giảng viên sẽ cần phải liên kết lại khi đăng nhập.
- Trải nghiệm an toàn & Chống bấm đúp: Nền mờ kính cao cấp `backdrop-blur-sm`, nút xác nhận tích hợp biểu tượng xoay tải (`Loader2`) và tự động vô hiệu hóa (`disabled`) khi đang gửi yêu cầu mạng lên máy chủ.

---

## 24. Luồng Quản Lý Định Mức Nộp Bài Học Viên (Student Submission Quota Flow)

### 24.1 Mô Hình Phân Cấp Định Mức (4 Cấp Bậc Phân Quyền)
Nhằm kiểm soát dung lượng lưu trữ đám mây Google Drive của giáo viên và ngăn chặn học viên tải lên tệp tin rác quá lớn, hệ thống áp dụng cơ chế phân cấp định mức 4 tầng:

```mermaid
graph TD
    A[1. Quản Trị Viên (Admin)] -->|Cấu hình mức trần maxQuotaMb (10 - 500MB)| B[2. Giáo Viên Part-time]
    B -->|Tùy chỉnh định mức mặc định defaultStudentQuotaMb (1 - maxQuotaMb) trong /profile| C[3. Đồng Bộ Lớp / Học Viên Mới]
    C -->|Gán tự động submissionQuotaMb cho học viên| D[4. Học Viên (managed_students)]
    A -->|Có quyền sửa định mức riêng của từng học viên| D
    B -->|Có quyền sửa định mức riêng của học viên lớp mình| D
```

1. **Cấp 1 - Quản Trị Viên (Admin Scope)**:
   - Tại màn hình Quản lý tài khoản (`UserManagementScreen.tsx`), chỉ Quản trị viên mới thấy nút icon **`HardDrive` (Định mức nộp)** tại cột Thao Tác của các giáo viên Part-time.
   - Mở modal cấu hình định mức trần (`maxQuotaMb`, từ 10MB đến 500MB, mặc định 100MB) cho từng giáo viên. Cập nhật qua `PATCH /api/admin/users/[id]` với trường `max_submission_quota_mb`.
2. **Cấp 2 - Giáo Viên Part-time (Teacher Scope)**:
   - Tại trang Hồ sơ cá nhân (`/profile`), **chỉ tài khoản Giáo viên Part-time** mới hiển thị Card *"Định mức nộp bài cho học viên"*.
   - Cho phép giáo viên kéo thanh trượt / nhập số để tùy chỉnh định mức mặc định cho học viên của mình (`defaultStudentQuotaMb`, từ 1MB đến `max_submission_quota_mb`, mặc định 50MB).
   - Khi lưu hồ sơ, gọi `PATCH /api/profile` để lưu vào Supabase `system_settings` (key: `teacher_quotas`) và bảng `users`.
3. **Cấp 3 - Cơ Chế Kế Thừa Khi Tạo / Đồng Bộ Học Viên**:
   - Khi giáo viên thêm lớp hoặc đồng bộ học viên vào Supabase (`syncStudentsForClass`), hệ thống tự động tra cứu `defaultStudentQuotaMb` của giáo viên phụ trách lớp và gán trực tiếp vào `submissionQuotaMb` của từng học viên mới.
4. **Cấp 4 - Quản Lý Định Mức Tại Màn Hình Học Viên (`StudentManagementScreen.tsx`)**:
   - Bảng quản lý học viên bổ sung cột thứ 8: **"Định Mức Nộp"** (căn giữa, badge xám/ruby nổi bật kèm đơn vị `MB`).
   - Modal xem chi tiết học viên hiển thị rõ hạn mức lưu trữ của học viên.
   - Modal chỉnh sửa học viên cho phép cập nhật riêng định mức `submissionQuotaMb` cho từng học viên cụ thể qua `PUT /api/students/[id]`.

### 24.2 Cơ Chế Lưu Trữ Bền Vững Trực Tiếp Trên Supabase Database (Supabase Quotas Persistence)
Toàn bộ hạn mức dữ liệu nộp bài của giáo viên và từng học viên được lưu trữ và truy vấn trực tiếp trên cơ sở dữ liệu Supabase theo kiến trúc hai lớp (Dual-Layer Supabase Architecture):
1. **Lớp Cấu Hình Định Mức Giáo Viên**:
   - Lưu trữ tập trung tại bảng `system_settings` với khóa `key = 'teacher_quotas'`.
   - Đồng bộ song song vào bảng `users` với 2 cột `max_submission_quota_mb` và `default_student_quota_mb`.
   - Dịch vụ `teacher-quota-service.ts` ưu tiên đọc dữ liệu tươi từ Supabase, tự động đối chiếu linh hoạt theo UUID hoặc mã LMS.
2. **Lớp Định Mức Học Viên Riêng Lẻ**:
   - Lưu trữ bản đồ định mức riêng biệt tại bảng `system_settings` với khóa chuyên trách `key = 'student_quotas'` (`{ [studentId]: quotaMb }`), kết hợp lưu cùng danh sách `managed_students`.
   - Đồng bộ trực tiếp vào cột `submission_quota_mb` của bảng `managed_students` trên Supabase.
   - Khi đọc danh sách học viên (`getAllManagedStudentsMap`), hệ thống tự động tải bản đồ `student_quotas` từ Supabase và gán khớp chuẩn xác vào từng học viên.
   - Mọi thao tác chỉnh sửa hạn mức học viên từ giao diện quản lý ngay lập tức đẩy dữ liệu lên Supabase qua API `PUT /api/students/[id]`.

---

## 25. Luồng Cổng Nộp Bài Học Viên & Xác Thực Đa Tầng (Student Submission Portal & Verification Flow)

### 25.1 Điểm Truy Cập & Tách Biệt Menu Sidebar Khách vs Đã Đăng Nhập (Hiển Thị Sidebar Toàn Diện Trên Mọi Giao Diện Khách)
- **Hiển Thị Sidebar Toàn Diện Trên Mọi Giao Diện Khách (Full Guest Sidebar Coverage)**:
  - Toàn bộ các trang công khai/giao diện khách bao gồm: **Trang chủ (`/`)**, **Cổng nộp bài (`/submit`)**, **Đăng nhập (`/login`)**, **Nhật ký phiên bản (`/changelog`)**, **Chính sách quyền riêng tư (`/privacy`)**, và **Trang 404 (`/not-found`)** đều được bao bọc thống nhất trong `AppLayout`.
  - Mọi người dùng dù chưa đăng nhập khi truy cập bất kỳ trang nào đều nhìn thấy **Sidebar bên trái** hoàn chỉnh, hỗ trợ co giãn thu gọn linh hoạt và Drawer cảm ứng trên thiết bị di động.
- **Khi là khách / học viên (Chưa đăng nhập)**:
  - Sidebar bên trái hoạt động độc lập, tinh gọn chỉ gồm 2 mục điều hướng trực tiếp: *"Trang chủ"* (`/`) và *"Cổng nộp bài"* (`/submit`). Tuyệt đối không tạo nhóm accordion chevrons rườm rà.
  - Dưới đáy sidebar: Khi ở Trang chủ hiển thị nút *"Đăng Nhập"* (`/login`); khi ở các trang khác hiển thị nút *"Xem Trang Chủ"* (`/`).
  - Nút *"Đăng nhập"* trên Header tự động ẩn khi người dùng đang ở chính trang `/login` để tránh dư thừa giao diện.
- **Sau khi đăng nhập**: Sidebar hiển thị các nhóm quản trị nghiệp vụ theo phân quyền vai trò (`QUẢN LÝ HỆ THỐNG`, `KIỂM TRA DỮ LIỆU`). Mục *"Cổng nộp bài"* được hiển thị trực tiếp thành 1 mục đơn lẻ bên dưới các nhóm, không bọc trong nhóm menu chính `HỌC VIÊN` hay tạo mũi tên dropdown riêng.
- **Header Tinh Gọn**: Tuyệt đối không đặt nút nộp bài trên thanh Header để giữ Header tinh gọn, đồng bộ chuẩn mực nhận diện thương hiệu. Mọi giao diện đều kế thừa `AppLayout`.

### 25.2 Ô Nhập Mã Truy Cập Nhanh
- Đầu trang cung cấp ô nhập *"Mã truy cập"* (Access Code) kèm nút *"Truy cập"* liền kề để phục vụ tính năng mở khóa nhanh bài nộp hoặc xác thực nâng cao.

### 25.3 Luồng Chọn Tuần Tự 5 Tầng Thác Nước & Quy Chuẩn Nhãn Dropdown Không Chứa Mở Ngoặc
Để đảm bảo tính toàn vẹn dữ liệu và trải nghiệm người dùng sạch sẽ, dễ đọc nhất:
- **Quy chuẩn nhãn hiển thị Dropdown (Không chứa nội dung trong ngoặc đơn)**:
  * **Họ tên Giáo viên**: Chỉ hiển thị thuần túy `{t.fullName}` (tuyệt đối không kèm mã `({t.lmsCode})`).
  * **Tên Lớp học**: Chỉ hiển thị tên lớp và khóa học `{c.name} • {c.courseName}` (tuyệt đối không kèm tên cơ sở `({c.centreName})`).
  * **Họ tên Học viên**: Chỉ hiển thị thuần túy `{s.fullName}` (tuyệt đối không kèm mã `({s.studentCode})`).
  * **Placeholder tinh gọn**: Viết ngắn gọn, chỉ kêu điền/chọn gì (`-- Chọn giáo viên --`, `-- Chọn lớp học --`, `-- Chọn học viên --`, `-- Chọn giai đoạn --`), tuyệt đối không giải thích dài dòng hay nêu ví dụ.

- **Cơ chế khóa tầng (Cascading Lock)**:
  1. **Bước 1: Chọn Giáo Viên (Teacher Selection)**:
     - Chỉ hiển thị các giáo viên thỏa mãn đồng thời 3 điều kiện:
       + Vai trò là **Giáo viên Part-time** (`Teacher Part-time`).
       + Trạng thái tài khoản đã được phê duyệt (**`approved`**).
       + Đã hoàn tất liên kết tài khoản lưu trữ đám mây qua **Google Drive OAuth**.
  2. **Bước 2: Chọn Lớp Học (Class Selection)**:
     - Khóa khi chưa chọn giáo viên. Hiển thị danh sách lớp do giáo viên đã chọn phụ trách (kèm tên môn học).
  3. **Bước 3: Chọn Học Viên (Student Selection)**:
     - Khóa khi chưa chọn lớp học. Hiển thị danh sách học viên trong lớp theo tên sạch không kèm ngoặc đơn.
     - Đã loại bỏ hiển thị định mức tại nhãn Bước 3 để chuyển xuống khu vực chuyên trách trước phần chọn hình thức nộp bài.
  4. **Bước 4: Chọn Giai Đoạn (Phase Selection)**:
     - Khóa khi chưa chọn học viên.
     - Bổ sung giai đoạn **"Buổi học thường"** gồm tất cả các buổi học không thuộc các mốc đặc biệt (Checkpoint 1, Checkpoint 2, SPCK). Danh sách buổi học thường được lưu bền vững vào Supabase tại cột `regular_sessions` (JSONB) của bảng `managed_classes`.
     - Các giai đoạn gồm:
       * *Buổi học thường (Regular Sessions)*: Các buổi học thông thường trên lớp.
       * *Giai đoạn 1 (Checkpoint 1)*: Buổi kiểm tra / dự án giai đoạn 1.
       * *Giai đoạn 2 (Checkpoint 2)*: Buổi kiểm tra / dự án giai đoạn 2.
       * *Dự án cuối khóa (SPCK)*: Buổi báo cáo sản phẩm cuối khóa.
  5. **Bước 5: Chọn Buổi Học & Giới Hạn Cố Định Theo Giai Đoạn (Strict Phase-Scoped Sessions)**:
     - Khóa khi chưa chọn giai đoạn.
     - **Chỉ hiển thị và cho phép chọn duy nhất các buổi học thuộc giai đoạn đã chọn** (`sessionNumbers`), học viên không thể xem hoặc chọn các buổi học nằm ngoài giai đoạn đó.
     - Mỗi thẻ buổi học hiển thị huy hiệu trạng thái tương ứng:
       * 🟢 *Xanh lá*: Còn hạn nộp.
       * 🔴 *Đỏ Ruby*: Quá hạn nộp.
       * 🟡 *Vàng Hổ Phách*: Nộp muộn cho phép.
       * 🔵 *Xanh Dương*: Chưa mở / Sắp mở.

### 25.4 Khu Vực Hạn Mức Nộp Bài & Trạng Thái Hạn Nộp Của Buổi Học (Quota & Deadline Status Banner)
Đặt cố định ngay sau Bước 5 (chọn buổi học) và trước khu vực lựa chọn hình thức nộp bài:
1. **Hạn Mức Nộp Bài Học Viên**:
   - Thẻ hiển thị dung lượng tối đa học viên được nộp trong một lần (ví dụ: `50 MB`), kèm họ tên học viên đang chọn.
2. **Huy Hiệu Trạng Thái Hạn Nộp 4 Màu Sắc**:
   - 🟢 **Màu Xanh Lá (Đang trong hạn nộp)**: Thời gian hiện tại nằm trong khung thời gian mở nộp bài hợp lệ. Cổng nộp bài mở hoàn toàn.
   - 🔴 **Màu Đỏ Ruby (Đã hết hạn nộp - Khóa cổng nộp bài)**: Đã vượt quá hạn nộp bài cho phép. Hệ thống lập tức hiển thị cảnh báo đỏ và **khóa toàn bộ khu vực nộp bài** (vô hiệu hóa kéo thả tệp tin, ô chọn file, ô nhập liên kết và nút nộp).
   - 🟡 **Màu Vàng Hổ Phách (Hết hạn chính thức - Cho phép nộp muộn)**: Đã quá hạn nộp bài chính thức của buổi học nhưng vẫn nằm trong khung thời gian nộp muộn gia hạn. Cho phép học viên tiếp tục nộp bài kèm ghi nhận cờ nộp muộn (`isLate`).
   - 🔵 **Màu Xanh Dương (Chưa mở / Sắp mở)**: Buổi học chưa đến thời gian cho phép nộp bài. Hệ thống khóa cổng nộp bài và thông báo thời gian mở dự kiến.

### 25.5 Phương Thức Nộp Bài Đa Năng (File Dropzone & Link Submission)
Khi cổng nộp bài ở trạng thái mở (`canSubmit === true`), học viên được lựa chọn giữa 2 hình thức:
1. **Nộp Tệp Tin (File Dropzone)**:
   - Hỗ trợ kéo thả hoặc bấm tải lên các tệp tin bài làm (`.zip`, `.rar`, `.pdf`, `.docx`, `.pptx`, `.png`, `.jpg`,...).
   - Đo lường dung lượng tệp tin tải lên theo thời gian thực và so sánh với định mức của học viên (`submissionQuotaMb`).
   - Thanh tiến trình hiển thị trực quan dung lượng đã dùng: `X.XX MB / Y MB (Z%)`. Nếu tổng dung lượng vượt quá định mức, hệ thống cảnh báo đỏ và khóa nút gửi bài.
2. **Nộp Liên Kết (Link Submission) & Kiểm Tra Quyền Truy Cập**:
   - Hỗ trợ nhập liên kết sản phẩm (Canva, Google Drive, Figma, GitHub, Scratch, hoặc trang web công khai).
   - Tích hợp nút **"Kiểm tra quyền truy cập"**: Gọi API `POST /api/submission/check-link` để kiểm tra liên kết có đang mở quyền truy cập công khai cho mọi người xem hay không. Báo xanh nếu liên kết truy cập được, hoặc cảnh báo nếu liên kết bị khóa riêng tư.

### 25.6 Nút Nộp Bài Thông Minh (Smart Submission Button)

---

## 26. Luồng Quản Lý Học Viên & Tự Động Điều Chuyển Giáo Viên Phụ Trách (Student-Teacher Dynamic Scoping & Transfer Flow)

### 26.1 Phân Quyền Hiển Thị Dữ Liệu Theo Giáo Viên Phụ Trách
- **Nguyên tắc cốt lõi**: Giáo viên (Full-time hoặc Part-time) chỉ được xem và quản lý những học viên thuộc các lớp mà mình đang trực tiếp phụ trách giảng dạy.
- **Tài khoản Quản trị viên (Admin / Super Admin)**: Được xem và quản lý toàn bộ học viên thuộc tất cả các cơ sở trực thuộc được cấp quyền.
- **Cơ chế khớp định danh đa dạng**:
  * Khớp mã LMS của giáo viên (`user.lmsCode`) trong danh sách mã giáo viên của lớp (`currentClass.teacherCodes`).
  * Khớp họ tên đầy đủ đã được chuẩn hóa (`normalizeTeacherName(user.fullName)`) với họ tên giáo viên trong lớp (`currentClass.teacherName`). Chuẩn hóa tự động lược bỏ các hậu tố phụ trách như `(LEC)`, `(TA)` và các tiền tố chức danh (`TF`, `GV`, `TA`, `Thầy`, `Cô`).
  * Khớp định danh tài khoản đã tạo lớp học (`currentClass.addedBy`).

### 26.2 Cơ Chế Tự Động Cập Nhật Khi Học Viên Chuyển Lớp (Thầy A $\rightarrow$ Thầy B)
Khi học viên có sự thay đổi về lớp học:
1. **Trường hợp học viên đang học lớp do Thầy A phụ trách**:
   - Dữ liệu `teacher_name` và `teacher_codes` trên Supabase ghi nhận Thầy A.
   - Chỉ Thầy A xem được học viên này trên giao diện Quản lý học viên và Cổng nộp bài. Thầy B hoàn toàn không nhìn thấy học viên này.
2. **Trường hợp học viên chuyển sang lớp do Thầy B phụ trách**:
   - Khi hệ thống đồng bộ danh sách lớp hoặc khi giáo viên/quản trị viên tải dữ liệu học viên, hàm `reconcileStudentsWithClasses()` sẽ tự động đối chiếu lớp học hiện tại của học viên:
     * Cập nhật `teacher_name` và `teacher_codes` sang Thầy B.
     * Cập nhật `class_name` và `class_id` sang lớp mới của Thầy B.
     * Tự động lưu vết lịch sử: `last_teacher_name` ghi nhận Thầy A, `last_class_name` ghi nhận lớp trước đó.
   - **Kết quả hiển thị tức thì**: Thầy B giờ đây xem và quản lý được học viên này. Ngược lại, Thầy A **hoàn toàn không còn nhìn thấy học viên này nữa** (đảm bảo tính bảo mật và đúng phạm vi phụ trách).

### 26.3 Cơ Chế Bảo Toàn Giáo Viên Phụ Trách Gần Nhất (Fallback Khi Lớp Không Xác Định)
- Trong trường hợp lớp học hiện tại của học viên **không xác định được** (ví dụ: lớp học đã kết thúc và bị gỡ khỏi hệ thống, học viên tạm ngưng học hoặc đang chờ xếp lớp mới):
  * Hệ thống tự động kích hoạt cơ chế bảo toàn giáo viên phụ trách gần nhất: Giữ nguyên `last_teacher_name` và `last_teacher_codes`.
  * Giáo viên phụ trách gần nhất đó vẫn tiếp tục xem được học viên trong danh mục quản lý của mình để hỗ trợ kiểm tra thông tin, xem lại bài nộp cũ hoặc theo dõi tiến trình của học viên.
  * Trên giao diện bảng học viên, nhãn phụ `(Gần nhất)` màu hổ phách được hiển thị để phân biệt rõ ràng với các lớp đang hoạt động chính thức.

### 26.4 Cấu Trúc Bảng Dữ Liệu Bền Vững Trên Supabase
Bảng `managed_students` được mở rộng các trường dữ liệu:
- `teacher_name` (TEXT): Tên giáo viên phụ trách lớp học hiện tại.
- `teacher_codes` (JSONB): Mảng mã LMS của các giáo viên phụ trách lớp học hiện tại.
- `last_teacher_name` (TEXT): Tên giáo viên phụ trách gần nhất (dùng khi lớp học không xác định hoặc khi chuyển lớp).
- `last_teacher_codes` (JSONB): Mảng mã LMS của giáo viên phụ trách gần nhất.
- `last_class_id` (TEXT): ID của lớp học trước đó.
- `last_class_name` (TEXT): Tên của lớp học trước đó.
- Dữ liệu được đồng bộ song song với bảng `system_settings` (khóa `managed_students`) đảm bảo hệ thống vận hành bền vững 100% trên cả môi trường local lẫn Vercel Serverless.











---

## 27. Luồng Tự Động Phân Định Vai Trò Giáo Viên Lớp Học (Teacher Role Deduction: LEC, TA, Supply)

### 27.1 Quy Tắc Phân Biệt Thực Tế Dựa Trên Dữ Liệu Điểm Danh LMS
Khi đồng bộ hoặc kiểm tra thông tin lớp học từ LMS MindX GraphQL, hệ thống quét qua danh sách phân công lớp (`c.teachers`), danh sách phân công từng buổi (`slots[].teachers`) và dữ liệu điểm danh thực tế (`slots[].teacherAttendance` với trạng thái `ATTENDED`):
1. **Giảng viên chính (LEC - Lecturer)**:
   - Giáo viên có số buổi đứng lớp thực tế nhiều nhất (`attendedCount` lớn nhất).
   - Trong trường hợp số buổi điểm danh bằng nhau, hệ thống ưu tiên giáo viên được phân công chính thức làm Giảng viên (`assignedRole === 'LEC'`) và có số lượng ca dạy được phân công (`slotCount`) nhiều hơn.
2. **Trợ giảng (TA - Teaching Assistant)**:
   - Giáo viên được phân công vai trò TA trên LMS, HOẶC:
   - Giáo viên cùng tham gia điểm danh trong cùng một buổi học với Giảng viên chính (`coAttendedCount > 0` và `coAttendedCount >= soloAttendedCount`).
3. **Giáo viên dạy thay (Supply)**:
   - Giáo viên được phân công vai trò Supply trên LMS, HOẶC:
   - Giáo viên chỉ tham gia đứng lớp một mình ở các buổi mà Giảng viên chính vắng mặt (`soloAttendedCount > 0` và `coAttendedCount === 0`), thay thế cho Giảng viên chính.

### 27.2 Thứ Tự Ưu Tiên & Định Dạng Hiển Thị
- Định dạng chuỗi: `Tên Giáo Viên (Role)` (Ví dụ: `Huỳnh Nhật Anh (LEC), Lê Ngọc Tú (TA)`, hoặc `Huỳnh Nhật Anh (LEC), Nguyễn Quốc Thành (Supply)`).
- Thứ tự sắp xếp ưu tiên: `LEC` -> `TA` -> `Supply` -> `Mentor`.


---

## 28. Quy Chuẩn Tự Động Đồng Bộ Dữ Liệu LMS & Hệ Thống Thông Báo Tổng Hợp (LMS Auto-Sync & Notification Center)

### 28.1 Cơ Chế Tự Động Cập Nhật Thay Đổi Dữ Liệu LMS vào Supabase
1. **Tự động hóa hoàn toàn (Zero Manual Diff Confirmation)**:
   - Khi phát hiện bất kỳ thay đổi nào từ LMS đối với dữ liệu lớp học (`managed_classes`) hoặc học viên (`managed_students`) mà hệ thống có lưu trữ, máy chủ tự động cập nhật ngay lập tức các thay đổi đó vào cơ sở dữ liệu Supabase (`saveAllManagedClassesMap`, `syncStudentsForClass`, `system_settings`).
   - Người dùng không cần phải bấm xác nhận thủ công từng mục thay đổi qua modal so sánh nữa.
2. **Lưu trữ và Truy xuất Thông báo Hệ thống**:
   - Mọi thay đổi được tự động ghi nhận vào trung tâm thông báo (`addSystemNotification`) với loại `LMS_SYNC`.
   - Danh sách chi tiết thay đổi (`details`) lưu trữ rõ ràng các trường dữ liệu trước và sau khi thay đổi (Ví dụ: `Sĩ số học viên: "12" ➔ "14"`, `Trạng thái: "OPEN" ➔ "RUNNING"`).
   - Dữ liệu thông báo được lưu trữ bền vững trên Supabase (`system_settings` với key = `system_notifications`) và file dự phòng `data/system_notifications_store.json`.

### 28.2 Cơ Chế Kiểm Tra Thông Báo Hai Chiều (Dual Access Point for Notifications)
Hệ thống hỗ trợ 2 cách tiếp cận thông báo khi người dùng **đã đăng nhập** (`isAuthenticated === true`):
1. **Cách 1: Biểu tượng chiếc chuông (Bell Icon) trên Thanh Điều Hướng (Top Header)**:
   - Đặt tại góc phải Header, nằm cạnh nút Đổi Giao Diện Sáng/Tối và cụm User Profile.
   - Hiển thị badge màu đỏ đếm số lượng thông báo mới chưa đọc (`unreadCount`).
   - Nhấp vào biểu tượng chuông để mở popover danh sách thông báo.
   - Hỗ trợ nút "Đã đọc hết", nút "Xóa tất cả", và nút đánh dấu đã đọc / xóa từng thông báo riêng lẻ.
2. **Cách 2: Mục "Thông báo hệ thống" trong Menu Người Dùng (User Profile Dropdown)**:
   - Trong dropdown mở ra khi nhấp vào Avatar / Họ tên người dùng, hiển thị mục "Thông báo hệ thống" đi kèm icon `Bell` và badge hiển thị số lượng thông báo chưa đọc.
   - Nhấp vào mục này sẽ tự động đóng menu và mở giao diện xem thông báo hệ thống.
3. **Đồng Bộ Thời Gian Thực (Real-time Event Dispatch)**:
   - Bất kỳ khi nào có dữ liệu cập nhật tự động từ LMS hoặc thông báo gửi Telegram thành công, hệ thống phát sự kiện `smh:notifications_updated` trên `window` để cập nhật số đếm chuông thông báo ngay tức thì mà không cần tải lại toàn bộ trang.

---

## 29. Quy Chuẩn Hẹn Giờ Gửi Thông Báo Lịch Trải Nghiệm Qua Telegram Bot (Scheduled Telegram Trial Reminder)

### 29.1 Cấu Hình & Lưu Trữ Cài Đặt Hẹn Giờ
- **Cấu hình chu kỳ**:
  - Hàng ngày (`DAILY`): Gửi đều đặn mỗi ngày một lần.
  - Hàng tuần (`WEEKLY`): Chọn các ngày cố định trong tuần (Thứ 2 đến Chủ nhật) để gửi.
  - Hàng tháng (`MONTHLY`): Chọn một ngày cụ thể trong tháng (Ngày 01 đến 31) để gửi.
- **Khung giờ gửi**: Định dạng giờ Việt Nam `HH:mm` (Ví dụ `08:00`, `19:00`).
- **Phạm vi ngày thông báo**:
  - Lịch Hôm Nay (`TODAY`): Gửi danh sách ca trải nghiệm diễn ra trong chính ngày gửi tin.
  - Lịch Ngày Mai (`TOMORROW`): Gửi trước lịch ca trải nghiệm cho ngày hôm sau để giáo viên và ban quản lý chuẩn bị trước.
- **Lưu trữ cấu hình**: Lưu tập trung trên bảng `system_settings` của Supabase (key = `trial_schedule_telegram_settings`) và file dự phòng `data/trial_schedule_telegram_settings.json`.

### 29.2 Định Dạng Tin Nhắn Telegram Chuẩn Trực Quan (HTML Format)
- Gửi trực tiếp tới kênh đích cấu hình trong `.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
- Tin nhắn sử dụng định dạng `HTML` trực quan:
  - Tiêu đề ngày trải nghiệm, thời gian xuất thông báo, tổng số ca.
  - Nhóm theo từng Cơ Sở (`🏢 CƠ SỞ: [TÊN CƠ SỞ]`).
  - Từng ca trải nghiệm thể hiện rõ: Ca học, Khối môn (`💻 CODING`, `🎨 ART`, `🤖 ROBOTICS`), Khung giờ, Tên Mentor phụ trách, Số lượng học viên, và Ghi chú ca (nếu có).
  - Tự động phân tách nhiều tin nhắn an toàn nếu độ dài vượt quá giới hạn 4096 ký tự của Telegram Bot API.

### 29.3 Thao Tác Thử Nghiệm & Tích Hợp Thông Báo Hệ Thống
- Màn hình Lịch trải nghiệm (`TrialSchedulesScreen`) tích hợp nút "Báo Telegram" trên thanh công cụ mở Modal cài đặt trực quan.
- Hỗ trợ nút **"Gửi thử ngay bây giờ" (Test Send)** cho phép kiểm tra tin nhắn Telegram thực tế của ngày đang xem.
- Mỗi lần gửi tin nhắn thành công (cả gửi thử nghiệm lẫn chạy tự động), hệ thống tự động sinh 1 thông báo hệ thống loại `TELEGRAM_REMINDER` gửi đến chuông thông báo trên Header và menu người dùng để quản trị viên dễ dàng theo dõi nhật ký gửi.

---

## 30. Quy Chuẩn Thống Kê Lượt Truy Cập Tài Khoản & Toàn Trang Lưu Supabase (Account & Global Visit Stats)

### 30.1 Cơ Chế Phân Định Lượt Truy Cập (Account Visits vs Global Visits)
- **Lượt Truy Cập Tài Khoản (Account Visits)**:
  - Mỗi khi một tài khoản đã đăng nhập (`admin`, `teacher-fulltime`, `teacher-parttime`) truy cập vào hệ thống hoặc tải trang Dashboard của mình, hệ thống tự động nhận diện danh tính người dùng thông qua Cookie / JWT (`smh_token` / `user_id`).
  - Lượt truy cập của chính tài khoản đó được tích lũy riêng biệt theo mã định danh `user_id` (`accountVisits[userId]`).
  - Trên màn hình Dashboard của từng vai trò (`/admin/dashboard`, `/teacher-fulltime/dashboard`, `/teacher-parttime/dashboard`), thẻ thống kê hiển thị tiêu đề chuẩn **"Lượt Truy Cập Tài Khoản"**, phản ánh chính xác số lần người dùng sở hữu tài khoản đó đã đăng nhập/vào xem hệ thống.
  - Thẻ Dashboard của Admin bổ sung phụ đề chi tiết thể hiện tổng quan toàn hệ thống (bao gồm tổng lượt của tất cả thành viên và khách vãng lai).
- **Tổng Lượt Truy Cập Toàn Trang (Global Visits)**:
  - Công thức tính toán tổng lượt truy cập toàn trang:
    $$\text{Tổng Lượt Truy Cập} = \text{Tổng Lượt Tất Cả Tài Khoản (Total Account Visits)} + \text{Lượt Truy Cập Của Khách (Guest Visits)}$$
  - Khách vãng lai chưa đăng nhập khi truy cập trang web (Trang chủ `/`, `/submit`, `/login`, v.v.) được ghi nhận vào `guestVisits`.
  - Phù hiệu nổi ở góc phải màn hình (`FloatingVisitBadge`) và các thống kê toàn trang hiển thị con số tổng hợp toàn bộ lượt truy cập này.

### 30.2 Lưu Trữ Bền Vững Trực Tiếp Trên Supabase Database
- Toàn bộ dữ liệu thống kê được lưu trữ đồng bộ, lâu dài trên cơ sở dữ liệu Supabase tại bảng `system_settings` với bản ghi `key = 'site_stats'`:
  - `total_account_visits`: Tổng lượt truy cập tích lũy của toàn bộ các tài khoản.
  - `guest_visits`: Tổng lượt truy cập của khách vãng lai.
  - `account_visits`: Bản đồ (`Record<string, number>`) lưu số lượt truy cập chi tiết của từng `user_id`.
  - `total_visits`: Tổng lượt truy cập toàn trang (tài khoản + khách).
  - `last_updated`: Thời điểm cập nhật dữ liệu gần nhất (ISO timestamp).
- Hệ thống hỗ trợ file dự phòng cục bộ `data/site_stats.json` để đảm bảo hệ thống luôn đọc/ghi mượt mà cả khi kết nối mạng tạm thời gián đoạn.
- **Cơ chế chống đếm trùng lặp (Debounce Control)**:
  - Do `FloatingVisitBadge` và `Dashboard` có thể gọi API cùng lúc khi tải trang, hệ thống tích hợp bộ nhớ đệm chống tăng trùng lặp (debounce 2.000ms theo từng người dùng / session) để mỗi phiên tải trang chỉ được tính đúng 1 lượt duy nhất.

