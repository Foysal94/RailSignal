import { describe, it, expect } from 'vitest';
import {
  TFL_LINES,
  TFL_LINE_IDS,
  getTflLineById,
  isValidLineId,
  getLinesByMode,
} from '../src/lines.js';

describe('TfL Line Definitions', () => {
  it('Should_contain_all_core_london_transit_lines', () => {
    expect(TFL_LINES.length).toBeGreaterThanOrEqual(14);
    expect(TFL_LINE_IDS).toContain('bakerloo');
    expect(TFL_LINE_IDS).toContain('central');
    expect(TFL_LINE_IDS).toContain('northern');
    expect(TFL_LINE_IDS).toContain('victoria');
    expect(TFL_LINE_IDS).toContain('elizabeth');
    expect(TFL_LINE_IDS).toContain('dlr');
    expect(TFL_LINE_IDS).toContain('london-overground');
  });

  it('Should_flag_northern_line_for_contrast_border', () => {
    const northern = getTflLineById('northern');
    expect(northern).toBeDefined();
    expect(northern?.color).toBe('#000000');
    expect(northern?.contrastBorder).toBe(true);
  });

  it('Should_validate_line_ids_correctly', () => {
    expect(isValidLineId('victoria')).toBe(true);
    expect(isValidLineId('invalid-line-id')).toBe(false);
  });

  it('Should_filter_lines_by_transit_mode', () => {
    const tubeLines = getLinesByMode('tube');
    expect(tubeLines.length).toBe(11);
    expect(tubeLines.every((line) => line.mode === 'tube')).toBe(true);

    const overgroundLines = getLinesByMode('overground');
    expect(overgroundLines.length).toBeGreaterThan(0);
    expect(overgroundLines.every((line) => line.mode === 'overground')).toBe(true);
  });
});
