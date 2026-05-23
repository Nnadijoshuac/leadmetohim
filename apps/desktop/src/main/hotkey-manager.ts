import { globalShortcut } from 'electron';
import { log } from './logger.js';
import { showOverlay, hideOverlay, isOverlayVisible } from './window-manager.js';

let currentHotkey = 'Alt+Space';
let pushToTalkKey = 'Alt+R';
let onPushToTalkStart: (() => void) | null = null;
let onPushToTalkStop: (() => void) | null = null;

export function registerHotkeys(
  hotkey: string,
  pttKey: string,
  onPTTStart: () => void,
  onPTTStop: () => void,
): void {
  unregisterAll();

  currentHotkey = hotkey;
  pushToTalkKey = pttKey;
  onPushToTalkStart = onPTTStart;
  onPushToTalkStop = onPTTStop;

  // Toggle overlay
  const toggled = globalShortcut.register(hotkey, () => {
    if (isOverlayVisible()) {
      hideOverlay();
    } else {
      showOverlay();
    }
  });

  if (!toggled) {
    log.warn(`Failed to register hotkey: ${hotkey}`);
  } else {
    log.info(`Hotkey registered: ${hotkey}`);
  }

  // Push-to-talk (separate key held for recording)
  const pttRegistered = globalShortcut.register(pttKey, () => {
    if (!isOverlayVisible()) showOverlay();
    onPushToTalkStart?.();
  });

  if (!pttRegistered) {
    log.warn(`Failed to register PTT key: ${pttKey}`);
  }
}

export function unregisterAll(): void {
  try {
    if (currentHotkey) globalShortcut.unregister(currentHotkey);
    if (pushToTalkKey) globalShortcut.unregister(pushToTalkKey);
  } catch (e) {
    log.warn('Error unregistering hotkeys', e);
  }
}

export function updateHotkey(
  newHotkey: string,
  newPTT: string,
  onPTTStart: () => void,
  onPTTStop: () => void,
): void {
  registerHotkeys(newHotkey, newPTT, onPTTStart, onPTTStop);
}
