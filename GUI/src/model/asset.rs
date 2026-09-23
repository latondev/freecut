use super::id::AssetId;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAsset {
    pub id: AssetId,
    pub path: PathBuf,
    pub name: String,
    pub duration_frames: u64,
    pub fps: f64,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub is_missing: bool,
}

impl MediaAsset {
    pub fn from_path(path: PathBuf) -> Self {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Media")
            .to_string();
        let exists = path.exists();
        Self {
            id: AssetId::new(),
            path,
            name,
            duration_frames: 300, // default 10s @ 30fps placeholder until Phase 4 media probe
            fps: 30.0,
            width: 1920,
            height: 1080,
            is_missing: !exists,
        }
    }
}
