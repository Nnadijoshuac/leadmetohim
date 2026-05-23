import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OverlayStatus } from '@leadmetohim/shared-types';

interface StatusIndicatorProps {
  status: OverlayStatus;
  isRecording: boolean;
}

const STATUS_CONFIG: Record<OverlayStatus, { label: string; color: string }> = {
  idle:        { label: 'Ready',         color: 'bg-slate-600' },
  listening:   { label: 'Listening…',    color: 'bg-red-500' },
  transcribing:{ label: 'Transcribing…', color: 'bg-amber-500' },
  searching:   { label: 'Searching…',    color: 'bg-blue-500' },
  result:      { label: 'Found',         color: 'bg-emerald-500' },
  error:       { label: 'Error',         color: 'bg-red-600' },
};

export function StatusIndicator({ status, isRecording }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2 px-1">
      <div className="relative flex items-center">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {(status === 'listening' || status === 'searching' || status === 'transcribing') && (
          <div className={`absolute inset-0 rounded-full ${config.color} opacity-60 animate-ping`} />
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-slate-400 font-medium tabular-nums"
        >
          {config.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
