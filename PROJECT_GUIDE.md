# FreeCut — Hướng dẫn tổng quan dự án

> Tài liệu nhập môn cho developer/agent mới. Mục tiêu là giúp hiểu mô hình hệ thống, tìm đúng khu vực cần sửa và biết cách kiểm tra thay đổi mà không phải đọc tuần tự toàn bộ repository.
>
> Nội dung mô tả trạng thái được xác minh trong source/config hiện tại. Đây là bản đồ và điểm bắt đầu, không thay thế source code khi cần xác nhận chi tiết hành vi. Khi tài liệu khác với code, ưu tiên source và test.

## 1. FreeCut là gì?

FreeCut là trình dựng video phi tuyến tính (NLE) nhiều track, ưu tiên local-first. Web app chạy trong Chromium và lưu project, metadata, media/cache cùng dữ liệu phân tích vào workspace do người dùng chọn. Media và project không cần upload lên dịch vụ cloud để edit/render. Một số model AI được tải và chạy trong browser; đây không đồng nghĩa mọi tài nguyên đều có sẵn offline ngay lần đầu.

Sản phẩm hướng tới editor quen workflow Premiere/Resolve: edit theo frame, thao tác bàn phím, timeline nhiều track và workspace dày thông tin nhưng dễ đọc. Nguyên tắc giao diện nằm trong [`PRODUCT.md`](PRODUCT.md) và [`DESIGN.md`](DESIGN.md).

FreeCut hiện có nhiều target khác nhau, cần phân biệt:

1. **Web app chính**: React/TypeScript, entry [`index.html`](index.html) → [`src/main.tsx`](src/main.tsx) → router/editor.
2. **Electron desktop wrapper**: đóng gói bản web build; main process và preload ở [`desktop/`](desktop/). Đây không phải một media engine native độc lập.
3. **Headless render/edit harness**: entry Vite thứ hai, [`headless.html`](headless.html) → [`src/headless/main.ts`](src/headless/main.ts), được điều khiển bởi Node/Playwright trong [`headless/`](headless/). Harness dùng lại pipeline render của app nhưng không mount UI/workspace gate.
4. **Rust + Slint native GUI**: prototype song song trong [`GUI/`](GUI/), hiện mới có shell và project JSON tối thiểu. Theo [`GUI/README.md`](GUI/README.md), decode/playback, timeline edit, compositor, export, effects và AI chưa được triển khai ở target này.

## 2. Chạy project

### Web app

Yêu cầu thực tế theo README/CI: Node.js 22+, npm 11+ và trình duyệt Chromium hiện đại (Chrome/Edge khuyến nghị). Cần `npm install`, rồi:

```bash
npm run dev
```

Mở `http://localhost:5173`. Khi chạy ứng dụng, chọn một thư mục workspace nếu chưa có workspace được cấp quyền.

Các lệnh thường dùng:

```bash
npm run dev                 # Vite+ dev server, port 5173
npm run build               # Production build
npm run preview             # Preview build
npm run perf                # Production-like build/serve, hữu ích đo playback
npm run lint                # Oxlint
npm run format              # Oxfmt
npm run check               # Type/lint checks qua Vite+
npm run test:run            # Unit/component tests
npm run routes              # Sinh lại TanStack route tree
npm run verify              # Quality gates, tests, build và headless contracts
```

Các script, phụ thuộc và chi tiết Electron packaging là nguồn chính tại [`package.json`](package.json). Không chỉnh tay [`src/routeTree.gen.ts`](src/routeTree.gen.ts); sửa file route rồi chạy `npm run routes`.

### Electron

- `npm run desktop:dev`: dev workflow của Electron.
- `npm run desktop:run`: build web trước rồi mở Electron.
- `npm run desktop:pack` / `npm run desktop:dist`: đóng gói.

[`desktop/main.cjs`](desktop/main.cjs) tạo cửa sổ, phục vụ `dist/` qua HTTP loopback với COOP/COEP và byte-range; [`desktop/preload.cjs`](desktop/preload.cjs) chỉ expose một API nhỏ bằng `contextBridge`. Giữ API preload nhỏ và kiểm tra/giới hạn dữ liệu IPC hoặc URL mở ngoài.

### Rust GUI prototype

Chạy riêng theo hướng dẫn [`GUI/README.md`](GUI/README.md): `cd GUI`, `cargo run`. Không nhầm các thay đổi ở đây với web renderer/Electron.

### Headless

Các lệnh headless được khai báo trong `package.json`:

