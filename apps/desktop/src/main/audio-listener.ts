import { log } from './logger.js';

// ── VAD parameters ────────────────────────────────────────────────────────────

const SPEECH_RMS_THRESHOLD = 0.012;  // energy level to count as speech
const SPEECH_ONSET_FRAMES = 3;       // consecutive speech frames to start utterance (~300ms)
const SILENCE_END_FRAMES  = 20;      // consecutive silence frames to end utterance (~2s)
const MIN_UTTERANCE_FRAMES = 5;      // minimum utterance length (~500ms)
const MAX_UTTERANCE_FRAMES = 300;    // maximum utterance length (~30s)

type OnUtterance = (pcm: Float32Array) => void;

// ── AudioListener ─────────────────────────────────────────────────────────────

export class AudioListener {
  private speechOnset = 0;
  private silenceCount = 0;
  private inSpeech = false;
  private utteranceFrames: Float32Array[] = [];
  private enabled = true;

  constructor(private readonly onUtterance: OnUtterance) {}

  processFrame(frame: Float32Array): void {
    if (!this.enabled) return;

    const rms = computeRMS(frame);
    const isSpeech = rms > SPEECH_RMS_THRESHOLD;

    if (isSpeech) {
      this.speechOnset++;
      this.silenceCount = 0;
    } else {
      this.silenceCount++;
      this.speechOnset = 0;
    }

    // Detect speech start
    if (!this.inSpeech && this.speechOnset >= SPEECH_ONSET_FRAMES) {
      this.inSpeech = true;
      this.utteranceFrames = [];
      log.info('[VAD] Speech started');
    }

    // Accumulate
    if (this.inSpeech) {
      this.utteranceFrames.push(frame);

      const done =
        this.silenceCount >= SILENCE_END_FRAMES ||
        this.utteranceFrames.length >= MAX_UTTERANCE_FRAMES;

      if (done) this.flush();
    }
  }

  private flush(): void {
    const frames = this.utteranceFrames;
    this.inSpeech = false;
    this.utteranceFrames = [];
    this.speechOnset = 0;
    this.silenceCount = 0;

    if (frames.length < MIN_UTTERANCE_FRAMES) return;

    const durationMs = frames.length * 100;
    log.info(`[VAD] Utterance complete: ${durationMs}ms`);

    const totalSamples = frames.reduce((s, f) => s + f.length, 0);
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const f of frames) {
      merged.set(f, offset);
      offset += f.length;
    }

    this.onUtterance(merged);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.inSpeech = false;
      this.utteranceFrames = [];
    }
  }
}

function computeRMS(frame: Float32Array): number {
  let sum = 0;
  for (const s of frame) sum += s * s;
  return Math.sqrt(sum / frame.length);
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Convert Float32Array 16 kHz mono PCM to a WAV Buffer (for PTT compat). */
export function float32ToWav(pcm: Float32Array, sampleRate = 16000): Buffer {
  const dataLen = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataLen);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);

  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i] ?? 0));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  return buf;
}
