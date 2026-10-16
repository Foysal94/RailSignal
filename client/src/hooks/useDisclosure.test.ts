import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDisclosure } from './useDisclosure';

describe('useDisclosure hook', () => {
  it('Should_default_to_closed_when_no_initial_state_provided', () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.isOpen).toBe(false);
  });

  it('Should_toggle_open_state_when_toggle_called', () => {
    const { result } = renderHook(() => useDisclosure(false));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('Should_explicitly_open_and_close', () => {
    const { result } = renderHook(() => useDisclosure(false));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });
});
