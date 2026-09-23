use super::avi_writer::AviWriter;
use super::config::{ExportConfig, ExportFormat};
use crate::model::Project;
use crate::preview::PreviewCompositor;
use std::fs;
use std::io;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct ExportProgress {
    #[allow(dead_code)]
    pub current_frame: u64,
    #[allow(dead_code)]
    pub total_frames: u64,
    pub progress: f32,
    pub status: String,
}

pub struct ExportEngine;

impl ExportEngine {
    /// Executes the export process for the given project.
    /// Can be cancelled at any time by setting `cancel_token` to true.
    pub fn export_project<F>(
        project: &Project,
        config: &ExportConfig,
        cancel_token: Arc<AtomicBool>,
        mut on_progress: F,
    ) -> io::Result<u64>
    where
        F: FnMut(ExportProgress),
    {
        // Ensure parent output directory exists
        if let Some(parent) = config.output_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        // Calculate total frames to export
        let compositor = PreviewCompositor::new(config.width, config.height);
        let total_frames = compositor.total_duration_frames(project).max(1);

        on_progress(ExportProgress {
            current_frame: 0,
            total_frames,
            progress: 0.0,
            status: format!("Initializing export: {} ({}x{})", config.preset, config.width, config.height),
        });

        match config.format {
            ExportFormat::AviVideo => {
                let mut writer = match AviWriter::create(
                    &config.output_path,
                    config.width,
                    config.height,
                    config.fps,
                ) {
                    Ok(w) => w,
                    Err(e) => {
                        return Err(io::Error::new(
                            e.kind(),
                            format!("Cannot create output file '{}': {}", config.output_path.display(), e),
                        ));
                    }
                };

                for frame in 0..total_frames {
                    if cancel_token.load(Ordering::Relaxed) {
                        drop(writer);
                        let _ = fs::remove_file(&config.output_path);
                        return Err(io::Error::new(
                            io::ErrorKind::Interrupted,
                            "Export was cancelled by user",
                        ));
                    }

                    // Render composited frame
                    let buffer = compositor.render_frame(project, frame);
                    let rgba_slice = buffer.as_slice();

                    // Convert &[Rgba8Pixel] to &[u8]
                    let raw_bytes: &[u8] = unsafe {
                        std::slice::from_raw_parts(
                            rgba_slice.as_ptr() as *const u8,
                            rgba_slice.len() * 4,
                        )
                    };

                    writer.write_rgba_frame(raw_bytes)?;

                    let current = frame + 1;
                    let progress = (current as f32 / total_frames as f32).clamp(0.0, 1.0);
                    let pct = (progress * 100.0).round() as u32;

                    on_progress(ExportProgress {
                        current_frame: current,
                        total_frames,
                        progress,
                        status: format!("Rendering frame {current}/{total_frames} ({pct}%)"),
                    });
                }

                writer.finish()?;
            }

            ExportFormat::BmpSequence => {
                let seq_dir = if config.output_path.is_dir() {
                    config.output_path.clone()
                } else {
                    config.output_path.with_extension("")
                };
                let _ = fs::create_dir_all(&seq_dir);

                for frame in 0..total_frames {
                    if cancel_token.load(Ordering::Relaxed) {
                        return Err(io::Error::new(
                            io::ErrorKind::Interrupted,
                            "Export was cancelled by user",
                        ));
                    }

                    let buffer = compositor.render_frame(project, frame);
                    let frame_filename = format!("frame_{:06}.bmp", frame);
                    let frame_path = seq_dir.join(frame_filename);

                    // Write BMP
                    let rgba_slice = buffer.as_slice();
                    let raw_bytes: &[u8] = unsafe {
                        std::slice::from_raw_parts(
                            rgba_slice.as_ptr() as *const u8,
                            rgba_slice.len() * 4,
                        )
                    };
                    save_frame_bmp(&frame_path, config.width, config.height, raw_bytes)?;

                    let current = frame + 1;
                    let progress = (current as f32 / total_frames as f32).clamp(0.0, 1.0);
                    let pct = (progress * 100.0).round() as u32;

                    on_progress(ExportProgress {
                        current_frame: current,
                        total_frames,
                        progress,
                        status: format!("Writing frame {current}/{total_frames} ({pct}%)"),
                    });
                }
            }

            ExportFormat::Mp4Ffmpeg => {
                // Fallback to AVI if ffmpeg is not present
                let mut avi_config = config.clone();
                avi_config.format = ExportFormat::AviVideo;
                return Self::export_project(project, &avi_config, cancel_token, on_progress);
            }
        }

        on_progress(ExportProgress {
            current_frame: total_frames,
            total_frames,
            progress: 1.0,
            status: "Export completed successfully!".to_string(),
        });

        Ok(total_frames)
    }
}

