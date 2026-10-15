export interface EnqueuedJob<TData> {
  id: string;
  name: string;
  data: TData;
  opts?: { jobId?: string; [key: string]: unknown } | undefined;
}

// In-memory test double for BullMQ queues. Simulates Redis queue persistence and job
// enqueuing without spawning network sockets or requiring external Redis instances.
export class InMemoryQueueDouble<TData, TResult = void> {
  public readonly jobs: EnqueuedJob<TData>[] = [];

  public async add(
    name: string,
    data: TData,
    opts?: { jobId?: string; [key: string]: unknown },
  ): Promise<{ id: string; name: string; data: TData; returnvalue?: TResult }> {
    const id = opts?.jobId ?? `mock-job-${this.jobs.length + 1}-${Date.now()}`;
    const jobEntry: EnqueuedJob<TData> = { id, name, data, opts };
    this.jobs.push(jobEntry);
    return {
      id,
      name,
      data,
    };
  }

  public clear(): void {
    this.jobs.length = 0;
  }
}
