import React from 'react';
import type { AppSettings, InsertMode } from '@leadmetohim/shared-types';

interface Props {
  settings: AppSettings;
  onSave: (partial: Partial<AppSettings>) => void;
}

export function GeneralSettings({ settings, onSave }: Props) {
  return (
    <div className="space-y-6 max-w-lg">
      <Section title="Insert Mode" description="How scripture is inserted into your applications">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'reference', label: 'Reference only', example: 'John 3:16' },
              { value: 'verse', label: 'Verse only', example: '"For God so loved…"' },
              { value: 'reference+verse', label: 'Reference + Verse', example: 'John 3:16 — "…"' },
              { value: 'copy', label: 'Copy to clipboard', example: 'No insertion' },
            ] as { value: InsertMode; label: string; example: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSave({ insertMode: opt.value })}
              className={`p-3 rounded-xl border text-left transition-all
                          ${settings.insertMode === opt.value
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : 'border-white/[0.06] bg-white/[0.03] text-slate-400 hover:border-white/10'
                          }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs opacity-60 mt-0.5 font-mono">{opt.example}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Translation" description="Bible translation for verse text">
        <div className="flex gap-2">
          {['KJV', 'WEB', 'ASV'].map((t) => (
            <button
              key={t}
              onClick={() => onSave({ translation: t })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                          ${settings.translation === t
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/[0.05] text-slate-400 border border-white/[0.05] hover:bg-white/[0.08]'
                          }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Search Sensitivity" description="Minimum confidence for semantic matches (lower = more results)">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0.15}
            max={0.65}
            step={0.05}
            value={settings.semanticThreshold}
            onChange={(e) => onSave({ semanticThreshold: parseFloat(e.target.value) })}
            className="flex-1 accent-amber-400"
          />
          <span className="text-sm text-slate-400 font-mono w-10 text-right">
            {Math.round(settings.semanticThreshold * 100)}%
          </span>
        </div>
      </Section>

      <Section title="Appearance">
        <label className="flex items-center gap-3 cursor-pointer">
          <Toggle
            checked={settings.animations}
            onChange={(v) => onSave({ animations: v })}
          />
          <span className="text-sm text-slate-300">Enable animations</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer mt-3">
          <Toggle
            checked={settings.showAlternatives}
            onChange={(v) => onSave({ showAlternatives: v })}
          />
          <span className="text-sm text-slate-300">Show alternative matches</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer mt-3">
          <Toggle
            checked={settings.startOnLogin}
            onChange={(v) => onSave({ startOnLogin: v })}
          />
          <span className="text-sm text-slate-300">Start on system login</span>
        </label>
      </Section>
    </div>
  );
}

function Section({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0
                  ${checked ? 'bg-amber-500' : 'bg-slate-700'}`}
      style={{ height: '22px' }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow
                    transition-transform
                    ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`}
        style={{ width: '18px', height: '18px' }}
      />
    </button>
  );
}
