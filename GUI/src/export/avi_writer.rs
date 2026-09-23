use std::fs::File;
use std::io::{self, BufWriter, Seek, SeekFrom, Write};
use std::path::Path;

struct IndexEntry {
    chunk_id: [u8; 4],
    flags: u32,
    offset: u32,
    size: u32,
}

pub struct AviWriter {
    file: BufWriter<File>,
    width: u32,
    height: u32,
    frame_count: u32,
    row_stride: usize,
    frame_bytes: usize,
    // File offsets for patching headers on finish
    total_frames_avih_pos: u64,
    total_frames_strh_pos: u64,
    movi_size_pos: u64,
    movi_start_pos: u64,
    indices: Vec<IndexEntry>,
}

impl AviWriter {
    pub fn create<P: AsRef<Path>>(path: P, width: u32, height: u32, fps: f64) -> io::Result<Self> {
        let file = File::create(path)?;
        let mut writer = BufWriter::new(file);

        let row_stride = ((width as usize * 3 + 3) / 4) * 4;
        let frame_bytes = row_stride * height as usize;
        let microsec_per_frame = if fps > 0.0 {
            (1_000_000.0 / fps).round() as u32
        } else {
            33333
        };

        // RIFF Header
        writer.write_all(b"RIFF")?;
        writer.write_all(&0u32.to_le_bytes())?; // Placeholder for file_size - 8 (offset 4)
        writer.write_all(b"AVI ")?;

        // hdrl LIST chunk
        writer.write_all(b"LIST")?;
        let hdrl_size = 4 + 8 + 56 + (8 + 4 + 8 + 56 + 8 + 40); // 184 bytes
        writer.write_all(&(hdrl_size as u32).to_le_bytes())?;
        writer.write_all(b"hdrl")?;

        // avih chunk (MainAVIHeader)
        writer.write_all(b"avih")?;
        writer.write_all(&56u32.to_le_bytes())?;
        writer.write_all(&microsec_per_frame.to_le_bytes())?;
        let max_bytes_sec = (frame_bytes as f64 * fps).round() as u32;
        writer.write_all(&max_bytes_sec.to_le_bytes())?;
        writer.write_all(&0u32.to_le_bytes())?; // padding
        writer.write_all(&0x10u32.to_le_bytes())?; // AVIF_HASINDEX
        let total_frames_avih_pos = writer.stream_position()?;
        writer.write_all(&0u32.to_le_bytes())?; // Placeholder for total_frames
        writer.write_all(&0u32.to_le_bytes())?; // initial_frames
        writer.write_all(&1u32.to_le_bytes())?; // streams = 1
        writer.write_all(&(frame_bytes as u32).to_le_bytes())?;
        writer.write_all(&width.to_le_bytes())?;
        writer.write_all(&height.to_le_bytes())?;
        writer.write_all(&[0u8; 16])?; // reserved[4]

        // strl LIST chunk (Stream 0: Video)
        writer.write_all(b"LIST")?;
        let strl_size = 4 + 8 + 56 + 8 + 40; // 116 bytes
        writer.write_all(&(strl_size as u32).to_le_bytes())?;
        writer.write_all(b"strl")?;

        // strh chunk (AVIStreamHeader)
        writer.write_all(b"strh")?;
        writer.write_all(&56u32.to_le_bytes())?;
        writer.write_all(b"vids")?;
        writer.write_all(b"DIB ")?;
        writer.write_all(&0u32.to_le_bytes())?; // flags
        writer.write_all(&0u16.to_le_bytes())?; // priority
        writer.write_all(&0u16.to_le_bytes())?; // language
        writer.write_all(&0u32.to_le_bytes())?; // initial_frames
        writer.write_all(&1000u32.to_le_bytes())?; // scale
        let rate = (fps * 1000.0).round() as u32;
        writer.write_all(&rate.to_le_bytes())?; // rate
        writer.write_all(&0u32.to_le_bytes())?; // start
        let total_frames_strh_pos = writer.stream_position()?;
        writer.write_all(&0u32.to_le_bytes())?; // Placeholder for length
        writer.write_all(&(frame_bytes as u32).to_le_bytes())?;
        writer.write_all(&10000u32.to_le_bytes())?; // quality
        writer.write_all(&0u32.to_le_bytes())?; // sample_size
        writer.write_all(&0u16.to_le_bytes())?; // left
        writer.write_all(&0u16.to_le_bytes())?; // top
        writer.write_all(&(width as u16).to_le_bytes())?; // right
        writer.write_all(&(height as u16).to_le_bytes())?; // bottom

        // strf chunk (BITMAPINFOHEADER)
        writer.write_all(b"strf")?;
        writer.write_all(&40u32.to_le_bytes())?;
        writer.write_all(&40u32.to_le_bytes())?; // biSize
        writer.write_all(&(width as i32).to_le_bytes())?;
        writer.write_all(&(height as i32).to_le_bytes())?; // positive height = bottom-up DIB
        writer.write_all(&1u16.to_le_bytes())?; // biPlanes
        writer.write_all(&24u16.to_le_bytes())?; // biBitCount = 24
        writer.write_all(&0u32.to_le_bytes())?; // biCompression = BI_RGB (uncompressed)
        writer.write_all(&(frame_bytes as u32).to_le_bytes())?;
        writer.write_all(&0i32.to_le_bytes())?; // biXPelsPerMeter
        writer.write_all(&0i32.to_le_bytes())?; // biYPelsPerMeter
        writer.write_all(&0u32.to_le_bytes())?; // biClrUsed
        writer.write_all(&0u32.to_le_bytes())?; // biClrImportant

        // movi LIST chunk
        writer.write_all(b"LIST")?;
        let movi_size_pos = writer.stream_position()?;
        writer.write_all(&0u32.to_le_bytes())?; // Placeholder for movi size
        let movi_start_pos = writer.stream_position()?;
        writer.write_all(b"movi")?;

        Ok(Self {
            file: writer,
            width,
            height,
            frame_count: 0,
            row_stride,
            frame_bytes,
            total_frames_avih_pos,
            total_frames_strh_pos,
            movi_size_pos,
            movi_start_pos,
            indices: Vec::new(),
        })
    }

