import React from 'react';
import { motion } from 'framer-motion';
import type { AlternativeResult } from '@leadmetohim/shared-types';

interface AlternativeResultsProps {
  alternatives: AlternativeResult[];
  onSelect: (ref: string) => void;
}

export function AlternativeResults({ alternatives, onSelect }: AlternativeResultsProps) {
  if (!alternatives.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.08 }}
      className="px-3 pb-3"
    >
      <div className="flex items-center gap-1.5 overflow-hidden">
        <span className="flex-shrink-0 text-xs font-medium text-slate-600">Also</span>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {alternatives.map((alt) => (
            <button
              key={alt.reference.display}
              onClick={() => onSelect(alt.reference.display)}
              className="no-drag max-w-[11rem] truncate rounded-md border border-white/[0.05] bg-white/[0.035]
                         px-2 py-1 text-xs font-medium text-slate-500 transition-colors
                         hover:border-amber-400/20 hover:bg-amber-400/10 hover:text-amber-200"
              title={alt.reference.display}
            >
              {alt.reference.display}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
