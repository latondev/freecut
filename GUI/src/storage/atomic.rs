use crate::model::Project;
use std::io::Write;
use std::path::Path;

pub fn atomic_save(path: &Path, content: &[u8]) -> Result<(), String> {
    let tmp_path = path.with_extension("freecut.tmp");
    // Write content to temporary file
    let mut file = std::fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temporary file: {e}"))?;
    file.write_all(content)
        .map_err(|e| format!("Failed to write content: {e}"))?;
    file.flush()
        .map_err(|e| format!("Failed to flush temporary file: {e}"))?;
    drop(file);

    // Optionally keep a .bak of existing file if it exists
    if path.exists() {
        let bak_path = path.with_extension("freecut.bak");
        let _ = std::fs::copy(path, bak_path);
    }

    // Atomic replace on Windows
    // std::fs::rename on Windows fails if destination exists in older Rust/Windows without remove first,
    // so remove existing first or use atomic rename
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    std::fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed to finalize project file: {e}"))?;
    Ok(())
}

pub fn save_project_to_file(project: &Project, path: &Path) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(project)
        .map_err(|e| format!("Serialization error: {e}"))?;
    atomic_save(path, &bytes)
}

pub fn load_project_from_file(path: &Path) -> Result<Project, String> {
    let bytes = std::fs::read(path)
        .map_err(|e| format!("Failed to read project file: {e}"))?;
    let mut project: Project = serde_json::from_slice(&bytes)
        .map_err(|e| format!("Corrupted project file or invalid schema: {e}"))?;

    // Check schema version
    if project.schema_version > 1 {
        return Err(format!(
            "Project schema version {} is newer than supported version 1",
            project.schema_version
        ));
    }

    // Check media file availability (missing media detection)
    for asset in &mut project.assets {
        asset.is_missing = !asset.path.exists();
    }

    Ok(project)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Clip, MediaAsset, Project};

    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn test_atomic_save_and_backup() {
        let temp_dir = std::env::temp_dir().join(format!("freecut_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let project_file = temp_dir.join("test_proj.freecut");
        let bak_file = temp_dir.join("test_proj.freecut.bak");

        // 1. Initial save
        atomic_save(&project_file, b"content version 1").unwrap();
        assert_eq!(fs::read_to_string(&project_file).unwrap(), "content version 1");
        assert!(!bak_file.exists());

        // 2. Overwrite save -> creates .bak
        atomic_save(&project_file, b"content version 2").unwrap();
        assert_eq!(fs::read_to_string(&project_file).unwrap(), "content version 2");
        assert!(bak_file.exists());
        assert_eq!(fs::read_to_string(&bak_file).unwrap(), "content version 1");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_save_and_load_project() {
        let temp_dir = std::env::temp_dir().join(format!("freecut_test_load_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let project_file = temp_dir.join("full_proj.freecut");

        let mut project = Project::new("My Film Project");
        let track_id = project.tracks[0].id.clone();
        project.tracks[0].clips.push(Clip::new(None, "Intro".to_string(), track_id, 0, 150));

        // Add dummy asset with existing file
        let existing_media = temp_dir.join("clip.mp4");
        fs::write(&existing_media, b"fake video bytes").unwrap();
        let asset1 = MediaAsset::from_path(existing_media);
        project.assets.push(asset1);

        // Add missing asset
        let missing_media = PathBuf::from("d:/non_existent_folder_xyz/missing.mp4");
        let asset2 = MediaAsset::from_path(missing_media);
        project.assets.push(asset2);

        // Save
        save_project_to_file(&project, &project_file).unwrap();
        assert!(project_file.exists());

        // Load
        let loaded = load_project_from_file(&project_file).unwrap();
        assert_eq!(loaded.name, "My Film Project");
        assert_eq!(loaded.tracks.len(), 2);
        assert_eq!(loaded.tracks[0].clips.len(), 1);

        assert_eq!(loaded.tracks[0].clips[0].name, "Intro");
        assert_eq!(loaded.assets.len(), 2);
        assert_eq!(loaded.assets[0].is_missing, false);
        assert_eq!(loaded.assets[1].is_missing, true);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_invalid_schema_version() {
        let temp_dir = std::env::temp_dir().join(format!("freecut_test_ver_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let project_file = temp_dir.join("invalid_ver.freecut");

        let bad_json = r#"{
            "schema_version": 99,
            "id": "proj_future_123",
            "name": "Future Proj",
            "created_at": 1000,
            "updated_at": 1000,
            "metadata": {
                "fps": 30.0,
                "width": 1920,
                "height": 1080
            },
            "assets": [],
            "tracks": []
        }"#;

        fs::write(&project_file, bad_json).unwrap();
        let res = load_project_from_file(&project_file);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("newer than supported"));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}


