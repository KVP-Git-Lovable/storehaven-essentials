// Module-level singleton that keeps a "Retry selected" batch running even when
// the user navigates away from the Rate-limited Failures page and comes back.
//
// The runner is keyed (typically by journey id) so multiple journeys can have
// independent in-flight batches. React components subscribe via the returned
// listener API and re-render on every state change.

export type RetryItemState = "queued" | "sending" | "success" | "failed";

export interface RetryJobState {
  isRunning: boolean;
  countdown: number | null;
  // Ordered list of ids in this batch (so the UI can show what was queued
  // even after the source rows are refetched / changed).
  queueIds: string[];
  statuses: Record<string, { state: RetryItemState; error?: string }>;
  // Snapshot of the queued rows captured at runRetries() time. Used so the
  // table can still render contact name / phone / failed-at after the user
  // navigates away (which would otherwise lose the React query cache).
  rowSnapshots: Record<string, any>;
  startedAt: number | null;
  finishedAt: number | null;
  totals: { sent: number; failed: number };
}

type Listener = () => void;

interface InternalJob extends RetryJobState {
  listeners: Set<Listener>;
  abort: boolean;
}

const jobs = new Map<string, InternalJob>();

function ensure(key: string): InternalJob {
  let j = jobs.get(key);
  if (!j) {
    j = {
      isRunning: false,
      countdown: null,
      queueIds: [],
      statuses: {},
      rowSnapshots: {},
      startedAt: null,
      finishedAt: null,
      totals: { sent: 0, failed: 0 },
      listeners: new Set(),
      abort: false,
    };
    jobs.set(key, j);
  }
  return j;
}

function emit(job: InternalJob) {
  for (const l of job.listeners) l();
}

export function getRetryJob(key: string): RetryJobState {
  return ensure(key);
}

export function subscribeRetryJob(key: string, listener: Listener): () => void {
  const job = ensure(key);
  job.listeners.add(listener);
  return () => {
    job.listeners.delete(listener);
  };
}

export function resetRetryJob(key: string) {
  const job = ensure(key);
  if (job.isRunning) return; // don't wipe an active batch
  job.queueIds = [];
  job.statuses = {};
  job.rowSnapshots = {};
  job.startedAt = null;
  job.finishedAt = null;
  job.totals = { sent: 0, failed: 0 };
  emit(job);
}

export interface RunRetryOptions {
  rows: Array<{ id: string; [k: string]: any }>;
  spacingMs: number;
  send: (row: any) => Promise<{ success: boolean; error?: string }>;
  onComplete?: (totals: { sent: number; failed: number }) => void;
  /**
   * Number of rows to process in parallel per cycle. Defaults to 1 (serial).
   * When >1, each cycle dispatches up to `batchSize` rows concurrently and
   * then waits `spacingMs` before starting the next batch.
   */
  batchSize?: number;
}

export async function startRetryJob(key: string, opts: RunRetryOptions) {
  const job = ensure(key);
  if (job.isRunning) return;
  job.isRunning = true;
  job.abort = false;
  job.queueIds = opts.rows.map((r) => r.id);
  job.statuses = {};
  job.rowSnapshots = {};
  for (const r of opts.rows) {
    job.statuses[r.id] = { state: "queued" };
    job.rowSnapshots[r.id] = r;
  }
  job.startedAt = Date.now();
  job.finishedAt = null;
  job.totals = { sent: 0, failed: 0 };
  job.countdown = null;
  emit(job);

  const batchSize = Math.max(1, opts.batchSize ?? 1);

  const processOne = async (row: any) => {
    job.statuses[row.id] = { state: "sending" };
    emit(job);
    try {
      const res = await opts.send(row);
      if (res.success) {
        job.statuses[row.id] = { state: "success" };
        job.totals.sent++;
      } else {
        job.statuses[row.id] = { state: "failed", error: res.error || "Send not accepted" };
        job.totals.failed++;
      }
    } catch (e: any) {
      job.statuses[row.id] = { state: "failed", error: e?.message || "Error" };
      job.totals.failed++;
    }
    emit(job);
  };

  for (let i = 0; i < opts.rows.length; i += batchSize) {
    if (job.abort) break;
    const batch = opts.rows.slice(i, i + batchSize);
    await Promise.all(batch.map((row) => processOne(row)));

    if (i + batchSize < opts.rows.length && !job.abort) {
      const target = Date.now() + opts.spacingMs;
      while (Date.now() < target && !job.abort) {
        job.countdown = Math.max(0, Math.ceil((target - Date.now()) / 1000));
        emit(job);
        await new Promise((r) => setTimeout(r, 1000));
      }
      job.countdown = null;
      emit(job);
    }
  }

  job.isRunning = false;
  job.countdown = null;
  job.finishedAt = Date.now();
  emit(job);
  opts.onComplete?.(job.totals);
}

export function stopRetryJob(key: string) {
  const job = jobs.get(key);
  if (!job) return;
  job.abort = true;
}