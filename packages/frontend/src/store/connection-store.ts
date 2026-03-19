import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConnectionConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly token: string;
}

interface ConnectionState {
  readonly config: ConnectionConfig | null;
  readonly isConnected: boolean;
  readonly setConfig: (config: ConnectionConfig) => void;
  readonly clearConfig: () => void;
  readonly setConnected: (connected: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set) => ({
      config: null,
      isConnected: false,
      setConfig: (config: ConnectionConfig) =>
        set({ config, isConnected: false }),
      clearConfig: () => set({ config: null, isConnected: false }),
      setConnected: (connected: boolean) => set({ isConnected: connected }),
    }),
    {
      name: 'jenkins-connection',
      partialize: (state) => ({ config: state.config }),
    },
  ),
);

export type { ConnectionConfig };
