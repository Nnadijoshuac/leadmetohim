import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchInput } from './SearchInput.js';
import { ResultCard } from './ResultCard.js';
import { AlternativeResults } from './AlternativeResults.js';
import { StatusIndicator } from './StatusIndicator.js';
import { useSearch } from '../../hooks/useSearch.js';
import { useSpeech } from '../../hooks/useSpeech.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { useSearchStore } from '../../stores/searchStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import type { InsertMode } from '@leadmetohim/shared-types';

const OVERLAY_BASE_H = 92;
const OVERLAY_RESULT_H = 300;
const OVERLAY_ALTERNATIVES_H = 48;

export function Overlay() {
  const { settings } = useSettingsStore();
  const { status, result, errorMessage, isRecording } = useSearchStore();
  const { query, handleQueryChange, insert, copyToClipboard } = useSearch();

  useEffect(() => {
    let h = OVERLAY_BASE_H;
    if (result) h += OVERLAY_RESULT_H;
    if (result?.alternatives.length) h += OVERLAY_ALTERNATIVES_H;
    window.electronAPI.overlay.setHeight(h);
  }, [result]);

  const dismiss = useCallback(() => {
    window.electronAPI.overlay.hide();
  }, []);

  const handleInsert = useCallback(
    (mode?: InsertMode) => {
      if (result) insert(result, mode);
    },
    [result, insert],
  );

  const handleCopy = useCallback(() => {
    if (result) copyToClipboard(result);
  }, [result, copyToClipboard]);

  const handleTranscript = useCallback(
    (text: string) => {
      handleQueryChange(text);
    },
    [handleQueryChange],
  );

  const { startRecording, stopRecording } = useSpeech(handleTranscript);

  const handleMicClick = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const handleAlternativeSelect = useCallback(
    (ref: string) => {
      handleQueryChange(ref);
    },
    [handleQueryChange],
  );

  useKeyboard({
    result,
    onInsert: () => handleInsert(),
    onCopy: handleCopy,
    onDismiss: dismiss,
  });

  const showResult = result !== null && status !== 'searching';
  const showError = status === 'error' && !!errorMessage;

  return (
    <div className="flex h-full w-full flex-col items-stretch p-1.5">
      <div className="glass drag-region flex w-full flex-col overflow-hidden rounded-xl">
        <SearchInput
          value={query}
          onChange={handleQueryChange}
          status={status}
          isRecording={isRecording}
          onMicClick={handleMicClick}
        />

        <AnimatePresence>
          {(showResult || showError || status === 'searching') && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              className="mx-3 h-px origin-left bg-white/[0.06]"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'searching' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-4"
            >
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.035] px-3 py-3">
                <div className="h-4 w-4 rounded-full border-2 border-amber-500/30 border-t-amber-300 animate-spin" />
                <span className="text-sm font-medium text-slate-400">Searching scripture...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showResult && result && (
            <motion.div
              key={result.reference.display}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-2"
            >
              <ResultCard
                result={result}
                onInsert={handleInsert}
                onCopy={handleCopy}
              />

              {settings.showAlternatives && result.alternatives.length > 0 && (
                <AlternativeResults
                  alternatives={result.alternatives}
                  onSelect={handleAlternativeSelect}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-3 my-2 rounded-lg border border-red-500/15 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex h-9 items-center justify-between gap-3 border-t border-white/[0.04] px-3">
          <StatusIndicator status={status} isRecording={isRecording} />

          <div className="no-drag flex min-w-0 items-center gap-2 text-[11px] text-slate-600">
            <Shortcut label="Enter" action="insert" />
            <Shortcut label="Tab" action="copy" />
            <Shortcut label="Esc" action="close" />
            <button
              onClick={() => window.electronAPI.system.openSettings()}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
              title="Settings"
              aria-label="Settings"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ label, action }: { label: string; action: string }) {
  return (
    <span className="hidden items-center gap-1 sm:flex">
      <kbd className="rounded border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
        {label}
      </kbd>
      <span>{action}</span>
    </span>
  );
}
