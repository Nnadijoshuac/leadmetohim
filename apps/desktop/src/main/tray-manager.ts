import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { showOverlay, createSettingsWindow } from './window-manager.js';
import { log } from './logger.js';

let tray: Tray | null = null;

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

  // Fallback: programmatic 16×16 icon (white cross on transparent)
  return nativeImage.createFromDataURL(createFallbackIconDataUrl());
}

export function createTray(): Tray {
  tray = new Tray(getTrayIcon());
  tray.setToolTip('LeadMeToHim — Scripture Copilot');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Search Scripture',
      accelerator: 'Alt+Space',
      click: () => showOverlay(),
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

  tray.setContextMenu(menu);
  tray.on('double-click', () => showOverlay());

  log.info('Tray created');
  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

function createFallbackIconDataUrl(): string {
  // 1×1 transparent PNG as base64 — replaced by real icon at build time
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}
