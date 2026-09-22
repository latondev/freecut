# 6. Rủi ro, testing và release

## 6.1. Rủi ro chính

### Rewrite quá lớn

Giải pháp: phase nhỏ, mỗi phase có binary chạy được; giữ web app và project fixtures.

### Codec/FFmpeg packaging

Giải pháp: chốt capability matrix, bundle backend hợp pháp, test clean machine và báo codec unsupported rõ ràng.

### GPU driver không ổn định

Giải pháp: CPU/software fallback, adapter diagnostics, feature flag GPU path, test integrated GPU.

### Slint binding phình to

Giải pháp: chia UI theo feature, không dồn hàng trăm callback vào một file, dùng model struct và message enum.

### Data loss khi migration

Giải pháp: schema version, atomic save, backup, unknown field preservation, migration fixtures.

### UI mượt nhưng export sai

Giải pháp: golden media fixtures, frame hash/visual comparison, audio duration checks và export integration test.

### Worker race/stale result

Giải pháp: job ID, generation token, cancellation, không apply kết quả nếu asset/project version đã thay đổi.

## 6.2. Test layers

### Unit test

- time/frame conversion;
- trim boundaries;
- snapping;
- command apply/undo/redo;
- project schema/migration;
- dock tree invariants;
- cache key;
- path normalization.

### Integration test

- open/save fixture;
- import/probe fixture;
- preview request/cancel;
- export/cancel/retry;
- missing media;
- corrupted project recovery.

### UI test

- keyboard shortcuts;
- focus/blur;
- modal close;
- pane split/resize/restore;
- timeline selection/drag/trim;
- error/toast/progress states.

### Performance test

- cold startup;
- first frame;
- seek latency;
- frame delivery under scrub;
- timeline with many clips;
- memory after long session;
- export throughput;
- GPU vs CPU fallback.

## 6.3. Golden fixtures

Tạo fixture tối thiểu:

```text
fixtures/
├── empty-project
├── short-video
├── mixed-video-audio-image
├── many-clips
├── missing-media
├── legacy-project
└── unsupported-codec
```

Fixture phải được version control nếu kích thước cho phép hoặc có script tạo deterministic.

## 6.4. Release channels

- `dev`: debug logs, CPU/GPU diagnostics, unsafe experimental features.
- `preview`: native beta, telemetry/log bundle tùy chính sách.
- `stable`: signed installer, migration backup, rollback guidance.

## 6.5. Definition of Done cho feature native

Một feature chỉ được coi là hoàn thành khi:

- có domain model/command nếu feature có mutation;
- có UI state cho empty/loading/busy/error;
- không block UI thread;
- có cancel hoặc retry nếu là job dài;
- có undo/redo nếu là edit;
- có test cho happy path và failure path;
- có log đủ để chẩn đoán;
- hoạt động với project fixture;
- không phá web/native project compatibility ngoài phạm vi đã ghi.

## 6.6. Rollback strategy

Trong migration:

- web app tiếp tục là fallback;
- native đọc schema cũ nhưng không ghi đè nếu chưa chắc tương thích;
- mỗi schema migration có backup;
- feature GPU có CPU fallback;
- native beta có thể mở project read-only nếu feature chưa hỗ trợ;
- không xóa worker/web implementation cho tới khi native có parity và benchmark đạt.
