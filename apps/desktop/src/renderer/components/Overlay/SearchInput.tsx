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
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  const placeholder =
    status === 'listening' ? 'Listening...' :
    status === 'transcribing' ? 'Transcribing...' :
    'Search scripture, reference, or spoken phrase';

  return (
    <div className="no-drag px-3 pt-3 pb-2">
      <div className="flex h-12 items-center gap-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 shadow-inner shadow-black/20">
        <svg
          className="h-4 w-4 flex-shrink-0 text-amber-300/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={isRecording}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-100
                     placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        <motion.button
          onClick={onMicClick}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-colors
                      ${isRecording
                        ? 'border-red-400/40 bg-red-500 text-white shadow-lg shadow-red-500/25'
                        : 'border-white/[0.06] bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200'
                      }`}
          title={isRecording ? 'Stop recording' : 'Push to talk'}
          aria-label={isRecording ? 'Stop recording' : 'Push to talk'}
        >
          {isRecording ? (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
            </svg>
          )}
        </motion.button>
      </div>
    </div>
  );
}
