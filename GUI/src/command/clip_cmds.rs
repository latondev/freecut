use super::history::Command;
use crate::model::{AssetId, Clip, ClipAudio, ClipEffects, ClipId, ClipTransform, MediaAsset, Project, TrackId};

pub struct AddAssetCommand {
    asset: MediaAsset,
}

impl AddAssetCommand {
    pub fn new(asset: MediaAsset) -> Self {
        Self { asset }
    }
}

impl Command for AddAssetCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        project.assets.push(self.asset.clone());
        Ok(())
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        project.assets.retain(|a| a.id != self.asset.id);
        Ok(())
    }

    fn description(&self) -> String {
        format!("Import asset '{}'", self.asset.name)
    }
}

pub struct RemoveAssetCommand {
    asset_id: AssetId,
    removed_asset: Option<MediaAsset>,
}

impl RemoveAssetCommand {
    pub fn new(asset_id: AssetId) -> Self {
        Self {
            asset_id,
            removed_asset: None,
        }
    }
}

impl Command for RemoveAssetCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        if let Some(pos) = project.assets.iter().position(|a| a.id == self.asset_id) {
            let asset = project.assets.remove(pos);
            self.removed_asset = Some(asset);
            Ok(())
        } else {
            Err(format!("Asset {:?} not found", self.asset_id))
        }
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        if let Some(asset) = &self.removed_asset {
            project.assets.push(asset.clone());
            Ok(())
        } else {
            Err("Cannot undo RemoveAsset: asset missing".into())
        }
    }

    fn description(&self) -> String {
        format!("Remove asset {:?}", self.asset_id)
    }
}

pub struct AddClipCommand {
    clip: Clip,
    track_id: TrackId,
}

impl AddClipCommand {
    pub fn new(clip: Clip, track_id: TrackId) -> Self {
        Self { clip, track_id }
    }
}

impl Command for AddClipCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        let track = project
            .tracks
            .iter_mut()
            .find(|t| t.id == self.track_id)
            .ok_or_else(|| format!("Track {:?} not found", self.track_id))?;
        track.clips.push(self.clip.clone());
        Ok(())
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        let track = project
            .tracks
            .iter_mut()
            .find(|t| t.id == self.track_id)
            .ok_or_else(|| format!("Track {:?} not found", self.track_id))?;
        track.clips.retain(|c| c.id != self.clip.id);
        Ok(())
    }

    fn description(&self) -> String {
        format!("Add clip '{}'", self.clip.name)
    }
}

pub struct RemoveClipCommand {
    clip_id: ClipId,
    removed_clip: Option<Clip>,
    track_id: Option<TrackId>,
}

impl RemoveClipCommand {
    pub fn new(clip_id: ClipId) -> Self {
        Self {
            clip_id,
            removed_clip: None,
            track_id: None,
        }
    }
}

impl Command for RemoveClipCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        for track in &mut project.tracks {
            if let Some(pos) = track.clips.iter().position(|c| c.id == self.clip_id) {
                let clip = track.clips.remove(pos);
                self.track_id = Some(track.id.clone());
                self.removed_clip = Some(clip);
                return Ok(());
            }
        }
        Err(format!("Clip {:?} not found", self.clip_id))
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        let (Some(clip), Some(track_id)) = (&self.removed_clip, &self.track_id) else {
            return Err("Cannot undo RemoveClip: state missing".into());
        };
        let track = project
            .tracks
            .iter_mut()
            .find(|t| &t.id == track_id)
            .ok_or_else(|| format!("Track {:?} not found", track_id))?;
        track.clips.push(clip.clone());
        Ok(())
    }

    fn description(&self) -> String {
        format!(
            "Remove clip '{}'",
            self.removed_clip
                .as_ref()
                .map(|c| c.name.as_str())
                .unwrap_or("unknown")
        )
    }
}

#[allow(dead_code)]
pub struct MoveClipCommand {
    clip_id: ClipId,
    old_start: u64,
    new_start: u64,
}

#[allow(dead_code)]
impl MoveClipCommand {
    pub fn new(clip_id: ClipId, old_start: u64, new_start: u64) -> Self {
        Self {
            clip_id,
            old_start,
            new_start,
        }
    }
}

