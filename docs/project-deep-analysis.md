# FreeCut: Báo Cáo Nghiên Cứu Chuyên Sâu & Phân Tích Kiến Trúc Hệ Thống (Deep Analysis & Stack-Aware Architecture)

> Tài liệu này được biên soạn dựa trên khảo sát thực tế toàn bộ codebase **FreeCut**, đồ thị phụ thuộc (`code-review-graph`), mã nguồn, file cấu hình và các tài liệu thiết kế ([DESIGN.md](file:///d:/Other/github/freecut/DESIGN.md), [PRODUCT.md](file:///d:/Other/github/freecut/PRODUCT.md), [CLAUDE.md](file:///d:/Other/github/freecut/CLAUDE.md)).

---

## 1. MENTAL MODEL & TỔNG QUAN DỰ ÁN

### 1.1. Bản chất sản phẩm
* **Tên dự án:** FreeCut (FreeCut Web)
* **Loại ứng dụng:** Non-Linear Video Editor (NLE) chuyên nghiệp, đa rãnh (multi-track), chạy trực tiếp 100% trong trình duyệt.
* **Đối tượng người dùng:** Các editor có kinh nghiệm chuyển từ Adobe Premiere Pro, DaVinci Resolve hoặc Final Cut Pro, đòi hỏi độ chính xác từng khung hình (frame-accurate), thao tác bàn phím tốc độ cao, giao diện làm việc tối ưu mật độ thông tin (high-density).
* **Triết lý Local-First:** Toàn bộ media, metadata dự án, thumbnail, waveform, transcript, scene cuts, và các file cache đều nằm trực tiếp trên ổ cứng người dùng thông qua **File System Access API** và **OPFS (Origin Private File System)**. Không upload media lên cloud.
* **Mục tiêu kép (Dual-Target Architecture):**
  1. **Interactive Web App** (`index.html` → `src/main.tsx`): Giao diện NLE đầy đủ tính năng trong trình duyệt.
  2. **Headless Engine** (`headless.html` → `src/headless/main.ts` & `headless/*.mjs`): Chạy qua Node.js + Playwright CLI/HTTP server hoặc Docker để tự động hóa render video, trích xuất frame, thực thi edit operations và tích hợp AI Agent.

---

## 2. DETECTED TECH STACK (Stack Kỹ Thuật Thực Tế Đã Xác Minh)

### 2.1. Frontend & Core Framework
* **Runtime & UI Library:** **React 19.2.5** (exact-pinned).
* **Language:** **TypeScript 7.0.2** (strict mode, kích hoạt `noUncheckedIndexedAccess: true`, `strictNullChecks: true`).
* **Toolchain / Build Engine:** **Vite-Plus (`vp`)** kết hợp Vite 6 với các công cụ nền tảng Rust:
  * `oxlint`: Linter kiểm tra tĩnh kiểu dữ liệu và syntax siêu tốc.
  * `oxfmt`: Code formatter thay thế Prettier.
  * `fallow`: Phân tích dead-code, unused exports và unused class members.
* **Routing:** **TanStack Router 1.168.22** (`@tanstack/react-router`, `@tanstack/router-cli`) với file-based routing được khai báo tại `tsr.config.json` và code-gen tại `src/routeTree.gen.ts`.
* **State Management:** **Zustand 5.0.12** kết hợp **Zundo 2.3.0** (quản lý lịch sử undo/redo theo mô hình temporal).

### 2.2. UI & Design System
* **CSS Framework:** **Tailwind CSS v4** (`@tailwindcss/vite` 4.2.2, `tailwindcss` 4.2.2) sử dụng directive `@theme` và không gian màu hiện đại **OKLCH**.
* **Animation & Motion:** **Motion 12.40.0** (Framer Motion v12 rebranding), `tailwindcss-animate`.
* **UI Component Primitives:** **Radix UI** primitives (`@radix-ui/react-*`), `class-variance-authority`, `clsx`, `tailwind-merge`.
* **Docking & Resizing:** `react-resizable-panels` 3.0.6.
* **Icons:** `lucide-react` **0.468.0** (*deliberately pinned*).
* **Toasts & Dialogs:** `sonner` 2.0.7.
* **Color Picker:** `react-colorful` 5.6.1 (cho color grading wheels và solid colors).
* **Typography:** 
  * `IBM Plex Sans`: UI controls, menus, labels, descriptions.
  * `IBM Plex Mono`: Timecodes, frame counters, FPS, decibel meters, dimensions, clip time offsets.

### 2.3. Video, Audio & Graphics Pipeline
* **Media Parsing & Demuxing/Encoding:** **Mediabunny 1.50.8** kèm các codec chuyên biệt:
  * `@mediabunny/prores` (Apple ProRes decode/encode)
  * `@mediabunny/mp3-encoder`
  * `@mediabunny/aac-encoder`
  * `@mediabunny/ac3` (Dolby Digital AC-3 decoder)
* **GPU Hardware Compositing:** **WebGPU** (`@webgpu/types`) xây dựng compositor đa lớp, WGSL compute/render shaders cho:
  * Pipeline xử lý hiệu ứng GPU (GPU Effects Pipeline): Color grading (Lift/Gamma/Gain, Saturation, Temperature, Tint), 3D LUTs (.cube parser), Blurs, Keying (Green/Blue screen), Distortions, Stylize (Vignette, Film Grain, Glow).
  * GPU Scopes: Waveform, Vectorscope, RGB Parade, Histogram.
* **Audio Engine:** 6-band parametric EQ + Master bus gain + Monitoring gain qua Web Audio API.
* **Animation Format:** `@lottiefiles/dotlottie-web` 0.76.0 (cho vector animations và stickers).
* **GIF Decoding:** `gifuct-js` 2.1.2.
* **Archive & Zip:** `fflate` 0.8.2 (đóng gói project bundles).

### 2.4. On-Device AI & WebML
* **Machine Learning Runtime:** `onnxruntime-web` **1.26.0-dev.20260410-5e55544225** (*deliberately pinned dev build*).
* **Speech-to-Text & Transcripts:** `@huggingface/transformers` 4.1.0 chạy mô hình Whisper trực tiếp trong trình duyệt.
* **Text-to-Speech (TTS):** `kokoro-js` 1.2.1 sinh giọng nói offline.
* **Scene Detection & Tagging:** AI workers (Gemma scene worker, LFM worker, Histogram-based cut detection).

### 2.5. Data Storage & Persistence
* **File System Access API:** Thư mục Workspace cục bộ do người dùng cấp quyền.
* **OPFS (Origin Private File System):** Lưu trữ nhị phân tốc độ cao cho audio waveforms, filmstrip thumbnails, gif frames.
* **IndexedDB (`idb` 8.0.3):** Lưu trữ directory handles để duy trì phiên làm việc khi reload.

---

## 3. CẤU TRÚC THƯ MỤC & PHÂN BỔ TRÁCH NHIỆM

```
freecut/
├── .code-review-graph/      # Dữ liệu tri thức đồ thị (21k+ nodes, 235k+ edges)
├── docs/                    # Tài liệu kỹ thuật dự án
├── headless/                # Headless engine chạy Node.js + Playwright (render, frame, edit, serve, Docker)
├── public/                  # Static assets & sw.js (Service Worker PWA)
├── scripts/                 # Architectural guardrail scripts (kiểm tra boundaries, deps contracts, fallow, edge budgets)
└── src/
    ├── app/                 # App-level boundaries: ErrorBoundary, PWA prompt, RouteErrorScreen
    ├── app.tsx              # Root component: WorkspaceGate, Global hotkey traps, RouterProvider
    ├── bootstrap.ts         # Khởi tạo runtime ban đầu
    ├── components/
    │   ├── brand/           # Logo FreeCut
    │   └── ui/              # shadcn/ui components (Radix + Tailwind primitives)
    ├── config/              # Cấu hình layout editor, hotkeys, workspace defaults
    ├── data/                # Dữ liệu tĩnh, changelog types
    ├── features/            # Modular feature slices (mỗi feature là một miền nghiệp vụ độc lập)
    │   ├── composition-runtime/ # Runtime render composition & clip evaluation
    │   ├── docs/            # Trình xem tài liệu hướng dẫn tích hợp
    │   ├── editor/          # Khung NLE Editor chính (Toolbar, Sidebars, Inspector, Docks)
    │   ├── effects/         # Quản lý thư viện hiệu ứng & transition presets
    │   ├── export/          # Export engine, render queue, encoder runner
    │   ├── keyframes/       # Value graph editor & dopesheet editor cho keyframes
    │   ├── lottie-browser/  # Trình duyệt và chèn sticker/animation Lottie
    │   ├── media-library/   # Import, phân loại media, proxy generation, transcription
    │   ├── preview/         # Trình phát preview, canvas overlay, transform gizmo, audio sync
    │   ├── project-bundle/  # Import/Export file bundle (.freecut zip archive)
    │   ├── projects/        # Quản lý danh sách project, metadata, tạo mới project
    │   ├── scene-browser/   # Trình duyệt cắt cảnh (scene cut detection)
    │   ├── settings/        # Cài đặt ứng dụng, audio buffer, GPU preferences
    │   ├── timeline/        # Cốt lõi timeline (tracks, clips, stores, persistence, ripple/roll edits)
    │   └── workspace-gate/  # Màn hình Splash & Gate bắt buộc chọn Workspace folder trước khi vào app
    ├── headless/            # Code TypeScript bridge cho headless runner (window.freecut)
    ├── i18n/                # Đa ngôn ngữ (en, es, fr, de, pt-BR, tr, ja, ko, zh)
    ├── index.css            # Stylesheet gốc: Tokens màu OKLCH, Easing variables, Dark-mode locks
    ├── infrastructure/      # Tầng hạ tầng kỹ thuật thấp
    │   ├── analysis/        # AI workers (Whisper, Gemma, scene cut)
    │   ├── audio/           # Web Audio decoders, meter utils, bus gain
    │   ├── browser/         # Tiện ích tương tác trình duyệt, full-screen, wakelock
    │   ├── gpu-compositor/  # WebGPU pipeline, texture pools
    │   ├── gpu-effects/     # Shader implementations (color, blur, distort, keying, LUTs)
    │   ├── gpu-scopes/      # Waveform, Vectorscope, Histogram GPU shaders
    │   └── storage/         # File System Access API workspace, OPFS caching
    ├── main.tsx             # Entry point Vite, Service Worker registration, auto-save before reload
    ├── routes/              # TanStack Router pages (/, /editor/$projectId, /projects, /changelog, /docs)
    ├── shared/              # Thư viện tiện ích, hooks, domain models dùng chung
    └── types/               # Type definitions toàn cục (project, timeline, keyframe, transform, blend-modes)
```

---

## 4. KIẾN TRÚC HỆ THỐNG & NGUYÊN TẮC THIẾT KẾ CODE

### 4.1. Quy Tắc Ranh Giới Feature Cực Kỳ Nghiêm Ngặt (Architectural Boundaries)
Dự án áp dụng cơ chế tự động kiểm tra kiến trúc trong CI/CD (`npm run verify`):
1. **No Direct Cross-Feature Imports:** File trong `src/features/<Feature-A>` **tuyệt đối không được** import trực tiếp từ `src/features/<Feature-B>`.
2. **Contract Adapters:** Mọi phụ thuộc giữa các feature phải thông qua thư mục `src/features/<Feature-A>/deps/*-contract.ts` và re-export qua các adapter module.
3. **Cấm dùng `@/lib/*`:** Quy tắc cấm tuyệt đối legacy imports (`check-legacy-lib-imports.mjs`). Mọi module chung phải nằm trong `@/shared/*` hoặc `@/infrastructure/*`.
4. **Manual Chunking ngăn ngừa TDZ:** [vite.config.ts](file:///d:/Other/github/freecut/vite.config.ts) phân chia rõ ràng các bundle (`core-logger`, `feature-editing-core`, `feature-editing-ui`, `timeline-media-visuals`, `gpu-effects`) để tránh triệt để lỗi Circular Dependency TDZ (*Cannot access before initialization*).

### 4.2. Quản Lý Trạng Thái (State Architecture)
* **Single Source of Truth:** Đối tượng `Project` và `ProjectTimeline` ([src/types/project.ts](file:///d:/Other/github/freecut/src/types/project.ts)).
* **Facade Pattern:** `useTimelineStore` ([src/features/timeline/stores/timeline-store-facade.ts](file:///d:/Other/github/freecut/src/features/timeline/stores/timeline-store-facade.ts)) cung cấp một API thống nhất che giấu các sub-stores bên dưới:
  * `items-store.ts`: Danh sách clips, tracks, linked groups, reordering, spatial indexing.
  * `keyframes-store.ts`: Quản lý keyframe tracks, easing curves, bezier math.
  * `sequences-store.ts`: Tabs timeline, nested sequences (pre-comps).
  * `timeline-command-store.ts`: Thực thi Command Pattern, hỗ trợ Undo/Redo với Zundo.
  * `timeline-persistence.ts`: Cơ chế auto-save debounced ghi xuống file `project.json` trên ổ cứng.
* **Playback & Audio Sync Store:** Tách biệt trạng thái playback tần số cao (`currentFrame`, `playing`, `shuttleSpeed`) ra khỏi Zustand store chính để tránh re-render không cần thiết trên toàn cây React.

### 4.3. Pipeline Render & Hiệu Ứng GPU
* **WebGPU Compositor:** Tận dụng WebGPU để hòa trộn các layer video, text, shape, image theo thời gian thực.
* **Dual Rendering Path:**
  * **Preview Mode:** Tối ưu hóa tốc độ và độ trễ thấp (sub-frame seek, frame-drop handling khi playback nhanh).
  * **Export Mode:** Render từng khung hình chính xác tuyệt đối (frame-accurate), không nén bớt bước tính toán, hỗ trợ multipass compositing và render queue chạy ngầm.

---

## 5. UI / GUI AUDIT: "THE QUIET INSTRUMENT"

Giao diện của FreeCut được xây dựng theo tài liệu [DESIGN.md](file:///d:/Other/github/freecut/DESIGN.md) và [PRODUCT.md](file:///d:/Other/github/freecut/PRODUCT.md) với định vị là một **nhạc cụ tinh xảo và tĩnh lặng**:

### 5.1. Bảng Màu OKLCH & Quy Tắc "The One Signal Rule"
* **Bề mặt tối trung tính (Graphite Ramp):**
  * Canvas nền: `oklch(0.15 0 0)` (#262626)
  * Timeline floor: `oklch(0.12 0 0)` (#1f1f1f - vùng tối nhất tạo độ sâu)
  * Panel header: `oklch(0.14 0 0)` (#242424)
  * Popover / Dropdown: `oklch(0.16 0 0)` (#292929)
  * Panel surface: `oklch(0.18 0 0)` (#2e2e2e)
  * Đường viền (Border): `oklch(0.25 0 0)`
* **The One Signal Rule:** Chỉ sử dụng duy nhất một màu tín hiệu nổi bật là **Signal Orange** (`oklch(0.68 0.19 45)`):
  * Dành riêng cho: Playhead, trạng thái đang phát (playing), nút kích hoạt (active), focus ring, vùng chọn.
  * **Tuyệt đối không dùng màu cam này để trang trí tĩnh.**
* **Màu ngữ nghĩa cho Clips (Semantic Hues):** Màu của clip mang ý nghĩa dữ liệu:
  * Video: Slate-Blue (`oklch(0.3991 0.0401 250)`)
  * Audio: Violet (`oklch(0.22 0.02 302)`)
  * Image: Sky Blue (`oklch(0.62 0.17 250)`)
  * Text / Captions: Grey-Violet (`oklch(0.671 0 290)`)
  * Markers: Blue / Green (In Point) / Red (Out Point)

### 5.2. Nguyên Tắc Phân Tầng Thị Giác (Tonal Layering)
* Không sử dụng drop shadow cho các panel phẳng. Chiều sâu được xác định bằng độ sáng của các lớp (Lightness steps).
* Chỉ dùng bóng mờ cho các thành phần bay (floating menus, dialogs) hoặc vầng sáng cam nhạt (`glow-primary`) khi đang phát.
* Dark-only: Không hỗ trợ Light Mode để đảm bảo độ chuẩn xác về màu sắc khi chỉnh màu (Color Grading / Scopes).

### 5.3. Trải Nghiệm Tương Tác NLE Chuyên Nghiệp
* **Phím tắt chuẩn NLE:**
  * `J - K - L`: Shuttle backward / Pause / Shuttle forward (tăng tốc x2, x4, x8 khi bấm liên tiếp).
  * `Space`: Play / Pause.
  * `I / O`: Đặt Mark In / Mark Out.
  * `C`: Razor tool (Cắt clip tại playhead).
  * `V`: Selection tool.
  * `B`: Ripple edit tool.
  * `N`: Rolling edit tool.
  * `Y`: Slip tool.
  * `U`: Slide tool.
* **Chặn zoom trình duyệt:** Toàn bộ phím tắt `Ctrl + Wheel`, `Ctrl + =/-` bị chặn ở capture phase để dành quyền zoom timeline và canvas.

---

## 6. QUY TRÌNH PHÁT TRIỂN & QUY TẮC ĐÓNG GÓP (DEVELOPMENT GUIDELINES)

Khi phát triển hoặc sửa đổi bất kỳ đoạn code nào trong FreeCut, bắt buộc phải tuân thủ:

### 6.1. Quy Trình Git & Commit
* **Branching Model:**
  * `develop`: Nhánh làm việc chính. Commit code trực tiếp vào `develop` (không tự ý tạo nhánh tính năng lẻ).
  * `staging`: Nhánh tích hợp tiền phát hành. Tạo PR từ `develop` vào `staging`.
  * `main`: Nhánh production. Không bao giờ tạo PR thẳng vào `main`.
* **Conventional Commits:** `type(scope): description`
  * Ví dụ: `fix(timeline): resolve ripple shift calculation`, `feat(effects): add bilateral blur shader`.

### 6.2. Quy Tắc Quản Lý Dependency
* Mọi dependencies phải **exact-pinned** (không dùng dấu `^` hoặc `~`).
* **Không được phép tự ý nâng cấp:**
  * `onnxruntime-web` (được ghim bản dev cụ thể phục vụ WebGPU WebML).
  * `lucide-react` (được ghim tại version `0.468.0`).

### 6.3. Bộ Lệnh Kiểm Tra Bắt Buộc (Verification Suite)
Trước khi push code hoặc hoàn tất công việc, phải chạy và đảm bảo vượt qua các bài test:
```bash
# Kiểm tra ranh giới feature & import contract
npm run check:boundaries
npm run check:deps-contracts
npm run check:legacy-lib-imports
npm run check:deps-wrapper-health

# Kiểm tra code quality & dead code
npm run check:unused-exports
npm run check:unused-class-members
npm run check:edge-budgets

# Lint & Typecheck
npm run check

# Unit test & Component test
npm run test:run

# Build test
npm run build
```

---

## 7. ĐIỂM CẦN LƯU Ý KHI MỞ RỘNG TÍNH NĂNG (RISKS & GOTCHAS)

1. **COOP / COEP Headers:**
   * Dev server và preview server đều bật:
     * `Cross-Origin-Embedder-Policy: require-corp`
     * `Cross-Origin-Opener-Policy: same-origin`
   * Điều này bắt buộc để kích hoạt `SharedArrayBuffer` và đa luồng Web Workers. Mọi external media nạp vào app phải hỗ trợ header CORS phù hợp, nếu không trình duyệt sẽ chặn nạp.
2. **Coupling cao giữa Preview và Types:**
   * Theo đồ thị tri thức (`code-review-graph`), nhóm `utils-preview` và `types-property` có hơn 5,200 liên kết phụ thuộc. Khi chỉnh sửa `src/types/project.ts` hoặc `src/types/timeline.ts`, hãy chạy kiểm tra toàn diện để tránh break preview pipeline.
3. **Bộ nhớ WebGPU:**
   * Khi render clip hoặc xử lý hiệu ứng, các GPU texture phải được giải phóng hoặc trả về `GpuTexturePool` để tránh tràn bộ nhớ VRAM trên các thiết bị tích hợp.