    /// Appends a raw RGBA frame (buffer length width * height * 4).
    /// Converts RGBA to Windows bottom-up BGR24 DIB.
    pub fn write_rgba_frame(&mut self, rgba_data: &[u8]) -> io::Result<()> {
        let expected_size = self.width as usize * self.height as usize * 4;
        if rgba_data.len() < expected_size {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "RGBA data buffer is smaller than width * height * 4",
            ));
        }

        let chunk_pos = self.file.stream_position()?;
        let rel_offset = (chunk_pos - self.movi_start_pos) as u32;

        self.file.write_all(b"00db")?;
        self.file.write_all(&(self.frame_bytes as u32).to_le_bytes())?;

        let w = self.width as usize;
        let h = self.height as usize;
        let pad_bytes = self.row_stride - (w * 3);
        let padding = [0u8; 4];

        // Windows DIB is bottom-up: row y goes from h - 1 down to 0
        for y in (0..h).rev() {
            let row_start = y * w * 4;
            for x in 0..w {
                let px = row_start + x * 4;
                let r = rgba_data[px];
                let g = rgba_data[px + 1];
                let b = rgba_data[px + 2];
                // Write BGR
                self.file.write_all(&[b, g, r])?;
            }
            if pad_bytes > 0 {
                self.file.write_all(&padding[..pad_bytes])?;
            }
        }

        self.indices.push(IndexEntry {
            chunk_id: *b"00db",
            flags: 0x10, // AVIIF_KEYFRAME
            offset: rel_offset,
            size: self.frame_bytes as u32,
        });

        self.frame_count += 1;
        Ok(())
    }

    /// Finalizes the AVI container, writes idx1 index table, and patches all headers.
    pub fn finish(mut self) -> io::Result<u32> {
        // Calculate movi LIST size
        let movi_end_pos = self.file.stream_position()?;
        let movi_size = (movi_end_pos - self.movi_start_pos) as u32;

        // Write idx1 index table
        self.file.write_all(b"idx1")?;
        let idx_size = (self.indices.len() * 16) as u32;
        self.file.write_all(&idx_size.to_le_bytes())?;
        for entry in &self.indices {
            self.file.write_all(&entry.chunk_id)?;
            self.file.write_all(&entry.flags.to_le_bytes())?;
            self.file.write_all(&entry.offset.to_le_bytes())?;
            self.file.write_all(&entry.size.to_le_bytes())?;
        }

        let total_file_size = self.file.stream_position()?;
        let riff_size = (total_file_size - 8) as u32;

        // Patch RIFF size (offset 4)
        self.file.seek(SeekFrom::Start(4))?;
        self.file.write_all(&riff_size.to_le_bytes())?;

        // Patch avih total_frames
        self.file.seek(SeekFrom::Start(self.total_frames_avih_pos))?;
        self.file.write_all(&self.frame_count.to_le_bytes())?;

        // Patch strh length
        self.file.seek(SeekFrom::Start(self.total_frames_strh_pos))?;
        self.file.write_all(&self.frame_count.to_le_bytes())?;

        // Patch movi LIST size
        self.file.seek(SeekFrom::Start(self.movi_size_pos))?;
        self.file.write_all(&movi_size.to_le_bytes())?;

        self.file.flush()?;
        Ok(self.frame_count)
    }

    #[allow(dead_code)]
    pub fn frame_count(&self) -> u32 {
        self.frame_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_avi_writer_creation_and_frames() {
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join("test_output_avi.avi");
        if test_path.exists() {
            let _ = fs::remove_file(&test_path);
        }

        let mut writer = AviWriter::create(&test_path, 64, 36, 30.0).expect("Failed to create AviWriter");

        // Create dummy RGBA frame (64 * 36 * 4)
        let frame_data = vec![128u8; 64 * 36 * 4];
        for _ in 0..5 {
            writer.write_rgba_frame(&frame_data).expect("Failed to write frame");
        }
        assert_eq!(writer.frame_count(), 5);

        let count = writer.finish().expect("Failed to finish AviWriter");
        assert_eq!(count, 5);

        // Verify file exists and has valid RIFF header
        let bytes = fs::read(&test_path).expect("Failed to read back test AVI file");
        assert!(bytes.len() > 100);
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"AVI ");

        let _ = fs::remove_file(&test_path);
    }
}
