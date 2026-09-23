//! FreeCut native desktop shell.

slint::include_modules!();

mod command;
mod export;
mod model;
mod preview;
mod storage;

use command::{
    AddAssetCommand, AddClipCommand, HistoryManager, RemoveAssetCommand, RemoveClipCommand,
    SplitClipCommand, UpdateClipPropertiesCommand,
};
use export::{ExportConfig, ExportEngine, ExportFormat};
use model::{Clip, ClipEffects, ClipId, MediaAsset, Project, Track, TrackKind};
use preview::PreviewCompositor;
use serde::{Deserialize, Serialize};
use slint::{ModelRc, VecModel};
use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use storage::{load_project_from_file, save_project_to_file};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Preferences {
    dark: bool,
    last_project: Option<String>,
    #[serde(default = "default_media_width")]
    media_width: f32,
    #[serde(default = "default_inspector_width")]
    inspector_width: f32,
    #[serde(default = "default_timeline_height")]
    timeline_height: f32,
    #[serde(default = "default_true")]
    show_media: bool,
    #[serde(default = "default_true")]
    show_inspector: bool,
}

fn default_media_width() -> f32 {
    276.0
}
fn default_inspector_width() -> f32 {
    292.0
}
fn default_timeline_height() -> f32 {
    280.0
}
fn default_true() -> bool {
    true
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            dark: true,
            last_project: None,
            media_width: default_media_width(),
            inspector_width: default_inspector_width(),
            timeline_height: default_timeline_height(),
            show_media: default_true(),
            show_inspector: default_true(),
        }
    }
}

fn log_event(level: &str, message: &str) {
    println!("[{level}] {message}");
    if let Some(mut path) = preferences_path() {
        path.set_file_name("freecut.log");
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            use std::io::Write;
            let _ = writeln!(file, "[{level}] {message}");
        }
    }
}

#[derive(Default)]
struct ExportRuntimeState {
    progress: f32,
    status_text: String,
    error: String,
}

#[derive(Clone)]
struct AppState {
    app: slint::Weak<App>,
    preferences: Rc<RefCell<Preferences>>,
    project_path: Rc<RefCell<Option<PathBuf>>>,
    project: Rc<RefCell<Project>>,
    history: Rc<RefCell<HistoryManager>>,
    playhead_frame: Rc<RefCell<u64>>,
    timeline_zoom: Rc<RefCell<f32>>,
    selected_clip_id: Rc<RefCell<Option<ClipId>>>,
    is_playing: Rc<RefCell<bool>>,
    is_looping: Rc<RefCell<bool>>,
    aspect_ratio: Rc<RefCell<String>>,
    compositor: Rc<RefCell<PreviewCompositor>>,
    export_config: Rc<RefCell<ExportConfig>>,
    cancel_token: Arc<AtomicBool>,
    is_exporting: Arc<AtomicBool>,
    export_completed: Arc<AtomicBool>,
    export_runtime: Arc<std::sync::Mutex<ExportRuntimeState>>,
}


fn format_timecode(frame: u64, fps: f64) -> String {
    let fps = if fps <= 0.0 { 30.0 } else { fps };
    let total_secs = (frame as f64 / fps) as u64;
    let rem_frames = (frame as f64 % fps) as u64;
    let hours = total_secs / 3600;
    let mins = (total_secs % 3600) / 60;
    let secs = total_secs % 60;
    format!("{:02}:{:02}:{:02}:{:02}", hours, mins, secs, rem_frames)
}

fn show_toast(app: &App, message: &str, kind: &str) {
    app.set_toast_message(message.into());
    app.set_toast_kind(kind.into());
    app.set_show_toast(true);
}

fn mutate_selected_clip<F>(state: &AppState, mutator: F, desc: &str)
where
    F: FnOnce(&mut Clip),
{
    let selected_id = state.selected_clip_id.borrow().clone();
    let Some(clip_id) = selected_id else { return };

    let mut old_opt = None;
    let mut new_opt = None;

    {
        let mut project = state.project.borrow_mut();
        for track in &mut project.tracks {
            if let Some(clip) = track.clips.iter_mut().find(|c| c.id == clip_id) {
                let ot = clip.transform.clone();
                let oe = clip.effects.clone();
                let oa = clip.audio.clone();
                let os = clip.speed;

                mutator(clip);

                old_opt = Some((ot, oe, oa, os));
                new_opt = Some((
                    clip.transform.clone(),
                    clip.effects.clone(),
                    clip.audio.clone(),
                    clip.speed,
                ));
                break;
            }
        }
    }

    if let (Some((ot, oe, oa, os)), Some((nt, ne, na, ns))) = (old_opt, new_opt) {
        let cmd = UpdateClipPropertiesCommand::new(
            clip_id,
            ot,
            nt,
            oe,
            ne,
            oa,
            na,
            os,
            ns,
        );
        let mut proj = state.project.borrow_mut();
        let mut hist = state.history.borrow_mut();
        let _ = hist.execute(Box::new(cmd), &mut proj);
    }

    sync_ui(state);
    if let Some(app) = state.app.upgrade() {
        show_toast(&app, desc, "info");
    }
}

