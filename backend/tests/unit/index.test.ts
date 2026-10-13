import { describe, expect, it, vi } from 'vitest';
import { main } from '../../src/index.js';

describe('Root Entry Point (index.ts)', () => {
  it('Should_delegate_to_syncDisruptionsRunner_and_bypass_http_server_when_job_flag_provided', async () => {
    const mockRunSyncJob = vi.fn().mockResolvedValue(0);
    const mockStartHttpServer = vi.fn().mockResolvedValue(undefined);
    const mockExit = vi.fn();

    await main({
      argv: ['--job', 'sync-disruptions'],
      runSyncJob: mockRunSyncJob,
      startHttpServer: mockStartHttpServer,
      exit: mockExit,
    });

    expect(mockRunSyncJob).toHaveBeenCalledOnce();
    expect(mockStartHttpServer).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('Should_delegate_to_syncDisruptionsRunner_when_job_flag_provided_with_equals_syntax', async () => {
    const mockRunSyncJob = vi.fn().mockResolvedValue(0);
    const mockStartHttpServer = vi.fn().mockResolvedValue(undefined);

    await main({
      argv: ['--job=sync-disruptions'],
      runSyncJob: mockRunSyncJob,
      startHttpServer: mockStartHttpServer,
    });

    expect(mockRunSyncJob).toHaveBeenCalledOnce();
    expect(mockStartHttpServer).not.toHaveBeenCalled();
  });

  it('Should_log_error_and_exit_with_code_1_when_unknown_job_flag_provided', async () => {
    const mockRunSyncJob = vi.fn();
    const mockStartHttpServer = vi.fn();
    const mockExit = vi.fn();
    const mockLogger = {
      error: vi.fn(),
    };

    await main({
      argv: ['--job', 'unknown-task'],
      runSyncJob: mockRunSyncJob,
      startHttpServer: mockStartHttpServer,
      exit: mockExit,
      logger: mockLogger,
    });

    expect(mockRunSyncJob).not.toHaveBeenCalled();
    expect(mockStartHttpServer).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown job: "unknown-task"'),
    );
  });

  it('Should_boot_http_server_when_no_job_flag_provided', async () => {
    const mockRunSyncJob = vi.fn();
    const mockStartHttpServer = vi.fn().mockResolvedValue(undefined);

    await main({
      argv: [],
      runSyncJob: mockRunSyncJob,
      startHttpServer: mockStartHttpServer,
    });

    expect(mockRunSyncJob).not.toHaveBeenCalled();
    expect(mockStartHttpServer).toHaveBeenCalledOnce();
  });
});
