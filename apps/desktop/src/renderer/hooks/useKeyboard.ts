import { useEffect } from 'react';
import type { SearchResult } from '@leadmetohim/shared-types';

interface UseKeyboardOptions {
  result: SearchResult | null;
  onInsert: (result: SearchResult) => void;
  onCopy: (result: SearchResult) => void;
  onDismiss: () => void;
}

export function useKeyboard({ result, onInsert, onCopy, onDismiss }: UseKeyboardOptions) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }

      if (!result) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onInsert(result);
        return;
      }

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        onCopy(result);
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [result, onInsert, onCopy, onDismiss]);
}
