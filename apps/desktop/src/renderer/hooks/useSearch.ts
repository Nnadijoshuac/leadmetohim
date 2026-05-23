import { useCallback, useRef } from 'react';
import { useSearchStore } from '../stores/searchStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import type { InsertMode, SearchResult } from '@leadmetohim/shared-types';

const DEBOUNCE_MS = 300;

export function useSearch() {
  const { query, status, result, errorMessage, setQuery, setStatus, setResult, setError } =
    useSearchStore();
  const { settings } = useSettingsStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResult(null);
        setStatus('idle');
        return;
      }

      setStatus('searching');
      setError(null);

      try {
        const res = await window.electronAPI.scripture.search(q);
        setResult(res);
        setStatus(res ? 'result' : 'idle');
      } catch (e) {
        setError('Search failed. Please try again.');
        setStatus('error');
      }
    },
    [setResult, setStatus, setError],
  );

  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(q), DEBOUNCE_MS);
    },
    [setQuery, search],
  );

  const insert = useCallback(
    async (result: SearchResult, mode?: InsertMode) => {
      const insertMode = mode ?? settings.insertMode;
      const text = buildInsertText(result, insertMode);
      await window.electronAPI.scripture.insert(text, insertMode);
    },
    [settings.insertMode],
  );

  const copyToClipboard = useCallback(
    async (result: SearchResult) => {
      const text = buildInsertText(result, settings.insertMode);
      await window.electronAPI.scripture.insert(text, 'copy');
    },
    [settings.insertMode],
  );

  return {
    query,
    status,
    result,
    errorMessage,
    handleQueryChange,
    search,
    insert,
    copyToClipboard,
  };
}

function buildInsertText(result: SearchResult, mode: InsertMode): string {
  const ref = result.reference.display;
  const verse = result.verseText ? `"${result.verseText}"` : '';

  switch (mode) {
    case 'reference':
      return ref;
    case 'verse':
      return verse || ref;
    case 'reference+verse':
      return verse ? `${ref} — ${verse}` : ref;
    case 'copy':
      return verse ? `${ref} — ${verse}` : ref;
    default:
      return ref;
  }
}
