import { isValidLineId, TFL_LINE_IDS } from '@railsignal/shared';
import type { Queue } from 'bullmq';
import {
  type DemoAlertJobData,
  demoAlertQueue as defaultDemoAlertQueue,
} from '../../queues/queues.js';

export interface EnqueueDemoAlertOptions {
  queue?: Pick<Queue<DemoAlertJobData, void, string>, 'add'> | undefined;
  email: string;
  lineIds?: string[] | undefined;
  lines?: string[] | undefined;
}

export interface EnqueueDemoAlertResult {
  status: 'queued';
  email: string;
}

export class InvalidDemoLineSelectionError extends Error {
  constructor(public readonly invalidLines: string[]) {
    super(`Invalid TfL line IDs: ${invalidLines.join(', ')}`);
    this.name = 'InvalidDemoLineSelectionError';
  }
}

/**
 * Validates portfolio visitor email and line selection, enqueuing on-demand demo alert.
 */
export async function enqueueDemoAlert(
  options: EnqueueDemoAlertOptions,
): Promise<EnqueueDemoAlertResult> {
  const queue = options.queue ?? defaultDemoAlertQueue;
  const normalizedEmail = options.email.trim().toLowerCase();

  const selectedLines = options.lineIds ?? options.lines;
  let linesToQueue: string[];

  if (selectedLines !== undefined) {
    const invalidLines = selectedLines.filter((id) => !isValidLineId(id));
    if (invalidLines.length > 0) {
      throw new InvalidDemoLineSelectionError(invalidLines);
    }
    linesToQueue = selectedLines;
  } else {
    // If visitor doesn't pick specific lines, default to all tracked TfL lines
    linesToQueue = [...TFL_LINE_IDS];
  }

  await queue.add('send-demo-alert', {
    email: normalizedEmail,
    lines: linesToQueue,
  });

  return {
    status: 'queued',
    email: normalizedEmail,
  };
}
