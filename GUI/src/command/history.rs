use crate::model::Project;

pub trait Command {
    fn execute(&mut self, project: &mut Project) -> Result<(), String>;
    fn undo(&mut self, project: &mut Project) -> Result<(), String>;
    fn description(&self) -> String;
}

pub struct HistoryManager {
    undo_stack: Vec<Box<dyn Command>>,
    redo_stack: Vec<Box<dyn Command>>,
    saved_version: usize,
    current_version: usize,
}

impl HistoryManager {
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            saved_version: 0,
            current_version: 0,
        }
    }

    pub fn execute(
        &mut self,
        mut cmd: Box<dyn Command>,
        project: &mut Project,
    ) -> Result<String, String> {
        cmd.execute(project)?;
        let desc = cmd.description();
        self.undo_stack.push(cmd);
        self.redo_stack.clear();
        self.current_version += 1;
        project.mark_updated();
        Ok(desc)
    }

    pub fn undo(&mut self, project: &mut Project) -> Result<Option<String>, String> {
        let Some(mut cmd) = self.undo_stack.pop() else {
            return Ok(None);
        };
        cmd.undo(project)?;
        let desc = cmd.description();
        self.redo_stack.push(cmd);
        self.current_version = self.current_version.saturating_sub(1);
        project.mark_updated();
        Ok(Some(desc))
    }

    pub fn redo(&mut self, project: &mut Project) -> Result<Option<String>, String> {
        let Some(mut cmd) = self.redo_stack.pop() else {
            return Ok(None);
        };
        cmd.execute(project)?;
        let desc = cmd.description();
        self.undo_stack.push(cmd);
        self.current_version += 1;
        project.mark_updated();
        Ok(Some(desc))
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn is_dirty(&self) -> bool {
        self.current_version != self.saved_version
    }

    pub fn mark_saved(&mut self) {
        self.saved_version = self.current_version;
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
        self.saved_version = 0;
        self.current_version = 0;
    }
}

impl Default for HistoryManager {
    fn default() -> Self {
        Self::new()
    }
}
