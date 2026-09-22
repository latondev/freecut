# 3. Mapping web → native

## 3.1. UI framework

| Web hiện tại | Native đích | Ghi chú |
|---|---|---|
| React/TSX | Slint `.slint` | Component declarative, callback typed |
| React props | Slint properties | Chỉ dùng cho view state |
| React context/store | Rust `Studio`/model | Rust là source of truth |
| React event handler | Slint callback → Rust message | Không gọi engine trực tiếp từ UI |
| CSS tokens | Slint theme tokens | Màu, spacing, typography tập trung |
| CSS layout | Slint layout + Rust dock tree | Dock tree không hard-code trong UI |
| React modal portal | Root dialog layer | Modal nằm ở App root |

## 3.2. Browser runtime

| Web | Native |
|---|---|
| File input | `rfd::FileDialog` |
| Drag/drop browser event | winit/Slint drop event |
| OPFS | native app data/cache directory |
| IndexedDB | SQLite hoặc JSON/project directory |
| Web Worker | Rust thread/Rayon/Tokio task |
| `fetch` asset/model | reqwest hoặc downloader native có progress |
| `localStorage` | preferences JSON/TOML |
| `URL.createObjectURL` | native path/asset handle |
| browser clipboard | platform clipboard crate/Slint support |
| browser notifications | toast/native notification sau này |

## 3.3. Media pipeline

### Probe/import

Web implementation có thể dùng browser metadata hoặc worker. Native cần một API ổn định:

```rust
trait MediaProbe {
    fn probe(path: &Path) -> Result<MediaInfo>;
}
```

### Decode

Chọn một trong các hướng sau sau benchmark:

- FFmpeg/libav: coverage codec rộng, phù hợp editor;
- GStreamer: pipeline mạnh, packaging phức tạp hơn;
- native decoder theo platform: tối ưu nhưng khó đồng nhất.

MVP nên chọn một backend chính và có capability report thay vì cố hỗ trợ mọi backend đồng thời.

### Preview

Browser canvas/video element được thay bằng:

```text
decoder → decoded frame → compositor → GPU texture → Slint image/viewport
```

### Waveform/filmstrip

Chuyển từ worker JS sang Rust job cacheable. Cache key gồm asset fingerprint, range và resolution mục tiêu.

## 3.4. Storage và cache

Cache không được nằm lẫn trong project source. Cần phân biệt:

- project data: có thể backup/di chuyển;
- derived cache: xóa và tạo lại được;
- user preferences: theo app/user;
- downloaded models: theo app data và có quản lý dung lượng.

## 3.5. AI/transcription/TTS

Không port worker TypeScript từng file. Chuẩn hóa thành job API:

```rust
struct JobProgress {
    job_id: JobId,
    fraction: Option<f32>,
    message: String,
}

enum AiJob {
    Transcribe(TranscribeRequest),
    Synthesize(SpeechRequest),
    Upscale(UpscaleRequest),
}
```

Model download, cancel, retry và cleanup phải là native service, không gắn vào lifecycle của component UI.

## 3.6. Compatibility với web app

Trong thời gian migration:

- giữ export project từ web;
- native đọc được format web hoặc có converter rõ ràng;
- tạo fixture project đại diện cho các tính năng chính;
- không đổi schema âm thầm;
- nếu native không hỗ trợ feature, giữ dữ liệu unknown để không làm mất khi save lại.