```bash
npm run headless
npm run headless:frame
npm run headless:layout
npm run headless:edit
npm run headless:test
npm run headless:test:portable
```

`headless:test` build trước. `headless:test:portable` chạy bộ Node, Chrome, edit-operation và media test portable; CI dùng build đã tạo để chạy portable contracts. Kiểm tra `package.json` trước khi dựa vào một tên CLI cụ thể.

## 3. Sơ đồ kiến trúc

```text
index.html                         headless.html
    │                                  │
    ▼                                  ▼
src/main.tsx                       src/headless/main.ts
    │                                  │
    ├── i18n / debug / PWA             ├── window.freecut bridge
    ▼                                  ├── validate/edit inputs
src/app.tsx                             └── export render pipeline
    │                                              │
    ├── ErrorBoundary                              │
    ├── WorkspaceGate                              │
    └── TanStack Router                            │
         ├── projects / setup                       │
         └── editor                                 │
              ├── feature UI                        │
              ├── Zustand timeline state            │
              └── preview/player                    │
                       │                            │
                       ▼                            ▼
             composition runtime ◀──────── export renderer
                       │
             browser / audio / GPU infrastructure
                       │
             workspace filesystem + OPFS caches
```

Các lớp chính:

- **`src/routes/`**: URL và route loaders; không chứa editor engine.
- **`src/features/`**: module sản phẩm/UI theo miền nghiệp vụ.
- **`src/runtime/`**: clock, player và logic đánh giá composition dùng khi preview/render.
- **`src/infrastructure/`**: adapter cho browser APIs, storage, audio, GPU, workers và inference.
- **`src/shared/`**: model/logic dùng chung, utilities và một số Zustand state liên miền.
- **`src/types/`**: kiểu dữ liệu dự án/timeline/effects/audio/export.
- **`src/components/`, `src/app/`, `src/config/`, `src/i18n/`**: shell UI, thiết lập ứng dụng và localization.

## 4. Bản đồ thư mục quan trọng

### Application, routes và UI

| Đường dẫn | Vai trò |
| --- | --- |
| [`src/main.tsx`](src/main.tsx) | Khởi động app, nạp i18n, xử lý update/PWA và mount React. |
| [`src/app.tsx`](src/app.tsx) | RouterProvider, error boundary, workspace gate, tooltip/toast và chặn browser zoom. |
| [`src/routes/`](src/routes/) | TanStack file-based routes: landing, project list/create, editor, docs, changelog. |
| [`src/routeTree.gen.ts`](src/routeTree.gen.ts) | File sinh tự động từ routes. |
| [`src/features/editor/`](src/features/editor/) | Editor shell/workspaces, toolbar, inspector, panels và orchestration UI. |
| [`src/components/ui/`](src/components/ui/) | Primitive/component UI dùng chung (Radix/shadcn-style). |
| [`src/config/`](src/config/) | Editor layout/workspaces, hotkeys và cấu hình mặc định. |

### Feature domains

Mỗi feature là một khu vực nghiệp vụ; xem trực tiếp các thư mục `components`, `stores`, `services`, `hooks`, `utils`, `workers`, `deps` đang có trong module đó.

| Feature | Điểm bắt đầu / phạm vi |
| --- | --- |
| `workspace-gate` | Chọn/reconnect workspace và chặn route cần storage cho đến khi có quyền. |
| `projects` | Danh sách, tạo/mở/xóa/khôi phục project và project-level flows. |
| `project-bundle` | Bundle import/export, schema validation. |
| `media-library` | Import, metadata, relink, proxy, thumbnail, media analysis và transcription. |
| `timeline` | Track/item editing, sequence navigation, markers, transitions, persistence, edit operations. |
| `preview` | Preview UI, scrub/playback coordination, overlays/gizmos và preview workers. |
| `keyframes` | Dopesheet/graph editor và thao tác animation. |
| `effects` | Effect/transition UI và preset handling. |
| `export` | Chuyển timeline thành composition, render/encode, export queue và subtitle/audio paths. |
| `scene-browser` | UI tìm/duyệt scene/caption/analysis. |
| `lottie-browser` | Duyệt, import và chỉnh Lottie assets. |
| `settings` | Cài đặt ứng dụng/editor. |
| `docs` | Nội dung/trình xem docs trong app. |

Các miền `src/features/` hiện có thể xem nhanh bằng cách liệt kê thư mục; không nên đoán module còn tồn tại chỉ từ tài liệu cũ.

### Runtime và infrastructure

