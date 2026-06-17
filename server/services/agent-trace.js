/**
 * Agent Trace — observability layer for Strategy Agent runs.
 *
 * AgentTracer tracks every pipeline step (timing, inputs, outputs, errors)
 * and persists them to the agent_traces / agent_trace_steps tables.
 */
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger.js';

const log = createLogger('agent-trace');

// ============================================================
// AgentTracer class
// ============================================================

export class AgentTracer {
  /**
   * @param {object} db - SQLite database instance
   * @param {string} trigger - 'generate' | 'regenerate' | 'compare'
   * @param {number[]} assetIds
   * @param {object} params - { budget, goal, riskLevel }
   */
  constructor(db, trigger, assetIds, params) {
    this.db = db;
    this.runId = randomUUID();
    this.traceId = null;
    this._stepTimers = {};
    this._init(trigger, assetIds, params);
  }

  _init(trigger, assetIds, params) {
    try {
      const result = this.db.prepare(`
        INSERT INTO agent_traces (run_id, trigger, asset_ids, params, status)
        VALUES (?, ?, ?, ?, 'running')
      `).run(this.runId, trigger, JSON.stringify(assetIds), JSON.stringify(params || {}));
      this.traceId = result.lastInsertRowid;
      log.debug('Trace created', { traceId: this.traceId, runId: this.runId });
    } catch (e) {
      log.warn('Failed to create trace', { error: e.message });
      this.traceId = null;
    }
  }

  // Start a pipeline step
  startStep(stepName, inputSummary = null) {
    if (!this.traceId) return;
    this._stepTimers[stepName] = Date.now();
    try {
      this.db.prepare(`
        INSERT INTO agent_trace_steps (trace_id, step_name, status, input_summary, started_at)
        VALUES (?, ?, 'running', ?, datetime('now'))
      `).run(this.traceId, stepName, inputSummary ? JSON.stringify(inputSummary) : null);
    } catch (e) {
      log.warn('Failed to start step', { stepName, error: e.message });
    }
  }

  // Complete a pipeline step successfully
  completeStep(stepName, outputSummary = null) {
    if (!this.traceId) return;
    const elapsed = this._stepTimers[stepName] ? Date.now() - this._stepTimers[stepName] : null;
    delete this._stepTimers[stepName];
    try {
      this.db.prepare(`
        UPDATE agent_trace_steps
        SET status = 'done', output_summary = ?, elapsed_ms = ?, completed_at = datetime('now')
        WHERE trace_id = ? AND step_name = ? AND status = 'running'
      `).run(outputSummary ? JSON.stringify(outputSummary) : null, elapsed, this.traceId, stepName);
    } catch (e) {
      log.warn('Failed to complete step', { stepName, error: e.message });
    }
  }

  // Mark a pipeline step as failed
  failStep(stepName, error) {
    if (!this.traceId) return;
    const elapsed = this._stepTimers[stepName] ? Date.now() - this._stepTimers[stepName] : null;
    delete this._stepTimers[stepName];
    try {
      this.db.prepare(`
        UPDATE agent_trace_steps
        SET status = 'failed', error = ?, elapsed_ms = ?, completed_at = datetime('now')
        WHERE trace_id = ? AND step_name = ? AND status = 'running'
      `).run(String(error), elapsed, this.traceId, stepName);
    } catch (e) {
      log.warn('Failed to fail step', { stepName, error: e.message });
    }
  }

