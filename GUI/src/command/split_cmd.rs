use super::history::Command;
use crate::model::{Clip, ClipId, Project, TrackId};

pub struct SplitClipCommand {
    clip_id: ClipId,
    split_frame: u64,
    original_clip: Option<Clip>,
    created_clip_id: Option<ClipId>,
    track_id: Option<TrackId>,
}

impl SplitClipCommand {
    pub fn new(clip_id: ClipId, split_frame: u64) -> Self {
        Self {
            clip_id,
            split_frame,
            original_clip: None,
            created_clip_id: None,
            track_id: None,
        }
    }
}

impl Command for SplitClipCommand {
    fn execute(&mut self, project: &mut Project) -> Result<(), String> {
        for track in &mut project.tracks {
            if let Some(pos) = track.clips.iter().position(|c| c.id == self.clip_id) {
                let clip = &track.clips[pos];
                if self.split_frame <= clip.timeline_start
                    || self.split_frame >= clip.timeline_start + clip.timeline_duration
                {
                    return Err(format!(
                        "Split frame {} is outside clip range [{}, {}]",
                        self.split_frame,
                        clip.timeline_start,
                        clip.timeline_start + clip.timeline_duration
                    ));
                }

                let orig = clip.clone();
                let split_offset = self.split_frame - orig.timeline_start;
                let duration_part1 = split_offset;
                let duration_part2 = orig.timeline_duration - split_offset;

                track.clips[pos].timeline_duration = duration_part1;
                track.clips[pos].source_duration = duration_part1;

                let mut part2 = Clip::new(
                    orig.asset_id.clone(),
                    format!("{} (split)", orig.name),
                    track.id.clone(),
                    self.split_frame,
                    duration_part2,
                );
                part2.source_start = orig.source_start + split_offset;
                part2.source_duration = duration_part2;

                let part2_id = part2.id.clone();
                track.clips.insert(pos + 1, part2);

                self.original_clip = Some(orig);
                self.created_clip_id = Some(part2_id);
                self.track_id = Some(track.id.clone());
                return Ok(());
            }
        }
        Err(format!("Clip {:?} not found", self.clip_id))
    }

    fn undo(&mut self, project: &mut Project) -> Result<(), String> {
        let (Some(orig), Some(created_id), Some(track_id)) =
            (&self.original_clip, &self.created_clip_id, &self.track_id)
        else {
            return Err("Cannot undo split: missing state".into());
        };

        let track = project
            .tracks
            .iter_mut()
            .find(|t| &t.id == track_id)
            .ok_or_else(|| format!("Track {:?} not found", track_id))?;

        track.clips.retain(|c| &c.id != created_id);

        if let Some(pos) = track.clips.iter().position(|c| c.id == orig.id) {
            track.clips[pos] = orig.clone();
        } else {
            track.clips.push(orig.clone());
        }

        Ok(())
    }

    fn description(&self) -> String {
        format!("Split clip at frame {}", self.split_frame)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::command::HistoryManager;

    #[test]
    fn test_split_clip_command_execute_and_undo() {
        let mut project = Project::new("Split Test");
        let mut history = HistoryManager::new();
        let track_id = project.tracks[0].id.clone();

        let clip = Clip::new(None, "Long Video".into(), track_id.clone(), 0, 100);
        let clip_id = clip.id.clone();
        project.tracks[0].clips.push(clip);

        assert_eq!(project.tracks[0].clips.len(), 1);

        // Split at frame 40
        let cmd = Box::new(SplitClipCommand::new(clip_id.clone(), 40));
        history.execute(cmd, &mut project).unwrap();

        assert_eq!(project.tracks[0].clips.len(), 2);
        assert_eq!(project.tracks[0].clips[0].timeline_start, 0);
        assert_eq!(project.tracks[0].clips[0].timeline_duration, 40);
        assert_eq!(project.tracks[0].clips[1].timeline_start, 40);
        assert_eq!(project.tracks[0].clips[1].timeline_duration, 60);

        // Undo
        history.undo(&mut project).unwrap();
        assert_eq!(project.tracks[0].clips.len(), 1);
        assert_eq!(project.tracks[0].clips[0].id, clip_id);
        assert_eq!(project.tracks[0].clips[0].timeline_duration, 100);

        // Redo
        history.redo(&mut project).unwrap();
        assert_eq!(project.tracks[0].clips.len(), 2);
    }
}
