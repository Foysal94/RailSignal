import { useCallback, useState } from 'react';

export interface UseDisclosureReturn {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

// Isolates disclosure state outside presentational components to maintain pure leaf component contracts (client/AGENTS.md).
export function useDisclosure(initialState = false): UseDisclosureReturn {
  const [isOpen, setIsOpen] = useState(initialState);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, toggle, open, close };
}
