CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_prompt TEXT NOT NULL,
  repo_path TEXT,
  repo_url TEXT,
  branch TEXT DEFAULT 'botautotask/wip',
  acceptance_cmd TEXT,
  execution_mode TEXT DEFAULT 'auto',
  preferred_core TEXT DEFAULT 'auto',
  status TEXT DEFAULT 'QUEUED',
  current_step INTEGER DEFAULT 0,
  max_steps INTEGER DEFAULT 15,
  lease_owner TEXT,
  lease_expires_at INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  worker_id TEXT NOT NULL,
  core_used TEXT NOT NULL,
  model_used TEXT NOT NULL,
  outcome TEXT NOT NULL,
  summary TEXT NOT NULL,
  git_commit TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (goal_id) REFERENCES goals(id)
);