fn sync_ui(state: &AppState) {

    let Some(app) = state.app.upgrade() else {
        return;
    };
    let project = state.project.borrow();
    let history = state.history.borrow();
    let zoom = *state.timeline_zoom.borrow();
    let playhead = *state.playhead_frame.borrow();
    let selected_id = state.selected_clip_id.borrow().clone();

    app.set_project_name(project.name.clone().into());
    app.set_is_dirty(history.is_dirty());
    app.set_can_undo(history.can_undo());
    app.set_can_redo(history.can_redo());
    app.set_clip_count(project.total_clips() as i32);

    let media_names: Vec<slint::SharedString> = project
        .assets
        .iter()
        .map(|a| {
            if a.is_missing {
                format!("{} [MISSING]", a.name).into()
            } else {
                a.name.clone().into()
            }
        })
        .collect();
    app.set_media_items(ModelRc::from(Rc::new(VecModel::from(media_names))));

    let clip_names: Vec<slint::SharedString> = project
        .tracks
        .iter()
        .flat_map(|t| &t.clips)
        .map(|c| c.name.clone().into())
        .collect();
    app.set_timeline_clips(ModelRc::from(Rc::new(VecModel::from(clip_names))));

    // Phase 3 Tracks Visual
    let tracks_visual: Vec<TrackVisual> = project
        .tracks
        .iter()
        .map(|t| TrackVisual {
            id: t.id.0.clone().into(),
            name: t.name.clone().into(),
            is_video: t.kind == TrackKind::Video,
            locked: t.locked,
            muted: t.muted,
        })
        .collect();
    app.set_timeline_tracks(ModelRc::from(Rc::new(VecModel::from(tracks_visual))));

    // Phase 3 Clips Visual
    let mut clips_visual: Vec<ClipVisual> = Vec::new();
    let mut found_selected_clip: Option<(Clip, String)> = None;

    for (t_idx, track) in project.tracks.iter().enumerate() {
        for clip in &track.clips {
            let is_sel = selected_id.as_ref() == Some(&clip.id);
            if is_sel {
                found_selected_clip = Some((clip.clone(), track.name.clone()));
            }
            let start_px = (clip.timeline_start as f32 * zoom) as f32;
            let width_px = ((clip.timeline_duration as f32 * zoom).max(36.0)) as f32;

            clips_visual.push(ClipVisual {
                id: clip.id.0.clone().into(),
                name: clip.name.clone().into(),
                track_index: t_idx as i32,
                start_px: start_px.into(),
                width_px: width_px.into(),
                timeline_start: clip.timeline_start as i32,
                timeline_duration: clip.timeline_duration as i32,
                is_video: track.kind == TrackKind::Video,
                is_selected: is_sel,
            });
        }
    }
    app.set_visual_clips(ModelRc::from(Rc::new(VecModel::from(clips_visual))));

    // Playhead & Timecode
    let timecode = format_timecode(playhead, project.metadata.fps);
    let playhead_px = (playhead as f32 * zoom) as f32;
    app.set_playhead_frame(playhead as i32);
    app.set_playhead_timecode(timecode.into());
    app.set_playhead_px(playhead_px.into());

    // Timeline Zoom
    app.set_timeline_zoom(zoom);
    let zoom_pct = (zoom / 1.5 * 100.0).round() as i32;
    app.set_timeline_zoom_text(format!("{zoom_pct}%").into());

    // Inspector dynamic binding
    if let Some((clip, track_name)) = found_selected_clip {
        app.set_has_selected_clip(true);
        app.set_selected_clip_name(clip.name.clone().into());
        app.set_selected_clip_track(track_name.into());
        app.set_selected_clip_start(clip.timeline_start as i32);
        app.set_selected_clip_duration(clip.timeline_duration as i32);
        app.set_selected_clip(clip.name.into());

        // Phase 6 & 7: Sync clip properties
        app.set_clip_scale(clip.transform.scale);
        app.set_clip_pos_x(clip.transform.pos_x);
        app.set_clip_pos_y(clip.transform.pos_y);
        app.set_clip_rotation(clip.transform.rotation);
        app.set_clip_opacity(clip.transform.opacity);
        app.set_clip_speed(clip.speed);
        app.set_clip_volume_db(clip.audio.volume_db);
        app.set_clip_muted(clip.audio.muted);
        app.set_clip_brightness(clip.effects.brightness);
        app.set_clip_contrast(clip.effects.contrast);
        app.set_clip_saturation(clip.effects.saturation);
        app.set_clip_grayscale(clip.effects.grayscale);
        app.set_clip_invert(clip.effects.invert);
    } else {
        app.set_has_selected_clip(false);
        app.set_selected_clip_name("Nothing selected".into());
        app.set_selected_clip("Nothing selected".into());
    }

    app.set_autosave_status(if history.is_dirty() {
        "Unsaved changes".into()
    } else {
        "Saved".into()
    });


    // Phase 4 Preview & Playback state sync
    let total_duration = {
        let comp = state.compositor.borrow();
        let pixel_buffer = comp.render_frame(&project, playhead);
        let preview_image = slint::Image::from_rgba8(pixel_buffer);
        app.set_preview_frame(preview_image);
        app.set_has_preview_frame(true);
        comp.total_duration_frames(&project)
    };

    app.set_is_playing(*state.is_playing.borrow());
    app.set_is_looping(*state.is_looping.borrow());
    app.set_aspect_ratio(state.aspect_ratio.borrow().clone().into());
    let total_timecode = format_timecode(total_duration, project.metadata.fps);
    app.set_total_duration_timecode(total_timecode.into());

    // Phase 5 Export state sync
    let exp_cfg = state.export_config.borrow();
    app.set_export_preset(exp_cfg.preset.clone().into());
    app.set_export_resolution(exp_cfg.resolution_str().into());
    app.set_export_fps(exp_cfg.fps_str().into());
    app.set_export_format(exp_cfg.format.display_name().into());
    app.set_export_output_path(exp_cfg.output_path.display().to_string().into());
    app.set_is_exporting(state.is_exporting.load(Ordering::Relaxed));
    app.set_export_completed(state.export_completed.load(Ordering::Relaxed));
    if let Ok(rt) = state.export_runtime.lock() {
        app.set_export_progress(rt.progress);
        app.set_export_status_text(rt.status_text.clone().into());
        app.set_export_error(rt.error.clone().into());
    }
}

