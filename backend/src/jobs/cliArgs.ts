import { parseArgs } from 'node:util';

export interface ParsedCliArgs {
  job?: string | undefined;
}

/**
 * Parses command-line arguments to extract scheduled job execution flags.
 * Uses Node's built-in util.parseArgs in non-strict mode to tolerate
 * runtime arguments without throwing on unknown flags.
 */
export function parseCliArgs(args: string[] = process.argv.slice(2)): ParsedCliArgs {
  const { values } = parseArgs({
    args,
    options: {
      job: {
        type: 'string',
      },
    },
    strict: false,
    allowPositionals: true,
  });

  return {
    job: typeof values.job === 'string' ? values.job : undefined,
  };
}
