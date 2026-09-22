# 1. Goals, phạm vi và nguyên tắc

## 1.1. Vì sao chuyển native

FreeCut cần desktop native vì editor media có các yêu cầu mà browser khó đáp ứng ổn định:

- truy cập file local trực tiếp;
- playback và seek ít trễ;
- xử lý media dài trong background;
- cache lớn và predictable;
- GPU preview;
- keyboard shortcut kiểu desktop;
- window/workspace tùy biến;
- binary nhẹ hơn app chạy trên Chromium.

Mục tiêu là cải thiện cảm nhận sử dụng, không phải chỉ thay đổi công nghệ.

## 1.2. Mục tiêu sản phẩm

### Mục tiêu bắt buộc

- App mở được như desktop app độc lập trên Windows trước.
- Tạo/mở/lưu project local.
- Import media bằng file picker và drag-and-drop.
- Hiển thị workspace gồm Media, Preview, Inspector và Timeline.
- Playback, seek và chỉnh sửa clip cơ bản.
- Undo/redo đáng tin cậy.
- Export được ít nhất một format phổ biến.
- UI không bị block trong lúc decode, preview, thumbnail hoặc export.
- Có log file và dialog lỗi startup có thể đọc được.

### Mục tiêu chất lượng

- UI phản hồi ngay khi kéo clip hoặc scrub.
- Không có thao tác nặng chạy trên UI thread.
- Memory/cache có giới hạn và cơ chế cleanup.
- Project mở lại cho kết quả giống trước khi đóng.
- Shortcut, menu, pointer và focus nhất quán.
- Có dark theme làm mặc định và design token tập trung.

### Không phải mục tiêu của MVP

- Port toàn bộ mọi tính năng AI ngay lập tức.
- Hỗ trợ mọi codec và mọi platform trong phase đầu.
- Clone pixel-perfect UI web hiện tại.
- Xóa web app trước khi native đạt parity cần thiết.
- Viết một abstraction quá chung cho mọi frontend ngay từ đầu.

## 1.3. Nguyên tắc kiến trúc

1. **Native-first cho media path**: decode, preview, waveform, thumbnail và export không phụ thuộc browser API.
2. **State ở Rust**: Slint không tự làm nguồn sự thật của project.
3. **Command-driven editing**: mọi mutation quan trọng đi qua command có undo/redo.
4. **Một chiều**: UI phát intent, Rust xử lý, Rust publish snapshot/model, UI render.
5. **Feature module hóa**: không để một `lib.rs` trở thành event router khổng lồ.
6. **Incremental migration**: mỗi phase có binary chạy được và rollback được.
7. **Đo trước khi tối ưu**: không tuyên bố zero-copy/zero-latency nếu chưa có benchmark.
8. **File format có version**: project phải có schema version và migration function.
9. **Graceful fallback**: GPU/codec/model không khả dụng phải có thông báo và fallback rõ.
10. **UX consistency trước visual novelty**: ưu tiên affordance, focus, shortcut, feedback và recoverability.

## 1.4. Ranh giới giữa UI và domain

Slint được phép:

- layout;
- vẽ panel, timeline, preview overlay;
- nhận pointer/keyboard gesture;
- hiển thị model;
- phát callback typed.

Slint không được là nơi duy nhất quyết định:

- clip có hợp lệ không;
- command có thể apply không;
- undo snapshot thế nào;
- project lưu ra sao;
- media decode bằng cách nào;
- job bị cancel thế nào;
- export pipeline có hợp lệ không.