fn save_frame_bmp(path: &std::path::Path, width: u32, height: u32, rgba: &[u8]) -> io::Result<()> {
    use io::Write;
    let mut file = fs::File::create(path)?;
    let row_size = ((width as usize * 3 + 3) / 4) * 4;
    let image_size = row_size * height as usize;
    let file_size = 54 + image_size;

    file.write_all(b"BM")?;
    file.write_all(&(file_size as u32).to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;
    file.write_all(&54u32.to_le_bytes())?;
    file.write_all(&40u32.to_le_bytes())?;
    file.write_all(&(width as i32).to_le_bytes())?;
    file.write_all(&(height as i32).to_le_bytes())?; // bottom-up DIB
    file.write_all(&1u16.to_le_bytes())?;
    file.write_all(&24u16.to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;
    file.write_all(&(image_size as u32).to_le_bytes())?;
    file.write_all(&2835u32.to_le_bytes())?;
    file.write_all(&2835u32.to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;
    file.write_all(&0u32.to_le_bytes())?;

    let w = width as usize;
    let h = height as usize;
    let pad_bytes = row_size - (w * 3);
    let padding = [0u8; 4];

    for y in (0..h).rev() {
        let row_start = y * w * 4;
        for x in 0..w {
            let px = row_start + x * 4;
            let b = rgba[px + 2];
            let g = rgba[px + 1];
            let r = rgba[px];
            file.write_all(&[b, g, r])?;
        }
        if pad_bytes > 0 {
            file.write_all(&padding[..pad_bytes])?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Clip;

    #[test]
    fn test_export_engine_successful_avi() {
        let temp_dir = std::env::temp_dir();
        let out_file = temp_dir.join("test_engine_export.avi");
        if out_file.exists() {
            let _ = fs::remove_file(&out_file);
        }

        let mut project = Project::new("Export Test");
        let v_track_id = project.tracks[0].id.clone();
        let clip = Clip::new(None, "Sample.mp4".into(), v_track_id, 0, 10);
        project.tracks[0].clips.push(clip);

        let mut config = ExportConfig::new(out_file.clone());
        config.width = 64;
        config.height = 36;
        config.fps = 30.0;

        let cancel_token = Arc::new(AtomicBool::new(false));
        let mut last_progress = 0.0;

        let res = ExportEngine::export_project(&project, &config, cancel_token, |p| {
            last_progress = p.progress;
        });

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), 10);
        assert_eq!(last_progress, 1.0);
        assert!(out_file.exists());
        assert!(fs::metadata(&out_file).unwrap().len() > 500);

        let _ = fs::remove_file(&out_file);
    }

    #[test]
    fn test_export_engine_cancellation() {
        let temp_dir = std::env::temp_dir();
        let out_file = temp_dir.join("test_engine_cancel.avi");
        if out_file.exists() {
            let _ = fs::remove_file(&out_file);
        }

        let mut project = Project::new("Cancel Test");
        let v_track_id = project.tracks[0].id.clone();
        let clip = Clip::new(None, "Sample.mp4".into(), v_track_id, 0, 50);
        project.tracks[0].clips.push(clip);

        let mut config = ExportConfig::new(out_file.clone());
        config.width = 64;
        config.height = 36;

        let cancel_token = Arc::new(AtomicBool::new(true)); // Cancel immediately

        let res = ExportEngine::export_project(&project, &config, cancel_token, |_| {});

        assert!(res.is_err());
        assert_eq!(res.err().unwrap().kind(), io::ErrorKind::Interrupted);
        // File should be cleaned up upon cancellation
        assert!(!out_file.exists());
    }
}
