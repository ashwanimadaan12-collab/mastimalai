"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin, API_BASE } from "@/lib/adminAuth";
import { StatusBadge } from "./ui";

interface Asset {
  status: string;
  streamUrl?: string | null;
  hlsPath?: string | null;
  durationSec?: number | null;
  renditions?: unknown;
}

// Video upload + transcode status for a movie or episode.
export function VideoPanel({ kind, id }: { kind: "movie" | "episode"; id: string }) {
  const { adminFetch, can } = useAdmin();
  const manage = can("content.manage");
  const [asset, setAsset] = useState<Asset | null | undefined>(undefined);
  const [ffmpeg, setFfmpeg] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endpoint = kind === "movie" ? `/admin/content/movies/${id}` : `/admin/content/episodes/${id}`;

  const load = useCallback(async () => {
    // Movies expose videoAsset directly; for episodes we read via the series tree,
    // so here we just re-fetch the movie/episode's own asset shape when available.
    const res = await adminFetch(kind === "movie" ? `/admin/content/movies/${id}` : `/admin/content/episodes/${id}/asset`);
    if (res.ok) {
      const d = await res.json();
      setAsset(d.videoAsset ?? d.asset ?? null);
    } else {
      setAsset(null);
    }
  }, [adminFetch, id, kind]);

  useEffect(() => {
    adminFetch("/admin/content/transcoder/status").then((r) => r.json()).then((d) => setFfmpeg(d.ffmpeg)).catch(() => setFfmpeg(false));
    if (kind === "movie") load();
    else setAsset(null);
  }, [adminFetch, load, kind]);

  // Poll while processing.
  useEffect(() => {
    if (asset?.status === "PROCESSING" || asset?.status === "UPLOADING") {
      pollRef.current = setInterval(load, 1500);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [asset?.status, load]);

  // Prefill the URL box with the current remote stream (so it's one click to optimise).
  useEffect(() => {
    if (asset?.streamUrl && !asset.streamUrl.includes("/streaming/local/") && !urlInput) {
      setUrlInput(asset.streamUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.streamUrl]);

  const transcodeUrl = async () => {
    if (!urlInput.trim()) return;
    setBusy("Pulling & transcoding…"); setErr("");
    const res = await adminFetch(`/admin/content/${kind}/${id}/transcode-url`, { method: "POST", body: JSON.stringify({ url: urlInput.trim() }) });
    setBusy("");
    if (!res.ok) { const e = await res.json().catch(() => null); return setErr(e?.error?.message ?? "Failed"); }
    setAsset({ status: "PROCESSING" });
  };

  const genSample = async () => {
    setBusy("Generating test clip…"); setErr("");
    const res = await adminFetch(`/admin/content/${kind}/${id}/sample-video`, { method: "POST", body: JSON.stringify({ seconds: 20 }) });
    setBusy("");
    if (!res.ok) { const e = await res.json().catch(() => null); return setErr(e?.error?.message ?? "Failed"); }
    setAsset({ status: "PROCESSING" });
  };

  const upload = async (file: File) => {
    setBusy(`Uploading ${(file.size / 1e6).toFixed(1)} MB…`); setErr("");
    const res = await fetch(`${API_BASE}/admin/content/${kind}/${id}/video?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", Authorization: `Bearer ${localStorage.getItem("mm_admin_token")}` },
      body: file,
    });
    setBusy("");
    if (!res.ok) { const e = await res.json().catch(() => null); return setErr(e?.error?.message ?? "Upload failed"); }
    setAsset({ status: "PROCESSING" });
  };

  const renditionCount = Array.isArray(asset?.renditions) ? asset!.renditions!.length : 0;
  const progress = asset?.renditions && !Array.isArray(asset.renditions) ? (asset.renditions as any).progress : null;

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Video & Transcoding</h2>
        {ffmpeg === false && <span className="text-xs text-red-500">ffmpeg not available on server</span>}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500">Status:</span>
        {asset === undefined ? <span className="text-slate-400">loading…</span> :
         asset === null ? <span className="text-slate-400">No video yet</span> :
         <>
           <StatusBadge status={asset.status} />
           {asset.status === "PROCESSING" && progress != null && <span className="text-slate-500">{progress}%</span>}
           {asset.status === "READY" && <span className="text-slate-500">{renditionCount} renditions · HLS ladder</span>}
         </>}
      </div>

      {asset?.status === "READY" && asset.streamUrl && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 break-all">
          {asset.streamUrl.includes("/streaming/local/") ? (
            <>Serving locally (transcoded HLS): <code>{asset.streamUrl.replace(API_BASE, "")}</code></>
          ) : (
            <>External stream (not transcoded): <code>{asset.streamUrl}</code></>
          )}
        </div>
      )}

      {manage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✓ Fastest way to add a video: paste its HLS <code>.m3u8</code> URL in the <b>Stream URL</b> field
          above and hit <b>Save Changes</b>. It plays immediately through the streaming proxy — no
          transcoding needed.
        </div>
      )}

      {manage && ffmpeg && (
        <details className="border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Optional: optimise this video (transcode) ▾
          </summary>
          <p className="mt-2 text-xs text-slate-400">
            Only needed if a source stream is slow or single-quality. Builds a 240p–1080p adaptive ladder
            in the background — <b>the current stream keeps playing</b> and only switches over when the new
            version is ready. Adding a video does <b>not</b> require this.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="input flex-1 min-w-[260px]"
              placeholder="https://…/master.m3u8"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <button onClick={transcodeUrl} className="btn-ghost" disabled={!!busy || !urlInput.trim()}>
              Transcode from URL
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button onClick={() => fileRef.current?.click()} className="btn-ghost" disabled={!!busy}>Upload video file</button>
            <input ref={fileRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <button onClick={genSample} className="btn-ghost" disabled={!!busy}>Generate test clip</button>
            {busy && <span className="text-sm text-slate-500">{busy}</span>}
            {(asset?.status === "PROCESSING" || asset?.status === "UPLOADING") && <span className="text-sm text-amber-600">Transcoding… (auto-refreshing)</span>}
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </details>
      )}
    </div>
  );
}