| Đường dẫn | Vai trò |
| --- | --- |
| [`src/runtime/player/`](src/runtime/player/) | Clock, playback coordination, video frame access và player contexts. |
| [`src/runtime/composition-runtime/`](src/runtime/composition-runtime/) | Đánh giá/render composition; lắp scene/layer theo frame; dùng bởi preview và export. |
| [`src/infrastructure/storage/`](src/infrastructure/storage/) | Workspace FS APIs, IndexedDB handle registry, cache và persistence adapters. |
| [`src/infrastructure/browser/`](src/infrastructure/browser/) | Browser-specific media/file/object URL/ProRes helpers. |
| [`src/infrastructure/gpu-compositor/`](src/infrastructure/gpu-compositor/) | GPU texture/compositor pipeline. |
| [`src/infrastructure/gpu-effects/`](src/infrastructure/gpu-effects/) | Effect registry và shader implementation. |
| [`src/infrastructure/gpu-transitions/`](src/infrastructure/gpu-transitions/) | Transition shaders/pipeline. |
| `src/infrastructure/gpu-media/`, `gpu-text/`, `gpu-shapes/`, `gpu-masks/`, `gpu-scopes/` | Render media/text/shapes/masks và video scopes. |
| [`src/infrastructure/audio/`](src/infrastructure/audio/) | Audio processing/worklets, time stretch, meters và sound. |
| [`src/infrastructure/analysis/`](src/infrastructure/analysis/) | Scene detection, captioning, embeddings và model workers. |
| [`src/infrastructure/llm/`](src/infrastructure/llm/) | Adapter/registry/protocol cho local LLM workers. |
| [`src/infrastructure/interpolation/`](src/infrastructure/interpolation/) và `upscale/` | Frame interpolation và upscale. |
| [`src/shared/`](src/shared/) | Các tiện ích/logic không gắn UI feature cụ thể, typography, state và media helpers. |

## 5. Luồng chạy quan trọng

### 5.1 Startup và workspace

1. `src/main.tsx` load i18n/styles và khởi chạy app; ở dev có thể nạp debug tools.
2. `App` dựng `WorkspaceGate` bên ngoài RouterProvider. Vị trí này có chủ ý: route loader có thể chạy trước khi component route mount, nên storage root phải được khởi tạo trước.
3. Gate khôi phục directory handle từ IndexedDB (`handles-db`), kiểm tra/cấp lại quyền, gọi `setWorkspaceRoot()` và `bootstrapWorkspace()`.
4. `/` có thể hiển thị mà không cần workspace; route `/projects*` và `/editor*` phụ thuộc workspace. Nếu File System Access API không khả dụng, full workflow không hoạt động.
5. Storage module lấy root qua `requireWorkspaceRoot()`; nếu gọi trước Gate, đây là lỗi thứ tự khởi tạo chứ không phải lý do để âm thầm dùng storage khác.

Nguồn: [`src/app.tsx`](src/app.tsx), [`src/features/workspace-gate/workspace-gate.tsx`](src/features/workspace-gate/workspace-gate.tsx), [`src/infrastructure/storage/workspace-fs/root.ts`](src/infrastructure/storage/workspace-fs/root.ts).

### 5.2 Mở và lưu project

1. Route `/editor/$projectId` loader đọc metadata project và schema version; editor component tải timeline sau đó.
2. Project được đọc/ghi dưới dạng JSON trong workspace; `Project` và timeline type ở [`src/types/project.ts`](src/types/project.ts), item/track cụ thể ở [`src/types/timeline.ts`](src/types/timeline.ts).
3. Timeline facade [`src/features/timeline/stores/timeline-store-facade.ts`](src/features/timeline/stores/timeline-store-facade.ts) cho UI một API thống nhất, nhưng state thực tế được tách thành stores (items, transitions, keyframes, markers, settings, command/history...).
4. Persistence được điều phối ở [`src/features/timeline/stores/timeline-persistence.ts`](src/features/timeline/stores/timeline-persistence.ts). Save cần loại bỏ dữ liệu phiên như object URL `blob:`; media-backed item được resolve lại bằng `mediaId` khi load.
5. Project migrations/normalization đặt trong [`src/shared/projects/migrations/`](src/shared/projects/migrations/). Khi thay đổi persisted schema, cập nhật version/migration và tests; không sửa dữ liệu cũ theo giả định project nào cũng là schema mới.

### 5.3 Workspace trên đĩa

