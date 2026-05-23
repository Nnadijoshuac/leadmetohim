import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { GeneralSettings } from './GeneralSettings.js';
import { HotkeySettings } from './HotkeySettings.js';
import { ModelSettings } from './ModelSettings.js';

type Tab = 'general' | 'hotkeys' | 'models';

export function Settings() {
  const [tab, setTab] = useState<Tab>('general');
  const { settings, setSettings, setModelStatus, setLoaded } = useSettingsStore();

  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
    window.electronAPI.system.getModelStatus().then(setModelStatus);
    window.electronAPI.system.onModelStatus(setModelStatus);
  }, [setSettings, setLoaded, setModelStatus]);

  const save = async (partial: Parameters<typeof window.electronAPI.settings.set>[0]) => {
    await window.electronAPI.settings.set(partial);
    setSettings({ ...settings, ...partial });
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'hotkeys', label: 'Hotkeys' },
    { id: 'models', label: 'Local Models' },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f14] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <span className="text-amber-400 text-lg">✦</span>
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">LeadMeToHim</h1>
          <p className="text-xs text-slate-500">Scripture Intelligence</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                        ${tab === t.id
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'
                        }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {tab === 'general' && <GeneralSettings settings={settings} onSave={save} />}
        {tab === 'hotkeys' && <HotkeySettings settings={settings} onSave={save} />}
        {tab === 'models' && <ModelSettings />}
      </div>
    </div>
  );
}
