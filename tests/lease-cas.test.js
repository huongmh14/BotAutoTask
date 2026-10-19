import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloud-core/worker.js';

class MockD1Database {
  constructor() {
    this.goals = new Map();
    this.journal = [];
    this.commands = [];
  }

  insertGoal(goal) {
    this.goals.set(goal.id, {
      ...goal,
      lease_epoch: goal.lease_epoch || 0,
      lease_expires_at: goal.lease_expires_at || 0,
      lease_owner: goal.lease_owner || null,
      status: goal.status || 'QUEUED'
    });
  }

  prepare(sql) {
    const db = this;
    return {
      _binds: [],
      bind(...args) {
        this._binds = args;
        return this;
      },
      async first() {
        if (sql.includes('FROM goals WHERE id = ?')) {
          const id = this._binds[0];
          return db.goals.get(id) || null;
        }
        if (sql.includes('FROM goals') && sql.includes('ORDER BY created_at ASC LIMIT 1')) {
          const now = this._binds[0];
          const workerId = this._binds[1];
          for (const g of db.goals.values()) {
            if (['QUEUED', 'RUNNING_LOCAL', 'RUNNING_CLOUD'].includes(g.status)) {
              if (g.lease_expires_at < now || g.lease_owner === workerId) {
                return g;
              }
            }
          }
          return null;
        }
        if (sql.includes('SELECT lease_owner, lease_epoch FROM goals WHERE id = ?')) {
          const id = this._binds[0];
          const g = db.goals.get(id);
          return g ? { lease_owner: g.lease_owner, lease_epoch: g.lease_epoch } : null;
        }
        return null;
      },
      async all() {
        if (sql.includes('FROM journal_entries WHERE goal_id = ?')) {
          const id = this._binds[0];
          return { results: db.journal.filter((j) => j.goal_id === id) };
        }
        if (sql.includes('FROM remote_commands')) {
          return { results: db.commands };
        }
        return { results: [] };
      },
      async run() {
        // CAS Update: UPDATE goals SET status = ?, lease_owner = ?, lease_expires_at = ?, lease_epoch = COALESCE(lease_epoch, 0) + 1, updated_at = ? WHERE id = ? AND (lease_expires_at < ? OR lease_owner = ?)
        if (sql.includes('UPDATE goals') && sql.includes('lease_epoch = COALESCE(lease_epoch, 0) + 1')) {
          const [status, owner, expiresAt, updatedAt, goalId, checkExpires, checkOwner] = this._binds;
          const g = db.goals.get(goalId);
          if (g && (g.lease_expires_at < checkExpires || g.lease_owner === checkOwner)) {
            g.status = status;
            g.lease_owner = owner;
            g.lease_expires_at = expiresAt;
            g.lease_epoch = (g.lease_epoch || 0) + 1;
            g.updated_at = updatedAt;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }

        // Heartbeat Update: UPDATE goals SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND lease_owner = ? (AND lease_epoch = ?)
        if (sql.includes('UPDATE goals SET lease_expires_at = ?')) {
          const [expiresAt, updatedAt, goalId, owner, epoch] = this._binds;
          const g = db.goals.get(goalId);
          if (g && g.lease_owner === owner) {
            if (epoch !== undefined && g.lease_epoch !== epoch) {
              return { meta: { changes: 0 } };
            }
            g.lease_expires_at = expiresAt;
            g.updated_at = updatedAt;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }

        // Journal Insert
        if (sql.includes('INSERT OR IGNORE INTO journal_entries')) {
          const [goal_id, step_number, worker_id, core_used, model_used, outcome, summary, git_commit, created_at] = this._binds;
          const exists = db.journal.some((j) => j.goal_id === goal_id && j.step_number === step_number);
          if (!exists) {
            db.journal.push({ goal_id, step_number, worker_id, core_used, model_used, outcome, summary, git_commit, created_at });
          }
          return { meta: { changes: exists ? 0 : 1 } };
        }

        // Update step status
        if (sql.includes('UPDATE goals SET current_step = ?')) {
          const [step, status, expiresAt, updatedAt, goalId] = this._binds;
          const g = db.goals.get(goalId);
          if (g) {
            g.current_step = step;
            g.status = status;
            g.lease_expires_at = expiresAt;
            g.updated_at = updatedAt;
          }
          return { meta: { changes: 1 } };
        }

        // Remote Commands Insert
        if (sql.includes('INSERT INTO remote_commands')) {
          const [id, goal_id, target_id, command_type, payload, created_at] = this._binds;
          db.commands.push({ id, goal_id, target_id, command_type, payload, status: 'PENDING', created_at });
          return { meta: { changes: 1 } };
        }

        return { meta: { changes: 1 } };
      }
    };
  }
}

test('Lease CAS prevents racing workers and increments lease_epoch', async () => {
  const db = new MockD1Database();
  const token = 'secret-token-test';
  const env = { DB: db, BOTAUTOTASK_API_TOKEN: token };

  db.insertGoal({
    id: 'goal-race-1',
    title: 'Test Race Goal',
    target_prompt: 'Do task',
    status: 'QUEUED',
    lease_expires_at: 0,
    lease_owner: null,
    lease_epoch: 0,
    created_at: 1000,
    updated_at: 1000
  });

  // Worker A acquires lease
  const reqA = new Request('https://worker/api/lease/acquire', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 'worker-A', goalId: 'goal-race-1' })
  });
  const resA = await worker.fetch(reqA, env);
  assert.equal(resA.status, 200);
  const dataA = await resA.json();
  assert.equal(dataA.goal.id, 'goal-race-1');
  assert.equal(dataA.goal.lease_owner, 'worker-A');
  assert.equal(dataA.goal.lease_epoch, 1);