  // Mark a step as skipped (e.g. fallback path)
  skipStep(stepName, reason = '') {
    if (!this.traceId) return;
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO agent_trace_steps
          (trace_id, step_name, status, error, started_at, completed_at)
        VALUES (?, ?, 'skipped', ?, datetime('now'), datetime('now'))
      `).run(this.traceId, stepName, reason || null);
    } catch (e) {
      log.warn('Failed to skip step', { stepName, error: e.message });
    }
  }

  // Update data quality score on the trace
  setDataQuality(score) {
    if (!this.traceId) return;
    try {
      this.db.prepare(`
        UPDATE agent_traces SET data_quality_score = ?, updated_at = datetime('now') WHERE id = ?
      `).run(score, this.traceId);
    } catch {}
  }

  // Persist a resumable checkpoint payload for a completed pipeline stage.
  saveCheckpoint(stepName, payload) {
    if (!this.traceId || !stepName || payload === undefined) return;
    try {
      this.db.prepare(`
        INSERT INTO agent_resume_checkpoints (trace_id, step_name, payload)
        VALUES (?, ?, ?)
        ON CONFLICT(trace_id, step_name) DO UPDATE SET
          payload = excluded.payload,
          updated_at = datetime('now')
      `).run(this.traceId, stepName, JSON.stringify(payload));
    } catch (e) {
      log.warn('Failed to save checkpoint', { stepName, error: e.message });
    }
  }

  // Persist an auditable artifact such as a prompt, raw model response, parsed output, or validation report.
  saveArtifact(stepName, artifactType, content, metadata = null) {
    if (!this.traceId || !stepName || !artifactType || content === undefined) return;
    try {
      this.db.prepare(`
        INSERT INTO agent_artifacts (trace_id, step_name, artifact_type, content, metadata)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        this.traceId,
        stepName,
        artifactType,
        typeof content === 'string' ? content : JSON.stringify(content),
        metadata ? JSON.stringify(metadata) : null,
      );
    } catch (e) {
      log.warn('Failed to save artifact', { stepName, artifactType, error: e.message });
    }
  }

  // Mark trace as done with evaluation results
  complete({ evalScore = null, evalDetail = null, model = null, elapsedMs = null } = {}) {
    if (!this.traceId) return;
    try {
      this.db.prepare(`
        UPDATE agent_traces
        SET status = 'done', eval_score = ?, eval_detail = ?, model = ?, elapsed_ms = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        evalScore != null ? Math.round(evalScore * 100) / 100 : null,
        evalDetail ? JSON.stringify(evalDetail) : null,
        model,
        elapsedMs,
        this.traceId,
      );
    } catch (e) {
      log.warn('Failed to complete trace', { error: e.message });
    }
  }

  // Mark trace as partially done (some steps failed but result still produced)
  partial({ evalScore = null, evalDetail = null, model = null, elapsedMs = null } = {}) {
    if (!this.traceId) return;
    try {
      this.db.prepare(`
        UPDATE agent_traces
        SET status = 'partial', eval_score = ?, eval_detail = ?, model = ?, elapsed_ms = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        evalScore != null ? Math.round(evalScore * 100) / 100 : null,
        evalDetail ? JSON.stringify(evalDetail) : null,
        model,
        elapsedMs,
        this.traceId,
      );
    } catch {}
  }

  // Mark trace as failed
  fail(error) {
    if (!this.traceId) return;
    try {
      this.db.prepare(`
        UPDATE agent_traces
        SET status = 'failed', error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(String(error), this.traceId);
    } catch {}
  }

  // Link this trace to an ai_generation_logs entry
  linkGenerationLog(generationLogId) {
    if (!this.traceId) return;
    try {
      this.db.prepare(`
        UPDATE agent_traces SET generation_log_id = ? WHERE id = ?
      `).run(generationLogId, this.traceId);
    } catch {}
  }
}

// ============================================================
// Query helpers
// ============================================================

/**
 * List recent traces (lightweight, no step details)
 */
export function queryTraces(db, { limit = 30, assetId, status } = {}) {
  const conditions = [];
  const params = [];
  if (assetId) { conditions.push("t.asset_ids LIKE ?"); params.push(`%${assetId}%`); }
  if (status)  { conditions.push("t.status = ?"); params.push(status); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limit);

  try {
    const rows = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM agent_trace_steps s WHERE s.trace_id = t.id) as step_count,
        (SELECT COUNT(*) FROM agent_trace_steps s WHERE s.trace_id = t.id AND s.status = 'failed') as failed_steps
      FROM agent_traces t
      ${where}
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(...params);

    return rows.map(normalizeTrace);
  } catch (e) {
    log.warn('Failed to query traces', { error: e.message });
    return [];
  }
}

/**
 * Get full trace with step details
 */
export function getTraceDetails(db, traceId) {
  try {
    const trace = db.prepare('SELECT * FROM agent_traces WHERE id = ?').get(traceId);
    if (!trace) return null;
    const steps = db.prepare(
      'SELECT * FROM agent_trace_steps WHERE trace_id = ? ORDER BY id ASC'
    ).all(traceId);
    const artifacts = db.prepare(
      'SELECT * FROM agent_artifacts WHERE trace_id = ? ORDER BY id ASC'
    ).all(traceId);
    return { ...normalizeTrace(trace), steps: steps.map(normalizeStep), artifacts: artifacts.map(normalizeArtifact) };
  } catch (e) {
    log.warn('Failed to get trace details', { error: e.message });
    return null;
  }
}

export function getTraceForResume(db, traceId) {
  try {
    const trace = db.prepare('SELECT * FROM agent_traces WHERE id = ?').get(traceId);
    return normalizeTrace(trace);
  } catch (e) {
    log.warn('Failed to get resume trace', { traceId, error: e.message });
    return null;
  }
}

export function getResumeCheckpoints(db, traceId) {
  try {
    const rows = db.prepare(
      'SELECT step_name, payload FROM agent_resume_checkpoints WHERE trace_id = ? ORDER BY id ASC'
    ).all(traceId);
    const checkpoints = {};
    for (const row of rows) {
      try {
        checkpoints[row.step_name] = JSON.parse(row.payload);
      } catch {
        checkpoints[row.step_name] = null;
      }
    }
    return checkpoints;
  } catch (e) {
    log.warn('Failed to load resume checkpoints', { traceId, error: e.message });
    return {};
  }
}

function normalizeTrace(row) {
  if (!row) return null;
  try { if (row.params) row.params = JSON.parse(row.params); } catch {}
  try { if (row.asset_ids) row.asset_ids = JSON.parse(row.asset_ids); } catch {}
  try { if (row.eval_detail) row.eval_detail = JSON.parse(row.eval_detail); } catch {}
  return row;
}

function normalizeStep(row) {
  if (!row) return null;
  try { if (row.input_summary) row.input_summary = JSON.parse(row.input_summary); } catch {}
  try { if (row.output_summary) row.output_summary = JSON.parse(row.output_summary); } catch {}
  return row;
}

function normalizeArtifact(row) {
  if (!row) return null;
  try { if (row.content) row.content = JSON.parse(row.content); } catch {}
  try { if (row.metadata) row.metadata = JSON.parse(row.metadata); } catch {}
  return row;
}