fn main() -> Result<(), slint::PlatformError> {
    log_event("INFO", "FreeCut desktop starting up (Phase 5 Export MVP)");
    if std::env::args().any(|a| a == "--snapshot") {
        std::env::set_var("SLINT_BACKEND", "winit-software");
    }
    let app = App::new()?;
    let prefs = load_preferences();
    log_event(
        "INFO",
        &format!(
            "Loaded preferences: dark={}, media_w={}, insp_w={}, time_h={}",
            prefs.dark, prefs.media_width, prefs.inspector_width, prefs.timeline_height
        ),
    );

    let mut initial_project = Project::new("Untitled project");
    let v_track_id = initial_project.tracks[0].id.clone();
    let a_track_id = initial_project.tracks[1].id.clone();

    // Default sample clips for immediate interactive visual editing
    let clip1 = Clip::new(None, "01_Intro_Video.mp4".into(), v_track_id, 0, 150);
    let clip2 = Clip::new(None, "02_Broll_Scene.mp4".into(), initial_project.tracks[0].id.clone(), 150, 180);
    let clip3 = Clip::new(None, "Audio_Soundtrack.mp3".into(), a_track_id, 0, 330);
    initial_project.tracks[0].clips.push(clip1);
    initial_project.tracks[0].clips.push(clip2);
    initial_project.tracks[1].clips.push(clip3);

    initial_project.assets.push(MediaAsset::from_path(PathBuf::from("01_Intro_Video.mp4")));
    initial_project.assets.push(MediaAsset::from_path(PathBuf::from("02_Broll_Scene.mp4")));
    initial_project.assets.push(MediaAsset::from_path(PathBuf::from("Audio_Soundtrack.mp3")));


    let state = AppState {
        app: app.as_weak(),
        preferences: Rc::new(RefCell::new(prefs.clone())),
        project_path: Rc::new(RefCell::new(None)),
        project: Rc::new(RefCell::new(initial_project)),
        history: Rc::new(RefCell::new(HistoryManager::new())),
        playhead_frame: Rc::new(RefCell::new(0)),
        timeline_zoom: Rc::new(RefCell::new(1.5)),
        selected_clip_id: Rc::new(RefCell::new(None)),
        is_playing: Rc::new(RefCell::new(false)),
        is_looping: Rc::new(RefCell::new(false)),
        aspect_ratio: Rc::new(RefCell::new("16:9".to_string())),
        compositor: Rc::new(RefCell::new(PreviewCompositor::default())),
        export_config: Rc::new(RefCell::new(ExportConfig::default())),
        cancel_token: Arc::new(AtomicBool::new(false)),
        is_exporting: Arc::new(AtomicBool::new(false)),
        export_completed: Arc::new(AtomicBool::new(false)),
        export_runtime: Arc::new(std::sync::Mutex::new(ExportRuntimeState {
            progress: 0.0,
            status_text: "Ready to export".to_string(),
            error: String::new(),
        })),
    };

    let playback_timer = slint::Timer::default();
    {
        let state = state.clone();
        playback_timer.start(
            slint::TimerMode::Repeated,
            std::time::Duration::from_millis(33),
            move || {
                if *state.is_playing.borrow() {
                    let total_frames = {
                        let proj = state.project.borrow();
                        state.compositor.borrow().total_duration_frames(&proj)
                    };
                    let mut cur = state.playhead_frame.borrow_mut();
                    *cur += 1;
                    if *cur >= total_frames {
                        if *state.is_looping.borrow() {
                            *cur = 0;
                        } else {
                            *cur = total_frames;
                            *state.is_playing.borrow_mut() = false;
                        }
                    }
                    drop(cur);
                    sync_ui(&state);
                }
            },
        );
    }

    app.set_dark(prefs.dark);
    app.set_media_width(prefs.media_width);
    app.set_inspector_width(prefs.inspector_width);
    app.set_timeline_height(prefs.timeline_height);
    app.set_show_media(prefs.show_media);
    app.set_show_inspector(prefs.show_inspector);

    app.set_project_status("Ready".into());
    app.set_workspace_mode("Editor".into());
    app.set_selected_media("Nothing selected".into());
    app.set_selected_clip("Nothing selected".into());

    let panes = vec![
        "Media".into(),
        "Preview".into(),
        "Timeline".into(),
        "Inspector".into(),
    ];
    app.set_panes(ModelRc::from(Rc::new(VecModel::from(panes))));

    sync_ui(&state);

    if std::env::args().any(|a| a == "--test-select") {
        let first_clip_id = state.project.borrow().tracks[0].clips.first().map(|c| c.id.clone());
        *state.selected_clip_id.borrow_mut() = first_clip_id;
        *state.playhead_frame.borrow_mut() = 60;
        sync_ui(&state);
    }

    if let Some(frame_str) = std::env::args()
        .position(|a| a == "--test-frame")
        .and_then(|i| std::env::args().nth(i + 1))
    {
        if let Ok(f) = frame_str.parse::<u64>() {
            *state.playhead_frame.borrow_mut() = f;
            sync_ui(&state);
        }
    }

    if std::env::args().any(|a| a == "--settings") {
        app.set_show_settings_dialog(true);
    }

    if std::env::args().any(|a| a == "--export-dialog") {
        app.set_show_export_dialog(true);
    }

    if std::env::args().any(|a| a == "--test-export-done") {
        app.set_show_export_dialog(true);
        app.set_export_completed(true);
        app.set_export_progress(1.0);
        app.set_export_status_text("Export finished successfully! (330 frames)".into());
    }

    if let Some(tab_name) = std::env::args()
        .position(|a| a == "--tab")
        .and_then(|i| std::env::args().nth(i + 1))
    {
        app.set_inspector_tab(tab_name.into());
    }

    if let Some(toast_msg) = std::env::args()
        .position(|a| a == "--toast")
        .and_then(|i| std::env::args().nth(i + 1))
    {
        show_toast(&app, &toast_msg, "success");
    }


    if let Some(out_path) = std::env::args()
        .position(|a| a == "--export-cli")
        .and_then(|i| std::env::args().nth(i + 1))
    {
        let proj = state.project.borrow().clone();
        let mut cfg = state.export_config.borrow().clone();
        cfg.output_path = PathBuf::from(out_path);
        let cancel = state.cancel_token.clone();
        let res = ExportEngine::export_project(&proj, &cfg, cancel, |p| {
            if p.current_frame % 60 == 0 || p.progress >= 1.0 {
                println!("[EXPORT] {}", p.status);
            }
        });
        match res {
            Ok(frames) => {
                println!("[EXPORT SUCCESS] Exported {frames} frames to {}", cfg.output_path.display());
                return Ok(());
            }
            Err(e) => {
                eprintln!("[EXPORT ERROR] Failed: {e}");
                return Ok(());
            }
        }
    }

    if let Some(target) = std::env::args()
        .position(|a| a == "--snapshot")
        .and_then(|i| std::env::args().nth(i + 1))
    {
        app.window()
            .set_size(slint::LogicalSize::new(1400.0, 900.0));

        app.show()?;
        let snapshot = app.window().take_snapshot()?;
        let width = snapshot.width();
        let height = snapshot.height();
        save_bmp(
            std::path::Path::new(&target),
            width,
            height,
            snapshot.as_bytes(),
        )
        .expect("Failed to write snapshot BMP");
        log_event(
            "INFO",
            &format!("Snapshot written to {target} ({width}x{height})"),
        );
        return Ok(());
    }

    // New Project Callback
    {
        let state = state.clone();
        app.on_new_project(move || {
            let mut new_proj = Project::new("Untitled project");
            let v_track_id = new_proj.tracks[0].id.clone();
            let a_track_id = new_proj.tracks[1].id.clone();
            new_proj.tracks[0].clips.push(Clip::new(None, "01_Intro_Video.mp4".into(), v_track_id.clone(), 0, 150));
            new_proj.tracks[0].clips.push(Clip::new(None, "02_Broll_Scene.mp4".into(), v_track_id, 150, 180));
            new_proj.tracks[1].clips.push(Clip::new(None, "Audio_Soundtrack.mp3".into(), a_track_id, 0, 330));

            new_proj.assets.push(MediaAsset::from_path(PathBuf::from("01_Intro_Video.mp4")));
            new_proj.assets.push(MediaAsset::from_path(PathBuf::from("02_Broll_Scene.mp4")));
            new_proj.assets.push(MediaAsset::from_path(PathBuf::from("Audio_Soundtrack.mp3")));



            *state.project.borrow_mut() = new_proj;
            state.history.borrow_mut().clear();
            state.project_path.borrow_mut().take();
            *state.playhead_frame.borrow_mut() = 0;
            *state.selected_clip_id.borrow_mut() = None;
            *state.is_playing.borrow_mut() = false;
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_selected_media("Nothing selected".into());
                app.set_selected_clip("Nothing selected".into());
                app.set_project_status("New project created with visual tracks".into());
                app.set_has_project(true);
            }
            log_event("INFO", "New project created with default tracks & sample clips");
        });
    }


    // Open Project Callback
    {
        let state = state.clone();
        app.on_open_project(move || {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("FreeCut project", &["freecut", "json"])
                .pick_file()
            {
                open_project(&state, path);
            }
        });
    }

    // Save Project Callback
    {
        let state = state.clone();
        app.on_save_project(move || {
            let path = state.project_path.borrow().clone().or_else(|| {
                rfd::FileDialog::new()
                    .set_file_name("untitled.freecut")
                    .add_filter("FreeCut project", &["freecut"])
                    .save_file()
            });
            if let Some(path) = path {
                save_project(&state, path);
            }
        });
    }

    // Save As Project Callback
    {
        let state = state.clone();
        app.on_save_as_project(move || {
            if let Some(path) = rfd::FileDialog::new()
                .set_file_name("untitled.freecut")
                .add_filter("FreeCut project", &["freecut", "json"])
                .save_file()
            {
                save_project(&state, path);
            }
        });
    }

    // Import Media Callback with Command Dispatcher
    {
        let state = state.clone();
        app.on_import_media(move || {
            let Some(paths) = rfd::FileDialog::new().pick_files() else {
                return;
            };
            let count = paths.len();
            log_event("INFO", &format!("Importing {count} media file(s)"));
            let track_id = state
                .project
                .borrow()
                .tracks
                .first()
                .map(|t| t.id.clone());

            let mut last_name = String::new();
            for path in paths {
                let asset = MediaAsset::from_path(path);
                last_name = asset.name.clone();
                let clip = Clip::new(
                    Some(asset.id.clone()),
                    asset.name.clone(),
                    track_id.clone().unwrap_or_default(),
                    0,
                    asset.duration_frames,
                );
                let _ = state.history.borrow_mut().execute(
                    Box::new(AddAssetCommand::new(asset)),
                    &mut state.project.borrow_mut(),
                );
                if let Some(ref tid) = track_id {
                    let _ = state.history.borrow_mut().execute(
                        Box::new(AddClipCommand::new(clip, tid.clone())),
                        &mut state.project.borrow_mut(),
                    );
                }
            }

            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_selected_media(last_name.into());
                app.set_selected_clip("Nothing selected".into());
                app.set_project_status(format!("Imported {count} media item(s)").into());
                app.set_has_project(true);
            }
        });
    }

    // Undo Callback
    {
        let state = state.clone();
        app.on_undo_action(move || {
            match state
                .history
                .borrow_mut()
                .undo(&mut state.project.borrow_mut())
            {
                Ok(Some(desc)) => {
                    log_event("INFO", &format!("Undo performed: {desc}"));
                    sync_ui(&state);
                    if let Some(app) = state.app.upgrade() {
                        app.set_project_status(format!("Undo: {desc}").into());
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    log_event("ERROR", &format!("Undo failed: {e}"));
                }
            }
        });
    }

    // Redo Callback
    {
        let state = state.clone();
        app.on_redo_action(move || {
            match state
                .history
                .borrow_mut()
                .redo(&mut state.project.borrow_mut())
            {
                Ok(Some(desc)) => {
                    log_event("INFO", &format!("Redo performed: {desc}"));
                    sync_ui(&state);
                    if let Some(app) = state.app.upgrade() {
                        app.set_project_status(format!("Redo: {desc}").into());
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    log_event("ERROR", &format!("Redo failed: {e}"));
                }
            }
        });
    }

    // Delete Clip Callback
    {
        let state = state.clone();
        app.on_delete_clip(move |index| {
            let clip_id = {
                let project = state.project.borrow();
                let all_clips: Vec<_> = project.tracks.iter().flat_map(|t| &t.clips).collect();
                all_clips.get(index as usize).map(|c| c.id.clone())
            };
            if let Some(cid) = clip_id {
                match state.history.borrow_mut().execute(
                    Box::new(RemoveClipCommand::new(cid)),
                    &mut state.project.borrow_mut(),
                ) {
                    Ok(desc) => {
                        log_event("INFO", &format!("Delete clip: {desc}"));
                        sync_ui(&state);
                        if let Some(app) = state.app.upgrade() {
                            app.set_project_status(format!("Deleted clip ({desc})").into());
                        }
                    }
                    Err(e) => {
                        log_event("ERROR", &format!("Delete clip failed: {e}"));
                    }
                }
            }
        });
    }

    // Media Selected Callback
    {
        let state = state.clone();
        app.on_media_selected(move |index| {
            if let Some(app) = state.app.upgrade() {
                let name = state
                    .project
                    .borrow()
                    .assets
                    .get(index as usize)
                    .map(|a| a.name.clone())
                    .unwrap_or_else(|| "Media".into());
                app.set_selected_media(name.clone().into());
                app.set_selected_clip("Nothing selected".into());
                app.set_project_status(format!("Media selected: {name}").into());
            }
        });
    }

    // Clip Selected Callback
    {
        let state = state.clone();
        app.on_clip_selected(move |index| {
            if let Some(app) = state.app.upgrade() {
                let name = state
                    .project
                    .borrow()
                    .tracks
                    .iter()
                    .flat_map(|t| &t.clips)
                    .nth(index as usize)
                    .map(|c| c.name.clone())
                    .unwrap_or_else(|| "Clip".into());
                app.set_selected_clip(format!("Clip • {name}").into());
                app.set_project_status(format!("Clip selected: {name}").into());
                log_event("INFO", &format!("Clip selected: {name}"));
            }
        });
    }

    // Theme Toggle Callback
    {
        let state = state.clone();
        app.on_toggle_theme(move || {
            let mut preferences = state.preferences.borrow_mut();
            preferences.dark = !preferences.dark;
            if let Some(app) = state.app.upgrade() {
                app.set_dark(preferences.dark);
                let msg = if preferences.dark {
                    "Dark theme"
                } else {
                    "Light theme"
                };
                app.set_project_status(msg.into());
                log_event("INFO", &format!("Theme changed to {msg}"));
            }
            save_preferences(&preferences);
        });
    }

    // Layout Changed Callback
    {
        let state = state.clone();
        app.on_layout_changed(move |media_w, insp_w, time_h| {
            let mut preferences = state.preferences.borrow_mut();
            preferences.media_width = media_w;
            preferences.inspector_width = insp_w;
            preferences.timeline_height = time_h;
            save_preferences(&preferences);
        });
    }

    // Reset Layout Callback
    {
        let state = state.clone();
        app.on_reset_layout(move || {
            let mut preferences = state.preferences.borrow_mut();
            preferences.media_width = default_media_width();
            preferences.inspector_width = default_inspector_width();
            preferences.timeline_height = default_timeline_height();
            preferences.show_media = true;
            preferences.show_inspector = true;
            save_preferences(&preferences);
            if let Some(app) = state.app.upgrade() {
                app.set_media_width(preferences.media_width);
                app.set_inspector_width(preferences.inspector_width);
                app.set_timeline_height(preferences.timeline_height);
                app.set_show_media(true);
                app.set_show_inspector(true);
                app.set_project_status("Workspace layout reset".into());
                log_event("INFO", "Dock layout reset to default");
            }
        });
    }

    // Toggle Media Panel
    {
        let state = state.clone();
        app.on_toggle_media(move || {
            let mut preferences = state.preferences.borrow_mut();
            preferences.show_media = !preferences.show_media;
            save_preferences(&preferences);
            if let Some(app) = state.app.upgrade() {
                app.set_show_media(preferences.show_media);
                let status = if preferences.show_media {
                    "Media panel visible"
                } else {
                    "Media panel hidden"
                };
                app.set_project_status(status.into());
                log_event("INFO", status);
            }
        });
    }

    // Toggle Inspector Panel
    {
        let state = state.clone();
        app.on_toggle_inspector(move || {
            let mut preferences = state.preferences.borrow_mut();
            preferences.show_inspector = !preferences.show_inspector;
            save_preferences(&preferences);
            if let Some(app) = state.app.upgrade() {
                app.set_show_inspector(preferences.show_inspector);
                let status = if preferences.show_inspector {
                    "Inspector panel visible"
                } else {
                    "Inspector panel hidden"
                };
                app.set_project_status(status.into());
                log_event("INFO", status);
            }
        });
    }

    // Settings Modal Callbacks
    {
        let state = state.clone();
        app.on_open_settings(move || {
            if let Some(app) = state.app.upgrade() {
                app.set_show_settings_dialog(true);
                log_event("INFO", "Settings modal opened");
            }
        });
    }

    {
        let state = state.clone();
        app.on_close_settings(move || {
            if let Some(app) = state.app.upgrade() {
                app.set_show_settings_dialog(false);
                log_event("INFO", "Settings modal closed");
            }
        });
    }

    // Export Project Callback
    {
        let state = state.clone();
        app.on_export_project(move || {
            if let Some(app) = state.app.upgrade() {
                app.invoke_open_export_dialog();
            }
        });
    }

    // Phase 3: Seek Playhead Callback
    {
        let state = state.clone();
        app.on_seek_playhead_px(move |px| {
            let zoom = *state.timeline_zoom.borrow();
            let frame = if zoom > 0.0 {
                (px / zoom).max(0.0).round() as u64
            } else {
                0
            };
            *state.playhead_frame.borrow_mut() = frame;
            sync_ui(&state);
        });
    }

    // Phase 3: Select Clip Callback
    {
        let state = state.clone();
        app.on_select_clip_id(move |id| {
            let id_str = id.to_string();
            log_event("INFO", &format!("Clip selected: {id_str}"));
            *state.selected_clip_id.borrow_mut() = Some(ClipId(id_str));
            sync_ui(&state);
        });
    }

    // Phase 3: Split At Playhead Callback
    {
        let state = state.clone();
        app.on_split_at_playhead(move || {
            let playhead = *state.playhead_frame.borrow();
            let selected_id = state.selected_clip_id.borrow().clone();

            let target_clip_id = {
                let proj = state.project.borrow();
                if let Some(ref sel_id) = selected_id {
                    proj.tracks
                        .iter()
                        .flat_map(|t| &t.clips)
                        .find(|c| &c.id == sel_id && playhead > c.timeline_start && playhead < c.timeline_start + c.timeline_duration)
                        .map(|c| c.id.clone())
                } else {
                    proj.tracks
                        .iter()
                        .flat_map(|t| &t.clips)
                        .find(|c| playhead > c.timeline_start && playhead < c.timeline_start + c.timeline_duration)
                        .map(|c| c.id.clone())
                }
            };

            if let Some(cid) = target_clip_id {
                match state.history.borrow_mut().execute(
                    Box::new(SplitClipCommand::new(cid, playhead)),
                    &mut state.project.borrow_mut(),
                ) {
                    Ok(desc) => {
                        log_event("INFO", &format!("Split clip: {desc}"));
                        sync_ui(&state);
                        if let Some(app) = state.app.upgrade() {
                            app.set_project_status(format!("Split: {desc}").into());
                        }
                    }
                    Err(e) => {
                        log_event("WARN", &format!("Split failed: {e}"));
                        if let Some(app) = state.app.upgrade() {
                            app.set_project_status(format!("Cannot split: {e}").into());
                        }
                    }
                }
            } else {
                if let Some(app) = state.app.upgrade() {
                    app.set_project_status("Position playhead inside a clip to split it".into());
                }
            }
        });
    }

    // Phase 3: Delete Selected Clip Callback
    {
        let state = state.clone();
        app.on_delete_selected_clip(move || {
            let sel = state.selected_clip_id.borrow().clone();
            if let Some(cid) = sel {
                match state.history.borrow_mut().execute(
                    Box::new(RemoveClipCommand::new(cid)),
                    &mut state.project.borrow_mut(),
                ) {
                    Ok(desc) => {
                        log_event("INFO", &format!("Delete clip: {desc}"));
                        *state.selected_clip_id.borrow_mut() = None;
                        sync_ui(&state);
                        if let Some(app) = state.app.upgrade() {
                            app.set_project_status(format!("Deleted: {desc}").into());
                        }
                    }
                    Err(e) => {
                        log_event("ERROR", &format!("Delete failed: {e}"));
                    }
                }
            }
        });
    }

    // Phase 3: Add Sample Clip Callback
    {
        let state = state.clone();
        app.on_add_sample_clip(move |is_video| {
            let proj = state.project.borrow();
            let track = proj.tracks.iter().find(|t| if is_video { t.kind == TrackKind::Video } else { t.kind == TrackKind::Audio });

            let (track_id, next_start, name) = if let Some(t) = track {
                let last_end = t.clips.iter().map(|c| c.timeline_start + c.timeline_duration).max().unwrap_or(0);
                let count = t.clips.len() + 1;
                let name = if is_video { format!("Video_Clip_{count}.mp4") } else { format!("Audio_BGM_{count}.mp3") };
                (t.id.clone(), last_end, name)
            } else {
                return;
            };
            drop(proj);

            let duration = if is_video { 120 } else { 180 };
            let new_clip = Clip::new(None, name, track_id.clone(), next_start, duration);
            let new_id = new_clip.id.clone();

            let _ = state.history.borrow_mut().execute(
                Box::new(AddClipCommand::new(new_clip, track_id)),
                &mut state.project.borrow_mut(),
            );
            *state.selected_clip_id.borrow_mut() = Some(new_id);
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status("Added sample clip to timeline".into());
            }
        });
    }

    // Phase 3: Zoom In / Zoom Out Callbacks
    {
        let state = state.clone();
        app.on_zoom_in(move || {
            let mut z = state.timeline_zoom.borrow_mut();
            *z = (*z * 1.25).min(6.0);
            drop(z);
            sync_ui(&state);
        });
    }
    {
        let state = state.clone();
        app.on_zoom_out(move || {
            let mut z = state.timeline_zoom.borrow_mut();
            *z = (*z / 1.25).max(0.4);
            drop(z);
            sync_ui(&state);
        });
    }

    // Phase 3: Toggle Track Mute / Lock Callbacks
    {
        let state = state.clone();
        app.on_toggle_track_mute(move |idx| {
            let mut proj = state.project.borrow_mut();
            if let Some(track) = proj.tracks.get_mut(idx as usize) {
                track.muted = !track.muted;
                log_event("INFO", &format!("Track {} mute toggled: {}", track.name, track.muted));
            }
            drop(proj);
            sync_ui(&state);
        });
    }
    {
        let state = state.clone();
        app.on_toggle_track_lock(move |idx| {
            let mut proj = state.project.borrow_mut();
            if let Some(track) = proj.tracks.get_mut(idx as usize) {
                track.locked = !track.locked;
                log_event("INFO", &format!("Track {} lock toggled: {}", track.name, track.locked));
            }
            drop(proj);
            sync_ui(&state);
        });
    }

    // Phase 3: Add Track Callback
    {
        let state = state.clone();
        app.on_add_track(move |is_video| {
            let mut proj = state.project.borrow_mut();
            let count = proj.tracks.iter().filter(|t| if is_video { t.kind == TrackKind::Video } else { t.kind == TrackKind::Audio }).count() + 1;
            let name = if is_video { format!("V{count}") } else { format!("A{count}") };
            let new_track = if is_video { Track::new_video(&name) } else { Track::new_audio(&name) };
            proj.tracks.push(new_track);
            drop(proj);
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(format!("Added track {name}").into());
            }
            log_event("INFO", &format!("Added new track {name}"));
        });
    }

    // Phase 4: Toggle Playback (Play / Pause)
    {
        let state = state.clone();
        app.on_toggle_playback(move || {
            let mut playing = state.is_playing.borrow_mut();
            *playing = !*playing;
            let is_play = *playing;
            drop(playing);

            if is_play {
                let total_frames = {
                    let proj = state.project.borrow();
                    state.compositor.borrow().total_duration_frames(&proj)
                };
                let mut cur = state.playhead_frame.borrow_mut();
                if *cur >= total_frames {
                    *cur = 0;
                }
            }

            sync_ui(&state);
            let status = if is_play { "Playing" } else { "Paused" };
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(status.into());
            }
            log_event("INFO", &format!("Playback: {status}"));
        });
    }

    // Phase 4: Step Frame (+/- delta frames)
    {
        let state = state.clone();
        app.on_step_frame(move |delta| {
            *state.is_playing.borrow_mut() = false;
            let total_frames = {
                let proj = state.project.borrow();
                state.compositor.borrow().total_duration_frames(&proj)
            };
            let mut cur = state.playhead_frame.borrow_mut();
            let new_frame = (*cur as i64 + delta as i64).clamp(0, total_frames as i64) as u64;
            *cur = new_frame;
            drop(cur);

            sync_ui(&state);
        });
    }

    // Phase 4: Jump to Start
    {
        let state = state.clone();
        app.on_jump_to_start(move || {
            *state.playhead_frame.borrow_mut() = 0;
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status("Jumped to start (00:00:00:00)".into());
            }
            log_event("INFO", "Playhead jumped to start");
        });
    }

    // Phase 4: Jump to End
    {
        let state = state.clone();
        app.on_jump_to_end(move || {
            let total_frames = {
                let proj = state.project.borrow();
                state.compositor.borrow().total_duration_frames(&proj)
            };
            *state.playhead_frame.borrow_mut() = total_frames;
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status("Jumped to end".into());
            }
            log_event("INFO", "Playhead jumped to end");
        });
    }

    // Phase 4: Toggle Looping
    {
        let state = state.clone();
        app.on_toggle_loop(move || {
            let mut loop_mode = state.is_looping.borrow_mut();
            *loop_mode = !*loop_mode;
            let status = if *loop_mode { "Looping enabled" } else { "Looping disabled" };
            drop(loop_mode);
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(status.into());
            }
            log_event("INFO", status);
        });
    }

    // Phase 4: Set Aspect Ratio
    {
        let state = state.clone();
        app.on_set_aspect_ratio(move |ratio| {
            let ratio_str = ratio.to_string();
            *state.aspect_ratio.borrow_mut() = ratio_str.clone();
            if ratio_str == "9:16" {
                *state.compositor.borrow_mut() = PreviewCompositor::new(180, 320);
            } else {
                *state.compositor.borrow_mut() = PreviewCompositor::new(320, 180);
            }
            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(format!("Aspect ratio: {ratio_str}").into());
            }
            log_event("INFO", &format!("Aspect ratio changed to {ratio_str}"));
        });
    }

    // Phase 5: Open Export Dialog
    {
        let state = state.clone();
        app.on_open_export_dialog(move || {
            *state.is_playing.borrow_mut() = false;
            state.export_completed.store(false, Ordering::SeqCst);
            if let Ok(mut rt) = state.export_runtime.lock() {
                rt.progress = 0.0;
                rt.status_text = "Ready to export".to_string();
                rt.error.clear();
            }

            let proj_name = state.project.borrow().name.clone();
            let sanitized = proj_name.replace(' ', "_");
            let mut cfg = state.export_config.borrow_mut();
            if let Some(parent) = cfg.output_path.parent() {
                cfg.output_path = parent.join(format!("{sanitized}.avi"));
            }
            drop(cfg);

            sync_ui(&state);
            if let Some(app) = state.app.upgrade() {
                app.set_show_export_dialog(true);
            }
            log_event("INFO", "Export dialog opened");
        });
    }

    // Phase 5: Close Export Dialog
    {
        let state = state.clone();
        app.on_close_export_dialog(move || {
            if !state.is_exporting.load(Ordering::Relaxed) {
                if let Some(app) = state.app.upgrade() {
                    app.set_show_export_dialog(false);
                }
                log_event("INFO", "Export dialog closed");
            }
        });
    }

    // Phase 5: Browse Export File Path
    {
        let state = state.clone();
        app.on_browse_export_path(move || {
            let current_path = state.export_config.borrow().output_path.clone();
            let current_name = current_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("FreeCut_Export.avi");
            if let Some(path) = rfd::FileDialog::new()
                .set_file_name(current_name)
                .add_filter("AVI Video (*.avi)", &["avi"])
                .add_filter("All Files (*.*)", &["*"])
                .save_file()
            {
                state.export_config.borrow_mut().output_path = path.clone();
                sync_ui(&state);
                log_event("INFO", &format!("Export destination path set to {}", path.display()));
            }
        });
    }

    // Phase 5: Set Export Preset
    {
        let state = state.clone();
        app.on_set_export_preset(move |preset| {
            let preset_str = preset.to_string();
            state.export_config.borrow_mut().apply_preset(&preset_str);
            sync_ui(&state);
            log_event("INFO", &format!("Export preset applied: {preset_str}"));
        });
    }

    // Phase 5: Start Export
    {
        let state = state.clone();
        app.on_start_export(move || {
            if state.is_exporting.load(Ordering::Relaxed) {
                return;
            }

            state.is_exporting.store(true, Ordering::SeqCst);
            state.export_completed.store(false, Ordering::SeqCst);
            state.cancel_token.store(false, Ordering::SeqCst);
            if let Ok(mut rt) = state.export_runtime.lock() {
                rt.progress = 0.0;
                rt.status_text = "Initializing render pipeline...".into();
                rt.error.clear();
            }
            sync_ui(&state);

            let project = state.project.borrow().clone();
            let config = state.export_config.borrow().clone();
            let cancel_token = state.cancel_token.clone();
            let is_exporting = state.is_exporting.clone();
            let export_completed = state.export_completed.clone();
            let export_runtime = state.export_runtime.clone();
            let app_weak = state.app.clone();

            log_event(
                "INFO",
                &format!(
                    "Export started: {} ({}x{} @ {:.0}fps) -> {}",
                    config.preset,
                    config.width,
                    config.height,
                    config.fps,
                    config.output_path.display()
                ),
            );

            std::thread::spawn(move || {
                let app_weak_progress = app_weak.clone();
                let runtime_progress = export_runtime.clone();

                let res = ExportEngine::export_project(&project, &config, cancel_token, move |p| {
                    let pct = p.progress;
                    let st = p.status;
                    if let Ok(mut rt) = runtime_progress.lock() {
                        rt.progress = pct;
                        rt.status_text = st.clone();
                    }
                    let app_p = app_weak_progress.clone();
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(app) = app_p.upgrade() {
                            app.set_export_progress(pct);
                            app.set_export_status_text(st.into());
                        }
                    });
                });

                is_exporting.store(false, Ordering::SeqCst);
                let app_weak_done = app_weak.clone();
                let filename = config
                    .output_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                match res {
                    Ok(frames) => {
                        export_completed.store(true, Ordering::SeqCst);
                        let status = format!("Export finished successfully! ({frames} frames)");
                        if let Ok(mut rt) = export_runtime.lock() {
                            rt.progress = 1.0;
                            rt.status_text = status.clone();
                            rt.error.clear();
                        }
                        log_event(
                            "INFO",
                            &format!(
                                "Export completed: {frames} frames to {}",
                                config.output_path.display()
                            ),
                        );
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(app) = app_weak_done.upgrade() {
                                app.set_is_exporting(false);
                                app.set_export_completed(true);
                                app.set_export_progress(1.0);
                                app.set_export_status_text(status.into());
                                app.set_project_status(format!("Exported to {filename}").into());
                            }
                        });
                    }
                    Err(e) => {
                        let is_cancel = e.kind() == std::io::ErrorKind::Interrupted;
                        let err_msg = e.to_string();
                        if let Ok(mut rt) = export_runtime.lock() {
                            if is_cancel {
                                rt.status_text = "Export cancelled by user".into();
                            } else {
                                rt.error = err_msg.clone();
                                rt.status_text = format!("Export failed: {err_msg}");
                            }
                        }
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(app) = app_weak_done.upgrade() {
                                app.set_is_exporting(false);
                                if is_cancel {
                                    app.set_export_status_text("Export cancelled by user".into());
                                } else {
                                    app.set_export_error(err_msg.clone().into());
                                    app.set_export_status_text(format!("Export failed: {err_msg}").into());
                                }
                            }
                        });
                    }
                }
            });
        });
    }

    // Phase 5: Cancel Export
    {
        let state = state.clone();
        app.on_cancel_export(move || {
            if state.is_exporting.load(Ordering::Relaxed) {
                state.cancel_token.store(true, Ordering::SeqCst);
                if let Ok(mut rt) = state.export_runtime.lock() {
                    rt.status_text = "Cancelling export...".into();
                }
                sync_ui(&state);
                log_event("INFO", "Export cancellation requested");
            }
        });
    }

    // Phase 5: Retry Export
    {
        let state = state.clone();
        app.on_retry_export(move || {
            if let Some(app) = state.app.upgrade() {
                app.invoke_start_export();
            }
        });
    }

    // Phase 5: Reveal Export File in Explorer
    {
        let state = state.clone();
        app.on_reveal_export_file(move || {
            let path = state.export_config.borrow().output_path.clone();
            if path.exists() {
                #[cfg(target_os = "windows")]
                {
                    let _ = std::process::Command::new("explorer.exe")
                        .arg(format!("/select,\"{}\"", path.display()))
                        .spawn();
                }
                #[cfg(not(target_os = "windows"))]
                {
                    if let Some(parent) = path.parent() {
                        let _ = std::process::Command::new("xdg-open").arg(parent).spawn();
                    }
                }
                log_event(
                    "INFO",
                    &format!("Revealed export file in file explorer: {}", path.display()),
                );
            } else if let Some(parent) = path.parent() {
                #[cfg(target_os = "windows")]
                {
                    let _ = std::process::Command::new("explorer.exe").arg(parent).spawn();
                }
            }
        });
    }

    // Phase 5: Set Custom Resolution, FPS, Format
    {
        let state = state.clone();
        app.on_set_export_resolution(move |res| {
            let parts: Vec<&str> = res.split('x').collect();
            if parts.len() == 2 {
                if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    let mut cfg = state.export_config.borrow_mut();
                    cfg.width = w;
                    cfg.height = h;
                    cfg.preset = "Custom".into();
                }
            }
            sync_ui(&state);
        });
    }
    {
        let state = state.clone();
        app.on_set_export_fps(move |fps_str| {
            let num: String = fps_str.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
            if let Ok(fps) = num.parse::<f64>() {
                let mut cfg = state.export_config.borrow_mut();
                cfg.fps = fps;
                cfg.preset = "Custom".into();
            }
            sync_ui(&state);
        });
    }
    {
        let state = state.clone();
        app.on_set_export_format(move |fmt_str| {
            let mut cfg = state.export_config.borrow_mut();
            if fmt_str.contains("BMP") {
                cfg.format = ExportFormat::BmpSequence;
            } else if fmt_str.contains("MP4") {
                cfg.format = ExportFormat::Mp4Ffmpeg;
            } else {
                cfg.format = ExportFormat::AviVideo;
            }
            sync_ui(&state);
        });
    }

    // Phase 6: Inspector Tab Switcher
    {
        let app_weak = app.as_weak();
        app.on_set_inspector_tab(move |tab| {
            if let Some(app) = app_weak.upgrade() {
                app.set_inspector_tab(tab);
            }
        });
    }

    // Phase 6: Inspector Video Controls
    {
        let state = state.clone();
        app.on_set_clip_scale(move |scale| {
            mutate_selected_clip(&state, |c| c.transform.scale = scale, &format!("Scale: {:.0}%", scale * 100.0));
        });
    }
    {
        let state = state.clone();
        app.on_set_clip_pos(move |x, y| {
            mutate_selected_clip(&state, |c| { c.transform.pos_x = x; c.transform.pos_y = y; }, "Position adjusted");
        });
    }
    {
        let state = state.clone();
        app.on_set_clip_rotation(move |rot| {
            mutate_selected_clip(&state, |c| c.transform.rotation = rot, &format!("Rotation: {:.0}°", rot));
        });
    }
    {
        let state = state.clone();
        app.on_set_clip_opacity(move |op| {
            mutate_selected_clip(&state, |c| c.transform.opacity = op, &format!("Opacity: {:.0}%", op * 100.0));
        });
    }
    {
        let state = state.clone();
        app.on_set_clip_speed(move |spd| {
            mutate_selected_clip(&state, |c| c.speed = spd, &format!("Speed: {:.1}x", spd));
        });
    }

    // Phase 6: Inspector Audio Controls
    {
        let state = state.clone();
        app.on_set_clip_volume(move |vol| {
            mutate_selected_clip(&state, |c| c.audio.volume_db = vol, &format!("Volume: {:.1} dB", vol));
        });
    }
    {
        let state = state.clone();
        app.on_toggle_clip_mute(move || {
            mutate_selected_clip(&state, |c| c.audio.muted = !c.audio.muted, "Audio mute toggled");
        });
    }

    // Phase 6 & 7: Inspector Video Effects Controls
    {
        let state = state.clone();
        app.on_set_clip_brightness(move |val| {
            mutate_selected_clip(&state, |c| c.effects.brightness = val, &format!("Brightness: {:.0}", val));
        });
    }
    {
        let state = state.clone();
        app.on_set_clip_contrast(move |val| {
            mutate_selected_clip(&state, |c| c.effects.contrast = val, &format!("Contrast: {:.0}", val));
        });
    }
    {
        let state = state.clone();
        app.on_set_clip_saturation(move |val| {
            mutate_selected_clip(&state, |c| c.effects.saturation = val, &format!("Saturation: {:.0}", val));
        });
    }
    {
        let state = state.clone();
        app.on_toggle_clip_grayscale(move || {
            mutate_selected_clip(&state, |c| c.effects.grayscale = !c.effects.grayscale, "B&W mode toggled");
        });
    }
    {
        let state = state.clone();
        app.on_toggle_clip_invert(move || {
            mutate_selected_clip(&state, |c| c.effects.invert = !c.effects.invert, "Invert colors toggled");
        });
    }
    {
        let state = state.clone();
        app.on_reset_clip_effects(move || {
            mutate_selected_clip(&state, |c| c.effects = ClipEffects::default(), "Reset all clip effects");
        });
    }

    // Phase 6: Media Library Quick Actions
    {
        let state = state.clone();
        app.on_add_media_to_timeline(move |idx| {
            let asset_opt = {
                let proj = state.project.borrow();
                proj.assets.get(idx as usize).cloned()
            };
            if let Some(asset) = asset_opt {
                let track_id_opt = {
                    let proj = state.project.borrow();
                    proj.tracks.first().map(|t| t.id.clone())
                };
                if let Some(track_id) = track_id_opt {
                    let playhead = *state.playhead_frame.borrow();
                    let clip = Clip::new(
                        Some(asset.id.clone()),
                        asset.name.clone(),
                        track_id.clone(),
                        playhead,
                        asset.duration_frames,
                    );
                    let cmd = Box::new(AddClipCommand::new(clip, track_id));
                    let mut proj = state.project.borrow_mut();
                    let mut hist = state.history.borrow_mut();
                    let _ = hist.execute(cmd, &mut proj);
                    drop(proj);
                    drop(hist);
                    sync_ui(&state);
                    if let Some(app) = state.app.upgrade() {
                        show_toast(&app, &format!("Added '{}' to timeline", asset.name), "success");
                    }
                }
            }
        });
    }
    {
        let state = state.clone();
        app.on_delete_media_item(move |idx| {
            let asset_id_opt = {
                let proj = state.project.borrow();
                proj.assets.get(idx as usize).map(|a| a.id.clone())
            };
            if let Some(asset_id) = asset_id_opt {
                let cmd = Box::new(RemoveAssetCommand::new(asset_id));
                let mut proj = state.project.borrow_mut();
                let mut hist = state.history.borrow_mut();
                let _ = hist.execute(cmd, &mut proj);
                drop(proj);
                drop(hist);
                sync_ui(&state);
                if let Some(app) = state.app.upgrade() {
                    show_toast(&app, "Removed asset from library", "warning");
                }
            }
        });
    }

    // Phase 6: Toast Dismiss Callback
    {
        let app_weak = app.as_weak();
        app.on_dismiss_toast(move || {
            if let Some(app) = app_weak.upgrade() {
                app.set_show_toast(false);
            }
        });
    }

    app.run()
}


