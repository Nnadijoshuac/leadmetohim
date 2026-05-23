import { useCallback, useRef, useEffect } from 'react';
import { useSearchStore } from '../stores/searchStore.js';

const SAMPLE_RATE = 16000;
const MAX_RECORD_MS = 10_000;

export function useSpeech(onTranscript: (text: string) => void) {
  const { setStatus, setRecording } = useSearchStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Listen for PTT commands from main process (global hotkey)
    window.electronAPI.speech.onStartRecording(() => startRecording());
    window.electronAPI.speech.onStopRecording(() => stopRecording());
    window.electronAPI.speech.onTranscript((text) => {
      setRecording(false);
      setStatus('idle');
      onTranscript(text);
    });
    window.electronAPI.speech.onError(() => {
      setRecording(false);
      setStatus('error');
    });
  }, [onTranscript, setRecording, setStatus]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) return;

        setStatus('transcribing');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuf = await blob.arrayBuffer();
        const buf = Buffer.from(arrayBuf);

        // Send to main process for whisper transcription
        await window.electronAPI.speech.sendAudioBuffer(buf);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setStatus('listening');

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    } catch (e) {
      console.error('Microphone access failed:', e);
      setStatus('error');
    }
  }, [setRecording, setStatus]);

  const stopRecording = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  }, [setRecording]);

  return { startRecording, stopRecording };
}
