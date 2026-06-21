// @ts-nocheck
import React, {
  useState, useRef, useCallback, useEffect, useMemo
} from 'react';
import {
  Phone, PhoneOff, MessageSquare, AlertCircle, Mic, MicOff,
  User, Bot, Check, Lock, RefreshCw, Cpu, Volume2, VolumeX,
  Brain, Loader2, X, Wifi, Activity, ChevronDown
} from 'lucide-react';
import { api } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OrbState =
  | 'idle' | 'connecting' | 'waiting'
  | 'listening' | 'thinking' | 'responding'
  | 'ended' | 'error';

type MsgRole = 'agent' | 'user' | 'system' | 'typing';

interface Msg {
  id: string | number;
  role: MsgRole;
  text: string;
  time?: string;
  isStreaming?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orb State Metadata
// ─────────────────────────────────────────────────────────────────────────────

const ORB_LABEL: Record<OrbState, string> = {
  idle: 'Ready',
  connecting: 'Connecting…',
  waiting: 'Allocating Agent…',
  listening: 'Listening',
  thinking: 'Processing…',
  responding: 'Responding',
  ended: 'Session Ended',
  error: 'Connection Error',
};

const ORB_SUB: Record<OrbState, string> = {
  idle: 'AI Voice Agent Offline',
  connecting: 'Establishing Secure TLS Stream',
  waiting: 'Initialising Host Container',
  listening: 'Analysing Speech Pattern',
  thinking: 'AI Engine Processing Query',
  responding: 'Streaming Response',
  ended: 'Call Session Closed',
  error: 'Reconnect or Refresh Page',
};

/** Returns tailwind shadow/glow classes per state */
function getOrbClass(state: OrbState): string {
  const base = 'transition-all duration-700';
  switch (state) {
    case 'listening':  return `${base} orb-listening`;
    case 'thinking':   return `${base} orb-thinking`;
    case 'responding': return `${base} orb-responding`;
    case 'error':      return `${base} orb-error`;
    default:           return `${base} orb-idle`;
  }
}

/** Returns the gradient stop colors for the orb shell */
function getOrbGradient(state: OrbState): string {
  switch (state) {
    case 'listening':  return 'from-emerald-400 via-cyan-400 to-teal-500';
    case 'thinking':   return 'from-indigo-500 via-purple-500 to-violet-600';
    case 'responding': return 'from-cyan-400 via-indigo-500 to-purple-600';
    case 'error':      return 'from-rose-500 via-red-500 to-pink-600';
    case 'connecting':
    case 'waiting':    return 'from-indigo-400 via-purple-500 to-cyan-400';
    default:           return 'from-slate-600 via-slate-500 to-slate-600';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamingText — renders text character-by-character
// ─────────────────────────────────────────────────────────────────────────────

function StreamingText({ text, speed = 16 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState('');
  const [done, setDone]   = useState(false);

  useEffect(() => {
    setShown('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span aria-live="polite">
      {shown}
      {!done && (
        <span
          aria-hidden="true"
          className="cursor-blink inline-block w-[2px] h-[13px] bg-cyan-400 align-middle ml-[2px] rounded-sm"
        />
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WaveformBars — decorative equaliser bars inside the orb
// ─────────────────────────────────────────────────────────────────────────────

function WaveformBars({ active, color = '#22d3ee' }: { active: boolean; color?: string }) {
  const delays = [0, 160, 80, 240, 40, 200, 120];
  return (
    <div className="flex items-end gap-[3px] h-7" aria-hidden="true">
      {delays.map((d, i) => (
        <div
          key={i}
          className="waveform-bar rounded-full"
          style={{
            width: 3,
            height: active ? `${12 + (i % 3) * 8}px` : '0px',
            background: color,
            animationDelay: `${d}ms`,
            animationDuration: active ? `${0.55 + (i % 3) * 0.15}s` : '0s',
            opacity: active ? 0.9 : 0,
            transition: 'height 0.4s ease, opacity 0.4s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrbCanvas — Fibonacci sphere + rotating ring visualizer
// ─────────────────────────────────────────────────────────────────────────────

function OrbCanvas({
  orbState,
  roomRef,
  volumeLevel,
}: {
  orbState: OrbState;
  roomRef: React.MutableRefObject<any>;
  volumeLevel: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let yaw = 0, pitch = 0;

    const N = 140, phi = (1 + Math.sqrt(5)) / 2;
    const pts = Array.from({ length: N }, (_, i) => {
      const t = 2 * Math.PI * i / phi;
      const p = Math.acos(1 - 2 * (i + 0.5) / N);
      return {
        x: Math.cos(t) * Math.sin(p),
        y: Math.sin(t) * Math.sin(p),
        z: Math.cos(p),
        s: 1.0 + Math.random() * 1.4,
      };
    });

    const resize = () => {
      const dpr  = devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawRing = (
      cx: number, cy: number,
      base: number, amp: number, freq: number,
      spd: number, color: string, lw: number,
    ) => {
      ctx.beginPath();
      const t = Date.now() * spd;
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * Math.PI * 2;
        const r = base + Math.sin(a * freq + t) * amp;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lw;
      ctx.stroke();
    };

    const draw = () => {
      const W  = canvas.width  / (devicePixelRatio || 1);
      const H  = canvas.height / (devicePixelRatio || 1);
      const cx = W / 2, cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Get live audio levels
      let uVol = 0, aVol = 0;
      if (roomRef.current && (orbState === 'listening' || orbState === 'responding' || orbState === 'thinking')) {
        uVol = roomRef.current.localParticipant?.audioLevel ?? 0;
        for (const p of roomRef.current.remoteParticipants.values()) {
          if (p.identity.toLowerCase().includes('agent')) { aVol = p.audioLevel ?? 0; break; }
        }
      }
      const activeVol  = Math.max(uVol, aVol);
      const volAmp     = activeVol * (volumeLevel / 100);
      const isActive   = ['listening', 'responding', 'thinking'].includes(orbState);
      const pulse      = Math.sin(Date.now() * 0.002) * 2.5;

      // Ring color sets per state
      let c1: string, c2: string, c3: string;
      if      (orbState === 'listening')  { c1 = 'rgba(16,185,129,0.5)';  c2 = 'rgba(6,182,212,0.4)';   c3 = 'rgba(52,211,153,0.3)'; }
      else if (orbState === 'thinking')   { c1 = 'rgba(99,102,241,0.55)'; c2 = 'rgba(147,51,234,0.45)'; c3 = 'rgba(167,139,250,0.35)'; }
      else if (orbState === 'responding') { c1 = 'rgba(6,182,212,0.55)';  c2 = 'rgba(99,102,241,0.45)'; c3 = 'rgba(147,51,234,0.35)'; }
      else if (orbState === 'error')      { c1 = 'rgba(244,63,94,0.5)';   c2 = 'rgba(251,113,133,0.4)'; c3 = 'rgba(244,63,94,0.25)'; }
      else { c1 = 'rgba(100,116,139,0.2)'; c2 = 'rgba(100,116,139,0.15)'; c3 = 'rgba(100,116,139,0.1)'; }

      if (isActive) {
        drawRing(cx, cy, 92,  3 + volAmp * 32, 5,  0.004,  c1, 2.0);
        drawRing(cx, cy, 118, 4 + volAmp * 44, 7, -0.005,  c2, 1.8);
        drawRing(cx, cy, 145, 5 + volAmp * 56, 6,  0.006,  c3, 1.6);
      } else {
        drawRing(cx, cy, 92,  2 + pulse * 0.7, 4,  0.0013, c1, 1.3);
        drawRing(cx, cy, 118, 2.5 + pulse * 0.9, 5, -0.0016, c2, 1.2);
        drawRing(cx, cy, 145, 3 + pulse * 1.1, 6,  0.0019, c3, 1.1);
      }

      // Fibonacci sphere
      const spd2 = 1 + activeVol * 3.5;
      yaw   += 0.003 * spd2;
      pitch += 0.0015 * spd2;
      const sr  = 56 + activeVol * 20;
      const fov = 2.4;

      const proj = pts.map(p => {
        const x1 = p.x * Math.cos(yaw) - p.z * Math.sin(yaw);
        const z1 = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
        const y2 = p.y * Math.cos(pitch) - z1 * Math.sin(pitch);
        const z2 = p.y * Math.sin(pitch) + z1 * Math.cos(pitch);
        const disp = 1 + (activeVol * 0.24) * (Math.sin(Date.now() * 0.011 + p.x * 4) * 0.5 + 0.5);
        const sc   = fov / (fov + z2 * disp);
        return { px: cx + x1 * disp * sc * sr, py: cy + y2 * disp * sc * sr, z: z2, s: p.s * sc };
      });

      const isUser  = uVol > 0.02 && uVol > aVol;
      const isAgent = aVol > 0.02;

      proj.filter(p => p.z > 0).forEach(p => {
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${0.12 * (1 - p.z)})`;
        ctx.fill();
      });
      proj.filter(p => p.z <= 0).forEach(p => {
        let fc: string;
        if (isUser)            fc = `rgba(52,211,153,${0.85 * (1 - Math.abs(p.z))})`;
        else if (isAgent)      fc = `rgba(129,140,248,${0.85 * (1 - Math.abs(p.z))})`;
        else if (orbState === 'error') fc = `rgba(251,113,133,${0.8 * (1 - Math.abs(p.z))})`;
        else                   fc = `rgba(255,255,255,${0.65 * (1 - Math.abs(p.z))})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.s, 0, Math.PI * 2);
        ctx.fillStyle = fc;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [orbState, roomRef, volumeLevel]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CentreOrbIcon — icon inside the orb inner core
// ─────────────────────────────────────────────────────────────────────────────

function CentreOrbIcon({ state }: { state: OrbState }) {
  if (state === 'listening')         return <Mic       className="w-9 h-9 text-emerald-300 animate-pulse" aria-hidden />;
  if (state === 'thinking')          return <Brain     className="w-9 h-9 text-indigo-300 animate-pulse"  aria-hidden />;
  if (state === 'responding')        return <Bot       className="w-9 h-9 text-cyan-300 animate-pulse"    aria-hidden />;
  if (state === 'connecting' || state === 'waiting')
                                     return <Loader2   className="w-9 h-9 text-indigo-400 animate-spin"  aria-hidden />;
  if (state === 'ended')             return <Check     className="w-9 h-9 text-emerald-400"               aria-hidden />;
  if (state === 'error')             return <AlertCircle className="w-9 h-9 text-rose-400 animate-pulse" aria-hidden />;
  return                                    <Phone     className="w-9 h-9 text-slate-400"                 aria-hidden />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatMessage — single message bubble
// ─────────────────────────────────────────────────────────────────────────────

const ChatMessage = React.memo(function ChatMessage({
  msg, isLast, callState,
}: {
  msg: Msg; isLast: boolean; callState: string;
}) {
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center animate-fade-in" role="status">
        <span className="status-pill">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden />
          {msg.text}
        </span>
      </div>
    );
  }

  if (msg.role === 'typing') {
    return (
      <div className="flex justify-start animate-fade-in" aria-label="AI is composing">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0" aria-hidden>
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="bubble-ai px-4 py-3 rounded-2xl rounded-tl-none">
            <div className="flex gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full dot-bounce-1" aria-hidden />
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full dot-bounce-2" aria-hidden />
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full dot-bounce-3" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAgent = msg.role === 'agent';
  return (
    <article
      className={`flex w-full animate-fade-in ${isAgent ? 'justify-start' : 'justify-end'}`}
      aria-label={`${isAgent ? 'AI Agent' : 'Patient'}: ${msg.text}`}
    >
      <div className={`max-w-[90%] flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}>
        {msg.time && (
          <span className="text-[9px] text-slate-500 font-mono mb-1 px-1" aria-hidden>
            {isAgent ? 'AI Agent' : 'Patient'} · {msg.time}
          </span>
        )}
        <div className="flex items-start gap-2.5">
          {isAgent && (
            <div className="w-7 h-7 rounded-full bg-slate-900 border border-cyan-800/40 flex items-center justify-center shrink-0 mt-0.5" aria-hidden>
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          )}
          <div className={`px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed font-medium ${
            isAgent
              ? 'bubble-ai rounded-tl-none text-cyan-100'
              : 'bubble-user rounded-tr-none text-violet-100'
          }`}>
            <p className="whitespace-pre-wrap">
              {msg.isStreaming
                ? <StreamingText text={msg.text} />
                : <>
                    {msg.text}
                    {isLast && callState === 'connected' && (
                      <span className="cursor-blink inline-block w-[2px] h-[13px] bg-cyan-400 align-middle ml-[2px] rounded-sm" aria-hidden />
                    )}
                  </>
              }
            </p>
          </div>
          {!isAgent && (
            <div className="w-7 h-7 rounded-full bg-slate-900 border border-purple-700/40 flex items-center justify-center shrink-0 mt-0.5" aria-hidden>
              <User className="w-3.5 h-3.5 text-purple-400" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GlassChatPanel — toggleable slide-in transcript panel
// ─────────────────────────────────────────────────────────────────────────────

function GlassChatPanel({
  isOpen,
  onClose,
  messages,
  callState,
  agentOnline,
  liveStats,
}: {
  isOpen: boolean;
  onClose: () => void;
  messages: Msg[];
  callState: string;
  agentOnline: boolean;
  liveStats: { patients?: number; doctors?: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  return (
    /* Overlay wrapper — pointer-events only when open */
    <div
      className={`
        absolute top-0 left-0 bottom-0 w-[320px] z-30
        transition-all duration-500 ease-out
        ${isOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none'}
      `}
      aria-hidden={!isOpen}
    >
      {/* Glass pane */}
      <div
        className="
          w-full h-full flex flex-col
          bg-slate-950/60 backdrop-blur-2xl
          border-r border-t border-b border-slate-700/30
          rounded-tr-3xl rounded-br-3xl
          shadow-[4px_0_60px_rgba(0,0,0,0.7),inset_1px_0_0_rgba(255,255,255,0.04)]
          overflow-hidden
        "
        role="complementary"
        aria-label="Live conversation transcript"
      >
        {/* Header */}
        <div className="
          flex items-center justify-between
          px-4 py-3.5
          border-b border-slate-700/30
          bg-slate-900/40 backdrop-blur-md
          shrink-0
        ">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <MessageSquare className="w-4 h-4 text-cyan-400" aria-hidden />
              {agentOnline && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900 animate-pulse" aria-hidden />
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-200 uppercase tracking-widest leading-none">
                Live Transcript
              </p>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                {agentOnline ? (
                  <span className="text-emerald-400">● Agent Online</span>
                ) : (
                  <span className="text-slate-600">● Agent Offline</span>
                )}
                {liveStats?.patients != null && ` · ${liveStats.patients} pts`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="
              w-7 h-7 rounded-full
              bg-slate-800/60 border border-slate-700/40
              flex items-center justify-center
              text-slate-400 hover:text-slate-200
              hover:bg-slate-700/60 hover:border-slate-600/50
              transition-all duration-200
            "
            aria-label="Close transcript panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message stream */}
        <div
          ref={containerRef}
          id="call-transcript"
          role="log"
          aria-live="polite"
          aria-label="Conversation transcript"
          className="
            flex-1 overflow-y-auto custom-scrollbar
            flex flex-col gap-3
            px-3.5 py-4
            min-h-0
          "
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
              <Activity className="w-8 h-8 opacity-30" aria-hidden />
              <p className="text-[11px] font-medium text-center leading-relaxed">
                Conversation will appear<br />here in real-time
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              msg={msg}
              isLast={idx === messages.length - 1}
              callState={callState}
            />
          ))}
        </div>

        {/* Footer gradient fade */}
        <div className="h-6 bg-gradient-to-t from-slate-950/60 to-transparent pointer-events-none shrink-0" aria-hidden />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceOrb — the massive centrepiece
// ─────────────────────────────────────────────────────────────────────────────

function VoiceOrb({
  orbState,
  roomRef,
  volumeLevel,
  callState,
  callDuration,
  isMicEnabled,
  isSpeakerMuted,
  onToggleMic,
  onToggleSpeaker,
  onVolumeChange,
  onConnect,
  onHangUp,
  onReset,
  error,
}: {
  orbState: OrbState;
  roomRef: React.MutableRefObject<any>;
  volumeLevel: number;
  callState: string;
  callDuration: number;
  isMicEnabled: boolean;
  isSpeakerMuted: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onVolumeChange: (v: number) => void;
  onConnect: () => void;
  onHangUp: () => void;
  onReset: () => void;
  error: string;
}) {
  const isActive = ['listening', 'thinking', 'responding'].includes(orbState);
  const grad     = getOrbGradient(orbState);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="relative flex items-center justify-center" aria-label={`AI Voice Orb — ${ORB_LABEL[orbState]}`}>

      {/* ── Outermost ambient ping ring ─────────────────────── */}
      <div
        className="absolute rounded-full border border-cyan-400/8 animate-ping pointer-events-none"
        style={{ width: 420, height: 420, animationDuration: '2.4s' }}
        aria-hidden
      />

      {/* ── Second ambient glow ring ─────────────────────────── */}
      <div
        className="absolute rounded-full bg-gradient-to-tr from-cyan-500/10 via-fuchsia-500/8 to-transparent blur-2xl animate-pulse pointer-events-none"
        style={{ width: 360, height: 360, animationDuration: '3s' }}
        aria-hidden
      />

      {/* ── Rotating outer border ring ───────────────────────── */}
      <div
        className={`absolute rounded-full pointer-events-none ${isActive ? 'opacity-80' : 'opacity-20'}`}
        style={{
          width: 304,
          height: 304,
          background: 'conic-gradient(from 0deg, transparent 60%, rgba(6,182,212,0.6) 80%, rgba(168,85,247,0.6) 90%, transparent 100%)',
          animation: 'rotate-slow 4s linear infinite',
          borderRadius: '50%',
        }}
        aria-hidden
      />

      {/* ── Counter-rotating outer ring ──────────────────────── */}
      <div
        className={`absolute rounded-full pointer-events-none ${isActive ? 'opacity-60' : 'opacity-10'}`}
        style={{
          width: 290,
          height: 290,
          background: 'conic-gradient(from 180deg, transparent 50%, rgba(168,85,247,0.5) 75%, rgba(6,182,212,0.4) 85%, transparent 100%)',
          animation: 'rotate-reverse 6s linear infinite',
          borderRadius: '50%',
        }}
        aria-hidden
      />

      {/* ── Canvas (Fibonacci sphere + waveform rings) ────────── */}
      <div className="absolute" style={{ width: 300, height: 300 }} aria-hidden>
        <OrbCanvas orbState={orbState} roomRef={roomRef} volumeLevel={volumeLevel} />
      </div>

      {/* ── Orb Shell ────────────────────────────────────────── */}
      <div
        className={`
          relative w-60 h-60 rounded-full
          bg-gradient-to-tr ${grad}
          p-[3px]
          transition-all duration-700
          ${getOrbClass(orbState)}
          ${isActive ? 'scale-105' : 'scale-100'}
          hover:scale-[1.06] cursor-pointer
          select-none z-20
        `}
        role="img"
        aria-label={ORB_LABEL[orbState]}
        onClick={callState === 'idle' ? onConnect : undefined}
      >
        {/* Inner dark recess */}
        <div
          className="
            w-full h-full rounded-full
            bg-gradient-to-b from-slate-900 via-slate-950 to-zinc-950
            flex flex-col items-center justify-center gap-2
          "
          style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), inset 0 0 8px rgba(255,255,255,0.03)' }}
        >
          {/* Soft inner glow */}
          <div
            className={`absolute w-28 h-28 rounded-full blur-2xl opacity-20 animate-pulse bg-gradient-to-tr ${grad}`}
            aria-hidden
          />

          {/* State icon */}
          <div className="relative z-10 flex flex-col items-center gap-1.5">
            <CentreOrbIcon state={orbState} />
            <WaveformBars active={isActive} color={orbState === 'listening' ? '#34d399' : '#22d3ee'} />
            {callState === 'connected' && (
              <span className="text-xs font-bold tracking-widest font-mono text-cyan-400 mt-0.5 animate-pulse">
                {fmt(callDuration)}
              </span>
            )}
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase gradient-text-shimmer">
              AI VOICE ORB
            </span>
          </div>
        </div>
      </div>

      {/* ── Left Sidebar Controls (Sensitivity bar) ──────────── */}
      <div className="absolute -left-20 flex flex-col items-center gap-2.5" aria-label="Volume sensitivity">
        <div
          className="h-32 w-2.5 bg-slate-900/80 border border-slate-700/40 rounded-full relative overflow-hidden flex items-end backdrop-blur-sm"
          aria-hidden
        >
          <div
            className="w-full bg-gradient-to-t from-cyan-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-150"
            style={{ height: `${volumeLevel}%` }}
          />
        </div>
        <input
          type="range" min="0" max="100" value={volumeLevel}
          onChange={e => onVolumeChange(+e.target.value)}
          className="sr-only"
          aria-label="Volume level"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={volumeLevel}
        />
        <span className="text-[8px] text-slate-500 font-bold tracking-widest uppercase" aria-hidden>Vol</span>
      </div>

      {/* ── Right Sidebar Controls ────────────────────────────── */}
      <div className="absolute -right-16 flex flex-col gap-3">
        {/* Speaker */}
        <button
          onClick={onToggleSpeaker}
          aria-pressed={isSpeakerMuted}
          aria-label={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
          className={`
            w-10 h-10 rounded-full border flex items-center justify-center
            transition-all duration-300 backdrop-blur-sm
            ${isSpeakerMuted
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.3)]'
              : 'bg-slate-900/70 border-slate-700/40 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            }
          `}
        >
          {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Mic */}
        <button
          onClick={onToggleMic}
          aria-pressed={!isMicEnabled}
          aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className={`
            w-10 h-10 rounded-full border flex items-center justify-center
            transition-all duration-300 backdrop-blur-sm
            ${!isMicEnabled
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.3)]'
              : 'bg-slate-900/70 border-slate-700/40 text-slate-400 hover:border-fuchsia-500/40 hover:text-fuchsia-400 hover:shadow-[0_0_12px_rgba(168,85,247,0.2)]'
            }
          `}
        >
          {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Label below orb ──────────────────────────────────── */}
      <div className="absolute -bottom-16 flex flex-col items-center gap-1.5">
        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em]" aria-live="polite">
          {ORB_LABEL[orbState]}
        </p>
        <p className="text-[9px] text-slate-600 font-mono animate-pulse">
          {ORB_SUB[orbState]}
        </p>
      </div>



      {/* ── Error badge ───────────────────────────────────────── */}
      {error && (
        <div
          className="
            absolute -bottom-28 left-1/2 -translate-x-1/2 w-72
            animate-shake
            flex items-center gap-2 text-[10px] text-rose-400
            bg-rose-950/20 border border-rose-500/25
            rounded-xl px-3.5 py-2.5 backdrop-blur-md
          "
          role="alert"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 animate-pulse" aria-hidden />
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CallActionButton — main CTA button below the orb area
// ─────────────────────────────────────────────────────────────────────────────

function CallActionButton({
  callState,
  onConnect,
  onHangUp,
  onReset,
  onCancelAllocation,
}: {
  callState: string;
  onConnect: () => void;
  onHangUp: () => void;
  onReset: () => void;
  onCancelAllocation: () => void;
}) {
  if (callState === 'idle' || callState === 'ended') {
    return (
      <button
        onClick={callState === 'idle' ? onConnect : onReset}
        aria-label={callState === 'idle' ? 'Open audio channel' : 'Reset session'}
        className="
          flex items-center gap-2.5 px-8 py-3
          bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600
          hover:from-cyan-400 hover:via-indigo-400 hover:to-purple-500
          text-white text-[11px] font-bold uppercase tracking-widest
          rounded-full shadow-[0_0_30px_rgba(6,182,212,0.35)]
          hover:shadow-[0_0_45px_rgba(6,182,212,0.5)]
          transition-all duration-300 active:scale-[0.97]
        "
      >
        <Phone className="w-4 h-4 animate-bounce" aria-hidden />
        {callState === 'idle' ? 'Open Audio Channel' : 'Reset Channel Ingress'}
      </button>
    );
  }

  if (callState === 'connecting') {
    return (
      <div className="flex items-center gap-2.5 text-slate-400 text-[11px] font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" aria-label="Connecting…" />
        Establishing stream…
      </div>
    );
  }

  if (callState === 'waiting_for_agent') {
    return (
      <button
        onClick={onCancelAllocation}
        aria-label="Cancel agent allocation"
        className="
          flex items-center gap-2 px-7 py-2.5
          bg-slate-900/70 border border-slate-700/50
          text-slate-400 text-[11px] font-bold uppercase tracking-widest
          rounded-full backdrop-blur-md
          hover:border-slate-600 hover:text-slate-200
          transition-all duration-200
        "
      >
        <X className="w-3.5 h-3.5" aria-hidden />
        Cancel Allocation
      </button>
    );
  }

  if (callState === 'connected') {
    return (
      <button
        onClick={onHangUp}
        aria-label="End call"
        className="
          flex items-center gap-2.5 px-8 py-3
          bg-gradient-to-r from-rose-500 to-red-600
          hover:from-rose-400 hover:to-red-500
          text-white text-[11px] font-bold uppercase tracking-widest
          rounded-full shadow-[0_0_25px_rgba(244,63,94,0.4)]
          hover:shadow-[0_0_40px_rgba(244,63,94,0.55)]
          transition-all duration-300 active:scale-[0.97]
        "
      >
        <PhoneOff className="w-4 h-4" aria-hidden />
        End Connection
      </button>
    );
  }

  if (callState === 'error') {
    return (
      <button
        onClick={onReset}
        aria-label="Retry connection"
        className="
          flex items-center gap-2 px-7 py-2.5
          bg-slate-900/70 border border-rose-500/30
          text-rose-400 text-[11px] font-bold uppercase tracking-widest
          rounded-full backdrop-blur-md
          hover:border-rose-400/50 hover:text-rose-300
          transition-all duration-200
        "
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden />
        Retry Connection
      </button>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBar — bottom floating pill
// ─────────────────────────────────────────────────────────────────────────────

function StatusBar({ agentOnline }: { agentOnline: boolean }) {
  return (
    <div
      className="
        animate-slide-up
        flex items-center gap-6
        bg-slate-950/85 backdrop-blur-2xl
        border border-slate-800/60
        rounded-full px-8 py-3
        shadow-[0_16px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(99,102,241,0.08)]
        hover:border-slate-700/60
        transition-all duration-300
      "
      role="status"
      aria-label="System status"
    >
      <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <Lock className="w-3 h-3 text-cyan-400 animate-pulse" aria-hidden />
        Secure TLS 1.3
      </span>

      <div className="w-px h-3 bg-slate-800" aria-hidden />

      <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <RefreshCw className="w-3 h-3 text-indigo-400 animate-slow-spin" aria-hidden />
        Real-time Sync
      </span>

      <div className="w-px h-3 bg-slate-800" aria-hidden />

      <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <Cpu className="w-3 h-3 text-purple-400 animate-pulse" aria-hidden />
        AI Processing
      </span>

      <div className="w-px h-3 bg-slate-800" aria-hidden />

      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
        <Wifi className={`w-3 h-3 ${agentOnline ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} aria-hidden />
        <span className={agentOnline ? 'text-emerald-400' : 'text-slate-600'}>
          {agentOnline ? 'Agent Online' : 'Agent Offline'}
        </span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatToggleButton
// ─────────────────────────────────────────────────────────────────────────────

function ChatToggleButton({
  isOpen,
  onToggle,
  unreadCount,
}: {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={isOpen}
      aria-label={isOpen ? 'Hide conversation transcript' : 'Show conversation transcript'}
      className={`
        relative flex items-center gap-2.5 px-4 py-2 rounded-xl
        text-[12px] font-semibold
        border transition-all duration-300
        ${isOpen
          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
          : 'bg-slate-900/70 border-slate-700/50 text-slate-400 hover:border-slate-600/70 hover:text-slate-200'
        }
        backdrop-blur-sm
      `}
    >
      <MessageSquare className="w-4 h-4" aria-hidden />
      {isOpen ? 'Hide Chat' : 'Show Chat'}
      {!isOpen && unreadCount > 0 && (
        <span className="
          absolute -top-1.5 -right-1.5
          w-4 h-4 rounded-full
          bg-cyan-400 text-slate-950
          text-[8px] font-black
          flex items-center justify-center
          border border-slate-950
        " aria-label={`${unreadCount} unread messages`}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AICallCenter — root component
// ─────────────────────────────────────────────────────────────────────────────

type OrbStateSetter = (s: OrbState) => void;

export default function AICallCenter() {
  // ── State ─────────────────────────────────────────────────────────────
  const [callState, setCallState]       = useState<string>('idle');
  const [orbState,  setOrbState]        = useState<OrbState>('idle');
  const [transcript, setTranscript]     = useState<Msg[]>([]);
  const [simTranscript, setSimTranscript] = useState<Msg[]>([]);
  const [isChatOpen, setIsChatOpen]     = useState(false);
  const [error,  setError]              = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMicEnabled,  setIsMicEnabled]   = useState(true);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [volumeLevel, setVolumeLevel]   = useState(70);
  const [liveStats, setLiveStats]       = useState<{ patients?: number; doctors?: number } | null>(null);
  const [agentOnline, setAgentOnline]   = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────
  const roomRef          = useRef<any>(null);
  const timerRef         = useRef<any>(null);
  const connectingRef    = useRef(false);
  const audioElemsRef    = useRef<HTMLAudioElement[]>([]);

  // ── Orb state machine ─────────────────────────────────────────────────
  const advanceOrb = useCallback((cs: string, spk?: 'user' | 'agent' | 'none') => {
    if (cs === 'idle')             return setOrbState('idle');
    if (cs === 'connecting')       return setOrbState('connecting');
    if (cs === 'waiting_for_agent') return setOrbState('waiting');
    if (cs === 'ended')            return setOrbState('ended');
    if (cs === 'error')            return setOrbState('error');
    if (cs === 'connected') {
      if (spk === 'user')  return setOrbState('listening');
      if (spk === 'agent') return setOrbState('responding');
      return setOrbState('thinking');
    }
  }, []);

  // ── Track unread messages when chat is closed ─────────────────────────
  const addMessage = useCallback((msg: Msg) => {
    setTranscript(prev => [...prev, msg]);
    setIsChatOpen(prev => {
      if (!prev) setUnreadCount(c => c + 1);
      return prev;
    });
  }, []);

  // ── Fetch backend stats + agent availability ──────────────────────────
  useEffect(() => {
    api.getStats()
      .then((d: any) => setLiveStats({ patients: d?.total_patients, doctors: d?.total_doctors }))
      .catch(() => {});

    try {
      const ws = api.createAgentWebSocket();
      ws.addEventListener('open',  () => { setAgentOnline(true);  ws.close(); });
      ws.addEventListener('error', () =>   setAgentOnline(false));
    } catch { setAgentOnline(false); }
  }, []);

  // ── Idle simulation (demo transcript when not connected) ──────────────
  useEffect(() => {
    if (callState !== 'idle') { setSimTranscript([]); return; }
    setSimTranscript([]);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (ms: number, m: Msg) =>
      timers.push(setTimeout(() => setSimTranscript(p => [...p, m]), ms));

    push(600,  { id: 's1', role: 'agent', text: "Hello! I'm your AI health assistant. How can I help you today?", time: new Date().toLocaleTimeString(), isStreaming: true });
    push(4000, { id: 's2', role: 'user',  text: "Hi, I need to schedule an appointment with a cardiologist.", time: new Date().toLocaleTimeString(), isStreaming: true });
    push(6500, { id: 'st', role: 'typing', text: '' });
    push(9000, { id: 's3', role: 'agent', text: "Of course! Can you confirm your full name and date of birth?", time: new Date().toLocaleTimeString(), isStreaming: true });

    return () => timers.forEach(clearTimeout);
  }, [callState]);

  // Merge live + sim transcripts
  const activeMessages = useMemo(
    () => transcript.length > 0 ? transcript : simTranscript,
    [transcript, simTranscript],
  );

  // ── LiveKit connection ────────────────────────────────────────────────
  const connectToAgent = useCallback(async () => {
    if (connectingRef.current || callState === 'connected' || callState === 'connecting') return;
    connectingRef.current = true;
    setError('');
    setCallState('connecting');
    advanceOrb('connecting');
    setTranscript([]);
    setCallDuration(0);

    try {
      const roomName       = `clinic-${Date.now()}`;
      const participantName = `patient-${Math.random().toString(36).slice(2, 8)}`;
      const tokenData      = await api.getLiveKitToken({ room_name: roomName, participant_name: participantName });

      const { Room, RoomEvent, Track } = await import('livekit-client');
      if (roomRef.current) await roomRef.current.disconnect();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: { audioPreset: { maxBitrate: 48_000 }, dtx: false, stopMicTrackOnMute: false },
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: any, _: any, participant: any) => {
        if (track.kind !== Track.Kind.Audio) return;
        document.getElementById(`audio-${participant.sid}`)?.remove();
        const el = track.attach() as HTMLAudioElement;
        el.id = `audio-${participant.sid}`;
        el.autoplay = true;
        el.style.display = 'none';
        el.muted  = isSpeakerMuted;
        el.volume = volumeLevel / 100;
        document.body.appendChild(el);
        audioElemsRef.current.push(el);
        el.play().catch(() => {});
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: any, _: any, participant: any) => {
        track.detach().forEach((el: HTMLElement) => el.remove());
        document.getElementById(`audio-${participant?.sid}`)?.remove();
      });

      room.on(RoomEvent.TranscriptionReceived, (segments: any[], participant: any) => {
        for (const seg of segments) {
          if (!seg.final || !seg.text.trim()) continue;
          const role: MsgRole = participant?.identity?.toLowerCase().includes('agent') ? 'agent' : 'user';
          advanceOrb('connected', role === 'agent' ? 'agent' : 'user');
          setTimeout(() => advanceOrb('connected', 'none'), 1200);
          setTranscript(prev =>
            prev.some(t => t.id === seg.id)
              ? prev
              : [...prev, { id: seg.id, role, text: seg.text, time: new Date().toLocaleTimeString(), isStreaming: true }],
          );
          if (!isChatOpen) setUnreadCount(c => c + 1);
        }
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (!msg.text) return;
          const role: MsgRole = participant?.identity?.toLowerCase().includes('agent') ? 'agent' : 'user';
          setTranscript(prev =>
            prev.some(t => t.text === msg.text)
              ? prev
              : [...prev, { id: Date.now(), role, text: msg.text, time: new Date().toLocaleTimeString(), isStreaming: true }],
          );
          if (!isChatOpen) setUnreadCount(c => c + 1);
        } catch {}
      });

      room.on(RoomEvent.ParticipantConnected, (participant: any) => {
        if (!participant.identity.toLowerCase().includes('agent')) return;
        setTranscript(prev => [
          ...prev,
          { id: Date.now(), role: 'system', text: 'AI Receptionist is now active.' },
        ]);
        setCallState('connected');
        setAgentOnline(true);
        advanceOrb('connected', 'none');
        if (!timerRef.current) timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
        if (participant.identity.toLowerCase().includes('agent')) {
          setAgentOnline(false);
          setTranscript(prev => [
            ...prev,
            { id: Date.now(), role: 'system', text: 'AI Receptionist has left the room.' },
          ]);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setCallState('ended');
        setAgentOnline(false);
        advanceOrb('ended');
        clearInterval(timerRef.current);
        connectingRef.current = false;
      });

      await room.connect(tokenData.url, tokenData.token);

      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          await room.localParticipant.setMicrophoneEnabled(isMicEnabled, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        } catch {
          setError('Listening only — microphone access denied.');
        }
      } else {
        setError('Listening only — insecure context. Open localhost:3000.');
      }

      const hasAgent = Array.from(room.remoteParticipants.values()).some(
        (p: any) => p.identity.toLowerCase().includes('agent'),
      );
      if (hasAgent) {
        setCallState('connected');
        setAgentOnline(true);
        advanceOrb('connected', 'none');
        if (!timerRef.current) timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      } else {
        setCallState('waiting_for_agent');
        advanceOrb('waiting_for_agent');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed — check backend.');
      setCallState('error');
      advanceOrb('error');
    } finally {
      connectingRef.current = false;
    }
  }, [callState, isMicEnabled, isSpeakerMuted, volumeLevel, advanceOrb, isChatOpen]);

  const hangUp = useCallback(async () => {
    clearInterval(timerRef.current);
    audioElemsRef.current.forEach(el => { el.pause(); el.remove(); });
    audioElemsRef.current = [];
    if (roomRef.current) { await roomRef.current.disconnect(); roomRef.current = null; }
    setCallState('ended');
    setAgentOnline(false);
    advanceOrb('ended');
  }, [advanceOrb]);

  const resetSession = useCallback(() => {
    setCallState('idle');
    advanceOrb('idle');
    setTranscript([]);
    setCallDuration(0);
    setError('');
    setUnreadCount(0);
  }, [advanceOrb]);

  const toggleMic = async () => {
    const n = !isMicEnabled;
    setIsMicEnabled(n);
    if (roomRef.current && callState === 'connected')
      await roomRef.current.localParticipant.setMicrophoneEnabled(n).catch(() => {});
  };

  const toggleSpeaker = () => {
    const n = !isSpeakerMuted;
    setIsSpeakerMuted(n);
    audioElemsRef.current.forEach(el => (el.muted = n));
  };

  const handleVolumeChange = (v: number) => {
    setVolumeLevel(v);
    audioElemsRef.current.forEach(el => (el.volume = v / 100));
  };

  // Reset unread when chat opens
  const handleChatToggle = () => {
    setIsChatOpen(p => !p);
    setUnreadCount(0);
  };

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(timerRef.current);
    audioElemsRef.current.forEach(el => el.remove());
    roomRef.current?.disconnect();
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <a href="#call-transcript" className="skip-link">Skip to conversation</a>

      {/*
        ── Root: full-height dark canvas ─────────────────────────────────
        We set position:relative so the chat panel and orb can be
        positioned absolutely without disturbing the layout.
      */}
      <div
        className="
          relative flex flex-col
          bg-[#030712] text-slate-100
          w-full min-h-screen
          overflow-hidden
        "
        style={{ fontFamily: 'var(--font-sans)' }}
        role="region"
        aria-label="AI Voice Agent Dashboard"
      >

        {/* ── Ambient Background Glows ─────────────────────────────────── */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {/* Top-right cyan glow */}
          <div
            className="absolute top-0 right-0 rounded-full pointer-events-none"
            style={{
              width: 700, height: 700,
              background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
              animation: 'ambient-drift-1 12s ease-in-out infinite',
            }}
          />
          {/* Bottom-left purple glow */}
          <div
            className="absolute bottom-0 left-0 rounded-full pointer-events-none"
            style={{
              width: 700, height: 700,
              background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)',
              animation: 'ambient-drift-2 15s ease-in-out infinite',
            }}
          />
          {/* Centre subtle radial */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 100%)',
            }}
          />
        </div>

        {/* ── Top Header Row ────────────────────────────────────────────── */}
        <div className="
          relative z-20 flex items-center justify-between
          px-6 py-4
          border-b border-slate-800/40
          bg-slate-950/30 backdrop-blur-sm
          shrink-0
        ">
          {/* Left — branding */}
          <div className="flex items-center gap-3">
            <div className="
              w-8 h-8 rounded-lg
              bg-gradient-to-tr from-cyan-500 to-indigo-600
              flex items-center justify-center
              shadow-[0_0_16px_rgba(6,182,212,0.4)]
            " aria-hidden>
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-200 leading-none tracking-tight">
                AI Voice Agent
              </p>
              <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">
                Healthcare Assistant · v2.0
              </p>
            </div>
          </div>

          {/* Right — chat toggle + stats pill */}
          <div className="flex items-center gap-3">
            {liveStats && (
              <div className="
                hidden sm:flex items-center gap-4
                text-[10px] font-semibold text-slate-500 uppercase tracking-wider
              ">
                {liveStats.patients != null && <span>{liveStats.patients} Patients</span>}
                {liveStats.doctors  != null && <span>{liveStats.doctors} Physicians</span>}
              </div>
            )}
            <ChatToggleButton
              isOpen={isChatOpen}
              onToggle={handleChatToggle}
              unreadCount={unreadCount}
            />
          </div>
        </div>

        {/* ── Body: canvas area ─────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">

          {/* ── Glassmorphism Chat Panel (absolutely positioned left) ───── */}
          <GlassChatPanel
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={activeMessages}
            callState={callState}
            agentOnline={agentOnline}
            liveStats={liveStats}
          />

          {/* ── Absolutely Centred Voice Orb ─────────────────────────────
              This div is always 100% of the parent, centred with flexbox.
              The chat panel slides over it on the left — the orb never moves.
          */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-20 pointer-events-none z-10">

            {/* Orb + surrounding controls */}
            <div className="pointer-events-auto">
              <VoiceOrb
                orbState={orbState}
                roomRef={roomRef}
                volumeLevel={volumeLevel}
                callState={callState}
                callDuration={callDuration}
                isMicEnabled={isMicEnabled}
                isSpeakerMuted={isSpeakerMuted}
                onToggleMic={toggleMic}
                onToggleSpeaker={toggleSpeaker}
                onVolumeChange={handleVolumeChange}
                onConnect={connectToAgent}
                onHangUp={hangUp}
                onReset={resetSession}
                error={error}
              />
            </div>

            {/* CTA action button below the orb */}
            <div className="pointer-events-auto mt-6">
              <CallActionButton
                callState={callState}
                onConnect={connectToAgent}
                onHangUp={hangUp}
                onReset={resetSession}
                onCancelAllocation={hangUp}
              />
            </div>
          </div>
        </div>

        {/* ── Bottom Status Bar ────────────────────────────────────────── */}
        <div className="
          relative z-20
          flex justify-center
          px-6 py-4
          border-t border-slate-800/40
          bg-slate-950/30 backdrop-blur-sm
          shrink-0
        ">
          <StatusBar agentOnline={agentOnline} />
        </div>

      </div>
    </>
  );
}