fn open_project(state: &AppState, path: PathBuf) {
    log_event("INFO", &format!("Opening project from {}", path.display()));
    match load_project_from_file(&path) {
        Ok(project) => {
            *state.project.borrow_mut() = project;
            state.history.borrow_mut().clear();
            *state.project_path.borrow_mut() = Some(path.clone());
            state.preferences.borrow_mut().last_project = Some(path.display().to_string());
            save_preferences(&state.preferences.borrow());
            *state.is_playing.borrow_mut() = false;
            *state.playhead_frame.borrow_mut() = 0;
            *state.selected_clip_id.borrow_mut() = None;
            sync_ui(state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(format!("Opened project '{}'", path.display()).into());
                app.set_has_project(true);
            }
            log_event(
                "INFO",
                &format!("Project loaded successfully from {}", path.display()),
            );
        }
        Err(err) => {
            log_event("ERROR", &format!("Failed to open project: {err}"));
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(format!("Open error: {err}").into());
            }
        }
    }
}

fn save_project(state: &AppState, path: PathBuf) {
    log_event("INFO", &format!("Saving project to {}", path.display()));
    let project = state.project.borrow();
    match save_project_to_file(&project, &path) {
        Ok(()) => {
            *state.project_path.borrow_mut() = Some(path.clone());
            state.history.borrow_mut().mark_saved();
            sync_ui(state);
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(format!("Saved to {}", path.display()).into());
                app.set_has_project(true);
                show_toast(&app, "Project saved successfully!", "success");
            }
            log_event(
                "INFO",
                &format!("Project saved successfully to {}", path.display()),
            );
        }
        Err(err) => {
            log_event("ERROR", &format!("Save failed: {err}"));
            if let Some(app) = state.app.upgrade() {
                app.set_project_status(format!("Save error: {err}").into());
                show_toast(&app, &format!("Save failed: {err}"), "error");
            }
        }
    }
}

