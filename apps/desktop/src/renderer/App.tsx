import React, { useEffect, useRef } from 'react';
import { Overlay } from './components/Overlay/index.js';
import { Settings } from './components/Settings/index.js';
import { useSettingsStore } from './stores/settingsStore.js';
import { useSearchStore } from './stores/searchStore.js';

type View = 'overlay' | 'settings';

function getView(): View {
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
  const { reset, setResult, setStatus } = useSearchStore();

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      setSettings(s);
      setLoaded(true);
    });

    window.electronAPI.settings.onChange((s) => setSettings(s));
    window.electronAPI.system.onModelStatus(setModelStatus);

    if (view === 'overlay') {
      window.electronAPI.overlay.onShow(() => reset());
      window.electronAPI.overlay.ready();

      // Auto-detection: main process detected scripture in ambient audio
      window.electronAPI.audio.onDetection((result) => {
        setResult(result);
        setStatus('result');
      });
    }
  }, [view, setSettings, setLoaded, setModelStatus, reset, setResult, setStatus]);

  // ── Always-on mic capture ─────────────────────────────────────────────────
  // Runs even when overlay is hidden — keeps listening in the background
  useAlwaysOnAudio();

  if (view === 'settings') return <Settings />;
  return <Overlay />;
}

// ── Always-on mic hook ────────────────────────────────────────────────────────

const SAMPLE_RATE   = 16000;
const BUFFER_SIZE   = 4096; // ~256ms of audio per frame
const MIN_ENERGY    = 0.001; // skip near-silence frames entirely

function useAlwaysOnAudio() {
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeRef    = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount:    1,
            sampleRate:      SAMPLE_RATE,
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl:  true,
          },
        });

        if (!activeRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const ctx       = new AudioContext({ sampleRate: SAMPLE_RATE });
        const source    = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);

        processor.onaudioprocess = (e) => {
          const channel = e.inputBuffer.getChannelData(0);

          // Quick energy gate — skip silent frames to save IPC bandwidth
          let energy = 0;
          for (const s of channel) energy += s * s;
          if (energy / channel.length < MIN_ENERGY) return;

          const copy = new Float32Array(channel);
          window.electronAPI.audio.sendFrame(copy);
        };

        source.connect(processor);
        processor.connect(ctx.destination);

        audioCtxRef.current  = ctx;
        streamRef.current    = stream;
        processorRef.current = processor;
      } catch (err) {
        // Mic permission denied or hardware not available — non-fatal
        console.warn('[AlwaysOn] Mic unavailable:', err);
      }
    }

    start();

    return () => {
      activeRef.current = false;
      processorRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);
}
