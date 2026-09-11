"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlaybackTicket } from "@masti/types";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

type State =
  | { phase: "loading" }
  | { phase: "need-login" }
  | { phase: "need-subscription" }
  | { phase: "error"; message: string }
  | { phase: "ready"; ticket: PlaybackTicket };

export function Player({ kind, id }: { kind: "movie" | "episode"; id: string }) {
  const { authFetch, loggedIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!loggedIn) {
      setState({ phase: "need-login" });
      return;
    }
    const body = kind === "movie" ? { movieId: id } : { episodeId: id };
    authFetch("/playback/token", { method: "POST", body: JSON.stringify(body) })
      .then(async (res) => {
        if (res.status === 402) return setState({ phase: "need-subscription" });
        if (res.status === 401) return setState({ phase: "need-login" });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          return setState({ phase: "error", message: e?.error?.message ?? "Playback unavailable" });
        }
        setState({ phase: "ready", ticket: (await res.json()) as PlaybackTicket });
      })
      .catch(() => setState({ phase: "error", message: "Network error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, loggedIn, kind, id]);

  if (state.phase === "loading")
    return <Centered><div className="animate-pulse text-muted">Loading player…</div></Centered>;
  if (state.phase === "need-login")
    return <Wall title="Login to watch" cta="Login" onClick={() => router.push("/login")}>Aapko is content ko dekhne ke liye login karna hoga.</Wall>;
  if (state.phase === "need-subscription")
    return <Wall title="Masti Premium required" cta="Get Premium" onClick={() => router.push("/subscription")}>Yeh premium content hai. Subscribe karke poori masti dekhiye.</Wall>;
  if (state.phase === "error")
    return <Wall title="Video load nahi ho pa raha" cta="Go Home" onClick={() => router.push("/")}>{state.message}. Please try again.</Wall>;

  return <VideoStage ticket={state.ticket} kind={kind} id={id} authFetch={authFetch} />;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

function VideoStage({
  ticket,
  kind,
  id,
  authFetch,
}: {
  ticket: PlaybackTicket;
  kind: "movie" | "episode";
  id: string;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFull, setIsFull] = useState(false);
  const [pseudoFull, setPseudoFull] = useState(false);
  const [seekHover, setSeekHover] = useState<{ x: number; time: number } | null>(null);
  const [tap, setTap] = useState<{ side: "L" | "R"; key: number } | null>(null);

  const lastSaved = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ t: number; side: string }>({ t: 0, side: "" });
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewReady = useRef(false);
  const previewSeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamUrl = ticket.streamUrl.startsWith("/")
    ? `${API_BASE}${ticket.streamUrl}`
    : ticket.streamUrl;

  // ---- Attach HLS to the main video ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: import("hls.js").default | null = null;
    const seek = () => {
      if (ticket.startPositionSec > 0) video.currentTime = ticket.startPositionSec;
      video.play().catch(() => {});
    };
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", seek, { once: true });
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            startLevel: -1,
            abrEwmaDefaultEstimate: 600_000,
            maxBufferLength: 20,
            maxMaxBufferLength: 60,
            backBufferLength: 30,
          });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, seek);
        } else {
          video.src = streamUrl;
          video.addEventListener("loadedmetadata", seek, { once: true });
        }
      });
    }
    return () => hls?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Progress save ----
  const saveProgress = useCallback(
    (force = false) => {
      const video = videoRef.current;
      if (!video || !video.duration || Number.isNaN(video.duration)) return;
      const now = video.currentTime;
      if (!force && Math.abs(now - lastSaved.current) < 15) return;
      lastSaved.current = now;
      authFetch("/watch/progress", {
        method: "POST",
        body: JSON.stringify({
          ...(kind === "movie" ? { movieId: id } : { episodeId: id }),
          positionSec: Math.floor(now),
          durationSec: Math.floor(video.duration),
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [authFetch, kind, id],
  );
  useEffect(() => () => saveProgress(true), [saveProgress]);

  // ---- Video element events ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrent(v.currentTime);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
      saveProgress(false);
    };
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); saveProgress(true); };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onVol = () => { setMuted(v.muted); setVolume(v.volume); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("volumechange", onVol);
    };
  }, [saveProgress]);

  // ---- Fullscreen ----
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const isFsNow = !!document.fullscreenElement || pseudoFull;
    if (isFsNow) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPseudoFull(false);
      return;
    }
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        // If it silently didn't take effect (blocked/no-op), use pseudo-fullscreen.
        setTimeout(() => {
          if (!document.fullscreenElement) setPseudoFull(true);
        }, 150);
      } else {
        // iOS Safari: fullscreen only on the video element itself.
        const v = videoRef.current as any;
        if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
        else setPseudoFull(true);
      }
    } catch {
      // Fullscreen API blocked (e.g. inside an iframe) → CSS pseudo-fullscreen.
      setPseudoFull(true);
    }
  }, [pseudoFull]);

  // ---- Controls auto-hide ----
  const nudgeControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setShowControls(false);
    }, 3000);
  }, []);

  // ---- Playback helpers ----
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + delta));
    nudgeControls();
  }, [nudgeControls]);

  const flashTap = (side: "L" | "R") => {
    setTap({ side, key: Date.now() });
    setTimeout(() => setTap(null), 550);
  };

  // Single tap toggles controls; double tap on a side seeks ±10s.
  const onZoneTap = (side: "L" | "R") => {
    const now = Date.now();
    if (now - lastTap.current.t < 320 && lastTap.current.side === side) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = { t: 0, side: "" };
      seekBy(side === "L" ? -10 : 10);
      flashTap(side);
    } else {
      lastTap.current = { t: now, side };
      singleTapTimer.current = setTimeout(() => {
        setShowControls((s) => !s);
        nudgeControls();
        lastTap.current = { t: 0, side: "" };
      }, 300);
    }
  };

  // ---- Seek bar (hover preview + click to seek) ----
  const timeAtClientX = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !duration) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const ensurePreview = useCallback(() => {
    if (previewReady.current) return;
    const pv = previewVideoRef.current;
    if (!pv) return;
    previewReady.current = true;
    if (pv.canPlayType("application/vnd.apple.mpegurl")) {
      pv.src = streamUrl;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const ph = new Hls({ enableWorker: true, maxBufferLength: 2, maxMaxBufferLength: 4 });
          ph.loadSource(streamUrl);
          ph.attachMedia(pv);
        } else {
          pv.src = streamUrl;
        }
      });
    }
  }, [streamUrl]);

  const onBarMove = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const time = timeAtClientX(clientX);
    setSeekHover({ x, time });
    // Update the thumbnail (debounced) from the hidden preview video.
    ensurePreview();
    if (previewSeekTimer.current) clearTimeout(previewSeekTimer.current);
    previewSeekTimer.current = setTimeout(() => {
      const pv = previewVideoRef.current;
      if (!pv) return;
      try {
        pv.currentTime = time;
      } catch {
        /* not seekable yet */
      }
    }, 120);
  };

  useEffect(() => {
    const pv = previewVideoRef.current;
    if (!pv) return;
    // The canvas is only mounted while hovering, so look it up at draw time.
    const draw = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        ctx.drawImage(pv, 0, 0, canvas.width, canvas.height);
      } catch {
        /* frame not ready yet */
      }
    };
    pv.addEventListener("seeked", draw);
    return () => pv.removeEventListener("seeked", draw);
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); nudgeControls(); break;
        case "ArrowRight": seekBy(10); flashTap("R"); break;
        case "ArrowLeft": seekBy(-10); flashTap("L"); break;
        case "f": toggleFullscreen(); break;
        case "m": { const v = videoRef.current; if (v) v.muted = !v.muted; break; }
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, nudgeControls]);

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const fullscreenActive = isFull || pseudoFull;

  return (
    <div>
      <div
        ref={containerRef}
        className={`group relative mx-auto aspect-video w-full max-w-6xl select-none overflow-hidden bg-black ${
          pseudoFull ? "fixed inset-0 z-[9999] max-w-none" : ""
        }`}
        onMouseMove={nudgeControls}
        style={{ cursor: showControls ? "default" : "none" }}
      >
        <video ref={videoRef} playsInline className="h-full w-full bg-black" />

        {/* Double-tap zones (seek). Center gap left for a play toggle. */}
        <div className="absolute inset-0 flex">
          <div className="h-full w-[38%]" onClick={() => onZoneTap("L")} />
          <div className="h-full w-[24%]" onClick={togglePlay} />
          <div className="h-full w-[38%]" onClick={() => onZoneTap("R")} />
        </div>

        {/* Buffering spinner */}
        {waiting && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-accent" />
          </div>
        )}

        {/* Double-tap indicators */}
        {tap && (
          <div
            key={tap.key}
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-5 py-4 text-white ${
              tap.side === "L" ? "left-[12%]" : "right-[12%]"
            }`}
          >
            {tap.side === "L" ? "« 10s" : "10s »"}
          </div>
        )}

        {/* Back button (top) */}
        {showControls && !fullscreenActive && (
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3">
            <Link href="/" className="pointer-events-auto text-sm text-white/90 hover:text-white">
              ‹ Back
            </Link>
          </div>
        )}

        {/* Controls bar */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 transition-opacity ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Seek bar */}
          <div
            ref={barRef}
            className="group/bar relative mb-2 flex h-4 cursor-pointer items-center"
            onMouseMove={(e) => onBarMove(e.clientX)}
            onMouseLeave={() => setSeekHover(null)}
            onClick={(e) => {
              const v = videoRef.current;
              if (v) v.currentTime = timeAtClientX(e.clientX);
            }}
          >
            <div className="relative h-1 w-full rounded bg-white/25 group-hover/bar:h-1.5">
              <div className="absolute left-0 top-0 h-full rounded bg-white/30" style={{ width: `${bufPct}%` }} />
              <div className="absolute left-0 top-0 h-full rounded bg-accent" style={{ width: `${pct}%` }} />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${pct}%` }} />
            </div>

            {/* Hover preview (thumbnail + time) */}
            {seekHover && (
              <div
                className="pointer-events-none absolute bottom-6 -translate-x-1/2"
                style={{ left: `${seekHover.x}px` }}
              >
                <canvas
                  ref={previewCanvasRef}
                  width={160}
                  height={90}
                  className="rounded-md bg-black ring-1 ring-white/20"
                />
                <div className="mt-1 text-center text-xs font-semibold text-white">{fmt(seekHover.time)}</div>
              </div>
            )}
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3 text-white">
            <button onClick={togglePlay} className="text-xl" aria-label="Play/Pause">
              {playing ? "❚❚" : "►"}
            </button>
            <button onClick={() => seekBy(-10)} aria-label="Back 10s" className="text-sm">« 10</button>
            <button onClick={() => seekBy(10)} aria-label="Forward 10s" className="text-sm">10 »</button>
            <button
              onClick={() => { const v = videoRef.current; if (v) v.muted = !v.muted; }}
              aria-label="Mute"
              className="text-lg"
            >
              {muted || volume === 0 ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => { const v = videoRef.current; if (v) { v.volume = Number(e.target.value); v.muted = false; } }}
              className="hidden w-20 accent-accent sm:block"
              aria-label="Volume"
            />
            <span className="ml-1 text-xs tabular-nums text-white/90">
              {fmt(current)} / {fmt(duration)}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={toggleFullscreen} aria-label="Fullscreen" className="text-lg">
                {fullscreenActive ? "⤢" : "⛶"}
              </button>
            </div>
          </div>
        </div>

        {/* Hidden video used only to render seek-bar thumbnails */}
        <video ref={previewVideoRef} muted playsInline preload="none" className="hidden" />
      </div>

      {!fullscreenActive && (
        <div className="px-4 py-4 sm:px-8">
          <Link href="/" className="text-sm text-muted hover:text-white">‹ Back to browse</Link>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[60vh] place-items-center">{children}</div>;
}

function Wall({ title, children, cta, onClick }: { title: string; children: React.ReactNode; cta: string; onClick: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="max-w-md">
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-2 text-muted">{children}</p>
        <button onClick={onClick} className="mt-5 rounded-md bg-accent px-6 py-2.5 font-bold text-black hover:bg-accent-2">
          {cta}
        </button>
      </div>
    </div>
  );
}
