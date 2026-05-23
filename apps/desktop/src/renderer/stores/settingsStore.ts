import { create } from 'zustand';
import type { AppSettings, ModelStatus } from '@leadmetohim/shared-types';
import { DEFAULT_SETTINGS } from '@leadmetohim/shared-types';

interface SettingsState {
  settings: AppSettings;
  modelStatus: ModelStatus;
  loaded: boolean;

  setSettings: (s: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setModelStatus: (s: ModelStatus) => void;
  setLoaded: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  modelStatus: { whisper: 'missing', embedder: 'missing' },
  loaded: false,

  setSettings: (s) => set({ settings: s }),
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  setModelStatus: (s) => set({ modelStatus: s }),
  setLoaded: (v) => set({ loaded: v }),
}));
