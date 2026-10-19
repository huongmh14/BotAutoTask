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
  lease_epoch INTEGER DEFAULT 0,
  turn_state TEXT DEFAULT 'idle',
  permission_mode TEXT DEFAULT 'default',
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_step ON journal_entries(goal_id, step_number);

CREATE TABLE IF NOT EXISTS remote_commands (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  target_id TEXT,
  command_type TEXT NOT NULL CHECK (command_type IN ('STEER','INTERRUPT','QUEUE','SWITCH_CORE','STOP_AGENT','TEAM_GOAL')),
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DELIVERED','ACKED','EXPIRED')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  preview TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','APPROVED','DENIED','EXPIRED')),
  decided_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
