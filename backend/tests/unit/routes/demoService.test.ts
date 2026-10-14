import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { DemoAlertJobData } from '../../../src/queues/queues.js';
import { enqueueDemoAlert, InvalidDemoLineSelectionError } from '../../../src/routes/demo/index.js';

describe('Demo Alert Service Unit Tests', () => {
  it('Should_throw_InvalidDemoLineSelectionError_when_unknown_line_ids_passed', async () => {
    const mockQueue = {
      add: vi.fn(),
    } as unknown as Queue<DemoAlertJobData, void, string>;

    await expect(
      enqueueDemoAlert({
        queue: mockQueue,
        email: 'test@example.com',
        lineIds: ['bakerloo', 'invalid-line-xyz'],
      }),
    ).rejects.toThrow(InvalidDemoLineSelectionError);

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('Should_normalize_email_and_enqueue_selected_lines', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    } as unknown as Queue<DemoAlertJobData, void, string>;

    const result = await enqueueDemoAlert({
      queue: mockQueue,
      email: '  Visitor@Example.COM  ',
      lineIds: ['central', 'northern'],
    });

    expect(result).toEqual({
      status: 'queued',
      email: 'visitor@example.com',
    });

    expect(mockQueue.add).toHaveBeenCalledWith('send-demo-alert', {
      email: 'visitor@example.com',
      lines: ['central', 'northern'],
    });
  });
});
