import React from 'react';
import { motion } from 'framer-motion';
import type { SearchResult, InsertMode } from '@leadmetohim/shared-types';

interface ResultCardProps {
  result: SearchResult;
  onInsert: (mode?: InsertMode) => void;
  onCopy: () => void;
}

export function ResultCard({ result, onInsert, onCopy }: ResultCardProps) {
  const { reference, verseText, confidence, queryType } = result;
  const confidencePct = Math.max(0, Math.min(100, Math.round(confidence * 100)));
  const queryLabel = queryType === 'explicit' ? 'exact' : queryType;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mx-3 mb-2 overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.045]"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold leading-6 text-amber-300">
            {reference.display}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {queryLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 pt-1">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full confidence-bar transition-all"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs tabular-nums text-slate-500">{confidencePct}%</span>
        </div>
      </div>

      {verseText && (
        <p className="px-4 pb-3 text-sm leading-6 text-slate-300 line-clamp-4">
          {verseText}
        </p>
      )}

      <div className="flex items-center gap-1.5 border-t border-white/[0.05] px-3 py-2.5">
        <ActionButton label="Insert" hint="Enter" onClick={() => onInsert()} primary />
        <ActionButton label="Reference" onClick={() => onInsert('reference')} />
        <ActionButton label="Verse" onClick={() => onInsert('verse')} />
        <div className="flex-1" />
        <ActionButton
          label="Copy"
          hint="Tab"
          onClick={onCopy}
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          }
        />
      </div>
    </motion.div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  hint?: string;
  primary?: boolean;
  icon?: React.ReactNode;
}

function ActionButton({ label, hint, onClick, primary, icon }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`no-drag flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium
                  transition-all duration-150 active:scale-95
                  ${primary
                    ? 'border-amber-400/25 bg-amber-400/15 text-amber-200 hover:bg-amber-400/22'
                    : 'border-white/[0.06] bg-white/[0.045] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
    >
      {icon}
      <span>{label}</span>
      {hint && <span className="text-[10px] opacity-50">{hint}</span>}
    </button>
  );
}
