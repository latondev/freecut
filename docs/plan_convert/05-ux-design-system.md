# 5. UX và design system

## 5.1. Tinh thần UX

Học từ Concat ở cấp độ hệ thống, không sao chép giao diện từng pixel:

- workspace là trung tâm;
- pane có thể dock/split/resize;
- thao tác thường dùng có vị trí ổn định;
- trạng thái save/play/export luôn nhìn thấy;
- keyboard là công dân hạng nhất;
- click vùng trống làm mất focus field;
- thao tác dài có progress/cancel;
- lỗi nói rõ nguyên nhân và cách xử lý;
- modal không phá context;
- mỗi action có feedback.

## 5.2. Layout mặc định

```text
┌────────────────────────────────────────────────────┐
│ Title bar / menus / project status / export         │
├──────────────┬─────────────────────┬───────────────┤
│ Media         │ Preview             │ Inspector     │
│ Library       │ Monitor             │ Properties    │
├──────────────┴─────────────────────┴───────────────┤
│ Timeline / tracks / playhead / tools                │
└────────────────────────────────────────────────────┘
```

Đây là layout mặc định, không phải layout cố định. User có thể đóng/mở panel và app nhớ layout.

## 5.3. Design tokens

Tạo token cho:

- surface: `page`, `panel`, `raised`, `field`, `well`;
- semantic: `accent`, `success`, `warning`, `danger`, `info`;
- media kind: video, audio, image, text, effect;
- typography: body, label, title, display, caption;
- spacing: xs, sm, md, lg, xl;
- radius: none, small, medium;
- motion: fast hover, normal panel, slow modal;
- focus/disabled/active/selected states.

Không hard-code màu trong từng component.

## 5.4. Interaction rules

- Drag clip: preview position trong lúc kéo; commit khi release.
- Trim clip: hiện duration/source range rõ.
- Delete: có undo; ripple delete là action riêng.
- Export: disable duplicate start, cho cancel rõ.
- Import: file lỗi hiển thị từng item, không fail cả batch nếu không cần.
- Modal: `Esc` đóng nếu không có thay đổi chưa xác nhận.
- Text field: shortcut editor không bắt phím người dùng đang nhập.
- Context menu: phản ánh đúng selection hiện tại.
- Loading: không dùng spinner vô hạn nếu có thể hiển thị progress.

## 5.5. States bắt buộc của UI

Mỗi pane chính cần thiết kế:

- empty;
- loading;
- ready;
- selected;
- busy;
- error;
- unavailable;
- stale/outdated;
- offline/missing media.

Không để một trạng thái chỉ được biểu diễn bằng việc panel trống.

## 5.6. Accessibility

- focus ring nhìn thấy được;
- keyboard navigation;
- label cho control không chỉ bằng icon;
- tooltip cho icon lạ;
- contrast đủ ở dark/light theme;
- shortcut không xung đột với text editing;
- reduced motion nếu framework hỗ trợ;
- thông báo lỗi có text, không chỉ màu đỏ.