impl Command for MoveClipCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        for track in &mut project.tracks {
            if let Some(clip) = track.clips.iter_mut().find(|c| c.id == self.clip_id) {
                clip.timeline_start = self.new_start;
                return Ok(());
            }
        }
        Err(format!("Clip {:?} not found", self.clip_id))
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        for track in &mut project.tracks {
            if let Some(clip) = track.clips.iter_mut().find(|c| c.id == self.clip_id) {
                clip.timeline_start = self.old_start;
                return Ok(());
            }
        }
        Err(format!("Clip {:?} not found", self.clip_id))
    }

    fn description(&self) -> String {
        format!("Move clip to frame {}", self.new_start)
    }
}

pub struct UpdateClipPropertiesCommand {
    clip_id: ClipId,
    old_transform: ClipTransform,
    new_transform: ClipTransform,
    old_effects: ClipEffects,
    new_effects: ClipEffects,
    old_audio: ClipAudio,
    new_audio: ClipAudio,
    old_speed: f32,
    new_speed: f32,
}

impl UpdateClipPropertiesCommand {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        clip_id: ClipId,
        old_transform: ClipTransform,
        new_transform: ClipTransform,
        old_effects: ClipEffects,
        new_effects: ClipEffects,
        old_audio: ClipAudio,
        new_audio: ClipAudio,
        old_speed: f32,
        new_speed: f32,
    ) -> Self {
        Self {
            clip_id,
            old_transform,
            new_transform,
            old_effects,
            new_effects,
            old_audio,
            new_audio,
            old_speed,
            new_speed,
        }
    }
}

