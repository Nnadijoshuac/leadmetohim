import path from 'path';
import fs from 'fs';
const { app } = require('electron');

let logFile: string | null = null;

function getLogFile(): string {
  if (!logFile) {
    const dir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logFile = path.join(dir, 'main.log');
  }
  return logFile;
}

function write(level: string, ...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(' ')}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(getLogFile(), line);
  } catch { /* swallow I/O errors — don't crash the app */ }
}

export const log = {
  info:  (...a: unknown[]) => write('INFO', ...a),
  warn:  (...a: unknown[]) => write('WARN', ...a),
  error: (...a: unknown[]) => write('ERROR', ...a),
  debug: (...a: unknown[]) => write('DEBUG', ...a),
};
