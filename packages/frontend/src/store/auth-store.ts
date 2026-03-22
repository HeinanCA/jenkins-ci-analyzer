import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: { id: string; email: string; name: string } | null;
  readonly instanceId: string | null;
  readonly organizationId: string | null;
  readonly setUser: (user: { id: string; email: string; name: string } | null) => void;
  readonly setInstanceId: (id: string | null) => void;
  readonly setOrganizationId: (id: string | null) => void;
  readonly logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      instanceId: null,
      organizationId: null,
      setUser: (user) =>
        set({ user, isAuthenticated: user !== null }),
      setInstanceId: (instanceId) => set({ instanceId }),
      setOrganizationId: (organizationId) => set({ organizationId }),
      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          instanceId: null,
          organizationId: null,
        }),
    }),
    {
      name: 'tig-auth',
    },
  ),
);
