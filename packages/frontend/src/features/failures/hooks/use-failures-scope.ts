import { useState } from 'react';

const STORAGE_KEY = 'pulsci_failures_scope';
const VALID_SCOPES = new Set(['mine', 'all']);

function readStoredScope(): 'mine' | 'all' {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null && VALID_SCOPES.has(raw)) {
      return raw as 'mine' | 'all';
    }
  } catch {
    // localStorage may be unavailable (SSR, private mode restrictions)
  }
  return 'mine';
}

function writeScope(scope: 'mine' | 'all'): void {
  try {
    localStorage.setItem(STORAGE_KEY, scope);
  } catch {
    // Best-effort
  }
}

export function useFailuresScope(): ['mine' | 'all', (s: 'mine' | 'all') => void] {
  const [scope, setScope] = useState<'mine' | 'all'>(readStoredScope);

  function handleSet(next: 'mine' | 'all'): void {
    writeScope(next);
    setScope(next);
  }

  return [scope, handleSet];
}
