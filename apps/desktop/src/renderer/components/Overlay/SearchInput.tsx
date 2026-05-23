import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { OverlayStatus } from '@leadmetohim/shared-types';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  status: OverlayStatus;
  isRecording: boolean;
  onMicClick: () => void;
}

export function SearchInput({ value, onChange, status, isRecording, onMicClick }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus when overlay shows
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  const placeholder =
    status === 'listening' ? 'Listening…' :
    status === 'transcribing' ? 'Transcribing…' :
    'Search scripture or speak a phrase…';

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 no-drag">
      {/* Search icon */}
      <svg
        className="w-4 h-4 text-slate-500 flex-shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={isRecording}
        className="flex-1 text-base font-normal text-slate-100 placeholder-slate-500
                   bg-transparent border-none outline-none no-drag
                   disabled:opacity-50 disabled:cursor-not-allowed"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* Mic button */}
      <motion.button
        onClick={onMicClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                    transition-colors no-drag
                    ${isRecording
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600/80 hover:text-slate-300'
                    }`}
        title={isRecording ? 'Stop recording (PTT)' : 'Push-to-talk (Alt+R)'}
      >
        {isRecording ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
          </svg>
        )}
      </motion.button>

      {/* Hotkey hint */}
      <span className="flex-shrink-0 text-xs text-slate-600 font-mono hidden sm:inline">
        ESC
      </span>
    </div>
  );
}
