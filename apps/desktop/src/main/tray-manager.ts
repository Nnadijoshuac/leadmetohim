import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { showOverlay, createSettingsWindow } from './window-manager.js';
import { log } from './logger.js';

let tray: Tray | null = null;
let _listening = true;
let _onToggleListening: ((enabled: boolean) => void) | null = null;

function getTrayIcon(): Electron.NativeImage {
  const candidates = [
    path.join(__dirname, '../../resources/tray-icon.png'),
    path.join(process.resourcesPath ?? '', 'tray-icon.png'),
    path.join(app.getAppPath(), 'resources/tray-icon.png'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      img.setTemplateImage(true);
      return img;
    }
  }

  return nativeImage.createFromDataURL(createFallbackIconDataUrl());
}

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Search Scripture',
      accelerator: 'Alt+Space',
      click: () => showOverlay(),
    },
    { type: 'separator' },
    {
      label: _listening ? 'Pause Listening' : 'Resume Listening',
      click: () => {
        _listening = !_listening;
        _onToggleListening?.(_listening);
        tray?.setContextMenu(buildMenu());
        tray?.setToolTip(`LeadMeToHim — ${_listening ? 'Listening' : 'Paused'}`);
        log.info(`Always-on listening ${_listening ? 'resumed' : 'paused'}`);
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => createSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: `LeadMeToHim v${app.getVersion()}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);
}

export function createTray(onToggleListening: (enabled: boolean) => void): Tray {
  _onToggleListening = onToggleListening;
  tray = new Tray(getTrayIcon());
  tray.setToolTip('LeadMeToHim — Listening');
  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => showOverlay());
  log.info('Tray created');
  return tray;
}

/** Sync tray state when listening is toggled from outside (e.g. settings window). */
export function setTrayListeningState(listening: boolean): void {
  _listening = listening;
  tray?.setContextMenu(buildMenu());
  tray?.setToolTip(`LeadMeToHim — ${listening ? 'Listening' : 'Paused'}`);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

function createFallbackIconDataUrl(): string {
  // 1×1 transparent PNG as base64 — replaced by real icon at build time
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}