Nguồn layout thực tế là [`src/infrastructure/storage/workspace-fs/paths.ts`](src/infrastructure/storage/workspace-fs/paths.ts); bản README được app tạo mới từ [`README.template.md`](src/infrastructure/storage/workspace-fs/README.template.md).

```text
{workspace}/
├── .freecut-workspace.json
├── README.md
├── index.json                         # index/listing có thể rebuild
├── projects/{projectId}/
│   ├── project.json                   # project + timeline là dữ liệu chính
│   ├── thumbnail.jpg
│   ├── media-links.json
│   ├── render-queue.json
│   └── animation-presets.json
├── media/{mediaId}/
│   ├── metadata.json
│   ├── {filename} hoặc source.link.json
│   ├── thumbnail.jpg
│   └── cache/                         # filmstrip, waveform, decoded audio, AI...
├── content/proxies/{proxyKey}/        # proxy dùng chung theo fingerprint
└── exports/                           # output export
```

Lưu ý:

- Workspace hiện là source of truth cho project/data người dùng; `index.json` là index có thể tự dựng lại từ thư mục project.
- IndexedDB trong `handles-db` dùng để nhớ directory handles/permissions, không phải nơi lưu toàn bộ project/timeline hiện tại.
- OPFS và cache workspace được dùng cho binary/cache phù hợp; nhiều cache có thể sinh lại. Xem module cụ thể trước khi xóa hoặc thay đổi lifecycle.
- Media có thể được link tới file bên ngoài hoặc lưu/copy theo flow import; kiểm tra `media-source.ts`, `media.ts` và media-library services trước khi suy luận một import luôn copy (hoặc luôn link) file.
- Có migration workspace version riêng (hiện path constants ghi workspace schema `2.0`) và migration project schema riêng. Đừng đánh đồng hai version này.
- File handle không serialize thẳng vào project JSON; registry IndexedDB gắn lại handle theo id.

### 5.4 Timeline, preview và render

- Thời gian edit được biểu diễn theo frame: item thường có `from` và `durationInFrames`; source frame fields có `sourceStart`, `sourceEnd`, `sourceFps`. Giữ đúng ranh giới frame khi viết trim/split/ripple math; không thay bằng float seconds nếu logic là frame-based.
- `ProjectTimeline` chứa tracks/items và các trường timeline-level; các item có type-specific fields (video/audio/text/image/shape/composition...). Timeline còn hỗ trợ nhiều composition/sequence; type chi tiết là source of truth.
- Playback state tần số cao (playhead/playing/shuttle) được chia khỏi các state chỉnh sửa để hạn chế rerender rộng. Khi sửa preview sync, đọc store và test của preview trước khi đổi subscription.
- Runtime composition được dùng để đánh giá scene theo thời gian. Preview ưu tiên độ trễ tương tác; export chạy pipeline theo frame để tạo kết quả hoàn chỉnh.
- Export chủ yếu ở `src/features/export/`; [`canvas-render-orchestrator.ts`](src/features/export/utils/canvas-render-orchestrator.ts) điều phối video/audio encode và render helpers. Đừng tạo renderer thứ hai nếu có thể dùng pipeline hiện hữu.
- WebGPU/WebCodecs/Workers là các API quan trọng. Dev server và preview cấu hình COOP/COEP; deployment/server thay đổi header có thể làm hỏng tính năng cần cross-origin isolation/SharedArrayBuffer.
- Khi quản lý WebGPU resource, để ý ownership/dispose/texture pooling; leak có thể chỉ lộ sau preview/export dài.

### 5.5 Headless API

`headless.html` nạp `src/headless/main.ts`; entry này expose `window.freecut` cho driver Node/Playwright. Media được driver cung cấp qua URL và seed vào media resolver; harness không cần mount workspace gate. Source `src/headless/` gồm API và validation/edit logic phía browser; thư mục root `headless/` gồm CLI/server/tests.

Khi sửa composition/export behavior, xem xét cả web export và headless contract tests, vì harness cố ý tái sử dụng renderer thật.

## 6. Mô hình dữ liệu và state

### Project và timeline

- `Project` giữ identity, tên, timestamps, schema version, metadata canvas/FPS và `ProjectTimeline`.
- `ProjectTimeline` chứa tracks/items, compositions/sequences, transitions, keyframes/markers và project-level audio/timeline settings (xem type hiện tại).
- `TimelineItem` được union theo type; dùng discriminant `item.type` thay vì giả định mọi item có `src`/`mediaId`.
- `mediaId` là liên kết tới media metadata/source trong workspace; `src` thường là URL/resource phục vụ phiên render và không được xem là định danh bền.
- Track, clip, composition, transition, keyframe và export schemas liên quan nằm dưới [`src/types/`](src/types/).

