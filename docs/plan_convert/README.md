# FreeCut Web → Native Desktop

## Mục đích

FreeCut hiện tại là web app. Kế hoạch này mô tả ý định chuyển FreeCut thành desktop app native, ưu tiên trải nghiệm giống Concat: nhẹ, mở nhanh, phản hồi tốt, workspace có thể dock/split, timeline kéo thả mượt và preview có khả năng tận dụng GPU.

Đích kỹ thuật được chọn là **Rust + Slint + winit + wgpu**, không dùng Electron và không dùng Tauri làm lớp desktop chính.

Tài liệu này là nguồn định hướng cho các thay đổi sau này. Mọi implementation mới cần đối chiếu với mục tiêu, phase và tiêu chí hoàn thành trong đây.

## Tình trạng hiện tại

FreeCut là codebase TypeScript/TSX/JavaScript lớn, có các khu vực chính:

- editor/workspace;
- preview và playback;
- timeline;
- media library;
- export;
- audio processing;
- transcription/TTS;
- worker xử lý nền;
- filesystem/browser storage.

Không được xem migration này là việc dịch từng component React thành Slint. Đây là migration kiến trúc: giữ lại domain behavior, project semantics, UX intent và test fixtures; viết lại window shell, state runtime, media pipeline và UI native.

## Tài liệu trong thư mục

1. `01-goals-and-principles.md` — mục tiêu, phạm vi, nguyên tắc và quyết định nền tảng.
2. `02-target-architecture.md` — kiến trúc Rust/Slint đích và data flow.
3. `03-web-to-native-mapping.md` — mapping chi tiết từ browser API sang native API.
4. `04-phases-and-mvp.md` — roadmap, các phase, MVP, deliverable và acceptance criteria.
5. `05-ux-design-system.md` — UX/UI theo hướng Concat nhưng dành cho FreeCut.
6. `06-risks-testing-release.md` — rủi ro, kiểm thử, hiệu năng, packaging và rollback.

## Quyết định ngắn gọn

- Native desktop là sản phẩm chính cho workflow editor nặng.
- Web app hiện tại chưa bị xóa; tiếp tục tồn tại trong giai đoạn migration.
- Project format, effect manifest và semantic behavior phải được bảo toàn hoặc có migration rõ ràng.
- Domain/model/command chuyển sang Rust trước khi port toàn bộ UI.
- Preview/export/media processing không được phụ thuộc vào browser runtime trong bản native.
- Slint chỉ đảm nhận presentation và interaction; Rust sở hữu state và business logic.
- Mỗi phase phải build được, chạy được và có tiêu chí đo lường; không merge một rewrite lớn không kiểm chứng.
