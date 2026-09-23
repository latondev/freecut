use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExportFormat {
    AviVideo,
    Mp4Ffmpeg,
    BmpSequence,
}

impl ExportFormat {
    #[allow(dead_code)]
    pub fn extension(&self) -> &'static str {
        match self {
            Self::AviVideo => "avi",
            Self::Mp4Ffmpeg => "mp4",
            Self::BmpSequence => "bmp",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::AviVideo => "AVI Video (.avi)",
            Self::Mp4Ffmpeg => "MP4 Video (.mp4)",
            Self::BmpSequence => "BMP Sequence (.bmp)",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExportConfig {
    pub preset: String,
    pub output_path: PathBuf,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub format: ExportFormat,
}

impl ExportConfig {
    pub fn new(output_path: PathBuf) -> Self {
        Self {
            preset: "YouTube 1080p".into(),
            output_path,
            width: 1920,
            height: 1080,
            fps: 30.0,
            format: ExportFormat::AviVideo,
        }
    }

    pub fn apply_preset(&mut self, preset: &str) {
        self.preset = preset.to_string();
        match preset {
            "Shorts 9:16" => {
                self.width = 1080;
                self.height = 1920;
                self.fps = 30.0;
                self.format = ExportFormat::AviVideo;
            }
            "720p Fast" => {
                self.width = 1280;
                self.height = 720;
                self.fps = 30.0;
                self.format = ExportFormat::AviVideo;
            }
            "4K Master" => {
                self.width = 3840;
                self.height = 2160;
                self.fps = 60.0;
                self.format = ExportFormat::AviVideo;
            }
            _ => {
                // Default: YouTube 1080p
                self.width = 1920;
                self.height = 1080;
                self.fps = 30.0;
                self.format = ExportFormat::AviVideo;
            }
        }
    }

    pub fn resolution_str(&self) -> String {
        format!("{}x{}", self.width, self.height)
    }

    pub fn fps_str(&self) -> String {
        format!("{:.0} fps", self.fps)
    }
}

impl Default for ExportConfig {
    fn default() -> Self {
        let default_path = std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .map(|p| p.join("Videos").join("FreeCut_Export.avi"))
            .unwrap_or_else(|| PathBuf::from("FreeCut_Export.avi"));
        Self::new(default_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_presets() {
        let mut config = ExportConfig::default();
        assert_eq!(config.width, 1920);
        assert_eq!(config.height, 1080);
        assert_eq!(config.fps, 30.0);

        config.apply_preset("Shorts 9:16");
        assert_eq!(config.width, 1080);
        assert_eq!(config.height, 1920);
        assert_eq!(config.resolution_str(), "1080x1920");

        config.apply_preset("4K Master");
        assert_eq!(config.width, 3840);
        assert_eq!(config.height, 2160);
        assert_eq!(config.fps, 60.0);
    }

    #[test]
    fn test_export_format_extension() {
        assert_eq!(ExportFormat::AviVideo.extension(), "avi");
        assert_eq!(ExportFormat::Mp4Ffmpeg.extension(), "mp4");
        assert_eq!(ExportFormat::BmpSequence.extension(), "bmp");
    }
}
