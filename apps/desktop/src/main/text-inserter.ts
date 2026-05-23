import { clipboard } from 'electron';
import { log } from './logger.js';

const PASTE_DELAY_MS = 120;
const CLIPBOARD_RESTORE_DELAY_MS = 600;

/**
 * Insert text into the currently focused application.
 *
 * Strategy:
 *   1. Save current clipboard
 *   2. Set clipboard to target text
 *   3. Hide our overlay (returns focus to previous app)
 *   4. Wait for focus transfer
 *   5. Simulate Ctrl+V
 *   6. Restore clipboard after a delay
 *
 * This approach is the most reliable across all Windows applications:
 * browsers, editors, chat apps, note tools, etc.
 */
export async function insertText(text: string): Promise<void> {
  const prevText = clipboard.readText();
  const prevImage = clipboard.readImage();
  const hadImage = !prevImage.isEmpty();

  clipboard.writeText(text);
  log.info('Text set to clipboard, simulating paste');

  await sleep(PASTE_DELAY_MS);

  try {
    await simulatePaste();
  } catch (e) {
    log.error('Failed to simulate paste:', e);
  }

  // Restore clipboard after the paste completes
  setTimeout(() => {
    try {
      if (hadImage) {
        clipboard.writeImage(prevImage);
      } else {
        clipboard.writeText(prevText);
      }
    } catch { /* ignore restore errors */ }
  }, CLIPBOARD_RESTORE_DELAY_MS);
}

/**
 * Simulate Ctrl+V using the robotjs or nut-js native API.
 * Falls back to PowerShell SendKeys if native fails.
 */
async function simulatePaste(): Promise<void> {
  // Try @nut-tree/nut-js first (best Windows support)
  try {
    const { keyboard, Key } = await import('@nut-tree/nut-js');
    keyboard.config.autoDelayMs = 0;
    await keyboard.pressKey(Key.LeftControl, Key.V);
    await keyboard.releaseKey(Key.LeftControl, Key.V);
    return;
  } catch {
    log.warn('nut-js unavailable, trying PowerShell fallback');
  }

  // PowerShell fallback — reliable on all Windows versions
  await powershellPaste();
}

async function powershellPaste(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const cmd = `powershell -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`;
  await execAsync(cmd, { timeout: 3000 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
