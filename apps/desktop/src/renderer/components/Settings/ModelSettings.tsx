import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import type { AppSettings } from '@leadmetohim/shared-types';

export function ModelSettings() {
  const { modelStatus, settings } = useSettingsStore();

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { color: string; label: string }> = {
      ready:       { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Ready' },
      downloading: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',   label: 'Downloading…' },
      missing:     { color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',    label: 'Not downloaded' },
      error:       { color: 'text-red-400 bg-red-400/10 border-red-400/20',          label: 'Error' },
    };
    const c = config[status] ?? config['missing']!;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${c.color}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-5 max-w-lg">
      <ModelRow
        title="Embedding Model"
        subtitle="all-MiniLM-L6-v2 · Xenova (ONNX) · ~22 MB"
        description="Used for semantic scripture retrieval. Downloaded automatically on first launch."
        status={<StatusBadge status={modelStatus.embedder} />}
        progress={modelStatus.embedderProgress}
      />

      <ModelRow
        title="Whisper Model"
        subtitle={`${settings.whisperModel} · whisper.cpp · ~75 MB`}
        description="Used for push-to-talk speech-to-text transcription."
        status={<StatusBadge status={modelStatus.whisper} />}
        progress={modelStatus.whisperProgress}
      />

      <div className="rounded-xl bg-blue-500/[0.07] border border-blue-500/20 px-4 py-3">
        <p className="text-xs text-blue-300/80">
          Models are downloaded once and cached in your user data directory.
          They run fully offline after the initial download.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Whisper Model Size</h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: 'tiny.en',  label: 'Tiny',  detail: '~75 MB · Fastest' },
              { value: 'base.en',  label: 'Base',  detail: '~142 MB · Balanced' },
              { value: 'small.en', label: 'Small', detail: '~466 MB · Accurate' },
            ] as { value: AppSettings['whisperModel']; label: string; detail: string }[]
          ).map((m) => (
            <div
              key={m.value}
              className={`p-3 rounded-xl border text-left
                          ${settings.whisperModel === m.value
                            ? 'border-amber-500/40 bg-amber-500/10'
                            : 'border-white/[0.06] bg-white/[0.03]'
                          }`}
            >
              <div className={`text-sm font-medium
                               ${settings.whisperModel === m.value ? 'text-amber-300' : 'text-slate-400'}`}>
                {m.label}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">{m.detail}</div>
              <div className="text-xs text-slate-600 mt-0.5 italic">Requires re-download</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelRow({
  title, subtitle, description, status, progress,
}: {
  title: string;
  subtitle: string;
  description: string;
  status: React.ReactNode;
  progress?: number;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-200">{title}</div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">{subtitle}</div>
          <div className="text-xs text-slate-600 mt-1.5 leading-relaxed">{description}</div>
        </div>
        {status}
      </div>
      {progress !== undefined && progress > 0 && progress < 100 && (
        <div className="mt-3">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1 text-right">{progress}%</div>
        </div>
      )}
    </div>
  );
}
