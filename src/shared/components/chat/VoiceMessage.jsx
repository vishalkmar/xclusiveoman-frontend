import { useRef, useState } from 'react';
import { LuPause, LuPlay, LuSend, LuTrash2 } from 'react-icons/lu';
import { MAX_VOICE_SECONDS, formatDuration } from './useVoiceRecorder.js';

// Support chat voice notes — shared by the agent chat (amber) and the admin
// Support Center (indigo); `tone` only switches the accent colour.

const TONES = {
  indigo: { button: 'bg-[#4F46E5] text-white hover:bg-[#4338CA]', bar: 'bg-[#4F46E5]', track: 'bg-[#C7D2FE]' },
  amber: { button: 'bg-[#d9860f] text-white hover:bg-[#b96f08]', bar: 'bg-[#d9860f]', track: 'bg-[#f3d9b1]' },
};

// Browser recordings are WebM/Ogg, which Safari can't play and which carry
// no duration header. Cloudinary transcodes on the fly when the extension is
// swapped, so an MP3 rendition is offered first wherever it's available.
function mp3Rendition(src) {
  if (!/res\.cloudinary\.com\/.+\/video\/upload\//.test(src || '')) return null;
  return src.replace(/\.(webm|ogg|oga|m4a|mp4|wav|aac)(\?.*)?$/i, '.mp3$2');
}

const PLAYBACK_RATES = [1, 1.5, 2];

export function VoiceMessage({ src, tone = 'indigo' }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [rate, setRate] = useState(1);
  const colors = TONES[tone] || TONES.indigo;
  const mp3 = mp3Rendition(src);
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setFailed(true));
    else audio.pause();
  }

  // 1× → 1.5× → 2× → 1×. Pitch is preserved by the browser by default.
  function cycleRate() {
    const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  if (failed) {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="text-xs font-semibold underline">
        Download voice message
      </a>
    );
  }

  return (
    <div className="flex w-56 max-w-full items-center gap-2.5 py-0.5 sm:w-64">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={(e) => {
          // Loading a <source> resets playbackRate, so re-apply it on play.
          e.currentTarget.playbackRate = rate;
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
      >
        {mp3 && <source src={mp3} type="audio/mpeg" />}
        <source src={src} onError={() => setFailed(true)} />
      </audio>
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'} className={`flex h-9 w-9 flex-none items-center justify-center rounded-full transition ${colors.button}`}>
        {playing ? <LuPause size={15} /> : <LuPlay size={15} className="translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1">
        <div role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(current)} tabIndex={-1} onClick={seek} className={`relative h-1.5 cursor-pointer overflow-hidden rounded-full ${colors.track}`}>
          <div className={`absolute inset-y-0 left-0 rounded-full ${colors.bar}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 text-[10px] tabular-nums text-current opacity-60">
          {formatDuration(playing || current ? current : duration)}
        </div>
      </div>
      <button
        type="button"
        onClick={cycleRate}
        aria-label={`Playback speed ${rate}×. Change speed`}
        title="Playback speed"
        className={`h-6 min-w-[34px] flex-none rounded-full px-1.5 text-[10px] font-bold tabular-nums transition ${rate === 1 ? 'bg-black/5 text-current opacity-70 hover:opacity-100' : colors.button}`}
      >
        {rate}×
      </button>
    </div>
  );
}

// Shown in place of the text box while recording.
export function VoiceRecordingBar({ seconds, onCancel, onSend, sending, tone = 'indigo' }) {
  const colors = TONES[tone] || TONES.indigo;
  const nearLimit = seconds >= MAX_VOICE_SECONDS - 15;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button type="button" onClick={onCancel} disabled={sending} aria-label="Discard recording" className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-40">
        <LuTrash2 size={18} />
      </button>
      <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#FECACA] bg-[#FFF7F7] px-4" aria-live="polite">
        <span className="relative flex h-2.5 w-2.5 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
        </span>
        <span className="text-sm font-semibold tabular-nums text-[#B91C1C]">{formatDuration(seconds)}</span>
        <span className="truncate text-xs text-[#94A3B8]">{nearLimit ? `Max ${formatDuration(MAX_VOICE_SECONDS)}` : 'Recording voice message…'}</span>
      </div>
      <button type="button" onClick={onSend} disabled={sending} aria-label="Send voice message" className={`flex h-10 w-10 flex-none items-center justify-center rounded-full shadow-sm transition disabled:opacity-40 ${colors.button}`}>
        <LuSend size={17} />
      </button>
    </div>
  );
}
