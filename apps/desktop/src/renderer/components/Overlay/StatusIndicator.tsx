import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OverlayStatus } from '@leadmetohim/shared-types';

interface StatusIndicatorProps {
  status: OverlayStatus;
  isRecording: boolean;
}

const STATUS_CONFIG: Record<OverlayStatus, { label: string; color: string }> = {
  idle:         { label: 'Ready', color: 'bg-slate-500' },
  listening:    { label: 'Listening', color: 'bg-red-500' },
  transcribing: { label: 'Transcribing', color: 'bg-amber-400' },
  searching:    { label: 'Searching', color: 'bg-blue-400' },
  result:       { label: 'Found', color: 'bg-emerald-400' },
  error:        { label: 'Error', color: 'bg-red-600' },
};

export function StatusIndicator({ status, isRecording }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const isActive = isRecording || status === 'listening' || status === 'searching' || status === 'transcribing';

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center">
        <div className={`h-2 w-2 rounded-full ${config.color}`} />
        {isActive && (
          <div className={`absolute inset-0 rounded-full ${config.color} opacity-50 animate-ping`} />
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.14 }}
          className="truncate text-xs font-medium text-slate-400"
        >
          {config.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
