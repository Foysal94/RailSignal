export interface WorkerLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}
