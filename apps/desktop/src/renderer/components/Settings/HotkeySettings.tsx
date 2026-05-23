import React, { useState, useCallback } from 'react';
import type { AppSettings } from '@leadmetohim/shared-types';

interface Props {
  settings: AppSettings;
  onSave: (partial: Partial<AppSettings>) => void;
}

export function HotkeySettings({ settings, onSave }: Props) {
  const [recording, setRecording] = useState<'hotkey' | 'ptt' | null>(null);
  const [temp, setTemp] = useState('');

  const startRecord = useCallback((field: 'hotkey' | 'ptt') => {
    setRecording(field);
    setTemp('Press the key combination…');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');

      const key = e.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key);
        const combo = parts.join('+');
        setTemp(combo);

        if (recording === 'hotkey') {
          onSave({ hotkey: combo });
        } else {
          onSave({ pushToTalkHotkey: combo });
        }
        setRecording(null);
      } else {
        setTemp(parts.join('+') + '+…');
      }
    },
    [recording, onSave],
  );

  return (
    <div
      className="space-y-6 max-w-lg"
      onKeyDown={handleKeyDown}
      tabIndex={recording ? 0 : -1}
    >
      <HotkeyRow
        label="Toggle Overlay"
        description="Open or close the scripture search overlay"
        value={settings.hotkey}
        isRecording={recording === 'hotkey'}
        recordTemp={recording === 'hotkey' ? temp : undefined}
        onRecord={() => startRecord('hotkey')}
        onCancel={() => setRecording(null)}
      />

      <HotkeyRow
        label="Push-to-Talk"
        description="Hold to record speech, release to transcribe"
        value={settings.pushToTalkHotkey}
        isRecording={recording === 'ptt'}
        recordTemp={recording === 'ptt' ? temp : undefined}
        onRecord={() => startRecord('ptt')}
        onCancel={() => setRecording(null)}
      />

      <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/20 px-4 py-3">
        <p className="text-xs text-amber-300/80">
          Click "Record" then press your desired key combination.
          Avoid keys used by Windows or other applications.
        </p>
      </div>
    </div>
  );
}

interface HotkeyRowProps {
  label: string;
  description: string;
  value: string;
  isRecording: boolean;
  recordTemp?: string;
  onRecord: () => void;
  onCancel: () => void;
}

function HotkeyRow({
  label, description, value, isRecording, recordTemp, onRecord, onCancel,
}: HotkeyRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isRecording ? (
          <>
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-sm font-mono
                             border border-amber-500/30 min-w-[140px] text-center animate-pulse">
              {recordTemp}
            </span>
            <button
              onClick={onCancel}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-400
                         hover:bg-slate-700 border border-white/[0.06]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <kbd className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-mono
                            border border-white/[0.08] min-w-[120px] text-center">
              {value}
            </kbd>
            <button
              onClick={onRecord}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-700/60 text-slate-400
                         hover:bg-slate-600/80 hover:text-slate-200 border border-white/[0.06]
                         transition-colors"
            >
              Record
            </button>
          </>
        )}
      </div>
    </div>
  );
}
