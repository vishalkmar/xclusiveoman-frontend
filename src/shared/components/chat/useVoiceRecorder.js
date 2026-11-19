import { useCallback, useEffect, useRef, useState } from 'react';

// Voice notes for the support chat (agent + admin). Wraps MediaRecorder:
// start() asks for the mic, stop() resolves the recording as a File ready
// for FormData, cancel() throws it away. Recording is capped so a forgotten
// mic can't produce a huge upload (the backend accepts up to 10 MB).

export const MAX_VOICE_SECONDS = 5 * 60;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg'];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

const EXTENSIONS = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' };

export function isVoiceRecordingSupported() {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function useVoiceRecorder({ onError } = {}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const resolveStopRef = useRef(null);
  const autoStopRef = useRef(null);

  const cleanup = useCallback(() => {
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => {
    // Unmounting mid-recording: release the mic, drop the audio.
    resolveStopRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (recorderRef.current) return false;
    if (!isVoiceRecordingSupported()) {
      onError?.('Voice messages are not supported in this browser.');
      return false;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      onError?.(err?.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in your browser to record voice messages.' : 'No microphone could be found.');
      return false;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(chunksRef.current, { type });
      const duration = Math.min(MAX_VOICE_SECONDS, (Date.now() - startedAtRef.current) / 1000);
      const file = new File([blob], `voice-message.${EXTENSIONS[type] || 'webm'}`, { type });
      cleanup();
      resolveStopRef.current?.(blob.size ? { file, duration } : null);
      resolveStopRef.current = null;
    };
    streamRef.current = stream;
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setRecording(true);
    recorder.start(250);
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_VOICE_SECONDS) autoStopRef.current?.();
    }, 250);
    return true;
  }, [cleanup, onError]);

  // Resolves { file, duration } — or null if nothing was captured.
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    resolveStopRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = cleanup;
      recorder.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  // Hitting the cap just stops recording; the composer still decides to send.
  autoStopRef.current = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.pause?.();
    window.clearInterval(timerRef.current);
  };

  return { recording, seconds, start, stop, cancel };
}
