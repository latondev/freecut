use super::clip::Clip;
use super::id::TrackId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrackKind {
    Video,
    Audio,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: TrackId,
    pub name: String,
    pub kind: TrackKind,
    pub locked: bool,
    pub muted: bool,
    pub clips: Vec<Clip>,
}

impl Track {
    pub fn new_video(name: &str) -> Self {
        Self {
            id: TrackId::new(),
            name: name.to_string(),
            kind: TrackKind::Video,
            locked: false,
            muted: false,
            clips: Vec::new(),
        }
    }

    #[allow(dead_code)]
    pub fn new_audio(name: &str) -> Self {

        Self {
            id: TrackId::new(),
            name: name.to_string(),
            kind: TrackKind::Audio,
            locked: false,
            muted: false,
            clips: Vec::new(),
        }
    }
}