### Timeline state

Facade `useTimelineStore` tạo API kết hợp cho component nhưng không có nghĩa toàn bộ state nằm trong một Zustand store nguyên khối. Stores theo domain nằm ở `src/features/timeline/stores/`; command/history và action modules xử lý mutation có thể undo/redo. UI/preview state bổ sung ở `src/shared/state/` và các feature stores. Trước khi thêm state, tìm store tương ứng để không tạo duplicate source of truth.

### Migrations

`migrateProject()` chạy versioned migrations theo thứ tự rồi normalization ở mỗi lần load. Schema cũ thiếu `schemaVersion` được xem là v1. Thêm field bền vững cần cân nhắc default, normalization, migration nếu breaking, backward compatibility và tests fixtures.

## 7. Quy tắc kiến trúc cần tuân thủ

Các rule này được thực thi bằng scripts, không chỉ là khuyến nghị:

1. **Không import trực tiếp feature khác từ trong feature.** `src/features/<A>` không import trực tiếp `src/features/<B>` ngoài seam được phép.
2. **Dependency xuyên feature đi qua adapter.** Đặt contract có phụ thuộc feature trong `src/features/<owner>/deps/*-contract.ts`; adapter không-contract re-export API cho code còn lại. Quy tắc chính xác được kiểm bởi [`scripts/check-feature-boundaries.mjs`](scripts/check-feature-boundaries.mjs) và [`scripts/check-deps-contract-boundaries.mjs`](scripts/check-deps-contract-boundaries.mjs).
3. **Không dùng legacy `@/lib/*`.** Code platform/shared hiện ở `@/infrastructure/*` hoặc `@/shared/*`; kiểm tra `npm run check:legacy-lib-imports`.
4. **Feature không phải nơi đặt code platform generic.** Storage/GPU/browser/audio primitives thuộc infrastructure; shared logic generic thuộc shared.
5. **Generated route tree không chỉnh tay.** Chạy `npm run routes`.
6. **Tránh import cycle/chunk cycle.** `vite.config.ts` có manual chunk boundaries vì từng có production TDZ issue; nếu đổi import graph/chunking, kiểm tra build production chứ không chỉ HMR dev.
7. Dùng `@/` alias (`src/`) theo convention; TypeScript strict, `noUncheckedIndexedAccess` bật.

Nếu cần thêm dependency giữa feature: xem adapter/contract lân cận, rồi chạy boundary checks và edge-budget check. Không giải quyết bằng cách import thẳng cho “nhanh”.

## 8. Giao diện và localization

- Định hướng “The Quiet Instrument”: dark graphite, orange signal color dùng có chủ đích, màu clip/marker mang nghĩa, mật độ cao nhưng dễ đọc.
- Tham khảo [`DESIGN.md`](DESIGN.md), token/style ở [`src/index.css`](src/index.css) và timeline styles riêng.
- UI dùng React, Tailwind CSS v4, Radix primitives và component wrappers tại `src/components/ui/`.
- Dùng i18n, không hardcode chuỗi user-facing mới. Cấu hình tại `src/i18n/`, locale JSON dưới `src/i18n/locales/`; kiểm tra lazy locale/resource pattern trước khi thêm key.
- Hotkeys/layout/workspace presets tập trung trong `src/config/`; editor shortcut phải tôn trọng input/contenteditable và conventions đang có.

## 9. Test và kiểm tra thay đổi

Vitest/Vite+ test config nằm trong [`vite.config.ts`](vite.config.ts), setup tại `src/test/setup.ts`; unit/component tests thường đặt cạnh module dưới dạng `*.test.ts(x)`. Headless contracts chạy Node/Playwright riêng.

Kiểm tra nhanh theo loại thay đổi:

| Thay đổi | Tối thiểu nên chạy |
| --- | --- |
| Component/utility nhỏ | Test tương ứng + `npm run check` |
| Timeline edit/state/persistence | Test liên quan trong `src/features/timeline/`, boundary checks và `npm run check` |
| Workspace/storage/schema | Test trong `src/infrastructure/storage/` + migration tests + project load/save tests |
| Preview/playback sync | Test preview sync; cân nhắc `npm run test:preview-sync:stress` |
| Composition/export | Test export/runtime + `npm run build`; cân nhắc headless contracts |
| GPU effect/transition | Pipeline tests/build; real-GPU probe/manual test cần hardware có WebGPU |
| Route | `npm run routes`, `npm run check`, test route/error behavior |
| UI copy/locales | i18n tests/consistency + `npm run check` |

