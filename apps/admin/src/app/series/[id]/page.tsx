"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdmin } from "@/lib/adminAuth";
import { Field, Toggle, Modal, StatusBadge, PlatformPicker } from "@/components/ui";

interface Genre { id: string; name: string }
interface Language { id: string; name: string }

export default function SeriesEditor() {
  const { adminFetch, can } = useAdmin();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const readOnly = !can("content.manage");

  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [epModal, setEpModal] = useState<{ seasonId: string; ep?: any } | null>(null);

  const [form, setForm] = useState<any>({
    title: "", slug: "", description: "", poster: "", backdrop: "", trailerUrl: "",
    year: "", ageRating: "", access: "PREMIUM", status: "DRAFT",
    isFeatured: false, isTrending: false, isTop10: false, languageId: "", genreIds: [] as string[],
    platforms: ["WEB", "ANDROID"] as string[],
  });
  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    adminFetch("/admin/content/genres").then((r) => r.json()).then((d) => setGenres(d.items));
    adminFetch("/admin/content/languages").then((r) => r.json()).then((d) => setLanguages(d.items));
  }, [adminFetch]);

  const loadSeries = useCallback(() => {
    if (isNew) return;
    adminFetch(`/admin/content/series/${params.id}`).then((r) => r.json()).then((s) => {
      setForm({
        title: s.title, slug: s.slug, description: s.description ?? "", poster: s.poster ?? "",
        backdrop: s.backdrop ?? "", trailerUrl: s.trailerUrl ?? "", year: s.year ?? "",
        ageRating: s.ageRating ?? "", access: s.access, status: s.status,
        isFeatured: s.isFeatured, isTrending: s.isTrending, isTop10: s.isTop10,
        languageId: s.languageId ?? "", genreIds: s.genres.map((g: Genre) => g.id),
        platforms: s.platforms ?? ["WEB", "ANDROID"],
      });
      setSeasons(s.seasons);
      setLoaded(true);
    });
  }, [isNew, params.id, adminFetch]);
  useEffect(loadSeries, [loadSeries]);

  const slugAuto = useMemo(() => form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), [form.title]);

  const save = async () => {
    setSaving(true); setMsg("");
    const payload = { ...form, slug: form.slug || slugAuto, year: form.year ? Number(form.year) : null, languageId: form.languageId || null };
    const res = isNew
      ? await adminFetch("/admin/content/series", { method: "POST", body: JSON.stringify(payload) })
      : await adminFetch(`/admin/content/series/${params.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => null); return setMsg(e?.error?.message ?? "Save failed"); }
    const s = await res.json();
    if (isNew) router.replace(`/series/${s.id}`); else setMsg("Saved ✓");
  };

  const addSeason = async () => {
    const number = seasons.length + 1;
    await adminFetch(`/admin/content/series/${params.id}/seasons`, { method: "POST", body: JSON.stringify({ number }) });
    loadSeries();
  };
  const delSeason = async (id: string) => {
    if (!confirm("Delete this season and its episodes?")) return;
    await adminFetch(`/admin/content/seasons/${id}`, { method: "DELETE" });
    loadSeries();
  };
  const delEpisode = async (id: string) => {
    if (!confirm("Delete this episode?")) return;
    await adminFetch(`/admin/content/episodes/${id}`, { method: "DELETE" });
    loadSeries();
  };

  if (!loaded) return <div className="text-slate-400">Loading…</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{isNew ? "New Series" : form.title || "Edit Series"}</h1>
        <button onClick={() => router.push("/series")} className="btn-ghost">← Back</button>
      </div>

      <div className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Slug"><input className="input" value={form.slug} placeholder={slugAuto} onChange={(e) => set("slug", e.target.value)} disabled={readOnly} /></Field>
        </div>
        <Field label="Description"><textarea className="input h-20" value={form.description} onChange={(e) => set("description", e.target.value)} disabled={readOnly} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Poster URL"><input className="input" value={form.poster} onChange={(e) => set("poster", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Backdrop URL"><input className="input" value={form.backdrop} onChange={(e) => set("backdrop", e.target.value)} disabled={readOnly} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Year"><input className="input" value={form.year} onChange={(e) => set("year", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Age rating"><input className="input" value={form.ageRating} onChange={(e) => set("ageRating", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Access">
            <select className="input" value={form.access} onChange={(e) => set("access", e.target.value)} disabled={readOnly}>
              <option value="FREE">FREE</option><option value="PREMIUM">PREMIUM</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)} disabled={readOnly}>
              {["DRAFT", "PUBLISHED", "SCHEDULED", "UNPUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Language">
          <select className="input w-56" value={form.languageId} onChange={(e) => set("languageId", e.target.value)} disabled={readOnly}>
            <option value="">—</option>
            {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <div>
          <span className="label">Genres</span>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const on = form.genreIds.includes(g.id);
              return <button key={g.id} type="button" disabled={readOnly}
                onClick={() => set("genreIds", on ? form.genreIds.filter((x: string) => x !== g.id) : [...form.genreIds, g.id])}
                className={`rounded-full px-3 py-1 text-sm ${on ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{g.name}</button>;
            })}
          </div>
        </div>
        <div className="flex gap-6 border-t border-slate-100 pt-4">
          <Toggle checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} label="Featured" />
          <Toggle checked={form.isTrending} onChange={(v) => set("isTrending", v)} label="Trending" />
          <Toggle checked={form.isTop10} onChange={(v) => set("isTop10", v)} label="Top 10" />
        </div>
        <div className="border-t border-slate-100 pt-4">
          <span className="label">Available on (platforms)</span>
          <PlatformPicker value={form.platforms} onChange={(v) => set("platforms", v)} />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : isNew ? "Create Series" : "Save Changes"}</button>
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </div>
        )}
      </div>

      {/* Seasons & episodes — only after the series exists */}
      {!isNew && (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Seasons & Episodes</h2>
            {!readOnly && <button onClick={addSeason} className="btn-ghost">+ Add Season</button>}
          </div>
          {seasons.length === 0 && <p className="text-sm text-slate-400">No seasons yet.</p>}
          <div className="space-y-5">
            {seasons.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                  <span className="font-semibold">{s.title ?? `Season ${s.number}`}</span>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <button onClick={() => setEpModal({ seasonId: s.id })} className="text-sm text-brand hover:underline">+ Episode</button>
                      <button onClick={() => delSeason(s.id)} className="text-sm text-red-500 hover:underline">Delete season</button>
                    </div>
                  )}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {s.episodes.length === 0 ? (
                      <tr><td className="px-4 py-3 text-slate-400">No episodes.</td></tr>
                    ) : s.episodes.map((e: any) => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-medium">E{e.number}. {e.title}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={e.access} /></td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{e.videoAsset?.streamUrl ? "stream set" : "no video"}</td>
                        {!readOnly && (
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => setEpModal({ seasonId: s.id, ep: e })} className="text-brand hover:underline">Edit</button>
                            <button onClick={() => delEpisode(e.id)} className="ml-3 text-red-500 hover:underline">Delete</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {epModal && (
        <EpisodeModal
          seasonId={epModal.seasonId}
          ep={epModal.ep}
          onClose={() => setEpModal(null)}
          onSaved={() => { setEpModal(null); loadSeries(); }}
        />
      )}
    </div>
  );
}

function EpisodeModal({ seasonId, ep, onClose, onSaved }: { seasonId: string; ep?: any; onClose: () => void; onSaved: () => void }) {
  const { adminFetch } = useAdmin();
  const [f, setF] = useState<any>({
    number: ep?.number ?? 1, title: ep?.title ?? "", description: ep?.description ?? "",
    thumbnail: ep?.thumbnail ?? "", durationSec: ep?.durationSec ?? "", introEndSec: ep?.introEndSec ?? "",
    access: ep?.access ?? "PREMIUM", status: ep?.status ?? "PUBLISHED", streamUrl: ep?.videoAsset?.streamUrl ?? "",
  });
  const set = (k: string, v: unknown) => setF((p: any) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true); setErr("");
    const payload = { ...f, number: Number(f.number), durationSec: f.durationSec ? Number(f.durationSec) : null, introEndSec: f.introEndSec ? Number(f.introEndSec) : null, streamUrl: f.streamUrl || null };
    const res = ep
      ? await adminFetch(`/admin/content/episodes/${ep.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await adminFetch(`/admin/content/seasons/${seasonId}/episodes`, { method: "POST", body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => null); return setErr(e?.error?.message ?? "Save failed"); }
    onSaved();
  };

  return (
    <Modal title={ep ? "Edit Episode" : "Add Episode"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <Field label="No."><input className="input" value={f.number} onChange={(e) => set("number", e.target.value)} /></Field>
          <div className="col-span-3"><Field label="Title"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} /></Field></div>
        </div>
        <Field label="Description"><textarea className="input h-16" value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Thumbnail URL"><input className="input" value={f.thumbnail} onChange={(e) => set("thumbnail", e.target.value)} /></Field>
        <Field label="Stream URL (HLS)"><input className="input" value={f.streamUrl} onChange={(e) => set("streamUrl", e.target.value)} /></Field>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Duration s"><input className="input" value={f.durationSec} onChange={(e) => set("durationSec", e.target.value)} /></Field>
          <Field label="Intro end s"><input className="input" value={f.introEndSec} onChange={(e) => set("introEndSec", e.target.value)} /></Field>
          <Field label="Access">
            <select className="input" value={f.access} onChange={(e) => set("access", e.target.value)}><option>FREE</option><option>PREMIUM</option></select>
          </Field>
          <Field label="Status">
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>{["DRAFT", "PUBLISHED", "UNPUBLISHED"].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}
