-- Migration 0002: Atomic lease CAS, remote commands, approvals
ALTER TABLE goals ADD COLUMN lease_epoch INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN turn_state TEXT DEFAULT 'idle';
ALTER TABLE goals ADD COLUMN permission_mode TEXT DEFAULT 'default';

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