Full quality suite:

```bash
npm run verify
```

CI quality path dùng Node 22, cài bằng Vite+ (`vp install`), chạy boundary/contract/legacy/dependency checks, `vp run check`, tests có coverage floor, build và portable headless suite. CI không có portable real WebGPU adapter; real-GPU effects là bước kiểm tra riêng. `verify` có thêm các checks dead-code/edge-budget và portable headless contracts như được khai báo trong `package.json`.

Các lệnh chuyên biệt khác gồm `npm run headless:test:node`, `npm run headless:test:chrome`, `npm run headless:test:media`, `npm run headless:gpu:probe` và `npm run test:preview-sync:stress`.

## 10. Hướng dẫn tìm nơi sửa theo triệu chứng

- **URL/page sai hoặc loader lỗi** → `src/routes/`, `src/app/route-error*`, rồi route tests.
- **Workspace không mở/permission mất** → `workspace-gate`, `handles-db.ts`, `workspace-fs/root.ts`, `fs-primitives.ts`.
- **Project không hiện hoặc không save** → `workspace-fs/projects.ts`, `workspace-index.ts`, timeline persistence, migration/normalization.
- **Media thiếu/offline/không decode** → media-library services/resolver, `infrastructure/browser/`, metadata/source storage.
- **Timeline edit sai frame hoặc undo/redo lỗi** → timeline actions/domain stores/command store, frame/source calculations và các tests tương ứng.
- **Scrub/playback giật, preview frame cũ** → preview feature, player clock/video modules, playback/preview bridge stores; đọc sync/stress tests.
- **Preview đúng nhưng export sai** → composition runtime, timeline-to-composition và export renderer/audio path; so sánh headless contract.
- **Effect/transition GPU lỗi** → registry, shader/pipeline infrastructure, compositing order và GPU test helpers.
- **Model AI không load/chậm** → feature worker/service + `infrastructure/analysis`, `llm`, model cache/provider registry; kiểm tra cancellation và worker lifecycle.
- **Build production lỗi nhưng dev chạy** → chunk cycle/manualChunks, lazy import, route split và `npm run build`.

## 11. Tài liệu và cấu hình tham khảo

- [`README.md`](README.md): user-facing overview, feature list, setup/browser support và lệnh development.
- [`PRODUCT.md`](PRODUCT.md): product intent, user, priorities và principles.
- [`DESIGN.md`](DESIGN.md): visual design system.
- [`docs/project-deep-analysis.md`](docs/project-deep-analysis.md): phân tích kiến trúc bằng tiếng Việt; dùng như tài liệu tham khảo và xác minh các chi tiết với source hiện tại.
- [`docs/render-frame-decomposition-plan.md`](docs/render-frame-decomposition-plan.md): kế hoạch/thiết kế decomposition render frame.
- [`docs/plan_convert/`](docs/plan_convert/): roadmap chuyển đổi native; không đồng nghĩa Rust GUI đã có các tính năng trong roadmap.
- [`package.json`](package.json), [`vite.config.ts`](vite.config.ts), [`tsconfig.json`](tsconfig.json), [`tsr.config.json`](tsr.config.json): scripts/tooling/build/type/routing config.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): CI thực tế.
- [`.cursorrules`](.cursorrules): code-review-graph workflow của project; nếu môi trường có các MCP graph tools, dùng graph trước để thu hẹp phạm vi rồi luôn xác minh source/tests. Khi tools không khả dụng, tìm kiếm/đọc source trực tiếp.

## 12. Checklist trước khi kết thúc một thay đổi

- [ ] Đã xác định đúng target/module (web, Electron, headless hay Rust GUI).
- [ ] Đã đọc implementation và tests ở luồng bị ảnh hưởng.
- [ ] Không tạo direct cross-feature import hoặc legacy `@/lib/*` import.
- [ ] Nếu đổi dữ liệu lưu: đã xét migration, normalization, backward compatibility và cache/object URL lifecycle.
- [ ] Nếu đổi time/edit: đã giữ frame math, source range và undo/redo semantics.
- [ ] Đã cập nhật locale/tests/docs có liên quan.
- [ ] Đã chạy check/test/build phù hợp; ghi rõ những gì chưa chạy.
