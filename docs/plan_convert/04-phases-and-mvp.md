# 4. Phases và MVP

## Tổng quan

```text
Phase 0  Discovery + contract
Phase 1  Native shell MVP
Phase 2  Project/core MVP
Phase 3  Timeline editing MVP
Phase 4  Preview/playback MVP
Phase 5  Export MVP
Phase 6  UX parity + performance
Phase 7  AI/effects/advanced features
Phase 8  Production hardening
```

Mỗi phase phải tạo ra artifact chạy được. Không mở phase mới nếu phase trước chưa có acceptance criteria cơ bản.

## Phase 0 — Discovery và contract

### Mục tiêu

Đóng băng behavior cần bảo toàn trước khi viết native.

### Việc cần làm

- inventory feature hiện tại;
- xác định project format hiện tại;
- xác định media format/capability;
- liệt kê keyboard shortcuts;
- lấy các project fixture thật;
- đo startup, memory, seek, export của web app làm baseline;
- quyết định Windows-first platform;
- thống nhất license và packaging dependencies;
- viết capability matrix web/native.

### Deliverable

- feature inventory;
- schema draft;
- sample projects;
- benchmark baseline;
- decision log;
- native workspace build được.

### Hoàn thành khi

- team biết feature nào bắt buộc cho MVP;
- có ít nhất 3 project fixture nhỏ/vừa/lớn;
- có đường build Rust sạch trên máy dev;
- không còn câu hỏi mơ hồ về project identity và time/frame model.

## Phase 1 — Native shell MVP

### Mục tiêu

Có app desktop native mở được, có UX shell giống Concat.

### Phạm vi

- Rust binary;
- Slint root App;
- custom title bar;
- dark theme;
- menu placeholder;
- settings placeholder;
- dock tree;
- pane split/resize/close/add;
- native file picker;
- drag/drop path;
- logging;
- startup error dialog;
- preferences JSON/TOML.

### Không làm

- decode video thật;
- effects thật;
- export;
- AI.

### Acceptance criteria

- app launch ổn định;
- resize/minimize/maximize/close hoạt động;
- title bar hoạt động đúng trên Windows;
- layout dock có thể lưu/restore;
- keyboard focus không bị mất sau khi đóng modal;
- không có panic không được báo;
- app không treo khi chọn file lớn.

## Phase 2 — Project/Core MVP

### Mục tiêu

Native app có project model và persistence đáng tin cậy.

### Phạm vi

- Project/Timeline/Track/Clip/Asset IDs;
- create/open/save/save as;
- schema version;
- atomic save;
- autosave;
- recent projects;
- missing media state;
- command dispatcher;
- undo/redo;
- publish models sang Slint.

### Acceptance criteria

- mở/save project không mất dữ liệu;
- đóng app giữa lúc save không làm hỏng file chính;
- undo/redo cho add/move/delete clip;
- project cũ được báo version rõ nếu chưa hỗ trợ;
- asset path tương đối được resolve đúng;
- mọi mutation quan trọng có command/test.

## Phase 3 — Timeline Editing MVP

### Mục tiêu

Cho phép edit video cơ bản với interaction giống editor desktop.

### Phạm vi

- timeline ruler;
- tracks;
- clip blocks;
- selection đơn/multiple;
- move;
- trim đầu/cuối;
- split tại playhead;
- delete;
- ripple delete tùy quyết định product;
- snapping;
- zoom/pan;
- playhead;
- context menu;
- keyboard shortcuts;
- multi-select/band select.

### Acceptance criteria

- kéo clip không giật ở project fixture mục tiêu;
- release mới tạo một history entry;
- trim không tạo range âm hoặc vượt asset;
- snapping có thể tắt;
- shortcut không ăn phím khi đang nhập text;
- timeline virtualize/không render vô hạn clip ngoài viewport.

## Phase 4 — Preview/Playback MVP

### Mục tiêu

Preview native thực sự hoạt động, không phụ thuộc browser.

### Phạm vi

- media probe;
- decode worker;
- preview frame request;
- seek;
- play/pause;
- frame step;
- aspect ratio;
- fit/fill;
- loading/error/no-frame states;
- CPU fallback;
- optional wgpu compositor.

### Acceptance criteria

- seek request cũ bị hủy/bỏ qua khi user scrub nhanh;
- UI không block khi decode;
- frame không thuộc request cũ không được ghi đè frame mới;
- không crash khi file lỗi/codec không hỗ trợ;
- có benchmark startup preview, first frame, seek latency và playback stability.

## Phase 5 — Export MVP

### Mục tiêu

Export được output tối thiểu đáng tin cậy.

### Phạm vi

- export dialog;
- output path;
- resolution/rate cơ bản;
- codec preset cơ bản;
- progress;
- cancel;
- retry;
- reveal output;
- export error log.

### Acceptance criteria

- cancel không để process nền chạy ngầm;
- output file có thể phát bằng player phổ biến;
- export lỗi không làm hỏng project;
- mở lại dialog thấy thông số đã chọn;
- progress không giả mạo 100% trước khi file đóng.

## Phase 6 — UX parity và performance

### Mục tiêu

Đạt trải nghiệm production-quality theo tinh thần Concat.

### Phạm vi

- light theme;
- semantic media colors;
- tooltips/kbd hints;
- focus ring/accessibility;
- toast/notification;
- settings thật;
- layout restore;
- autosave indicator;
- media bin grid/list;
- inspector cơ bản;
- waveform/filmstrip cache;
- GPU preview benchmark;
- memory/cache cleanup;
- crash/startup diagnostics.

### Acceptance criteria

- không có interaction chính chỉ dùng được bằng chuột;
- mọi background task có trạng thái;
- app chịu được sleep/wake và display resize;
- memory không tăng vô hạn khi scrub lâu;
- cache cleanup không xóa project data;
- benchmark đạt ngưỡng đã chốt ở Phase 0.

## Phase 7 — Advanced features

Thực hiện theo ưu tiên sản phẩm:

- effects/transitions;
- keyframes;
- audio tools;
- captions/transcription;
- text-to-speech;
- AI models;
- proxy media;
- frame interpolation/upscale;
- collaboration/remote API nếu thật sự cần.

Mỗi feature phải được tích hợp qua command/model/job API, không thêm một luồng state riêng chỉ trong UI.

## Phase 8 — Production hardening

- Windows installer;
- code signing nếu có;
- crash reporting/log bundle;
- auto update strategy;
- migration test nhiều schema version;
- clean install/uninstall test;
- offline operation;
- corrupted media/project recovery;
- GPU driver matrix;
- release channel và rollback.

## MVP cuối cùng là gì?

MVP có nghĩa là một native editor nhỏ nhưng dùng được end-to-end:

```text
Launch
→ Create/Open project
→ Import media
→ Place media on timeline
→ Move/trim/split/delete
→ Play/seek preview
→ Undo/redo
→ Save project
→ Export video
```

Nếu thiếu một mắt xích trong flow trên thì chưa gọi là editor MVP hoàn chỉnh.
