use crate::model::{Clip, Project, TrackKind};
use slint::{Rgba8Pixel, SharedPixelBuffer};

pub struct PreviewCompositor {
    width: u32,
    height: u32,
}

impl PreviewCompositor {
    pub fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }

    pub fn total_duration_frames(&self, project: &Project) -> u64 {
        project
            .tracks
            .iter()
            .flat_map(|t| &t.clips)
            .map(|c| c.timeline_start + c.timeline_duration)
            .max()
            .unwrap_or(300)
    }

    pub fn find_active_video_clip<'a>(&self, project: &'a Project, frame: u64) -> Option<&'a Clip> {
        for track in &project.tracks {
            if track.kind == TrackKind::Video && !track.muted {
                if let Some(clip) = track.clips.iter().find(|c| {
                    frame >= c.timeline_start && frame < c.timeline_start + c.timeline_duration
                }) {
                    return Some(clip);
                }
            }
        }
        None
    }

    pub fn render_frame(&self, project: &Project, frame: u64) -> SharedPixelBuffer<Rgba8Pixel> {
        let mut buffer = SharedPixelBuffer::<Rgba8Pixel>::new(self.width, self.height);
        let slice = buffer.make_mut_slice();

        let active_clip = self.find_active_video_clip(project, frame);

        // Determine theme colors based on active clip or idle state
        let (base_r, base_g, base_b) = if let Some(clip) = active_clip {
            // Video active: Teal / emerald dynamic gradient
            let hash = clip.name.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32));
            let r = 16 + (hash % 20) as u8;
            let g = 50 + (hash % 30) as u8;
            let b = 40 + (hash % 25) as u8;
            (r, g, b)
        } else {
            // Idle or gap: Sleek dark studio gradient
            (20, 20, 24)
        };

        let w = self.width as usize;
        let h = self.height as usize;
        let scanline_x = if self.width > 0 {
            ((frame * 4) % (self.width as u64)) as usize
        } else {
            0
        };

        for y in 0..h {
            let row_offset = y * w;
            let v_factor = (y as f32 / h as f32 * 20.0) as u8;

            for x in 0..w {
                let is_scanline = x == scanline_x || x == (scanline_x + 1) % w;
                let is_grid = (x % 32 == 0 && y % 32 == 0) || x == 0 || y == 0 || x == w - 1 || y == h - 1;

                let raw_r = if is_scanline {
                    245
                } else if is_grid {
                    base_r.saturating_add(30)
                } else {
                    base_r.saturating_sub(v_factor)
                };

                let raw_g = if is_scanline {
                    250
                } else if is_grid {
                    base_g.saturating_add(35)
                } else {
                    base_g.saturating_sub(v_factor / 2)
                };

                let raw_b = if is_scanline {
                    80
                } else if is_grid {
                    base_b.saturating_add(30)
                } else {
                    base_b.saturating_sub(v_factor)
                };

                // Apply clip effects & opacity if active clip exists
                let (r, g, b) = if let Some(clip) = active_clip {
                    Self::apply_effects(raw_r, raw_g, raw_b, clip)
                } else {
                    (raw_r, raw_g, raw_b)
                };

                slice[row_offset + x] = Rgba8Pixel {
                    r,
                    g,
                    b,
                    a: 255,
                };
            }
        }

        buffer
    }

    /// Process a pixel with clip effects & transform
    pub fn apply_effects(r: u8, g: u8, b: u8, clip: &Clip) -> (u8, u8, u8) {
        // 1. Brightness
        let b_delta = (clip.effects.brightness / 100.0 * 128.0) as i32;
        let mut pr = (r as i32 + b_delta).clamp(0, 255);
        let mut pg = (g as i32 + b_delta).clamp(0, 255);
        let mut pb = (b as i32 + b_delta).clamp(0, 255);

        // 2. Contrast
        if clip.effects.contrast != 0.0 {
            let c_factor = (clip.effects.contrast / 100.0) + 1.0;
            pr = (((pr as f32 - 128.0) * c_factor) + 128.0).clamp(0.0, 255.0) as i32;
            pg = (((pg as f32 - 128.0) * c_factor) + 128.0).clamp(0.0, 255.0) as i32;
            pb = (((pb as f32 - 128.0) * c_factor) + 128.0).clamp(0.0, 255.0) as i32;
        }

        // 3. Saturation
        if clip.effects.saturation != 0.0 {
            let lum = 0.2126 * pr as f32 + 0.7152 * pg as f32 + 0.0722 * pb as f32;
            let s_factor = (clip.effects.saturation / 100.0) + 1.0;
            pr = (lum + (pr as f32 - lum) * s_factor).clamp(0.0, 255.0) as i32;
            pg = (lum + (pg as f32 - lum) * s_factor).clamp(0.0, 255.0) as i32;
            pb = (lum + (pb as f32 - lum) * s_factor).clamp(0.0, 255.0) as i32;
        }

        // 4. Grayscale
        if clip.effects.grayscale {
            let lum = (0.2126 * pr as f32 + 0.7152 * pg as f32 + 0.0722 * pb as f32).clamp(0.0, 255.0) as i32;
            pr = lum;
            pg = lum;
            pb = lum;
        }

        // 5. Invert
        if clip.effects.invert {
            pr = 255 - pr;
            pg = 255 - pg;
            pb = 255 - pb;
        }

        // 6. Opacity (blend over dark background 20, 20, 24)
        let opacity = clip.transform.opacity.clamp(0.0, 1.0);
        let bg_r = 20.0f32;
        let bg_g = 20.0f32;
        let bg_b = 24.0f32;

        let final_r = (pr as f32 * opacity + bg_r * (1.0 - opacity)).clamp(0.0, 255.0) as u8;
        let final_g = (pg as f32 * opacity + bg_g * (1.0 - opacity)).clamp(0.0, 255.0) as u8;
        let final_b = (pb as f32 * opacity + bg_b * (1.0 - opacity)).clamp(0.0, 255.0) as u8;

        (final_r, final_g, final_b)
    }
}

