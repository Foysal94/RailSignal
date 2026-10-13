import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../../src/jobs/cliArgs.js';

describe('CLI Argument Parser', () => {
  it('Should_return_empty_options_when_no_arguments_provided', () => {
    const result = parseCliArgs([]);
    expect(result.job).toBeUndefined();
  });

  it('Should_parse_job_name_when_passed_as_separate_argument', () => {
    const result = parseCliArgs(['--job', 'sync-disruptions']);
    expect(result.job).toBe('sync-disruptions');
  });

  it('Should_parse_job_name_when_passed_with_equals_syntax', () => {
    const result = parseCliArgs(['--job=sync-disruptions']);
    expect(result.job).toBe('sync-disruptions');
  });

  it('Should_ignore_unrelated_flags_and_positional_arguments', () => {
    const result = parseCliArgs([
      'node',
      'dist/index.js',
      '--job',
      'sync-disruptions',
      '--verbose',
    ]);
    expect(result.job).toBe('sync-disruptions');
  });
});
