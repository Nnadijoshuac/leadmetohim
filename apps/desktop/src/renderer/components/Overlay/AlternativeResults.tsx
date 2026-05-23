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
      transition={{ delay: 0.1 }}
      className="px-4 pb-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-600 font-medium">Also:</span>
        {alternatives.map((alt) => (
          <button
            key={alt.reference.display}
            onClick={() => onSelect(alt.reference.display)}
            className="no-drag text-xs text-slate-500 hover:text-amber-400
                       transition-colors font-medium hover:underline decoration-amber-400/50"
          >
            {alt.reference.display}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