fn preferences_path() -> Option<PathBuf> {
    dirs_path().map(|path| path.join("preferences.json"))
}

fn dirs_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from))
        .map(|path| path.join("FreeCut"))
}

fn load_preferences() -> Preferences {
    preferences_path()
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save_preferences(preferences: &Preferences) {
    let Some(path) = preferences_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(bytes) = serde_json::to_vec_pretty(preferences) {
        let _ = std::fs::write(path, bytes);
    }
}

fn save_bmp(path: &std::path::Path, width: u32, height: u32, rgba: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut file = std::fs::File::create(path)?;
    let row_size = width * 4;
    let image_size = row_size * height;
    let file_size = 54 + image_size;
    file.write_all(b"BM")?;
    file.write_all(&(file_size as u32).to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;
    file.write_all(&54u32.to_le_bytes())?;
    file.write_all(&40u32.to_le_bytes())?;
    file.write_all(&(width as i32).to_le_bytes())?;
    file.write_all(&(-(height as i32)).to_le_bytes())?;
    file.write_all(&1u16.to_le_bytes())?;
    file.write_all(&32u16.to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;
    file.write_all(&(image_size as u32).to_le_bytes())?;
    file.write_all(&2835u32.to_le_bytes())?;
    file.write_all(&2835u32.to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;

    let mut bgra = Vec::with_capacity(image_size as usize);
    for chunk in rgba.chunks_exact(4) {
        bgra.push(chunk[2]);
        bgra.push(chunk[1]);
        bgra.push(chunk[0]);
        bgra.push(chunk[3]);
    }
    file.write_all(&bgra)?;
    Ok(())
}
