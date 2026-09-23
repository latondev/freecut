# FreeCut Native GUI

Đây là native desktop shell song song với web app hiện tại.

## Chạy

```powershell
cd GUI
cargo run
```

Nếu máy chưa có Rust/Cargo dependencies, cài Rust stable trước rồi chạy lệnh trên.

## Hiện có

- Rust binary + Slint UI;
- native window shell;
- dark design tokens;
- custom title bar;
- create/open/save project JSON tối thiểu;
- native import file picker;
- theme toggle;
- workspace gồm Media, Preview, Timeline, Inspector;
- các boundary callback để nối domain model ở phase sau.

## Chưa có

- decode/playback thật;
- timeline editing thật;
- GPU compositor;
- export pipeline;
- effects/transitions;
- transcription/AI.

Các phần này nằm trong roadmap ở `../docs/plan_convert/04-phases-and-mvp.md`.
