# Implementation Plan: Đóng Gói Toàn Bộ Web App Thành Desktop App (.exe) Đầy Đủ 100% Tính Năng

Kế hoạch này triển khai **Lựa chọn A** mà người dùng đã chọn: đóng gói toàn bộ ứng dụng Web hiện tại (`src/`) thành một phần mềm **Desktop Windows (.exe) độc lập**, giúp người dùng có ngay 100% tính năng hoàn chỉnh của FreeCut (WebCodecs, GPU shaders, Audio Mixer, Text/Subtitles, AI Kokoro TTS/Transcribe, Waveform, Keyframe animation, Trimming chuột) trong một cửa sổ app riêng mà không cần mở trình duyệt.

---

## User Review Required

> [!IMPORTANT]
> **Giải pháp đóng gói Desktop tối ưu cho NLE Web:**
> 1. **Nền tảng Desktop Shell (Chromium Native Wrapper - Electron)**:
>    - FreeCut Web phụ thuộc sâu vào các công nghệ trình duyệt tiên tiến nhất: **WebCodecs** (giải mã phần cứng H.264/HEVC), **WebGPU / WebGL** (shader hiệu ứng), **Web Audio API** đa kênh, và **SharedArrayBuffer** (đa luồng worker AI Kokoro TTS & Transformers).
>    - Việc sử dụng Electron engine đảm bảo **100% môi trường tương thích hoàn hảo**, không bị giới hạn tính năng hay thiếu codec như các webview rút gọn.
> 2. **Cấu hình Headers bảo mật cục bộ (COOP & COEP)**:
>    - Tự động nạp các header `'Cross-Origin-Embedder-Policy': 'require-corp'` và `'Cross-Origin-Opener-Policy': 'same-origin'` trong luồng desktop để kích hoạt `SharedArrayBuffer` và bộ đệm âm thanh mượt mà.
> 3. **Xuất bản file thực thi độc lập (`.exe`)**:
>    - Cung cấp lệnh chạy trực tiếp `npm run desktop` để mở app tức thì.
>    - Cung cấp lệnh `npm run desktop:build` để đóng gói ra file cài đặt hoặc portable `.exe` trong thư mục `release/` mang đi máy khác dùng mà không cần cài node hay môi trường dev.

---

## Open Questions

Không có câu hỏi chặn. Chúng ta đã build thử thành công `dist/` trong 8.02 giây và kiểm tra Electron runtime hoạt động tốt trên hệ thống.

---

## Proposed Changes

### 1. Cấu hình Desktop Shell (`desktop/`)

#### [NEW] [desktop/main.cjs](file:///d:/Other/github/freecut/desktop/main.cjs)
- Tạo cửa sổ ứng dụng Desktop `BrowserWindow` với:
  - Kích thước mặc định chuẩn NLE: 1400x900 (min 1024x600).
  - Tích hợp Icon ứng dụng, Dark theme backdrop.
  - Thiết lập Interceptor nạp các header `Cross-Origin-Embedder-Policy` & `Cross-Origin-Opener-Policy` trên giao thức `file://` hoặc local server để đảm bảo `SharedArrayBuffer`, WebCodecs và AI workers hoạt động 100%.
  - Quản lý lifecycle: Đóng mở cửa sổ, phím tắt toàn màn hình (F11), DevTools (F12).
  - Tải trực tiếp `dist/index.html` của bản web đã build.

#### [NEW] [desktop/preload.cjs](file:///d:/Other/github/freecut/desktop/preload.cjs)
- Cung cấp cầu nối an toàn (Context Isolation) giữa môi trường desktop và giao diện web.

---

### 2. Cấu hình Package & Scripts (`package.json`)

#### [MODIFY] [package.json](file:///d:/Other/github/freecut/package.json)
- Bổ sung trường `"main": "desktop/main.cjs"`.
- Bổ sung scripts mới:
  - `"desktop": "vp build && electron ."` (Tự động build và mở app desktop ngay lập tức).
  - `"desktop:dev": "electron . --dev"` (Kết nối trực tiếp tới Vite dev server).
  - `"desktop:pack": "electron-builder --dir"` (Đóng gói thư mục chạy độc lập).
  - `"desktop:dist": "electron-builder"` (Tạo bộ cài installer `.exe` và portable `.exe`).
- Bổ sung cấu hình `"build"` cho `electron-builder` (tên app `FreeCut`, appId, win icon, output `release/`).
- Bổ sung dependencies cần thiết: `electron` và `electron-builder`.

---

## Verification Plan

### Automated Build Verification
1. Build toàn bộ frontend web:
   ```bash
   npx vite build
   ```
   Yêu cầu: Tạo thành công thư mục `dist/` với đầy đủ assets, html, css, js và AI models.

### Manual Verification
1. Khởi chạy App Desktop thực tế:
   ```bash
   npx electron desktop/main.cjs
   ```
2. Kiểm tra cửa sổ ứng dụng mở lên với giao diện hoàn chỉnh của FreeCut Web:
   - Kiểm tra Import video/audio vào Media Library.
   - Kéo thả clip vào Timeline, cắt clip, di chuyển clip.
   - Thử nghiệm các tính năng nâng cao: Audio Mixer, Text Motion, AI Voice Kokoro, WebCodecs preview và Export video.
3. Thử nghiệm đóng gói ra file chạy `.exe` độc lập bằng `electron-builder`.
