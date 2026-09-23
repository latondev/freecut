use super::asset::MediaAsset;
use super::clip::Clip;
use super::id::ClipId;
use super::track::Track;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub width: u32,
    pub height: u32,
    pub fps: f64,
}

impl Default for ProjectMetadata {
    fn default() -> Self {
        Self {
            width: 1920,
            height: 1080,
            fps: 30.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub metadata: ProjectMetadata,
    pub assets: Vec<MediaAsset>,
    pub tracks: Vec<Track>,
}

impl Project {
    pub fn new(name: &str) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let track1 = Track::new_video("V1");
        let track2 = Track::new_audio("A1");
        Self {
            schema_version: 1,
            id: format!("proj_{now}"),
            name: name.to_string(),
            created_at: now,
            updated_at: now,
            metadata: ProjectMetadata::default(),
            assets: Vec::new(),
            tracks: vec![track1, track2],
        }
    }

    pub fn total_clips(&self) -> usize {
        self.tracks.iter().map(|t| t.clips.len()).sum()
    }

    #[allow(dead_code)]
    pub fn find_clip(&self, clip_id: &ClipId) -> Option<&Clip> {

        self.tracks
            .iter()
            .flat_map(|t| &t.clips)
            .find(|c| &c.id == clip_id)
    }

    pub fn mark_updated(&mut self) {
        self.updated_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Clip, TimelineId};

    #[test]
    fn test_project_creation_and_find_clip() {
        let proj = Project::new("My Film");
        assert_eq!(proj.name, "My Film");
        assert_eq!(proj.schema_version, 1);
        assert_eq!(proj.tracks.len(), 2);
        assert_eq!(proj.total_clips(), 0);

        let mut proj = proj;
        let clip = Clip::new(None, "Video Clip 1".to_string(), proj.tracks[0].id.clone(), 0, 100);

        let clip_id = clip.id.clone();
        proj.tracks[0].clips.push(clip);


        assert_eq!(proj.total_clips(), 1);
        let found = proj.find_clip(&clip_id);
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Video Clip 1");

        let timeline_id = TimelineId::new();
        assert!(timeline_id.0.starts_with("timeline_"));
    }
}

