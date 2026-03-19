import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TeamScopeState {
  readonly selectedFolder: string | null;
  readonly availableFolders: readonly string[];
  readonly setSelectedFolder: (folder: string | null) => void;
  readonly setAvailableFolders: (folders: readonly string[]) => void;
}

export const useTeamScopeStore = create<TeamScopeState>()(
  persist(
    (set) => ({
      selectedFolder: null,
      availableFolders: [],
      setSelectedFolder: (folder: string | null) =>
        set({ selectedFolder: folder }),
      setAvailableFolders: (folders: readonly string[]) =>
        set({ availableFolders: folders }),
    }),
    {
      name: 'jenkins-team-scope',
      partialize: (state) => ({
        selectedFolder: state.selectedFolder,
      }),
    },
  ),
);