impl Command for UpdateClipPropertiesCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        for track in &mut project.tracks {
            if let Some(clip) = track.clips.iter_mut().find(|c| c.id == self.clip_id) {
                clip.transform = self.new_transform.clone();
                clip.effects = self.new_effects.clone();
                clip.audio = self.new_audio.clone();
                clip.speed = self.new_speed;
                return Ok(());
            }
        }
        Err(format!("Clip {:?} not found", self.clip_id))
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        for track in &mut project.tracks {
            if let Some(clip) = track.clips.iter_mut().find(|c| c.id == self.clip_id) {
                clip.transform = self.old_transform.clone();
                clip.effects = self.old_effects.clone();
                clip.audio = self.old_audio.clone();
                clip.speed = self.old_speed;
                return Ok(());
            }
        }
        Err(format!("Clip {:?} not found", self.clip_id))
    }

    fn description(&self) -> String {
        format!("Update properties for clip {:?}", self.clip_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::command::HistoryManager;
    use crate::model::{Clip, MediaAsset, Project};
    use std::path::PathBuf;

    #[test]
    fn test_add_asset_command() {
        let mut project = Project::new("Test Project");
        let mut history = HistoryManager::new();
        let asset = MediaAsset::from_path(PathBuf::from("video.mp4"));
        let asset_id = asset.id.clone();

        assert_eq!(project.assets.len(), 0);
        assert!(!history.is_dirty());

        let cmd = Box::new(AddAssetCommand::new(asset));
        history.execute(cmd, &mut project).unwrap();

        assert_eq!(project.assets.len(), 1);
        assert_eq!(project.assets[0].id, asset_id);
        assert!(history.is_dirty());
        assert!(history.can_undo());
        assert!(!history.can_redo());

        history.undo(&mut project).unwrap();
        assert_eq!(project.assets.len(), 0);
        assert!(history.can_redo());

        history.redo(&mut project).unwrap();
        assert_eq!(project.assets.len(), 1);
    }

    #[test]
    fn test_remove_asset_command() {
        let mut project = Project::new("Remove Asset Test");
        let mut history = HistoryManager::new();
        let asset = MediaAsset::from_path(PathBuf::from("audio.mp3"));
        let asset_id = asset.id.clone();
        project.assets.push(asset);

        assert_eq!(project.assets.len(), 1);

        let rem_cmd = Box::new(RemoveAssetCommand::new(asset_id.clone()));
        history.execute(rem_cmd, &mut project).unwrap();
        assert_eq!(project.assets.len(), 0);

        history.undo(&mut project).unwrap();
        assert_eq!(project.assets.len(), 1);
        assert_eq!(project.assets[0].id, asset_id);
    }

    #[test]
    fn test_add_remove_move_clip_commands() {
        let mut project = Project::new("Timeline Test");
        let mut history = HistoryManager::new();
        let track_id = project.tracks[0].id.clone();

        let clip = Clip::new(None, "Clip 1".to_string(), track_id.clone(), 0, 100);
        let clip_id = clip.id.clone();

        // 1. Add Clip
        let add_cmd = Box::new(AddClipCommand::new(clip, track_id.clone()));
        history.execute(add_cmd, &mut project).unwrap();
        assert_eq!(project.tracks[0].clips.len(), 1);
        assert_eq!(project.tracks[0].clips[0].timeline_start, 0);

        // 2. Move Clip
        let move_cmd = Box::new(MoveClipCommand::new(clip_id.clone(), 0, 150));
        history.execute(move_cmd, &mut project).unwrap();
        assert_eq!(project.tracks[0].clips[0].timeline_start, 150);

        // Undo move
        history.undo(&mut project).unwrap();
        assert_eq!(project.tracks[0].clips[0].timeline_start, 0);

        // Redo move
        history.redo(&mut project).unwrap();
        assert_eq!(project.tracks[0].clips[0].timeline_start, 150);

        // 3. Remove Clip
        let rem_cmd = Box::new(RemoveClipCommand::new(clip_id.clone()));
        history.execute(rem_cmd, &mut project).unwrap();
        assert_eq!(project.tracks[0].clips.len(), 0);

        // Undo remove
        history.undo(&mut project).unwrap();
        assert_eq!(project.tracks[0].clips.len(), 1);
        assert_eq!(project.tracks[0].clips[0].id, clip_id);

        // Mark saved
        history.mark_saved();
        assert!(!history.is_dirty());
    }

    #[test]
    fn test_update_clip_properties_command_undo_redo() {
        let mut project = Project::new("Props Test");
        let mut history = HistoryManager::new();
        let track_id = project.tracks[0].id.clone();

        let mut clip = Clip::new(None, "Color Clip".to_string(), track_id.clone(), 0, 100);
        let clip_id = clip.id.clone();
        clip.transform.scale = 1.0;
        clip.effects.brightness = 0.0;
        project.tracks[0].clips.push(clip);

        let old_transform = ClipTransform::default();
        let mut new_transform = ClipTransform::default();
        new_transform.scale = 1.5;
        new_transform.opacity = 0.8;

        let old_effects = ClipEffects::default();
        let mut new_effects = ClipEffects::default();
        new_effects.brightness = 25.0;
        new_effects.grayscale = true;

        let old_audio = ClipAudio::default();
        let mut new_audio = ClipAudio::default();
        new_audio.volume_db = -6.0;

        let cmd = Box::new(UpdateClipPropertiesCommand::new(
            clip_id.clone(),
            old_transform,
            new_transform.clone(),
            old_effects,
            new_effects.clone(),
            old_audio,
            new_audio.clone(),
            1.0,
            1.5,
        ));

        history.execute(cmd, &mut project).unwrap();

        // Verify applied
        let updated = &project.tracks[0].clips[0];
        assert_eq!(updated.transform.scale, 1.5);
        assert_eq!(updated.effects.brightness, 25.0);
        assert!(updated.effects.grayscale);
        assert_eq!(updated.audio.volume_db, -6.0);
        assert_eq!(updated.speed, 1.5);

        // Undo
        history.undo(&mut project).unwrap();
        let reverted = &project.tracks[0].clips[0];
        assert_eq!(reverted.transform.scale, 1.0);
        assert_eq!(reverted.effects.brightness, 0.0);
        assert!(!reverted.effects.grayscale);
        assert_eq!(reverted.audio.volume_db, 0.0);
        assert_eq!(reverted.speed, 1.0);

        // Redo
        history.redo(&mut project).unwrap();
        let redone = &project.tracks[0].clips[0];
        assert_eq!(redone.transform.scale, 1.5);
        assert_eq!(redone.effects.brightness, 25.0);
        assert!(redone.effects.grayscale);
    }
}


