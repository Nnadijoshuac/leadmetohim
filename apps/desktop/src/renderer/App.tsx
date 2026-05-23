import React, { useEffect } from 'react';
import { Overlay } from './components/Overlay/index.js';
import { Settings } from './components/Settings/index.js';
import { useSettingsStore } from './stores/settingsStore.js';
import { useSearchStore } from './stores/searchStore.js';

type View = 'overlay' | 'settings';

function getView(): View {
  // Distinguish overlay vs settings window by URL
  if (
    window.location.pathname.includes('settings') ||
    window.location.search.includes('view=settings')
  ) {
    return 'settings';
  }
  return 'overlay';
}

export function App() {
  const view = getView();
  const { setSettings, setLoaded, setModelStatus } = useSettingsStore();
  const { reset } = useSearchStore();

  useEffect(() => {
    // Load settings and sync on changes
    window.electronAPI.settings.get().then((s) => {
      setSettings(s);
      setLoaded(true);
    });

    window.electronAPI.settings.onChange((s) => setSettings(s));
    window.electronAPI.system.onModelStatus(setModelStatus);

    // Reset search state when overlay is shown
    if (view === 'overlay') {
      window.electronAPI.overlay.onShow(() => reset());
      window.electronAPI.overlay.ready();
    }
  }, [view, setSettings, setLoaded, setModelStatus, reset]);

  if (view === 'settings') {
    return <Settings />;
  }

  return <Overlay />;
}
