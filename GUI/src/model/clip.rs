use super::id::{AssetId, ClipId, TrackId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClipTransform {
    pub scale: f32,       // 0.5 .. 2.0 (default 1.0)
    pub pos_x: f32,       // offset in pixels (default 0.0)
    pub pos_y: f32,       // offset in pixels (default 0.0)
    pub rotation: f32,    // degrees -180.0 .. 180.0 (default 0.0)
    pub opacity: f32,     // 0.0 .. 1.0 (default 1.0)
}

impl Default for ClipTransform {
    fn default() -> Self {
        Self {
            scale: 1.0,
            pos_x: 0.0,
            pos_y: 0.0,
            rotation: 0.0,
            opacity: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClipEffects {
    pub brightness: f32,  // -100.0 .. 100.0 (default 0.0)
    pub contrast: f32,    // -100.0 .. 100.0 (default 0.0)
    pub saturation: f32,  // -100.0 .. 100.0 (default 0.0)
    pub grayscale: bool,  // default false
    pub invert: bool,     // default false
}

impl Default for ClipEffects {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 0.0,
            saturation: 0.0,
            grayscale: false,
            invert: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClipAudio {
    pub volume_db: f32,   // -60.0 .. +12.0 (default 0.0)
    pub muted: bool,      // default false
}

impl Default for ClipAudio {
    fn default() -> Self {
        Self {
            volume_db: 0.0,
            muted: false,
        }
    }
}

fn default_speed() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Clip {
    pub id: ClipId,
    pub asset_id: Option<AssetId>,
    pub name: String,
    pub track_id: TrackId,
    pub source_start: u64,
    pub source_duration: u64,
    pub timeline_start: u64,
    pub timeline_duration: u64,

    #[serde(default)]
    pub transform: ClipTransform,

    #[serde(default)]
    pub effects: ClipEffects,

    #[serde(default)]
    pub audio: ClipAudio,

    #[serde(default = "default_speed")]
    pub speed: f32,
}

impl Clip {
    pub fn new(
        asset_id: Option<AssetId>,
        name: String,
        track_id: TrackId,
        timeline_start: u64,
        duration: u64,
    ) -> Self {
        Self {
            id: ClipId::new(),
            asset_id,
            name,
            track_id,
            source_start: 0,
            source_duration: duration,
            timeline_start,
            timeline_duration: duration,
            transform: ClipTransform::default(),
            effects: ClipEffects::default(),
            audio: ClipAudio::default(),
            speed: 1.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clip_defaults() {
        let clip = Clip::new(None, "Test Clip".into(), TrackId::new(), 0, 100);
        assert_eq!(clip.transform.scale, 1.0);
        assert_eq!(clip.transform.opacity, 1.0);
        assert_eq!(clip.effects.brightness, 0.0);
        assert!(!clip.effects.grayscale);
        assert_eq!(clip.audio.volume_db, 0.0);
        assert_eq!(clip.speed, 1.0);
    }

    #[test]
    fn test_clip_serde_backwards_compatibility() {
        // Old JSON without transform, effects, audio, speed
        let old_json = r#"{
            "id": "clip-old-123",
            "asset_id": null,
            "name": "Legacy Clip",
            "track_id": "trk-1",
            "source_start": 0,
            "source_duration": 90,
            "timeline_start": 10,
            "timeline_duration": 90
        }"#;

        let clip: Clip = serde_json::from_str(old_json).expect("Deserialization of old schema must succeed");
        assert_eq!(clip.name, "Legacy Clip");
        assert_eq!(clip.transform.scale, 1.0);
        assert_eq!(clip.effects.brightness, 0.0);
        assert_eq!(clip.audio.volume_db, 0.0);
        assert_eq!(clip.speed, 1.0);
    }
}

