import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useConnectionStore } from '../../store/connection-store';

interface Props {
  readonly children: ReactNode;
}

export function ConnectionGuard({ children }: Props) {
  const config = useConnectionStore((s) => s.config);

  if (!config) {
    return <Navigate to="/settings" replace />;
  }

  return <>{children}</>;
}
