import { create } from 'zustand';
import type { SearchResult, OverlayStatus, InsertMode } from '@leadmetohim/shared-types';

interface SearchState {
  query: string;
  status: OverlayStatus;
  result: SearchResult | null;
  errorMessage: string | null;
  isRecording: boolean;

  setQuery: (q: string) => void;
  setStatus: (s: OverlayStatus) => void;
  setResult: (r: SearchResult | null) => void;
  setError: (msg: string | null) => void;
  setRecording: (v: boolean) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  status: 'idle',
  result: null,
  errorMessage: null,
  isRecording: false,

  setQuery: (q) => set({ query: q }),
  setStatus: (s) => set({ status: s }),
  setResult: (r) => set({ result: r }),
  setError: (msg) => set({ errorMessage: msg }),
  setRecording: (v) => set({ isRecording: v }),
  reset: () => set({ query: '', status: 'idle', result: null, errorMessage: null, isRecording: false }),
}));
