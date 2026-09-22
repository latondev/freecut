# 2. Target architecture

## 2.1. Workspace Rust đề xuất

```text
crates/
├── freecut-app          # binary, lifecycle, startup, logging
├── freecut-ui           # Slint integration và binding Rust
├── freecut-core         # domain types, IDs, time/frame primitives
├── freecut-project      # project schema, persistence, migrations
├── freecut-command      # commands, history, undo/redo
├── freecut-media        # probe, decode, thumbnails, waveform
├── freecut-render       # preview compositor, GPU resources
├── freecut-export       # render/export jobs
├── freecut-effects      # effects, transitions, manifests
├── freecut-ai           # transcription, TTS, optional models
└── freecut-platform     # paths, dialogs, window integration
```

Không bắt buộc tạo đủ crate ngay từ ngày đầu. Có thể bắt đầu bằng `freecut-app`, `freecut-ui`, `freecut-core`, `freecut-project`, `freecut-command`; tách crate khi boundary đã rõ.

## 2.2. UI tree

```text
App
├── TitleBar
├── StartScreen
├── Workspace
│   ├── Dock
│   │   ├── MediaPane
│   │   ├── PreviewPane
│   │   ├── InspectorPane
│   │   ├── TimelinePane
│   │   └── Config/DetailsPane
│   └── PaneSplitters
├── MenuLayer
├── DialogLayer
└── ToastLayer
```

Dock tree nên sống trong Rust vì Rust dễ bảo toàn invariant khi split, remove, reorder và restore layout. Slint nhận danh sách `Seat`/`Divider` đã được flatten để vẽ.

## 2.3. Core data model tối thiểu

```text
Project
├── metadata
├── assets: MediaAsset[]
├── timelines: Timeline[]
└── settings

Timeline
├── tracks: Track[]
├── duration
├── frame_rate
└── resolution

Track
└── clips: Clip[]

Clip
├── asset_id
├── source_range
├── timeline_range
├── transform
├── audio_properties
├── visual_properties
├── effects
└── keyframes
```

Tất cả object quan trọng cần stable ID. Không dùng array index làm identity lâu dài.

## 2.4. Data flow

```text
Pointer/keyboard trong Slint
        ↓
Typed callback/message
        ↓
Studio dispatcher
        ↓
Command validation
        ↓
Project mutation + history
        ↓
Job scheduler nếu cần media work
        ↓
Publish view models
        ↓
Slint ModelRc / properties
```

Ví dụ:

```text
drag clip
→ ClipDragStarted
→ preview position trong UI
→ ClipMoveRequested
→ MoveClip command
→ project cập nhật
→ undo snapshot
→ publish timeline
```

Preview drag có thể dùng transient interaction state; chỉ tạo command khi release để history không bị hàng trăm bước nhỏ.

## 2.5. Threading model

- UI thread: Slint event loop, state mutation ngắn, publish model.
- Media workers: decode, probe, thumbnails, waveform, proxy.
- Render worker/GPU queue: compositor và frame preparation.
- Export worker: render/export pipeline.
- AI workers: transcription/TTS/upscale tùy model.

Mọi worker cần:

- job ID;
- cancellation token;
- progress event;
- error event;
- generation/version để bỏ qua kết quả cũ;
- không truy cập trực tiếp UI object.

## 2.6. Project persistence

Đề xuất:

```text
project.freecut/
├── project.json
├── assets.json hoặc asset metadata trong project.json
├── cache/
│   ├── thumbnails/
│   ├── waveforms/
│   └── proxies/
└── backups/
```

Project schema cần:

- `schema_version`;
- app version;
- relative path ưu tiên absolute path;
- asset fingerprint/metadata;
- migration từ version cũ;
- autosave tạm;
- atomic write;
- backup trước khi overwrite.

## 2.7. Rendering strategy

Giai đoạn đầu có thể dùng CPU/software fallback để hoàn thiện behavior. Sau đó tích hợp wgpu:

1. preview texture;
2. compositor layer;
3. transform/effect shader;
4. timeline/monitor synchronization;
5. shared device với GUI renderer nếu framework hỗ trợ ổn định.

Không gắn toàn bộ MVP vào shared GPU device trước khi có test trên Windows GPU phổ biến, integrated GPU và software adapter.
