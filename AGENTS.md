# Dự Án SMH (School MindX Hub) - Quyết Định & Quy Tắc Thiết Kế

## Ràng Buộc Sử Dụng MCP Server & Skills

Agent khi thực hiện phát triển tính năng (Features), sửa lỗi (Debugging), hay thiết kế UI/UX trên dự án này **bắt buộc tuân thủ quy tắc**:
1. **MCP Servers**: Tận dụng tối đa các công cụ MCP sẵn có (`supabase`, `firebase`, `postman`, `chrome-devtools`) để tương tác cơ sở dữ liệu, kiểm thử API tự động, và kiểm tra giao diện trình duyệt.
2. **Skills Ecosystem**: Luôn đọc và kích hoạt các skills phù hợp như `supabase` (quản lý RLS & auth), `frontend-design` & `anti-ui-slop` (thiết kế giao diện hiện đại), `tdd` (phát triển hướng kiểm thử), và `web-design-guidelines` (kiểm tra chuẩn UX/a11y).
3. **Cấu trúc đường dẫn API**: Quản lý tập trung tại `lib/constants/api-routes.ts`.
4. **Xử lý trạng thái người dùng**: Quản lý trạng thái thông qua bảng `user_statuses` liên kết động (`status_id`), tuyệt đối không hardcode static UUID ID.
5. **Bắt buộc đọc và tuân thủ Luồng Hoạt Động (Feature Flows)**: Toàn bộ luồng hoạt động của từng chức năng trong dự án được lưu trữ chi tiết tại [docs/FEATURE_FLOWS.md](file:///d:/Documents/Practice/Self%20Project/SMH/docs/FEATURE_FLOWS.md). Mỗi khi làm việc (phát triển tính năng, sửa lỗi, refactor, thiết kế UI hay viết API), Agent **BẮT BUỘC PHẢI ĐỌC TÀI LIỆU NÀY TRƯỚC** để nắm vững logic nghiệp vụ và làm cho đúng. Đồng thời, khi có chức năng mới hoặc thay đổi luồng hoạt động, Agent **BẮT BUỘC CẬP NHẬT** tài liệu này ngay lập tức.
6. **Tra cứu & Sử dụng Schema GraphQL LMS Firebase**: Mọi lệnh/query lấy dữ liệu từ hệ thống Firebase / LMS MindX phải được tra cứu từ tài liệu schema lưu trữ tại [docs/LMS_GRAPHQL_SCHEMA.md](file:///d:/Documents/Practice/Self%20Project/SMH/docs/LMS_GRAPHQL_SCHEMA.md) và file [docs/lms_graphql_schema.json](file:///d:/Documents/Practice/Self%20Project/SMH/docs/lms_graphql_schema.json) để tìm đúng bộ lệnh và dữ liệu cần tìm.
7. **Quy chuẩn dữ liệu trả về từ API (Chỉ trả về Dạng Chữ, Không Trả Về Khóa Ngoại ID)**: Tất cả API xây dựng trong dự án khi phản hồi về Client bắt buộc phải trả về dữ liệu dưới dạng **CHỮ (Text / Display Name)** cho các trường tham chiếu/khóa ngoại (`role`, `status`, `centre`, `department`, v.v.), **tuyệt đối không trả về ID khóa ngoại thô**. Ngoại lệ duy nhất được phép là **ID khóa chính (Primary Key)** của bản ghi đó.
8. **Quy chuẩn Giao diện Tổng thể (Layout Sidebar, Header Dropdown, Theme Sáng/Tối & Lucide Icons)**:
   - **Kiến trúc Layout**: Sử dụng `AppLayout` thống nhất toàn hệ thống. Menu chức năng đặt ở **Sidebar bên trái** (phân nhóm Menu chính & Menu phụ), hỗ trợ co giãn và Drawer cảm ứng trên Mobile. **Header** chỉ chứa nút Theme Toggle (Sáng/Tối) và cụm User Profile (Avatar, Họ tên, Badge Role) với Dropdown gồm *Chỉnh sửa thông tin cá nhân* (`/profile`) và *Đăng xuất*.
   - **Bảng Màu Chủ Đạo**: Kết hợp hài hòa giữa Đỏ Ruby/Crimson (`#E11D48`, `#F43F5E`), Đen Obsidian (`#090D16`) và Trắng tuyết (`#FFFFFF`, `#F8FAFC`), tuyệt đối không dùng màu thô cứng thuần `#FF0000`/`#000000`.
   - **Chuẩn Icon**: Bắt buộc **100% sử dụng icon từ thư viện chính thống `lucide-react`**, tuyệt đối cấm dùng icon tự chế do AI sinh ra.
9. **Trang Not-Found (404) Tự Điều Hướng Thông Minh**:
   - Khi truy cập đường dẫn không tồn tại (`app/not-found.tsx`), hệ thống hiển thị đếm ngược 5 giây và **tự động điều hướng về đúng Dashboard theo vai trò của người dùng nếu đã đăng nhập** (`Admin`, `Teacher Full-time`, `Teacher Part-time`) hoặc **tự động điều hướng về Trang chủ (`/`) nếu chưa đăng nhập**.
10. **Quy chuẩn Căn Giữa Dữ Liệu & Chống Từ Mồ Côi (Anti-Orphan & Alignment Rule)**:
    - Tất cả các cột dữ liệu định danh và trạng thái (STT, Mã LMS, Loại tài khoản, Trạng thái, Vai trò, Thao tác hành động, Switch toggle) bắt buộc phải **căn giữa (`text-center`, `justify-center`)**.
    - Bắt buộc áp dụng **`whitespace-nowrap`** cho các huy hiệu (badges), nhãn (labels), tiêu đề cột, nút bấm thao tác và các nhóm dữ liệu để chống triệt để hiện tượng **từ mồ côi** (xuống dòng chỉ rớt lại 1 từ). Các thông tin cùng một khối dữ liệu phải giữ trên **1 hàng**, bảng dữ liệu hỗ trợ cuộn ngang linh hoạt (`overflow-x-auto`) để đạt chuẩn responsive cao nhất.
11. **Cơ Chế Cập Nhật Dữ Liệu Real-Time & Nút Làm Mới**:
    - Dữ liệu người dùng (Họ tên, Vai trò) luôn lấy trực tiếp từ Supabase Database theo thời gian thực (Real-time).
    - Đối với bất kỳ màn hình nào **đã có nút "Làm mới" / "Cập nhật"** (như Quản lý tài khoản, Phân quyền màn hình): **Tuyệt đối không bật polling ngầm (`setInterval`)**, dữ liệu chỉ được tải lại khi người dùng chủ động bấm nút làm mới hoặc sau khi hoàn tất hành động thêm / sửa / xóa / toggle.
12. **Quy Tắc Quản Lý Biến Môi Trường (Duy Nhất 1 File `.env`, Không Tạo File Khác)**:
    - Toàn bộ cấu hình biến môi trường của hệ thống được đặt tập trung trong **DUY NHẤT một file `.env`**.
    - Tuyệt đối **KHÔNG tạo bất kỳ file nào khác liên quan đến env** (như `.env.example`, `.env.local`, `.env.development`, `.env.production`, v.v.).
    - File `.env` phải được bảo vệ nghiêm ngặt trong `.gitignore`, tuyệt đối không bao giờ được commit hay đẩy lên GitHub.
13. **Quy Chuẩn Định Tuyến Phân Quyền Theo Vai Trò (`/[role]/[main_menu]/[menu]`)**:
    - Tất cả các tuyến đường (routes) có khả năng phân quyền theo vai trò bắt buộc phải tuân theo cấu trúc: `/[role]/[main_menu]/[menu]` (Ví dụ: `/admin/system-management/users`, `/teacher-fulltime/system-management/users`).
    - Tuyến phân quyền màn hình bắt buộc có tên chứa `screen_permission`: `/[role]/system-management/screen_permission`.
    - **Chặn Truy Cập Chéo Vai Trò & Chặn Không Có Quyền**: Bất kỳ người dùng nào cố tình truy cập vào route mang tiền tố của vai trò khác (hoặc route chưa được phân quyền) đều bị Middleware chặn và **trả về trực tiếp trang 404 (`not-found`)**.
14. **Quy Chuẩn Layout Thống Nhất Toàn Hệ Thống (Header, Footer & Collapsible Sidebar)**:
    - **Đồng bộ Header & Footer**: Bất kỳ giao diện nào (Dashboard, Quản lý, Phân quyền, Đăng nhập, 404 Not Found) đều phải có Header và Footer đồng nhất với nhận diện thương hiệu *School MindX Hub (SMH)*.
    - **Vị Trí Tình Trạng Hệ Thống**: Thông tin trạng thái vận hành hệ thống ("Hệ thống hoạt động ổn định 100% • Supabase DB Connected • Bảo Mật RBAC") được đặt cố định ở **Footer** kèm bản quyền và phiên bản hệ thống, không đặt thẻ trùng lặp trong phần nội dung chính của Dashboard.
    - **Sidebar Thu Gọn (Collapsible)**: Sidebar bên trái hỗ trợ nút thu gọn (Collapse) thành cột icon 80px tinh gọn hoặc mở rộng 288px, ghi nhớ trạng thái thu gọn qua `localStorage`.
15. **Phân Định Dữ Liệu & Thao Tác Theo Cấp Bậc Vai Trò (Role Hierarchy Scope)**:
    - Khi một vai trò cấp dưới được cấp quyền truy cập màn hình (như Quản lý tài khoản hay Phân quyền), người dùng chỉ được xem và thao tác trên các tài khoản/vai trò có điểm số lớn hơn mình (cấp bậc thấp hơn: `targetRolePoints > currentUserRolePoints`).
    - Tuyệt đối khóa quyền chỉnh sửa, đổi vai trò, đổi trạng thái hoặc xóa tài khoản của chính mình và các vai trò có cấp bậc bằng hoặc cao hơn mình.
16. **Quy Chuẩn Quản Lý Cơ Sở Trực Thuộc (User Affiliated Centres Management)**:
    - Dữ liệu cơ sở trực thuộc được lưu trữ độc lập trên Supabase (`user_centres`), tuyệt đối không ghi ngược hay làm thay đổi dữ liệu trên LMS MindX.
    - Danh mục cơ sở chính thống để chọn thêm được đồng bộ từ LMS.
    - Khi tạo tài khoản loại LMS, hệ thống tự động đồng bộ cơ sở ban đầu từ LMS sang Supabase. Tài khoản tự tạo nội bộ ban đầu không có cơ sở trực thuộc (`[]`).
    - Tuân thủ phân cấp vai trò (`targetRolePoints > currentUserRolePoints`), khóa chỉnh sửa với chính mình và cấp bậc bằng/cao hơn.
17. **Quy Chuẩn Hiển Thị & Quản Lý Lịch Trải Nghiệm (Trial / Office Hours Standard)**:
    - **Đồng bộ cơ sở trực thuộc**: Chỉ truy vấn và sắp xếp các ca trải nghiệm theo đúng danh sách cơ sở trực thuộc được lưu trữ của tài khoản đang đăng nhập (`user_centres`), tuyệt đối không hiển thị bộ lọc chọn tài khoản hay role trên giao diện.
    - **Bố cục Ma trận Thống nhất (Single Matrix View)**: Bố cục bảng ma trận gồm 7 cột chuẩn theo đúng thứ tự: `[Cơ sở]` | `[Khối]` | `[Ca]` | `[Khung giờ]` | `[Mentor]` | `[Số lượng]` | `[Note]`. Mỗi case trải nghiệm là **1 dòng duy nhất** thể hiện Mentor và Số lượng học viên, tuyệt đối không tách chi tiết từng dòng học viên.
    - **Tiêu đề bảng tinh gọn & Triệt tiêu thanh cuộn**: Tiêu đề bảng chỉ hiển thị thuần túy `LỊCH TRẢI NGHIỆM ([Tên cơ sở]) • [Ngày]`, **tuyệt đối không để chữ "LMS MindX Hub" hay "Ultra HD 3x"** trên giao diện cũng như trong ảnh sao chép. Triệt tiêu hoàn toàn các thanh cuộn (`no-scrollbar`, `scrollbarWidth: none`) trên giao diện và trong ảnh sao chép.
    - **Định dạng chữ to, rõ ràng và tương phản cao (High-Legibility Standard)**: Cỡ chữ trong bảng và khi kết xuất ảnh sao chép (cả 1 cơ sở và toàn bộ cơ sở) phải to, rõ nét (`text-base`, `text-lg`, `font-black`), tương phản cao để khi xem ảnh thu nhỏ trên Zalo (điện thoại/máy tính) vẫn đọc rõ thông tin không bị mờ hay nhỏ.
    - **Thứ tự khối môn & ca**: Bắt buộc sắp xếp theo thứ tự Khối: `CODING` (Đỏ Ruby `#E11D48`) $\rightarrow$ `ART` (Xanh Navy `#1E3A8A`) $\rightarrow$ `ROBOTICS` (Xanh Lá `#15803D`). Ca học: `SÁNG` $\rightarrow$ `CHIỀU` $\rightarrow$ `TỐI` (sắp xếp tăng dần theo `startTime`).
    - **Lọc thô triệt để ca Makeup**: Tự động loại bỏ 100% các ca có `type` liên quan đến dạy bù (`MAKEUP`, `MAKE_UP`, `BÙ`, `BU`).
    - **Tính năng sao chép ảnh theo từng cơ sở & toàn bộ cơ sở**: Dưới mỗi tên cơ sở có nút "Sao chép ảnh" lưu thẳng Clipboard để dán nhanh (Ctrl+V) vào nhóm Zalo. **Chỉ hiển thị nút sao chép đối với các cơ sở có ca trải nghiệm**. Nút sao chép toàn bộ cơ sở nằm trên thanh công cụ trên cùng.
    - **Bắt buộc bọc bằng AppLayout**: Màn hình lịch trải nghiệm phải kế thừa `AppLayout` đầy đủ Sidebar bên trái, Header người dùng bên trên và Footer thông tin hệ thống bên dưới.
18. **Quy Chuẩn Tài Khoản Kiểm Thử Chính Thức (Official Test Accounts Standard)**:
    - Khi thực hiện kiểm thử tự động, kiểm tra giao diện hay kiểm thử API, Agent **bắt buộc sử dụng bộ tài khoản chính thức sau, tuyệt đối không nhập lan man**:
      - **Admin**: `admin` / `Nh@t@nh12@8` (Sở hữu đầy đủ 56 cơ sở trực thuộc và toàn quyền quản trị).
      - **Teacher Full-time**: `anhhn01` / `Nh@t@nh12@8` (Thuộc 4 cơ sở trực thuộc và phân quyền full-time).
      - **Teacher Part-time**: `huynhnhatanh` / `Nh@t@nh12@8` (Thuộc 4 cơ sở trực thuộc và phân quyền part-time).
19. **Cơ Chế Bảo Mật JWT & Thời Gian Duy Trì Tài Khoản Cố Định 30 Ngày (JWT Security & 30-Day Session Standard)**:
    - Secret key tạo JWT đặt tại `.env` với biến `JWT_SECRET=student-mindx-hub`.
    - Token định danh `smh_token` được ký thuật toán `HS256` qua thư viện `jose`, lưu trong HttpOnly cookie an toàn.
    - **Thời gian duy trì tài khoản (Session Maintenance)**: Cố định hết hạn sau **30 ngày** cho toàn bộ tài khoản. Khi token hết hạn, Middleware tự động xóa phiên và đẩy về trang đăng nhập (`/login?redirect=...&reason=expired`).
20. **Danh Mục 56 Cơ Sở MindX Chính Thống & Tiêu Chuẩn Xuất Ảnh Lịch Trải Nghiệm Không Bị Đen (LMS Centres & Zero-Black Export Standard)**:
    - Hệ thống áp dụng danh mục đầy đủ **56 cơ sở vật lý chính thống** từ MindX (loại bỏ các nhóm miền, hotline, online và mầm non đối tác), tài khoản `admin` được gán toàn bộ 56 cơ sở này để kiểm tra toàn hệ thống.
    - Vùng xuất ảnh sao chép lịch trải nghiệm (cả từng cơ sở và toàn bộ cơ sở) phải được cô lập trong wrapper tọa độ riêng biệt, đảm bảo thẻ được chụp luôn giữ tọa độ `left: 0; position: relative` và tính toán `scrollHeight` đầy đủ để triệt tiêu 100% hiện tượng ảnh xuất ra bị đen hoặc mất nội dung. Ảnh sao chép toàn bộ cơ sở bắt buộc có banner tiêu đề tổng thể nổi bật.
21. **Quy Chuẩn Ràng Buộc Dữ Liệu & Xác Thực Toàn Hệ Thống (Comprehensive Data Validation & Constraints Standard)**:
    - **Hồ sơ cá nhân (`/profile`)**:
      - `full_name`: 
        - **Tài khoản LMS có họ tên trên hệ thống LMS**: Khóa cố định 100% (`disabled` / read-only), hiển thị badge `(Cố định từ LMS)`.
        - **Tài khoản LMS chưa có họ tên trên hệ thống LMS**: Có quyền chỉnh sửa và lưu họ tên vào hệ thống (ràng buộc 2 - 70 ký tự).
        - **Tài khoản do website tạo nội bộ**: Luôn có quyền chỉnh sửa họ tên tự do (ràng buộc 2 - 70 ký tự).
      - `password`: **Mật khẩu chỉ được thay đổi khi là tài khoản do website cấp** (tài khoản nội bộ, ràng buộc 6 - 50 ký tự, kiểm tra trùng khớp xác nhận mật khẩu và có thanh đo độ mạnh mật khẩu trực quan). Tuyệt đối khóa 100% đối với tài khoản LMS (`is_firebase = true`, do xác thực trực tiếp qua hạ tầng LMS MindX).
      - `lms_code` & `email`: Khóa cố định 100% (`disabled` / read-only), tuyệt đối không cho phép tự ý chỉnh sửa.
    - **Phân cấp vai trò & quyền hạn (Role Hierarchy Scope)**: Tuyệt đối khóa quyền tự thay đổi vai trò, tự đổi trạng thái, tự xóa tài khoản của chính mình và của các tài khoản có cấp bậc bằng hoặc cao hơn mình (`targetRolePoints <= currentUserRolePoints`).
22. **Quy Chuẩn Gợi Ý Đăng Nhập & Chống Tự Điền Ban Đầu (Login Autocomplete & Anti-Initial-Autofill Standard)**:
    - Form đăng nhập hỗ trợ tính năng gợi ý tài khoản đã lưu trên trình duyệt (`autoComplete="username"`, `name="username"`).
    - Ngăn chặn trình duyệt tự động điền sẵn thông tin khi vừa tải trang thông qua cơ chế kích hoạt tương tác (`readOnly` ban đầu, tự gỡ bỏ khi người dùng nhấp/chạm vào ô nhập) để đảm bảo tính riêng tư mà vẫn mở gợi ý đầy đủ khi người dùng tương tác.
23. **Quy Chuẩn Quy Trình Đẩy Code Git & Cập Nhật Phiên Bản (Git Push & Version Update Standard)**:
    - **RÀNG BUỘC TUYỆT ĐỐI VỀ QUYỀN PUSH**: Agent **CHỈ ĐƯỢC PHÉP THỰC HIỆN ĐẨY CODE LÊN GIT (GIT PUSH) KHI ĐƯỢC NGƯỜI DÙNG YÊU CẦU HOẶC CHO PHÉP RÕ RÀNG**. Tuyệt đối **KHÔNG TỰ Ý CHẠY `git push`** trong bất kỳ hoàn cảnh nào nếu người dùng chưa ra lệnh.
    - Khi người dùng yêu cầu push code lên Git, Agent **bắt buộc tuân thủ đúng trình tự các bước sau**:
      1. Rà soát `.gitignore` và loại bỏ triệt để các file nhạy cảm, file tạm thời, file rác/scratch.
      2. **Cập nhật phiên bản hệ thống tập trung tại `lib/constants/version.ts`**: Khi có tính năng mới, bắt buộc tăng số hiệu phiên bản (`vx.x`, ví dụ `v1.5`), cập nhật ngày phát hành và tóm tắt các chức năng chính (ngắn gọn, không quá chuyên môn).
      3. Chạy kiểm tra bản build: `npm run build` (đảm bảo biên dịch thành công, không có lỗi runtime/build).
      4. Thêm các thay đổi vào stage: `git add .`
      5. Kéo cập nhật mới nhất từ nhánh đích: `git pull origin preview`
      6. Xử lý conflict (nếu có) cẩn thận, đảm bảo tính toàn vẹn của code.
      7. Tạo commit với thông điệp bằng tiếng Anh mô tả rõ chức năng chính và các thay đổi kèm theo (`git commit -m "<Main Feature>: <Detailed changes in English>"`).
      8. Đẩy code lên remote: `git push origin preview`.
24. **Quy Chuẩn Badge Nổi Hiển Thị Lượt Truy Cập Trang Web (Floating Visit Count Badge Standard)**:
    - Hiển thị badge nổi cố định ở **góc dưới bên phải màn hình, lơ lửng phía trên Chân trang (Footer)** (`fixed bottom-16 right-3 sm:bottom-20 sm:right-6 z-40`), hoàn toàn tách biệt khỏi Header, Footer và khu vực tương tác chính để tuyệt đối không che khuất bất kỳ nút bấm hay thông tin phiên bản / bản quyền nào.
    - Đảm bảo tính responsive 100% trên cả thiết bị di động lẫn máy tính để bàn.
    - Tích hợp **chấm tròn màu xanh nhấp nháy (pulsing green dot)** hiệu ứng `animate-ping` biểu thị trạng thái hoạt động trực tiếp theo thời gian thực (live activity).
    - Hiển thị số lượt truy cập trang web thực tế được định dạng chuẩn Việt Nam (ví dụ: `1.431 lượt truy cập`), kết hợp cơ chế lưu trữ bền vững tại `data/site_stats.json`.
25. **Quy Chuẩn Chế Độ Bảo Trì Hệ Thống Đa Môi Trường & Màn Hình Bảo Trì Cố Định (Production Persistent Maintenance Mode Standard)**:
    - Quản trị viên (Admin) quản lý bảo trì tại `/[role]/system-management/maintenance`.
    - **Lưu trữ bền vững trên Production qua Supabase Database**: Trạng thái bảo trì được lưu trữ bền vững tại bảng chuyên biệt `system_settings` trên Supabase (khóa `key = 'maintenance_status'`, `value = jsonb`). Tuyệt đối không chèn bản ghi dummy vào bảng `users`. Trên môi trường Production (như Vercel serverless), `middleware.ts` truy vấn trực tiếp bảng `system_settings` qua Supabase REST API và chặn 100% người dùng các role khác về trang `/maintenance` một cách triệt để, không bị ảnh hưởng bởi tính vô trạng thái của serverless filesystem.
    - **Màn hình bảo trì xuất hiện đầu tiên & cố định liên tục**: Khi kích hoạt bảo trì, toàn bộ người dùng (kể cả truy cập Trang chủ `/` hay `/login` thông thường) đều bị Middleware chuyển hướng ngay lập tức về trang `/maintenance` và lưu lại ở đó liên tục cho đến khi bảo trì kết thúc. Tuyệt đối không chỉ hiển thị một thông báo thông thường rồi cho ở lại trang khác.
    - **Kênh đăng nhập đặc thù cho Quản trị viên**: Trên trang `/maintenance`, chỉ Quản trị viên mới có thể nhấp nút "Quản trị viên đăng nhập" (`/login?admin=1`) để truy cập form đăng nhập quản trị. Nếu tài khoản không phải Admin cố tình đăng nhập trong thời gian bảo trì, hệ thống từ chối và điều hướng ngay về `/maintenance`.
    - Hỗ trợ ô nhập ngày giờ dự kiến kết thúc (`datetime-local`). Nếu để trống, hệ thống tự động thiết lập mặc định là **3 tiếng** kể từ thời điểm bật. Khi quá thời gian dự kiến, hệ thống tự động mở khóa bảo trì.
26. **Quy Chuẩn Quản Lý Nhật Ký Phiên Bản Mới Nhất (Single Latest Version Changelog Standard)**:
    - Quản lý phiên bản tập trung duy nhất tại `lib/constants/version.ts` (`CURRENT_VERSION`).
    - Trang Changelog (`/changelog`) **chỉ hiển thị duy nhất 1 phiên bản mới nhất**, tóm tắt các tính năng chính một cách tinh gọn, dễ hiểu, không dùng thuật ngữ kỹ thuật quá chuyên môn.
    - Chân trang (Footer) hiển thị đúng số hiệu phiên bản mới nhất kèm liên kết dẫn trực tiếp đến `/changelog`, tuyệt đối không ghi chữ "production".
    - **Bắt buộc**: Mỗi lần có chức năng mới được đẩy lên Git, Agent bắt buộc phải cập nhật tăng phiên bản (`vx.x`) và tóm tắt chức năng mới vào `lib/constants/version.ts` trước khi commit.
27. **Quy Chuẩn Nhận Diện Thương Hiệu & Logo SMH Hỗ Trợ Đa Giao Diện Sáng/Tối (SMH Dual-Theme Brand Identity Standard)**:
    - Sử dụng bộ nhận diện logo chính thức `<SMHLogo />` kế thừa phong cách hình học đa giác chữ X đặc trưng của MindX kết hợp chữ SMH và dải màu đỏ Ruby/Crimson chủ đạo (`#E11D48`, `#BE123C`). Tuyệt đối không gắn thêm badge "HUB" cạnh chữ SMH (vì chữ H vốn dĩ là Hub).
    - **Tương thích hoàn hảo Sáng & Tối (Light & Dark Theme Parity)**: Chữ logo dùng màu động `text-slate-900 dark:text-white`, phụ đề `text-slate-500 dark:text-slate-400`, nền squircle dùng `fill-slate-100 dark:fill-[#0D1117]` và viền `stroke-rose-500/20 dark:stroke-rose-500/35`. Tuyệt đối không hardcode nền đen hay chữ trắng thô cứng trong chế độ Sáng.
    - Đồng bộ hiển thị logo trên toàn bộ Header, Sidebar, Card Đăng nhập, Hero Trang chủ và Chân trang hệ thống.
28. **Quy Chuẩn Không Tự Tiện Thêm Nội Dung / Nút / Card Vào Giao Diện (Strict Content & UI Boundary Standard)**:
    - Agent tuyệt đối **KHÔNG ĐƯỢC PHÉP tự tiện thêm chữ, nút bấm, card tính năng, banner hoặc bất kỳ phần tử nội dung nào khác** vào giao diện (đặc biệt là trang chủ hoặc các màn hình chính) nếu chưa hỏi ý kiến hoặc chưa có yêu cầu cụ thể từ người dùng.
    - Mọi sự sáng tạo về nội dung, tính năng hoặc bố cục đều phải tuân theo chỉ thị cụ thể của người dùng. Không suy diễn tự ý bổ sung các khối card/chức năng ngoài luồng.
29. **Quy Chuẩn Nút Chuyển Đổi Trang Chủ / Dashboard Tại Đáy Sidebar (Sidebar Bottom Action Standard)**:
    - Loại bỏ nhóm menu "Tổng quan / Điều hướng" ở đầu danh sách menu trên Sidebar để tránh trùng lặp và gây rối mắt.
    - Khi ở Trang chủ (`/`), toàn bộ menu nghiệp vụ của Dashboard bị ẩn hoàn toàn, khu vực cuộn menu phía trên để trống tinh gọn.
    - Khối "Hệ thống sẵn sàng" tại chân Sidebar được thay thế bằng Action Button điều hướng độc lập, có thiết kế nổi bật và khác biệt hoàn toàn với các item menu thông thường:
      - Khi ở Trang chủ: Nút nổi bật gradient Đỏ Ruby (`from-rose-600 to-red-600`) đổ bóng với icon `LayoutDashboard` và chữ **"Về Bảng Điều Khiển"**.
      - Khi ở Dashboard / màn hình quản lý: Thẻ bo tròn viền tinh tế với icon `Home` màu Rose và chữ **"Xem Trang Chủ"**.
      - Hỗ trợ đầy đủ trạng thái mở rộng (288px) lẫn thu gọn (80px) kèm tooltip.
30. **Quy Chuẩn Bắt Buộc Liên Kết Google Drive Đối Với Giảng Viên (Mandatory Google Drive OAuth for Teachers Standard)**:
    - Áp dụng đối với các tài khoản vai trò Giảng viên (`Teacher Part-time` và `Teacher Full-time`) mà trường `email` trong bảng `users` Supabase đang rỗng (`NULL` hoặc `""`).
    - Khi đăng nhập hoặc truy cập bất kỳ route nào trong hệ thống, Middleware tự động chặn và chuyển hướng bắt buộc về `/connect-google-drive`.
    - Hỗ trợ cả Google OAuth truyền thống và Supabase Auth OAuth (`supabase.auth.signInWithOAuth`).
    - Sau khi xác thực Google thành công, email nhận được từ Google được lưu trực tiếp vào bảng `users.email` trong Supabase và lưu token Google Drive an toàn tại `data/google_drive_tokens.json`. Hệ thống cấp lại JWT `smh_token` có chứa email và điều hướng động về đúng Dashboard tương ứng với vai trò của người dùng (`/${roleSlug}/dashboard`), tuyệt đối không hardcode một vai trò cố định.
31. **Quy Chuẩn Thống Nhất Bố Cục Giao Diện Mọi Menu & Triệt Tiêu Văn Bản Giải Thích (Unified Menu Layout & Zero Explanatory Text Standard)**:
    - **Thẻ Tiêu Đề Thống Nhất (Unified Page Header Card)**: Mọi màn hình menu chức năng (Quản lý tài khoản, Phân quyền, Cơ sở trực thuộc, Lịch trải nghiệm, Bảo trì hệ thống, Hồ sơ cá nhân) bắt buộc sử dụng thẻ tiêu đề đồng bộ cấu trúc:
      - Container: `bg-white dark:bg-[#0B0F17] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4`.
      - Khối Tiêu đề: Khung icon đại diện kích thước chuẩn `w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20`, tiêu đề in hoa đậm (`font-black tracking-wide text-xl sm:text-2xl`), và phụ đề ngắn gọn 1 dòng súc tích (`text-xs sm:text-sm text-slate-500 dark:text-slate-400`).
      - Khối Hành động: Đặt toàn bộ các nút thao tác nghiệp vụ, nút làm mới, nút thêm mới gọn gàng ở phía bên phải.
    - **Tuyệt Đối Không Thêm Văn Bản / Ghi Chú Giải Thích Hướng Dẫn**: Không được phép tự ý thêm các khối ghi chú, hộp cảnh báo, banner hướng dẫn dài dòng ("Tại sao cần làm...", "Lưu ý khi sử dụng...", "👉 Vuốt ngang để xem...") vào bất kỳ màn hình nào trừ khi có yêu cầu cụ thể từ người dùng. Giao diện phải sạch sẽ, tinh gọn, tập trung hoàn toàn vào dữ liệu và tác vụ.
32. **Quy Chuẩn Bắt Buộc OAuth Riêng Cho Teacher Part-Time & Tính Năng Hủy Liên Kết (Google Drive OAuth Scope & Unlink Standard)**:
    - Cơ chế bắt buộc OAuth Google Drive chỉ áp dụng DUY NHẤT cho vai trò `Teacher Part-time` khi email trong Supabase còn trống. Tài khoản `Teacher Full-time` và `Admin` không bị ép buộc liên kết.
    - **Hủy liên kết Google Drive**:
      - Người dùng có thể tự hủy liên kết tài khoản Google Drive của mình tại trang Hồ sơ cá nhân (`/profile`).
      - Trong màn hình Quản lý tài khoản (`/[role]/system-management/users`), người dùng có vai trò cấp bậc cao hơn (`callerPoints < targetPoints`) có quyền hủy liên kết Google Drive cho các tài khoản cấp dưới (tuyệt đối không được hủy liên kết của chính mình tại đây hoặc của người có cấp bậc bằng/cao hơn).
33. **Quy Chuẩn Quản Lý Lớp Học, Hạn Nộp Bài & Lưu Trữ Supabase Độc Quyền (Class Management & Supabase Exclusive Storage Standard)**:
    - Màn hình Quản lý lớp học đặt tại **QUẢN LÝ HỆ THỐNG** với đường dẫn chuẩn: `/[role]/system-management/classes`.
    - **Lưu trữ độc quyền Supabase Bền Vững Đa Môi Trường**:
      - Toàn bộ dữ liệu lớp học quản lý và hạn nộp bài tùy chỉnh được lưu trữ độc quyền trên bảng chuyên biệt `managed_classes` trên Supabase Database, đảm bảo hoạt động bền vững 100% trên Vercel Production Serverless.
      - Tuyệt đối KHÔNG làm thay đổi bất kỳ dữ liệu nào trên LMS MindX (chỉ dùng Read-only GraphQL).
    - **Tìm kiếm real-time theo tên/mã lớp & Chống spam 429 (Debounce 1s)**:
      - Ô tìm kiếm gọi query LMS với debounce **1000ms (1 giây)** khi người dùng dừng nhập để chống lỗi 429 Too Many Requests, kết hợp bộ lọc client-side lọc tức thì trên dữ liệu đã tải.
      - Hỗ trợ dropdown hiển thị kết quả khớp từ khóa, phím tắt mũi tên lên/xuống và Enter để chọn nhanh.
    - **Ràng buộc trạng thái lớp khi thêm (Chỉ OPEN hoặc RUNNING, cấm FINISHED)**:
      - Hệ thống **CHỈ hỗ trợ thêm các lớp đang mở (OPEN) hoặc đang học (RUNNING)** vào danh sách quản lý.
      - Tuyệt đối **KHÔNG cho phép thêm các lớp đã kết thúc (FINISHED)**. Dropdown loại trừ các lớp FINISHED; nếu tìm kiếm hoặc chọn lớp FINISHED, hệ thống từ chối và báo lỗi rõ ràng.
    - **Phân quyền thêm lớp học theo vai trò**:
      - **Admin & Teacher Full-time**: Có quyền tìm kiếm & thêm **tất cả** các lớp học thuộc danh sách cơ sở trực thuộc được phân công vào Supabase.
      - **Teacher Part-time**: Được quyền tìm kiếm & thêm **các lớp do chính mình phụ trách giảng dạy** vào hệ thống quản lý.
    - **Bộ lọc, Sắp xếp & Phân trang 20 lớp / Trang (Pagination & Sort Standard)**:
      - **Bộ lọc**: Ô tìm kiếm mã lớp/khóa học/giáo viên/cơ sở (có nút xóa `X`), dropdown lọc theo cơ sở trực thuộc (`userCentres`), dropdown lọc theo trạng thái (`Tất cả`, `Đang học`, `Sắp mở`, `Đã kết thúc`).
      - **Sắp xếp (`sortBy`)**: Mới nhất/cũ nhất (ngày bắt đầu), Mã lớp A → Z / Z → A, Tiến độ cao → thấp / thấp → cao, Số buổi nhiều nhất, Mới thêm vào hệ thống.
      - **Phân trang (20 lớp / trang)**: Cố định 20 lớp mỗi trang, STT liên tục, hỗ trợ **ô nhập số trang trực tiếp (Jump to page input)** để nhảy trang nhanh, nút Trang đầu, Trước, Kế, Cuối và thống kê số lượng hiển thị.
    - **Bảng danh sách chỉ hiển thị khi đã thêm vào Supabase**: Bảng tổng quan bên dưới ban đầu để trống nếu chưa có lớp nào được thêm. Bảng chỉ hiển thị dữ liệu các lớp đã được lưu trong Supabase.
    - **Xác định Giáo viên phụ trách (dạy nhiều buổi nhất & đồng hạng)**: Giáo viên phụ trách lớp được tính dựa trên số buổi dạy (slots) nhiều nhất từ LMS. Nếu có từ 2 giáo viên cùng có số buổi dạy cao nhất bằng nhau, hiển thị đầy đủ tất cả các giáo viên đó (`GV 1, GV 2`).
    - **Phân quyền tìm kiếm & xem lớp học theo vai trò**:
      - **Admin & Teacher Full-time**: Được tìm kiếm và xem **TẤT CẢ** các lớp ở trạng thái opening, running và finished tại các cơ sở trực thuộc được phân công.
      - **Teacher Part-time**: **CHỈ** xem được các lớp do chính giáo viên đó phụ trách (nếu tìm kiếm lớp khác sẽ thông báo không tìm thấy).
    - **Ràng buộc thêm lớp học (Bắt buộc Giáo viên có tài khoản Supabase)**: Khi thêm lớp học, hệ thống bắt buộc kiểm tra xem giáo viên phụ trách lớp đã tồn tại tài khoản trong Supabase (`users`) hay chưa. Nếu chưa, từ chối thêm và báo lỗi chính xác: *"Tài khoản này chưa được cấp quyền truy cập vào website này"*.
    - **Bảng tổng quan 10 cột chuẩn**: STT, Mã Lớp & Khóa Học, Cơ Sở, Giáo Viên Phụ Trách, Giờ Học (ví dụ `18:00 - 20:00`), Ngày Bắt Đầu, Ngày Kết Thúc, Tiến Độ, Trạng Thái, Thao Tác (căn giữa toàn bộ cột trừ Mã Lớp và Cơ Sở).
    - **Modal chi tiết lớp học & Hạn nộp bài**:
      - Bỏ hoàn toàn cột "Tóm tắt nội dung" và 3 card mốc đánh giá riêng lẻ để bảng lịch trình được nâng cao tối đa.
      - Hiển thị đầy đủ Giờ học và Giáo viên phụ trách.
      - Bảng lịch trình chi tiết có cột "Hạn nộp bài" cho phép người dùng chỉnh sửa trực tiếp.
      - Quy tắc hạn nộp bài mặc định: Buổi 1 đến Checkpoint 2 là `[Bắt đầu] - [Kết thúc, Ngày học]` của từng buổi. Giai đoạn Sản phẩm cuối khóa (từ buổi ngay sau Checkpoint 2 đến buổi cuối): tất cả các buổi trong giai đoạn này đều có chung hạn nộp thống nhất từ buổi sau CP2 đến buổi cuối.
      - Khi thêm mới: Dưới cùng có 2 nút [Thêm] (lưu vào Supabase) và [Hủy].
    - **Đồng bộ chọn lọc từng trường từ LMS (Granular Selective Field Sync)**:
      - Khi nhấn "Tải dữ liệu từ LMS", hệ thống đối chiếu với LMS GraphQL thời gian thực.
      - Nếu có khác biệt, mở Modal đối chiếu 4 cột có Checkbox cho từng thuộc tính thay đổi (Giáo viên, Giờ học, Ngày kết thúc, Trạng thái, v.v.) kèm nút "Chọn tất cả" / "Bỏ chọn tất cả".
      - Chỉ ghi đè đúng các trường được người dùng tích chọn, giữ nguyên các trường khác và bảo toàn 100% hạn nộp bài tùy chỉnh.
34. **Quy Chuẩn Danh Mục 56 Cơ Sở MindX Chính Thống (56 Official MindX Campuses Standard)**:
    - Hệ thống áp dụng danh mục chuẩn hóa đúng **56 cơ sở vật lý chính thống** của MindX trên toàn quốc (loại bỏ 15 nhóm/hotline/phòng ban/online/đối tác mầm non). Admin được phân công toàn bộ 56 cơ sở này.
35. **Quy Chuẩn Quản Lý Học Viên Độc Lập & Bảng Chuyên Biệt (`managed_students`)**:
    - Dữ liệu học viên được lưu trữ trong bảng quan hệ chuyên biệt `managed_students` trên Supabase, liên kết khóa ngoại với lớp học: `class_id REFERENCES managed_classes(id) ON DELETE CASCADE`.
    - Khi một lớp học bị xóa khỏi bảng `managed_classes`, toàn bộ học viên thuộc lớp đó tự động được xóa cascade bởi PostgreSQL DB.
    - Màn hình Quản lý học viên hoạt động độc lập tại `/[role]/system-management/students`, tách biệt hoàn toàn khỏi Quản lý lớp học và có mã phân quyền `student_management` riêng biệt.
    - Bảng `users` trong Supabase được bảo vệ sạch sẽ 100%, chỉ chứa tài khoản người dùng thực tế, tuyệt đối cấm chèn các hàng dummy.
36. **Quy Chuẩn Triệt Tiêu Thông Báo & Hộp Thoại Mặc Định Của Trình Duyệt (Zero Browser Default Dialog Standard)**:
    - Tuyệt đối **KHÔNG ĐƯỢC PHÉP sử dụng các thông báo hay hộp thoại mặc định của trình duyệt** (`alert()`, `confirm()`, `prompt()`) trong toàn bộ mã nguồn của hệ thống.
    - **Thông báo phản hồi (Feedback Toasts)**: Bắt buộc sử dụng component Toast tùy biến chuyên nghiệp (`@/components/common/Toast`) với hiệu ứng hoạt họa trượt mượt mà (`animate-in fade-in slide-in-from-top-3`), phân loại sắc thái rõ ràng (Thành công: `bg-emerald-500`, Lỗi: `bg-rose-500`, Thông tin: `bg-slate-900 dark:bg-[#0B0F17]`), tự động ẩn sau 3.5 - 4.5 giây và tích hợp 100% icon chính thống từ `lucide-react` (`Check`, `AlertCircle`, `CheckCircle2`).
    - **Hộp thoại xác nhận thao tác (Confirmation Modals)**: Bắt buộc sử dụng modal xác nhận chuyên biệt (`@/components/common/ConfirmModal`) có lớp phủ làm mờ (`backdrop-blur-sm`), phân loại nguy cơ (`danger` cho hành động xóa vĩnh viễn / gỡ dữ liệu; `warning` cho hành động hủy liên kết Google Drive), hiển thị rõ đối tượng chịu tác động và nút bấm có trạng thái quay vòng tải (`Loader2`) chống bấm đúp (double-click). Giao diện tương thích hoàn hảo chế độ Sáng / Tối.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