  // Worker B immediately tries to acquire the same goal while lease is active
  const reqB = new Request('https://worker/api/lease/acquire', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 'worker-B', goalId: 'goal-race-1' })
  });
  const resB = await worker.fetch(reqB, env);
  assert.equal(resB.status, 200);
  const dataB = await resB.json();
  // Worker B must be rejected because Worker A has active lease
  assert.equal(dataB.goal, null);
  assert.equal(dataB.conflict, true);
});

test('Lease heartbeat and step fence outdated epochs with HTTP 409', async () => {
  const db = new MockD1Database();
  const token = 'secret-token-test';
  const env = { DB: db, BOTAUTOTASK_API_TOKEN: token };

  db.insertGoal({
    id: 'goal-fence-1',
    title: 'Test Fence Goal',
    target_prompt: 'Do task',
    status: 'RUNNING_LOCAL',
    lease_expires_at: Date.now() + 60000,
    lease_owner: 'worker-A',
    lease_epoch: 5,
    created_at: 1000,
    updated_at: 1000
  });

  // Valid heartbeat with matching epoch
  const hbReqValid = new Request('https://worker/api/lease/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal_id: 'goal-fence-1', worker_id: 'worker-A', lease_epoch: 5 })
  });
  const hbResValid = await worker.fetch(hbReqValid, env);
  assert.equal(hbResValid.status, 200);

  // Outdated worker tries heartbeat with stale epoch 4 -> 409 Conflict
  const hbReqStale = new Request('https://worker/api/lease/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal_id: 'goal-fence-1', worker_id: 'worker-A', lease_epoch: 4 })
  });
  const hbResStale = await worker.fetch(hbReqStale, env);
  assert.equal(hbResStale.status, 409);

  // Stale worker tries to report step with old epoch 4 -> 409 Conflict
  const stepReqStale = new Request('https://worker/api/lease/step', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal_id: 'goal-fence-1',
      worker_id: 'worker-A',
      lease_epoch: 4,
      step_number: 1,
      core_used: 'opencode',
      model_used: 'deepseek-v4.1-flash-free',
      outcome: 'STEP_PROGRESSED',
      summary: 'Stale attempt'
    })
  });
  const stepResStale = await worker.fetch(stepReqStale, env);
  assert.equal(stepResStale.status, 409);
  const stepData = await stepResStale.json();
  assert.equal(stepData.epoch_mismatch, true);
});
