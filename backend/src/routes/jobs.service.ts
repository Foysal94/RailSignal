import type { Queue } from 'bullmq';
import {
  ingestQueue as defaultIngestQueue,
  type IngestJobData,
  type IngestJobResult,
} from '../queues/queues.js';

export interface EnqueueSyncJobOptions {
  queue?: Pick<Queue<IngestJobData, IngestJobResult, string>, 'add'> | undefined;
  expectedSecret?: string | undefined;
  providedSecret?: string | undefined;
  referenceDate?: string | undefined;
  force?: boolean | undefined;
}

export type EnqueueSyncJobResult =
  | { status: 'unauthorized' }
  | { status: 'queued'; jobId?: string | undefined };

/**
 * Enforces secret-based job authentication and dispatches ingestion pipeline job to BullMQ.
 */
export async function enqueueSyncDisruptionsJob(
  options: EnqueueSyncJobOptions,
): Promise<EnqueueSyncJobResult> {
  const { expectedSecret, providedSecret, referenceDate, force } = options;

  // Header verification: both expected and provided secrets must be non-empty and equal
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return { status: 'unauthorized' };
  }

  const queue = options.queue ?? defaultIngestQueue;
  const job = await queue.add('sync-weekend-disruptions', {
    referenceDate,
    force,
  });

  return {
    status: 'queued',
    ...(job.id ? { jobId: String(job.id) } : {}),
  };
}