impl Default for PreviewCompositor {
    fn default() -> Self {
        Self::new(320, 180)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Clip, Project};

    #[test]
    fn test_find_active_video_clip() {
        let mut project = Project::new("Preview Test");
        let v_track_id = project.tracks[0].id.clone();

        let c1 = Clip::new(None, "Scene 1".into(), v_track_id.clone(), 0, 100);
        let c2 = Clip::new(None, "Scene 2".into(), v_track_id, 100, 150);
        project.tracks[0].clips.push(c1);
        project.tracks[0].clips.push(c2);

        let compositor = PreviewCompositor::default();

        // At frame 50 -> Scene 1
        let active = compositor.find_active_video_clip(&project, 50);
        assert!(active.is_some());
        assert_eq!(active.unwrap().name, "Scene 1");

        // At frame 120 -> Scene 2
        let active2 = compositor.find_active_video_clip(&project, 120);
        assert!(active2.is_some());
        assert_eq!(active2.unwrap().name, "Scene 2");

        // At frame 300 -> None (gap)
        let active3 = compositor.find_active_video_clip(&project, 300);
        assert!(active3.is_none());

        // Total duration should be 250
        assert_eq!(compositor.total_duration_frames(&project), 250);
    }

    #[test]
    fn test_render_frame_buffer() {
        let project = Project::new("Render Buffer Test");
        let compositor = PreviewCompositor::new(64, 36);
        let buffer = compositor.render_frame(&project, 15);
        assert_eq!(buffer.width(), 64);
        assert_eq!(buffer.height(), 36);
    }

    #[test]
    fn test_compositor_effects_pipeline() {
        let mut clip = Clip::new(None, "Effect Clip".into(), Default::default(), 0, 100);

        // 1. Grayscale test
        clip.effects.grayscale = true;
        let (r, g, b) = PreviewCompositor::apply_effects(100, 150, 200, &clip);
        assert_eq!(r, g);
        assert_eq!(g, b);

        // 2. Invert test
        clip.effects.grayscale = false;
        clip.effects.invert = true;
        let (ir, ig, ib) = PreviewCompositor::apply_effects(50, 100, 200, &clip);
        assert_eq!(ir, 205);
        assert_eq!(ig, 155);
        assert_eq!(ib, 55);

        // 3. Brightness test
        clip.effects.invert = false;
        clip.effects.brightness = 50.0;
        let (br, _, _) = PreviewCompositor::apply_effects(100, 100, 100, &clip);
        assert!(br > 100);

        // 4. Opacity test
        clip.effects.brightness = 0.0;
        clip.transform.opacity = 0.0;
        let (or, og, ob) = PreviewCompositor::apply_effects(255, 255, 255, &clip);
        // Blended with background (20, 20, 24)
        assert_eq!(or, 20);
        assert_eq!(og, 20);
        assert_eq!(ob, 24);
    }

    #[test]
    fn test_muted_track_ignored() {
        let mut project = Project::new("Muted Test");
        let v_track_id = project.tracks[0].id.clone();
        let c1 = Clip::new(None, "Muted Scene".into(), v_track_id, 0, 100);
        project.tracks[0].clips.push(c1);
        project.tracks[0].muted = true;

        let compositor = PreviewCompositor::default();
        let active = compositor.find_active_video_clip(&project, 50);
        assert!(active.is_none(), "Muted track clips should not be rendered in preview");
    }

    #[test]
    fn test_empty_project_duration() {
        let mut project = Project::new("Empty Test");
        project.tracks.clear();
        let compositor = PreviewCompositor::default();
        assert_eq!(compositor.total_duration_frames(&project), 300);
    }
}

