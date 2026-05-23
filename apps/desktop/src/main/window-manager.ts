import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { log } from './logger.js';

const OVERLAY_WIDTH = 700;
const OVERLAY_HEIGHT_IDLE = 72;
const OVERLAY_HEIGHT_MAX = 520;

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return path.join(__dirname, '../preload/index.js');
}

function getRendererPath(page: string): string {
  if (app.isPackaged) {
    return path.join(__dirname, `../renderer/${page}.html`);
  }
  return `http://localhost:5173/${page}.html`;
}

// ── Overlay window ────────────────────────────────────────────────────────────

export function createOverlayWindow(): BrowserWindow {
  const { bounds } = screen.getPrimaryDisplay();

  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT_IDLE,
    x: Math.round(bounds.x + (bounds.width - OVERLAY_WIDTH) / 2),
    y: Math.round(bounds.y + bounds.height * 0.12),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  if (app.isPackaged) {
    overlayWindow.loadFile(getRendererPath('index'));
  } else {
    overlayWindow.loadURL('http://localhost:5173/');
  }

  overlayWindow.on('closed', () => { overlayWindow = null; });
  overlayWindow.on('blur', () => {
    // Auto-hide after short delay if user clicked away
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isFocused()) {
        hideOverlay();
      }
    }, 150);
  });

  log.info('Overlay window created');
  return overlayWindow;
}

export function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
  const win = overlayWindow!;

  // Re-center on current active display
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { bounds } = display;
  win.setPosition(
    Math.round(bounds.x + (bounds.width - OVERLAY_WIDTH) / 2),
    Math.round(bounds.y + bounds.height * 0.12),
  );

  win.showInactive();
  win.setOpacity(0);
  win.show();
  win.focus();
  win.webContents.send('overlay:show');

  // Fade in
  let opacity = 0;
  const step = 0.08;
  const interval = setInterval(() => {
    opacity = Math.min(1, opacity + step);
    if (!win.isDestroyed()) win.setOpacity(opacity);
    if (opacity >= 1) clearInterval(interval);
  }, 12);
}

export function hideOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const win = overlayWindow;

  win.webContents.send('overlay:hide');

  // Fade out
  let opacity = win.getOpacity();
  const interval = setInterval(() => {
    opacity = Math.max(0, opacity - 0.12);
    if (!win.isDestroyed()) win.setOpacity(opacity);
    if (opacity <= 0) {
      clearInterval(interval);
      if (!win.isDestroyed()) win.hide();
    }
  }, 12);
}

export function setOverlayHeight(height: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const clampedH = Math.max(OVERLAY_HEIGHT_IDLE, Math.min(height, OVERLAY_HEIGHT_MAX));
  const [x, y] = overlayWindow.getPosition();
  overlayWindow.setBounds({ x: x ?? 0, y: y ?? 0, width: OVERLAY_WIDTH, height: clampedH }, true);
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function isOverlayVisible(): boolean {
  return overlayWindow !== null && !overlayWindow.isDestroyed() && overlayWindow.isVisible();
}

// ── Settings window ────────────────────────────────────────────────────────────

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 580,
    minWidth: 600,
    minHeight: 480,
    title: 'LeadMeToHim — Settings',
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    show: false,
    backgroundColor: '#0f0f14',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    settingsWindow.loadFile(getRendererPath('settings'));
  } else {
    settingsWindow.loadURL('http://localhost:5173/settings.html');
  }

  settingsWindow.once('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });

  log.info('Settings window created');
  return settingsWindow;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}
