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

const OVERLAY_BASE_H = 72;
const OVERLAY_RESULT_H = 320;
const OVERLAY_ALTERNATIVES_H = 40;

export function Overlay() {
  const { settings } = useSettingsStore();
  const { status, result, errorMessage, isRecording } = useSearchStore();
  const { query, handleQueryChange, insert, copyToClipboard, search } = useSearch();

  // Adjust window height reactively
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
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
    <div className="w-full h-full flex flex-col items-stretch p-0">
      <div className="glass rounded-2xl overflow-hidden flex flex-col w-full drag-region">

        {/* ── Search bar ───────────────────────────────────────────────── */}
        <SearchInput
          value={query}
          onChange={handleQueryChange}
          status={status}
          isRecording={isRecording}
          onMicClick={handleMicClick}
        />

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {(showResult || showError || status === 'searching') && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              className="h-px bg-white/[0.06] mx-4"
            />
          )}
        </AnimatePresence>

        {/* ── Searching skeleton ───────────────────────────────────────── */}
        <AnimatePresence>
          {status === 'searching' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-4"
            >
              <div className="flex gap-2 items-center">
                <div className="w-4 h-4 border-2 border-amber-500/40 border-t-amber-400
                                rounded-full animate-spin" />
                <span className="text-sm text-slate-500">Searching scripture…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Result ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {showResult && result && (
            <motion.div
              key={result.reference.display}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-2 pb-1"
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

        {/* ── Error ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 text-sm text-red-400"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.04]">
          <StatusIndicator status={status} isRecording={isRecording} />

          <div className="flex items-center gap-3 text-[11px] text-slate-600 no-drag">
            <span><kbd className="font-mono">↵</kbd> insert</span>
            <span><kbd className="font-mono">⇥</kbd> copy</span>
            <span><kbd className="font-mono">ESC</kbd> close</span>
            <button
              onClick={() => window.electronAPI.system.openSettings()}
              className="text-slate-700 hover:text-slate-400 transition-colors ml-1"
              title="Settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
