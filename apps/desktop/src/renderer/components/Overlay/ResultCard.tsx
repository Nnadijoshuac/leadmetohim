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
  const confidencePct = Math.round(confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mx-3 mb-1 rounded-xl overflow-hidden
                 bg-white/[0.04] border border-white/[0.06]
                 hover:bg-white/[0.06] transition-colors"
    >
      {/* Reference bar */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400 font-semibold text-lg tracking-tight">
            {reference.display}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/[0.07] text-slate-400 font-mono">
            {queryType === 'explicit' ? 'exact' : queryType}
          </span>
        </div>

        {/* Confidence pill */}
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full confidence-bar transition-all"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{confidencePct}%</span>
        </div>
      </div>

      {/* Verse text */}
      {verseText && (
        <p className="px-4 pb-3 text-sm text-slate-300 leading-relaxed font-normal
                      line-clamp-3 italic">
          "{verseText}"
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-0.5">
        <ActionButton
          label="Insert"
          hint="↵"
          onClick={() => onInsert()}
          primary
        />
        <ActionButton
          label="Ref only"
          hint=""
          onClick={() => onInsert('reference')}
        />
        <ActionButton
          label="Verse only"
          hint=""
          onClick={() => onInsert('verse')}
        />
        <div className="flex-1" />
        <ActionButton
          label="Copy"
          hint="⇥"
          onClick={onCopy}
          icon={
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>
    </motion.div>
  );
}

interface ActionButtonProps {
  label: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
  icon?: React.ReactNode;
}

function ActionButton({ label, hint, onClick, primary, icon }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                  transition-all duration-150 active:scale-95
                  ${primary
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/20'
                    : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.09] hover:text-slate-300 border border-white/[0.04]'
                  }`}
    >
      {icon}
      {label}
      {hint && (
        <span className="text-[10px] opacity-50 font-mono">{hint}</span>
      )}
    </button>
  );
}
